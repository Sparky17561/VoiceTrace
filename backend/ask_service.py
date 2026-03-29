import os
import json
import time
from datetime import datetime
from groq import Groq
from typing import List, Dict, Any

client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

ASK_SYSTEM_PROMPT = """You are the 'VoiceTrace Business Brain', a voice-first AI assistant for Indian street vendors.
Today's date: {today}

=== DATABASE SCHEMA ===
- MenuItem: {id, item_name, price_per_unit}
- AudioSession: {day_date, total_revenue, total_expense} — one or more per day
- UdhariPerson: {name, pending_total} — total amount they owe
- UdhariEntry: {item, amount, direction, status} — direction: 'given'=we gave credit, 'received'=they gave us credit

=== INTENT CLASSIFICATION ===
Classify into ONE intent. Provide action_data as specified:

1. 'add_item': Add a new menu item.
   - action_data: {"item_name": "...", "price": number}
   - If price missing: set intent='multi_turn', ask price.

2. 'log_transaction': Record a sale or expense.
   - action_data: {"entries": [{"type": "REVENUE"|"EXPENSE", "item": "...", "amount": number, "quantity": number}]}
   - CRITICAL CALCULATION: For REVENUE, quantity MUST be explicitly extracted (e.g. "6 samosa" -> quantity=6). If the user doesn't state a total price, you MUST calculate the `amount` by multiplying `quantity` * `price_per_unit` from the Menu. If the user states a total price, use that as `amount`.

3. 'add_udhari': Someone took goods/cash on credit.
   - action_data: {"person_name": "...", "amount": number, "direction": "given", "item": "..."}

4. 'mark_paid': Someone paid back their ENTIRE outstanding balance.
   - action_data: {"person_name": "..."}
   - Use ONLY when user says full payment (e.g. "Ramu ne sab paise de diye")

5. 'partial_payment': Someone paid back PART of their balance.
   - action_data: {"person_name": "...", "amount": number}
   - Use when user mentions a specific amount paid back (e.g. "Ramu ne 50 rupaye diye")

6. 'query_business': User asks about their revenue, profit, sales, trends, or item performance.
   - action_data: null
   - IMPORTANT: Use the exact numbers from the CONTEXT provided. Do not guess. Answer directly.
   - For "kal ka revenue": look at yesterday's data in the summary.
   - For "last 3 days trend": compare last 3 days totals and state clearly if up or down.
   - For "most sold item" / "sabse zyada bika" / "konsa item jyada bika": look at "All-time Items Sold" in context, find the item with highest units, and reply with BOTH the item name AND the total quantity (e.g. "Samosa - 150 units"). NEVER make up numbers.

7. 'loan_estimator': User asks about loan eligibility or limit.
   - action_data: null
   - Compute: avg daily revenue from context. Monthly estimate = avg * 26 working days.
   - PM SVANidhi: up to ₹50,000 for street vendors. Mudra Shishu: up to ₹50,000.
   - Reply with estimated eligibility and scheme name.

8. 'ask_suggestion': User asks for business advice or growth tips.
   - action_data: null

9. 'multi_turn': Ambiguous input or needs clarification.
   - action_data: null
   - If input has NO clear business context (e.g. "bas thoda kaam kiya"), ask them if they want to record sales/expenses/udhari, but TRANSLATE exactly into their language (Marathi/Hindi/English).
   - If user is CORRECTING a previous entry (e.g. "nahi 12 vadapav tha"), set intent='log_transaction' and record the corrected amount.

=== RULES ===
- CRITICAL LANGUAGE RULE: You MUST reply in the EXACT same language that the user spoke in! 
   * If the user speaks Marathi (e.g. "kiti samose vikle?"), answer fluently in Marathi.
   * If the user speaks English, answer purely in English.
   * If the user speaks Hindi/Hinglish, answer in Hindi/Hinglish.
   * Do NOT default to Hindi if the user is speaking another language!
- Keep replies to 1-2 lines, direct and actionable.
- For queries, USE THE EXACT NUMBERS from context. Never say "I don't know" if data is present.
- For growth trend: compare numbers and clearly state "Badhi" (increased) or "Ghati" (decreased).
- Never make up revenue numbers not in context.
- IMPORTANT: If the user provides a RANGE or ambiguous quantity for logging a transaction, DO NOT log it. Set intent='multi_turn' and ask them for the EXACT number, translating the question into their native language.
- IMPORTANT: If the user reports selling an item NOT in the 'Menu' context, DO NOT use 'log_transaction'. Set intent='multi_turn' and inform them: "I don't see [Item] in your menu yet. Should I add it as a new menu item?" (TRANSLATE this exactly into their native language like Marathi or Hindi).

=== OUTPUT FORMAT ===
Return ONLY valid JSON:
{
  "intent": "...",
  "reply": "...",
  "action_data": { ... },
  "follow_up_needed": true/false
}
"""

