
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { UserPlus, ArrowRight, Zap, ArrowLeft, ShieldCheck, Chrome } from 'lucide-react';

/* ── Fonts (injected once) ─────────────────────────────────────── */
if (!document.querySelector('[data-ss-fonts]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&family=DM+Sans:wght@300;400;500&display=swap';
  link.setAttribute('data-ss-fonts', '');
  document.head.appendChild(link);

  const style = document.createElement('style');
  style.setAttribute('data-ss-styles', '');
  style.textContent = `
    .font-syne { font-family: 'Syne', sans-serif !important; }
    .font-dm   { font-family: 'DM Sans', sans-serif !important; }

    @keyframes ss-fadeUp {
      from { opacity: 0; transform: translateY(22px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes ss-pulse-ring {
      0%   { transform: scale(1);    opacity: .5; }
      70%  { transform: scale(1.38); opacity: 0;  }
      100% { transform: scale(1.38); opacity: 0;  }
    }

    .anim-1 { animation: ss-fadeUp .5s .00s cubic-bezier(.22,1,.36,1) both; }
    .anim-2 { animation: ss-fadeUp .5s .08s cubic-bezier(.22,1,.36,1) both; }
    .anim-3 { animation: ss-fadeUp .5s .16s cubic-bezier(.22,1,.36,1) both; }
    .anim-4 { animation: ss-fadeUp .5s .24s cubic-bezier(.22,1,.36,1) both; }

    .pulse-ring {
      position: absolute; inset: 0; border-radius: 9999px;
      background: rgba(255,214,0,.35);
      animation: ss-pulse-ring 2.4s ease-out infinite;
    }

    .signup-btn { transition: all .18s cubic-bezier(.22,1,.36,1); }
    .signup-btn:hover  { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(255,214,0,.45); }
    .signup-btn:active { transform: scale(.97); }
  `;
  document.head.appendChild(style);
}

const inputCls =
  'w-full px-5 py-4 bg-gray-100 rounded-2xl border-2 border-transparent focus:border-[#FFD600] outline-none font-dm text-base text-[#0a0a0a] transition-all placeholder:text-gray-400';

export default function StaffSignup() {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (username.length < 3 || username.length > 15) {
      setError('Username must be between 3 and 15 characters.');
      return;
    }

    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + '/login',
          data: {
            role: 'pending_staff',
            username: username,
            full_name: fullName
          }
        }
      });

      if (signupError) throw signupError;
      
      if (data?.user) {
        const { error: profileError } = await supabase
          .from('users')
          .insert([{ 
            id: data.user.id, 
            role: 'pending_staff',
            username: username,
            full_name: fullName,
            email: email
          }]);
        
        if (profileError) console.error('Profile creation error:', profileError);
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Signup failed.');
    }
  };

  return (
    <div className="font-dm min-h-svh bg-[#f2f2f0] flex flex-col items-center pb-20">

      {/* ── Dark hero bar ─────────────────────────────────────── */}
      <div className="w-full bg-[#0a0a0a] px-6 pt-14 pb-24 flex flex-col items-center text-center relative overflow-hidden">
        <div className="absolute -top-10 -right-10 opacity-[0.04] rotate-12 pointer-events-none">
          <Zap size={220} color="#fff" fill="#fff" />
        </div>

        {/* Icon */}
        <div className="anim-1 relative flex items-center justify-center mb-6">
          <div className="pulse-ring" style={{ width: 64, height: 64, inset: 'auto', borderRadius: '50%' }} />
          <div className="relative w-16 h-16 rounded-2xl bg-[#FFD600] flex items-center justify-center z-10">
            <UserPlus size={28} color="#0a0a0a" strokeWidth={2.5} />
          </div>
        </div>

        <h1 className="font-syne anim-2 text-5xl font-black text-white leading-none tracking-tight mb-3">
          Staff<br/>Registration
        </h1>
        <p className="anim-3 font-syne text-xs font-semibold uppercase tracking-widest text-gray-500">
          Join our professional dining team
        </p>
      </div>

      {/* ── Form card ─────────────────────────────────────────── */}
      <div className="w-full max-w-md px-4 -mt-12 z-10">
        <div className="anim-3 bg-white rounded-3xl border border-black/[0.06] shadow-lg px-8 py-10">

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-red-600 font-syne font-bold text-sm uppercase tracking-wide mb-6">
              {error}
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 text-green-600 font-syne font-bold text-sm uppercase tracking-wide mb-6">
              Application submitted! Please check your email for a confirmation link. An admin will assign you a branch shortly.
            </div>
          )}

          {!success ? (
            <form onSubmit={handleSignup} className="space-y-5">
              <div className="space-y-2">
                <label className="font-syne text-xs font-bold uppercase tracking-widest text-gray-400">
                  Full Name
                </label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="John Doe"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="font-syne text-xs font-bold uppercase tracking-widest text-gray-400">
                  Username (3-15 chars)
                </label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="staff_member"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="font-syne text-xs font-bold uppercase tracking-widest text-gray-400">
                  Work Email
                </label>
                <input
                  type="email"
                  className={inputCls}
                  placeholder="staff@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="font-syne text-xs font-bold uppercase tracking-widest text-gray-400">
                  Password
                </label>
                <input
                  type="password"
                  className={inputCls}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="signup-btn w-full bg-[#FFD600] text-[#0a0a0a] font-syne font-extrabold text-base uppercase tracking-wide py-5 rounded-2xl flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(255,214,0,.3)] mt-2"
              >
                Register as Staff <ArrowRight size={18} strokeWidth={2.5} />
              </button>
            </form>
          ) : (
            <div className="text-center py-6">
              <p className="font-dm text-gray-500 mb-8">
                Once confirmed and assigned by an admin, you can sign in to your staff portal.
              </p>
              <Link
                to="/login"
                className="signup-btn inline-block w-full bg-[#FFD600] text-[#0a0a0a] font-syne font-extrabold text-base uppercase tracking-wide py-5 rounded-2xl text-center shadow-[0_4px_20px_rgba(255,214,0,.3)]"
              >
                Go to Sign In
              </Link>
            </div>
          )}

          {/* Footer links */}
          <div className="mt-8 pt-7 border-t border-gray-100 flex flex-col items-center gap-4">
            <p className="font-dm text-sm text-gray-400">Already a staff member?</p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 font-syne font-bold text-sm uppercase tracking-wide text-[#0a0a0a] hover:text-[#9a7e00] transition-colors"
            >
              <ArrowLeft size={15} /> Back to Sign In
            </Link>
          </div>

          {/* Trust badge */}
          <div className="mt-7 flex items-center justify-center gap-2 text-gray-300">
            <ShieldCheck size={13} />
            <span className="font-syne text-[10px] font-bold uppercase tracking-widest">
              Personnel Security Protocol Enabled
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
