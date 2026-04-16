'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Save, RotateCcw } from 'lucide-react';

interface TemplateMeta {
  key: string;
  label: string;
  vars: string[];
}

interface Template {
  id: string;
  tpaOrgId: string;
  templateKey: string;
  subject: string | null;
  bodyHtml: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export function EmailTemplatesEditor() {
  const { toast } = useToast();
  const [available, setAvailable] = useState<TemplateMeta[]>([]);
  const [templates, setTemplates] = useState<Record<string, Template | null>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');

  useEffect(() => {
    fetchList();
  }, []);

  async function fetchList() {
    setLoading(true);
    try {
      const res = await fetch('/api/email-templates');
      if (res.ok) {
        const data = await res.json();
        setAvailable(data.available || []);
        const byKey: Record<string, Template | null> = {};
        for (const t of data.templates || []) {
          byKey[t.templateKey] = t;
        }
        setTemplates(byKey);
        const firstKey = (data.available && data.available[0]?.key) || null;
        if (firstKey) {
          selectKey(firstKey, byKey);
        }
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to load templates', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function selectKey(key: string, byKey: Record<string, Template | null> = templates) {
    setSelectedKey(key);
    const t = byKey[key];
    setSubject(t?.subject ?? '');
    setBodyHtml(t?.bodyHtml ?? '');
  }

  async function handleSave() {
    if (!selectedKey) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/email-templates/${selectedKey}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, bodyHtml }),
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates((prev) => ({ ...prev, [selectedKey]: data.template }));
        toast({ title: 'Template Saved', description: 'Custom template updated.' });
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error || 'Failed to save', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Unexpected error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!selectedKey) return;
    if (!confirm('Reset to default? This clears your custom subject/body and falls back to built-in copy.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/email-templates/${selectedKey}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: null, bodyHtml: null }),
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates((prev) => ({ ...prev, [selectedKey]: data.template }));
        setSubject('');
        setBodyHtml('');
        toast({ title: 'Reset to Default', description: 'Built-in copy will be used.' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Unexpected error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  const meta = available.find((m) => m.key === selectedKey);
  const currentTemplate = selectedKey ? templates[selectedKey] : null;
  const isCustomized = !!(currentTemplate?.subject || currentTemplate?.bodyHtml);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <Card className="p-4 md:col-span-1 h-fit">
        <h3 className="font-medium mb-3">Templates</h3>
        <div className="space-y-1">
          {available.map((m) => {
            const customized = !!(templates[m.key]?.subject || templates[m.key]?.bodyHtml);
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => selectKey(m.key)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  selectedKey === m.key ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{m.label}</span>
                  {customized && (
                    <Badge variant="secondary" className="text-[10px] h-5">Custom</Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="md:col-span-3 space-y-4">
        {selectedKey && meta ? (
          <>
            <Card className="p-4 bg-primary/5 border-primary/20">
              <h3 className="font-medium text-primary mb-2">Available Variables</h3>
              <div className="flex flex-wrap gap-2">
                {meta.vars.map((v) => (
                  <code key={v} className="px-2 py-1 bg-background rounded text-xs font-mono">
                    {`{{${v}}}`}
                  </code>
                ))}
              </div>
              <p className="text-xs text-primary/70 mt-2">
                Variables are replaced with real values at send time. Leave fields blank to use the platform default copy.
              </p>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold">{meta.label}</h2>
                  <p className="text-xs text-muted-foreground">
                    Key: <code className="font-mono">{meta.key}</code>
                    {isCustomized ? ' — customized' : ' — using default'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="(leave blank for default)"
                  />
                </div>

                <div>
                  <Label htmlFor="body">Body (HTML)</Label>
                  <Textarea
                    id="body"
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    rows={14}
                    placeholder="(leave blank for default)"
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    disabled={saving || !isCustomized}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset to Default
                  </Button>

                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Template'}
                  </Button>
                </div>
              </div>
            </Card>
          </>
        ) : (
          <Card className="p-12 text-center text-muted-foreground">
            Select a template to edit.
          </Card>
        )}
      </div>
    </div>
  );
}
