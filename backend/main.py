from fastapi import FastAPI, UploadFile, File, Depends, BackgroundTasks, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import List, Optional
import shutil
import os
import json
import random
import uuid
from datetime import datetime, timedelta
from fastapi.staticfiles import StaticFiles
from collections import defaultdict

from db import engine, Base, get_db
import models
from schemas import (
    AudioSessionResponse, IntentResponse, ChatMessageResponse,
    UdhariPersonCreate, UdhariEntryCreate, UdhariPersonResponse, UdhariEntryResponse,
    AskRequest, AskResponse
)
from groq_service import process_audio_pipeline, process_text_pipeline, translate_search_query
from auth import get_current_user, get_password_hash, verify_password, create_access_token
from ask_service import process_ask
from pdf_service import generate_full_report

# ── Initialize DB tables ──
Base.metadata.create_all(bind=engine)

# ── Migration shim: add new columns to existing tables (idempotent) ──
def run_migrations():
    with engine.connect() as conn:
        migrations = [
            "ALTER TABLE session_entries ADD COLUMN stockout_flag BOOLEAN DEFAULT 0",
            "ALTER TABLE session_entries ADD COLUMN lost_sales_flag BOOLEAN DEFAULT 0",
        ]
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # Column already exists

run_migrations()

app = FastAPI(title="VoiceTrace API — Voice Business OS")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("static/audio", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# ─────────────────────────────────────────────────────────────────────────────
# AUTH SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────
class UserRegister(BaseModel):
    phone: str
    password: str
    name: Optional[str] = "Trader"

class UserLogin(BaseModel):
    phone: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    name: str
    needs_onboarding: bool = False

class OTPRequest(BaseModel):
    phone: str

class OTPVerify(BaseModel):
    phone: str
    otp: str

# ─────────────────────────────────────────────────────────────────────────────
# AUTH ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=TokenResponse)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.phone == user_in.phone).first()
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    new_user = models.User(phone=user_in.phone, name=user_in.name, hashed_password=get_password_hash(user_in.password))
    db.add(new_user); db.commit(); db.refresh(new_user)
    access_token = create_access_token(data={"sub": new_user.phone})
    return {"access_token": access_token, "user_id": new_user.id, "name": new_user.name or "Trader", "needs_onboarding": True}

@app.post("/auth/login", response_model=TokenResponse)
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.phone == user_in.phone).first()
    if not user or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid phone or password")
    access_token = create_access_token(data={"sub": user.phone})
    stalls_count = db.query(models.Stall).filter(models.Stall.user_id == user.id).count()
    return {"access_token": access_token, "user_id": user.id, "name": user.name or "Trader", "needs_onboarding": stalls_count == 0}

