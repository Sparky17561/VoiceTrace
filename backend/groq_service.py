import os
import json
from dotenv import load_dotenv
from groq import Groq
from pydantic import ValidationError
from schemas import AudioSessionExtraction

load_dotenv()
load_dotenv("../.env")

client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

SYSTEM_PROMPT = """You are an expert AI financial data extractor AND chat assistant for Indian street vendors. You process mixed Hindi/English/Marathi text.

You receive a spoken Transcript from the user, and a Context of today's ledger entries.
You MUST decide if the user is RECORDING a new transaction OR ASKING a query OR LOGGING UDHARI.
CRITICAL INTENT RULE: If the transcript mentions "paise nahi diye", "later pay", "borrow", "likh le", or names a person as taking something without cash, you MUST NOT use 'transaction'. You MUST use 'udhari'. 'transaction' is ONLY for immediate cash received.

=== STALL MENU PRICING CONTEXT ===
{menu_context}

CRITICAL MATH & QUANTITY PROTOCOL:
Follow this inner logic for EVERY item extraction:
STEP A: Find the ITEM in the STALL MENU (provided below). Note its 'price_per_unit'.
STEP B: Find the QUANTITY the user mentioned (look for numbers like 'bis', 'sau', 'five', 'ten', '10', '20', etc.).
STEP C: If a total price is NOT mentioned in the transcript, you MUST calculate: (Quantity) * (price_per_unit from menu).
STEP D: If a total price IS mentioned (e.g. 'I sold 10 samosas for 500'), IGNORE the menu price and use the user's explicit total (500).
STEP E: Output ONLY the final integer as 'value' or 'amount'. NEVER include math expressions or notes.
Example: Menu has 'Samosa' at Rs 15. User says 'Das samosa'. Logic: 10 * 15 = 150. Value: 150.
Example: Menu has 'Samosa' at Rs 15. User says 'Das samosa beche 500 ke'. Logic: User said 500. Value: 500.
ALWAYS prioritize the MENU price for calculations unless the user specifies a different total amount.
CLEAN ITEM NAMES: Strip all quantity words ('bis', '10', etc.) and adjectives from the `item_name`. Only result in the core name from the menu (e.g., 'Samosa').

=== UDHARI (CREDIT) DETECTION RULES ===
Detect credit transactions (Udhari) using these keywords/phrases:
- "paise nahi diye" / "paise baadme dega" / "paise nahi mila" (Did not pay / will pay later)
- "udhari" / "udhaar" / "borrowed"
- "likh le" / "note kar le" / "account mein daal" (Write it down / add to account)
- "kal dega" / "parso dega" (Will pay tomorrow/later)
- "khaya par paise nahi diye" (Ate but didn't pay)
If these exist, Intent MUST be 'udhari'. Ensure `person_name` is extracted correctly.

=== STOCKOUT DETECTION RULES ===
Detect stockout phrases:
- "khatam ho gaya" / "khatam ho gayi" / "khatam hua" → stockout_flag: true
- "ran out" / "sold out" / "out of stock" → stockout_flag: true
- "aur demand thi but nahi tha" → lost_sales_flag: true
If stockout_flag is true AND revenue > 0 → keep revenue as partial sale.
If lost_sales_flag is true → add insight: "Lost potential sales due to stock shortage".

CRITICAL JSON FORMAT:
You must strictly return valid JSON matching ONE of these THREE intents. 
- NEVER INCLUDE COMMENTS, NOTES, OR EXPLANATIONS INSIDE THE JSON (e.g. no # or //). 
- Comments cause JSON validation to FAIL. 
- Return ONLY the JSON object and nothing else.

Intent 1: TRANSACTION (The user stated they earned, sold, bought, or spent money)
{
  "intent": "transaction",
  "transaction_data": {
    "raw_text": "...",
    "normalized_text": "...",
    "entries": [
      {"entry_type": "REVENUE", "item_name": "mangoes", "value": 1000, "type": "exact", "stockout_flag": false, "lost_sales_flag": false},
      {"entry_type": "REVENUE", "item_name": "vadapav", "value": 240, "type": "exact", "stockout_flag": true, "lost_sales_flag": true},
      {"entry_type": "EXPENSE", "item_name": "auto fare", "value": 50, "type": "exact", "stockout_flag": false, "lost_sales_flag": false}
    ],
    "profit": {"value": 950, "type": "exact"},
    "confidence": "high",
    "insight": "Good sales today. Vadapav ran out — lost potential sales.",
    "suggestion": "Prepare more Vadapav tomorrow."
  }
}

Intent 2: QUERY (The user is asking a question, OR an item they mentioned is NOT present in the menu)
{
  "intent": "query",
  "query_text": "You have spent 500 rupees today on auto fare. Your total profit so far is 1200 rupees."
}

Intent 3: UDHARI (The user mentions someone borrowed items or money, e.g. "Ramu ate 2 vadapav and samosa")
{
  "intent": "udhari",
  "udhari_data": {
    "person_name": "Ramu",
    "item": "2 vadapav and samosa",
    "amount": 45,
    "direction": "given",
    "insight": "Ramu took udhari today."
  }
}

Context of Today's Ledger (ONLY FOR QUERIES):
{context_str}
"""

