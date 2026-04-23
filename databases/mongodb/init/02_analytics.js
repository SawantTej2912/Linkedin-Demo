// Analytics event logs + AI traces collections
db = db.getSiblingDB('linkedin_ds_logs');

db.createCollection('event_logs');
db.event_logs.createIndex({ event_type: 1, timestamp: -1 });
db.event_logs.createIndex({ actor_id: 1 });
db.event_logs.createIndex({ 'entity.entity_id': 1 });
db.event_logs.createIndex({ trace_id: 1 });
db.event_logs.createIndex({ idempotency_key: 1 }, { unique: true, sparse: true });

db.createCollection('ai_task_traces');
db.ai_task_traces.createIndex({ trace_id: 1 }, { unique: true });
db.ai_task_traces.createIndex({ status: 1 });
db.ai_task_traces.createIndex({ created_at: -1 });
db.ai_task_traces.createIndex({ 'history.timestamp': -1 });

print('MongoDB: analytics collections and indexes created.');
