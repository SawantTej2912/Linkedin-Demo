import { useState } from 'react';
import api from '../api/apiClient';

// ─────────────────────────────────────────────
//  VALIDATION HELPERS
// ─────────────────────────────────────────────
function validateName(value, label) {
  if (!value || value.trim() === '') return `${label} is required`;
  if (!/^[a-zA-Z]/.test(value))      return `${label} must start with a letter`;
  if (!/^[a-zA-Z\s]+$/.test(value))  return `${label} can only contain letters`;
  return '';
}

function validateEmail(value) {
  if (!value || value.trim() === '')  return 'Email is required';
  if (!/^[a-zA-Z]/.test(value))      return 'Email must start with a letter';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address';
  return '';
}

function validatePassword(value) {
  if (!value)               return 'Password is required';
  if (value.length < 8)     return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(value)) return 'Must contain an uppercase letter (A-Z)';
  if (!/[a-z]/.test(value)) return 'Must contain a lowercase letter (a-z)';
  if (!/[0-9]/.test(value)) return 'Must contain a number (0-9)';
  if (!/[!@#$%^&*(),.?":{}|<>_\-+=]/.test(value)) return 'Must contain a special character';
  return '';
}

// ─────────────────────────────────────────────
//  PASSWORD STRENGTH BAR (5 rules)
// ─────────────────────────────────────────────
function PasswordStrengthBar({ password }) {
  if (!password) return null;
  let score = 0;
  if (password.length >= 8)   score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>_\-+=]/.test(password)) score++;

  const labels = ['','Weak','Fair','Good','Strong','Very Strong'];
  const colors = ['','#ef4444','#f59e0b','#3b82f6','#22c55e','#16a34a'];
  const s = Math.min(score, 5);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ flex:1, height:3, borderRadius:2,
            background: i <= score ? colors[s] : '#e5e7eb', transition:'background 0.3s' }} />
        ))}
      </div>
      <p style={{ fontSize:11, color:colors[s], margin:0, fontWeight:600 }}>{labels[s]}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
//  SHARED INPUT COMPONENT
// ─────────────────────────────────────────────
function Input({ label, type='text', value, onChange, error, placeholder, rightEl }) {
  return (
    <div style={{ marginBottom: error ? 6 : 16 }}>
      {label && <label style={{ display:'block', fontSize:14, color:'#333', marginBottom:6, fontWeight:500 }}>{label}</label>}
      <div style={{ position:'relative' }}>
        <input
          type={type} value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width:'100%', padding:'14px 16px',
            border: `1.5px solid ${error ? '#dc2626' : '#c9cacb'}`,
            borderRadius:4, fontSize:16, boxSizing:'border-box',
            outline:'none', color:'#111', background:'white',
            paddingRight: rightEl ? 48 : 16,
          }}
        />
        {rightEl && (
          <div style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', cursor:'pointer', color:'#666' }}>
            {rightEl}
          </div>
        )}
      </div>
      {error && <p style={{ margin:'4px 0 10px', fontSize:12, color:'#dc2626' }}>⚠ {error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────
//  DIVIDER  ── or ──
// ─────────────────────────────────────────────
function Divider() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, margin:'20px 0' }}>
      <div style={{ flex:1, height:1, background:'#e0e0e0' }} />
      <span style={{ color:'#666', fontSize:14, fontWeight:500 }}>or</span>
      <div style={{ flex:1, height:1, background:'#e0e0e0' }} />
    </div>
  );
}

// ─────────────────────────────────────────────
//  BRAND MARK
// ─────────────────────────────────────────────
function LinkedInLogo({ size = 34 }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <span style={{
        width:size, height:size, borderRadius:6, background:'linear-gradient(135deg,#0a66c2,#3b82f6)', color:'white',
        fontWeight:800, fontSize:size * 0.45, display:'inline-flex', alignItems:'center', justifyContent:'center',
        letterSpacing:'-0.5px'
      }}>in</span>
      <span style={{ color:'#0a66c2', fontWeight:700, fontSize:size * 0.62 }}>LinkedIn DS</span>
    </div>
  );
}


