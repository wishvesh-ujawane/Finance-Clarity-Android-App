import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Download, FileText, Search, X, MessageSquareText } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { useFabAction } from '@/context/FabContext';
import { CategoryIcon } from '@/components/CategoryIcon';
import { SmsOriginBadge } from '@/components/sms/SmsOriginBadge';
import { FirstScanWizard } from '@/components/sms/FirstScanWizard';
import { ScanProgressOverlay } from '@/components/sms/ScanProgressOverlay';
import { SmsApprovalSheet } from '@/components/sms/SmsApprovalSheet';
import { cn } from '@/lib/utils';
import { formatDateLabel, formatINR, localDateStr } from '@/lib/finance-utils';
import { buildTransactionsCsv, exportCsvFile } from '@/lib/csv';
import { SMS_COPY } from '@/lib/sms/copy';

type RangePreset = 'current' | 'last1' | 'last3' | 'custom';

function getPresetRange(preset: RangePreset, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date();
  if (preset === 'current') {
    // Current month: 1st of this month through today
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: localDateStr(firstOfMonth), to: localDateStr(now) };
  }
  if (preset === 'last1') {
    // Previous full calendar month only (e.g. May → April 1–30)
    const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfPrevMonth = new Date(firstOfCurrentMonth.getTime() - 1);
    const firstDayOfPrevMonth = new Date(lastDayOfPrevMonth.getFullYear(), lastDayOfPrevMonth.getMonth(), 1);
    return {
      from: localDateStr(firstDayOfPrevMonth),
      to: localDateStr(lastDayOfPrevMonth),
    };
  }
  if (preset === 'last3') {
    // From 1st of 3 calendar months ago to today
    const d = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    return { from: localDateStr(d), to: localDateStr(now) };
  }
  return { from: customFrom, to: customTo };
}

