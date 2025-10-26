'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { AlertCircle, User, MapPin, Calendar, FileText, CheckCircle, XCircle, FileDown } from 'lucide-react';
import { format } from 'date-fns';

interface OrderDetailsProps {
  orderId: string;
  userRole: string;
}

export function OrderDetails({ orderId, userRole }: OrderDetailsProps) {
  const { toast } = useToast();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [generatingAuth, setGeneratingAuth] = useState(false);
  const [uploadingConcentraAuth, setUploadingConcentraAuth] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [markingAuthCreated, setMarkingAuthCreated] = useState(false);

  useEffect(() => {
    async function fetchOrder() {
      try {
        const response = await fetch(`/api/orders/${orderId}`);
        if (response.ok) {
          const data = await response.json();
          setOrder(data.order);
        } else {
          setError('Order not found');
        }
      } catch (err) {
        setError('Failed to load order');
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();
  }, [orderId]);

  const handleDownload = async (documentId: string, filename: string) => {
    try {
      const response = await fetch(`/api/files/${documentId}`);
      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }

      const { url } = await response.json();
      window.open(url, '_blank');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download file',
        variant: 'destructive',
      });
    }
  };

  const handleGenerateConcentraAuth = async () => {
    setGeneratingAuth(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/concentra/summary`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate authorization PDF');
      }

      const data = await response.json();

      toast({
        title: 'Authorization Generated',
        description: data.message,
      });

      // Refresh order to show new document
      const orderResponse = await fetch(`/api/orders/${orderId}`);
      if (orderResponse.ok) {
        const orderData = await orderResponse.json();
        setOrder(orderData.order);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate authorization PDF',
        variant: 'destructive',
      });
    } finally {
      setGeneratingAuth(false);
    }
  };

  const handleGenerateCustomAuth = async () => {
    setGeneratingAuth(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/generate-auth-form`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate authorization form');
      }

      const data = await response.json();

      toast({
        title: 'Authorization Form Sent',
        description: data.message || 'Authorization form has been emailed to all recipients and the expiration timer has been started.',
      });

      // Refresh order to show updated status and timer
      const orderResponse = await fetch(`/api/orders/${orderId}`);
      if (orderResponse.ok) {
        const orderData = await orderResponse.json();
        setOrder(orderData.order);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate authorization form',
        variant: 'destructive',
      });
    } finally {
      setGeneratingAuth(false);
    }
  };

  const handleUploadConcentraAuth = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/pdf') {
      toast({
        title: 'Invalid File',
        description: 'Please upload a PDF file',
        variant: 'destructive',
      });
      return;
    }

    setUploadingConcentraAuth(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/orders/${orderId}/upload-concentra-auth`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload authorization form');
      }

      const data = await response.json();

      toast({
        title: 'Authorization Form Uploaded',
        description: data.message || 'Concentra authorization form has been uploaded, emailed to all recipients, and the expiration timer has been started.',
      });

      // Refresh order to show updated status and timer
      const orderResponse = await fetch(`/api/orders/${orderId}`);
      if (orderResponse.ok) {
        const orderData = await orderResponse.json();
        setOrder(orderData.order);
      }

      // Clear the file input
      event.target.value = '';
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload authorization form',
        variant: 'destructive',
      });
    } finally {
      setUploadingConcentraAuth(false);
    }
  };

  const handleReview = async (action: 'approved' | 'rejected') => {
    if (action === 'rejected' && !feedback.trim()) {
      toast({
        title: 'Feedback Required',
        description: 'Please provide feedback explaining why you are rejecting these results',
        variant: 'destructive',
      });
      return;
    }

    setReviewing(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          feedback: feedback.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit review');
      }

      toast({
        title: action === 'approved' ? 'Results Approved' : 'Results Rejected',
        description: action === 'approved'
          ? 'The results have been approved and the order is now complete'
          : 'The provider has been notified and will upload corrected results',
      });

      // Refresh order data
      const orderResponse = await fetch(`/api/orders/${orderId}`);
      if (orderResponse.ok) {
        const data = await orderResponse.json();
        setOrder(data.order);
      }

      setFeedback('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit review',
        variant: 'destructive',
      });
    } finally {
      setReviewing(false);
    }
  };

  const handleCancelOrder = async () => {
    setCanceling(true);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel order');
      }

      toast({
        title: 'Order Cancelled',
        description: 'The order has been cancelled successfully',
      });

      // Refresh order data
      const orderResponse = await fetch(`/api/orders/${orderId}`);
      if (orderResponse.ok) {
        const data = await orderResponse.json();
        setOrder(data.order);
      }

      setShowCancelConfirm(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel order',
        variant: 'destructive',
      });
    } finally {
      setCanceling(false);
    }
  };

  const handleMarkAuthCreated = async () => {
    setMarkingAuthCreated(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/auth-created`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to mark authorization as created');
      }

      const data = await response.json();

      toast({
        title: 'Authorization Timer Started',
        description: `Expiration countdown started. Authorization expires in ${data.expiresInDays} days.`,
      });

      // Refresh order data
      const orderResponse = await fetch(`/api/orders/${orderId}`);
      if (orderResponse.ok) {
        const orderData = await orderResponse.json();
        setOrder(orderData.order);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start authorization timer',
        variant: 'destructive',
      });
    } finally {
      setMarkingAuthCreated(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Order Not Found"
        description={error || 'The order you are looking for does not exist'}
      />
    );
  }

  const isProvider = userRole.startsWith('provider');
  const isEmployerAdmin = userRole === 'employer_admin';
  const canCancel = (isEmployerAdmin || isProvider) && order.status !== 'complete' && order.status !== 'cancelled';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
          <p className="text-gray-500 mt-1">
            Created {format(new Date(order.createdAt), 'PPP')} at {format(new Date(order.createdAt), 'p')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} />
          {canCancel && (
            <Button
              onClick={() => setShowCancelConfirm(true)}
              variant="destructive"
              size="sm"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel Order
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Candidate Information */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Candidate Information</h2>
          </div>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500">Name</dt>
              <dd className="font-medium">
                {order.candidate.firstName} {order.candidate.lastName}
              </dd>
            </div>
            {order.candidate.dob && (
              <div>
                <dt className="text-sm text-gray-500">Date of Birth</dt>
                <dd className="font-medium">{order.candidate.dob}</dd>
              </div>
            )}
            {order.candidate.ssnLast4 && (
              <div>
                <dt className="text-sm text-gray-500">SSN Last 4</dt>
                <dd className="font-medium">{order.candidate.ssnLast4}</dd>
              </div>
            )}
            {order.candidate.email && (
              <div>
                <dt className="text-sm text-gray-500">Email</dt>
                <dd className="font-medium">{order.candidate.email}</dd>
              </div>
            )}
            {order.candidate.phone && (
              <div>
                <dt className="text-sm text-gray-500">Phone</dt>
                <dd className="font-medium">{order.candidate.phone}</dd>
              </div>
            )}
            {order.candidate.address && (
              <div>
                <dt className="text-sm text-gray-500">Address</dt>
                <dd className="font-medium">
                  {order.candidate.address}
                  {order.candidate.city && `, ${order.candidate.city}`}
                  {order.candidate.state && `, ${order.candidate.state}`}
                  {order.candidate.zip && ` ${order.candidate.zip}`}
                </dd>
              </div>
            )}
          </dl>
        </Card>

        {/* Order Details */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Order Details</h2>
          </div>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500">Test Type</dt>
              <dd className="font-medium">{order.testType}</dd>
            </div>
            {order.urgency && (
              <div>
                <dt className="text-sm text-gray-500">Urgency</dt>
                <dd className="font-medium capitalize">{order.urgency}</dd>
              </div>
            )}
            {order.jobsiteLocation && (
              <div>
                <dt className="text-sm text-gray-500">Jobsite Location</dt>
                <dd className="font-medium">{order.jobsiteLocation}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-gray-500">Needs Mask</dt>
              <dd className="font-medium">{order.needsMask ? 'Yes' : 'No'}</dd>
            </div>
            {order.needsMask && order.maskSize && (
              <div>
                <dt className="text-sm text-gray-500">Mask Size</dt>
                <dd className="font-medium">{order.maskSize}</dd>
              </div>
            )}
            {isProvider && order.organization && (
              <div>
                <dt className="text-sm text-gray-500">Employer</dt>
                <dd className="font-medium">{order.organization.name}</dd>
              </div>
            )}
            {order.requestedByUser && (
              <div>
                <dt className="text-sm text-gray-500">Requested By</dt>
                <dd className="font-medium">{order.requestedByUser.name || order.requestedByUser.email}</dd>
              </div>
            )}
            {order.notes && (
              <div>
                <dt className="text-sm text-gray-500">Notes</dt>
                <dd className="font-medium">{order.notes}</dd>
              </div>
            )}
            {order.authCreatedAt && order.authExpiresAt && (
              <div className="pt-2 border-t">
                <dt className="text-sm text-gray-500">Authorization Status</dt>
                <dd className="font-medium text-sm mt-1">
                  <p>
                    Created: {format(new Date(order.authCreatedAt), 'PPp')}
                    {order.autoTimerStarted && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Auto</span>
                    )}
                  </p>
                  <p>Expires: {format(new Date(order.authExpiresAt), 'PPp')}</p>
                  {order.authNumber && (
                    <p className="text-gray-600">Auth #: {order.authNumber}</p>
                  )}
                  {new Date(order.authExpiresAt) > new Date() ? (
                    <p className="text-green-600 font-semibold mt-1">
                      ✓ Active ({Math.ceil((new Date(order.authExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining)
                    </p>
                  ) : (
                    <p className="text-red-600 font-semibold mt-1">
                      ⚠ Expired
                    </p>
                  )}
                </dd>
              </div>
            )}
          </dl>
        </Card>
      </div>

      {/* Appointment Information */}
      {order.appointments && order.appointments.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Appointment</h2>
          </div>
          {order.appointments.map((appointment: any) => (
            <div key={appointment.id} className="space-y-2">
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm text-gray-500">Site</dt>
                  <dd className="font-medium">{appointment.site.name}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Address</dt>
                  <dd className="font-medium">
                    {appointment.site.address}, {appointment.site.city},{' '}
                    {appointment.site.state} {appointment.site.zip}
                  </dd>
                </div>
                {appointment.site.phone && (
                  <div>
                    <dt className="text-sm text-gray-500">Phone</dt>
                    <dd className="font-medium">{appointment.site.phone}</dd>
                  </div>
                )}
                {appointment.startTime && (
                  <div>
                    <dt className="text-sm text-gray-500">Scheduled Time</dt>
                    <dd className="font-medium">
                      {format(new Date(appointment.startTime), 'PPpp')}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm text-gray-500">Status</dt>
                  <dd className="font-medium capitalize">{appointment.status}</dd>
                </div>
              </dl>
            </div>
          ))}
        </Card>
      )}

      {/* Documents */}
      {order.documents && order.documents.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Documents</h2>
          <div className="space-y-2">
            {order.documents.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="font-medium">{doc.fileName}</p>
                  <p className="text-sm text-gray-500 capitalize">{doc.kind}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownload(doc.id, doc.fileName)}
                >
                  Download
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Provider: Generate Authorization */}
      {isProvider && order.status !== 'complete' && order.status !== 'cancelled' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Authorization</h2>
            {order.authorizationMethod && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                {order.authorizationMethod === 'concentra' ? 'Concentra Network' : 'Custom Location'}
              </span>
            )}
          </div>

          {/* Provider Override: Switch Authorization Method */}
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-amber-900 mb-1">
                  {order.useConcentra ? 'Using Concentra Network' : 'Using Custom Authorization'}
                </h3>
                <p className="text-sm text-amber-700">
                  {order.useConcentra ? (
                    <>Distance too far or employee complained? Switch to custom authorization to allow any testing location.</>
                  ) : (
                    <>Switched to custom authorization. Candidate can choose any testing location.</>
                  )}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="ml-4"
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/orders/${orderId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        useConcentra: !order.useConcentra,
                      }),
                    });

                    if (response.ok) {
                      const data = await response.json();
                      setOrder(data.order);
                      toast({
                        title: 'Authorization Method Updated',
                        description: `Switched to ${!order.useConcentra ? 'Concentra' : 'Custom'} authorization`,
                      });
                    } else {
                      throw new Error('Failed to update');
                    }
                  } catch (error) {
                    toast({
                      title: 'Error',
                      description: 'Failed to update authorization method',
                      variant: 'destructive',
                    });
                  }
                }}
              >
                Switch to {order.useConcentra ? 'Custom' : 'Concentra'}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Different flows based on useConcentra */}
            {order.useConcentra ? (
              // Concentra Flow
              <>
                {/* Step 1: Upload Concentra Authorization Form */}
                <div className="flex items-start justify-between pb-4 border-b">
                  <div className="flex-1">
                    <h3 className="font-medium mb-1">1. Upload Concentra Authorization Form</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      After creating the authorization in Concentra Hub, upload the PDF here. It will be automatically emailed to all recipients and the expiration timer will start.
                    </p>
                    {order.authorizationMethod === 'concentra' && order.authorizationFormSentAt && (
                      <p className="text-sm text-green-600 font-medium">
                        ✓ Last uploaded: {format(new Date(order.authorizationFormSentAt), 'PPp')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handleUploadConcentraAuth}
                      disabled={uploadingConcentraAuth}
                      className="hidden"
                      id="concentra-auth-upload"
                    />
                    <Button
                      onClick={() => document.getElementById('concentra-auth-upload')?.click()}
                      disabled={uploadingConcentraAuth}
                      variant={order.authorizationMethod === 'concentra' ? 'outline' : 'default'}
                    >
                      <FileDown className="mr-2 h-4 w-4" />
                      {uploadingConcentraAuth ? 'Uploading...' : order.authorizationMethod === 'concentra' ? 'Reupload Form' : 'Upload Form'}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              // Custom Flow
              <>
                {/* Generate and Send Custom Authorization Form */}
                <div className="flex items-start justify-between pb-4 border-b">
                  <div className="flex-1">
                    <h3 className="font-medium mb-1">1. Send Authorization Form</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      Generates a pre-filled PDF authorization form and emails it to the candidate and designated recipients. Timer starts automatically.
                    </p>
                    {order.authorizationMethod === 'custom' && order.authorizationFormSentAt && (
                      <p className="text-sm text-green-600 font-medium">
                        ✓ Last sent: {format(new Date(order.authorizationFormSentAt), 'PPp')}
                      </p>
                    )}
                    {order.authorizationMethod === 'custom' && !order.authorizationFormSentAt && (
                      <p className="text-sm text-green-600 font-medium">
                        ✓ Authorization form has been generated
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleGenerateCustomAuth}
                    disabled={generatingAuth}
                    variant={order.authorizationMethod === 'custom' ? 'outline' : 'default'}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    {generatingAuth ? 'Sending...' : order.authorizationMethod === 'custom' ? 'Resend Form' : 'Send Form'}
                  </Button>
                </div>
              </>
            )}

            {/* Step 2: Authorization Timer Status */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium mb-1">2. Authorization Timer</h3>
                <p className="text-sm text-gray-600 mb-2">
                  {!order.authCreatedAt ? (
                    order.useConcentra ? (
                      <>Timer will automatically start when you upload the Concentra authorization form above</>
                    ) : (
                      <>Timer automatically started when authorization form was generated</>
                    )
                  ) : (
                    'Authorization timer has been started'
                  )}
                </p>
                {order.authCreatedAt && order.authExpiresAt && (
                  <div className="text-sm">
                    <p className="text-gray-600">
                      <span className="font-medium">Created:</span> {format(new Date(order.authCreatedAt), 'PPp')}
                      {order.useConcentra && order.authorizationMethod === 'concentra' && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          Auto-started when form uploaded
                        </span>
                      )}
                      {!order.useConcentra && order.authorizationMethod === 'custom' && (
                        <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          Auto-started when form generated
                        </span>
                      )}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-medium">Expires:</span> {format(new Date(order.authExpiresAt), 'PPp')}
                    </p>
                    {order.authNumber && (
                      <p className="text-gray-600">
                        <span className="font-medium">Auth #:</span> {order.authNumber}
                      </p>
                    )}
                    {new Date(order.authExpiresAt) > new Date() ? (
                      <p className="text-green-600 font-medium mt-1">
                        ✓ Authorization active ({Math.ceil((new Date(order.authExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining)
                      </p>
                    ) : (
                      <p className="text-red-600 font-medium mt-1">
                        ⚠ Authorization expired
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Employer Review Section */}
      {!isProvider && order.status === 'pending_review' && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Review Results</h2>
          <p className="text-sm text-gray-600 mb-4">
            Please review the uploaded results and either approve them to complete the order, or reject them with feedback for the provider to make corrections.
          </p>

          <div className="space-y-4">
            <div>
              <Label htmlFor="feedback">Feedback (Required for rejection)</Label>
              <Textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Provide feedback about the results (required if rejecting)"
                rows={4}
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => handleReview('approved')}
                disabled={reviewing}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {reviewing ? 'Processing...' : 'Approve Results'}
              </Button>

              <Button
                onClick={() => handleReview('rejected')}
                disabled={reviewing}
                variant="destructive"
                className="flex-1"
              >
                <XCircle className="mr-2 h-4 w-4" />
                {reviewing ? 'Processing...' : 'Reject & Request Correction'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Cancel Order Confirmation Dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-2">Cancel Order?</h2>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to cancel this order? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={handleCancelOrder}
                disabled={canceling}
                variant="destructive"
                className="flex-1"
              >
                {canceling ? 'Canceling...' : 'Yes, Cancel Order'}
              </Button>
              <Button
                onClick={() => setShowCancelConfirm(false)}
                disabled={canceling}
                variant="outline"
                className="flex-1"
              >
                No, Keep Order
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
