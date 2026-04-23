import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../api/apiClient';
import { applicationsByMember } from '../api/applicationApi';
import { getMemberDashboard } from '../api/analyticsApi';

// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────
const STATUS_COLORS = {
  submitted: '#0a66c2',
  reviewing: '#f59e0b',
  interview: '#10b981',
  offer:     '#22c55e',
  rejected:  '#ef4444',
};

const COMPANY_BY_TITLE = {
  'Senior Software Engineer':    'Google',
  'Machine Learning Engineer':   'Google',
  'Site Reliability Engineer':   'Google',
  'Backend Engineer – Instagram':'Meta',
  'Data Engineer – Analytics':   'Meta',
  'Frontend Engineer – React':   'Meta',
  'Cloud Solutions Architect':   'Microsoft',
  'Software Engineer – Azure':   'Microsoft',
  'DevOps Engineer':             'Microsoft',
  'Product Manager – AI':        'Microsoft',
};

// ─────────────────────────────────────────────
//  SMALL COMPONENTS
// ─────────────────────────────────────────────
function Card({ children, style: extra }) {
  return (
    <div style={{ background:'white', borderRadius:10, border:'1px solid #e5e7eb',
                  boxShadow:'0 1px 3px rgba(0,0,0,0.05)', padding:'20px 24px',
                  marginBottom:16, ...extra }}>
      {children}
    </div>
  );
}

