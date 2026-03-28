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
   - action_data: {"entries": [{"type": "REVENUE"|"EXPENSE", "item": "...", "amount": number}]}

3. 'add_udhari': Someone took goods/cash on credit.
   - action_data: {"person_name": "...", "amount": number, "direction": "given", "item": "..."}

4. 'mark_paid': Someone paid back their ENTIRE outstanding balance.
   - action_data: {"person_name": "..."}
   - Use ONLY when user says full payment (e.g. "Ramu ne sab paise de diye")

5. 'partial_payment': Someone paid back PART of their balance.
   - action_data: {"person_name": "...", "amount": number}
   - Use when user mentions a specific amount paid back (e.g. "Ramu ne 50 rupaye diye")

6. 'query_business': User asks about their revenue, profit, sales, trends.
   - action_data: null
   - IMPORTANT: Use the exact numbers from the CONTEXT provided. Do not guess. Answer directly.
   - For "kal ka revenue": look at yesterday's data in the summary.
   - For "last 3 days trend": compare last 3 days totals and state clearly if up or down.

7. 'loan_estimator': User asks about loan eligibility or limit.
   - action_data: null
   - Compute: avg daily revenue from context. Monthly estimate = avg * 26 working days.
   - PM SVANidhi: up to ₹50,000 for street vendors. Mudra Shishu: up to ₹50,000.
   - Reply with estimated eligibility and scheme name.

8. 'ask_suggestion': User asks for business advice or growth tips.
   - action_data: null

9. 'multi_turn': Ambiguous input or needs clarification.
   - action_data: null
   - If input has NO clear business context (e.g. "bas thoda kaam kiya", "kuch hua"), ask: "Kya aap sales, expenses, ya udhari record karna chahte ho?"
   - If user is CORRECTING a previous entry (e.g. "nahi 12 vadapav tha"), set intent='log_transaction' and record the corrected amount.

=== RULES ===
- Answer in same language as user (Hindi → Hindi, English → English, Hinglish → Hinglish).
- Keep replies to 1-2 lines, direct and actionable.
- For queries, USE THE EXACT NUMBERS from context. Never say "I don't know" if data is present.
- For growth trend: compare numbers and clearly state "Badhi" (increased) or "Ghati" (decreased).
- Never make up revenue numbers not in context.
- IMPORTANT: If the user provides a RANGE or ambiguous quantity for logging a transaction (e.g. "40-50 samose beche", "10-12 log aaye"), DO NOT log it. Set intent='multi_turn' and ask them for the EXACT number.
- IMPORTANT: If the user reports selling an item that is completely NOT in the 'Menu' context, DO NOT use 'log_transaction'. Set intent='multi_turn' and inform them: "I don't see [Item] in your menu yet. Should I add it as a new menu item?"

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
        daily_lines.append(f"  {d['date']}: revenue=₹{rev}, expense=₹{exp}, profit=₹{profit}")
    
    daily_summary_str = "\n".join(daily_lines) if daily_lines else "  No data yet."
    
    # Udhari summary
    udhari = context.get('udhari', [])
    udhari_lines = [f"  {u['name']}: owes ₹{u['pending']}" for u in udhari if u.get('pending', 0) > 0]
    udhari_str = "\n".join(udhari_lines) if udhari_lines else "  No pending udhari."
    
    # Menu
    menu = context.get('menu', [])
    menu_str = ", ".join([f"{m['item_name']} (₹{m['price']})" for m in menu]) or "No items yet."
    
    context_block = f"""
=== YOUR BUSINESS DATA ===
Today: {today}
Menu: {menu_str}

Daily Revenue (last 10 days):
{daily_summary_str}

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
