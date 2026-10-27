import { describe, expect, it } from 'vitest';
import { brandChange } from './ProductFormDialog';

describe('brandChange', () => {
  it('sends nothing when the brand is unchanged, so the API keeps it', () => {
    expect(brandChange('soko', 'soko')).toEqual({});
    expect(brandChange('', '')).toEqual({});
  });

  it('sends the new brand when it changed', () => {
    expect(brandChange('soko', 'pembe')).toEqual({ brandId: 'pembe' });
    expect(brandChange('', 'pembe')).toEqual({ brandId: 'pembe' });
  });

  it('asks to remove the brand when it was cleared', () => {
    expect(brandChange('soko', '')).toEqual({ removeBrand: true });
  });
});
