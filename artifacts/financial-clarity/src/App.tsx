import { Switch, Route, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FinanceProvider } from '@/context/FinanceContext';
import { Navigation } from '@/components/Navigation';
import { FAB } from '@/components/FAB';
import { TransactionSheet } from '@/components/TransactionSheet';
import Dashboard from '@/pages/Dashboard';
import Budgets from '@/pages/Budgets';
import Analysis from '@/pages/Analysis';
import Transactions from '@/pages/Transactions';
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
      <FinanceProvider>
        <TooltipProvider>
          <WouterRouter base={routerBase}>
            <AppLayout />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </FinanceProvider>
    </QueryClientProvider>
  );
}

export default App;
