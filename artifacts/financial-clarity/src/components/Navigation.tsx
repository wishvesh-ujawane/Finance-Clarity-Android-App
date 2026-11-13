import { Link, useLocation } from 'wouter';
import { LayoutDashboard, PieChart, BarChart3, TrendingUp, Receipt, Settings } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { cn } from '@/lib/utils';
import { formatAmount } from '@/lib/finance-utils';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/transactions', label: 'Transactions', icon: Receipt },
  { path: '/budgets', label: 'Budgets', icon: PieChart },
  { path: '/analysis', label: 'Analysis', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function Navigation() {
  const [location] = useLocation();
  const { getTotalIncome, getTotalExpenses, getNetBalanceToDate } = useFinance();

  // Keep sidebar language aligned with the Dashboard hero — the big number is
  // lifetime pocket cash (month-agnostic), and the Income/Expenses tiles below
  // are the current-month figures.
  const balance = getNetBalanceToDate();
  const income = getTotalIncome();
  const expenses = getTotalExpenses();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-64 bg-hero text-hero-foreground z-40 border-r border-hero-foreground/10">
        <div className="p-6 border-b border-hero-foreground/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <TrendingUp size={16} className="text-accent-foreground" />
            </div>
            <p className="text-base font-bold text-hero-foreground leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Fiscal Focus
            </p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1" data-testid="sidebar-nav">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const isActive = location === path;
            return (
              <Link key={path} href={path}>
                <div
                  data-testid={`nav-${label.toLowerCase()}`}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-hero-foreground/70 hover:text-hero-foreground hover:bg-hero-foreground/10'
                  )}
                >
                  <Icon size={18} />
                  {label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-hero-foreground/10">
          <div className="bg-hero-foreground/5 rounded-xl p-4 space-y-3">
            <p className="text-xs text-hero-foreground/60 uppercase tracking-wider font-medium">Overview</p>
            <div>
              <p className="text-xs text-hero-foreground/60">Lifetime balance</p>
              <p className={cn(
                'amount text-xl font-bold',
                balance >= 0 ? 'text-income-on-hero' : 'text-spending-on-hero'
              )} style={{ fontFamily: 'var(--font-display)' }}>
                {formatAmount(balance)}
              </p>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <p className="text-[11px] text-hero-foreground/60">Income (this month)</p>
                <p className="amount text-xs font-semibold text-income-on-hero">{formatAmount(income)}</p>
              </div>
              <div className="flex-1">
                <p className="text-[11px] text-hero-foreground/60">Expenses (this month)</p>
                <p className="amount text-xs font-semibold text-spending-on-hero">{formatAmount(expenses)}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        data-testid="bottom-nav"
      >
        <div className="flex">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const isActive = location === path;
            return (
              <Link key={path} href={path} className="flex-1">
                <div
                  data-testid={`mobile-nav-${label.toLowerCase()}`}
                  className={cn(
                    'flex flex-col items-center justify-center min-h-12 py-2 gap-0.5 transition-colors',
                    isActive ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon size={19} />
                  <span className="text-[11px] font-medium">{label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
