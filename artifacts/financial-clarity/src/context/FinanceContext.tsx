import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { Transaction, Category, Budget, RecurringExpense, SavingsGoal, SAVINGS_CATEGORY_IDS, SYSTEM_ADJUSTMENT_CATEGORY_IDS, MonthReconciliation } from '@/lib/types';
import { addMonths, currentMonth, localDateStr, isConsumptionExpense } from '@/lib/finance-utils';
import { canDeleteCategory, type CategoryDeleteCheck } from '@/lib/category-rules';
import { createId } from '@/lib/ids';
import { writeFinanceData, type FinanceStorageKey } from '@/lib/storage/finance-storage';
import { readFinanceData, type StoredFinanceData } from '@/lib/storage/finance-read';
import type { FinanceLoad } from '@/lib/storage/startup';
import { getLastDueMonthBeforeDate, getRecurringOccurrenceDate } from '@/lib/recurring-utils';

const SAVINGS_CATEGORY_ID_SET: ReadonlySet<string> = new Set(SAVINGS_CATEGORY_IDS);
const SYSTEM_ADJUSTMENT_CATEGORY_ID_SET: ReadonlySet<string> = new Set(SYSTEM_ADJUSTMENT_CATEGORY_IDS);

/** Result of a finance write: state changes only when the save succeeded. */
export type FinanceWriteResult = { ok: true } | { ok: false; message: string };
export type DeleteCategoryResult = CategoryDeleteCheck | { ok: false; reason: 'storage'; message: string };

interface FinanceData {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  recurringExpenses: RecurringExpense[];
  reconciliations: MonthReconciliation[];
  savingsGoal: SavingsGoal;
}

const STORAGE_KEY_FOR: Record<keyof FinanceData, FinanceStorageKey> = {
  transactions: 'transactions',
  categories: 'categories',
  budgets: 'budgets',
  recurringExpenses: 'recurring',
  reconciliations: 'reconciliations',
  savingsGoal: 'savingsGoal',
};

/**
 * Canonical per-month summary. Single source of truth for screen-level totals.
 * - totalExpenses excludes savings-category transactions.
 * - totalSavings is the sum of expense-typed transactions in savings categories.
 * - netFlow = totalIncome - totalExpenses - totalSavings.
 * - savingsRate = totalSavings / totalIncome * 100, or 0 when income is 0.
 * - hasData = true when any transaction exists in the month.
 */
export interface MonthSummary {
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  netFlow: number;
  savingsRate: number;
  transactionCount: number;
  hasData: boolean;
}

const SAVINGS_DEFAULTS: Category[] = [
  { id: 'savings-goal', name: 'Goal Savings', icon: 'PiggyBank', color: '#0EA5E9', type: 'savings' },
  { id: 'savings-emergency', name: 'Emergency Fund', icon: 'ShieldCheck', color: '#14B8A6', type: 'savings' },
];

/** "Other" catch-all categories used as a neutral fallback for imported entries. */
const OTHER_DEFAULTS: Category[] = [
  { id: 'other', name: 'Other', icon: 'Receipt', color: '#94A3B8', type: 'expense' },
  { id: 'other-income', name: 'Other Income', icon: 'Banknote', color: '#22C55E', type: 'income' },
];

/**
 * Hidden system categories used by the Month-End Review reconciliation
 * step. Filtered out of every user-facing category picker (budgets page,
 * transaction sheet grid, analysis chip rows) via
 * `SYSTEM_ADJUSTMENT_CATEGORY_ID_SET`.
 */
const ADJUSTMENT_DEFAULTS: Category[] = [
  { id: '_adjustment-missed-spend', name: 'Missed Spend', icon: 'HelpCircle', color: '#64748B', type: 'expense' },
  { id: '_adjustment-overlogged', name: 'Over-logged Reversal', icon: 'Undo2', color: '#64748B', type: 'income' },
];

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'groceries', name: 'Groceries', icon: 'ShoppingCart', color: '#10B981', type: 'expense' },
  { id: 'rent', name: 'Rent', icon: 'Home', color: '#6366F1', type: 'expense' },
  { id: 'leisure', name: 'Leisure', icon: 'Smile', color: '#F59E0B', type: 'expense' },
  { id: 'transport', name: 'Transport', icon: 'Car', color: '#3B82F6', type: 'expense' },
  { id: 'health', name: 'Health', icon: 'Heart', color: '#EF4444', type: 'expense' },
  { id: 'dining', name: 'Dining', icon: 'Utensils', color: '#F97316', type: 'expense' },
  { id: 'salary', name: 'Salary', icon: 'Briefcase', color: '#10B981', type: 'income' },
  { id: 'freelance', name: 'Freelance', icon: 'Laptop', color: '#8B5CF6', type: 'income' },
  { id: 'investment', name: 'Investment', icon: 'TrendingUp', color: '#2563EB', type: 'income' },
  ...SAVINGS_DEFAULTS,
  ...OTHER_DEFAULTS,
  ...ADJUSTMENT_DEFAULTS,
];

