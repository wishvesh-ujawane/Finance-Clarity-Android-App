import { useState } from 'react';
import { Cloud, LogOut, RotateCw, Upload, AlertCircle, CheckCircle2, FlaskConical } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useBackup } from '@/context/BackupContext';
import { useFinance } from '@/context/FinanceContext';
import { RestorePreviewDialog } from './RestorePreviewDialog';
import { WhatsAppIcon } from './icons/WhatsAppIcon';

const TESTER_WHATSAPP_PHONE = '918830828911';
const TESTER_WHATSAPP_MESSAGE =
  'Hey Wishvesh, Please register my email address for testing the application';

function relativeTime(timestamp: number | null): string {
  if (!timestamp) return 'Never';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function BackupSettingsCard() {
  const {
    user,
    isSignedIn,
    status,
    error,
    lastBackupAt,
    autoBackupEnabled,
    lastAutoBackupError,
    remoteBackup,
    signIn,
    signOut,
    backupNow,
    restoreFromDrive,
    checkRemoteBackup,
    setAutoBackupEnabled,
    clearError,
  } = useBackup();
  const { transactions, categories, budgets } = useFinance();
  const { toast } = useToast();
  const [restoreOpen, setRestoreOpen] = useState(false);

  const busy = status === 'signing-in' || status === 'checking' || status === 'backing-up' || status === 'restoring';

  const handleConnect = async () => {
    try {
      await signIn();
      // Probe Drive so user sees existing backup info immediately.
      try { await checkRemoteBackup(); } catch { /* swallow; surfaced via context */ }
    } catch {
      // Cancellation: no toast.
    }
  };

  const handleBackupNow = async () => {
    try {
      const counts = await backupNow();
      toast({
        title: 'Backed up to Google Drive',
        description: `${counts.transactions} transactions \u2022 ${counts.categories} categories \u2022 ${counts.budgets} budgets`,
      });
    } catch {
      // Error already in context.
    }
  };

  const handleOpenRestore = async () => {
    clearError();
    try {
      const info = await checkRemoteBackup();
      if (!info) {
        toast({ title: 'No backup on this account yet.' });
        return;
      }
      setRestoreOpen(true);
    } catch {
      // surfaced via context
    }
  };

  const handleConfirmRestore = async () => {
    try {
      const counts = await restoreFromDrive();
      setRestoreOpen(false);
      toast({
        title: 'Restore complete',
        description: `${counts.transactions} transactions restored.`,
      });
    } catch {
      setRestoreOpen(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
          <Cloud size={18} />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Google Drive Backup</p>
          <p className="text-xs text-muted-foreground">
            {isSignedIn
              ? 'Your data is backed up to your Google account.'
              : 'Sign in with Google to back up and restore your data.'}
          </p>
        </div>
      </div>

      {/* Testing-phase banner */}
      <div className="px-5 pt-4">
        <div className="relative overflow-hidden rounded-xl border border-amber-300/60 dark:border-amber-500/30 bg-gradient-to-br from-amber-50 via-orange-50 to-pink-50 dark:from-amber-500/10 dark:via-orange-500/10 dark:to-pink-500/10 p-4">
          <div className="pointer-events-none absolute -top-8 -right-8 w-28 h-28 rounded-full bg-amber-300/30 dark:bg-amber-400/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-8 w-28 h-28 rounded-full bg-pink-300/30 dark:bg-pink-400/10 blur-2xl" />
          <div className="relative flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <FlaskConical size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">The app is in testing phase</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Feel free to provide your email address to register as a test user.
              </p>
              <a
                href={`https://wa.me/${TESTER_WHATSAPP_PHONE}?text=${encodeURIComponent(TESTER_WHATSAPP_MESSAGE)}`}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="backup-tester-whatsapp"
                className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#25D366] text-white text-xs font-semibold hover:bg-[#1ebe57] transition-colors shadow-sm"
              >
                <WhatsAppIcon size={14} />
                Message on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-3">
        {/* Account row */}
        {isSignedIn && user ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/60">
            {user.imageUrl ? (
              <img src={user.imageUrl} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold">
                {user.email.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{user.name || user.email}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <button
              data-testid="backup-signout"
              onClick={() => void signOut()}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <LogOut size={13} /> Disconnect
            </button>
          </div>
        ) : (
          <button
            data-testid="backup-connect"
            onClick={handleConnect}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-40"
          >
            <Cloud size={15} />
            {status === 'signing-in' ? 'Connecting\u2026' : 'Connect Google Drive'}
          </button>
        )}

        {isSignedIn && (
          <>
            <button
              data-testid="backup-now"
              onClick={handleBackupNow}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[hsl(222,65%,13%)] text-white text-sm font-semibold hover:bg-[hsl(222,65%,18%)] transition-colors disabled:opacity-40"
            >
              <Upload size={15} />
              {status === 'backing-up' ? 'Uploading\u2026' : 'Backup now'}
            </button>
            <p className="text-xs text-muted-foreground pl-1">
              Last backed up: {relativeTime(lastBackupAt)}
            </p>

            <button
              data-testid="backup-restore"
              onClick={handleOpenRestore}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-muted/80 transition-colors disabled:opacity-40"
            >
              <RotateCw size={15} />
              {status === 'restoring' ? 'Restoring\u2026' : status === 'checking' ? 'Checking\u2026' : 'Restore from Drive'}
            </button>
            {remoteBackup?.exportedAt && (
              <p className="text-xs text-muted-foreground pl-1">
                Backup on Drive: {new Date(remoteBackup.exportedAt).toLocaleString()}
              </p>
            )}

            <label className="flex items-center justify-between py-2 pl-1 cursor-pointer">
              <span>
                <span className="block text-sm font-medium text-foreground">Auto-backup</span>
                <span className="block text-xs text-muted-foreground">Backs up every 7 days when you open the app.</span>
              </span>
              <Switch
                data-testid="backup-auto-toggle"
                checked={autoBackupEnabled}
                onCheckedChange={setAutoBackupEnabled}
              />
            </label>

            {lastAutoBackupError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 text-red-600 text-xs">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold">Last auto-backup failed</p>
                  <p>{lastAutoBackupError}</p>
                </div>
                <button onClick={handleBackupNow} className="font-semibold hover:underline">
                  Retry
                </button>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 text-red-600 text-xs">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <div className="flex-1">{error}</div>
            <button onClick={clearError} className="font-semibold hover:underline">Dismiss</button>
          </div>
        )}

        {status === 'idle' && lastBackupAt && !error && (
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 pl-1">
            <CheckCircle2 size={13} /> Up to date.
          </div>
        )}
      </div>

      <RestorePreviewDialog
        open={restoreOpen}
        onOpenChange={(open) => { if (!busy) setRestoreOpen(open); }}
        remote={remoteBackup}
        currentCounts={{
          transactions: transactions.length,
          categories: categories.length,
          budgets: budgets.length,
        }}
        onConfirm={handleConfirmRestore}
        busy={status === 'restoring'}
      />
    </div>
  );
}
