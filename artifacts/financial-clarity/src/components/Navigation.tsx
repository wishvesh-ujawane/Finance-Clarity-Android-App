import { Link, useLocation } from 'wouter';
import { LayoutDashboard, PieChart, BarChart3, TrendingUp, Receipt, Settings } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { cn } from '@/lib/utils';
import { formatINR } from '@/lib/finance-utils';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/transactions', label: 'Transactions', icon: Receipt },
  { path: '/budgets', label: 'Budgets', icon: PieChart },
  { path: '/analysis', label: 'Analysis', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function Navigation() {
  const [location] = useLocation();
  const { getTotalIncome, getTotalExpenses, getBalance } = useFinance();

  const balance = getBalance();
  const income = getTotalIncome();
  const expenses = getTotalExpenses();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-64 bg-[hsl(222,65%,13%)] text-white z-40 border-r border-white/10">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <TrendingUp size={16} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-white/50 font-medium tracking-wider uppercase">Financial</p>
              <p className="text-sm font-bold text-white leading-tight" style={{ fontFamily: 'var(--font-display)' }}>Clarity</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1" data-testid="sidebar-nav">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const isActive = path === '/settings'
              ? location === '/settings' || location === '/recurring'
              : location === path;
            return (
              <Link key={path} href={path}>
                <div
                  data-testid={`nav-${label.toLowerCase()}`}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer',
                    isActive
                      ? 'bg-accent text-white shadow-lg'
                      : 'text-white/60 hover:text-white hover:bg-white/8'
                  )}
                >
                  <Icon size={18} />
                  {label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="bg-white/5 rounded-xl p-4 space-y-3">
            <p className="text-xs text-white/40 uppercase tracking-wider font-medium">This Month</p>
            <div>
              <p className="text-xs text-white/50">Balance</p>
              <p className={cn(
                'text-xl font-bold',
                balance >= 0 ? 'text-emerald-400' : 'text-red-400'
              )} style={{ fontFamily: 'var(--font-display)' }}>
                {formatINR(balance)}
              </p>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <p className="text-[10px] text-white/40">Income</p>
                <p className="text-xs font-semibold text-emerald-400">{formatINR(income)}</p>
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-white/40">Expenses</p>
                <p className="text-xs font-semibold text-red-400">{formatINR(expenses)}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[hsl(222,65%,12%)] border-t border-border z-40" data-testid="bottom-nav">
        <div className="flex">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const isActive = path === '/settings'
              ? location === '/settings' || location === '/recurring'
              : location === path;
            return (
              <Link key={path} href={path} className="flex-1">
                <div
                  data-testid={`mobile-nav-${label.toLowerCase()}`}
                  className={cn(
                    'flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors',
                    isActive ? 'text-accent' : 'text-muted-foreground'
                  )}
                >
                  <Icon size={19} />
                  <span className="text-[9px] font-medium">{label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
