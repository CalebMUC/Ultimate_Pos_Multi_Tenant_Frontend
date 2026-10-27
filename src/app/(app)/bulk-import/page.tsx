'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Download, FileSpreadsheet, Upload, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle, Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@/components/ui/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/Display';
import { FormAlert } from '@/components/shared/States';
import { categoriesApi, productsApi } from '@/api/endpoints/catalog';
import { usePermission } from '@/hooks/useSessionInfo';
import { toastError } from '@/lib/forms';
import type { BulkImportResultDto } from '@/api/dto/catalog';

interface ImportRow { rowNumber: number; name: string; isValid: boolean; error: string | null }

function Importer<R extends ImportRow>({ kind, upload, template, extraColumns, invalidate, note }: {
  kind: string;
  upload(file: File, dryRun: boolean): Promise<BulkImportResultDto<R>>;
  template(): Promise<void>;
  extraColumns: ColumnDef<R, unknown>[];
  /** Other cached lists the import can change. */
  invalidate: string[];
  note?: string;
}) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<BulkImportResultDto<R> | null>(null);
  const [busy, setBusy] = useState<'check' | 'import' | 'template' | null>(null);
  const [error, setError] = useState<unknown>(null);

  async function run(dryRun: boolean) {
    if (!file) return;
    setBusy(dryRun ? 'check' : 'import');
    setError(null);
    try {
      const r = await upload(file, dryRun);
      setResult(r);
      if (r.committed) {
        await Promise.all(invalidate.map((r) => qc.invalidateQueries({ queryKey: [r] })));
        toast.success(`${r.validRows} ${kind} imported`);
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  const columns: ColumnDef<R, unknown>[] = [
    { header: 'Row', accessorKey: 'rowNumber' },
    { header: 'Name', accessorKey: 'name' },
    ...extraColumns,
    {
      header: 'Result',
      accessorKey: 'isValid',
      cell: ({ row }) => (row.original.isValid ? <Badge variant="success"><CheckCircle2 className="size-3" />OK</Badge> : <span className="flex items-center gap-1 text-destructive"><XCircle className="size-3.5 shrink-0" />{row.original.error}</span>),
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="size-5 text-primary" />Import {kind}</CardTitle>
          <CardDescription>1. Download the template. 2. Fill it in. 3. Check the file: nothing is saved until you import. Up to 5,000 rows per file.{note ? ` ${note}` : ''}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            loading={busy === 'template'}
            onClick={async () => {
              setBusy('template');
              try { await template(); } catch (e) { toastError(e); } finally { setBusy(null); }
            }}
          >
            <Download />Template
          </Button>
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="w-auto max-w-xs"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setError(null); }}
          />
          <Button variant="secondary" disabled={!file} loading={busy === 'check'} onClick={() => run(true)}>Check file</Button>
          <Button disabled={!file || !result || result.committed || result.validRows === 0} loading={busy === 'import'} onClick={() => run(false)}>
            <Upload />Import {result && !result.committed ? `${result.validRows} valid row(s)` : ''}
          </Button>
        </CardContent>
      </Card>
      <FormAlert error={error} />
      {result && (
        <>
          <Alert variant={result.committed ? 'success' : result.invalidRows > 0 ? 'warning' : 'info'}>
            {result.committed ? <CheckCircle2 /> : <FileSpreadsheet />}
            <AlertTitle>{result.committed ? 'Imported' : 'Checked: nothing saved yet'}</AlertTitle>
            <AlertDescription>
              {result.totalRows} row(s): {result.validRows} valid, {result.invalidRows} with errors.
              {!result.committed && result.invalidRows > 0 && ' Rows with errors are skipped. Fix them in the file and check again, or import the valid rows now.'}
            </AlertDescription>
          </Alert>
          <DataTable columns={columns} data={result.rows} getRowId={(r) => String(r.rowNumber)} pageSize={50} rowClassName={(r) => (r.isValid ? undefined : 'bg-destructive/5')} />
        </>
      )}
    </div>
  );
}

function BulkImport() {
  const products = usePermission('Products.BulkImport');
  const categories = usePermission('Categories.BulkImport');
  return (
    <>
      <PageHeader title="Bulk import" description="Load categories and products from a spreadsheet. Import categories first: products refer to them by code." />
      <Tabs defaultValue={categories ? 'categories' : 'products'}>
        <TabsList>
          {categories && <TabsTrigger value="categories">Categories</TabsTrigger>}
          {products && <TabsTrigger value="products">Products</TabsTrigger>}
        </TabsList>
        {categories && (
          <TabsContent value="categories">
            <Importer
              kind="categories"
              upload={categoriesApi.bulkUpload}
              template={categoriesApi.downloadTemplate}
              invalidate={['categories']}
              extraColumns={[{ header: 'Code', accessorKey: 'code' }, { header: 'Parent code', accessorKey: 'parentCode', cell: ({ row }) => (row.original as { parentCode: string | null }).parentCode ?? '—' }]}
            />
          </TabsContent>
        )}
        {products && (
          <TabsContent value="products">
            <Importer
              kind="products"
              upload={productsApi.bulkUpload}
              template={productsApi.downloadTemplate}
              invalidate={['products', 'brands']}
              note="Description and Brand are optional. A brand that doesn’t exist yet is created on import; a deactivated brand is an error."
              extraColumns={[{ header: 'SKU', accessorKey: 'sku', cell: ({ row }) => (row.original as { sku: string | null }).sku ?? '—' }]}
            />
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission={['Products.BulkImport', 'Categories.BulkImport']}><BulkImport /></PermissionRoute>;
}
