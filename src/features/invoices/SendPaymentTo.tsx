import { cn } from '@/lib/utils';
import type { SendPaymentToBlock } from './paymentDetails';

/**
 * The "Send payment to" block. invoice: the A4 invoice and the settings preview. receipt: a credit sale's receipt, on 80 mm or A4,
 * with a rule above; long values (an account name) wrap, never cut short.
 */
export function SendPaymentTo({ block, variant, className }: { block: SendPaymentToBlock; variant: 'invoice' | 'receipt'; className?: string }) {
  const receipt = variant === 'receipt';
  return (
    <section aria-label="Send payment to" className={className}>
      {receipt && <div className="my-2 border-t border-dashed border-black" />}
      <h2 className={cn('font-bold uppercase', receipt ? 'text-center' : 'text-sm font-extrabold tracking-wide text-black')}>
        {receipt ? 'Send payment to' : 'Send payment to:'}
      </h2>
      <dl className={cn('grid gap-x-2 gap-y-0.5', receipt ? 'mt-1 grid-cols-[auto_minmax(0,1fr)]' : 'mt-2.5 grid-cols-[8.5rem_minmax(0,1fr)]')}>
        {block.lines.map((l) => (
          <div key={l.label} className="contents">
            <dt className={cn('whitespace-nowrap', !receipt && 'text-neutral-600')}>{l.label}{receipt ? '' : ':'}</dt>
            <dd className={cn('break-words', receipt ? 'text-right' : 'font-medium text-black')}>{l.value}</dd>
          </div>
        ))}
      </dl>
      {block.due && <p className={cn('mt-1.5 font-semibold', receipt ? 'text-center' : 'text-black')}>{block.due}</p>}
      {block.note && <p className={cn('mt-1 whitespace-pre-line break-words', receipt ? 'text-center' : 'text-xs text-neutral-700')}>{block.note}</p>}
    </section>
  );
}
