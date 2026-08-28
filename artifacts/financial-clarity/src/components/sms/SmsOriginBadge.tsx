/**
 * SMS origin badge component (Phase 4).
 * Renders a small pill on transaction rows that were imported from SMS.
 */

import { MessageSquareText } from 'lucide-react';
import type { Transaction } from '@/lib/types';
import { SMS_COPY } from '@/lib/sms/copy';

interface SmsOriginBadgeProps {
  transaction: Transaction;
}

export function SmsOriginBadge({ transaction }: SmsOriginBadgeProps) {
  if (!transaction.sourceSmsFingerprint) return null;

  return (
    <span className="inline-flex items-center gap-1 text-[10px] bg-accent/10 text-accent rounded-full px-2 py-0.5 font-medium">
      <MessageSquareText size={10} />
      {SMS_COPY.badge.label}
    </span>
  );
}
