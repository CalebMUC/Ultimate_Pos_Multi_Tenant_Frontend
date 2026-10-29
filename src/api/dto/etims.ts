// Application/Etims/EtimsDtos.cs
import type { EtimsDocumentType, EtimsSubmissionStatus } from '../enums';
import type { DateTimeString, Guid } from './common';

export interface RegisterEtimsDeviceRequestDto {
  branchId: Guid;
  /** The serial the PIN's device was registered with on KRA's eTIMS portal, e.g. "UPOSP052446551J001". */
  deviceSerialNumber: string;
  /** Classification for products with none of their own or from their category. */
  defaultItemClassCode: string;
  /** Defaults to the business's KRA PIN. */
  tin?: string | null;
  /** Only for a device KRA already initialised (KRA answers "902 This device is installed"): the key it issued then. */
  cmcKey?: string | null;
  /** Optional: the API follows KRA's expected numbers anyway. */
  lastInvoiceNumber?: number;
  lastStockAdjustmentNumber?: number;
  lastItemSequence?: number;
  /** KRA prints at most 20 characters. */
  receiptTopMessage?: string | null;
  receiptBottomMessage?: string | null;
}

/** Full replace. A deactivated device stops reporting; nothing it missed is sent later. */
export interface UpdateEtimsDeviceRequestDto {
  defaultItemClassCode: string;
  isActive: boolean;
  receiptTopMessage: string | null;
  receiptBottomMessage: string | null;
}

export type EtimsStatusName = 'Pending' | 'Failed' | 'Sent' | 'Rejected';

export interface EtimsDeviceDto {
  etimsDeviceId: Guid;
  branchId: Guid;
  branchName: string;
  tin: string;
  /** KRA's branch id: "00" for the head office. */
  bhfId: string;
  deviceSerialNumber: string;
  /** Masked, e.g. "233...851". The key itself never reaches the browser. */
  cmcKeyHint: string;
  sdcId: string | null;
  mrcNo: string | null;
  taxpayerName: string | null;
  kraBranchName: string | null;
  defaultItemClassCode: string | null;
  receiptTopMessage: string | null;
  receiptBottomMessage: string | null;
  isActive: boolean;
  activatedAt: DateTimeString;
  sweptUntil: DateTimeString;
  lastInvoiceNumber: number;
  lastStockAdjustmentNumber: number;
  lastItemSequence: number;
  openingStockQueuedAt: DateTimeString | null;
  lastCodeSyncAt: DateTimeString | null;
  /** Keyed by status NAME. A status with none may be missing. */
  submissionCounts: Partial<Record<EtimsStatusName, number>>;
}

export interface EtimsRunResultDto { queued: number; sent: number; failed: number; waiting: number }

export interface EtimsReferenceSyncDto { kind: string; resultCode: string | null; resultMessage: string | null; count: number }

/** codeClass 10: quantity units, 17: packaging units. */
export interface EtimsCodeDto { codeClass: string; codeClassName: string; code: string; name: string; useYn: string | null }

export interface EtimsItemClassDto { itemClassCode: string; itemClassName: string; level: string | null; taxTypeCode: string | null; useYn: string | null }

/** A read from KRA, passed through: data is KRA's own JSON. resultCode "001" means nothing was found. */
export interface EtimsLookupDto { endpoint: string; resultCode: string | null; resultMessage: string | null; resultDate: string | null; data: unknown; error: string | null }

export type EtimsLookupKind = 'taxpayer' | 'branches' | 'notices' | 'items' | 'purchases' | 'imports' | 'sales' | 'stock-moves' | 'customer-pin' | 'invoice';

export interface EtimsProductProfileDto {
  productId: Guid;
  /** KRA's code, e.g. "KE2NTBX0000014". Null until KRA accepts the item. */
  itemCode: string | null;
  /** The product's own classification. */
  itemClassCode: string | null;
  /** Its own, else its category's. Both null: the device default applies. */
  effectiveItemClassCode: string | null;
  packagingUnitCode: string;
  /** Two letters: KG, BX, NO… */
  quantityUnitCode: string;
  originCountryCode: string;
  /** KRA holds it: nothing can change any more. */
  isRegistered: boolean;
}

