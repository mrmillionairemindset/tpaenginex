'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface Props {
  incidentId: string;
  userRole: string;
  canSignOffRtw: boolean;
}

interface Treatment {
  id: string;
  treatmentDate: string;
  providerType: string;
  providerName: string | null;
  diagnosis: string | null;
  workRestrictions: string | null;
  nextVisitOn: string | null;
  notes: string | null;
}

interface DocumentRow {
  id: string;
  documentType: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
}

interface RtwEval {
  id: string;
  evaluationDate: string;
  status: string;
  evaluatorName: string | null;
  releasedToWorkOn: string | null;
  restrictions: string[];
  followUpRequired: boolean;
  followUpDate: string | null;
  signedOffAt: string | null;
  notes: string | null;
}

interface Incident {
  id: string;
  incidentNumber: string;
  incidentDate: string;
  status: string;
  severity: string;
  oshaRecordable: boolean;
  lostDaysCount: number;
  restrictedDaysCount: number;
  injuryType: string;
  description: string;
  location: string;
  jobAtIncident: string | null;
  bodyPartsAffected: string[];
  workersCompClaimNumber: string | null;
  workersCompCarrier: string | null;
  notes: string | null;
  internalNotes?: string | null;
  person?: { id: string; firstName: string; lastName: string };
  clientOrg?: { id: string; name: string } | null;
  treatments: Treatment[];
  documents: DocumentRow[];
  rtwEvals: RtwEval[];
}

