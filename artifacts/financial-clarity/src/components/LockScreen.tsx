import { useEffect, useRef, useState } from 'react';
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

const MAX_ATTEMPTS_BEFORE_COOLDOWN = 5;
const COOLDOWN_MS = 30_000;

export function LockScreen() {
  const {
    isLocked,
    isReady,
    settings,
    biometricAvailable,
    unlockWithPin,
    unlockWithBiometric,
    resetAllData,
  } = useSecurity();

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const biometricTriedRef = useRef(false);
  const submittingRef = useRef(false);

  const biometricEnabled = Boolean(settings?.biometricEnabled) && biometricAvailable;

  // Reset state whenever the screen becomes locked again
  useEffect(() => {
    if (isLocked) {
      setPin('');
      setError('');
      setShake(false);
      biometricTriedRef.current = false;
    }
  }, [isLocked]);

  // Auto-prompt biometric once when shown
  useEffect(() => {
    if (!isLocked || !biometricEnabled || biometricTriedRef.current) return;
    biometricTriedRef.current = true;
    void unlockWithBiometric();
  }, [isLocked, biometricEnabled, unlockWithBiometric]);

  // Cooldown ticker
  useEffect(() => {
    if (cooldownUntil <= 0) {
      setCooldownRemaining(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, cooldownUntil - Date.now());
      setCooldownRemaining(remaining);
      if (remaining === 0) {
        setCooldownUntil(0);
        setAttempts(0);
        setError('');
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
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
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);
        setPin('');
        setShake(true);
        window.setTimeout(() => setShake(false), 400);
        if (nextAttempts >= MAX_ATTEMPTS_BEFORE_COOLDOWN) {
          setCooldownUntil(Date.now() + COOLDOWN_MS);
          setError(`Too many attempts. Try again in 30s.`);
        } else {
          setError('Incorrect PIN. Try again.');
        }
      }
    } finally {
      submittingRef.current = false;
    }
  };

  const handleBiometric = () => {
    if (cooldownRemaining > 0) return;
    void unlockWithBiometric();
  };

  if (!isReady || !isLocked || !settings) return null;

  const cooldownSeconds = Math.ceil(cooldownRemaining / 1000);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="App locked"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-6"
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

        {error && (
          <p className="text-xs font-medium text-red-500 flex items-center gap-1.5">
            <ShieldAlert size={14} />
            {cooldownRemaining > 0 ? `Too many attempts. Try again in ${cooldownSeconds}s.` : error}
          </p>
        )}

        {biometricEnabled && (
          <button
            type="button"
            onClick={handleBiometric}
            disabled={cooldownRemaining > 0}
            data-testid="lock-screen-biometric"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm font-semibold text-foreground hover:bg-accent/5 transition-colors disabled:opacity-40"
          >
            <Fingerprint size={16} />
            Use biometrics
          </button>
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
