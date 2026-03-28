from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from db import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True)
    otp_code = Column(String, nullable=True)
    otp_expiry = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    stalls = relationship("Stall", back_populates="owner", cascade="all, delete")

class Stall(Base):
    __tablename__ = "stalls"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, nullable=False)
    location = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    owner = relationship("User", back_populates="stalls")
    menu_items = relationship("MenuItem", back_populates="stall", cascade="all, delete")
    sessions = relationship("AudioSession", back_populates="stall", cascade="all, delete")
    messages = relationship("ChatMessage", back_populates="stall", cascade="all, delete")
    udhari_persons = relationship("UdhariPerson", back_populates="stall", cascade="all, delete")

class MenuItem(Base):
    __tablename__ = "menu_items"
    id = Column(Integer, primary_key=True, index=True)
    stall_id = Column(Integer, ForeignKey("stalls.id"))
    item_name = Column(String, nullable=False)
    price_per_unit = Column(Float, nullable=False)
    
    stall = relationship("Stall", back_populates="menu_items")

class AudioSession(Base):
    __tablename__ = "audio_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    stall_id = Column(Integer, ForeignKey("stalls.id"), nullable=True)
    day_date = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    raw_text = Column(String, nullable=True)
    normalized_text = Column(String, nullable=True)
    confidence = Column(String, nullable=True)
    
    profit_value = Column(Float, nullable=True)
    profit_min = Column(Float, nullable=True)
    profit_max = Column(Float, nullable=True)
    profit_type = Column(String, nullable=True)
    
    total_revenue = Column(Float, default=0.0)
    total_expense = Column(Float, default=0.0)
    
    insight = Column(Text, nullable=True)
    suggestion = Column(Text, nullable=True)
    warnings = Column(Text, nullable=True)
    audio_url = Column(String, nullable=True)
    
    stall = relationship("Stall", back_populates="sessions")
    entries = relationship("SessionEntry", back_populates="session", cascade="all, delete")

class SessionEntry(Base):
    __tablename__ = "session_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("audio_sessions.id"))
    
    entry_type = Column(String, nullable=False)  # 'REVENUE', 'EXPENSE', 'UNKNOWN'
    item_name = Column(String, nullable=True)
    
    value = Column(Float, nullable=True)
    min = Column(Float, nullable=True)
    max = Column(Float, nullable=True)
    amount_type = Column(String, nullable=False)  # 'exact', 'range', 'approx'
    
    # ── NEW: Stockout intelligence ──
    stockout_flag = Column(Boolean, default=False)    # item ran out
    lost_sales_flag = Column(Boolean, default=False)  # demand existed but no stock
    
    session = relationship("AudioSession", back_populates="entries")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    stall_id = Column(Integer, ForeignKey("stalls.id"), nullable=True)
    day_date = Column(String, index=True)
    role = Column(String, nullable=False)  # "user", "assistant"
    content = Column(Text, nullable=False)
    message_type = Column(String, default="text")  # "text" or "ledger_card"
    
    associated_session_id = Column(Integer, ForeignKey("audio_sessions.id"), nullable=True)
    associated_session = relationship("AudioSession")
    
    stall = relationship("Stall", back_populates="messages")
    created_at = Column(DateTime, default=datetime.utcnow)

# ── NEW: Udhari (Borrow) System ──

class UdhariPerson(Base):
    __tablename__ = "udhari_persons"
    id = Column(Integer, primary_key=True, index=True)
    stall_id = Column(Integer, ForeignKey("stalls.id"))
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    stall = relationship("Stall", back_populates="udhari_persons")
    entries = relationship("UdhariEntry", back_populates="person", cascade="all, delete")

class UdhariEntry(Base):
    __tablename__ = "udhari_entries"
    id = Column(Integer, primary_key=True, index=True)
    person_id = Column(Integer, ForeignKey("udhari_persons.id"))
    stall_id = Column(Integer, ForeignKey("stalls.id"))
    item = Column(String, nullable=True)      # what was borrowed / lent
    amount = Column(Float, nullable=False)
    direction = Column(String, default="given")   # "given" (I gave) | "taken" (I received)
    status = Column(String, default="pending")    # "pending" | "paid"
    note = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    person = relationship("UdhariPerson", back_populates="entries")
