const mongoose = require('mongoose');

const MONGO_URI = `mongodb://${process.env.MONGO_USER || 'appuser'}:${process.env.MONGO_PASSWORD || 'apppassword'}@${process.env.MONGO_HOST || 'localhost'}:${process.env.MONGO_PORT || 27017}/${process.env.MONGO_DATABASE || 'linkedin_ds_logs'}?authSource=admin`;

mongoose.connect(MONGO_URI).then(() => console.log('MongoDB connected')).catch(console.error);

// Thread schema
const threadSchema = new mongoose.Schema({
  thread_id:       { type: String, required: true, unique: true },
  participant_ids: [String],
  last_message:    String,
  updated_at:      { type: Date, default: Date.now },
  created_at:      { type: Date, default: Date.now },
});

// Message schema
const messageSchema = new mongoose.Schema({
  message_id:       { type: String, required: true, unique: true },
  thread_id:        { type: String, required: true, index: true },
  sender_id:        { type: String, required: true },
  message_text:     { type: String, required: true },
  idempotency_key:  { type: String, sparse: true, unique: true },
  sent_at:          { type: Date, default: Date.now },
});

const Thread  = mongoose.model('Thread',  threadSchema);
const Message = mongoose.model('Message', messageSchema);

module.exports = { Thread, Message };
