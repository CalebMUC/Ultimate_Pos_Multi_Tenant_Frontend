'use client';

import { PermissionRoute } from '@/components/shared/Can';
import { RolesScreen } from '@/features/admin/RolesScreen';

export default function Page() {
  return <PermissionRoute permission="Roles.View"><RolesScreen /></PermissionRoute>;
}
