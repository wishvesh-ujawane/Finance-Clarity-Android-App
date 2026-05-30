import { useRef, useState, type ChangeEvent } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, CloudUpload, Download, FileUp, ShieldCheck } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { buildTransactionsCsv, exportCsvFile, parseTransactionsCsv } from '@/lib/csv';
import {
  downloadBackupFromDrive,
  getConfiguredGoogleAndroidClientId,
  getConfiguredGoogleWebClientId,
  requestGoogleDriveToken,
  uploadBackupToDrive,
} from '@/lib/google-drive';
import type { BackupManifest } from '@/lib/types';
import { cn } from '@/lib/utils';

const IMPORT_COLORS = ['#10B981', '#6366F1', '#F59E0B', '#3B82F6', '#EF4444', '#F97316', '#8B5CF6', '#EC4899'];
const CATEGORY_COLORS = [
  '#10B981', '#6366F1', '#F59E0B', '#3B82F6', '#EF4444',
  '#F97316', '#8B5CF6', '#EC4899', '#14B8A6', '#06B6D4',
  '#84CC16', '#D946EF', '#0EA5E9', '#F43F5E',
];

function transactionKey(input: {
  date: string;
  type: 'income' | 'expense';
  amount: number;
  categoryId: string;
  note?: string;
}) {
  return [input.date, input.type, input.amount.toFixed(2), input.categoryId, input.note || ''].join('|');
}

