from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from db import Base

class AudioSession(Base):
    __tablename__ = "audio_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
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
    warnings = Column(Text, nullable=True) # Stored as JSON string
    
    entries = relationship("SessionEntry", back_populates="session", cascade="all, delete")

class SessionEntry(Base):
    __tablename__ = "session_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("audio_sessions.id"))
    
    entry_type = Column(String, nullable=False) # 'REVENUE', 'EXPENSE', 'UNKNOWN'
    item_name = Column(String, nullable=True)
    
    value = Column(Float, nullable=True)
    min = Column(Float, nullable=True)
    max = Column(Float, nullable=True)
    amount_type = Column(String, nullable=False) # 'exact', 'range', 'approx'
    
    session = relationship("AudioSession", back_populates="entries")
