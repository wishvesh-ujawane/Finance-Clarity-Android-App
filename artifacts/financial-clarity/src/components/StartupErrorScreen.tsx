import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import type { StartupProblem } from '@/lib/storage/startup';

const COPY: Record<StartupProblem, { title: string; body: string }> = {
  unavailable: {
    title: 'Can\u2019t open your data',
    body: 'Fiscal Focus couldn\u2019t read the data saved on this phone. Nothing was changed. Close and reopen the app. If this keeps happening, restart your phone.',
  },
  'storage-full': {
    title: 'Phone storage is full',
    body: 'Fiscal Focus needs to update how your data is saved, but there isn\u2019t enough space. Nothing was changed. Free up space, then try again.',
  },
  'newer-version': {
    title: 'Update Fiscal Focus',
    body: 'Your data was saved by a newer version of Fiscal Focus. Nothing was changed. Update the app from Google Play, then open it again.',
  },
  'migration-failed': {
    title: 'Couldn\u2019t update your data',
    body: 'Fiscal Focus couldn\u2019t update how your data is saved. Nothing was changed. Try again. If this keeps happening, update the app.',
  },
  unpreserved: {
    title: 'Some data couldn\u2019t be read',
    body: 'Some saved data couldn\u2019t be read, and there isn\u2019t enough space to keep a safe copy of it. Nothing was changed. Free up space, then try again.',
  },
};

interface StartupErrorScreenProps {
  problem: StartupProblem;
  onRetry: () => void;
  /** Offered only when continuing is possible; it needs explicit confirmation (DESIGN §8.2). */
  onContinue?: () => void;
}

/** Full-screen explanation when local data can't be opened safely at startup. */
export function StartupErrorScreen({ problem, onRetry, onContinue }: StartupErrorScreenProps) {
  const [confirming, setConfirming] = useState(false);
  const copy = COPY[problem];

  return (
    <div
      role="alert"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background p-6"
      data-testid="startup-error-screen"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle size={28} aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.body}</p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button onClick={onRetry} data-testid="startup-retry">
            Try again
          </Button>
          {onContinue && (
            <Button variant="ghost" onClick={() => setConfirming(true)} data-testid="startup-continue">
              Continue without it
            </Button>
          )}
        </div>
      </div>

      {onContinue && (
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent data-testid="startup-continue-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>Continue without the unreadable data?</AlertDialogTitle>
              <AlertDialogDescription>
                The records that couldn&rsquo;t be read won&rsquo;t be shown. They will be permanently replaced the
                next time you save a change of the same kind, for example a transaction. This can&rsquo;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onContinue}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="startup-continue-confirm"
              >
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
