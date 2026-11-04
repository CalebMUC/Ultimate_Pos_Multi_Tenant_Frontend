import { describe, expect, it } from 'vitest';
import { businessSchema } from './BusinessForm';

const logo = businessSchema.shape.logoUrl;

describe('logo link', () => {
  it('takes a full link or a path to an image shipped with the app', () => {
    expect(logo.safeParse('https://cdn.example.com/logo.png').success).toBe(true);
    expect(logo.safeParse('/tenants/aqua-hub/logo.png').success).toBe(true);
    expect(logo.safeParse('').success).toBe(true);
  });

  it('refuses a bare file name and a link to another host without a scheme', () => {
    expect(logo.safeParse('logo.png').success).toBe(false);
    expect(logo.safeParse('//elsewhere.example/logo.png').success).toBe(false);
  });
});
