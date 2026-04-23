from datetime import datetime, timezone
from typing import Any, Optional
from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGO_URI, MONGO_DATABASE

_client = AsyncIOMotorClient(MONGO_URI)
_db = _client[MONGO_DATABASE]
_collection = _db['ai_task_traces']


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def upsert_trace(trace_id: str, data: dict[str, Any]) -> None:
    payload = {**data, 'updated_at': utcnow()}
    await _collection.update_one(
        {'trace_id': trace_id},
        {'$set': payload, '$setOnInsert': {'trace_id': trace_id, 'created_at': utcnow(), 'history': []}},
        upsert=True,
    )


async def append_history(trace_id: str, status: str, step: str, details: Optional[dict[str, Any]] = None) -> None:
    await _collection.update_one(
        {'trace_id': trace_id},
        {
            '$push': {
                'history': {
                    'timestamp': utcnow(),
                    'status': status,
                    'step': step,
                    'details': details or {},
                }
            },
            '$set': {'updated_at': utcnow()},
        },
        upsert=True,
    )


async def get_trace(trace_id: str) -> Optional[dict[str, Any]]:
    return await _collection.find_one({'trace_id': trace_id}, {'_id': 0})
