import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { searchJobs, getJob } from '../api/jobApi';
import { submitApplication, applicationsByMember } from '../api/applicationApi';

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

// Returns a colored circle with the first letter of the company name
function CompanyLogo({ name, size = 44 }) {
  const colors = ['#0a66c2','#1a73e8','#4f46e5','#0891b2','#059669','#d97706','#dc2626'];
  const color  = colors[(name || 'A').charCodeAt(0) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: 10,
      background: color, color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.4, flexShrink: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

// Formats salary range → "$160K – $220K"
function salary(min, max) {
  if (!min) return null;
  const fmt = n => `$${Math.round(+n / 1000)}K`;
  return `${fmt(min)} – ${fmt(max)}`;
}

// Relative date → "3 days ago"
function timeAgo(dateStr) {
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

// Small pill badge
function Badge({ children, color = '#e0eaff', text = '#1e40af' }) {
  return (
    <span style={{
      background: color, color: text,
      padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────
//  COMPANY NAME MAP  (job → company)
//  The API returns recruiter data on the job;
//  we store company name from JOBS seed data.
// ─────────────────────────────────────────────
const COMPANY_BY_TITLE = {
  'Senior Software Engineer':   'Google',
  'Machine Learning Engineer':  'Google',
  'Site Reliability Engineer':  'Google',
  'Backend Engineer – Instagram':'Meta',
  'Data Engineer – Analytics':  'Meta',
  'Frontend Engineer – React':  'Meta',
  'Cloud Solutions Architect':  'Microsoft',
  'Software Engineer – Azure':  'Microsoft',
  'DevOps Engineer':            'Microsoft',
  'Product Manager – AI':       'Microsoft',
};

function JobsSidebarModule({ title, children, actionLabel, onAction }) {
  return (
    <section style={{
      background: 'white',
      borderRadius: 12,
      border: '1px solid #e2e8f0',
      padding: 14,
      boxShadow: '0 1px 6px rgba(15,23,42,0.04)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h4 style={{ margin: 0, fontSize: 14, color: '#0f172a' }}>{title}</h4>
        {actionLabel && (
          <button onClick={onAction} style={{ border: 'none', background: 'transparent', color: '#0a66c2', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {actionLabel}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function JobPreviewCard({ job, onOpen }) {
  const company = job.company_name || COMPANY_BY_TITLE[job.title] || 'Company';
  return (
    <button
      onClick={() => onOpen(job)}
      style={{
        width: '100%',
        textAlign: 'left',
        border: '1px solid #e2e8f0',
        background: '#fff',
        borderRadius: 12,
        padding: 12,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        boxShadow: '0 1px 6px rgba(15,23,42,0.04)',
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <CompanyLogo name={company} size={38} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {job.title}
          </div>
          <div style={{ marginTop: 2, fontSize: 12, color: '#334155', fontWeight: 600 }}>{company}</div>
          <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>
            {job.city}, {job.state} · {job.work_mode}
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Badge>{job.employment_type}</Badge>
            <Badge color="#f9fafb" text="#64748b">{timeAgo(job.posted_at)}</Badge>
          </div>
        </div>
      </div>
    </button>
  );
}

function JobRecommendationSection({ title, subtitle, jobs, onOpenJob, onShowAll }) {
  return (
    <section style={{
      background: 'white',
      borderRadius: 14,
      border: '1px solid #e2e8f0',
      padding: 16,
      boxShadow: '0 2px 12px rgba(15,23,42,0.04)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>{title}</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>{subtitle}</p>
        </div>
        <button
          onClick={onShowAll}
          style={{ height: 34, padding: '0 14px', borderRadius: 999, border: '1px solid #bfdbfe', background: '#f8fbff', color: '#0a66c2', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Show all
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
        {jobs.map(job => <JobPreviewCard key={job.job_id} job={job} onOpen={onOpenJob} />)}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
//  JOBS HOME / DISCOVERY
// ─────────────────────────────────────────────
export default function JobsPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await searchJobs({ page: 1, limit: 36 });
        setJobs(res.data.results || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const openJob = (job) => navigate('/jobs/browse', { state: { jobId: job.job_id } });
  const showAll = (presetFilters = {}) => navigate('/jobs/browse', { state: { filters: presetFilters } });

  const preferenceJobs = jobs
    .filter(job => ['remote', 'hybrid'].includes((job.work_mode || '').toLowerCase()))
    .slice(0, 4);
  const activityJobs = [...jobs]
    .sort((a, b) => (b.applicants_count || 0) - (a.applicants_count || 0))
    .slice(0, 4);
  const featuredJobs = [...jobs]
    .sort((a, b) => new Date(b.posted_at || 0) - new Date(a.posted_at || 0))
    .slice(0, 4);

  const userName = localStorage.getItem('user_name') || 'Member';
  const savedJobsCount = (() => {
    try {
      return JSON.parse(localStorage.getItem('saved_jobs_ui') || '[]').length;
    } catch {
      return 0;
    }
  })();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', gap: 16 }}>
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <JobsSidebarModule title="Profile Summary">
          <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>{userName}</div>
            <div>Keep your profile fresh for better matches.</div>
          </div>
        </JobsSidebarModule>
        <JobsSidebarModule title="Preferences" actionLabel="Update" onAction={() => showAll({ work_mode: 'remote' })}>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
            Work mode, role, and level settings influence every recommendation.
          </p>
        </JobsSidebarModule>
        <JobsSidebarModule title="Job Tracker">
          <div style={{ fontSize: 12, color: '#64748b' }}>Saved jobs: <strong style={{ color: '#0f172a' }}>{savedJobsCount}</strong></div>
          <button onClick={() => showAll()} style={{ marginTop: 10, border: '1px solid #cbd5e1', borderRadius: 999, height: 32, padding: '0 12px', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            View tracked jobs
          </button>
        </JobsSidebarModule>
        <JobsSidebarModule title="Career Insights">
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#475569', lineHeight: 1.7 }}>
            <li>Remote software roles are trending.</li>
            <li>Data + AI skills are in high demand.</li>
            <li>Applications within 48h convert better.</li>
          </ul>
        </JobsSidebarModule>
        <JobsSidebarModule title="Utilities">
          <button style={{ width: '100%', height: 34, borderRadius: 999, border: 'none', background: '#0a66c2', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Post a free job
          </button>
        </JobsSidebarModule>
      </aside>

      <main style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
          <h2 style={{ margin: 0, fontSize: 24, color: '#0f172a' }}>Discover jobs for you</h2>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
            Curated recommendations based on your profile, activity, and market demand.
          </p>
        </div>

        {loading ? (
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: 18, color: '#64748b', fontSize: 14 }}>
            Loading recommendations...
          </div>
        ) : (
          <>
            <JobRecommendationSection
              title="Jobs based on your preferences"
              subtitle="Matches aligned with your preferred work setup."
              jobs={preferenceJobs}
              onOpenJob={openJob}
              onShowAll={() => showAll({ work_mode: 'remote' })}
            />
            <JobRecommendationSection
              title="Jobs based on your activity"
              subtitle="Roles many candidates like you are exploring."
              jobs={activityJobs}
              onOpenJob={openJob}
              onShowAll={() => showAll({})}
            />
            <JobRecommendationSection
              title="Featured recommendations"
              subtitle="Fresh opportunities from top employers."
              jobs={featuredJobs}
              onOpenJob={openJob}
              onShowAll={() => showAll({})}
            />
          </>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────
//  JOBS BROWSE / DETAIL EXPERIENCE
// ─────────────────────────────────────────────
export function JobsBrowsePage() {
  const location = useLocation();
  const initialFilters = location.state?.filters;
  const initialJobId = location.state?.jobId;
  const [filters, setFilters] = useState({
    keyword: '', location: '', employment_types: [], seniority_level: '', work_mode: '', industry: '',
  });
  const [jobs,        setJobs]       = useState([]);
  const [selected,    setSelected]   = useState(null);
  const [toast,       setToast]      = useState({ text: '', type: 'success' });
  const [loading,     setLoading]    = useState(false);
  const [applying,    setApplying]   = useState(false);  // loading state for apply button
  const [applyError,  setApplyError] = useState('');     // inline error under the button
  const [page,        setPage]       = useState(1);
  const [hasMore,     setHasMore]    = useState(false);
  const [myApps,      setMyApps]     = useState([]);
  const [savedJobs,   setSavedJobs]  = useState(() => {
    try {
      const saved = localStorage.getItem('saved_jobs_ui');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [hoveredJobId, setHoveredJobId] = useState(null);
  const [showCompactDetailBar, setShowCompactDetailBar] = useState(false);
  const [compactBarThreshold, setCompactBarThreshold] = useState(180);
  const detailScrollRef = useRef(null);
  const largeHeaderRef = useRef(null);

  const member_id = localStorage.getItem('member_id');

  useEffect(() => {
    localStorage.setItem('saved_jobs_ui', JSON.stringify(savedJobs));
  }, [savedJobs]);

  useEffect(() => {
    const headerHeight = largeHeaderRef.current?.offsetHeight || 180;
    const threshold = Math.max(80, headerHeight - 52);
    setCompactBarThreshold(threshold);
    setShowCompactDetailBar(false);

    if (detailScrollRef.current) {
      detailScrollRef.current.scrollTop = 0;
    }
  }, [selected]);

  // Load all jobs on first visit
  useEffect(() => {
    const nextFilters = initialFilters ? { ...filters, ...initialFilters } : {};
    if (initialFilters) {
      setFilters(prev => ({ ...prev, ...initialFilters }));
    }
    handleSearch(1, nextFilters);
  }, []);

  useEffect(() => {
    if (!initialJobId || jobs.length === 0) return;
    handleView(initialJobId);
  }, [initialJobId, jobs.length]);

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));
  const setAndSearch = (k, v) => {
    setFilters(prev => {
      const next = { ...prev, [k]: v };
      handleSearch(1, next);
      return next;
    });
  };
  const toggleEmploymentType = (type) => {
    setFilters(prev => {
      const exists = prev.employment_types.includes(type);
      const nextEmploymentTypes = exists
        ? prev.employment_types.filter(t => t !== type)
        : [...prev.employment_types, type];
      const next = { ...prev, employment_types: nextEmploymentTypes };
      handleSearch(1, next);
      return next;
    });
  };

  const showToast = (text, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast({ text: '', type: 'success' }), 3500);
  };

  // ── Search ──
  const handleSearch = async (p = 1, overrideFilters) => {
    setLoading(true);
    try {
      const payload = { ...(overrideFilters !== undefined ? overrideFilters : filters), page: p, limit: 20 };
      if (Array.isArray(payload.employment_types) && payload.employment_types.length === 0) delete payload.employment_types;
      Object.keys(payload).forEach(k => { if (!payload[k]) delete payload[k]; });
      const res     = await searchJobs(payload);
      const results = res.data.results || [];
      setJobs(p === 1 ? results : prev => [...prev, ...results]);
      setPage(p);
      setHasMore(results.length === 20);
    } catch (e) {
      showToast('Search failed: ' + e.message, 'error');
    }
    setLoading(false);
  };

  // ── View job detail ──
  const handleView = async (job_id) => {
    setApplyError('');  // clear any previous error when switching jobs
    try {
      const res = await getJob(job_id);
      setSelected(res.data);
      if (member_id) {
        applicationsByMember(member_id)
          .then(r => setMyApps((r.data.results || []).map(a => a.job_id)))
          .catch(() => {});
      }
    } catch (_) {
      showToast('Error loading job details', 'error');
    }
  };

  // ── Apply ──
  const handleApply = async () => {
    if (!member_id) { setApplyError('Please sign in to apply.'); return; }
    if (!selected)  return;
    setApplying(true);
    setApplyError('');
    try {
      await submitApplication({ job_id: selected.job_id, member_id, idempotency_key: crypto.randomUUID() });
      setMyApps(prev => [...prev, selected.job_id]);
      showToast('🎉 Application submitted successfully!');
    } catch (e) {
      const msg = e.response?.data?.error || 'Apply failed. Please try again.';
      setApplyError(msg);   // shown inline under the button — hard to miss
    } finally {
      setApplying(false);
    }
  };
  const toggleSaved = () => {
    if (!selected) return;
    setSavedJobs(prev =>
      prev.includes(selected.job_id)
        ? prev.filter(id => id !== selected.job_id)
        : [...prev, selected.job_id]
    );
  };

  const alreadyApplied = selected && myApps.includes(selected.job_id);
  const isSaved = selected && savedJobs.includes(selected.job_id);
  const companyName    = job => job.company_name || COMPANY_BY_TITLE[job.title] || 'Company';
  const compactMetaLine = selected
    ? `${companyName(selected)} \u00b7 ${selected.city}, ${selected.state}`
    : '';
  const handleDetailScroll = (e) => {
    setShowCompactDetailBar(e.currentTarget.scrollTop > compactBarThreshold);
  };

  // ─────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

      {/* ── Toast notification ── */}
      {toast.text && (
        <div style={{
          position: 'fixed', top: 70, right: 24, zIndex: 999,
          background: toast.type === 'error' ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${toast.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
          color: toast.type === 'error' ? '#dc2626' : '#15803d',
          padding: '12px 20px', borderRadius: 8, fontSize: 14,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          {toast.type === 'error' ? '⚠ ' : '✓ '}{toast.text}
        </div>
      )}

      {/* ── Page header ── */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 26, color: '#0f172a', fontWeight: 700, letterSpacing: '-0.01em' }}>Find your next role</h2>
        <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
          {jobs.length > 0 ? `${jobs.length} job${jobs.length !== 1 ? 's' : ''} found` : 'Search across thousands of opportunities'}
        </p>
      </div>

      {/* ── Search bar ── */}
      <div style={{
        background: 'white', borderRadius: 12,
        border: '1px solid #e2e8f0', padding: 16,
        marginBottom: 16, boxShadow: '0 2px 12px rgba(15,23,42,0.04)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr auto auto', gap: 8, alignItems: 'center' }}>

          {/* Keyword */}
          <div style={{ flex: 2, minWidth: 160, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 14 }}>🔍</span>
            <input
              placeholder="Job title, skill, or keyword"
              value={filters.keyword}
              onChange={e => set('keyword', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch(1)}
              style={searchInputStyle({ paddingLeft: 34, height: 40 })}
            />
          </div>

          {/* Location */}
          <div style={{ flex: 1, minWidth: 130, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 13 }}>📍</span>
            <input
              placeholder="City or state"
              value={filters.location}
              onChange={e => set('location', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch(1)}
              style={searchInputStyle({ paddingLeft: 30, height: 40 })}
            />
          </div>

          {/* Seniority */}
          <select value={filters.seniority_level} onChange={e => setAndSearch('seniority_level', e.target.value)}
            style={selectStyle({ height: 40, borderRadius: 999 })}>
            <option value="">Level</option>
            {['Internship', 'Entry level', 'Associate', 'Mid-Senior level', 'Director', 'Executive'].map(t => <option key={t}>{t}</option>)}
          </select>

          {/* Search button */}
          <button onClick={() => handleSearch(1)} disabled={loading}
            style={{
              height: 40, padding: '0 20px', background: loading ? '#93c5fd' : '#0a66c2',
              color: 'white', border: 'none', borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', borderRadius: 999, boxShadow: '0 2px 8px rgba(10,102,194,0.18)',
            }}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {['Full-time', 'Part-time', 'Contract', 'Internship'].map(type => {
            const active = filters.employment_types.includes(type);
            return (
              <button key={type} onClick={() => toggleEmploymentType(type)} style={chipStyle(active)}>
                {type}
              </button>
            );
          })}
          {['onsite', 'remote', 'hybrid'].map(mode => {
            const active = filters.work_mode === mode;
            return (
              <button key={mode} onClick={() => setAndSearch('work_mode', active ? '' : mode)} style={chipStyle(active)}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            );
          })}

          {/* Clear */}
          {(filters.keyword || filters.location || filters.employment_types.length || filters.seniority_level || filters.work_mode) && (
            <button onClick={() => {
              const cleared = { keyword: '', location: '', employment_types: [], seniority_level: '', work_mode: '', industry: '' };
              setFilters(cleared);
              handleSearch(1, cleared);
            }}
              style={{ height: 34, padding: '0 12px', background: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* ── LEFT: Job list ── */}
        <div style={{ flex: '0 0 380px', minWidth: 0, height: '100%', overflowY: 'auto', paddingRight: 4 }}>
          {/* Empty state */}
          {jobs.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '64px 20px', background: 'white', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💼</div>
              <p style={{ color: '#6b7280', margin: 0, fontSize: 15 }}>No jobs found. Try different keywords.</p>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && jobs.length === 0 && (
            [1,2,3].map(i => (
              <div key={i} style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16, marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f3f4f6' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 14, background: '#f3f4f6', borderRadius: 4, marginBottom: 8, width: '60%' }} />
                    <div style={{ height: 12, background: '#f3f4f6', borderRadius: 4, width: '40%' }} />
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Job cards */}
          {jobs.map(job => {
            const isActive = selected?.job_id === job.job_id;
            const company  = companyName(job);
            return (
              <div key={job.job_id} onClick={() => handleView(job.job_id)}
                onMouseEnter={() => setHoveredJobId(job.job_id)}
                onMouseLeave={() => setHoveredJobId(null)}
                style={{
                  background: isActive ? '#f8fbff' : hoveredJobId === job.job_id ? '#fcfdff' : 'white',
                  borderRadius: 12, padding: 16, marginBottom: 8,
                  cursor: 'pointer', transition: 'all 0.15s ease',
                  border: `1px solid ${isActive ? '#93c5fd' : '#e2e8f0'}`,
                  borderLeft: `3px solid ${isActive ? '#0a66c2' : 'transparent'}`,
                  boxShadow: isActive ? '0 4px 16px rgba(10,102,194,0.12)' : '0 1px 6px rgba(15,23,42,0.05)',
                }}>

                <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                  <CompanyLogo name={company} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 16, color: '#0f172a', marginBottom: 2,
                                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {job.title}
                    </div>
                    <div style={{ color: '#334155', fontSize: 13, fontWeight: 500 }}>{company}</div>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                  📍 {job.city}, {job.state} &nbsp;·&nbsp; {job.work_mode}
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  <Badge>{job.employment_type}</Badge>
                  {salary(job.salary_min, job.salary_max) && (
                    <Badge color="#f0fdf4" text="#15803d">{salary(job.salary_min, job.salary_max)}</Badge>
                  )}
                  <Badge color="#f9fafb" text="#6b7280">{job.seniority_level}</Badge>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' }}>
                  <span>👥 {job.applicants_count} applicants</span>
                  <span>{timeAgo(job.posted_at)}</span>
                </div>
              </div>
            );
          })}

          {/* Load more */}
          {hasMore && (
            <button onClick={() => handleSearch(page + 1)} disabled={loading}
              style={{
                width: '100%', padding: 12, border: '1px solid #bfdbfe',
                color: '#0a66c2', background: '#f8fbff', borderRadius: 999,
                cursor: 'pointer', fontWeight: 600, fontSize: 14,
              }}>
              {loading ? 'Loading…' : 'Load more jobs'}
            </button>
          )}
        </div>

        {/* ── RIGHT: Job detail panel ── */}
        <div style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', paddingRight: 4 }}>
          {!selected ? (
            <div style={{
              background: 'white', borderRadius: 12, border: '1px solid #e2e8f0',
              padding: '80px 20px', textAlign: 'center', color: '#9ca3af',
            }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>📋</div>
              <p style={{ margin: 0, fontSize: 15 }}>Select a job to see full details</p>
            </div>
          ) : (
            <div style={{
              background: 'white', borderRadius: 12, border: '1px solid #e2e8f0',
              boxShadow: '0 2px 12px rgba(15,23,42,0.05)',
              overflow: 'hidden',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {/* Scroll area with compact sticky action bar */}
              <div ref={detailScrollRef} onScroll={handleDetailScroll} style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                <div style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 5,
                  marginBottom: -64,
                  height: 64,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.98)',
                  borderBottom: showCompactDetailBar ? '1px solid #e2e8f0' : '1px solid transparent',
                  boxShadow: showCompactDetailBar ? '0 4px 10px rgba(15,23,42,0.06)' : 'none',
                  opacity: showCompactDetailBar ? 1 : 0,
                  transform: showCompactDetailBar ? 'translateY(0)' : 'translateY(-8px)',
                  pointerEvents: showCompactDetailBar ? 'auto' : 'none',
                  transition: 'opacity 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
                }}>
                  <div style={{ minWidth: 0, flex: 1, paddingRight: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selected.title}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {compactMetaLine}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={toggleSaved}
                      style={{
                        height: 32, padding: '0 12px', borderRadius: 999,
                        border: `1px solid ${isSaved ? '#0a66c2' : '#cbd5e1'}`,
                        color: isSaved ? '#0a66c2' : '#334155',
                        background: isSaved ? '#eff6ff' : '#fff',
                        fontWeight: 600, fontSize: 12, cursor: 'pointer',
                      }}>
                      {isSaved ? 'Saved' : 'Save'}
                    </button>
                    <button onClick={handleApply}
                      disabled={alreadyApplied || selected.status !== 'open' || applying}
                      style={{
                        height: 32, padding: '0 12px', borderRadius: 999, border: 'none',
                        background: alreadyApplied ? '#dcfce7' : selected.status !== 'open' ? '#e5e7eb' : applying ? '#3b82f6' : '#0a66c2',
                        color: alreadyApplied ? '#15803d' : selected.status !== 'open' ? '#9ca3af' : 'white',
                        cursor: alreadyApplied || selected.status !== 'open' || applying ? 'not-allowed' : 'pointer',
                        fontWeight: 700, fontSize: 12, letterSpacing: '0.1px',
                      }}>
                      {alreadyApplied ? 'Applied' : applying ? 'Submitting…' : selected.status !== 'open' ? 'Closed' : 'Apply'}
                    </button>
                  </div>
                </div>

                {/* Large full header (scrolls away naturally) */}
                <div ref={largeHeaderRef}>
                  <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 12 }}>
                      <CompanyLogo name={companyName(selected)} size={48} />
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '0 0 4px', fontSize: 20, color: '#0f172a', fontWeight: 700, letterSpacing: '-0.01em' }}>{selected.title}</h3>
                        <p style={{ margin: '0 0 2px', color: '#334155', fontWeight: 600, fontSize: 15 }}>{companyName(selected)}</p>
                        <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
                          📍 {selected.city}, {selected.state}, {selected.country} &nbsp;·&nbsp; {selected.work_mode}
                        </p>
                      </div>
                      <span style={{
                        background: selected.status === 'open' ? '#dcfce7' : '#fee2e2',
                        color:      selected.status === 'open' ? '#15803d' : '#dc2626',
                        padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                      }}>
                        {selected.status === 'open' ? 'Actively Hiring' : 'Closed'}
                      </span>
                    </div>

                    {/* Meta row */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                      <Badge>{selected.employment_type}</Badge>
                      <Badge color="#f9fafb" text="#6b7280">{selected.seniority_level}</Badge>
                      <Badge color="#f9fafb" text="#6b7280">{selected.industry}</Badge>
                      {salary(selected.salary_min, selected.salary_max) && (
                        <Badge color="#f0fdf4" text="#15803d">💰 {salary(selected.salary_min, selected.salary_max)} / yr</Badge>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleApply}
                        disabled={alreadyApplied || selected.status !== 'open' || applying}
                        style={{
                          flex: 1, height: 42,
                          background: alreadyApplied ? '#dcfce7' : selected.status !== 'open' ? '#e5e7eb' : applying ? '#3b82f6' : '#0a66c2',
                          color:      alreadyApplied ? '#15803d' : selected.status !== 'open' ? '#9ca3af' : 'white',
                          border: 'none', borderRadius: 999,
                          cursor: alreadyApplied || selected.status !== 'open' || applying ? 'not-allowed' : 'pointer',
                          fontWeight: 700, fontSize: 14, letterSpacing: '0.2px',
                          transition: 'background 0.2s',
                        }}>
                        {alreadyApplied ? '✓ Applied' : applying ? 'Submitting…' : selected.status !== 'open' ? 'Position Closed' : 'Apply'}
                      </button>

                      <button onClick={toggleSaved}
                        style={{
                          height: 42, padding: '0 16px', borderRadius: 999,
                          border: `1px solid ${isSaved ? '#0a66c2' : '#cbd5e1'}`,
                          color: isSaved ? '#0a66c2' : '#334155',
                          background: isSaved ? '#eff6ff' : '#fff',
                          fontWeight: 600, fontSize: 13, cursor: 'pointer',
                        }}>
                        {isSaved ? 'Saved' : 'Save'}
                      </button>
                    </div>
                  </div>
                  {/* Stats bar */}
                  <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9' }}>
                    {[
                      { label: 'Applicants', value: selected.applicants_count },
                      { label: 'Views',      value: selected.views_count },
                      { label: 'Posted',     value: timeAgo(selected.posted_at) },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ flex: 1, padding: '10px 0', textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{value}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: 24 }}>
                  {/* Skills */}
                  {selected.skills?.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <h4 style={{ margin: '0 0 10px', fontSize: 14, color: '#111', fontWeight: 600 }}>Required Skills</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {selected.skills.map(s => (
                          <span key={s} style={{
                            background: '#eff6ff', color: '#1e40af',
                            padding: '4px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                          }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <div style={{ marginBottom: 20 }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: 14, color: '#111', fontWeight: 600 }}>About the Role</h4>
                    <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
                      {selected.description}
                    </p>
                  </div>

                  {/* Inline error — shown right under the button so it's impossible to miss */}
                  {applyError && (
                    <div style={{
                      marginTop: 10, padding: '10px 14px', borderRadius: 6,
                      background: '#fef2f2', border: '1px solid #fecaca',
                      color: '#dc2626', fontSize: 13, fontWeight: 500,
                    }}>
                      ⚠ {applyError}
                    </div>
                  )}

                  {!member_id && (
                    <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, marginTop: 10 }}>
                      Sign in to apply for this position
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared style helpers ──────────────────────────────────────────────────────
function searchInputStyle(extra = {}) {
  return {
    width: '100%', padding: '10px 12px', border: '1px solid #dbe2ea',
    borderRadius: 999, fontSize: 14, boxSizing: 'border-box',
    outline: 'none', color: '#111', background: '#fafafa',
    ...extra,
  };
}

function selectStyle(extra = {}) {
  return {
    padding: '10px 12px', border: '1px solid #dbe2ea', borderRadius: 8,
    fontSize: 14, background: 'white', cursor: 'pointer', color: '#374151',
    minWidth: 120,
    ...extra,
  };
}

function chipStyle(active) {
  return {
    height: 34,
    padding: '0 12px',
    borderRadius: 999,
    border: `1px solid ${active ? '#93c5fd' : '#dbe2ea'}`,
    background: active ? '#eff6ff' : '#fff',
    color: active ? '#0a66c2' : '#475569',
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
  };
}
