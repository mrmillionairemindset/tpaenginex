'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Plus, X, Mail, Building2 } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  type: string;
  authFormRecipients: string[];
  authExpiryDays: number;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  async function fetchOrganizations() {
    try {
      const response = await fetch('/api/organizations');
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
        if (data.organizations.length > 0 && !selectedOrgId) {
          setSelectedOrgId(data.organizations[0].id);
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load organizations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  const selectedOrg = organizations.find(org => org.id === selectedOrgId);

  const addEmail = () => {
    if (!selectedOrg) return;

    const email = emailInput.trim();
    if (!email) {
      toast({
        title: 'Error',
        description: 'Please enter an email address',
        variant: 'destructive',
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicates
    if (selectedOrg.authFormRecipients.includes(email)) {
      toast({
        title: 'Duplicate Email',
        description: 'This email is already in the list',
        variant: 'destructive',
      });
      return;
    }

    // Add email to the list
    updateOrgSettings({
      authFormRecipients: [...selectedOrg.authFormRecipients, email],
    });
    setEmailInput('');
  };

  const removeEmail = (email: string) => {
    if (!selectedOrg) return;

    updateOrgSettings({
      authFormRecipients: selectedOrg.authFormRecipients.filter(e => e !== email),
    });
  };

  const updateOrgSettings = async (updates: Partial<Organization>) => {
    if (!selectedOrgId) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/organizations/${selectedOrgId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update settings');
      }

      const data = await response.json();

      // Update local state
      setOrganizations(orgs =>
        orgs.map(org =>
          org.id === selectedOrgId
            ? { ...org, ...updates }
            : org
        )
      );

      toast({
        title: 'Settings Updated',
        description: data.message || 'Organization settings have been updated',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No organizations found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage email recipients for authorization forms per organization
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Organization List */}
        <Card className="lg:col-span-1 p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organizations
          </h2>
          <div className="space-y-2">
            {organizations.map(org => (
              <button
                key={org.id}
                onClick={() => setSelectedOrgId(org.id)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  selectedOrgId === org.id
                    ? 'bg-primary text-white'
                    : 'hover:bg-muted'
                }`}
              >
                <div className="font-medium text-sm">{org.name}</div>
                <div className="text-xs opacity-75">
                  {org.authFormRecipients?.length || 0} recipient{(org.authFormRecipients?.length || 0) !== 1 ? 's' : ''}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Email Recipients Management */}
        <Card className="lg:col-span-3 p-6">
          {selectedOrg && (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">{selectedOrg.name}</h2>
                <p className="text-sm text-muted-foreground">
                  Configure email recipients who will receive authorization forms for this organization's orders
                </p>
              </div>

              {/* Add Email Input */}
              <div className="mb-6">
                <Label htmlFor="emailInput" className="mb-2">Add Email Recipient</Label>
                <div className="flex gap-2">
                  <Input
                    id="emailInput"
                    type="email"
                    placeholder="email@example.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addEmail();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button onClick={addEmail} disabled={saving}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  These recipients will automatically receive authorization form emails (along with the candidate)
                </p>
              </div>

              {/* Email List */}
              <div>
                <Label className="mb-3 block">Current Recipients ({selectedOrg.authFormRecipients?.length || 0})</Label>
                {selectedOrg.authFormRecipients && selectedOrg.authFormRecipients.length > 0 ? (
                  <div className="space-y-2">
                    {selectedOrg.authFormRecipients.map((email) => (
                      <div
                        key={email}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg border"
                      >
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm">{email}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEmail(email)}
                          disabled={saving}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No email recipients configured</p>
                    <p className="text-sm">Add email addresses above to receive authorization forms</p>
                  </div>
                )}
              </div>

              {/* Info Box */}
              <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <h3 className="font-medium text-primary mb-2">How it works</h3>
                <ul className="text-sm text-primary space-y-1">
                  <li>• When a provider generates a custom authorization form, it will be automatically emailed</li>
                  <li>• Recipients include: the candidate + all emails configured here</li>
                  <li>• If no emails are configured, the form will be sent to the candidate and the order requester</li>
                  <li>• Provider will also download a copy of the PDF</li>
                </ul>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
