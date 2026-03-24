import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { QRCodeCanvas } from 'qrcode.react';
import { History, ArrowLeft, Receipt, ShoppingBag, Zap, ChevronRight, UserCircle, LogOut, Bell, X } from 'lucide-react';

/* ── Fonts + keyframes (injected once) ─────────────────────────── */
if (!document.querySelector('[data-ch-fonts]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&family=DM+Sans:wght@300;400;500&display=swap';
  link.setAttribute('data-ch-fonts', '');
  document.head.appendChild(link);

  const style = document.createElement('style');
  style.setAttribute('data-ch-styles', '');
  style.textContent = `
    .font-syne { font-family: 'Syne', sans-serif !important; }
    .font-dm   { font-family: 'DM Sans', sans-serif !important; }

    @keyframes ch-fadeUp {
      from { opacity: 0; transform: translateY(22px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes ch-spin { to { transform: rotate(360deg); } }
    @keyframes ch-pulse {
      0%, 100% { transform: scale(1);    opacity: .5; }
      50%       { transform: scale(1.38); opacity: 0;  }
    }

    .anim-1 { animation: ch-fadeUp .5s .00s cubic-bezier(.22,1,.36,1) both; }
    .anim-2 { animation: ch-fadeUp .5s .09s cubic-bezier(.22,1,.36,1) both; }
    .anim-3 { animation: ch-fadeUp .5s .18s cubic-bezier(.22,1,.36,1) both; }
    .anim-4 { animation: ch-fadeUp .5s .27s cubic-bezier(.22,1,.36,1) both; }
    .anim-expand { animation: ch-fadeUp .3s cubic-bezier(.22,1,.36,1) both; }

    .ch-spinner {
      width: 52px; height: 52px; border-radius: 50%;
      border: 3px solid rgba(255,214,0,.15);
      border-top-color: #FFD600;
      animation: ch-spin .8s linear infinite;
    }
    .pulse-ring {
      position: absolute; inset: 0; border-radius: 9999px;
      background: rgba(255,214,0,.4);
      animation: ch-pulse 2.4s ease-out infinite;
    }
    .order-card { transition: box-shadow .22s ease, transform .22s ease; }
    .order-card:hover { box-shadow: 0 10px 36px rgba(0,0,0,.10); transform: translateY(-3px); }
    .chevron-wrap { transition: transform .22s ease, background .22s ease; }
    
    @media (max-width: 480px) {
      .order-card:hover {
        transform: none;
      }
    }
  `;
  document.head.appendChild(style);
}

/* ── Helpers ───────────────────────────────────────────────────── */
const STATUS = {
  pending:   { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Sent to Kitchen' },
  preparing: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Chef Preparing' },
  served:    { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Serving…' },
  completed: { bg: 'bg-gray-100',   text: 'text-gray-500',   label: 'Enjoyed' },
  cancelled: { bg: 'bg-red-100',    text: 'text-red-600',    label: 'Cancelled' },
};

function getStep(status) {
  return { pending: 1, preparing: 2, served: 3, completed: 4, cancelled: 0 }[status] || 0;
}

function getReceiptCode(orderId) {
  return `RECEIPT-${orderId}`;
}

/* ══════════════════════════════════════════════════════════════════
   Component
══════════════════════════════════════════════════════════════════ */
export default function CustomerHistory() {
  const [orders,        setOrders]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [user,          setUser]          = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [selectedQr,    setSelectedQr]    = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifs,     setShowNotifs]     = useState(false);
  const navigate = useNavigate();

  const ordersRef = useRef(orders);
  useEffect(() => { ordersRef.current = orders; }, [orders]);

  useEffect(() => {
    fetchOrders();
    fetchNotifications();

    const ordersSubscription = supabase
      .channel('history_orders')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders',
        filter: `user_id=eq.${user?.id}`
      }, () => fetchOrders(false))
      .subscribe();

    const notifsSubscription = supabase
      .channel('history_notifs')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user?.id}`
      }, fetchNotifications)
      .subscribe();

    return () => {
      supabase.removeChannel(ordersSubscription);
      supabase.removeChannel(notifsSubscription);
    };
  }, [user?.id]);

  const fetchOrders = async (showLoading = true) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/login'); return; }
      
      const currentUser = session.user;
      setUser(currentUser);

      if (showLoading) setLoading(true);

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            quantity,
            price_at_order,
            menu_items (
              name
            )
          )
        `)
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform for UI
      const transformed = data.map(order => ({
        ...order,
        items: order.order_items.map(oi => ({
          quantity: oi.quantity,
          price_at_order: oi.price_at_order,
          menu_item: oi.menu_items
        }))
      }));

      setOrders(transformed);
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setNotifications(data);
    } catch (err) { console.error(err); }
  };

  const markNotifRead = async (id) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      
      if (error) throw error;
      fetchNotifications();
    } catch (err) { console.error(err); }
  };

  const handleLogout = async () => { 
    await supabase.auth.signOut();
    navigate('/login'); 
  };

  /* ── Loading ────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="font-dm min-h-screen bg-[#f2f2f0] flex flex-col items-center justify-center gap-5">
        <div className="ch-spinner" />
        <p className="font-syne text-xs font-bold uppercase tracking-widest text-gray-400">
          Loading orders…
        </p>
      </div>
    );
  }

  /* ── Main ───────────────────────────────────────────────────── */
  return (
    <div className="font-dm min-h-screen bg-[#f2f2f0] pb-[80px] sm:pb-24">

      {/* ── Dark top bar ────────────────────────────────────────── */}
      <div className="bg-[#0a0a0a] px-[16px] sm:px-5 pt-[40px] sm:pt-12 pb-[60px] sm:pb-24 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 opacity-[0.04] rotate-12 pointer-events-none">
          <History size={160} color="#fff" />
        </div>
        <div className="max-w-xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="anim-1 flex items-center gap-3 sm:gap-4">
            <div className="w-[44px] sm:w-12 h-[44px] sm:h-12 rounded-2xl bg-[#FFD600] flex items-center justify-center shrink-0">
              <Zap size={18} color="#0a0a0a" fill="#0a0a0a" />
            </div>
            <div className="min-w-0">
              <p className="font-syne text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
                Welcome back
              </p>
              <h1 className="font-syne text-[18px] sm:text-2xl font-extrabold text-white leading-tight truncate max-w-[180px] sm:max-w-none">
                {user?.email}
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 anim-1">
            <button 
              onClick={() => setShowNotifs(true)}
              className="relative w-[36px] sm:w-11 h-[36px] sm:h-11 rounded-2xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95"
            >
              <Bell size={16} />
              {notifications.filter(n => !n.is_read).length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] sm:min-w-4 h-[14px] sm:h-4 rounded-full bg-red-500 border-2 border-[#0a0a0a] text-[8px] sm:text-[9px] font-black flex items-center justify-center px-0.5">
                  {notifications.filter(n => !n.is_read).length}
                </span>
              )}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 sm:gap-2 bg-white/10 hover:bg-white/20 text-white font-syne font-bold text-[10px] sm:text-xs uppercase tracking-wider px-3 sm:px-5 py-2 sm:py-3 rounded-xl transition-all active:scale-95"
            >
              <LogOut size={13} /> <span className="hidden xs:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="max-w-xl mx-auto px-[16px] sm:px-4 space-y-4 sm:space-y-6">

        {/* Profile card — floats over dark bar */}
        <div className="anim-2 -mt-[48px] sm:-mt-14 bg-white rounded-3xl shadow-lg border border-black/[0.05] p-5 sm:p-7 flex items-center gap-4 sm:gap-5">
          <div className="w-[56px] sm:w-16 h-[56px] sm:h-16 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
            <UserCircle size={28} color="#0a0a0a" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-syne text-[16px] sm:text-xl font-extrabold text-[#0a0a0a] leading-snug truncate">
              {user?.email}
            </p>
            <p className="font-dm text-[11px] sm:text-sm text-gray-400 mt-0.5 sm:mt-1">
              Gold Member ·{' '}
              <span className="text-yellow-600 font-semibold">3 Deals Ready</span>
            </p>
          </div>
          {/* order count bubble */}
          <div className="relative flex items-center justify-center">
            <div className="pulse-ring" />
            <div className="relative w-[44px] sm:w-12 h-[44px] sm:h-12 rounded-full bg-[#FFD600] flex items-center justify-center">
              <span className="font-syne text-[14px] sm:text-base font-black text-[#0a0a0a]">{orders.length}</span>
            </div>
          </div>
        </div>

        {/* Section heading */}
        <div className="anim-3 flex items-center justify-between px-1 pt-1 sm:pt-2 flex-wrap gap-2">
          <h2 className="font-syne text-[20px] sm:text-2xl font-black text-[#0a0a0a] tracking-tight">
            Your Orders
          </h2>
          <span className="font-syne text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-yellow-100 text-yellow-700 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full">
            {orders.length} receipts
          </span>
        </div>

        {/* Orders list */}
        <div className="anim-4 space-y-3 sm:space-y-4">

          {orders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-black/[0.06] shadow-sm p-8 sm:p-16 flex flex-col items-center text-center gap-4 sm:gap-5">
              <div className="w-20 sm:w-24 h-20 sm:h-24 rounded-full bg-gray-100 flex items-center justify-center">
                <ShoppingBag size={32} className="text-gray-300" />
              </div>
              <div className="space-y-2">
                <p className="font-syne text-[20px] sm:text-2xl font-black text-[#0a0a0a]">No orders yet</p>
                <p className="font-dm text-[14px] sm:text-base text-gray-400 leading-relaxed max-w-xs">
                  Your order history will appear here once you've placed your first order.
                </p>
              </div>
              <Link
                to="/"
                className="inline-flex items-center gap-2 bg-[#FFD600] text-[#0a0a0a] font-syne font-extrabold text-[14px] sm:text-base uppercase tracking-wide px-6 sm:px-8 py-3 sm:py-4 rounded-2xl shadow-[0_4px_20px_rgba(255,214,0,.35)] hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(255,214,0,.45)] active:scale-95 transition-all mt-2"
              >
                Go to Table
              </Link>
            </div>
          ) : (
            orders.map(order => {
              const isExpanded = expandedOrder === order.id;
              const st = STATUS[order.status] || STATUS.completed;
              const currentStep = getStep(order.status);
              const pct = order.status === 'cancelled' ? 0 : Math.min((currentStep / 4) * 100, 100);
              const isActive = !['completed', 'cancelled'].includes(order.status);

              return (
                <div
                  key={order.id}
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  className={`order-card bg-white rounded-3xl border border-black/[0.06] shadow-sm overflow-hidden relative cursor-pointer ${isExpanded ? 'shadow-xl' : ''}`}
                >
                  {/* yellow left accent */}
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#FFD600] rounded-l-3xl" />

                  {/* Card header */}
                  <div className="pl-5 sm:pl-7 pr-4 sm:pr-5 py-5 sm:py-7 flex items-center gap-3 sm:gap-4">
                    {/* Order # badge */}
                    <div className="w-12 sm:w-14 h-12 sm:h-14 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
                      <span className="font-syne text-[12px] sm:text-base font-black text-[#0a0a0a]">#{order.id}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1 sm:space-y-1.5">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="font-syne text-[12px] sm:text-base font-extrabold text-[#0a0a0a]">
                          {new Date(order.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric',
                          })}
                        </span>
                        <span className={`font-syne text-[9px] sm:text-[11px] font-bold uppercase tracking-wide px-2 sm:px-3 py-0.5 rounded-full ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>
                      </div>

                      <p className="font-dm text-[11px] sm:text-sm text-gray-400 flex items-center gap-1 sm:gap-1.5">
                        <Receipt size={11} />
                        {order.items.length} {order.items.length === 1 ? 'item' : 'items'} · ${order.total_amount}
                      </p>

                      <div className="h-1 sm:h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1 sm:mt-1.5 flex gap-0.5">
                        {[1, 2, 3, 4].map(step => (
                          <div 
                            key={step}
                            className={`h-full flex-1 transition-all duration-500 ${step <= currentStep ? 'bg-[#FFD600]' : 'bg-gray-200'} ${order.status === 'cancelled' ? 'bg-red-400' : ''}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Chevron */}
                    <div className={`chevron-wrap w-8 sm:w-10 h-8 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${isExpanded ? 'bg-[#FFD600] rotate-90' : 'bg-gray-100'}`}>
                      <ChevronRight
                        size={14}
                        strokeWidth={2.5}
                        className={isExpanded ? 'text-[#0a0a0a]' : 'text-gray-400'}
                      />
                    </div>
                  </div>

                  {/* Expanded body */}
                  {isExpanded && (
                    <div className="anim-expand border-t border-dashed border-gray-100 px-5 sm:px-7 py-5 sm:py-7 space-y-5 sm:space-y-7">

                      {/* Items list */}
                      <div>
                        <p className="font-syne text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 sm:mb-5">
                          Order Summary
                        </p>
                        <div className="space-y-3 sm:space-y-4">
                          {order.items.map((item, i) => (
                            <div key={i} className="flex items-center justify-between gap-2">
                              <span className="font-dm text-[13px] sm:text-base text-gray-600 break-words flex-1">
                                <span className="text-gray-400 mr-1 sm:mr-1.5">{item.quantity}×</span>
                                <span className="break-words">{item.menu_item?.name}</span>
                              </span>
                              <span className="font-syne text-[13px] sm:text-base font-bold text-[#0a0a0a] shrink-0">
                                ${item.price_at_order * item.quantity}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Total */}
                        <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-dashed border-gray-200 flex items-center justify-between flex-wrap gap-2">
                          <span className="font-syne text-[11px] sm:text-sm font-bold uppercase tracking-wide text-gray-400">
                            Total Paid
                          </span>
                          <span className="font-syne text-[20px] sm:text-2xl font-black text-[#0a0a0a]">
                            ${order.total_amount}
                          </span>
                        </div>
                      </div>

                      {/* QR code */}
                      <div className="flex flex-col xs:flex-row items-center justify-between gap-4 sm:gap-5 bg-gray-50 rounded-2xl p-4 sm:p-5">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="bg-white p-2 rounded-xl shadow-sm shrink-0">
                            <QRCodeCanvas
                              value={getReceiptCode(order.id)}
                              size={56}
                              level="H"
                              includeMargin={true}
                              className="block rounded-lg"
                            />
                          </div>
                          <p className="font-dm text-[11px] sm:text-sm text-gray-400 leading-relaxed max-w-[140px] sm:max-w-[160px]">
                            Show this to the waiter to serve your order.
                          </p>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedQr(getReceiptCode(order.id)); }}
                          className="bg-[#0a0a0a] text-white font-syne font-bold text-[9px] sm:text-[10px] uppercase tracking-widest px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl hover:bg-[#FFD600] hover:text-[#0a0a0a] transition-all active:scale-95 whitespace-nowrap"
                        >
                          View QR
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Deals footer */}
        <div className="bg-[#0a0a0a] rounded-3xl p-5 sm:p-8 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 opacity-[0.06] pointer-events-none">
            <Zap size={120} color="#FFD600" fill="#FFD600" />
          </div>

          <p className="font-syne text-[9px] sm:text-xs font-semibold uppercase tracking-widest text-gray-600 mb-1.5 sm:mb-2">
            Exclusive for {user?.email?.split('@')[0]}
          </p>
          <h2 className="font-syne text-[20px] sm:text-2xl font-black text-white mb-5 sm:mb-8">
            Special Deals
          </h2>

          <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4 mb-5 sm:mb-8">
            {[
              { title: 'Free Coffee', sub: 'Valid on next visit' },
              { title: '10% Off',     sub: 'Orders over $50'    },
            ].map(d => (
              <div key={d.title} className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6">
                <p className="font-syne text-[14px] sm:text-lg font-extrabold text-[#FFD600] mb-1 sm:mb-1.5">{d.title}</p>
                <p className="font-dm text-[11px] sm:text-sm text-gray-500">{d.sub}</p>
              </div>
            ))}
          </div>

          <Link
            to="/"
            className="inline-flex items-center gap-2 font-syne text-[11px] sm:text-sm font-bold uppercase tracking-wider text-gray-500 hover:text-[#FFD600] transition-colors"
          >
            <ArrowLeft size={13} /> Back to Dining
          </Link>
        </div>

      </div>
      
      {/* ── QR MODAL ────────────────────────────────────────────── */}
      {selectedQr && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[150] flex items-center justify-center p-4 sm:p-6" onClick={() => setSelectedQr(null)}>
          <div className="anim-scale bg-white rounded-[32px] sm:rounded-[40px] p-6 sm:p-10 flex flex-col items-center gap-6 sm:gap-8 max-w-[320px] sm:max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-1.5 sm:space-y-2">
              <h3 className="font-syne text-[20px] sm:text-2xl font-black text-[#0a0a0a] uppercase tracking-tighter">Your Receipt</h3>
              <p className="font-dm text-[11px] sm:text-sm text-gray-400">Order verification code</p>
            </div>
            
            <div className="bg-gray-50 p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] border border-black/[0.03]">
              <QRCodeCanvas
                value={selectedQr}
                size={224}
                level="H"
                includeMargin={true}
                className="block rounded-xl"
              />
            </div>

            <button 
              onClick={() => setSelectedQr(null)}
              className="w-full bg-[#0a0a0a] text-white font-syne font-extrabold text-[12px] sm:text-sm uppercase tracking-widest py-4 sm:py-5 rounded-2xl active:scale-95 transition-all shadow-lg"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── NOTIFICATIONS MODAL ────────────────────────────────── */}
      {showNotifs && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[200] flex items-center justify-center p-3 sm:p-4">
          <div className="anim-scale bg-white rounded-[28px] sm:rounded-[40px] shadow-2xl w-full max-w-md border border-black/[0.06] overflow-hidden mx-3 sm:mx-4">
            <div className="bg-[#0a0a0a] px-5 sm:px-8 py-5 sm:py-7 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-xl bg-[#FFD600] flex items-center justify-center shrink-0">
                  <Bell size={14} color="#0a0a0a" />
                </div>
                <h3 className="font-syne text-[16px] sm:text-xl font-extrabold text-white uppercase tracking-tighter">Notifications</h3>
              </div>
              <button onClick={() => setShowNotifs(false)} className="w-7 sm:w-9 h-7 sm:h-9 rounded-xl bg-white/10 flex items-center justify-center text-white transition-all active:scale-95">
                <X size={14} />
              </button>
            </div>

            <div className="p-4 sm:p-6 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto space-y-2.5 sm:space-y-3">
              {notifications.map(n => (
                <div key={n.id} onClick={() => markNotifRead(n.id)} 
                  className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all cursor-pointer ${n.is_read ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-yellow-50 border-yellow-100 shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                    <p className="font-syne font-bold text-[11px] sm:text-sm uppercase tracking-wide text-[#0a0a0a]">{n.title}</p>
                    {!n.is_read && <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-[#FFD600]" />}
                  </div>
                  <p className="font-dm text-[10px] sm:text-xs text-gray-500 leading-relaxed">{n.message}</p>
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="text-center py-12 sm:py-16">
                  <p className="font-syne text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-300">No notifications</p>
                </div>
              )}
            </div>
            <div className="p-4 sm:p-6 border-t border-gray-100">
              <button onClick={() => setShowNotifs(false)} className="w-full py-4 sm:py-5 bg-[#0a0a0a] text-white font-syne font-bold uppercase text-[10px] sm:text-xs tracking-widest rounded-2xl transition-all active:scale-95 shadow-lg">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
