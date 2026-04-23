import json
import uuid
from datetime import datetime, timezone
from kafka import KafkaProducer, KafkaConsumer
from config import KAFKA_BROKER

_producer = None

def get_producer() -> KafkaProducer:
    global _producer
    if _producer is None:
        _producer = KafkaProducer(
            bootstrap_servers=KAFKA_BROKER,
            value_serializer=lambda v: json.dumps(v).encode(),
            key_serializer=lambda k: k.encode() if k else None,
        )
    return _producer

def publish_event(topic: str, event_type: str, actor_id: str, entity_type: str, entity_id: str, payload: dict, trace_id: str = None):
    envelope = {
        "event_type":      event_type,
        "trace_id":        trace_id or str(uuid.uuid4()),
        "timestamp":       datetime.now(timezone.utc).isoformat(),
        "actor_id":        actor_id,
        "entity":          {"entity_type": entity_type, "entity_id": entity_id},
        "payload":         payload,
        "idempotency_key": str(uuid.uuid4()),
    }
    get_producer().send(topic, key=entity_id, value=envelope)
    get_producer().flush()
    return envelope
