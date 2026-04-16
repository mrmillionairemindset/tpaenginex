'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Upload, Download, Loader2 } from 'lucide-react';

interface ImportResult {
  imported: number;
  errors: { row: number; error: string }[];
}

interface OrderImportDialogProps {
  onImported?: () => void;
}

export function OrderImportDialog({ onImported }: OrderImportDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setSubmitting(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/orders/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: 'Import failed',
          description: data.error || 'Unknown error',
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }
      setResult(data as ImportResult);
      if (data.imported > 0) {
        toast({
          title: 'Import complete',
          description: `Imported ${data.imported} order(s)${data.errors?.length ? `, ${data.errors.length} error(s)` : ''}.`,
        });
        onImported?.();
      } else {
        toast({
          title: 'No orders imported',
          description: `${data.errors?.length || 0} error(s) found.`,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Import error',
        description: err?.message || 'Request failed',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Orders from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk-create orders. Persons are matched by email within your TPA;
            new persons are created when no match exists.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <p className="font-medium mb-1">Required columns:</p>
            <p className="text-muted-foreground">
              firstName, lastName, email, phone, dob, testType, serviceType, isDOT, jobsiteLocation
            </p>
            <p className="font-medium mt-2 mb-1">Optional columns:</p>
            <p className="text-muted-foreground">ssnLast4, scheduledFor, clientOrgId</p>
            <p className="mt-2 text-xs text-muted-foreground">
              serviceType must be one of: pre_employment, random, post_accident, reasonable_suspicion, physical, other, drug_screen.
              isDOT: true or false.
            </p>
          </div>

          <div>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => (window.location.href = '/api/orders/import/template')}
            >
              <Download className="h-3 w-3 mr-1" />
              Download template
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="csv-file">CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setResult(null);
              }}
            />
          </div>

          {result && (
            <div className="rounded-md border p-3 text-sm space-y-2">
              <p className="font-medium">
                Imported {result.imported} order{result.imported === 1 ? '' : 's'}.
                {result.errors.length > 0
                  ? ` ${result.errors.length} error${result.errors.length === 1 ? '' : 's'}:`
                  : ''}
              </p>
              {result.errors.length > 0 && (
                <ul className="max-h-40 overflow-y-auto space-y-1 text-xs text-destructive">
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Close
          </Button>
          <Button onClick={handleSubmit} disabled={!file || submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
