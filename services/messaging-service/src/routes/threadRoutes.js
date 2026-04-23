const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Thread } = require('../models/mongoose');

function normalizeParticipants(participantIds) {
  return [...new Set((participantIds || []).filter(Boolean))].sort();
}

// POST /threads/open
router.post('/open', async (req, res) => {
  const normalized = normalizeParticipants(req.body.participant_ids);
  if (normalized.length < 2) {
    return res.status(400).json({ error: 'At least two participant_ids are required' });
  }

  try {
    const existing = await Thread.findOne({
      participant_ids: { $all: normalized, $size: normalized.length },
    }).sort({ updated_at: -1 });

    if (existing) {
      return res.status(200).json({ thread_id: existing.thread_id, existing: true });
    }

    const thread_id = uuidv4();
    const thread = await Thread.create({ thread_id, participant_ids: normalized });
    res.status(201).json({ thread_id: thread.thread_id, existing: false });
  } catch (err) {
    console.error('thread open error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /threads/get
router.post('/get', async (req, res) => {
  const { thread_id } = req.body;
  if (!thread_id) return res.status(400).json({ error: 'thread_id required' });
  try {
    const thread = await Thread.findOne({ thread_id });
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    res.json(thread);
  } catch (err) {
    console.error('thread get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /threads/byUser
router.post('/byUser', async (req, res) => {
  const { user_id, page = 1, limit = 20 } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  try {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 20, 1);
    const threads = await Thread.find({ participant_ids: user_id })
      .sort({ updated_at: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);
    res.json({ results: threads, page: pageNum, limit: limitNum });
  } catch (err) {
    console.error('threads by user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
