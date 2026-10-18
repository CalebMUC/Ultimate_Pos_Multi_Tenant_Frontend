import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl font-bold text-primary">404</p>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">The link may be wrong, or the page has moved.</p>
      <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Go to the start page</Link>
    </div>
  );
}
