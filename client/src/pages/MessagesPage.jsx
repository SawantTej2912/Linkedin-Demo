import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/apiClient';

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function initials(name = '') {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dayLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Avatar circle
function Avatar({ name, size = 40, color = '#0a66c2' }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, flexShrink: 0,
    }}>
      {initials(name)}
    </div>
  );
}

const AVATAR_COLORS = ['#0a66c2','#10b981','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#ec4899'];

// ─────────────────────────────────────────────
//  NEW MESSAGE MODAL
// ─────────────────────────────────────────────
function NewMessageModal({ myId, onOpen, onClose }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = async (q) => {
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const r = await api.post('/members/search', { keyword: q, limit: 10 });
      setResults((r.data.results || []).filter(m => m.member_id !== myId));
    } catch { /* ignore */ }
    setLoading(false);
  };

  const startChat = async (other) => {
    // Open (or reuse) a thread with these two participants
    const r = await api.post('/threads/open', { participant_ids: [myId, other.member_id] });
    onOpen(r.data.thread_id, other);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'white', borderRadius: 12, width: 460, maxHeight: '70vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>New message</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>
        {/* Search */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <input
            autoFocus
            value={query}
            onChange={e => search(e.target.value)}
            placeholder="Search by name or email…"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        {/* Results */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && <p style={{ textAlign: 'center', color: '#9ca3af', padding: 20, fontSize: 14 }}>Searching…</p>}
          {!loading && results.length === 0 && query && (
            <p style={{ textAlign: 'center', color: '#9ca3af', padding: 20, fontSize: 14 }}>No members found</p>
          )}
          {results.map((m, i) => (
            <div key={m.member_id} onClick={() => startChat(m)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Avatar name={`${m.first_name} ${m.last_name}`} size={42} color={AVATAR_COLORS[i % AVATAR_COLORS.length]} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{m.first_name} {m.last_name}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{m.headline || m.email}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────
export default function MessagesPage() {
  const myId = localStorage.getItem('member_id') || '';
  const myName = localStorage.getItem('member_name') || 'You';

  const [threads,      setThreads]      = useState([]);
  const [activeThread, setActiveThread] = useState(null); // full thread object
  const [messages,     setMessages]     = useState([]);
  const [text,         setText]         = useState('');
  const [memberCache,  setMemberCache]  = useState({}); // member_id → member object
  const [showModal,    setShowModal]    = useState(false);
  const [loadingMsgs,  setLoadingMsgs]  = useState(false);
  const [threadSearch, setThreadSearch] = useState('');
  const [activePill,   setActivePill]   = useState('Focused');

  const bottomRef  = useRef();
  const inputRef   = useRef();
  const pollRef    = useRef();

  // ── Fetch member by ID (with in-memory cache) ──
  const fetchMember = useCallback(async (id) => {
    if (!id || memberCache[id]) return memberCache[id];
    try {
      const r = await api.post('/members/get', { member_id: id });
      const m = r.data;
      setMemberCache(prev => ({ ...prev, [id]: m }));
      return m;
    } catch { return null; }
  }, [memberCache]);

  // ── Load all threads ──
  const loadThreads = useCallback(async () => {
    if (!myId) return;
    try {
      const r = await api.post('/threads/byUser', { user_id: myId });
      const ts = r.data.results || [];
      setThreads(ts);
      // Pre-fetch participant names
      const ids = [...new Set(ts.flatMap(t => t.participant_ids || []).filter(id => id !== myId))];
      ids.forEach(id => fetchMember(id));
    } catch { /* ignore */ }
  }, [myId, fetchMember]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  // ── Open a thread ──
  const openThread = async (thread) => {
    setActiveThread(thread);
    setLoadingMsgs(true);
    try {
      const r = await api.post('/messages/list', { thread_id: thread.thread_id });
      setMessages(r.data.results || []);
      // Pre-fetch sender names
      const senderIds = [...new Set((r.data.results || []).map(m => m.sender_id))];
      senderIds.forEach(id => fetchMember(id));
    } catch { /* ignore */ }
    setLoadingMsgs(false);
    // Start polling for new messages every 5 s
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await api.post('/messages/list', { thread_id: thread.thread_id });
        setMessages(r.data.results || []);
      } catch { /* ignore */ }
    }, 5000);
  };

  // Stop polling when unmounted
  useEffect(() => () => clearInterval(pollRef.current), []);

  // Auto-scroll to bottom when messages change
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Send a message ──
  const sendMessage = async () => {
    if (!text.trim() || !activeThread) return;
    const body = text.trim();
    setText('');
    try {
      await api.post('/messages/send', {
        thread_id: activeThread.thread_id,
        sender_id: myId,
        message_text: body,
      });
      // Refresh messages + thread list
      const r = await api.post('/messages/list', { thread_id: activeThread.thread_id });
      setMessages(r.data.results || []);
      loadThreads();
    } catch { /* ignore */ }
  };

  // ── New message modal: a thread was opened ──
  const handleNewThreadOpened = async (thread_id, otherMember) => {
    setShowModal(false);
    // Cache the other member
    setMemberCache(prev => ({ ...prev, [otherMember.member_id]: otherMember }));
    // Refresh thread list then open the new thread
    await loadThreads();
    openThread({ thread_id, participant_ids: [myId, otherMember.member_id] });
  };

  // ─────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────
  const activeOtherId = activeThread
    ? (activeThread.participant_ids || []).find(id => id !== myId)
    : null;
  const activeOther = memberCache[activeOtherId];
  const normalizedThreadSearch = threadSearch.trim().toLowerCase();
  const filteredThreads = threads.filter((t) => {
    if (!normalizedThreadSearch) return true;
    const otherId = (t.participant_ids || []).find(id => id !== myId);
    const other = memberCache[otherId];
    const name = other ? `${other.first_name} ${other.last_name}`.toLowerCase() : '';
    const preview = (t.last_message || '').toLowerCase();
    return name.includes(normalizedThreadSearch) || preview.includes(normalizedThreadSearch);
  });
  const quickReplies = ['Thanks for the update!', 'Can we chat tomorrow?', 'Sounds good to me'];

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 12px 20px' }}>
      {showModal && (
        <NewMessageModal myId={myId} onOpen={handleNewThreadOpened} onClose={() => setShowModal(false)} />
      )}

      <div style={{
        height: 'calc(100vh - 140px)', minHeight: 560,
        border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden',
        background: 'white', boxShadow: '0 6px 24px rgba(15,23,42,0.08)',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* ── FULL-WIDTH TOP CONTROLS ── */}
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 10, background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>Messaging</h2>
            <div style={{ position: 'relative', maxWidth: 420, flex: 1 }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 12 }}>🔍</span>
              <input
                value={threadSearch}
                onChange={e => setThreadSearch(e.target.value)}
                placeholder="Search messages"
                style={{ width: '100%', height: 32, border: '1px solid #dbe3ec', borderRadius: 8, padding: '0 10px 0 30px', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#f8fafc' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <button title="More actions" style={iconCircleBtn}>•••</button>
              <button
                onClick={() => setShowModal(true)}
                title="New message"
                style={iconCircleBtn}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['Focused', 'Unread', 'Connections'].map((pill) => (
              <button
                key={pill}
                onClick={() => setActivePill(pill)}
                style={{
                  height: 30,
                  borderRadius: 999,
                  border: `1px solid ${activePill === pill ? '#99c8f6' : '#dbe3ec'}`,
                  background: activePill === pill ? '#e9f3ff' : '#fff',
                  color: activePill === pill ? '#0a66c2' : '#475569',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '0 12px',
                  cursor: 'pointer',
                }}
              >
                {pill}
              </button>
            ))}
          </div>
        </div>

        {/* ── LOWER 2-COLUMN LAYOUT ── */}
        <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>

        {/* ── LEFT SIDEBAR ── */}
        <div style={{ width: 360, borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0, background: '#fff' }}>

          {/* Thread list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredThreads.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
                <p style={{ margin: 0, fontSize: 14 }}>No conversations yet</p>
                <p style={{ margin: '8px 0 0', fontSize: 13 }}>Click + to start a new message</p>
              </div>
            )}
            {filteredThreads.map((t, i) => {
              const otherId = (t.participant_ids || []).find(id => id !== myId);
              const other   = memberCache[otherId];
              const name    = other ? `${other.first_name} ${other.last_name}` : '…';
              const isActive = activeThread?.thread_id === t.thread_id;

              return (
                <div
                  key={t.thread_id}
                  onClick={() => openThread(t)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 14px', cursor: 'pointer',
                    background: isActive ? '#f1f7ff' : 'transparent',
                    borderBottom: '1px solid #eff3f7',
                    borderLeft: isActive ? '3px solid #0a66c2' : '3px solid transparent',
                    minHeight: 78,
                    transition: 'background 140ms ease',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <Avatar name={name} size={46} color={AVATAR_COLORS[i % AVATAR_COLORS.length]} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                        {name}
                      </span>
                      <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>
                        {timeAgo(t.updated_at)}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                      {t.last_message || 'Start a conversation'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        {!activeThread ? (
          /* Empty state */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>💬</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#374151' }}>Your Messages</h3>
            <p style={{ margin: '0 0 24px', fontSize: 14 }}>Select a conversation or start a new one.</p>
            <button
              onClick={() => setShowModal(true)}
              style={{ padding: '10px 24px', background: '#0a66c2', color: 'white', border: 'none', borderRadius: 20, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              New message
            </button>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#fff' }}>

            {/* Chat header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, background: '#fff' }}>
              <Avatar name={activeOther ? `${activeOther.first_name} ${activeOther.last_name}` : '…'} size={44} color="#0a66c2" />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeOther ? `${activeOther.first_name} ${activeOther.last_name}` : 'Loading…'}
                </div>
                {activeOther?.headline && (
                  <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeOther.headline}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={iconCircleBtn}>📞</button>
                <button style={iconCircleBtn}>⋯</button>
              </div>
            </div>

            {/* Messages area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {loadingMsgs && (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20, fontSize: 14 }}>Loading messages…</div>
              )}
              {!loadingMsgs && messages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>
                  <p style={{ fontSize: 14 }}>No messages yet. Say hello!</p>
                </div>
              )}

              {messages.map((m, i) => {
                const isMe = m.sender_id === myId;
                const sender = memberCache[m.sender_id];
                const senderName = sender ? `${sender.first_name} ${sender.last_name}` : (isMe ? myName : '…');
                const prevMsg = messages[i - 1];
                const showDayBreak = !prevMsg || dayLabel(prevMsg.sent_at) !== dayLabel(m.sent_at);
                const showSender = !prevMsg || prevMsg.sender_id !== m.sender_id;
                const showTime = !messages[i + 1] || messages[i + 1].sender_id !== m.sender_id;

                return (
                  <div key={m.message_id}>
                    {showDayBreak && (
                      <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 10px' }}>
                        <span style={{ fontSize: 11, color: '#64748b', background: '#eaf0f6', borderRadius: 999, padding: '4px 10px', fontWeight: 600 }}>
                          {dayLabel(m.sent_at)}
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginTop: showSender ? 12 : 2 }}>
                      {!isMe && (
                        <div style={{ width: 32, flexShrink: 0 }}>
                          {showTime && <Avatar name={senderName} size={32} color="#0a66c2" />}
                        </div>
                      )}
                      <div style={{ maxWidth: '64%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                        {showSender && !isMe && (
                          <span style={{ fontSize: 12, color: '#64748b', marginBottom: 4, marginLeft: 4, fontWeight: 600 }}>{senderName}</span>
                        )}
                        <div style={{
                          padding: '10px 14px',
                          borderRadius: isMe ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
                          background: isMe ? '#0a66c2' : '#fff',
                          color: isMe ? 'white' : '#0f172a',
                          fontSize: 14, lineHeight: 1.45,
                          boxShadow: '0 1px 3px rgba(15,23,42,0.1)',
                          wordBreak: 'break-word',
                          border: isMe ? 'none' : '1px solid #e2e8f0',
                        }}>
                          {m.message_text}
                        </div>
                        {showTime && (
                          <span style={{ fontSize: 11, color: '#94a3b8', margin: '4px 4px 0' }}>
                            {timeAgo(m.sent_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Quick replies + Input area */}
            <div style={{ borderTop: '1px solid #e2e8f0', background: '#fff' }}>
              <div style={{ padding: '10px 14px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {quickReplies.map((reply) => (
                  <button
                    key={reply}
                    onClick={() => {
                      setText(reply);
                      inputRef.current?.focus();
                    }}
                    style={{
                      height: 30,
                      borderRadius: 999,
                      border: '1px solid #dbe3ec',
                      background: '#f8fafc',
                      color: '#475569',
                      fontSize: 12,
                      fontWeight: 500,
                      padding: '0 10px',
                      cursor: 'pointer',
                    }}
                  >
                    {reply}
                  </button>
                ))}
              </div>

              <div style={{ padding: '10px 14px 12px', display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                <div style={{ flex: 1, border: '1px solid #dbe3ec', background: '#f8fafc', borderRadius: 14, padding: '10px 12px', minHeight: 46, display: 'flex', alignItems: 'center' }}>
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={e => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Write a message…"
                  rows={1}
                  style={{
                    width: '100%', background: 'none', border: 'none', outline: 'none',
                    fontSize: 14, resize: 'none', lineHeight: 1.4, fontFamily: 'inherit',
                    color: '#0f172a', maxHeight: 120,
                  }}
                />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!text.trim()}
                  style={{
                    width: 42, height: 42, borderRadius: '50%', border: 'none',
                    background: text.trim() ? '#0a66c2' : '#e2e8f0',
                    color: text.trim() ? 'white' : '#94a3b8',
                    cursor: text.trim() ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'background 0.15s',
                    boxShadow: text.trim() ? '0 2px 8px rgba(10,102,194,0.25)' : 'none',
                  }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </div>
            </div>

          </div>
        )}
        </div>
      </div>
    </div>
  );
}

const iconCircleBtn = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  border: '1px solid #dbe3ec',
  background: '#fff',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#475569',
  fontSize: 14,
  fontWeight: 700,
};
