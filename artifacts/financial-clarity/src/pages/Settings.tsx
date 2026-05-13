import { useRef, useState, type ChangeEvent } from 'react';
import { Download, FileUp, Settings as SettingsIcon } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { buildTransactionsCsv, exportCsvFile, parseTransactionsCsv } from '@/lib/csv';
import { cn } from '@/lib/utils';

const IMPORT_COLORS = ['#10B981', '#6366F1', '#F59E0B', '#3B82F6', '#EF4444', '#F97316', '#8B5CF6', '#EC4899'];

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

export default function Settings() {
  const { transactions, categories, addCategory, importTransactions } = useFinance();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
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
    if (!file) return;

    setError('');
    setMessage('');
    setIsImporting(true);

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

        if ((existingCounts[key] || 0) > seen) {
          return [];
        }

        return [item];
      });

      const imported = importTransactions(items);
      setMessage(`Imported ${imported} transaction${imported === 1 ? '' : 's'}. Skipped ${rows.length - imported} duplicate${rows.length - imported === 1 ? '' : 's'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setIsImporting(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8">
      <div className="mb-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Settings</h1>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <SettingsIcon size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">CSV Backup</p>
            <p className="text-xs text-muted-foreground">Export or restore records using the same CSV format.</p>
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
    </div>
  );
}
