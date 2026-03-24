import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { LogIn, QrCode, Utensils, Zap, ChefHat, UserCircle, X, Camera, ArrowRight, Chrome, RefreshCw } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import PasswordField from '../components/PasswordField';
import {
  loadUserProfile,
  getDashboardPath,
  getEffectiveBranchId,
  getEffectiveRole,
} from '../authProfile';

// Inject keyframes for animations
const styleTag = document.createElement('style');
styleTag.textContent = `
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
  
  .animate-fadeUp { animation: fadeUp 0.55s cubic-bezier(.22,1,.36,1) both; }
  .animate-fadeUpDelay { animation: fadeUp 0.55s 0.1s cubic-bezier(.22,1,.36,1) both; }
  .animate-fadeUpDelay2 { animation: fadeUp 0.55s 0.2s cubic-bezier(.22,1,.36,1) both; }
  .animate-scaleIn { animation: scaleIn 0.4s cubic-bezier(.22,1,.36,1) both; }
  .animate-pulse-ring { animation: pulse-ring 2.2s ease-out infinite; }
  
  #reader video {
    border-radius: 16px;
    width: 100% !important;
    height: auto !important;
    max-height: 400px;
    object-fit: cover;
  }
  
  @media (max-width: 480px) {
    #reader video {
      max-height: 300px;
    }
  }
`;
if (!document.querySelector('[data-login-animations]')) {
  styleTag.setAttribute('data-login-animations', '');
  document.head.appendChild(styleTag);
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showStaffLogin, setShowStaffLogin] = useState(false);
  const [showCustomerLogin, setShowCustomerLogin] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(window.location.search);
  const redirect = queryParams.get('redirect');

  useEffect(() => {
    const syncSession = async (sessionArg = null) => {
      const session = sessionArg ?? (await supabase.auth.getSession()).data.session;
      const sessionUser = session?.user ?? null;

      setUser(sessionUser);

      if (!sessionUser) {
        setUserRole(null);
        return;
      }

      const profile = await loadUserProfile(sessionUser).catch((profileError) => {
        console.error('Failed to load profile:', profileError);
        return null;
      });

      const role = getEffectiveRole(sessionUser, profile);
      const branchId = getEffectiveBranchId(sessionUser, profile);
      const destination = getDashboardPath(role, branchId);

      setUserRole(role);

      if (redirect) {
        navigate(redirect, { replace: true });
        return;
      }

      if (destination && role !== 'customer') {
        navigate(destination, { replace: true });
      }
    };

    syncSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session);
    });

    return () => subscription.unsubscribe();
  }, [navigate, redirect]);

  const isCustomer = userRole === 'customer';

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

      const profile = await loadUserProfile(data.user).catch((profileError) => {
        console.error('Failed to load profile:', profileError);
        return null;
      });

      const role = getEffectiveRole(data.user, profile);
      const branchId = getEffectiveBranchId(data.user, profile);
      const destination = getDashboardPath(role, branchId);

      setUserRole(role);
      
      if (redirect) {
        navigate(redirect);
        return;
      }

      if (!role) {
        setError('Your account profile is still syncing. Please try again in a moment.');
        return;
      }

      if (role === 'customer') {
        setShowCustomerLogin(false);
        return;
      }

      if (destination) {
        navigate(destination);
      } else {
        setError('Your account is still waiting for admin setup. Please try again shortly.');
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
    setUserRole(null);
  };

  return (
    <div className="min-h-screen bg-[#f2f2f0] flex flex-col items-center pb-[60px]">
      {/* Header / Hero */}
      <div className="w-full bg-black py-[clamp(32px,8vh,52px)] px-6 pb-[clamp(48px,10vh,80px)] flex flex-col items-center text-center relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-[60px] -right-[60px] w-[clamp(180px,30vw,240px)] h-[clamp(180px,30vw,240px)] rounded-full bg-[rgba(255,214,0,0.08)] pointer-events-none" />
        <div className="absolute bottom-0 -left-[40px] w-[clamp(140px,25vw,180px)] h-[clamp(140px,25vw,180px)] rounded-full bg-[rgba(255,214,0,0.05)] pointer-events-none" />

        <div className="w-[clamp(52px,12vw,64px)] h-[clamp(52px,12vw,64px)] rounded-[clamp(14px,3vw,18px)] bg-black text-[#FFD600] flex items-center justify-center shadow-2xl mb-[clamp(16px,4vh,20px)] animate-fadeUp">
          <Zap size={clamp(24, 5, 28)} fill="currentColor" />
        </div>

        <h1 className="text-[clamp(36px,11vw,86px)] font-black leading-none tracking-[-0.04em] text-white font-['Syne'] animate-fadeUpDelay">
          Food<span className="text-[#FFD600]">.</span>App
        </h1>

        <p className="text-[clamp(11px,3vw,13px)] font-medium tracking-[0.18em] uppercase text-gray-500 mt-[clamp(10px,2vh,12px)] animate-fadeUpDelay2">
          The Future of Dining
        </p>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-[480px] px-4 -mt-[clamp(32px,5vh,40px)] z-10">
        {!isScanning ? (
          <div className="bg-white dark:bg-[#161616] border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] rounded-[clamp(20px,4vw,28px)] shadow-md p-[clamp(28px,5vh,36px)] p-[clamp(20px,4vw,28px)] pb-[clamp(24px,4vh,28px)] text-center animate-fadeUpDelay2">
            {/* QR Icon with pulse */}
            <div className="relative inline-flex mb-[clamp(20px,4vh,24px)]">
              <div className="absolute inset-0 rounded-full bg-[rgba(255,214,0,0.4)] animate-pulse-ring" />
              <div className="w-[clamp(72px,15vw,88px)] h-[clamp(72px,15vw,88px)] rounded-full bg-[#FFD600] flex items-center justify-center relative">
                <QrCode size={clamp(32, 8, 40)} color="#0a0a0a" strokeWidth={1.8} />
              </div>
            </div>

            {isCustomer ? (
              <>
                <h2 className="text-[clamp(22px,6vw,26px)] font-extrabold text-black dark:text-white mb-2 break-words font-['Syne']">
                  Welcome, {user?.email}!
                </h2>
                <div className="flex gap-2.5 justify-center mb-6 flex-wrap">
                  <button 
                    onClick={() => navigate('/history')} 
                    className="inline-flex items-center gap-2 px-[clamp(10px,3vw,20px)] py-[clamp(8px,2vh,12px)] rounded-full bg-black text-white text-[clamp(10px,2.5vw,11px)] font-bold uppercase tracking-[0.08em] transition-all active:scale-95 font-['Syne']"
                  >
                    My Orders
                  </button>
                  <button 
                    onClick={handleLogout} 
                    className="inline-flex items-center gap-2 px-[clamp(10px,3vw,20px)] py-[clamp(8px,2vh,12px)] rounded-full bg-transparent text-gray-500 border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] text-[clamp(10px,2.5vw,11px)] font-bold uppercase tracking-[0.08em] transition-all active:scale-95 font-['Syne'] hover:border-[#FFD600] hover:text-black dark:hover:text-white"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-[clamp(22px,6vw,26px)] font-extrabold text-black dark:text-white mb-2 font-['Syne']">
                  Welcome, Guest!
                </h2>
                <p className="text-gray-500 text-[clamp(14px,3.5vw,15px)] leading-relaxed mb-[clamp(24px,5vh,28px)]">
                  Scan the QR code on your table to view the menu and order instantly.
                </p>
              </>
            )}

            <button 
              onClick={() => setIsScanning(true)} 
              className="w-full py-[clamp(14px,3.5vh,18px)] px-6 rounded-2xl bg-[#FFD600] text-black font-['Syne'] font-extrabold text-[clamp(15px,4vw,17px)] uppercase tracking-[0.04em] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(255,214,0,0.45)] active:translate-y-0 active:scale-98 flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(255,214,0,0.35)]"
            >
              <Camera size={20} strokeWidth={2.5} /> Scan Table QR
            </button>

            {!isCustomer && (
              <div className="mt-6 p-[clamp(14px,3vh,16px)] bg-[rgba(255,214,0,0.12)] rounded-2xl border border-[#FFD600]">
                <p className="text-[clamp(12px,3vw,13px)] font-bold text-black mb-1">WANT TO SAVE YOUR RECEIPTS?</p>
                <p className="text-[clamp(10px,2.5vw,11px)] text-gray-500 mb-3">Create a customer account to get exclusive deals!</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  <button 
                    onClick={() => navigate('/signup')}
                    className="inline-flex items-center gap-2 px-[clamp(16px,4vw,20px)] py-[clamp(8px,2vh,10px)] rounded-full bg-black text-white text-[clamp(10px,2.5vw,11px)] font-bold uppercase tracking-[0.08em] transition-all active:scale-95 font-['Syne']"
                  >
                    Sign Up
                  </button>
                  <button 
                    onClick={() => setShowCustomerLogin(true)}
                    className="inline-flex items-center gap-2 px-[clamp(16px,4vw,20px)] py-[clamp(8px,2vh,10px)] rounded-full bg-transparent text-gray-500 border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] text-[clamp(10px,2.5vw,11px)] font-bold uppercase tracking-[0.08em] transition-all active:scale-95 font-['Syne'] hover:border-[#FFD600] hover:text-black dark:hover:text-white"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            )}

            {/* Steps */}
            <div className="flex gap-[clamp(8px,2vw,10px)] mt-7">
              {[
                { icon: <QrCode size={clamp(18, 4, 22)} />, label: '1. Scan QR' },
                { icon: <Utensils size={clamp(18, 4, 22)} />, label: '2. Pick Food' },
                { icon: <Zap size={clamp(18, 4, 22)} />, label: '3. Pay & Go' },
              ].map((s) => (
                <div key={s.label} className="flex flex-col items-center gap-2 p-[clamp(12px,2.5vh,16px)] px-[clamp(8px,2vw,12px)] rounded-2xl bg-[rgba(255,214,0,0.12)] flex-1 transition-all hover:bg-[rgba(255,214,0,0.2)] hover:-translate-y-0.5">
                  <span className="text-black">{s.icon}</span>
                  <span className="text-[clamp(9px,2.5vw,10px)] font-bold text-gray-600 tracking-[0.06em] uppercase font-['Syne']">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#161616] border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] rounded-[clamp(20px,4vw,28px)] shadow-md p-[clamp(24px,4vh,28px)] p-[clamp(20px,4vw,24px)] text-center animate-scaleIn">
            <h2 className="text-[clamp(18px,5vw,20px)] font-extrabold text-black dark:text-white mb-4 font-['Syne']">
              Point at QR Code
            </h2>
            <div className="rounded-2xl overflow-hidden mb-5 relative">
              <div id="reader" className="bg-black min-h-[clamp(250px,40vh,300px)]" />
              <button 
                onClick={toggleCamera}
                className="absolute bottom-4 right-4 bg-[#FFD600] border-none rounded-full w-[clamp(40px,10vw,44px)] h-[clamp(40px,10vw,44px)] flex items-center justify-center shadow-lg cursor-pointer transition-all hover:scale-105 active:scale-95"
              >
                <RefreshCw size={clamp(18, 4, 20)} color="#000" />
              </button>
            </div>
            <button 
              onClick={() => setIsScanning(false)} 
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-transparent text-gray-500 border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] text-[13px] font-bold uppercase tracking-[0.08em] transition-all active:scale-95 font-['Syne'] hover:border-[#FFD600] hover:text-black dark:hover:text-white"
            >
              <X size={16} /> Cancel
            </button>
          </div>
        )}

        {/* Staff portal */}
        <div className="mt-5">
          {!showStaffLogin ? (
            <div className="text-center">
              <button
                onClick={() => setShowStaffLogin(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-transparent text-gray-500 border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] text-[13px] font-bold uppercase tracking-[0.08em] transition-all active:scale-95 font-['Syne'] hover:border-[#FFD600] hover:text-black dark:hover:text-white"
              >
                <UserCircle size={16} /> Staff Portal
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#161616] border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] rounded-[clamp(20px,4vw,28px)] shadow-md p-[clamp(28px,5vh,32px)] p-[clamp(20px,4vw,28px)] relative animate-scaleIn">
              <button
                onClick={() => setShowStaffLogin(false)}
                className="absolute top-4 right-4 bg-none border-none cursor-pointer text-gray-400 p-1 rounded-lg transition-colors hover:text-black dark:hover:text-white"
              >
                <X size={20} />
              </button>

              <h3 className="text-[clamp(18px,5vw,20px)] font-extrabold text-black dark:text-white mb-1.5 font-['Syne']">
                Staff Sign In
              </h3>
              <p className="text-gray-400 text-[clamp(12px,3vw,13px)] mb-6">Personnel access only</p>

              {error && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-2.5 px-3.5 mb-4 text-red-600 dark:text-red-400 text-[clamp(12px,3vw,13px)] font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="flex flex-col gap-3">
                <input
                  className="w-full px-[clamp(14px,3vw,18px)] py-[clamp(12px,2.5vh,15px)] bg-gray-100 dark:bg-gray-800 border border-transparent rounded-xl text-[clamp(14px,3.5vw,15px)] font-medium text-black dark:text-white outline-none transition-all focus:border-[#FFD600] focus:bg-white dark:focus:bg-gray-900 placeholder:text-gray-400"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoCapitalize="off"
                />
                <PasswordField
                  className="w-full px-[clamp(14px,3vw,18px)] py-[clamp(12px,2.5vh,15px)] bg-gray-100 dark:bg-gray-800 border border-transparent rounded-xl text-[clamp(14px,3.5vw,15px)] font-medium text-black dark:text-white outline-none transition-all focus:border-[#FFD600] focus:bg-white dark:focus:bg-gray-900 placeholder:text-gray-400"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button type="submit" className="w-full py-[clamp(14px,3.5vh,18px)] px-6 rounded-2xl bg-[#FFD600] text-black font-['Syne'] font-extrabold text-[clamp(15px,4vw,17px)] uppercase tracking-[0.04em] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(255,214,0,0.45)] active:translate-y-0 active:scale-98 flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(255,214,0,0.35)] mt-1">
                  Sign In <ArrowRight size={18} />
                </button>
              </form>
              
              <div className="mt-5 text-center">
                <p className="text-[clamp(11px,2.8vw,12px)] text-gray-500">New staff member? 
                  <button 
                    onClick={() => navigate('/staff/signup')}
                    className="bg-none border-none text-black dark:text-white font-extrabold cursor-pointer ml-1 hover:underline"
                  >
                    Register Here
                  </button>
                </p>
              </div>
              
              <div className="my-4 flex items-center gap-2.5">
                <div className="flex-1 h-px bg-[rgba(0,0,0,0.07)] dark:bg-[rgba(255,255,255,0.07)]" />
                <span className="text-[clamp(11px,2.8vw,12px)] text-gray-400">OR</span>
                <div className="flex-1 h-px bg-[rgba(0,0,0,0.07)] dark:bg-[rgba(255,255,255,0.07)]" />
              </div>
              
              <button onClick={handleGoogleLogin} className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-transparent text-gray-500 border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] text-[13px] font-bold uppercase tracking-[0.08em] transition-all active:scale-95 font-['Syne'] hover:border-[#FFD600] hover:text-black dark:hover:text-white">
                <Chrome size={18} /> Sign in with Google
              </button>
            </div>
          )}
        </div>

        {/* Customer Sign In Modal */}
        {showCustomerLogin && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
            <div className="w-full max-w-[400px] animate-scaleIn">
              <div className="bg-white dark:bg-[#161616] border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] rounded-[clamp(20px,4vw,28px)] shadow-md p-[clamp(28px,5vh,32px)] p-[clamp(20px,4vw,28px)] relative">
                <button
                  onClick={() => setShowCustomerLogin(false)}
                  className="absolute top-4 right-4 bg-none border-none cursor-pointer text-gray-400 p-1 rounded-lg transition-colors hover:text-black dark:hover:text-white"
                >
                  <X size={20} />
                </button>

                <h3 className="text-[clamp(20px,6vw,24px)] font-extrabold text-black dark:text-white mb-1.5 font-['Syne']">
                  Customer Sign In
                </h3>
                <p className="text-gray-400 text-[clamp(12px,3vw,13px)] mb-6">Access your receipts & deals</p>

                {error && (
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-2.5 px-3.5 mb-4 text-red-600 dark:text-red-400 text-[clamp(12px,3vw,13px)] font-medium">
                    {error}
                  </div>
                )}

                <form onSubmit={handleLogin} className="flex flex-col gap-3">
                  <input
                    className="w-full px-[clamp(14px,3vw,18px)] py-[clamp(12px,2.5vh,15px)] bg-gray-100 dark:bg-gray-800 border border-transparent rounded-xl text-[clamp(14px,3.5vw,15px)] font-medium text-black dark:text-white outline-none transition-all focus:border-[#FFD600] focus:bg-white dark:focus:bg-gray-900 placeholder:text-gray-400"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <PasswordField
                    className="w-full px-[clamp(14px,3vw,18px)] py-[clamp(12px,2.5vh,15px)] bg-gray-100 dark:bg-gray-800 border border-transparent rounded-xl text-[clamp(14px,3.5vw,15px)] font-medium text-black dark:text-white outline-none transition-all focus:border-[#FFD600] focus:bg-white dark:focus:bg-gray-900 placeholder:text-gray-400"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button type="submit" className="w-full py-[clamp(14px,3.5vh,18px)] px-6 rounded-2xl bg-[#FFD600] text-black font-['Syne'] font-extrabold text-[clamp(15px,4vw,17px)] uppercase tracking-[0.04em] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(255,214,0,0.45)] active:translate-y-0 active:scale-98 flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(255,214,0,0.35)] mt-1">
                    Sign In <ArrowRight size={18} />
                  </button>
                </form>
                
                <div className="my-4 flex items-center gap-2.5">
                  <div className="flex-1 h-px bg-[rgba(0,0,0,0.07)] dark:bg-[rgba(255,255,255,0.07)]" />
                  <span className="text-[clamp(11px,2.8vw,12px)] text-gray-400">OR</span>
                  <div className="flex-1 h-px bg-[rgba(0,0,0,0.07)] dark:bg-[rgba(255,255,255,0.07)]" />
                </div>
                
                <button onClick={handleGoogleLogin} className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-transparent text-gray-500 border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] text-[13px] font-bold uppercase tracking-[0.08em] transition-all active:scale-95 font-['Syne'] hover:border-[#FFD600] hover:text-black dark:hover:text-white">
                  <Chrome size={18} /> Sign in with Google
                </button>
                
                <div className="mt-5 text-center">
                  <p className="text-[clamp(11px,2.8vw,12px)] text-gray-500">Don't have an account? 
                    <button 
                      onClick={() => navigate('/signup')}
                      className="bg-none border-none text-black dark:text-white font-extrabold cursor-pointer ml-1 hover:underline"
                    >
                      Sign Up
                    </button>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function for clamp values in inline styles
function clamp(min, preferred, max) {
  if (typeof preferred === 'string') {
    return preferred;
  }
  return Math.min(max, Math.max(min, preferred));
}

export default Login;
