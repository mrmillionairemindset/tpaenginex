'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

interface ServiceRequest {
  id: string;
  donorFirstName: string;
  donorLastName: string;
  donorEmail: string | null;
  donorPhone: string | null;
  serviceType: string;
  isDOT: boolean;
  priority: string | null;
  location: string;
  requestedDate: string | null;
  notes: string | null;
  status: string;
  declineReason: string | null;
  convertedOrderId: string | null;
  createdAt: string;
  submitter: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  clientOrg: {
    id: string;
    name: string;
  } | null;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  submitted: { label: 'Submitted', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  accepted: { label: 'Accepted', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  declined: { label: 'Declined', className: 'bg-red-100 text-red-800 border-red-200' },
  converted: { label: 'Converted', className: 'bg-green-100 text-green-800 border-green-200' },
};

export function ServiceRequestsTable() {
  const router = useRouter();
  const { toast } = useToast();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const fetchRequests = async () => {
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
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleConvert = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/service-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'converted' }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: 'Error',
          description: data.error || 'Failed to convert request',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Order Created',
        description: `Service request converted to order ${data.orderNumber}`,
      });

      // Refresh the list
      await fetchRequests();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (id: string) => {
    if (!declineReason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a reason for declining',
        variant: 'destructive',
      });
      return;
    }

    setActionLoading(id);
    try {
      const res = await fetch(`/api/service-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'declined', declineReason: declineReason.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: 'Error',
          description: data.error || 'Failed to decline request',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Request Declined',
        description: 'The service request has been declined.',
      });

      setDeclineId(null);
      setDeclineReason('');
      await fetchRequests();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">Loading service requests...</p>
      </Card>
    );
  }

  if (requests.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">No service requests found.</p>
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
              <th className="text-left p-3 font-medium">Client</th>
              <th className="text-left p-3 font-medium">Donor Name</th>
              <th className="text-left p-3 font-medium">Service Type</th>
              <th className="text-left p-3 font-medium">DOT</th>
              <th className="text-left p-3 font-medium">Priority</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => {
              const statusInfo = statusConfig[req.status] || statusConfig.submitted;
              const isPending = req.status === 'submitted' || req.status === 'accepted';

              return (
                <tr key={req.id} className="border-b hover:bg-muted/30">
                  <td className="p-3">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    {req.clientOrg?.name || '--'}
                  </td>
                  <td className="p-3">
                    {req.donorFirstName} {req.donorLastName}
                  </td>
                  <td className="p-3">{req.serviceType}</td>
                  <td className="p-3">
                    {req.isDOT ? (
                      <Badge variant="outline" className="text-xs">DOT</Badge>
                    ) : (
                      <span className="text-muted-foreground">Non-DOT</span>
                    )}
                  </td>
                  <td className="p-3">
                    {req.priority === 'urgent' ? (
                      <Badge className="bg-red-100 text-red-800 border-red-200">Urgent</Badge>
                    ) : (
                      <span className="text-muted-foreground">Standard</span>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge className={statusInfo.className}>
                      {statusInfo.label}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {isPending && (
                      <div className="flex items-center gap-2">
                        {declineId === req.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={declineReason}
                              onChange={(e) => setDeclineReason(e.target.value)}
                              placeholder="Reason for declining..."
                              className="h-8 text-xs w-48"
                            />
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDecline(req.id)}
                              disabled={actionLoading === req.id}
                              className="h-8 text-xs"
                            >
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setDeclineId(null); setDeclineReason(''); }}
                              className="h-8 text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleConvert(req.id)}
                              disabled={actionLoading === req.id}
                              className="h-8 text-xs"
                            >
                              {actionLoading === req.id ? 'Creating...' : 'Accept & Create Order'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeclineId(req.id)}
                              disabled={actionLoading === req.id}
                              className="h-8 text-xs"
                            >
                              Decline
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                    {req.status === 'converted' && req.convertedOrderId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/orders/${req.convertedOrderId}`)}
                        className="h-8 text-xs"
                      >
                        View Order
                      </Button>
                    )}
                    {req.status === 'declined' && (
                      <span className="text-xs text-muted-foreground">
                        {req.declineReason}
                      </span>
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
