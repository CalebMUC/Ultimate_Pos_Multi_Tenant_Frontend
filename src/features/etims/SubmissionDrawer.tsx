'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { Can } from '@/components/shared/Can';
import { DetailList } from '@/components/shared/Display';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { EtimsSubmissionStatus, labels } from '@/api/enums';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateTime } from '@/lib/format';
import type { EtimsSubmissionDto } from '@/api/dto/etims';
import { sourceHref, submissionStatusVariant } from './etims';
import { useEtimsScope } from './scope';

export const canRetry = (s: EtimsSubmissionDto) => s.status === EtimsSubmissionStatus.Failed || s.status === EtimsSubmissionStatus.Rejected;

export function SubmissionStatusBadge({ status }: { status: EtimsSubmissionStatus }) {
  return <Badge variant={submissionStatusVariant[status]}>{labels.etimsSubmissionStatus[status]}</Badge>;
}

/** One submission, with the exact JSON sent to KRA and KRA's reply. */
export function SubmissionDrawer({ submissionId, onOpenChange, onRetry, retrying }: {
  submissionId: string | null;
  onOpenChange(open: boolean): void;
  onRetry(s: EtimsSubmissionDto): void;
  retrying: boolean;
}) {
  const key = useQueryKey();
  const { calls, resource, manage, linksSources } = useEtimsScope();
  const detail = useQuery({
    queryKey: key(resource, { etimsSubmission: submissionId }),
    queryFn: () => calls.submission(submissionId!),
    enabled: !!submissionId,
  });
  const s = detail.data?.submission;
  const href = s && linksSources ? sourceHref(s.sourceType, s.sourceId) : null;
  return (
    <Dialog open={!!submissionId} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        className="left-auto right-0 top-0 h-full max-h-screen w-full translate-x-0 translate-y-0 content-start rounded-none data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 sm:w-[min(48rem,100%)]"
      >
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {s ? <>{labels.etimsDocumentType[s.documentType]} <SubmissionStatusBadge status={s.status} /></> : 'Submission'}
          </DialogTitle>
          <DialogDescription>{s ? `${s.endpoint} · created ${formatDateTime(s.createdAt)}` : 'Loading…'}</DialogDescription>
        </DialogHeader>
        {detail.isLoading ? <LoadingState /> : detail.error ? <ErrorState error={detail.error} onRetry={() => detail.refetch()} /> : s && (
          <div className="space-y-4">
            <DetailList
              columns={2}
              items={[
                { label: 'Source', value: href ? <Link href={href} className="text-primary hover:underline">{s.sourceType}</Link> : s.sourceType },
                { label: 'KRA number', value: s.documentNumber },
                { label: 'KRA code', value: s.resultCode && <span className="font-mono">{s.resultCode}</span> },
                { label: 'KRA said', value: s.resultMessage },
                { label: 'Attempts', value: s.attempts },
                { label: 'Last attempt', value: s.lastAttemptAt ? formatDateTime(s.lastAttemptAt) : null },
                { label: 'Next attempt', value: s.status === EtimsSubmissionStatus.Failed ? formatDateTime(s.nextAttemptAt) : null },
                { label: 'Sent', value: s.sentAt ? formatDateTime(s.sentAt) : null },
                { label: 'Receipt no.', value: s.receiptNumber },
              ]}
            />
            {canRetry(s) && (
              <Can permission={manage}>
                <Button loading={retrying} onClick={() => onRetry(s)}><RotateCcw />Retry</Button>
              </Can>
            )}
            <JsonPane title="Sent to KRA" value={detail.data!.request} />
            <JsonPane title="KRA replied" value={detail.data!.response} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function JsonPane({ title, value }: { title: string; value: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = value === null || value === undefined ? '' : JSON.stringify(value, null, 2);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused (no permission, not a secure origin): the text can still be selected.
    }
  }
  return (
    <section aria-label={title}>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {text && <Button variant="ghost" size="sm" onClick={copy}>{copied ? <Check /> : <Copy />}{copied ? 'Copied' : 'Copy'}</Button>}
      </div>
      {text
        ? <pre className="max-h-80 overflow-auto rounded-md border bg-muted p-3 font-mono text-xs">{text}</pre>
        : <p className="text-sm text-muted-foreground">Nothing yet.</p>}
    </section>
  );
}
