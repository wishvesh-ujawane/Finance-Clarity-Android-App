import { useEffect, useState } from 'react';
import { Switch, Route, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FinanceProvider } from '@/context/FinanceContext';
import { SecurityProvider, useSecurity } from '@/context/SecurityContext';
import { BackupProvider } from '@/context/BackupContext';
import { FabProvider } from '@/context/FabContext';
import { MonthEndReviewProvider, useMonthEndReview } from '@/context/MonthEndReviewContext';
import { Navigation } from '@/components/Navigation';
import { FAB } from '@/components/FAB';
import { TransactionSheet } from '@/components/TransactionSheet';
import { LockScreen } from '@/components/LockScreen';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { MonthEndReviewFlow } from '@/components/month-end/MonthEndReviewFlow';
import { isOnboardingComplete } from '@/lib/onboarding';
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

const queryClient = new QueryClient();

function normalizeRouterBase(baseUrl: string) {
  const normalized = baseUrl.replace(/\/$/, '');
  if (!normalized || normalized === '.' || normalized === './') return undefined;
  return normalized;
}

function AppLayout() {
  const { isReady, isLocked } = useSecurity();
  const { setSuppressAutoOpen } = useMonthEndReview();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(() => !isOnboardingComplete());

  const showOnboarding = !isLocked && needsOnboarding;

  // Suppress the month-end review auto-open while the app isn't ready, the
  // lock screen is up, or first-launch onboarding is running.
  useEffect(() => {
    setSuppressAutoOpen(!isReady || isLocked || showOnboarding);
  }, [isReady, isLocked, showOnboarding, setSuppressAutoOpen]);

  if (!isReady) {
    return <div className="min-h-screen bg-background" />;
  }
  return (
    <div className="flex min-h-screen bg-background">
      <Navigation />
      <main className="flex-1 md:ml-64 overflow-y-auto min-h-screen">
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
      {!isLocked && !showOnboarding && <FAB />}
      <TransactionSheet />
      <LockScreen />
      {!isLocked && !showOnboarding && <MonthEndReviewFlow />}
      {showOnboarding && (
        <OnboardingFlow onComplete={() => setNeedsOnboarding(false)} />
      )}
    </div>
  );
}

function App() {
  const routerBase = normalizeRouterBase(import.meta.env.BASE_URL);

  return (
    <QueryClientProvider client={queryClient}>
      <FinanceProvider>
        <SecurityProvider>
          <BackupProvider>
            <FabProvider>
              <MonthEndReviewProvider>
                <TooltipProvider>
                  <WouterRouter base={routerBase}>
                    <AppLayout />
                  </WouterRouter>
                  <Toaster />
                </TooltipProvider>
              </MonthEndReviewProvider>
            </FabProvider>
          </BackupProvider>
        </SecurityProvider>
      </FinanceProvider>
    </QueryClientProvider>
  );
}

export default App;
