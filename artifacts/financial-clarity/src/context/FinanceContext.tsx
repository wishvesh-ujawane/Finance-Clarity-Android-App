import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { Transaction, Category, Budget, RecurringExpense, SavingsGoal, SAVINGS_CATEGORY_IDS, MonthReconciliation } from '@/lib/types';
import { currentMonth, lastDateOfMonth, localDateStr } from '@/lib/domain/periods';
import {
  balanceThroughEndOf,
  cardBillPaymentsIn,
  carryForward,
  categorySpent,
  expectedBankBalanceAtEndOf,
  lifetimeBalance,
  monthlyNet,
  monthSummary,
  outstandingCardAmount,
  outstandingCardAmountThroughEndOf,
  savingsBalanceThroughEndOf,
  totalCommitments,
  totalConsumption,
  totalDayToDay,
  totalIncome,
  totalSavingsContributions,
  type MonthSummary,
} from '@/lib/domain/finance-metrics';
import {
  canDeactivateCategory,
  activeRecurringRulesIn,
  activeRecurringBlockMessage,
  canDeleteCategory,
  duplicateNameMessage,
  findActiveNameClash,
  INACTIVE_CATEGORY_MESSAGE,
  isCategoryActive,
  type CategoryDeleteCheck,
} from '@/lib/category-rules';
import { createId } from '@/lib/ids';
import { writeFinanceData, type FinanceStorageKey } from '@/lib/storage/finance-storage';
import { readFinanceData, type StoredFinanceData } from '@/lib/storage/finance-read';
import type { FinanceLoad } from '@/lib/storage/startup';
import { getLastDueMonthBeforeDate, planRecurringGeneration } from '@/lib/domain/recurring';
import { applyBudgetCopy, budgetCopyCount, planBudgetCopy } from '@/lib/domain/budgets';

const SAVINGS_CATEGORY_ID_SET: ReadonlySet<string> = new Set(SAVINGS_CATEGORY_IDS);

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

/** Canonical per-month summary (defined in `lib/domain/finance-metrics`). */
export type { MonthSummary };

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
 * `SYSTEM_ADJUSTMENT_CATEGORY_IDS`.
 */
const ADJUSTMENT_DEFAULTS: Category[] = [
  { id: '_adjustment-missed-spend', name: 'Missed Spend', icon: 'HelpCircle', color: '#64748B', type: 'expense' },
  { id: '_adjustment-overlogged', name: 'Over-logged Reversal', icon: 'Undo2', color: '#64748B', type: 'income' },
  { id: '_adjustment-savings', name: 'Savings reconciliation', icon: 'PiggyBank', color: '#64748B', type: 'both' },
];

const DEFAULT_CATEGORIES: Category[] = ([
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
] as Category[]).map(c => ({ ...c, active: true }));

/**
 * Ensure hardcoded required categories exist in the array with the correct
 * `type`. Covers the two Savings buckets, the two "Other" catch-alls, and
 * the two hidden Adjustment categories used by the
 * Month-End Review reconciliation step. Missing entries are appended;
 * entries with a wrong `type` are corrected in place, and they are always
 * active because their features depend on them. Preserves user ordering.
 */
