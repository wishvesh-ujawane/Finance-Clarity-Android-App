/**
 * FirstScanWizard component (Phase 4).
 * Onboarding sheet for first-time SMS scan with range picker and optional cutoff date.
 */

import { useState } from 'react';
import { MessageSquareText, Sparkles, X } from 'lucide-react';
import { Drawer } from 'vaul';
import { cn } from '@/lib/utils';
import { SMS_COPY } from '@/lib/sms/copy';

type ScanRange = 7 | 30 | 90 | 365;

interface FirstScanWizardProps {
  open: boolean;
  onClose: () => void;
  onScanStart: (sinceDays: number) => void;
  onMaybeLater: () => void;
}

export function FirstScanWizard({ open, onClose, onScanStart, onMaybeLater }: FirstScanWizardProps) {
  const [selectedRange, setSelectedRange] = useState<ScanRange>(30);
  const [showCutoff, setShowCutoff] = useState(false);
  const [cutoffDate, setCutoffDate] = useState('');

  const handleStartScan = () => {
    onScanStart(selectedRange);
  };

  return (
    <Drawer.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }} dismissible>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-3xl outline-none max-h-[90vh] overflow-y-auto">
          <div className="p-6 pb-8">
            {/* Grab handle + close button */}
            <div className="flex items-center justify-between mb-4">
              <div className="mx-auto w-10 h-1.5 rounded-full bg-muted" aria-hidden />
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 w-9 h-9 rounded-full bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Illustration band */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-14 h-14 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                <MessageSquareText size={24} />
              </div>
              <Sparkles size={20} className="text-accent" />
            </div>

            {/* Title and explanation */}
            <Drawer.Title
              className="text-lg font-bold text-foreground mb-2"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {SMS_COPY.wizard.title}
            </Drawer.Title>
            <Drawer.Description className="text-sm text-muted-foreground mb-1">
              {SMS_COPY.wizard.subtitle}
            </Drawer.Description>
            <div className="space-y-1 mb-6">
              {SMS_COPY.wizard.explanation.map((line, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  • {line}
                </p>
              ))}
            </div>

            {/* Range selector */}
            <div className="mb-4">
              <label className="text-sm font-semibold text-foreground mb-2 block">
                {SMS_COPY.wizard.howFarBackLabel}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {([7, 30, 90, 365] as const).map((days) => {
                  const label = (() => {
                    if (days === 7) return SMS_COPY.wizard.days7;
                    if (days === 30) return SMS_COPY.wizard.days30;
                    if (days === 90) return SMS_COPY.wizard.days90;
                    return SMS_COPY.wizard.daysAll;
                  })();
                  return (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setSelectedRange(days)}
                      className={cn(
                        'py-2.5 rounded-xl text-sm font-semibold transition-all',
                        selectedRange === days
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

            {/* Optional cutoff card */}
            <button
              type="button"
              onClick={() => setShowCutoff(!showCutoff)}
              className="w-full text-left bg-muted/50 rounded-xl p-3 mb-6 hover:bg-muted transition-colors"
            >
              <p className="text-sm font-semibold text-foreground mb-1">{SMS_COPY.wizard.cutoffLabel}</p>
              <p className="text-xs text-muted-foreground">{SMS_COPY.wizard.cutoffHint}</p>
              {showCutoff && (
                <div className="mt-3">
                  <input
                    type="date"
                    value={cutoffDate}
                    onChange={(e) => setCutoffDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent"
                    onClick={(e) => e.stopPropagation()}
                  />
                  {cutoffDate && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {SMS_COPY.wizard.cutoffCountHint(0)}
                    </p>
                  )}
                </div>
              )}
            </button>

            {/* CTAs */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleStartScan}
                className="w-full py-3.5 rounded-xl bg-accent text-white font-semibold hover:bg-accent/90 transition-colors"
              >
                {SMS_COPY.wizard.primaryCta}
              </button>
              <button
                type="button"
                onClick={onMaybeLater}
                className="w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {SMS_COPY.wizard.secondaryCta}
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
