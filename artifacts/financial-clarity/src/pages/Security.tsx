import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Fingerprint, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useFinance } from '@/context/FinanceContext';
import { ensureBiometricReady } from '@/lib/biometric';
import {
  getConfiguredGoogleAndroidClientId,
  getConfiguredGoogleWebClientId,
  requestGoogleIdentityToken,
} from '@/lib/google-drive';
import { cn } from '@/lib/utils';

const LOCK_TIMEOUT_OPTIONS = [1, 5, 15, 30];

export default function Security() {
  const [, navigate] = useLocation();
  const {
    securitySettings,
    updateSecuritySettings,
    setSecurityPin,
    clearSecurityPin,
  } = useFinance();

  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSavePin = async () => {
    setError('');
    setMessage('');
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits.');
      return;
    }
    if (pin !== pinConfirm) {
      setError('PIN and confirm PIN do not match.');
      return;
    }

    try {
      setIsSavingPin(true);
      await setSecurityPin(pin);
      setPin('');
      setPinConfirm('');
      setMessage('PIN saved successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save PIN.');
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleBiometricToggle = async (checked: boolean) => {
    setError('');
    setMessage('');

    if (!checked) {
      updateSecuritySettings({ biometricEnabled: false });
      setMessage('Biometric login disabled.');
      return;
    }

    const ready = await ensureBiometricReady();
    if (!ready.success) {
      setError(ready.message || 'Device biometric setup failed.');
      updateSecuritySettings({ biometricEnabled: false });
      return;
    }

    updateSecuritySettings({ biometricEnabled: true });
    setMessage('Biometric login enabled.');
  };

  const handleRecoverPin = async () => {
    setError('');
    setMessage('');
    const androidClientId = getConfiguredGoogleAndroidClientId();
    const webClientId = getConfiguredGoogleWebClientId();

    if (!androidClientId || !webClientId) {
      setError('Google client ID is not configured.');
      return;
    }

    try {
      setIsRecovering(true);
      await requestGoogleIdentityToken(androidClientId, webClientId);
      clearSecurityPin();
      setMessage('PIN reset complete. App lock has been disabled.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google verification failed.');
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8 space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/settings')}
          className="inline-flex items-center justify-center rounded-full border border-border p-2 text-muted-foreground hover:border-accent/70 hover:text-accent transition-colors"
          aria-label="Back to settings"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Security</p>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
            App protection
          </h1>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <LockKeyhole size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">App lock</p>
            <p className="text-xs text-muted-foreground">Require PIN after timeout to reopen the app.</p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-3 bg-white dark:bg-card">
            <div>
              <p className="text-sm font-medium text-foreground">Enable app lock</p>
              <p className="text-xs text-muted-foreground">Protect the app when it is backgrounded.</p>
            </div>
            <Switch
              checked={securitySettings.appLockEnabled}
              onCheckedChange={checked => updateSecuritySettings({ appLockEnabled: checked })}
            />
          </div>

          <div className="rounded-xl border border-border p-4 bg-white dark:bg-card">
            <p className="text-sm font-medium text-foreground">Lock timeout</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {LOCK_TIMEOUT_OPTIONS.map(option => (
                <button
                  key={option}
                  onClick={() => updateSecuritySettings({ lockTimeoutMinutes: option })}
                  className={cn(
                    'rounded-2xl px-4 py-2 text-xs font-semibold transition-colors',
                    securitySettings.lockTimeoutMinutes === option
                      ? 'bg-accent text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {option} min
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <Fingerprint size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Biometric login</p>
            <p className="text-xs text-muted-foreground">Use face or fingerprint unlock when supported.</p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-3 bg-white dark:bg-card">
            <div>
              <p className="text-sm font-medium text-foreground">Enable biometric login</p>
              <p className="text-xs text-muted-foreground">Only available when device biometrics are set up.</p>
            </div>
            <Switch
              checked={securitySettings.biometricEnabled}
              onCheckedChange={handleBiometricToggle}
            />
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <ShieldCheck size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">PIN</p>
            <p className="text-xs text-muted-foreground">A PIN is required for app lock and recovery.</p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={event => setPin(event.target.value)}
            placeholder={securitySettings.pinHash ? 'New PIN' : 'Set PIN'}
            className="w-full px-4 py-3 text-sm bg-white dark:bg-card rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent"
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pinConfirm}
            onChange={event => setPinConfirm(event.target.value)}
            placeholder="Confirm PIN"
            className="w-full px-4 py-3 text-sm bg-white dark:bg-card rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            onClick={handleSavePin}
            disabled={isSavingPin}
            className="w-full rounded-xl px-4 py-3 bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {isSavingPin ? 'Saving PIN' : securitySettings.pinHash ? 'Update PIN' : 'Set PIN'}
          </button>

          {securitySettings.pinHash && (
            <button
              onClick={handleRecoverPin}
              disabled={isRecovering}
              className="w-full rounded-xl px-4 py-3 border border-border text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
            >
              {isRecovering ? 'Recovering PIN' : 'Forgot PIN? Recover with Google'}
            </button>
          )}
        </div>
      </div>

      {(message || error) && (
        <div className={cn(
          'rounded-2xl border p-4 text-sm',
          error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
        )}
        >
          {error || message}
        </div>
      )}
    </div>
  );
}