export function IncidentDetail({ incidentId, canSignOffRtw }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);

  const [newTreatment, setNewTreatment] = useState({
    treatmentDate: '',
    providerType: 'urgent_care',
    providerName: '',
    diagnosis: '',
    workRestrictions: '',
    nextVisitOn: '',
    notes: '',
  });

  const [newRtw, setNewRtw] = useState({
    evaluationDate: '',
    status: 'full_duty' as 'full_duty' | 'restricted_duty' | 'unable_to_work',
    evaluatorName: '',
    releasedToWorkOn: '',
    restrictions: '',
    followUpRequired: false,
    followUpDate: '',
    notes: '',
  });

  const fetchIncident = useCallback(async () => {
    try {
      const res = await fetch(`/api/injury/incidents/${incidentId}`);
      if (res.ok) {
        const data = await res.json();
        setIncident(data.incident);
      }
    } catch (err) {
      console.error('[incident-detail] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    fetchIncident();
  }, [fetchIncident]);

  const addTreatment = async () => {
    if (!newTreatment.treatmentDate) {
      toast({ title: 'Treatment date required', variant: 'destructive' });
      return;
    }
    const res = await fetch(`/api/injury/incidents/${incidentId}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        treatmentDate: new Date(newTreatment.treatmentDate).toISOString(),
        providerType: newTreatment.providerType,
        providerName: newTreatment.providerName || undefined,
        diagnosis: newTreatment.diagnosis || undefined,
        workRestrictions: newTreatment.workRestrictions || undefined,
        nextVisitOn: newTreatment.nextVisitOn
          ? new Date(newTreatment.nextVisitOn).toISOString()
          : undefined,
        notes: newTreatment.notes || undefined,
      }),
    });
    if (res.ok) {
      toast({ title: 'Treatment recorded' });
      setNewTreatment({
        treatmentDate: '',
        providerType: 'urgent_care',
        providerName: '',
        diagnosis: '',
        workRestrictions: '',
        nextVisitOn: '',
        notes: '',
      });
      fetchIncident();
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: 'Failed', description: err.error, variant: 'destructive' });
    }
  };

  const addRtw = async () => {
    if (!newRtw.evaluationDate) {
      toast({ title: 'Evaluation date required', variant: 'destructive' });
      return;
    }
    const body: Record<string, unknown> = {
      evaluationDate: new Date(newRtw.evaluationDate).toISOString(),
      status: newRtw.status,
      evaluatorName: newRtw.evaluatorName || undefined,
      releasedToWorkOn: newRtw.releasedToWorkOn
        ? new Date(newRtw.releasedToWorkOn).toISOString()
        : undefined,
      restrictions: newRtw.restrictions
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      followUpRequired: newRtw.followUpRequired,
      followUpDate: newRtw.followUpDate
        ? new Date(newRtw.followUpDate).toISOString()
        : undefined,
      notes: newRtw.notes || undefined,
    };
    const res = await fetch(`/api/injury/incidents/${incidentId}/rtw-evals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      toast({ title: 'RTW evaluation recorded' });
      setNewRtw({
        evaluationDate: '',
        status: 'full_duty',
        evaluatorName: '',
        releasedToWorkOn: '',
        restrictions: '',
        followUpRequired: false,
        followUpDate: '',
        notes: '',
      });
      fetchIncident();
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: 'Failed', description: err.error, variant: 'destructive' });
    }
  };

  const signOffRtw = async (rtwId: string) => {
    const res = await fetch(`/api/injury/rtw-evals/${rtwId}/sign-off`, { method: 'POST' });
    if (res.ok) {
      toast({ title: 'RTW signed off' });
      fetchIncident();
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: 'Failed', description: err.error, variant: 'destructive' });
    }
  };

  const uploadDocument = async (file: File, documentType: string) => {
    const fd = new FormData();
    fd.set('file', file);
    fd.set('documentType', documentType);
    const res = await fetch(`/api/injury/incidents/${incidentId}/documents`, {
      method: 'POST',
      body: fd,
    });
    if (res.ok) {
      toast({ title: 'Document uploaded' });
      fetchIncident();
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: 'Upload failed', description: err.error, variant: 'destructive' });
    }
  };

  const downloadDocument = async (docId: string) => {
    const res = await fetch(`/api/injury/documents/${docId}`);
    if (res.ok) {
      const data = await res.json();
      window.open(data.document.downloadUrl, '_blank');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!incident) {
    return (
      <div className="p-8 text-center">
        <p>Incident not found.</p>
        <Button className="mt-4" onClick={() => router.push('/injury/incidents')}>
          Back to list
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{incident.incidentNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {incident.person?.firstName} {incident.person?.lastName}
            {incident.clientOrg ? ` — ${incident.clientOrg.name}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge>{incident.status.replace(/_/g, ' ')}</Badge>
          <Badge>{incident.severity.replace(/_/g, ' ')}</Badge>
          {incident.oshaRecordable && (
            <Badge className="bg-red-100 text-red-800">OSHA Recordable</Badge>
          )}
        </div>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Incident Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Date of Injury:</span>{' '}
            {new Date(incident.incidentDate).toLocaleString()}
          </div>
          <div>
            <span className="text-muted-foreground">Job at incident:</span>{' '}
            {incident.jobAtIncident || '—'}
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Location:</span> {incident.location}
          </div>
          <div>
            <span className="text-muted-foreground">Injury Type:</span>{' '}
            {incident.injuryType.replace(/_/g, ' ')}
          </div>
          <div>
            <span className="text-muted-foreground">Body Parts:</span>{' '}
            {incident.bodyPartsAffected?.join(', ') || '—'}
          </div>
          <div>
            <span className="text-muted-foreground">Lost days / Restricted:</span>{' '}
            {incident.lostDaysCount} / {incident.restrictedDaysCount}
          </div>
          <div>
            <span className="text-muted-foreground">WC Claim:</span>{' '}
            {incident.workersCompClaimNumber || '—'}
            {incident.workersCompCarrier ? ` (${incident.workersCompCarrier})` : ''}
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Description:</span>
            <p className="mt-1 whitespace-pre-wrap">{incident.description}</p>
          </div>
          {incident.notes && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Notes:</span>
              <p className="mt-1 whitespace-pre-wrap">{incident.notes}</p>
            </div>
          )}
          {incident.internalNotes && (
            <div className="col-span-2 rounded-md bg-yellow-50 p-3 dark:bg-yellow-900/20">
              <span className="text-xs font-semibold text-yellow-800 dark:text-yellow-200">
                Internal notes (TPA only):
              </span>
              <p className="mt-1 whitespace-pre-wrap text-sm">{incident.internalNotes}</p>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Treatment Log</h2>
        {incident.treatments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No treatments recorded yet.</p>
        ) : (
          <ul className="space-y-3">
            {incident.treatments.map((t) => (
              <li key={t.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {new Date(t.treatmentDate).toLocaleDateString()} —{' '}
                    {t.providerType.replace(/_/g, ' ')}
                  </span>
                  {t.providerName && (
                    <span className="text-muted-foreground">{t.providerName}</span>
                  )}
                </div>
                {t.diagnosis && (
                  <div className="mt-1">
                    <span className="text-muted-foreground">Dx:</span> {t.diagnosis}
                  </div>
                )}
                {t.workRestrictions && (
                  <div className="mt-1">
                    <span className="text-muted-foreground">Restrictions:</span>{' '}
                    {t.workRestrictions}
                  </div>
                )}
                {t.nextVisitOn && (
                  <div className="mt-1">
                    <span className="text-muted-foreground">Next visit:</span>{' '}
                    {new Date(t.nextVisitOn).toLocaleDateString()}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 border-t pt-4">
          <h3 className="mb-2 font-medium">Record Treatment</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="tDate">Date & Time</Label>
              <Input
                id="tDate"
                type="datetime-local"
                value={newTreatment.treatmentDate}
                onChange={(e) =>
                  setNewTreatment({ ...newTreatment, treatmentDate: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tProvider">Provider Type</Label>
              <Select
                value={newTreatment.providerType}
                onValueChange={(v) =>
                  setNewTreatment({ ...newTreatment, providerType: v })
                }
              >
                <SelectTrigger id="tProvider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="er">ER</SelectItem>
                  <SelectItem value="urgent_care">Urgent Care</SelectItem>
                  <SelectItem value="primary_care">Primary Care</SelectItem>
                  <SelectItem value="specialist">Specialist</SelectItem>
                  <SelectItem value="physical_therapy">Physical Therapy</SelectItem>
                  <SelectItem value="occupational_medicine">Occ Med</SelectItem>
                  <SelectItem value="diagnostic">Diagnostic</SelectItem>
                  <SelectItem value="pharmacy">Pharmacy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="tProvName">Provider Name</Label>
              <Input
                id="tProvName"
                value={newTreatment.providerName}
                onChange={(e) =>
                  setNewTreatment({ ...newTreatment, providerName: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tDx">Diagnosis</Label>
              <Input
                id="tDx"
                value={newTreatment.diagnosis}
                onChange={(e) =>
                  setNewTreatment({ ...newTreatment, diagnosis: e.target.value })
                }
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="tRestr">Work Restrictions</Label>
              <Textarea
                id="tRestr"
                rows={2}
                value={newTreatment.workRestrictions}
                onChange={(e) =>
                  setNewTreatment({ ...newTreatment, workRestrictions: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tNext">Next Visit</Label>
              <Input
                id="tNext"
                type="datetime-local"
                value={newTreatment.nextVisitOn}
                onChange={(e) =>
                  setNewTreatment({ ...newTreatment, nextVisitOn: e.target.value })
                }
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="tNotes">Notes</Label>
              <Textarea
                id="tNotes"
                rows={2}
                value={newTreatment.notes}
                onChange={(e) =>
                  setNewTreatment({ ...newTreatment, notes: e.target.value })
                }
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={addTreatment}>Add Treatment</Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Return-to-Work Evaluations</h2>
        {incident.rtwEvals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No RTW evaluations yet.</p>
        ) : (
          <ul className="space-y-3">
            {incident.rtwEvals.map((r) => (
              <li key={r.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {new Date(r.evaluationDate).toLocaleDateString()} —{' '}
                    {r.status.replace(/_/g, ' ')}
                  </span>
                  {r.signedOffAt ? (
                    <Badge className="bg-green-100 text-green-800">
                      Signed off {new Date(r.signedOffAt).toLocaleDateString()}
                    </Badge>
                  ) : canSignOffRtw ? (
                    <Button size="sm" variant="outline" onClick={() => signOffRtw(r.id)}>
                      Sign off
                    </Button>
                  ) : null}
                </div>
                {r.evaluatorName && (
                  <div className="mt-1 text-muted-foreground">Evaluator: {r.evaluatorName}</div>
                )}
                {r.releasedToWorkOn && (
                  <div className="mt-1">
                    Released:{' '}
                    {new Date(r.releasedToWorkOn).toLocaleDateString()}
                  </div>
                )}
                {r.restrictions.length > 0 && (
                  <ul className="mt-1 list-disc pl-5">
                    {r.restrictions.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                )}
                {r.followUpRequired && r.followUpDate && (
                  <div className="mt-1 text-xs">
                    Follow-up: {new Date(r.followUpDate).toLocaleDateString()}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 border-t pt-4">
          <h3 className="mb-2 font-medium">Record Evaluation</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="rDate">Evaluation Date</Label>
              <Input
                id="rDate"
                type="datetime-local"
                value={newRtw.evaluationDate}
                onChange={(e) => setNewRtw({ ...newRtw, evaluationDate: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rStatus">Status</Label>
              <Select
                value={newRtw.status}
                onValueChange={(v) => setNewRtw({ ...newRtw, status: v as any })}
              >
                <SelectTrigger id="rStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_duty">Full Duty</SelectItem>
                  <SelectItem value="restricted_duty">Restricted Duty</SelectItem>
                  <SelectItem value="unable_to_work">Unable to Work</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rEval">Evaluator Name</Label>
              <Input
                id="rEval"
                value={newRtw.evaluatorName}
                onChange={(e) => setNewRtw({ ...newRtw, evaluatorName: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rReleased">Released on</Label>
              <Input
                id="rReleased"
                type="datetime-local"
                value={newRtw.releasedToWorkOn}
                onChange={(e) => setNewRtw({ ...newRtw, releasedToWorkOn: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="rRestr">Restrictions (one per line)</Label>
              <Textarea
                id="rRestr"
                rows={3}
                value={newRtw.restrictions}
                onChange={(e) => setNewRtw({ ...newRtw, restrictions: e.target.value })}
                placeholder={`No lifting over 10 lbs\nNo overhead work\n4-hour shifts`}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rFollowUp">Follow-up Date (optional)</Label>
              <Input
                id="rFollowUp"
                type="datetime-local"
                value={newRtw.followUpDate}
                onChange={(e) =>
                  setNewRtw({
                    ...newRtw,
                    followUpDate: e.target.value,
                    followUpRequired: !!e.target.value,
                  })
                }
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="rNotes">Notes</Label>
              <Textarea
                id="rNotes"
                rows={2}
                value={newRtw.notes}
                onChange={(e) => setNewRtw({ ...newRtw, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={addRtw}>Add RTW Evaluation</Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Documents</h2>
        {incident.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          <ul className="space-y-2">
            {incident.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <span className="font-medium">{d.fileName}</span>
                  <span className="ml-2 text-muted-foreground">
                    {d.documentType.replace(/_/g, ' ')}
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={() => downloadDocument(d.id)}>
                  Download
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 border-t pt-4">
          <label className="block text-sm font-medium">Upload Document</label>
          <div className="mt-2 flex items-center gap-2">
            <select
              id="docType"
              className="rounded-md border bg-background px-3 py-2 text-sm"
              defaultValue="incident_report"
            >
              <option value="incident_report">Incident Report</option>
              <option value="medical_record">Medical Record</option>
              <option value="wc_claim_form">WC Claim Form</option>
              <option value="osha_301">OSHA 301</option>
              <option value="rtw_note">RTW Note</option>
              <option value="imaging">Imaging</option>
              <option value="witness_statement">Witness Statement</option>
              <option value="photo">Photo</option>
              <option value="other">Other</option>
            </select>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                const typeSel = document.getElementById('docType') as HTMLSelectElement | null;
                if (file && typeSel) {
                  uploadDocument(file, typeSel.value);
                  e.target.value = '';
                }
              }}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
