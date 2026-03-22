import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { QRCodeCanvas } from 'qrcode.react';
import { ShoppingCart, Check, CreditCard, Utensils, X, Plus, Zap, ArrowRight, Clock, Bell } from 'lucide-react';

/* ── Fonts + keyframes (injected once) ─────────────────────────── */
if (!document.querySelector('[data-co-fonts]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&family=DM+Sans:wght@300;400;500&display=swap';
  link.setAttribute('data-co-fonts', '');
  document.head.appendChild(link);

  const style = document.createElement('style');
  style.setAttribute('data-co-styles', '');
  style.textContent = `
    .font-syne { font-family: 'Syne', sans-serif !important; }
    .font-dm   { font-family: 'DM Sans', sans-serif !important; }

    @keyframes co-fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes co-slideUp {
      from { opacity: 0; transform: translateY(100%); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes co-scaleIn {
      from { opacity: 0; transform: scale(.94); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes co-pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: .4; }
    }
    @keyframes co-spin { to { transform: rotate(360deg); } }

    .anim-up     { animation: co-fadeUp  .5s cubic-bezier(.22,1,.36,1) both; }
    .anim-slide  { animation: co-slideUp .4s cubic-bezier(.22,1,.36,1) both; }
    .anim-scale  { animation: co-scaleIn .35s cubic-bezier(.22,1,.36,1) both; }

    .status-dot-pulse { animation: co-pulse .9s ease-in-out infinite; }

    .menu-card { transition: box-shadow .22s ease, transform .22s ease; }
    .menu-card:hover { box-shadow: 0 8px 28px rgba(0,0,0,.09); transform: translateY(-2px); }

    .add-btn { transition: all .18s cubic-bezier(.22,1,.36,1); }
    .add-btn:hover  { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(255,214,0,.4); }
    .add-btn:active { transform: scale(.97); }

    .cart-btn { transition: all .18s cubic-bezier(.22,1,.36,1); }
    .cart-btn:hover  { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(255,214,0,.4); }
    .cart-btn:active { transform: scale(.97); }
  `;
  document.head.appendChild(style);
}

/* ── Helpers ───────────────────────────────────────────────────── */
const STATUS_MAP = {
  pending:   { label: 'Sent to Kitchen',      step: 1 },
  preparing: { label: 'Chef is Preparing…',   step: 2 },
  served:    { label: 'On the Way to You',     step: 3 },
  completed: { label: 'Enjoy your meal!',      step: 4 },
  cancelled: { label: 'Order Cancelled',       step: 0 },
};

const inputCls =
  'w-full px-5 py-4 bg-gray-100 rounded-2xl border-2 border-transparent focus:border-[#FFD600] outline-none font-dm text-base text-[#0a0a0a] transition-all placeholder:text-gray-400';

/* ══════════════════════════════════════════════════════════════════
   Component
══════════════════════════════════════════════════════════════════ */
export default function CustomerOrder() {
  const { tableId } = useParams();
  const [table,         setTable]         = useState(null);
  const [menuItems,     setMenuItems]     = useState([]);
  const [cart,          setCart]          = useState([]);
  const [showCart,      setShowCart]      = useState(false);
  const [isPaying,      setIsPaying]      = useState(false);
  const [paymentCode,   setPaymentCode]   = useState('');
  const [orderComplete, setOrderComplete] = useState(false);
  const [activeOrder,   setActiveOrder]   = useState(null);
  const [itemQuantities, setItemQuantities] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [showNotifs,     setShowNotifs]     = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo,   setAppliedPromo]   = useState(null);

  const [user,          setUser]          = useState(null);
  const [isCustomer,    setIsCustomer]    = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        setIsCustomer(session.user.user_metadata?.role === 'customer' || session.user.app_metadata?.role === 'customer' || true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsCustomer(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { 
    fetchTableAndMenu(); 
    if (user?.id) fetchNotifications(); 

    const ordersSubscription = supabase
      .channel('customer_order')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'orders',
        filter: `table_id=eq.${tableId}`
      }, (payload) => {
        if (activeOrder && payload.new.id === activeOrder.id) {
          setActiveOrder(prev => ({ ...prev, ...payload.new }));
        }
      })
      .subscribe();

    const notifsSubscription = user?.id ? supabase
      .channel('customer_notifs')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, fetchNotifications)
      .subscribe() : null;

    return () => {
      supabase.removeChannel(ordersSubscription);
      if (notifsSubscription) supabase.removeChannel(notifsSubscription);
    };
  }, [tableId, activeOrder?.id, user?.id]);

  const fetchTableAndMenu = async () => {
    try {
      const { data: tableData, error: tableError } = await supabase
        .from('tables')
        .select('*')
        .eq('id', tableId)
        .single();
      
      if (tableError) throw tableError;
      setTable(tableData);

      const { data: menuData, error: menuError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('branch_id', tableData.branch_id);
      
      if (menuError) throw menuError;
      setMenuItems(menuData);
    } catch (err) { console.error(err); }
  };

  const fetchNotifications = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setNotifications(data);
    } catch (err) { console.error('Error fetching notifications:', err); }
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

  const addToCart = (item, quantity = 1) => {
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) return;
    
    const existing = cart.find(i => i.id === item.id);
    if (existing) setCart(cart.map(i => i.id === item.id ? { ...i, quantity: i.quantity + qty } : i));
    else setCart([...cart, { ...item, quantity: qty }]);
  };

  const removeFromCart = (id) => setCart(cart.filter(i => i.id !== id));
  const cartQty   = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const confirmPayment = async () => {
    try {
      // 1. Create order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{
          table_id: parseInt(tableId),
          branch_id: table.branch_id,
          user_id: user?.id,
          total_amount: cartTotal,
          status: 'pending',
          is_paid: true // Simulating payment success
        }])
        .select()
        .single();
      
      if (orderError) throw orderError;

      // 2. Create order items
      const orderItems = cart.map(item => ({
        order_id: orderData.id,
        menu_item_id: item.id,
        quantity: item.quantity,
        price_at_order: item.price
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);
      
      if (itemsError) throw itemsError;

      setActiveOrder(orderData);
      setOrderComplete(true);
      setCart([]);
      setIsPaying(false);
      setShowCart(false);
      setPromoCodeInput('');
    } catch (err) { 
      console.error(err); 
      alert('Order failed: ' + err.message); 
    }
  };

  /* ── Order Complete / Receipt screen ─────────────────────────── */
  if (orderComplete && activeOrder) {
    const st   = STATUS_MAP[activeOrder.status] || STATUS_MAP.pending;
    const step = st.step;

    const trackSteps = [
      { label: 'Kitchen Received', active: step >= 1, done: step > 1 },
      { label: 'Chef Preparing',   active: step === 2, done: step > 2 },
      { label: 'Out for Delivery', active: step === 3, done: step > 3 },
      { label: 'Completed',        active: false,      done: step === 4 },
    ];

    return (
      <div className="font-dm min-h-svh bg-[#f2f2f0] flex flex-col items-center pb-20">

        {/* Dark hero */}
        <div className="w-full bg-[#0a0a0a] px-5 pt-14 pb-24 flex flex-col items-center text-center relative overflow-hidden">
          {/* Header row with bell */}
          <div className="absolute top-0 left-0 right-0 p-5 flex justify-between items-center z-20">
            <h1 className="font-syne text-xl font-black text-white uppercase tracking-tighter">FoodApp</h1>
            {isCustomer && (
              <button 
                onClick={() => setShowNotifs(true)}
                className="relative w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95"
              >
                <Bell size={20} />
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-[#0a0a0a] text-[9px] font-black flex items-center justify-center">
                    {notifications.filter(n => !n.is_read).length}
                  </span>
                )}
              </button>
            )}
          </div>

          <div className="absolute -top-10 -right-10 opacity-[0.04] pointer-events-none">
            <Zap size={200} color="#fff" fill="#fff" />
          </div>
          <div className="w-16 h-16 rounded-2xl bg-[#FFD600] flex items-center justify-center mb-5 mt-10">
            <Check size={28} color="#0a0a0a" strokeWidth={3} />
          </div>
          <h1 className="font-syne text-4xl font-black text-white leading-tight tracking-tight mb-2">
            Order #{activeOrder.id}
          </h1>
          <p className="font-syne text-xs font-semibold uppercase tracking-widest text-gray-500">
            Table {table?.number}
          </p>
        </div>

        <div className="w-full max-w-md px-4 -mt-12 z-10 space-y-5">

          {/* DO NOT CLOSE warning for guests */}
          {!isCustomer && (
            <div className="anim-up bg-red-500 text-white rounded-2xl px-5 py-4 flex items-center gap-3">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="font-syne font-bold text-sm uppercase tracking-wide">Do not close this page</p>
                <p className="font-dm text-xs opacity-80 mt-0.5">Wait for the waiter to scan your QR</p>
              </div>
            </div>
          )}

          {/* Receipt card */}
          <div className="anim-up bg-white rounded-3xl border border-black/[0.06] shadow-lg overflow-hidden">
            <div className="h-1.5 bg-[#FFD600]" />

            {/* QR */}
            <div className="flex flex-col items-center px-8 pt-8 pb-6 border-b border-dashed border-gray-100">
              <span className="font-syne text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
                Official Receipt
              </span>
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
                <QRCodeCanvas 
                  value={`RECEIPT-${activeOrder.id}`}
                  size={176}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="font-dm text-xs text-gray-400 mt-3 text-center leading-relaxed">
                Show this QR to the waiter when they arrive at your table
              </p>
            </div>

            {/* Status + total */}
            <div className="px-7 py-6 space-y-3 border-b border-dashed border-gray-100">
              <div className="flex items-center justify-between">
                <span className="font-syne text-sm font-bold uppercase tracking-wide text-gray-400">Status</span>
                <span className="font-syne text-sm font-extrabold text-[#0a0a0a]">{st.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-syne text-sm font-bold uppercase tracking-wide text-gray-400">Total Paid</span>
                <span className="font-syne text-xl font-black text-[#0a0a0a]">${activeOrder.total_amount}</span>
              </div>
            </div>

            {/* Tracker */}
            <div className="px-7 py-6 space-y-3">
              {trackSteps.map((s, i) => (
                <div key={i} className="flex items-center gap-4 bg-gray-50 rounded-2xl px-5 py-4">
                  <div className={`w-3 h-3 rounded-full shrink-0 ${
                    s.done   ? 'bg-green-500' :
                    s.active ? 'bg-[#FFD600] status-dot-pulse' :
                               'bg-gray-200'
                  }`} />
                  <span className={`font-syne text-sm font-bold uppercase tracking-wide ${s.done || s.active ? 'text-[#0a0a0a]' : 'text-gray-400'}`}>
                    {s.label}
                  </span>
                  {s.done && <Check size={14} className="text-green-500 ml-auto" strokeWidth={3} />}
                </div>
              ))}
            </div>
          </div>

          {/* Save receipt CTA for guests */}
          {!isCustomer && (
            <div className="anim-up bg-[#0a0a0a] rounded-3xl px-7 py-6 flex items-center justify-between gap-4">
              <div>
                <p className="font-syne text-sm font-extrabold text-white mb-1">Save this receipt forever?</p>
                <p className="font-dm text-xs text-gray-500">Create a free account</p>
              </div>
              <a
                href="/signup"
                className="flex items-center gap-2 bg-[#FFD600] text-[#0a0a0a] font-syne font-extrabold text-xs uppercase tracking-wide px-5 py-3 rounded-xl shrink-0 hover:-translate-y-0.5 transition-transform"
              >
                Sign Up <ArrowRight size={14} />
              </a>
            </div>
          )}

          {/* New order button */}
          <button
            onClick={() => { setOrderComplete(false); setActiveOrder(null); }}
            className="cart-btn w-full bg-[#0a0a0a] text-white font-syne font-extrabold text-base uppercase tracking-wide py-5 rounded-2xl flex items-center justify-center gap-2"
          >
            New Order
          </button>
        </div>
      </div>
    );
  }

  /* ── Menu screen ─────────────────────────────────────────────── */
  return (
    <div className="font-dm min-h-svh bg-[#f2f2f0] pb-32">

      {/* Sticky header */}
      <header className="bg-[#0a0a0a] sticky top-0 z-40 px-5 py-5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-syne text-2xl font-extrabold text-white leading-tight">FoodApp</h1>
            {isCustomer ? (
              <p className="font-syne text-xs font-semibold uppercase tracking-widest text-[#FFD600] mt-0.5">
                Hi, {user?.email || 'Customer'}!
              </p>
            ) : (
              <p className="font-syne text-xs font-semibold uppercase tracking-widest text-gray-500 mt-0.5">
                Table #{table?.number}
              </p>
            )}
          </div>
          
          {isCustomer && (
            <button 
              onClick={() => setShowNotifs(true)}
              className="relative w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95"
            >
              <Bell size={20} />
              {notifications.filter(n => !n.is_read).length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-[#0a0a0a] text-[9px] font-black flex items-center justify-center">
                  {notifications.filter(n => !n.is_read).length}
                </span>
              )}
            </button>
          )}

          {!isCustomer && (
            <a 
              href={`/login?redirect=/table/${tableId}`}
              className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95"
              title="Sign In"
            >
              <ArrowRight size={20} />
            </a>
          )}
        </div>

        {/* Cart button */}
        <button
          onClick={() => setShowCart(true)}
          className="relative flex items-center gap-2.5 bg-[#FFD600] text-[#0a0a0a] font-syne font-extrabold text-sm uppercase tracking-wide px-5 py-3 rounded-2xl cart-btn shadow-[0_4px_16px_rgba(255,214,0,.3)]"
        >
          <ShoppingCart size={18} strokeWidth={2.5} />
          {cartQty > 0 ? `${cartQty} item${cartQty > 1 ? 's' : ''}` : 'Cart'}
          {cartQty > 0 && (
            <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#0a0a0a] text-[#FFD600] font-syne font-black text-[10px] flex items-center justify-center">
              {cartQty}
            </span>
          )}
        </button>
      </header>

      {/* Menu */}
      <main className="max-w-xl mx-auto px-4 pt-8 space-y-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-syne text-2xl font-black text-[#0a0a0a] tracking-tight">Menu</h2>
          <span className="font-syne text-xs font-bold uppercase tracking-wider bg-yellow-100 text-yellow-700 px-4 py-2 rounded-full">
            {menuItems.length} items
          </span>
        </div>

        {menuItems.map((item, idx) => {
          const cartItem = cart.find(i => i.id === item.id);
          const currentQty = itemQuantities[item.id] || 1;

          return (
            <div
              key={item.id}
              className="menu-card bg-white rounded-3xl border border-black/[0.06] shadow-sm overflow-hidden"
              style={{ animationDelay: `${idx * 0.04}s` }}
            >
              <div className="h-1.5 bg-[#FFD600] w-full" />
              
              {item.image_url && (
                <div className="h-44 w-full bg-gray-100 overflow-hidden relative">
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                </div>
              )}

              <div className="px-6 py-6">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-syne text-xl font-extrabold text-[#0a0a0a] leading-snug mb-1">
                      {item.name}
                    </h3>
                    <p className="font-dm text-sm text-gray-400 leading-relaxed">{item.description}</p>
                  </div>
                  <span className="font-syne text-2xl font-black text-[#0a0a0a] shrink-0">${item.price}</span>
                </div>

                <div className="flex gap-3">
                  <div className="flex items-center bg-gray-100 rounded-2xl px-3 py-2 shrink-0 border border-transparent focus-within:border-[#FFD600] transition-all">
                    <span className="font-syne text-[10px] font-bold uppercase text-gray-400 mr-2">Qty</span>
                    <input
                      type="number"
                      min="1"
                      className="w-12 bg-transparent font-syne font-black text-center text-[#0a0a0a] outline-none"
                      value={currentQty}
                      onChange={e => setItemQuantities({ ...itemQuantities, [item.id]: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <button
                    onClick={() => { addToCart(item, currentQty); setItemQuantities({ ...itemQuantities, [item.id]: 1 }); }}
                    className="add-btn flex-1 bg-[#FFD600] text-[#0a0a0a] font-syne font-extrabold text-sm uppercase tracking-wide py-4 rounded-2xl flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(255,214,0,.25)]"
                  >
                    <Plus size={17} strokeWidth={2.5} /> Add to Order
                  </button>
                </div>
                
                {cartItem && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-[#0a0a0a] font-syne text-[10px] font-bold uppercase tracking-wider bg-gray-50 py-2 rounded-xl border border-dashed border-gray-200">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                    {cartItem.quantity} in cart
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </main>

      {/* ── Cart drawer ──────────────────────────────────────────── */}
      {showCart && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex flex-col justify-end">
          <div className="anim-slide bg-white rounded-t-3xl max-h-[90svh] flex flex-col overflow-hidden">

            {/* Drawer handle + header */}
            <div className="bg-[#0a0a0a] px-6 py-5 flex items-center justify-between shrink-0">
              <h2 className="font-syne text-xl font-extrabold text-white">Your Order</h2>
              <button
                onClick={() => setShowCart(false)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95"
              >
                <X size={18} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                    <ShoppingCart size={28} className="text-gray-300" />
                  </div>
                  <p className="font-syne text-base font-bold text-gray-400 uppercase tracking-wide">Cart is empty</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex items-center gap-4 bg-gray-50 rounded-2xl px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-syne text-base font-extrabold text-[#0a0a0a] leading-snug">{item.name}</p>
                      <p className="font-dm text-sm text-gray-400 mt-0.5">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-syne text-lg font-black text-[#0a0a0a] shrink-0">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="w-8 h-8 rounded-xl bg-red-100 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-95 shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Total + checkout */}
            <div className="px-6 py-6 border-t border-gray-100 shrink-0 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-syne text-base font-bold uppercase tracking-wide text-gray-400">Total</span>
                <span className="font-syne text-3xl font-black text-[#0a0a0a]">${cartTotal.toFixed(2)}</span>
              </div>
              <button
                disabled={cart.length === 0}
                onClick={() => { setShowCart(false); setIsPaying(true); }}
                className="cart-btn w-full bg-[#FFD600] text-[#0a0a0a] font-syne font-extrabold text-base uppercase tracking-wide py-5 rounded-2xl flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(255,214,0,.3)] disabled:opacity-40 disabled:pointer-events-none"
              >
                Checkout Now <ArrowRight size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment modal ─────────────────────────────────────────── */}
      {isPaying && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="anim-scale bg-white rounded-3xl shadow-2xl w-full max-w-md border border-black/[0.06] overflow-hidden">

            {/* Modal header */}
            <div className="bg-[#0a0a0a] px-7 py-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFD600] flex items-center justify-center shrink-0">
                  <CreditCard size={18} color="#0a0a0a" />
                </div>
                <h3 className="font-syne text-xl font-extrabold text-white">Ecocash Pay</h3>
              </div>
              <button
                onClick={() => setIsPaying(false)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="px-8 py-8 space-y-6">
              <div>
                <p className="font-dm text-sm text-gray-400 text-center leading-relaxed mb-5">
                  Enter your simulation confirmation code to complete payment.
                </p>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="font-syne text-xs font-bold uppercase tracking-widest text-gray-400">
                      Confirmation Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. EC-12345"
                      className={`${inputCls} text-center font-syne font-bold text-lg uppercase tracking-widest`}
                      value={paymentCode}
                      onChange={e => setPaymentCode(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="font-syne text-xs font-bold uppercase tracking-widest text-gray-400">
                      Promo Code (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. SAVE20"
                      className={`${inputCls} text-center font-syne font-bold text-lg uppercase tracking-widest`}
                      value={promoCodeInput}
                      onChange={e => setPromoCodeInput(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between px-1">
                  <span className="font-dm text-xs text-gray-400">Order total</span>
                  <span className="font-syne text-base font-black text-[#0a0a0a]">${cartTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsPaying(false)}
                  className="flex-1 py-4 bg-gray-100 text-[#0a0a0a] font-syne font-bold uppercase text-sm rounded-2xl hover:bg-gray-200 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmPayment}
                  className="flex-1 py-4 bg-[#FFD600] text-[#0a0a0a] font-syne font-extrabold uppercase text-sm rounded-2xl shadow-[0_4px_16px_rgba(255,214,0,.3)] hover:-translate-y-0.5 active:scale-95 transition-all"
                >
                  Pay &amp; Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── NOTIFICATIONS MODAL ────────────────────────────────── */}
      {showNotifs && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="anim-scale bg-white rounded-3xl shadow-2xl w-full max-w-md border border-black/[0.06] overflow-hidden">
            <div className="bg-[#0a0a0a] px-7 py-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFD600] flex items-center justify-center shrink-0">
                  <Bell size={18} color="#0a0a0a" />
                </div>
                <h3 className="font-syne text-xl font-extrabold text-white">Notifications</h3>
              </div>
              <button onClick={() => setShowNotifs(false)} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white transition-all active:scale-95">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
              {notifications.map(n => (
                <div key={n.id} onClick={() => markNotifRead(n.id)} 
                  className={`p-5 rounded-2xl border transition-all cursor-pointer ${n.is_read ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-yellow-50 border-yellow-100 shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-syne font-bold text-sm uppercase tracking-wide text-[#0a0a0a]">{n.title}</p>
                    {!n.is_read && <div className="w-2 h-2 rounded-full bg-[#FFD600]" />}
                  </div>
                  <p className="font-dm text-xs text-gray-500 leading-relaxed">{n.message}</p>
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="text-center py-10">
                  <p className="font-syne text-xs font-bold uppercase tracking-widest text-gray-300">No notifications</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-100">
              <button onClick={() => setShowNotifs(false)} className="w-full py-4 bg-[#0a0a0a] text-white font-syne font-bold uppercase text-xs rounded-2xl transition-all active:scale-95">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}