/**
 * Ensure hardcoded required categories exist in the array with the correct
 * `type`. Covers the two Savings buckets, the two "Other" catch-alls, and
 * the two hidden Adjustment categories used by the
 * Month-End Review reconciliation step. Missing entries are appended;
 * entries with a wrong `type` are corrected in place. Preserves user ordering.
 */
function ensureRequiredCategories(list: Category[]): Category[] {
  const seeds = [...SAVINGS_DEFAULTS, ...OTHER_DEFAULTS, ...ADJUSTMENT_DEFAULTS];
  const byId = new Map(list.map(c => [c.id, c] as const));
  let mutated = false;
  for (const seed of seeds) {
    const existing = byId.get(seed.id);
    if (!existing) {
      byId.set(seed.id, { ...seed });
      mutated = true;
    } else if (existing.type !== seed.type) {
      byId.set(seed.id, { ...existing, type: seed.type });
      mutated = true;
    }
  }
  if (!mutated) return list;
  // Preserve original ordering then append any newly added.
  const seen = new Set<string>();
  const ordered: Category[] = [];
  for (const c of list) {
    seen.add(c.id);
    ordered.push(byId.get(c.id) ?? c);
  }
  for (const seed of seeds) {
    if (!seen.has(seed.id)) ordered.push(byId.get(seed.id)!);
  }
  return ordered;
}

interface FinanceContextType {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  recurringExpenses: RecurringExpense[];
  savingsGoal: SavingsGoal;
  /** Month-End Review reconciliation records (one per month, at most). */
  reconciliations: MonthReconciliation[];
  addTransaction: (t: Omit<Transaction, 'id'>) => FinanceWriteResult;
  /** Adds transactions and any new categories they use in one all-or-nothing save. */
  importTransactions: (
    items: Omit<Transaction, 'id'>[],
    newCategories?: Category[],
  ) => { ok: true; count: number } | { ok: false; message: string };
  updateTransaction: (id: string, updates: Omit<Transaction, 'id'>) => FinanceWriteResult;
  deleteTransaction: (id: string) => FinanceWriteResult;
  addCategory: (c: Omit<Category, 'id'>) => { ok: true; category: Category } | { ok: false; message: string };
  updateCategory: (id: string, updates: Omit<Category, 'id'>) => FinanceWriteResult;
  deleteCategory: (id: string) => DeleteCategoryResult;
  addBudget: (b: Omit<Budget, 'id'>) => FinanceWriteResult;
  updateBudget: (id: string, limit: number) => FinanceWriteResult;
  deleteBudget: (id: string) => FinanceWriteResult;
  transferBudgetsToMonth: (fromMonth: string, toMonth: string) => { ok: true; count: number } | { ok: false; message: string };
  addRecurring: (r: Omit<RecurringExpense, 'id' | 'lastGeneratedMonth'>) => FinanceWriteResult;
  updateRecurring: (id: string, updates: Omit<RecurringExpense, 'id'>) => FinanceWriteResult;
  deleteRecurring: (id: string) => FinanceWriteResult;
  toggleRecurringActive: (id: string) => FinanceWriteResult;
  setSavingsGoal: (goal: SavingsGoal) => FinanceWriteResult;
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  isSheetOpen: boolean;
  editingTransaction: Transaction | null;
  /** Initial mode to seed the Add Transaction sheet with. Null falls back to 'expense'. */
  sheetInitialMode: 'expense' | 'income' | 'save' | null;
  openSheet: (initialMode?: 'expense' | 'income' | 'save') => void;
  openEditSheet: (t: Transaction) => void;
  closeSheet: () => void;
  /** Global Add Budget sheet state (rendered once in App root). */
  isBudgetSheetOpen: boolean;
  openBudgetSheet: () => void;
  closeBudgetSheet: () => void;
  getTotalIncome: (month?: string) => number;
  getTotalExpenses: (month?: string) => number;
  getTotalSavings: (month?: string) => number;
  /** Commitments: consumption expenses in commitment-type categories. */
  getTotalCommitments: (month?: string) => number;
  /** Day-to-day: consumption expenses excluding commitments and savings. */
  getTotalDayToDay: (month?: string) => number;
  /** Per-month budget totals split by category type (dayToDay / commitments / savings). */
  getBudgetBreakdown: (month?: string) => {
    dayToDay: { limit: number; spent: number };
    commitments: { limit: number; spent: number };
    savings: { limit: number; spent: number };
  };
  getBalance: (month?: string) => number;
  getCarryForward: (month: string) => number;
  /** Total cash in pocket through today — month-agnostic. Sum of all
   * income minus consumption-only expenses (credit-card-payment transfers
   * and savings transfers are excluded) for transactions with date <= today.
   * Future-dated transactions are excluded so planned/recurring future txns
   * don't change pocket cash. */
  getNetBalanceToDate: () => number;
  /** Expected cash balance at the END of a given calendar month. Same math
   * as getNetBalanceToDate but with a month-end cutoff. Used by Month-End
   * Review's reconcile step to compare against the user's actual bank
   * balance for that month. */
  getCumulativeNetBalanceThroughEndOf: (month: string) => number;
  /** All-time outstanding credit-card balance = sum of credit-card purchases
   * minus sum of credit-card-payment transfers. Floored at zero. Accuracy
   * depends on the user tagging paymentMethod on applicable transactions. */
  getOutstandingCardBalance: () => number;
  /** Return the reconciliation record for `month`, or null if the month
   * has not been reconciled yet. */
  getReconciliationFor: (month: string) => MonthReconciliation | null;
  /** Record a Month-End Review reconciliation for `month`. If an adjustment
   * amount is provided, a hidden-category adjustment transaction is created
   * dated the last calendar day of `month` and its id is stored on the
   * record. Returns the saved record. */
  addReconciliation: (input: {
    month: string;
    actualBalance: number;
    expectedBalance: number;
    adjustmentAmount?: number;
    note?: string;
  }) => { ok: true; record: MonthReconciliation } | { ok: false; message: string };
  getSpentForCategory: (categoryId: string, month: string) => number;
  /** Canonical per-month summary — use this from all screens. */
  getMonthSummary: (month?: string) => MonthSummary;
  /** Re-reads all entities from localStorage. Used after a Drive restore. */
  reloadFromStorage: () => void;
  /** Monotonic timestamp bumped on every mutation; consumed by auto-backup. */
  lastChangedAt: number;
  /** Set when a background save (for example recurring generation) fails. */
  storageError: string | null;
  clearStorageError: () => void;

}

