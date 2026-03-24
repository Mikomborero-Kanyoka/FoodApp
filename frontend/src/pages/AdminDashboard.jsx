import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  Activity,
  BarChart3,
  Building,
  ChevronRight,
  Clock3,
  DollarSign,
  History,
  LogOut,
  Plus,
  Power,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Store,
  Trash2,
  UserCog,
  Users,
  UtensilsCrossed,
  X,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ADMIN_ASSIGNABLE_ROLES,
  fetchUserProfile,
  getDashboardPath,
  getEffectiveBranchId,
  getEffectiveRole,
} from '../authProfile';
import {
  buildBranchInsights,
  buildBranchShare,
  buildCategoryPreferences,
  buildCustomerInsights,
  buildDayPartInsights,
  buildRevenueTrend,
  buildStatusMix,
  buildTopFoodPreferences,
  formatCurrency,
  formatDate,
  formatDateTime,
  getEmployeeLifecycle,
  getOrderItems,
  getOrderStatusClass,
} from './adminDashboardUtils';
import {
  EmptyPanel,
  ensureAdminDashboardStyles,
  HorizontalBars,
  Modal,
  SearchInput,
  StatCard,
  TABS,
  VerticalBars,
  inputCls,
  selectCls,
} from './adminDashboardUi';

ensureAdminDashboardStyles();

const CHART_COLORS = ['#FFD600', '#0a0a0a', '#22c55e', '#f97316', '#3b82f6', '#fb7185'];
const ROLE_OPTIONS = ['pending_staff', ...ADMIN_ASSIGNABLE_ROLES];
const DEFAULT_EMPLOYEE_DRAFT = { branchId: '', role: 'pending_staff', isActive: true };
const compactCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

function formatCompactCurrency(value) {
  return compactCurrency.format(Number(value || 0));
}

function getRecordName(record) {
  const username = typeof record?.username === 'string' ? record.username.trim() : '';
  if (username) return username;
  return `user_${String(record?.id || '').slice(0, 8)}`;
}

