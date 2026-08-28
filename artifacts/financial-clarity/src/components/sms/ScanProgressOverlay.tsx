/**
 * ScanProgressOverlay component (Phase 4).
 * Sticky bar showing live SMS scan progress with phase updates and cancel button.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { SMS_COPY } from '@/lib/sms/copy';

interface ProgressEvent {
  phase: 'reading' | 'parsing' | 'matching' | 'done';
  sender?: string;
  read: number;
  parsed: number;
  newCandidates: number;
  autoLinked: number;
}

interface ScanProgressOverlayProps {
  open: boolean;
  progress: ProgressEvent;
  onCancel: () => void;
}

export function ScanProgressOverlay({ open, progress, onCancel }: ScanProgressOverlayProps) {
  const phaseLabel = (() => {
    switch (progress.phase) {
      case 'reading':
        return SMS_COPY.progress.phaseReading;
      case 'parsing':
        return progress.sender
          ? SMS_COPY.progress.phaseParsing(progress.sender)
          : SMS_COPY.progress.phaseReading;
      case 'matching':
        return SMS_COPY.progress.phaseMatching;
      case 'done':
        return SMS_COPY.progress.phaseDone;
    }
  })();

  const summaryText = SMS_COPY.progress.summaryLine(
    progress.read,
    progress.newCandidates,
    progress.autoLinked
  );

  // Progress percentage: rough estimate based on phase
  const progressPct = (() => {
    if (progress.phase === 'done') return 100;
    if (progress.phase === 'reading') return 10;
    if (progress.phase === 'matching') return 90;
    // Parsing phase: scale from 10% to 90% based on read count
    // Assume typical inbox has ~500 messages, cap at 1000
    const readRatio = Math.min(progress.read / 1000, 1);
    return 10 + readRatio * 80;
  })();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="fixed top-0 left-0 right-0 z-50 bg-accent/8 backdrop-blur-sm border-b border-border"
          role="status"
          aria-live="polite"
        >
          <div className="h-10 px-4 flex items-center justify-between">
            <div className="flex-1 text-sm font-medium text-foreground">
              {phaseLabel} · {summaryText}
            </div>
            {progress.phase !== 'done' && (
              <button
                type="button"
                onClick={onCancel}
                className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                aria-label={SMS_COPY.progress.cancelButton}
              >
                {SMS_COPY.progress.cancelButton}
              </button>
            )}
          </div>
          {/* Progress line */}
          <motion.div
            className="h-0.5 bg-accent"
            initial={{ width: '0%' }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
