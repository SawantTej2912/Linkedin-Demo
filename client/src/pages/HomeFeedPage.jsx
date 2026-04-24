import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  getFeedPosts,
  getSavedPosts,
  createPost,
  likePost,
  unlikePost,
  savePost,
  unsavePost,
  addPostComment,
  deletePostComment,
} from '../api/postApi';

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function avatarFromName(name) {
  return (name || 'U').trim().charAt(0).toUpperCase();
}

function SidebarCard({ title, children }) {
  return (
    <section style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      padding: 14,
      boxShadow: '0 1px 6px rgba(15,23,42,0.04)',
    }}>
      {title && <h4 style={{ margin: '0 0 8px', fontSize: 14, color: '#0f172a' }}>{title}</h4>}
      {children}
    </section>
  );
}

function PostCard({
  post,
  currentMemberId,
  onToggleLike,
  onToggleSave,
  onAddComment,
  onDeleteComment,
  actionLoading,
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState('');

  const submitComment = async () => {
    const value = commentText.trim();
    if (!value) return;
    setCommentError('');
    try {
      await onAddComment(post.id, value);
      setCommentText('');
      setShowComments(true);
    } catch (e) {
      setCommentError(e?.response?.data?.error || 'Unable to add comment');
    }
  };

  return (
    <article style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 14,
      padding: 16,
      boxShadow: '0 2px 10px rgba(15,23,42,0.04)',
    }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #0a66c2, #3b82f6)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          flexShrink: 0,
        }}>
          {avatarFromName(post.author?.name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {post.author?.name}
          </div>
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {post.author?.headline || 'LinkedIn Member'}
          </div>
          <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 3 }}>
            {timeAgo(post.createdAt)} · {post.type.replace('_', ' ')}
          </div>
        </div>
      </div>

      <div style={{
        color: '#1e293b',
        fontSize: 15,
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {post.content}
      </div>

      <div style={{ marginTop: 14, borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 13, marginBottom: 8 }}>
          <span>{post.likesCount} likes</span>
          <span>{post.commentsCount} comments</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          <button
            onClick={() => onToggleLike(post)}
            disabled={actionLoading}
            style={{
              height: 34,
              border: 'none',
              borderRadius: 8,
              background: post.likedByCurrentUser ? '#e2e8f0' : '#f8fafc',
              color: post.likedByCurrentUser ? '#334155' : '#475569',
              fontWeight: 700,
              cursor: actionLoading ? 'not-allowed' : 'pointer',
              fontSize: 13,
            }}
          >
            {post.likedByCurrentUser ? 'Unlike' : 'Like'}
          </button>
          <button
            onClick={() => setShowComments(v => !v)}
            style={{
              height: 34,
              border: 'none',
              borderRadius: 8,
              background: showComments ? '#e2e8f0' : '#f8fafc',
              color: '#475569',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Comment
          </button>
          <button
            onClick={() => onToggleSave(post)}
            disabled={actionLoading}
            style={{
              height: 34,
              border: 'none',
              borderRadius: 8,
              background: post.savedByCurrentUser ? '#e2e8f0' : '#f8fafc',
              color: '#475569',
              fontWeight: 700,
              cursor: actionLoading ? 'not-allowed' : 'pointer',
              fontSize: 13,
            }}
          >
            {post.savedByCurrentUser ? 'Unsave' : 'Save'}
          </button>
        </div>

        {showComments && (
          <div style={{ marginTop: 12, borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitComment()}
                placeholder="Add a comment..."
                style={{
                  flex: 1,
                  height: 34,
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  padding: '0 10px',
                  fontSize: 13,
                }}
              />
              <button
                onClick={submitComment}
                disabled={actionLoading || !commentText.trim()}
                style={{
                  height: 34,
                  borderRadius: 8,
                  border: 'none',
                  padding: '0 12px',
                  background: '#0a66c2',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                }}
              >
                Post
              </button>
            </div>
            {commentError && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{commentError}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(post.comments || []).map(comment => {
                const canDelete = comment.canDelete ||
                  comment.authorId === currentMemberId ||
                  post.authorId === currentMemberId;
                return (
                  <div key={comment.id} style={{ background: '#f8fafc', borderRadius: 10, padding: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{comment.author?.name}</div>
                        <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {comment.author?.headline || 'LinkedIn Member'} · {timeAgo(comment.createdAt)}
                        </div>
                      </div>
                      {canDelete && (
                        <button
                          onClick={() => onDeleteComment(post.id, comment.id)}
                          disabled={actionLoading}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#dc2626',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: actionLoading ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13, color: '#334155', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {comment.content}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export default function HomeFeedPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [composerError, setComposerError] = useState('');
  const userName = localStorage.getItem('user_name') || 'Member';
  const role = localStorage.getItem('role') || 'member';
  const currentMemberId = localStorage.getItem('member_id') || null;
  const isSavedView = window.location.pathname === '/home/saved';

  useEffect(() => {
    const loadFeed = async () => {
      try {
        setLoading(true);
        const res = isSavedView ? await getSavedPosts(50) : await getFeedPosts(30);
        setPosts(res.data.results || []);
      } catch (e) {
        setError(e?.response?.data?.error || 'Could not load feed posts');
      } finally {
        setLoading(false);
      }
    };
    loadFeed();
  }, [isSavedView]);

  const subtitle = useMemo(() => {
    if (role === 'recruiter') return 'Recruiter';
    return 'Member';
  }, [role]);

  const updatePost = (postId, updater) => {
    setPosts(prev => prev.map(post => (post.id === postId ? updater(post) : post)));
  };

  const handleToggleLike = async (post) => {
    if (!currentMemberId) return;
    setActionLoading(true);
    try {
      const res = post.likedByCurrentUser ? await unlikePost(post.id) : await likePost(post.id);
      updatePost(post.id, prev => ({
        ...prev,
        likedByCurrentUser: res.data.likedByCurrentUser,
        likesCount: res.data.likesCount,
      }));
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleSave = async (post) => {
    if (!currentMemberId) return;
    setActionLoading(true);
    try {
      if (post.savedByCurrentUser) {
        await unsavePost(post.id);
        if (isSavedView) {
          setPosts(prev => prev.filter(item => item.id !== post.id));
        } else {
          updatePost(post.id, prev => ({ ...prev, savedByCurrentUser: false }));
        }
      } else {
        await savePost(post.id);
        updatePost(post.id, prev => ({ ...prev, savedByCurrentUser: true }));
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddComment = async (postId, content) => {
    if (!currentMemberId) return;
    setActionLoading(true);
    try {
      const res = await addPostComment(postId, content);
      updatePost(postId, prev => ({
        ...prev,
        comments: [...(prev.comments || []), res.data.comment],
        commentsCount: (prev.commentsCount || 0) + 1,
      }));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteComment = async (postId, commentId) => {
    setActionLoading(true);
    try {
      await deletePostComment(postId, commentId);
      updatePost(postId, prev => {
        const nextComments = (prev.comments || []).filter(comment => comment.id !== commentId);
        return {
          ...prev,
          comments: nextComments,
          commentsCount: Math.max((prev.commentsCount || 1) - 1, 0),
        };
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreatePost = async () => {
    const content = composerText.trim();
    if (!content) {
      setComposerError('Post content cannot be empty');
      return;
    }
    if (content.length > 2000) {
      setComposerError('Post must be 2000 characters or less');
      return;
    }
    setComposerError('');
    setActionLoading(true);
    try {
      const res = await createPost(content);
      if (!isSavedView) {
        setPosts(prev => [res.data.post, ...prev]);
      }
      setComposerText('');
      setComposerOpen(false);
    } catch (e) {
      setComposerError(e?.response?.data?.error || 'Unable to create post');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr) 260px', gap: 16 }}>
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SidebarCard>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>{userName}</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{subtitle}</div>
          <div style={{ marginTop: 12, fontSize: 12, color: '#475569' }}>
            Keep your profile updated to surface better feed recommendations.
          </div>
        </SidebarCard>
        <SidebarCard title="Quick Links">
          <div style={{ fontSize: 13, color: '#0a66c2', lineHeight: 1.9 }}>
            <Link to="/connections" style={{ color: '#0a66c2', textDecoration: 'none', display: 'block' }}>My network</Link>
            <Link to="/home/saved" style={{ color: '#0a66c2', textDecoration: 'none', display: 'block' }}>Saved posts</Link>
            <Link to="/career-resources" style={{ color: '#0a66c2', textDecoration: 'none', display: 'block' }}>Career resources</Link>
          </div>
        </SidebarCard>
      </aside>

      <main style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!isSavedView && (
          <SidebarCard>
            {!composerOpen ? (
              <button
                onClick={() => setComposerOpen(true)}
                style={{
                  width: '100%',
                  height: 42,
                  borderRadius: 999,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#64748b',
                  textAlign: 'left',
                  padding: '0 16px',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Start a post
              </button>
            ) : (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{userName}</div>
                <textarea
                  value={composerText}
                  onChange={e => setComposerText(e.target.value)}
                  placeholder="Share an update"
                  maxLength={2000}
                  rows={5}
                  style={{
                    width: '100%',
                    border: '1px solid #cbd5e1',
                    borderRadius: 10,
                    padding: 10,
                    fontSize: 14,
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>{composerText.trim().length}/2000</div>
                {composerError && <div style={{ marginTop: 6, fontSize: 12, color: '#dc2626' }}>{composerError}</div>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                  <button
                    onClick={() => { setComposerOpen(false); setComposerText(''); setComposerError(''); }}
                    style={{ height: 34, border: '1px solid #cbd5e1', borderRadius: 999, background: '#fff', padding: '0 14px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreatePost}
                    disabled={actionLoading}
                    style={{ height: 34, border: 'none', borderRadius: 999, background: '#0a66c2', color: '#fff', padding: '0 14px', cursor: actionLoading ? 'not-allowed' : 'pointer', fontWeight: 700 }}
                  >
                    Post
                  </button>
                </div>
              </div>
            )}
          </SidebarCard>
        )}
        {loading && (
          <SidebarCard>
            <div style={{ color: '#64748b', fontSize: 14 }}>Loading your feed...</div>
          </SidebarCard>
        )}
        {error && (
          <SidebarCard>
            <div style={{ color: '#dc2626', fontSize: 14 }}>{error}</div>
          </SidebarCard>
        )}
        {!loading && !error && posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            currentMemberId={currentMemberId}
            onToggleLike={handleToggleLike}
            onToggleSave={handleToggleSave}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
            actionLoading={actionLoading}
          />
        ))}
      </main>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SidebarCard title="LinkedIn News">
          <ul style={{ margin: 0, paddingLeft: 16, color: '#475569', fontSize: 13, lineHeight: 1.8 }}>
            <li>AI hiring demand rises in Q2</li>
            <li>Remote-first teams refine culture</li>
            <li>Data engineering roles stay strong</li>
          </ul>
        </SidebarCard>
      </aside>
    </div>
  );
}
