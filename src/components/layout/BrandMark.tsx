import { cn } from '@/lib/utils';

export function BrandMark({ dark = true, compact = false, className }: { dark?: boolean; compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="7" className="fill-primary" />
        <path d="M9 9h9a5 5 0 0 1 0 10h-5v4H9z" fill="#fff" />
        <circle cx="18" cy="14" r="2" className="fill-primary" />
      </svg>
      {!compact && (
        <span className={cn('text-lg font-semibold tracking-tight', dark ? 'text-sidebar-foreground' : 'text-foreground')}>
          Ultimate<span className="text-primary">POS</span>
        </span>
      )}
    </div>
  );
}
