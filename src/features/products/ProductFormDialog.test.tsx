import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ItemType, TaxClassification } from '@/api/enums';
import { renderWithProviders, signIn } from '@/test/render';
import type { ProductDto } from '@/api/dto/catalog';
import { ProductFormDialog } from './ProductFormDialog';

const product: ProductDto = {
  productId: 'p1', sku: 'FLR-FG-000001', name: 'Soko Maize Meal 2kg', description: null, categoryId: 'c1', categoryName: 'Maize Flour',
  itemType: ItemType.FinishedGood, taxClassification: TaxClassification.Standard, baseUnitOfMeasureId: 'pcs', baseUnitSymbol: 'pcs', reorderLevel: 0,
  barcode: null, isBatchTracked: false, requiresPrescription: false, genericName: null, strength: null, dosageForm: null, manufacturer: null,
  isActive: true, brandId: 'soko', brandName: 'Soko',
};

describe('new product prices and packs', () => {
  it('shows prices and packs to a user who may set both', () => {
    signIn(['Products.View', 'Products.Create', 'Products.ManagePricing', 'Products.ManageUnitConversions']);
    renderWithProviders(<ProductFormDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByLabelText(/Retail price per/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add pack/ }));
    expect(screen.getByLabelText(/in one pack/)).toBeInTheDocument();
    expect(screen.getByLabelText('Retail price per pack')).toBeInTheDocument();
  });

  it('shows no price fields without Products.ManagePricing, but still offers packs', () => {
    signIn(['Products.View', 'Products.Create', 'Products.ManageUnitConversions']);
    renderWithProviders(<ProductFormDialog open onOpenChange={vi.fn()} />);
    expect(screen.queryByLabelText(/Retail price per/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add pack/ }));
    expect(screen.queryByLabelText('Retail price per pack')).not.toBeInTheDocument();
  });

  it('offers no packs without Products.ManageUnitConversions', () => {
    signIn(['Products.View', 'Products.Create', 'Products.ManagePricing']);
    renderWithProviders(<ProductFormDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByLabelText(/Retail price per/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add pack/ })).not.toBeInTheDocument();
  });

  it('leaves prices to the Pricing tab when editing', () => {
    signIn(['Products.View', 'Products.Update', 'Products.ManagePricing', 'Products.ManageUnitConversions']);
    renderWithProviders(<ProductFormDialog open onOpenChange={vi.fn()} product={product} />);
    expect(screen.queryByText('Prices')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add pack/ })).not.toBeInTheDocument();
  });
});
