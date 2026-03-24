export const ORDER_STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-700',
  preparing: 'bg-blue-100 text-blue-700',
  served: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-rose-100 text-rose-700',
};

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const fullDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function formatCurrency(value) {
  return money.format(Number(value || 0));
}

export function formatDate(value) {
  if (!value) return 'No activity yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown date';
  return shortDate.format(parsed);
}

export function formatDateTime(value) {
  if (!value) return 'No activity yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown date';
  return fullDate.format(parsed);
}

export function getOrderItems(order) {
  return Array.isArray(order?.order_items) ? order.order_items : [];
}

export function getOrderStatusClass(status) {
  return ORDER_STATUS_STYLES[status] || ORDER_STATUS_STYLES.completed;
}

export function getEmployeeLifecycle(employee) {
  if (employee?.is_active === false && employee?.branch_id == null && employee?.role === 'pending_staff') {
    return { label: 'Archived', className: 'bg-rose-100 text-rose-700' };
  }

  if (employee?.is_active === false) {
    return { label: 'Inactive', className: 'bg-slate-200 text-slate-700' };
  }

  if (employee?.role === 'pending_staff') {
    return { label: 'Pending', className: 'bg-yellow-100 text-yellow-700' };
  }

  return { label: 'Active', className: 'bg-emerald-100 text-emerald-700' };
}

export function buildCustomerInsights(customers, orders, branchesById) {
  return customers
    .map((customer) => {
      const customerOrders = orders.filter((order) => order.user_id === customer.id);
      const branchVisits = new Map();
      const favoriteItems = new Map();
      let spend = 0;
      let itemCount = 0;

      customerOrders.forEach((order) => {
        spend += Number(order.total_amount || 0);

        if (order.branch_id != null) {
          const branchKey = String(order.branch_id);
          branchVisits.set(branchKey, (branchVisits.get(branchKey) || 0) + 1);
        }

        getOrderItems(order).forEach((item) => {
          const quantity = Number(item.quantity || 0);
          const name = item.menu_items?.name || `Item #${item.menu_item_id || 'Unknown'}`;

          itemCount += quantity;
          favoriteItems.set(name, (favoriteItems.get(name) || 0) + quantity);
        });
      });

      const branchVisitList = Array.from(branchVisits.entries())
        .map(([branchId, count]) => ({
          id: Number(branchId),
          name: branchesById[branchId]?.name || `Branch #${branchId}`,
          count,
        }))
        .sort((left, right) => right.count - left.count);

      const favoriteList = Array.from(favoriteItems.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((left, right) => right.count - left.count);

      return {
        ...customer,
        orders: customerOrders,
        ordersCount: customerOrders.length,
        spend,
        averageTicket: customerOrders.length ? spend / customerOrders.length : 0,
        lastVisit: customerOrders[0]?.created_at || null,
        itemCount,
        branchVisits: branchVisitList,
        primaryBranch: branchVisitList[0] || null,
        favorites: favoriteList.slice(0, 3),
        favoriteHeadline: favoriteList[0]?.name || 'No clear favorite yet',
      };
    })
    .sort((left, right) => {
      if (right.spend !== left.spend) return right.spend - left.spend;
      return right.ordersCount - left.ordersCount;
    });
}

export function buildBranchInsights(branches, orders) {
  return branches
    .map((branch) => {
      const branchOrders = orders.filter((order) => String(order.branch_id) === String(branch.id));
      const uniqueCustomers = new Set();
      const itemMix = new Map();
      let revenue = 0;

      branchOrders.forEach((order) => {
        revenue += Number(order.total_amount || 0);
        if (order.user_id) uniqueCustomers.add(order.user_id);

        getOrderItems(order).forEach((item) => {
          const quantity = Number(item.quantity || 0);
          const name = item.menu_items?.name || `Item #${item.menu_item_id || 'Unknown'}`;
          itemMix.set(name, (itemMix.get(name) || 0) + quantity);
        });
      });

      const topItems = Array.from(itemMix.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 2);

      return {
        ...branch,
        revenue,
        ordersCount: branchOrders.length,
        customerCount: uniqueCustomers.size,
        averageTicket: branchOrders.length ? revenue / branchOrders.length : 0,
        recentOrderAt: branchOrders[0]?.created_at || null,
        topItems,
      };
    })
    .sort((left, right) => right.revenue - left.revenue);
}

export function buildRevenueTrend(orders, days = 7) {
  const slots = [];
  const slotMap = new Map();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    const slot = { key, label: shortDate.format(date), value: 0 };
    slots.push(slot);
    slotMap.set(key, slot);
  }

  orders.forEach((order) => {
    if (!order?.created_at) return;
    const parsed = new Date(order.created_at);
    if (Number.isNaN(parsed.getTime())) return;
    const slot = slotMap.get(parsed.toISOString().slice(0, 10));
    if (slot) slot.value += Number(order.total_amount || 0);
  });

  return slots;
}

