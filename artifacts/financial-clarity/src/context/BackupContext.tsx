import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { App, type AppState } from '@capacitor/app';
import { useFinance } from './FinanceContext';
import {
  getCurrentUser,
  isSignedIn as isSignedInLib,
  signIn as signInLib,
  signOut as signOutLib,
  trySilentRefresh,
  type GoogleUser,
} from '@/lib/googleAuth';
import {
  BACKUP_FILE_NAME,
  DriveError,
  downloadBackup,
  findBackupFile,
  findOrCreateBackupFolder,
  uploadBackup,
  uploadSnapshot,
  type DriveFile,
} from '@/lib/googleDrive';
import {
  applyBackup,
  buildBackup,
  hashBackupData,
  parseBackup,
  serializeBackup,
  validateBackup,
  type BackupCounts,
  type BackupFile,
} from '@/lib/backup';

const PREFS_KEY = 'financial-clarity:backup-prefs';
const DRIVE_FOLDER_CACHE_KEY = 'financial-clarity:backup-folder-id';
const AUTO_BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type BackupStatus =
  | 'idle'
  | 'signing-in'
  | 'checking'
  | 'backing-up'
  | 'restoring'
  | 'error';

export interface RemoteBackupInfo {
  fileId: string;
  exportedAt?: string;
  device?: string;
  counts?: BackupCounts;
  size?: string;
  modifiedTime?: string;
}

interface BackupPrefs {
  autoBackupEnabled: boolean;
  lastBackupAt: number | null;
  lastBackupHash: string | null;
  lastAutoBackupFailedAt: number | null;
  lastAutoBackupError: string | null;
  signedInEmail: string | null;
}

const DEFAULT_PREFS: BackupPrefs = {
  autoBackupEnabled: true,
  lastBackupAt: null,
  lastBackupHash: null,
  lastAutoBackupFailedAt: null,
  lastAutoBackupError: null,
  signedInEmail: null,
};

function readPrefs(): BackupPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<BackupPrefs>;
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function writePrefs(prefs: BackupPrefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}

