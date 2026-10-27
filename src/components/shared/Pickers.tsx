'use client';

import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react';
import { customersApi } from '@/api/endpoints/business';
import { brandsApi, productsApi } from '@/api/endpoints/catalog';
import { suppliersApi } from '@/api/endpoints/inventory';
import { NativeSelect } from '@/components/ui/primitives';
import { flattenCategories, useBrands, useCategories, useExpenseCategories, useUnits } from '@/hooks/useLookups';
import { formatMoney } from '@/lib/format';
import type { CustomerDto } from '@/api/dto/business';
import type { BrandDto, ProductDto, ProductQuery } from '@/api/dto/catalog';
import type { SupplierDto } from '@/api/dto/inventory';
import { ProductFlags } from './Display';
import { EntityCombobox } from './EntityCombobox';

interface PickerProps<T> {
  value: string | null;
  onChange(id: string | null, item: T | null): void;
  selectedLabel?: string | null;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  clearable?: boolean;
  className?: string;
}

export function ProductPicker({ filter, ...props }: PickerProps<ProductDto> & { filter?: Omit<ProductQuery, 'search' | 'page' | 'pageSize'> }) {
  return (
    <EntityCombobox<ProductDto>
      resource="products"
      params={filter}
      fetcher={async (search, signal) => (await productsApi.list({ isActive: true, ...filter, search, pageSize: 20 }, signal)).items}
      getId={(p) => p.productId}
      getLabel={(p) => `${p.name}${p.strength ? ` ${p.strength}` : ''} (${p.sku})`}
      renderItem={(p) => (
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate">
            {p.name}{p.strength ? ` ${p.strength}` : ''} <span className="text-xs text-muted-foreground">{p.sku}</span>
          </span>
          <ProductFlags requiresPrescription={p.requiresPrescription} isBatchTracked={p.isBatchTracked} />
        </span>
      )}
      placeholder={props.placeholder ?? 'Select product…'}
      searchPlaceholder="Name, brand, SKU, barcode or generic name…"
      {...props}
    />
  );
}

/** Offers active brands. A product keeping a since-deactivated brand shows it as "Pembe (inactive)" so it isn't silently lost. */
export function BrandPicker({ footer, ...props }: PickerProps<BrandDto> & { footer?: ReactNode }) {
  const brands = useBrands();
  const current = props.value ? brands.data?.find((b) => b.brandId === props.value) : undefined;
  const selectedLabel = current ? (current.isActive ? current.name : `${current.name} (inactive)`) : props.selectedLabel;
  return (
    <EntityCombobox<BrandDto>
      resource="brands"
      fetcher={(search) => brandsApi.list({ search: search || undefined, isActive: true })}
      getId={(b) => b.brandId}
      getLabel={(b) => b.name}
      placeholder={props.placeholder ?? 'No brand'}
      searchPlaceholder="Search brands…"
      footer={footer}
      {...props}
      selectedLabel={selectedLabel}
    />
  );
}

/** Brand filter for lists: every brand, inactive ones marked. */
export const BrandSelect = forwardRef<HTMLSelectElement, SelectProps>(function BrandSelect({ placeholder = 'All brands', activeOnly = false, ...props }, ref) {
  const brands = useBrands();
  const list = (brands.data ?? []).filter((b) => !activeOnly || b.isActive || b.brandId === props.value);
  return (
    <NativeSelect ref={ref} {...props}>
      <option value="">{brands.isLoading ? 'Loading…' : placeholder}</option>
      {list.map((b) => <option key={b.brandId} value={b.brandId}>{b.isActive ? b.name : `${b.name} (inactive)`}</option>)}
    </NativeSelect>
  );
});

