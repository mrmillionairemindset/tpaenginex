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
  const [clientLabel, setClientLabel] = useState('');
  const [formData, setFormData] = useState({
    clientOrgId: '',
    serviceType: 'random' as 'random' | 'post_accident' | 'reasonable_suspicion',
    locationStreet: '',
    locationCity: '',
    locationState: '',
    locationZip: '',
    scheduledDate: '',
    totalOrdered: 1,
    collectorId: '',
    notes: '',
  });

  useEffect(() => {
    // Fetch client orgs and collectors
    Promise.all([
      fetch('/api/clients').then(r => r.ok ? r.json() : { clients: [] }),
      fetch('/api/collectors').then(r => r.ok ? r.json() : { collectors: [] }),
    ]).then(([clientData, collectorData]) => {
      setClients(clientData.clients || []);
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
          clientOrgId: (formData.clientOrgId && formData.clientOrgId !== 'walk_in' && formData.clientOrgId !== 'other') ? formData.clientOrgId : undefined,
          clientLabel: formData.clientOrgId === 'walk_in' ? 'Walk-In' : formData.clientOrgId === 'other' ? clientLabel : undefined,
          serviceType: formData.serviceType,
          location: [formData.locationStreet, formData.locationCity, formData.locationState, formData.locationZip].filter(Boolean).join(', '),
          scheduledDate: new Date(formData.scheduledDate).toISOString(),
          totalOrdered: formData.totalOrdered,
          collectorId: formData.collectorId || undefined,
          notes: formData.notes || undefined,
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
            onChange={(e) => {
              setFormData({ ...formData, clientOrgId: e.target.value });
              if (e.target.value !== 'other') setClientLabel('');
            }}
          >
            <option value="">Select a client...</option>
            <option value="walk_in">Walk-In Individual</option>
            <option value="other">Other (Non-Client Business)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {formData.clientOrgId === 'other' && (
            <Input
              className="mt-2"
              placeholder="Enter business name..."
              required
              value={clientLabel}
              onChange={(e) => setClientLabel(e.target.value)}
            />
          )}
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
              <option value="post_accident">Post-Accident</option>
              <option value="reasonable_suspicion">Reasonable Suspicion</option>
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
          <Label>Collection Location / Address <span className="text-red-500">*</span></Label>
          <div className="grid gap-4 md:grid-cols-2 mt-2">
            <div className="md:col-span-2">
              <Input
                id="locationStreet"
                required
                placeholder="Street address"
                value={formData.locationStreet}
                onChange={(e) => setFormData({ ...formData, locationStreet: e.target.value })}
              />
            </div>
            <div>
              <Input
                id="locationCity"
                required
                placeholder="City"
                value={formData.locationCity}
                onChange={(e) => setFormData({ ...formData, locationCity: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="locationState"
                required
                placeholder="State"
                maxLength={2}
                value={formData.locationState}
                onChange={(e) => setFormData({ ...formData, locationState: e.target.value.toUpperCase() })}
              />
              <Input
                id="locationZip"
                required
                placeholder="ZIP"
                maxLength={5}
                value={formData.locationZip}
                onChange={(e) => setFormData({ ...formData, locationZip: e.target.value.replace(/\D/g, '').slice(0, 5) })}
              />
            </div>
          </div>
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
