import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { RemoteBackupInfo } from '@/context/BackupContext';

interface RestorePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remote: RemoteBackupInfo | null;
  currentCounts?: { transactions: number; categories: number; budgets: number };
  onConfirm: () => void;
  busy?: boolean;
}

function formatDate(value: string | undefined) {
  if (!value) return 'Unknown date';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function RestorePreviewDialog({
  open,
  onOpenChange,
  remote,
  currentCounts,
  onConfirm,
  busy,
}: RestorePreviewDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Replace all local data?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                This will replace every transaction, category, budget and recurring
                expense on this device with the contents of your Google Drive backup.
              </p>
              {remote && (
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <p className="font-medium text-foreground">Backup details</p>
                  <p className="text-xs text-muted-foreground">
                    Created: {formatDate(remote.exportedAt)}
                  </p>
                  {remote.device && (
                    <p className="text-xs text-muted-foreground">
                      Source device: {remote.device}
                    </p>
                  )}
                  {remote.counts && (
                    <p className="text-xs text-muted-foreground">
                      Contains: {remote.counts.transactions} transactions • {remote.counts.categories} categories • {remote.counts.budgets} budgets • {remote.counts.recurringExpenses} recurring
                    </p>
                  )}
                </div>
              )}
              {currentCounts && (
                <p className="text-xs text-muted-foreground">
                  Current device has {currentCounts.transactions} transactions, {currentCounts.categories} categories,{' '}
                  {currentCounts.budgets} budgets.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                A safety snapshot of your current data will be saved to Drive automatically before restoring.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy || !remote}
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {busy ? 'Restoring\u2026' : 'Replace data'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
