import { Switch, Route, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FinanceProvider } from '@/context/FinanceContext';
import { Navigation } from '@/components/Navigation';
import { FAB } from '@/components/FAB';
import { TransactionSheet } from '@/components/TransactionSheet';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { AppLockGate } from '@/components/AppLockGate';
import Dashboard from '@/pages/Dashboard';
import Budgets from '@/pages/Budgets';
import Analysis from '@/pages/Analysis';
import Transactions from '@/pages/Transactions';
import Settings from '@/pages/Settings';
import Security from '@/pages/Security';
import BackupRestore from '@/pages/BackupRestore';
import Recurring from '@/pages/Recurring';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

function normalizeRouterBase(baseUrl: string) {
  const normalized = baseUrl.replace(/\/$/, '');
  if (!normalized || normalized === '.' || normalized === './') return undefined;
  return normalized;
}

function AppLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <Navigation />
      <main className="flex-1 md:ml-64 overflow-y-auto min-h-screen">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/transactions" component={Transactions} />
          <Route path="/budgets" component={Budgets} />
          <Route path="/analysis" component={Analysis} />
          <Route path="/settings" component={Settings} />
          <Route path="/security" component={Security} />
          <Route path="/backup" component={BackupRestore} />
          <Route path="/recurring" component={Recurring} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <FAB />
      <TransactionSheet />
    </div>
  );
}

function App() {
  const routerBase = normalizeRouterBase(import.meta.env.BASE_URL);

  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <FinanceProvider>
          <TooltipProvider>
            <WouterRouter base={routerBase}>
              <AppLockGate>
                <AppLayout />
              </AppLockGate>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </FinanceProvider>
      </AppErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
