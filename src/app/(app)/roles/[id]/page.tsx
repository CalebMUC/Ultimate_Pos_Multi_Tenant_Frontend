'use client';

import { useParams } from 'next/navigation';
import { PermissionRoute } from '@/components/shared/Can';
import { RolesScreen } from '@/features/admin/RolesScreen';

/** Linked from "Role permissions changed" notifications and the audit log. */
export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <PermissionRoute permission="Roles.View"><RolesScreen key={id} initialRoleId={id} /></PermissionRoute>;
}
