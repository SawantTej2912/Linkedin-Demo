const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../models/db');
const { publishEvent } = require('../kafka/producer');

function normalizePair(a, b) {
  return [a, b].sort();
}

async function hasExistingConnection(conn, userA, userB) {
  const [a, b] = normalizePair(userA, userB);
  const [rows] = await conn.execute(
    'SELECT id FROM connections WHERE member_a = ? AND member_b = ? LIMIT 1',
    [a, b]
  );
  return rows.length > 0;
}

// POST /connections/request
router.post('/request', async (req, res) => {
  const { requester_id, receiver_id, message, idempotency_key } = req.body;
  if (!requester_id || !receiver_id) {
    return res.status(400).json({ error: 'requester_id and receiver_id required' });
  }
  if (requester_id === receiver_id) {
    return res.status(400).json({ error: 'Cannot connect to yourself' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [memberRows] = await conn.execute(
      'SELECT member_id, is_deleted FROM members WHERE member_id IN (?, ?)',
      [requester_id, receiver_id]
    );
    if (memberRows.length !== 2 || memberRows.some((m) => m.is_deleted)) {
      await conn.rollback();
      return res.status(404).json({ error: 'One or both members not found' });
    }

    if (await hasExistingConnection(conn, requester_id, receiver_id)) {
      await conn.rollback();
      return res.status(409).json({ error: 'Members are already connected' });
    }

    const [existingRequests] = await conn.execute(
      `SELECT request_id, requester_id, receiver_id, status
       FROM connection_requests
       WHERE (requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?)
       ORDER BY created_at DESC`,
      [requester_id, receiver_id, receiver_id, requester_id]
    );

    const pendingReverse = existingRequests.find(
      (r) => r.requester_id === receiver_id && r.receiver_id === requester_id && r.status === 'pending'
    );
    if (pendingReverse) {
      await conn.rollback();
      return res.status(409).json({
        error: 'A pending request from the other user already exists',
        existing_request_id: pendingReverse.request_id,
      });
    }

    const existingForward = existingRequests.find(
      (r) => r.requester_id === requester_id && r.receiver_id === receiver_id
    );
    if (existingForward) {
      await conn.rollback();
      if (existingForward.status === 'pending') {
        return res.status(409).json({ error: 'Connection request already exists', request_id: existingForward.request_id });
      }
      if (existingForward.status === 'accepted') {
        return res.status(409).json({ error: 'Members are already connected' });
      }
    }

    const request_id = uuidv4();
    const ikey = idempotency_key || uuidv4();
    await conn.execute(
      `INSERT INTO connection_requests
       (request_id, requester_id, receiver_id, message, idempotency_key)
       VALUES (?, ?, ?, ?, ?)`,
      [request_id, requester_id, receiver_id, message || null, ikey]
    );

    await conn.commit();

    await publishEvent({
      topic: 'connection.requested',
      eventType: 'connection.requested',
      actorId: requester_id,
      entityType: 'connection',
      entityId: request_id,
      payload: { requester_id, receiver_id, message: message || null },
    });

    res.status(201).json({ request_id });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Connection request already exists' });
    }
    console.error('connection request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

// POST /connections/accept
router.post('/accept', async (req, res) => {
  const { request_id } = req.body;
  if (!request_id) return res.status(400).json({ error: 'request_id required' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      'SELECT * FROM connection_requests WHERE request_id = ? FOR UPDATE',
      [request_id]
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = rows[0];
    const { requester_id, receiver_id } = request;

    if (request.status === 'accepted') {
      await conn.rollback();
      return res.json({ success: true, already_accepted: true });
    }
    if (request.status === 'rejected') {
      await conn.rollback();
      return res.status(409).json({ error: 'Rejected requests cannot be accepted' });
    }

    const [memberA, memberB] = normalizePair(requester_id, receiver_id);
    await conn.execute(
      'UPDATE connection_requests SET status = "accepted" WHERE request_id = ?',
      [request_id]
    );
    await conn.execute(
      'INSERT IGNORE INTO connections (member_a, member_b) VALUES (?, ?)',
      [memberA, memberB]
    );
    await conn.execute(
      'UPDATE members SET connections_count = connections_count + 1 WHERE member_id IN (?, ?)',
      [requester_id, receiver_id]
    );

    await conn.commit();

    await publishEvent({
      topic: 'connection.accepted',
      eventType: 'connection.accepted',
      actorId: receiver_id,
      entityType: 'connection',
      entityId: request_id,
      payload: { requester_id, receiver_id },
    });

    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error('connection accept error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

// POST /connections/reject
router.post('/reject', async (req, res) => {
  const { request_id } = req.body;
  if (!request_id) return res.status(400).json({ error: 'request_id required' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      'SELECT * FROM connection_requests WHERE request_id = ? FOR UPDATE',
      [request_id]
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = rows[0];
    if (request.status === 'accepted') {
      await conn.rollback();
      return res.status(409).json({ error: 'Accepted requests cannot be rejected' });
    }
    if (request.status === 'rejected') {
      await conn.rollback();
      return res.json({ success: true, already_rejected: true });
    }

    await conn.execute(
      'UPDATE connection_requests SET status = "rejected" WHERE request_id = ?',
      [request_id]
    );
    await conn.commit();

    await publishEvent({
      topic: 'connection.rejected',
      eventType: 'connection.rejected',
      actorId: request.receiver_id,
      entityType: 'connection',
      entityId: request_id,
      payload: { requester_id: request.requester_id, receiver_id: request.receiver_id },
    });

    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error('connection reject error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

// POST /connections/list
router.post('/list', async (req, res) => {
  const { user_id, page = 1, limit = 20 } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 20, 1);
    const offset = (pageNum - 1) * limitNum;

    const [rows] = await pool.query(
      `SELECT m.member_id, m.first_name, m.last_name, m.email, m.city, m.state, m.country, m.headline,
              c.connected_at
       FROM connections c
       JOIN members m ON m.member_id = IF(c.member_a = ?, c.member_b, c.member_a)
       WHERE (c.member_a = ? OR c.member_b = ?) AND m.is_deleted = 0
       ORDER BY c.connected_at DESC
       LIMIT ${limitNum} OFFSET ${offset}`,
      [user_id, user_id, user_id]
    );

    res.json({ results: rows, page: pageNum, limit: limitNum });
  } catch (err) {
    console.error('connection list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /connections/pending — requests sent TO this user that are still pending
router.post('/pending', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM connection_requests
       WHERE receiver_id = ? AND status = 'pending'
       ORDER BY created_at DESC`,
      [user_id]
    );
    res.json({ results: rows });
  } catch (err) {
    console.error('connection pending error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /connections/sent — requests sent BY this user that are still pending
router.post('/sent', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM connection_requests
       WHERE requester_id = ? AND status = 'pending'
       ORDER BY created_at DESC`,
      [user_id]
    );
    res.json({ results: rows });
  } catch (err) {
    console.error('connection sent error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /connections/mutual (extra credit)
router.post('/mutual', async (req, res) => {
  const { user_id, other_id } = req.body;
  if (!user_id || !other_id) {
    return res.status(400).json({ error: 'user_id and other_id required' });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT DISTINCT m.member_id, m.first_name, m.last_name, m.email, m.city, m.state, m.country, m.headline
       FROM connections c1
       JOIN connections c2
         ON IF(c1.member_a = ?, c1.member_b, c1.member_a) = IF(c2.member_a = ?, c2.member_b, c2.member_a)
       JOIN members m
         ON m.member_id = IF(c1.member_a = ?, c1.member_b, c1.member_a)
       WHERE (c1.member_a = ? OR c1.member_b = ?)
         AND (c2.member_a = ? OR c2.member_b = ?)
         AND m.is_deleted = 0`,
      [user_id, other_id, user_id, user_id, user_id, other_id, other_id]
    );

    res.json({ results: rows });
  } catch (err) {
    console.error('mutual connections error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