@app.get("/onboarding/status")
def onboarding_status(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    stalls = db.query(models.Stall).filter(models.Stall.user_id == user.id).all()
    if not stalls: return {"completed": False, "reason": "no_stalls"}
    item_count = db.query(models.MenuItem).filter(models.MenuItem.stall_id.in_([s.id for s in stalls])).count()
    if item_count == 0: return {"completed": False, "reason": "no_items"}
    return {"completed": True}

class OnboardingSetup(BaseModel):
    stall_name: str
    location: Optional[str] = ""
    items: List[dict]

@app.post("/onboarding/complete")
def onboarding_complete(setup: OnboardingSetup, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    stall = models.Stall(user_id=user.id, name=setup.stall_name, location=setup.location)
    db.add(stall); db.commit(); db.refresh(stall)
    for item in setup.items:
        db.add(models.MenuItem(stall_id=stall.id, item_name=item['name'], price_per_unit=item['price']))
    db.commit()
    return {"status": "success", "stall_id": stall.id}

@app.post("/auth/otp-request")
def request_otp(req: OTPRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.phone == req.phone).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    otp = str(random.randint(100000, 999999))
    user.otp_code = otp
    user.otp_expiry = datetime.utcnow() + timedelta(minutes=5)
    db.commit()
    print(f"DEBUG: OTP for {req.phone} is {otp}")
    return {"message": "OTP sent successfully (Simulated)"}

@app.post("/auth/otp-verify", response_model=TokenResponse)
def verify_otp(req: OTPVerify, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.phone == req.phone).first()
    if not user or user.otp_code != req.otp or (user.otp_expiry and user.otp_expiry < datetime.utcnow()):
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")
    user.otp_code = None; db.commit()
    access_token = create_access_token(data={"sub": user.phone})
    return {"access_token": access_token, "user_id": user.id, "name": user.name or "Trader"}

# ─────────────────────────────────────────────────────────────────────────────
# STALL & MENU
# ─────────────────────────────────────────────────────────────────────────────
class StallCreate(BaseModel):
    name: str
    location: Optional[str] = ""

class MenuItemCreate(BaseModel):
    item_name: str
    price_per_unit: float

class MenuItemResponse(BaseModel):
    id: int
    item_name: str
    price_per_unit: float

class StallResponse(BaseModel):
    id: int
    name: str
    location: Optional[str] = None
    menu_items: List[MenuItemResponse] = []
    class Config:
        from_attributes = True

@app.get("/stalls", response_model=List[StallResponse])
def get_stalls(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return user.stalls

@app.post("/stalls", response_model=StallResponse)
def create_stall(stall_in: StallCreate, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_stall = models.Stall(user_id=user.id, name=stall_in.name, location=stall_in.location)
    db.add(db_stall); db.commit(); db.refresh(db_stall)
    return db_stall

@app.put("/stalls/{stall_id}", response_model=StallResponse)
def update_stall(stall_id: int, stall_in: StallCreate, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    stall = db.query(models.Stall).filter(models.Stall.id == stall_id, models.Stall.user_id == user.id).first()
    if not stall: raise HTTPException(404, "Stall not found")
    stall.name = stall_in.name; stall.location = stall_in.location
    db.commit(); db.refresh(stall)
    return stall

@app.delete("/stalls/{stall_id}")
def delete_stall(stall_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    stall = db.query(models.Stall).filter(models.Stall.id == stall_id, models.Stall.user_id == user.id).first()
    if not stall: raise HTTPException(404, "Stall not found")
    db.delete(stall); db.commit()
    return {"status": "success"}

@app.post("/stalls/{stall_id}/menu", response_model=MenuItemResponse)
def add_menu_item(stall_id: int, item_in: MenuItemCreate, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    stall = db.query(models.Stall).filter(models.Stall.id == stall_id, models.Stall.user_id == user.id).first()
    if not stall: raise HTTPException(404, "Stall not found")
    item = models.MenuItem(stall_id=stall.id, item_name=item_in.item_name, price_per_unit=item_in.price_per_unit)
    db.add(item); db.commit(); db.refresh(item)
    return item

@app.put("/menu/{item_id}", response_model=MenuItemResponse)
def update_menu_item(item_id: int, item_in: MenuItemCreate, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(models.MenuItem).join(models.Stall).filter(models.MenuItem.id == item_id, models.Stall.user_id == user.id).first()
    if not item: raise HTTPException(404, "Item not found")
    item.item_name = item_in.item_name; item.price_per_unit = item_in.price_per_unit
    db.commit(); db.refresh(item)
    return item

@app.delete("/menu/{item_id}")
def delete_menu_item(item_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(models.MenuItem).join(models.Stall).filter(models.MenuItem.id == item_id, models.Stall.user_id == user.id).first()
    if not item: raise HTTPException(404, "Item not found")
    db.delete(item); db.commit()
    return {"status": "success"}

# ─────────────────────────────────────────────────────────────────────────────
# AUDIO / TEXT PROCESSING
# ─────────────────────────────────────────────────────────────────────────────

import difflib

def _enforce_menu_check(result: dict, menu_items: list):
    valid_names = [m.item_name.lower() for m in menu_items]
    if not valid_names:
        return result
        
    def get_fuzzy_match(raw_name):
        if not raw_name: return None
        low = raw_name.lower()
        # Direct check
        if low in valid_names: return next(m.item_name for m in menu_items if m.item_name.lower() == low)
        # Fuzzy match
        matches = difflib.get_close_matches(low, valid_names, n=1, cutoff=0.7)
        if matches:
            return next(m.item_name for m in menu_items if m.item_name.lower() == matches[0])
        return None

    if result.get("intent") == "transaction":
        for e in result.get("data", {}).get("entries", []):
            if e.get("entry_type") == "REVENUE" and e.get("item_name"):
                match = get_fuzzy_match(e["item_name"])
                if match:
                    e["item_name"] = match
                else:
                    return {
                        "intent": "query",
                        "raw_text": result.get("raw_text", ""),
                        "query_text": f"Item '{e['item_name']}' is not present in your menu for this stall. Please add it from the Shops tab."
                    }
    elif result.get("intent") == "udhari":
        item_full = result.get("data", {}).get("item", "")
        if item_full:
            # Check if it's just money words
            low_full = item_full.lower()
            money_words = ["rs", "rupee", "rupees", "cash", "money", "paise"]
            if not any(mw in low_full for mw in money_words):
                match = get_fuzzy_match(item_full)
                if match:
                    result["data"]["item"] = match
                else:
                    return {
                        "intent": "query",
                        "raw_text": result.get("raw_text", ""),
                        "query_text": f"Item '{item_full}' for Udhari is not present in your menu. Please add it from the Shops tab."
                    }
    return result


@app.post("/process-audio-preview")
async def process_audio_preview(
    request: Request,
    stall_id: int,
    day_date: Optional[str] = None,
    audio: UploadFile = File(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Process audio and return preview data WITHOUT saving to DB."""
    stall = db.query(models.Stall).filter(models.Stall.id == stall_id, models.Stall.user_id == user.id).first()
    if not stall: raise HTTPException(404, "Stall not found")
    if not day_date: day_date = datetime.utcnow().date().isoformat()

    ext = audio.filename.split(".")[-1] if "." in audio.filename else "m4a"
    unique_filename = f"{uuid.uuid4()}.{ext}"
    audio_path = os.path.join("static/audio", unique_filename)
    with open(audio_path, "wb") as b:
        shutil.copyfileobj(audio.file, b)
    base_url = str(request.base_url).rstrip("/")
    audio_url = f"{base_url}/static/audio/{unique_filename}"

    today_sessions = db.query(models.AudioSession).filter(models.AudioSession.stall_id == stall_id, models.AudioSession.day_date == day_date).all()
    context_lines = []
    for s in today_sessions:
        for e in s.entries: context_lines.append(f"- {e.entry_type}: {e.item_name} = {e.value}")
    context_str = "\n".join(context_lines) or "No entries yet."
    menu_items = db.query(models.MenuItem).filter(models.MenuItem.stall_id == stall_id).all()
    menu_context = "\n".join([f"- {m.item_name}: rs {m.price_per_unit}" for m in menu_items])

    result = process_audio_pipeline(audio_path, context_str, menu_context)
    result = _enforce_menu_check(result, menu_items)
    # Return the raw result + audio_url WITHOUT saving
    return {"result": result, "audio_url": audio_url, "day_date": day_date, "stall_id": stall_id}

class ConfirmRequest(BaseModel):
    stall_id: int
    day_date: str
    audio_url: Optional[str] = None
    result: dict

@app.post("/confirm-entry", response_model=IntentResponse)
def confirm_entry(req: ConfirmRequest, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Commit a previously previewed result into the DB."""
    stall = db.query(models.Stall).filter(models.Stall.id == req.stall_id, models.Stall.user_id == user.id).first()
    if not stall: raise HTTPException(404, "Stall not found")
    return _save_result(req.result, req.stall_id, req.day_date, req.audio_url, db)

@app.post("/process-audio", response_model=IntentResponse)
async def process_audio(
    request: Request,
    stall_id: int,
    day_date: Optional[str] = None,
    audio: UploadFile = File(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    stall = db.query(models.Stall).filter(models.Stall.id == stall_id, models.Stall.user_id == user.id).first()
    if not stall: raise HTTPException(404, "Stall not found")
    if not day_date: day_date = datetime.utcnow().date().isoformat()

    ext = audio.filename.split(".")[-1] if "." in audio.filename else "m4a"
    unique_filename = f"{uuid.uuid4()}.{ext}"
    audio_path = os.path.join("static/audio", unique_filename)
    with open(audio_path, "wb") as b:
        shutil.copyfileobj(audio.file, b)
    base_url = str(request.base_url).rstrip("/")
    audio_url = f"{base_url}/static/audio/{unique_filename}"

    today_sessions = db.query(models.AudioSession).filter(models.AudioSession.stall_id == stall_id, models.AudioSession.day_date == day_date).all()
    context_lines = []
    for s in today_sessions:
        for e in s.entries: context_lines.append(f"- {e.entry_type}: {e.item_name} = {e.value}")
    context_str = "\n".join(context_lines) or "No entries yet."
    menu_items = db.query(models.MenuItem).filter(models.MenuItem.stall_id == stall_id).all()
    menu_context = "\n".join([f"- {m.item_name}: rs {m.price_per_unit}" for m in menu_items])

    result = process_audio_pipeline(audio_path, context_str, menu_context)
    result = _enforce_menu_check(result, menu_items)
    return _save_result(result, stall_id, day_date, audio_url, db)

class ProcessTextRequest(BaseModel):
    text: str
    stall_id: int
    day_date: Optional[str] = None

@app.post("/process-text-preview")
def process_text_preview(req: ProcessTextRequest, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    stall = db.query(models.Stall).filter(models.Stall.id == req.stall_id, models.Stall.user_id == user.id).first()
    if not stall: raise HTTPException(404, "Stall not found")
    day_date = req.day_date or datetime.utcnow().date().isoformat()

    today_sessions = db.query(models.AudioSession).filter(models.AudioSession.stall_id == req.stall_id, models.AudioSession.day_date == day_date).all()
    context_lines = []
    for s in today_sessions:
        for e in s.entries: context_lines.append(f"- {e.entry_type}: {e.item_name} = {e.value}")
    context_str = "\n".join(context_lines) or "No entries yet."
    menu_items = db.query(models.MenuItem).filter(models.MenuItem.stall_id == req.stall_id).all()
    menu_context = "\n".join([f"- {m.item_name}: rs {m.price_per_unit}" for m in menu_items])

    result = process_text_pipeline(req.text, context_str, menu_context)
    result = _enforce_menu_check(result, menu_items)
    return {"result": result, "day_date": day_date, "stall_id": req.stall_id}

def _save_result(result: dict, stall_id: int, day_date: str, audio_url: Optional[str], db: Session):
    if result["intent"] == "udhari":
        data = result["data"]
        person_name = data.get("person_name")
        amount = data.get("amount", 0)
        item = data.get("item", "")
        direction = data.get("direction", "given")
        
        person = db.query(models.UdhariPerson).filter(
            models.UdhariPerson.stall_id == stall_id,
            models.UdhariPerson.name.ilike(person_name)
        ).first()
        if not person:
            person = models.UdhariPerson(stall_id=stall_id, name=person_name)
            db.add(person); db.commit(); db.refresh(person)
        
        entry = models.UdhariEntry(
            person_id=person.id, stall_id=stall_id,
            item=item, amount=amount, direction=direction
        )
        db.add(entry)
        db_s = models.AudioSession(
            stall_id=stall_id, day_date=day_date,
            raw_text=result.get("raw_text"), total_revenue=0, total_expense=0,
            insight=f"Udhari: {person_name} ({direction} ₹{amount})", audio_url=audio_url
        )
        db.add(db_s); db.commit(); db.refresh(db_s)
        
        um = models.ChatMessage(stall_id=stall_id, day_date=day_date, role="user", content=result.get("raw_text", ""))
        bm = models.ChatMessage(stall_id=stall_id, day_date=day_date, role="assistant", content=f"✅ Added udhari: {person_name} {direction} ₹{amount} for {item}", message_type="action_card", associated_session_id=db_s.id)
        db.add(um); db.add(bm); db.commit(); db.refresh(um); db.refresh(bm)
        return {"intent": "udhari", "user_message": um, "assistant_message": bm, "session": db_s}

    elif result["intent"] == "transaction":
        data = result["data"]
        tr, te = 0, 0
        for e in data.get("entries", []):
            v = e.get("value") or e.get("min") or 0
            if e.get("entry_type") == "REVENUE": tr += v
            else: te += v

        db_s = models.AudioSession(
            stall_id=stall_id, day_date=day_date,
            raw_text=data.get("raw_text"), total_revenue=tr, total_expense=te,
            insight=data.get("insight"), warnings=json.dumps(data.get("warnings", [])),
            audio_url=audio_url
        )
        for e in data.get("entries", []):
            db_s.entries.append(models.SessionEntry(
                entry_type=e.get("entry_type", "UNKNOWN"),
                item_name=e.get("item_name"),
                value=e.get("value"),
                amount_type=e.get("type", "approx"),
                stockout_flag=bool(e.get("stockout_flag", False)),
                lost_sales_flag=bool(e.get("lost_sales_flag", False)),
            ))
        db.add(db_s); db.commit(); db.refresh(db_s)
        um = models.ChatMessage(stall_id=stall_id, day_date=day_date, role="user", content=data.get("raw_text", ""))
        bm = models.ChatMessage(stall_id=stall_id, day_date=day_date, role="assistant", content=data.get("insight", "Saved."), message_type="ledger_card", associated_session_id=db_s.id)
        db.add(um); db.add(bm); db.commit(); db.refresh(um); db.refresh(bm)
        return {"intent": "transaction", "user_message": um, "assistant_message": bm, "session": db_s}
    else:
        um = models.ChatMessage(stall_id=stall_id, day_date=day_date, role="user", content=result.get("raw_text", ""))
        bm = models.ChatMessage(stall_id=stall_id, day_date=day_date, role="assistant", content=result.get("query_text", ""), message_type="text")
        db.add(um); db.add(bm); db.commit(); db.refresh(um); db.refresh(bm)
        return {"intent": "query", "user_message": um, "assistant_message": bm, "session": None}

# ─────────────────────────────────────────────────────────────────────────────
# CHAT & DAYS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/days")
def get_days(stall_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    days = db.query(models.ChatMessage.day_date).filter(models.ChatMessage.stall_id == stall_id).distinct().all()
    t = datetime.utcnow().date().isoformat()
    l = [d[0] for d in days if d[0]]
    if t not in l: l.insert(0, t)
    return l

@app.get("/chat/{day_date}", response_model=list[ChatMessageResponse])
def get_chat_history(day_date: str, stall_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.ChatMessage).filter(models.ChatMessage.stall_id == stall_id, models.ChatMessage.day_date == day_date).order_by(models.ChatMessage.created_at.asc()).all()

@app.get("/entries", response_model=List[AudioSessionResponse])
def get_entries(stall_id: int, date: Optional[str] = None, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(models.AudioSession).filter(models.AudioSession.stall_id == stall_id)
    if date: q = q.filter(models.AudioSession.day_date == date)
    return q.order_by(models.AudioSession.created_at.desc()).all()

@app.get("/search", response_model=List[AudioSessionResponse])
def search_entries(stall_id: int, query: str, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    syns = translate_search_query(query)
    from sqlalchemy import or_
    filters = [models.AudioSession.raw_text.ilike(f"%{s}%") for s in syns]
    return db.query(models.AudioSession).join(models.SessionEntry).filter(
        models.AudioSession.stall_id == stall_id,
        or_(*[models.SessionEntry.item_name.ilike(f"%{s}%") for s in syns] + filters)
    ).distinct().all()

# ─────────────────────────────────────────────────────────────────────────────
# ANALYTICS — DAILY SUMMARY
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/analytics/daily-summary")
def daily_summary(stall_id: int, days: int = 7, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    stall = db.query(models.Stall).filter(models.Stall.id == stall_id, models.Stall.user_id == user.id).first()
    if not stall: raise HTTPException(404, "Stall not found")

    cutoff = (datetime.utcnow() - timedelta(days=days)).date().isoformat()
    sessions = db.query(models.AudioSession).filter(
        models.AudioSession.stall_id == stall_id,
        models.AudioSession.day_date >= cutoff
    ).order_by(models.AudioSession.day_date.desc()).all()

    daily = defaultdict(lambda: {"items": {}, "total_revenue": 0, "total_expense": 0, "stockout_items": []})

    for session in sessions:
        d = session.day_date
        daily[d]["total_revenue"] += session.total_revenue or 0
        daily[d]["total_expense"] += session.total_expense or 0
        for entry in session.entries:
            name = entry.item_name or "Unknown"
            if name not in daily[d]["items"]:
                daily[d]["items"][name] = {"revenue": 0, "stockout": False, "lost_sales": False}
            if entry.entry_type == "REVENUE":
                daily[d]["items"][name]["revenue"] += entry.value or 0
            if entry.stockout_flag:
                daily[d]["items"][name]["stockout"] = True
                if name not in daily[d]["stockout_items"]:
                    daily[d]["stockout_items"].append(name)
            if entry.lost_sales_flag:
                daily[d]["items"][name]["lost_sales"] = True

    result = []
    for date, data in sorted(daily.items(), reverse=True):
        result.append({
            "date": date,
            "items": data["items"],
            "total_revenue": round(data["total_revenue"], 2),
            "total_expense": round(data["total_expense"], 2),
            "profit": round(data["total_revenue"] - data["total_expense"], 2),
            "stockout_items": data["stockout_items"],
        })
    return result

# ─────────────────────────────────────────────────────────────────────────────
# ASK ENDPOINT — Multi-turn Voice Brain
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/ask")
def ask(req: AskRequest, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    stall = db.query(models.Stall).filter(models.Stall.id == req.stall_id, models.Stall.user_id == user.id).first()
    if not stall: raise HTTPException(404, "Stall not found")

    # Fetch recent daily summary for context
    cutoff = (datetime.utcnow() - timedelta(days=7)).date().isoformat()
    sessions = db.query(models.AudioSession).filter(
        models.AudioSession.stall_id == req.stall_id,
        models.AudioSession.day_date >= cutoff
    ).all()
    daily = defaultdict(lambda: {"revenue": 0, "expense": 0, "stockout_items": []})
    for s in sessions:
        daily[s.day_date]["revenue"] += s.total_revenue or 0
        daily[s.day_date]["expense"] += s.total_expense or 0
        for e in s.entries:
            if e.stockout_flag and e.item_name and e.item_name not in daily[s.day_date]["stockout_items"]:
                daily[s.day_date]["stockout_items"].append(e.item_name)
    daily_summary_list = [
        {"date": d, "total_revenue": v["revenue"], "total_expense": v["expense"],
         "profit": v["revenue"] - v["expense"], "stockout_items": v["stockout_items"]}
        for d, v in sorted(daily.items(), reverse=True)
    ]

    # Fetch udhari summary
    persons = db.query(models.UdhariPerson).filter(models.UdhariPerson.stall_id == req.stall_id).all()
    udhari_list = []
    for p in persons:
        pending = sum(e.amount for e in p.entries if e.status == "pending" and e.direction == "given")
        udhari_list.append({"name": p.name, "pending_total": pending, "id": p.id})

    # Call the Ask brain
    result = process_ask(req.text, daily_summary_list, udhari_list, req.session_context)

    # Auto-execute side effects based on action_data
    action_taken = None
    action_data = result.get("action_data")
    if action_data:
        atype = action_data.get("type", "")
        if atype == "udhari_add":
            person_name = action_data.get("person_name", "")
            amount = action_data.get("amount", 0)
            direction = action_data.get("direction", "given")
            if person_name and amount > 0:
                person = db.query(models.UdhariPerson).filter(
                    models.UdhariPerson.stall_id == req.stall_id,
                    models.UdhariPerson.name.ilike(person_name)
                ).first()
                if not person:
                    person = models.UdhariPerson(stall_id=req.stall_id, name=person_name)
                    db.add(person); db.commit(); db.refresh(person)
                entry = models.UdhariEntry(
                    person_id=person.id, stall_id=req.stall_id,
                    item=action_data.get("item"), amount=amount, direction=direction
                )
                db.add(entry); db.commit()
                action_taken = {"type": "udhari_added", "person": person_name, "amount": amount}

        elif atype == "udhari_pay":
            person_name = action_data.get("person_name", "")
            amount = action_data.get("amount", 0)
            if person_name:
                person = db.query(models.UdhariPerson).filter(
                    models.UdhariPerson.stall_id == req.stall_id,
                    models.UdhariPerson.name.ilike(person_name)
                ).first()
                if person:
                    pending = [e for e in person.entries if e.status == "pending"]
                    total_paid = 0
                    today_date = datetime.utcnow().date().isoformat()
                    items_list = []
                    
                    for e in pending:
                        e.status = "paid"
                        if e.direction == "given":
                            total_paid += e.amount
                            if e.item: items_list.append(e.item)
                            
                    if total_paid > 0:
                        session = db.query(models.AudioSession).filter(
                            models.AudioSession.stall_id == req.stall_id,
                            models.AudioSession.day_date == today_date
                        ).first()
                        if not session:
                            session = models.AudioSession(stall_id=req.stall_id, day_date=today_date)
                            db.add(session); db.commit(); db.refresh(session)
                        
                        items_str = ", ".join(items_list[:3]) + ("..." if len(items_list) > 3 else "")
                        new_entry = models.SessionEntry(
                            session_id=session.id,
                            entry_type="REVENUE",
                            item_name=f"{person.name} paid bill: {items_str}",
                            value=total_paid,
                            amount_type="exact"
                        )
                        db.add(new_entry)
                        session.total_revenue = (session.total_revenue or 0) + total_paid
                        session.profit_value = (session.profit_value or 0) + total_paid
                    
                    db.commit()
                    action_taken = {"type": "udhari_paid", "person": person_name}

    return {
        "intent": result["intent"],
        "reply": result["reply"],
        "follow_up": result.get("follow_up"),
        "action_taken": action_taken,
    }

# ─────────────────────────────────────────────────────────────────────────────
# UDHARI CRUD
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/udhari")
def get_udhari(stall_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    stall = db.query(models.Stall).filter(models.Stall.id == stall_id, models.Stall.user_id == user.id).first()
    if not stall: raise HTTPException(404, "Stall not found")
    persons = db.query(models.UdhariPerson).filter(models.UdhariPerson.stall_id == stall_id).all()
    result = []
    for p in persons:
        pending = sum(e.amount for e in p.entries if e.status == "pending")
        result.append({
            "id": p.id, "name": p.name, "stall_id": stall_id,
            "created_at": p.created_at.isoformat(),
            "pending_total": pending,
            "entries": [{"id": e.id, "item": e.item, "amount": e.amount, "direction": e.direction,
                         "status": e.status, "note": e.note, "created_at": e.created_at.isoformat()}
                        for e in sorted(p.entries, key=lambda x: x.created_at, reverse=True)]
        })
    return result

@app.post("/udhari/person")
def create_udhari_person(req: UdhariPersonCreate, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    stall = db.query(models.Stall).filter(models.Stall.id == req.stall_id, models.Stall.user_id == user.id).first()
    if not stall: raise HTTPException(404, "Stall not found")
    existing = db.query(models.UdhariPerson).filter(
        models.UdhariPerson.stall_id == req.stall_id,
        models.UdhariPerson.name == req.name
    ).first()
    if existing:
        return {"id": existing.id, "name": existing.name, "stall_id": req.stall_id}
    person = models.UdhariPerson(stall_id=req.stall_id, name=req.name)
    db.add(person); db.commit(); db.refresh(person)
    return {"id": person.id, "name": person.name, "stall_id": req.stall_id}

@app.post("/udhari/entry")
def add_udhari_entry(req: UdhariEntryCreate, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    person = db.query(models.UdhariPerson).filter(models.UdhariPerson.id == req.person_id).first()
    if not person: raise HTTPException(404, "Person not found")
    entry = models.UdhariEntry(
        person_id=req.person_id, stall_id=req.stall_id,
        item=req.item, amount=req.amount, direction=req.direction, note=req.note
    )
    db.add(entry); db.commit(); db.refresh(entry)
    return {"id": entry.id, "amount": entry.amount, "status": entry.status}

@app.put("/udhari/entry/{entry_id}/pay")
def mark_udhari_paid(entry_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    entry = db.query(models.UdhariEntry).filter(models.UdhariEntry.id == entry_id).first()
    if not entry: raise HTTPException(404, "Entry not found")
    entry.status = "paid"
    
    # Sync with current day's ledger as REVENUE if it was 'given'
    if entry.direction == "given":
        today_date = datetime.utcnow().date().isoformat()
        session = db.query(models.AudioSession).filter(
            models.AudioSession.stall_id == entry.stall_id,
            models.AudioSession.day_date == today_date
        ).first()
        if not session:
            session = models.AudioSession(stall_id=entry.stall_id, day_date=today_date)
            db.add(session); db.commit(); db.refresh(session)
        
        # Add entry to history
        new_history = models.SessionEntry(
            session_id=session.id,
            entry_type="REVENUE",
            item_name=f"{entry.person.name} paid for: {entry.item or 'items'}",
            value=entry.amount,
            amount_type="exact"
        )
        db.add(new_history)
        
        # Update session totals
        session.total_revenue = (session.total_revenue or 0) + entry.amount
        session.profit_value = (session.profit_value or 0) + entry.amount
    
    db.commit()
    return {"status": "paid", "id": entry_id}

@app.put("/udhari/person/{person_id}/pay-all")
def mark_all_paid(person_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    entries = db.query(models.UdhariEntry).filter(
        models.UdhariEntry.person_id == person_id,
        models.UdhariEntry.status == "pending"
    ).all()
    total_paid = 0
    today_date = datetime.utcnow().date().isoformat()
    person_obj = db.query(models.UdhariPerson).filter(models.UdhariPerson.id == person_id).first()
    items_list = []
    
    for e in entries:
        e.status = "paid"
        if e.direction == "given": 
            total_paid += e.amount
            if e.item: items_list.append(e.item)
    
    if total_paid > 0 and person_obj:
        session = db.query(models.AudioSession).filter(
            models.AudioSession.stall_id == person_obj.stall_id,
            models.AudioSession.day_date == today_date
        ).first()
        if not session:
            session = models.AudioSession(stall_id=person_obj.stall_id, day_date=today_date)
            db.add(session); db.commit(); db.refresh(session)
        
        items_str = ", ".join(items_list[:3]) + ("..." if len(items_list) > 3 else "")
        new_entry = models.SessionEntry(
            session_id=session.id,
            entry_type="REVENUE",
            item_name=f"{person_obj.name} settled bill ({items_str})",
            value=total_paid,
            amount_type="exact"
        )
        db.add(new_entry)
        session.total_revenue = (session.total_revenue or 0) + total_paid
        session.profit_value = (session.profit_value or 0) + total_paid

    db.commit()
    return {"status": "all_paid", "count": len(entries)}

@app.delete("/udhari/person/{person_id}")
def delete_udhari_person(person_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    person = db.query(models.UdhariPerson).filter(models.UdhariPerson.id == person_id).first()
    if not person: raise HTTPException(404, "Person not found")
    db.delete(person); db.commit()
    return {"status": "deleted"}

# ─────────────────────────────────────────────────────────────────────────────
# PDF EXPORT
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/export/pdf")
def export_pdf(stall_id: int, days: int = 30, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    stall = db.query(models.Stall).filter(models.Stall.id == stall_id, models.Stall.user_id == user.id).first()
    if not stall: raise HTTPException(404, "Stall not found")

    cutoff = (datetime.utcnow() - timedelta(days=days)).date().isoformat()
    sessions = db.query(models.AudioSession).filter(
        models.AudioSession.stall_id == stall_id,
        models.AudioSession.day_date >= cutoff
    ).order_by(models.AudioSession.day_date.desc()).all()

    total_rev = sum(s.total_revenue or 0 for s in sessions)
    total_exp = sum(s.total_expense or 0 for s in sessions)
    day_dates = list({s.day_date for s in sessions if s.day_date})

    # Serialize sessions for PDF service
    session_dicts = []
    for s in sessions:
        session_dicts.append({
            "id": s.id,
            "day_date": s.day_date,
            "created_at": s.created_at.isoformat() if s.created_at else "",
            "raw_text": s.raw_text or "",
            "insight": s.insight or "",
            "audio_url": s.audio_url,
            "total_revenue": s.total_revenue or 0,
            "total_expense": s.total_expense or 0,
            "entries": [
                {
                    "entry_type": e.entry_type,
                    "item_name": e.item_name,
                    "value": e.value or 0,
                    "stockout_flag": e.stockout_flag,
                    "lost_sales_flag": e.lost_sales_flag,
                }
                for e in s.entries
            ]
        })

    end_date = datetime.utcnow().date().isoformat()
    date_range = f"{cutoff} to {end_date}" if sessions else end_date
    summary = {
        "total_revenue": total_rev,
        "total_expense": total_exp,
        "profit": total_rev - total_exp,
        "days_count": len(day_dates),
    }

    pdf_path = generate_full_report(
        stall_name=stall.name,
        stall_location=stall.location or "",
        user_name=user.name or "Owner",
        user_phone=user.phone,
        date_range=date_range,
        sessions=session_dicts,
        summary=summary,
    )
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"voicetrace_{stall.name.replace(' ', '_')}_{end_date}.pdf"
    )
