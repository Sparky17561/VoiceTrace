from fastapi import FastAPI, UploadFile, File, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import shutil
import os
import json

from db import engine, Base, get_db
from models import AudioSession, SessionEntry
from schemas import AudioSessionResponse
from groq_service import process_audio_pipeline
from pdf_service import generate_pdf

# Initialize DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/process-audio", response_model=AudioSessionResponse)
async def process_audio(audio: UploadFile = File(...), db: Session = Depends(get_db)):
    # 1. Save temp file
    temp_path = f"temp_{audio.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(audio.file, buffer)
        
    # 2. Process through Groq
    result_dict = process_audio_pipeline(temp_path)
    if os.path.exists(temp_path):
        os.remove(temp_path)
    
    # 3. Calculate internal pure DB totals
    total_rev = 0
    total_exp = 0
    for e in result_dict.get("entries", []):
        val = e.get("value") or e.get("min") or 0
        if e.get("entry_type") == "REVENUE":
            total_rev += val
        elif e.get("entry_type") == "EXPENSE":
            total_exp += val
            
    # 4. Save to SQLite
    profit = result_dict.get("profit", {})
    db_session = AudioSession(
        raw_text=result_dict.get("raw_text"),
        normalized_text=result_dict.get("normalized_text"),
        confidence=result_dict.get("confidence"),
        profit_value=profit.get("value"),
        profit_min=profit.get("min"),
        profit_max=profit.get("max"),
        profit_type=profit.get("type"),
        total_revenue=total_rev,
        total_expense=total_exp,
        insight=result_dict.get("insight"),
        suggestion=result_dict.get("suggestion"),
        warnings=json.dumps(result_dict.get("warnings", []))
    )
    
    for e in result_dict.get("entries", []):
        db_session.entries.append(
            SessionEntry(
                entry_type=e["entry_type"],
                item_name=e.get("item_name"),
                value=e.get("value"),
                min=e.get("min"),
                max=e.get("max"),
                amount_type=e.get("type") or "approx"
            )
        )
        
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    
    return db_session

@app.get("/entries", response_model=list[AudioSessionResponse])
def get_entries(db: Session = Depends(get_db)):
    return db.query(AudioSession).order_by(AudioSession.created_at.desc()).all()

@app.get("/export")
def export_ledger(db: Session = Depends(get_db)):
    # Top level aggregated export
    latest = db.query(AudioSession).order_by(AudioSession.created_at.desc()).first()
    if not latest:
        return {"error": "No entries found to generate PDF"}
        
    pdf_path = generate_pdf(
        latest.total_revenue,
        latest.total_expense,
        latest.profit_value,
        latest.profit_min,
        latest.profit_max,
        latest.profit_type,
        latest.insight,
        str(latest.created_at)
    )
    return FileResponse(pdf_path, media_type='application/pdf', filename=f"Ledger_{latest.created_at.date()}.pdf")
