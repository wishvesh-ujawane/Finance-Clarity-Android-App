import { useState } from 'react';
import { Link } from 'wouter';
import { ChevronRight, Cloud, Heart, MessageCircle, PiggyBank, Repeat, Shapes, ShieldCheck } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { useSecurity } from '@/context/SecurityContext';
import { formatINR } from '@/lib/finance-utils';
import { FeedbackSheet } from '@/components/FeedbackSheet';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
      {children}
    </p>
  );
}

export default function Settings() {
  const { recurringExpenses, savingsGoal } = useFinance();
  const { isAppLockEnabled, settings: securitySettings } = useSecurity();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const activeRecurringCount = recurringExpenses.filter(r => r.active).length;
  const hasSavingsTarget = savingsGoal.goal.monthly > 0 || savingsGoal.goal.annual > 0
    || savingsGoal.emergency.monthly > 0 || savingsGoal.emergency.annual > 0;

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8 flex flex-col min-h-screen">
      <div className="mb-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preferences</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Settings</h1>
      </div>

      {/* Finances */}
      <SectionLabel>Finances</SectionLabel>
      <div className="bg-card border border-border rounded-2xl overflow-hidden mb-5">
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

        <div className="border-t border-border" />

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

        <div className="border-t border-border" />

        <Link href="/settings/savings">
          <button
            type="button"
            data-testid="settings-savings-link"
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-accent/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              <PiggyBank size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Savings</p>
              <p className="text-xs text-muted-foreground">
                {hasSavingsTarget
                  ? `Goal ${formatINR(savingsGoal.goal.monthly)}/mo \u2022 Emergency ${formatINR(savingsGoal.emergency.monthly)}/mo`
                  : 'Set goal savings and emergency fund targets.'}
              </p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </Link>
      </div>

      {/* Privacy & Data */}
      <SectionLabel>Privacy & Data</SectionLabel>
      <div className="bg-card border border-border rounded-2xl overflow-hidden mb-5">
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

        <Link href="/settings/backup">
          <button
            type="button"
            data-testid="settings-backup-link"
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-accent/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              <Cloud size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Backup & Restore</p>
              <p className="text-xs text-muted-foreground">Google Drive backup and CSV import/export.</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </Link>
      </div>

      {/* Support */}
      <SectionLabel>Support</SectionLabel>
      <div className="bg-card border border-border rounded-2xl overflow-hidden mb-6">
        <button
          type="button"
          data-testid="settings-feedback-link"
          onClick={() => setFeedbackOpen(true)}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-accent/5 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <MessageCircle size={18} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">Send Feedback</p>
            <p className="text-xs text-muted-foreground">Message us on WhatsApp or send an email.</p>
          </div>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
      </div>

      <div className="mt-auto pt-6 flex flex-col items-center text-center gap-1.5">
        <p className="text-sm font-semibold text-muted-foreground" data-testid="app-version">
          v{__APP_VERSION__}
        </p>
        <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
          Made with <Heart size={14} className="text-red-500 fill-red-500" /> for finance enthusiasts
        </p>
      </div>

      <FeedbackSheet open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
  );
}
