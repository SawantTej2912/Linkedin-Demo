import asyncio
from typing import Optional
from shared.service_client import get_job, get_applications_by_job, get_member
from shared.llm_client import chat_complete, has_llm
from shared.kafka_client import publish_event
from shared.trace_store import upsert_trace, append_history, get_trace
from skills.resume_parser.skill import parse_resume
from skills.job_candidate_matcher.skill import compute_match
from skills.job_candidate_matcher.schemas import MatchRequest
from .schemas import HiringTaskStatus, ShortlistedCandidate, TaskStatus

_tasks: dict[str, HiringTaskStatus] = {}


def _task_payload(task: HiringTaskStatus) -> dict:
    return {
        'trace_id': task.trace_id,
        'job_id': task.job_id,
        'recruiter_id': task.recruiter_id,
        'status': task.status.value if hasattr(task.status, 'value') else str(task.status),
        'step': task.step,
        'error': task.error,
        'approval_action': task.approval_action,
        'shortlist': [candidate.model_dump() for candidate in task.shortlist],
        'history': task.history,
    }


async def persist_task(task: HiringTaskStatus, history_details: Optional[dict] = None) -> HiringTaskStatus:
    _tasks[task.trace_id] = task
    await upsert_trace(task.trace_id, _task_payload(task))
    await append_history(
        task.trace_id,
        task.status.value if hasattr(task.status, 'value') else str(task.status),
        task.step,
        history_details,
    )
    stored = await get_task_async(task.trace_id)
    return stored or task


async def initialize_task(trace_id: str, job_id: str, recruiter_id: str, status: TaskStatus, step: str) -> HiringTaskStatus:
    task = HiringTaskStatus(
        trace_id=trace_id,
        status=status,
        job_id=job_id,
        recruiter_id=recruiter_id,
        step=step,
    )
    return await persist_task(task, {'initialized': True})


async def get_task_async(trace_id: str) -> Optional[HiringTaskStatus]:
    if trace_id in _tasks:
        return _tasks[trace_id]
    doc = await get_trace(trace_id)
    if not doc:
        return None
    doc['status'] = TaskStatus(doc.get('status', TaskStatus.pending))
    shortlist = doc.get('shortlist', [])
    doc['shortlist'] = [ShortlistedCandidate(**item) for item in shortlist]
    task = HiringTaskStatus(**doc)
    _tasks[trace_id] = task
    return task


async def _publish_result(task: HiringTaskStatus, extra_payload: Optional[dict] = None) -> None:
    payload = {
        'job_id': task.job_id,
        'recruiter_id': task.recruiter_id,
        'status': task.status.value if hasattr(task.status, 'value') else str(task.status),
        'step': task.step,
        'approval_action': task.approval_action,
        'shortlist_count': len(task.shortlist),
        'shortlist': [candidate.model_dump() for candidate in task.shortlist],
    }
    if extra_payload:
        payload.update(extra_payload)
    publish_event('ai.results', 'ai.results', task.recruiter_id, 'ai_task', task.trace_id, payload, task.trace_id)


async def _is_cancelled(trace_id: str) -> bool:
    task = await get_task_async(trace_id)
    return bool(task and task.status == TaskStatus.cancelled)


def _compose_location(data: dict) -> str:
    return ', '.join([data.get('city', ''), data.get('state', ''), data.get('country', '')]).strip(', ')


async def _generate_outreach(job: dict, candidate: ShortlistedCandidate) -> str:
    if not has_llm():
        overlap = ', '.join(candidate.skills_overlap[:3]) if candidate.skills_overlap else 'your background'
        return (
            f"Hi — I’m recruiting for {job.get('title', 'this role')}. "
            f"Your experience with {overlap} stood out, and I’d like to share more about the opportunity. "
            f"Would you be open to a short conversation this week?"
        )

    return await chat_complete([
        {
            'role': 'system',
            'content': 'You are a recruiter assistant. Write a short, personalized LinkedIn outreach message under 150 words.',
        },
        {
            'role': 'user',
            'content': (
                f"Job: {job.get('title')} at {job.get('company_name') or job.get('company_id')}. "
                f"Candidate match score: {candidate.match_score:.0%}. "
                f"Skills overlap: {', '.join(candidate.skills_overlap)}. "
                'Write the outreach message.'
            ),
        },
    ])


