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
import { AlertCircle, User, FileText, CheckCircle, XCircle, UserCheck, ClipboardCheck, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [checklist, setChecklist] = useState<any[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(true);
  const [togglingItem, setTogglingItem] = useState<string | null>(null);
  const [ccfNumber, setCcfNumber] = useState('');
  const [savingCcf, setSavingCcf] = useState(false);
  const [ccfOverrideMode, setCcfOverrideMode] = useState(false);
  const [ccfAuditReason, setCcfAuditReason] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

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

  useEffect(() => {
    async function fetchChecklist() {
      try {
        const response = await fetch(`/api/orders/${orderId}/checklist`);
        if (response.ok) {
          const data = await response.json();
          setChecklist(data.checklist);
        }
      } catch (err) {
        // Checklist may not exist for older orders
      } finally {
        setChecklistLoading(false);
      }
    }

    fetchChecklist();
  }, [orderId]);

  const ORDER_STATUSES = [
    { value: 'new', label: 'New' },
    { value: 'needs_site', label: 'Needs Site' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'results_uploaded', label: 'Results Uploaded' },
    { value: 'pending_review', label: 'Pending Review' },
    { value: 'needs_correction', label: 'Needs Correction' },
    { value: 'complete', label: 'Complete' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === order?.status) return;
    setUpdatingStatus(true);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        const data = await response.json();
        setOrder(data.order);
        toast({ title: 'Status Updated', description: `Order moved to ${ORDER_STATUSES.find(s => s.value === newStatus)?.label}` });
      } else {
        const err = await response.json();
        toast({ title: 'Error', description: err.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const startEditing = () => {
    setEditForm({
      testType: order.testType || '',
      serviceType: order.serviceType || 'drug_screen',
      isDOT: order.isDOT || false,
      priority: order.priority || 'standard',
      urgency: order.urgency || 'standard',
      jobsiteLocation: order.jobsiteLocation || '',
      notes: order.notes || '',
      internalNotes: order.internalNotes || '',
      needsMask: order.needsMask || false,
      maskSize: order.maskSize || '',
      candidateFirstName: order.candidate?.firstName || '',
      candidateLastName: order.candidate?.lastName || '',
      candidateEmail: order.candidate?.email || '',
      candidatePhone: order.candidate?.phone || '',
    });
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      // Update order fields
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testType: editForm.testType,
          serviceType: editForm.serviceType,
          isDOT: editForm.isDOT,
          priority: editForm.priority,
          urgency: editForm.urgency,
          jobsiteLocation: editForm.jobsiteLocation,
          notes: editForm.notes,
          internalNotes: editForm.internalNotes,
          needsMask: editForm.needsMask,
          maskSize: editForm.maskSize,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        setEditing(false);
        toast({ title: 'Order Updated' });
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save changes', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleChecklist = async (checklistItemId: string, isCompleted: boolean) => {
    setTogglingItem(checklistItemId);
    try {
      const response = await fetch(`/api/orders/${orderId}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklistItemId, isCompleted }),
      });

      if (response.ok) {
        const data = await response.json();
        setChecklist((prev) =>
          prev.map((item) =>
            item.id === checklistItemId ? data.item : item
          )
        );
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to update checklist item',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update checklist item',
        variant: 'destructive',
      });
    } finally {
      setTogglingItem(null);
    }
  };

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
          : 'The TPA has been notified and will upload corrected results',
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

  const isTpaUser = userRole.startsWith('tpa_') || userRole === 'platform_admin';
  const isClientAdmin = userRole === 'client_admin';
  const canCancel = (isClientAdmin || isTpaUser) && order.status !== 'complete' && order.status !== 'cancelled';
  const canDelete = (userRole === 'tpa_admin') || (userRole === 'tpa_staff' && order.status === 'new');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
          <p className="text-muted-foreground mt-1">
            Created {format(new Date(order.createdAt), 'PPP')} at {format(new Date(order.createdAt), 'p')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {order.isDOT && (
            <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded">DOT</span>
          )}
          {order.priority === 'urgent' && (
            <span className="text-xs font-semibold bg-red-100 text-red-800 px-2 py-1 rounded">URGENT</span>
          )}
          {isTpaUser ? (
            <select
              className="h-8 rounded-md border border-input bg-background px-2 py-1 text-sm font-medium ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={order.status}
              disabled={updatingStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          ) : (
            <StatusBadge status={order.status} />
          )}
          {isTpaUser && !editing && order.status !== 'cancelled' && (
            <Button onClick={startEditing} variant="outline" size="sm">
              <Pencil className="mr-2 h-4 w-4" />
              Edit Order
            </Button>
          )}
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
          {canDelete && (
            <Button
              onClick={() => setShowDeleteConfirm(true)}
              variant="outline"
              size="sm"
              className="border-destructive text-destructive hover:bg-destructive/10"
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Candidate Information */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Candidate Information</h2>
          </div>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-muted-foreground">Name</dt>
              <dd className="font-medium">
                {order.candidate.firstName} {order.candidate.lastName}
              </dd>
            </div>
            {order.candidate.dob && (
              <div>
                <dt className="text-sm text-muted-foreground">Date of Birth</dt>
                <dd className="font-medium">{order.candidate.dob}</dd>
              </div>
            )}
            {order.candidate.ssnLast4 && (
              <div>
                <dt className="text-sm text-muted-foreground">SSN Last 4</dt>
                <dd className="font-medium">{order.candidate.ssnLast4}</dd>
              </div>
            )}
            {order.candidate.email && (
              <div>
                <dt className="text-sm text-muted-foreground">Email</dt>
                <dd className="font-medium">{order.candidate.email}</dd>
              </div>
            )}
            {order.candidate.phone && (
              <div>
                <dt className="text-sm text-muted-foreground">Phone</dt>
                <dd className="font-medium">{order.candidate.phone}</dd>
              </div>
            )}
            {order.candidate.address && (
              <div>
                <dt className="text-sm text-muted-foreground">Address</dt>
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
            <FileText className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Order Details</h2>
          </div>

          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Test Type</label>
                <Input
                  value={editForm.testType}
                  onChange={(e) => setEditForm({ ...editForm, testType: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Service Type</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editForm.serviceType}
                  onChange={(e) => setEditForm({ ...editForm, serviceType: e.target.value })}
                >
                  <option value="pre_employment">Pre-Employment</option>
                  <option value="random">Random</option>
                  <option value="post_accident">Post-Accident</option>
                  <option value="reasonable_suspicion">Reasonable Suspicion</option>
                  <option value="physical">Physical</option>
                  <option value="drug_screen">Drug Screen</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Priority</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                  >
                    <option value="standard">Standard</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="editIsDOT"
                    checked={editForm.isDOT}
                    onChange={(e) => setEditForm({ ...editForm, isDOT: e.target.checked })}
                    className="h-4 w-4 rounded border-input"
                  />
                  <label htmlFor="editIsDOT" className="text-sm">DOT Test</label>
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Collection Location</label>
                <Input
                  value={editForm.jobsiteLocation}
                  onChange={(e) => setEditForm({ ...editForm, jobsiteLocation: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Needs Mask</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editForm.needsMask ? 'yes' : 'no'}
                    onChange={(e) => setEditForm({ ...editForm, needsMask: e.target.value === 'yes', maskSize: e.target.value === 'no' ? '' : editForm.maskSize })}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
                {editForm.needsMask && (
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">Mask Size</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={editForm.maskSize}
                      onChange={(e) => setEditForm({ ...editForm, maskSize: e.target.value })}
                    >
                      <option value="">Select size...</option>
                      <option value="Small">Small</option>
                      <option value="Medium">Medium</option>
                      <option value="Large">Large</option>
                      <option value="X-Large">X-Large</option>
                      <option value="Unknown">Unknown</option>
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Notes</label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={2}
                />
              </div>
              {isTpaUser && (
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Internal Notes</label>
                  <Textarea
                    value={editForm.internalNotes}
                    onChange={(e) => setEditForm({ ...editForm, internalNotes: e.target.value })}
                    rows={2}
                    placeholder="Internal notes (not visible to clients)"
                  />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSaveEdit} disabled={saving} size="sm">
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button onClick={() => setEditing(false)} variant="outline" size="sm">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-muted-foreground">Service Type</dt>
              <dd className="font-medium capitalize">{order.serviceType?.replace(/_/g, ' ') || order.testType}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Test Type</dt>
              <dd className="font-medium">{order.testType}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">DOT Status</dt>
              <dd className="font-medium">{order.isDOT ? 'DOT' : 'Non-DOT'}</dd>
            </div>
            {order.priority && (
              <div>
                <dt className="text-sm text-muted-foreground">Priority</dt>
                <dd className="font-medium capitalize">{order.priority}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-muted-foreground">CCF #</dt>
              {(() => {
                const canEdit = isTpaUser && !order.ccfNumber && order.status !== 'new' && order.status !== 'needs_site' && order.status !== 'cancelled';
                const isAdmin = userRole === 'tpa_admin' || userRole === 'platform_admin';
                const canAdminOverride = isTpaUser && order.ccfNumber && isAdmin;

                if (canEdit) {
                  // First entry — staff can set CCF once
                  return (
                    <dd className="flex items-center gap-2 mt-1">
                      <input
                        type="text"
                        value={ccfNumber}
                        onChange={(e) => setCcfNumber(e.target.value)}
                        placeholder="Enter CCF number..."
                        className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        onClick={async () => {
                          if (!ccfNumber.trim()) return;
                          setSavingCcf(true);
                          try {
                            const res = await fetch(`/api/orders/${orderId}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ ccfNumber: ccfNumber.trim() }),
                            });
                            if (res.ok) {
                              const data = await res.json();
                              setOrder(data.order);
                              setCcfNumber('');
                              toast({ title: 'CCF # Saved', description: `Chain of Custody number recorded` });
                            }
                          } catch (err) {
                            toast({ title: 'Error', description: 'Failed to save CCF number', variant: 'destructive' });
                          } finally {
                            setSavingCcf(false);
                          }
                        }}
                        disabled={savingCcf || !ccfNumber.trim()}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {savingCcf ? 'Saving...' : 'Save'}
                      </button>
                    </dd>
                  );
                } else if (order.ccfNumber) {
                  // Locked — show value with admin override option
                  return (
                    <dd>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{order.ccfNumber}</span>
                        <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded">Locked</span>
                      </div>
                      {canAdminOverride && !ccfOverrideMode && (
                        <button
                          onClick={() => {
                            setCcfOverrideMode(true);
                            setCcfNumber(order.ccfNumber);
                            setCcfAuditReason('');
                          }}
                          className="mt-1 text-xs text-muted-foreground hover:text-foreground underline"
                        >
                          Admin: Correct CCF #
                        </button>
                      )}
                      {ccfOverrideMode && (
                        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                          <p className="text-xs font-semibold text-destructive">CCF Override — This change will be logged in the audit trail</p>
                          <div>
                            <label className="block text-xs font-medium text-foreground mb-1">New CCF #</label>
                            <input
                              type="text"
                              value={ccfNumber}
                              onChange={(e) => setCcfNumber(e.target.value)}
                              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-foreground mb-1">Reason for change <span className="text-red-500">*</span></label>
                            <textarea
                              value={ccfAuditReason}
                              onChange={(e) => setCcfAuditReason(e.target.value)}
                              placeholder="e.g., Incorrect number entered by collector, corrected per lab confirmation..."
                              rows={2}
                              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                if (!ccfNumber.trim() || !ccfAuditReason.trim()) {
                                  toast({ title: 'Required', description: 'Both new CCF # and reason are required', variant: 'destructive' });
                                  return;
                                }
                                setSavingCcf(true);
                                try {
                                  const res = await fetch(`/api/orders/${orderId}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      ccfNumber: ccfNumber.trim(),
                                      ccfAuditReason: ccfAuditReason.trim(),
                                    }),
                                  });
                                  if (res.ok) {
                                    const data = await res.json();
                                    setOrder(data.order);
                                    setCcfOverrideMode(false);
                                    setCcfNumber('');
                                    setCcfAuditReason('');
                                    toast({ title: 'CCF # Updated', description: 'Change has been recorded in the audit trail' });
                                  } else {
                                    const err = await res.json();
                                    toast({ title: 'Error', description: err.error, variant: 'destructive' });
                                  }
                                } catch (err) {
                                  toast({ title: 'Error', description: 'Failed to update CCF number', variant: 'destructive' });
                                } finally {
                                  setSavingCcf(false);
                                }
                              }}
                              disabled={savingCcf || !ccfAuditReason.trim() || !ccfNumber.trim()}
                              className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                            >
                              {savingCcf ? 'Saving...' : 'Confirm Override'}
                            </button>
                            <button
                              onClick={() => {
                                setCcfOverrideMode(false);
                                setCcfNumber('');
                                setCcfAuditReason('');
                              }}
                              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </dd>
                  );
                } else {
                  return <dd className="font-medium"><span className="text-muted-foreground">Not yet assigned</span></dd>;
                }
              })()}
            </div>
            {order.resultStatus && (
              <div>
                <dt className="text-sm text-muted-foreground">Result Status</dt>
                <dd className="font-medium capitalize">{order.resultStatus}</dd>
              </div>
            )}
            {order.jobsiteLocation && (
              <div>
                <dt className="text-sm text-muted-foreground">Collection Location</dt>
                <dd className="font-medium">{order.jobsiteLocation}</dd>
              </div>
            )}
            {isTpaUser && order.organization && (
              <div>
                <dt className="text-sm text-muted-foreground">Client</dt>
                <dd className="font-medium">{order.organization.name}</dd>
              </div>
            )}
            {order.requestedByUser && (
              <div>
                <dt className="text-sm text-muted-foreground">Requested By</dt>
                <dd className="font-medium">{order.requestedByUser.name || order.requestedByUser.email}</dd>
              </div>
            )}
            {order.notes && (
              <div>
                <dt className="text-sm text-muted-foreground">Notes</dt>
                <dd className="font-medium">{order.notes}</dd>
              </div>
            )}
          </dl>
          )}
        </Card>
      </div>

      {/* Checklist */}
      {!checklistLoading && checklist.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Checklist</h2>
            </div>
            <span className="text-sm text-muted-foreground">
              {checklist.filter((item) => item.isCompleted).length}/{checklist.length} complete
            </span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2 mb-4">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{
                width: `${(checklist.filter((item) => item.isCompleted).length / checklist.length) * 100}%`,
              }}
            />
          </div>
          <div className="space-y-2">
            {checklist.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-2 rounded hover:bg-secondary/50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={item.isCompleted}
                  disabled={!isTpaUser || togglingItem === item.id}
                  onChange={() => handleToggleChecklist(item.id, !item.isCompleted)}
                  className="mt-1 h-4 w-4 rounded border-border cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm ${
                      item.isCompleted ? 'line-through text-muted-foreground' : ''
                    }`}
                  >
                    {item.item}
                  </span>
                  {item.isCompleted && item.completedByUser && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Completed by {item.completedByUser.name || item.completedByUser.email}
                      {item.completedAt && ` at ${format(new Date(item.completedAt), 'PPp')}`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Collector Information */}
      {order.collector && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserCheck className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Assigned Collector</h2>
          </div>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-muted-foreground">Name</dt>
              <dd className="font-medium">{order.collector.firstName} {order.collector.lastName}</dd>
            </div>
            {isTpaUser && order.collector.email && (
              <div>
                <dt className="text-sm text-muted-foreground">Email</dt>
                <dd className="font-medium">{order.collector.email}</dd>
              </div>
            )}
            {isTpaUser && order.collector.phone && (
              <div>
                <dt className="text-sm text-muted-foreground">Phone</dt>
                <dd className="font-medium">{order.collector.phone}</dd>
              </div>
            )}
          </dl>
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
                  <p className="text-sm text-muted-foreground capitalize">{doc.kind}</p>
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

      {/* Client Review Section */}
      {!isTpaUser && order.status === 'pending_review' && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Review Results</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Please review the uploaded results and either approve them to complete the order, or reject them with feedback.
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
      {/* Cancel Order Confirmation Dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-2">Cancel Order?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to cancel this order? The order will remain in the system with a cancelled status.
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

      {/* Delete Order Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md w-full mx-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 mb-4">
              <h2 className="text-lg font-semibold text-destructive mb-1">Permanently Delete Order?</h2>
              <p className="text-sm text-muted-foreground">
                This will permanently remove order <strong>{order.orderNumber}</strong> and all associated data (checklist, notifications). This cannot be undone.
              </p>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Reason for deletion <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="e.g., Duplicate order, entered wrong candidate, test order..."
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={async () => {
                  if (!deleteReason.trim()) {
                    toast({ title: 'Required', description: 'Deletion reason is required', variant: 'destructive' });
                    return;
                  }
                  setDeleting(true);
                  try {
                    const res = await fetch(`/api/orders/${orderId}?action=delete`, {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ reason: deleteReason.trim() }),
                    });
                    if (res.ok) {
                      toast({ title: 'Order Deleted', description: 'Order has been permanently removed' });
                      window.location.href = '/orders';
                    } else {
                      const err = await res.json();
                      toast({ title: 'Error', description: err.error, variant: 'destructive' });
                    }
                  } catch (err) {
                    toast({ title: 'Error', description: 'Failed to delete order', variant: 'destructive' });
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting || !deleteReason.trim()}
                variant="destructive"
                className="flex-1"
              >
                {deleting ? 'Deleting...' : 'Permanently Delete'}
              </Button>
              <Button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteReason('');
                }}
                disabled={deleting}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