function toTitleCase(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildBranchesById(branches) {
  return branches.reduce((acc, branch) => {
    acc[String(branch.id)] = branch;
    return acc;
  }, {});
}

function DashboardPanel({ title, kicker, action, children, className = '' }) {
  return (
    <section className={`lift-card bg-white rounded-3xl border border-black/[0.06] shadow-sm p-5 sm:p-6 ${className}`}>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          {kicker ? (
            <p className="font-syne text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-2">
              {kicker}
            </p>
          ) : null}
          <h2 className="font-syne text-[20px] sm:text-[24px] font-black tracking-tight text-[#0a0a0a]">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MiniMetric({ label, value, detail }) {
  return (
    <div className="bg-gray-50 rounded-2xl border border-black/[0.04] p-4">
      <p className="font-syne text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">{label}</p>
      <p className="font-syne text-[22px] font-black text-[#0a0a0a] mt-2 leading-none">{value}</p>
      {detail ? <p className="font-dm text-[11px] text-gray-500 mt-3">{detail}</p> : null}
    </div>
  );
}

function OrderStatusPill({ status }) {
  return (
    <span className={`font-syne text-[10px] font-bold uppercase tracking-[0.16em] px-3 py-1.5 rounded-full ${getOrderStatusClass(status)}`}>
      {toTitleCase(status || 'completed')}
    </span>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [branches, setBranches] = useState([]);
  const [userRecords, setUserRecords] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [customerQuery, setCustomerQuery] = useState('');
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [employeeDraft, setEmployeeDraft] = useState(DEFAULT_EMPLOYEE_DRAFT);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [newBranch, setNewBranch] = useState({ name: '', address: '' });
  const [notice, setNotice] = useState(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingBranch, setIsSavingBranch] = useState(false);
  const [isSavingEmployee, setIsSavingEmployee] = useState(false);

  const branchesById = buildBranchesById(branches);
  const employees = userRecords.filter((record) => record.role !== 'customer');
  const customers = userRecords.filter((record) => record.role === 'customer');
  const customerInsights = buildCustomerInsights(customers, orders, branchesById);
  const branchInsights = buildBranchInsights(branches, orders);
  const revenueTrend = buildRevenueTrend(orders, 7);
  const dayPartInsights = buildDayPartInsights(orders);
  const topFoodPreferences = buildTopFoodPreferences(orders, 6);
  const categoryPreferences = buildCategoryPreferences(orders, 5);
  const branchShare = buildBranchShare(branches, orders);
  const statusMix = buildStatusMix(orders);
  const selectedCustomer = customerInsights.find((customer) => customer.id === selectedCustomerId) || null;
  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId) || null;
  const liveOrders = orders.filter((order) => !['completed', 'cancelled'].includes(order.status));
  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const averageTicket = orders.length ? totalRevenue / orders.length : 0;
  const repeatCustomers = customerInsights.filter((customer) => customer.ordersCount > 1).length;
  const repeatRate = customerInsights.length ? Math.round((repeatCustomers / customerInsights.length) * 100) : 0;
  const pendingApplications = employees.filter((employee) => employee.role === 'pending_staff' && employee.is_active !== false);
  const inactiveEmployees = employees.filter((employee) => employee.role !== 'admin' && employee.is_active === false);
  const activeStaff = employees.filter((employee) => employee.role !== 'admin' && employee.role !== 'pending_staff' && employee.is_active !== false);
  const topCustomer = customerInsights[0] || null;
  const topBranch = branchInsights[0] || null;
  const peakDayPart = [...dayPartInsights].sort((left, right) => right.value - left.value)[0] || null;
  const topCategory = categoryPreferences[0]?.label || 'No preference yet';
  const customerAverageSpend = customerInsights.length
    ? customerInsights.reduce((sum, customer) => sum + customer.spend, 0) / customerInsights.length
    : 0;

  const filteredCustomers = customerInsights.filter((customer) => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) return true;

    return [
      getRecordName(customer),
      customer.favoriteHeadline,
      customer.primaryBranch?.name,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const filteredEmployees = employees.filter((employee) => {
    const query = employeeQuery.trim().toLowerCase();
    if (!query) return true;

    return [
      getRecordName(employee),
      employee.role,
      branchesById[String(employee.branch_id)]?.name,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const reviewQueue = filteredEmployees.filter((employee) => employee.role === 'pending_staff' && employee.is_active !== false);
  const roster = filteredEmployees.filter((employee) => employee.role !== 'pending_staff' || employee.is_active === false);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const refreshDashboard = async (showIndicator = true) => {
    if (showIndicator) setIsRefreshing(true);

    try {
      const [branchesResult, usersResult, ordersResult] = await Promise.all([
        supabase.from('branches').select('*'),
        supabase.from('users').select('*'),
        supabase
          .from('orders')
          .select(`
            id,
            user_id,
            branch_id,
            status,
            total_amount,
            created_at,
            branches (
              id,
              name
            ),
            order_items (
              quantity,
              price_at_order,
              menu_item_id,
              menu_items (
                name,
                category
              )
            )
          `)
          .order('created_at', { ascending: false }),
      ]);

      if (branchesResult.error) throw branchesResult.error;
      if (usersResult.error) throw usersResult.error;
      if (ordersResult.error) throw ordersResult.error;

      const nextBranches = [...(branchesResult.data || [])].sort((left, right) =>
        String(left.name || '').localeCompare(String(right.name || ''), undefined, { sensitivity: 'base' }),
      );

      const nextUsers = [...(usersResult.data || [])].sort((left, right) => {
        if (left.role === 'admin' && right.role !== 'admin') return -1;
        if (left.role !== 'admin' && right.role === 'admin') return 1;
        return getRecordName(left).localeCompare(getRecordName(right), undefined, { sensitivity: 'base' });
      });

      setBranches(nextBranches);
      setUserRecords(nextUsers);
      setOrders(ordersResult.data || []);
    } catch (error) {
      console.error(error);
      setNotice({
        tone: 'error',
        message: error.message || 'Failed to refresh the admin dashboard.',
      });
    } finally {
      if (showIndicator) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadAdmin = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          navigate('/login', { replace: true });
          return;
        }

        const profile = await fetchUserProfile(session.user.id).catch((error) => {
          console.error('Failed to load profile:', error);
          return null;
        });

        const role = getEffectiveRole(session.user, profile);
        const branchId = getEffectiveBranchId(session.user, profile);

        if (role !== 'admin') {
          navigate(getDashboardPath(role, branchId) || '/login', { replace: true });
          return;
        }

        if (!isMounted) return;

        setUser(session.user);
        await refreshDashboard();
      } finally {
        if (isMounted) setIsCheckingAccess(false);
      }
    };

    loadAdmin();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (!user?.id) return undefined;

    const liveChannel = supabase
      .channel('admin-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => refreshDashboard(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, () => refreshDashboard(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => refreshDashboard(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => refreshDashboard(false))
      .subscribe();

    return () => {
      supabase.removeChannel(liveChannel);
    };
  }, [user?.id]);

  const closeEmployeeModal = () => {
    setSelectedEmployeeId(null);
    setEmployeeDraft(DEFAULT_EMPLOYEE_DRAFT);
  };

  const openEmployeeModal = (employee) => {
    setSelectedEmployeeId(employee.id);
    setEmployeeDraft({
      branchId: employee.branch_id != null ? String(employee.branch_id) : '',
      role: employee.role || 'pending_staff',
      isActive: employee.is_active !== false,
    });
  };

  const handleAddBranch = async (event) => {
    event.preventDefault();
    const payload = {
      name: newBranch.name.trim(),
      address: newBranch.address.trim(),
    };

    if (!payload.name || !payload.address) {
      setNotice({ tone: 'error', message: 'Branch name and address are required.' });
      return;
    }

    setIsSavingBranch(true);

    try {
      const { error } = await supabase.from('branches').insert([payload]);
      if (error) throw error;

      setNewBranch({ name: '', address: '' });
      setShowAddBranch(false);
      setNotice({ tone: 'success', message: `${payload.name} was added to your branch network.` });
      await refreshDashboard(false);
    } catch (error) {
      console.error(error);
      setNotice({ tone: 'error', message: error.message || 'Failed to create the branch.' });
    } finally {
      setIsSavingBranch(false);
    }
  };

  const handleSaveEmployee = async (event) => {
    event.preventDefault();
    if (!selectedEmployee) return;

    if (selectedEmployee.role === 'admin') {
      setNotice({ tone: 'error', message: 'Admin accounts are read-only from this dashboard.' });
      return;
    }

    const nextRole = employeeDraft.role || 'pending_staff';
    const requiresBranch = nextRole !== 'pending_staff';

    if (requiresBranch && !employeeDraft.branchId) {
      setNotice({ tone: 'error', message: 'Assigned staff need a branch before they can work.' });
      return;
    }

    setIsSavingEmployee(true);

    try {
      const payload = {
        role: nextRole,
        branch_id: nextRole === 'pending_staff' ? null : Number(employeeDraft.branchId),
        is_active: employeeDraft.isActive,
      };

      if (selectedEmployee.role === 'pending_staff' && nextRole !== 'pending_staff' && payload.is_active !== false) {
        payload.is_active = true;
      }

      const { error } = await supabase.from('users').update(payload).eq('id', selectedEmployee.id);
      if (error) throw error;

      closeEmployeeModal();
      setNotice({
        tone: 'success',
        message: `${getRecordName(selectedEmployee)} is now set as ${toTitleCase(payload.role)}.`,
      });
      await refreshDashboard(false);
    } catch (error) {
      console.error(error);
      setNotice({ tone: 'error', message: error.message || 'Failed to save employee changes.' });
    } finally {
      setIsSavingEmployee(false);
    }
  };

  const handleToggleEmployeeActive = async (employee) => {
    if (!employee) return;

    if (employee.id === user?.id || employee.role === 'admin') {
      setNotice({ tone: 'error', message: 'You cannot deactivate the active admin account.' });
      return;
    }

    const nextActive = employee.is_active === false;

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: nextActive })
        .eq('id', employee.id);

      if (error) throw error;

      setNotice({
        tone: 'success',
        message: `${getRecordName(employee)} was ${nextActive ? 're-activated' : 'deactivated'}.`,
      });
      await refreshDashboard(false);
    } catch (error) {
      console.error(error);
      setNotice({ tone: 'error', message: error.message || 'Failed to update employee status.' });
    }
  };

  const handleArchiveApplication = async (employee) => {
    if (!employee) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({
          role: 'pending_staff',
          branch_id: null,
          is_active: false,
        })
        .eq('id', employee.id);

      if (error) throw error;

      setNotice({
        tone: 'success',
        message: `${getRecordName(employee)} was archived from the approval queue.`,
      });
      await refreshDashboard(false);
    } catch (error) {
      console.error(error);
      setNotice({ tone: 'error', message: error.message || 'Failed to archive the application.' });
    }
  };

  const handleDeleteEmployee = async (employee) => {
    if (!employee) return;

    if (employee.id === user?.id || employee.role === 'admin') {
      setNotice({ tone: 'error', message: 'Admin accounts cannot be deleted from this dashboard.' });
      return;
    }

    const confirmed = window.confirm(
      `Delete ${getRecordName(employee)} from the employee directory? This only removes the app profile.`,
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase.from('users').delete().eq('id', employee.id);
      if (error) throw error;

      if (selectedEmployeeId === employee.id) closeEmployeeModal();

      setNotice({
        tone: 'success',
        message: `${getRecordName(employee)} was removed from the employee directory.`,
      });
      await refreshDashboard(false);
    } catch (error) {
      console.error(error);
      setNotice({
        tone: 'error',
        message: error.message || 'Failed to delete the employee profile.',
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  if (isCheckingAccess) {
    return (
      <div className="font-dm min-h-svh bg-[#f2f2f0] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-[3px] border-[#FFD600]/20 border-t-[#FFD600] animate-spin" />
        <p className="font-syne text-xs font-bold uppercase tracking-widest text-gray-400">
          Loading admin intelligence
        </p>
      </div>
    );
  }

  return (
    <div className="font-dm min-h-svh bg-[#f2f2f0] pb-16">
      <div className="bg-[#0a0a0a] px-4 sm:px-6 pt-12 pb-28 relative overflow-hidden">
        <div className="absolute -top-12 -right-8 opacity-[0.04] rotate-12 pointer-events-none">
          <Store size={240} color="#fff" />
        </div>

        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
            <div className="anim-1 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#FFD600] flex items-center justify-center shrink-0">
                  <Zap size={26} color="#0a0a0a" fill="#0a0a0a" />
                </div>
                <div>
                  <p className="font-syne text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
                    FoodApp command layer
                  </p>
                  <h1 className="font-syne text-3xl sm:text-5xl font-black text-white tracking-tight leading-none">
                    Admin Intelligence
                  </h1>
                </div>
              </div>

              <p className="font-dm text-sm sm:text-base text-gray-400 max-w-2xl leading-relaxed">
                Watch branch performance, inspect customer habits, approve or freeze staff, and track buying patterns from one control room.
              </p>
            </div>

            <div className="anim-2 flex flex-col sm:flex-row gap-3 self-start xl:self-auto">
              <button
                type="button"
                onClick={() => refreshDashboard(true)}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#FFD600] text-[#0a0a0a] font-syne font-bold text-xs uppercase tracking-[0.18em] shadow-[0_8px_24px_rgba(255,214,0,.18)] transition-all active:scale-95"
              >
                <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/10 text-white font-syne font-bold text-xs uppercase tracking-[0.18em] hover:bg-white/15 transition-all active:scale-95"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          </div>

          <div className="anim-3 flex flex-wrap items-center gap-2 bg-white/10 p-2 rounded-3xl w-fit">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`tab-pill flex items-center gap-2 px-4 sm:px-5 py-3 rounded-2xl font-syne font-bold text-[11px] sm:text-xs uppercase tracking-[0.18em] ${
                  activeTab === tab.key ? 'bg-[#FFD600] text-[#0a0a0a]' : 'text-gray-300 hover:text-white'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-16 space-y-6">
        {notice ? (
          <div
            className={`anim-3 rounded-3xl border px-5 py-4 flex items-start justify-between gap-4 ${
              notice.tone === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            <p className="font-syne text-[12px] sm:text-[13px] font-bold uppercase tracking-[0.14em]">
              {notice.message}
            </p>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        {activeTab === 'overview' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={<DollarSign size={20} />}
                label="Revenue tracked"
                value={formatCurrency(totalRevenue)}
                detail={`${orders.length} orders across ${branches.length} branches.`}
                accent="yellow"
              />
              <StatCard
                icon={<ShoppingBag size={20} />}
                label="Open demand"
                value={liveOrders.length}
                detail={`${statusMix.find((row) => row.label === 'Preparing')?.value || 0} orders are still in kitchen flow.`}
                accent="slate"
              />
              <StatCard
                icon={<UserCog size={20} />}
                label="Active staff"
                value={activeStaff.length}
                detail={`${pendingApplications.length} approvals waiting and ${inactiveEmployees.length} inactive profiles.`}
                accent="green"
              />
              <StatCard
                icon={<Users size={20} />}
                label="Repeat customers"
                value={`${repeatRate}%`}
                detail={`${repeatCustomers} customers have ordered more than once.`}
                accent="blue"
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
              <DashboardPanel title="Revenue rhythm" kicker="Last 7 days">
                {revenueTrend.some((slot) => slot.value > 0) ? (
                  <div className="space-y-6">
                    <VerticalBars rows={revenueTrend} valueFormatter={formatCompactCurrency} />
                    <div className="grid sm:grid-cols-3 gap-3">
                      <MiniMetric label="Average ticket" value={formatCurrency(averageTicket)} detail="Average revenue per order." />
                      <MiniMetric label="Top branch" value={topBranch?.name || 'No leader yet'} detail={topBranch ? formatCurrency(topBranch.revenue) : 'No orders yet'} />
                      <MiniMetric label="Peak period" value={peakDayPart?.label || 'No traffic'} detail={peakDayPart ? `${peakDayPart.value} orders` : 'Waiting for first purchase'} />
                    </div>
                  </div>
                ) : (
                  <EmptyPanel
                    title="No revenue trend yet"
                    description="Once orders start landing, the admin overview will show daily momentum here."
                  />
                )}
              </DashboardPanel>

              <DashboardPanel title="Operational pulse" kicker="Watchlist">
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <MiniMetric label="Approvals" value={pendingApplications.length} detail="Pending staff still waiting for a branch and role." />
                    <MiniMetric label="Inactive" value={inactiveEmployees.length} detail="Profiles paused from branch operations." />
                    <MiniMetric label="Favorite category" value={topCategory} detail="Strongest current food preference signal." />
                    <MiniMetric label="Best customer" value={topCustomer ? getRecordName(topCustomer) : 'No champion yet'} detail={topCustomer ? formatCurrency(topCustomer.spend) : 'No customer spend yet'} />
                  </div>
                  <div>
                    <p className="font-syne text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-4">
                      Order status mix
                    </p>
                    <HorizontalBars rows={statusMix} valueFormatter={(value) => `${value}`} accentClass="bg-[#0a0a0a]" />
                  </div>
                </div>
              </DashboardPanel>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <DashboardPanel
                title="Customer leaders"
                kicker="Spending and loyalty"
                action={
                  <button
                    type="button"
                    onClick={() => setActiveTab('customers')}
                    className="font-syne text-[11px] font-bold uppercase tracking-[0.18em] text-[#0a0a0a] flex items-center gap-1"
                  >
                    Open customers <ChevronRight size={14} />
                  </button>
                }
              >
                {customerInsights.length > 0 ? (
                  <div className="space-y-5">
                    {topCustomer ? (
                      <div className="rounded-3xl bg-[#0a0a0a] text-white p-5">
                        <p className="font-syne text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">Top spender</p>
                        <div className="mt-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                          <div>
                            <h3 className="font-syne text-2xl font-black">{getRecordName(topCustomer)}</h3>
                            <p className="font-dm text-sm text-gray-400 mt-2">
                              {topCustomer.ordersCount} orders, {topCustomer.primaryBranch?.name || 'no primary branch yet'}, last visit {formatDate(topCustomer.lastVisit)}.
                            </p>
                          </div>
                          <p className="font-syne text-3xl font-black text-[#FFD600]">{formatCurrency(topCustomer.spend)}</p>
                        </div>
                      </div>
                    ) : null}

                    <HorizontalBars
                      rows={customerInsights.slice(0, 5).map((customer) => ({
                        label: getRecordName(customer),
                        value: customer.spend,
                        meta: `${customer.ordersCount} orders, favorite: ${customer.favoriteHeadline}`,
                      }))}
                      valueFormatter={formatCompactCurrency}
                      accentClass="bg-gradient-to-r from-[#FFD600] to-[#FFED94]"
                    />
                  </div>
                ) : (
                  <EmptyPanel
                    title="Customer data pending"
                    description="Customer intelligence will populate automatically after the first recorded purchases."
                  />
                )}
              </DashboardPanel>

              <DashboardPanel
                title="Branch leaderboard"
                kicker="Revenue share"
                action={
                  <button
                    type="button"
                    onClick={() => setActiveTab('branches')}
                    className="font-syne text-[11px] font-bold uppercase tracking-[0.18em] text-[#0a0a0a] flex items-center gap-1"
                  >
                    Open branches <ChevronRight size={14} />
                  </button>
                }
              >
                {branchShare.length > 0 ? (
                  <HorizontalBars rows={branchShare} valueFormatter={formatCompactCurrency} accentClass="bg-[#0a0a0a]" />
                ) : (
                  <EmptyPanel
                    title="Branch results pending"
                    description="As orders come in, branch revenue and customer concentration will show up here."
                  />
                )}
              </DashboardPanel>
            </div>

            <DashboardPanel title="Recent orders" kicker="Most recent activity">
              {orders.length > 0 ? (
                <div className="space-y-3">
                  {orders.slice(0, 6).map((order) => (
                    <div
                      key={order.id}
                      className="rounded-3xl border border-black/[0.06] bg-gray-50 px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-syne text-sm font-black text-[#0a0a0a]">Order #{order.id}</span>
                          <OrderStatusPill status={order.status} />
                        </div>
                        <p className="font-dm text-sm text-gray-500">
                          {order.branches?.name || branchesById[String(order.branch_id)]?.name || 'Unknown branch'} - {formatDateTime(order.created_at)}
                        </p>
                        <p className="font-dm text-sm text-gray-500">
                          {getOrderItems(order).length} line items
                        </p>
                      </div>
                      <span className="font-syne text-xl font-black text-[#0a0a0a]">{formatCurrency(order.total_amount)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPanel
                  title="No orders recorded"
                  description="Recent transactions will appear here once branches start processing orders."
                />
              )}
            </DashboardPanel>
          </>
        ) : null}

        {activeTab === 'branches' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={<Building size={20} />}
                label="Branches"
                value={branches.length}
                detail={`${branchInsights.filter((branch) => branch.ordersCount > 0).length} branches have order traffic.`}
                accent="yellow"
              />
              <StatCard
                icon={<DollarSign size={20} />}
                label="Top branch revenue"
                value={topBranch ? formatCurrency(topBranch.revenue) : formatCurrency(0)}
                detail={topBranch ? `${topBranch.name} leads the network.` : 'No branch sales yet.'}
                accent="slate"
              />
              <StatCard
                icon={<Users size={20} />}
                label="Active guests"
                value={customerInsights.filter((customer) => customer.ordersCount > 0).length}
                detail="Customers with at least one recorded order."
                accent="blue"
              />
              <StatCard
                icon={<ShoppingBag size={20} />}
                label="Branch avg ticket"
                value={topBranch ? formatCurrency(topBranch.averageTicket) : formatCurrency(0)}
                detail="Average ticket at the current leading branch."
                accent="green"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <button
                type="button"
                onClick={() => setShowAddBranch(true)}
                className="lift-card bg-white rounded-3xl border-2 border-dashed border-gray-200 shadow-sm p-8 min-h-[260px] flex flex-col items-center justify-center gap-4 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <Plus size={28} className="text-gray-400" />
                </div>
                <div>
                  <p className="font-syne text-xl font-black text-[#0a0a0a]">Add new branch</p>
                  <p className="font-dm text-sm text-gray-500 mt-2">
                    Expand the network and hand the location off to branch operations.
                  </p>
                </div>
              </button>

              {branchInsights.map((branch) => (
                <div key={branch.id} className="lift-card bg-white rounded-3xl border border-black/[0.06] shadow-sm overflow-hidden">
                  <div className="h-1.5 bg-[#FFD600]" />
                  <div className="p-6 space-y-5">
                    <div className="space-y-2">
                      <p className="font-syne text-2xl font-black text-[#0a0a0a] leading-tight">{branch.name}</p>
                      <p className="font-dm text-sm text-gray-500 leading-relaxed">{branch.address}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <MiniMetric label="Revenue" value={formatCompactCurrency(branch.revenue)} />
                      <MiniMetric label="Orders" value={branch.ordersCount} />
                      <MiniMetric label="Guests" value={branch.customerCount} />
                    </div>

                    <div className="space-y-3">
                      <p className="font-syne text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">What sells here</p>
                      {branch.topItems.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {branch.topItems.map((item) => (
                            <span
                              key={`${branch.id}-${item.name}`}
                              className="rounded-full bg-gray-100 px-3 py-2 font-dm text-xs text-gray-600"
                            >
                              {item.name} - {item.count}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="font-dm text-sm text-gray-500">No menu preference signal yet.</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2">
                      <p className="font-dm text-xs text-gray-400">
                        Last activity: {branch.recentOrderAt ? formatDateTime(branch.recentOrderAt) : 'No order yet'}
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate(`/branch/${branch.id}`)}
                        className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#0a0a0a] text-white font-syne font-bold text-[11px] uppercase tracking-[0.18em] hover:bg-gray-800 transition-all active:scale-95"
                      >
                        Manage branch
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {activeTab === 'customers' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={<Users size={20} />}
                label="Customers"
                value={customerInsights.length}
                detail={`${customerInsights.filter((customer) => customer.ordersCount > 0).length} have order history.`}
                accent="blue"
              />
              <StatCard
                icon={<History size={20} />}
                label="Repeat rate"
                value={`${repeatRate}%`}
                detail="Share of customers that came back more than once."
                accent="yellow"
              />
              <StatCard
                icon={<DollarSign size={20} />}
                label="Average spend"
                value={formatCurrency(customerAverageSpend)}
                detail="Average lifetime spend per customer profile."
                accent="green"
              />
              <StatCard
                icon={<UtensilsCrossed size={20} />}
                label="Food preference"
                value={topCategory}
                detail="Most ordered category right now."
                accent="slate"
              />
            </div>

            <DashboardPanel
              title="Customer intelligence"
              kicker="Visit history, spend, and branch preferences"
              action={
                <button
                  type="button"
                  onClick={() => refreshDashboard(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-[#0a0a0a] font-syne font-bold text-[11px] uppercase tracking-[0.18em] transition-all active:scale-95"
                >
                  <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                  Refresh
                </button>
              }
            >
              <SearchInput
                value={customerQuery}
                onChange={setCustomerQuery}
                placeholder="Search by customer, favorite food, or main branch..."
              />
            </DashboardPanel>

            {filteredCustomers.length > 0 ? (
              <div className="grid gap-5 xl:grid-cols-2">
                {filteredCustomers.map((customer) => (
                  <div key={customer.id} className="lift-card bg-white rounded-3xl border border-black/[0.06] shadow-sm p-6 space-y-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-syne text-2xl font-black text-[#0a0a0a] leading-tight truncate">
                          {getRecordName(customer)}
                        </p>
                        <p className="font-dm text-sm text-gray-500 mt-2">
                          Last visit {formatDate(customer.lastVisit)} - customer since {formatDate(customer.created_at)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-blue-50 text-blue-700 px-3 py-2 font-syne text-[11px] font-bold uppercase tracking-[0.16em] shrink-0">
                        {customer.primaryBranch?.name || 'No branch yet'}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <MiniMetric label="Spend" value={formatCompactCurrency(customer.spend)} />
                      <MiniMetric label="Orders" value={customer.ordersCount} />
                      <MiniMetric label="Avg ticket" value={formatCompactCurrency(customer.averageTicket)} />
                    </div>

                    <div className="space-y-3">
                      <p className="font-syne text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Favorites</p>
                      {customer.favorites.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {customer.favorites.map((item) => (
                            <span
                              key={`${customer.id}-${item.name}`}
                              className="rounded-full bg-gray-100 px-3 py-2 font-dm text-xs text-gray-600"
                            >
                              {item.name} - {item.count}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="font-dm text-sm text-gray-500">No favorite dishes surfaced yet.</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <p className="font-dm text-sm text-gray-500">
                        {customer.primaryBranch ? `${customer.primaryBranch.count} visits to ${customer.primaryBranch.name}` : 'No branch pattern yet'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedCustomerId(customer.id)}
                        className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#0a0a0a] text-white font-syne font-bold text-[11px] uppercase tracking-[0.18em] hover:bg-gray-800 transition-all active:scale-95"
                      >
                        View profile
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyPanel
                title="No customers match the current search"
                description="Try a broader name, favorite dish, or branch term to reopen the customer list."
              />
            )}
          </>
        ) : null}

        {activeTab === 'employees' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={<UserCog size={20} />}
                label="Employees"
                value={employees.length}
                detail="All admin, branch, and staff profiles."
                accent="yellow"
              />
              <StatCard
                icon={<ShieldCheck size={20} />}
                label="Ready to work"
                value={activeStaff.length}
                detail="Assigned staff currently marked active."
                accent="green"
              />
              <StatCard
                icon={<Clock3 size={20} />}
                label="Pending approvals"
                value={pendingApplications.length}
                detail="Staff who still need branch and role decisions."
                accent="blue"
              />
              <StatCard
                icon={<Power size={20} />}
                label="Inactive"
                value={inactiveEmployees.length}
                detail="Profiles paused or archived from the floor."
                accent="rose"
              />
            </div>

            <DashboardPanel
              title="Employee lifecycle"
              kicker="Assignments, activation, and cleanup"
              action={
                <button
                  type="button"
                  onClick={() => refreshDashboard(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-[#0a0a0a] font-syne font-bold text-[11px] uppercase tracking-[0.18em] transition-all active:scale-95"
                >
                  <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                  Refresh
                </button>
              }
            >
              <SearchInput
                value={employeeQuery}
                onChange={setEmployeeQuery}
                placeholder="Search by employee, role, or branch..."
              />
            </DashboardPanel>

            {reviewQueue.length > 0 ? (
              <DashboardPanel title="Approval queue" kicker="Pending staff applications">
                <div className="grid gap-4 xl:grid-cols-2">
                  {reviewQueue.map((employee) => (
                    <div key={employee.id} className="rounded-3xl border border-black/[0.06] bg-gray-50 p-5 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-syne text-xl font-black text-[#0a0a0a]">{getRecordName(employee)}</p>
                          <p className="font-dm text-sm text-gray-500 mt-2">
                            Registered {formatDate(employee.created_at)} and waiting for assignment.
                          </p>
                        </div>
                        <span className="rounded-full bg-yellow-100 px-3 py-2 font-syne text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-700">
                          Pending
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => openEmployeeModal(employee)}
                          className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#0a0a0a] text-white font-syne font-bold text-[11px] uppercase tracking-[0.18em] hover:bg-gray-800 transition-all active:scale-95"
                        >
                          Review application
                          <ChevronRight size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchiveApplication(employee)}
                          className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white text-[#0a0a0a] border border-black/[0.06] font-syne font-bold text-[11px] uppercase tracking-[0.18em] transition-all active:scale-95"
                        >
                          Archive
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </DashboardPanel>
            ) : null}

            <DashboardPanel title="Employee roster" kicker="Where people work and whether they are active">
              {roster.length > 0 ? (
                <div className="space-y-3">
                  {roster.map((employee) => {
                    const lifecycle = getEmployeeLifecycle(employee);
                    const branchName = branchesById[String(employee.branch_id)]?.name || 'Unassigned';
                    const isProtectedAdmin = employee.role === 'admin' || employee.id === user?.id;

                    return (
                      <div
                        key={employee.id}
                        className="rounded-3xl border border-black/[0.06] bg-gray-50 px-5 py-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4"
                      >
                        <div className="space-y-2 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <p className="font-syne text-xl font-black text-[#0a0a0a] truncate">{getRecordName(employee)}</p>
                            <span className={`rounded-full px-3 py-1.5 font-syne text-[10px] font-bold uppercase tracking-[0.18em] ${lifecycle.className}`}>
                              {lifecycle.label}
                            </span>
                            <span className="rounded-full bg-white px-3 py-1.5 font-syne text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 border border-black/[0.06]">
                              {toTitleCase(employee.role)}
                            </span>
                          </div>
                          <p className="font-dm text-sm text-gray-500">
                            Works at {branchName} - profile created {formatDate(employee.created_at)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEmployeeModal(employee)}
                            className="px-4 py-3 rounded-2xl bg-white border border-black/[0.06] text-[#0a0a0a] font-syne font-bold text-[11px] uppercase tracking-[0.18em] transition-all active:scale-95"
                          >
                            Manage
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleEmployeeActive(employee)}
                            disabled={isProtectedAdmin}
                            className={`px-4 py-3 rounded-2xl font-syne font-bold text-[11px] uppercase tracking-[0.18em] transition-all active:scale-95 disabled:opacity-50 ${
                              employee.is_active === false
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-900 text-white'
                            }`}
                          >
                            {employee.is_active === false ? 'Activate' : 'Deactivate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEmployee(employee)}
                            disabled={isProtectedAdmin}
                            className="px-4 py-3 rounded-2xl bg-rose-50 text-rose-600 font-syne font-bold text-[11px] uppercase tracking-[0.18em] transition-all active:scale-95 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyPanel
                  title="No employees match the current search"
                  description="Clear or broaden the employee search to reopen the roster."
                />
              )}
            </DashboardPanel>
          </>
        ) : null}

        {activeTab === 'analytics' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={<Activity size={20} />}
                label="Traffic window"
                value={peakDayPart?.label || 'No traffic'}
                detail={peakDayPart ? `${peakDayPart.value} orders in the busiest window.` : 'Waiting for order activity.'}
                accent="yellow"
              />
              <StatCard
                icon={<UtensilsCrossed size={20} />}
                label="Favorite category"
                value={topCategory}
                detail="Most ordered food category across all branches."
                accent="green"
              />
              <StatCard
                icon={<BarChart3 size={20} />}
                label="Top branch"
                value={topBranch?.name || 'No leader'}
                detail={topBranch ? `${topBranch.ordersCount} orders so far.` : 'No branch movement yet.'}
                accent="slate"
              />
              <StatCard
                icon={<DollarSign size={20} />}
                label="Average ticket"
                value={formatCurrency(averageTicket)}
                detail="Network-wide average spend per order."
                accent="blue"
              />
            </div>

            {orders.length > 0 ? (
              <>
                <div className="grid gap-6 xl:grid-cols-2">
                  <DashboardPanel title="Revenue trend" kicker="Last 7 days">
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={revenueTrend}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ececec" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'DM Sans' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'DM Sans' }} />
                          <Tooltip
                            formatter={(value) => formatCurrency(value)}
                            contentStyle={{ borderRadius: '18px', border: 'none', boxShadow: '0 16px 34px rgba(0,0,0,0.12)', fontFamily: 'DM Sans' }}
                          />
                          <Line type="monotone" dataKey="value" stroke="#FFD600" strokeWidth={4} dot={{ fill: '#FFD600', r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </DashboardPanel>

                  <DashboardPanel title="Buying patterns" kicker="Orders by day part">
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dayPartInsights}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ececec" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'DM Sans' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'DM Sans' }} />
                          <Tooltip
                            formatter={(value, _name, item) => [`${value} orders`, item?.payload?.meta || '']}
                            contentStyle={{ borderRadius: '18px', border: 'none', boxShadow: '0 16px 34px rgba(0,0,0,0.12)', fontFamily: 'DM Sans' }}
                          />
                          <Bar dataKey="value" radius={[12, 12, 0, 0]} fill="#0a0a0a" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </DashboardPanel>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <DashboardPanel title="Food preferences" kicker="Category demand">
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={categoryPreferences} dataKey="value" nameKey="label" innerRadius={70} outerRadius={110} paddingAngle={4}>
                            {categoryPreferences.map((entry, index) => (
                              <Cell key={`${entry.label}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => [`${value} items`, 'Category']}
                            contentStyle={{ borderRadius: '18px', border: 'none', boxShadow: '0 16px 34px rgba(0,0,0,0.12)', fontFamily: 'DM Sans' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-3">
                      {categoryPreferences.map((entry, index) => (
                        <div key={entry.label} className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                          />
                          <span className="font-dm text-xs text-gray-500">{entry.label}</span>
                        </div>
                      ))}
                    </div>
                  </DashboardPanel>

                  <DashboardPanel title="Top dishes" kicker="Units sold">
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topFoodPreferences} layout="vertical" margin={{ left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#ececec" />
                          <XAxis type="number" hide />
                          <YAxis
                            dataKey="label"
                            type="category"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: '#0a0a0a', fontFamily: 'Syne', fontWeight: 800 }}
                            width={120}
                          />
                          <Tooltip
                            formatter={(value) => [`${value} units`, 'Volume']}
                            contentStyle={{ borderRadius: '18px', border: 'none', boxShadow: '0 16px 34px rgba(0,0,0,0.12)', fontFamily: 'DM Sans' }}
                          />
                          <Bar dataKey="value" fill="#FFD600" radius={[0, 10, 10, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </DashboardPanel>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <DashboardPanel title="Branch revenue share" kicker="Where the money comes from">
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={branchShare} dataKey="value" nameKey="label" innerRadius={70} outerRadius={110} paddingAngle={4}>
                            {branchShare.map((entry, index) => (
                              <Cell key={`${entry.label}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => [formatCurrency(value), 'Revenue']}
                            contentStyle={{ borderRadius: '18px', border: 'none', boxShadow: '0 16px 34px rgba(0,0,0,0.12)', fontFamily: 'DM Sans' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-3">
                      {branchShare.map((entry, index) => (
                        <div key={entry.label} className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                          />
                          <span className="font-dm text-xs text-gray-500">
                            {entry.label} - {entry.meta}
                          </span>
                        </div>
                      ))}
                    </div>
                  </DashboardPanel>

                  <DashboardPanel title="Customer spend leaders" kicker="Who buys the most">
                    <HorizontalBars
                      rows={customerInsights.slice(0, 6).map((customer) => ({
                        label: getRecordName(customer),
                        value: customer.spend,
                        meta: `${customer.ordersCount} orders - ${customer.primaryBranch?.name || 'no main branch yet'}`,
                      }))}
                      valueFormatter={formatCompactCurrency}
                      accentClass="bg-gradient-to-r from-[#0a0a0a] to-[#475569]"
                    />
                  </DashboardPanel>
                </div>
              </>
            ) : (
              <EmptyPanel
                title="Analytics waiting for data"
                description="Place orders through the customer flow and the admin dashboard will start drawing graphs for buying patterns and food preferences."
              />
            )}
          </>
        ) : null}

        {selectedCustomer ? (
          <Modal
            onClose={() => setSelectedCustomerId(null)}
            title={`${getRecordName(selectedCustomer)} profile`}
            icon={<History size={18} color="#0a0a0a" />}
            maxWidthCls="max-w-5xl"
          >
            <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
              <div className="space-y-5">
                <div className="rounded-3xl bg-[#0a0a0a] text-white p-6">
                  <p className="font-syne text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">Customer summary</p>
                  <h3 className="font-syne text-3xl font-black mt-4">{getRecordName(selectedCustomer)}</h3>
                  <p className="font-dm text-sm text-gray-400 mt-3 leading-relaxed">
                    Primary branch: {selectedCustomer.primaryBranch?.name || 'No dominant branch yet'}.
                  </p>
                  <p className="font-dm text-sm text-gray-400 mt-2">
                    Favorite dish: {selectedCustomer.favoriteHeadline}.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <MiniMetric label="Lifetime spend" value={formatCurrency(selectedCustomer.spend)} />
                  <MiniMetric label="Orders" value={selectedCustomer.ordersCount} />
                  <MiniMetric label="Avg ticket" value={formatCurrency(selectedCustomer.averageTicket)} />
                  <MiniMetric label="Last visit" value={formatDate(selectedCustomer.lastVisit)} />
                </div>

                <DashboardPanel title="Branch visits" kicker="Where they choose to eat" className="p-4 sm:p-5">
                  {selectedCustomer.branchVisits.length > 0 ? (
                    <HorizontalBars
                      rows={selectedCustomer.branchVisits.map((visit) => ({
                        label: visit.name,
                        value: visit.count,
                        meta: `${visit.count} visits`,
                      }))}
                      valueFormatter={(value) => `${value}`}
                      accentClass="bg-[#0a0a0a]"
                    />
                  ) : (
                    <EmptyPanel
                      title="No branch history yet"
                      description="This customer has not completed a tracked order."
                    />
                  )}
                </DashboardPanel>

                <DashboardPanel title="Favorite dishes" kicker="Most repeated items" className="p-4 sm:p-5">
                  {selectedCustomer.favorites.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedCustomer.favorites.map((item) => (
                        <span key={item.name} className="rounded-full bg-gray-100 px-3 py-2 font-dm text-xs text-gray-600">
                          {item.name} - {item.count}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="font-dm text-sm text-gray-500">No repeat preference has formed yet.</p>
                  )}
                </DashboardPanel>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl bg-gray-50 border border-black/[0.04] px-5 py-4">
                  <p className="font-syne text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">
                    Order history
                  </p>
                </div>

                {selectedCustomer.orders.length > 0 ? (
                  selectedCustomer.orders.map((order) => (
                    <div key={order.id} className="rounded-3xl border border-black/[0.06] bg-white p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-syne text-lg font-black text-[#0a0a0a]">Order #{order.id}</span>
                            <OrderStatusPill status={order.status} />
                          </div>
                          <p className="font-dm text-sm text-gray-500 mt-2">
                            {order.branches?.name || branchesById[String(order.branch_id)]?.name || 'Unknown branch'} - {formatDateTime(order.created_at)}
                          </p>
                        </div>
                        <span className="font-syne text-2xl font-black text-[#0a0a0a]">{formatCurrency(order.total_amount)}</span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {getOrderItems(order).map((item, index) => (
                          <span key={`${order.id}-${index}`} className="rounded-full bg-gray-100 px-3 py-2 font-dm text-xs text-gray-600">
                            {item.quantity} x {item.menu_items?.name || `Item #${item.menu_item_id || 'Unknown'}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyPanel
                    title="No orders found"
                    description="This customer exists in the system but does not have tracked order history yet."
                  />
                )}
              </div>
            </div>
          </Modal>
        ) : null}

        {selectedEmployee ? (
          <Modal
            onClose={closeEmployeeModal}
            title="Manage employee"
            icon={<UserCog size={18} color="#0a0a0a" />}
            maxWidthCls="max-w-3xl"
          >
            <div className="space-y-6">
              <div className="rounded-3xl bg-gray-50 border border-black/[0.04] p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <p className="font-syne text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Employee record</p>
                    <h3 className="font-syne text-2xl font-black text-[#0a0a0a] mt-3">{getRecordName(selectedEmployee)}</h3>
                    <p className="font-dm text-sm text-gray-500 mt-2">
                      Works at {branchesById[String(selectedEmployee.branch_id)]?.name || 'Unassigned'} - current role {toTitleCase(selectedEmployee.role)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-4 py-2 font-syne text-[10px] font-bold uppercase tracking-[0.18em] ${getEmployeeLifecycle(selectedEmployee).className}`}
                  >
                    {getEmployeeLifecycle(selectedEmployee).label}
                  </span>
                </div>
              </div>

              {selectedEmployee.role === 'admin' ? (
                <div className="rounded-3xl border border-yellow-200 bg-yellow-50 px-5 py-4">
                  <p className="font-syne text-[11px] font-bold uppercase tracking-[0.18em] text-yellow-700">
                    Admin profiles stay protected
                  </p>
                  <p className="font-dm text-sm text-yellow-800 mt-3 leading-relaxed">
                    This dashboard shows the admin account for visibility, but role, activation, and deletion controls stay locked to avoid breaking platform access.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSaveEmployee} className="space-y-5">
                  <div className="space-y-2">
                    <label className="font-syne text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Branch assignment</label>
                    <select
                      className={selectCls}
                      value={employeeDraft.branchId}
                      onChange={(event) => setEmployeeDraft((current) => ({ ...current, branchId: event.target.value }))}
                    >
                      <option value="">Unassigned</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                    <p className="font-dm text-xs text-gray-500">
                      Staff roles require a branch. Pending staff will be unassigned automatically.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="font-syne text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Role</label>
                    <select
                      className={selectCls}
                      value={employeeDraft.role}
                      onChange={(event) => setEmployeeDraft((current) => ({ ...current, role: event.target.value }))}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {toTitleCase(role)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="font-syne text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Activation</label>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setEmployeeDraft((current) => ({ ...current, isActive: true }))}
                        className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                          employeeDraft.isActive
                            ? 'border-emerald-200 bg-emerald-50'
                            : 'border-black/[0.06] bg-white'
                        }`}
                      >
                        <p className="font-syne text-sm font-black text-[#0a0a0a]">Active</p>
                        <p className="font-dm text-xs text-gray-500 mt-2">The employee can access their assigned tools.</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmployeeDraft((current) => ({ ...current, isActive: false }))}
                        className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                          !employeeDraft.isActive
                            ? 'border-slate-300 bg-slate-100'
                            : 'border-black/[0.06] bg-white'
                        }`}
                      >
                        <p className="font-syne text-sm font-black text-[#0a0a0a]">Inactive</p>
                        <p className="font-dm text-xs text-gray-500 mt-2">The employee keeps their profile but loses branch access.</p>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-black/[0.05] bg-gray-50 px-5 py-4 flex items-start gap-3">
                    <ShieldCheck size={18} className="text-[#0a0a0a] mt-0.5 shrink-0" />
                    <p className="font-dm text-sm text-gray-600 leading-relaxed">
                      Assigning a non-pending role with an active status is what puts an employee onto the branch floor.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-1">
                    <button
                      type="button"
                      onClick={closeEmployeeModal}
                      className="flex-1 py-4 rounded-2xl bg-gray-100 text-[#0a0a0a] font-syne font-bold text-sm uppercase tracking-[0.18em] transition-all active:scale-95"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingEmployee}
                      className="flex-1 py-4 rounded-2xl bg-[#FFD600] text-[#0a0a0a] font-syne font-black text-sm uppercase tracking-[0.18em] shadow-[0_8px_24px_rgba(255,214,0,.22)] transition-all active:scale-95 disabled:opacity-70"
                    >
                      {isSavingEmployee ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </Modal>
        ) : null}

        {showAddBranch ? (
          <Modal
            onClose={() => setShowAddBranch(false)}
            title="Create branch"
            icon={<Building size={18} color="#0a0a0a" />}
          >
            <form onSubmit={handleAddBranch} className="space-y-5">
              <div className="space-y-2">
                <label className="font-syne text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Branch name</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Downtown location"
                  value={newBranch.name}
                  onChange={(event) => setNewBranch((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="font-syne text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Address</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="123 Main Street"
                  value={newBranch.address}
                  onChange={(event) => setNewBranch((current) => ({ ...current, address: event.target.value }))}
                  required
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddBranch(false)}
                  className="flex-1 py-4 rounded-2xl bg-gray-100 text-[#0a0a0a] font-syne font-bold text-sm uppercase tracking-[0.18em] transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBranch}
                  className="flex-1 py-4 rounded-2xl bg-[#FFD600] text-[#0a0a0a] font-syne font-black text-sm uppercase tracking-[0.18em] shadow-[0_8px_24px_rgba(255,214,0,.22)] transition-all active:scale-95 disabled:opacity-70"
                >
                  {isSavingBranch ? 'Creating...' : 'Create branch'}
                </button>
              </div>
            </form>
          </Modal>
        ) : null}

      </div>
    </div>
  );
}
