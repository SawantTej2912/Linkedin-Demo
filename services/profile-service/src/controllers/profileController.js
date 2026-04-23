const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const pool = require('../models/db');
const { publishEvent } = require('../kafka/producer');
const { getCache, setCache, delCache } = require('../cache/redisClient');

async function createMember(req, res) {
  const {
    first_name, last_name, email, password, phone,
    city, state, country, headline, about, profile_photo_url,
    resume_url, resume_text, skills = []
  } = req.body;

  if (!first_name || !last_name || !email || !password) {
    return res.status(400).json({ error: 'first_name, last_name, email, password are required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const member_id = uuidv4();
    const password_hash = await bcrypt.hash(password, 10);

    await conn.execute(
      `INSERT INTO members
       (member_id, first_name, last_name, email, password_hash, phone, city, state, country, headline, about, profile_photo_url, resume_url, resume_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        member_id, first_name, last_name, email, password_hash,
        phone || null, city || null, state || null, country || null,
        headline || null, about || null, profile_photo_url || null,
        resume_url || null, resume_text || null
      ]
    );

    if (Array.isArray(skills) && skills.length) {
      const normalizedSkills = [...new Set(skills.map(s => String(s).trim()).filter(Boolean))];
      for (const skill of normalizedSkills) {
        await conn.execute('INSERT IGNORE INTO member_skills (member_id, skill) VALUES (?, ?)', [member_id, skill]);
      }
    }

    await conn.commit();

    await publishEvent({
      topic: 'profile.updated',
      eventType: 'profile.created',
      actorId: member_id,
      entityType: 'member',
      entityId: member_id,
      payload: { email, city, state, country },
    });

    res.status(201).json({ member_id });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error('createMember error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
}

async function getMember(req, res) {
  const { member_id, viewer_id } = req.body;
  if (!member_id) return res.status(400).json({ error: 'member_id required' });

  const cacheKey = `member:${member_id}`;
  const cached = await getCache(cacheKey);
  const effectiveViewer = req.headers['x-user-id'] || viewer_id || null;

  try {
    if (cached) {
      if (effectiveViewer && effectiveViewer !== member_id) {
        publishEvent({
          topic: 'profile.viewed',
          eventType: 'profile.viewed',
          actorId: effectiveViewer,
          entityType: 'member',
          entityId: member_id,
          payload: {},
        }).catch(() => {});
      }
      return res.json({ ...cached, _cache: true });
    }

    const [rows] = await pool.execute(
      'SELECT * FROM members WHERE member_id = ? AND is_deleted = 0',
      [member_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Member not found' });

    const [skillRows, experienceRows, educationRows] = await Promise.all([
      pool.execute('SELECT skill FROM member_skills WHERE member_id = ? ORDER BY skill ASC', [member_id]),
      pool.execute('SELECT * FROM member_experience WHERE member_id = ? ORDER BY is_current DESC, start_date DESC', [member_id]),
      pool.execute('SELECT * FROM member_education WHERE member_id = ? ORDER BY end_year DESC, start_year DESC', [member_id]),
    ]);

    const member = {
      ...rows[0],
      skills: skillRows[0].map(s => s.skill),
      experience: experienceRows[0],
      education: educationRows[0],
    };

    await setCache(cacheKey, member);

    if (effectiveViewer && effectiveViewer !== member_id) {
      publishEvent({
        topic: 'profile.viewed',
        eventType: 'profile.viewed',
        actorId: effectiveViewer,
        entityType: 'member',
        entityId: member_id,
        payload: {},
      }).catch(() => {});
    }

    res.json(member);
  } catch (err) {
    console.error('getMember error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateMember(req, res) {
  const { member_id, ...fields } = req.body;
  if (!member_id) return res.status(400).json({ error: 'member_id required' });

  const allowed = ['first_name', 'last_name', 'phone', 'city', 'state', 'country',
                   'headline', 'about', 'profile_photo_url', 'resume_url', 'resume_text'];
  const updates = Object.keys(fields).filter(k => allowed.includes(k));
  if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });

  try {
    const [existing] = await pool.execute(
      'SELECT member_id FROM members WHERE member_id = ? AND is_deleted = 0',
      [member_id]
    );
    if (!existing.length) return res.status(404).json({ error: 'Member not found' });

    const setClauses = updates.map(k => `${k} = ?`).join(', ');
    const values = [...updates.map(k => fields[k]), member_id];

    await pool.execute(`UPDATE members SET ${setClauses} WHERE member_id = ?`, values);

    await delCache(`member:${member_id}`);

    await publishEvent({
      topic: 'profile.updated',
      eventType: 'profile.updated',
      actorId: member_id,
      entityType: 'member',
      entityId: member_id,
      payload: Object.fromEntries(updates.map(k => [k, fields[k]])),
    });

    res.json({ success: true, updated_fields: updates });
  } catch (err) {
    console.error('updateMember error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteMember(req, res) {
  const { member_id } = req.body;
  if (!member_id) return res.status(400).json({ error: 'member_id required' });

  try {
    const [rows] = await pool.execute(
      'SELECT member_id FROM members WHERE member_id = ? AND is_deleted = 0',
      [member_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Member not found' });

    await pool.execute('UPDATE members SET is_deleted = 1 WHERE member_id = ?', [member_id]);
    await delCache(`member:${member_id}`);

    res.json({ member_id, deleted: true });
  } catch (err) {
    console.error('deleteMember error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function searchMembers(req, res) {
  const { skill, location, keyword, page = 1, limit = 20 } = req.body;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const offset = (pageNum - 1) * limitNum;

  let query = 'SELECT DISTINCT m.* FROM members m';
  const params = [];

  if (skill) {
    query += ' JOIN member_skills ms ON m.member_id = ms.member_id AND ms.skill LIKE ?';
    params.push(`%${skill}%`);
  }

  query += ' WHERE m.is_deleted = 0';

  if (location) {
    query += ' AND (m.city LIKE ? OR m.state LIKE ? OR m.country LIKE ?)';
    params.push(`%${location}%`, `%${location}%`, `%${location}%`);
  }
  if (keyword) {
    query += ' AND (m.email LIKE ? OR m.first_name LIKE ? OR m.last_name LIKE ? OR m.headline LIKE ? OR m.about LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  query += ` ORDER BY m.updated_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

  try {
    const [rows] = await pool.query(query, params);
    res.json({ results: rows, page: pageNum, limit: limitNum });
  } catch (err) {
    console.error('searchMembers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function addSkill(req, res) {
  const { member_id, skill } = req.body;
  if (!member_id || !skill) return res.status(400).json({ error: 'member_id and skill required' });
  try {
    await pool.execute(
      'INSERT IGNORE INTO member_skills (member_id, skill) VALUES (?, ?)',
      [member_id, String(skill).trim()]
    );
    await delCache(`member:${member_id}`);
    res.json({ success: true, skill: String(skill).trim() });
  } catch (err) {
    console.error('addSkill error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function removeSkill(req, res) {
  const { member_id, skill } = req.body;
  if (!member_id || !skill) return res.status(400).json({ error: 'member_id and skill required' });
  try {
    await pool.execute(
      'DELETE FROM member_skills WHERE member_id = ? AND skill = ?',
      [member_id, skill]
    );
    await delCache(`member:${member_id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('removeSkill error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function loginMember(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM members WHERE email = ? AND is_deleted = 0',
      [email]
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const member = rows[0];
    const match = await bcrypt.compare(password, member.password_hash || '');
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { password_hash, ...safeData } = member;
    res.json(safeData);
  } catch (err) {
    console.error('loginMember error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  createMember,
  getMember,
  updateMember,
  deleteMember,
  searchMembers,
  loginMember,
  addSkill,
  removeSkill,
};
