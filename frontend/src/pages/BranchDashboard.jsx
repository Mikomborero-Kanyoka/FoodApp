import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Plus, Utensils, Printer, Users, ShoppingBag,
  Clock, X, Zap, LayoutDashboard, Upload, ImageIcon,
} from 'lucide-react';

/* ── Fonts + keyframes (injected once) ─────────────────────────── */
if (!document.querySelector('[data-bd-fonts]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&family=DM+Sans:wght@300;400;500&display=swap';
  link.setAttribute('data-bd-fonts', '');
  document.head.appendChild(link);

  const style = document.createElement('style');
  style.setAttribute('data-bd-styles', '');
  style.textContent = `
    .font-syne { font-family: 'Syne', sans-serif !important; }
    .font-dm   { font-family: 'DM Sans', sans-serif !important; }

    @keyframes bd-fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes bd-scaleIn {
      from { opacity: 0; transform: scale(.94); }
      to   { opacity: 1; transform: scale(1); }
    }

    .anim-1 { animation: bd-fadeUp .5s .00s cubic-bezier(.22,1,.36,1) both; }
    .anim-2 { animation: bd-fadeUp .5s .08s cubic-bezier(.22,1,.36,1) both; }
    .anim-3 { animation: bd-fadeUp .5s .16s cubic-bezier(.22,1,.36,1) both; }
    .anim-4 { animation: bd-fadeUp .5s .24s cubic-bezier(.22,1,.36,1) both; }
    .modal-in { animation: bd-scaleIn .3s cubic-bezier(.22,1,.36,1) both; }

    .hover-lift { transition: box-shadow .22s ease, transform .22s ease; }
    .hover-lift:hover { box-shadow: 0 10px 36px rgba(0,0,0,.10); transform: translateY(-3px); }

    .add-dish-btn { transition: box-shadow .22s ease, transform .22s ease; }
    .add-dish-btn:hover { box-shadow: 0 8px 28px rgba(255,214,0,.35); transform: translateY(-2px); }

    .table-card { transition: box-shadow .2s ease, transform .2s ease; }
    .table-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,.09); transform: translateY(-2px); }
  `;
  document.head.appendChild(style);
}

/* ── Constants ──────────────────────────────────────────────────── */
const ORDER_STATUS = {
  pending:   { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  preparing: { bg: 'bg-blue-100',   text: 'text-blue-700'   },
  served:    { bg: 'bg-green-100',  text: 'text-green-700'  },
  completed: { bg: 'bg-gray-100',   text: 'text-gray-500'   },
  cancelled: { bg: 'bg-red-100',    text: 'text-red-600'    },
};

const inputCls =
  'w-full px-5 py-4 bg-gray-100 rounded-2xl border-2 border-transparent focus:border-[#FFD600] outline-none font-dm text-base text-[#0a0a0a] transition-all placeholder:text-gray-400';

const selectCls =
  'w-full px-5 py-4 bg-gray-100 rounded-2xl border-2 border-transparent focus:border-[#FFD600] outline-none font-syne font-bold text-sm uppercase text-[#0a0a0a] transition-all';

/* ── Modal wrapper — scrollable, max height capped ─────────────── */
function Modal({ onClose, title, icon, children }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="modal-in bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-black/[0.06] overflow-hidden flex flex-col max-h-[90svh]">
        {/* Sticky header with X always visible */}
        <div className="bg-[#0a0a0a] px-8 py-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFD600] flex items-center justify-center shrink-0">
              {icon}
            </div>
            <h2 className="font-syne text-xl font-extrabold text-white">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95 shrink-0"
          >
            <X size={18} />
          </button>
        </div>
        {/* Scrollable body */}
        <div className="overflow-y-auto px-8 py-8 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Component
══════════════════════════════════════════════════════════════════ */
export default function BranchDashboard() {
  const { branchId } = useParams();
  const navigate     = useNavigate();

  const [activeTab,       setActiveTab]       = useState('tables');
  const [tables,          setTables]          = useState([]);
  const [menuItems,       setMenuItems]       = useState([]);
  const [employees,       setEmployees]       = useState([]);
  const [customers,       setCustomers]       = useState([]);
  const [orders,          setOrders]          = useState([]);
  const [roles,           setRoles]           = useState([]);
  const [newTableNum,     setNewTableNum]     = useState('');
  const [bulkCount,       setBulkCount]       = useState('');
  const [newMenuItem,     setNewMenuItem]     = useState({ name: '', description: '', price: '', image_url: '' });
  const [newEmployee,     setNewEmployee]     = useState({ email: '', role: '' });
  const [showAddMenu,     setShowAddMenu]     = useState(false);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [isUploading,     setIsUploading]     = useState(false);

  const [showPromoModal,  setShowPromoModal]  = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [promoData,       setPromoData]       = useState({ discount: 10, title: 'Special Discount!', message: 'Use code {CODE} for {PERCENT}% off your next order!' });

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
    fetchTables(); fetchMenu(); fetchEmployees(); fetchOrders(); fetchRoles(); fetchCustomers();
    
    // Subscribe to real-time changes
    const tablesSubscription = supabase
      .channel('public:tables')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables', filter: `branch_id=eq.${branchId}` }, fetchTables)
      .subscribe();

    const ordersSubscription = supabase
      .channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `branch_id=eq.${branchId}` }, fetchOrders)
      .subscribe();

    return () => {
      supabase.removeChannel(tablesSubscription);
      supabase.removeChannel(ordersSubscription);
    };
  }, [branchId]);

  const fetchTables    = async () => { try { const { data, error } = await supabase.from('tables').select('*').eq('branch_id', branchId).order('number'); if (error) throw error; setTables(data);    } catch(e){ console.error(e); } };
  const fetchMenu      = async () => { try { const { data, error } = await supabase.from('menu_items').select('*').eq('branch_id', branchId); if (error) throw error; setMenuItems(data); } catch(e){ console.error(e); } };
  const fetchEmployees = async () => { try { const { data, error } = await supabase.from('users').select('*').eq('branch_id', branchId); if (error) throw error; setEmployees(data); } catch(e){ console.error(e); } };
  const fetchOrders    = async () => { try { const { data, error } = await supabase.from('orders').select('*, tables(*)').eq('branch_id', branchId).order('created_at', { ascending: false }); if (error) throw error; setOrders(data);    } catch(e){ console.error(e); } };
  const fetchRoles     = async () => { setRoles(['admin', 'manager', 'supervisor', 'waiter', 'kitchen', 'staff', 'customer']); };
  const fetchCustomers = async () => { try { const { data, error } = await supabase.from('users').select('*').eq('role', 'customer'); if (error) throw error; setCustomers(data); } catch(e){ console.error(e); } };

  const handleSendPromo = async (e) => {
    e.preventDefault();
    try {
      const uids = selectedCustomer ? [selectedCustomer.id] : customers.map(c => c.id);
      
      const promos = uids.map(uid => ({
        user_id: uid,
        discount_percent: promoData.discount,
        branch_id: parseInt(branchId),
        code: `PROMO-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      }));

      const { error } = await supabase.from('promo_codes').insert(promos);
      if (error) throw error;

      alert('Campaign launched successfully!');
      setShowPromoModal(false);
      setSelectedCustomer(null);
    } catch (e) { console.error(e); alert('Failed to launch campaign'); }
  };

  const handleAddTable = async () => {
    if (!newTableNum) return;
    try { 
      const { error } = await supabase.from('tables').insert([{ 
        number: parseInt(newTableNum), 
        branch_id: parseInt(branchId) 
      }]);
      if (error) throw error;
      setNewTableNum(''); 
      fetchTables(); 
    } catch(e){ console.error(e); }
  };

  const handleBulkAddTables = async () => {
    if (!bulkCount || bulkCount <= 0) return;
    try {
      const maxNum = tables.length > 0 ? Math.max(...tables.map(t => t.number)) : 0;
      const newTables = Array.from({ length: parseInt(bulkCount) }, (_, i) => ({
        number: maxNum + i + 1,
        branch_id: parseInt(branchId)
      }));
      const { error } = await supabase.from('tables').insert(newTables);
      if (error) throw error;
      setBulkCount(''); 
      fetchTables(); 
    } catch(e){ console.error(e); }
  };

  const handleDeleteTable = async (tableId) => {
    if (!window.confirm('Delete this table?')) return;
    try { 
      const { error } = await supabase.from('tables').delete().eq('id', tableId);
      if (error) throw error;
      fetchTables(); 
    } catch(e){ console.error(e); }
  };

  const handlePrintQR = (table) => {
    const canvas = document.getElementById(`qr-${table.id}`);
    const qrDataUrl = canvas.toDataURL();
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Print QR Table #${table.number}</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;}img{width:300px;height:300px;}h1{font-size:2.5rem;margin-top:20px;}</style>
      </head><body onload="window.print();window.close();">
      <img src="${qrDataUrl}" /><h1>TABLE #${table.number}</h1>
      </body></html>`);
    win.document.close();
  };

  const handlePrintAllQRs = () => {
    const win = window.open('', '_blank');
    let qrHtml = '';
    tables.forEach(t => {
      const canvas = document.getElementById(`qr-${t.id}`);
      const qrDataUrl = canvas.toDataURL();
      qrHtml += `<div class="item"><img src="${qrDataUrl}" /><h2>TABLE #${t.number}</h2></div>`;
    });

    win.document.write(`
      <html><head><title>Print All QRs</title>
      <style>body{font-family:sans-serif;padding:20px;}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:40px;}.item{display:flex;flex-direction:column;align-items:center;border:1px solid #eee;padding:20px;page-break-inside:avoid;}img{width:180px;height:180px;}h2{margin-top:10px;font-size:1.2rem;}</style>
      </head><body onload="window.print();window.close();">
      <div class="grid">${qrHtml}</div>
      </body></html>`);
    win.document.close();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('menu-images')
        .upload(fileName, file);
      
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('menu-images')
        .getPublicUrl(fileName);

      setNewMenuItem(prev => ({ ...prev, image_url: publicUrl }));
    } catch (err) {
      console.error('Upload failed', err);
      alert('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddMenu = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('menu_items').insert([{ 
        ...newMenuItem, 
        branch_id: parseInt(branchId) 
      }]);
      if (error) throw error;
      setNewMenuItem({ name: '', description: '', price: '', image_url: '' });
      setShowAddMenu(false);
      fetchMenu();
    } catch(e){ console.error(e); }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    try {
      // 1. Find the user by email in the public.users table (populated via signup)
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('id')
        .eq('email', newEmployee.email.trim()) 
        .maybeSingle();

      if (fetchError) throw fetchError;
      
      let targetId = userData?.id;

      if (!targetId) {
        alert('User with this email/username not found. Please ensure they have signed up first.');
        return;
      }

      const { error } = await supabase
        .from('users')
        .update({
          role: newEmployee.role,
          branch_id: parseInt(branchId),
        })
        .eq('id', targetId);

      if (error) throw error;

      setNewEmployee({ email: '', role: '' });
      setShowAddEmployee(false);
      fetchEmployees();
      alert('Staff member onboarded successfully!');
    } catch(err){ 
      console.error(err); 
      alert('Failed to onboard staff: ' + err.message);
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try { 
      const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
      if (error) throw error;
      fetchOrders(); 
    }
    catch(e){ console.error(e); }
  };

  const tabs = [
    { key: 'tables',    label: 'Tables & QR' },
    { key: 'menu',      label: 'Menu'        },
    { key: 'orders',    label: 'Orders'      },
    { key: 'customers', label: 'Customers'   },
    ...(isMgmt ? [{ key: 'employees', label: 'Staff' }] : []),
  ];

  /* ── Main ─────────────────────────────────────────────────────── */
  return (
    <div className="font-dm min-h-svh bg-[#f2f2f0] pb-24">

      {/* ── Dark top bar ──────────────────────────────────────── */}
      <div className="bg-[#0a0a0a] px-5 pt-12 pb-24 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 opacity-[0.04] rotate-12 pointer-events-none">
          <LayoutDashboard size={220} color="#fff" />
        </div>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="anim-1 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#FFD600] flex items-center justify-center shrink-0">
              <Zap size={26} color="#0a0a0a" fill="#0a0a0a" />
            </div>
            <div>
              <p className="font-syne text-xs font-semibold uppercase tracking-widest text-gray-500 mb-0.5">
                Branch #{branchId}
              </p>
              <h1 className="font-syne text-2xl font-extrabold text-white leading-tight">
                Branch Management
              </h1>
            </div>
          </div>

          <div className="anim-1 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex gap-2 bg-white/10 p-1.5 rounded-2xl">
              <button onClick={() => navigate(`/waiter/${branchId}`)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 font-syne font-bold text-xs uppercase tracking-wide transition-all active:scale-95">
                <Users size={15} /> Waiter
              </button>
              <button onClick={() => navigate(`/kitchen/${branchId}`)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 font-syne font-bold text-xs uppercase tracking-wide transition-all active:scale-95">
                <Utensils size={15} /> Kitchen
              </button>
            </div>
            <div className="flex gap-1.5 bg-white/10 p-1.5 rounded-2xl overflow-x-auto">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-5 py-2.5 rounded-xl font-syne font-bold text-xs uppercase tracking-wide whitespace-nowrap transition-all active:scale-95
                    ${activeTab === t.key ? 'bg-[#FFD600] text-[#0a0a0a]' : 'text-gray-400 hover:text-white'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 -mt-12 space-y-6">

        {/* ══ TABLES ══════════════════════════════════════════════ */}
        {activeTab === 'tables' && (
          <div className="anim-2 space-y-6">
            {isMgmt && (
              <div className="bg-white rounded-3xl border border-black/[0.06] shadow-sm p-6 flex flex-wrap gap-4 items-center">
                <div className="flex-1 flex gap-2 min-w-[200px]">
                  <input type="number" placeholder="Table #" className={`${inputCls} flex-1`} value={newTableNum}
                    onChange={e => setNewTableNum(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddTable()} />
                  <button onClick={handleAddTable} className="bg-[#0a0a0a] text-white font-syne font-extrabold text-xs uppercase tracking-wide px-5 py-4 rounded-2xl hover:bg-gray-800 transition-all shrink-0">
                    Add Single
                  </button>
                </div>
                <div className="flex-1 flex gap-2 min-w-[200px]">
                  <input type="number" placeholder="How many more?" className={`${inputCls} flex-1`} value={bulkCount}
                    onChange={e => setBulkCount(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleBulkAddTables()} />
                  <button onClick={handleBulkAddTables} className="bg-[#FFD600] text-[#0a0a0a] font-syne font-extrabold text-xs uppercase tracking-wide px-5 py-4 rounded-2xl shadow-[0_4px_12px_rgba(255,214,0,.2)] hover:-translate-y-0.5 transition-all shrink-0">
                    Bulk Add
                  </button>
                </div>
                <button onClick={handlePrintAllQRs} className="flex items-center gap-2 bg-blue-600 text-white font-syne font-extrabold text-xs uppercase tracking-wide px-6 py-4 rounded-2xl hover:bg-blue-700 transition-all shrink-0">
                  <Printer size={16} /> Print All QRs
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {tables.map(table => (
                <div key={table.id} className="table-card bg-white rounded-3xl border border-black/[0.06] shadow-sm p-5 flex flex-col items-center gap-4 relative group">
                  {isMgmt && (
                    <button onClick={() => handleDeleteTable(table.id)}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-50 text-red-500 opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all z-10">
                      <X size={14} />
                    </button>
                  )}
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <span className="font-syne text-base font-black text-[#0a0a0a]">#{table.number}</span>
                  </div>
                  <div className="p-2 bg-white border border-gray-100 rounded-xl shadow-sm">
                    <QRCodeCanvas
                      id={`qr-${table.id}`}
                      value={`${window.location.origin}/table/${table.id}`}
                      size={96}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <button onClick={() => handlePrintQR(table)}
                    className="flex items-center gap-1.5 bg-[#0a0a0a] text-white font-syne font-bold text-[10px] uppercase tracking-wide px-4 py-2.5 rounded-xl hover:bg-gray-800 active:scale-95 transition-all w-full justify-center">
                    <Printer size={12} /> Print
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ MENU ════════════════════════════════════════════════ */}
        {activeTab === 'menu' && (
          <div className="anim-2 space-y-4">
            {isMgmt && (
              <button onClick={() => setShowAddMenu(true)}
                className="add-dish-btn w-full bg-[#FFD600] text-[#0a0a0a] font-syne font-extrabold text-base uppercase tracking-wide rounded-3xl p-6 flex items-center justify-center gap-3 shadow-[0_4px_20px_rgba(255,214,0,.3)] active:scale-[.99] transition-all">
                <Plus size={22} strokeWidth={2.5} /> Add New Dish to Menu
              </button>
            )}
            <div className="space-y-3">
              {menuItems.map((item, idx) => (
                <div key={item.id} className="hover-lift bg-white rounded-3xl border border-black/[0.06] shadow-sm overflow-hidden relative flex items-center gap-5 pl-6 pr-6 py-6" style={{ animationDelay: `${idx * 0.04}s` }}>
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#FFD600] rounded-l-3xl" />
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden border border-black/[0.03]">
                    {item.image_url
                      ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      : <Utensils size={24} className="text-[#0a0a0a]" strokeWidth={1.5} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-syne text-lg font-extrabold text-[#0a0a0a] leading-snug">{item.name}</p>
                    <p className="font-dm text-sm text-gray-400 mt-0.5 leading-relaxed">{item.description}</p>
                  </div>
                  <span className="font-syne text-xl font-black text-[#0a0a0a] shrink-0">${item.price}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ ORDERS ══════════════════════════════════════════════ */}
        {activeTab === 'orders' && (
          <div className="anim-2 space-y-5">
            <div className="flex items-center justify-between px-1 pt-2">
              <h2 className="font-syne text-2xl font-black text-[#0a0a0a] tracking-tight flex items-center gap-3">
                <ShoppingBag size={22} /> Branch Orders
              </h2>
              <span className="font-syne text-xs font-bold uppercase tracking-wider bg-yellow-100 text-yellow-700 px-4 py-2 rounded-full">
                {orders.length} orders
              </span>
            </div>
            <div className="space-y-3">
              {orders.map((order, idx) => {
                const st = ORDER_STATUS[order.status] || ORDER_STATUS.completed;
                const isSettled = ['completed', 'cancelled'].includes(order.status);
                return (
                  <div key={order.id} className="hover-lift bg-white rounded-3xl border border-black/[0.06] shadow-sm overflow-hidden relative pl-6 pr-6 py-6 flex flex-col sm:flex-row sm:items-center gap-4" style={{ animationDelay: `${idx * 0.04}s` }}>
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#FFD600] rounded-l-3xl" />
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
                      <span className="font-syne text-sm font-black text-[#0a0a0a]">T{order.table_id}</span>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-syne text-base font-extrabold text-[#0a0a0a]">Order #{order.id}</span>
                        <span className={`font-syne text-[11px] font-bold uppercase tracking-wide px-3 py-0.5 rounded-full ${st.bg} ${st.text}`}>{order.status}</span>
                      </div>
                      <p className="font-dm text-sm text-gray-400 flex items-center gap-1.5">
                        <Clock size={13} /> ${order.total_amount}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 flex-wrap">
                      {!isSettled && (
                        <select className="font-syne font-bold text-xs uppercase bg-gray-100 text-[#0a0a0a] px-4 py-3 rounded-xl border-2 border-transparent focus:border-[#FFD600] outline-none transition-all"
                          value={order.status} onChange={e => updateOrderStatus(order.id, e.target.value)}>
                          <option value="pending">Pending</option>
                          <option value="preparing">Preparing</option>
                          <option value="served">Served</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      )}
                      <span className={`font-syne text-xs font-bold uppercase tracking-wide px-4 py-2.5 rounded-xl ${order.is_paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {order.is_paid ? 'Paid' : 'Unpaid'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ CUSTOMERS ═══════════════════════════════════════════ */}
        {activeTab === 'customers' && (
          <div className="anim-2 space-y-5">
            <div className="flex items-center justify-between px-1 pt-2">
              <h2 className="font-syne text-2xl font-black text-[#0a0a0a] tracking-tight">Customer Ecosystem</h2>
              <button onClick={() => { setSelectedCustomer(null); setShowPromoModal(true); }}
                className="flex items-center gap-2 bg-[#0a0a0a] text-white font-syne font-extrabold text-sm uppercase tracking-wide px-6 py-3.5 rounded-2xl hover:bg-gray-800 transition-all">
                <Zap size={18} fill="#FFD600" color="#FFD600" /> Send Bulk Promo
              </button>
            </div>
            <div className="space-y-3">
              {customers.map((cus, idx) => (
                <div key={cus.id} className="hover-lift bg-white rounded-3xl border border-black/[0.06] shadow-sm overflow-hidden relative flex items-center gap-5 pl-6 pr-6 py-6" style={{ animationDelay: `${idx * 0.04}s` }}>
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#FFD600] rounded-l-3xl" />
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
                    <Users size={26} className="text-[#0a0a0a]" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-syne text-lg font-extrabold text-[#0a0a0a] leading-snug">{cus.username}</p>
                    <p className="font-dm text-sm text-gray-400 mt-0.5">Verified Customer</p>
                  </div>
                  <button onClick={() => { setSelectedCustomer(cus); setShowPromoModal(true); }}
                    className="font-syne text-xs font-bold uppercase tracking-wide bg-yellow-100 text-yellow-700 px-5 py-3 rounded-xl hover:bg-[#FFD600] hover:text-[#0a0a0a] transition-all">
                    Send Promo
                  </button>
                </div>
              ))}
              {customers.length === 0 && (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                  <p className="font-syne text-gray-400 font-bold uppercase tracking-widest">No customers found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ EMPLOYEES ═══════════════════════════════════════════ */}
        {activeTab === 'employees' && (
          <div className="anim-2 space-y-5">
            <div className="flex items-center justify-between px-1 pt-2">
              <h2 className="font-syne text-2xl font-black text-[#0a0a0a] tracking-tight">Branch Staff</h2>
              {isMgmt && (
                <button onClick={() => setShowAddEmployee(true)}
                  className="flex items-center gap-2 bg-[#FFD600] text-[#0a0a0a] font-syne font-extrabold text-sm uppercase tracking-wide px-6 py-3.5 rounded-2xl shadow-[0_4px_16px_rgba(255,214,0,.3)] hover:-translate-y-0.5 active:scale-95 transition-all">
                  <Plus size={18} strokeWidth={2.5} /> Add Staff
                </button>
              )}
            </div>
            <div className="space-y-3">
              {employees.map((emp, idx) => (
                <div key={emp.id} className="hover-lift bg-white rounded-3xl border border-black/[0.06] shadow-sm overflow-hidden relative flex items-center gap-5 pl-6 pr-6 py-6" style={{ animationDelay: `${idx * 0.04}s` }}>
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#FFD600] rounded-l-3xl" />
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
                    <Users size={26} className="text-[#0a0a0a]" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-syne text-lg font-extrabold text-[#0a0a0a] leading-snug">{emp.username}</p>
                    <p className="font-dm text-sm text-gray-400 mt-0.5">Branch #{branchId}</p>
                  </div>
                  <span className="font-syne text-xs font-bold uppercase tracking-wide bg-yellow-100 text-yellow-700 px-4 py-2 rounded-full shrink-0">
                    {emp.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── ADD MENU MODAL ──────────────────────────────────────── */}
      {showAddMenu && (
        <Modal onClose={() => setShowAddMenu(false)} title="Add Menu Item" icon={<Utensils size={18} color="#0a0a0a" />}>
          <form onSubmit={handleAddMenu} className="space-y-5">

            <div className="space-y-2">
              <label className="font-syne text-xs font-bold uppercase tracking-wider text-gray-400">Item Name</label>
              <input className={inputCls} placeholder="e.g. Grilled Salmon"
                value={newMenuItem.name} onChange={e => setNewMenuItem({ ...newMenuItem, name: e.target.value })} required />
            </div>

            <div className="space-y-2">
              <label className="font-syne text-xs font-bold uppercase tracking-wider text-gray-400">Description</label>
              <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Brief description of the dish…"
                value={newMenuItem.description} onChange={e => setNewMenuItem({ ...newMenuItem, description: e.target.value })} required />
            </div>

            <div className="space-y-2">
              <label className="font-syne text-xs font-bold uppercase tracking-wider text-gray-400">Price ($)</label>
              <input type="number" step="0.01" className={inputCls} placeholder="0.00"
                value={newMenuItem.price} onChange={e => setNewMenuItem({ ...newMenuItem, price: parseFloat(e.target.value) })} required />
            </div>

            {/* ── Image field with preview ─────────────────────── */}
            <div className="space-y-2">
              <label className="font-syne text-xs font-bold uppercase tracking-wider text-gray-400">Image</label>

              {/* URL input + upload button */}
              <div className="flex gap-3">
                <input className={`${inputCls} flex-1`} placeholder="Paste URL or upload below…"
                  value={newMenuItem.image_url} onChange={e => setNewMenuItem({ ...newMenuItem, image_url: e.target.value })} />
                <label className={`w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0 cursor-pointer hover:bg-gray-200 transition-all active:scale-95 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
                  {isUploading
                    ? <div className="w-5 h-5 border-2 border-gray-400 border-t-[#FFD600] rounded-full animate-spin" />
                    : <Upload size={20} className="text-[#0a0a0a]" />}
                </label>
              </div>

              {/* Live image preview */}
              <div key="image-preview-area">
                {newMenuItem.image_url ? (
                  <div key="preview-img-container" className="relative mt-2 rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
                    <img
                      key={newMenuItem.image_url}
                      src={newMenuItem.image_url}
                      alt="Preview"
                      className="w-full h-44 object-cover"
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                    <button
                      type="button"
                      onClick={() => setNewMenuItem({ ...newMenuItem, image_url: '' })}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div key="preview-placeholder" className="mt-2 rounded-2xl border-2 border-dashed border-gray-200 h-24 flex items-center justify-center gap-2 text-gray-300">
                    <ImageIcon size={20} />
                    <span className="font-syne text-xs font-bold uppercase tracking-wide">Preview appears here</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowAddMenu(false)}
                className="flex-1 py-4 bg-gray-100 text-[#0a0a0a] font-syne font-bold uppercase text-sm rounded-2xl hover:bg-gray-200 active:scale-95 transition-all">
                Cancel
              </button>
              <button type="submit"
                className="flex-1 py-4 bg-[#FFD600] text-[#0a0a0a] font-syne font-extrabold uppercase text-sm rounded-2xl shadow-[0_4px_16px_rgba(255,214,0,.3)] hover:-translate-y-0.5 active:scale-95 transition-all">
                Add Item
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── ADD EMPLOYEE MODAL ──────────────────────────────────── */}
      {showAddEmployee && (
        <Modal onClose={() => setShowAddEmployee(false)} title="Hire Staff" icon={<Users size={18} color="#0a0a0a" />}>
          <form onSubmit={handleAddEmployee} className="space-y-5">
            <div className="space-y-2">
              <label className="font-syne text-xs font-bold uppercase tracking-wider text-gray-400">User Email / Username</label>
              <input className={inputCls} placeholder="e.g. jane@example.com"
                value={newEmployee.email} onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })} required />
              <p className="text-[10px] text-gray-400 italic">User must have signed up for an account first.</p>
            </div>
            <div className="space-y-2">
              <label className="font-syne text-xs font-bold uppercase tracking-wider text-gray-400">Role</label>
              <select className={selectCls} value={newEmployee.role}
                onChange={e => setNewEmployee({ ...newEmployee, role: e.target.value })} required>
                <option value="">Select role…</option>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowAddEmployee(false)}
                className="flex-1 py-4 bg-gray-100 text-[#0a0a0a] font-syne font-bold uppercase text-sm rounded-2xl hover:bg-gray-200 active:scale-95 transition-all">
                Cancel
              </button>
              <button type="submit"
                className="flex-1 py-4 bg-[#FFD600] text-[#0a0a0a] font-syne font-extrabold uppercase text-sm rounded-2xl shadow-[0_4px_16px_rgba(255,214,0,.3)] hover:-translate-y-0.5 active:scale-95 transition-all">
                Promote to Staff
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── PROMO MODAL ────────────────────────────────────────── */}
      {showPromoModal && (
        <Modal onClose={() => setShowPromoModal(false)} title={selectedCustomer ? `Promo for ${selectedCustomer.username}` : "Bulk Promo Campaign"} icon={<Zap size={18} color="#0a0a0a" fill="#0a0a0a" />}>
          <form onSubmit={handleSendPromo} className="space-y-5">
            <div className="space-y-2">
              <label className="font-syne text-xs font-bold uppercase tracking-wider text-gray-400">Discount Percentage (%)</label>
              <input type="number" className={inputCls} value={promoData.discount}
                onChange={e => setPromoData({ ...promoData, discount: parseInt(e.target.value) })} required />
            </div>
            <div className="space-y-2">
              <label className="font-syne text-xs font-bold uppercase tracking-wider text-gray-400">Message Title</label>
              <input className={inputCls} placeholder="e.g. Flash Sale!" value={promoData.title}
                onChange={e => setPromoData({ ...promoData, title: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <label className="font-syne text-xs font-bold uppercase tracking-wider text-gray-400">Message Body</label>
              <textarea className={`${inputCls} resize-none`} rows={4} value={promoData.message}
                onChange={e => setPromoData({ ...promoData, message: e.target.value })} required />
              <p className="font-dm text-[10px] text-gray-400">Tip: Use {`{CODE}`} and {`{PERCENT}`} as placeholders.</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowPromoModal(false)}
                className="flex-1 py-4 bg-gray-100 text-[#0a0a0a] font-syne font-bold uppercase text-sm rounded-2xl hover:bg-gray-200 transition-all">
                Cancel
              </button>
              <button type="submit"
                className="flex-1 py-4 bg-[#0a0a0a] text-white font-syne font-extrabold uppercase text-sm rounded-2xl shadow-xl hover:bg-gray-800 transition-all">
                Send Campaign
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}