export function CustomerPicker(props: PickerProps<CustomerDto>) {
  return (
    <EntityCombobox<CustomerDto>
      resource="customers"
      fetcher={async (search) => (await customersApi.list(search || undefined)).filter((c) => c.isActive).slice(0, 30)}
      getId={(c) => c.customerId}
      getLabel={(c) => c.customerName}
      renderItem={(c) => (
        <span className="flex flex-col">
          <span className="truncate">{c.customerName}</span>
          <span className="text-xs text-muted-foreground">
            {[c.phoneNumber, c.creditLimit !== null ? `Limit ${formatMoney(c.creditLimit)}` : null].filter(Boolean).join(' · ') || '—'}
          </span>
        </span>
      )}
      placeholder={props.placeholder ?? 'Walk-in customer'}
      searchPlaceholder="Name, phone or KRA PIN…"
      {...props}
    />
  );
}

export function SupplierPicker(props: PickerProps<SupplierDto>) {
  return (
    <EntityCombobox<SupplierDto>
      resource="suppliers"
      fetcher={async (search) => {
        const all = await suppliersApi.list();
        const s = search.toLowerCase();
        return all.filter((x) => x.isActive && (!s || x.supplierName.toLowerCase().includes(s) || (x.phoneNumber ?? '').includes(s))).slice(0, 30);
      }}
      getId={(s) => s.supplierId}
      getLabel={(s) => s.supplierName}
      placeholder={props.placeholder ?? 'Select supplier…'}
      {...props}
    />
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { placeholder?: string; activeOnly?: boolean };

/** Units for a product: base unit plus active pack units. Falls back to all units when no product is given. */
export const UnitSelect = forwardRef<HTMLSelectElement, SelectProps & { allowedIds?: string[] }>(function UnitSelect({ placeholder = 'Unit', allowedIds, activeOnly = true, ...props }, ref) {
  const units = useUnits();
  const list = (units.data ?? []).filter((u) => (!activeOnly || u.isActive || u.unitOfMeasureId === props.value) && (!allowedIds || allowedIds.includes(u.unitOfMeasureId)));
  return (
    <NativeSelect ref={ref} {...props}>
      <option value="">{units.isLoading ? 'Loading…' : placeholder}</option>
      {list.map((u) => <option key={u.unitOfMeasureId} value={u.unitOfMeasureId}>{u.name} ({u.symbol})</option>)}
    </NativeSelect>
  );
});

export const CategorySelect = forwardRef<HTMLSelectElement, SelectProps & { excludeId?: string }>(function CategorySelect({ placeholder = 'Select category', excludeId, activeOnly = true, ...props }, ref) {
  const categories = useCategories();
  const flat = flattenCategories(categories.data).filter((c) => (!activeOnly || c.isActive || c.categoryId === props.value) && c.categoryId !== excludeId);
  return (
    <NativeSelect ref={ref} {...props}>
      <option value="">{categories.isLoading ? 'Loading…' : placeholder}</option>
      {flat.map((c) => <option key={c.categoryId} value={c.categoryId}>{`${'  '.repeat(c.depth)}${c.name}`}</option>)}
    </NativeSelect>
  );
});

export const ExpenseCategorySelect = forwardRef<HTMLSelectElement, SelectProps>(function ExpenseCategorySelect({ placeholder = 'Select category', activeOnly = true, ...props }, ref) {
  const categories = useExpenseCategories();
  const list = (categories.data ?? []).filter((c) => !activeOnly || c.isActive || c.expenseCategoryId === props.value);
  return (
    <NativeSelect ref={ref} {...props}>
      <option value="">{categories.isLoading ? 'Loading…' : placeholder}</option>
      {list.map((c) => <option key={c.expenseCategoryId} value={c.expenseCategoryId}>{c.code} · {c.name}</option>)}
    </NativeSelect>
  );
});

/** A select over an enum label map. Values are numbers. */
export function EnumSelect<T extends number>({ map, value, onChange, placeholder, ...rest }: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> & {
  map: Record<T, string>;
  value: T | null | undefined;
  onChange(value: T | null): void;
  placeholder?: string;
}) {
  return (
    <NativeSelect value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : (Number(e.target.value) as T))} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {Object.entries(map).map(([k, label]) => <option key={k} value={k}>{label as string}</option>)}
    </NativeSelect>
  );
}