const FinanceContext = createContext<FinanceContextType | null>(null);

const RELOAD_FAILED_MESSAGE =
  'Couldn\u2019t reload your saved data. Close and reopen the app to see the latest saved data.';

function emptySavingsGoal(): SavingsGoal {
  return { goal: { monthly: 0, annual: 0 }, emergency: { monthly: 0, annual: 0 } };
}

const EMPTY_STORED_DATA: StoredFinanceData = {
  transactions: [],
  categories: [],
  budgets: [],
  recurringExpenses: [],
  reconciliations: [],
  savingsGoal: null,
};

/** Applies the load-time defaults to validated stored data (DATABASE §10.3). */
function toFinanceData(stored: StoredFinanceData): FinanceData {
  return {
    transactions: stored.transactions.map(t => ({ ...t, note: t.note || '' })),
    categories: stored.categories.length === 0 ? DEFAULT_CATEGORIES : ensureRequiredCategories(stored.categories),
    budgets: stored.budgets.map(b => ({ ...b, month: b.month || currentMonth() })),
    recurringExpenses: stored.recurringExpenses,
    reconciliations: stored.reconciliations,
    savingsGoal: stored.savingsGoal ?? emptySavingsGoal(),
  };
}

interface FinanceProviderProps {
  children: ReactNode;
  /** Data already read by the startup storage check. Read here when absent. */
  initialLoad?: FinanceLoad;
}

