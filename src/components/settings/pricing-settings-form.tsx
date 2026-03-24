'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface CatalogService {
  id: string;
  category: string;
  group: string | null;
  name: string;
  code: string | null;
  rate: number | null;
  isActive: boolean;
}

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
  const [services, setServices] = useState<CatalogService[]>([]);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [dotSurcharge, setDotSurcharge] = useState('0.00');
  const [paymentTermDays, setPaymentTermDays] = useState('30');
  const [savingGlobal, setSavingGlobal] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [catalogRes, settingsRes] = await Promise.all([
          fetch('/api/service-catalog'),
          fetch('/api/tpa-settings'),
        ]);

        if (catalogRes.ok) {
          const data = await catalogRes.json();
          const svcs = (data.services || []) as CatalogService[];
          setServices(svcs);
          const rateMap: Record<string, string> = {};
          for (const svc of svcs) {
            rateMap[svc.id] = svc.rate ? centsToDollars(svc.rate) : '';
          }
          setRates(rateMap);
        }

        if (settingsRes.ok) {
          const data = await settingsRes.json();
          setDotSurcharge(
            data.settings.dotSurchargeRate
              ? centsToDollars(data.settings.dotSurchargeRate)
              : '0.00'
          );
          setPaymentTermDays(String(data.settings.defaultPaymentTermDays ?? 30));
        }
      } catch (err) {
        console.error('Failed to fetch pricing data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const saveRate = async (serviceId: string) => {
    setSavingId(serviceId);
    try {
      const cents = dollarsToCents(rates[serviceId] || '');
      const res = await fetch(`/api/service-catalog/${serviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate: cents > 0 ? cents : null }),
      });
      if (res.ok) {
        toast({ title: 'Rate Saved', description: 'Service rate updated' });
      } else {
        toast({ title: 'Error', description: 'Failed to save rate', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  const saveAllRates = async () => {
    setSavingGlobal(true);
    let saved = 0;
    try {
      for (const svc of services) {
        const cents = dollarsToCents(rates[svc.id] || '');
        const currentRate = svc.rate || 0;
        if (cents !== currentRate) {
          await fetch(`/api/service-catalog/${svc.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rate: cents > 0 ? cents : null }),
          });
          saved++;
        }
      }

      // Save DOT surcharge and payment terms
      await fetch('/api/tpa-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dotSurchargeRate: dollarsToCents(dotSurcharge),
          defaultPaymentTermDays: parseInt(paymentTermDays, 10) || 30,
        }),
      });

      toast({ title: 'Pricing Saved', description: `${saved} rate${saved !== 1 ? 's' : ''} updated` });
    } catch {
      toast({ title: 'Error', description: 'Failed to save pricing', variant: 'destructive' });
    } finally {
      setSavingGlobal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Group services by category then by group
  const drugTestingServices = services.filter(s => s.category === 'drug_testing');
  const occHealthServices = services.filter(s => s.category === 'occupational_health');

  const occHealthGroups = new Map<string, CatalogService[]>();
  for (const svc of occHealthServices) {
    const group = svc.group || 'Other';
    if (!occHealthGroups.has(group)) occHealthGroups.set(group, []);
    occHealthGroups.get(group)!.push(svc);
  }

  const categoryLabel: Record<string, string> = {
    drug_testing: 'Drug Testing',
    occupational_health: 'Occupational Health',
  };

  return (
    <div className="space-y-6">
      {/* Drug Testing Services */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-1">Drug Testing Rates</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Set the rate for each drug testing service. These are used as line items on auto-generated invoices.
        </p>
        <div className="space-y-3">
          {drugTestingServices.map((svc) => (
            <div key={svc.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{svc.name}</span>
                {!svc.isActive && <Badge variant="secondary" className="ml-2 text-[10px]">Inactive</Badge>}
              </div>
              <div className="relative w-28">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="pl-7 h-8 text-sm"
                  value={rates[svc.id] || ''}
                  onChange={(e) => setRates(prev => ({ ...prev, [svc.id]: e.target.value }))}
                  onBlur={() => {
                    const cents = dollarsToCents(rates[svc.id] || '');
                    if (cents !== (svc.rate || 0)) saveRate(svc.id);
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Occupational Health Services — grouped */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-1">Occupational Health Rates</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Set the rate for each occupational health service. Grouped by category.
        </p>
        <div className="space-y-6">
          {[...occHealthGroups.entries()].map(([group, svcs]) => (
            <div key={group}>
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">{group}</h4>
              <div className="space-y-2">
                {svcs.map((svc) => (
                  <div key={svc.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm">{svc.name}</span>
                      {!svc.isActive && <Badge variant="secondary" className="ml-2 text-[10px]">Inactive</Badge>}
                    </div>
                    <div className="relative w-28">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-7 h-8 text-sm"
                        value={rates[svc.id] || ''}
                        onChange={(e) => setRates(prev => ({ ...prev, [svc.id]: e.target.value }))}
                        onBlur={() => {
                          const cents = dollarsToCents(rates[svc.id] || '');
                          if (cents !== (svc.rate || 0)) saveRate(svc.id);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* DOT Surcharge + Payment Terms */}
      <Card className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-1">DOT Surcharge</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Additional amount added as a line item when an order is DOT-regulated.
          </p>
          <div className="relative max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <Input
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

        <div>
          <h3 className="text-lg font-semibold mb-1">Payment Terms</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Days until an invoice is due after being sent to the client.
          </p>
          <div className="max-w-xs">
            <Input
              type="number"
              min="1"
              max="365"
              value={paymentTermDays}
              onChange={(e) => setPaymentTermDays(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={saveAllRates} disabled={savingGlobal}>
          {savingGlobal ? 'Saving...' : 'Save All Pricing'}
        </Button>
      </Card>
    </div>
  );
}
