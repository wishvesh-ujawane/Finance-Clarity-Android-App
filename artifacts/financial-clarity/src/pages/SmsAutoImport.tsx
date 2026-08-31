/**
 * SmsAutoImport settings page (Phase 4).
 * Full-featured control panel: pending/linked tabs, scan settings, cutoff management.
 */

import { useCallback, useState } from 'react';
import { Link } from 'wouter';
import { MessageSquareText, ChevronLeft, Search } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { CategoryIcon } from '@/components/CategoryIcon';
import { formatAmount, formatDateLabel } from '@/lib/finance-utils';
import { SMS_COPY } from '@/lib/sms/copy';
import { cn } from '@/lib/utils';
import { SmsOriginBadge } from '@/components/sms/SmsOriginBadge';
import { ScanProgressOverlay } from '@/components/sms/ScanProgressOverlay';
import { SmsApprovalSheet } from '@/components/sms/SmsApprovalSheet';
import { getSmsReader } from '@/lib/sms/SmsReader';
import { parseSms } from '@/lib/sms/parser';

type Tab = 'pending' | 'linked' | 'settings';
type ScanWindow = 7 | 30 | 90;

/** Format a lastScanMs timestamp as a human-readable relative label. */
function formatLastScan(lastScanMs: number): string {
  if (!lastScanMs) return 'Never';
  const diffMs = Date.now() - lastScanMs;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  return new Date(lastScanMs).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function SmsAutoImport() {
  const {
    pendingSms,
    pendingSmsCount,
    lastScanMs,
    runSmsScan,
    getLinkedTransactions,
    approveSms,
    dismissSms,
    unlinkSmsFromTransaction,
    categories,
    openEditSheet,
  } = useFinance();

  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [scanWindow, setScanWindow] = useState<ScanWindow>(30);

  // Scan feedback state (mirrors the Transactions chip flow so the "Scan now"
  // button on this page shows a live progress bar and always tells the user
  // the outcome — including "0 new" — instead of silently doing nothing.
  const [showScanProgress, setShowScanProgress] = useState(false);
  const [showApprovalSheet, setShowApprovalSheet] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
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

  const handleScanNow = useCallback(() => {
    if (showScanProgress) return; // prevent double-fire
    setScanError(null);
    setScanProgress({
      phase: 'reading',
      read: 0,
      parsed: 0,
      newCandidates: 0,
      autoLinked: 0,
    });
    setShowScanProgress(true);
    // Force a fresh (mode: 'first') scan over the picked window so the
    // Settings page always honours the filter regardless of lastScanMs.
    runSmsScan({
      sinceDays: scanWindow,
      mode: 'first',
      onProgress: (event) => setScanProgress(event),
    })
      .then((result) => {
        if (!result.ok) {
          setScanError(
            result.reason === 'permission-denied'
              ? 'SMS permission not granted. Enable it in Settings → Apps → Fiscal Focus → Permissions → SMS.'
              : result.reason === 'query-failed'
                ? 'Could not read your SMS inbox. On Samsung, open Settings → Apps → Fiscal Focus → ⋮ → "Allow restricted settings" and re-toggle SMS permission.'
                : result.error || 'Scan failed.',
          );
          // Leave the overlay up so the user reads the error.
          setTimeout(() => setShowScanProgress(false), 4000);
          return;
        }
        if (result.needsReview > 0) {
          // Close overlay and open approval sheet.
          setShowScanProgress(false);
          setShowApprovalSheet(true);
        } else {
          // No new SMS to review — keep the "Scan complete · N read · 0 new"
          // summary visible for a moment so the user sees the outcome.
          setTimeout(() => setShowScanProgress(false), 2500);
        }
      })
      .catch((err) => {
        setScanError(err instanceof Error ? err.message : 'Scan failed unexpectedly.');
        setTimeout(() => setShowScanProgress(false), 4000);
      });
  }, [runSmsScan, scanWindow, showScanProgress]);

  // ---------------------------------------------------------------
  // Diagnostic — read raw inbox and tag each SMS as parsed vs
  // unrecognised so users (and I) can see which bank/UPI senders
  // need new parser rules. No data leaves the device.
  // ---------------------------------------------------------------
  type DiagnosticRow = {
    id: string;
    sender: string;
    body: string;
    timestamp: number;
    parsed: boolean;
  };
  const [diagnosticRows, setDiagnosticRows] = useState<DiagnosticRow[] | null>(null);
  const [diagnosticRunning, setDiagnosticRunning] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const [diagnosticFilter, setDiagnosticFilter] = useState<'unrecognised' | 'all'>('unrecognised');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleRunDiagnostic = useCallback(async () => {
    setDiagnosticRunning(true);
    setDiagnosticError(null);
    setDiagnosticRows(null);
    try {
      const reader = getSmsReader();
      const hasPerm = await reader.hasPermission();
      if (!hasPerm) {
        const state = await reader.requestPermission();
        if (state !== 'granted') {
          setDiagnosticError('SMS permission denied.');
          return;
        }
      }
      const now = Date.now();
      const sinceMs = now - 30 * 86400000;
      const messages = await reader.readMessages(sinceMs, now);
      const rows: DiagnosticRow[] = [];
      for (const msg of messages) {
        const parsedSms = await parseSms(msg);
        rows.push({
          id: msg.id,
          sender: msg.sender,
          body: msg.body,
          timestamp: msg.timestamp,
          parsed: parsedSms !== null,
        });
      }
      // Newest first for readability.
      rows.sort((a, b) => b.timestamp - a.timestamp);
      setDiagnosticRows(rows);
    } catch (err) {
      setDiagnosticError(err instanceof Error ? err.message : 'Diagnostic failed.');
    } finally {
      setDiagnosticRunning(false);
    }
  }, []);

  const handleCopyBody = useCallback(async (row: DiagnosticRow) => {
    const payload = `Sender: ${row.sender}\nDate: ${new Date(row.timestamp).toISOString()}\n\n${row.body}`;
    try {
      await navigator.clipboard.writeText(payload);
      setCopiedId(row.id);
      setTimeout(() => setCopiedId((prev) => (prev === row.id ? null : prev)), 1500);
    } catch {
      // Fallback: no-op — user can long-press select on the body itself.
    }
  }, []);

  const linkedTransactions = getLinkedTransactions();
  // Both the hero summary and the tab label read from this so they cannot
  // drift from the rendered list. `linkedSmsCount` on the context is now
  // also derived from transactions but we compute locally here for clarity.
  const linkedCount = linkedTransactions.length;
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const handleApprove = async (fingerprint: string) => {
    await approveSms([fingerprint]);
  };

  const handleIgnore = (fingerprint: string) => {
    dismissSms([fingerprint]);
  };

  const handleUnlink = (fingerprint: string) => {
    unlinkSmsFromTransaction(fingerprint);
  };

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/settings">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ChevronLeft size={16} />
            Settings
          </button>
        </Link>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <MessageSquareText size={18} />
          </div>
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {SMS_COPY.settings.title}
          </h1>
        </div>
      </div>

      {/* Hero card */}
      <div className="bg-accent/8 border border-border rounded-2xl p-4 mb-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">
              {SMS_COPY.settings.heroSummary(pendingSmsCount, linkedCount)}
            </p>
            <p className="text-xs text-muted-foreground">
              Last scan: {formatLastScan(lastScanMs)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleScanNow}
            disabled={showScanProgress}
            className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Search size={14} />
            {SMS_COPY.settings.scanNowButton}
          </button>
        </div>
        {scanError && (
          <div
            role="alert"
            className="mt-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive"
          >
            {scanError}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['pending', 'linked', 'settings'] as const).map((tab) => {
          const label = (() => {
            if (tab === 'pending') return SMS_COPY.settings.tabPending(pendingSmsCount);
            if (tab === 'linked') return SMS_COPY.settings.tabLinked(linkedCount);
            return SMS_COPY.settings.tabSettings;
          })();

          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all',
                activeTab === tab
                  ? 'bg-accent text-white shadow-md'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'pending' && (
        <div className="space-y-2">
          {pendingSms.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-foreground mb-1">
                {SMS_COPY.settings.pendingEmptyTitle}
              </p>
              <p className="text-xs text-muted-foreground">
                {SMS_COPY.settings.pendingEmptySubtitle}
              </p>
            </div>
          ) : (
            pendingSms.map((parsed) => {
              // Match FinanceContext.approveSms fallback so the preview icon
              // reflects the category the transaction will actually be given.
              const fallbackCategoryId =
                parsed.direction === 'credit' ? 'other-income' : 'other';
              const category = categoryById.get(parsed.suggestedCategoryId || fallbackCategoryId);
              const merchant =
                parsed.merchant || (parsed.direction === 'debit' ? 'Payment' : 'Transfer');

              return (
                <div
                  key={parsed.fingerprint}
                  className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: category?.color || '#10B981' }}
                  >
                    <CategoryIcon icon={category?.icon || 'DollarSign'} size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{merchant}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateLabel(parsed.dateISO)} · {formatAmount(parsed.amount)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleApprove(parsed.fingerprint)}
                      className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors"
                    >
                      {SMS_COPY.settings.approveButton}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleIgnore(parsed.fingerprint)}
                      className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold hover:text-foreground transition-colors"
                    >
                      {SMS_COPY.settings.ignoreButton}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'linked' && (
        <div className="space-y-2">
          {linkedTransactions.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-foreground mb-1">
                {SMS_COPY.settings.linkedEmptyTitle}
              </p>
              <p className="text-xs text-muted-foreground">
                {SMS_COPY.settings.linkedEmptySubtitle}
              </p>
            </div>
          ) : (
            linkedTransactions.map((tx) => {
              const category = categoryById.get(tx.categoryId);

              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl"
                >
                  <button
                    type="button"
                    onClick={() => openEditSheet(tx)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: category?.color || '#10B981' }}
                    >
                      <CategoryIcon icon={category?.icon || 'DollarSign'} size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {tx.note || category?.name || 'Transaction'}
                        </p>
                        <SmsOriginBadge transaction={tx} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDateLabel(tx.date)} · {formatAmount(tx.amount)}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnlink(tx.sourceSmsFingerprint!)}
                    className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold hover:text-foreground transition-colors"
                  >
                    {SMS_COPY.settings.unlinkButton}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-5">
          {/* Scan window */}
          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block">
              {SMS_COPY.settings.scanWindowLabel}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([7, 30, 90] as const).map((days) => {
                const label = (() => {
                  if (days === 7) return SMS_COPY.settings.scanWindow7;
                  if (days === 30) return SMS_COPY.settings.scanWindow30;
                  return SMS_COPY.settings.scanWindow90;
                })();

                return (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setScanWindow(days)}
                    className={cn(
                      'py-2.5 rounded-xl text-sm font-semibold transition-all',
                      scanWindow === days
                        ? 'bg-accent text-white shadow-md'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cutoff date */}
          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block">
              {SMS_COPY.settings.cutoffLabel}
            </label>
            <p className="text-xs text-muted-foreground mb-2">{SMS_COPY.settings.cutoffHint}</p>
            <input
              type="date"
              className="w-full px-3 py-2.5 text-sm bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Reset dismissed list */}
          <div className="pt-4 border-t border-border">
            <p className="text-sm font-semibold text-foreground mb-1">
              {SMS_COPY.settings.resetDismissedLabel}
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              All previously ignored SMS will appear again in the next scan.
            </p>
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-colors"
            >
              {SMS_COPY.settings.resetDismissedButton}
            </button>
          </div>

          {/* Diagnostic — unrecognised SMS. Only for debugging parser
              coverage; does not send any data anywhere. */}
          <div className="pt-4 border-t border-border">
            <p className="text-sm font-semibold text-foreground mb-1">
              Diagnose unrecognised SMS
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Reads the last 30 days of SMS and shows which ones the parser
              can't understand yet. Nothing leaves your phone. Copy an
              unrecognised example and share it to add a new rule for that
              bank or UPI app.
            </p>
            <button
              type="button"
              onClick={handleRunDiagnostic}
              disabled={diagnosticRunning}
              className="px-4 py-2 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-muted/70 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {diagnosticRunning ? 'Reading inbox…' : 'Run diagnostic'}
            </button>
            {diagnosticError && (
              <div
                role="alert"
                className="mt-3 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive"
              >
                {diagnosticError}
              </div>
            )}
            {diagnosticRows !== null && (
              <div className="mt-4 space-y-3">
                {(() => {
                  const total = diagnosticRows.length;
                  const parsedCount = diagnosticRows.filter((r) => r.parsed).length;
                  const unrecognisedCount = total - parsedCount;
                  return (
                    <div className="flex items-center justify-between text-xs">
                      <p className="text-muted-foreground">
                        <span className="font-semibold text-foreground">{total}</span> read
                        {' · '}
                        <span className="font-semibold text-emerald-600">{parsedCount}</span> parsed
                        {' · '}
                        <span className="font-semibold text-amber-600">{unrecognisedCount}</span> unrecognised
                      </p>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setDiagnosticFilter('unrecognised')}
                          className={cn(
                            'px-2 py-1 rounded-md text-[11px] font-semibold transition-colors',
                            diagnosticFilter === 'unrecognised'
                              ? 'bg-accent text-white'
                              : 'bg-muted text-muted-foreground hover:text-foreground',
                          )}
                        >
                          Unrecognised
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiagnosticFilter('all')}
                          className={cn(
                            'px-2 py-1 rounded-md text-[11px] font-semibold transition-colors',
                            diagnosticFilter === 'all'
                              ? 'bg-accent text-white'
                              : 'bg-muted text-muted-foreground hover:text-foreground',
                          )}
                        >
                          All
                        </button>
                      </div>
                    </div>
                  );
                })()}
                {diagnosticRows
                  .filter((r) => diagnosticFilter === 'all' || !r.parsed)
                  .slice(0, 50)
                  .map((row) => (
                    <div
                      key={row.id}
                      className={cn(
                        'rounded-xl border p-3',
                        row.parsed
                          ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20'
                          : 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/20',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {row.sender}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(row.timestamp).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {' · '}
                            <span
                              className={cn(
                                'font-semibold',
                                row.parsed ? 'text-emerald-600' : 'text-amber-600',
                              )}
                            >
                              {row.parsed ? 'parsed' : 'unrecognised'}
                            </span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyBody(row)}
                          className="flex-shrink-0 px-2 py-1 rounded-md bg-card border border-border text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {copiedId === row.id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-[11px] font-mono text-foreground whitespace-pre-wrap break-words leading-snug">
                        {row.body}
                      </p>
                    </div>
                  ))}
                {diagnosticRows.filter((r) => diagnosticFilter === 'all' || !r.parsed).length > 50 && (
                  <p className="text-[11px] text-muted-foreground text-center">
                    Showing first 50 of{' '}
                    {diagnosticRows.filter((r) => diagnosticFilter === 'all' || !r.parsed).length}.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <ScanProgressOverlay
        open={showScanProgress}
        progress={scanProgress}
        onCancel={() => setShowScanProgress(false)}
      />
      <SmsApprovalSheet
        open={showApprovalSheet}
        onClose={() => setShowApprovalSheet(false)}
      />
    </div>
  );
}
