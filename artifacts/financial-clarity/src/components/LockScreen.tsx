import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Fingerprint, Lock, ShieldAlert } from 'lucide-react';
import { useSecurity } from '@/context/SecurityContext';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function formatCooldown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

export function LockScreen() {
  const {
    isLocked,
    isReady,
    settings,
    biometricAvailable,
    biometricReason,
    unlockWithPin,
    unlockWithBiometric,
    resetAllData,
  } = useSecurity();

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [isBiometricBusy, setIsBiometricBusy] = useState(false);
  const biometricTriedRef = useRef(false);
  const submittingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const biometricEnabled = Boolean(settings?.biometricEnabled) && biometricAvailable;
  const cooldownUntil = settings?.cooldownUntil ?? 0;

  // Reset state whenever the screen becomes locked again
  useEffect(() => {
    if (isLocked) {
      setPin('');
      setError('');
      setShake(false);
      setIsBiometricBusy(false);
      biometricTriedRef.current = false;
    }
  }, [isLocked]);

  // Cooldown ticker; the cooldown itself is persisted in security settings.
  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, cooldownUntil - Date.now());
      setCooldownRemaining(remaining);
      if (remaining === 0) setError('');
      return remaining;
    };
    if (tick() === 0) return;
    const id = window.setInterval(() => {
      if (tick() === 0) window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const handleChange = (value: string) => {
    if (cooldownRemaining > 0 || submittingRef.current) return;
    setPin(value);
    setError('');
    if (value.length === 4) {
      void submit(value);
    }
  };

  const submit = async (value: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const ok = await unlockWithPin(value);
      if (!ok) {
        setPin('');
        setShake(true);
        window.setTimeout(() => setShake(false), 400);
        setError('Incorrect PIN. Try again.');
      }
    } finally {
      submittingRef.current = false;
    }
  };

  // Keep keyboard focus inside the lock screen. Events from the reset dialog
  // (rendered in a portal) are left to that dialog's own focus trap.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (event.key !== 'Tab' || !container || !container.contains(event.target as Node)) return;
    const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) {
      event.preventDefault();
      container.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === container)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const submitBiometric = useCallback(async ({ showError }: { showError: boolean }) => {
    if (cooldownRemaining > 0 || isBiometricBusy) return;
    setIsBiometricBusy(true);
    setError('');
    try {
      const ok = await unlockWithBiometric();
      if (!ok && showError) {
        setError('Biometric unlock was cancelled. Enter your PIN or try again.');
      }
    } finally {
      setIsBiometricBusy(false);
    }
  }, [cooldownRemaining, isBiometricBusy, unlockWithBiometric]);

  // Auto-prompt biometric once when shown
  useEffect(() => {
    if (!isLocked || !biometricEnabled || biometricTriedRef.current) return;
    biometricTriedRef.current = true;
    void submitBiometric({ showError: false });
  }, [isLocked, biometricEnabled, submitBiometric]);

  const handleBiometric = () => {
    void submitBiometric({ showError: true });
  };

  if (!isReady || !isLocked || !settings) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="App locked"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background p-6"
    >
      <div className="w-full max-w-sm flex flex-col items-center text-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 text-accent flex items-center justify-center">
          <Lock size={28} />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
            Fiscal Focus Locked
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your 4-digit PIN to continue.
          </p>
        </div>

        <div
          data-testid="lock-screen-pin"
          className={cn('transition-transform', shake && 'animate-[shake_0.35s_ease-in-out]')}
          style={{
            // Inline keyframes fallback if Tailwind theme lacks `shake`
            animationName: shake ? 'fc-shake' : undefined,
          }}
        >
          <InputOTP
            maxLength={4}
            value={pin}
            onChange={handleChange}
            disabled={cooldownRemaining > 0}
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
          >
            <InputOTPGroup className="gap-2">
              {[0, 1, 2, 3].map(i => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  className="h-14 w-12 text-lg rounded-md border border-input first:rounded-l-md last:rounded-r-md"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {(error || cooldownRemaining > 0) && (
          <p className="text-xs font-medium text-destructive flex items-center gap-1.5" role="alert">
            <ShieldAlert size={14} />
            {cooldownRemaining > 0 ? `Too many attempts. Try again in ${formatCooldown(cooldownRemaining)}.` : error}
          </p>
        )}

        {biometricEnabled && (
          <button
            type="button"
            onClick={handleBiometric}
            disabled={cooldownRemaining > 0 || isBiometricBusy}
            data-testid="lock-screen-biometric"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm font-semibold text-foreground hover:bg-accent/5 transition-colors disabled:opacity-40"
          >
            <Fingerprint size={16} />
            {isBiometricBusy ? 'Checking...' : 'Use biometrics'}
          </button>
        )}

        {settings.biometricEnabled && !biometricAvailable && (
          <p className="max-w-xs text-xs text-muted-foreground">
            {biometricReason}
          </p>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              data-testid="lock-screen-reset"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Forgot PIN? Reset app data
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset all app data?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes your transactions, categories, budgets, and the app lock.
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={resetAllData}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Reset everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <style>{`
        @keyframes fc-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
