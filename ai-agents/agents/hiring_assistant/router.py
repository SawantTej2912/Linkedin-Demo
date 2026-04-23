import uuid
import asyncio
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from config import AI_INLINE_FALLBACK
from shared.kafka_client import publish_event
from .schemas import HiringRequest, HiringTaskStatus, ApprovalRequest, TaskStatus
from .agent import (
    initialize_task,
    run_hiring_workflow,
    get_task_async,
    handle_approval,
    cancel_task_async,
)

router = APIRouter(prefix='/agents/hiring-assistant', tags=['agents'])


@router.post('/start', response_model=HiringTaskStatus)
async def start_hiring_workflow(req: HiringRequest):
    trace_id = str(uuid.uuid4())
    task = await initialize_task(
        trace_id=trace_id,
        job_id=req.job_id,
        recruiter_id=req.recruiter_id,
        status=TaskStatus.pending,
        step='Queued for Kafka processing',
    )

    try:
        publish_event(
            'ai.requests',
            'ai.requested',
            req.recruiter_id,
            'ai_task',
            trace_id,
            {'job_id': req.job_id, 'recruiter_id': req.recruiter_id, 'top_k': req.top_k},
            trace_id,
        )
        return task
    except Exception as exc:
        if not AI_INLINE_FALLBACK:
            raise HTTPException(status_code=503, detail=f'Kafka unavailable and inline fallback disabled: {exc}')
        asyncio.create_task(run_hiring_workflow(req.job_id, req.recruiter_id, req.top_k, trace_id, source='inline-fallback'))
        fallback_task = await initialize_task(
            trace_id=trace_id,
            job_id=req.job_id,
            recruiter_id=req.recruiter_id,
            status=TaskStatus.pending,
            step='Kafka unavailable — running inline fallback',
        )
        return fallback_task


@router.post('/status', response_model=HiringTaskStatus)
async def get_status(body: dict):
    trace_id = body.get('trace_id')
    task = await get_task_async(trace_id)
    if not task:
        raise HTTPException(status_code=404, detail='Task not found')
    return task


@router.post('/approve', response_model=HiringTaskStatus)
async def approve_task(req: ApprovalRequest):
    try:
        task = await handle_approval(req.trace_id, req.action, req.edited_outreach)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not task:
        raise HTTPException(status_code=404, detail='Task not found')
    return task


@router.post('/cancel', response_model=HiringTaskStatus)
async def cancel_task(body: dict):
    trace_id = body.get('trace_id')
    task = await cancel_task_async(trace_id)
    if not task:
        raise HTTPException(status_code=404, detail='Task not found')
    if task.status in {TaskStatus.completed, TaskStatus.approved, TaskStatus.rejected, TaskStatus.failed}:
        raise HTTPException(status_code=400, detail='Task already completed — cannot cancel')
    return task


@router.websocket('/ws/{trace_id}')
async def websocket_status(websocket: WebSocket, trace_id: str):
    await websocket.accept()
    try:
        last_snapshot = None
        while True:
            task = await get_task_async(trace_id)
            if task:
                snapshot = task.model_dump(mode='json')
                if snapshot != last_snapshot:
                    await websocket.send_json(snapshot)
                    last_snapshot = snapshot
                    if task.status in {
                        TaskStatus.completed,
                        TaskStatus.approved,
                        TaskStatus.rejected,
                        TaskStatus.failed,
                        TaskStatus.awaiting_approval,
                        TaskStatus.cancelled,
                    }:
                        break
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        pass
