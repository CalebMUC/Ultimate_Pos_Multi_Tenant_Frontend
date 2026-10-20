import { renderHook, screen } from '@testing-library/react';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePreferences } from '@/stores/preferences';
import { BusinessKind, BusinessSector } from '@/api/enums';
import { BUSINESS_ID, renderWithProviders, signIn } from '@/test/render';
import { useSession } from '@/stores/session';
import { PermissionRoute } from '@/components/shared/Can';
import { useVisibleNavigation } from '@/components/layout/Sidebar';
import { ProductFormDialog } from '@/features/products/ProductFormDialog';
import type { BusinessDto } from '@/api/dto/business';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

const CORE = ['dashboard', 'sales', 'customers', 'catalog', 'stock', 'purchasing', 'expenses', 'reports', 'mpesa', 'branches', 'settings'];
const ALL = [
  'Production.View', 'Formulas.View', 'ProductionReports.View', 'DeliveryOrders.View', 'Prescriptions.View', 'InventoryReports.View', 'Stock.View',
  'Sales.Create', 'Products.View', 'Dashboard.View',
];

/** Signs in to a business of this kind whose membership lists these modules (as the API sends them). */
function business(kind: BusinessKind, sector: BusinessSector, modules: string[] | undefined, permissions = ALL) {
  signIn(permissions);
  useSession.setState((s) => ({ businesses: s.businesses.map((b) => ({ ...b, kind, sector, modules })), business: null }));
}

// The Pharmacy group follows its own setting; off here, so its product probe makes no call.
beforeEach(() => usePreferences.setState({ showPharmacyMenu: false }));

const labels = () => {
  const client = new QueryClient();
  const { result } = renderHook(() => useVisibleNavigation('business'), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  return result.current.flatMap((g) => [g.label, ...(g.items?.map((i) => `${g.label} > ${i.label}`) ?? [])]);
};

describe('menus follow the modules the API sends', () => {
  it('a refill station has deliveries but no production, batches or prescriptions', () => {
    business(BusinessKind.Trader, BusinessSector.WaterRefill, [...CORE, 'deliveries', 'containers']);
    const menu = labels();
    expect(menu).toContain('Point of Sale > Deliveries');
    expect(menu).not.toContain('Production');
    expect(menu).not.toContain('Reports > Expiry');
    expect(menu).not.toContain('Reports > Prescription Register');
  });

  it('a manufacturing agrovet has production and expiry, but no deliveries', () => {
    business(BusinessKind.Manufacturer, BusinessSector.Agrovet, [...CORE, 'production', 'batches']);
    const menu = labels();
    expect(menu).toContain('Production');
    expect(menu).toContain('Reports > Expiry');
    expect(menu).not.toContain('Point of Sale > Deliveries');
  });

  it('needs the permission as well: a cashier in a manufacturer sees no production', () => {
    business(BusinessKind.Manufacturer, BusinessSector.General, [...CORE, 'production'], ['Sales.Create', 'Dashboard.View']);
    expect(labels()).not.toContain('Production');
  });

  it('ignores a key it does not know', () => {
    business(BusinessKind.Trader, BusinessSector.Pharmacy, [...CORE, 'batches', 'prescriptions', 'loyalty']);
    expect(labels()).toContain('Reports > Prescription Register');
  });

  it('without a list (an older API) keeps today’s menus: production for manufacturers only', () => {
    business(BusinessKind.Trader, BusinessSector.General, undefined);
    expect(labels()).not.toContain('Production');
    expect(labels()).toContain('Point of Sale > Deliveries');
  });

  it('a reclassification shows as soon as the profile is re-read', () => {
    business(BusinessKind.Manufacturer, BusinessSector.General, [...CORE, 'production', 'batches', 'prescriptions', 'deliveries', 'containers']);
    expect(labels()).toContain('Production');
    act(() => useSession.getState().setBusiness({
      businessId: BUSINESS_ID, kind: BusinessKind.Manufacturer, sector: BusinessSector.WaterRefill, modules: [...CORE, 'production', 'deliveries', 'containers'],
    } as BusinessDto));
    const menu = labels();
    expect(menu).not.toContain('Reports > Prescription Register');
    expect(menu).toContain('Point of Sale > Deliveries');
  });
});

describe('module routes', () => {
  it('say "not used by this business" rather than refusing the user', () => {
    business(BusinessKind.Trader, BusinessSector.WaterRefill, [...CORE, 'deliveries', 'containers']);
    renderWithProviders(<PermissionRoute permission="Production.View" module="production"><p>Runs</p></PermissionRoute>);
    expect(screen.getByText('Not used by this business')).toBeInTheDocument();
    expect(screen.getByText(/Production isn't part of this business's setup/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByText('Runs')).not.toBeInTheDocument();
  });

  it('still show the 403 page for a missing permission', () => {
    business(BusinessKind.Manufacturer, BusinessSector.General, [...CORE, 'production'], ['Sales.Create']);
    renderWithProviders(<PermissionRoute permission="Production.View" module="production"><p>Runs</p></PermissionRoute>);
    expect(screen.getByText("You don't have permission")).toBeInTheDocument();
  });
});

describe('product form', () => {
  it('offers only finished goods, and no batch or prescription setup, to a refill station', () => {
    business(BusinessKind.Trader, BusinessSector.WaterRefill, [...CORE, 'deliveries', 'containers']);
    renderWithProviders(<ProductFormDialog open onOpenChange={vi.fn()} />);
    expect(screen.queryAllByRole('option', { name: /Raw material|Packaging/ })).toHaveLength(0);
    expect(screen.getByRole('option', { name: 'Finished good' })).toBeInTheDocument();
    expect(screen.queryByText(/Batch-tracked/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Prescription only/)).not.toBeInTheDocument();
  });

  it('offers every item type and the medicine setup to a manufacturing pharmacy', () => {
    business(BusinessKind.Manufacturer, BusinessSector.Pharmacy, [...CORE, 'production', 'batches', 'prescriptions']);
    renderWithProviders(<ProductFormDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByRole('option', { name: 'Raw material' })).toBeInTheDocument();
    expect(screen.getByText(/Batch-tracked/)).toBeInTheDocument();
    expect(screen.getByText(/Prescription only/)).toBeInTheDocument();
  });
});
