import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, PiggyBank, ShieldCheck, Target } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { formatAmountFull } from '@/lib/format';
import { parseCurrencyInput } from '@/lib/currency-utils';

export default function SavingsGoals() {
  const [, setLocation] = useLocation();
  const { savingsGoal, setSavingsGoal } = useFinance();

  const [goalMonthlyInput, setGoalMonthlyInput] = useState(String(savingsGoal.goal.monthly || ''));
  const [goalAnnualInput, setGoalAnnualInput] = useState(String(savingsGoal.goal.annual || ''));
  const [emergencyMonthlyInput, setEmergencyMonthlyInput] = useState(String(savingsGoal.emergency.monthly || ''));
  const [emergencyAnnualInput, setEmergencyAnnualInput] = useState(String(savingsGoal.emergency.annual || ''));
  const [goalSavedMessage, setGoalSavedMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  const handleSaveGoal = () => {
    const result = setSavingsGoal({
      goal: {
        monthly: parseCurrencyInput(goalMonthlyInput),
        annual: parseCurrencyInput(goalAnnualInput),
      },
      emergency: {
        monthly: parseCurrencyInput(emergencyMonthlyInput),
        annual: parseCurrencyInput(emergencyAnnualInput),
      },
    });
    if (!result.ok) {
      setGoalSavedMessage('');
      setSaveError(result.message);
      return;
    }
    setSaveError('');
    setGoalSavedMessage('Savings goals saved.');
    setTimeout(() => setGoalSavedMessage(''), 2500);
  };

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8">
      <div className="flex items-center gap-2 mb-6">
        <button
          type="button"
          data-testid="savings-back"
          onClick={() => setLocation('/settings')}
          className="tap-target w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Back to settings"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Settings</p>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Savings</h1>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
            <Target size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Savings Goals</p>
            <p className="text-xs text-muted-foreground">Set monthly or annual targets for each savings category.</p>
          </div>
        </div>
        <div className="p-5 space-y-6">
          {/* Goal Savings */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-savings-tint text-savings flex items-center justify-center flex-shrink-0">
                <PiggyBank size={15} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">Goal Savings</p>
                <p className="text-xs text-muted-foreground amount">
                  {savingsGoal.goal.annual > 0 || savingsGoal.goal.monthly > 0
                    ? `Current: ${formatAmountFull(savingsGoal.goal.monthly)}/mo \u2022 ${formatAmountFull(savingsGoal.goal.annual)}/year`
                    : 'No target set.'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="goal-monthly" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Monthly</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                  <input id="goal-monthly"
                    data-testid="goal-monthly"
                    type="number"
                    value={goalMonthlyInput}
                    onChange={e => setGoalMonthlyInput(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-3 text-sm amount bg-muted rounded-xl border-0 outline-none focus:ring-2 focus:ring-accent text-foreground"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="goal-annual" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Annual</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                  <input id="goal-annual"
                    data-testid="goal-annual"
                    type="number"
                    value={goalAnnualInput}
                    onChange={e => setGoalAnnualInput(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-3 text-sm amount bg-muted rounded-xl border-0 outline-none focus:ring-2 focus:ring-accent text-foreground"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Emergency Fund */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={15} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">Emergency Fund</p>
                <p className="text-xs text-muted-foreground amount">
                  {savingsGoal.emergency.annual > 0 || savingsGoal.emergency.monthly > 0
                    ? `Current: ${formatAmountFull(savingsGoal.emergency.monthly)}/mo \u2022 ${formatAmountFull(savingsGoal.emergency.annual)}/year`
                    : 'No target set.'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="emergency-monthly" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Monthly</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                  <input id="emergency-monthly"
                    data-testid="emergency-monthly"
                    type="number"
                    value={emergencyMonthlyInput}
                    onChange={e => setEmergencyMonthlyInput(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-3 text-sm amount bg-muted rounded-xl border-0 outline-none focus:ring-2 focus:ring-accent text-foreground"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="emergency-annual" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Annual</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                  <input id="emergency-annual"
                    data-testid="emergency-annual"
                    type="number"
                    value={emergencyAnnualInput}
                    onChange={e => setEmergencyAnnualInput(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-3 text-sm amount bg-muted rounded-xl border-0 outline-none focus:ring-2 focus:ring-accent text-foreground"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            data-testid="goal-save"
            onClick={handleSaveGoal}
            className="w-full min-h-12 py-3 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90 transition-colors"
          >
            Save Goals
          </button>
          {goalSavedMessage && (
            <p className="text-xs font-medium text-success">{goalSavedMessage}</p>
          )}
          {saveError && <p className="text-xs font-medium text-destructive" role="alert" data-testid="savings-save-error">{saveError}</p>}
        </div>
      </div>
    </div>
  );
}
