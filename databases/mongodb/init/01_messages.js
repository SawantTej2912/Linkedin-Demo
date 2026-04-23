// Messages + Threads collections
db = db.getSiblingDB('linkedin_ds_logs');

db.createCollection('threads');
db.threads.createIndex({ participant_ids: 1 });
db.threads.createIndex({ updated_at: -1 });

db.createCollection('messages');
db.messages.createIndex({ thread_id: 1, sent_at: 1 });
db.messages.createIndex({ sender_id: 1 });
db.messages.createIndex({ idempotency_key: 1 }, { unique: true, sparse: true });

print('MongoDB: messages collections and indexes created.');
