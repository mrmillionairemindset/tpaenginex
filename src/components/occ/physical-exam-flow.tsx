'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Trash2, Plus, CheckCircle2, Lock } from 'lucide-react';

interface Props {
  examId: string;
  userRole: string;
  hasNrcme: boolean;
}

interface Exam {
  id: string;
  status: string;
  examType: string;
  examDate: string | null;
  person: { firstName: string; lastName: string };
}

interface Finding {
  id: string;
  category: string;
  description: string;
  action: string | null;
}

const STEPS = ['Health History', 'Vitals', 'Findings', 'Certify'] as const;
type StepIndex = 0 | 1 | 2 | 3;

const FINDING_CATEGORIES = [
  'hypertension_stage1',
  'hypertension_stage2',
  'hypertension_stage3',
  'diabetes_insulin',
  'diabetes_non_insulin',
  'cardiovascular_stable',
  'cardiovascular_unstable',
  'sleep_apnea_osa',
  'sleep_apnea_untreated',
  'copd',
  'asthma_controlled',
  'vision_monocular',
  'vision_corrected',
  'hearing_aid',
  'hearing_impaired',
  'musculoskeletal_limb',
  'neurological_seizure',
  'neurological_stable',
  'psychiatric_controlled',
  'psychiatric_active',
  'other',
];

