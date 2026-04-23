const { v4: uuidv4 } = require('uuid');
const pool = require('../models/db');
const { publishEvent } = require('../kafka/producer');
const { getCache, setCache, delCache } = require('../cache/redisClient');

function parsePageLimit(body = {}) {
  const page = Math.max(parseInt(body.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(body.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

async function createJob(req, res) {
  const {
    company_id, recruiter_id, title, description, seniority_level, employment_type,
    city, state, country, work_mode, salary_min, salary_max, industry, skills,
  } = req.body;

  if (!recruiter_id || !title) {
    return res.status(400).json({ error: 'recruiter_id and title required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const job_id = uuidv4();
    await conn.execute(
      `INSERT INTO jobs
       (job_id, company_id, recruiter_id, title, description, seniority_level, employment_type, city, state, country, work_mode, salary_min, salary_max, industry)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job_id,
        company_id || null,
        recruiter_id,
        title,
        description || null,
        seniority_level || null,
        employment_type || null,
        city || null,
        state || null,
        country || null,
        work_mode || null,
        salary_min || null,
        salary_max || null,
        industry || null,
      ]
    );

    if (Array.isArray(skills) && skills.length) {
      const normalizedSkills = [...new Set(skills.map((s) => String(s).trim()).filter(Boolean))];
      for (const skill of normalizedSkills) {
        await conn.execute('INSERT INTO job_skills (job_id, skill) VALUES (?, ?)', [job_id, skill]);
      }
    }

    await conn.commit();
    await publishEvent({
      topic: 'job.posted',
      eventType: 'job.posted',
      actorId: recruiter_id,
      entityType: 'job',
      entityId: job_id,
      payload: { title, recruiter_id, company_id: company_id || null, city, state, country },
    });

    res.status(201).json({ job_id });
  } catch (err) {
    await conn.rollback();
    console.error('createJob error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
}

async function getJob(req, res) {
  const { job_id } = req.body;
  if (!job_id) return res.status(400).json({ error: 'job_id required' });

  const cacheKey = `job:${job_id}`;
  const cached = await getCache(cacheKey);
  const viewerId = req.headers['x-user-id'] || req.body.member_id || 'anonymous';

  try {
    if (cached) {
      publishEvent({
        topic: 'job.viewed',
        eventType: 'job.viewed',
        actorId: viewerId,
        entityType: 'job',
        entityId: job_id,
        payload: { recruiter_id: cached.recruiter_id },
      }).catch(() => {});
      pool.execute('UPDATE jobs SET views_count = views_count + 1 WHERE job_id = ?', [job_id]).catch(() => {});
      return res.json({ ...cached, _cache: true });
    }

    const [rows] = await pool.execute(
      `SELECT j.*, r.company_name, r.company_industry
       FROM jobs j
       JOIN recruiters r ON r.recruiter_id = j.recruiter_id
       WHERE j.job_id = ?`,
      [job_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });

    const [skills] = await pool.execute('SELECT skill FROM job_skills WHERE job_id = ? ORDER BY skill ASC', [job_id]);
    const job = { ...rows[0], skills: skills.map((s) => s.skill) };
    await setCache(cacheKey, job);

    pool.execute('UPDATE jobs SET views_count = views_count + 1 WHERE job_id = ?', [job_id]).catch(() => {});
    await publishEvent({
      topic: 'job.viewed',
      eventType: 'job.viewed',
      actorId: viewerId,
      entityType: 'job',
      entityId: job_id,
      payload: { recruiter_id: job.recruiter_id },
    });

    res.json(job);
  } catch (err) {
    console.error('getJob error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateJob(req, res) {
  const { job_id, recruiter_id, ...fields } = req.body;
  if (!job_id) return res.status(400).json({ error: 'job_id required' });

  const allowed = ['title', 'description', 'seniority_level', 'employment_type', 'city', 'state', 'country', 'work_mode', 'salary_min', 'salary_max', 'industry', 'status'];
  const updates = Object.keys(fields).filter((k) => allowed.includes(k));
  if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });

  try {
    const [rows] = await pool.execute('SELECT recruiter_id FROM jobs WHERE job_id = ?', [job_id]);
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });
    if (recruiter_id && rows[0].recruiter_id !== recruiter_id) {
      return res.status(403).json({ error: 'Only the owning recruiter can update this job' });
    }

    const set = updates.map((k) => `${k} = ?`).join(', ');
    await pool.execute(`UPDATE jobs SET ${set} WHERE job_id = ?`, [...updates.map((k) => fields[k]), job_id]);
    await delCache(`job:${job_id}`);
    res.json({ success: true, updated_fields: updates });
  } catch (err) {
    console.error('updateJob error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function searchJobs(req, res) {
  const { keyword, location, employment_type, employment_types, job_type, industry, work_mode, seniority_level } = req.body;
  const { page, limit, offset } = parsePageLimit(req.body);
  const effectiveEmploymentTypes = Array.isArray(employment_types)
    ? employment_types.filter(Boolean)
    : [];
  const effectiveEmploymentType = employment_type || job_type || null;

  let query = `
    SELECT DISTINCT j.*, r.company_name, r.company_industry
    FROM jobs j
    JOIN recruiters r ON r.recruiter_id = j.recruiter_id
    LEFT JOIN job_skills js ON js.job_id = j.job_id
    WHERE j.status = 'open'
  `;
  const params = [];

  if (keyword) {
    query += ' AND (j.title LIKE ? OR j.description LIKE ? OR js.skill LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (location) {
    query += ' AND (j.city LIKE ? OR j.state LIKE ? OR j.country LIKE ?)';
    params.push(`%${location}%`, `%${location}%`, `%${location}%`);
  }
  if (effectiveEmploymentTypes.length > 0) {
    query += ` AND j.employment_type IN (${effectiveEmploymentTypes.map(() => '?').join(', ')})`;
    params.push(...effectiveEmploymentTypes);
  } else if (effectiveEmploymentType) {
    query += ' AND j.employment_type = ?';
    params.push(effectiveEmploymentType);
  }
  if (seniority_level) {
    query += ' AND j.seniority_level = ?';
    params.push(seniority_level);
  }
  if (industry) {
    query += ' AND j.industry LIKE ?';
    params.push(`%${industry}%`);
  }
  if (work_mode) {
    query += ' AND j.work_mode = ?';
    params.push(work_mode);
  }

  query += ` ORDER BY j.posted_at DESC LIMIT ${limit} OFFSET ${offset}`;

  try {
    const [rows] = await pool.query(query, params);
    res.json({ results: rows, page, limit });
  } catch (err) {
    console.error('searchJobs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function closeJob(req, res) {
  const { job_id, recruiter_id } = req.body;
  if (!job_id) return res.status(400).json({ error: 'job_id required' });

  try {
    const [rows] = await pool.execute('SELECT recruiter_id FROM jobs WHERE job_id = ?', [job_id]);
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });
    if (recruiter_id && rows[0].recruiter_id !== recruiter_id) {
      return res.status(403).json({ error: 'Only the owning recruiter can close this job' });
    }

    await pool.execute('UPDATE jobs SET status = "closed", closed_at = NOW() WHERE job_id = ?', [job_id]);
    await delCache(`job:${job_id}`);
    await publishEvent({
      topic: 'job.closed',
      eventType: 'job.closed',
      actorId: recruiter_id || rows[0].recruiter_id,
      entityType: 'job',
      entityId: job_id,
      payload: { recruiter_id: rows[0].recruiter_id },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('closeJob error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function jobsByRecruiter(req, res) {
  const { recruiter_id } = req.body;
  if (!recruiter_id) return res.status(400).json({ error: 'recruiter_id required' });

  const { page, limit, offset } = parsePageLimit(req.body);

  try {
    const [rows] = await pool.query(
      `SELECT j.*, r.company_name, r.company_industry
       FROM jobs j
       JOIN recruiters r ON r.recruiter_id = j.recruiter_id
       WHERE j.recruiter_id = ?
       ORDER BY j.posted_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [recruiter_id]
    );
    res.json({ results: rows, page, limit });
  } catch (err) {
    console.error('jobsByRecruiter error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function saveJob(req, res) {
  const { member_id, job_id } = req.body;
  if (!member_id || !job_id) return res.status(400).json({ error: 'member_id and job_id required' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [jobRows] = await conn.execute('SELECT recruiter_id, status FROM jobs WHERE job_id = ?', [job_id]);
    if (!jobRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Job not found' });
    }

    await conn.execute('INSERT INTO saved_jobs (member_id, job_id, saved_at) VALUES (?, ?, NOW())', [member_id, job_id]);
    await conn.execute('UPDATE jobs SET saves_count = saves_count + 1 WHERE job_id = ?', [job_id]);
    await conn.commit();

    await publishEvent({
      topic: 'job.saved',
      eventType: 'job.saved',
      actorId: member_id,
      entityType: 'job',
      entityId: job_id,
      payload: { recruiter_id: jobRows[0].recruiter_id },
    });

    res.status(201).json({ member_id, job_id, saved: true });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Job already saved' });
    console.error('saveJob error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
}

async function unsaveJob(req, res) {
  const { member_id, job_id } = req.body;
  if (!member_id || !job_id) return res.status(400).json({ error: 'member_id and job_id required' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute('DELETE FROM saved_jobs WHERE member_id = ? AND job_id = ?', [member_id, job_id]);
    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Saved job not found' });
    }
    await conn.execute('UPDATE jobs SET saves_count = GREATEST(saves_count - 1, 0) WHERE job_id = ?', [job_id]);
    await conn.commit();
    res.json({ member_id, job_id, removed: true });
  } catch (err) {
    await conn.rollback();
    console.error('unsaveJob error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
}

async function savedByMember(req, res) {
  const { member_id } = req.body;
  if (!member_id) return res.status(400).json({ error: 'member_id required' });

  try {
    const [rows] = await pool.execute(
      `SELECT j.*, r.company_name, r.company_industry
       FROM jobs j
       JOIN saved_jobs s ON j.job_id = s.job_id
       JOIN recruiters r ON r.recruiter_id = j.recruiter_id
       WHERE s.member_id = ?
       ORDER BY s.saved_at DESC`,
      [member_id]
    );
    res.json({ results: rows });
  } catch (err) {
    console.error('savedByMember error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  createJob,
  getJob,
  updateJob,
  searchJobs,
  closeJob,
  jobsByRecruiter,
  saveJob,
  unsaveJob,
  savedByMember,
};
