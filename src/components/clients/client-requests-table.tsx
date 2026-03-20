'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface ServiceRequest {
  id: string;
  donorFirstName: string;
  donorLastName: string;
  serviceType: string;
  isDOT: boolean;
  priority: string | null;
  status: string;
  convertedOrderId: string | null;
  declineReason: string | null;
  createdAt: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  submitted: { label: 'Submitted', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  accepted: { label: 'Accepted', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  declined: { label: 'Declined', className: 'bg-red-100 text-red-800 border-red-200' },
  converted: { label: 'Converted', className: 'bg-green-100 text-green-800 border-green-200' },
};

export function ClientRequestsTable() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRequests() {
      try {
        const res = await fetch('/api/service-requests');
        const data = await res.json();
        if (data.serviceRequests) {
          setRequests(data.serviceRequests);
        }
      } catch (error) {
        console.error('Failed to fetch service requests:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchRequests();
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">Loading requests...</p>
      </Card>
    );
  }

  if (requests.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">No service requests yet.</p>
        <Link
          href="/client-portal/request"
          className="text-primary hover:underline text-sm mt-2 inline-block"
        >
          Submit your first request
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Submitted</th>
              <th className="text-left p-3 font-medium">Donor Name</th>
              <th className="text-left p-3 font-medium">Service Type</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Order</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => {
              const statusInfo = statusConfig[req.status] || statusConfig.submitted;
              return (
                <tr key={req.id} className="border-b hover:bg-muted/30">
                  <td className="p-3">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    {req.donorFirstName} {req.donorLastName}
                  </td>
                  <td className="p-3">
                    <span>{req.serviceType}</span>
                    {req.isDOT && (
                      <Badge variant="outline" className="ml-2 text-xs">DOT</Badge>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge className={statusInfo.className}>
                      {statusInfo.label}
                    </Badge>
                    {req.status === 'declined' && req.declineReason && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {req.declineReason}
                      </p>
                    )}
                  </td>
                  <td className="p-3">
                    {req.convertedOrderId ? (
                      <Link
                        href={`/client-portal/orders`}
                        className="text-primary hover:underline text-sm"
                      >
                        View Order
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
