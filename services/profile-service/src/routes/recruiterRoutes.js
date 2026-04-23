const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const bcrypt  = require('bcryptjs');
const pool    = require('../models/db');

// POST /recruiters/create
// Creates a new recruiter account.
// Required: first_name, last_name, email, password, company_name
router.post('/create', async (req, res) => {
  const { first_name, last_name, email, password, phone, company_id, company_name, company_industry, company_size, role } = req.body;
  if (!first_name || !last_name || !email || !password || !company_name) {
    return res.status(400).json({ error: 'first_name, last_name, email, password, company_name required' });
  }
  try {
    const recruiter_id    = uuidv4();
    const cid             = company_id || uuidv4();
    const password_hash   = await bcrypt.hash(password, 10);
    await pool.execute(
      `INSERT INTO recruiters
         (recruiter_id, company_id, first_name, last_name, email, password_hash, phone, company_name, company_industry, company_size, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [recruiter_id, cid, first_name, last_name, email, password_hash, phone || null, company_name, company_industry || null, company_size || null, role || 'recruiter']
    );
    res.status(201).json({ recruiter_id, company_id: cid });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already exists' });
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /recruiters/login
// Verifies recruiter email + password. Returns recruiter data if correct.
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM recruiters WHERE email = ? AND (is_deleted IS NULL OR is_deleted = 0)', [email]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid email or password' });

    const recruiter = rows[0];
    // Guard: if no password_hash set (old account), reject cleanly instead of crashing
    if (!recruiter.password_hash) return res.status(401).json({ error: 'Invalid email or password' });
    const match = await bcrypt.compare(password, recruiter.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    const { password_hash, ...safeData } = recruiter;
    res.json(safeData);
  } catch (err) {
    console.error('recruiter login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /recruiters/get
router.post('/get', async (req, res) => {
  const { recruiter_id } = req.body;
  if (!recruiter_id) return res.status(400).json({ error: 'recruiter_id required' });
  try {
    const [rows] = await pool.execute('SELECT * FROM recruiters WHERE recruiter_id = ?', [recruiter_id]);
    if (!rows.length) return res.status(404).json({ error: 'Recruiter not found' });
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /recruiters/update
router.post('/update', async (req, res) => {
  const { recruiter_id, ...fields } = req.body;
  if (!recruiter_id) return res.status(400).json({ error: 'recruiter_id required' });
  const allowed = ['first_name', 'last_name', 'phone', 'company_name', 'company_industry', 'company_size', 'role'];
  const updates = Object.keys(fields).filter(k => allowed.includes(k));
  if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });
  try {
    const [check] = await pool.execute('SELECT recruiter_id FROM recruiters WHERE recruiter_id = ?', [recruiter_id]);
    if (!check.length) return res.status(404).json({ error: 'Recruiter not found' });
    const set = updates.map(k => `${k} = ?`).join(', ');
    await pool.execute(`UPDATE recruiters SET ${set} WHERE recruiter_id = ?`, [...updates.map(k => fields[k]), recruiter_id]);
    res.json({ recruiter_id, updated_fields: updates });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /recruiters/delete
router.post('/delete', async (req, res) => {
  const { recruiter_id } = req.body;
  if (!recruiter_id) return res.status(400).json({ error: 'recruiter_id required' });
  try {
    const [check] = await pool.execute('SELECT recruiter_id FROM recruiters WHERE recruiter_id = ?', [recruiter_id]);
    if (!check.length) return res.status(404).json({ error: 'Recruiter not found' });
    await pool.execute('UPDATE recruiters SET is_deleted = 1 WHERE recruiter_id = ?', [recruiter_id]);
    res.json({ recruiter_id, deleted: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
