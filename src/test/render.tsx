import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/overlays';
import { BusinessKind, BusinessType } from '@/api/enums';
import { useSession } from '@/stores/session';
import type { BranchMembershipDto } from '@/api/dto/branches';

export const API = 'http://localhost/api/v1';
export const BUSINESS_ID = 'b0000000-0000-0000-0000-000000000001';
export const HEAD_OFFICE = { branchId: 'br000000-0000-0000-0000-000000000000', branchNumber: 0, kraBranchId: '00', name: 'Head Office', code: 'HQ', isDefault: true };
export const WESTLANDS = { branchId: 'br000000-0000-0000-0000-000000000001', branchNumber: 1, kraBranchId: '01', name: 'Westlands', code: 'WL', isDefault: false };

/** Signs a test user in (no network). branches: where they may work, default first; the first is active unless activeBranchId says otherwise. */
export function signIn(permissions: string[] = [], opts: { branches?: BranchMembershipDto[]; activeBranchId?: string } = {}) {
  const branches = opts.branches ?? [HEAD_OFFICE];
  useSession.setState({
    status: 'authenticated',
    accessToken: 'test-token',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    user: { id: 'u1', email: 'admin@test.ke', fullName: 'Test Admin', phoneNumber: null, isActive: true, isLocked: false, roles: ['Admin'], permissions },
    activeBusinessId: BUSINESS_ID,
    businesses: [{ businessId: BUSINESS_ID, businessName: 'Test Ltd', tradingName: null, kind: BusinessKind.Trader, businessType: BusinessType.Retailer, isDefault: true }],
    business: null,
    mustChangePassword: false,
    branches,
    activeBranchId: opts.activeBranchId ?? branches[0]?.branchId ?? null,
  });
}

export function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  return { client, ...render(<QueryClientProvider client={client}><TooltipProvider>{ui}</TooltipProvider></QueryClientProvider>) };
}

/** The envelope the API wraps every response in. */
export const ok = <T,>(data: T, meta: unknown = null) => ({ success: true, data, error: null, meta });
export const paged = <T,>(items: T[], page = 1, pageSize = 20, totalCount = items.length) =>
  ok(items, { page, pageSize, totalCount, totalPages: Math.max(1, Math.ceil(totalCount / pageSize)) });
