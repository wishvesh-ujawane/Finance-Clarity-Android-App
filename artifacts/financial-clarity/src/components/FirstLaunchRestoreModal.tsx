import { useEffect, useState } from 'react';
import { Cloud, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useBackup } from '@/context/BackupContext';
import { useFinance } from '@/context/FinanceContext';
import { useToast } from '@/hooks/use-toast';

const FIRST_RUN_FLAG = 'financial-clarity:first-run-done';

function hasExistingData() {
  try {
    const raw = localStorage.getItem('financial-clarity:transactions');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

function readFlag() {
  try { return localStorage.getItem(FIRST_RUN_FLAG); } catch { return null; }
}

function writeFlag(value: string) {
  try { localStorage.setItem(FIRST_RUN_FLAG, value); } catch { /* ignore */ }
}

type Step = 'prompt' | 'sign-in' | 'check' | 'no-backup' | 'found' | 'restoring' | 'offline' | 'error';

export function FirstLaunchRestoreModal() {
  const { transactions } = useFinance();
  const {
    user,
    isSignedIn,
    signIn,
    checkRemoteBackup,
    restoreFromDrive,
    remoteBackup,
    status,
  } = useBackup();
  const { toast } = useToast();

  const [open, setOpen] = useState<boolean>(false);
  const [step, setStep] = useState<Step>('prompt');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Decide whether to show the modal on mount.
  useEffect(() => {
    const flag = readFlag();
    if (flag) return;
    if (hasExistingData() || transactions.length > 0) {
      // Existing user upgrading from earlier release; never show.
      writeFlag('autoset:has-data');
      return;
    }
    setOpen(true);
  }, [transactions.length]);

  const handleStartFresh = () => {
    writeFlag(`dismissed:${Date.now()}`);
    setOpen(false);
  };

  const handleCheck = async () => {
    setErrorMessage(null);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setStep('offline');
      return;
    }

    try {
      if (!isSignedIn) {
        setStep('sign-in');
        await signIn();
      }
      setStep('check');
      const info = await checkRemoteBackup();
      if (info) {
        setStep('found');
      } else {
        setStep('no-backup');
      }
    } catch (err) {
      // Sign-in cancellation falls here; treat as soft dismiss back to prompt.
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      if (/cancel/i.test(message) || /closed/i.test(message)) {
        setStep('prompt');
        return;
      }
      setErrorMessage(message);
      setStep('error');
    }
  };

  const handleRestore = async () => {
    setErrorMessage(null);
    setStep('restoring');
    try {
      const counts = await restoreFromDrive(remoteBackup ?? undefined);
      writeFlag(`restored:${Date.now()}`);
      setOpen(false);
      toast({
        title: 'Restore complete',
        description: `${counts.transactions} transactions restored from Google Drive.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Restore failed.';
      setErrorMessage(message);
      setStep('error');
    }
  };

  const handleNoBackupClose = () => {
    writeFlag(`no-backup:${Date.now()}`);
    setOpen(false);
  };

  const handleClose = (next: boolean) => {
    // Prevent closing during restore.
    if (!next && step === 'restoring') return;
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              <Cloud size={18} />
            </div>
            <div>
              <DialogTitle>
                {step === 'found' ? 'Backup found!' :
                  step === 'no-backup' ? 'No backup yet' :
                  step === 'offline' ? 'Couldn\u2019t check for backup' :
                  step === 'error' ? 'Something went wrong' :
                  step === 'restoring' ? 'Restoring your data' :
                  step === 'check' || step === 'sign-in' ? 'Checking Google Drive' :
                  'Welcome to Fiscal Focus'}
              </DialogTitle>
              <DialogDescription>
                {step === 'prompt' && 'Restore your transactions from a previous device, or start fresh.'}
                {step === 'sign-in' && 'Opening Google sign-in\u2026'}
                {step === 'check' && 'Looking for an existing backup on your Google Drive\u2026'}
                {step === 'no-backup' && 'No backup was found on this Google account.'}
                {step === 'offline' && 'You\u2019re offline. Try again when you have a connection.'}
                {step === 'restoring' && 'Hold tight while we bring your data back.'}
                {step === 'error' && (errorMessage ?? 'Please try again.')}
                {step === 'found' && 'We found a backup on your Google Drive. Restore it?'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === 'found' && remoteBackup && (
          <div className="rounded-lg border border-border p-3 space-y-1 text-sm">
            {remoteBackup.exportedAt && (
              <p className="text-xs text-muted-foreground">
                Created: {new Date(remoteBackup.exportedAt).toLocaleString()}
              </p>
            )}
            {remoteBackup.device && (
              <p className="text-xs text-muted-foreground">Source: {remoteBackup.device}</p>
            )}
            {remoteBackup.counts && (
              <p className="text-xs text-muted-foreground">
                {remoteBackup.counts.transactions} transactions • {remoteBackup.counts.categories} categories • {remoteBackup.counts.budgets} budgets
              </p>
            )}
            {user?.email && (
              <p className="text-xs text-muted-foreground">Signed in as {user.email}</p>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {step === 'prompt' && (
            <>
              <button
                onClick={handleStartFresh}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-muted transition-colors"
              >
                Start fresh
              </button>
              <button
                onClick={handleCheck}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent/90 transition-colors"
              >
                Sign in &amp; check for backup
              </button>
            </>
          )}
          {step === 'found' && (
            <>
              <button
                onClick={handleStartFresh}
                disabled={status === 'restoring'}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-40"
              >
                Start fresh
              </button>
              <button
                onClick={handleRestore}
                disabled={status === 'restoring'}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-40"
              >
                Restore
              </button>
            </>
          )}
          {step === 'no-backup' && (
            <button
              onClick={handleNoBackupClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent/90 transition-colors"
            >
              Continue
            </button>
          )}
          {step === 'offline' && (
            <>
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-muted transition-colors"
              >
                Try later
              </button>
              <button
                onClick={handleStartFresh}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent/90 transition-colors"
              >
                Start fresh
              </button>
            </>
          )}
          {step === 'error' && (
            <>
              <button
                onClick={handleStartFresh}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-muted transition-colors"
              >
                Start fresh
              </button>
              <button
                onClick={handleCheck}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent/90 transition-colors"
              >
                Retry
              </button>
            </>
          )}
          {(step === 'sign-in' || step === 'check' || step === 'restoring') && (
            <button
              disabled
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-muted text-muted-foreground"
            >
              <X size={14} className="inline mr-1" /> Working…
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
