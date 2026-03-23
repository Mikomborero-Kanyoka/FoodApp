import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RefreshCw, LogOut, Clock3, Zap, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';
import {
  loadUserProfile,
  getDashboardPath,
  getEffectiveBranchId,
  getEffectiveRole,
} from '../authProfile';

if (!document.querySelector('[data-sp-fonts]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&family=DM+Sans:wght@300;400;500&display=swap';
  link.setAttribute('data-sp-fonts', '');
  document.head.appendChild(link);

  const style = document.createElement('style');
  style.setAttribute('data-sp-styles', '');
  style.textContent = `
    .font-syne { font-family: 'Syne', sans-serif !important; }
    .font-dm   { font-family: 'DM Sans', sans-serif !important; }

    @keyframes sp-fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes sp-spin {
      to { transform: rotate(360deg); }
    }

    .anim-1 { animation: sp-fadeUp .5s .00s cubic-bezier(.22,1,.36,1) both; }
    .anim-2 { animation: sp-fadeUp .5s .08s cubic-bezier(.22,1,.36,1) both; }
    .anim-3 { animation: sp-fadeUp .5s .16s cubic-bezier(.22,1,.36,1) both; }

    .sp-spinner {
      width: 48px;
      height: 48px;
      border-radius: 9999px;
      border: 3px solid rgba(255,214,0,.18);
      border-top-color: #FFD600;
      animation: sp-spin .8s linear infinite;
    }
  `;
  document.head.appendChild(style);
}

export default function StaffPending() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profileReady, setProfileReady] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const refreshStatus = async () => {
    setError('');
    setIsRefreshing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        navigate('/login', { replace: true });
        return;
      }

      setUser(session.user);

      const profile = await loadUserProfile(session.user).catch((profileError) => {
        console.error('Failed to load profile:', profileError);
        return null;
      });

      const role = getEffectiveRole(session.user, profile);
      const branchId = getEffectiveBranchId(session.user, profile);
      const destination = getDashboardPath(role, branchId);

      if (destination && destination !== '/staff/pending') {
        navigate(destination, { replace: true });
        return;
      }

      setProfileReady(Boolean(profile));
    } catch (err) {
      console.error(err);
      setError('We could not refresh your assignment status right now.');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshStatus();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        navigate('/login', { replace: true });
        return;
      }

      refreshStatus();
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  if (isRefreshing && !user) {
    return (
      <div className="font-dm min-h-svh bg-[#f2f2f0] flex flex-col items-center justify-center gap-5">
        <div className="sp-spinner" />
        <p className="font-syne text-xs font-bold uppercase tracking-widest text-gray-400">
          Checking assignment status
        </p>
      </div>
    );
  }

  return (
    <div className="font-dm min-h-svh bg-[#f2f2f0] flex flex-col items-center pb-20">
      <div className="w-full bg-[#0a0a0a] px-6 pt-14 pb-24 flex flex-col items-center text-center relative overflow-hidden">
        <div className="absolute -top-10 -right-10 opacity-[0.04] rotate-12 pointer-events-none">
          <Clock3 size={220} color="#fff" />
        </div>

        <div className="anim-1 relative flex items-center justify-center mb-6">
          <div className="relative w-16 h-16 rounded-2xl bg-[#FFD600] flex items-center justify-center z-10">
            <Clock3 size={28} color="#0a0a0a" strokeWidth={2.5} />
          </div>
        </div>

        <h1 className="font-syne anim-2 text-5xl font-black text-white leading-none tracking-tight mb-3">
          Awaiting<br/>Assignment
        </h1>
        <p className="anim-3 font-syne text-xs font-semibold uppercase tracking-widest text-gray-500">
          Staff access activates after admin approval
        </p>
      </div>

      <div className="w-full max-w-md px-4 -mt-12 z-10">
        <div className="anim-3 bg-white rounded-3xl border border-black/[0.06] shadow-lg px-8 py-10">
          <div className="rounded-2xl bg-yellow-50 border border-yellow-200 px-5 py-4 mb-6">
            <p className="font-syne text-sm font-bold uppercase tracking-wide text-yellow-700">
              Account Pending
            </p>
            <p className="font-dm text-sm text-yellow-800 mt-2 leading-relaxed">
              {profileReady
                ? 'Your email is confirmed and your profile is ready. An admin still needs to assign your branch and role before you can access staff tools.'
                : 'Your profile is still syncing after confirmation. If you just verified your email, wait a moment and refresh your status.'}
            </p>
          </div>

          {user?.email && (
            <div className="mb-6 rounded-2xl bg-gray-50 border border-black/[0.04] px-5 py-4">
              <p className="font-syne text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
                Signed In As
              </p>
              <p className="font-dm text-base text-[#0a0a0a] break-all">{user.email}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-red-600 font-syne font-bold text-sm uppercase tracking-wide mb-6">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={refreshStatus}
              disabled={isRefreshing}
              className="w-full bg-[#FFD600] text-[#0a0a0a] font-syne font-extrabold text-base uppercase tracking-wide py-5 rounded-2xl flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(255,214,0,.3)] disabled:opacity-70"
            >
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh Status
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full bg-gray-100 text-[#0a0a0a] font-syne font-bold text-base uppercase tracking-wide py-5 rounded-2xl flex items-center justify-center gap-2.5"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>

          <div className="mt-8 pt-7 border-t border-gray-100 flex flex-col items-center gap-4">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 font-syne font-bold text-sm uppercase tracking-wide text-[#0a0a0a] hover:text-[#9a7e00] transition-colors"
            >
              <Zap size={15} /> Back to Login
            </Link>
          </div>

          <div className="mt-7 flex items-center justify-center gap-2 text-gray-300">
            <ShieldCheck size={13} />
            <span className="font-syne text-[10px] font-bold uppercase tracking-widest">
              Waiting For Branch And Role Assignment
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
