'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const SERVICE_TYPES = [
  { key: 'drug_screen', label: 'Drug Screen' },
  { key: 'pre_employment', label: 'Pre-Employment' },
  { key: 'random', label: 'Random' },
  { key: 'post_accident', label: 'Post-Accident' },
  { key: 'reasonable_suspicion', label: 'Reasonable Suspicion' },
  { key: 'physical', label: 'Physical' },
  { key: 'other', label: 'Other' },
];

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function dollarsToCents(dollars: string): number {
  const parsed = parseFloat(dollars);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

export function PricingSettingsForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [dotSurcharge, setDotSurcharge] = useState('0.00');
  const [paymentTermDays, setPaymentTermDays] = useState('30');

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch('/api/tpa-settings');
        if (response.ok) {
          const data = await response.json();
          const serviceRates = data.settings.defaultServiceRates || {};
          const rateStrings: Record<string, string> = {};
          for (const st of SERVICE_TYPES) {
            rateStrings[st.key] = serviceRates[st.key]
              ? centsToDollars(serviceRates[st.key])
              : '';
          }
          setRates(rateStrings);
          setDotSurcharge(
            data.settings.dotSurchargeRate
              ? centsToDollars(data.settings.dotSurchargeRate)
              : '0.00'
          );
          setPaymentTermDays(
            String(data.settings.defaultPaymentTermDays ?? 30)
          );
        }
      } catch (error) {
        console.error('Failed to fetch pricing settings:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Convert dollar strings to cents
      const serviceRates: Record<string, number> = {};
      for (const st of SERVICE_TYPES) {
        const cents = dollarsToCents(rates[st.key] || '');
        if (cents > 0) {
          serviceRates[st.key] = cents;
        }
      }

      const response = await fetch('/api/tpa-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultServiceRates: serviceRates,
          dotSurchargeRate: dollarsToCents(dotSurcharge),
          defaultPaymentTermDays: parseInt(paymentTermDays, 10) || 30,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Pricing Saved',
          description: 'Service rates and billing defaults have been updated',
        });
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to save pricing',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-1">Service Rates</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Set the default rate per service type. These are used to auto-calculate invoice amounts when orders or events are completed. Leave blank for services you don't offer.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {SERVICE_TYPES.map((st) => (
              <div key={st.key}>
                <Label htmlFor={`rate-${st.key}`}>{st.label}</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    id={`rate-${st.key}`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="pl-7"
                    value={rates[st.key] || ''}
                    onChange={(e) =>
                      setRates((prev) => ({ ...prev, [st.key]: e.target.value }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-1">DOT Surcharge</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Additional amount added per service when the order is flagged as DOT-regulated.
          </p>
          <div className="max-w-xs">
            <Label htmlFor="dotSurcharge">DOT Surcharge per Service</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                id="dotSurcharge"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="pl-7"
                value={dotSurcharge}
                onChange={(e) => setDotSurcharge(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-1">Payment Terms</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Number of days after an invoice is sent before it's considered due. Used to auto-set the due date when marking invoices as "Sent".
          </p>
          <div className="max-w-xs">
            <Label htmlFor="paymentTermDays">Payment Term (days)</Label>
            <Input
              id="paymentTermDays"
              type="number"
              min="1"
              max="365"
              className="mt-1"
              value={paymentTermDays}
              onChange={(e) => setPaymentTermDays(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Pricing'}
          </Button>
        </div>
      </Card>
    </form>
  );
}
