const pool = require('../models/db');
const { v4: uuidv4 } = require('uuid');

let postsTablesReady = false;

const BOOTSTRAP_POSTS = [
  { type: 'career_update', content: `Excited to share that I started a new backend role this week.\nGrateful for everyone who helped with interview prep.\nLooking forward to shipping meaningful products.` },
  { type: 'hiring', content: `We're hiring software engineers across backend and full-stack.\nIf you enjoy API design and distributed systems, let's connect.\n#hiring #engineering` },
  { type: 'project', content: `Built a real-time Kafka pipeline for application events.\nLatency dropped significantly after moving to event-driven processing.\nProud of this team effort.` },
  { type: 'learning', content: `Recently revisited system design basics.\nOne key lesson: start with clarity on constraints before architecture.\nMakes trade-offs much easier.` },
  { type: 'general', content: `Consistency beats intensity in career growth.\nSmall daily progress compounds quickly over a year.` },
  { type: 'job_update', content: `Looking for Summer 2026 internship opportunities.\nComfortable with React, Node.js, and SQL.\n#internship #opentowork` },
  { type: 'hiring', content: `My team is hiring data engineers with Spark + Airflow experience.\nRemote-friendly for US time zones.\nDM if interested. #hiring #dataengineering` },
  { type: 'project', content: `Shipped an internal analytics dashboard this sprint.\nSub-second load times after query optimization + caching.` },
  { type: 'learning', content: `Interview prep reminder:\nexplain trade-offs, not just final answers.\nIt signals senior-level thinking.` },
  { type: 'general', content: `For students: deep project understanding matters more than project count.\nInterviewers quickly spot real ownership.` },
  { type: 'career_update', content: `Celebrating one year in my current role.\nThe biggest growth came from mentorship and code review feedback.` },
  { type: 'job_update', content: `Open to platform engineering roles.\nExperience with CI/CD, Kubernetes, and developer tooling.\n#opentowork` },
];
const BOOTSTRAP_COMMENTS = [
  'Congrats! Wishing you the best in this new chapter.',
  'Great share. This is super relevant right now.',
  'Thanks for posting this - really useful takeaway.',
  'Love this perspective. Appreciate the breakdown.',
];

