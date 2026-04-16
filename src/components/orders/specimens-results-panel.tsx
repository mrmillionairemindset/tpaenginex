'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { SignaturePad } from '@/components/orders/signature-pad';
import { format } from 'date-fns';
import { FlaskConical, FileBarChart, PenTool, Plus } from 'lucide-react';

interface SpecimensResultsPanelProps {
  orderId: string;
  userRole: string;
}

interface Specimen {
  id: string;
  specimenType: string;
  ccfNumber: string | null;
  status: string;
  collectedAt: string | null;
  collectorName?: string | null;
  createdAt: string;
}

interface Result {
  id: string;
  specimenId: string;
  panelType: string;
  resultValue: string;
  mroDecision: string | null;
  reportedAt: string | null;
  source: string | null;
  createdAt: string;
}

interface Signature {
  id: string;
  signerName: string;
  signerRole: string;
  signedAt: string;
  signatureDataUrl: string;
}

const RESULT_VALUE_COLORS: Record<string, string> = {
  negative: 'bg-green-100 text-green-800 border-green-200',
  positive: 'bg-red-100 text-red-800 border-red-200',
  inconclusive: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  refused: 'bg-gray-100 text-gray-800 border-gray-200',
  pending: 'bg-blue-100 text-blue-800 border-blue-200',
};

const SPECIMEN_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-800 border-blue-200',
  collected: 'bg-green-100 text-green-800 border-green-200',
  shipped: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  lab_received: 'bg-purple-100 text-purple-800 border-purple-200',
  testing: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  reported: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

const MRO_DECISION_COLORS: Record<string, string> = {
  verified_negative: 'bg-green-100 text-green-800 border-green-200',
  verified_positive: 'bg-red-100 text-red-800 border-red-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  refusal_to_test: 'bg-gray-100 text-gray-800 border-gray-200',
};

