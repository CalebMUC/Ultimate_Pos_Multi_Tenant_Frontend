// Some DTOs return enum values as pre-formatted strings (ExpenseDto.paymentMethod/status, StockMovementDto.movementType,
// StockBatchDto.expiryStatus). Normalise them here so the rest of the app only sees typed values.
import { ExpensePaymentMethod, ExpenseStatus, StockMovementType, type ExpiryStatus } from './enums';
import type { ExpenseApiDto, ExpenseDto } from './dto/expenses';
import type { StockBatchApiDto, StockBatchDto, StockMovementApiDto, StockMovementDto } from './dto/inventory';

/** Parses an enum value that may arrive as its name ("BankTransfer"), its number (2) or a numeric string ("2"). */
export function parseEnum<E extends Record<string, string | number>>(enumObj: E, value: unknown): E[keyof E] | null {
  if (typeof value === 'number') return (Object.values(enumObj).includes(value) ? value : null) as E[keyof E] | null;
  if (typeof value !== 'string' || value === '') return null;
  if (/^\d+$/.test(value)) return parseEnum(enumObj, Number(value));
  const key = Object.keys(enumObj).find((k) => k.toLowerCase() === value.replace(/[\s_-]/g, '').toLowerCase());
  return key ? (enumObj[key as keyof E] as E[keyof E]) : null;
}

const EXPIRY_STATUSES: ExpiryStatus[] = ['Expired', 'NearExpiry', 'Ok', 'NoExpiry'];

export function parseExpiryStatus(value: string | null | undefined): ExpiryStatus {
  const found = EXPIRY_STATUSES.find((s) => s.toLowerCase() === (value ?? '').toLowerCase());
  return found ?? 'NoExpiry';
}

export function mapExpense(dto: ExpenseApiDto): ExpenseDto {
  return {
    ...dto,
    paymentMethod: parseEnum(ExpensePaymentMethod, dto.paymentMethod) ?? ExpensePaymentMethod.Cash,
    status: parseEnum(ExpenseStatus, dto.status) ?? ExpenseStatus.Posted,
  };
}

/** "Transfer to 02 Kisumu" / "Transfer from 01 Westlands": the API notes transfers as "TRF-000001 to 02 Kisumu". */
export function movementName(movementType: string, notes: string | null | undefined): string {
  const type = parseEnum(StockMovementType, movementType);
  if (type === StockMovementType.TransferOut || type === StockMovementType.TransferIn) {
    const out = type === StockMovementType.TransferOut;
    const match = (out ? /\bto\s+(.+)$/i : /\bfrom\s+(.+)$/i).exec(notes ?? '');
    return match ? `Transfer ${out ? 'to' : 'from'} ${match[1].trim()}` : `Transfer ${out ? 'out' : 'in'}`;
  }
  return movementType.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function mapStockMovement(dto: StockMovementApiDto): StockMovementDto {
  return {
    ...dto,
    movementType: parseEnum(StockMovementType, dto.movementType),
    movementTypeName: movementName(dto.movementType, dto.notes),
  };
}

export function mapStockBatch(dto: StockBatchApiDto): StockBatchDto {
  return { ...dto, expiryStatus: parseExpiryStatus(dto.expiryStatus) };
}

/** "PartiallyReceived" -> "Partially received", for report strings. */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  const spaced = value.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0) + spaced.slice(1).toLowerCase();
}
