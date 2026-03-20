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
import { Save, Plus, ToggleLeft, ToggleRight } from 'lucide-react';

type LeadStage =
  | 'new_lead'
  | 'outreach_sent'
  | 'proposal_sent'
  | 'follow_up'
  | 'contract_sent'
  | 'closed_won'
  | 'closed_lost';

interface Template {
  id: string;
  stage: LeadStage;
  subject: string;
  body: string;
  isActive: boolean;
  delayMinutes: number;
  createdAt: string;
  updatedAt: string;
}

const STAGE_ORDER: LeadStage[] = [
  'outreach_sent',
  'proposal_sent',
  'follow_up',
  'contract_sent',
  'closed_won',
  'closed_lost',
];

const STAGE_LABELS: Record<LeadStage, string> = {
  new_lead: 'New Lead',
  outreach_sent: 'Outreach Sent',
  proposal_sent: 'Proposal Sent',
  follow_up: 'Follow Up',
  contract_sent: 'Contract Sent',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

const STAGE_STYLES: Record<LeadStage, string> = {
  new_lead: 'bg-muted text-foreground',
  outreach_sent: 'bg-primary/10 text-primary',
  proposal_sent: 'bg-accent/10 text-accent',
  follow_up: 'bg-amber-100 text-amber-800',
  contract_sent: 'bg-cyan-100 text-cyan-800',
  closed_won: 'bg-green-100 text-green-800',
  closed_lost: 'bg-red-100 text-red-800',
};

const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  outreach_sent: {
    subject: 'Introduction from {{tpaName}}',
    body: 'Hi {{contactName}},\n\nI wanted to introduce {{tpaName}} and our drug testing coordination services. We help companies like {{companyName}} streamline their workplace testing programs with reliable, compliant, and hassle-free service.\n\nI\'d love to schedule a quick call to learn more about your needs. Would you have 15 minutes this week?\n\nBest regards,\n{{tpaName}}',
  },
  proposal_sent: {
    subject: 'Proposal for {{companyName}} from {{tpaName}}',
    body: 'Hi {{contactName}},\n\nPlease find our service proposal attached. We\'ve tailored this based on what we know about {{companyName}}\'s needs.\n\nKey highlights:\n- Nationwide testing network\n- DOT and non-DOT programs\n- Dedicated account management\n- Fast turnaround on results\n\nPlease don\'t hesitate to reach out with any questions.\n\nBest regards,\n{{tpaName}}',
  },
  follow_up: {
    subject: 'Following up -- {{tpaName}}',
    body: 'Hi {{contactName}},\n\nI wanted to follow up on our previous conversation about drug testing services for {{companyName}}.\n\nIs there anything else you need from us to move forward? We\'re happy to answer any questions or adjust our proposal.\n\nLooking forward to hearing from you.\n\nBest regards,\n{{tpaName}}',
  },
  contract_sent: {
    subject: 'Service Agreement -- {{tpaName}} + {{companyName}}',
    body: 'Hi {{contactName}},\n\nPlease review the attached service agreement between {{tpaName}} and {{companyName}}. Once signed, we can begin onboarding your team right away.\n\nIf you have any questions about the terms, please don\'t hesitate to reach out.\n\nBest regards,\n{{tpaName}}',
  },
  closed_won: {
    subject: 'Welcome to {{tpaName}}!',
    body: 'Hi {{contactName}},\n\nWe\'re excited to have {{companyName}} on board! Our team will be reaching out shortly to begin the onboarding process.\n\nHere\'s what to expect next:\n- Account setup and configuration\n- Training for your team\n- First order scheduling\n\nWelcome to the {{tpaName}} family!\n\nBest regards,\n{{tpaName}}',
  },
  closed_lost: {
    subject: 'Thank you -- {{tpaName}}',
    body: 'Hi {{contactName}},\n\nThank you for considering {{tpaName}} for your drug testing needs. While we weren\'t the right fit this time, we\'d love to stay in touch in case your needs change in the future.\n\nWishing {{companyName}} all the best.\n\nBest regards,\n{{tpaName}}',
  },
};