def process_audio_pipeline(audio_file_path: str, context_str: str = "No entries yet today.", menu_context: str = "No menu items."):
    import time
    import requests
    start_t = time.time()
    print(f"[{time.time() - start_t:.2f}s] Starting Whisper transcription...")
    
    try:
        url = "https://api.groq.com/openai/v1/audio/transcriptions"
        headers = { "Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}" }
        
        with open(audio_file_path, "rb") as file:
            files = { "file": ("audio.m4a", file, "audio/m4a") }
            data = { "model": "whisper-large-v3-turbo", "language": "hi" }
            response = requests.post(url, headers=headers, files=files, data=data, timeout=45)
            
        if response.status_code != 200:
            raise Exception(f"API HTTP {response.status_code}: {response.text}")
            
        transcription_text = response.json().get("text", "")
        print(f"[{time.time() - start_t:.2f}s] Whisper completed!")
        
        class FakeTranscription:
            text = transcription_text
        transcription = FakeTranscription()
        
    except Exception as e:
        print(f"[{time.time() - start_t:.2f}s] Whisper FAILED: {str(e)}")
        return {"intent": "query", "query_text": f"Could not read audio: {str(e)}"}
        
    transcript = transcription.text.strip()
    if not transcript:
        return {"intent": "query", "query_text": "No voice detected. Please try recording again."}

    print(f"[{time.time() - start_t:.2f}s] Transcript received: '{transcript}'")

    for attempt in range(2):
        print(f"[{time.time() - start_t:.2f}s] Starting Intent/Extraction (Attempt {attempt + 1})...")
        try:
            formatted_prompt = SYSTEM_PROMPT.replace("{context_str}", context_str).replace("{menu_context}", menu_context)
            completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": formatted_prompt},
                    {"role": "user", "content": f"Transcript: {transcript}"}
                ],
                model="llama-3.3-70b-versatile",
                response_format={"type": "json_object"},
            )
            
            raw_json = completion.choices[0].message.content
            print(f"[{time.time() - start_t:.2f}s] Llama extraction successful!")
            parsed = json.loads(raw_json)
            
            intent = parsed.get("intent", "transaction")
            if intent == "query":
                return {
                    "intent": "query",
                    "raw_text": transcript,
                    "query_text": parsed.get("query_text", "I'm sorry, I couldn't generate a proper response.")
                }
            elif intent == "udhari":
                from schemas import UdhariDataExtraction
                udhari_data = parsed.get("udhari_data", parsed)
                validated = UdhariDataExtraction(**udhari_data)
                return {
                    "intent": "udhari",
                    "raw_text": transcript,
                    "data": validated.model_dump()
                }
            else:
                transaction_data = parsed.get("transaction_data", parsed)
                validated = AudioSessionExtraction(**transaction_data)
                validated.raw_text = transcript
                return {
                    "intent": "transaction",
                    "data": validated.model_dump()
                }
            
        except (json.JSONDecodeError, ValidationError) as e:
            print(f"[{time.time() - start_t:.2f}s] Extraction Exception: {e}")
            if attempt == 1:
                return {
                    "intent": "query",
                    "raw_text": transcript,
                    "query_text": "I heard you, but couldn't parse the details. Please try again."
                }
                
    return {"intent": "query", "raw_text": "", "query_text": "Something went wrong. Please try again."}

def process_text_pipeline(text: str, context_str: str = "No entries yet today.", menu_context: str = "No menu items."):
    """Same as audio pipeline but skips transcription — takes raw text directly."""
    for attempt in range(2):
        try:
            formatted_prompt = SYSTEM_PROMPT.replace("{context_str}", context_str).replace("{menu_context}", menu_context)
            completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": formatted_prompt},
                    {"role": "user", "content": f"Transcript: {text}"}
                ],
                model="llama-3.1-8b-instant",
                response_format={"type": "json_object"},
            )
            raw_json = completion.choices[0].message.content
            parsed = json.loads(raw_json)
            intent = parsed.get("intent", "transaction")
            if intent == "query":
                return {"intent": "query", "raw_text": text, "query_text": parsed.get("query_text", "")}
            elif intent == "udhari":
                from schemas import UdhariDataExtraction
                udhari_data = parsed.get("udhari_data", parsed)
                validated = UdhariDataExtraction(**udhari_data)
                return {"intent": "udhari", "raw_text": text, "data": validated.model_dump()}
            else:
                transaction_data = parsed.get("transaction_data", parsed)
                validated = AudioSessionExtraction(**transaction_data)
                validated.raw_text = text
                return {"intent": "transaction", "data": validated.model_dump()}
        except Exception as e:
            print(f"Text pipeline error: {e}")
            if attempt == 1:
                return {"intent": "query", "raw_text": text, "query_text": "Couldn't parse that. Please try again."}
    return {"intent": "query", "raw_text": text, "query_text": "Unknown error."}

def safe_fallback(transcript_text: str, warnings: list = []):
    return {
        "raw_text": transcript_text,
        "normalized_text": "Unprocessed strictly due to fallback",
        "entries": [],
        "profit": {"value": 0, "min": 0, "max": 0, "type": "exact"},
        "confidence": "low",
        "warnings": ["Audio succeeded but intent mapping failed."] + warnings,
        "insight": "Unable to generate financial insight.",
        "suggestion": "Please try to record again with clearer speech."
    }

def translate_search_query(query: str):
    prompt = f"Return ONLY a comma-separated list of synonyms and translations for the word '{query}' in English, Hindi (Devanagari), Marathi, and Tamil. No extra text, no markdown. Max 10 synonyms."
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )
    res = response.choices[0].message.content.strip()
    return [s.strip() for s in res.split(",") if s.strip()]
