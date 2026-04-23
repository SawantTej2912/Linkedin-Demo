import { useState, useEffect, useCallback } from 'react';
import { listConnections, sendRequest, acceptRequest, rejectRequest, pendingRequests, sentRequests } from '../api/connectionApi';
import api from '../api/apiClient';

// Avatar circle
function Avatar({ name = '', size = 48, color = '#0a66c2' }) {
  const letters = name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: 700, fontSize: size * 0.35, flexShrink: 0,
    }}>
      {letters}
    </div>
  );
}

const COLORS = ['#0a66c2', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

function Toast({ msg, onClose }) {
  useEffect(() => { if (msg) { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); } }, [msg, onClose]);
  if (!msg) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: '#111', color: 'white', padding: '12px 24px', borderRadius: 8,
      fontSize: 14, fontWeight: 500, zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    }}>
      {msg}
    </div>
  );
}

export default function ConnectionsPage() {
  const user_id = localStorage.getItem('member_id') || '';

  const [tab,         setTab]         = useState('myConnections');
  const [connections, setConnections] = useState([]);
  const [pending,     setPending]     = useState([]);
  const [sent,        setSent]        = useState([]); // receiver_ids I already sent to
  const [sentRequestsList, setSentRequestsList] = useState([]);
  const [searchRes,   setSearchRes]   = useState([]);
  const [keyword,     setKeyword]     = useState('');
  const [memberCache, setMemberCache] = useState({});
  const [toast,       setToast]       = useState('');
  const [loading,     setLoading]     = useState(false);

  // ── Fetch member name by ID (cached) ──
  const fetchMember = useCallback(async (id) => {
    if (!id || memberCache[id]) return memberCache[id];
    try {
      const r = await api.post('/members/get', { member_id: id });
      setMemberCache(prev => ({ ...prev, [id]: r.data }));
      return r.data;
    } catch { return null; }
  }, [memberCache]);

  const memberName = (id) => {
    const m = memberCache[id];
    return m ? `${m.first_name} ${m.last_name}` : id.slice(0, 8) + '…';
  };

  // ── Load connections ──
  const loadConnections = useCallback(async () => {
    try {
      const r = await listConnections(user_id);
      setConnections(r.data.results || []);
    } catch { /* ignore */ }
  }, [user_id]);

  // ── Load pending requests (sent TO me) ──
  const loadPending = useCallback(async () => {
    try {
      const r = await pendingRequests(user_id);
      const reqs = r.data.results || [];
      setPending(reqs);
      // Pre-fetch requester names
      reqs.forEach(req => fetchMember(req.requester_id));
    } catch { /* ignore */ }
  }, [user_id, fetchMember]);

  // ── Load sent requests (sent BY me, still pending) ──
  const loadSent = useCallback(async () => {
    try {
      const r = await sentRequests(user_id);
      const reqs = r.data.results || [];
      setSentRequestsList(reqs);
      setSent(reqs.map(r => r.receiver_id)); // store receiver_ids so we can disable Connect button
      reqs.forEach(req => fetchMember(req.receiver_id));
    } catch { /* ignore */ }
  }, [user_id]);

  // Load everything on mount
  useEffect(() => {
    if (!user_id) return;
    loadConnections();
    loadPending();
    loadSent();
  }, [user_id, loadConnections, loadPending, loadSent]);

  // Reload pending when switching to that tab
  useEffect(() => {
    if (tab === 'pending') loadPending();
    if (tab === 'myConnections') loadConnections();
    if (tab === 'sent') loadSent();
  }, [tab, loadPending, loadConnections, loadSent]);

  // ── Search ──
  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    try {
      const r = await api.post('/members/search', { keyword, limit: 20 });
      setSearchRes((r.data.results || []).filter(m => m.member_id !== user_id));
    } catch { setToast('Search failed'); }
    setLoading(false);
  };

  // ── Send connection request ──
  const handleConnect = async (receiver_id) => {
    try {
      await sendRequest({ requester_id: user_id, receiver_id, idempotency_key: crypto.randomUUID() });
      setSent(prev => [...prev, receiver_id]);
      await loadSent();
      setToast('Connection request sent!');
    } catch (e) {
      setToast(e.response?.data?.error || 'Request failed');
    }
  };

  // ── Accept ──
  const handleAccept = async (request_id) => {
    try {
      await acceptRequest(request_id);
      setToast('Connection accepted!');
      loadPending();
      loadConnections();
    } catch { setToast('Failed to accept'); }
  };

  // ── Reject ──
  const handleReject = async (request_id) => {
    try {
      await rejectRequest(request_id);
      setToast('Request declined');
      loadPending();
    } catch { setToast('Failed to decline'); }
  };

  // ── Already connected? ──
  const isConnected = (member_id) => connections.some(c => c.member_id === member_id);
  const hasSent     = (member_id) => sent.includes(member_id);

  // ── Tab style ──
  const tabStyle = (t) => ({
    padding: '9px 20px', border: 'none', cursor: 'pointer', borderRadius: 20,
    fontWeight: 600, fontSize: 14, transition: 'all 0.15s',
    background: tab === t ? '#0a66c2' : 'white',
    color:      tab === t ? 'white'   : '#374151',
    boxShadow:  tab === t ? 'none'    : '0 0 0 1px #d1d5db',
  });

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <Toast msg={toast} onClose={() => setToast('')} />

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: '#111' }}>Network</h2>
        <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>Manage your professional connections</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button style={tabStyle('myConnections')} onClick={() => setTab('myConnections')}>
          My Connections ({connections.length})
        </button>
        <button style={tabStyle('find')} onClick={() => setTab('find')}>
          Find People
        </button>
        <button style={tabStyle('pending')} onClick={() => setTab('pending')}>
          Pending Requests {pending.length > 0 && (
            <span style={{ marginLeft: 6, background: '#ef4444', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 12 }}>
              {pending.length}
            </span>
          )}
        </button>
        <button style={tabStyle('sent')} onClick={() => setTab('sent')}>
          Sent Requests {sentRequestsList.length > 0 && (
            <span style={{ marginLeft: 6, background: '#6b7280', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 12 }}>
              {sentRequestsList.length}
            </span>
          )}
        </button>
      </div>

      {/* ── MY CONNECTIONS ── */}
      {tab === 'myConnections' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {connections.length === 0 && (
            <p style={{ color: '#6b7280', gridColumn: '1/-1' }}>No connections yet. Use "Find People" to connect.</p>
          )}
          {connections.map((c, i) => (
            <div key={c.member_id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Avatar name={`${c.first_name} ${c.last_name}`} size={52} color={COLORS[i % COLORS.length]} />
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{c.first_name} {c.last_name}</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{c.headline || 'Member'}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{c.city || ''}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── FIND PEOPLE ── */}
      {tab === 'find' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input
              placeholder="Search by name, skill, keyword..."
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              style={{ flex: 1, padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none' }}
            />
            <button onClick={handleSearch}
              style={{ padding: '10px 20px', background: '#0a66c2', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {searchRes.map((m, i) => {
              const connected = isConnected(m.member_id);
              const requested = hasSent(m.member_id);
              return (
                <div key={m.member_id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <Avatar name={`${m.first_name} ${m.last_name}`} size={52} color={COLORS[i % COLORS.length]} />
                  <div style={{ marginTop: 12, marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{m.first_name} {m.last_name}</div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{m.headline || 'Member'}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{m.city || ''}</div>
                  </div>
                  {connected ? (
                    <div style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>✓ Connected</div>
                  ) : requested ? (
                    <div style={{ fontSize: 13, color: '#9ca3af', fontWeight: 600 }}>Pending…</div>
                  ) : (
                    <button onClick={() => handleConnect(m.member_id)}
                      style={{ width: '100%', padding: '7px', border: '1px solid #0a66c2', color: '#0a66c2', background: 'white', borderRadius: 20, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                      + Connect
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── PENDING REQUESTS ── */}
      {tab === 'pending' && (
        <div>
          {pending.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🤝</div>
              <p style={{ fontSize: 15, fontWeight: 500, color: '#374151' }}>No pending requests</p>
              <p style={{ fontSize: 13 }}>When someone sends you a connection request, it will appear here.</p>
            </div>
          )}
          {pending.map(req => (
            <div key={req.request_id} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px',
              marginBottom: 12, background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <Avatar name={memberName(req.requester_id)} size={52} color="#0a66c2" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>
                  {memberName(req.requester_id)}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                  {req.message || 'Wants to connect with you'}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                  {new Date(req.requested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleAccept(req.request_id)}
                  style={{ padding: '8px 20px', background: '#0a66c2', color: 'white', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  Accept
                </button>
                <button onClick={() => handleReject(req.request_id)}
                  style={{ padding: '8px 20px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 20, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SENT REQUESTS ── */}
      {tab === 'sent' && (
        <div>
          {sentRequestsList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📨</div>
              <p style={{ fontSize: 15, fontWeight: 500, color: '#374151' }}>No outgoing requests</p>
              <p style={{ fontSize: 13 }}>Requests you send will stay here until the other member accepts or rejects them.</p>
            </div>
          )}
          {sentRequestsList.map(req => (
            <div key={req.request_id} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px',
              marginBottom: 12, background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <Avatar name={memberName(req.receiver_id)} size={52} color="#6b7280" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{memberName(req.receiver_id)}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Awaiting response</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                  Sent {new Date(req.created_at || req.requested_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <span style={{ padding: '4px 12px', borderRadius: 12, background: '#f3f4f6', color: '#374151', fontSize: 12, fontWeight: 600 }}>Pending</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
