import { describe, expect, it } from 'vitest';
import { guardRedirect, homePathFor, landingPath } from '@/features/auth/AuthGuard';
import { resolveNotificationLink, entityLink } from '@/features/notifications/format';
import {
  accessScreen, accessStatusStyle, addMonthsClamped, computeLicensePeriod, decodeLicenseWarning, isAccessCode, isBlockedStatus, warningTone,
} from './access';

describe('access code → screen', () => {
  it('maps the four refusals to their screens', () => {
    expect(accessScreen('BUSINESS_SUSPENDED')).toMatchObject({ title: 'This business is suspended', showReason: true });
    expect(accessScreen('BUSINESS_CLOSED')).toMatchObject({ title: 'This business has been closed', showReason: false });
    expect(accessScreen('LICENSE_EXPIRED')).toMatchObject({ title: 'The licence has expired', description: 'Renew to continue.' });
    expect(accessScreen('UNLICENSED')).toMatchObject({ title: 'This business has no licence yet' });
    expect(accessScreen('SOMETHING_ELSE').title).toMatch(/can’t be used/);
  });

  it('recognises only the four codes', () => {
    expect(isAccessCode('BUSINESS_SUSPENDED')).toBe(true);
    expect(isAccessCode('UNLICENSED')).toBe(true);
    expect(isAccessCode('USER_LIMIT_REACHED')).toBe(false);
    expect(isAccessCode('FORBIDDEN')).toBe(false);
    expect(isAccessCode(undefined)).toBe(false);
  });
});

describe('status badges', () => {
  it('uses the agreed colours', () => {
    expect(accessStatusStyle('Active').className).toContain('text-success');
    expect(accessStatusStyle('ExpiringSoon').className).toContain('bg-warning');
    expect(accessStatusStyle('GracePeriod').className).toContain('orange');
    expect(accessStatusStyle('Expired').className).toContain('bg-destructive');
    expect(accessStatusStyle('Unlicensed').className).toContain('bg-destructive');
    // Suspended is a red outline, not a fill.
    expect(accessStatusStyle('Suspended').className).toContain('border-destructive');
    expect(accessStatusStyle('Suspended').className).toContain('bg-transparent');
    expect(accessStatusStyle('Closed').className).toContain('bg-muted');
    expect(accessStatusStyle('GracePeriod').label).toBe('Grace period');
  });

  it('knows which statuses are refused', () => {
    expect(['Expired', 'Unlicensed', 'Suspended', 'Closed'].every(isBlockedStatus)).toBe(true);
    expect(['Active', 'ExpiringSoon', 'GracePeriod', null].some(isBlockedStatus)).toBe(false);
  });
});

describe('X-License-Warning', () => {
  it('decodes the URL-encoded header', () => {
    const text = 'The licence ends on 2026-10-25 (7 days left). Renew to avoid interruption.';
    expect(decodeLicenseWarning(encodeURIComponent(text))).toBe(text);
    expect(decodeLicenseWarning('Access%20stops%20in%203%20days')).toBe('Access stops in 3 days');
  });

  it('ignores a missing or empty header and survives bad encoding', () => {
    expect(decodeLicenseWarning(undefined)).toBeNull();
    expect(decodeLicenseWarning('')).toBeNull();
    expect(decodeLicenseWarning('100%')).toBe('100%');
  });

  it('is red in the grace period, amber before', () => {
    expect(warningTone('The licence ended on 2026-10-10. Access stops in 3 days unless it is renewed.')).toBe('grace');
    expect(warningTone('The licence ends on 2026-10-25 (7 days left).')).toBe('expiring');
    expect(warningTone('anything', 'GracePeriod')).toBe('grace');
  });
});

