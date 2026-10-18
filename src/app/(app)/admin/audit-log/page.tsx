'use client';

import { PermissionRoute } from '@/components/shared/Can';
import { AuditLogPage } from '@/features/audit/AuditLogPage';

export default function Page() {
  return <PermissionRoute permission="AuditLog.View"><AuditLogPage /></PermissionRoute>;
}
