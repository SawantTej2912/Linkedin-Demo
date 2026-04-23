from fastapi import APIRouter, HTTPException
from .schemas import ResumeParseRequest, ParsedResume
from .skill import parse_resume

router = APIRouter(prefix="/skills/parse-resume", tags=["skills"])

@router.post("", response_model=ParsedResume)
async def parse_resume_endpoint(req: ResumeParseRequest):
    try:
        return await parse_resume(req.resume_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
