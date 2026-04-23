import { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import LoginPage        from './pages/LoginPage';
import JobsPage         from './pages/JobsPage';
import ProfilePage      from './pages/ProfilePage';
import MessagesPage     from './pages/MessagesPage';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import ConnectionsPage  from './pages/ConnectionsPage';
import RecruiterPage    from './pages/RecruiterPage';
import AIAssistantPage  from './pages/AIAssistantPage';

function BrandMark() {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
      <span style={{ width:28, height:28, borderRadius:6, background:'linear-gradient(135deg,#0a66c2,#3b82f6)', color:'white', display:'inline-flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:16 }}>in</span>
      <span style={{ fontWeight:700, fontSize:20, color:'white', letterSpacing:'0.2px' }}>LinkedIn DS</span>
    </span>
  );
}

export default function App() {
  const location = useLocation();
  const [user, setUser] = useState(() => {
    const id   = localStorage.getItem('member_id') || localStorage.getItem('recruiter_id');
    const name = localStorage.getItem('user_name');
    const role = localStorage.getItem('role');
    return id ? { id, name, role } : null;
  });

  const handleLogin = (userData) => setUser(userData);

  const handleLogout = () => {
    ['member_id', 'recruiter_id', 'user_name', 'role', 'token'].forEach(k => localStorage.removeItem(k));
    setUser(null);
  };

  if (!user) return <LoginPage onLogin={handleLogin} />;

  const isRecruiter = user.role === 'recruiter';
  const isJobsRoute = !isRecruiter && location.pathname === '/';
  const contentWrapperStyle = isJobsRoute
    ? {
        maxWidth: 1200,
        margin: '0 auto',
        padding: '16px 20px',
        height: 'calc(100vh - 52px)',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }
    : { maxWidth: 1200, margin: '0 auto', padding: '24px 20px' };

  const navLinkStyle = { color: 'white', textDecoration: 'none', padding: '6px 10px', borderRadius: 4, fontSize: 14 };

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f3f2ef', minHeight: '100vh' }}>
      <nav style={{ background: '#0a66c2', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 4, height: 52, position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
        <Link to={isRecruiter ? '/recruiter' : '/'} style={{ marginRight: 16, textDecoration: 'none' }}><BrandMark /></Link>

        {!isRecruiter && <Link to="/"            style={navLinkStyle}>Jobs</Link>}
        {!isRecruiter && <Link to="/connections" style={navLinkStyle}>Connections</Link>}
        {!isRecruiter && <Link to="/messages"    style={navLinkStyle}>Messages</Link>}
        {!isRecruiter && <Link to="/profile"     style={navLinkStyle}>Profile</Link>}
        {!isRecruiter && <Link to="/analytics"   style={navLinkStyle}>Analytics</Link>}

        {isRecruiter && <Link to="/recruiter"  style={navLinkStyle}>Dashboard</Link>}
        {isRecruiter && <Link to="/messages"   style={navLinkStyle}>Messages</Link>}
        <Link to="/ai" style={navLinkStyle}>AI Agent</Link>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'white', fontSize: 13 }}>
            {isRecruiter ? '🏢' : '👤'} {user.name}
          </span>
          <button onClick={handleLogout}
            style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
            Sign Out
          </button>
        </div>
      </nav>

      <div style={contentWrapperStyle}>
        <Routes>
          <Route path="/"            element={<JobsPage />} />
          <Route path="/profile"     element={<ProfilePage />} />
          <Route path="/messages"    element={<MessagesPage />} />
          <Route path="/analytics"   element={<AnalyticsDashboard />} />
          <Route path="/connections" element={<ConnectionsPage />} />
          <Route path="/recruiter"   element={<RecruiterPage />} />
          <Route path="/ai"          element={<AIAssistantPage />} />
        </Routes>
      </div>
    </div>
  );
}
