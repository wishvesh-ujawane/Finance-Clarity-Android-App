/**
 * Centralized user-facing copy for the SMS auto-import feature.
 * All UI strings live here to enable future i18n without scattered edits.
 */

export const SMS_COPY = {
  wizard: {
    title: 'Scan your SMS for transactions',
    subtitle: 'Find bank and card transactions in your inbox and import them automatically.',
    howFarBackLabel: 'How far back?',
    days7: '7 days',
    days30: '30 days',
    days90: '90 days',
    daysAll: 'All time',
    cutoffLabel: 'Set a cutoff date (optional)',
    cutoffHint: 'SMS before this date will be ignored forever.',
    cutoffCountHint(count: number) {
      return `Will ignore ~${count.toLocaleString('en-IN')} SMS before this date`;
    },
    primaryCta: 'Start scanning',
    secondaryCta: 'Maybe later',
    explanation: [
      'We will scan your SMS inbox for transaction alerts from your bank and credit cards.',
      'You review each one before we add it as a transaction.',
      'All scanning happens locally on your device - your SMS never leave your phone.',
    ],
  },

  progress: {
    phaseReading: 'Reading inbox',
    phaseParsing(sender: string) {
      return `Parsing ${sender}`;
    },
    phaseMatching: 'Matching existing',
    phaseDone: 'Scan complete',
    summaryLine(read: number, newCandidates: number, autoLinked: number) {
      return `${read} read · ${newCandidates} new · ${autoLinked} auto-linked`;
    },
    cancelButton: 'Cancel',
  },

  approval: {
    title: 'Review SMS Transactions',
    summaryNew(count: number) {
      return `${count} new`;
    },
    summaryLinked(count: number) {
      return `${count} auto-linked`;
    },
    summaryDuplicates(count: number) {
      return `${count} possible duplicate${count === 1 ? '' : 's'}`;
    },
    autoLinkedSectionTitle: 'Auto-linked to existing',
    newSectionTitle(count: number) {
      return `NEW (${count})`;
    },
    rowMenuEdit: 'Edit category',
    rowMenuPaymentMethod: 'Edit payment method',
    rowMenuLink: 'Link to existing',
    rowMenuIgnore: 'Ignore forever',
    rowMenuRawSms: 'Show raw SMS',
    linkConfirm: 'Confirm link',
    linkNotSame: 'Not the same',
    selectedSummary(n: number, total: number) {
      return `Selected: ${n} of ${total}`;
    },
    approveAll: 'Approve all',
    approveSelected(n: number) {
      return `Approve selected (${n})`;
    },
    approveSuccess(n: number) {
      return `✓ ${n} transaction${n === 1 ? '' : 's'} added`;
    },
    emptyState: {
      title: 'All caught up',
      subtitle: 'No new SMS transactions to review right now.',
    },
  },

  settings: {
    title: 'Auto-import from SMS',
    heroSummary(pending: number, linked: number) {
      return `${pending} pending · ${linked} linked`;
    },
    scanNowButton: 'Scan now',
    tabPending(count: number) {
      return `Pending (${count})`;
    },
    tabLinked(count: number) {
      return `Linked (${count})`;
    },
    tabSettings: 'Settings',
    pendingEmptyTitle: 'No SMS awaiting approval',
    pendingEmptySubtitle: 'Run a scan to find new transactions in your inbox.',
    linkedEmptyTitle: 'No linked transactions yet',
    linkedEmptySubtitle: 'Approved SMS transactions will appear here.',
    approveButton: 'Approve',
    ignoreButton: 'Ignore',
    unlinkButton: 'Unlink',
    scanWindowLabel: 'Default scan window',
    scanWindow7: '7 days',
    scanWindow30: '30 days',
    scanWindow90: '90 days',
    cutoffLabel: 'Set new cutoff date',
    cutoffHint: 'SMS before this date will be ignored in future scans.',
    resetDismissedLabel: 'Reset dismissed list',
    resetDismissedButton: 'Clear all',
    resetDismissedConfirmTitle: 'Clear dismissed SMS list?',
    resetDismissedConfirmBody: 'All previously ignored SMS will appear again in the next scan. This cannot be undone.',
    resetDismissedConfirmCancel: 'Cancel',
    resetDismissedConfirmProceed: 'Clear list',
    revokePermissionLabel: 'Revoke SMS permission',
    revokePermissionHint: 'Open Android settings to revoke READ_SMS permission.',
    revokePermissionButton: 'Open settings',
  },

  chip: {
    scanSms: 'Scan SMS',
    pending(count: number) {
      return `${count} SMS awaiting approval`;
    },
  },

  badge: {
    label: 'SMS',
  },

  paymentMethod: {
    cash: 'Cash',
    bank: 'Bank',
    creditCard: 'Credit Card',
    creditCardPayment: 'Card Payment',
  },

  errors: {
    permissionDenied: 'SMS permission denied. Grant permission to scan your inbox.',
    queryFailed: 'Failed to read SMS inbox. Please try again.',
    unknown: 'An unexpected error occurred while scanning SMS.',
  },
} as const;