export function buildDayPartInsights(orders) {
  const buckets = [
    { label: 'Breakfast', count: 0, revenue: 0 },
    { label: 'Lunch', count: 0, revenue: 0 },
    { label: 'Afternoon', count: 0, revenue: 0 },
    { label: 'Dinner', count: 0, revenue: 0 },
    { label: 'Late', count: 0, revenue: 0 },
  ];

  orders.forEach((order) => {
    if (!order?.created_at) return;
    const parsed = new Date(order.created_at);
    if (Number.isNaN(parsed.getTime())) return;

    const hour = parsed.getHours();
    const bucket =
      hour >= 6 && hour < 11 ? buckets[0]
        : hour >= 11 && hour < 15 ? buckets[1]
          : hour >= 15 && hour < 18 ? buckets[2]
            : hour >= 18 && hour < 22 ? buckets[3]
              : buckets[4];

    bucket.count += 1;
    bucket.revenue += Number(order.total_amount || 0);
  });

  return buckets.map((bucket) => ({
    label: bucket.label,
    value: bucket.count,
    meta: formatCurrency(bucket.revenue),
  }));
}

export function buildTopFoodPreferences(orders, limit = 6) {
  const items = new Map();

  orders.forEach((order) => {
    getOrderItems(order).forEach((item) => {
      const quantity = Number(item.quantity || 0);
      const name = item.menu_items?.name || `Item #${item.menu_item_id || 'Unknown'}`;
      items.set(name, (items.get(name) || 0) + quantity);
    });
  });

  return Array.from(items.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, limit);
}

export function buildCategoryPreferences(orders, limit = 5) {
  const categories = new Map();

  orders.forEach((order) => {
    getOrderItems(order).forEach((item) => {
      const quantity = Number(item.quantity || 0);
      const category = item.menu_items?.category || 'Uncategorized';
      categories.set(category, (categories.get(category) || 0) + quantity);
    });
  });

  return Array.from(categories.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, limit);
}

export function buildBranchShare(branches, orders) {
  return branches
    .map((branch) => {
      const branchOrders = orders.filter((order) => String(order.branch_id) === String(branch.id));
      const revenue = branchOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

      return {
        label: branch.name,
        value: revenue,
        meta: `${branchOrders.length} orders`,
      };
    })
    .sort((left, right) => right.value - left.value)
    .slice(0, 6);
}

export function buildStatusMix(orders) {
  const counts = { pending: 0, preparing: 0, served: 0, completed: 0, cancelled: 0 };

  orders.forEach((order) => {
    if (counts[order.status] !== undefined) counts[order.status] += 1;
  });

  return [
    { label: 'Pending', value: counts.pending, meta: 'Needs kitchen pickup' },
    { label: 'Preparing', value: counts.preparing, meta: 'In the kitchen now' },
    { label: 'Served', value: counts.served, meta: 'Ready for waiter closure' },
    { label: 'Completed', value: counts.completed, meta: 'Finished orders' },
    { label: 'Cancelled', value: counts.cancelled, meta: 'Lost demand' },
  ];
}
