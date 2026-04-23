from .schemas import MatchRequest, MatchResult

def compute_match(req: MatchRequest) -> MatchResult:
    """Rule-based + skills overlap match score."""
    job_set    = set(s.lower() for s in req.job_skills)
    member_set = set(s.lower() for s in req.resume_skills)
    overlap    = job_set & member_set

    # Skills score (0-0.6 weight)
    skills_score = len(overlap) / max(len(job_set), 1) * 0.6

    # Location score (0-0.2 weight)
    location_score = 0.0
    if req.job_location and req.member_location:
        if req.job_location.lower() in req.member_location.lower():
            location_score = 0.2

    # Experience score (0-0.2 weight)
    exp_score = 0.0
    if req.required_experience is not None and req.member_experience is not None:
        ratio = req.member_experience / max(req.required_experience, 0.5)
        exp_score = min(ratio, 1.0) * 0.2

    match_score = round(skills_score + location_score + exp_score, 3)
    explanation = (
        f"Skills overlap: {len(overlap)}/{len(job_set)} ({', '.join(list(overlap)[:5])}). "
        f"Location match: {'yes' if location_score > 0 else 'no'}. "
        f"Experience: {req.member_experience or 'unknown'} vs required {req.required_experience or 'any'}."
    )
    return MatchResult(
        member_id=req.member_id,
        job_id=req.job_id,
        match_score=match_score,
        skills_overlap=list(overlap),
        explanation=explanation,
    )
