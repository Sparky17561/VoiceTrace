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

class AudioSessionExtraction(BaseModel):
    raw_text: str = ""
    normalized_text: str = ""
    entries: List[EntrySchema] = []
    profit: ProfitSchema = ProfitSchema()
    confidence: str = "medium"
    warnings: List[str] = []
    insight: str = "No insight."
    suggestion: str = "No suggestion."

class SessionEntryResponse(BaseModel):
    id: int
    session_id: int
    entry_type: str
    item_name: Optional[str] = None
    value: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None
    amount_type: str

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
    
    entries: List[SessionEntryResponse] = []

    class Config:
        from_attributes = True
