from pydantic import BaseModel
from typing import Optional

class ResumeParseRequest(BaseModel):
    resume_text: str
    member_id:   Optional[str] = None

class ParsedResume(BaseModel):
    skills:           list[str]
    years_experience: float
    education:        list[dict]
    job_titles:       list[str]
    summary:          Optional[str] = None
