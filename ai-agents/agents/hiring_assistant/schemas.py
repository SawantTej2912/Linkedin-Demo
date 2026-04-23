from pydantic import BaseModel
from typing import Optional, Any
from enum import Enum

class TaskStatus(str, Enum):
    pending = 'pending'
    running = 'running'
    awaiting_approval = 'awaiting_approval'
    approved = 'approved'
    rejected = 'rejected'
    completed = 'completed'
    failed = 'failed'
    cancelled = 'cancelled'

class HiringRequest(BaseModel):
    job_id: str
    recruiter_id: str
    top_k: int = 5

class ShortlistedCandidate(BaseModel):
    member_id: str
    match_score: float
    skills_overlap: list[str]
    explanation: str
    outreach_draft: Optional[str] = None

class HiringTaskStatus(BaseModel):
    trace_id: str
    status: TaskStatus
    job_id: str
    recruiter_id: str
    shortlist: list[ShortlistedCandidate] = []
    step: str = ''
    error: Optional[str] = None
    approval_action: Optional[str] = None
    history: list[dict[str, Any]] = []

class ApprovalRequest(BaseModel):
    trace_id: str
    action: str  # approve | edit | reject
    edited_outreach: Optional[str] = None
