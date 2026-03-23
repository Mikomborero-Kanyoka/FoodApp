import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Plus, Users, Building, ChevronRight, Store, X, Zap } from 'lucide-react';

/* ── Fonts + keyframes (injected once) ─────────────────────────── */
if (!document.querySelector('[data-ad-fonts]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&family=DM+Sans:wght@300;400;500&display=swap';
  link.setAttribute('data-ad-fonts', '');
  document.head.appendChild(link);

  const style = document.createElement('style');
  style.setAttribute('data-ad-styles', '');
  style.textContent = `
    .font-syne { font-family: 'Syne', sans-serif !important; }
    .font-dm   { font-family: 'DM Sans', sans-serif !important; }

    @keyframes ad-fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes ad-scaleIn {
      from { opacity: 0; transform: scale(0.94); }
      to   { opacity: 1; transform: scale(1); }
    }

    .anim-1 { animation: ad-fadeUp .5s .00s cubic-bezier(.22,1,.36,1) both; }
    .anim-2 { animation: ad-fadeUp .5s .08s cubic-bezier(.22,1,.36,1) both; }
    .anim-3 { animation: ad-fadeUp .5s .16s cubic-bezier(.22,1,.36,1) both; }
    .anim-4 { animation: ad-fadeUp .5s .24s cubic-bezier(.22,1,.36,1) both; }
    .modal-in { animation: ad-scaleIn .3s cubic-bezier(.22,1,.36,1) both; }

    .branch-card { transition: box-shadow .22s ease, transform .22s ease; }
    .branch-card:hover { box-shadow: 0 12px 40px rgba(0,0,0,.10); transform: translateY(-3px); }

    .emp-card { transition: box-shadow .2s ease, transform .2s ease; }
    .emp-card:hover { box-shadow: 0 8px 28px rgba(0,0,0,.08); transform: translateY(-2px); }

    .add-card { transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease; }
    .add-card:hover { border-color: #FFD600 !important; box-shadow: 0 8px 28px rgba(255,214,0,.15); transform: translateY(-3px); }
    .add-card:hover .add-icon { background: #FFD600 !important; }
    .add-card:hover .add-icon svg { color: #0a0a0a !important; }
  `;
  document.head.appendChild(style);
}

/* ── Shared input/select classes ────────────────────────────────── */
const inputCls =
  'w-full px-5 py-4 bg-gray-100 rounded-2xl border-2 border-transparent focus:border-[#FFD600] outline-none font-dm text-base text-[#0a0a0a] transition-all placeholder:text-gray-400';

const selectCls =
  'w-full px-5 py-4 bg-gray-100 rounded-2xl border-2 border-transparent focus:border-[#FFD600] outline-none font-syne font-bold text-sm uppercase text-[#0a0a0a] transition-all';

/* ── Modal wrapper ────────────────────────────────────────────── */
const Modal = ({ onClose, title, icon, children }) => (
  <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
    <div className="modal-in bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-black/[0.06] overflow-hidden">
      {/* Modal header */}
      <div className="bg-[#0a0a0a] px-8 py-7 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFD600] flex items-center justify-center shrink-0">
            {icon}
          </div>
          <h2 className="font-syne text-xl font-extrabold text-white">{title}</h2>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95"
        >
          <X size={18} />
        </button>
      </div>
      {/* Modal body */}
      <div className="px-8 py-8">{children}</div>
    </div>
  </div>
);

/* ══════════════════════════════════════════════════════════════════
   Component
══════════════════════════════════════════════════════════════════ */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [branches,        setBranches]        = useState([]);
  const [employees,       setEmployees]       = useState([]);
  const [roles,           setRoles]           = useState([]);
  const [newBranch,       setNewBranch]       = useState({ name: '', address: '' });
  const [newEmployee,     setNewEmployee]     = useState({ email: '', role: '', branch_id: '' });
  const [showAddBranch,   setShowAddBranch]   = useState(false);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [activeTab,       setActiveTab]       = useState('branches');

  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        const role = session.user.user_metadata?.role || session.user.app_metadata?.role;
        if (role !== 'admin') {
          navigate('/login');
        }
      } else {
        navigate('/login');
      }
    });

    fetchBranches();
    fetchEmployees();
    fetchRoles();
  }, [navigate]);

  const fetchBranches  = async () => { try { const { data, error } = await supabase.from('branches').select('*'); if (error) throw error; setBranches(data);  } catch(e){ console.error(e); } };
  const fetchEmployees = async () => { try { const { data, error } = await supabase.from('users').select('*'); if (error) throw error; setEmployees(data); } catch(e){ console.error(e); } };
  const fetchRoles     = async () => { setRoles(['admin', 'manager', 'supervisor', 'waiter', 'kitchen', 'staff', 'customer']); };

  const handleAddBranch = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('branches').insert([newBranch]);
      if (error) throw error;
      setNewBranch({ name: '', address: '' });
      setShowAddBranch(false);
      fetchBranches();
    } catch(err){ console.error(err); }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    try {
      // 1. Find the user by email in the public.users table (populated via signup)
      // Note: This requires the staff member to have already created a customer account
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('id')
        .eq('email', newEmployee.email.trim()) 
        .maybeSingle();

      if (fetchError) throw fetchError;
      
      let targetId = userData?.id;

      // If not found in users table, they might not have a profile but exist in Auth
      // However, we can't search Auth easily without Admin API.
      // So we assume they signed up and have a profile.
      
      if (!targetId) {
        alert('User with this email/username not found. Please ensure they have signed up first.');
        return;
      }

      const { error } = await supabase
        .from('users')
        .update({
          role: newEmployee.role,
          branch_id: newEmployee.branch_id ? parseInt(newEmployee.branch_id) : null,
        })
        .eq('id', targetId);

      if (error) throw error;

      setNewEmployee({ email: '', role: '', branch_id: '' });
      setShowAddEmployee(false);
      fetchEmployees();
      alert('Staff member onboarded successfully!');
    } catch(err){ 
      console.error(err); 
      alert('Failed to onboard staff: ' + err.message);
    }
  };

  /* ── Main ───────────────────────────────────────────────────── */
  return (
    <div className="font-dm min-h-svh bg-[#f2f2f0] pb-24">

      {/* ── Dark top bar ──────────────────────────────────────── */}
      <div className="bg-[#0a0a0a] px-5 pt-12 pb-24 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 opacity-[0.04] rotate-12 pointer-events-none">
          <Store size={240} color="#fff" />
        </div>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          {/* Brand */}
          <div className="anim-1 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#FFD600] flex items-center justify-center shrink-0">
              <Zap size={26} color="#0a0a0a" fill="#0a0a0a" />
            </div>
            <div>
              <p className="font-syne text-xs font-semibold uppercase tracking-widest text-gray-500 mb-0.5">
                FoodApp
              </p>
              <h1 className="font-syne text-2xl font-extrabold text-white leading-tight">
                Admin Central
              </h1>
            </div>
          </div>

          {/* Tab nav */}
          <div className="anim-1 flex items-center gap-2 bg-white/10 p-1.5 rounded-2xl self-start sm:self-auto">
            {[
              { key: 'branches',  label: 'Branches',  icon: <Building size={16} /> },
              { key: 'employees', label: 'Employees', icon: <Users size={16} /> },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-syne font-bold text-sm uppercase tracking-wide transition-all active:scale-95
                  ${activeTab === t.key
                    ? 'bg-[#FFD600] text-[#0a0a0a]'
                    : 'text-gray-400 hover:text-white'}`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 -mt-12 space-y-6">

        {/* ── BRANCHES TAB ────────────────────────────────────── */}
        {activeTab === 'branches' && (
          <div className="anim-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">

            {/* Add branch card */}
            <button
              onClick={() => setShowAddBranch(true)}
              className="add-card bg-white rounded-3xl border-2 border-dashed border-gray-200 shadow-sm p-10 flex flex-col items-center justify-center gap-4 cursor-pointer text-center min-h-[200px]"
            >
              <div className="add-icon w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center transition-all">
                <Plus size={28} className="text-gray-400 transition-colors" />
              </div>
              <span className="font-syne text-base font-extrabold text-[#0a0a0a] uppercase tracking-wide">
                Add New Branch
              </span>
            </button>

            {branches.map((branch, idx) => (
              <div
                key={branch.id}
                className="branch-card bg-white rounded-3xl border border-black/[0.06] shadow-sm overflow-hidden relative"
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                {/* top accent */}
                <div className="h-1.5 bg-[#FFD600] w-full" />
                {/* ghost icon */}
                <div className="absolute top-4 right-4 opacity-[0.06] pointer-events-none">
                  <Building size={80} />
                </div>

                <div className="p-7 flex flex-col gap-5">
                  <div>
                    <h2 className="font-syne text-xl font-extrabold text-[#0a0a0a] leading-snug mb-1">
                      {branch.name}
                    </h2>
                    <p className="font-dm text-sm text-gray-400 leading-relaxed">{branch.address}</p>
                  </div>
                  <button
                    onClick={() => navigate(`/branch/${branch.id}`)}
                    className="flex items-center justify-between w-full px-5 py-4 bg-[#0a0a0a] text-white rounded-2xl font-syne font-bold text-sm uppercase tracking-wide hover:bg-gray-800 active:scale-95 transition-all"
                  >
                    Manage Branch <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── EMPLOYEES TAB ───────────────────────────────────── */}
        {activeTab === 'employees' && (
          <div className="anim-2 space-y-5">

            {/* Section header */}
            <div className="flex items-center justify-between px-1 pt-2">
              <h2 className="font-syne text-2xl font-black text-[#0a0a0a] tracking-tight">
                Active Personnel
              </h2>
              <button
                onClick={() => setShowAddEmployee(true)}
                className="flex items-center gap-2 bg-[#FFD600] text-[#0a0a0a] font-syne font-extrabold text-sm uppercase tracking-wide px-6 py-3.5 rounded-2xl shadow-[0_4px_16px_rgba(255,214,0,.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(255,214,0,.4)] active:scale-95 transition-all"
              >
                <Plus size={18} strokeWidth={2.5} /> Add Employee
              </button>
            </div>

            {/* Employee cards */}
            <div className="space-y-3">
              {employees.map((emp, idx) => (
                <div
                  key={emp.id}
                  className="emp-card bg-white rounded-3xl border border-black/[0.06] shadow-sm overflow-hidden relative flex items-center gap-5 pl-6 pr-6 py-6"
                  style={{ animationDelay: `${idx * 0.04}s` }}
                >
                  {/* yellow left bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#FFD600] rounded-l-3xl" />

                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
                    <Users size={26} className="text-[#0a0a0a]" strokeWidth={1.5} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-syne text-lg font-extrabold text-[#0a0a0a] leading-snug">
                      {emp.username}
                    </p>
                    <p className="font-dm text-sm text-gray-400 mt-0.5">
                      {branches.find(b => b.id === emp.branch_id)?.name || 'Global Admin'}
                    </p>
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

      {/* ── ADD EMPLOYEE MODAL ──────────────────────────────────── */}
      {showAddEmployee && (
        <Modal
          onClose={() => setShowAddEmployee(false)}
          title="Onboard Staff"
          icon={<Users size={18} color="#0a0a0a" />}
        >
          <form onSubmit={handleAddEmployee} className="space-y-5">
            <div className="space-y-2">
              <label className="font-syne text-xs font-bold uppercase tracking-wider text-gray-400">User Email / Username</label>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. john@example.com"
                value={newEmployee.email}
                onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })}
                required
              />
              <p className="text-[10px] text-gray-400 italic">User must have signed up for an account first.</p>
            </div>

            <div className="space-y-2">
              <label className="font-syne text-xs font-bold uppercase tracking-wider text-gray-400">Assigned Role</label>
              <select
                className={selectCls}
                value={newEmployee.role}
                onChange={e => setNewEmployee({ ...newEmployee, role: e.target.value })}
                required
              >
                <option value="">Select role…</option>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="font-syne text-xs font-bold uppercase tracking-wider text-gray-400">Branch</label>
              <select
                className={selectCls}
                value={newEmployee.branch_id}
                onChange={e => setNewEmployee({ ...newEmployee, branch_id: e.target.value })}
              >
                <option value="">None (Global Admin)</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddEmployee(false)}
                className="flex-1 py-4 bg-gray-100 text-[#0a0a0a] font-syne font-bold uppercase text-sm rounded-2xl hover:bg-gray-200 active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-4 bg-[#FFD600] text-[#0a0a0a] font-syne font-extrabold uppercase text-sm rounded-2xl shadow-[0_4px_16px_rgba(255,214,0,.3)] hover:-translate-y-0.5 active:scale-95 transition-all"
              >
                Promote to Staff
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── ADD BRANCH MODAL ────────────────────────────────────── */}
      {showAddBranch && (
        <Modal
          onClose={() => setShowAddBranch(false)}
          title="Create Branch"
          icon={<Building size={18} color="#0a0a0a" />}
        >
          <form onSubmit={handleAddBranch} className="space-y-5">
            <div className="space-y-2">
              <label className="font-syne text-xs font-bold uppercase tracking-wider text-gray-400">Branch Name</label>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. Downtown Location"
                value={newBranch.name}
                onChange={e => setNewBranch({ ...newBranch, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="font-syne text-xs font-bold uppercase tracking-wider text-gray-400">Address</label>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. 123 Main Street"
                value={newBranch.address}
                onChange={e => setNewBranch({ ...newBranch, address: e.target.value })}
                required
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddBranch(false)}
                className="flex-1 py-4 bg-gray-100 text-[#0a0a0a] font-syne font-bold uppercase text-sm rounded-2xl hover:bg-gray-200 active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-4 bg-[#FFD600] text-[#0a0a0a] font-syne font-extrabold uppercase text-sm rounded-2xl shadow-[0_4px_16px_rgba(255,214,0,.3)] hover:-translate-y-0.5 active:scale-95 transition-all"
              >
                Confirm Create
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}