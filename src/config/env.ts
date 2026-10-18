// Everything with the NEXT_PUBLIC_ prefix ships to the browser: never put secrets here.
// Next inlines these at build time, so each must be read by its full literal name.
export const env = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1',
  useMocks: process.env.NEXT_PUBLIC_USE_MOCKS === 'true',
  defaultUtcOffsetMinutes: Number(process.env.NEXT_PUBLIC_DEFAULT_UTC_OFFSET_MINUTES ?? 180),
  /** The Ultimate POS team, shown on blocking screens and the licence page. Either may be empty. */
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? '',
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? '',
} as const;
