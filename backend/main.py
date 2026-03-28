from fastapi import FastAPI, UploadFile, File, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import shutil
import os
import json

from db import engine, Base, get_db
from models import AudioSession, SessionEntry, ChatMessage
from schemas import AudioSessionResponse, IntentResponse, ChatMessageResponse
from groq_service import process_audio_pipeline
from pdf_service import generate_pdf
from datetime import datetime
from typing import Optional

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

@app.post("/process-audio", response_model=IntentResponse)
async def process_audio(
    day_date: Optional[str] = None, 
    audio: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    if not day_date:
        day_date = datetime.utcnow().date().isoformat()
        
    # Build Context
    today_sessions = db.query(AudioSession).filter(AudioSession.day_date == day_date).all()
    context_lines = []
    for s in today_sessions:
        for e in s.entries:
            context_lines.append(f"- {e.entry_type}: {e.item_name} = {e.value}")
    context_str = "\n".join(context_lines) or "No financial entries for this date yet."
    
    # 1. Save temp file
    temp_path = f"temp_{audio.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(audio.file, buffer)
        
    # 2. Process
    result = process_audio_pipeline(temp_path, context_str)
    if os.path.exists(temp_path):
        os.remove(temp_path)
        
    if result["intent"] == "transaction":
        data = result["data"]
        # Calculate internal
        total_rev = 0
        total_exp = 0
        for e in data.get("entries", []):
            val = e.get("value") or e.get("min") or 0
            if e.get("entry_type") == "REVENUE":
                total_rev += val
            elif e.get("entry_type") == "EXPENSE":
                total_exp += val
                
        profit = data.get("profit", {})
        db_session = AudioSession(
            day_date=day_date,
            raw_text=data.get("raw_text"),
            normalized_text=data.get("normalized_text"),
            confidence=data.get("confidence"),
            profit_value=profit.get("value"),
            profit_min=profit.get("min"),
            profit_max=profit.get("max"),
            profit_type=profit.get("type"),
            total_revenue=total_rev,
            total_expense=total_exp,
            insight=data.get("insight"),
            suggestion=data.get("suggestion"),
            warnings=json.dumps(data.get("warnings", []))
        )
        
        for e in data.get("entries", []):
            db_session.entries.append(SessionEntry(
                entry_type=e.get("entry_type", "UNKNOWN"),
                item_name=e.get("item_name"),
                value=e.get("value"),
                min=e.get("min"),
                max=e.get("max"),
                amount_type=e.get("type", "approx")
            ))
            
        db.add(db_session)
        db.commit()
        db.refresh(db_session)
        
        # Create Chat Messages
        user_msg = ChatMessage(day_date=day_date, role="user", content=data.get("raw_text", ""))
        bot_msg = ChatMessage(
            day_date=day_date, 
            role="assistant", 
            content=data.get("insight", "Saved."), 
            message_type="ledger_card", 
            associated_session_id=db_session.id
        )
        
        db.add(user_msg)
        db.add(bot_msg)
        db.commit()
        db.refresh(user_msg)
        db.refresh(bot_msg)
        
        return {
            "intent": "transaction",
            "user_message": user_msg,
            "assistant_message": bot_msg,
            "session": db_session
        }
    else:
        # Query
        user_msg = ChatMessage(day_date=day_date, role="user", content=result.get("raw_text", ""))
        bot_msg = ChatMessage(day_date=day_date, role="assistant", content=result.get("query_text", ""), message_type="text")
        
        db.add(user_msg)
        db.add(bot_msg)
        db.commit()
        db.refresh(user_msg)
        db.refresh(bot_msg)
        
        return {
            "intent": "query",
            "user_message": user_msg,
            "assistant_message": bot_msg,
            "session": None
        }

@app.get("/days")
def get_days(db: Session = Depends(get_db)):
    days = db.query(ChatMessage.day_date).distinct().order_by(ChatMessage.day_date.desc()).all()
    # Add today if mostly empty
    today = datetime.utcnow().date().isoformat()
    day_list = [d[0] for d in days if d[0]]
    if today not in day_list:
        day_list.insert(0, today)
    return day_list

@app.get("/chat/{day_date}", response_model=list[ChatMessageResponse])
def get_chat_history(day_date: str, db: Session = Depends(get_db)):
    msgs = db.query(ChatMessage).filter(ChatMessage.day_date == day_date).order_by(ChatMessage.created_at.asc()).all()
    return msgs

@app.get("/entries", response_model=list[AudioSessionResponse])
def get_entries(date: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(AudioSession)
    if date:
        query = query.filter(AudioSession.day_date == date)
    return query.order_by(AudioSession.created_at.desc()).all()

from fastapi import HTTPException
from pydantic import BaseModel

class EntryUpdate(BaseModel):
    item_name: Optional[str] = None
    value: Optional[float] = None

@app.put("/entries/{entry_id}", response_model=AudioSessionResponse)
def update_entry(entry_id: int, entry_update: EntryUpdate, db: Session = Depends(get_db)):
    entry = db.query(SessionEntry).filter(SessionEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
        
    if entry_update.item_name is not None:
        entry.item_name = entry_update.item_name
    if entry_update.value is not None:
        entry.value = entry_update.value
        
    session = entry.session
    total_rev = 0
    total_exp = 0
    for e in session.entries:
        val = e.value or e.min or 0
        if e.entry_type == "REVENUE":
            total_rev += val
        elif e.entry_type == "EXPENSE":
            total_exp += val
            
    session.total_revenue = total_rev
    session.total_expense = total_exp
    if session.profit_type == "exact" or not session.profit_type:
        session.profit_value = total_rev - total_exp
        
    db.commit()
    db.refresh(session)
    return session

@app.get("/export")
def export_ledger(db: Session = Depends(get_db)):
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
