'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Shield, ShieldCheck, Copy, Check, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  initialEnabled: boolean;
  enabledAt: string | null;
}

export function TwoFactorSettings({ initialEnabled, enabledAt }: Props) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [enabledAtState, setEnabledAtState] = useState(enabledAt);
  const [unusedBackupCount, setUnusedBackupCount] = useState<number | null>(null);

  // Setup state
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupStep, setSetupStep] = useState<'loading' | 'qr' | 'verify' | 'backup-codes'>('loading');
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Disable state
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableToken, setDisableToken] = useState('');

  // Regenerate state
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenPassword, setRegenPassword] = useState('');
  const [regenToken, setRegenToken] = useState('');

  useEffect(() => {
    if (enabled) {
      fetch('/api/2fa/backup-codes')
        .then((r) => r.json())
        .then((d) => setUnusedBackupCount(d.unusedCount ?? 0))
        .catch(() => setUnusedBackupCount(null));
    }
  }, [enabled]);

  const startSetup = async () => {
    setSetupOpen(true);
    setSetupStep('loading');
    try {
      const res = await fetch('/api/2fa/setup', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start 2FA setup');
      const data = await res.json();
      setQrCode(data.qrCodeDataUrl);
      setSecret(data.secret);
      setSetupStep('qr');
    } catch (err) {
      toast({ title: 'Error', description: 'Could not start 2FA setup', variant: 'destructive' });
      setSetupOpen(false);
    }
  };

  const verifyCodeSubmit = async () => {
    if (!/^\d{6}$/.test(verifyCode)) {
      toast({ title: 'Invalid code', description: 'Enter the 6-digit code from your authenticator', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, token: verifyCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Verification failed', description: data.error || 'Invalid code', variant: 'destructive' });
        return;
      }
      setBackupCodes(data.backupCodes);
      setSetupStep('backup-codes');
      setEnabled(true);
      setEnabledAtState(new Date().toISOString());
      toast({ title: '2FA Enabled', description: 'Two-factor authentication is now active' });
    } catch (err) {
      toast({ title: 'Error', description: 'Verification failed', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const disable2FA = async () => {
    if (!disablePassword || !disableToken) {
      toast({ title: 'Missing fields', description: 'Password and 2FA code are required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disablePassword, totpToken: disableToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Could not disable', description: data.error, variant: 'destructive' });
        return;
      }
      setEnabled(false);
      setEnabledAtState(null);
      setDisableOpen(false);
      setDisablePassword('');
      setDisableToken('');
      toast({ title: '2FA Disabled', description: 'Two-factor authentication has been turned off' });
    } catch {
      toast({ title: 'Error', description: 'Failed to disable 2FA', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const regenerateBackupCodes = async () => {
    if (!regenPassword || !regenToken) {
      toast({ title: 'Missing fields', description: 'Password and 2FA code are required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/2fa/backup-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: regenPassword, totpToken: regenToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Could not regenerate', description: data.error, variant: 'destructive' });
        return;
      }
      setBackupCodes(data.backupCodes);
      setSetupStep('backup-codes'); // Reuse the backup codes display step
      setSetupOpen(true);
      setRegenOpen(false);
      setRegenPassword('');
      setRegenToken('');
      setUnusedBackupCount(data.backupCodes.length);
    } catch {
      toast({ title: 'Error', description: 'Failed to regenerate backup codes', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const copySecret = async () => {
    await navigator.clipboard.writeText(secret);
    toast({ title: 'Copied', description: 'Secret copied to clipboard' });
  };

  const copyBackupCodes = async () => {
    await navigator.clipboard.writeText(backupCodes.join('\n'));
    toast({ title: 'Copied', description: 'Backup codes copied to clipboard' });
  };

  const downloadBackupCodes = () => {
    const blob = new Blob(
      [`TPAEngineX Backup Codes\nGenerated: ${new Date().toISOString()}\n\n${backupCodes.join('\n')}\n\nSave these in a secure place. Each code can be used once.`],
      { type: 'text/plain' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tpaengx-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {enabled ? (
            <ShieldCheck className="h-6 w-6 text-green-600 mt-0.5" />
          ) : (
            <Shield className="h-6 w-6 text-muted-foreground mt-0.5" />
          )}
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              Two-Factor Authentication
              {enabled && <Badge variant="default" className="bg-green-600">Enabled</Badge>}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add an extra layer of security by requiring a verification code from your authenticator app at login.
            </p>
            {enabled && enabledAtState && (
              <p className="text-xs text-muted-foreground mt-2">
                Enabled on {format(new Date(enabledAtState), 'PPP')}
              </p>
            )}
            {enabled && unusedBackupCount !== null && (
              <p className="text-xs text-muted-foreground mt-1">
                {unusedBackupCount} of 10 backup codes unused
                {unusedBackupCount <= 3 && unusedBackupCount > 0 && (
                  <span className="text-amber-600 ml-1">— consider regenerating</span>
                )}
                {unusedBackupCount === 0 && (
                  <span className="text-red-600 ml-1">— regenerate immediately</span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {!enabled ? (
            <Button onClick={startSetup}>Enable 2FA</Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setRegenOpen(true)}>
                Regenerate codes
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDisableOpen(true)}>
                Disable 2FA
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Setup Dialog */}
      <Dialog open={setupOpen} onOpenChange={(open) => { if (!submitting) setSetupOpen(open); }}>
        <DialogContent className="max-w-md">
          {setupStep === 'loading' && (
            <>
              <DialogHeader>
                <DialogTitle>Starting setup...</DialogTitle>
              </DialogHeader>
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                Generating your secret...
              </div>
            </>
          )}

          {setupStep === 'qr' && (
            <>
              <DialogHeader>
                <DialogTitle>Scan QR code</DialogTitle>
                <DialogDescription>
                  Open your authenticator app (Google Authenticator, 1Password, Authy, etc.) and scan this QR code.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex justify-center">
                  {qrCode && <img src={qrCode} alt="2FA QR code" className="border rounded" />}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Can't scan? Enter this key manually:</p>
                  <div className="flex gap-2">
                    <code className="flex-1 px-3 py-2 bg-muted rounded text-xs font-mono break-all">{secret}</code>
                    <Button size="sm" variant="outline" onClick={copySecret}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSetupOpen(false)}>Cancel</Button>
                <Button onClick={() => setSetupStep('verify')}>Next</Button>
              </DialogFooter>
            </>
          )}

          {setupStep === 'verify' && (
            <>
              <DialogHeader>
                <DialogTitle>Verify setup</DialogTitle>
                <DialogDescription>
                  Enter the 6-digit code from your authenticator app to confirm setup.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="verify-code">Verification code</Label>
                  <Input
                    id="verify-code"
                    placeholder="123456"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    autoFocus
                    inputMode="numeric"
                    className="text-center text-2xl font-mono tracking-widest"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSetupStep('qr')} disabled={submitting}>Back</Button>
                <Button onClick={verifyCodeSubmit} disabled={submitting || verifyCode.length !== 6}>
                  {submitting ? 'Verifying...' : 'Verify & Enable'}
                </Button>
              </DialogFooter>
            </>
          )}

          {setupStep === 'backup-codes' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                  Save your backup codes
                </DialogTitle>
                <DialogDescription>
                  Store these in a safe place (password manager, printed, etc.). You'll need them if you lose access to your authenticator. <strong>These won't be shown again.</strong>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-muted rounded p-4 font-mono text-sm space-y-1">
                  {backupCodes.map((code, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-muted-foreground w-6">{i + 1}.</span>
                      <span>{code}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-start gap-2 p-3 rounded bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-200 text-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>Each code can be used exactly once. After using a code, it's permanently invalidated.</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyBackupCodes} className="flex-1">
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadBackupCodes} className="flex-1">
                    Download
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => { setSetupOpen(false); setVerifyCode(''); setBackupCodes([]); }}>
                  <Check className="h-4 w-4 mr-1" /> I've saved my codes
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable Dialog */}
      <Dialog open={disableOpen} onOpenChange={(open) => { if (!submitting) setDisableOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable 2FA</DialogTitle>
            <DialogDescription>
              This will turn off two-factor authentication. Enter your password and current 2FA code to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="disable-pw">Password</Label>
              <Input id="disable-pw" type="password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="disable-token">2FA Code</Label>
              <Input
                id="disable-token"
                placeholder="123456"
                value={disableToken}
                onChange={(e) => setDisableToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                inputMode="numeric"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableOpen(false)} disabled={submitting}>Cancel</Button>
            <Button variant="destructive" onClick={disable2FA} disabled={submitting}>
              {submitting ? 'Disabling...' : 'Disable 2FA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Dialog */}
      <Dialog open={regenOpen} onOpenChange={(open) => { if (!submitting) setRegenOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate backup codes</DialogTitle>
            <DialogDescription>
              This invalidates your existing backup codes and generates 10 new ones.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="regen-pw">Password</Label>
              <Input id="regen-pw" type="password" value={regenPassword} onChange={(e) => setRegenPassword(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="regen-token">2FA Code</Label>
              <Input
                id="regen-token"
                placeholder="123456"
                value={regenToken}
                onChange={(e) => setRegenToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                inputMode="numeric"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={regenerateBackupCodes} disabled={submitting}>
              {submitting ? 'Regenerating...' : 'Generate new codes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