function humanizeError(err: unknown): string {
  if (err instanceof DriveError) {
    if (err.reason === 'storageQuotaExceeded') {
      return 'Your Google Drive is full. Free up space and try again.';
    }
    if (err.reason === 'insufficientPermissions' || err.status === 403) {
      return 'Permission was removed. Please reconnect Google Drive.';
    }
    if (err.status === 404) {
      return 'Backup not found on Drive — it may have been deleted.';
    }
    if (err.status === 401) {
      return 'Session expired — please reconnect Google Drive.';
    }
    return err.message;
  }
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return 'No internet — try again when you\'re back online.';
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

function appPropertiesFor(backup: BackupFile): Record<string, string> {
  return {
    schemaVersion: String(backup.schemaVersion),
    appVersion: backup.appVersion,
    exportedAt: backup.exportedAt,
    devicePlatform: backup.device.platform,
    deviceModel: backup.device.model ?? '',
    countTransactions: String(backup.counts.transactions),
    countCategories: String(backup.counts.categories),
    countBudgets: String(backup.counts.budgets),
    countRecurring: String(backup.counts.recurringExpenses),
    countSavings: String(backup.counts.savingsGoal),
  };
}

function remoteInfoFromDriveFile(file: DriveFile): RemoteBackupInfo {
  const ap = file.appProperties ?? {};
  const counts: BackupCounts | undefined = ap.countTransactions !== undefined
    ? {
        transactions: Number(ap.countTransactions) || 0,
        categories: Number(ap.countCategories) || 0,
        budgets: Number(ap.countBudgets) || 0,
        recurringExpenses: Number(ap.countRecurring) || 0,
        savingsGoal: Number(ap.countSavings) || 0,
      }
    : undefined;
  return {
    fileId: file.id,
    exportedAt: ap.exportedAt ?? file.modifiedTime,
    device: ap.deviceModel || ap.devicePlatform,
    counts,
    size: file.size,
    modifiedTime: file.modifiedTime,
  };
}

interface BackupContextValue {
  // Auth
  user: GoogleUser | null;
  isSignedIn: boolean;
  // Status
  status: BackupStatus;
  error: string | null;
  // Prefs
  lastBackupAt: number | null;
  autoBackupEnabled: boolean;
  lastAutoBackupError: string | null;
  // Remote state
  remoteBackup: RemoteBackupInfo | null;
  // Actions
  signIn: () => Promise<GoogleUser>;
  signOut: () => Promise<void>;
  checkRemoteBackup: () => Promise<RemoteBackupInfo | null>;
  backupNow: () => Promise<BackupCounts>;
  restoreFromDrive: (info?: RemoteBackupInfo) => Promise<BackupCounts>;
  setAutoBackupEnabled: (enabled: boolean) => void;
  clearError: () => void;
}

const BackupContext = createContext<BackupContextValue | null>(null);

export function BackupProvider({ children }: { children: ReactNode }) {
  const { reloadFromStorage, lastChangedAt } = useFinance();

  const [user, setUser] = useState<GoogleUser | null>(null);
  const [status, setStatus] = useState<BackupStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<BackupPrefs>(() => readPrefs());
  const [remoteBackup, setRemoteBackup] = useState<RemoteBackupInfo | null>(null);

  const folderIdRef = useRef<string | null>(localStorage.getItem(DRIVE_FOLDER_CACHE_KEY));
  const autoBackupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Try silent refresh on mount so the user stays signed in across launches.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await trySilentRefresh();
      if (cancelled) return;
      if (cached) setUser(cached);
    })();
    return () => { cancelled = true; };
  }, []);

  const updatePrefs = useCallback((patch: Partial<BackupPrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch };
      writePrefs(next);
      return next;
    });
  }, []);

  const ensureFolder = useCallback(async (): Promise<string> => {
    if (folderIdRef.current) return folderIdRef.current;
    const id = await findOrCreateBackupFolder();
    folderIdRef.current = id;
    try { localStorage.setItem(DRIVE_FOLDER_CACHE_KEY, id); } catch { /* ignore */ }
    return id;
  }, []);

  const signIn = useCallback(async (): Promise<GoogleUser> => {
    setError(null);
    setStatus('signing-in');
    try {
      const u = await signInLib();
      setUser(u);
      updatePrefs({ signedInEmail: u.email });
      setStatus('idle');
      return u;
    } catch (err) {
      setStatus('idle'); // Sign-in cancellation should not show error UI.
      throw err;
    }
  }, [updatePrefs]);

  const signOut = useCallback(async () => {
    await signOutLib();
    setUser(null);
    setRemoteBackup(null);
    updatePrefs({ signedInEmail: null });
  }, [updatePrefs]);

  const checkRemoteBackup = useCallback(async (): Promise<RemoteBackupInfo | null> => {
    setError(null);
    setStatus('checking');
    try {
      const folderId = await ensureFolder();
      const file = await findBackupFile(folderId);
      const info = file ? remoteInfoFromDriveFile(file) : null;
      setRemoteBackup(info);
      setStatus('idle');
      return info;
    } catch (err) {
      setStatus('error');
      setError(humanizeError(err));
      throw err;
    }
  }, [ensureFolder]);

  const backupNow = useCallback(async (): Promise<BackupCounts> => {
    setError(null);
    setStatus('backing-up');
    try {
      const folderId = await ensureFolder();
      const existing = await findBackupFile(folderId);
      const backup = buildBackup();
      const json = serializeBackup(backup);
      const file = await uploadBackup(json, {
        fileId: existing?.id,
        folderId,
        appProperties: appPropertiesFor(backup),
      });
      const hash = await hashBackupData(backup);
      updatePrefs({
        lastBackupAt: Date.now(),
        lastBackupHash: hash,
        lastAutoBackupFailedAt: null,
        lastAutoBackupError: null,
      });
      setRemoteBackup(remoteInfoFromDriveFile(file));
      setStatus('idle');
      return backup.counts;
    } catch (err) {
      setStatus('error');
      setError(humanizeError(err));
      throw err;
    }
  }, [ensureFolder, updatePrefs]);

  const restoreFromDrive = useCallback(async (
    info?: RemoteBackupInfo,
  ): Promise<BackupCounts> => {
    setError(null);
    setStatus('restoring');
    try {
      const folderId = await ensureFolder();
      let target: RemoteBackupInfo | null = info ?? remoteBackup;
      if (!target) {
        const file = await findBackupFile(folderId);
        if (!file) throw new DriveError('No backup found', 404);
        target = remoteInfoFromDriveFile(file);
      }
      // Pre-restore safety snapshot.
      try {
        const snapshot = buildBackup();
        if (snapshot.counts.transactions > 0 || snapshot.counts.categories > 0) {
          const snapshotName = `finance-clarity-backup.pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
          await uploadSnapshot(folderId, snapshotName, serializeBackup(snapshot));
        }
      } catch {
        // Snapshot is best-effort; do not block restore.
      }

      const raw = await downloadBackup(target.fileId);
      const parsed = parseBackup(raw);
      const validation = validateBackup(parsed);
      if (!validation.ok) {
        const message =
          validation.reason === 'newer-version'
            ? validation.errors[0]
            : validation.reason === 'invalid-data' || validation.reason === 'invalid-shape'
              ? 'This backup file appears damaged and cannot be restored.'
              : `Couldn\u2019t restore backup: ${validation.errors[0]}`;
        throw new Error(message);
      }
      const result = applyBackup(validation.backup);
      reloadFromStorage();
      const hash = await hashBackupData(validation.backup);
      updatePrefs({
        lastBackupAt: Date.now(),
        lastBackupHash: hash,
      });
      setStatus('idle');
      return result.counts;
    } catch (err) {
      setStatus('error');
      setError(humanizeError(err));
      throw err;
    }
  }, [ensureFolder, reloadFromStorage, remoteBackup, updatePrefs]);

  const setAutoBackupEnabled = useCallback((enabled: boolean) => {
    updatePrefs({ autoBackupEnabled: enabled });
  }, [updatePrefs]);

  const clearError = useCallback(() => {
    setError(null);
    if (status === 'error') setStatus('idle');
  }, [status]);

  // ---------------- Auto-backup ----------------
  const runAutoBackup = useCallback(async () => {
    if (!prefs.autoBackupEnabled) return;
    if (!isSignedInLib()) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    if (status !== 'idle') return;
    const due = prefs.lastBackupAt === null || (Date.now() - prefs.lastBackupAt) >= AUTO_BACKUP_INTERVAL_MS;
    if (!due) return;

    // Skip if data unchanged since last backup.
    try {
      const snapshot = buildBackup();
      const hash = await hashBackupData(snapshot);
      if (hash === prefs.lastBackupHash) {
        updatePrefs({ lastBackupAt: Date.now() }); // Reset clock without uploading.
        return;
      }
    } catch {
      // Fall through; backupNow will catch real errors.
    }

    try {
      await backupNow();
    } catch (err) {
      updatePrefs({
        lastAutoBackupFailedAt: Date.now(),
        lastAutoBackupError: humanizeError(err),
      });
    }
  }, [backupNow, prefs.autoBackupEnabled, prefs.lastBackupAt, prefs.lastBackupHash, status, updatePrefs]);

  // Trigger debounced auto-backup attempt when local data changes.
  useEffect(() => {
    if (autoBackupTimerRef.current) clearTimeout(autoBackupTimerRef.current);
    autoBackupTimerRef.current = setTimeout(() => { void runAutoBackup(); }, 30_000);
    return () => {
      if (autoBackupTimerRef.current) clearTimeout(autoBackupTimerRef.current);
    };
  }, [lastChangedAt, runAutoBackup]);

  // Also check on app foreground / cold start.
  useEffect(() => {
    void runAutoBackup();
    let remove: (() => void) | null = null;
    let cancelled = false;
    void App.addListener('appStateChange', (state: AppState) => {
      if (state.isActive) void runAutoBackup();
    }).then(handle => {
      if (cancelled) {
        void handle.remove();
        return;
      }
      remove = () => { void handle.remove(); };
    }).catch(() => { /* App plugin unavailable on web; ignore. */ });
    return () => {
      cancelled = true;
      if (remove) remove();
    };
  }, [runAutoBackup]);

  const value: BackupContextValue = {
    user,
    isSignedIn: user !== null,
    status,
    error,
    lastBackupAt: prefs.lastBackupAt,
    autoBackupEnabled: prefs.autoBackupEnabled,
    lastAutoBackupError: prefs.lastAutoBackupError,
    remoteBackup,
    signIn,
    signOut,
    checkRemoteBackup,
    backupNow,
    restoreFromDrive,
    setAutoBackupEnabled,
    clearError,
  };

  return <BackupContext.Provider value={value}>{children}</BackupContext.Provider>;
}

export function useBackup() {
  const ctx = useContext(BackupContext);
  if (!ctx) throw new Error('useBackup must be used within BackupProvider');
  return ctx;
}

// Re-export for components.
export { BACKUP_FILE_NAME };
