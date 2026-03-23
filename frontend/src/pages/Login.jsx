import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { fetchUserProfile, STAFF_SIGNUP_ROLE } from '../authProfile';
import { LogIn, QrCode, Utensils, Zap, ChefHat, UserCircle, X, Camera, ArrowRight, Chrome, RefreshCw } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

// Inject Google Fonts + keyframes once
const styleTag = document.createElement('style');
styleTag.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

  :root {
    --primary: #FFD600;
    --primary-dim: rgba(255,214,0,0.12);
    --black: #0a0a0a;
    --white: #fafafa;
    --gray: #6b6b6b;
    --card-bg: #fff;
    --card-border: rgba(0,0,0,0.07);
    --input-bg: #f5f5f5;
  }

  .dark {
    --card-bg: #161616;
    --card-border: rgba(255,255,255,0.07);
    --input-bg: #222;
    --white: #fafafa;
    --black: #0a0a0a;
  }

  .login-root * { box-sizing: border-box; margin: 0; padding: 0; }
  .login-root { font-family: 'DM Sans', sans-serif; }
  .login-root h1, .login-root h2, .login-root h3, .login-root .syne { font-family: 'Syne', sans-serif; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.93); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes pulse-ring {
    0%   { transform: scale(1); opacity: 0.5; }
    70%  { transform: scale(1.35); opacity: 0; }
    100% { transform: scale(1.35); opacity: 0; }
  }
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  .fade-up      { animation: fadeUp 0.55s cubic-bezier(.22,1,.36,1) both; }
  .fade-up-2    { animation: fadeUp 0.55s 0.1s cubic-bezier(.22,1,.36,1) both; }
  .fade-up-3    { animation: fadeUp 0.55s 0.2s cubic-bezier(.22,1,.36,1) both; }
  .fade-up-4    { animation: fadeUp 0.55s 0.3s cubic-bezier(.22,1,.36,1) both; }
  .scale-in     { animation: scaleIn 0.4s cubic-bezier(.22,1,.36,1) both; }

  .pill-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 12px 24px; border-radius: 100px;
    font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px;
    text-transform: uppercase; letter-spacing: 0.08em;
    cursor: pointer; border: none; transition: all 0.2s ease;
  }
  .pill-btn:active { transform: scale(0.96); }

  .primary-btn {
    width: 100%; padding: 18px 24px; border-radius: 16px;
    background: var(--primary); color: var(--black);
    font-family: 'Syne', sans-serif; font-weight: 800; font-size: 17px;
    text-transform: uppercase; letter-spacing: 0.04em;
    cursor: pointer; border: none;
    transition: all 0.22s cubic-bezier(.22,1,.36,1);
    display: flex; align-items: center; justify-content: center; gap: 10px;
    box-shadow: 0 4px 20px rgba(255,214,0,0.35);
  }
  .primary-btn:hover  { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(255,214,0,0.45); }
  .primary-btn:active { transform: translateY(0) scale(0.98); }

  .ghost-btn {
    background: transparent; color: var(--gray);
    border: 1.5px solid var(--card-border);
    transition: all 0.2s ease;
  }
  .ghost-btn:hover { border-color: var(--primary); color: var(--black); }

  .card {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 28px;
    box-shadow: 0 2px 40px rgba(0,0,0,0.06);
  }

  .input-field {
    width: 100%; padding: 15px 18px;
    background: var(--input-bg); border: 1.5px solid transparent;
    border-radius: 12px; font-family: 'DM Sans', sans-serif;
    font-size: 15px; font-weight: 500; color: var(--black);
    outline: none; transition: border-color 0.2s ease;
    letter-spacing: 0.02em;
  }
  .input-field::placeholder { color: #999; }
  .input-field:focus { border-color: var(--primary); background: var(--card-bg); }

  .step-chip {
    display: flex; flex-direction: column; align-items: center;
    gap: 8px; padding: 16px 12px; border-radius: 16px;
    background: var(--primary-dim); flex: 1;
    transition: all 0.2s ease;
  }
  .step-chip:hover { background: rgba(255,214,0,0.2); transform: translateY(-2px); }

  .logo-mark {
    width: 64px; height: 64px; border-radius: 18px;
    background: var(--black); color: var(--primary);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  }

  .wordmark { font-size: clamp(48px, 11vw, 86px); font-weight: 900; line-height: 1; letter-spacing: -0.04em; }
  .wordmark .dot { color: var(--primary); }

  .scanner-wrapper { border-radius: 20px; overflow: hidden; }
  .scanner-wrapper #reader { border: none !important; }
  .scanner-wrapper #reader video { border-radius: 16px; }
`;
if (!document.querySelector('[data-login-styles]')) {
  styleTag.setAttribute('data-login-styles', '');
  document.head.appendChild(styleTag);
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showStaffLogin, setShowStaffLogin] = useState(false);
  const [showCustomerLogin, setShowCustomerLogin] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // 'user' or 'environment'
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(window.location.search);
  const redirect = queryParams.get('redirect');

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchUserProfile(session.user.id)
          .then(setUserProfile)
          .catch((profileError) => console.error('Failed to load user profile', profileError));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        try {
          const profile = await fetchUserProfile(session.user.id);
          setUserProfile(profile);
        } catch (profileError) {
          console.error('Failed to load user profile', profileError);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const effectiveRole = userProfile?.role || user?.user_metadata?.role || user?.app_metadata?.role;
  const isCustomer = effectiveRole === 'customer' || (!!user && !effectiveRole);

  useEffect(() => {
    let html5QrCode;
    if (isScanning) {
      html5QrCode = new Html5Qrcode("reader");
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      html5QrCode.start(
        { facingMode: facingMode }, 
        config,
        (decodedText) => {
          if (decodedText.includes('/table/')) {
            const tableId = decodedText.split('/table/')[1];
            html5QrCode.stop().then(() => {
              setIsScanning(false);
              navigate(`/table/${tableId}`);
            }).catch(err => console.error(err));
          }
        },
        (errorMessage) => {
          // parse error, ignore
        }
      ).catch(err => {
        console.error("Unable to start scanning.", err);
      });
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error(err));
      }
    };
  }, [isScanning, navigate, facingMode]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const profile = await fetchUserProfile(data.user.id);
      const role = profile?.role || data.user.user_metadata?.role;
      const branchId = profile?.branch_id || data.user.user_metadata?.branch_id;
      
      if (redirect) {
        navigate(redirect);
        return;
      }

      if (role === 'admin') navigate('/admin');
      else if (role === 'kitchen' && branchId) navigate(`/kitchen/${branchId}`);
      else if (role === 'waiter' && branchId) navigate(`/waiter/${branchId}`);
      else if (['manager', 'supervisor'].includes(role) && branchId) navigate(`/branch/${branchId}`);
      else if (role === STAFF_SIGNUP_ROLE && !branchId) {
        setError('Your staff account is waiting for admin branch assignment.');
      } else if (role === STAFF_SIGNUP_ROLE && branchId) {
        setError('Your branch is assigned. Please wait for your manager to assign your working role.');
      }
      else {
        setShowCustomerLogin(false);
      }
    } catch (err) {
      if (err.message?.includes('Invalid login credentials') || err.status === 400) {
        setError('Invalid credentials or email not confirmed. Please check your email for a verification link.');
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) setError(error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <div className="login-root" style={{
      minHeight: '100svh',
      background: '#f2f2f0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '0 0 60px',
    }}>

      {/* Header / Hero */}
      <div style={{
        width: '100%',
        background: '#0a0a0a',
        padding: '52px 24px 80px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative blobs */}
        <div style={{
          position: 'absolute', top: -60, right: -60,
          width: 240, height: 240, borderRadius: '50%',
          background: 'rgba(255,214,0,0.08)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: -40,
          width: 180, height: 180, borderRadius: '50%',
          background: 'rgba(255,214,0,0.05)', pointerEvents: 'none',
        }} />

        <div className="logo-mark fade-up" style={{ marginBottom: 20 }}>
          <Zap size={28} fill="currentColor" />
        </div>

        <h1 className="wordmark syne fade-up-2" style={{ color: '#fafafa' }}>
          Food<span className="dot">.</span>App
        </h1>

        <p className="fade-up-3" style={{
          color: '#666', fontSize: 13, fontWeight: 500,
          letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 12,
        }}>
          The Future of Dining
        </p>
      </div>

      {/* Main Card */}
      <div style={{ width: '100%', maxWidth: 480, padding: '0 16px', marginTop: -40, zIndex: 10 }}>

        {!isScanning ? (
          <div className="card fade-up-3" style={{ padding: '36px 28px 28px', textAlign: 'center' }}>

            {/* QR Icon with pulse */}
            <div style={{ position: 'relative', display: 'inline-flex', marginBottom: 24 }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(255,214,0,0.4)',
                animation: 'pulse-ring 2.2s ease-out infinite',
              }} />
              <div style={{
                width: 88, height: 88, borderRadius: '50%',
                background: '#FFD600',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                <QrCode size={40} color="#0a0a0a" strokeWidth={1.8} />
              </div>
            </div>

            {isCustomer ? (
              <>
                <h2 className="syne" style={{ fontSize: 26, fontWeight: 800, color: '#0a0a0a', marginBottom: 8 }}>
                  Welcome, {user.email}!
                </h2>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
                   <button onClick={() => navigate('/history')} className="pill-btn" style={{ background: '#0a0a0a', color: '#fff', fontSize: 10 }}>My Orders</button>
                   <button onClick={handleLogout} className="pill-btn ghost-btn" style={{ fontSize: 10 }}>Logout</button>
                </div>
              </>
            ) : (
              <>
                <h2 className="syne" style={{ fontSize: 26, fontWeight: 800, color: '#0a0a0a', marginBottom: 8 }}>
                  Welcome, Guest!
                </h2>
                <p style={{ color: '#888', fontSize: 15, lineHeight: 1.6, marginBottom: 28, fontWeight: 400 }}>
                  Scan the QR code on your table to view the menu and order instantly.
                </p>
              </>
            )}

            <button className="primary-btn" onClick={() => setIsScanning(true)}>
              <Camera size={20} strokeWidth={2.5} /> Scan Table QR
            </button>

            {!isCustomer && (
              <div style={{ marginTop: 24, padding: '16px', background: 'var(--primary-dim)', borderRadius: '16px', border: '1px solid var(--primary)' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#0a0a0a', marginBottom: 4 }}>WANT TO SAVE YOUR RECEIPTS?</p>
                <p style={{ fontSize: 11, color: '#666', marginBottom: 12 }}>Create a customer account to get exclusive deals!</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button 
                    className="pill-btn" 
                    onClick={() => navigate('/signup')}
                    style={{ background: '#0a0a0a', color: '#fff', fontSize: 11, padding: '10px 20px' }}
                  >
                    Sign Up
                  </button>
                  <button 
                    className="pill-btn ghost-btn" 
                    onClick={() => setShowCustomerLogin(true)}
                    style={{ fontSize: 11, padding: '10px 20px' }}
                  >
                    Sign In
                  </button>
                </div>
              </div>
            )}

            {/* Steps */}
            <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
              {[
                { icon: <QrCode size={22} />, label: '1. Scan QR' },
                { icon: <Utensils size={22} />, label: '2. Pick Food' },
                { icon: <Zap size={22} />, label: '3. Pay & Go' },
              ].map((s) => (
                <div key={s.label} className="step-chip">
                  <span style={{ color: '#0a0a0a' }}>{s.icon}</span>
                  <span className="syne" style={{ fontSize: 10, fontWeight: 700, color: '#555', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card scale-in" style={{ padding: '28px 24px', textAlign: 'center' }}>
            <h2 className="syne" style={{ fontSize: 20, fontWeight: 800, color: '#0a0a0a', marginBottom: 16 }}>
              Point at QR Code
            </h2>
            <div className="scanner-wrapper" style={{ marginBottom: 20, position: 'relative' }}>
              <div id="reader" style={{ background: '#000', minHeight: '300px' }} />
              <button 
                onClick={toggleCamera}
                style={{
                  position: 'absolute', bottom: 16, right: 16,
                  background: 'var(--primary)', border: 'none', borderRadius: '50%',
                  width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)', zIndex: 10
                }}
              >
                <RefreshCw size={20} color="#000" />
              </button>
            </div>
            <button className="pill-btn ghost-btn" onClick={() => setIsScanning(false)}>
              <X size={16} /> Cancel
            </button>
          </div>
        )}

        {/* Staff portal */}
        <div style={{ marginTop: 20 }}>
          {!showStaffLogin ? (
            <div style={{ textAlign: 'center' }}>
              <button
                className="pill-btn ghost-btn"
                onClick={() => setShowStaffLogin(true)}
                style={{ margin: '0 auto' }}
              >
                <UserCircle size={16} /> Staff Portal
              </button>
            </div>
          ) : (
            <div className="card scale-in" style={{ padding: '32px 28px', position: 'relative' }}>
              <button
                onClick={() => setShowStaffLogin(false)}
                style={{
                  position: 'absolute', top: 16, right: 16,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#999', padding: 4, borderRadius: 8,
                  display: 'flex', alignItems: 'center', transition: 'color 0.2s',
                }}
                onMouseOver={e => e.currentTarget.style.color = '#0a0a0a'}
                onMouseOut={e => e.currentTarget.style.color = '#999'}
              >
                <X size={20} />
              </button>

              <h3 className="syne" style={{ fontSize: 20, fontWeight: 800, color: '#0a0a0a', marginBottom: 6 }}>
                Staff Sign In
              </h3>
              <p style={{ color: '#999', fontSize: 13, marginBottom: 24 }}>Personnel access only</p>

              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 10, padding: '10px 14px', marginBottom: 16,
                  color: '#dc2626', fontSize: 13, fontWeight: 500,
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  className="input-field"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoCapitalize="off"
                />
                <input
                  className="input-field"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="submit" className="primary-btn" style={{ marginTop: 4 }}>
                  Sign In <ArrowRight size={18} />
                </button>
              </form>
              <div style={{ margin: '16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--card-border)' }} />
                <span style={{ fontSize: 12, color: '#999' }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--card-border)' }} />
              </div>
              <button onClick={handleGoogleLogin} className="pill-btn ghost-btn" style={{ width: '100%', justifyContent: 'center' }}>
                <Chrome size={18} /> Sign in with Google
              </button>
              <div style={{ marginTop: 18, textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: '#666' }}>
                  New team member?
                  <button
                    onClick={() => navigate('/signup?mode=staff')}
                    style={{ background: 'none', border: 'none', color: '#0a0a0a', fontWeight: 800, cursor: 'pointer', marginLeft: 4 }}
                  >
                    Create staff account
                  </button>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Customer Sign In Modal */}
        {showCustomerLogin && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[200] flex items-center justify-center p-6">
            <div className="card scale-in" style={{ padding: '32px 28px', position: 'relative', width: '100%', maxWidth: 400 }}>
              <button
                onClick={() => setShowCustomerLogin(false)}
                style={{
                  position: 'absolute', top: 16, right: 16,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#999', padding: 4, borderRadius: 8,
                }}
              >
                <X size={20} />
              </button>

              <h3 className="syne" style={{ fontSize: 24, fontWeight: 800, color: '#0a0a0a', marginBottom: 6 }}>
                Customer Sign In
              </h3>
              <p style={{ color: '#999', fontSize: 13, marginBottom: 24 }}>Access your receipts & deals</p>

              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 10, padding: '10px 14px', marginBottom: 16,
                  color: '#dc2626', fontSize: 13, fontWeight: 500,
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  className="input-field"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <input
                  className="input-field"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="submit" className="primary-btn" style={{ marginTop: 4 }}>
                  Sign In <ArrowRight size={18} />
                </button>
              </form>
              <div style={{ margin: '16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--card-border)' }} />
                <span style={{ fontSize: 12, color: '#999' }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--card-border)' }} />
              </div>
              <button onClick={handleGoogleLogin} className="pill-btn ghost-btn" style={{ width: '100%', justifyContent: 'center' }}>
                <Chrome size={18} /> Sign in with Google
              </button>
              
              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: '#666' }}>Don't have an account? 
                  <button 
                    onClick={() => navigate('/signup')}
                    style={{ background: 'none', border: 'none', color: '#0a0a0a', fontWeight: 800, cursor: 'pointer', marginLeft: 4 }}
                  >
                    Sign Up
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;
