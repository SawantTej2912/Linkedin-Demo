const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Message, Thread } = require('../models/mongoose');
const { publishEvent } = require('../kafka/producer');

async function withRetry(fn, attempts = 3, delayMs = 300) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts) throw err;
      console.warn(`[messaging] Retry ${i}/${attempts} after error: ${err.message}`);
      await new Promise((r) => setTimeout(r, delayMs * i));
    }
  }
}

// POST /messages/send
router.post('/send', async (req, res) => {
  const { thread_id, sender_id, message_text, idempotency_key } = req.body;
  if (!thread_id || !sender_id || !message_text) {
    return res.status(400).json({ error: 'thread_id, sender_id, message_text required' });
  }

  const message_id = uuidv4();
  const ikey = idempotency_key || uuidv4();

  try {
    const thread = await Thread.findOne({ thread_id });
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    if (!thread.participant_ids.includes(sender_id)) {
      return res.status(403).json({ error: 'Sender is not a participant in this thread' });
    }

    const msg = await withRetry(() =>
      Message.create({ message_id, thread_id, sender_id, message_text, idempotency_key: ikey })
    );

    await withRetry(() =>
      Thread.updateOne({ thread_id }, { last_message: message_text, updated_at: new Date() })
    );

    publishEvent({
      topic: 'message.sent',
      eventType: 'message.sent',
      actorId: sender_id,
      entityType: 'thread',
      entityId: thread_id,
      payload: { message_id, message_text },
    }).catch((err) => console.error('[messaging] Kafka publish failed (non-fatal):', err.message));

    res.status(201).json({ message_id: msg.message_id });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Duplicate message (idempotency)' });
    }
    console.error('[messaging] send failed after retries:', err.message);
    res.status(500).json({ error: 'Message send failed — please retry' });
  }
});

// POST /messages/list
router.post('/list', async (req, res) => {
  const { thread_id, page = 1, limit = 50 } = req.body;
  if (!thread_id) return res.status(400).json({ error: 'thread_id required' });
  try {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 50, 1);
    const messages = await Message.find({ thread_id })
      .sort({ sent_at: 1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);
    res.json({ results: messages, page: pageNum, limit: limitNum });
  } catch (err) {
    console.error('messages list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
