import { useState } from 'react';
import { Link } from 'wouter';
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronRight, LogIn, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { isSignInCancelled, useBackup } from '@/context/BackupContext';
import { useSecurity } from '@/context/SecurityContext';
import { ProfileAvatar } from '@/components/ProfileAvatar';

type ProfileAction = 'sign-in' | 'refresh' | 'disconnect';

const OFFLINE_MESSAGE = 'You\u2019re offline. Your data on this phone is safe. Connect to the internet and try again.';
const SIGN_IN_FAILED_MESSAGE =
  'Couldn\u2019t sign in to Google. Your data on this phone is safe. Check your connection and try again.';

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export default function Profile() {
  const { user, isSignedIn, status, signIn, signOut } = useBackup();
  const { isAppLockEnabled, settings: securitySettings } = useSecurity();
  const [action, setAction] = useState<ProfileAction | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Backup, restore, and Drive checks use the current account, so account
  // changes wait until they finish.
  const busy = action !== null || (status !== 'idle' && status !== 'error');

  const runSignIn = async (kind: 'sign-in' | 'refresh') => {
    if (busy) return;
    setMessage('');
    setError('');
    if (isOffline()) {
      setError(OFFLINE_MESSAGE);
      return;
    }
    const previousId = user?.id ?? null;
    setAction(kind);
    try {
      const next = await signIn();
      if (kind === 'sign-in') setMessage(`Signed in as ${next.email}.`);
      else if (previousId && previousId !== next.id) setMessage(`Switched to ${next.email}.`);
      else setMessage('Profile updated from Google.');
    } catch (err) {
      if (!isSignInCancelled(err)) setError(SIGN_IN_FAILED_MESSAGE);
    } finally {
      setAction(null);
    }
  };

  const handleDisconnect = async () => {
    if (busy) return;
    setMessage('');
    setError('');
    setAction('disconnect');
    try {
      await signOut();
      setMessage('Google disconnected. Your data on this phone and your Drive backups are kept.');
    } catch {
      setError('Google didn\u2019t confirm the sign-out, but Fiscal Focus is disconnected on this phone. Your data is safe.');
    } finally {
      setAction(null);
    }
  };

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/settings"
          data-testid="profile-back"
          className="tap-target w-9 h-9 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Back to settings"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Settings</p>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Profile</h1>
        </div>
      </div>

      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">Google account</p>
      <div className="bg-card border border-border rounded-2xl overflow-hidden mb-6" data-testid="profile-account-card">
        {isSignedIn && user ? (
          <div className="p-5 flex flex-col items-center text-center gap-3">
            <ProfileAvatar user={user} size="lg" />
            <div className="min-w-0 max-w-full">
              <p className="text-base font-bold text-foreground truncate" data-testid="profile-name">{user.name || user.email}</p>
              <p className="text-sm text-muted-foreground truncate" data-testid="profile-email">{user.email}</p>
            </div>
            <p className="text-xs text-muted-foreground max-w-sm">
              Your name and photo come from your Google account. To change them, update your Google account, then tap Refresh from Google.
            </p>
            <div className="w-full space-y-3 pt-1">
              <button
                type="button"
                data-testid="profile-refresh"
                onClick={() => void runSignIn('refresh')}
                disabled={busy}
                aria-busy={action === 'refresh'}
                className="w-full min-h-12 flex items-center justify-center gap-2 px-4 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-muted/80 transition-colors disabled:opacity-40"
              >
                <RefreshCw size={15} className={action === 'refresh' ? 'animate-spin' : undefined} />
                {action === 'refresh' ? 'Refreshing\u2026' : 'Refresh from Google'}
              </button>
              <button
                type="button"
                data-testid="profile-disconnect"
                onClick={() => void handleDisconnect()}
                disabled={busy}
                aria-busy={action === 'disconnect'}
                className="w-full min-h-12 flex items-center justify-center gap-2 px-4 rounded-xl border border-danger/30 text-danger text-sm font-semibold hover:bg-danger-tint transition-colors disabled:opacity-40"
              >
                <LogOut size={15} />
                {action === 'disconnect' ? 'Disconnecting\u2026' : 'Disconnect Google'}
              </button>
              <p className="text-xs text-muted-foreground">
                Disconnecting keeps the data on this phone and your Google Drive backups.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-5 flex flex-col items-center text-center gap-3" data-testid="profile-signed-out">
            <ProfileAvatar user={null} size="lg" />
            <div>
              <p className="text-base font-bold text-foreground">You&rsquo;re not signed in</p>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                Sign in with Google to show your name and photo here and to back up your data to Google Drive.
                Fiscal Focus works fully without signing in.
              </p>
            </div>
            <button
              type="button"
              data-testid="profile-sign-in"
              onClick={() => void runSignIn('sign-in')}
              disabled={busy}
              aria-busy={action === 'sign-in'}
              className="w-full min-h-12 flex items-center justify-center gap-2 px-4 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-40"
            >
              <LogIn size={15} />
              {action === 'sign-in' ? 'Signing in\u2026' : 'Sign in with Google'}
            </button>
          </div>
        )}

        {(message || error) && (
          <div className="px-5 pb-5">
            {error ? (
              <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-danger-tint text-danger text-xs">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <p className="flex-1">{error}</p>
              </div>
            ) : (
              <p role="status" className="flex items-center justify-center gap-2 text-xs font-medium text-success">
                <CheckCircle2 size={13} /> {message}
              </p>
            )}
          </div>
        )}
      </div>

      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">Security</p>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <Link
          href="/settings/security"
          data-testid="profile-security-link"
          className="w-full min-h-14 flex items-center gap-3 px-5 py-3 text-left hover:bg-muted/40 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">App Lock &amp; Security</p>
            <p className="text-xs text-muted-foreground">
              {isAppLockEnabled
                ? `App lock is on${securitySettings?.biometricEnabled ? ' \u2022 biometrics enabled' : ''}`
                : 'Set a PIN to lock the app. Biometrics are offered on supported devices.'}
            </p>
          </div>
          <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
        </Link>
      </div>
    </div>
  );
}