/** Nulls keep the current value. 400 INVALID_ASSIGNMENT once KRA holds the item. */
export interface UpdateEtimsProductProfileRequestDto {
  itemClassCode: string | null;
  packagingUnitCode: string | null;
  quantityUnitCode: string | null;
  originCountryCode: string | null;
}

export interface EtimsSubmissionDto {
  etimsSubmissionId: Guid;
  etimsDeviceId: Guid;
  branchId: Guid;
  documentType: EtimsDocumentType;
  /** "Product", "Sale", "SaleVoid", "SaleReturn", "OpeningStock", or a stock movement type. */
  sourceType: string;
  /** The product, sale, sale return or stock movement batch it reports. */
  sourceId: Guid;
  /** KRA invoice number (sales, credit notes) or stock number. Null until KRA accepts it. */
  documentNumber: number | null;
  endpoint: string;
  status: EtimsSubmissionStatus;
  attempts: number;
  nextAttemptAt: DateTimeString;
  lastAttemptAt: DateTimeString | null;
  sentAt: DateTimeString | null;
  /** KRA's code, e.g. "000", "910", "924". */
  resultCode: string | null;
  /** KRA's words, or "Waiting for 1 item(s) to be registered with KRA." */
  resultMessage: string | null;
  receiptNumber: number | null;
  createdAt: DateTimeString;
}

/** The exact JSON sent and KRA's reply. */
export interface EtimsSubmissionDetailDto { submission: EtimsSubmissionDto; request: unknown; response: unknown }

export interface EtimsSubmissionQuery {
  page?: number;
  pageSize?: number;
  deviceId?: Guid;
  status?: EtimsSubmissionStatus;
  documentType?: EtimsDocumentType;
  sourceId?: Guid;
}

/** What a receipt prints for KRA. Null fields until KRA has signed the sale. */
export interface EtimsReceiptDto {
  saleId: Guid;
  status: EtimsSubmissionStatus;
  /** KRA's invoice number, not the POS sale number. */
  invoiceNumber: number | null;
  receiptNumber: number | null;
  totalReceiptNumber: number | null;
  internalData: string | null;
  receiptSignature: string | null;
  sdcId: string | null;
  mrcNo: string | null;
  sdcDateTime: string | null;
  /** The QR code's content. */
  verificationUrl: string | null;
  /** Why it is not signed yet, when it is not. */
  resultMessage: string | null;
}

// Application/Etims/PlatformEtimsDtos.cs: the platform, as the integrator every business reports to KRA through.

/** One business's eTIMS position on the platform's overview. */
export interface PlatformEtimsBusinessRowDto {
  businessId: Guid;
  businessName: string;
  kraPin: string;
  etimsEnabled: boolean;
  businessActive: boolean;
  businessSuspended: boolean;
  deviceCount: number;
  activeDeviceCount: number;
  pending: number;
  failed: number;
  rejected: number;
  sent: number;
  /** When KRA last accepted something from it. */
  lastSentAt: DateTimeString | null;
  /** The oldest Failed or Rejected submission. Null = nothing needs attention. */
  oldestProblemAt: DateTimeString | null;
}

/** Every business with eTIMS on (or with devices from when it was), and the totals across them. */
export interface PlatformEtimsOverviewDto {
  businessCount: number;
  deviceCount: number;
  activeDeviceCount: number;
  pending: number;
  failed: number;
  rejected: number;
  businesses: PlatformEtimsBusinessRowDto[];
}

/** device null: the branch has no eTIMS device yet. */
export interface PlatformEtimsBranchDto { branchId: Guid; name: string; kraBranchId: string; isActive: boolean; device: EtimsDeviceDto | null }

export interface PlatformEtimsBusinessDto {
  businessId: Guid;
  businessName: string;
  kraPin: string;
  etimsEnabled: boolean;
  etimsEnabledAt: DateTimeString | null;
  branches: PlatformEtimsBranchDto[];
}

/** A submission with the business and device it went through. */
export interface PlatformEtimsSubmissionDto {
  businessId: Guid;
  businessName: string;
  branchName: string;
  tin: string;
  bhfId: string;
  submission: EtimsSubmissionDto;
}

/** No status: Failed and Rejected (what needs attention). */
export interface PlatformEtimsSubmissionQuery {
  page?: number;
  pageSize?: number;
  businessId?: Guid;
  deviceId?: Guid;
  status?: EtimsSubmissionStatus;
  documentType?: EtimsDocumentType;
}
