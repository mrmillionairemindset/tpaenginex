'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

export function Osha300Downloader() {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [loading, setLoading] = useState(false);

  const yearOptions = Array.from({ length: 8 }, (_, i) => String(currentYear - i));

  const download = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/injury/osha-300?year=${encodeURIComponent(year)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate OSHA 300 log');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `osha-300-${year}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'OSHA 300 log downloaded' });
    } catch (err: any) {
      toast({
        title: 'Download failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-xl p-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="year">Calendar Year</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger id="year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-sm text-muted-foreground">
          Generates the OSHA Form 300 Log of Work-Related Injuries and Illnesses
          for all recordable cases in the selected year. Per 29 CFR 1904, post
          the Form 300A summary from February 1 through April 30 of the year
          following the year covered.
        </p>

        <div className="flex justify-end">
          <Button onClick={download} disabled={loading}>
            {loading ? 'Generating…' : 'Download PDF'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
