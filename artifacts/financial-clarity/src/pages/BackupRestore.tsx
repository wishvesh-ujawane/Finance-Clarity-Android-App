import { useRef, useState, type ChangeEvent } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Download, FileUp, Settings as SettingsIcon } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { buildTransactionsCsv, exportCsvFile, parseTransactionsCsv, planCsvImport } from '@/lib/csv';
import { createId } from '@/lib/ids';
import type { Category } from '@/lib/types';
import { cn } from '@/lib/utils';
import { BackupSettingsCard } from '@/components/BackupSettingsCard';
import { CsvImportPreviewDialog, type CsvImportPreview } from '@/components/CsvImportPreviewDialog';

const IMPORT_COLORS = ['#10B981', '#6366F1', '#F59E0B', '#3B82F6', '#EF4444', '#F97316', '#8B5CF6', '#EC4899'];
const MAX_CSV_BYTES = 5 * 1024 * 1024;

export default function BackupRestore() {
  const [, setLocation] = useLocation();
  const { transactions, categories, importTransactions } = useFinance();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState<CsvImportPreview | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleExport = async () => {
    setError('');
    setMessage('');
    setIsExporting(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `financial-clarity-all-${stamp}.csv`;
      await exportCsvFile(filename, buildTransactionsCsv(transactions, categories));
      setMessage(`Export ready: ${filename}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;

    setError('');
    setMessage('');

    if (file.size > MAX_CSV_BYTES) {
      setError('This file is larger than 5 MB and was not imported. Your data is unchanged.');
      return;
    }

    try {
      const { rows, invalidRows } = parseTransactionsCsv(await file.text());
      if (rows.length === 0 && invalidRows.length === 0) {
        setError('This CSV has no transaction rows. Your data is unchanged.');
        return;
      }
      setPreview({ fileName: file.name, plan: planCsvImport(rows, transactions, categories), invalidRows });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'The file could not be read.';
      setError(`${reason} Your data is unchanged.`);
    }
  };

  const confirmImport = () => {
    if (!preview || isImporting) return;
    setIsImporting(true);
    try {
      const newCategories: Category[] = preview.plan.categoriesToCreate.map((entry, index) => ({
        id: createId(),
        name: entry.name,
        icon: 'DollarSign',
        color: IMPORT_COLORS[index % IMPORT_COLORS.length],
        type: entry.type,
      }));
      const createdIds = new Map(preview.plan.categoriesToCreate.map((entry, index) => [entry.key, newCategories[index].id]));

      const items = preview.plan.items.flatMap(item => {
        const categoryId = item.categoryId ?? (item.newCategoryKey ? createdIds.get(item.newCategoryKey) : undefined);
        if (!categoryId) return [];
        const { date, type, amount, note } = item.row;
        return [{ date, type, amount, note, categoryId }];
      });

      // Categories and transactions are saved together, or not at all.
      const result = importTransactions(items, newCategories);
      setPreview(null);
      if (!result.ok) {
        setError(`Nothing was imported. ${result.message}`);
        return;
      }
      const skippedDuplicates = preview.plan.duplicateCount;
      const skippedInvalid = preview.invalidRows.length;
      const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
      setMessage(
        `Imported ${plural(result.count, 'transaction')}. Skipped ${plural(skippedDuplicates, 'duplicate')}` +
        (skippedInvalid > 0 ? ` and ${plural(skippedInvalid, 'invalid row')}.` : '.'),
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8">
      <div className="flex items-center gap-2 mb-6">
        <button
          type="button"
          data-testid="backup-back"
          onClick={() => setLocation('/settings')}
          className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Back to settings"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Settings</p>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Backup & Restore</h1>
        </div>
      </div>

      <BackupSettingsCard />

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <SettingsIcon size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">CSV Backup</p>
            <p className="text-xs text-muted-foreground">Transactions only. Not a full backup; use Google Drive backup for budgets, recurring rules, and settings.</p>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <button
            data-testid="settings-export-csv"
            onClick={handleExport}
            disabled={isExporting || transactions.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[hsl(222,65%,13%)] text-white text-sm font-semibold hover:bg-[hsl(222,65%,18%)] transition-colors disabled:opacity-40"
          >
            <Download size={15} />
            {isExporting ? 'Preparing Export' : 'Export CSV'}
          </button>

          <input
            ref={inputRef}
            data-testid="settings-import-input"
            type="file"
            accept=".csv,text/csv"
            onChange={handleImport}
            className="hidden"
          />
          <button
            data-testid="settings-import-csv"
            onClick={() => inputRef.current?.click()}
            disabled={isImporting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-40"
          >
            <FileUp size={15} />
            {isImporting ? 'Importing CSV' : 'Import CSV'}
          </button>

          {(message || error) && (
            <p className={cn('text-xs font-medium', error ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400')}>
              {error || message}
            </p>
          )}
        </div>
      </div>

      <CsvImportPreviewDialog
        preview={preview}
        busy={isImporting}
        onCancel={() => setPreview(null)}
        onConfirm={confirmImport}
      />
    </div>
  );
}
