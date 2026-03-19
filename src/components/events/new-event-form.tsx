'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

interface ClientOrg {
  id: string;
  name: string;
}

interface Collector {
  id: string;
  firstName: string;
  lastName: string;
}

export function NewEventForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<ClientOrg[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [formData, setFormData] = useState({
    clientOrgId: '',
    serviceType: 'random' as 'random' | 'onsite_batch',
    location: '',
    scheduledDate: '',
    totalOrdered: 1,
    collectorId: '',
    notes: '',
  });

  useEffect(() => {
    // Fetch client orgs and collectors
    Promise.all([
      fetch('/api/organizations').then(r => r.ok ? r.json() : { organizations: [] }),
      fetch('/api/collectors').then(r => r.ok ? r.json() : { collectors: [] }),
    ]).then(([orgData, collectorData]) => {
      // Filter to client type orgs
      const clientOrgs = (orgData.organizations || []).filter(
        (org: any) => org.type === 'client'
      );
      setClients(clientOrgs);
      setCollectors(collectorData.collectors || []);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          scheduledDate: new Date(formData.scheduledDate).toISOString(),
          collectorId: formData.collectorId || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Event Created',
          description: `Event ${data.event.eventNumber} has been created`,
        });
        router.push(`/events/${data.event.id}`);
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to create event',
          variant: 'destructive',
        });
      }
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
    <form onSubmit={handleSubmit}>
      <Card className="p-6 space-y-6">
        <div>
          <Label htmlFor="clientOrgId">Client / Company <span className="text-red-500">*</span></Label>
          <select
            id="clientOrgId"
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            value={formData.clientOrgId}
            onChange={(e) => setFormData({ ...formData, clientOrgId: e.target.value })}
          >
            <option value="">Select a client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="serviceType">Service Type <span className="text-red-500">*</span></Label>
            <select
              id="serviceType"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={formData.serviceType}
              onChange={(e) => setFormData({ ...formData, serviceType: e.target.value as any })}
            >
              <option value="random">Random</option>
              <option value="onsite_batch">Onsite Batch</option>
            </select>
          </div>

          <div>
            <Label htmlFor="totalOrdered">Number of Donors <span className="text-red-500">*</span></Label>
            <Input
              id="totalOrdered"
              type="number"
              min={1}
              required
              value={formData.totalOrdered}
              onChange={(e) => setFormData({ ...formData, totalOrdered: parseInt(e.target.value) || 1 })}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="location">Collection Location / Address <span className="text-red-500">*</span></Label>
          <Input
            id="location"
            required
            placeholder="Full address where collector will go"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="scheduledDate">Scheduled Date & Time <span className="text-red-500">*</span></Label>
          <Input
            id="scheduledDate"
            type="datetime-local"
            required
            value={formData.scheduledDate}
            onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="collectorId">Assigned Collector</Label>
          <select
            id="collectorId"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            value={formData.collectorId}
            onChange={(e) => setFormData({ ...formData, collectorId: e.target.value })}
          >
            <option value="">Select a collector...</option>
            {collectors.map((c) => (
              <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="notes">Special Instructions / Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder='e.g., "White Construction = Rapid + Lab + BAT"'
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Event'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </Card>
    </form>
  );
}
