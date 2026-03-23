import { supabase } from './supabaseClient';

export const ADMIN_ASSIGNABLE_ROLES = ['manager', 'supervisor', 'waiter', 'kitchen'];

export async function fetchUserProfile(userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('users')
    .select('id, username, role, branch_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function buildProfileFromAuthUser(user) {
  if (!user?.id) return null;

  const metadata = user.user_metadata || user.app_metadata || {};
  const usernameFromEmail = user.email ? user.email.split('@')[0] : `user_${String(user.id).slice(0, 8)}`;
  const rawBranchId = metadata.branch_id;
  const parsedBranchId = rawBranchId === undefined || rawBranchId === null || rawBranchId === ''
    ? null
    : Number(rawBranchId);

  return {
    id: user.id,
    username: metadata.username || usernameFromEmail,
    role: metadata.role || 'customer',
    branch_id: Number.isInteger(parsedBranchId) ? parsedBranchId : null,
  };
}

export async function ensureUserProfile(user) {
  const profilePayload = buildProfileFromAuthUser(user);
  if (!profilePayload) return null;

  const { error } = await supabase
    .from('users')
    .insert([profilePayload]);

  if (error && error.code !== '23505') throw error;

  return fetchUserProfile(user.id);
}

export async function loadUserProfile(user) {
  if (!user?.id) return null;

  const existingProfile = await fetchUserProfile(user.id);
  if (existingProfile) return existingProfile;

  return ensureUserProfile(user);
}

export function getEffectiveRole(user, profile) {
  return profile?.role || user?.user_metadata?.role || user?.app_metadata?.role || null;
}

export function getEffectiveBranchId(user, profile) {
  return profile?.branch_id ?? user?.user_metadata?.branch_id ?? user?.app_metadata?.branch_id ?? null;
}

export function isManagementRole(role) {
  return ['admin', 'manager', 'supervisor'].includes(role);
}

export function getDashboardPath(role, branchId) {
  if (role === 'admin') return '/admin';
  if (role === 'pending_staff') return '/staff/pending';
  if (role === 'kitchen') return branchId ? `/kitchen/${branchId}` : '/staff/pending';
  if (role === 'waiter') return branchId ? `/waiter/${branchId}` : '/staff/pending';

  if (['manager', 'supervisor', 'staff'].includes(role)) {
    return branchId ? `/branch/${branchId}` : '/staff/pending';
  }

  return null;
}
