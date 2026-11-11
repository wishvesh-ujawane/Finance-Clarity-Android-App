import { useCallback, useEffect, useState } from 'react';
import { Switch, Route, Router as WouterRouter } from 'wouter';
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/hooks/use-toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FinanceProvider, useFinance } from '@/context/FinanceContext';
import { SecurityProvider, useSecurity } from '@/context/SecurityContext';
import { BackupProvider } from '@/context/BackupContext';
import { FabProvider } from '@/context/FabContext';
import { MonthEndReviewProvider, useMonthEndReview } from '@/context/MonthEndReviewContext';
import { Navigation } from '@/components/Navigation';
import { FAB } from '@/components/FAB';
import { TransactionSheet } from '@/components/TransactionSheet';
import { BudgetSheet } from '@/components/BudgetSheet';
import { LockScreen } from '@/components/LockScreen';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { MonthEndReviewFlow } from '@/components/month-end/MonthEndReviewFlow';
import { StartupErrorScreen } from '@/components/StartupErrorScreen';
import { StorageNoticeBanner } from '@/components/StorageNoticeBanner';
import { isOnboardingComplete } from '@/lib/onboarding';
import { prepareStorage, type StorageStartupResult } from '@/lib/storage/startup';
import type { QuarantineReport } from '@/lib/storage/finance-read';
import Dashboard from '@/pages/Dashboard';
import Budgets from '@/pages/Budgets';
import Analysis from '@/pages/Analysis';
import Transactions from '@/pages/Transactions';
import Settings from '@/pages/Settings';
import Security from '@/pages/Security';
import RecurringExpenses from '@/pages/RecurringExpenses';
import Categories from '@/pages/Categories';
import BackupRestore from '@/pages/BackupRestore';
import SavingsGoals from '@/pages/SavingsGoals';
import NotFound from '@/pages/not-found';

function normalizeRouterBase(baseUrl: string) {
  const normalized = baseUrl.replace(/\/$/, '');
  if (!normalized || normalized === '.' || normalized === './') return undefined;
  return normalized;
}

function AppLayout({ quarantined }: { quarantined: QuarantineReport[] }) {
  const { isReady, isLocked } = useSecurity();
  const { setSuppressAutoOpen } = useMonthEndReview();
  const { processRecurring } = useFinance();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(() => !isOnboardingComplete());

  const showOnboarding = !isLocked && needsOnboarding;

  // Recurring expenses are generated only while unlocked: once after unlock
  // and again whenever the app returns to the foreground (ARCHITECTURE §6.4).
  useEffect(() => {
    if (!isReady || isLocked) return;
    processRecurring();
    const onVisible = () => {
      if (document.visibilityState === 'visible') processRecurring();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isReady, isLocked, processRecurring]);

  // Suppress the month-end review auto-open while the app isn't ready, the
  // lock screen is up, or first-launch onboarding is running.
  useEffect(() => {
    setSuppressAutoOpen(!isReady || isLocked || showOnboarding);
  }, [isReady, isLocked, showOnboarding, setSuppressAutoOpen]);

  if (!isReady) {
    return <div className="min-h-screen bg-background" />;
  }
  // Locked means not rendered: no page, sheet, or navigation is mounted until
  // the user unlocks (ARCHITECTURE §4.3).
  if (isLocked) {
    return (
      <div className="min-h-screen bg-background">
        <LockScreen />
      </div>
    );
  }
  return (
    <div className="flex min-h-screen bg-background">
      <Navigation />
      <main className="flex-1 md:ml-64 overflow-y-auto min-h-screen">
        <StorageNoticeBanner reports={quarantined} />
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/transactions" component={Transactions} />
          <Route path="/budgets" component={Budgets} />
          <Route path="/analysis" component={Analysis} />
          <Route path="/settings/security" component={Security} />
          <Route path="/settings/recurring" component={RecurringExpenses} />
          <Route path="/settings/categories" component={Categories} />
          <Route path="/settings/backup" component={BackupRestore} />
          <Route path="/settings/savings" component={SavingsGoals} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </main>
      {!showOnboarding && <FAB />}
      <TransactionSheet />
      <BudgetSheet />
      {!showOnboarding && <MonthEndReviewFlow />}
      {showOnboarding && (
        <OnboardingFlow onComplete={() => setNeedsOnboarding(false)} />
      )}
    </div>
  );
}

function AppToaster() {
  const { isLocked } = useSecurity();
  return isLocked ? null : <Toaster />;
}

/** Shows background save failures (for example recurring generation) as a toast. */
function StorageErrorNotifier() {
  const { storageError, clearStorageError } = useFinance();
  useEffect(() => {
    if (!storageError) return;
    toast({ variant: 'destructive', title: 'Couldn\u2019t save', description: storageError });
    clearStorageError();
  }, [storageError, clearStorageError]);
  return null;
}

function App() {
  const routerBase = normalizeRouterBase(import.meta.env.BASE_URL);
  // Migrations and the finance read run before any provider mounts (ARCHITECTURE §6.1).
  const [startup, setStartup] = useState<StorageStartupResult>(() => prepareStorage());
  const retryStartup = useCallback(() => setStartup(prepareStorage()), []);
  const continueStartup = useCallback(() => {
    setStartup(current => (!current.ok && current.problem === 'unpreserved' ? { ok: true, load: current.load } : current));
  }, []);

  if (!startup.ok) {
    return (
      <StartupErrorScreen
        problem={startup.problem}
        onRetry={retryStartup}
        onContinue={startup.problem === 'unpreserved' ? continueStartup : undefined}
      />
    );
  }

  return (
    <FinanceProvider initialLoad={startup.load}>
      <SecurityProvider>
        <BackupProvider>
          <FabProvider>
            <MonthEndReviewProvider>
              <TooltipProvider>
                <WouterRouter base={routerBase}>
                  <AppLayout quarantined={startup.load.quarantined} />
                </WouterRouter>
                <AppToaster />
                <StorageErrorNotifier />
              </TooltipProvider>
            </MonthEndReviewProvider>
          </FabProvider>
        </BackupProvider>
      </SecurityProvider>
    </FinanceProvider>
  );
}

export default App;
