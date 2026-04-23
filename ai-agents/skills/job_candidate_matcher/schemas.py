from pydantic import BaseModel
from typing import Optional

class MatchRequest(BaseModel):
    job_id:      str
    member_id:   str
    job_skills:  list[str]
    resume_skills: list[str]
    job_location:  Optional[str] = None
    member_location: Optional[str] = None
    required_experience: Optional[float] = None
    member_experience:   Optional[float] = None

class MatchResult(BaseModel):
    member_id:     str
    job_id:        str
    match_score:   float          # 0.0 – 1.0
    skills_overlap: list[str]
    explanation:   str
