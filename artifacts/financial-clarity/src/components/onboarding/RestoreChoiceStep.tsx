import { useState } from 'react';
import { CloudDownload, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBackup, type RemoteBackupInfo } from '@/context/BackupContext';
import { useFinance } from '@/context/FinanceContext';
import { RestorePreviewDialog } from '@/components/RestorePreviewDialog';
import { useToast } from '@/hooks/use-toast';

interface RestoreChoiceStepProps {
  remote: RemoteBackupInfo;
  onDone: () => void;
}

function formatDate(value: string | undefined) {
  if (!value) return 'Unknown date';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function RestoreChoiceStep({ remote, onDone }: RestoreChoiceStepProps) {
  const { restoreFromDrive } = useBackup();
  const { transactions, categories, budgets } = useFinance();
  const { toast } = useToast();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirmRestore = async () => {
    setError(null);
    setBusy(true);
    try {
      const counts = await restoreFromDrive(remote);
      setConfirmOpen(false);
      toast({
        title: 'Backup restored',
        description: `Loaded ${counts.transactions} transactions and ${counts.categories} categories.`,
      });
      onDone();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Restore failed.';
      setError(message);
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const counts = remote.counts;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-emerald-500/15">
          <CloudDownload className="h-12 w-12 text-emerald-500" strokeWidth={1.8} />
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Backup found
        </p>
        <h2
          className="mb-4 max-w-md text-2xl font-bold text-foreground sm:text-3xl"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Restore your data?
        </h2>
        <p className="mb-6 max-w-md text-sm text-muted-foreground sm:text-base">
          We found an existing backup in your Google Drive. Restore it now to
          continue where you left off.
        </p>

        <div className="w-full max-w-md space-y-1 rounded-xl border border-border bg-card p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Backup details
          </p>
          <p className="text-sm text-foreground">
            Created: <span className="text-muted-foreground">{formatDate(remote.exportedAt)}</span>
          </p>
          {remote.device && (
            <p className="text-sm text-foreground">
              Device: <span className="text-muted-foreground">{remote.device}</span>
            </p>
          )}
          {counts && (
            <p className="text-xs text-muted-foreground">
              {counts.transactions} transactions • {counts.categories} categories • {counts.budgets} budgets • {counts.recurringExpenses} recurring
            </p>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mt-6 flex max-w-md items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-left text-xs text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="space-y-3 px-6 pb-8">
        <Button
          onClick={() => { setError(null); setConfirmOpen(true); }}
          size="lg"
          className="w-full"
          disabled={busy}
          data-testid="onboarding-restore"
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Restoring…
            </>
          ) : (
            'Restore this backup'
          )}
        </Button>
        <Button
          variant="ghost"
          onClick={onDone}
          className="w-full"
          disabled={busy}
          data-testid="onboarding-start-fresh"
        >
          Start fresh
        </Button>
      </div>

      <RestorePreviewDialog
        open={confirmOpen}
        onOpenChange={(open) => { if (!busy) setConfirmOpen(open); }}
        remote={remote}
        currentCounts={{
          transactions: transactions.length,
          categories: categories.length,
          budgets: budgets.length,
        }}
        onConfirm={handleConfirmRestore}
        busy={busy}
      />
    </div>
  );
}
