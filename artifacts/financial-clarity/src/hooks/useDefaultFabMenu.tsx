import { Minus, Plus, PiggyBank, Target } from 'lucide-react';
import { useFabMenu, type FabMenuItem } from '@/context/FabContext';
import { useFinance } from '@/context/FinanceContext';

/**
 * Registers the standard 4-option FAB speed-dial for the primary screens
 * (Dashboard, Transactions, Budgets):
 *
 * - Add expense  → Add Transaction sheet in `expense` mode
 * - Add income   → Add Transaction sheet in `income` mode
 * - Add budget   → Add Budget sheet (global, mounted in App.tsx)
 * - Add savings  → Add Transaction sheet in `save` mode
 *
 * Screens that need a different single-action FAB (e.g. Recurring
 * Expenses) should keep using `useFabAction` instead.
 */
export function useDefaultFabMenu() {
  const { openSheet, openBudgetSheet } = useFinance();

  const items: FabMenuItem[] = [
    {
      onClick: () => openSheet('expense'),
      label: 'Add expense',
      icon: <Minus size={20} strokeWidth={2.5} />,
      testId: 'fab-menu-expense',
      className: 'bg-red-500 text-white',
    },
    {
      onClick: () => openSheet('income'),
      label: 'Add income',
      icon: <Plus size={20} strokeWidth={2.5} />,
      testId: 'fab-menu-income',
      className: 'bg-emerald-500 text-white',
    },
    {
      onClick: () => openBudgetSheet(),
      label: 'Add budget',
      icon: <Target size={20} strokeWidth={2.5} />,
      testId: 'fab-menu-budget',
      className: 'bg-accent text-white',
    },
    {
      onClick: () => openSheet('save'),
      label: 'Add savings',
      icon: <PiggyBank size={20} strokeWidth={2.5} />,
      testId: 'fab-menu-save',
      className: 'bg-sky-500 text-white',
    },
  ];

  useFabMenu(items, 'fab-add');
}