// ----------------------------------------------------------------------------
// Step 1: Health History
// ----------------------------------------------------------------------------
function HealthHistoryStep({
  examId,
  onSaved,
}: {
  examId: string;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [conditions, setConditions] = useState<string[]>([]);
  const [medications, setMedications] = useState<Array<{ name: string; dose: string; condition: string }>>([
    { name: '', dose: '', condition: '' },
  ]);
  const [surgeries, setSurgeries] = useState<string>('');
  const [tobacco, setTobacco] = useState('');
  const [alcohol, setAlcohol] = useState('');
  const [illegalDrugs, setIllegalDrugs] = useState('');
  const [hasCommercialLicense, setHasCommercialLicense] = useState(false);
  const [yearsExperience, setYearsExperience] = useState<number | ''>('');
  const [additional, setAdditional] = useState('');
  const [driverSignature, setDriverSignature] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/occ/physicals/${examId}/health-history`);
        if (res.ok) {
          const data = await res.json();
          const payload = data.healthHistory?.data;
          if (payload) {
            setConditions(Array.isArray(payload.conditions) ? payload.conditions.map((c: any) => c.name || '') : []);
            setMedications(Array.isArray(payload.medications) && payload.medications.length > 0 ? payload.medications : [{ name: '', dose: '', condition: '' }]);
            setSurgeries(
              Array.isArray(payload.surgeries)
                ? payload.surgeries.map((s: any) => s.procedure).join('\n')
                : '',
            );
            if (payload.substanceUse) {
              setTobacco(payload.substanceUse.tobacco || '');
              setAlcohol(payload.substanceUse.alcohol || '');
              setIllegalDrugs(payload.substanceUse.illegalDrugs || '');
            }
            if (payload.drivingHistory) {
              setHasCommercialLicense(Boolean(payload.drivingHistory.hasCommercialLicense));
              setYearsExperience(
                typeof payload.drivingHistory.yearsExperience === 'number'
                  ? payload.drivingHistory.yearsExperience
                  : '',
              );
            }
            if (payload.additional?.notes) setAdditional(payload.additional.notes);
          }
          if (data.healthHistory?.driverSignature) setDriverSignature(data.healthHistory.driverSignature);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [examId]);

  const toggleCondition = (name: string) => {
    setConditions((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));
  };

  const addMedication = () => setMedications((prev) => [...prev, { name: '', dose: '', condition: '' }]);
  const removeMedication = (idx: number) => setMedications((prev) => prev.filter((_, i) => i !== idx));
  const updateMedication = (idx: number, field: 'name' | 'dose' | 'condition', value: string) => {
    setMedications((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  };

  const save = async (sign: boolean) => {
    setSaving(true);
    try {
      const data = {
        conditions: conditions.map((name) => ({ name, currentlyTreated: true })),
        medications: medications.filter((m) => m.name.trim()),
        surgeries: surgeries
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => ({ procedure: line })),
        substanceUse: { tobacco, alcohol, illegalDrugs },
        drivingHistory: {
          hasCommercialLicense,
          yearsExperience: typeof yearsExperience === 'number' ? yearsExperience : undefined,
        },
        additional: { notes: additional },
      };
      const body: Record<string, unknown> = { data };
      if (sign && driverSignature.trim()) body.driverSignature = driverSignature.trim();

      const res = await fetch(`/api/occ/physicals/${examId}/health-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      toast({ title: 'Health history saved' });
      onSaved();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-6"><LoadingSpinner size="md" /></div>;
  }

  const commonConditions = [
    'Hypertension', 'Diabetes', 'Heart Disease', 'Lung Disease', 'Sleep Apnea',
    'Kidney Disease', 'Seizures / Epilepsy', 'Mental Health Condition',
    'Hearing Loss', 'Vision Loss', 'Musculoskeletal Condition',
  ];

  return (
    <Card className="p-6 space-y-6">
      <div>
        <Label>Medical Conditions (check all that currently apply)</Label>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
          {commonConditions.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={conditions.includes(c)}
                onChange={() => toggleCondition(c)}
              />
              {c}
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label>Current Medications</Label>
          <Button type="button" variant="outline" size="sm" onClick={addMedication}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
        <div className="mt-2 space-y-2">
          {medications.map((m, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <Input
                className="col-span-4"
                placeholder="Medication name"
                value={m.name}
                onChange={(e) => updateMedication(i, 'name', e.target.value)}
              />
              <Input
                className="col-span-3"
                placeholder="Dose"
                value={m.dose}
                onChange={(e) => updateMedication(i, 'dose', e.target.value)}
              />
              <Input
                className="col-span-4"
                placeholder="Condition"
                value={m.condition}
                onChange={(e) => updateMedication(i, 'condition', e.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="col-span-1"
                onClick={() => removeMedication(i)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="surgeries">Surgeries / Hospitalizations (one per line)</Label>
        <Textarea
          id="surgeries"
          rows={3}
          value={surgeries}
          onChange={(e) => setSurgeries(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label htmlFor="tobacco">Tobacco use</Label>
          <Input id="tobacco" value={tobacco} onChange={(e) => setTobacco(e.target.value)} placeholder="None / 1ppd / etc." />
        </div>
        <div className="space-y-1">
          <Label htmlFor="alcohol">Alcohol use</Label>
          <Input id="alcohol" value={alcohol} onChange={(e) => setAlcohol(e.target.value)} placeholder="None / Occasional / etc." />
        </div>
        <div className="space-y-1">
          <Label htmlFor="illegal">Illegal drug use</Label>
          <Input id="illegal" value={illegalDrugs} onChange={(e) => setIllegalDrugs(e.target.value)} placeholder="None" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasCommercialLicense}
            onChange={(e) => setHasCommercialLicense(e.target.checked)}
          />
          Has Commercial Driver License
        </label>
        <div className="space-y-1">
          <Label htmlFor="yearsExperience">Years Driving Experience</Label>
          <Input
            id="yearsExperience"
            type="number"
            min={0}
            max={60}
            value={yearsExperience}
            onChange={(e) => setYearsExperience(e.target.value ? Number(e.target.value) : '')}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="additional">Additional notes from driver</Label>
        <Textarea
          id="additional"
          rows={2}
          value={additional}
          onChange={(e) => setAdditional(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="signature">Driver Signature (base64 data URL or printed name)</Label>
        <Input
          id="signature"
          value={driverSignature}
          onChange={(e) => setDriverSignature(e.target.value)}
          placeholder="Typed name or signature data URL"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => save(false)} disabled={saving}>
          Save Draft
        </Button>
        <Button onClick={() => save(true)} disabled={saving || !driverSignature.trim()}>
          Save &amp; Mark Signed
        </Button>
      </div>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Step 2: Vitals
// ----------------------------------------------------------------------------
function VitalsStep({ examId, onSaved }: { examId: string; onSaved: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState<any>({
    heightInches: '',
    weightPounds: '',
    bpSystolic: '',
    bpDiastolic: '',
    pulse: '',
    wearsCorrectiveLenses: false,
    visionRightCorrected: '',
    visionLeftCorrected: '',
    visionBothCorrected: '',
    horizontalFieldOfVisionRight: '',
    horizontalFieldOfVisionLeft: '',
    colorVisionAdequate: true,
    hearingRight: 'passed_whisper',
    hearingLeft: 'passed_whisper',
    urineProtein: 'negative',
    urineBlood: 'negative',
    urineSugar: 'negative',
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/occ/physicals/${examId}/vitals`);
        if (res.ok) {
          const data = await res.json();
          if (data.vitals) {
            setF((prev: any) => ({
              ...prev,
              ...Object.fromEntries(
                Object.entries(data.vitals).map(([k, v]) => [k, v === null ? '' : v]),
              ),
            }));
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [examId]);

  const bmi = useMemo(() => {
    const h = Number(f.heightInches);
    const w = Number(f.weightPounds);
    if (!h || !w) return null;
    return Math.round(((w / (h * h)) * 703) * 10) / 10;
  }, [f.heightInches, f.weightPounds]);

  const save = async () => {
    setSaving(true);
    try {
      const toNum = (v: any) => (v === '' || v == null ? undefined : Number(v));
      const body = {
        heightInches: toNum(f.heightInches),
        weightPounds: toNum(f.weightPounds),
        bpSystolic: toNum(f.bpSystolic),
        bpDiastolic: toNum(f.bpDiastolic),
        pulse: toNum(f.pulse),
        wearsCorrectiveLenses: Boolean(f.wearsCorrectiveLenses),
        visionRightCorrected: f.visionRightCorrected || undefined,
        visionLeftCorrected: f.visionLeftCorrected || undefined,
        visionBothCorrected: f.visionBothCorrected || undefined,
        horizontalFieldOfVisionRight: toNum(f.horizontalFieldOfVisionRight),
        horizontalFieldOfVisionLeft: toNum(f.horizontalFieldOfVisionLeft),
        colorVisionAdequate: Boolean(f.colorVisionAdequate),
        hearingRight: f.hearingRight || undefined,
        hearingLeft: f.hearingLeft || undefined,
        urineProtein: f.urineProtein || undefined,
        urineBlood: f.urineBlood || undefined,
        urineSugar: f.urineSugar || undefined,
      };
      const res = await fetch(`/api/occ/physicals/${examId}/vitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      const data = await res.json();
      if (data.autoFindingCategory) {
        toast({
          title: 'Vitals saved',
          description: `Auto-added finding: ${data.autoFindingCategory.replace(/_/g, ' ')}`,
        });
      } else {
        toast({ title: 'Vitals saved' });
      }
      onSaved();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-6"><LoadingSpinner size="md" /></div>;

  const upd = (k: string, v: any) => setF((prev: any) => ({ ...prev, [k]: v }));

  return (
    <Card className="p-6 space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-1">
          <Label>Height (in)</Label>
          <Input type="number" value={f.heightInches} onChange={(e) => upd('heightInches', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Weight (lb)</Label>
          <Input type="number" value={f.weightPounds} onChange={(e) => upd('weightPounds', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>BMI</Label>
          <div className="h-10 flex items-center text-sm font-semibold">
            {bmi !== null ? bmi : '—'}
            {bmi !== null && bmi >= 40 && (
              <Badge className="ml-2 bg-yellow-100 text-yellow-800">OSA screen</Badge>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <Label>Pulse (bpm)</Label>
          <Input type="number" value={f.pulse} onChange={(e) => upd('pulse', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label>BP Systolic</Label>
          <Input type="number" value={f.bpSystolic} onChange={(e) => upd('bpSystolic', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>BP Diastolic</Label>
          <Input type="number" value={f.bpDiastolic} onChange={(e) => upd('bpDiastolic', e.target.value)} />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={f.wearsCorrectiveLenses}
            onChange={(e) => upd('wearsCorrectiveLenses', e.target.checked)}
          />
          <Label>Wears corrective lenses</Label>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label>Vision R (corrected)</Label>
          <Input placeholder="20/40" value={f.visionRightCorrected} onChange={(e) => upd('visionRightCorrected', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Vision L (corrected)</Label>
          <Input placeholder="20/40" value={f.visionLeftCorrected} onChange={(e) => upd('visionLeftCorrected', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Vision Both (corrected)</Label>
          <Input placeholder="20/40" value={f.visionBothCorrected} onChange={(e) => upd('visionBothCorrected', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Horizontal FOV R (degrees)</Label>
          <Input type="number" value={f.horizontalFieldOfVisionRight} onChange={(e) => upd('horizontalFieldOfVisionRight', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Horizontal FOV L (degrees)</Label>
          <Input type="number" value={f.horizontalFieldOfVisionLeft} onChange={(e) => upd('horizontalFieldOfVisionLeft', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Hearing R</Label>
          <Select value={f.hearingRight} onValueChange={(v) => upd('hearingRight', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="passed_whisper">Passed whisper</SelectItem>
              <SelectItem value="audiometric_20db">Audiometric 20dB</SelectItem>
              <SelectItem value="hearing_aid">Hearing aid required</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Hearing L</Label>
          <Select value={f.hearingLeft} onValueChange={(v) => upd('hearingLeft', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="passed_whisper">Passed whisper</SelectItem>
              <SelectItem value="audiometric_20db">Audiometric 20dB</SelectItem>
              <SelectItem value="hearing_aid">Hearing aid required</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label>Urine Protein</Label>
          <Input value={f.urineProtein} onChange={(e) => upd('urineProtein', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Urine Blood</Label>
          <Input value={f.urineBlood} onChange={(e) => upd('urineBlood', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Urine Sugar</Label>
          <Input value={f.urineSugar} onChange={(e) => upd('urineSugar', e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Vitals'}
        </Button>
      </div>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Step 3: Findings
// ----------------------------------------------------------------------------
function FindingsStep({ examId, onChanged }: { examId: string; onChanged: () => void }) {
  const { toast } = useToast();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState<string>('other');
  const [description, setDescription] = useState('');
  const [action, setAction] = useState('');

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/occ/physicals/${examId}/findings`);
      if (res.ok) {
        const data = await res.json();
        setFindings(data.findings || []);
      }
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => { refresh(); }, [refresh]);

  const addFinding = async () => {
    if (!description.trim()) {
      toast({ title: 'Description required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/occ/physicals/${examId}/findings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, description: description.trim(), action: action.trim() || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      setDescription('');
      setAction('');
      setCategory('other');
      await refresh();
      onChanged();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const removeFinding = async (id: string) => {
    if (!confirm('Remove this finding?')) return;
    const res = await fetch(`/api/occ/physicals/${examId}/findings/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await refresh();
      onChanged();
    }
  };

  if (loading) return <div className="flex items-center justify-center py-6"><LoadingSpinner size="md" /></div>;

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">Current Findings</h3>
        {findings.length === 0 ? (
          <div className="text-sm text-muted-foreground">No findings recorded. Healthy driver.</div>
        ) : (
          <div className="space-y-2">
            {findings.map((f) => (
              <div key={f.id} className="flex items-start justify-between rounded-md border p-3">
                <div className="text-sm">
                  <div className="font-medium">{f.category.replace(/_/g, ' ')}</div>
                  <div className="text-muted-foreground">{f.description}</div>
                  {f.action && <div className="text-xs mt-1">Action: {f.action}</div>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeFinding(f.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold mb-2">Add Finding</h3>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FINDING_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Action / Recommendation (optional)</Label>
            <Input value={action} onChange={(e) => setAction(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button onClick={addFinding} disabled={saving}>
              <Plus className="mr-2 h-4 w-4" /> Add Finding
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Step 4: Certify
// ----------------------------------------------------------------------------
function CertifyStep({
  examId,
  hasNrcme,
  onCertified,
}: {
  examId: string;
  hasNrcme: boolean;
  onCertified: () => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [certifying, setCertifying] = useState(false);
  const [preview, setPreview] = useState<{
    durationMonths: number;
    decision: string;
    reason: string;
    restrictions: string[];
  } | null>(null);
  const [overrideMonths, setOverrideMonths] = useState<string>('');
  const [overrideDecision, setOverrideDecision] = useState<string>('');
  const [extraRestrictions, setExtraRestrictions] = useState<string>('');

  const refresh = useCallback(async () => {
    // Use the findings list to compute preview client-side via a call to calculate equivalent
    const res = await fetch(`/api/occ/physicals/${examId}/findings`);
    if (!res.ok) return;
    const data = await res.json();
    // Mini client-side computation matching the server's logic approximate preview
    // For accuracy we would replicate calculateMecDuration, but we keep a simple summary;
    // the real calculation is server-side at certify time.
    const findings = data.findings as Finding[];
    const decisions: string[] = [];
    let months = 24;
    let decision = 'medically_qualified';
    const restrictions: string[] = [];
    const shortest = (m: number, why: string) => {
      if (m < months) {
        months = m;
        decisions.push(why);
      }
    };
    for (const f of findings) {
      switch (f.category) {
        case 'hypertension_stage1': shortest(12, 'Stage 1 HTN'); break;
        case 'hypertension_stage2': shortest(12, 'Stage 2 HTN'); decision = 'qualified_with_restrictions'; break;
        case 'hypertension_stage3': shortest(3, 'Stage 3 HTN'); decision = 'temporarily_disqualified'; months = 0; break;
        case 'diabetes_insulin': shortest(12, 'Insulin DM'); decision = 'qualified_with_restrictions'; restrictions.push('Insulin federal exemption required'); break;
        case 'diabetes_non_insulin': shortest(12, 'Non-insulin DM'); break;
        case 'cardiovascular_stable': shortest(12, 'CV stable'); decision = 'qualified_with_restrictions'; break;
        case 'cardiovascular_unstable': months = 0; decision = 'disqualified'; break;
        case 'sleep_apnea_osa': shortest(12, 'OSA on CPAP'); decision = 'qualified_with_restrictions'; restrictions.push('CPAP compliance'); break;
        case 'sleep_apnea_untreated': months = 0; decision = 'temporarily_disqualified'; break;
        case 'vision_corrected': restrictions.push('Corrective lenses'); if (decision === 'medically_qualified') decision = 'qualified_with_restrictions'; break;
        case 'vision_monocular': decision = 'qualified_with_restrictions'; restrictions.push('Vision exemption required'); break;
        case 'hearing_aid': restrictions.push('Hearing aid'); if (decision === 'medically_qualified') decision = 'qualified_with_restrictions'; break;
        case 'neurological_seizure': months = 0; decision = 'disqualified'; break;
        case 'psychiatric_active': months = 0; decision = 'disqualified'; break;
      }
    }
    setPreview({
      durationMonths: months,
      decision,
      reason: decisions.length > 0 ? decisions.join('; ') : 'Standard 2-year certification',
      restrictions: Array.from(new Set(restrictions)),
    });
  }, [examId]);

  useEffect(() => { refresh(); }, [refresh]);

  const certify = async () => {
    if (!hasNrcme) {
      toast({
        title: 'NRCME required',
        description: 'Your account does not have an NRCME number on file.',
        variant: 'destructive',
      });
      return;
    }

    setCertifying(true);
    try {
      const body: Record<string, unknown> = {};
      if (overrideMonths.trim()) body.overrideMonths = Number(overrideMonths);
      if (overrideDecision.trim()) body.overrideDecision = overrideDecision;
      const extras = extraRestrictions
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (extras.length > 0 && preview) {
        body.overrideRestrictions = Array.from(new Set([...preview.restrictions, ...extras]));
      }

      const res = await fetch(`/api/occ/physicals/${examId}/certify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      const data = await res.json();
      toast({
        title: 'Certified',
        description: `MEC ${data.certificate.number} issued.`,
      });
      onCertified();
      router.push(`/occ/physicals/${examId}`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCertifying(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      {!hasNrcme && (
        <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
          <Lock className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            Certification requires an NRCME number. Your user profile does not have one — a certified
            medical examiner must sign in to complete this step.
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold mb-2">Calculated Certification</h3>
        {preview ? (
          <div className="rounded-md border p-4 text-sm space-y-1">
            <div>
              <span className="text-muted-foreground">Decision:</span>{' '}
              <Badge>{preview.decision.replace(/_/g, ' ')}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Duration:</span>{' '}
              <span className="font-semibold">
                {preview.durationMonths === 0 ? 'Not certified' : `${preview.durationMonths} months`}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Reason:</span> {preview.reason}
            </div>
            {preview.restrictions.length > 0 && (
              <div>
                <div className="text-muted-foreground">Restrictions:</div>
                <ul className="list-disc list-inside">
                  {preview.restrictions.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Loading preview…</div>
        )}
      </div>

      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold mb-2">Examiner Overrides (optional)</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Override duration (months)</Label>
            <Input
              type="number"
              min={0}
              max={24}
              placeholder={preview ? String(preview.durationMonths) : ''}
              value={overrideMonths}
              onChange={(e) => setOverrideMonths(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Override decision</Label>
            <Select value={overrideDecision} onValueChange={setOverrideDecision}>
              <SelectTrigger><SelectValue placeholder="Use calculated" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="medically_qualified">Medically qualified</SelectItem>
                <SelectItem value="qualified_with_restrictions">Qualified with restrictions</SelectItem>
                <SelectItem value="temporarily_disqualified">Temporarily disqualified</SelectItem>
                <SelectItem value="disqualified">Disqualified</SelectItem>
                <SelectItem value="pending_evaluation">Pending evaluation</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1 mt-3">
          <Label>Additional restrictions (one per line)</Label>
          <Textarea
            rows={2}
            placeholder="e.g., Must wear corrective lenses"
            value={extraRestrictions}
            onChange={(e) => setExtraRestrictions(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={certify} disabled={certifying || !hasNrcme}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {certifying ? 'Certifying...' : 'Certify & Issue MEC'}
        </Button>
      </div>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Main wizard
// ----------------------------------------------------------------------------
export function PhysicalExamFlow({ examId, userRole, hasNrcme }: Props) {
  const router = useRouter();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<StepIndex>(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchExam = useCallback(async () => {
    try {
      const res = await fetch(`/api/occ/physicals/${examId}`);
      if (res.ok) {
        const data = await res.json();
        setExam(data.exam);
      }
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => { fetchExam(); }, [fetchExam, refreshKey]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" /></div>;
  }
  if (!exam) return <div className="p-6">Exam not found</div>;

  if (exam.status === 'completed' || exam.status === 'abandoned') {
    return (
      <div className="p-6">
        <Card className="p-6">
          <div className="text-sm">
            This exam has status <Badge>{exam.status}</Badge> and cannot be modified.
          </div>
          <Button className="mt-4" onClick={() => router.push(`/occ/physicals/${examId}`)}>
            Back to Detail
          </Button>
        </Card>
      </div>
    );
  }

  const driverName = `${exam.person.firstName} ${exam.person.lastName}`;

  return (
    <div>
      <PageHeader
        title={`Exam in Progress — ${driverName}`}
        description={`${exam.examType.toUpperCase()} · Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
      />

      <div className="my-4 flex gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => setStep(i as StepIndex)}
            className={
              'px-3 py-1.5 text-sm rounded-md border ' +
              (step === i ? 'bg-primary text-white border-primary' : 'bg-muted/40 hover:bg-muted')
            }
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <HealthHistoryStep examId={examId} onSaved={() => setStep(1)} />
      )}
      {step === 1 && (
        <VitalsStep examId={examId} onSaved={() => { setRefreshKey((k) => k + 1); setStep(2); }} />
      )}
      {step === 2 && (
        <FindingsStep examId={examId} onChanged={() => setRefreshKey((k) => k + 1)} />
      )}
      {step === 3 && (
        <CertifyStep examId={examId} hasNrcme={hasNrcme} onCertified={() => setRefreshKey((k) => k + 1)} />
      )}

      <div className="mt-4 flex justify-between">
        <Button variant="outline" onClick={() => setStep((s) => (Math.max(0, s - 1) as StepIndex))} disabled={step === 0}>
          Previous
        </Button>
        {step < 3 && (
          <Button onClick={() => setStep((s) => (Math.min(3, s + 1) as StepIndex))}>
            Next Step
          </Button>
        )}
      </div>
    </div>
  );
}
