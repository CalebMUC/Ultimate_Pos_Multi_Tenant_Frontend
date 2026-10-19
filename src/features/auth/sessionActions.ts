import { applyLoginResponse, clearSession, refreshSession } from '@/api/client';
import { authApi } from '@/api/endpoints/identity';
import { businessesApi } from '@/api/endpoints/business';
import { tokenStorage } from '@/api/tokenStorage';
import { queryClient } from '@/lib/queryClient';
import { useCartStore } from '@/stores/cart';
import { useSession } from '@/stores/session';
import { useAccess } from '@/stores/access';
import type { Guid } from '@/api/dto/common';
import type { LoginResponseDto } from '@/api/dto/identity';

/** Loads GET /businesses/current into the session (logo, VAT, short code, discount cap). */
export async function loadCurrentBusiness() {
  const { activeBusinessId, setBusiness } = useSession.getState();
  if (!activeBusinessId) {
    setBusiness(null);
    return null;
  }
  try {
    const business = await businessesApi.current();
    // Ignore a late answer for a business we have already left.
    if (useSession.getState().activeBusinessId === business.businessId) setBusiness(business);
    return business;
  } catch {
    return null;
  }
}

/** On app start: restore the session from the stored refresh token, if any. */
export async function bootstrapSession() {
  if (!tokenStorage.getRefreshToken()) {
    useSession.getState().clear();
    return;
  }
  try {
    await refreshSession();
    await loadCurrentBusiness();
    // The forced-password flag and the licence position, which the refresh response only partly carries.
    void refreshMe().catch(() => undefined);
  } catch {
    // A network failure leaves us without an access token; treat as signed out but keep the refresh token for next time.
    if (useSession.getState().status !== 'authenticated') useSession.getState().clear();
  }
}

/** Signs in, to the given business and branch when there is one (else the user's defaults). */
export async function login(email: string, password: string, businessId?: Guid | null, branchId?: Guid | null): Promise<LoginResponseDto> {
  const data = await authApi.login({ email, password, businessId: businessId ?? null, branchId: branchId ?? null });
  queryClient.clear();
  useCartStore.getState().clearAll();
  applyLoginResponse(data);
  await loadCurrentBusiness();
  void refreshMe().catch(() => undefined);
  return data;
}

/**
 * Switches to another business: new token pair, then every cache, the cart and the profile reset so nothing from the previous
 * business can show in the next.
 */
export async function switchBusiness(businessId: Guid, branchId?: Guid | null) {
  // The branch last worked at in that business, if it can still be used; the API falls back to the default otherwise.
  const preferred = branchId ?? tokenStorage.getLastBranchId(businessId);
  let data: LoginResponseDto;
  try {
    data = await authApi.switchBusiness({ businessId, refreshToken: tokenStorage.getRefreshToken(), branchId: preferred });
  } catch (e) {
    if (!preferred || branchId) throw e;
    data = await authApi.switchBusiness({ businessId, refreshToken: tokenStorage.getRefreshToken() });
  }
  await queryClient.cancelQueries();
  queryClient.clear();
  useCartStore.getState().clearAll();
  useSession.getState().setBusiness(null);
  applyLoginResponse(data);
  await loadCurrentBusiness();
  return data;
}

/**
 * Moves to another branch of this business: new tokens (both replaced), then everything from the old branch is dropped (every
 * query cache, the POS cart) so nothing of one branch shows at another.
 */
export async function switchBranch(branchId: Guid) {
  const data = await authApi.switchBranch({ branchId, refreshToken: tokenStorage.getRefreshToken() });
  await queryClient.cancelQueries();
  queryClient.clear();
  useCartStore.getState().clearAll();
  applyLoginResponse(data);
  return data;
}

/** After a refresh moved the user to another branch: drop the old branch's data. */
export function resetBranchData() {
  void queryClient.cancelQueries().then(() => queryClient.invalidateQueries());
  useCartStore.getState().clearAll();
}

/** Re-reads roles, permissions, branches, the forced-password flag and the licence position (GET /auth/me). */
export async function refreshMe() {
  const me = await authApi.me();
  useSession.getState().setUser(me.user, me.businesses, me.activeBusinessId, me.mustChangePassword ?? false, me.branches);
  const access = me.businessAccess;
  if (access) {
    const warns = access.allowed && (access.status === 'ExpiringSoon' || access.status === 'GracePeriod') && access.message;
    useAccess.getState().setWarning(warns ? { message: access.message!, status: access.status } : null);
  }
  return me;
}

/**
 * Changes the password, then signs in again with it: the API ends every session on a password change, this one included,
 * so without a fresh sign-in the user would be thrown out at the next token refresh. The cart and caches are kept.
 */
export async function changePassword(currentPassword: string, newPassword: string) {
  const { user, activeBusinessId } = useSession.getState();
  await authApi.changePassword({ currentPassword, newPassword });
  if (!user) return;
  const data = await authApi.login({ email: user.email, password: newPassword, businessId: activeBusinessId });
  applyLoginResponse(data);
  if (data.activeBusinessId !== activeBusinessId) await loadCurrentBusiness();
}

export async function logout() {
  const refreshToken = tokenStorage.getRefreshToken();
  if (refreshToken) {
    try {
      await authApi.logout(refreshToken);
    } catch {
      // Signing out locally matters more than the server call.
    }
  }
  clearSession();
  queryClient.clear();
  useCartStore.getState().clearAll();
}
