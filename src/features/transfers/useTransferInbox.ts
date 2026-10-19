'use client';

import { useQuery } from '@tanstack/react-query';
import { stockTransfersApi } from '@/api/endpoints/branches';
import { StockTransferStatus } from '@/api/enums';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { useSession } from '@/stores/session';

/** Transfers on their way to the active branch (dispatched, not yet received). The list also holds ones sent from here: keep only incoming. */
export function useTransferInbox() {
  const key = useQueryKey();
  const allowed = usePermission('StockTransfers.View');
  const activeBranchId = useSession((s) => s.activeBranchId);
  const query = useQuery({
    queryKey: key('stock-transfers', { inbox: activeBranchId }),
    queryFn: () => stockTransfersApi.list({ status: StockTransferStatus.Dispatched, branchId: activeBranchId!, pageSize: 100 }),
    enabled: allowed && !!activeBranchId,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
  const incoming = query.data?.items.filter((t) => t.toBranchId === activeBranchId) ?? [];
  return { count: incoming.length, incoming, query };
}
