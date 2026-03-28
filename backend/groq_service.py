import os
import json
from dotenv import load_dotenv
from groq import Groq
from pydantic import ValidationError
from schemas import AudioSessionExtraction

# Explicitly load .env file from the parent/current directory
load_dotenv()
load_dotenv("../.env")

client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

SYSTEM_PROMPT = """You are an expert AI financial data extractor AND chat assistant for Indian street vendors. You process mixed Hindi/English/Marathi text.

You receive a spoken Transcript from the user, and a Context of today's ledger entries.
You MUST decide if the user is RECORDING a new transaction OR ASKING a query about their data.

CRITICAL JSON FORMAT:
You must strictly return JSON matching ONE of these two intents:

Intent 1: TRANSACTION (The user stated they earned, sold, bought, or spent money)
{
  "intent": "transaction",
  "transaction_data": {
    "raw_text": "...",
    "normalized_text": "...",
    "entries": [
      {"entry_type": "REVENUE", "item_name": "mangoes", "value": 1000, "type": "exact"},
      {"entry_type": "EXPENSE", "item_name": "auto fare", "value": 50, "type": "exact"}
    ],
    "profit": {"value": 950, "type": "exact"},
    "confidence": "high",
    "insight": "Good margins today.",
    "suggestion": "Track inventory costs."
  }
}
* Buying inventory or "saman laya" or "kharcha" is ALWAYS an EXPENSE.
* "Kamaye" or "beka" or "bech kar" is ALWAYS REVENUE.
* Do NOT put amounts inside `item_name`. Put them strictly in `value`.

Intent 2: QUERY (The user is asking a question about their day, e.g. "How much did I spend today?", "What is my total profit?")
{
  "intent": "query",
  "query_text": "You have spent 500 rupees today on auto fare. Your total profit so far is 1200 rupees."
}
* You MUST answer the user's question accurately using ONLY the Context provided below. Answer in the same language they asked.

Context of Today's Ledger:
{context_str}
"""

def process_audio_pipeline(audio_file_path: str, context_str: str = "No entries yet today."):
    import time
    import requests
    start_t = time.time()
    print(f"[{time.time() - start_t:.2f}s] Starting Whisper transcription...")
    
    # 1. Transcribe with Whisper using STABLE requests library
    try:
        url = "https://api.groq.com/openai/v1/audio/transcriptions"
        headers = { "Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}" }
        
        with open(audio_file_path, "rb") as file:
            files = { "file": ("audio.m4a", file, "audio/m4a") }
            data = { "model": "whisper-large-v3-turbo" }
            
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

    # 2. Extract or Query with Llama 3.1
    for attempt in range(2):
        print(f"[{time.time() - start_t:.2f}s] Starting Intent/Extraction (Attempt {attempt + 1})...")
        try:
            formatted_prompt = SYSTEM_PROMPT.replace("{context_str}", context_str)
            completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": formatted_prompt},
                    {"role": "user", "content": f"Transcript: {transcript}"}
                ],
                model="llama-3.1-8b-instant",
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
                    "query_text": parsed.get("query_text", "I'm sorry, I couldn't generate a proper response to that.")
                }
            else:
                # 3. Pydantic validation for transaction
                transaction_data = parsed.get("transaction_data", parsed) # Fallback if nested incorrectly
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
                    "query_text": "I heard you, but my extraction mathematically failed to parse the meaning perfectly."
                }
                
    return {"intent": "query", "raw_text": transcript, "query_text": "Fatal fallback execution."}

def safe_fallback(transcript_text: str, warnings: list = []):
    return {
        "raw_text": transcript_text,
        "normalized_text": "Unprocessed strictly due to fallback",
        "entries": [],
        "profit": {"value": 0, "min": 0, "max": 0, "type": "exact"},
        "confidence": "low",
        "warnings": ["Audio succeeded but intent mapping mathematically failed."] + warnings,
        "insight": "Unable to generate solid financial insight.",
        "suggestion": "Please try to record again with clearer speech."
    }
