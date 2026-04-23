from pydantic import BaseModel
from typing import Optional

class CareerCoachRequest(BaseModel):
    member_id:   str
    job_id:      str
    resume_text: Optional[str] = None

class CareerCoachResponse(BaseModel):
    headline_suggestion: str
    resume_improvements: list[str]
    skills_to_add:       list[str]
    cover_letter_tips:   list[str]
