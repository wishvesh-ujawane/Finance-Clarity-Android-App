import { useState } from 'react';
import { Cloud, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBackup } from '@/context/BackupContext';
import type { RemoteBackupInfo } from '@/context/BackupContext';

interface AuthStepProps {
  // Called with a remote backup info if one was found after sign-in.
  onSignedIn: (remote: RemoteBackupInfo | null) => void;
  // Called when the user picks "Skip for now".
  onSkip: () => void;
}

export function AuthStep({ onSignedIn, onSkip }: AuthStepProps) {
  const { signIn, checkRemoteBackup } = useBackup();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setError(null);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setError("You're offline. Connect to the internet and try again.");
      return;
    }
    setBusy(true);
    try {
      await signIn();
      const info = await checkRemoteBackup();
      onSignedIn(info);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      // Sign-in cancellation: stay on this step quietly.
      if (/cancel/i.test(message) || /closed/i.test(message)) {
        setError(null);
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/10">
          <Cloud className="h-12 w-12 text-primary" strokeWidth={1.8} />
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Optional
        </p>
        <h2
          className="mb-4 max-w-md text-2xl font-bold text-foreground sm:text-3xl"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Back up to Google Drive?
        </h2>
        <p className="mb-2 max-w-md text-sm text-muted-foreground sm:text-base">
          Sign in with Google to keep an encrypted backup in your own Drive,
          and to restore your data when you switch devices.
        </p>
        <p className="max-w-md text-xs text-muted-foreground">
          You can connect or disconnect anytime in Settings &rarr; Backup.
        </p>

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
          onClick={handleConnect}
          size="lg"
          className="w-full"
          disabled={busy}
          data-testid="onboarding-google-signin"
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting…
            </>
          ) : (
            'Continue with Google'
          )}
        </Button>
        <Button
          variant="ghost"
          onClick={onSkip}
          className="w-full"
          disabled={busy}
          data-testid="onboarding-skip-auth"
        >
          Skip for now
        </Button>
      </div>
    </div>
  );
}
