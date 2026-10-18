import { describe, expect, it } from 'vitest';
import { ExpensePaymentMethod, ExpenseStatus, StockMovementType } from './enums';
import { humanize, mapExpense, mapStockBatch, mapStockMovement, parseEnum, parseExpiryStatus } from './mappers';
import type { ExpenseApiDto } from './dto/expenses';
import type { StockBatchApiDto, StockMovementApiDto } from './dto/inventory';

describe('parseEnum', () => {
  it('accepts names, numbers and numeric strings', () => {
    expect(parseEnum(ExpensePaymentMethod, 'BankTransfer')).toBe(ExpensePaymentMethod.BankTransfer);
    expect(parseEnum(ExpensePaymentMethod, 'bank transfer')).toBe(ExpensePaymentMethod.BankTransfer);
    expect(parseEnum(ExpensePaymentMethod, 3)).toBe(ExpensePaymentMethod.Cheque);
    expect(parseEnum(ExpensePaymentMethod, '1')).toBe(ExpensePaymentMethod.Mpesa);
  });

  it('returns null for unknown values', () => {
    expect(parseEnum(ExpensePaymentMethod, 'Card')).toBeNull();
    expect(parseEnum(ExpensePaymentMethod, 9)).toBeNull();
    expect(parseEnum(ExpensePaymentMethod, null)).toBeNull();
  });
});

describe('mappers', () => {
  it('normalises expense strings to enums', () => {
    const dto = { paymentMethod: 'Mpesa', status: 'Voided' } as ExpenseApiDto;
    const mapped = mapExpense(dto);
    expect(mapped.paymentMethod).toBe(ExpensePaymentMethod.Mpesa);
    expect(mapped.status).toBe(ExpenseStatus.Voided);
  });

  it('maps stock movement type and keeps a readable name', () => {
    const mapped = mapStockMovement({ movementType: 'SaleReturn' } as StockMovementApiDto);
    expect(mapped.movementType).toBe(StockMovementType.SaleReturn);
    expect(mapped.movementTypeName).toBe('Sale Return');
  });

  it('maps expiry status, defaulting to NoExpiry', () => {
    expect(mapStockBatch({ expiryStatus: 'NearExpiry' } as StockBatchApiDto).expiryStatus).toBe('NearExpiry');
    expect(parseExpiryStatus('expired')).toBe('Expired');
    expect(parseExpiryStatus(undefined)).toBe('NoExpiry');
  });

  it('humanizes report strings', () => {
    expect(humanize('PartiallyReceived')).toBe('Partially received');
    expect(humanize(null)).toBe('—');
  });
});
