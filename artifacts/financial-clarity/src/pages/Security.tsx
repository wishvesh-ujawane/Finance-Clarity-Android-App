import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Fingerprint, KeyRound, ShieldCheck, ShieldOff } from 'lucide-react';
import { useSecurity } from '@/context/SecurityContext';
import { Switch } from '@/components/ui/switch';
import { PinSetupDialog, type PinDialogMode } from '@/components/PinSetupDialog';
import { verifyPin } from '@/lib/security';

export default function Security() {
  const {
    settings,
    isAppLockEnabled,
    biometricAvailable,
    biometricReason,
    setupPin,
    changePin,
    enableBiometric,
    disableBiometric,
    disableAppLock,
  } = useSecurity();

  const [dialogMode, setDialogMode] = useState<PinDialogMode | null>(null);
  const [pendingCurrentPin, setPendingCurrentPin] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [biometricBusy, setBiometricBusy] = useState(false);

  const showMessage = (msg: string) => { setMessage(msg); setError(''); };
  const showError = (msg: string) => { setError(msg); setMessage(''); };

  const verifyCurrent = async (pin: string) => {
    if (!settings) return false;
    return verifyPin(pin, settings);
  };

  const handleEnable = () => {
    setPendingCurrentPin(null);
    setDialogMode('setup');
  };

  const handleChange = () => {
    setPendingCurrentPin(null);
    setDialogMode('change');
  };

  const handleDisable = () => {
    setPendingCurrentPin(null);
    setDialogMode('confirm-disable');
  };

  const handleDialogComplete = async (pin: string) => {
    if (dialogMode === 'setup') {
      await setupPin(pin);
      showMessage('App lock enabled.');
      return;
    }
    if (dialogMode === 'change') {
      // PinSetupDialog flow: verify-current -> enter-new -> confirm-new.
      // verifyCurrent was already called during the verify step; we only get
      // the new PIN here. Use changePin with stored current PIN snapshot.
      const current = pendingCurrentPin;
      if (!current) {
        showError('Please re-enter your current PIN.');
        return;
      }
      const ok = await changePin(current, pin);
      setPendingCurrentPin(null);
      if (ok) showMessage('PIN updated.');
      else showError('Could not change PIN.');
      return;
    }
    if (dialogMode === 'confirm-disable') {
      const ok = await disableAppLock(pin);
      if (ok) showMessage('App lock disabled.');
      else showError('Incorrect PIN.');
    }
  };

  const verifyAndRemember = async (pin: string) => {
    const ok = await verifyCurrent(pin);
    if (ok) setPendingCurrentPin(pin);
    return ok;
  };

  const handleBiometricToggle = async (next: boolean) => {
    if (biometricBusy) return;
    setBiometricBusy(true);
    const busyTimeout = window.setTimeout(() => {
      setBiometricBusy(false);
    }, 12000);
    try {
      if (next) {
        const ok = await enableBiometric();
        if (ok) showMessage('Biometric unlock enabled.');
        else showError('Could not enable biometrics.');
      } else {
        disableBiometric();
        showMessage('Biometric unlock disabled.');
      }
    } finally {
      window.clearTimeout(busyTimeout);
      setBiometricBusy(false);
    }
  };

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/settings">
          <button
            type="button"
            data-testid="security-back"
            className="w-9 h-9 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Back to settings"
          >
            <ArrowLeft size={16} />
          </button>
        </Link>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Settings</p>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Security</h1>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <ShieldCheck size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">App Lock</p>
            <p className="text-xs text-muted-foreground">
              {isAppLockEnabled
                ? 'A 4-digit PIN unlocks the app. Biometrics can unlock too.'
                : 'Require a PIN (and optionally biometrics) to open the app.'}
            </p>
          </div>
        </div>

        <div className="p-5 space-y-3">
          {!isAppLockEnabled ? (
            <button
              type="button"
              data-testid="security-enable"
              onClick={handleEnable}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors"
            >
              <ShieldCheck size={15} />
              Enable App Lock
            </button>
          ) : (
            <>
              <button
                type="button"
                data-testid="security-change-pin"
                onClick={handleChange}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[hsl(222,65%,13%)] text-white text-sm font-semibold hover:bg-[hsl(222,65%,18%)] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <KeyRound size={15} />
                  Change PIN
                </span>
                <span className="text-xs font-medium text-white/60">4 digits</span>
              </button>

              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border bg-background">
                <div className="flex items-center gap-2">
                  <Fingerprint size={16} className="text-accent" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Biometric unlock</p>
                    <p className="text-xs text-muted-foreground">
                      {biometricAvailable
                        ? 'Use fingerprint or face to unlock.'
                        : biometricReason}
                    </p>
                    {!biometricAvailable && (
                      <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                        You can still toggle on to test biometric prompt.
                      </p>
                    )}
                  </div>
                </div>
                <Switch
                  data-testid="security-biometric-toggle"
                  checked={Boolean(settings?.biometricEnabled)}
                  onCheckedChange={handleBiometricToggle}
                />
              </div>

              <button
                type="button"
                data-testid="security-disable"
                onClick={handleDisable}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-500/30 text-red-600 text-sm font-semibold hover:bg-red-500/5 transition-colors"
              >
                <ShieldOff size={15} />
                Disable App Lock
              </button>
            </>
          )}

          {(message || error) && (
            <p className={error ? 'text-xs font-medium text-red-500' : 'text-xs font-medium text-emerald-600 dark:text-emerald-400'}>
              {error || message}
            </p>
          )}
        </div>
      </div>

      <PinSetupDialog
        open={dialogMode !== null}
        mode={dialogMode ?? 'setup'}
        onOpenChange={(open) => { if (!open) { setDialogMode(null); setPendingCurrentPin(null); } }}
        verifyCurrent={dialogMode === 'change' ? verifyAndRemember : verifyCurrent}
        onComplete={handleDialogComplete}
      />
    </div>
  );
}
