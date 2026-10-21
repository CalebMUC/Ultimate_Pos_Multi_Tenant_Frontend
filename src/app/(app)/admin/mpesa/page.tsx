'use client';

import Link from 'next/link';
import { CheckCircle2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { DetailList, PageHeader } from '@/components/shared/Display';
import { mpesaApi } from '@/api/endpoints/sales';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useActiveBusiness } from '@/hooks/useSessionInfo';

function MpesaSetup() {
  const { business } = useActiveBusiness();
  const register = useApiMutation(() => mpesaApi.registerC2bUrls(), { success: (r) => (r.registered ? 'Till confirmation URLs registered with Safaricom' : 'Safaricom did not accept the registration') });
  const shortCode = business?.mpesaShortCode;
  return (
    <>
      <PageHeader title="M-Pesa setup" description="Connect the business till so customer payments appear in Ultimate POS." />
      <div className="grid max-w-3xl gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Smartphone className="size-5 text-success" />Till number</CardTitle>
            <CardDescription>Payments to this till or paybill are routed to this business.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailList
              items={[
                ...(business?.mpesaTillNumber !== undefined ? [{ label: 'Till', value: business.mpesaTillNumber ?? 'Not set' }] : []),
                ...(business?.mpesaPaybillNumber !== undefined ? [{ label: 'Paybill', value: business.mpesaPaybillNumber ?? 'Not set' }] : []),
                { label: 'Routes payments by', value: shortCode ?? 'Not set' },
                { label: 'Business', value: business?.tradingName || business?.businessName },
              ]}
            />
            <Button variant="outline" size="sm" asChild><Link href="/admin/business">Change in business profile</Link></Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Register confirmation URLs</CardTitle>
            <CardDescription>Tells Safaricom where to send till (C2B) payment notifications. Do this once after setting the short code, and again if it changes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!shortCode && <Alert variant="warning"><AlertDescription>Set the short code in the business profile first.</AlertDescription></Alert>}
            {register.data?.registered && <Alert variant="success"><CheckCircle2 /><AlertTitle>Registered</AlertTitle><AlertDescription>New till payments will show under M-Pesa Payments.</AlertDescription></Alert>}
            <Button disabled={!shortCode} loading={register.isPending} onClick={() => register.mutate(undefined)}>Register URLs</Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Mpesa.Configure"><MpesaSetup /></PermissionRoute>;
}
