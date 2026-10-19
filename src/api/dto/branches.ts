// Application/Branches/BranchDtos.cs and Application/Inventory/StockTransfers.cs
import type { StockTransferStatus } from '../enums';
import type { DateOnly, DateTimeString, Guid } from './common';

/** branchNumber 0–99 is the KRA eTIMS branch id; kraBranchId is it as two digits ("00" is the head office). */
export interface BranchDto {
  branchId: Guid;
  branchNumber: number;
  kraBranchId: string;
  name: string;
  code: string | null;
  physicalAddress: string | null;
  county: string | null;
  phoneNumber: string | null;
  email: string | null;
  /** A branch with its own till gets its customers' payments routed to it. */
  mpesaShortCode: string | null;
  isHeadOffice: boolean;
  isActive: boolean;
  createdAt: DateTimeString;
}

/**
 * Every open branch of the business, names only, for any member: to choose a transfer's destination and to label another branch's
 * documents. isMine: the caller works there. No contact details and no access to the branch's data.
 */
export interface BranchDirectoryEntryDto {
  branchId: Guid;
  branchNumber: number;
  kraBranchId: string;
  name: string;
  code: string | null;
  isHeadOffice: boolean;
  isMine: boolean;
}

/** A branch the signed-in user may work at, default first. */
export interface BranchMembershipDto {
  branchId: Guid;
  branchNumber: number;
  kraBranchId: string;
  name: string;
  code: string | null;
  isDefault: boolean;
}

interface BranchFields {
  name: string;
  code: string | null;
  physicalAddress: string | null;
  county: string | null;
  phoneNumber: string | null;
  email: string | null;
  mpesaShortCode: string | null;
}
/** branchNumber left out takes the next free number (1, 2 …). */
export interface CreateBranchRequestDto extends BranchFields { branchNumber?: number | null }
/** The number is fixed once assigned: it identifies the branch to KRA. */
export type UpdateBranchRequestDto = BranchFields;

/** accessAll: the user holds Branches.AccessAll and may work at every branch, whatever is assigned. */
export interface UserBranchesDto { userId: Guid; accessAll: boolean; branches: BranchDto[]; defaultBranchId: Guid | null }
export interface AssignUserBranchesRequestDto { branchIds: Guid[]; defaultBranchId?: Guid | null }

// ---- Stock transfers ----

export interface CreateStockTransferRequestDto {
  /** Defaults to the branch signed in to. */
  fromBranchId?: Guid | null;
  toBranchId: Guid;
  notes?: string | null;
  lines: { productId: Guid; unitOfMeasureId: Guid; quantity: number }[];
}

/** Lines left out arrived in full; quantities are in the line's own unit. */
export interface ReceiveStockTransferRequestDto { lines?: { stockTransferLineId: Guid; quantityReceived: number }[] | null; notes?: string | null }

export interface StockTransferLineBatchDto { batchNumber: string; expiryDate: DateOnly | null; quantityInBaseUnits: number; quantityReceivedInBaseUnits: number | null }

export interface StockTransferLineDto {
  stockTransferLineId: Guid;
  productId: Guid;
  productName: string;
  sku: string;
  unitOfMeasureId: Guid;
  unitSymbol: string | null;
  quantity: number;
  quantityInBaseUnits: number;
  quantityReceivedInBaseUnits: number | null;
  shortageInBaseUnits: number;
  unitCost: number | null;
  batches: StockTransferLineBatchDto[];
}

export interface StockTransferDto {
  stockTransferId: Guid;
  transferNumber: string;
  fromBranchId: Guid;
  fromBranchName: string;
  fromKraBranchId: string;
  toBranchId: Guid;
  toBranchName: string;
  toKraBranchId: string;
  status: StockTransferStatus;
  notes: string | null;
  createdAt: DateTimeString;
  createdBy: Guid | null;
  dispatchedAt: DateTimeString | null;
  receivedAt: DateTimeString | null;
  receiveNotes: string | null;
  /** Costs: shown only with Costing.View. */
  dispatchedValue: number | null;
  shortageValue: number | null;
  lines: StockTransferLineDto[];
}
