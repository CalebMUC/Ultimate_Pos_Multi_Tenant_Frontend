'use client';

import { useQuery } from '@tanstack/react-query';
import { productBundlesApi } from '@/api/endpoints/bundles';
import { PriceType } from '@/api/enums';
import { useActiveBusiness, usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import type { ProductBundleDto } from '@/api/dto/bundles';
import type { SalePreviewDto } from '@/api/dto/sales';

/** Bundles the business can sell now, for the counter and search. Only where the business uses bundles and the user may see products. */
export function useActiveBundles() {
  const key = useQueryKey();
  const { hasModule } = useActiveBusiness();
  const canView = usePermission('Products.View');
  return useQuery({
    queryKey: key('product-bundles', { isActive: true }),
    queryFn: ({ signal }) => productBundlesApi.list({ isActive: true }, signal),
    enabled: hasModule('bundles') && canView,
    staleTime: 30_000,
  });
}

/** The price shown on a tile. Display only: the preview prices the sale. */
export function bundlePrice(bundle: Pick<ProductBundleDto, 'retailPrice' | 'wholesalePrice'>, priceType: PriceType | null | undefined): number {
  return priceType === PriceType.Wholesale ? bundle.wholesalePrice ?? bundle.retailPrice : bundle.retailPrice;
}

/** A part counted one piece per bundle (a bottle): a bundle with exactly one is "bottle + water", any other is a pack. */
const isSinglePiece = (c: ProductBundleDto['components'][number]) => c.baseUnitSymbol === 'pcs' && c.quantityInBaseUnits === 1;
/** Litres in one bundle: its parts held in litres. */
export const bundleLitres = (b: ProductBundleDto) => b.components.filter((c) => c.baseUnitSymbol === 'l').reduce((sum, c) => sum + c.quantityInBaseUnits, 0);

/** Splits bundles into "with bottle" and "packs", each ordered by litres, largest first. */
export function groupBundles(bundles: ProductBundleDto[]): { withBottle: ProductBundleDto[]; packs: ProductBundleDto[] } {
  const byLitres = (a: ProductBundleDto, b: ProductBundleDto) => bundleLitres(b) - bundleLitres(a) || a.name.localeCompare(b.name);
  const withBottle = bundles.filter((b) => b.components.filter(isSinglePiece).length === 1);
  const packs = bundles.filter((b) => !withBottle.includes(b));
  return { withBottle: [...withBottle].sort(byLitres), packs: [...packs].sort(byLitres) };
}

/** A bundle row of the preview: its server total and whether any part is short (with the short parts named). */
export function bundlePreview(preview: SalePreviewDto | undefined, productBundleId: string) {
  const summary = preview?.bundles?.find((b) => b.productBundleId === productBundleId) ?? null;
  const parts = preview?.lines.filter((l) => l.productBundleId === productBundleId) ?? [];
  return { summary, parts, short: parts.filter((l) => !l.stockSufficient) };
}
