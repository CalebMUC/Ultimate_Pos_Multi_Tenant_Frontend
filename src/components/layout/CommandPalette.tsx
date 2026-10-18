'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { useQuery } from '@tanstack/react-query';
import { CornerDownLeft, Package, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { ProductFlags } from '@/components/shared/Display';
import { productsApi } from '@/api/endpoints/catalog';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { useVisibleNavigation } from './Sidebar';

/** Ctrl+K: jump to any page the user may open, or find a product by name, SKU, barcode or generic name. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search.trim(), 200);
  const groups = useVisibleNavigation();
  const canSearchProducts = usePermission('Products.View');
  const key = useQueryKey();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('upos:open-command', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('upos:open-command', onOpen);
    };
  }, []);

  const products = useQuery({
    queryKey: key('products', { search: debounced, pageSize: 8, palette: true }),
    queryFn: ({ signal }) => productsApi.list({ search: debounced, pageSize: 8 }, signal),
    enabled: open && canSearchProducts && debounced.length >= 2,
  });

  function go(href: string) {
    setOpen(false);
    setSearch('');
    router.push(href);
  }

  const pages = groups.flatMap((g) => (g.href ? [{ label: g.label, group: g.label, href: g.href }] : g.items!.map((i) => ({ label: i.label, group: g.label, href: i.href }))));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Search</DialogTitle>
        <Command shouldFilter={false} className="flex flex-col">
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 text-muted-foreground" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Go to a page or find a product…"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">No results.</Command.Empty>
            {(products.data?.items.length ?? 0) > 0 && (
              <Command.Group heading="Products" className="text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                {products.data!.items.map((p) => (
                  <Command.Item
                    key={p.productId}
                    value={`product-${p.productId}`}
                    onSelect={() => go(`/products/${p.productId}`)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground aria-selected:bg-accent"
                  >
                    <Package className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      {p.name}
                      {p.strength ? ` ${p.strength}` : ''} <span className="text-xs text-muted-foreground">· {p.sku}</span>
                    </span>
                    <ProductFlags requiresPrescription={p.requiresPrescription} isBatchTracked={p.isBatchTracked} />
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            <Command.Group heading="Pages" className="text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
              {pages
                .filter((p) => !search || `${p.group} ${p.label}`.toLowerCase().includes(search.toLowerCase()))
                .map((p) => (
                  <Command.Item
                    key={p.group + p.href + p.label}
                    value={`page-${p.group}-${p.label}`}
                    onSelect={() => go(p.href)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground aria-selected:bg-accent"
                  >
                    <CornerDownLeft className="size-4 text-muted-foreground" />
                    <span className="flex-1">{p.label}</span>
                    {p.group !== p.label && <span className="text-xs text-muted-foreground">{p.group}</span>}
                  </Command.Item>
                ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