export function SpecimensResultsPanel({ orderId, userRole }: SpecimensResultsPanelProps) {
  const { toast } = useToast();

  // Data state
  const [specimens, setSpecimens] = useState<Specimen[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loadingSpecimens, setLoadingSpecimens] = useState(true);
  const [loadingResults, setLoadingResults] = useState(true);
  const [loadingSignatures, setLoadingSignatures] = useState(true);

  // Dialog state
  const [showAddSpecimen, setShowAddSpecimen] = useState(false);
  const [showAddResult, setShowAddResult] = useState(false);
  const [submittingSpecimen, setSubmittingSpecimen] = useState(false);
  const [submittingResult, setSubmittingResult] = useState(false);

  // Form state
  const [specimenForm, setSpecimenForm] = useState({ specimenType: 'primary', ccfNumber: '' });
  const [resultForm, setResultForm] = useState({
    specimenId: '',
    panelType: '',
    resultValue: 'pending',
    mroDecision: '',
    source: '',
  });

  const isTpaUser = userRole.startsWith('tpa_') || userRole === 'platform_admin';
  const canAddSpecimen = ['tpa_admin', 'tpa_staff', 'tpa_records', 'platform_admin'].includes(userRole);
  const canAddResult = ['tpa_admin', 'tpa_records', 'platform_admin'].includes(userRole);

  const fetchSpecimens = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}/specimens`);
      if (res.ok) {
        const data = await res.json();
        setSpecimens(data.specimens || []);
      }
    } catch {
      // Specimens endpoint may not exist yet
    } finally {
      setLoadingSpecimens(false);
    }
  }, [orderId]);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}/results`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch {
      // Results endpoint may not exist yet
    } finally {
      setLoadingResults(false);
    }
  }, [orderId]);

  const fetchSignatures = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}/signatures`);
      if (res.ok) {
        const data = await res.json();
        setSignatures(data.signatures || []);
      }
    } catch {
      // Signatures endpoint may not exist yet
    } finally {
      setLoadingSignatures(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchSpecimens();
    fetchResults();
    fetchSignatures();
  }, [fetchSpecimens, fetchResults, fetchSignatures]);

  const handleAddSpecimen = async () => {
    if (!specimenForm.ccfNumber.trim()) {
      toast({ title: 'CCF Number Required', description: 'Please enter a CCF number.', variant: 'destructive' });
      return;
    }
    setSubmittingSpecimen(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/specimens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specimenType: specimenForm.specimenType,
          ccfNumber: specimenForm.ccfNumber.trim(),
        }),
      });
      if (res.ok) {
        toast({ title: 'Specimen Added', description: 'The specimen has been recorded.' });
        setShowAddSpecimen(false);
        setSpecimenForm({ specimenType: 'primary', ccfNumber: '' });
        fetchSpecimens();
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error || 'Failed to add specimen', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add specimen', variant: 'destructive' });
    } finally {
      setSubmittingSpecimen(false);
    }
  };

  const handleAddResult = async () => {
    if (!resultForm.specimenId) {
      toast({ title: 'Specimen Required', description: 'Please select a specimen.', variant: 'destructive' });
      return;
    }
    if (!resultForm.panelType.trim()) {
      toast({ title: 'Panel Type Required', description: 'Please enter a panel type.', variant: 'destructive' });
      return;
    }
    setSubmittingResult(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specimenId: resultForm.specimenId,
          panelType: resultForm.panelType.trim(),
          resultValue: resultForm.resultValue,
          mroDecision: resultForm.mroDecision || null,
          source: resultForm.source.trim() || null,
        }),
      });
      if (res.ok) {
        toast({ title: 'Result Added', description: 'The result has been recorded.' });
        setShowAddResult(false);
        setResultForm({ specimenId: '', panelType: '', resultValue: 'pending', mroDecision: '', source: '' });
        fetchResults();
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error || 'Failed to add result', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add result', variant: 'destructive' });
    } finally {
      setSubmittingResult(false);
    }
  };

  const handleSignatureComplete = () => {
    fetchSignatures();
  };

  return (
    <div className="space-y-6">
      {/* Specimens Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Specimens</h2>
          </div>
          {canAddSpecimen && (
            <Button size="sm" onClick={() => setShowAddSpecimen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Specimen
            </Button>
          )}
        </div>

        {loadingSpecimens ? (
          <div className="flex items-center justify-center py-6">
            <LoadingSpinner size="md" />
          </div>
        ) : specimens.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No specimens recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">CCF Number</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Collected At</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Collector</th>
                </tr>
              </thead>
              <tbody>
                {specimens.map((specimen) => (
                  <tr key={specimen.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2 px-3 capitalize">{specimen.specimenType}</td>
                    <td className="py-2 px-3 font-mono text-xs">{specimen.ccfNumber || '-'}</td>
                    <td className="py-2 px-3">
                      <Badge className={SPECIMEN_STATUS_COLORS[specimen.status] || 'bg-gray-100 text-gray-800'}>
                        {specimen.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="py-2 px-3">
                      {specimen.collectedAt ? format(new Date(specimen.collectedAt), 'PPp') : '-'}
                    </td>
                    <td className="py-2 px-3">{specimen.collectorName || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Results Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Results</h2>
          </div>
          {canAddResult && specimens.length > 0 && (
            <Button size="sm" onClick={() => setShowAddResult(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Result
            </Button>
          )}
        </div>

        {loadingResults ? (
          <div className="flex items-center justify-center py-6">
            <LoadingSpinner size="md" />
          </div>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No results recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Panel Type</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Result</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">MRO Decision</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Reported At</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Source</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2 px-3">{result.panelType}</td>
                    <td className="py-2 px-3">
                      <Badge className={RESULT_VALUE_COLORS[result.resultValue] || 'bg-gray-100 text-gray-800'}>
                        {result.resultValue}
                      </Badge>
                    </td>
                    <td className="py-2 px-3">
                      {result.mroDecision ? (
                        <Badge className={MRO_DECISION_COLORS[result.mroDecision] || 'bg-gray-100 text-gray-800'}>
                          {result.mroDecision.replace(/_/g, ' ')}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {result.reportedAt ? format(new Date(result.reportedAt), 'PPp') : '-'}
                    </td>
                    <td className="py-2 px-3">{result.source || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Signatures Section */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <PenTool className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Signatures</h2>
        </div>

        {loadingSignatures ? (
          <div className="flex items-center justify-center py-6">
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <>
            {signatures.length > 0 && (
              <div className="space-y-3 mb-6">
                {signatures.map((sig) => (
                  <div key={sig.id} className="flex items-center gap-4 p-3 border rounded-lg">
                    {sig.signatureDataUrl && (
                      <img
                        src={sig.signatureDataUrl}
                        alt={`Signature by ${sig.signerName}`}
                        className="h-12 w-24 object-contain border rounded bg-white"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{sig.signerName}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {sig.signerRole.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(sig.signedAt), 'PPp')}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {isTpaUser && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold mb-3">Capture Signature</h3>
                <SignaturePad
                  orderId={orderId}
                  signerRole={userRole}
                  onSigned={handleSignatureComplete}
                />
              </div>
            )}

            {!isTpaUser && signatures.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No signatures recorded yet.</p>
            )}
          </>
        )}
      </Card>

      {/* Add Specimen Dialog */}
      <Dialog open={showAddSpecimen} onOpenChange={setShowAddSpecimen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Specimen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="specimenType">Specimen Type</Label>
              <select
                id="specimenType"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={specimenForm.specimenType}
                onChange={(e) => setSpecimenForm({ ...specimenForm, specimenType: e.target.value })}
              >
                <option value="primary">Primary</option>
                <option value="split">Split</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ccfNumber">CCF Number</Label>
              <Input
                id="ccfNumber"
                placeholder="Enter CCF number"
                value={specimenForm.ccfNumber}
                onChange={(e) => setSpecimenForm({ ...specimenForm, ccfNumber: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSpecimen(false)} disabled={submittingSpecimen}>
              Cancel
            </Button>
            <Button onClick={handleAddSpecimen} disabled={submittingSpecimen}>
              {submittingSpecimen ? 'Adding...' : 'Add Specimen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Result Dialog */}
      <Dialog open={showAddResult} onOpenChange={setShowAddResult}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Result</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="resultSpecimen">Specimen</Label>
              <select
                id="resultSpecimen"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={resultForm.specimenId}
                onChange={(e) => setResultForm({ ...resultForm, specimenId: e.target.value })}
              >
                <option value="">Select specimen...</option>
                {specimens.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.specimenType} - {s.ccfNumber || s.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="panelType">Panel Type</Label>
              <Input
                id="panelType"
                placeholder="e.g., 5-Panel, 10-Panel, BAT"
                value={resultForm.panelType}
                onChange={(e) => setResultForm({ ...resultForm, panelType: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resultValue">Result Value</Label>
              <select
                id="resultValue"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={resultForm.resultValue}
                onChange={(e) => setResultForm({ ...resultForm, resultValue: e.target.value })}
              >
                <option value="pending">Pending</option>
                <option value="negative">Negative</option>
                <option value="positive">Positive</option>
                <option value="inconclusive">Inconclusive</option>
                <option value="cancelled">Cancelled</option>
                <option value="refused">Refused</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mroDecision">MRO Decision (optional)</Label>
              <select
                id="mroDecision"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={resultForm.mroDecision}
                onChange={(e) => setResultForm({ ...resultForm, mroDecision: e.target.value })}
              >
                <option value="">None</option>
                <option value="verified_negative">Verified Negative</option>
                <option value="verified_positive">Verified Positive</option>
                <option value="cancelled">Cancelled</option>
                <option value="refusal_to_test">Refusal to Test</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source (optional)</Label>
              <Input
                id="source"
                placeholder="e.g., Lab report, eScreen, manual entry"
                value={resultForm.source}
                onChange={(e) => setResultForm({ ...resultForm, source: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddResult(false)} disabled={submittingResult}>
              Cancel
            </Button>
            <Button onClick={handleAddResult} disabled={submittingResult}>
              {submittingResult ? 'Adding...' : 'Add Result'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
