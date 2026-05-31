import { Switch, Route, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FinanceProvider } from '@/context/FinanceContext';
import { SecurityProvider, useSecurity } from '@/context/SecurityContext';
import { Navigation } from '@/components/Navigation';
import { FAB } from '@/components/FAB';
import { TransactionSheet } from '@/components/TransactionSheet';
import { LockScreen } from '@/components/LockScreen';
import Dashboard from '@/pages/Dashboard';
import Budgets from '@/pages/Budgets';
import Analysis from '@/pages/Analysis';
import Transactions from '@/pages/Transactions';
import Settings from '@/pages/Settings';
import Security from '@/pages/Security';
import RecurringExpenses from '@/pages/RecurringExpenses';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

function normalizeRouterBase(baseUrl: string) {
  const normalized = baseUrl.replace(/\/$/, '');
  if (!normalized || normalized === '.' || normalized === './') return undefined;
  return normalized;
}

function AppLayout() {
  const { isReady, isLocked } = useSecurity();
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
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </main>
      {!isLocked && <FAB />}
      <TransactionSheet />
      <LockScreen />
    </div>
  );
}

function App() {
  const routerBase = normalizeRouterBase(import.meta.env.BASE_URL);

  return (
    <QueryClientProvider client={queryClient}>
      <FinanceProvider>
        <SecurityProvider>
          <TooltipProvider>
            <WouterRouter base={routerBase}>
              <AppLayout />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </SecurityProvider>
      </FinanceProvider>
    </QueryClientProvider>
  );
}

export default App;