function formatPeriodLabel(preset: RangePreset, from: string, to: string): string {
  if (preset === 'current') {
    const d = new Date(from + 'T00:00:00');
    return `${d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} (so far)`;
  }
  if (preset === 'last1') {
    const d = new Date(from + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }
  if (preset === 'last3') return 'Last 3 Months';
  return `${from} to ${to}`;
}

export default function Transactions() {
  const { transactions, categories, openEditSheet, openSheet, pendingSmsCount, lastScanMs, runSmsScan } = useFinance();

  useFabAction(openSheet, 'Add transaction', 'fab-add-transaction');

  const [preset, setPreset] = useState<RangePreset>('current');
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    d.setDate(1);
    return localDateStr(d);
  });
  const [customTo, setCustomTo] = useState(() => localDateStr(new Date()));
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [exportError, setExportError] = useState('');

  // SMS scan state
  const [showFirstScanWizard, setShowFirstScanWizard] = useState(false);
  const [showScanProgress, setShowScanProgress] = useState(false);
  const [showApprovalSheet, setShowApprovalSheet] = useState(false);
  const [scanProgress, setScanProgress] = useState<{
    phase: 'reading' | 'parsing' | 'matching' | 'done';
    sender?: string;
    read: number;
    parsed: number;
    newCandidates: number;
    autoLinked: number;
  }>({
    phase: 'reading',
    read: 0,
    parsed: 0,
    newCandidates: 0,
    autoLinked: 0,
  });

  const { from: effectiveFrom, to: effectiveTo } = useMemo(
    () => getPresetRange(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  );

  const categoryById = useMemo(
    () => new Map(categories.map(c => [c.id, c])),
    [categories]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions
      .filter(t => {
        if (t.date < effectiveFrom || t.date > effectiveTo) return false;
        if (filterType !== 'all' && t.type !== filterType) return false;
        if (q) {
          const cat = categoryById.get(t.categoryId);
          const haystack = [
            cat?.name || '',
            t.note || '',
            String(t.amount),
            t.amount.toFixed(2),
          ].join(' ').toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, effectiveFrom, effectiveTo, filterType, searchQuery, categoryById]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    filtered.forEach(t => {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    });
    return Object.keys(map).sort((a, b) => b.localeCompare(a)).map(date => ({ date, txns: map[date] }));
  }, [filtered]);

  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const getCategoryById = (id: string) => categoryById.get(id);

  const handleSmsChipClick = useCallback(() => {
    if (lastScanMs === 0) {
      setShowFirstScanWizard(true);
    } else if (pendingSmsCount > 0) {
      setShowApprovalSheet(true);
    } else {
      // Run incremental scan
      setShowScanProgress(true);
      runSmsScan({
        sinceDays: 30,
        mode: 'incremental',
        onProgress: (event) => setScanProgress(event),
      }).then((result) => {
        setShowScanProgress(false);
        if (result.ok && result.needsReview > 0) {
          setShowApprovalSheet(true);
        }
      });
    }
  }, [lastScanMs, pendingSmsCount, runSmsScan]);

  const handleFirstScanStart = useCallback((sinceDays: number) => {
    setShowFirstScanWizard(false);
    setShowScanProgress(true);
    runSmsScan({
      sinceDays,
      mode: 'first',
      onProgress: (event) => setScanProgress(event),
    }).then((result) => {
      setShowScanProgress(false);
      if (result.ok && result.needsReview > 0) {
        setShowApprovalSheet(true);
      }
    });
  }, [runSmsScan]);

  const handleMaybeLater = useCallback(() => {
    setShowFirstScanWizard(false);
    // Note: user chose to defer; the chip will re-open the wizard on next tap
    // because lastScanMs is still 0 until a real scan runs.
  }, []);

  const downloadCSV = useCallback(async () => {
    setExportError('');
    const allForExport = transactions
      .filter(t => t.date >= effectiveFrom && t.date <= effectiveTo)
      .sort((a, b) => b.date.localeCompare(a.date));

    const period = formatPeriodLabel(preset, effectiveFrom, effectiveTo).replace(/\s+/g, '-').toLowerCase();
    try {
      await exportCsvFile(`financial-clarity-${period}.csv`, buildTransactionsCsv(allForExport, categories));
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    }
  }, [transactions, categories, effectiveFrom, effectiveTo, preset]);

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">History</p>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Transactions</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSmsChipClick}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors',
              pendingSmsCount > 0
                ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
                : 'bg-accent/10 text-accent hover:bg-accent/20'
            )}
          >
            <MessageSquareText size={14} />
            {pendingSmsCount > 0 ? SMS_COPY.chip.pending(pendingSmsCount) : SMS_COPY.chip.scanSms}
          </button>
          <button
            data-testid="download-csv"
            onClick={downloadCSV}
            disabled={transactions.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[hsl(222,65%,13%)] text-white text-sm font-semibold hover:bg-[hsl(222,65%,18%)] transition-colors disabled:opacity-40"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>
      {exportError && <p className="text-xs font-medium text-red-500 mb-3">{exportError}</p>}

      {/* SMS UI overlays */}
      <FirstScanWizard
        open={showFirstScanWizard}
        onClose={() => setShowFirstScanWizard(false)}
        onScanStart={handleFirstScanStart}
        onMaybeLater={handleMaybeLater}
      />
      <ScanProgressOverlay
        open={showScanProgress}
        progress={scanProgress}
        onCancel={() => setShowScanProgress(false)}
      />
      <SmsApprovalSheet
        open={showApprovalSheet}
        onClose={() => setShowApprovalSheet(false)}
      />

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          data-testid="transactions-search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by category, note, or amount"
          className="w-full pl-9 pr-9 py-2.5 text-sm bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent text-foreground placeholder:text-muted-foreground"
        />
        {searchQuery && (
          <button
            type="button"
            data-testid="transactions-search-clear"
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
            aria-label="Clear search"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Range Filters */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-4 space-y-3">
        <div className="flex gap-2">
          {([
            { key: 'current', label: 'This Month' },
            { key: 'last1', label: 'Last Month' },
            { key: 'last3', label: 'Last 3 Months' },
            { key: 'custom', label: 'Custom' },
          ] as { key: RangePreset; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              data-testid={`range-${key}`}
              onClick={() => setPreset(key)}
              className={cn(
                'flex-1 py-2 rounded-xl text-[11px] font-semibold transition-all',
                preset === key ? 'bg-accent text-white shadow' : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground font-medium block mb-1">From</label>
              <input
                data-testid="from-date"
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-muted rounded-lg border-0 outline-none focus:ring-2 focus:ring-accent text-foreground"
              />
            </div>
            <Calendar size={14} className="text-muted-foreground mt-4 flex-shrink-0" />
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground font-medium block mb-1">To</label>
              <input
                data-testid="to-date"
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-muted rounded-lg border-0 outline-none focus:ring-2 focus:ring-accent text-foreground"
              />
            </div>
          </div>
        )}

        {/* Active range label */}
        <p className="text-[10px] text-muted-foreground">
          Showing: <span className="font-semibold text-foreground">{formatPeriodLabel(preset, effectiveFrom, effectiveTo)}</span>
          {preset !== 'custom' && (
            <span className="ml-1">({effectiveFrom} — {effectiveTo})</span>
          )}
        </p>

        {/* Type filter */}
        <div className="flex gap-2">
          {(['all', 'income', 'expense'] as const).map(t => (
            <button
              key={t}
              data-testid={`filter-${t}`}
              onClick={() => setFilterType(t)}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all',
                filterType === t
                  ? t === 'all' ? 'bg-[hsl(222,65%,13%)] text-white' : t === 'income' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Transactions</p>
          <p className="text-base font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{filtered.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Income</p>
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate">{formatINR(totalIncome)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Expenses</p>
          <p className="text-xs font-bold text-red-500 truncate">{formatINR(totalExpenses)}</p>
        </div>
      </div>

      {/* Transaction List grouped by date */}
      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <FileText size={24} />
          </div>
          <p className="text-sm font-semibold mb-1">No transactions found</p>
          <p className="text-xs text-center max-w-xs">
            {preset === 'current'
              ? `No transactions yet for ${formatPeriodLabel(preset, effectiveFrom, effectiveTo)}`
              : preset === 'last1'
              ? `No transactions recorded for ${formatPeriodLabel(preset, effectiveFrom, effectiveTo)}`
              : preset === 'last3'
                ? 'No transactions in the last 3 months'
                : `No transactions between ${effectiveFrom} and ${effectiveTo}`}
          </p>
          <p className="text-xs mt-1 text-muted-foreground/60">Try a different date range or add some transactions</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ date, txns }, gi) => {
            const dayIncome = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
            const dayExpense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

            return (
              <motion.div
                key={date}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.04 }}
              >
                {/* Date header */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-xs font-bold text-foreground">
                    {formatDateLabel(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <div className="flex items-center gap-3 text-[10px] font-semibold">
                    {dayIncome > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{formatINR(dayIncome)}</span>}
                    {dayExpense > 0 && <span className="text-red-500">-{formatINR(dayExpense)}</span>}
                  </div>
                </div>

                <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
                  {txns.map(t => {
                    const cat = getCategoryById(t.categoryId);
                    return (
                      <div
                        key={t.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openEditSheet(t)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openEditSheet(t);
                          }
                        }}
                        className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer"
                        data-testid={`txn-${t.id}`}
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: (cat?.color || '#6366F1') + '22' }}
                        >
                          <CategoryIcon icon={cat?.icon || 'DollarSign'} color={cat?.color || '#6366F1'} size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{cat?.name || 'Unknown'}</p>
                          {t.note && <p className="text-xs text-muted-foreground truncate">{t.note}</p>}
                          <SmsOriginBadge transaction={t} />
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={cn('text-sm font-bold', t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                            {t.type === 'income' ? '+' : '-'}{formatINR(t.amount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
