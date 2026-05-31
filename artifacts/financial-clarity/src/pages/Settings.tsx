import { useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'wouter';
import { ChevronRight, Download, FileUp, Repeat, ShieldCheck, Settings as SettingsIcon, Target, PiggyBank, Shapes } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { useSecurity } from '@/context/SecurityContext';
import { buildTransactionsCsv, exportCsvFile, parseTransactionsCsv } from '@/lib/csv';
import { formatINR } from '@/lib/finance-utils';
import { cn } from '@/lib/utils';
import { BackupSettingsCard } from '@/components/BackupSettingsCard';

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
  const { transactions, categories, addCategory, importTransactions, recurringExpenses, savingsGoal, setSavingsGoal } = useFinance();
  const { isAppLockEnabled, settings: securitySettings } = useSecurity();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [goalMonthlyInput, setGoalMonthlyInput] = useState(String(savingsGoal.goal.monthly || ''));
  const [goalAnnualInput, setGoalAnnualInput] = useState(String(savingsGoal.goal.annual || ''));
  const [emergencyMonthlyInput, setEmergencyMonthlyInput] = useState(String(savingsGoal.emergency.monthly || ''));
  const [emergencyAnnualInput, setEmergencyAnnualInput] = useState(String(savingsGoal.emergency.annual || ''));
  const [goalSavedMessage, setGoalSavedMessage] = useState('');

  const handleSaveGoal = () => {
    setSavingsGoal({
      goal: {
        monthly: parseFloat(goalMonthlyInput) || 0,
        annual: parseFloat(goalAnnualInput) || 0,
      },
      emergency: {
        monthly: parseFloat(emergencyMonthlyInput) || 0,
        annual: parseFloat(emergencyAnnualInput) || 0,
      },
    });
    setGoalSavedMessage('Savings goals saved.');
    setTimeout(() => setGoalSavedMessage(''), 2500);
  };

  const activeRecurringCount = recurringExpenses.filter(r => r.active).length;

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

      <div className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
        <Link href="/settings/security">
          <button
            type="button"
            data-testid="settings-security-link"
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-accent/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              <ShieldCheck size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Security</p>
              <p className="text-xs text-muted-foreground">
                {isAppLockEnabled
                  ? `App lock is on${securitySettings?.biometricEnabled ? ' \u2022 biometrics enabled' : ''}`
                  : 'Set a PIN to lock the app. Biometrics are offered on supported devices.'}
              </p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </Link>

        <div className="border-t border-border" />

        <Link href="/settings/categories">
          <button
            type="button"
            data-testid="settings-categories-link"
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-accent/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              <Shapes size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Manage Categories</p>
              <p className="text-xs text-muted-foreground">Create, update, and delete your category list.</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </Link>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
        <Link href="/settings/recurring">
          <button
            type="button"
            data-testid="settings-recurring-link"
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-accent/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              <Repeat size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Recurring Expenses</p>
              <p className="text-xs text-muted-foreground">
                {recurringExpenses.length === 0
                  ? 'Auto-add rent, EMIs, SIPs, and subscriptions every month.'
                  : `${recurringExpenses.length} configured \u2022 ${activeRecurringCount} active`}
              </p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </Link>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <Target size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Savings Goals</p>
            <p className="text-xs text-muted-foreground">Set monthly or annual targets for each savings category.</p>
          </div>
        </div>
        <div className="p-5 space-y-5">
          {/* Goal Savings */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-500 flex items-center justify-center">
                <PiggyBank size={15} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">Goal Savings</p>
                <p className="text-[11px] text-muted-foreground">
                  {savingsGoal.goal.annual > 0 || savingsGoal.goal.monthly > 0
                    ? `Current: ${formatINR(savingsGoal.goal.monthly)}/mo \u2022 ${formatINR(savingsGoal.goal.annual)}/year`
                    : 'No target set.'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Monthly</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                  <input
                    data-testid="goal-monthly"
                    type="number"
                    value={goalMonthlyInput}
                    onChange={e => setGoalMonthlyInput(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-3 text-sm bg-muted rounded-xl border-0 outline-none focus:ring-2 focus:ring-accent text-foreground"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Annual</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                  <input
                    data-testid="goal-annual"
                    type="number"
                    value={goalAnnualInput}
                    onChange={e => setGoalAnnualInput(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-3 text-sm bg-muted rounded-xl border-0 outline-none focus:ring-2 focus:ring-accent text-foreground"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Emergency Fund */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-500/15 text-teal-500 flex items-center justify-center">
                <ShieldCheck size={15} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">Emergency Fund</p>
                <p className="text-[11px] text-muted-foreground">
                  {savingsGoal.emergency.annual > 0 || savingsGoal.emergency.monthly > 0
                    ? `Current: ${formatINR(savingsGoal.emergency.monthly)}/mo \u2022 ${formatINR(savingsGoal.emergency.annual)}/year`
                    : 'No target set.'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Monthly</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                  <input
                    data-testid="emergency-monthly"
                    type="number"
                    value={emergencyMonthlyInput}
                    onChange={e => setEmergencyMonthlyInput(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-3 text-sm bg-muted rounded-xl border-0 outline-none focus:ring-2 focus:ring-accent text-foreground"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Annual</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                  <input
                    data-testid="emergency-annual"
                    type="number"
                    value={emergencyAnnualInput}
                    onChange={e => setEmergencyAnnualInput(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-3 text-sm bg-muted rounded-xl border-0 outline-none focus:ring-2 focus:ring-accent text-foreground"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            data-testid="goal-save"
            onClick={handleSaveGoal}
            className="w-full py-3 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors"
          >
            Save Goals
          </button>
          {goalSavedMessage && (
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{goalSavedMessage}</p>
          )}
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
