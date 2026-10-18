'use client';

import { PermissionRoute } from '@/components/shared/Can';
import { PosPage } from '@/features/pos/PosPage';

export default function Page() {
  return (
    <PermissionRoute permission="Sales.Create">
      <PosPage />
    </PermissionRoute>
  );
}
