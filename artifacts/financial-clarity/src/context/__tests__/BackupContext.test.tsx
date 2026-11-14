import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { App } from '@capacitor/app';
import * as auth from '@/lib/googleAuth';
import * as drive from '@/lib/googleDrive';
import { FinanceProvider } from '../FinanceContext';
import { BackupProvider, isSignInCancelled, useBackup } from '../BackupContext';

vi.mock('@capacitor/app', () => ({
  App: { addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }) },
}));

vi.mock('@/lib/googleAuth', () => {
  const user = { id: 'u1', email: 'synthetic@example.invalid', name: 'Synthetic User' };
  return {
    getCurrentUser: () => user,
    isSignedIn: () => true,
    signIn: vi.fn().mockResolvedValue(user),
    signOut: vi.fn().mockResolvedValue(undefined),
    trySilentRefresh: vi.fn().mockResolvedValue(user),
  };
});

vi.mock('@/lib/googleDrive', () => {
  class DriveError extends Error {
    status: number;
    reason?: string;
    constructor(message: string, status: number, reason?: string) {
      super(message);
      this.status = status;
      this.reason = reason;
    }
  }
  return {
    BACKUP_FILE_NAME: 'finance-clarity-backup.json',
    DriveError,
    downloadBackup: vi.fn(),
    findBackupFile: vi.fn(),
    findOrCreateBackupFolder: vi.fn(),
    uploadBackup: vi.fn(),
    uploadSnapshot: vi.fn(),
  };
});

function wrapper({ children }: { children: ReactNode }) {
  return (
    <FinanceProvider>
      <BackupProvider>{children}</BackupProvider>
    </FinanceProvider>
  );
}

const REMOTE_RAW = '{"synthetic":"remote backup"}';

function remoteFile(countTransactions?: number) {
  return {
    id: 'remote-file',
    name: 'finance-clarity-backup.json',
    appProperties: countTransactions === undefined
      ? undefined
      : { countTransactions: String(countTransactions), exportedAt: '2026-11-01T00:00:00.000Z' },
  };
}

function seedTransactions(count: number) {
  const rows = Array.from({ length: count }, (_, i) => ({
    id: `t${i}`, type: 'expense', amount: 100 + i, categoryId: 'groceries', note: 'synthetic', date: '2026-11-01',
  }));
  localStorage.setItem('financial-clarity:transactions', JSON.stringify(rows));
}

async function renderBackup() {
  const hook = renderHook(() => useBackup(), { wrapper });
  await waitFor(() => expect(hook.result.current.isSignedIn).toBe(true));
  return hook;
}

describe('BackupContext backup overwrite guard', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(drive.findOrCreateBackupFolder).mockResolvedValue('folder');
    vi.mocked(drive.downloadBackup).mockResolvedValue(REMOTE_RAW);
    vi.mocked(drive.uploadSnapshot).mockResolvedValue({ id: 'snapshot', name: 'snapshot.json' });
    vi.mocked(drive.uploadBackup).mockResolvedValue(remoteFile(0));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('asks before replacing a Drive backup that has more transactions', async () => {
    vi.mocked(drive.findBackupFile).mockResolvedValue(remoteFile(12));
    const { result } = await renderBackup();

    let outcome: Awaited<ReturnType<typeof result.current.backupNow>> | undefined;
    await act(async () => { outcome = await result.current.backupNow(); });

    expect(outcome).toEqual({
      status: 'needs-confirmation',
      remoteTransactions: 12,
      localTransactions: 0,
      remoteExportedAt: '2026-11-01T00:00:00.000Z',
    });
    expect(drive.uploadBackup).not.toHaveBeenCalled();
    expect(drive.uploadSnapshot).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('saves a copy of the Drive backup before replacing it when confirmed', async () => {
    vi.mocked(drive.findBackupFile).mockResolvedValue(remoteFile(12));
    const { result } = await renderBackup();

    let outcome: Awaited<ReturnType<typeof result.current.backupNow>> | undefined;
    await act(async () => { outcome = await result.current.backupNow({ replaceLargerBackup: true }); });

    expect(outcome?.status).toBe('done');
    expect(drive.downloadBackup).toHaveBeenCalledWith('remote-file');
    expect(drive.uploadSnapshot).toHaveBeenCalledWith(
      'folder',
      expect.stringMatching(/^finance-clarity-backup\.pre-overwrite-.+\.json$/),
      REMOTE_RAW,
    );
    expect(drive.uploadBackup).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ fileId: 'remote-file' }));
    const snapshotOrder = vi.mocked(drive.uploadSnapshot).mock.invocationCallOrder[0];
    const uploadOrder = vi.mocked(drive.uploadBackup).mock.invocationCallOrder[0];
    expect(snapshotOrder).toBeLessThan(uploadOrder);
  });

  it('does not replace the Drive backup if the safety copy fails', async () => {
    vi.mocked(drive.findBackupFile).mockResolvedValue(remoteFile(12));
    vi.mocked(drive.uploadSnapshot).mockRejectedValue(new Error('Network down'));
    const { result } = await renderBackup();

    await act(async () => {
      await expect(result.current.backupNow({ replaceLargerBackup: true })).rejects.toThrow(/was not replaced/);
    });
    expect(drive.uploadBackup).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/was not replaced/);
  });

  it('replaces a smaller Drive backup without asking', async () => {
    seedTransactions(3);
    vi.mocked(drive.findBackupFile).mockResolvedValue(remoteFile(2));
    const { result } = await renderBackup();

    let outcome: Awaited<ReturnType<typeof result.current.backupNow>> | undefined;
    await act(async () => { outcome = await result.current.backupNow(); });

    expect(outcome).toMatchObject({ status: 'done', counts: { transactions: 3 } });
    expect(drive.uploadSnapshot).not.toHaveBeenCalled();
    expect(drive.uploadBackup).toHaveBeenCalledTimes(1);
  });

  it('asks when the Drive backup has no counts and cannot be read', async () => {
    seedTransactions(5);
    vi.mocked(drive.findBackupFile).mockResolvedValue(remoteFile());
    vi.mocked(drive.downloadBackup).mockResolvedValue('not json');
    const { result } = await renderBackup();

    let outcome: Awaited<ReturnType<typeof result.current.backupNow>> | undefined;
    await act(async () => { outcome = await result.current.backupNow(); });

    expect(outcome).toMatchObject({ status: 'needs-confirmation', remoteTransactions: null, localTransactions: 5 });
    expect(drive.uploadBackup).not.toHaveBeenCalled();
  });

  it('pauses auto-backup instead of replacing a larger Drive backup', async () => {
    localStorage.setItem('financial-clarity:backup-prefs', JSON.stringify({
      autoBackupEnabled: true,
      lastBackupAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
      lastBackupHash: 'stale',
      lastAutoBackupFailedAt: null,
      lastAutoBackupError: null,
      signedInEmail: null,
    }));
    vi.mocked(drive.findBackupFile).mockResolvedValue(remoteFile(12));
    const { result } = await renderBackup();

    const onResume = vi.mocked(App.addListener).mock.calls.at(-1)?.[1] as ((state: { isActive: boolean }) => void) | undefined;
    if (!onResume) throw new Error('appStateChange listener not registered');
    await act(async () => { onResume({ isActive: true }); });

    await waitFor(() => expect(result.current.lastAutoBackupError).toMatch(/Auto-backup paused/));
    expect(drive.uploadBackup).not.toHaveBeenCalled();
    expect(drive.uploadSnapshot).not.toHaveBeenCalled();
  });
});