// ─────────────────────────────────────────────
//  MAIN LOGIN PAGE
// ─────────────────────────────────────────────
export default function LoginPage({ onLogin }) {
  // 'signin' | 'signup' | 'recruiter'
  const [mode, setMode] = useState('signin');

  // Field values
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [firstName,   setFirstName]   = useState('');
  const [lastName,    setLastName]    = useState('');
  const [headline,    setHeadline]    = useState('');
  const [city,        setCity]        = useState('');
  const [keepSigned,  setKeepSigned]  = useState(true);
  const [showPwd,     setShowPwd]     = useState(false);

  // Errors
  const [errors,      setErrors]      = useState({});
  const [serverError, setServerError] = useState('');
  const [loading,     setLoading]     = useState(false);

  const reset = (newMode) => {
    setMode(newMode); setErrors({}); setServerError('');
    setEmail(''); setPassword(''); setFirstName('');
    setLastName(''); setHeadline(''); setCity('');
  };

  // ── Sign In ──
  const handleSignIn = async () => {
    const emailErr = validateEmail(email);
    if (emailErr) { setErrors({ email: emailErr }); return; }
    if (!password) { setErrors({ password: 'Password is required' }); return; }
    setErrors({}); setServerError(''); setLoading(true);
    try {
      const res    = await api.post('/members/login', { email, password });
      const member = res.data;
      localStorage.setItem('member_id',  member.member_id);
      localStorage.setItem('user_name',  `${member.first_name} ${member.last_name}`);
      localStorage.setItem('role',       'member');
      onLogin({ role:'member', id:member.member_id, name:`${member.first_name} ${member.last_name}` });
    } catch (e) {
      setServerError(e.response?.data?.error || 'Sign in failed. Please try again.');
    }
    setLoading(false);
  };

  // ── Sign Up ──
  const handleSignUp = async () => {
    const errs = {
      firstName: validateName(firstName, 'First name'),
      lastName:  validateName(lastName,  'Last name'),
      email:     validateEmail(email),
      password:  validatePassword(password),
    };
    setErrors(errs);
    if (Object.values(errs).some(e => e)) return;
    setServerError(''); setLoading(true);
    try {
      const res = await api.post('/members/create', {
        first_name: firstName, last_name: lastName,
        email, password, headline: headline || null, city: city || null,
      });
      localStorage.setItem('member_id', res.data.member_id);
      localStorage.setItem('user_name', `${firstName} ${lastName}`);
      localStorage.setItem('role',      'member');
      onLogin({ role:'member', id:res.data.member_id, name:`${firstName} ${lastName}` });
    } catch (e) {
      setServerError(e.response?.data?.error || 'Account creation failed.');
    }
    setLoading(false);
  };

  // ── Recruiter Sign Up ──
  const handleRecruiterSignUp = async () => {
    const errs = {
      firstName:   validateName(firstName, 'First name'),
      lastName:    validateName(lastName,  'Last name'),
      email:       validateEmail(email),
      password:    validatePassword(password),
      companyName: !headline.trim() ? 'Company name is required' : null,
    };
    setErrors(errs);
    if (Object.values(errs).some(e => e)) return;
    setServerError(''); setLoading(true);
    try {
      await api.post('/recruiters/create', {
        first_name: firstName, last_name: lastName,
        email, password,
        company_name: headline.trim(),
        city: city || null,
      });
      // After creating the account, immediately log in to get full recruiter data
      const loginRes = await api.post('/recruiters/login', { email, password });
      const recruiter = loginRes.data;
      localStorage.setItem('recruiter_id', recruiter.recruiter_id);
      localStorage.setItem('user_name',    `${recruiter.first_name} ${recruiter.last_name}`);
      localStorage.setItem('role',         'recruiter');
      onLogin({ role:'recruiter', id:recruiter.recruiter_id, name:`${recruiter.first_name} ${recruiter.last_name}` });
    } catch (e) {
      setServerError(e.response?.data?.error || 'Account creation failed.');
    }
    setLoading(false);
  };

  // ── Recruiter Sign In ──
  const handleRecruiter = async () => {
    const emailErr = validateEmail(email);
    if (emailErr) { setErrors({ email: emailErr }); return; }
    if (!password) { setErrors({ password: 'Password is required' }); return; }
    setErrors({}); setServerError(''); setLoading(true);
    try {
      const res = await api.post('/recruiters/login', { email, password });
      const recruiter = res.data;
      localStorage.setItem('recruiter_id', recruiter.recruiter_id);
      localStorage.setItem('user_name',    `${recruiter.first_name} ${recruiter.last_name}`);
      localStorage.setItem('role',         'recruiter');
      onLogin({ role:'recruiter', id:recruiter.recruiter_id, name:`${recruiter.first_name} ${recruiter.last_name}` });
    } catch (e) {
      setServerError(e.response?.data?.error || 'Sign in failed. Check your email and password.');
    }
    setLoading(false);
  };

  const onKey = e => {
    if (e.key !== 'Enter') return;
    if (mode === 'signin')           handleSignIn();
    if (mode === 'signup')           handleSignUp();
    if (mode === 'recruiter')        handleRecruiter();
    if (mode === 'recruiter-signup') handleRecruiterSignUp();
  };

  // ─────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'#f3f2ef', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* ── Top nav bar ── */}
      <div style={{ background:'white', borderBottom:'1px solid #e0e0e0', padding:'12px 24px', display:'flex', alignItems:'center' }}>
        <LinkedInLogo size={36} />
      </div>

      {/* ── Page body ── */}
      <div style={{ display:'flex', justifyContent:'center', alignItems:'flex-start', padding:'40px 16px', minHeight:'calc(100vh - 65px)' }}>
        <div style={{ width:'100%', maxWidth:400 }}>

          {/* ── Mode selector (subtle tabs) ── */}
          <div style={{ display:'flex', background:'white', border:'1px solid #e5e7eb', borderRadius:8, marginBottom:24, overflow:'hidden' }}>
            {[['signin','Sign In'],['signup','Join now'],['recruiter','Recruiter']].map(([m,label]) => (
              <button key={m} onClick={() => reset(m)}
                style={{
                  flex:1, padding:'11px 0', border:'none', cursor:'pointer',
                  background: mode===m ? '#0a66c2' : 'white',
                  color:      mode===m ? 'white'   : '#555',
                  fontWeight: mode===m ? 700 : 500,
                  fontSize:13, transition:'all 0.2s',
                  borderRight: m!=='recruiter' ? '1px solid #e5e7eb' : 'none',
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* ── White card ── */}
          <div style={{ background:'white', borderRadius:8, padding:'28px 32px', boxShadow:'0 0 0 1px rgba(0,0,0,0.08)', marginBottom:16 }}
            onKeyDown={onKey}>

            {/* Server error */}
            {serverError && (
              <div style={{ background:'#fff1f2', border:'1px solid #fecdd3', color:'#be123c',
                            padding:'10px 14px', borderRadius:4, marginBottom:20, fontSize:14 }}>
                ⚠ {serverError}
              </div>
            )}

            {/* ══════════ SIGN IN ══════════ */}
            {mode === 'signin' && (
              <>
                <h2 style={{ margin:'0 0 6px', fontSize:28, fontWeight:700, color:'#111' }}>Sign in</h2>
                <p style={{ margin:'0 0 20px', fontSize:15, color:'#333' }}>
                  Stay updated on your professional world.
                </p>


                <Input label="Email or phone" type="email" value={email}
                  onChange={setEmail} error={errors.email} placeholder="Email or phone" />
                <Input label="Password" type={showPwd ? 'text' : 'password'} value={password}
                  onChange={setPassword} error={errors.password} placeholder="Password"
                  rightEl={
                    <span onClick={() => setShowPwd(s=>!s)} style={{ fontSize:20, userSelect:'none' }}>
                      {showPwd ? '🙈' : '👁'}
                    </span>
                  }
                />

                {/* Forgot password */}
                <div style={{ textAlign:'right', marginTop:-8, marginBottom:20 }}>
                  <span style={{ color:'#0a66c2', fontSize:14, cursor:'pointer', fontWeight:600 }}>
                    Forgot password?
                  </span>
                </div>

                {/* Keep me signed in */}
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', marginBottom:20, fontSize:14 }}>
                  <input type="checkbox" checked={keepSigned} onChange={e=>setKeepSigned(e.target.checked)}
                    style={{ width:16, height:16, accentColor:'#0a66c2' }} />
                  Keep me signed in
                </label>

                <button onClick={handleSignIn} disabled={loading} style={primaryBtnStyle(loading)}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>

                <p style={{ textAlign:'center', fontSize:15, marginTop:20, color:'#333' }}>
                  New to LinkedIn DS?{' '}
                  <span onClick={() => reset('signup')}
                    style={{ color:'#0a66c2', fontWeight:700, cursor:'pointer', textDecoration:'underline' }}>
                    Join now
                  </span>
                </p>
              </>
            )}

            {/* ══════════ SIGN UP ══════════ */}
            {mode === 'signup' && (
              <>
                <h2 style={{ margin:'0 0 6px', fontSize:26, fontWeight:700, color:'#111' }}>Create your account</h2>
                <p style={{ margin:'0 0 20px', fontSize:14, color:'#555' }}>Make the most of your professional life.</p>

                <div style={{ display:'flex', gap:10 }}>
                  <div style={{ flex:1 }}>
                    <Input label="First name" value={firstName} onChange={setFirstName}
                      error={errors.firstName} placeholder="First name" />
                  </div>
                  <div style={{ flex:1 }}>
                    <Input label="Last name" value={lastName} onChange={setLastName}
                      error={errors.lastName} placeholder="Last name" />
                  </div>
                </div>

                <Input label="Email" type="email" value={email} onChange={setEmail}
                  error={errors.email} placeholder="Email address" />

                <Input label="Password" type={showPwd ? 'text' : 'password'} value={password}
                  onChange={setPassword} error={errors.password}
                  placeholder="Min 8 chars, uppercase, number, special"
                  rightEl={<span onClick={() => setShowPwd(s=>!s)} style={{ fontSize:18, userSelect:'none' }}>{showPwd?'🙈':'👁'}</span>}
                />

                <PasswordStrengthBar password={password} />

                {/* Password rules */}
                <div style={{ background:'#f0f7ff', borderRadius:4, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#374151' }}>
                  {[
                    ['At least 8 characters',         password.length >= 8],
                    ['One uppercase letter (A-Z)',     /[A-Z]/.test(password)],
                    ['One lowercase letter (a-z)',     /[a-z]/.test(password)],
                    ['One number (0-9)',               /[0-9]/.test(password)],
                    ['One special character (!@#$%)',  /[!@#$%^&*(),.?":{}|<>_\-+=]/.test(password)],
                  ].map(([rule, met]) => (
                    <div key={rule} style={{ color:met?'#16a34a':'#9ca3af', marginBottom:2 }}>
                      {met ? '✓' : '○'} {rule}
                    </div>
                  ))}
                </div>

                <Input label="Headline (optional)" value={headline} onChange={setHeadline}
                  error="" placeholder="e.g. MS in Data Intelligence @SJSU" />
                <Input label="City (optional)" value={city} onChange={setCity}
                  error="" placeholder="e.g. San Jose" />

                <p style={{ fontSize:12, color:'#666', marginBottom:16, lineHeight:1.5 }}>
                  By clicking Agree & Join, you agree to the LinkedIn DS{' '}
                  <span style={{ color:'#0a66c2' }}>User Agreement</span>,{' '}
                  <span style={{ color:'#0a66c2' }}>Privacy Policy</span>, and{' '}
                  <span style={{ color:'#0a66c2' }}>Cookie Policy</span>.
                </p>

                <button onClick={handleSignUp} disabled={loading} style={primaryBtnStyle(loading)}>
                  {loading ? 'Creating account…' : 'Agree & Join'}
                </button>

                <Divider />

                <p style={{ textAlign:'center', fontSize:15, margin:0, color:'#333' }}>
                  Already on LinkedIn DS?{' '}
                  <span onClick={() => reset('signin')}
                    style={{ color:'#0a66c2', fontWeight:700, cursor:'pointer', textDecoration:'underline' }}>
                    Sign in
                  </span>
                </p>
              </>
            )}

            {/* ══════════ RECRUITER ══════════ */}
            {mode === 'recruiter' && (
              <>
                <h2 style={{ margin:'0 0 6px', fontSize:26, fontWeight:700, color:'#111' }}>Recruiter Sign In</h2>
                <p style={{ margin:'0 0 20px', fontSize:14, color:'#555' }}>
                  Access your hiring dashboard and manage job postings.
                </p>

                <Input label="Work Email" type="email" value={email}
                  onChange={setEmail} error={errors.email} placeholder="you@company.com" />

                <Input label="Password" type={showPwd ? 'text' : 'password'} value={password}
                  onChange={setPassword} error={errors.password} placeholder="Password"
                  rightEl={
                    <span onClick={() => setShowPwd(s=>!s)} style={{ fontSize:20, userSelect:'none' }}>
                      {showPwd ? '🙈' : '👁'}
                    </span>
                  }
                />

                <button onClick={handleRecruiter} disabled={loading} style={primaryBtnStyle(loading)}>
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>

                <p style={{ textAlign:'center', fontSize:13, color:'#555', marginTop:16 }}>
                  New recruiter?{' '}
                  <span onClick={() => reset('recruiter-signup')}
                    style={{ color:'#0a66c2', fontWeight:600, cursor:'pointer' }}>
                    Create an account
                  </span>
                </p>
              </>
            )}

            {/* ══════════ RECRUITER SIGN UP ══════════ */}
            {mode === 'recruiter-signup' && (
              <>
                <h2 style={{ margin:'0 0 6px', fontSize:24, fontWeight:700, color:'#111' }}>Create Recruiter Account</h2>
                <p style={{ margin:'0 0 20px', fontSize:14, color:'#555' }}>
                  Post jobs and find top talent.
                </p>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <Input label="First name" value={firstName} onChange={setFirstName} error={errors.firstName} placeholder="First name" />
                  <Input label="Last name"  value={lastName}  onChange={setLastName}  error={errors.lastName}  placeholder="Last name" />
                </div>
                <Input label="Work Email" type="email" value={email} onChange={setEmail} error={errors.email} placeholder="you@company.com" />
                <Input label="Password" type={showPwd ? 'text' : 'password'} value={password}
                  onChange={setPassword} error={errors.password} placeholder="Min. 8 characters"
                  rightEl={<span onClick={() => setShowPwd(s=>!s)} style={{ fontSize:20, userSelect:'none' }}>{showPwd ? '🙈' : '👁'}</span>}
                />
                <Input label="Company Name" value={headline} onChange={setHeadline} error={errors.companyName} placeholder="e.g. Google, Acme Corp" />
                <Input label="City (optional)" value={city} onChange={setCity} placeholder="e.g. San Francisco" />

                <button onClick={handleRecruiterSignUp} disabled={loading} style={primaryBtnStyle(loading)}>
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>

                <p style={{ textAlign:'center', fontSize:13, color:'#555', marginTop:12 }}>
                  Already have an account?{' '}
                  <span onClick={() => reset('recruiter')} style={{ color:'#0a66c2', fontWeight:600, cursor:'pointer' }}>
                    Sign in
                  </span>
                </p>
              </>
            )}
          </div>

          {/* ── Footer ── */}
          <p style={{ textAlign:'center', fontSize:12, color:'#666', marginTop:8 }}>
            CMPE 273 · Distributed Systems · Spring 2026 · Group 5
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  SHARED STYLES
// ─────────────────────────────────────────────
function primaryBtnStyle(loading) {
  return {
    width:'100%', padding:'15px', fontSize:16, fontWeight:700,
    background: loading ? '#93c5fd' : '#0a66c2',
    color:'white', border:'none', borderRadius:24,
    cursor: loading ? 'not-allowed' : 'pointer',
    letterSpacing:'0.3px', transition:'background 0.2s',
  };
}

