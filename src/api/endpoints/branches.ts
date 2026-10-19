import { cleanParams } from '@/lib/utils';
import { api } from '../client';
import type { StockTransferStatus } from '../enums';
import type { Guid, PageParams } from '../dto/common';
import type {
  AssignUserBranchesRequestDto, BranchDirectoryEntryDto, BranchDto, CreateBranchRequestDto, CreateStockTransferRequestDto, ReceiveStockTransferRequestDto,
  StockTransferDto, UpdateBranchRequestDto, UserBranchesDto,
} from '../dto/branches';

/** Any member may list: they see every branch with Branches.AccessAll, otherwise their own. Changes need Branches.Manage. */
export const branchesApi = {
  list: (includeInactive = false) => api.get<BranchDto[]>('/branches', includeInactive ? { includeInactive } : undefined),
  /** Every open branch, names only, for any member (transfer destinations, labels). The list above is only the caller's own. */
  directory: () => api.get<BranchDirectoryEntryDto[]>('/branches/directory'),
  get: (id: Guid) => api.get<BranchDto>(`/branches/${id}`),
  /** BRANCH_LIMIT_REACHED (403) past the licence's limit. */
  create: (body: CreateBranchRequestDto) => api.post<BranchDto>('/branches', body),
  update: (id: Guid, body: UpdateBranchRequestDto) => api.put<BranchDto>(`/branches/${id}`, body),
  activate: (id: Guid) => api.post<BranchDto>(`/branches/${id}/activate`),
  /** Refused for the head office, and for a branch still holding stock. */
  deactivate: (id: Guid) => api.post<BranchDto>(`/branches/${id}/deactivate`),
};

/** Who works where. Changes apply at the user's next sign-in or token refresh. */
export const userBranchesApi = {
  get: (userId: Guid) => api.get<UserBranchesDto>(`/users/${userId}/branches`),
  /** Full replace. */
  set: (userId: Guid, body: AssignUserBranchesRequestDto) => api.put<UserBranchesDto>(`/users/${userId}/branches`, body),
};

/** Draft → Dispatched (in transit) → Received. A draft can be cancelled; a dispatched transfer must be received. */
export const stockTransfersApi = {
  /** Transfers from or to the branch, when given. */
  list: (query: PageParams & { status?: StockTransferStatus; branchId?: Guid }) => api.getPaged<StockTransferDto>('/stock-transfers', cleanParams(query)),
  get: (id: Guid) => api.get<StockTransferDto>(`/stock-transfers/${id}`),
  create: (body: CreateStockTransferRequestDto) => api.post<StockTransferDto>('/stock-transfers', body),
  /** Takes the stock out of the source (FEFO lots for batch-tracked products). 409 INSUFFICIENT_STOCK leaves the draft. */
  dispatch: (id: Guid) => api.post<StockTransferDto>(`/stock-transfers/${id}/dispatch`),
  receive: (id: Guid, body: ReceiveStockTransferRequestDto) => api.post<StockTransferDto>(`/stock-transfers/${id}/receive`, body),
  cancel: (id: Guid) => api.post<StockTransferDto>(`/stock-transfers/${id}/cancel`),
};
