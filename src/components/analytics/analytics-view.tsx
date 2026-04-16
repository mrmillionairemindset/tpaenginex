'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ApiUsagePanel } from './api-usage-panel';
import { WebhooksPanel } from './webhooks-panel';

const DAY_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

export function AnalyticsView() {
  const [days, setDays] = useState<number>(7);
  const [tab, setTab] = useState<'api' | 'webhooks'>('api');

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as 'api' | 'webhooks')}
      className="space-y-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabsList>
          <TabsTrigger value="api">API Usage</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        <div
          role="group"
          aria-label="Date range"
          className="inline-flex items-center gap-1 rounded-md border bg-muted/40 p-1"
        >
          {DAY_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant={days === opt.value ? 'default' : 'ghost'}
              onClick={() => setDays(opt.value)}
              className={cn(
                'h-7 px-3 text-xs',
                days === opt.value ? '' : 'text-muted-foreground'
              )}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <TabsContent value="api" className="mt-0">
        <ApiUsagePanel days={days} />
      </TabsContent>

      <TabsContent value="webhooks" className="mt-0">
        <WebhooksPanel days={days} />
      </TabsContent>
    </Tabs>
  );
}