async def run_hiring_workflow(job_id: str, recruiter_id: str, top_k: int, trace_id: str, source: str = 'kafka'):
    task = await get_task_async(trace_id)
    if not task:
        task = await initialize_task(trace_id, job_id, recruiter_id, TaskStatus.pending, 'Queued for processing')

    task.status = TaskStatus.running
    task.step = 'Fetching job details'
    await persist_task(task, {'source': source})

    try:
        if await _is_cancelled(trace_id):
            return await get_task_async(trace_id)

        job = await get_job(job_id)
        job_skills = job.get('skills', []) or []
        job_location = _compose_location(job)

        task.step = 'Fetching applications'
        await persist_task(task)
        applications = await get_applications_by_job(job_id, limit=100)

        if await _is_cancelled(trace_id):
            return await get_task_async(trace_id)

        if not applications:
            task.status = TaskStatus.completed
            task.step = 'No applications found'
            task.shortlist = []
            await persist_task(task, {'applications_found': 0})
            await _publish_result(task, {'applications_found': 0})
            return task

        task.step = 'Parsing resumes and scoring candidates'
        await persist_task(task, {'applications_found': len(applications)})

        async def process_application(app: dict):
            member_id = app.get('member_id')
            if not member_id:
                return None
            try:
                member = await get_member(member_id)
                resume_text = app.get('resume_text') or member.get('resume_text', '') or member.get('about', '')
                if not resume_text:
                    return None
                parsed = await parse_resume(resume_text)
                match = compute_match(MatchRequest(
                    job_id=job_id,
                    member_id=member_id,
                    job_skills=job_skills,
                    resume_skills=parsed.skills,
                    job_location=job_location or None,
                    member_location=_compose_location(member) or None,
                    member_experience=parsed.years_experience,
                ))
                return ShortlistedCandidate(
                    member_id=member_id,
                    match_score=match.match_score,
                    skills_overlap=match.skills_overlap,
                    explanation=match.explanation,
                )
            except Exception as exc:
                print(f'Error processing {member_id}: {exc}')
                return None

        results = await asyncio.gather(*[process_application(app) for app in applications])
        scored = sorted([item for item in results if item], key=lambda x: x.match_score, reverse=True)[:top_k]

        if await _is_cancelled(trace_id):
            return await get_task_async(trace_id)

        task.step = 'Generating outreach drafts'
        await persist_task(task, {'scored_candidates': len(scored)})
        for candidate in scored:
            candidate.outreach_draft = await _generate_outreach(job, candidate)

        task.shortlist = scored
        task.status = TaskStatus.awaiting_approval
        task.step = 'Awaiting recruiter approval'
        await persist_task(task, {'shortlist_count': len(scored)})
        await _publish_result(task, {'source': source})
        return task

    except Exception as exc:
        task.status = TaskStatus.failed
        task.error = str(exc)
        task.step = 'Workflow failed'
        await persist_task(task, {'error': str(exc)})
        try:
            await _publish_result(task, {'error': str(exc), 'source': source})
        except Exception:
            pass
        print(f'Hiring workflow error [{trace_id}]: {exc}')
        return task


async def handle_approval(trace_id: str, action: str, edited_outreach: Optional[str] = None):
    task = await get_task_async(trace_id)
    if not task:
        return None

    normalized = (action or '').strip().lower()
    if normalized not in {'approve', 'edit', 'reject'}:
        raise ValueError('action must be approve, edit, or reject')

    task.approval_action = normalized
    if normalized == 'reject':
        task.status = TaskStatus.rejected
        task.step = 'Recruiter rejected AI output'
    else:
        if normalized == 'edit' and edited_outreach and task.shortlist:
            task.shortlist[0].outreach_draft = edited_outreach
        task.status = TaskStatus.approved
        task.step = 'Recruiter approved AI output'

    await persist_task(task, {'approval_action': normalized})
    await _publish_result(task, {'approval_action': normalized})
    return task


async def cancel_task_async(trace_id: str):
    task = await get_task_async(trace_id)
    if not task:
        return None

    if task.status in {TaskStatus.completed, TaskStatus.approved, TaskStatus.rejected, TaskStatus.failed}:
        return task

    task.status = TaskStatus.cancelled
    task.step = 'Cancelled by recruiter'
    await persist_task(task, {'approval_action': 'cancel'})
    await _publish_result(task, {'approval_action': 'cancel'})
    return task
