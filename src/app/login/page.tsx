'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/primitives';
import { FormAlert } from '@/components/shared/States';
import { TenantMark } from '@/components/layout/TenantMark';
import { login, logout } from '@/features/auth/sessionActions';
import { BranchChoiceList } from '@/features/branches/BranchChoiceList';
import { landingPath, safeReturnTo } from '@/features/auth/AuthGuard';
import { isAccessCode } from '@/features/access/access';
import { reportAccessBlocked } from '@/api/client';
import { isApiError, normaliseError } from '@/api/errors';
import { tokenStorage } from '@/api/tokenStorage';
import { useSession } from '@/stores/session';
import { useStoredBranding } from '@/hooks/useSessionInfo';

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});
type FormValues = z.infer<typeof schema>;


function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'));
  const status = useSession((s) => s.status);
  const [error, setError] = useState<unknown>(null);
  /** Signed in, with several branches: where to go once one is chosen. */
  const [branchStep, setBranchStep] = useState<string | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });
  // A sign-in from this form routes itself (through the pickers); the effect below is only for a session restored on load.
  const signingIn = useRef(false);

  // Already signed in (session restored): skip the form.
  useEffect(() => {
    if (status !== 'authenticated' || signingIn.current) return;
    const { user, activeBusinessId, mustChangePassword } = useSession.getState();
    router.replace(landingPath({ permissions: user?.permissions ?? [], activeBusinessId, mustChangePassword }, returnTo));
  }, [status, returnTo, router]);

  async function onSubmit(values: FormValues) {
    setError(null);
    signingIn.current = true;
    const remembered = tokenStorage.getLastBusinessId();
    const rememberedBranch = tokenStorage.getLastBranchId(remembered);
    // The remembered business and branch may belong to someone else on this device, the user may have lost access to them,
    // the branch may be closed, or the business suspended: fall back step by step, and the API picks what the user can use.
    const fallsBack = (e: unknown) => isApiError(e, 'FORBIDDEN') || isAccessCode(normaliseError(e).code);
    const attempts: [string | null, string | null][] = [[remembered, rememberedBranch], [remembered, null], [null, null]];
    const tries = attempts.filter(([b, br], i) => i === 0 || (b !== attempts[i - 1][0] || br !== attempts[i - 1][1]));
    try {
      let data;
      for (let i = 0; ; i++) {
        try {
          data = await login(values.email, values.password, tries[i][0], tries[i][1]);
          break;
        } catch (e) {
          if (i < tries.length - 1 && fallsBack(e)) continue;
          throw e;
        }
      }
      const chooseBusiness = data.businesses.length > 1 && !remembered && !!data.activeBusinessId;
      // Several branches: the user picks where they work today (their last or default branch is preselected).
      const chooseBranch = !!data.activeBusinessId && (data.branches?.length ?? 0) > 1;
      const mustChange = data.mustChangePassword ?? false;
      if (chooseBranch && !chooseBusiness && !mustChange) {
        // Right here in the sign-in card. (After a business picker or a password change, it's the /select-branch page.)
        setBranchStep(landingPath({ permissions: data.user.permissions, activeBusinessId: data.activeBusinessId, mustChangePassword: false }, returnTo));
        return;
      }
      router.replace(landingPath(
        { permissions: data.user.permissions, activeBusinessId: data.activeBusinessId, mustChangePassword: data.mustChangePassword ?? false },
        returnTo,
        chooseBusiness,
        chooseBranch,
      ));
    } catch (e) {
      signingIn.current = false;
      // No business the user belongs to can be used today: say why, full page.
      if (reportAccessBlocked(normaliseError(e))) {
        router.push(`/blocked?code=${normaliseError(e).code}`);
        return;
      }
      setError(e);
    }
  }

  const { errors, isSubmitting } = form.formState;
  if (branchStep) {
    const business = useSession.getState().businesses.find((b) => b.businessId === useSession.getState().activeBusinessId);
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Where are you working today?</h1>
          <p className="text-sm text-muted-foreground">
            {business ? <>{business.tradingName || business.businessName} · </> : null}Choose your branch. You can switch from the header later.
          </p>
        </div>
        <BranchChoiceList onChosen={() => router.replace(branchStep)} />
        <Button
          variant="ghost"
          className="w-full"
          onClick={async () => {
            await logout();
            signingIn.current = false;
            setBranchStep(null);
            form.reset({ email: form.getValues('email'), password: '' });
          }}
        >
          Not you? Sign in again
        </Button>
      </div>
    );
  }
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">Use the email and password your administrator gave you.</p>
      </div>
      <FormAlert error={error} />
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="email" type="email" autoComplete="username" className="h-11 pl-9" aria-invalid={!!errors.email} {...form.register('email')} />
        </div>
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="password" type="password" autoComplete="current-password" className="h-11 pl-9" aria-invalid={!!errors.password} {...form.register('password')} />
        </div>
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        Sign in
      </Button>
      <p className="text-center text-xs text-muted-foreground">Forgot your password? Ask an administrator of your business to reset it.</p>
    </form>
  );
}

export default function LoginPage() {
  const branding = useStoredBranding();
  const [backgroundFailed, setBackgroundFailed] = useState(false);
  const background = backgroundFailed ? null : branding?.backgroundImageUrl;
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        {background && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={background} alt="" onError={() => setBackgroundFailed(true)} className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-sidebar/75" />
          </>
        )}
        {/* Empty until storage is read, so a client's till doesn't flash Ultimate POS first. */}
        {branding !== undefined && (
          <>
            <TenantMark name={branding?.name} logoUrl={branding?.logoUrl} className="relative" />
            {branding ? (
              <div className="relative space-y-4">
                <h2 className="text-3xl font-semibold leading-tight">Welcome to {branding.name}</h2>
                <p className="max-w-md text-sidebar-muted">Sign in to continue.</p>
              </div>
            ) : (
              <div className="relative space-y-4">
                <h2 className="text-3xl font-semibold leading-tight">Sell, stock and account for every business you run, from one place.</h2>
                <p className="max-w-md text-sidebar-muted">
                  Point of sale, batch and expiry tracking, purchasing, production and reports for Kenyan manufacturers, pharmacies and retailers.
                </p>
              </div>
            )}
            <p className="relative text-xs text-sidebar-muted">{branding ? 'Powered by Ultimate POS' : <>© {new Date().getFullYear()} Ultimate POS</>}</p>
          </>
        )}
        {!background && <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-primary/20 blur-3xl" />}
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="min-h-8 lg:hidden">{branding !== undefined && <TenantMark name={branding?.name} logoUrl={branding?.logoUrl} dark={false} />}</div>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
