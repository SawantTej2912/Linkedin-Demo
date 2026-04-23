const mongoose = require('mongoose');

const MONGO_URI = `mongodb://${process.env.MONGO_USER || 'appuser'}:${process.env.MONGO_PASSWORD || 'apppassword'}@${process.env.MONGO_HOST || 'localhost'}:${process.env.MONGO_PORT || 27017}/${process.env.MONGO_DATABASE || 'linkedin_ds_logs'}?authSource=admin`;

mongoose.connect(MONGO_URI).then(() => console.log('Analytics: MongoDB connected')).catch(console.error);

const eventLogSchema = new mongoose.Schema({
  event_type:      { type: String, required: true, index: true },
  trace_id:        String,
  timestamp:       { type: Date, default: Date.now, index: true },
  actor_id:        { type: String, index: true },
  entity:          { entity_type: String, entity_id: String },
  payload:         mongoose.Schema.Types.Mixed,
  idempotency_key: { type: String, sparse: true, unique: true },
  _topic:          String,
}, {
  collection: 'event_logs',
});

eventLogSchema.index({ 'entity.entity_id': 1 });

const EventLog = mongoose.model('EventLog', eventLogSchema);
module.exports = EventLog;
