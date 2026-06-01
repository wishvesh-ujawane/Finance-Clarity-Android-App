import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Cloud, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBackup } from '@/context/BackupContext';
import {
  dismissConnectDriveBanner,
  isConnectDriveBannerDismissed,
} from '@/lib/onboarding';

/**
 * Soft prompt shown to users who completed onboarding without connecting
 * Google Drive. Dismissible and persists across reloads.
 */
export function ConnectDriveBanner() {
  const { isSignedIn } = useBackup();
  const [dismissed, setDismissed] = useState<boolean>(() => isConnectDriveBannerDismissed());

  // If the user connects Drive after the banner mounted, hide it.
  useEffect(() => {
    if (isSignedIn) setDismissed(true);
  }, [isSignedIn]);

  if (isSignedIn || dismissed) return null;

  const handleDismiss = () => {
    dismissConnectDriveBanner();
    setDismissed(true);
  };

  return (
    <div
      className="mb-4 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4"
      role="region"
      aria-label="Connect Google Drive"
      data-testid="connect-drive-banner"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <Cloud className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">
          Keep your data safe
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Connect Google Drive to back up your transactions and restore them on another device.
        </p>
        <div className="mt-3 flex gap-2">
          <Link href="/settings/backup">
            <Button size="sm" data-testid="connect-drive-banner-cta">
              Connect Drive
            </Button>
          </Link>
          <Button size="sm" variant="ghost" onClick={handleDismiss}>
            Not now
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
