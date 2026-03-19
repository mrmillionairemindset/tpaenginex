'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

const CERTIFICATION_OPTIONS = ['DOT', 'BAT', 'Non-DOT', 'Oral Fluid', 'Hair'];

export function NewCollectorForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    serviceArea: '',
    notes: '',
  });
  const [certifications, setCertifications] = useState<string[]>([]);

  const toggleCert = (cert: string) => {
    setCertifications(prev =>
      prev.includes(cert) ? prev.filter(c => c !== cert) : [...prev, cert]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/collectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          certifications: certifications.length > 0 ? certifications : undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Collector Added',
          description: `${formData.firstName} ${formData.lastName} has been added`,
        });
        router.push('/collectors');
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to add collector',
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
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="firstName">First Name <span className="text-red-500">*</span></Label>
            <Input
              id="firstName"
              required
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="lastName">Last Name <span className="text-red-500">*</span></Label>
            <Input
              id="lastName"
              required
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
            <Input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone <span className="text-red-500">*</span></Label>
            <Input
              id="phone"
              type="tel"
              required
              placeholder="555-123-4567"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label>Certifications</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {CERTIFICATION_OPTIONS.map((cert) => (
              <button
                key={cert}
                type="button"
                onClick={() => toggleCert(cert)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  certifications.includes(cert)
                    ? 'bg-primary text-white border-primary'
                    : 'bg-card text-foreground border-input hover:bg-muted'
                }`}
              >
                {cert}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="serviceArea">Service Area</Label>
          <Input
            id="serviceArea"
            placeholder="e.g., Houston metro, DFW area"
            value={formData.serviceArea}
            onChange={(e) => setFormData({ ...formData, serviceArea: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Any additional notes about this collector"
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? 'Adding...' : 'Add Collector'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </Card>
    </form>
  );
}
