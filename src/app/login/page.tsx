'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/primitives';
import { FormAlert } from '@/components/shared/States';
import { BrandMark } from '@/components/layout/BrandMark';
import { login } from '@/features/auth/sessionActions';
import { landingPath, safeReturnTo } from '@/features/auth/AuthGuard';
import { isAccessCode } from '@/features/access/access';
import { reportAccessBlocked } from '@/api/client';
import { isApiError, normaliseError } from '@/api/errors';
import { tokenStorage } from '@/api/tokenStorage';
import { useSession } from '@/stores/session';

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
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  // Already signed in (session restored): skip the form.
  useEffect(() => {
    if (status !== 'authenticated') return;
    const { user, activeBusinessId, mustChangePassword } = useSession.getState();
    router.replace(landingPath({ permissions: user?.permissions ?? [], activeBusinessId, mustChangePassword }, returnTo));
  }, [status, returnTo, router]);

  async function onSubmit(values: FormValues) {
    setError(null);
    const remembered = tokenStorage.getLastBusinessId();
    try {
      let data;
      try {
        data = await login(values.email, values.password, remembered);
      } catch (e) {
        // The remembered business may belong to someone else on this device, the user may have lost access to it, or it may
        // be suspended or out of licence: without it, the API signs in to a business the user can still use.
        if (remembered && (isApiError(e, 'FORBIDDEN') || isAccessCode(normaliseError(e).code))) data = await login(values.email, values.password, null);
        else throw e;
      }
      const choose = data.businesses.length > 1 && !remembered && !!data.activeBusinessId;
      router.replace(landingPath(
        { permissions: data.user.permissions, activeBusinessId: data.activeBusinessId, mustChangePassword: data.mustChangePassword ?? false },
        returnTo,
        choose,
      ));
    } catch (e) {
      // No business the user belongs to can be used today: say why, full page.
      if (reportAccessBlocked(normaliseError(e))) {
        router.push(`/blocked?code=${normaliseError(e).code}`);
        return;
      }
      setError(e);
    }
  }

  const { errors, isSubmitting } = form.formState;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <BrandMark />
        <div className="space-y-4">
          <h2 className="text-3xl font-semibold leading-tight">Sell, stock and account for every business you run, from one place.</h2>
          <p className="max-w-md text-sidebar-muted">
            Point of sale, batch and expiry tracking, purchasing, production and reports for Kenyan manufacturers, pharmacies and retailers.
          </p>
        </div>
        <p className="text-xs text-sidebar-muted">© {new Date().getFullYear()} Ultimate POS</p>
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-primary/20 blur-3xl" />
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden"><BrandMark dark={false} /></div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Sign in</h1>
            <p className="text-sm text-muted-foreground">Use the email and password your administrator gave you.</p>
          </div>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