async function ensurePostsTables() {
  if (postsTablesReady) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS posts (
      post_id        VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      author_id      VARCHAR(36) NOT NULL,
      content        TEXT NOT NULL,
      post_type      ENUM('general','job_update','project','hiring','learning','career_update') DEFAULT 'general',
      likes_count    INT DEFAULT 0,
      comments_count INT DEFAULT 0,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES members(member_id) ON DELETE CASCADE,
      INDEX idx_author (author_id),
      INDEX idx_created_at (created_at),
      INDEX idx_post_type (post_type)
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS post_likes (
      like_id      VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      post_id      VARCHAR(36) NOT NULL,
      member_id    VARCHAR(36) NOT NULL,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_post_member_like (post_id, member_id),
      FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE,
      INDEX idx_like_post (post_id),
      INDEX idx_like_member (member_id)
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS post_comments (
      comment_id    VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      post_id       VARCHAR(36) NOT NULL,
      author_id     VARCHAR(36) NOT NULL,
      content       TEXT NOT NULL,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES members(member_id) ON DELETE CASCADE,
      INDEX idx_comment_post (post_id),
      INDEX idx_comment_author (author_id),
      INDEX idx_comment_created (created_at)
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS saved_posts (
      save_id       VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      post_id       VARCHAR(36) NOT NULL,
      member_id     VARCHAR(36) NOT NULL,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_saved_post_member (post_id, member_id),
      FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE,
      INDEX idx_saved_member (member_id),
      INDEX idx_saved_post (post_id)
    )
  `);
  postsTablesReady = true;
}

function getActorMemberId(req) {
  const role = req.headers['x-user-role'];
  if (role === 'member' && req.headers['x-user-id']) return req.headers['x-user-id'];
  return req.headers['x-member-id'] || req.body?.member_id || null;
}

async function assertMember(memberId) {
  if (!memberId) return false;
  const [rows] = await pool.execute(
    'SELECT member_id FROM members WHERE member_id = ? AND is_deleted = 0',
    [memberId]
  );
  return rows.length > 0;
}

async function refreshPostCounters(postId) {
  const [[likeRow]] = await pool.execute(
    'SELECT COUNT(*) AS total FROM post_likes WHERE post_id = ?',
    [postId]
  );
  const [[commentRow]] = await pool.execute(
    'SELECT COUNT(*) AS total FROM post_comments WHERE post_id = ?',
    [postId]
  );
  await pool.execute(
    'UPDATE posts SET likes_count = ?, comments_count = ? WHERE post_id = ?',
    [likeRow.total || 0, commentRow.total || 0, postId]
  );
  return { likesCount: likeRow.total || 0, commentsCount: commentRow.total || 0 };
}

async function bootstrapPostsIfNeeded() {
  const [countRows] = await pool.execute('SELECT COUNT(*) AS total FROM posts');
  if ((countRows[0]?.total || 0) > 0) return;
  const [authors] = await pool.execute(
    `SELECT member_id
     FROM members
     WHERE is_deleted = 0
     ORDER BY created_at ASC
     LIMIT 12`
  );
  if (!authors.length) return;

  const seededPostIds = [];
  for (let i = 0; i < BOOTSTRAP_POSTS.length; i++) {
    const author = authors[i % authors.length];
    const post = BOOTSTRAP_POSTS[i];
    const postId = uuidv4();
    await pool.execute(
      `INSERT INTO posts
         (post_id, author_id, content, post_type, likes_count, comments_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? HOUR), DATE_SUB(NOW(), INTERVAL ? HOUR))`,
      [postId, author.member_id, post.content, post.type, 0, 0, i + 1, i + 1]
    );
    seededPostIds.push(postId);
  }

  for (let i = 0; i < seededPostIds.length; i++) {
    const commentCount = i % 3 === 0 ? 2 : 1;
    for (let j = 0; j < commentCount; j++) {
      const author = authors[(i + j + 1) % authors.length];
      await pool.execute(
        `INSERT INTO post_comments (comment_id, post_id, author_id, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? HOUR), DATE_SUB(NOW(), INTERVAL ? HOUR))`,
        [uuidv4(), seededPostIds[i], author.member_id, BOOTSTRAP_COMMENTS[(i + j) % BOOTSTRAP_COMMENTS.length], i + j + 1, i + j + 1]
      );
    }
    await refreshPostCounters(seededPostIds[i]);
  }
}

async function getFeed(req, res) {
  const limit = Math.min(Math.max(parseInt(req.query.limit || '30', 10), 1), 100);
  const actorId = getActorMemberId(req);
  try {
    await ensurePostsTables();
    await bootstrapPostsIfNeeded();

    const [rows] = await pool.query(
      `SELECT
         p.post_id,
         p.author_id,
         p.content,
         p.post_type,
         p.likes_count,
         p.comments_count,
         p.created_at,
         p.updated_at,
         m.first_name,
         m.last_name,
         m.headline,
         m.profile_photo_url
       FROM posts p
       JOIN members m ON m.member_id = p.author_id
       WHERE m.is_deleted = 0
       ORDER BY p.created_at DESC
       LIMIT ${limit}`
    );

    const postIds = rows.map(r => r.post_id);
    const likedSet = new Set();
    const savedSet = new Set();
    if (actorId && postIds.length) {
      const [likes] = await pool.query(
        `SELECT post_id
         FROM post_likes
         WHERE member_id = ?
           AND post_id IN (${postIds.map(() => '?').join(',')})`,
        [actorId, ...postIds]
      );
      likes.forEach(l => likedSet.add(l.post_id));
      const [saves] = await pool.query(
        `SELECT post_id
         FROM saved_posts
         WHERE member_id = ?
           AND post_id IN (${postIds.map(() => '?').join(',')})`,
        [actorId, ...postIds]
      );
      saves.forEach(s => savedSet.add(s.post_id));
    }

    const commentsByPost = {};
    if (postIds.length) {
      const [comments] = await pool.query(
        `SELECT
           c.comment_id,
           c.post_id,
           c.author_id,
           c.content,
           c.created_at,
           m.first_name,
           m.last_name,
           m.headline
         FROM post_comments c
         JOIN members m ON m.member_id = c.author_id
         WHERE c.post_id IN (${postIds.map(() => '?').join(',')})
         ORDER BY c.created_at ASC`,
        postIds
      );
      comments.forEach(comment => {
        if (!commentsByPost[comment.post_id]) commentsByPost[comment.post_id] = [];
        commentsByPost[comment.post_id].push({
          id: comment.comment_id,
          postId: comment.post_id,
          authorId: comment.author_id,
          content: comment.content,
          createdAt: comment.created_at,
          author: {
            id: comment.author_id,
            name: `${comment.first_name} ${comment.last_name}`.trim(),
            headline: comment.headline || 'LinkedIn Member',
          },
          canDelete: Boolean(actorId) && (actorId === comment.author_id),
        });
      });
    }

    const results = rows.map(post => {
      const comments = commentsByPost[post.post_id] || [];
      const canDeleteCommentByPostOwner = Boolean(actorId) && actorId === post.author_id;
      return {
        id: post.post_id,
        authorId: post.author_id,
        content: post.content,
        type: post.post_type,
        likesCount: post.likes_count || 0,
        commentsCount: post.comments_count || comments.length,
        createdAt: post.created_at,
        updatedAt: post.updated_at,
        likedByCurrentUser: likedSet.has(post.post_id),
        savedByCurrentUser: savedSet.has(post.post_id),
        author: {
          id: post.author_id,
          name: `${post.first_name} ${post.last_name}`.trim(),
          headline: post.headline || 'LinkedIn Member',
          profileImage: post.profile_photo_url || null,
        },
        comments: comments.map(comment => ({
          ...comment,
          canDelete: comment.canDelete || canDeleteCommentByPostOwner,
        })),
      };
    });

    return res.json({ results });
  } catch (err) {
    console.error('getFeed error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getPostById(postId, actorId) {
  const [rows] = await pool.execute(
    `SELECT
       p.post_id,
       p.author_id,
       p.content,
       p.post_type,
       p.likes_count,
       p.comments_count,
       p.created_at,
       p.updated_at,
       m.first_name,
       m.last_name,
       m.headline,
       m.profile_photo_url
     FROM posts p
     JOIN members m ON m.member_id = p.author_id
     WHERE p.post_id = ? AND m.is_deleted = 0
     LIMIT 1`,
    [postId]
  );
  if (!rows.length) return null;
  const post = rows[0];

  const [comments] = await pool.execute(
    `SELECT
       c.comment_id, c.post_id, c.author_id, c.content, c.created_at,
       cm.first_name, cm.last_name, cm.headline
     FROM post_comments c
     JOIN members cm ON cm.member_id = c.author_id
     WHERE c.post_id = ?
     ORDER BY c.created_at ASC`,
    [postId]
  );

  let likedByCurrentUser = false;
  let savedByCurrentUser = false;
  if (actorId) {
    const [[liked]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM post_likes WHERE post_id = ? AND member_id = ?',
      [postId, actorId]
    );
    likedByCurrentUser = liked.total > 0;
    const [[saved]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM saved_posts WHERE post_id = ? AND member_id = ?',
      [postId, actorId]
    );
    savedByCurrentUser = saved.total > 0;
  }

  return {
    id: post.post_id,
    authorId: post.author_id,
    content: post.content,
    type: post.post_type,
    likesCount: post.likes_count || 0,
    commentsCount: post.comments_count || comments.length,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
    likedByCurrentUser,
    savedByCurrentUser,
    author: {
      id: post.author_id,
      name: `${post.first_name} ${post.last_name}`.trim(),
      headline: post.headline || 'LinkedIn Member',
      profileImage: post.profile_photo_url || null,
    },
    comments: comments.map(comment => ({
      id: comment.comment_id,
      postId: comment.post_id,
      authorId: comment.author_id,
      content: comment.content,
      createdAt: comment.created_at,
      author: {
        id: comment.author_id,
        name: `${comment.first_name} ${comment.last_name}`.trim(),
        headline: comment.headline || 'LinkedIn Member',
      },
      canDelete: Boolean(actorId) && (actorId === comment.author_id || actorId === post.author_id),
    })),
  };
}

async function createPost(req, res) {
  const memberId = getActorMemberId(req);
  const content = (req.body?.content || '').trim();
  const postType = req.body?.type || 'general';
  try {
    await ensurePostsTables();
    if (!(await assertMember(memberId))) {
      return res.status(401).json({ error: 'Member authentication required' });
    }
    if (!content) return res.status(400).json({ error: 'Post content is required' });
    if (content.length > 2000) return res.status(400).json({ error: 'Post must be 2000 characters or less' });

    const postId = uuidv4();
    await pool.execute(
      `INSERT INTO posts (post_id, author_id, content, post_type, likes_count, comments_count)
       VALUES (?, ?, ?, ?, 0, 0)`,
      [postId, memberId, content, postType]
    );
    const post = await getPostById(postId, memberId);
    return res.status(201).json({ post });
  } catch (err) {
    console.error('createPost error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function likePost(req, res) {
  const memberId = getActorMemberId(req);
  const { postId } = req.params;
  try {
    await ensurePostsTables();
    if (!(await assertMember(memberId))) {
      return res.status(401).json({ error: 'Member authentication required' });
    }
    await pool.execute(
      'INSERT IGNORE INTO post_likes (like_id, post_id, member_id) VALUES (?, ?, ?)',
      [uuidv4(), postId, memberId]
    );
    const counts = await refreshPostCounters(postId);
    return res.json({ likedByCurrentUser: true, likesCount: counts.likesCount, commentsCount: counts.commentsCount });
  } catch (err) {
    console.error('likePost error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function unlikePost(req, res) {
  const memberId = getActorMemberId(req);
  const { postId } = req.params;
  try {
    await ensurePostsTables();
    if (!(await assertMember(memberId))) {
      return res.status(401).json({ error: 'Member authentication required' });
    }
    await pool.execute(
      'DELETE FROM post_likes WHERE post_id = ? AND member_id = ?',
      [postId, memberId]
    );
    const counts = await refreshPostCounters(postId);
    return res.json({ likedByCurrentUser: false, likesCount: counts.likesCount, commentsCount: counts.commentsCount });
  } catch (err) {
    console.error('unlikePost error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function addComment(req, res) {
  const memberId = getActorMemberId(req);
  const { postId } = req.params;
  const content = (req.body?.content || '').trim();
  try {
    await ensurePostsTables();
    if (!(await assertMember(memberId))) {
      return res.status(401).json({ error: 'Member authentication required' });
    }
    if (!content) return res.status(400).json({ error: 'Comment content is required' });

    const commentId = uuidv4();
    await pool.execute(
      `INSERT INTO post_comments (comment_id, post_id, author_id, content)
       VALUES (?, ?, ?, ?)`,
      [commentId, postId, memberId, content]
    );
    await refreshPostCounters(postId);

    const [rows] = await pool.execute(
      `SELECT c.comment_id, c.post_id, c.author_id, c.content, c.created_at,
              m.first_name, m.last_name, m.headline
       FROM post_comments c
       JOIN members m ON m.member_id = c.author_id
       WHERE c.comment_id = ?`,
      [commentId]
    );
    const row = rows[0];
    return res.status(201).json({
      comment: {
        id: row.comment_id,
        postId: row.post_id,
        authorId: row.author_id,
        content: row.content,
        createdAt: row.created_at,
        author: {
          id: row.author_id,
          name: `${row.first_name} ${row.last_name}`.trim(),
          headline: row.headline || 'LinkedIn Member',
        },
        canDelete: true,
      },
    });
  } catch (err) {
    console.error('addComment error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteComment(req, res) {
  const memberId = getActorMemberId(req);
  const { postId, commentId } = req.params;
  try {
    await ensurePostsTables();
    if (!(await assertMember(memberId))) {
      return res.status(401).json({ error: 'Member authentication required' });
    }
    const [rows] = await pool.execute(
      `SELECT c.comment_id, c.author_id, p.author_id AS post_owner_id
       FROM post_comments c
       JOIN posts p ON p.post_id = c.post_id
       WHERE c.comment_id = ? AND c.post_id = ?`,
      [commentId, postId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Comment not found' });

    const comment = rows[0];
    const canDelete = comment.author_id === memberId || comment.post_owner_id === memberId;
    if (!canDelete) return res.status(403).json({ error: 'Not allowed to delete this comment' });

    await pool.execute('DELETE FROM post_comments WHERE comment_id = ?', [commentId]);
    const counts = await refreshPostCounters(postId);
    return res.json({ deleted: true, likesCount: counts.likesCount, commentsCount: counts.commentsCount });
  } catch (err) {
    console.error('deleteComment error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function savePost(req, res) {
  const memberId = getActorMemberId(req);
  const { postId } = req.params;
  try {
    await ensurePostsTables();
    if (!(await assertMember(memberId))) {
      return res.status(401).json({ error: 'Member authentication required' });
    }
    await pool.execute(
      'INSERT IGNORE INTO saved_posts (save_id, post_id, member_id) VALUES (?, ?, ?)',
      [uuidv4(), postId, memberId]
    );
    return res.json({ savedByCurrentUser: true });
  } catch (err) {
    console.error('savePost error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function unsavePost(req, res) {
  const memberId = getActorMemberId(req);
  const { postId } = req.params;
  try {
    await ensurePostsTables();
    if (!(await assertMember(memberId))) {
      return res.status(401).json({ error: 'Member authentication required' });
    }
    await pool.execute(
      'DELETE FROM saved_posts WHERE post_id = ? AND member_id = ?',
      [postId, memberId]
    );
    return res.json({ savedByCurrentUser: false });
  } catch (err) {
    console.error('unsavePost error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getSavedPosts(req, res) {
  const memberId = getActorMemberId(req);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 100);
  try {
    await ensurePostsTables();
    if (!(await assertMember(memberId))) {
      return res.status(401).json({ error: 'Member authentication required' });
    }
    const [savedRows] = await pool.query(
      `SELECT p.post_id
       FROM saved_posts sp
       JOIN posts p ON p.post_id = sp.post_id
       WHERE sp.member_id = ?
       ORDER BY sp.created_at DESC
       LIMIT ${limit}`,
      [memberId]
    );
    const posts = [];
    for (const row of savedRows) {
      const post = await getPostById(row.post_id, memberId);
      if (post) posts.push(post);
    }
    return res.json({ results: posts });
  } catch (err) {
    console.error('getSavedPosts error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getFeed,
  createPost,
  likePost,
  unlikePost,
  addComment,
  deleteComment,
  savePost,
  unsavePost,
  getSavedPosts,
};