describe('licence period preview', () => {
  const today = '2026-10-18';

  it('renews from the day after the current licence', () => {
    expect(computeLicensePeriod({ months: 12, currentEndsOn: '2026-11-30', today })).toEqual({ ok: true, startsOn: '2026-12-01', endsOn: '2027-11-30', renewal: true, days: 365 });
  });

  it('starts today when the current licence has lapsed or there is none', () => {
    expect(computeLicensePeriod({ months: 1, currentEndsOn: '2026-10-01', today })).toMatchObject({ startsOn: today, endsOn: '2026-11-17', renewal: false });
    expect(computeLicensePeriod({ months: 1, currentEndsOn: null, today })).toMatchObject({ startsOn: today, endsOn: '2026-11-17' });
  });

  it('honours an explicit start and an end date instead of months', () => {
    expect(computeLicensePeriod({ endsOn: '2026-12-31', startsOn: '2026-11-01', currentEndsOn: '2026-11-30', today })).toMatchObject({ startsOn: '2026-11-01', endsOn: '2026-12-31', renewal: false, days: 61 });
  });

  it('clamps months like .NET AddMonths', () => {
    expect(addMonthsClamped('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29');
    // A licence from 31 Jan for 1 month ends 27 Feb (28 Feb − 1 day).
    expect(computeLicensePeriod({ months: 1, startsOn: '2027-01-31', today })).toMatchObject({ endsOn: '2027-02-27' });
  });

  it('rejects what the API rejects', () => {
    expect(computeLicensePeriod({ months: 12, endsOn: '2027-01-01', today })).toMatchObject({ ok: false });
    expect(computeLicensePeriod({ today })).toMatchObject({ ok: false });
    expect(computeLicensePeriod({ months: 37, today })).toMatchObject({ ok: false });
    expect(computeLicensePeriod({ endsOn: '2026-10-01', today })).toMatchObject({ ok: false, error: 'The end date must be on or after the start date.' });
  });
});

describe('routing', () => {
  const superUser = { permissions: ['Platform.Dashboard.View', 'Businesses.ViewAll'], activeBusinessId: null };
  const cashier = { permissions: ['Sales.Create'], activeBusinessId: 'b1' };

  it('lands each kind of account in its own app', () => {
    expect(homePathFor(superUser.permissions, null)).toBe('/platform');
    expect(homePathFor(cashier.permissions, 'b1')).toBe('/pos');
    expect(homePathFor(cashier.permissions, 'b1', true)).toBe('/change-password');
  });

  it('sends a forced password change first, then on to the destination', () => {
    expect(landingPath({ ...cashier, mustChangePassword: true }, '/sales')).toBe(`/change-password?returnTo=${encodeURIComponent('/sales')}`);
    expect(landingPath({ ...superUser, mustChangePassword: false }, '/sales')).toBe('/platform');
    expect(landingPath({ ...cashier, mustChangePassword: false }, '/platform/businesses')).toBe('/pos');
  });

  it('keeps each area to its own users', () => {
    const base = { mustChangePassword: false, isPlatformUser: false, activeBusinessId: 'b1', permissions: cashier.permissions };
    expect(guardRedirect({ ...base, isPlatformUser: true, activeBusinessId: null }, 'business', '/sales')).toBe('/platform');
    expect(guardRedirect(base, 'platform', '/platform')).toBe('/pos');
    expect(guardRedirect(base, 'business', '/sales')).toBeNull();
    expect(guardRedirect({ ...base, mustChangePassword: true }, 'business', '/sales')).toBe(`/change-password?returnTo=${encodeURIComponent('/sales')}`);
    expect(guardRedirect({ ...base, mustChangePassword: true }, 'any', '/change-password')).toBeNull();
  });

  it('opens notification links only in the right area', () => {
    expect(resolveNotificationLink('/platform/businesses/x', 'platform')).toBe('/platform/businesses/x');
    expect(resolveNotificationLink('/settings/license', 'platform')).toBe('/platform/licenses');
    expect(resolveNotificationLink('/sales/1', 'platform')).toBeNull();
    expect(resolveNotificationLink('/platform/businesses/x', 'business')).toBeNull();
    expect(resolveNotificationLink('/settings/license', 'business')).toBe('/settings/license');
    expect(entityLink('Business', 'x', 'platform')).toBe('/platform/businesses/x');
    expect(entityLink('Sale', 'x', 'platform')).toBeNull();
  });
});
