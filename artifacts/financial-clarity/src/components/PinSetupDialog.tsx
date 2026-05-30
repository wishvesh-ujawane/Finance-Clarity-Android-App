import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { cn } from '@/lib/utils';

export type PinDialogMode = 'setup' | 'change' | 'confirm-disable';

type Step =
  | 'verify-current'
  | 'enter-new'
  | 'confirm-new'
  | 'verify-only';

interface Props {
  open: boolean;
  mode: PinDialogMode;
  onOpenChange: (open: boolean) => void;
  /**
   * Verify the current PIN. Required for `change` and `confirm-disable`.
   * Should return true if the PIN matches.
   */
  verifyCurrent?: (pin: string) => Promise<boolean>;
  /**
   * Called when the dialog completes successfully. For `setup`/`change` it
   * receives the new PIN. For `confirm-disable` it receives the verified current PIN.
   */
  onComplete: (pin: string) => Promise<void> | void;
}

function titleFor(mode: PinDialogMode, step: Step): string {
  if (mode === 'setup') {
    if (step === 'enter-new') return 'Choose a 4-digit PIN';
    return 'Confirm your PIN';
  }
  if (mode === 'change') {
    if (step === 'verify-current') return 'Enter current PIN';
    if (step === 'enter-new') return 'Choose a new PIN';
    return 'Confirm new PIN';
  }
  return 'Enter current PIN to disable';
}

function descriptionFor(mode: PinDialogMode, step: Step): string {
  if (mode === 'setup') {
    if (step === 'enter-new') return 'You\u2019ll use this PIN to unlock the app.';
    return 'Re-enter the PIN to confirm it matches.';
  }
  if (mode === 'change') {
    if (step === 'verify-current') return 'Confirm your current PIN to continue.';
    if (step === 'enter-new') return 'Pick a new 4-digit PIN.';
    return 'Re-enter the new PIN to confirm it matches.';
  }
  return 'Disabling app lock removes the PIN and biometric unlock.';
}

export function PinSetupDialog({ open, mode, onOpenChange, verifyCurrent, onComplete }: Props) {
  const initialStep: Step = mode === 'setup'
    ? 'enter-new'
    : mode === 'change' ? 'verify-current' : 'verify-only';

  const [step, setStep] = useState<Step>(initialStep);
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(initialStep);
      setPin('');
      setFirstPin('');
      setError('');
      setBusy(false);
    }
  }, [open, initialStep]);

  const advance = async (value: string) => {
    setError('');
    if (step === 'verify-current' || step === 'verify-only') {
      if (!verifyCurrent) return;
      setBusy(true);
      const ok = await verifyCurrent(value);
      setBusy(false);
      if (!ok) {
        setPin('');
        setError('Incorrect PIN.');
        return;
      }
      if (step === 'verify-only') {
        try {
          await onComplete(value);
          onOpenChange(false);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Something went wrong.');
        }
        return;
      }
      setPin('');
      setStep('enter-new');
      return;
    }

    if (step === 'enter-new') {
      setFirstPin(value);
      setPin('');
      setStep('confirm-new');
      return;
    }

    if (step === 'confirm-new') {
      if (value !== firstPin) {
        setPin('');
        setError('PINs don\u2019t match. Try again.');
        setStep('enter-new');
        setFirstPin('');
        return;
      }
      setBusy(true);
      try {
        await onComplete(value);
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      } finally {
        setBusy(false);
      }
    }
  };

  const handleChange = (value: string) => {
    if (busy) return;
    setPin(value);
    if (value.length === 4) {
      void advance(value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{titleFor(mode, step)}</DialogTitle>
          <DialogDescription>{descriptionFor(mode, step)}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-4">
          <InputOTP
            maxLength={4}
            value={pin}
            onChange={handleChange}
            disabled={busy}
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
          >
            <InputOTPGroup className="gap-2">
              {[0, 1, 2, 3].map(i => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  className="h-12 w-11 text-lg rounded-md border border-input first:rounded-l-md last:rounded-r-md"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        {error && (
          <p className={cn('text-xs font-medium text-red-500 text-center')}>{error}</p>
        )}
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}
