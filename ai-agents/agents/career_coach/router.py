import json
from fastapi import APIRouter, HTTPException
from .schemas import CareerCoachRequest, CareerCoachResponse
from shared.service_client import get_member, get_job
from shared.llm_client import chat_complete, has_llm

router = APIRouter(prefix='/agents/career-coach', tags=['agents'])


def heuristic_career_coach(member: dict, job: dict, resume: str) -> CareerCoachResponse:
    current_headline = member.get('headline', '').strip()
    job_title = job.get('title', 'Target Role')
    job_skills = [str(s) for s in job.get('skills', [])]
    resume_lower = (resume or '').lower()
    missing_skills = [skill for skill in job_skills if skill.lower() not in resume_lower][:5]

    headline = current_headline or f'{job_title} | {", ".join(job_skills[:3])}'
    if job_skills:
        headline = f'{job_title} | {", ".join(job_skills[:3])} | Results-driven candidate'

    improvements = [
        'Quantify impact in each experience bullet with metrics such as latency reduced, users served, or revenue influenced.',
        f'Align your summary with the {job_title} role and explicitly mention the most important required skills.',
        'Move the most relevant projects and achievements higher in the resume so recruiters see them first.',
    ]
    if missing_skills:
        improvements.append(f'Add evidence for these missing skills if you truly have them: {", ".join(missing_skills)}.')

    cover_tips = [
        'Open with why this company and role fit your background instead of using a generic introduction.',
        'Use one short paragraph to connect your strongest project or experience to the job requirements.',
        'Close with a concrete value statement and interest in the next hiring step.',
    ]

    return CareerCoachResponse(
        headline_suggestion=headline,
        resume_improvements=improvements,
        skills_to_add=missing_skills,
        cover_letter_tips=cover_tips,
    )


@router.post('', response_model=CareerCoachResponse)
async def career_coach(req: CareerCoachRequest):
    try:
        member, job = await get_member(req.member_id), await get_job(req.job_id)
        resume = req.resume_text or member.get('resume_text', '') or member.get('about', '')

        if not has_llm():
            return heuristic_career_coach(member, job, resume)

        prompt = f"""
Job title: {job.get('title')}
Job skills required: {', '.join(job.get('skills', []))}
Job description (excerpt): {str(job.get('description', ''))[:500]}

Candidate's current headline: {member.get('headline', '')}
Candidate's resume/about (excerpt): {resume[:800]}

Return ONLY valid JSON:
{{
  "headline_suggestion": "...",
  "resume_improvements": ["...", "..."],
  "skills_to_add": ["..."],
  "cover_letter_tips": ["...", "..."]
}}"""
        content = await chat_complete([
            {'role': 'system', 'content': 'You are a professional career coach helping candidates tailor their profile for a specific job.'},
            {'role': 'user', 'content': prompt},
        ])
        data = json.loads(content)
        return CareerCoachResponse(**data)
    except Exception as exc:
        try:
            member, job = await get_member(req.member_id), await get_job(req.job_id)
            resume = req.resume_text or member.get('resume_text', '') or member.get('about', '')
            return heuristic_career_coach(member, job, resume)
        except Exception:
            raise HTTPException(status_code=500, detail=str(exc))
