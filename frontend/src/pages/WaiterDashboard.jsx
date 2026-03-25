import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Bell, Check, Utensils, ArrowLeft, QrCode, X, Zap, Upload, LogOut, RefreshCw } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  fetchUserProfile,
  getDashboardPath,
  getEffectiveBranchId,
  getEffectiveRole,
  isManagementRole,
} from '../authProfile';

/* ── Fonts + keyframes (injected once) ─────────────────────────── */
if (!document.querySelector('[data-wd-fonts]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&family=DM+Sans:wght@300;400;500&display=swap';
  link.setAttribute('data-wd-fonts', '');
  document.head.appendChild(link);

  const style = document.createElement('style');
  style.setAttribute('data-wd-styles', '');
  style.textContent = `
    .font-syne { font-family: 'Syne', sans-serif !important; }
    .font-dm   { font-family: 'DM Sans', sans-serif !important; }

    @keyframes wd-fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes wd-scaleIn {
      from { opacity: 0; transform: scale(.94); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes wd-pulse-ring {
      0%   { transform: scale(1);   opacity: .5; }
      70%  { transform: scale(1.4); opacity: 0;  }
      100% { transform: scale(1.4); opacity: 0;  }
    }
    @keyframes wd-breathe {
      0%, 100% { box-shadow: 0 0 0 0   rgba(255,214,0,.0);  }
      50%       { box-shadow: 0 0 0 8px rgba(255,214,0,.12); }
    }

    .anim-1 { animation: wd-fadeUp .5s .00s cubic-bezier(.22,1,.36,1) both; }
    .anim-2 { animation: wd-fadeUp .5s .07s cubic-bezier(.22,1,.36,1) both; }
    .anim-3 { animation: wd-fadeUp .5s .14s cubic-bezier(.22,1,.36,1) both; }
    .modal-in { animation: wd-scaleIn .3s cubic-bezier(.22,1,.36,1) both; }

    .pulse-dot::before {
      content: '';
      position: absolute; inset: 0; border-radius: 9999px;
      background: rgba(255,214,0,.4);
      animation: wd-pulse-ring 2.2s ease-out infinite;
    }

    .order-card { transition: box-shadow .22s ease, transform .22s ease; }
    .order-card:hover { box-shadow: 0 12px 40px rgba(0,0,0,.09); transform: translateY(-3px); }
    .order-card-live { animation: wd-breathe 3s ease-in-out infinite; }

    .serve-btn { transition: all .18s cubic-bezier(.22,1,.36,1); }
    .serve-btn:hover  { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(255,214,0,.45); }
    .serve-btn:active { transform: scale(.97); }

    .scanner-wrapper #wd-reader        { border: none !important; }
    .scanner-wrapper #wd-reader video  { border-radius: 16px; }
  `;
  document.head.appendChild(style);
}

/* ══════════════════════════════════════════════════════════════════
   Component
══════════════════════════════════════════════════════════════════ */
export default function WaiterDashboard() {
  const { branchId } = useParams();
  const navigate     = useNavigate();
  const scannerRef   = useRef(null);
  const scanLockRef  = useRef(false);

  const [orders,           setOrders]           = useState([]);
  const [showScanner,      setShowScanner]      = useState(false);
  const [scanResult,       setScanResult]       = useState(null);
  const [scannerError,     setScannerError]     = useState('');
  const [scannerRetryKey,  setScannerRetryKey]  = useState(0);
  const [isStartingScan,   setIsStartingScan]   = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isLoggingOut,     setIsLoggingOut]     = useState(false);

  const [user, setUser] = useState(null);
  const [isMgmt, setIsMgmt] = useState(false);

  useEffect(() => {
    const syncUser = async (sessionArg = null) => {
      const session = sessionArg ?? (await supabase.auth.getSession()).data.session;

      if (!session?.user) {
        navigate('/login', { replace: true });
        return;
      }

      setUser(session.user);

      const profile = await fetchUserProfile(session.user.id).catch((profileError) => {
        console.error('Failed to load profile:', profileError);
        return null;
      });

      const role = getEffectiveRole(session.user, profile);
      const assignedBranchId = getEffectiveBranchId(session.user, profile);
      const destination = getDashboardPath(role, assignedBranchId);

      setIsMgmt(isManagementRole(role));

      if (!role) return;

      if (!['admin', 'manager', 'supervisor', 'waiter'].includes(role)) {
        navigate(destination || '/login', { replace: true });
        return;
      }

      if (role !== 'admin' && !assignedBranchId) {
        navigate(destination || '/staff/pending', { replace: true });
        return;
      }

      if (role !== 'admin' && assignedBranchId && String(assignedBranchId) !== String(branchId)) {
        navigate(`/waiter/${assignedBranchId}`, { replace: true });
      }
    };

    syncUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncUser(session);
    });

    return () => subscription.unsubscribe();
  }, [branchId, navigate]);

  /* ── Polling ────────────────────────────────────────────────── */
  useEffect(() => {
    fetchOrders();
    
    // Real-time subscription for served orders
    const ordersSubscription = supabase
      .channel('waiter_orders')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders',
        filter: `branch_id=eq.${branchId}`
      }, fetchOrders)
      .subscribe();

    return () => {
      supabase.removeChannel(ordersSubscription);
    };
  }, [branchId]);

  const getScannerErrorMessage = (err) => {
    const message = String(err?.message || err || '').toLowerCase();

    const isSecureContextMissing =
      window.location.protocol !== 'https:' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1';

    if (!navigator.mediaDevices?.getUserMedia) {
      return 'Camera access is not supported in this browser.';
    }

    if (isSecureContextMissing) {
      return 'Camera access requires HTTPS or localhost.';
    }

    if (message.includes('permission') || message.includes('notallowed')) {
      return 'Camera permission was blocked. Allow camera access and try again.';
    }

    if (message.includes('notfound') || message.includes('device not found') || message.includes('no camera')) {
      return 'No camera was found on this device.';
    }

    if (message.includes('notreadable') || message.includes('trackstart')) {
      return 'The camera is busy in another app. Close it there and retry.';
    }

    return 'Could not start the camera. Try again or use image upload instead.';
  };

  const pickPreferredCamera = (cameras) => {
    if (!Array.isArray(cameras) || cameras.length === 0) return null;

    return (
      cameras.find((camera) => /(back|rear|environment)/i.test(camera.label || '')) ||
      cameras[0]
    );
  };

  const stopScannerInstance = async (scanner) => {
    if (!scanner) return;

    try {
      await scanner.stop();
    } catch (stopError) {
      const message = String(stopError?.message || stopError || '').toLowerCase();

      if (!message.includes('not started') && !message.includes('scanner is not running')) {
        console.error('Failed to stop waiter scanner:', stopError);
      }
    }

    try {
      scanner.clear();
    } catch (clearError) {
      console.error('Failed to clear waiter scanner:', clearError);
    }
  };

  /* ── QR Scanner ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!showScanner) return;
    let disposed = false;
    let scanner = null;

    scanLockRef.current = false;
    setScannerError('');
    setIsStartingScan(true);

    const startScanner = async () => {
      scanner = new Html5Qrcode('wd-reader');
      scannerRef.current = scanner;

      try {
        const config = { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 };
        let cameraTarget = { facingMode: 'environment' };

        try {
          const cameras = await Html5Qrcode.getCameras();
          const preferredCamera = pickPreferredCamera(cameras);

          if (preferredCamera?.id) {
            cameraTarget = preferredCamera.id;
          }
        } catch (cameraListError) {
          console.warn('Could not load camera list, using default facing mode:', cameraListError);
        }

        await scanner.start(cameraTarget, config, onScanSuccess, () => {});

        if (disposed) {
          await stopScannerInstance(scanner);
        }
      } catch (err) {
        console.error('Failed to start waiter scanner:', err);

        if (!disposed) {
          setScannerError(getScannerErrorMessage(err));
        }

        await stopScannerInstance(scanner);
      } finally {
        if (!disposed) {
          setIsStartingScan(false);
        }
      }
    };

    startScanner();

    return () => {
      disposed = true;

      if (scannerRef.current === scanner) {
        scannerRef.current = null;
      }

      void stopScannerInstance(scanner);
    };
  }, [showScanner, scannerRetryKey]);

  const onScanSuccess = async (decodedText) => {
    if (scanLockRef.current) return;

    scanLockRef.current = true;

    try {
      // Logic for scan completion:
      // If code starts with "RECEIPT-", it's an order completion
      if (decodedText.startsWith('RECEIPT-')) {
        const orderId = decodedText.replace('RECEIPT-', '');
        const { error } = await supabase
          .from('orders')
          .update({ status: 'completed' })
          .eq('id', orderId);
        
        if (error) throw error;

        setScanResult({ success: true, message: 'Order marked as completed' });
      } else {
        throw new Error('Invalid QR code format');
      }
      setShowScanner(false);
      fetchOrders();
    } catch (err) {
      setScanResult({ success: false, message: err.message || 'Scan failed' });
      setShowScanner(false);
    }
  };

  const handleOpenScanner = () => {
    setScanResult(null);
    setScannerError('');
    setScannerRetryKey((current) => current + 1);
    setShowScanner(true);
  };

  const handleCloseScanner = () => {
    setShowScanner(false);
    setIsStartingScan(false);
  };

  const handleRetryScanner = () => {
    scanLockRef.current = false;
    setScannerError('');
    setScannerRetryKey((current) => current + 1);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsProcessingFile(true);
    const qr = new Html5Qrcode('wd-reader-file-temp');
    try {
      const decoded = await qr.scanFile(file, true);
      await onScanSuccess(decoded);
    } catch {
      setScanResult({ success: false, message: 'Could not find QR code in image' });
    } finally {
      setIsProcessingFile(false);
      try {
        qr.clear();
      } catch (clearError) {
        console.error('Failed to clear uploaded QR scanner:', clearError);
      }
    }
  };

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            quantity,
            menu_items (
              name,
              image_url
            )
          )
        `)
        .eq('branch_id', branchId)
        .eq('status', 'served')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Transform for UI
      const transformed = data.map(order => ({
        ...order,
        items: order.order_items.map(oi => ({
          quantity: oi.quantity,
          menu_item: oi.menu_item
        }))
      }));

      setOrders(transformed);
    } catch (err) {
      console.error(err);
    }
  };

  const completeOrder = async (orderId) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'completed' })
        .eq('id', orderId);
      
      if (error) throw error;
      fetchOrders();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Failed to sign out:', err);
      setScanResult({ success: false, message: 'Could not sign out right now' });
      setIsLoggingOut(false);
    }
  };

  /* ── Main ─────────────────────────────────────────────────────── */
  return (
    <div className="font-dm min-h-svh bg-[#f2f2f0] pb-24">

      {/* ── Dark top bar ──────────────────────────────────────── */}
      <div className="bg-[#0a0a0a] px-5 pt-12 pb-24 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 opacity-[0.04] rotate-12 pointer-events-none">
          <Bell size={220} color="#fff" />
        </div>

        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          {/* Brand */}
          <div className="anim-1 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#FFD600] flex items-center justify-center shrink-0">
              <Zap size={26} color="#0a0a0a" fill="#0a0a0a" />
            </div>
            <div>
              {isMgmt && (
                <button
                  onClick={() => navigate(`/branch/${branchId}`)}
                  className="flex items-center gap-1.5 text-gray-500 hover:text-[#FFD600] font-syne font-bold text-xs uppercase tracking-widest mb-1 transition-colors"
                >
                  <ArrowLeft size={13} /> Back to Dashboard
                </button>
              )}
              <h1 className="font-syne text-2xl font-extrabold text-white leading-tight">
                Waiter Service
              </h1>
            </div>
          </div>

          {/* Ready orders count + scan button */}
          <div className="anim-1 flex items-center gap-3 flex-wrap sm:justify-end">
            {orders.length > 0 && (
              <div className="flex items-center gap-2 bg-[#FFD600]/10 border border-[#FFD600]/20 px-5 py-3 rounded-2xl">
                <div className="pulse-dot relative w-2.5 h-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FFD600] relative z-10" />
                </div>
                <span className="font-syne text-sm font-bold text-[#FFD600]">
                  {orders.length} ready to serve
                </span>
              </div>
            )}
            <button
              onClick={handleOpenScanner}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-syne font-bold text-sm uppercase tracking-wide px-5 py-3 rounded-2xl transition-all active:scale-95"
            >
              <QrCode size={16} /> Scan Receipt
            </button>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-2 bg-white text-[#0a0a0a] hover:bg-[#FFD600] font-syne font-bold text-sm uppercase tracking-wide px-5 py-3 rounded-2xl transition-all active:scale-95 disabled:opacity-60 disabled:pointer-events-none"
            >
              <LogOut size={16} />
              {isLoggingOut ? 'Signing Out...' : 'Logout'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────── */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 -mt-12 space-y-5">

        {/* Scan result toast */}
        {scanResult && (
          <div className={`anim-2 rounded-2xl border px-5 py-4 flex items-center justify-between gap-4
            ${scanResult.success
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-600'}`}
          >
            <div className="flex items-center gap-3">
              {scanResult.success
                ? <Check size={18} strokeWidth={2.5} />
                : <X size={18} strokeWidth={2.5} />}
              <p className="font-syne font-bold text-sm uppercase tracking-wide">
                {scanResult.message}
              </p>
            </div>
            <button
              onClick={() => setScanResult(null)}
              className="opacity-50 hover:opacity-100 transition-opacity"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Orders */}
        {orders.length === 0 ? (
          <div className="anim-2 bg-white rounded-3xl border border-black/[0.06] shadow-sm p-20 flex flex-col items-center gap-5 text-center">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
              <Utensils size={32} className="text-gray-300" />
            </div>
            <div>
              <p className="font-syne text-xl font-black text-[#0a0a0a] mb-2">All Clear</p>
              <p className="font-dm text-base text-gray-400 leading-relaxed">
                No orders are ready to serve right now. Check back shortly.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order, idx) => (
              <div
                key={order.id}
                className="order-card order-card-live bg-white rounded-3xl border border-black/[0.06] shadow-sm overflow-hidden"
                style={{ animationDelay: `${idx * 0.06}s` }}
              >
                {/* Yellow top accent */}
                <div className="h-1.5 bg-[#FFD600] w-full" />

                {/* Order header */}
                <div className="px-6 pt-6 pb-5 flex items-center justify-between border-b border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-[#FFD600] flex items-center justify-center shrink-0">
                      <span className="font-syne text-xl font-black text-[#0a0a0a]">
                        T{order.table_id}
                      </span>
                    </div>
                    <div>
                      <p className="font-syne text-lg font-extrabold text-[#0a0a0a] leading-snug">
                        Table {order.table_id}
                      </p>
                      <p className="font-syne text-xs font-bold uppercase tracking-wide text-green-600 mt-0.5">
                        ● Order Ready
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-dm text-xs text-gray-400 mb-0.5">
                      {order.is_paid ? '✓ Paid' : 'Unpaid'}
                    </p>
                    <p className="font-syne text-2xl font-black text-[#0a0a0a]">
                      ${order.total_amount}
                    </p>
                  </div>
                </div>

                {/* Items */}
                <div className="px-6 py-5 space-y-2.5">
                  <p className="font-syne text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                    {order.items.length} {order.items.length === 1 ? 'Item' : 'Items'}
                  </p>
                  {order.items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3.5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-syne text-sm font-black text-[#FFD600] bg-[#0a0a0a] w-7 h-7 rounded-lg flex items-center justify-center shrink-0">
                          {item.quantity}
                        </span>
                        {item.menu_item?.image_url && (
                          <img src={item.menu_item.image_url} alt="" className="w-8 h-8 rounded-lg object-cover border border-black/[0.05]" />
                        )}
                        <span className="font-dm text-base text-[#0a0a0a]">
                          {item.menu_item?.name || 'Unknown Item'}
                        </span>
                      </div>
                      <Utensils size={15} className="text-gray-300 shrink-0" />
                    </div>
                  ))}
                </div>

                {/* Complete button */}
                <div className="px-6 pb-6">
                  <button
                    onClick={() => completeOrder(order.id)}
                    className="serve-btn w-full bg-[#FFD600] text-[#0a0a0a] font-syne font-extrabold text-base uppercase tracking-wide py-5 rounded-2xl flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(255,214,0,.3)]"
                  >
                    <Check size={20} strokeWidth={3} /> Served & Complete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Scanner modal ─────────────────────────────────────── */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="modal-in bg-white rounded-3xl shadow-2xl w-full max-w-md border border-black/[0.06] overflow-hidden">

            {/* Modal header */}
            <div className="bg-[#0a0a0a] px-7 py-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFD600] flex items-center justify-center shrink-0">
                  <QrCode size={18} color="#0a0a0a" />
                </div>
                <h2 className="font-syne text-xl font-extrabold text-white">Scan Receipt</h2>
              </div>
              <button
                onClick={handleCloseScanner}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scanner area */}
            <div className="px-7 py-6 space-y-5">
              <div className="scanner-wrapper rounded-2xl overflow-hidden border border-gray-100 bg-[#0a0a0a] relative min-h-[280px]">
                <div id="wd-reader" className="min-h-[280px]" />

                {isStartingScan && (
                  <div className="absolute inset-0 bg-[#0a0a0a]/90 flex flex-col items-center justify-center gap-3 text-white">
                    <RefreshCw size={22} className="animate-spin" />
                    <p className="font-syne text-xs font-bold uppercase tracking-widest text-white/70">
                      Opening Camera
                    </p>
                  </div>
                )}
              </div>

              {scannerError && (
                <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-4 space-y-3">
                  <p className="font-syne text-xs font-bold uppercase tracking-wide text-red-600">
                    {scannerError}
                  </p>
                  <button
                    type="button"
                    onClick={handleRetryScanner}
                    className="w-full flex items-center justify-center gap-2 bg-[#0a0a0a] text-white font-syne font-bold text-sm uppercase tracking-wide py-3 rounded-2xl transition-all active:scale-95"
                  >
                    <RefreshCw size={16} />
                    Retry Camera
                  </button>
                </div>
              )}

              {/* Hidden element for file scanning */}
              <div id="wd-reader-file-temp" className="hidden" />

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="font-syne text-xs font-bold uppercase tracking-wider text-gray-400">or upload image</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* File upload */}
              <label className={`flex items-center justify-center gap-2.5 w-full py-4 bg-gray-100 hover:bg-gray-200 rounded-2xl font-syne font-bold text-sm uppercase tracking-wide text-[#0a0a0a] cursor-pointer transition-all active:scale-[.99]
                ${isProcessingFile ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileUpload}
                />
                <Upload size={16} strokeWidth={2.5} />
                {isProcessingFile ? 'Processing…' : 'Choose File'}
              </label>

              <p className="text-center font-dm text-xs text-gray-400">
                Point camera at a receipt QR code, or upload a photo of the receipt.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
