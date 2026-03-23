import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Utensils, Check, ChefHat, ArrowLeft, Zap, Clock } from 'lucide-react';

/* ── Fonts + keyframes (injected once) ─────────────────────────── */
if (!document.querySelector('[data-kd-fonts]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&family=DM+Sans:wght@300;400;500&display=swap';
  link.setAttribute('data-kd-fonts', '');
  document.head.appendChild(link);

  const style = document.createElement('style');
  style.setAttribute('data-kd-styles', '');
  style.textContent = `
    .font-syne { font-family: 'Syne', sans-serif !important; }
    .font-dm   { font-family: 'DM Sans', sans-serif !important; }

    @keyframes kd-fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes kd-pulse-ring {
      0%   { transform: scale(1);    opacity: .5; }
      70%  { transform: scale(1.4);  opacity: 0;  }
      100% { transform: scale(1.4);  opacity: 0;  }
    }
    @keyframes kd-breathe {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255,214,0,.0); }
      50%       { box-shadow: 0 0 0 8px rgba(255,214,0,.15); }
    }

    .anim-1 { animation: kd-fadeUp .5s .00s cubic-bezier(.22,1,.36,1) both; }
    .anim-2 { animation: kd-fadeUp .5s .06s cubic-bezier(.22,1,.36,1) both; }
    .anim-3 { animation: kd-fadeUp .5s .12s cubic-bezier(.22,1,.36,1) both; }

    .pulse-ring {
      position: absolute; inset: 0; border-radius: 9999px;
      background: rgba(255,214,0,.35);
      animation: kd-pulse-ring 2.2s ease-out infinite;
    }

    .order-card { transition: box-shadow .22s ease, transform .22s ease; }
    .order-card:hover { box-shadow: 0 16px 48px rgba(0,0,0,.14); transform: translateY(-4px); }

    /* pending cards get a gentle yellow pulse */
    .card-pending { animation: kd-breathe 3s ease-in-out infinite; }

    .action-btn { transition: all .18s cubic-bezier(.22,1,.36,1); }
    .action-btn:hover { transform: translateY(-2px); }
    .action-btn:active { transform: scale(.97); }
  `;
  document.head.appendChild(style);
}

/* ── Status config ──────────────────────────────────────────────── */
const STATUS = {
  pending:   { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending'   },
  preparing: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Preparing' },
  served:    { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Served'    },
};

/* ══════════════════════════════════════════════════════════════════
   Component
══════════════════════════════════════════════════════════════════ */
export default function KitchenDashboard() {
  const { branchId } = useParams();
  const navigate     = useNavigate();
  const [orders, setOrders] = useState([]);

  const [user, setUser] = useState(null);
  const [isMgmt, setIsMgmt] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        const role = session.user.user_metadata?.role || session.user.app_metadata?.role;
        setIsMgmt(['admin', 'manager', 'supervisor'].includes(role));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      const role = session?.user?.user_metadata?.role || session?.user?.app_metadata?.role;
      setIsMgmt(['admin', 'manager', 'supervisor'].includes(role));
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchOrders();

    // Real-time subscription for new/updated orders
    const ordersSubscription = supabase
      .channel('kitchen_orders')
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
        .neq('status', 'completed')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Transform for UI (flatten items)
      const transformed = data.map(order => ({
        ...order,
        items: order.order_items.map(oi => ({
          quantity: oi.quantity,
          menu_item: oi.menu_items
        }))
      }));

      setOrders(transformed);
    } catch (err) {
      console.error(err);
    }
  };

  const updateStatus = async (orderId, newStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);
      
      if (error) throw error;
      fetchOrders();
    } catch (err) {
      console.error(err);
    }
  };

  const pendingCount   = orders.filter(o => o.status === 'pending').length;
  const preparingCount = orders.filter(o => o.status === 'preparing').length;

  /* ── Main ─────────────────────────────────────────────────────── */
  return (
    <div className="font-dm min-h-svh bg-[#0a0a0a] pb-24">

      {/* ── Top bar ───────────────────────────────────────────── */}
      <div className="bg-[#0a0a0a] border-b border-white/[0.06] px-5 pt-10 pb-8 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 opacity-[0.04] rotate-12 pointer-events-none">
          <ChefHat size={240} color="#fff" />
        </div>

        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          {/* Brand + back */}
          <div className="anim-1 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#FFD600] flex items-center justify-center shrink-0">
              <ChefHat size={26} color="#0a0a0a" strokeWidth={2} />
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
                Kitchen Live View
              </h1>
            </div>
          </div>

          {/* Stats chips */}
          <div className="anim-1 flex items-center gap-3">
            <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-5 py-3 rounded-2xl">
              <div className="relative flex items-center justify-center">
                <div className="pulse-ring" style={{ width: 10, height: 10, inset: 'auto' }} />
                <div className="w-2.5 h-2.5 rounded-full bg-[#FFD600] relative z-10" />
              </div>
              <span className="font-syne text-sm font-bold text-[#FFD600]">{pendingCount} pending</span>
            </div>
            <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-5 py-3 rounded-2xl">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
              <span className="font-syne text-sm font-bold text-blue-400">{preparingCount} cooking</span>
            </div>
            <div className="bg-white/5 border border-white/10 px-5 py-3 rounded-2xl">
              <span className="font-syne text-sm font-bold text-white">{orders.length} total</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Orders grid ───────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 pt-8">
        {orders.length === 0 ? (
          <div className="anim-2 flex flex-col items-center justify-center text-center py-32 gap-5">
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center">
              <Utensils size={36} className="text-white/20" />
            </div>
            <p className="font-syne text-2xl font-black text-white/20 uppercase tracking-wide">
              All clear — no active orders
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {orders.map((order, idx) => {
              const st        = STATUS[order.status] || STATUS.pending;
              const isPending = order.status === 'pending';
              const isCooking = order.status === 'preparing';

              return (
                <div
                  key={order.id}
                  className={`order-card bg-white rounded-3xl overflow-hidden flex flex-col ${isPending ? 'card-pending' : ''}`}
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  {/* Card top accent bar — yellow for pending, blue for preparing */}
                  <div className={`h-1.5 w-full ${isPending ? 'bg-[#FFD600]' : isCooking ? 'bg-blue-500' : 'bg-green-500'}`} />

                  {/* Card header */}
                  <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
                        <span className="font-syne text-lg font-black text-[#0a0a0a]">T{order.table_id}</span>
                      </div>
                      <div>
                        <p className="font-syne text-base font-extrabold text-[#0a0a0a] leading-snug">
                          Order #{order.id}
                        </p>
                        <p className="font-dm text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Clock size={11} /> Table {order.table_id}
                        </p>
                      </div>
                    </div>
                    <span className={`font-syne text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-full ${st.bg} ${st.text}`}>
                      {st.label}
                    </span>
                  </div>

                  {/* Items list */}
                  <div className="px-6 py-5 flex-1 space-y-2.5">
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
                          <span className="font-dm text-base text-[#0a0a0a] font-medium">
                            {item.menu_item?.name || 'Unknown Item'}
                          </span>
                        </div>
                        <Utensils size={15} className="text-gray-300 shrink-0" />
                      </div>
                    ))}
                  </div>

                  {/* Action button */}
                  <div className="px-6 pb-6">
                    {isPending && (
                      <button
                        onClick={() => updateStatus(order.id, 'preparing')}
                        className="action-btn w-full bg-[#FFD600] text-[#0a0a0a] font-syne font-extrabold text-base uppercase tracking-wide py-4 rounded-2xl flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(255,214,0,.35)]"
                      >
                        <ChefHat size={20} strokeWidth={2.5} /> Start Cooking
                      </button>
                    )}
                    {isCooking && (
                      <button
                        onClick={() => updateStatus(order.id, 'served')}
                        className="action-btn w-full bg-green-500 text-white font-syne font-extrabold text-base uppercase tracking-wide py-4 rounded-2xl flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(34,197,94,.3)]"
                      >
                        <Check size={20} strokeWidth={3} /> Ready to Serve
                      </button>
                    )}
                    {order.status === 'served' && (
                      <div className="w-full bg-green-50 text-green-700 font-syne font-bold text-sm uppercase tracking-wide py-4 rounded-2xl flex items-center justify-center gap-2">
                        <Check size={16} strokeWidth={3} /> Served — Awaiting Pickup
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}