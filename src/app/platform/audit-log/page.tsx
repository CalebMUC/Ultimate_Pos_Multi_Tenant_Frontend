'use client';

import { PermissionRoute } from '@/components/shared/Can';
import { AuditLogView } from '@/features/audit/AuditLogPage';

/** The platform's own events: registrations, suspensions, licences and Super Users. A business's log is on its Activity tab. */
export default function Page() {
  return <PermissionRoute permission="Platform.Support"><AuditLogView platform={{}} /></PermissionRoute>;
}
