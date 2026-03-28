"""
ask_service.py — Multi-turn voice brain for the /ask endpoint.
Routes text to: log_transaction | add_udhari | mark_paid | query_business | ask_suggestion | multi_turn
"""
import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
load_dotenv("../.env")

client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

ASK_SYSTEM_PROMPT = """You are a smart business assistant for an Indian street vendor. You speak simple, friendly Hindi-English mixed language (Hinglish is fine). 

You have access to their recent business data below.

=== RECENT BUSINESS DATA ===
{daily_summary}

=== UDHARI SUMMARY ===
{udhari_summary}

=== CONVERSATION SO FAR ===
{session_context}

YOUR CAPABILITIES:
1. Log a sale or expense (intent: log_transaction)
2. Add a borrow/udhari entry (intent: add_udhari)  
3. Mark a repayment as paid (intent: mark_paid)
4. Answer business questions using their data (intent: query_business)
5. Give trend-based suggestions (intent: ask_suggestion)
6. Ask ONE clarifying question if needed (intent: multi_turn)

STRICT RULES:
- Reply in simple plain language, 1-2 sentences max
- Numbers always in Indian Rupees (₹)
- If you need to clarify something, set intent=multi_turn and put the question in follow_up field
- Never ask more than 1 question at a time
- Be warm, helpful, like a knowledgeable friend
- For udhari: "X ne Y liye" or "X ko Y diye" → add_udhari
- For repayment: "X ne wapas kiya" or "X paid" → mark_paid
- For transactions: any mention of selling/buying/revenue/expense → log_transaction
- For questions about business: "kitna", "kaisa", "kya hua" → query_business
- For stock/suggestion questions: "kya banao", "stock badhao" → ask_suggestion

IMPORTANT: Always return valid JSON with this exact structure:
{
  "intent": "query_business | log_transaction | add_udhari | mark_paid | ask_suggestion | multi_turn",
  "reply": "Your plain language response here",
  "follow_up": null or "Your ONE clarifying question here",
  "action_data": null or {
    "type": "udhari_add | udhari_pay | transaction",
    "person_name": "name if udhari",
    "amount": 0,
    "item": "item name if relevant",
    "direction": "given or taken"
  }
}
"""

def process_ask(text: str, daily_summary: list, udhari_summary: list, session_context: list) -> dict:
    """
    Process a text query through the multi-turn Ask brain.
    Returns structured response with intent, reply, optional follow_up, and action_data.
    """
    # Format daily summary for prompt
    if daily_summary:
        ds_lines = []
        for d in daily_summary[:7]:
            stockout_note = f" | Stockouts: {', '.join(d.get('stockout_items', []))}" if d.get('stockout_items') else ""
            ds_lines.append(
                f"- {d['date']}: Revenue ₹{d['total_revenue']}, Expense ₹{d['total_expense']}, Profit ₹{d['profit']}{stockout_note}"
            )
        ds_str = "\n".join(ds_lines)
    else:
        ds_str = "No sales data yet."

    # Format udhari summary
    if udhari_summary:
        ud_lines = [f"- {p['name']}: ₹{p['pending_total']} pending" for p in udhari_summary if p['pending_total'] > 0]
        ud_str = "\n".join(ud_lines) if ud_lines else "No pending udhari."
    else:
        ud_str = "No udhari records."

    # Format session context (last 4 exchanges)
    if session_context:
        ctx_lines = [f"{m['role'].upper()}: {m['content']}" for m in session_context[-4:]]
        ctx_str = "\n".join(ctx_lines)
    else:
        ctx_str = "No previous conversation."

    prompt = ASK_SYSTEM_PROMPT.replace("{daily_summary}", ds_str)\
                               .replace("{udhari_summary}", ud_str)\
                               .replace("{session_context}", ctx_str)

    for attempt in range(2):
        try:
            completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": text}
                ],
                model="llama-3.1-8b-instant",
                response_format={"type": "json_object"},
                temperature=0.3,
            )
            raw = completion.choices[0].message.content
            parsed = json.loads(raw)
            return {
                "intent": parsed.get("intent", "query_business"),
                "reply": parsed.get("reply", "Sorry, I couldn't understand that."),
                "follow_up": parsed.get("follow_up"),
                "action_data": parsed.get("action_data"),
            }
        except Exception as e:
            print(f"Ask service error (attempt {attempt+1}): {e}")
            if attempt == 1:
                return {
                    "intent": "query_business",
                    "reply": "Sorry, I couldn't process that. Please try again.",
                    "follow_up": None,
                    "action_data": None,
                }
    return {"intent": "query_business", "reply": "Something went wrong.", "follow_up": None, "action_data": None}
