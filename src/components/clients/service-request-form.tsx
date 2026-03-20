'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

const SERVICE_TYPES = [
  'Pre-Employment',
  'Random',
  'Post-Accident',
  'Reasonable Suspicion',
  'Physical',
  'Other',
];

// Auto-urgent service types
const URGENT_SERVICE_TYPES = ['Post-Accident', 'Reasonable Suspicion'];

export function ServiceRequestForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    donorFirstName: '',
    donorLastName: '',
    donorEmail: '',
    donorPhone: '',
    serviceType: '',
    isDOT: false,
    priority: 'standard',
    location: '',
    requestedDate: '',
    notes: '',
  });

  // Auto-set priority to urgent for post-accident and reasonable suspicion
  useEffect(() => {
    if (URGENT_SERVICE_TYPES.includes(formData.serviceType)) {
      setFormData((prev) => ({ ...prev, priority: 'urgent' }));
    }
  }, [formData.serviceType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await res.json();

      if (!res.ok) {
        toast({
          title: 'Error',
          description: result.error || 'Failed to submit request',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Request Submitted',
        description: 'Your service request has been submitted to your TPA for review.',
      });

      router.push('/client-portal/requests');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Donor Information */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Donor Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="donorFirstName">First Name *</Label>
              <Input
                id="donorFirstName"
                required
                value={formData.donorFirstName}
                onChange={(e) => setFormData({ ...formData, donorFirstName: e.target.value })}
                placeholder="First name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="donorLastName">Last Name *</Label>
              <Input
                id="donorLastName"
                required
                value={formData.donorLastName}
                onChange={(e) => setFormData({ ...formData, donorLastName: e.target.value })}
                placeholder="Last name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="donorEmail">Email</Label>
              <Input
                id="donorEmail"
                type="email"
                value={formData.donorEmail}
                onChange={(e) => setFormData({ ...formData, donorEmail: e.target.value })}
                placeholder="donor@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="donorPhone">Phone</Label>
              <Input
                id="donorPhone"
                type="tel"
                value={formData.donorPhone}
                onChange={(e) => setFormData({ ...formData, donorPhone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
        </div>

        {/* Service Details */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Service Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="serviceType">Service Type *</Label>
              <Select
                value={formData.serviceType}
                onValueChange={(val) => setFormData({ ...formData, serviceType: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>DOT or Non-DOT *</Label>
              <div className="flex gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="isDOT"
                    checked={!formData.isDOT}
                    onChange={() => setFormData({ ...formData, isDOT: false })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Non-DOT</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="isDOT"
                    checked={formData.isDOT}
                    onChange={() => setFormData({ ...formData, isDOT: true })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">DOT</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <div className="flex gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="priority"
                    checked={formData.priority === 'standard'}
                    onChange={() => setFormData({ ...formData, priority: 'standard' })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Standard</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="priority"
                    checked={formData.priority === 'urgent'}
                    onChange={() => setFormData({ ...formData, priority: 'urgent' })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Urgent</span>
                </label>
              </div>
              {URGENT_SERVICE_TYPES.includes(formData.serviceType) && (
                <p className="text-xs text-amber-600">
                  Auto-set to Urgent for {formData.serviceType} requests
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="requestedDate">Requested Date &amp; Time</Label>
              <Input
                id="requestedDate"
                type="datetime-local"
                value={formData.requestedDate}
                onChange={(e) => setFormData({ ...formData, requestedDate: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <Label htmlFor="location">Collection Location / Address *</Label>
          <Input
            id="location"
            required
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="Enter the collection site address or location"
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Special Instructions / Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Any special instructions or notes for the TPA..."
            rows={4}
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/client-portal/requests')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !formData.serviceType}>
            {loading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