def process_ask(text: str, context: Dict[str, Any]):
    start_t = time.time()
    today = datetime.utcnow().date().isoformat()
    
    # Build a clean, computed summary for the AI
    summary = context.get('summary', [])
    
    # Compute per-day totals clearly (summary already aggregated per day from backend)
    daily_lines = []
    for d in summary[:10]:  # last 10 days
        rev = d.get('revenue', 0)
        exp = d.get('expense', 0)
        profit = rev - exp
        items_dict = d.get('items_sold', {})
        stockout = d.get('stockout', [])
        parts = []
        if items_dict:
            parts.append("ITEMS SOLD: " + ", ".join([f"{v}x {k}" for k, v in items_dict.items()]))
        if stockout:
            parts.append("STOCKOUT: " + ", ".join(stockout))
        detail = " | ".join(parts) if parts else ""
        daily_lines.append(f"  {d['date']}: revenue=\u20b9{rev}, expense=\u20b9{exp}, profit=\u20b9{profit}" + (f" | {detail}" if detail else ""))
    
    daily_summary_str = "\n".join(daily_lines) if daily_lines else "  No data yet."
    
    # Cumulative items sold summary (for 'most sold item' queries)
    all_items: Dict[str, int] = {}
    for d in summary:
        for item, qty in d.get('items_sold', {}).items():
            all_items[item] = all_items.get(item, 0) + qty
    if all_items:
        sorted_items = sorted(all_items.items(), key=lambda x: x[1], reverse=True)
        cumulative_str = ", ".join([f"{k}: {v} units" for k, v in sorted_items[:10]])
        cumulative_block = f"\nAll-time Items Sold (last 10 days total): {cumulative_str}"
    else:
        cumulative_block = ""
    
    # Udhari summary
    udhari = context.get('udhari', [])
    udhari_lines = [f"  {u['name']}: owes \u20b9{u['pending']}" for u in udhari if u.get('pending', 0) > 0]
    udhari_str = "\n".join(udhari_lines) if udhari_lines else "  No pending udhari."
    
    # Menu
    menu = context.get('menu', [])
    menu_str = ", ".join([f"{m['item_name']} (\u20b9{m['price']})" for m in menu]) or "No items yet."
    
    context_block = f"""
=== YOUR BUSINESS DATA ===
Today: {today}
Menu: {menu_str}

Daily Revenue (last 10 days):
{daily_summary_str}{cumulative_block}

Udhari (credit) outstanding:
{udhari_str}

Recent conversation:
{json.dumps(context.get('session_history', [])[-4:], ensure_ascii=False)}
"""

    prompt = ASK_SYSTEM_PROMPT.replace("{today}", today)
    
    try:
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"{context_block}\n\nUser says: {text}"}
            ],
            model="llama-3.3-70b-versatile",
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        raw_json = completion.choices[0].message.content
        print(f"[{time.time() - start_t:.2f}s] Ask Brain complete.")
        return json.loads(raw_json)
    except Exception as e:
        print(f"Ask Brain Error: {e}")
        return {
            "intent": "multi_turn",
            "reply": "Thoda problem aa gaya. Dobara boliye?",
            "action_data": None,
            "follow_up_needed": False
        }
