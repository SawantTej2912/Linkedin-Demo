from fastapi import APIRouter
from .schemas import MatchRequest, MatchResult
from .skill import compute_match

router = APIRouter(prefix="/skills/match-candidates", tags=["skills"])

@router.post("", response_model=MatchResult)
async def match_endpoint(req: MatchRequest):
    return compute_match(req)