function ensureRequiredCategories(list: Category[]): Category[] {
  const seeds = [...SAVINGS_DEFAULTS, ...OTHER_DEFAULTS, ...ADJUSTMENT_DEFAULTS];
  const byId = new Map(list.map(c => [c.id, c] as const));
  let mutated = false;
  for (const seed of seeds) {
    const existing = byId.get(seed.id);
    if (!existing) {
      byId.set(seed.id, { ...seed, active: true });
      mutated = true;
    } else if (existing.type !== seed.type || existing.active === false) {
      byId.set(seed.id, { ...existing, type: seed.type, active: existing.active === false ? true : existing.active });
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
  /** Makes a category active or inactive. Built-in categories can't be made inactive. */
  setCategoryActive: (id: string, active: boolean) => FinanceWriteResult;
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
  /** Lifetime balance through today, including confirmed savings corrections.
   * Future-dated transactions are excluded. This is not bank cash. */
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
  /** Outstanding card amount counting entries dated through the last day of `month`. */
  getOutstandingCardBalanceAtEndOf: (month: string) => number;
  /** Card bill payments dated in `month`. */
  getCardBillPaymentsIn: (month: string) => number;
  /** Month-end reconcile target: balance through the month plus the card amount still unpaid then. */
  getExpectedBankBalanceAtEndOf: (month: string) => number;
  getSavingsBalanceAtEndOf: (month: string) => number;
  /** Records a card bill payment dated the last day of `month`; refuses more than the unpaid amount. */
  recordCardBillPayment: (month: string, amount: number) => FinanceWriteResult;
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
    savings?: { actualBalance: number; decreaseReason?: 'spent' | 'transfer' };
  }) => { ok: true; record: MonthReconciliation } | { ok: false; message: string };
  /** Amount counted against a category budget: savings contributions for a savings category, consumption otherwise. */
  getSpentForCategory: (categoryId: string, month: string) => number;
  /** Canonical per-month summary — use this from all screens. */
  getMonthSummary: (month?: string) => MonthSummary;
  /** Re-reads all entities from localStorage. Used after a Drive restore. */
  reloadFromStorage: () => void;
  /**
   * Adds every due recurring occurrence once and advances rule cursors.
   * Called by the app shell after unlock and on resume (ARCHITECTURE §6.4).
   */
  processRecurring: () => { ok: true; count: number } | { ok: false; message: string };
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

  // New entries need an active category (PRD FR-03, DATABASE §6.2).
  const isInactiveCategory = (categoryId: string): boolean => {
    const category = latest.current.categories.find(c => c.id === categoryId);
    return category !== undefined && !isCategoryActive(category);
  };

  const addTransaction = useCallback((t: Omit<Transaction, 'id'>): FinanceWriteResult => {
    if (t.savingsCorrection || t.categoryId === '_adjustment-savings') {
      return { ok: false, message: 'Savings corrections must be recorded in month-end reconciliation. Nothing was saved.' };
    }
    if (isInactiveCategory(t.categoryId)) return { ok: false, message: INACTIVE_CATEGORY_MESSAGE };
    return commit({ transactions: [{ ...t, id: createId() }, ...latest.current.transactions] });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit]);

  const importTransactions = useCallback((
    items: Omit<Transaction, 'id'>[],
    newCategories: Category[] = [],
  ): { ok: true; count: number } | { ok: false; message: string } => {
    if (items.length === 0 && newCategories.length === 0) return { ok: true, count: 0 };
    if (items.some(t => t.savingsCorrection || t.categoryId === '_adjustment-savings')) {
      return { ok: false, message: 'Savings corrections cannot be imported as ordinary transactions. Nothing was saved.' };
    }
    const changes: Partial<FinanceData> = {
      transactions: [...items.map(t => ({ ...t, id: createId() })), ...latest.current.transactions],
    };
    if (newCategories.length > 0) {
      // Savings type is reserved for the two hardcoded categories.
      const safe = newCategories.map(c => ({ ...c, type: c.type === 'savings' ? 'expense' as const : c.type, active: true }));
      changes.categories = [...latest.current.categories, ...safe];
    }
    const result = commit(changes);
    return result.ok ? { ok: true, count: items.length } : result;
  }, [commit]);

  // Editing may keep the entry's current category even if it is now inactive.
  const updateTransaction = useCallback((id: string, updates: Omit<Transaction, 'id'>): FinanceWriteResult => {
    const previous = latest.current.transactions.find(t => t.id === id);
    if (previous?.savingsCorrection || updates.savingsCorrection) {
      return { ok: false, message: 'Remove the savings correction in Transactions and record a new one in a later review. Nothing was changed.' };
    }
    if (previous?.categoryId !== updates.categoryId && isInactiveCategory(updates.categoryId)) {
      return { ok: false, message: INACTIVE_CATEGORY_MESSAGE };
    }
    return commit({ transactions: latest.current.transactions.map(t => t.id === id ? { ...updates, id } : t) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit]);

  const deleteTransaction = useCallback((id: string): FinanceWriteResult =>
    commit({ transactions: latest.current.transactions.filter(t => t.id !== id) }),
  [commit]);

  const addCategory = useCallback((c: Omit<Category, 'id'>): { ok: true; category: Category } | { ok: false; message: string } => {
    // Savings type is reserved for the two hardcoded categories.
    if (findActiveNameClash(latest.current.categories, c.name)) return { ok: false, message: duplicateNameMessage(c.name) };
    const safeType: Category['type'] = c.type === 'savings' ? 'expense' : c.type;
    const newCat: Category = { ...c, type: safeType, active: true, id: createId() };
    const result = commit({ categories: [...latest.current.categories, newCat] });
    return result.ok ? { ok: true, category: newCat } : result;
  }, [commit]);

  const updateCategory = useCallback((id: string, updates: Omit<Category, 'id'>): FinanceWriteResult => {
    const current = latest.current.categories.find(c => c.id === id);
    if (current && isCategoryActive(current) && findActiveNameClash(latest.current.categories, updates.name, id)) {
      return { ok: false, message: duplicateNameMessage(updates.name) };
    }
    return commit({
      categories: latest.current.categories.map(c => {
        if (c.id !== id) return c;
        // Status changes go through setCategoryActive, so keep the current one.
        const active = c.active;
        // For hardcoded savings categories, force type='savings' to preserve invariant.
        if (SAVINGS_CATEGORY_ID_SET.has(id)) {
          return { ...updates, type: 'savings', active, id };
        }
        // Disallow promoting a non-savings category to 'savings' via update.
        const safeType: Category['type'] = updates.type === 'savings' ? c.type : updates.type;
        return { ...updates, type: safeType, active, id };
      }),
    });
  }, [commit]);

  const setCategoryActive = useCallback((id: string, active: boolean): FinanceWriteResult => {
    if (!active && !canDeactivateCategory(id)) {
      return { ok: false, message: 'This built-in category is needed by the app, so it can\u2019t be made inactive.' };
    }
    if (!active) {
      const blocking = activeRecurringRulesIn(id, latest.current.recurringExpenses);
      if (blocking.length > 0) return { ok: false, message: activeRecurringBlockMessage(blocking) };
    }
    const category = latest.current.categories.find(c => c.id === id);
    if (active && category && findActiveNameClash(latest.current.categories, category.name, id)) {
      return { ok: false, message: duplicateNameMessage(category.name) };
    }
    return commit({ categories: latest.current.categories.map(c => (c.id === id ? { ...c, active } : c)) });
  }, [commit]);

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
    if (!existing && isInactiveCategory(b.categoryId)) return { ok: false, message: INACTIVE_CATEGORY_MESSAGE };
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
    const plan = planBudgetCopy(latest.current.budgets, latest.current.categories, fromMonth, toMonth);
    const count = budgetCopyCount(plan);
    if (plan.created.length === 0 && plan.overwritten.length === 0) return { ok: true as const, count };
    const result = commit({ budgets: applyBudgetCopy(latest.current.budgets, plan, toMonth, createId) });
    return result.ok ? { ok: true as const, count } : result;
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

  // A new or edited recurring rule needs an active category (DATABASE §6.2).
  const addRecurring = useCallback((r: Omit<RecurringExpense, 'id' | 'lastGeneratedMonth'>): FinanceWriteResult => {
    if (isInactiveCategory(r.categoryId)) return { ok: false, message: INACTIVE_CATEGORY_MESSAGE };
    return commit({ recurringExpenses: [...latest.current.recurringExpenses, { ...r, id: createId() }] });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit]);

  const updateRecurring = useCallback((id: string, updates: Omit<RecurringExpense, 'id'>): FinanceWriteResult => {
    if (isInactiveCategory(updates.categoryId)) return { ok: false, message: INACTIVE_CATEGORY_MESSAGE };
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

  // Recurring generation (ARCHITECTURE §6.4): the app shell calls this after
  // unlock and on every resume; rule changes made while unlocked call it too.
  // Single-flight, and idempotent because occurrence keys block duplicates.
  const processingRecurring = useRef(false);
  const processRecurring = useCallback((): { ok: true; count: number } | { ok: false; message: string } => {
    if (processingRecurring.current) return { ok: true, count: 0 };
    processingRecurring.current = true;
    try {
      const { transactions: currentTransactions, recurringExpenses: currentRules } = latest.current;
      const plan = planRecurringGeneration(currentRules, currentTransactions, localDateStr(new Date()));
      if (Object.keys(plan.cursors).length === 0) return { ok: true, count: 0 };
      const changes: Partial<FinanceData> = {
        recurringExpenses: currentRules.map(r =>
          plan.cursors[r.id] ? { ...r, lastGeneratedMonth: plan.cursors[r.id] } : r),
      };
      if (plan.occurrences.length > 0) {
        changes.transactions = [...plan.occurrences.map(t => ({ ...t, id: createId() })), ...currentTransactions];
      }
      // Transactions and cursors are saved together; on failure nothing changes
      // and generation is retried on the next resume.
      const result = commit(changes);
      if (!result.ok) {
        const message = `Recurring expenses could not be added. ${result.message}`;
        setStorageError(message);
        return { ok: false, message };
      }
      return { ok: true, count: plan.occurrences.length };
    } finally {
      processingRecurring.current = false;
    }
  }, [commit]);

  // Re-run when rules change (add, edit, resume), but not on the first render:
  // the app shell runs the first pass once the app is unlocked.
  const rulesSeen = useRef(false);
  useEffect(() => {
    if (!rulesSeen.current) {
      rulesSeen.current = true;
      return;
    }
    processRecurring();
  }, [recurringExpenses, processRecurring]);

  // Every total below comes from lib/domain/finance-metrics (PRD §6); the
  // context only supplies the selected month and today's date.
  const getTotalIncome = useCallback((month?: string) =>
    totalIncome(transactions, month || selectedMonth), [transactions, selectedMonth]);

  const getTotalExpenses = useCallback((month?: string) =>
    totalConsumption(transactions, month || selectedMonth), [transactions, selectedMonth]);

  const getTotalSavings = useCallback((month?: string) =>
    totalSavingsContributions(transactions, month || selectedMonth), [transactions, selectedMonth]);

  const getTotalCommitments = useCallback((month?: string) =>
    totalCommitments(transactions, categories, month || selectedMonth), [transactions, categories, selectedMonth]);

  const getTotalDayToDay = useCallback((month?: string) =>
    totalDayToDay(transactions, categories, month || selectedMonth), [transactions, categories, selectedMonth]);

  const getBalance = useCallback((month?: string) =>
    monthlyNet(transactions, month || selectedMonth), [transactions, selectedMonth]);

  const getCarryForward = useCallback((month: string) => carryForward(transactions, month), [transactions]);

  const getNetBalanceToDate = useCallback(() => lifetimeBalance(transactions, localDateStr(new Date())), [transactions]);

  const getCumulativeNetBalanceThroughEndOf = useCallback(
    (month: string) => balanceThroughEndOf(transactions, month),
    [transactions],
  );

  const getOutstandingCardBalance = useCallback(() => outstandingCardAmount(transactions), [transactions]);

  const getOutstandingCardBalanceAtEndOf = useCallback(
    (month: string) => outstandingCardAmountThroughEndOf(transactions, month),
    [transactions],
  );

  const getCardBillPaymentsIn = useCallback((month: string) => cardBillPaymentsIn(transactions, month), [transactions]);

  const getExpectedBankBalanceAtEndOf = useCallback(
    (month: string) => expectedBankBalanceAtEndOf(transactions, month),
    [transactions],
  );

  const getSavingsBalanceAtEndOf = useCallback(
    (month: string) => savingsBalanceThroughEndOf(transactions, month),
    [transactions],
  );

  // A card bill payment is a transfer, not spending (PRD §6): it lowers the
  // outstanding card amount and the expected bank balance only.
  const recordCardBillPayment = useCallback((month: string, amount: number): FinanceWriteResult => {
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, message: 'Enter an amount greater than zero. Nothing was saved.' };
    }
    const owed = outstandingCardAmountThroughEndOf(latest.current.transactions, month);
    if (amount > owed + 0.005) {
      return { ok: false, message: 'That is more than the unpaid card amount. Nothing was saved.' };
    }
    const payment: Transaction = {
      id: createId(),
      type: 'expense',
      amount,
      categoryId: 'other',
      note: 'Card bill payment',
      date: lastDateOfMonth(month),
      paymentMethod: 'credit-card-payment',
    };
    return commit({ transactions: [payment, ...latest.current.transactions] });
  }, [commit]);

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
      savings?: { actualBalance: number; decreaseReason?: 'spent' | 'transfer' };
    }): { ok: true; record: MonthReconciliation } | { ok: false; message: string } => {
      const { month, actualBalance, expectedBalance, adjustmentAmount, note, savings } = input;

      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
        !Number.isFinite(actualBalance) || actualBalance < 0 ||
        !Number.isFinite(expectedBalance) ||
        (adjustmentAmount !== undefined && !Number.isFinite(adjustmentAmount))) {
        return { ok: false, message: 'Enter valid balances. Nothing was saved.' };
      }

      let savingsAdjustment: Transaction | undefined;
      if (savings) {
        if (!Number.isFinite(savings.actualBalance) || savings.actualBalance < 0) {
          return { ok: false, message: 'Enter a valid savings balance. Nothing was saved.' };
        }
        const difference = savings.actualBalance - savingsBalanceThroughEndOf(latest.current.transactions, month);
        if (!Number.isFinite(difference)) {
          return { ok: false, message: 'These balances are too large to calculate. Nothing was saved.' };
        }
        if (Math.abs(difference) >= 0.005) {
          if (difference < 0 && savings.decreaseReason !== 'spent' && savings.decreaseReason !== 'transfer') {
            return { ok: false, message: 'Choose what happened to the lower savings balance. Nothing was saved.' };
          }
          const correction = difference > 0 ? 'increase' : savings.decreaseReason;
          if (!correction) return { ok: false, message: 'Choose a savings correction. Nothing was saved.' };
          savingsAdjustment = {
            id: createId(),
            type: correction === 'increase' ? 'income' : 'expense',
            amount: Math.abs(difference),
            categoryId: '_adjustment-savings',
            note: correction === 'increase' ? 'Savings balance correction' :
              correction === 'transfer' ? 'Savings transferred to bank' : 'Savings spent or lost',
            date: lastDateOfMonth(month),
            savingsCorrection: correction,
          };
        }
        const withSavings = savingsAdjustment
          ? [savingsAdjustment, ...latest.current.transactions]
          : latest.current.transactions;
        const currentExpected = expectedBankBalanceAtEndOf(withSavings, month);
        if (!Number.isFinite(currentExpected) || !Number.isFinite(balanceThroughEndOf(withSavings, month))) {
          return { ok: false, message: 'These balances are too large to calculate. Nothing was saved.' };
        }
        if (Math.abs(currentExpected - expectedBalance) >= 0.005 ||
          (adjustmentAmount !== undefined && Math.abs(adjustmentAmount - (currentExpected - actualBalance)) >= 0.005)) {
          return { ok: false, message: 'Balances changed while reviewing. Check the amounts and try again. Nothing was saved.' };
        }
      }

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
      if (adjustment || savingsAdjustment) {
        changes.transactions = [
          ...(adjustment ? [adjustment] : []),
          ...(savingsAdjustment ? [savingsAdjustment] : []),
          ...latest.current.transactions,
        ];
      }
      const result = commit(changes);
      return result.ok ? { ok: true, record } : result;
    },
    [commit],
  );

  const getSpentForCategory = useCallback(
    (categoryId: string, month: string) => categorySpent(transactions, categoryId, month),
    [transactions],
  );

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

  const getMonthSummary = useCallback(
    (month?: string): MonthSummary => monthSummary(transactions, month || selectedMonth),
    [transactions, selectedMonth],
  );

  return (
    <FinanceContext.Provider value={{
      transactions, categories, budgets,
      recurringExpenses, savingsGoal,
      reconciliations,
      addTransaction, importTransactions, updateTransaction, deleteTransaction,
      addCategory, updateCategory, setCategoryActive, deleteCategory,
      addBudget, updateBudget, deleteBudget, transferBudgetsToMonth,
      addRecurring, updateRecurring, deleteRecurring, toggleRecurringActive,
      setSavingsGoal,
      selectedMonth, setSelectedMonth,
      isSheetOpen, editingTransaction, sheetInitialMode,
      openSheet, openEditSheet, closeSheet,
      isBudgetSheetOpen, openBudgetSheet, closeBudgetSheet,
      getTotalIncome, getTotalExpenses, getTotalSavings, getBalance, getCarryForward, getNetBalanceToDate, getCumulativeNetBalanceThroughEndOf, getOutstandingCardBalance, getOutstandingCardBalanceAtEndOf, getCardBillPaymentsIn, getExpectedBankBalanceAtEndOf, getSavingsBalanceAtEndOf, recordCardBillPayment, getReconciliationFor, addReconciliation, getSpentForCategory,
      getTotalCommitments, getTotalDayToDay, getBudgetBreakdown,
      getMonthSummary,
      reloadFromStorage, processRecurring, lastChangedAt,
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
