import { useState, useEffect, useRef } from 'react';
import api from '../api/apiClient';
import { getMember, updateMember } from '../api/profileApi';
import { applicationsByMember } from '../api/applicationApi';
import { getMemberDashboard } from '../api/analyticsApi';

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function statusColor(s) {
  return { submitted:'#0a66c2', reviewing:'#f59e0b', interview:'#10b981',
           offer:'#22c55e', rejected:'#ef4444' }[s] || '#555';
}

function Avatar({ name, photo, size = 120 }) {
  if (photo) return (
    <img src={photo} alt="profile"
      style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover' }} />
  );
  const initials = (name||'U').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%',
      background:'linear-gradient(135deg,#0a66c2,#0891b2)',
      color:'white', display:'flex', alignItems:'center', justifyContent:'center',
      fontWeight:700, fontSize:size*0.35,
    }}>{initials}</div>
  );
}

// ─────────────────────────────────────────────
//  MODAL
// ─────────────────────────────────────────────
function Modal({ title, onClose, onSave, children, saveLabel='Save' }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  zIndex:1000, padding:16 }}>
      <div style={{ background:'white', borderRadius:12, width:'100%', maxWidth:580,
                    maxHeight:'90vh', overflowY:'auto',
                    boxShadow:'0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                      padding:'18px 24px', borderBottom:'1px solid #e5e7eb' }}>
          <h3 style={{ margin:0, fontSize:18, fontWeight:700 }}>{title}</h3>
          <button onClick={onClose}
            style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#6b7280' }}>×</button>
        </div>
        <div style={{ padding:'20px 24px' }}>{children}</div>
        <div style={{ padding:'12px 24px', borderTop:'1px solid #e5e7eb',
                      display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose}
            style={{ padding:'8px 20px', border:'1.5px solid #d1d5db', background:'white',
                     borderRadius:20, cursor:'pointer', fontWeight:600, fontSize:14 }}>Cancel</button>
          <button onClick={onSave}
            style={{ padding:'8px 24px', background:'#0a66c2', color:'white',
                     border:'none', borderRadius:20, cursor:'pointer', fontWeight:700, fontSize:14 }}>
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type='text', placeholder, multiline, rows=4 }) {
  const s = { width:'100%', padding:'10px 12px', border:'1.5px solid #d1d5db',
               borderRadius:6, fontSize:14, boxSizing:'border-box', marginTop:4,
               fontFamily:'inherit', resize: multiline?'vertical':undefined };
  return (
    <div style={{ marginBottom:16 }}>
      {label && <label style={{ fontSize:13, fontWeight:600, color:'#374151' }}>{label}</label>}
      {multiline
        ? <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} style={s}/>
        : <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={s}/>}
    </div>
  );
}

function Card({ children, style: extra }) {
  return (
    <div style={{ background:'white', borderRadius:10, border:'1px solid #e5e7eb',
                  boxShadow:'0 1px 3px rgba(0,0,0,0.05)', marginBottom:12, ...extra }}>
      {children}
    </div>
  );
}

function SectionHeader({ title, onAdd, onEdit }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'18px 20px 0' }}>
      <h3 style={{ margin:0, fontSize:17, fontWeight:700, color:'#111' }}>{title}</h3>
      <div style={{ display:'flex', gap:4 }}>
        {onAdd  && <button onClick={onAdd}  style={iconBtn()}>＋</button>}
        {onEdit && <button onClick={onEdit} style={iconBtn()}>✏️</button>}
      </div>
    </div>
  );
}

function iconBtn() {
  return { background:'none', border:'none', fontSize:18, cursor:'pointer',
           color:'#444', padding:'2px 8px', borderRadius:4 };
}

// ─────────────────────────────────────────────
//  SKILLS — popular suggestions
// ─────────────────────────────────────────────
const SKILL_SUGGESTIONS = [
  'Python','JavaScript','TypeScript','Java','Go','React','Node.js','SQL',
  'Docker','Kubernetes','AWS','Azure','Machine Learning','TensorFlow',
  'Kafka','Redis','MongoDB','PostgreSQL','REST','GraphQL','CI/CD','Terraform',
];

