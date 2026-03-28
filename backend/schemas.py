from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ProfitSchema(BaseModel):
    value: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None
    type: str = "exact"

class EntrySchema(BaseModel):
    entry_type: str = "UNKNOWN"
    item_name: Optional[str] = None
    value: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None
    type: str = "approx"
    stockout_flag: bool = False
    lost_sales_flag: bool = False

class AudioSessionExtraction(BaseModel):
    raw_text: str = ""
    normalized_text: str = ""
    entries: List[EntrySchema] = []
    profit: ProfitSchema = ProfitSchema()
    confidence: str = "medium"
    warnings: List[str] = []
    insight: str = "No insight."
    suggestion: str = "No suggestion."

class UdhariDataExtraction(BaseModel):
    person_name: str
    item: Optional[str] = ""
    amount: float
    direction: str = "given"
    insight: Optional[str] = "Udhari logged."

class SessionEntryResponse(BaseModel):
    id: int
    session_id: int
    entry_type: str
    item_name: Optional[str] = None
    value: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None
    amount_type: str
    stockout_flag: bool = False
    lost_sales_flag: bool = False

    class Config:
        from_attributes = True

class AudioSessionResponse(BaseModel):
    id: int
    created_at: datetime
    raw_text: Optional[str]
    normalized_text: Optional[str]
    confidence: Optional[str]
    profit_value: Optional[float]
    profit_min: Optional[float]
    profit_max: Optional[float]
    profit_type: Optional[str]
    total_revenue: float
    total_expense: float
    insight: Optional[str]
    suggestion: Optional[str]
    warnings: Optional[str]
    audio_url: Optional[str]
    day_date: Optional[str] = None
    
    entries: List[SessionEntryResponse] = []

    class Config:
        from_attributes = True

class ChatMessageResponse(BaseModel):
    id: int
    day_date: str
    role: str
    content: str
    message_type: str
    associated_session: Optional[AudioSessionResponse] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class IntentResponse(BaseModel):
    intent: str
    user_message: ChatMessageResponse
    assistant_message: ChatMessageResponse
    session: Optional[AudioSessionResponse] = None

# ── Udhari Schemas ──

class UdhariPersonCreate(BaseModel):
    name: str
    stall_id: int

class UdhariEntryCreate(BaseModel):
    person_id: int
    stall_id: int
    item: Optional[str] = None
    amount: float
    direction: str = "given"   # "given" | "taken"
    note: Optional[str] = None

class UdhariEntryResponse(BaseModel):
    id: int
    item: Optional[str]
    amount: float
    direction: str
    status: str
    note: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class UdhariPersonResponse(BaseModel):
    id: int
    name: str
    stall_id: int
    created_at: datetime
    entries: List[UdhariEntryResponse] = []
    pending_total: float = 0.0
    
    class Config:
        from_attributes = True

# ── Ask Tab Schema ──

class AskRequest(BaseModel):
    stall_id: int
    text: str
    session_context: List[dict] = []   # last few exchanges for multi-turn

class AskResponse(BaseModel):
    intent: str
    reply: str
    follow_up: Optional[str] = None
    action_taken: Optional[dict] = None
