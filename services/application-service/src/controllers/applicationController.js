const { v4: uuidv4 } = require('uuid');
const pool = require('../models/db');
const { publishEvent } = require('../kafka/producer');

function parsePageLimit(body = {}) {
  const page = Math.max(parseInt(body.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(body.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function buildLocation(memberRow) {
  return [memberRow.city, memberRow.state, memberRow.country].filter(Boolean).join(', ');
}

async function submitApplication(req, res) {
  const { job_id, member_id, resume_url, resume_text, cover_letter, idempotency_key } = req.body;
  if (!job_id || !member_id) return res.status(400).json({ error: 'job_id and member_id required' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [jobRows] = await conn.execute(
      'SELECT job_id, recruiter_id, status FROM jobs WHERE job_id = ?',
      [job_id]
    );
    const [memberRows] = await conn.execute(
      'SELECT member_id, city, state, country FROM members WHERE member_id = ? AND is_deleted = 0',
      [member_id]
    );

    if (!jobRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Job not found' });
    }
    if (!memberRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Member not found' });
    }
    if (jobRows[0].status !== 'open') {
      await conn.rollback();
      return res.status(409).json({ error: 'Cannot apply to a closed job' });
    }

    const application_id = uuidv4();
    const ikey = idempotency_key || uuidv4();

    await conn.execute(
      `INSERT INTO applications
       (application_id, job_id, member_id, resume_url, resume_text, cover_letter, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [application_id, job_id, member_id, resume_url || null, resume_text || null, cover_letter || null, ikey]
    );

    await conn.execute('UPDATE jobs SET applicants_count = applicants_count + 1 WHERE job_id = ?', [job_id]);
    await conn.commit();

    const member = memberRows[0];
    await publishEvent({
      topic: 'application.submitted',
      eventType: 'application.submitted',
      actorId: member_id,
      entityType: 'application',
      entityId: application_id,
      payload: {
        application_id,
        job_id,
        member_id,
        recruiter_id: jobRows[0].recruiter_id,
        location: buildLocation(member),
        city: member.city || null,
        state: member.state || null,
        country: member.country || null,
        status: 'submitted',
      },
    });

    res.status(201).json({ application_id });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Already applied to this job' });
    console.error('submitApplication error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
}

async function getApplication(req, res) {
  const { application_id } = req.body;
  if (!application_id) return res.status(400).json({ error: 'application_id required' });
  try {
    const [rows] = await pool.execute('SELECT * FROM applications WHERE application_id = ?', [application_id]);
    if (!rows.length) return res.status(404).json({ error: 'Application not found' });

    const [notes] = await pool.execute('SELECT * FROM application_notes WHERE application_id = ? ORDER BY created_at DESC', [application_id]);
    const [history] = await pool.execute('SELECT * FROM application_status_history WHERE application_id = ? ORDER BY changed_at DESC', [application_id]);

    res.json({ ...rows[0], notes, history });
  } catch (err) {
    console.error('getApplication error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function applicationsByJob(req, res) {
  const { job_id, recruiter_id } = req.body;
  if (!job_id) return res.status(400).json({ error: 'job_id required' });

  const { page, limit, offset } = parsePageLimit(req.body);

  try {
    if (recruiter_id) {
      const [jobRows] = await pool.execute('SELECT recruiter_id FROM jobs WHERE job_id = ?', [job_id]);
      if (!jobRows.length) return res.status(404).json({ error: 'Job not found' });
      if (jobRows[0].recruiter_id !== recruiter_id) {
        return res.status(403).json({ error: 'Only the owning recruiter can view applications for this job' });
      }
    }

    const [rows] = await pool.query(
      `SELECT a.*, m.first_name, m.last_name, m.headline, m.city, m.state, m.country
       FROM applications a
       LEFT JOIN members m ON m.member_id = a.member_id
       WHERE a.job_id = ?
       ORDER BY a.applied_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [job_id]
    );
    res.json({ results: rows, page, limit });
  } catch (err) {
    console.error('applicationsByJob error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function applicationsByMember(req, res) {
  const { member_id } = req.body;
  if (!member_id) return res.status(400).json({ error: 'member_id required' });

  const { page, limit, offset } = parsePageLimit(req.body);

  try {
    const [rows] = await pool.query(
      `SELECT a.*, j.title, j.city, j.state, j.country, j.work_mode, j.employment_type, j.seniority_level,
              r.company_name
       FROM applications a
       LEFT JOIN jobs j ON j.job_id = a.job_id
       LEFT JOIN recruiters r ON r.recruiter_id = j.recruiter_id
       WHERE a.member_id = ?
       ORDER BY a.applied_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [member_id]
    );
    res.json({ results: rows, page, limit });
  } catch (err) {
    console.error('applicationsByMember error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateStatus(req, res) {
  const { application_id, status, recruiter_id } = req.body;
  const valid = ['submitted', 'reviewing', 'interview', 'offer', 'rejected'];

  if (!application_id || !valid.includes(status)) {
    return res.status(400).json({ error: 'application_id and valid status required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      `SELECT a.application_id, a.status, a.member_id, a.job_id, j.recruiter_id
       FROM applications a
       JOIN jobs j ON j.job_id = a.job_id
       WHERE a.application_id = ?`,
      [application_id]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Application not found' });
    }

    const current = rows[0];
    if (recruiter_id && current.recruiter_id !== recruiter_id) {
      await conn.rollback();
      return res.status(403).json({ error: 'Only the owning recruiter can update this application' });
    }

    const old_status = current.status;

    await conn.execute('UPDATE applications SET status = ? WHERE application_id = ?', [status, application_id]);
    await conn.execute(
      'INSERT INTO application_status_history (application_id, old_status, new_status, changed_by) VALUES (?,?,?,?)',
      [application_id, old_status, status, recruiter_id || current.recruiter_id]
    );
    await conn.commit();

    await publishEvent({
      topic: 'application.status.changed',
      eventType: 'application.status.changed',
      actorId: recruiter_id || current.recruiter_id,
      entityType: 'application',
      entityId: application_id,
      payload: {
        application_id,
        job_id: current.job_id,
        member_id: current.member_id,
        recruiter_id: current.recruiter_id,
        old_status,
        new_status: status,
      },
    });

    res.json({ success: true, old_status, new_status: status });
  } catch (err) {
    await conn.rollback();
    console.error('updateStatus error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
}

async function addNote(req, res) {
  const { application_id, recruiter_id, note } = req.body;
  if (!application_id || !note) return res.status(400).json({ error: 'application_id and note required' });

  try {
    if (recruiter_id) {
      const [rows] = await pool.execute(
        `SELECT j.recruiter_id
         FROM applications a
         JOIN jobs j ON j.job_id = a.job_id
         WHERE a.application_id = ?`,
        [application_id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Application not found' });
      if (rows[0].recruiter_id !== recruiter_id) {
        return res.status(403).json({ error: 'Only the owning recruiter can add a note' });
      }
    }

    await pool.execute(
      'INSERT INTO application_notes (application_id, recruiter_id, note) VALUES (?,?,?)',
      [application_id, recruiter_id || null, note]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('addNote error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  submitApplication,
  getApplication,
  applicationsByJob,
  applicationsByMember,
  updateStatus,
  addNote,
};
