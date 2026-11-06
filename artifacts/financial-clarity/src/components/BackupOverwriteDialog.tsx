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

export interface BackupOverwriteDetails {
  remoteTransactions: number | null;
  localTransactions: number;
  remoteExportedAt?: string;
}

interface BackupOverwriteDialogProps {
  details: BackupOverwriteDetails | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export function BackupOverwriteDialog({ details, busy, onCancel, onConfirm }: BackupOverwriteDialogProps) {
  const exported = details?.remoteExportedAt ? new Date(details.remoteExportedAt).toLocaleString() : null;

  return (
    <AlertDialog open={details !== null} onOpenChange={open => { if (!open && !busy) onCancel(); }}>
      <AlertDialogContent data-testid="backup-overwrite-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Replace your Drive backup?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              {details?.remoteTransactions === null ? (
                <p>Your Google Drive backup could not be read, so it may hold data this phone does not have.</p>
              ) : (
                <p>
                  Your Google Drive backup has {plural(details?.remoteTransactions ?? 0, 'transaction')}
                  {exported ? ` (saved ${exported})` : ''}. This phone has {plural(details?.localTransactions ?? 0, 'transaction')}.
                </p>
              )}
              <p>
                If you have just reinstalled the app, choose <span className="font-semibold">Cancel</span> and use
                Restore from Drive instead.
              </p>
              <p className="text-xs text-muted-foreground">
                If you replace it, a copy of the current Drive backup is saved in the same Drive folder first.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} data-testid="backup-overwrite-cancel">Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            data-testid="backup-overwrite-confirm"
            onClick={event => { event.preventDefault(); onConfirm(); }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? 'Replacing\u2026' : 'Replace Drive backup'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
