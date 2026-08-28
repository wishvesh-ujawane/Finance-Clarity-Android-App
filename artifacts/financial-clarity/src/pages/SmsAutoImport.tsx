/**
 * SmsAutoImport settings page (Phase 4).
 * Full-featured control panel: pending/linked tabs, scan settings, cutoff management.
 */

import { useState } from 'react';
import { Link } from 'wouter';
import { MessageSquareText, ChevronLeft, Search } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { CategoryIcon } from '@/components/CategoryIcon';
import { formatAmount, formatDateLabel } from '@/lib/finance-utils';
import { SMS_COPY } from '@/lib/sms/copy';
import { cn } from '@/lib/utils';
import { SmsOriginBadge } from '@/components/sms/SmsOriginBadge';

type Tab = 'pending' | 'linked' | 'settings';
type ScanWindow = 7 | 30 | 90;

export default function SmsAutoImport() {
  const {
    pendingSms,
    pendingSmsCount,
    linkedSmsCount,
    getLinkedTransactions,
    approveSms,
    dismissSms,
    unlinkSmsFromTransaction,
    categories,
    openEditSheet,
  } = useFinance();

  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [scanWindow, setScanWindow] = useState<ScanWindow>(30);

  const linkedTransactions = getLinkedTransactions();
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
              {SMS_COPY.settings.heroSummary(pendingSmsCount, linkedSmsCount)}
            </p>
            <p className="text-xs text-muted-foreground">
              Last scan: {/* TODO: format lastScanMs */}Never
            </p>
          </div>
          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors flex items-center gap-2"
          >
            <Search size={14} />
            {SMS_COPY.settings.scanNowButton}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['pending', 'linked', 'settings'] as const).map((tab) => {
          const label = (() => {
            if (tab === 'pending') return SMS_COPY.settings.tabPending(pendingSmsCount);
            if (tab === 'linked') return SMS_COPY.settings.tabLinked(linkedSmsCount);
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
              const category = categoryById.get(parsed.suggestedCategoryId || 'leisure');
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
        </div>
      )}
    </div>
  );
}