// ─────────────────────────────────────────────
//  MAIN PROFILE PAGE
// ─────────────────────────────────────────────
export default function ProfilePage() {
  const member_id = localStorage.getItem('member_id') || '';

  // User-scoped localStorage keys — prevents data leaking between accounts on the same browser
  const photoKey  = `profile_photo_${member_id}`;
  const colorKey  = `cover_color_${member_id}`;
  const expKey    = `exp_${member_id}`;
  const eduKey    = `edu_${member_id}`;
  const openToKey = `open_to_work_${member_id}`;

  const [profile,     setProfile]    = useState(null);
  const [skills,      setSkills]     = useState([]);
  const [apps,        setApps]       = useState([]);
  const [connCount,   setConnCount]  = useState(0);
  const [memberMetrics, setMemberMetrics] = useState(null);
  const [toast,       setToast]      = useState({ text:'', type:'success' });

  // local-only (localStorage)
  const [photo,      setPhoto]      = useState(() => localStorage.getItem(photoKey) || '');
  const [coverColor, setCoverColor] = useState(() => localStorage.getItem(colorKey) || '#1e3a5f');
  const [experience, setExperience] = useState(() => { try { return JSON.parse(localStorage.getItem(expKey)||'[]'); } catch { return []; } });
  const [education,  setEducation]  = useState(() => { try { return JSON.parse(localStorage.getItem(eduKey)||'[]'); } catch { return []; } });
  const [openToWork, setOpenToWork] = useState(() => localStorage.getItem(openToKey) === 'true');

  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState({});
  const [newSkill, setNewSkill] = useState('');
  const [addSectionOpen, setAddSectionOpen] = useState(false);

  const photoRef = useRef();

  // ── Load data ──
  useEffect(() => {
    if (!member_id) return;
    getMember(member_id).then(r => {
      setProfile(r.data);
      setSkills(r.data.skills || []);
    }).catch(() => {});
    applicationsByMember(member_id).then(r => setApps(r.data.results || [])).catch(() => {});
    getMemberDashboard(member_id).then(r => setMemberMetrics(r.data)).catch(() => {});
    // Load real connection count from connections table
    api.post('/connections/list', { user_id: member_id, limit: 500 })
      .then(r => setConnCount((r.data.results || []).length))
      .catch(() => {});
  }, [member_id]);

  const showToast = (text, type='success') => {
    setToast({ text, type });
    setTimeout(() => setToast({ text:'', type:'success' }), 3000);
  };

  // ── Save profile fields to API ──
  const saveProfile = async (fields) => {
    try {
      await updateMember({ member_id, ...fields });
      setProfile(p => ({ ...p, ...fields }));
      showToast('Profile updated!');
    } catch { showToast('Update failed. Try again.', 'error'); }
  };

  const open  = (name, init={}) => { setModal(name); setDraft(init); };
  const close = () => setModal(null);

  // ── Photo upload ──
  const handlePhoto = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setPhoto(ev.target.result);
      localStorage.setItem(photoKey, ev.target.result);
      showToast('Photo updated!');
    };
    reader.readAsDataURL(file);
  };

  // ── Skills ──
  const handleAddSkill = async (skill) => {
    const s = (skill || newSkill).trim();
    if (!s || skills.includes(s)) return;
    try {
      await api.post('/members/skills/add', { member_id, skill: s });
      setSkills(prev => [...prev, s]);
      setNewSkill('');
      showToast(`"${s}" added to skills!`);
    } catch { showToast('Failed to add skill', 'error'); }
  };

  const handleRemoveSkill = async (skill) => {
    try {
      await api.post('/members/skills/remove', { member_id, skill });
      setSkills(prev => prev.filter(s => s !== skill));
      showToast(`"${skill}" removed`);
    } catch { showToast('Failed to remove skill', 'error'); }
  };

  // ── Experience ──
  const saveExp = (list) => { setExperience(list); localStorage.setItem(expKey, JSON.stringify(list)); };
  const deleteExp = (i) => saveExp(experience.filter((_,idx)=>idx!==i));

  // ── Education ──
  const saveEdu = (list) => { setEducation(list); localStorage.setItem(eduKey, JSON.stringify(list)); };
  const deleteEdu = (i) => saveEdu(education.filter((_,idx)=>idx!==i));

  // ── Delete account ──
  const handleDelete = async () => {
    try {
      await api.post('/members/delete', { member_id });
      ['member_id','recruiter_id','user_name','role', photoKey, colorKey, expKey, eduKey, openToKey]
        .forEach(k => localStorage.removeItem(k));
      window.location.reload();
    } catch { showToast('Delete failed', 'error'); }
  };

  if (!member_id) return <div style={{ textAlign:'center', padding:40, color:'#6b7280' }}>Please sign in.</div>;
  if (!profile)   return <div style={{ textAlign:'center', padding:60, color:'#6b7280' }}>Loading profile…</div>;

  const fullName = `${profile.first_name} ${profile.last_name}`;
  const location = [profile.city, profile.state, profile.country].filter(Boolean).join(', ');
  const profileViewsTotal = (memberMetrics?.profile_views || []).reduce((sum, row) => sum + (row.views || 0), 0);
  const appBreakdown = memberMetrics?.application_status_breakdown || [];
  const activeApplicationCount = appBreakdown
    .filter(row => ['submitted', 'reviewing', 'interview'].includes(row.status))
    .reduce((sum, row) => sum + row.count, 0);


  return (
    <div style={{ maxWidth:860, margin:'0 auto' }}>

      {/* ── Toast ── */}
      {toast.text && (
        <div style={{
          position:'fixed', top:70, right:24, zIndex:2000,
          background: toast.type==='error' ? '#fef2f2' : '#f0fdf4',
          border:`1px solid ${toast.type==='error'?'#fecaca':'#bbf7d0'}`,
          color: toast.type==='error'?'#dc2626':'#15803d',
          padding:'12px 20px', borderRadius:8, fontSize:14,
          boxShadow:'0 4px 12px rgba(0,0,0,0.1)',
        }}>
          {toast.type==='error'?'⚠ ':'✓ '}{toast.text}
        </div>
      )}

      {/* ════ CARD 1: Cover + Avatar + Info ════ */}
      <Card>
        {/* Cover */}
        <div style={{ height:180, background:coverColor, borderRadius:'10px 10px 0 0', position:'relative' }}>
          <div style={{ position:'absolute', right:12, bottom:12, display:'flex', gap:8 }}>
            <button onClick={() => open('cover')}
              style={{ background:'rgba(255,255,255,0.85)', border:'none', borderRadius:6,
                       padding:'6px 12px', cursor:'pointer', fontSize:12, fontWeight:600 }}>
              🎨 Cover color
            </button>
          </div>
        </div>

        <div style={{ padding:'0 24px 20px', position:'relative' }}>
          {/* Avatar */}
          <div style={{ position:'absolute', top:-60, left:20 }}>
            <div style={{ position:'relative', display:'inline-block' }}>
              <div style={{ borderRadius:'50%', border:'4px solid white', overflow:'hidden', width:120, height:120 }}>
                <Avatar name={fullName} photo={photo} size={120} />
              </div>
              <button onClick={() => open('photo')}
                style={{ position:'absolute', bottom:4, right:4, background:'white',
                         border:'2px solid #e5e7eb', borderRadius:'50%', width:30, height:30,
                         display:'flex', alignItems:'center', justifyContent:'center',
                         cursor:'pointer', fontSize:14, boxShadow:'0 1px 4px rgba(0,0,0,0.15)' }}>
                📷
              </button>
              <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display:'none' }} />
            </div>
          </div>

          {/* Top-right buttons */}
          <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:12, gap:8 }}>
            <button onClick={() => open('intro', {
                first_name:profile.first_name, last_name:profile.last_name,
                headline:profile.headline||'', city:profile.city||'',
                state:profile.state||'', country:profile.country||'', phone:profile.phone||'',
              })}
              style={{ background:'none', border:'1.5px solid #d1d5db', borderRadius:20,
                       padding:'6px 16px', cursor:'pointer', fontSize:14, fontWeight:600 }}>
              ✏️ Edit intro
            </button>
          </div>

          {/* Name & headline */}
          <div style={{ marginTop:52 }}>
            <h2 style={{ margin:'0 0 4px', fontSize:24, fontWeight:700 }}>{fullName}</h2>
            <p style={{ margin:'0 0 8px', fontSize:16, color:'#374151' }}>
              {profile.headline || <span style={{ color:'#9ca3af', fontStyle:'italic' }}>Add a headline</span>}
            </p>

            {/* Recent exp / edu logos — only show if company/school is filled in */}
            {(experience.some(e=>e.company) || education.some(e=>e.school)) && (
              <div style={{ display:'flex', gap:16, marginBottom:8 }}>
                {experience.filter(e=>e.company).slice(0,1).map((e,i) => (
                  <span key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:14 }}>
                    <span style={{ width:20, height:20, background:'#0a66c2', borderRadius:3,
                                   display:'inline-flex', alignItems:'center', justifyContent:'center',
                                   color:'white', fontSize:10, fontWeight:700 }}>{e.company[0].toUpperCase()}</span>
                    {e.company}
                  </span>
                ))}
                {education.filter(e=>e.school).slice(0,1).map((e,i) => (
                  <span key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:14 }}>
                    <span style={{ width:20, height:20, background:'#7c3aed', borderRadius:3,
                                   display:'inline-flex', alignItems:'center', justifyContent:'center',
                                   color:'white', fontSize:10, fontWeight:700 }}>{e.school[0].toUpperCase()}</span>
                    {e.school}
                  </span>
                ))}
              </div>
            )}

            {location && <p style={{ margin:'0 0 4px', fontSize:14, color:'#6b7280' }}>📍 {location}</p>}
            <p style={{ margin:'0 0 16px', fontSize:14 }}>
              <span style={{ color:'#0a66c2', fontWeight:600 }}>{connCount} connections</span>
            </p>

            {/* Action buttons */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', position:'relative' }}>
              <button onClick={() => { const next = !openToWork; setOpenToWork(next); localStorage.setItem(openToKey, String(next)); showToast(next ? 'Open to work enabled' : 'Open to work disabled'); }}
                style={{ padding:'7px 16px', borderRadius:20, background: openToWork ? '#0a66c2' : 'white',
                         color: openToWork ? 'white' : '#0a66c2', border: openToWork ? 'none' : '1.5px solid #0a66c2',
                         fontWeight:600, fontSize:14, cursor:'pointer' }}>
                {openToWork ? '✓ Open to work' : 'Open to work'}
              </button>

              {/* Add section dropdown */}
              <div style={{ position:'relative' }}>
                <button onClick={() => setAddSectionOpen(o => !o)}
                  style={{ padding:'7px 16px', borderRadius:20, background:'white',
                           color:'#0a66c2', border:'1.5px solid #0a66c2',
                           fontWeight:600, fontSize:14, cursor:'pointer' }}>
                  Add section ▾
                </button>
                {addSectionOpen && (
                  <div style={{ position:'absolute', top:38, left:0, background:'white',
                                border:'1px solid #e5e7eb', borderRadius:8, zIndex:100,
                                boxShadow:'0 4px 16px rgba(0,0,0,0.12)', minWidth:200 }}>
                    {[
                      ['About',      () => open('about', { about:profile.about||'' })],
                      ['Experience', () => open('exp-add', { company:'',title:'',startDate:'',endDate:'',location:'',description:'',current:false })],
                      ['Education',  () => open('edu-add', { school:'',degree:'',field:'',startDate:'',endDate:'',description:'' })],
                      ['Skills',     () => open('skills')],
                    ].map(([label, action]) => (
                      <button key={label} onClick={() => { action(); setAddSectionOpen(false); }}
                        style={{ display:'block', width:'100%', padding:'10px 16px', background:'none',
                                 border:'none', textAlign:'left', cursor:'pointer', fontSize:14,
                                 color:'#111', borderBottom:'1px solid #f3f4f6' }}>
                        + {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={() => open('delete')}
                style={{ padding:'7px 16px', borderRadius:20, background:'white',
                         color:'#dc2626', border:'1.5px solid #dc2626',
                         fontWeight:600, fontSize:14, cursor:'pointer' }}>
                Delete account
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* ════ CARD 2: Analytics ════ */}
      <Card>
        <div style={{ padding:'16px 20px 8px' }}>
          <h3 style={{ margin:'0 0 4px', fontSize:17, fontWeight:700 }}>Analytics</h3>
          <p style={{ margin:'0 0 14px', fontSize:13, color:'#6b7280' }}>Private to you</p>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            {[
              { icon:'👥', value: profileViewsTotal,      label:'profile views',       sub:'Past 30 days' },
              { icon:'📊', value: apps.length,            label:'applications sent',   sub:'All time' },
              { icon:'⏳', value: activeApplicationCount, label:'active applications', sub:'Submitted / reviewing / interview' },
            ].map(({ icon, value, label, sub }) => (
              <div key={label} style={{ flex:1, minWidth:140, padding:'12px 16px',
                                        background:'#f9fafb', borderRadius:8 }}>
                <div style={{ fontSize:22, marginBottom:6 }}>{icon}</div>
                <div style={{ fontWeight:700, fontSize:20, color:'#111' }}>{value}</div>
                <div style={{ fontSize:13, color:'#374151' }}>{label}</div>
                <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ textAlign:'center', padding:'10px 0 14px' }}>
          <a href="/analytics" style={{ color:'#0a66c2', fontSize:13, fontWeight:600, textDecoration:'none' }}>Show all analytics →</a>
        </div>
      </Card>

      {/* ════ CARD 3: About ════ */}
      <Card>
        <SectionHeader title="About" onEdit={() => open('about', { about:profile.about||'' })} />
        <div style={{ padding:'12px 20px 20px' }}>
          {profile.about
            ? <p style={{ margin:0, color:'#374151', fontSize:14, lineHeight:1.7, whiteSpace:'pre-wrap' }}>{profile.about}</p>
            : <p style={{ margin:0, color:'#9ca3af', fontSize:14, fontStyle:'italic', cursor:'pointer' }}
                 onClick={() => open('about', { about:'' })}>
                Click to add an About section…
              </p>}
        </div>
      </Card>

      {/* ════ CARD 4: Experience ════ */}
      <Card>
        <SectionHeader title="Experience"
          onAdd={() => open('exp-add', { company:'',title:'',startDate:'',endDate:'',location:'',description:'',current:false })} />
        <div style={{ padding:'4px 20px 16px' }}>
          {experience.length === 0 && (
            <p style={{ color:'#9ca3af', fontSize:14, fontStyle:'italic', margin:'12px 0 0' }}>
              Add your work experience.
            </p>
          )}
          {experience.map((exp, i) => (
            <div key={i} style={{ display:'flex', gap:14, paddingTop:16,
                                   borderTop: i>0?'1px solid #f3f4f6':'none' }}>
              <div style={{ width:48, height:48, borderRadius:8, flexShrink:0, background:'#0a66c2',
                             color:'white', display:'flex', alignItems:'center', justifyContent:'center',
                             fontWeight:700, fontSize:20 }}>
                {(exp.company||'?')[0].toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:15 }}>{exp.title}</div>
                    <div style={{ color:'#374151', fontSize:14 }}>{exp.company}</div>
                    <div style={{ color:'#6b7280', fontSize:13 }}>
                      {exp.startDate} – {exp.current?'Present':exp.endDate||'Present'}
                      {exp.location?` · ${exp.location}`:''}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:4 }}>
                    <button onClick={() => open(`exp-edit-${i}`, {...exp})} style={iconBtn()}>✏️</button>
                    <button onClick={() => deleteExp(i)} style={{ ...iconBtn(), color:'#dc2626' }}>🗑</button>
                  </div>
                </div>
                {exp.description && <p style={{ margin:'6px 0 0', fontSize:13, color:'#6b7280' }}>{exp.description}</p>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ════ CARD 5: Education ════ */}
      <Card>
        <SectionHeader title="Education"
          onAdd={() => open('edu-add', { school:'',degree:'',field:'',startDate:'',endDate:'',description:'' })} />
        <div style={{ padding:'4px 20px 16px' }}>
          {education.length === 0 && (
            <p style={{ color:'#9ca3af', fontSize:14, fontStyle:'italic', margin:'12px 0 0' }}>
              Add your education history.
            </p>
          )}
          {education.map((edu, i) => (
            <div key={i} style={{ display:'flex', gap:14, paddingTop:16,
                                   borderTop: i>0?'1px solid #f3f4f6':'none' }}>
              <div style={{ width:48, height:48, borderRadius:8, flexShrink:0, background:'#7c3aed',
                             color:'white', display:'flex', alignItems:'center', justifyContent:'center',
                             fontWeight:700, fontSize:20 }}>
                {(edu.school||'?')[0].toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:15 }}>{edu.school}</div>
                    <div style={{ color:'#374151', fontSize:14 }}>{edu.degree}{edu.field?`, ${edu.field}`:''}</div>
                    <div style={{ color:'#6b7280', fontSize:13 }}>{edu.startDate} – {edu.endDate||'Present'}</div>
                  </div>
                  <div style={{ display:'flex', gap:4 }}>
                    <button onClick={() => open(`edu-edit-${i}`, {...edu})} style={iconBtn()}>✏️</button>
                    <button onClick={() => deleteEdu(i)} style={{ ...iconBtn(), color:'#dc2626' }}>🗑</button>
                  </div>
                </div>
                {edu.description && <p style={{ margin:'6px 0 0', fontSize:13, color:'#6b7280' }}>{edu.description}</p>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ════ CARD 6: Skills ════ */}
      <Card>
        <SectionHeader title="Skills" onAdd={() => open('skills')} />
        <div style={{ padding:'12px 20px 20px' }}>
          {skills.length === 0 && (
            <p style={{ color:'#9ca3af', fontSize:14, fontStyle:'italic', margin:0 }}>
              Add skills to show recruiters what you know.
            </p>
          )}
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {skills.map(s => (
              <span key={s} style={{ display:'flex', alignItems:'center', gap:4,
                                      background:'#eff6ff', color:'#1e40af',
                                      padding:'5px 12px', borderRadius:20, fontSize:13, fontWeight:500 }}>
                {s}
                <button onClick={() => handleRemoveSkill(s)}
                  style={{ background:'none', border:'none', cursor:'pointer',
                            color:'#6b7280', fontSize:14, lineHeight:1, padding:0 }}>×</button>
              </span>
            ))}
          </div>
        </div>
      </Card>

      {/* ════ CARD 7: Contact Info ════ */}
      <Card>
        <SectionHeader title="Contact Info" onEdit={() => open('intro', {
          first_name:profile.first_name, last_name:profile.last_name,
          headline:profile.headline||'', city:profile.city||'',
          state:profile.state||'', country:profile.country||'', phone:profile.phone||'',
        })} />
        <div style={{ padding:'12px 20px 20px' }}>
          {[
            { icon:'✉️', label:'Email',    value: profile.email },
            { icon:'📞', label:'Phone',    value: profile.phone    || <span style={{color:'#9ca3af',fontStyle:'italic'}}>Not added</span> },
            { icon:'📍', label:'Location', value: location         || <span style={{color:'#9ca3af',fontStyle:'italic'}}>Not added</span> },
            { icon:'🏷️', label:'Member ID',value: <span style={{fontSize:12,color:'#9ca3af',fontFamily:'monospace'}}>{member_id}</span> },
          ].map(({ icon, label, value }) => (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:14,
                                       padding:'10px 0', borderBottom:'1px solid #f3f4f6' }}>
              <span style={{ fontSize:20, width:28, textAlign:'center' }}>{icon}</span>
              <div>
                <div style={{ fontSize:12, color:'#9ca3af', fontWeight:500 }}>{label}</div>
                <div style={{ fontSize:14, color:'#111', fontWeight:500, marginTop:1 }}>{value}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ════ CARD 8: Applications ════ */}
      {apps.length > 0 && (
        <Card>
          <SectionHeader title={`My Applications (${apps.length})`} />
          <div style={{ padding:'4px 20px 16px' }}>
            {apps.map((a, i) => (
              <div key={a.application_id} style={{ display:'flex', justifyContent:'space-between',
                                                    alignItems:'center', padding:'12px 0',
                                                    borderTop: i>0?'1px solid #f3f4f6':'none' }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:14 }}>{a.job_title || a.job_id}</div>
                  <div style={{ fontSize:13, color:'#6b7280' }}>
                    Applied {new Date(a.applied_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                  </div>
                </div>
                <span style={{ background:`${statusColor(a.status)}20`, color:statusColor(a.status),
                                padding:'4px 12px', borderRadius:12, fontSize:13, fontWeight:600 }}>
                  {a.status.charAt(0).toUpperCase()+a.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ════════════ MODALS ════════════ */}

      {/* Edit Intro */}
      {modal === 'intro' && (
        <Modal title="Edit intro" onClose={close} onSave={async () => {
          await saveProfile({ first_name:draft.first_name, last_name:draft.last_name,
            headline:draft.headline, city:draft.city, state:draft.state,
            country:draft.country, phone:draft.phone });
          close();
        }}>
          <div style={{ display:'flex', gap:12 }}>
            <Field label="First name" value={draft.first_name||''} onChange={v=>setDraft(d=>({...d,first_name:v}))} />
            <Field label="Last name"  value={draft.last_name||''}  onChange={v=>setDraft(d=>({...d,last_name:v}))} />
          </div>
          <Field label="Headline" value={draft.headline||''} onChange={v=>setDraft(d=>({...d,headline:v}))} placeholder="e.g. MS in Data Intelligence @SJSU" />
          <Field label="Phone" type="tel" value={draft.phone||''} onChange={v=>setDraft(d=>({...d,phone:v}))} placeholder="+1 408-000-0000" />
          <div style={{ display:'flex', gap:12 }}>
            <Field label="City"    value={draft.city||''}    onChange={v=>setDraft(d=>({...d,city:v}))}    placeholder="San Jose" />
            <Field label="State"   value={draft.state||''}   onChange={v=>setDraft(d=>({...d,state:v}))}   placeholder="CA" />
            <Field label="Country" value={draft.country||''} onChange={v=>setDraft(d=>({...d,country:v}))} placeholder="USA" />
          </div>
        </Modal>
      )}

      {/* Edit About */}
      {modal === 'about' && (
        <Modal title="Edit About" onClose={close} onSave={async () => {
          await saveProfile({ about: draft.about });
          close();
        }}>
          <Field label="About" multiline rows={7} value={draft.about||''}
            onChange={v=>setDraft(d=>({...d,about:v}))}
            placeholder="Tell people about your background, skills, and interests…" />
        </Modal>
      )}

      {/* Add/Edit Skills */}
      {modal === 'skills' && (
        <Modal title="Add Skills" onClose={close} onSave={close} saveLabel="Done">
          {/* Type custom skill */}
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            <input value={newSkill} onChange={e=>setNewSkill(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handleAddSkill()}
              placeholder="Type a skill and press Enter or Add"
              style={{ flex:1, padding:'10px 12px', border:'1.5px solid #d1d5db',
                       borderRadius:6, fontSize:14 }} />
            <button onClick={() => handleAddSkill()}
              style={{ padding:'10px 18px', background:'#0a66c2', color:'white',
                       border:'none', borderRadius:6, cursor:'pointer', fontWeight:600 }}>
              Add
            </button>
          </div>

          {/* Current skills */}
          {skills.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <p style={{ fontSize:13, fontWeight:600, color:'#374151', margin:'0 0 8px' }}>Your skills:</p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {skills.map(s => (
                  <span key={s} style={{ display:'flex', alignItems:'center', gap:4,
                                          background:'#eff6ff', color:'#1e40af',
                                          padding:'5px 12px', borderRadius:20, fontSize:13 }}>
                    {s}
                    <button onClick={()=>handleRemoveSkill(s)}
                      style={{ background:'none',border:'none',cursor:'pointer',color:'#6b7280',fontSize:14 }}>×</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          <p style={{ fontSize:13, fontWeight:600, color:'#374151', margin:'0 0 8px' }}>Suggestions:</p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {SKILL_SUGGESTIONS.filter(s=>!skills.includes(s)).map(s => (
              <button key={s} onClick={()=>handleAddSkill(s)}
                style={{ padding:'5px 12px', borderRadius:20, border:'1.5px solid #0a66c2',
                          background:'white', color:'#0a66c2', cursor:'pointer', fontSize:13, fontWeight:500 }}>
                + {s}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Add Experience */}
      {modal === 'exp-add' && (
        <Modal title="Add Experience" onClose={close} onSave={() => { saveExp([...experience,draft]); close(); }}>
          <ExpForm draft={draft} setDraft={setDraft} />
        </Modal>
      )}

      {/* Edit Experience */}
      {modal?.startsWith('exp-edit-') && (() => {
        const idx = parseInt(modal.split('-')[2]);
        return (
          <Modal title="Edit Experience" onClose={close} onSave={() => {
            const l=[...experience]; l[idx]=draft; saveExp(l); close();
          }}>
            <ExpForm draft={draft} setDraft={setDraft} />
          </Modal>
        );
      })()}

      {/* Add Education */}
      {modal === 'edu-add' && (
        <Modal title="Add Education" onClose={close} onSave={() => { saveEdu([...education,draft]); close(); }}>
          <EduForm draft={draft} setDraft={setDraft} />
        </Modal>
      )}

      {/* Edit Education */}
      {modal?.startsWith('edu-edit-') && (() => {
        const idx = parseInt(modal.split('-')[2]);
        return (
          <Modal title="Edit Education" onClose={close} onSave={() => {
            const l=[...education]; l[idx]=draft; saveEdu(l); close();
          }}>
            <EduForm draft={draft} setDraft={setDraft} />
          </Modal>
        );
      })()}

      {/* Photo modal — change or remove */}
      {modal === 'photo' && (
        <Modal title="Profile Photo" onClose={close} onSave={close} saveLabel="Done">
          <div style={{ textAlign:'center', marginBottom:24 }}>
            <div style={{ display:'inline-block', borderRadius:'50%', overflow:'hidden',
                          width:120, height:120, border:'3px solid #e5e7eb', marginBottom:16 }}>
              <Avatar name={fullName} photo={photo} size={120} />
            </div>
            <p style={{ fontSize:14, color:'#6b7280', margin:0 }}>
              {photo ? 'Your current profile photo' : 'No photo — showing initials'}
            </p>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <button onClick={() => { photoRef.current?.click(); close(); }}
              style={{ padding:'12px', border:'1.5px solid #0a66c2', borderRadius:8,
                       background:'white', color:'#0a66c2', cursor:'pointer',
                       fontWeight:600, fontSize:14 }}>
              📷 Upload new photo
            </button>

            {photo && (
              <button onClick={() => {
                setPhoto('');
                localStorage.removeItem(photoKey);
                showToast('Profile photo removed');
                close();
              }}
                style={{ padding:'12px', border:'1.5px solid #dc2626', borderRadius:8,
                         background:'white', color:'#dc2626', cursor:'pointer',
                         fontWeight:600, fontSize:14 }}>
                🗑 Remove photo
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Cover color picker */}
      {modal === 'cover' && (
        <Modal title="Choose cover color" onClose={close} onSave={close} saveLabel="Done">
          <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
            {['#1e3a5f','#0a66c2','#1a1a2e','#0f3460','#1b4332','#6b21a8',
              '#be123c','#92400e','#374151','#0891b2','#059669','#7c3aed',
              '#c2410c','#1d4ed8','#065f46'].map(c => (
              <button key={c} onClick={() => { setCoverColor(c); localStorage.setItem(colorKey,c); }}
                style={{ width:48, height:48, borderRadius:8, background:c, cursor:'pointer',
                          border: coverColor===c?'3px solid white':'2px solid transparent',
                          boxShadow: coverColor===c?'0 0 0 3px #0a66c2':'none' }} />
            ))}
          </div>
        </Modal>
      )}

      {/* Delete account */}
      {modal === 'delete' && (
        <Modal title="Delete Account" onClose={close} onSave={handleDelete} saveLabel="Yes, Delete">
          <div style={{ textAlign:'center', padding:'10px 0' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>⚠️</div>
            <p style={{ fontSize:16, fontWeight:600, color:'#111', marginBottom:8 }}>
              Are you sure you want to delete your account?
            </p>
            <p style={{ fontSize:14, color:'#6b7280' }}>
              This cannot be undone. All your data will be permanently removed.
            </p>
          </div>
        </Modal>
      )}

    </div>
  );
}

// ─────────────────────────────────────────────
//  EXPERIENCE FORM
// ─────────────────────────────────────────────
function ExpForm({ draft, setDraft }) {
  const set = (k,v) => setDraft(d=>({...d,[k]:v}));
  return (
    <>
      <Field label="Job Title"  value={draft.title||''}    onChange={v=>set('title',v)}    placeholder="e.g. Software Engineer" />
      <Field label="Company"    value={draft.company||''}  onChange={v=>set('company',v)}  placeholder="e.g. Google" />
      <Field label="Location"   value={draft.location||''} onChange={v=>set('location',v)} placeholder="e.g. San Francisco, CA" />
      <div style={{ display:'flex', gap:12 }}>
        <Field label="Start Date" value={draft.startDate||''} onChange={v=>set('startDate',v)} placeholder="Jan 2023" />
        <Field label="End Date"   value={draft.endDate||''}   onChange={v=>set('endDate',v)}   placeholder="Dec 2024" />
      </div>
      <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14, marginBottom:16 }}>
        <input type="checkbox" checked={draft.current||false} onChange={e=>set('current',e.target.checked)} />
        I currently work here
      </label>
      <Field label="Description (optional)" multiline rows={3} value={draft.description||''}
        onChange={v=>set('description',v)} placeholder="Key responsibilities and achievements…" />
    </>
  );
}

// ─────────────────────────────────────────────
//  EDUCATION FORM
// ─────────────────────────────────────────────
function EduForm({ draft, setDraft }) {
  const set = (k,v) => setDraft(d=>({...d,[k]:v}));
  return (
    <>
      <Field label="School / University" value={draft.school||''} onChange={v=>set('school',v)} placeholder="e.g. San José State University" />
      <Field label="Degree"              value={draft.degree||''} onChange={v=>set('degree',v)} placeholder="e.g. Master's degree" />
      <Field label="Field of study"      value={draft.field||''}  onChange={v=>set('field',v)}  placeholder="e.g. Data Science" />
      <div style={{ display:'flex', gap:12 }}>
        <Field label="Start" value={draft.startDate||''} onChange={v=>set('startDate',v)} placeholder="Jan 2025" />
        <Field label="End"   value={draft.endDate||''}   onChange={v=>set('endDate',v)}   placeholder="Aug 2027" />
      </div>
      <Field label="Description (optional)" multiline rows={3} value={draft.description||''}
        onChange={v=>set('description',v)} placeholder="Activities, awards, GPA…" />
    </>
  );
}
