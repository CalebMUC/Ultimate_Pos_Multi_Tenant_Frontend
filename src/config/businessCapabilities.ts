import { BusinessKind } from '@/api/enums';

// Which areas of the app a business uses. The API works them out from the business's sector and kind (BusinessModules.cs) and sends
// them as `modules` on the sign-in memberships and on GET /businesses/current. The frontend never rebuilds that list: it only reads it.
// Modules decide what is OFFERED; permissions still decide what is allowed, and the API enforces permissions, not modules.

/** Module keys the frontend knows. The API may send others (new modules): those are ignored. */
export type ModuleKey =
  | 'dashboard' | 'sales' | 'customers' | 'catalog' | 'stock' | 'purchasing' | 'expenses' | 'reports' | 'mpesa' | 'branches' | 'settings' | 'cashUp'
  | 'production' | 'batches' | 'prescriptions' | 'deliveries' | 'containers' | 'bundles';

/** Names for the "not used by this business" page. */
export const moduleLabels: Partial<Record<ModuleKey, string>> = {
  production: 'Production',
  batches: 'Batches and expiry dates',
  prescriptions: 'The prescription register',
  deliveries: 'Deliveries',
  containers: 'Containers',
  bundles: 'Bundles',
  cashUp: 'The cash-up',
};

/**
 * Whether the business uses a module. `modules` missing (an API from before modules) keeps the behaviour from before: everything
 * shows except production (manufacturers only), and bundles and the cash-up (which came after modules).
 */
export function moduleEnabled(modules: readonly string[] | null | undefined, kind: BusinessKind | null | undefined, key: ModuleKey): boolean {
  if (modules) return modules.includes(key);
  // Newer than the module list: an API without the list has neither.
  if (key === 'bundles' || key === 'cashUp') return false;
  return key === 'production' ? kind === BusinessKind.Manufacturer : true;
}
