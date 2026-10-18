'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BlockedScreen } from '@/features/access/BlockedScreen';

function Blocked() {
  return <BlockedScreen code={useSearchParams().get('code')} />;
}

/** Not behind the auth guard: refusals also arrive at sign-in, before there is a session. */
export default function BlockedPage() {
  return <Suspense><Blocked /></Suspense>;
}