export function FinanceProvider({ children, initialLoad }: FinanceProviderProps) {
  const [initial] = useState(() => {
    if (initialLoad) return { data: toFinanceData(initialLoad.data), skipWrite: new Set(initialLoad.quarantined.map(r => r.key)) };
    const read = readFinanceData();
    if (read.ok) return { data: toFinanceData(read.data), skipWrite: new Set(read.quarantined.map(r => r.key)) };
    // Storage could not be read: never write over it from this empty state.
    return { data: toFinanceData(EMPTY_STORED_DATA), skipWrite: new Set<FinanceStorageKey>(['transactions', 'categories']) };
  });
  const [transactions, setTransactions] = useState<Transaction[]>(initial.data.transactions);
  const [categories, setCategories] = useState<Category[]>(initial.data.categories);
  const [budgets, setBudgets] = useState<Budget[]>(initial.data.budgets);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>(initial.data.recurringExpenses);
  const [reconciliations, setReconciliations] = useState<MonthReconciliation[]>(initial.data.reconciliations);
  const [savingsGoal, setSavingsGoalState] = useState<SavingsGoal>(initial.data.savingsGoal);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [sheetInitialMode, setSheetInitialMode] = useState<'expense' | 'income' | 'save' | null>(null);
  const [isBudgetSheetOpen, setIsBudgetSheetOpen] = useState(false);
  const [lastChangedAt, setLastChangedAt] = useState<number>(0);
  const [storageError, setStorageError] = useState<string | null>(null);

  // Latest committed data, so consecutive writes in one event never build on
  // stale state. Synced from React state on every render.
  const latest = useRef<FinanceData>({ transactions, categories, budgets, recurringExpenses, reconciliations, savingsGoal });
  latest.current = { transactions, categories, budgets, recurringExpenses, reconciliations, savingsGoal };

  // Persist first (ARCHITECTURE §6.2): write storage, then update React state
  // only if every write succeeded. Multi-key writes roll back together.
  const commit = useCallback((changes: Partial<FinanceData>): FinanceWriteResult => {
    const storageChanges: Partial<Record<FinanceStorageKey, unknown>> = {};
    for (const key of Object.keys(changes) as Array<keyof FinanceData>) {
      storageChanges[STORAGE_KEY_FOR[key]] = changes[key];
    }
    const result = writeFinanceData(storageChanges);
    if (!result.ok) return { ok: false, message: result.message };

    latest.current = { ...latest.current, ...changes };
    if (changes.transactions) setTransactions(changes.transactions);
    if (changes.categories) setCategories(changes.categories);
    if (changes.budgets) setBudgets(changes.budgets);
    if (changes.recurringExpenses) setRecurringExpenses(changes.recurringExpenses);
    if (changes.reconciliations) setReconciliations(changes.reconciliations);
    if (changes.savingsGoal) setSavingsGoalState(changes.savingsGoal);
    setLastChangedAt(Date.now());
    return { ok: true };
  }, []);

  const clearStorageError = useCallback(() => setStorageError(null), []);

  // On launch, store the normalised data that was just read (unless the key was
  // quarantined). A failure here loses nothing: the same values are rebuilt
  // from storage on the next launch.
  useEffect(() => {
    const writes: Partial<Record<FinanceStorageKey, unknown>> = {};
    for (const key of ['transactions', 'categories'] as const) {
      if (!initial.skipWrite.has(key)) writes[key] = latest.current[key];
    }
    writeFinanceData(writes);
    setLastChangedAt(Date.now());
  }, []);

  // One-time backfill: for legacy SavingsGoal entries with a target but no createdAt,
  // anchor pace at the earliest savings transaction in that category (else today).
  useEffect(() => {
    const today = localDateStr(new Date());
    const needsBackfill = (e: SavingsGoal['goal']) => (e.monthly > 0 || e.annual > 0) && !e.createdAt;
    if (!needsBackfill(savingsGoal.goal) && !needsBackfill(savingsGoal.emergency)) return;
    const earliestFor = (catId: string): string => {
      let earliest: string | null = null;
      for (const t of transactions) {
        if (t.type !== 'expense' || t.categoryId !== catId) continue;
        if (earliest === null || t.date < earliest) earliest = t.date;
      }
      return earliest ?? today;
    };
    const previousSavingsGoal = latest.current.savingsGoal;
    const updatedSavingsGoal: SavingsGoal = {
      goal: needsBackfill(previousSavingsGoal.goal) ? { ...previousSavingsGoal.goal, createdAt: earliestFor('savings-goal') } : previousSavingsGoal.goal,
      emergency: needsBackfill(previousSavingsGoal.emergency) ? { ...previousSavingsGoal.emergency, createdAt: earliestFor('savings-emergency') } : previousSavingsGoal.emergency,
    };
    const result = commit({ savingsGoal: updatedSavingsGoal });
    if (!result.ok) setStorageError(result.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addTransaction = useCallback((t: Omit<Transaction, 'id'>): FinanceWriteResult =>
    commit({ transactions: [{ ...t, id: createId() }, ...latest.current.transactions] }),
  [commit]);

  const importTransactions = useCallback((
    items: Omit<Transaction, 'id'>[],
    newCategories: Category[] = [],
  ): { ok: true; count: number } | { ok: false; message: string } => {
    if (items.length === 0 && newCategories.length === 0) return { ok: true, count: 0 };
    const changes: Partial<FinanceData> = {
      transactions: [...items.map(t => ({ ...t, id: createId() })), ...latest.current.transactions],
    };
    if (newCategories.length > 0) {
      // Savings type is reserved for the two hardcoded categories.
      const safe = newCategories.map(c => (c.type === 'savings' ? { ...c, type: 'expense' as const } : c));
      changes.categories = [...latest.current.categories, ...safe];
    }
    const result = commit(changes);
    return result.ok ? { ok: true, count: items.length } : result;
  }, [commit]);

  const updateTransaction = useCallback((id: string, updates: Omit<Transaction, 'id'>): FinanceWriteResult =>
    commit({ transactions: latest.current.transactions.map(t => t.id === id ? { ...updates, id } : t) }),
  [commit]);

  const deleteTransaction = useCallback((id: string): FinanceWriteResult =>
    commit({ transactions: latest.current.transactions.filter(t => t.id !== id) }),
  [commit]);

  const addCategory = useCallback((c: Omit<Category, 'id'>): { ok: true; category: Category } | { ok: false; message: string } => {
    // Savings type is reserved for the two hardcoded categories.
    const safeType: Category['type'] = c.type === 'savings' ? 'expense' : c.type;
    const newCat: Category = { ...c, type: safeType, id: createId() };
    const result = commit({ categories: [...latest.current.categories, newCat] });
    return result.ok ? { ok: true, category: newCat } : result;
  }, [commit]);

  const updateCategory = useCallback((id: string, updates: Omit<Category, 'id'>): FinanceWriteResult =>
    commit({
      categories: latest.current.categories.map(c => {
        if (c.id !== id) return c;
        // For hardcoded savings categories, force type='savings' to preserve invariant.
        if (SAVINGS_CATEGORY_ID_SET.has(id)) {
          return { ...updates, type: 'savings', id };
        }
        // Disallow promoting a non-savings category to 'savings' via update.
        const safeType: Category['type'] = updates.type === 'savings' ? c.type : updates.type;
        return { ...updates, type: safeType, id };
      }),
    }),
  [commit]);

  const deleteCategory = useCallback((id: string): DeleteCategoryResult => {
    const check = canDeleteCategory(id, latest.current);
    if (!check.ok) return check;
    const result = commit({ categories: latest.current.categories.filter(c => c.id !== id) });
    return result.ok ? check : { ok: false, reason: 'storage', message: result.message };
  }, [commit]);

  const addBudget = useCallback((b: Omit<Budget, 'id'>): FinanceWriteResult => {
    const month = b.month || selectedMonth;
    const currentBudgets = latest.current.budgets;
    const existing = currentBudgets.find(x => x.categoryId === b.categoryId && x.month === month);
    const next = existing
      ? currentBudgets.map(x => x.id === existing.id ? { ...x, limit: b.limit, month } : x)
      : [...currentBudgets, { ...b, month, id: createId() }];
    return commit({ budgets: next });
  }, [selectedMonth, commit]);

  const updateBudget = useCallback((id: string, limit: number): FinanceWriteResult =>
    commit({ budgets: latest.current.budgets.map(b => b.id === id ? { ...b, limit } : b) }),
  [commit]);

  const deleteBudget = useCallback((id: string): FinanceWriteResult =>
    commit({ budgets: latest.current.budgets.filter(b => b.id !== id) }),
  [commit]);

  const transferBudgetsToMonth = useCallback((fromMonth: string, toMonth: string) => {
    if (fromMonth === toMonth) return { ok: true as const, count: 0 };

    const currentBudgets = latest.current.budgets;
    const sourceBudgets = currentBudgets.filter(b => b.month === fromMonth);
    if (sourceBudgets.length === 0) return { ok: true as const, count: 0 };

    const next = [...currentBudgets];
    sourceBudgets.forEach(source => {
      const existingIndex = next.findIndex(b => b.month === toMonth && b.categoryId === source.categoryId);
      if (existingIndex >= 0) {
        next[existingIndex] = { ...next[existingIndex], limit: source.limit, month: toMonth };
      } else {
        next.push({ id: createId(), categoryId: source.categoryId, limit: source.limit, month: toMonth });
      }
    });

    const result = commit({ budgets: next });
    return result.ok ? { ok: true as const, count: sourceBudgets.length } : result;
  }, [commit]);

  const openSheet = useCallback((initialMode?: 'expense' | 'income' | 'save') => {
    setEditingTransaction(null);
    setSheetInitialMode(initialMode ?? null);
    setIsSheetOpen(true);
  }, []);

  const openEditSheet = useCallback((t: Transaction) => {
    setEditingTransaction(t);
    setSheetInitialMode(null);
    setIsSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setIsSheetOpen(false);
    setEditingTransaction(null);
    setSheetInitialMode(null);
  }, []);

  const openBudgetSheet = useCallback(() => {
    setIsBudgetSheetOpen(true);
  }, []);

  const closeBudgetSheet = useCallback(() => {
    setIsBudgetSheetOpen(false);
  }, []);

  const addRecurring = useCallback((r: Omit<RecurringExpense, 'id' | 'lastGeneratedMonth'>): FinanceWriteResult =>
    commit({ recurringExpenses: [...latest.current.recurringExpenses, { ...r, id: createId() }] }),
  [commit]);

  const updateRecurring = useCallback((id: string, updates: Omit<RecurringExpense, 'id'>): FinanceWriteResult => {
    const previous = latest.current.recurringExpenses.find(r => r.id === id);
    const nextRule: RecurringExpense = { ...updates, id };
    if (previous?.lastGeneratedMonth && (!nextRule.lastGeneratedMonth || nextRule.lastGeneratedMonth < previous.lastGeneratedMonth)) {
      nextRule.lastGeneratedMonth = previous.lastGeneratedMonth;
    }
    if (previous && !previous.active && nextRule.active) {
      const skippedThrough = getLastDueMonthBeforeDate(nextRule, localDateStr(new Date()));
      nextRule.lastGeneratedMonth = previous.lastGeneratedMonth &&
        (!skippedThrough || previous.lastGeneratedMonth > skippedThrough)
        ? previous.lastGeneratedMonth
        : skippedThrough;
    }
    return commit({ recurringExpenses: latest.current.recurringExpenses.map(r => r.id === id ? nextRule : r) });
  }, [commit]);

  const deleteRecurring = useCallback((id: string): FinanceWriteResult =>
    commit({ recurringExpenses: latest.current.recurringExpenses.filter(r => r.id !== id) }),
  [commit]);

  const toggleRecurringActive = useCallback((id: string): FinanceWriteResult => {
    const today = localDateStr(new Date());
    return commit({
      recurringExpenses: latest.current.recurringExpenses.map(r => {
        if (r.id !== id) return r;
        const active = !r.active;
        if (!active) return { ...r, active };
        const skippedThrough = getLastDueMonthBeforeDate(r, today);
        const lastGeneratedMonth = r.lastGeneratedMonth &&
          (!skippedThrough || r.lastGeneratedMonth > skippedThrough)
          ? r.lastGeneratedMonth
          : skippedThrough;
        return { ...r, active, lastGeneratedMonth };
      }),
    });
  }, [commit]);

  const setSavingsGoal = useCallback((goal: SavingsGoal): FinanceWriteResult => {
    // Stamp createdAt on newly-active entries so pace can be anchored from creation.
    const today = localDateStr(new Date());
    const stamp = (next: SavingsGoal['goal'], prev: SavingsGoal['goal']): SavingsGoal['goal'] => {
      const hasTarget = next.monthly > 0 || next.annual > 0;
      const prevHadTarget = prev.monthly > 0 || prev.annual > 0;
      if (hasTarget && !next.createdAt) {
        // First time this entry has a target — anchor pace from today (unless prev already had one).
        return { ...next, createdAt: prev.createdAt ?? (prevHadTarget ? prev.createdAt : today) ?? today };
      }
      return next;
    };
    const previous = latest.current.savingsGoal;
    const next: SavingsGoal = {
      goal: stamp(goal.goal, previous.goal),
      emergency: stamp(goal.emergency, previous.emergency),
    };
    return commit({ savingsGoal: next });
  }, [commit]);

  const reloadFromStorage = useCallback(() => {
    // Re-read every entity from storage. Used after a Drive restore.
    const read = readFinanceData();
    if (!read.ok) {
      setStorageError(RELOAD_FAILED_MESSAGE);
      return;
    }
    const next = toFinanceData(read.data);
    latest.current = next;
    setTransactions(next.transactions);
    setCategories(next.categories);
    setBudgets(next.budgets);
    setRecurringExpenses(next.recurringExpenses);
    setReconciliations(next.reconciliations);
    setSavingsGoalState(next.savingsGoal);
    setLastChangedAt(Date.now());
  }, []);

  // Recurring materializer: for each active recurring expense, generate one
  // transaction per month from startMonth..currentMonth that hasn't been generated yet.
  // For the CURRENT month, we wait until today's date reaches the rule's dayOfMonth
  // before stamping. Future months are never materialized here.
  useEffect(() => {
    const today = localDateStr(new Date());
    const cur = today.slice(0, 7);
    const pending: { recurringId: string; lastMonth: string; newTx: Omit<Transaction, 'id'>[] }[] = [];
    const { transactions: currentTransactions, recurringExpenses: currentRules } = latest.current;

    currentRules.forEach(r => {
      if (!r.active) return;
      if (!r.startMonth || r.startMonth > cur) return;

      const startFrom = r.lastGeneratedMonth && r.lastGeneratedMonth >= r.startMonth
        ? addMonths(r.lastGeneratedMonth, 1)
        : r.startMonth;
      if (startFrom > cur) return;

      const monthsToGenerate: string[] = [];
      let m = startFrom;
      while (m <= cur) {
        if (getRecurringOccurrenceDate(m, r.dayOfMonth) > today) break;
        monthsToGenerate.push(m);
        m = addMonths(m, 1);
      }
      if (monthsToGenerate.length === 0) return;

      const newTx: Omit<Transaction, 'id'>[] = [];
      monthsToGenerate.forEach(monthKey => {
        const date = getRecurringOccurrenceDate(monthKey, r.dayOfMonth);
        const note = r.description;

        const exists = currentTransactions.some(t =>
          t.recurringRuleId === r.id && t.recurringMonth === monthKey
        );
        // Legacy generated transactions had no occurrence key. Match their
        // exact scheduled date once, then the forward-only cursor takes over.
        const legacyExists = currentTransactions.some(t =>
          t.recurringRuleId === undefined &&
          t.type === 'expense' &&
          t.date === date &&
          t.amount === r.amount &&
          (t.note || '').trim().toLowerCase() === note.trim().toLowerCase() &&
          t.categoryId === r.categoryId
        );
        if (exists || legacyExists) return;

        newTx.push({
          type: 'expense', amount: r.amount, categoryId: r.categoryId, note, date,
          recurringRuleId: r.id, recurringMonth: monthKey,
        });
      });

      pending.push({ recurringId: r.id, lastMonth: monthsToGenerate[monthsToGenerate.length - 1], newTx });
    });

    if (pending.length === 0) return;

    const allNew: Transaction[] = pending.flatMap(p => p.newTx.map(t => ({ ...t, id: createId() })));
    const changes: Partial<FinanceData> = {
      recurringExpenses: currentRules.map(r => {
        const match = pending.find(p => p.recurringId === r.id);
        return match ? { ...r, lastGeneratedMonth: match.lastMonth } : r;
      }),
    };
    if (allNew.length > 0) changes.transactions = [...allNew, ...currentTransactions];
    // Transactions and cursors are saved together; on failure nothing changes
    // and generation is retried on the next launch.
    const result = commit(changes);
    if (!result.ok) setStorageError(`Recurring expenses could not be added. ${result.message}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurringExpenses]);

  const getTransactionsForMonth = useCallback((month?: string) => {
    const m = month || selectedMonth;
    return transactions.filter(t => t.date.startsWith(m));
  }, [transactions, selectedMonth]);

  const getTotalIncome = useCallback((month?: string) => {
    return getTransactionsForMonth(month)
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [getTransactionsForMonth]);

  const getTotalExpenses = useCallback((month?: string) => {
    return getTransactionsForMonth(month)
      .filter(isConsumptionExpense)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [getTransactionsForMonth]);

  const getTotalSavings = useCallback((month?: string) => {
    return getTransactionsForMonth(month)
      .filter(t => t.type === 'expense' && SAVINGS_CATEGORY_ID_SET.has(t.categoryId))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [getTransactionsForMonth]);

  // Commitments: consumption-expense txns whose category is of type 'commitment'
  // (rent, home-loan EMI, etc.). Non-overlapping with savings; subset of
  // getTotalExpenses.
  const getTotalCommitments = useCallback((month?: string) => {
    const commitmentIds = new Set(categories.filter(c => c.type === 'commitment').map(c => c.id));
    return getTransactionsForMonth(month)
      .filter(isConsumptionExpense)
      .filter(t => commitmentIds.has(t.categoryId))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [getTransactionsForMonth, categories]);

  // Day-to-day: consumption-expense txns that are NOT commitments and NOT
  // savings. The canonical "discretionary spend" number used by the
  // Analysis "Day-to-day" tile and the Dashboard day-to-day budget bar.
  const getTotalDayToDay = useCallback((month?: string) => {
    return getTotalExpenses(month) - getTotalCommitments(month);
  }, [getTotalExpenses, getTotalCommitments]);

  const getBalance = useCallback((month?: string) => {
    return getTotalIncome(month) - getTotalExpenses(month) - getTotalSavings(month);
  }, [getTotalIncome, getTotalExpenses, getTotalSavings]);

  // Carry forward = cumulative balance of all months BEFORE the given month.
  // Expenses are filtered through isConsumptionExpense so credit-card-payment
  // transfers (bank -> card) don't double-count — the underlying credit-card
  // purchase is already an outflow. Savings-category expenses are also
  // excluded (user still has that money, just moved to a savings bucket).
  const getCarryForward = useCallback((month: string) => {
    const prevTransactions = transactions.filter(t => t.date < month);
    let income = 0;
    let outflow = 0;
    for (const t of prevTransactions) {
      if (t.type === 'income') income += t.amount;
      else if (isConsumptionExpense(t)) outflow += t.amount;
    }
    return income - outflow;
  }, [transactions]);

  // Total pocket cash through today, ignoring the selected month. Same
  // consumption-only filter as getCarryForward: card-payment transfers and
  // savings transfers are not outflows. Future-dated transactions are
  // excluded so projections don't move the number.
  const getNetBalanceToDate = useCallback(() => {
    const todayStr = localDateStr(new Date());
    let income = 0;
    let outflow = 0;
    for (const t of transactions) {
      if (t.date > todayStr) continue;
      if (t.type === 'income') income += t.amount;
      else if (isConsumptionExpense(t)) outflow += t.amount;
    }
    return income - outflow;
  }, [transactions]);

  // Expected cash balance at the END of a calendar month — same model as
  // getNetBalanceToDate but with a month-end cutoff instead of today. Used
  // by the Month-End Review reconcile step to compare against the user's
  // actual bank balance for that month.
  const getCumulativeNetBalanceThroughEndOf = useCallback((month: string) => {
    // month is 'YYYY-MM'; cutoff is any date starting with month or earlier.
    // String compare works because dates are ISO 'YYYY-MM-DD'.
    const cutoffPrefix = month;
    let income = 0;
    let outflow = 0;
    for (const t of transactions) {
      // Keep entries dated on or before the last day of `month`.
      if (t.date.slice(0, 7) > cutoffPrefix) continue;
      if (t.type === 'income') income += t.amount;
      else if (isConsumptionExpense(t)) outflow += t.amount;
    }
    return income - outflow;
  }, [transactions]);

  // Outstanding credit-card balance = all-time card purchases minus all-time
  // card-bill payments. Floored at zero so overpayments don't surface a
  // confusing negative. Accuracy depends on manual payment-method tagging.
  const getOutstandingCardBalance = useCallback(() => {
    let purchases = 0;
    let payments = 0;
    for (const t of transactions) {
      if (t.type !== 'expense') continue;
      if (t.paymentMethod === 'credit-card') purchases += t.amount;
      else if (t.paymentMethod === 'credit-card-payment') payments += t.amount;
    }
    return Math.max(0, purchases - payments);
  }, [transactions]);

  const getReconciliationFor = useCallback(
    (month: string): MonthReconciliation | null =>
      reconciliations.find(r => r.month === month) ?? null,
    [reconciliations],
  );

  // Create / replace a Month-End Review reconciliation record for `month`.
  // When `adjustmentAmount` is non-zero we also create a hidden-category
  // adjustment transaction dated the last calendar day of `month`, so the
  // next month's carry-forward is already correct. Positive amounts become
  // an expense in `_adjustment-missed-spend`; negative amounts become an
  // income in `_adjustment-overlogged`.
  const addReconciliation = useCallback(
    (input: {
      month: string;
      actualBalance: number;
      expectedBalance: number;
      adjustmentAmount?: number;
      note?: string;
    }): { ok: true; record: MonthReconciliation } | { ok: false; message: string } => {
      const { month, actualBalance, expectedBalance, adjustmentAmount, note } = input;

      let adjustmentTxnId: string | undefined;
      let adjustment: Transaction | undefined;
      if (adjustmentAmount !== undefined && adjustmentAmount !== 0) {
        // Last calendar day of `month`.
        const [yStr, mStr] = month.split('-').map(Number);
        const lastDay = new Date(yStr, mStr, 0).getDate();
        const dateIso = `${month}-${String(lastDay).padStart(2, '0')}`;
        const amt = Math.abs(adjustmentAmount);
        const id = createId();
        adjustmentTxnId = id;
        adjustment = adjustmentAmount > 0
          ? {
              id,
              type: 'expense',
              amount: amt,
              categoryId: '_adjustment-missed-spend',
              note: note || 'Missed spend (reconciled)',
              date: dateIso,
            }
          : {
              id,
              type: 'income',
              amount: amt,
              categoryId: '_adjustment-overlogged',
              note: note || 'Over-logged reversal (reconciled)',
              date: dateIso,
            };
      }

      const record: MonthReconciliation = {
        month,
        actualBalance,
        expectedBalance,
        adjustmentTxnId,
        reconciledAt: Date.now(),
      };
      // Replace any existing record for the month (allow re-reconcile). The
      // adjustment transaction is saved before the record (DATABASE §7.3).
      const changes: Partial<FinanceData> = {
        reconciliations: [record, ...latest.current.reconciliations.filter(r => r.month !== month)],
      };
      if (adjustment) changes.transactions = [adjustment, ...latest.current.transactions];
      const result = commit(changes);
      return result.ok ? { ok: true, record } : result;
    },
    [commit],
  );

  const getSpentForCategory = useCallback((categoryId: string, month: string) => {
    return transactions
      .filter(t => t.type === 'expense' && t.categoryId === categoryId && t.date.startsWith(month))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  // Three-bucket budget breakdown by category type, driven off `cat.type`.
  // Budgets whose category is 'expense' or 'both' land in dayToDay; 'commitment'
  // in commitments; 'savings' in savings. Unknown-category rows fall into
  // dayToDay (safe default — matches the pre-split behavior).
  const getBudgetBreakdown = useCallback((month?: string) => {
    const m = month || selectedMonth;
    const monthBudgets = budgets.filter(b => b.month === m);
    const buckets = {
      dayToDay: { limit: 0, spent: 0 },
      commitments: { limit: 0, spent: 0 },
      savings: { limit: 0, spent: 0 },
    };
    for (const b of monthBudgets) {
      const cat = categories.find(c => c.id === b.categoryId);
      const bucket =
        cat?.type === 'commitment' ? buckets.commitments
        : cat?.type === 'savings' ? buckets.savings
        : buckets.dayToDay;
      bucket.limit += b.limit;
      bucket.spent += getSpentForCategory(b.categoryId, m);
    }
    return buckets;
  }, [budgets, categories, selectedMonth, getSpentForCategory]);

  const getMonthSummary = useCallback((month?: string): MonthSummary => {
    const monthTxns = getTransactionsForMonth(month);
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalSavings = 0;
    for (const t of monthTxns) {
      if (t.type === 'income') {
        totalIncome += t.amount;
      } else if (t.type === 'expense') {
        if (SAVINGS_CATEGORY_ID_SET.has(t.categoryId)) totalSavings += t.amount;
        else totalExpenses += t.amount;
      }
    }
    const netFlow = totalIncome - totalExpenses - totalSavings;
    const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;
    return {
      totalIncome,
      totalExpenses,
      totalSavings,
      netFlow,
      savingsRate,
      transactionCount: monthTxns.length,
      hasData: monthTxns.length > 0,
    };
  }, [getTransactionsForMonth]);

  return (
    <FinanceContext.Provider value={{
      transactions, categories, budgets,
      recurringExpenses, savingsGoal,
      reconciliations,
      addTransaction, importTransactions, updateTransaction, deleteTransaction,
      addCategory, updateCategory, deleteCategory,
      addBudget, updateBudget, deleteBudget, transferBudgetsToMonth,
      addRecurring, updateRecurring, deleteRecurring, toggleRecurringActive,
      setSavingsGoal,
      selectedMonth, setSelectedMonth,
      isSheetOpen, editingTransaction, sheetInitialMode,
      openSheet, openEditSheet, closeSheet,
      isBudgetSheetOpen, openBudgetSheet, closeBudgetSheet,
      getTotalIncome, getTotalExpenses, getTotalSavings, getBalance, getCarryForward, getNetBalanceToDate, getCumulativeNetBalanceThroughEndOf, getOutstandingCardBalance, getReconciliationFor, addReconciliation, getSpentForCategory,
      getTotalCommitments, getTotalDayToDay, getBudgetBreakdown,
      getMonthSummary,
      reloadFromStorage, lastChangedAt,
      storageError, clearStorageError,
    }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
