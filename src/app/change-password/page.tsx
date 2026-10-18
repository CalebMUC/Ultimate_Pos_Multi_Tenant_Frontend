'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/primitives';
import { BrandMark } from '@/components/layout/BrandMark';
import { AuthGuard, homePathFor, safeReturnTo } from '@/features/auth/AuthGuard';
import { ChangePasswordFields, useChangePasswordForm } from '@/features/auth/ChangePasswordDialog';
import { logout } from '@/features/auth/sessionActions';
import { useSession } from '@/stores/session';

/**
 * Required when someone else set the password (a new account, an admin or support reset). The guard keeps the user here
 * until it is done; afterwards they continue to where they were going.
 */
function ChangePassword() {
  const router = useRouter();
  const params = useSearchParams();
  const user = useSession((s) => s.user);
  const forced = useSession((s) => s.mustChangePassword);
  const { form, submit, messages } = useChangePasswordForm(() => {
    toast.success('Password changed');
    const { user: u, activeBusinessId, mustChangePassword } = useSession.getState();
    router.replace(safeReturnTo(params.get('returnTo')) ?? homePathFor(u?.permissions ?? [], activeBusinessId, mustChangePassword));
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <BrandMark dark={false} />
        <Card className="space-y-5 p-6">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-xl font-semibold"><KeyRound className="size-5 text-primary" />Choose a new password</h1>
            <p className="text-sm text-muted-foreground">
              {forced
                ? <>Your password was set by someone else. Choose your own before you continue, {user?.fullName?.split(' ')[0]}.</>
                : 'Change the password you sign in with.'}
            </p>
          </div>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <ChangePasswordFields form={form} messages={messages} autoFocus />
            <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>Change password and continue</Button>
          </form>
        </Card>
        <Button variant="ghost" className="w-full" onClick={async () => { await logout(); window.location.assign('/login'); }}>
          <LogOut />Sign out instead
        </Button>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <AuthGuard area="any">
      <Suspense><ChangePassword /></Suspense>
    </AuthGuard>
  );
}
