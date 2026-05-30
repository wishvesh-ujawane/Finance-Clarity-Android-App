import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Fingerprint, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { tryBiometricUnlock } from '@/lib/biometric';
import {
  getConfiguredGoogleAndroidClientId,
  getConfiguredGoogleWebClientId,
  requestGoogleIdentityToken,
} from '@/lib/google-drive';
import { cn } from '@/lib/utils';

export function AppLockGate({ children }: { children: ReactNode }) {
  const {
    securitySettings,
    hasHydrated,
    verifySecurityPin,
    markSecurityUnlocked,
    clearSecurityPin,
  } = useFinance();

  const [isLocked, setIsLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [isCheckingBiometric, setIsCheckingBiometric] = useState(false);
  const [isResettingPin, setIsResettingPin] = useState(false);
  const backgroundAt = useRef<number | null>(null);

  const requiresLock = securitySettings.appLockEnabled && securitySettings.pinHash.length > 0;

  useEffect(() => {
    if (!hasHydrated || !requiresLock) {
      setIsLocked(false);
      return;
    }

    const timeoutMs = Math.max(1, securitySettings.lockTimeoutMinutes) * 60_000;
    const lastUnlockMs = securitySettings.lastUnlockAt ? Date.parse(securitySettings.lastUnlockAt) : 0;
    if (!lastUnlockMs || Date.now() - lastUnlockMs > timeoutMs) {
      setIsLocked(true);
    }
  }, [hasHydrated, requiresLock, securitySettings.lastUnlockAt, securitySettings.lockTimeoutMinutes]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!requiresLock) return;
      if (document.visibilityState === 'hidden') {
        backgroundAt.current = Date.now();
        return;
      }

      if (document.visibilityState === 'visible' && backgroundAt.current) {
        const elapsed = Date.now() - backgroundAt.current;
        const timeoutMs = Math.max(1, securitySettings.lockTimeoutMinutes) * 60_000;
        if (elapsed >= timeoutMs) {
          setIsLocked(true);
        }
        backgroundAt.current = null;
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [requiresLock, securitySettings.lockTimeoutMinutes]);

  const handleUnlockPin = async () => {
    const success = await verifySecurityPin(pin);
    if (!success) {
      setMessage('Invalid PIN. Try again.');
      return;
    }
    setPin('');
    setMessage('');
    setIsLocked(false);
    markSecurityUnlocked();
  };

  const handleBiometricUnlock = async () => {
    setIsCheckingBiometric(true);
    const result = await tryBiometricUnlock();
    setIsCheckingBiometric(false);
    if (!result.success) {
      setMessage(result.message || 'Biometric unlock was not successful. Use PIN.');
      return;
    }
    setMessage('');
    setIsLocked(false);
    markSecurityUnlocked();
  };

  const handleResetPin = async () => {
    const androidClientId = getConfiguredGoogleAndroidClientId();
    const webClientId = getConfiguredGoogleWebClientId();
    if (!androidClientId || !webClientId) {
      setMessage('Google client ID is missing. Add it in Settings to enable PIN recovery.');
      return;
    }

    try {
      setIsResettingPin(true);
      await requestGoogleIdentityToken(androidClientId, webClientId);
      clearSecurityPin();
      setIsLocked(false);
      setMessage('PIN reset complete. App lock was disabled.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Google verification failed.');
    } finally {
      setIsResettingPin(false);
    }
  };

  if (!requiresLock || !isLocked) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-[120] bg-background">
      <div className="min-h-screen w-full flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-md bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                  <LockKeyhole size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">Security Check</p>
                  <p className="text-xs text-muted-foreground">Unlock Financial Clarity to continue.</p>
                </div>
              </div>
              <div className="px-2 py-1 rounded-lg bg-accent/10 text-accent text-[11px] font-semibold flex items-center gap-1">
                <Sparkles size={11} />
                Protected
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {securitySettings.biometricEnabled && (
              <button
                onClick={handleBiometricUnlock}
                disabled={isCheckingBiometric}
                className="w-full rounded-xl px-4 py-3 bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Fingerprint size={16} />
                {isCheckingBiometric ? 'Checking Biometric' : 'Unlock with Biometric'}
              </button>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={event => setPin(event.target.value)}
                placeholder="Enter PIN"
                className="w-full px-4 py-3 text-sm bg-white dark:bg-card rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                onClick={handleUnlockPin}
                className="w-full rounded-xl px-4 py-3 border border-border text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors"
              >
                Unlock with PIN
              </button>
            </div>

            <button
              onClick={handleResetPin}
              disabled={isResettingPin}
              className="w-full rounded-xl px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <ShieldCheck size={14} />
              {isResettingPin ? 'Verifying Google Account' : 'Forgot PIN? Verify with Google to reset'}
            </button>

            {message && (
              <p className={cn(
                'text-xs rounded-lg px-3 py-2 border',
                message.toLowerCase().includes('complete') || message.toLowerCase().includes('enabled')
                  ? 'text-emerald-700 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/10'
                  : 'text-muted-foreground border-border bg-muted/30'
              )}
              >
                {message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
