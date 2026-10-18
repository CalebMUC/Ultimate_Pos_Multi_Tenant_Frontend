import { applyLoginResponse, clearSession, refreshSession } from '@/api/client';
import { authApi } from '@/api/endpoints/identity';
import { businessesApi } from '@/api/endpoints/business';
import { tokenStorage } from '@/api/tokenStorage';
import { queryClient } from '@/lib/queryClient';
import { useCartStore } from '@/stores/cart';
import { useSession } from '@/stores/session';
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
  } catch {
    // A network failure leaves us without an access token; treat as signed out but keep the refresh token for next time.
    if (useSession.getState().status !== 'authenticated') useSession.getState().clear();
  }
}

export async function login(email: string, password: string, businessId?: Guid | null): Promise<LoginResponseDto> {
  const data = await authApi.login({ email, password, businessId: businessId ?? null });
  queryClient.clear();
  useCartStore.getState().clearAll();
  applyLoginResponse(data);
  await loadCurrentBusiness();
  return data;
}

/**
 * Switches to another business: new token pair, then every cache, the cart and the profile reset so nothing from the previous
 * business can show in the next.
 */
export async function switchBusiness(businessId: Guid) {
  const data = await authApi.switchBusiness({ businessId, refreshToken: tokenStorage.getRefreshToken() });
  await queryClient.cancelQueries();
  queryClient.clear();
  useCartStore.getState().clearAll();
  useSession.getState().setBusiness(null);
  applyLoginResponse(data);
  await loadCurrentBusiness();
  return data;
}

/** Re-reads roles and permissions (GET /auth/me). */
export async function refreshMe() {
  const me = await authApi.me();
  useSession.getState().setUser(me.user, me.businesses, me.activeBusinessId);
  return me;
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
