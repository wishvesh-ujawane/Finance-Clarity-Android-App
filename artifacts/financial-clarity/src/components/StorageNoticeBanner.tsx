import { useState } from 'react';
import { Info, X } from 'lucide-react';
import type { QuarantineReport } from '@/lib/storage/finance-read';

function noticeText(reports: QuarantineReport[]): string {
  const counts = reports.map(r => r.invalidCount);
  if (counts.some(c => c === null)) {
    return 'Part of your saved data couldn\u2019t be read, so it isn\u2019t shown. The original data was kept on this phone. You can keep using the app.';
  }
  const total = counts.reduce<number>((sum, c) => sum + (c ?? 0), 0);
  const records = total === 1 ? '1 saved record' : `${total} saved records`;
  return `${records} couldn\u2019t be read, so ${total === 1 ? 'it isn\u2019t' : 'they aren\u2019t'} shown. The original data was kept on this phone. You can keep using the app.`;
}

/**
 * Non-blocking startup notice for quarantined data (ARCHITECTURE §8.3).
 * Shows counts only, never record contents.
 */
export function StorageNoticeBanner({ reports }: { reports: QuarantineReport[] }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || reports.length === 0) return null;

  return (
    <div
      className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-info/20 bg-info-tint p-4 md:mx-8"
      role="status"
      aria-label={'Some data couldn\u2019t be read'}
      data-testid="storage-notice-banner"
    >
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-info" aria-hidden="true" />
      <p className="flex-1 text-sm text-foreground">{noticeText(reports)}</p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="-m-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-foreground/80 hover:bg-info/10 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
