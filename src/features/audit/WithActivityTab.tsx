'use client';

import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { usePermission } from '@/hooks/useSessionInfo';
import { ActivityTimeline } from './ActivityTimeline';

/** Puts a detail page's content under a "Details" tab beside an "Activity" tab. Without AuditLog.View the content shows as-is. */
export function WithActivityTab({ entityType, entityId, children }: { entityType: string; entityId: string; children: ReactNode }) {
  const allowed = usePermission('AuditLog.View');
  if (!allowed) return <>{children}</>;
  return (
    <Tabs defaultValue="details">
      <TabsList className="mb-1">
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>
      <TabsContent value="details">{children}</TabsContent>
      <TabsContent value="activity">
        <Card><CardContent className="pt-4"><ActivityTimeline entityType={entityType} entityId={entityId} /></CardContent></Card>
      </TabsContent>
    </Tabs>
  );
}