describe('BackupContext Google account changes', () => {
  const FOLDER_CACHE_KEY = 'financial-clarity:backup-folder-id';

  beforeEach(() => {
    localStorage.clear();
    vi.mocked(drive.findOrCreateBackupFolder).mockResolvedValue('folder');
    vi.mocked(drive.findBackupFile).mockResolvedValue(remoteFile(4));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('keeps Drive state when signing in again with the same account', async () => {
    const { result } = await renderBackup();
    await act(async () => { await result.current.checkRemoteBackup(); });
    expect(localStorage.getItem(FOLDER_CACHE_KEY)).toBe('folder');

    await act(async () => { await result.current.signIn(); });

    expect(result.current.user?.id).toBe('u1');
    expect(result.current.remoteBackup?.fileId).toBe('remote-file');
    expect(localStorage.getItem(FOLDER_CACHE_KEY)).toBe('folder');
  });

  it('drops the previous account\u2019s Drive folder and backup info when a different account signs in', async () => {
    const { result } = await renderBackup();
    await act(async () => { await result.current.checkRemoteBackup(); });

    const other = { id: 'u2', email: 'other@example.invalid', name: 'Other User' };
    vi.mocked(auth.signIn).mockResolvedValueOnce(other);
    await act(async () => { await result.current.signIn(); });

    expect(result.current.user).toEqual(other);
    expect(result.current.remoteBackup).toBeNull();
    expect(localStorage.getItem(FOLDER_CACHE_KEY)).toBeNull();
  });

  it('keeps the signed-in account when sign-in is cancelled', async () => {
    const { result } = await renderBackup();
    vi.mocked(auth.signIn).mockRejectedValueOnce(new Error('The user canceled the sign-in flow.'));

    await act(async () => {
      await expect(result.current.signIn()).rejects.toThrow(/canceled/);
    });

    expect(result.current.user?.id).toBe('u1');
    expect(result.current.status).toBe('idle');
  });

  it('clears the account on this phone even if Google fails to confirm sign-out', async () => {
    const { result } = await renderBackup();
    await act(async () => { await result.current.checkRemoteBackup(); });
    vi.mocked(auth.signOut).mockRejectedValueOnce(new Error('Network down'));

    await act(async () => {
      await expect(result.current.signOut()).rejects.toThrow('Network down');
    });

    expect(result.current.isSignedIn).toBe(false);
    expect(result.current.remoteBackup).toBeNull();
    expect(localStorage.getItem(FOLDER_CACHE_KEY)).toBeNull();
  });
});

describe('isSignInCancelled', () => {
  it('recognises cancelled or closed Google prompts only', () => {
    expect(isSignInCancelled(new Error('The user canceled the sign-in flow.'))).toBe(true);
    expect(isSignInCancelled({ message: 'ignored' })).toBe(false);
    expect(isSignInCancelled('popup_closed_by_user')).toBe(true);
    expect(isSignInCancelled(new Error('Something went wrong: 10'))).toBe(false);
  });
});
