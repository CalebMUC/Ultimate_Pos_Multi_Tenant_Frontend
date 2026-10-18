'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PermissionRoute } from '@/components/shared/Can';
import { PageHeader } from '@/components/shared/Display';
import { RegisterBusinessWizard } from '@/features/platform/RegisterBusinessWizard';

export default function Page() {
  return (
    <PermissionRoute permission="Businesses.Register">
      <PageHeader
        title="Register a business"
        description="The business profile, then the person who will run it."
        actions={<Button variant="ghost" asChild><Link href="/platform/businesses"><ArrowLeft />Businesses</Link></Button>}
      />
      <RegisterBusinessWizard />
    </PermissionRoute>
  );
}
