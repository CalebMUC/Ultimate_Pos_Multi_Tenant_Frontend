import type { Guid } from './dto/common';

/**
 * Any GET may add ?branchId= to see one branch only (lists, reports, the dashboard, valuation, single-product stock). Left out,
 * users with Branches.AccessAll see every branch combined and everyone else their own. Writes always happen at the active branch.
 */
export interface BranchScope { branchId?: Guid | null }

/** The query parameter for a scope, or nothing. */
export const branchParam = (scope?: BranchScope | null): { branchId?: Guid } => (scope?.branchId ? { branchId: scope.branchId } : {});
