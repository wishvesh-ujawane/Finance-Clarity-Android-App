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
import type { CsvImportPlan, InvalidCsvRow } from '@/lib/csv';

export interface CsvImportPreview {
  fileName: string;
  plan: CsvImportPlan;
  invalidRows: InvalidCsvRow[];
}

interface CsvImportPreviewDialogProps {
  preview: CsvImportPreview | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const MAX_LISTED_INVALID_ROWS = 5;

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export function CsvImportPreviewDialog({ preview, busy, onCancel, onConfirm }: CsvImportPreviewDialogProps) {
  const newCount = preview?.plan.items.length ?? 0;
  const invalidRows = preview?.invalidRows ?? [];
  const newCategories = preview?.plan.categoriesToCreate ?? [];

  return (
    <AlertDialog open={preview !== null} onOpenChange={open => { if (!open && !busy) onCancel(); }}>
      <AlertDialogContent data-testid="csv-preview">
        <AlertDialogHeader>
          <AlertDialogTitle>Import CSV?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p className="break-all text-xs text-muted-foreground">{preview?.fileName}</p>
              <ul className="space-y-1 text-foreground">
                <li>{plural(newCount, 'new transaction')} will be added.</li>
                <li>{plural(preview?.plan.duplicateCount ?? 0, 'duplicate')} already in the app will be skipped.</li>
                {invalidRows.length > 0 && (
                  <li>{plural(invalidRows.length, 'invalid row')} will be skipped.</li>
                )}
              </ul>
              {invalidRows.length > 0 && (
                <ul className="rounded-lg border border-border p-3 space-y-1 text-xs text-muted-foreground" data-testid="csv-preview-invalid">
                  {invalidRows.slice(0, MAX_LISTED_INVALID_ROWS).map(row => (
                    <li key={row.line}>Row {row.line}: {row.reason}</li>
                  ))}
                  {invalidRows.length > MAX_LISTED_INVALID_ROWS && (
                    <li>and {invalidRows.length - MAX_LISTED_INVALID_ROWS} more</li>
                  )}
                </ul>
              )}
              {newCategories.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  New categories: {newCategories.map(category => category.name).join(', ')}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Nothing changes until you confirm. CSV holds transactions only; it is not a full backup.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {newCount > 0 ? (
            <>
              <AlertDialogCancel disabled={busy} data-testid="csv-preview-cancel">Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={busy}
                data-testid="csv-preview-confirm"
                onClick={event => { event.preventDefault(); onConfirm(); }}
              >
                {busy ? 'Importing…' : `Import ${plural(newCount, 'transaction')}`}
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogCancel data-testid="csv-preview-cancel">Close</AlertDialogCancel>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