export function LeadTemplatesEditor() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creatingDefaults, setCreatingDefaults] = useState(false);
  const [editState, setEditState] = useState<Record<string, { subject: string; body: string; delayMinutes: number }>>({});

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    try {
      const response = await fetch('/api/leads/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
        // Initialize edit state
        const state: Record<string, { subject: string; body: string; delayMinutes: number }> = {};
        for (const t of data.templates || []) {
          state[t.id] = { subject: t.subject, body: t.body, delayMinutes: t.delayMinutes };
        }
        setEditState(state);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load templates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(templateId: string) {
    const edits = editState[templateId];
    if (!edits) return;

    setSavingId(templateId);
    try {
      const response = await fetch(`/api/leads/templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: edits.subject,
          body: edits.body,
          delayMinutes: edits.delayMinutes,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates((prev) =>
          prev.map((t) => (t.id === templateId ? data.template : t))
        );
        toast({ title: 'Template Saved', description: 'Email template has been updated' });
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to save template',
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
      setSavingId(null);
    }
  }

  async function handleToggleActive(templateId: string, currentActive: boolean) {
    setSavingId(templateId);
    try {
      const response = await fetch(`/api/leads/templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates((prev) =>
          prev.map((t) => (t.id === templateId ? data.template : t))
        );
        toast({
          title: !currentActive ? 'Template Activated' : 'Template Deactivated',
          description: !currentActive
            ? 'Emails will be sent when leads reach this stage'
            : 'Emails will not be sent for this stage',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to toggle template',
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  }

  async function handleCreateDefaults() {
    setCreatingDefaults(true);
    try {
      for (const stage of STAGE_ORDER) {
        const defaults = DEFAULT_TEMPLATES[stage];
        if (!defaults) continue;

        // Skip if a template already exists for this stage
        if (templates.some((t) => t.stage === stage)) continue;

        const response = await fetch('/api/leads/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stage,
            subject: defaults.subject,
            body: defaults.body,
            delayMinutes: 0,
            isActive: true,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error(`Failed to create template for ${stage}:`, error);
        }
      }

      // Refresh templates
      await fetchTemplates();
      toast({
        title: 'Default Templates Created',
        description: 'Email templates have been created for all pipeline stages',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create default templates',
        variant: 'destructive',
      });
    } finally {
      setCreatingDefaults(false);
    }
  }

  function updateEdit(templateId: string, field: string, value: string | number) {
    setEditState((prev) => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        [field]: value,
      },
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  const hasAllTemplates = STAGE_ORDER.every((stage) =>
    templates.some((t) => t.stage === stage)
  );

  return (
    <div className="space-y-6">
      {/* Placeholder help */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <h3 className="font-medium text-primary mb-2">Available Placeholders</h3>
        <div className="flex flex-wrap gap-2">
          <code className="px-2 py-1 bg-background rounded text-xs font-mono">{'{{companyName}}'}</code>
          <code className="px-2 py-1 bg-background rounded text-xs font-mono">{'{{contactName}}'}</code>
          <code className="px-2 py-1 bg-background rounded text-xs font-mono">{'{{contactEmail}}'}</code>
          <code className="px-2 py-1 bg-background rounded text-xs font-mono">{'{{tpaName}}'}</code>
        </div>
        <p className="text-xs text-primary/70 mt-2">
          These placeholders will be replaced with actual values when the email is sent.
        </p>
      </Card>

      {/* Create defaults button */}
      {!hasAllTemplates && (
        <div className="flex justify-end">
          <Button onClick={handleCreateDefaults} disabled={creatingDefaults}>
            <Plus className="h-4 w-4 mr-2" />
            {creatingDefaults ? 'Creating...' : 'Create Default Templates'}
          </Button>
        </div>
      )}

      {templates.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground mb-4">
            No email templates configured yet. Create default templates to get started.
          </p>
          <Button onClick={handleCreateDefaults} disabled={creatingDefaults}>
            <Plus className="h-4 w-4 mr-2" />
            {creatingDefaults ? 'Creating...' : 'Create Default Templates'}
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {STAGE_ORDER.map((stage) => {
            const template = templates.find((t) => t.stage === stage);
            if (!template) return null;

            const edits = editState[template.id] || {
              subject: template.subject,
              body: template.body,
              delayMinutes: template.delayMinutes,
            };

            return (
              <Card key={template.id} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Badge
                      className={`${STAGE_STYLES[stage]} font-medium`}
                      variant="secondary"
                    >
                      {STAGE_LABELS[stage]}
                    </Badge>
                    {template.isActive ? (
                      <span className="text-xs text-green-600 font-medium">Active</span>
                    ) : (
                      <span className="text-xs text-muted-foreground font-medium">Inactive</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(template.id, template.isActive)}
                    disabled={savingId === template.id}
                  >
                    {template.isActive ? (
                      <ToggleRight className="h-5 w-5 text-green-600" />
                    ) : (
                      <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="ml-1 text-xs">
                      {template.isActive ? 'Disable' : 'Enable'}
                    </span>
                  </Button>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor={`subject-${template.id}`}>Subject</Label>
                    <Input
                      id={`subject-${template.id}`}
                      value={edits.subject}
                      onChange={(e) => updateEdit(template.id, 'subject', e.target.value)}
                      placeholder="Email subject..."
                    />
                  </div>

                  <div>
                    <Label htmlFor={`body-${template.id}`}>Body</Label>
                    <Textarea
                      id={`body-${template.id}`}
                      value={edits.body}
                      onChange={(e) => updateEdit(template.id, 'body', e.target.value)}
                      rows={6}
                      placeholder="Email body..."
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="w-48">
                    <Label htmlFor={`delay-${template.id}`}>Delay (minutes)</Label>
                    <Input
                      id={`delay-${template.id}`}
                      type="number"
                      min="0"
                      value={edits.delayMinutes}
                      onChange={(e) =>
                        updateEdit(template.id, 'delayMinutes', parseInt(e.target.value) || 0)
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      0 = send immediately on stage change
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={() => handleSave(template.id)}
                    disabled={savingId === template.id}
                    size="sm"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {savingId === template.id ? 'Saving...' : 'Save Template'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
