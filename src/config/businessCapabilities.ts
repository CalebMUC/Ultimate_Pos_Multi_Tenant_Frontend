import { BusinessKind } from '@/api/enums';

// Which areas of the app a business uses. The API works them out from the business's sector and kind (BusinessModules.cs) and sends
// them as `modules` on the sign-in memberships and on GET /businesses/current. The frontend never rebuilds that list: it only reads it.
// Modules decide what is OFFERED; permissions still decide what is allowed, and the API enforces permissions, not modules.

/** Module keys the frontend knows. The API may send others (new modules): those are ignored. */
export type ModuleKey =
  | 'dashboard' | 'sales' | 'customers' | 'catalog' | 'stock' | 'purchasing' | 'expenses' | 'reports' | 'mpesa' | 'branches' | 'settings'
  | 'production' | 'batches' | 'prescriptions' | 'deliveries' | 'containers';

/** Names for the "not used by this business" page. */
export const moduleLabels: Partial<Record<ModuleKey, string>> = {
  production: 'Production',
  batches: 'Batches and expiry dates',
  prescriptions: 'The prescription register',
  deliveries: 'Deliveries',
  containers: 'Containers',
};

/**
 * Whether the business uses a module. `modules` missing (an API from before modules) keeps today's behaviour: everything shows,
 * except production, which only manufacturers have.
 */
export function moduleEnabled(modules: readonly string[] | null | undefined, kind: BusinessKind | null | undefined, key: ModuleKey): boolean {
  if (modules) return modules.includes(key);
  return key === 'production' ? kind === BusinessKind.Manufacturer : true;
}