function countByKey(keys: string[]) {
  return keys.reduce<Record<string, number>>((counts, key) => {
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function manifestCounts(manifest: BackupManifest) {
  return {
    createdAt: new Date(manifest.createdAt).toLocaleString('en-IN'),
    transactions: manifest.summary?.transactions ?? 0,
    categories: manifest.summary?.categories ?? 0,
    budgets: manifest.summary?.budgets ?? 0,
    recurringEntries: manifest.summary?.recurringEntries ?? 0,
  };
}

export default function BackupRestore() {
  const [, navigate] = useLocation();
  const {
    transactions,
    categories,
    addCategory,
    importTransactions,
    buildEncryptedBackup,
    restoreEncryptedBackup,
  } = useFinance();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isFetchingRestore, setIsFetchingRestore] = useState(false);
  const [isApplyingRestore, setIsApplyingRestore] = useState(false);
  const [pendingRestoreManifest, setPendingRestoreManifest] = useState<BackupManifest | null>(null);
  const [localManifestPreview, setLocalManifestPreview] = useState<BackupManifest | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const androidClientId = getConfiguredGoogleAndroidClientId();
  const webClientId = getConfiguredGoogleWebClientId();

  const createCsvBackup = async () => {
    setError('');
    setMessage('');
    setIsExportingCsv(true);

    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `financial-clarity-backup-${stamp}.csv`;
      await exportCsvFile(filename, buildTransactionsCsv(transactions, categories));
      setMessage(`CSV export ready: ${filename}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV export failed.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const importCsvFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setMessage('');
    setIsImportingCsv(true);

    try {
      const rows = parseTransactionsCsv(await file.text());
      const categoryByNameAndType = new Map(
        categories.map(category => [`${category.name.toLowerCase()}|${category.type}`, category])
      );
      const categoryById = new Map(categories.map(category => [category.id, category]));

      const existingCounts = countByKey(transactions.map(transaction => {
        const category = categoryById.get(transaction.categoryId);
        return transactionKey(transaction) + `|${category?.name.toLowerCase() || ''}`;
      }));

      const seenCounts: Record<string, number> = {};
      const items = rows.flatMap((row, index) => {
        const lookupKey = `${row.categoryName.toLowerCase()}|${row.type}`;
        const bothLookupKey = `${row.categoryName.toLowerCase()}|both`;
        let category = categoryByNameAndType.get(lookupKey) || categoryByNameAndType.get(bothLookupKey);

        if (!category) {
          category = addCategory({
            name: row.categoryName,
            icon: 'DollarSign',
            color: IMPORT_COLORS[index % IMPORT_COLORS.length],
            type: row.type,
          });
          categoryByNameAndType.set(lookupKey, category);
        }

        const item = {
          date: row.date,
          type: row.type,
          amount: row.amount,
          categoryId: category.id,
          note: row.note,
        };

        const key = transactionKey(item) + `|${row.categoryName.toLowerCase()}`;
        const seen = seenCounts[key] || 0;
        seenCounts[key] = seen + 1;

        if ((existingCounts[key] || 0) > seen) return [];
        return [item];
      });

      const imported = importTransactions(items);
      setMessage(`Imported ${imported} transaction${imported === 1 ? '' : 's'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV import failed.');
    } finally {
      setIsImportingCsv(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const backupToGoogleDrive = async () => {
    if (!androidClientId || !webClientId) {
      setError('Google OAuth is not configured.');
      return;
    }

    setError('');
    setMessage('');
    setIsBackingUp(true);

    try {
      const token = await requestGoogleDriveToken(androidClientId, webClientId);
      const manifest = await buildEncryptedBackup();
      await uploadBackupToDrive(token, JSON.stringify(manifest));
      setMessage('Encrypted backup uploaded to Google Drive.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Drive backup failed.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const fetchDriveBackup = async () => {
    if (!androidClientId || !webClientId) {
      setError('Google OAuth is not configured.');
      return;
    }

    setError('');
    setMessage('');
    setIsFetchingRestore(true);

    try {
      const token = await requestGoogleDriveToken(androidClientId, webClientId);
      const raw = await downloadBackupFromDrive(token);
      if (!raw) {
        setMessage('No cloud backup found in Google Drive app data.');
        return;
      }

      const cloudManifest = JSON.parse(raw) as BackupManifest;
      const localManifest = await buildEncryptedBackup();
      setPendingRestoreManifest(cloudManifest);
      setLocalManifestPreview(localManifest);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Drive restore failed.');
    } finally {
      setIsFetchingRestore(false);
    }
  };

  const applyRestore = async (mode: 'merge' | 'replace') => {
    if (!pendingRestoreManifest) return;

    setIsApplyingRestore(true);
    setError('');
    setMessage('');

    try {
      await restoreEncryptedBackup(pendingRestoreManifest, mode);
      setPendingRestoreManifest(null);
      setLocalManifestPreview(null);
      setMessage(mode === 'merge'
        ? 'Cloud backup merged into local data.'
        : 'Local data replaced with cloud backup.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed.');
    } finally {
      setIsApplyingRestore(false);
    }
  };

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8 space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/settings')}
          className="inline-flex items-center justify-center rounded-full border border-border p-2 text-muted-foreground hover:border-accent/70 hover:text-accent transition-colors"
          aria-label="Back to settings"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Backup & Restore</p>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
            Safe data copy
          </h1>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <ShieldCheck size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Google Drive backup</p>
            <p className="text-xs text-muted-foreground">Securely store and restore app data from your Drive app data folder.</p>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <button
            onClick={backupToGoogleDrive}
            disabled={isBackingUp}
            className="w-full rounded-xl px-4 py-3 bg-[hsl(222,65%,13%)] text-white text-sm font-semibold hover:bg-[hsl(222,65%,18%)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CloudUpload size={15} />
            {isBackingUp ? 'Backing Up' : 'Backup to Google Drive'}
          </button>
          <button
            onClick={fetchDriveBackup}
            disabled={isFetchingRestore}
            className="w-full rounded-xl px-4 py-3 border border-border text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Download size={15} />
            {isFetchingRestore ? 'Loading Backup' : 'Restore from Google Drive'}
          </button>

          {pendingRestoreManifest && localManifestPreview && (
            <div className="border border-border rounded-xl p-3 bg-muted/20 space-y-3">
              <p className="text-xs font-bold text-foreground">Restore preview</p>
              <p className="text-xs text-muted-foreground">
                Local: {manifestCounts(localManifestPreview).createdAt} • Txn {manifestCounts(localManifestPreview).transactions} • Cat {manifestCounts(localManifestPreview).categories}
              </p>
              <p className="text-xs text-muted-foreground">
                Cloud: {manifestCounts(pendingRestoreManifest).createdAt} • Txn {manifestCounts(pendingRestoreManifest).transactions} • Cat {manifestCounts(pendingRestoreManifest).categories}
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => applyRestore('merge')}
                  disabled={isApplyingRestore}
                  className="flex-1 rounded-xl px-3 py-2 bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  Merge
                </button>
                <button
                  onClick={() => applyRestore('replace')}
                  disabled={isApplyingRestore}
                  className="flex-1 rounded-xl px-3 py-2 border border-border text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
                >
                  Replace Local
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <Download size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">CSV backup</p>
            <p className="text-xs text-muted-foreground">Export transactions as CSV or import records from a CSV file.</p>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <button
            onClick={createCsvBackup}
            disabled={isExportingCsv || transactions.length === 0}
            className="w-full rounded-xl px-4 py-3 bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <FileUp size={15} />
            {isExportingCsv ? 'Preparing CSV' : 'Export CSV'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={importCsvFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImportingCsv}
            className="w-full rounded-xl px-4 py-3 border border-border text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <FileUp size={15} />
            {isImportingCsv ? 'Importing CSV' : 'Import CSV'}
          </button>
        </div>
      </div>

      {(message || error) && (
        <div className={cn(
          'rounded-2xl border p-4 text-sm',
          error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
        )}
        >
          {error || message}
        </div>
      )}
    </div>
  );
}
