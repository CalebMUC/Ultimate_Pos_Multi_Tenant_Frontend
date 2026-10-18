import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { ApiError, normaliseError, toFormPath } from './errors';

function axiosError(status: number, data: unknown): AxiosError {
  const response = { status, data, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } } as AxiosResponse;
  return new AxiosError('failed', 'ERR_BAD_REQUEST', response.config, null, response);
}

describe('toFormPath', () => {
  it('converts indexer paths to react-hook-form paths', () => {
    expect(toFormPath('lines[0].quantity')).toBe('lines.0.quantity');
    expect(toFormPath('prescription.patientName')).toBe('prescription.patientName');
    expect(toFormPath('lines[12]')).toBe('lines.12');
  });
});

describe('normaliseError', () => {
  it('reads the envelope with field details', () => {
    const error = normaliseError(
      axiosError(400, {
        success: false,
        data: null,
        error: { code: 'VALIDATION_FAILED', message: 'Name is required.', details: { name: ['Name is required.'], 'lines[1].quantity': ['Must be more than 0.'] } },
      }),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.fieldErrors).toEqual({ name: ['Name is required.'], 'lines.1.quantity': ['Must be more than 0.'] });
  });

  it('reads the single-message shape', () => {
    const error = normaliseError(axiosError(400, { success: false, error: { code: 'INVALID_ASSIGNMENT', message: 'Cannot cancel a received order.' } }));
    expect(error.code).toBe('INVALID_ASSIGNMENT');
    expect(error.message).toBe('Cannot cancel a received order.');
    expect(error.hasFieldErrors()).toBe(false);
  });

  it('handles empty 401 and 403 bodies', () => {
    expect(normaliseError(axiosError(401, '')).code).toBe('UNAUTHORIZED');
    const forbidden = normaliseError(axiosError(403, ''));
    expect(forbidden.code).toBe('NO_PERMISSION');
    expect(forbidden.message).toMatch(/permission/i);
  });

  it('keeps business 403s (FORBIDDEN) with their message', () => {
    const error = normaliseError(axiosError(403, { success: false, error: { code: 'FORBIDDEN', message: 'A pharmacist must dispense this.' } }));
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toBe('A pharmacist must dispense this.');
  });

  it('reports network failures', () => {
    const error = normaliseError(new AxiosError('Network Error', 'ERR_NETWORK'));
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.status).toBe(0);
  });

  it('falls back on ProblemDetails', () => {
    const error = normaliseError(axiosError(400, { title: 'One or more validation errors occurred.', errors: { Name: ['Required'] } }));
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.fieldErrors.Name).toEqual(['Required']);
  });
});
