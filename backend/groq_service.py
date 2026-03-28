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

SYSTEM_PROMPT = """You are an expert AI financial data extractor for Indian street vendors. You process mixed Hindi/English/Marathi text.

CRITICAL RULES:
1. Identify all financial entries as strictly "REVENUE" (money earned/sales) or "EXPENSE" (money spent, buying goods, inventory, rent, bribes, wages).
2. For EVERY entry, you MUST extract the numeric amount and strictly place it in the "value" field. Never leave "value" as null if an amount is spoken!
3. Buying inventory or "saman laya" or "kharcha" is ALWAYS an EXPENSE.
4. "Kamaye" or "beka" or "bech kar" is ALWAYS REVENUE.

PROFIT CALCULATION:
- Net Profit = (Total Revenue) - (Total Expenses)
- Place the final computed integer in `profit.value`.

CRITICAL JSON FORMAT:
{
  "raw_text": "...",
  "normalized_text": "...",
  "entries": [
    {"entry_type": "REVENUE", "item_name": "mangoes", "value": 1000, "type": "exact"},
    {"entry_type": "EXPENSE", "item_name": "auto fare", "value": 50, "type": "exact"},
    {"entry_type": "EXPENSE", "item_name": "inventory goods", "value": 200, "type": "exact"}
  ],
  "profit": {"value": 750, "type": "exact"},
  "confidence": "high",
  "insight": "Good margins today.",
  "suggestion": "Track inventory costs."
}

Do NOT put amounts inside `item_name`. Put them in `value`.
"""

def process_audio_pipeline(audio_file_path: str):
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
            
            # Direct POST bypasses the brittle Groq Python SDK connection issues
            response = requests.post(url, headers=headers, files=files, data=data, timeout=45)
            
        if response.status_code != 200:
            raise Exception(f"API HTTP {response.status_code}: {response.text}")
            
        transcription_text = response.json().get("text", "")
        print(f"[{time.time() - start_t:.2f}s] Whisper completed!")
        
        # We must reassign this to exactly 'transcript' down below
        class FakeTranscription:
            text = transcription_text
        transcription = FakeTranscription()
        
    except Exception as e:
        print(f"[{time.time() - start_t:.2f}s] Whisper FAILED: {str(e)}")
        return safe_fallback(f"Could not read audio: {str(e)}")
        
    transcript = transcription.text.strip()
    if not transcript:
        return safe_fallback("No voice detected.")

    print(f"[{time.time() - start_t:.2f}s] Transcript received: '{transcript}'")

    # 2. Extract with Llama 3.1
    for attempt in range(2):
        print(f"[{time.time() - start_t:.2f}s] Starting Extraction (Attempt {attempt + 1})...")
        try:
            completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Transcript: {transcript}"}
                ],
                model="llama-3.1-8b-instant",
                response_format={"type": "json_object"},
            )
            
            raw_json = completion.choices[0].message.content
            print(f"[{time.time() - start_t:.2f}s] Llama extraction successful!")
            parsed = json.loads(raw_json)
            
            # 3. Pydantic validation
            validated = AudioSessionExtraction(**parsed)
            # Guarantee raw transcript matches true Whisper output
            validated.raw_text = transcript
            return validated.model_dump()
            
        except (json.JSONDecodeError, ValidationError) as e:
            print(f"[{time.time() - start_t:.2f}s] Extraction Exception: {e}")
            if hasattr(e, 'errors'):
                print(f"Pydantic errors: {e.errors()}")
            print(f"Raw JSON was: {raw_json}")
            if attempt == 1:
                return safe_fallback(transcript, [f"Extraction failed: {str(e)}"])
                
    return safe_fallback(transcript, ["Fatal fallback execution"])

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