function StatBox({ icon, value, label, sub, color='#0a66c2' }) {
  return (
    <div style={{ flex:1, minWidth:140, background:'#f9fafb', borderRadius:8, padding:'16px 20px' }}>
      <div style={{ fontSize:24, marginBottom:8 }}>{icon}</div>
      <div style={{ fontSize:28, fontWeight:700, color }}>{value}</div>
      <div style={{ fontSize:14, color:'#374151', fontWeight:500 }}>{label}</div>
      {sub && <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

// Custom tooltip for bar chart
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:8,
                  padding:'10px 14px', boxShadow:'0 2px 8px rgba(0,0,0,0.1)' }}>
      <p style={{ margin:'0 0 4px', fontWeight:600, fontSize:13 }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ margin:0, fontSize:13, color:p.fill || p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────
export default function AnalyticsDashboard() {
  const member_id = localStorage.getItem('member_id') || '';

  const [myApps,   setMyApps]   = useState([]);
  const [allJobs,  setAllJobs]  = useState([]);
  const [memberDashboard, setMemberDashboard] = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Load member's applications
        if (member_id) {
          const [appRes, dashRes] = await Promise.all([
            applicationsByMember(member_id),
            getMemberDashboard(member_id),
          ]);
          setMyApps(appRes.data.results || []);
          setMemberDashboard(dashRes.data || null);
        }
        // Load all jobs with their real counts from MySQL
        const j = await api.post('/jobs/search', { limit: 20 });
        setAllJobs(j.data.results || []);
      } catch(e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [member_id]);

  // ── Derived data ──
  // Application status breakdown for pie chart
  const statusCounts = (memberDashboard?.application_status_breakdown || myApps.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {}));
  const pieData = Array.isArray(statusCounts)
    ? statusCounts.map(({ status, count }) => ({ name: status, value: count }))
    : Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  const profileViewsTotal = (memberDashboard?.profile_views || []).reduce((sum, row) => sum + (row.views || 0), 0);

  // Top jobs by applicants_count (from MySQL jobs table)
  const topJobs = [...allJobs]
    .sort((a,b) => b.applicants_count - a.applicants_count)
    .slice(0, 8)
    .map(j => ({
      name: (COMPANY_BY_TITLE[j.title] || '') + ' · ' + j.title.split(' ').slice(0,3).join(' '),
      applicants: j.applicants_count,
      views: j.views_count,
      saves: j.saves_count,
    }));

  // Work mode breakdown
  const workModes = allJobs.reduce((acc, j) => {
    acc[j.work_mode] = (acc[j.work_mode] || 0) + 1;
    return acc;
  }, {});
  const workModeData = Object.entries(workModes).map(([name, value]) => ({ name, value }));

  // Employment type breakdown
  const empTypes = allJobs.reduce((acc, j) => {
    acc[j.employment_type] = (acc[j.employment_type] || 0) + 1;
    return acc;
  }, {});
  const empTypeData = Object.entries(empTypes).map(([name, value]) => ({ name, value }));

  const COLORS = ['#0a66c2','#10b981','#f59e0b','#8b5cf6','#ef4444'];

  if (loading) return (
    <div style={{ textAlign:'center', padding:60, color:'#6b7280', fontSize:15 }}>
      Loading analytics…
    </div>
  );

  return (
    <div style={{ maxWidth:1100, margin:'0 auto' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom:20 }}>
        <h2 style={{ margin:'0 0 4px', fontSize:24, fontWeight:700, color:'#111' }}>Analytics</h2>
        <p style={{ margin:0, color:'#6b7280', fontSize:14 }}>
          Your activity and platform insights
        </p>
      </div>

      {/* ── SECTION 1: My Stats ── */}
      <Card>
        <h3 style={{ margin:'0 0 16px', fontSize:16, fontWeight:700 }}>My Activity</h3>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <StatBox icon="👥" value={profileViewsTotal} label="Profile views" sub="Past 30 days" />
          <StatBox icon="📋" value={myApps.length}   label="Applications sent"  sub="All time" />
          <StatBox icon="🎯" value={myApps.filter(a=>a.status==='interview').length}
                             label="Interviews"      sub="All time" color="#10b981" />
          <StatBox icon="✅" value={myApps.filter(a=>a.status==='offer').length}
                             label="Offers received" sub="All time" color="#22c55e" />
        </div>
      </Card>

      {/* ── SECTION 2: Application Status Pie + My Applications List ── */}
      <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>

        {/* Pie chart */}
        <Card style={{ flex:'0 0 340px' }}>
          <h3 style={{ margin:'0 0 4px', fontSize:16, fontWeight:700 }}>My Application Status</h3>
          <p style={{ margin:'0 0 16px', fontSize:13, color:'#6b7280' }}>{myApps.length} total applications</p>
          {pieData.length === 0 ? (
            <p style={{ color:'#9ca3af', fontSize:14, textAlign:'center', padding:'40px 0' }}>
              No applications yet
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name"
                     cx="50%" cy="50%" outerRadius={85} label={({name,value})=>`${name}: ${value}`}
                     labelLine={false}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#9ca3af'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
          {/* Status legend */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:12 }}>
            {pieData.map(({ name, value }) => (
              <span key={name} style={{ display:'flex', alignItems:'center', gap:4,
                                           fontSize:12, background:`${STATUS_COLORS[name]}15`,
                                           color:STATUS_COLORS[name], padding:'3px 10px',
                                           borderRadius:12, fontWeight:600 }}>
                {name}: {value}
              </span>
            ))}
          </div>
        </Card>

        {/* My applications list */}
        <Card style={{ flex:1, minWidth:280 }}>
          <h3 style={{ margin:'0 0 16px', fontSize:16, fontWeight:700 }}>Recent Applications</h3>
          {myApps.length === 0 ? (
            <p style={{ color:'#9ca3af', fontSize:14 }}>No applications yet</p>
          ) : (
            myApps.slice(0,6).map((a,i) => (
              <div key={a.application_id} style={{ display:'flex', justifyContent:'space-between',
                                                    alignItems:'center', padding:'10px 0',
                                                    borderTop: i>0?'1px solid #f3f4f6':'none' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#111' }}>
                    {a.job_id?.slice(0,8)}…
                  </div>
                  <div style={{ fontSize:12, color:'#9ca3af' }}>
                    {new Date(a.applied_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                  </div>
                </div>
                <span style={{ background:`${STATUS_COLORS[a.status]}20`,
                                color:STATUS_COLORS[a.status],
                                padding:'3px 10px', borderRadius:12,
                                fontSize:12, fontWeight:600 }}>
                  {a.status}
                </span>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* ── SECTION 3: Top Jobs by Applicants ── */}
      <Card>
        <h3 style={{ margin:'0 0 4px', fontSize:16, fontWeight:700 }}>Top Jobs by Applicants</h3>
        <p style={{ margin:'0 0 16px', fontSize:13, color:'#6b7280' }}>
          Most competitive positions on the platform
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topJobs} layout="vertical" margin={{ left:20, right:20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize:12 }} />
            <YAxis type="category" dataKey="name" width={200} tick={{ fontSize:11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="applicants" name="Applicants" fill="#0a66c2" radius={[0,4,4,0]} />
            <Bar dataKey="views"      name="Views"      fill="#93c5fd" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* ── SECTION 4: Job Market Breakdown ── */}
      <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>

        <Card style={{ flex:1, minWidth:260 }}>
          <h3 style={{ margin:'0 0 16px', fontSize:16, fontWeight:700 }}>Work Mode Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={workModeData} dataKey="value" nameKey="name"
                   cx="50%" cy="50%" outerRadius={75} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}>
                {workModeData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ flex:1, minWidth:260 }}>
          <h3 style={{ margin:'0 0 16px', fontSize:16, fontWeight:700 }}>Employment Type</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={empTypeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize:11 }} />
              <YAxis tick={{ fontSize:11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Jobs" fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ flex:1, minWidth:260 }}>
          <h3 style={{ margin:'0 0 8px', fontSize:16, fontWeight:700 }}>Salary Ranges</h3>
          <p style={{ fontSize:13, color:'#6b7280', margin:'0 0 12px' }}>Min salary across job postings</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={allJobs.map(j=>({
              name: j.title.split(' ').slice(0,2).join(' '),
              min:  Math.round(+j.salary_min/1000),
              max:  Math.round(+j.salary_max/1000),
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize:9 }} />
              <YAxis tick={{ fontSize:11 }} unit="K" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="min" name="Min $K" fill="#8b5cf6" radius={[4,4,0,0]} />
              <Bar dataKey="max" name="Max $K" fill="#c4b5fd" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

    </div>
  );
}
