/**
 * SmsApprovalSheet component (Phase 4).
 * Central UI for reviewing, approving, dismissing, and linking SMS transactions.
 * Includes auto-linked section, selectable rows, and per-row actions.
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Drawer } from 'vaul';
import {
  ArrowDown, ArrowUp, ArrowLeftRight, Info, MoreVertical,
  MessageSquareText, ChevronDown, ChevronUp, Check, X,
} from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { useFinance } from '@/context/FinanceContext';
import { cn } from '@/lib/utils';
import { formatAmount, formatDateLabel } from '@/lib/finance-utils';
import { SMS_COPY } from '@/lib/sms/copy';
import type { ParsedSms } from '@/lib/sms/parser/types';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SmsApprovalSheetProps {
  open: boolean;
  onClose: () => void;
}

export function SmsApprovalSheet({ open, onClose }: SmsApprovalSheetProps) {
  const { pendingSms, categories, approveSms, dismissSms } = useFinance();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [autoLinkedExpanded, setAutoLinkedExpanded] = useState(false);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const handleToggleSelect = (fingerprint: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fingerprint)) {
        next.delete(fingerprint);
      } else {
        next.add(fingerprint);
      }
      return next;
    });
  };

  const handleApproveSelected = async () => {
    if (selected.size === 0) return;
    await approveSms(Array.from(selected));
    setSelected(new Set());
    if (pendingSms.length === 0) {
      onClose();
    }
  };

  const handleApproveAll = async () => {
    const allFingerprints = pendingSms.map((p) => p.fingerprint);
    await approveSms(allFingerprints);
    setSelected(new Set());
    onClose();
  };

  const handleDismiss = (fingerprint: string) => {
    dismissSms([fingerprint]);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(fingerprint);
      return next;
    });
  };

  if (!open) return null;

  return (
    <Drawer.Root open={open} onOpenChange={onClose} dismissible={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-3xl outline-none max-h-[85vh] flex flex-col">
          {/* Sticky header */}
          <div className="flex-shrink-0 border-b border-border p-4 pb-3">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                  <MessageSquareText size={18} />
                </div>
                <div>
                  <h2
                    className="text-lg font-bold text-foreground"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {SMS_COPY.approval.title}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {SMS_COPY.approval.summaryNew(pendingSms.length)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {pendingSms.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-semibold text-foreground mb-1">
                  {SMS_COPY.approval.emptyState.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {SMS_COPY.approval.emptyState.subtitle}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Section label */}
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
                  {SMS_COPY.approval.newSectionTitle(pendingSms.length)}
                </p>

                {/* Rows */}
                {pendingSms.map((parsed) => (
                  <SmsRow
                    key={parsed.fingerprint}
                    parsed={parsed}
                    isSelected={selected.has(parsed.fingerprint)}
                    onToggleSelect={() => handleToggleSelect(parsed.fingerprint)}
                    onDismiss={() => handleDismiss(parsed.fingerprint)}
                    categoryById={categoryById}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Sticky bottom bar */}
          {pendingSms.length > 0 && (
            <div className="flex-shrink-0 border-t border-border p-4 bg-card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">
                  {SMS_COPY.approval.selectedSummary(selected.size, pendingSms.length)}
                </p>
                <button
                  type="button"
                  onClick={handleApproveAll}
                  className="text-sm font-semibold text-accent hover:text-accent/80 transition-colors"
                >
                  {SMS_COPY.approval.approveAll}
                </button>
              </div>
              <button
                type="button"
                onClick={handleApproveSelected}
                disabled={selected.size === 0}
                className="w-full py-3.5 rounded-xl bg-accent text-white font-semibold hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {SMS_COPY.approval.approveSelected(selected.size)}
              </button>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

interface SmsRowProps {
  parsed: ParsedSms;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDismiss: () => void;
  categoryById: Map<string, any>;
}

function SmsRow({ parsed, isSelected, onToggleSelect, onDismiss, categoryById }: SmsRowProps) {
  const category = categoryById.get(parsed.suggestedCategoryId || 'leisure');

  const amountColor = (() => {
    if (parsed.direction === 'credit') return 'text-emerald-600';
    if (parsed.paymentMethod === 'credit-card-payment') return 'text-muted-foreground';
    return 'text-destructive';
  })();

  const amountIcon = (() => {
    if (parsed.direction === 'credit') return <ArrowUp size={14} />;
    if (parsed.paymentMethod === 'credit-card-payment') return <ArrowLeftRight size={14} />;
    return <ArrowDown size={14} />;
  })();

  const merchant = parsed.merchant || (parsed.direction === 'debit' ? 'Payment' : 'Transfer');

  return (
    <motion.button
      type="button"
      onClick={onToggleSelect}
      className={cn(
        'w-full p-3 rounded-xl border transition-all text-left',
        isSelected ? 'border-accent bg-accent/5' : 'border-border bg-card hover:bg-muted/30'
      )}
      animate={{ scale: isSelected ? 0.98 : 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      role="checkbox"
      aria-checked={isSelected}
    >
      <div className="flex items-start gap-3">
        {/* Category icon */}
        <div className="flex-shrink-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{ backgroundColor: category?.color || '#10B981' }}
          >
            <CategoryIcon icon={category?.icon || 'DollarSign'} size={18} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <p className="text-sm font-semibold text-foreground truncate">{merchant}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateLabel(parsed.dateISO)} · {category?.name || 'Leisure'}
              </p>
            </div>
            <div className={cn('flex items-center gap-1 text-sm font-bold', amountColor)}>
              {amountIcon}
              {formatAmount(parsed.amount)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground truncate">
              {parsed.senderId} {parsed.accountTail && `…${parsed.accountTail}`}
            </p>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="flex-shrink-0 w-5 h-5 rounded-full bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
                  aria-label={SMS_COPY.approval.rowMenuRawSms}
                >
                  <Info size={12} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 text-xs text-foreground p-3">
                <p className="font-mono text-[10px] whitespace-pre-wrap break-words">{parsed.rawBody}</p>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
              aria-label="More actions"
            >
              <MoreVertical size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDismiss(); }}>
              {SMS_COPY.approval.rowMenuIgnore}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.button>
  );
}
