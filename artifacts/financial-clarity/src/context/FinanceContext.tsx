import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Transaction, Category, Budget, RecurringExpense, SavingsGoal, SAVINGS_CATEGORY_IDS } from '@/lib/types';
import { currentMonth, localDateStr, isConsumptionExpense } from '@/lib/finance-utils';

const SAVINGS_CATEGORY_ID_SET: ReadonlySet<string> = new Set(SAVINGS_CATEGORY_IDS);

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
];

/** Ensure both hardcoded savings categories exist in the array and have type='savings'. */
function ensureSavingsCategories(list: Category[]): Category[] {
  const byId = new Map(list.map(c => [c.id, c] as const));
  let mutated = false;
  for (const seed of SAVINGS_DEFAULTS) {
    const existing = byId.get(seed.id);
    if (!existing) {
      byId.set(seed.id, { ...seed });
      mutated = true;
    } else if (existing.type !== 'savings') {
      byId.set(seed.id, { ...existing, type: 'savings' });
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
  for (const seed of SAVINGS_DEFAULTS) {
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
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  importTransactions: (items: Omit<Transaction, 'id'>[]) => number;
  updateTransaction: (id: string, updates: Omit<Transaction, 'id'>) => void;
  deleteTransaction: (id: string) => void;
  addCategory: (c: Omit<Category, 'id'>) => Category;
  updateCategory: (id: string, updates: Omit<Category, 'id'>) => void;
  deleteCategory: (id: string) => void;
  addBudget: (b: Omit<Budget, 'id'>) => void;
  updateBudget: (id: string, limit: number) => void;
  deleteBudget: (id: string) => void;
  transferBudgetsToMonth: (fromMonth: string, toMonth: string) => number;
  addRecurring: (r: Omit<RecurringExpense, 'id' | 'lastGeneratedMonth'>) => void;
  updateRecurring: (id: string, updates: Omit<RecurringExpense, 'id'>) => void;
  deleteRecurring: (id: string) => void;
  toggleRecurringActive: (id: string) => void;
  setSavingsGoal: (goal: SavingsGoal) => void;
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  isSheetOpen: boolean;
  editingTransaction: Transaction | null;
  openSheet: () => void;
  openEditSheet: (t: Transaction) => void;
  closeSheet: () => void;
  getTotalIncome: (month?: string) => number;
  getTotalExpenses: (month?: string) => number;
  getTotalSavings: (month?: string) => number;
  getBalance: (month?: string) => number;
  getCarryForward: (month: string) => number;
  /** Total cash in pocket through today — month-agnostic. Sum of all
   * income minus all expenses (savings transfers included as outflow)
   * for transactions with date <= today. Future-dated transactions are
   * excluded so planned/recurring future txns don't change pocket cash. */
  getNetBalanceToDate: () => number;
  getSpentForCategory: (categoryId: string, month: string) => number;
  /** Canonical per-month summary — use this from all screens. */
  getMonthSummary: (month?: string) => MonthSummary;
  /** Re-reads all entities from localStorage. Used after a Drive restore. */
  reloadFromStorage: () => void;
  /** Monotonic timestamp bumped on every mutation; consumed by auto-backup. */
  lastChangedAt: number;
}

const FinanceContext = createContext<FinanceContextType | null>(null);
const skippedInitialStorageWrites = new Set<string>();

function getStorageKey(key: string) {
  return `financial-clarity:${key}`;
}

function getBackupStorageKey(key: string) {
  return `financial-clarity:backup:${key}:${Date.now()}`;
}

function preserveRawStorage(key: string, raw: string): void {
  try {
    localStorage.setItem(getBackupStorageKey(key), raw);
  } catch {
    // ignore
  }
  skippedInitialStorageWrites.add(key);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidTransaction(value: unknown): value is Transaction {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    (value.type === 'income' || value.type === 'expense') &&
    typeof value.amount === 'number' &&
    Number.isFinite(value.amount) &&
    typeof value.categoryId === 'string' &&
    value.categoryId.length > 0 &&
    (value.note === undefined || typeof value.note === 'string') &&
    typeof value.date === 'string' &&
    value.date.length > 0 &&
    (value.paymentMethod === undefined || typeof value.paymentMethod === 'string')
  );
}

function isValidCategory(value: unknown): value is Category {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    typeof value.icon === 'string' &&
    typeof value.color === 'string' &&
    (value.type === 'income' || value.type === 'expense' || value.type === 'commitment' || value.type === 'savings' || value.type === 'both')
  );
}

function isValidBudget(value: unknown): value is Budget {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.categoryId === 'string' &&
    value.categoryId.length > 0 &&
    typeof value.limit === 'number' &&
    Number.isFinite(value.limit) &&
    (value.month === undefined || typeof value.month === 'string')
  );
}

function isValidRecurring(value: unknown): value is RecurringExpense {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.description === 'string' &&
    typeof value.amount === 'number' &&
    Number.isFinite(value.amount) &&
    typeof value.categoryId === 'string' &&
    value.categoryId.length > 0 &&
    typeof value.dayOfMonth === 'number' &&
    value.dayOfMonth >= 1 &&
    value.dayOfMonth <= 31 &&
    typeof value.active === 'boolean' &&
    typeof value.startMonth === 'string' &&
    (value.lastGeneratedMonth === undefined || typeof value.lastGeneratedMonth === 'string')
  );
}

function loadArrayFromStorage<T>(key: string, fallback: T[], isValid: (value: unknown) => value is T): T[] {
  try {
    const raw = localStorage.getItem(getStorageKey(key));
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      preserveRawStorage(key, raw);
      return fallback;
    }
    const filtered = parsed.filter(isValid);
    if (filtered.length !== parsed.length) {
      preserveRawStorage(key, raw);
    }
    return filtered;
  } catch {
    try {
      const raw = localStorage.getItem(getStorageKey(key));
      if (raw) preserveRawStorage(key, raw);
    } catch {
      // ignore
    }
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    if (skippedInitialStorageWrites.has(key)) {
      skippedInitialStorageWrites.delete(key);
      return;
    }
    localStorage.setItem(getStorageKey(key), JSON.stringify(value));
  } catch {
    // ignore
  }
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function addOneMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    loadArrayFromStorage('transactions', [], isValidTransaction).map(t => ({ ...t, note: t.note || '' }))
  );
  const [categories, setCategories] = useState<Category[]>(() => {
    const stored = loadArrayFromStorage('categories', [], isValidCategory);
    if (stored.length === 0) return DEFAULT_CATEGORIES;
    return ensureSavingsCategories(stored);
  });
  const [budgets, setBudgets] = useState<Budget[]>(() =>
    loadArrayFromStorage('budgets', [], isValidBudget).map(b => ({ ...b, month: b.month || currentMonth() }))
  );
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>(() =>
    loadArrayFromStorage('recurring', [], isValidRecurring)
  );
  const [savingsGoal, setSavingsGoalState] = useState<SavingsGoal>(() => {
    const empty: SavingsGoal = { goal: { monthly: 0, annual: 0 }, emergency: { monthly: 0, annual: 0 } };
    const validEntry = (v: unknown): v is { monthly: number; annual: number; createdAt?: string } =>
      isObject(v) && typeof v.monthly === 'number' && Number.isFinite(v.monthly)
      && typeof v.annual === 'number' && Number.isFinite(v.annual)
      && (v.createdAt === undefined || typeof v.createdAt === 'string');
    const pickEntry = (v: unknown) => {
      if (!validEntry(v)) return { monthly: 0, annual: 0 };
      const out: { monthly: number; annual: number; createdAt?: string } = { monthly: v.monthly, annual: v.annual };
      if (v.createdAt) out.createdAt = v.createdAt;
      return out;
    };
    try {
      const raw = localStorage.getItem(getStorageKey('savings-goal'));
      if (!raw) return empty;
      const parsed = JSON.parse(raw) as unknown;
      if (!isObject(parsed)) return empty;
      // New shape
      if (validEntry(parsed.goal) || validEntry(parsed.emergency)) {
        return {
          goal: pickEntry(parsed.goal),
          emergency: pickEntry(parsed.emergency),
        };
      }
      // Legacy shape { monthly, annual } -> migrate into `goal`.
      if (validEntry(parsed)) {
        return { goal: pickEntry(parsed), emergency: { monthly: 0, annual: 0 } };
      }
      return empty;
    } catch {
      return empty;
    }
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [lastChangedAt, setLastChangedAt] = useState<number>(0);

  useEffect(() => { saveToStorage('transactions', transactions); setLastChangedAt(Date.now()); }, [transactions]);
  useEffect(() => { saveToStorage('categories', categories); setLastChangedAt(Date.now()); }, [categories]);
  useEffect(() => { saveToStorage('budgets', budgets); setLastChangedAt(Date.now()); }, [budgets]);
  useEffect(() => { saveToStorage('recurring', recurringExpenses); setLastChangedAt(Date.now()); }, [recurringExpenses]);
  useEffect(() => {
    try { localStorage.setItem(getStorageKey('savings-goal'), JSON.stringify(savingsGoal)); } catch { /* ignore */ }
    setLastChangedAt(Date.now());
  }, [savingsGoal]);

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
    setSavingsGoalState(prev => ({
      goal: needsBackfill(prev.goal) ? { ...prev.goal, createdAt: earliestFor('savings-goal') } : prev.goal,
      emergency: needsBackfill(prev.emergency) ? { ...prev.emergency, createdAt: earliestFor('savings-emergency') } : prev.emergency,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addTransaction = useCallback((t: Omit<Transaction, 'id'>) => {
    setTransactions(prev => [{ ...t, id: createId() }, ...prev]);
  }, []);

  const importTransactions = useCallback((items: Omit<Transaction, 'id'>[]) => {
    if (items.length === 0) return 0;
    setTransactions(prev => [
      ...items.map(t => ({ ...t, id: createId() })),
      ...prev,
    ]);
    return items.length;
  }, []);

  const updateTransaction = useCallback((id: string, updates: Omit<Transaction, 'id'>) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...updates, id } : t));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  }, []);

  const addCategory = useCallback((c: Omit<Category, 'id'>): Category => {
    // Savings type is reserved for the two hardcoded categories.
    const safeType: Category['type'] = c.type === 'savings' ? 'expense' : c.type;
    const newCat: Category = { ...c, type: safeType, id: createId() };
    setCategories(prev => [...prev, newCat]);
    return newCat;
  }, []);

  const updateCategory = useCallback((id: string, updates: Omit<Category, 'id'>) => {
    setCategories(prev => prev.map(c => {
      if (c.id !== id) return c;
      // For hardcoded savings categories, force type='savings' to preserve invariant.
      if (SAVINGS_CATEGORY_ID_SET.has(id)) {
        return { ...updates, type: 'savings', id };
      }
      // Disallow promoting a non-savings category to 'savings' via update.
      const safeType: Category['type'] = updates.type === 'savings' ? c.type : updates.type;
      return { ...updates, type: safeType, id };
    }));
  }, []);

  const deleteCategory = useCallback((id: string) => {
    if (SAVINGS_CATEGORY_ID_SET.has(id)) return; // hardcoded; cannot delete
    setCategories(prev => prev.filter(c => c.id !== id));
    setBudgets(prev => prev.filter(b => b.categoryId !== id));
  }, []);

  const addBudget = useCallback((b: Omit<Budget, 'id'>) => {
    setBudgets(prev => {
      const month = b.month || selectedMonth;
      const existing = prev.find(x => x.categoryId === b.categoryId && x.month === month);
      if (existing) {
        return prev.map(x => x.id === existing.id ? { ...x, limit: b.limit, month } : x);
      }
      return [...prev, { ...b, month, id: createId() }];
    });
  }, [selectedMonth]);

  const updateBudget = useCallback((id: string, limit: number) => {
    setBudgets(prev => prev.map(b => b.id === id ? { ...b, limit } : b));
  }, []);

  const deleteBudget = useCallback((id: string) => {
    setBudgets(prev => prev.filter(b => b.id !== id));
  }, []);

  const transferBudgetsToMonth = useCallback((fromMonth: string, toMonth: string) => {
    if (fromMonth === toMonth) return 0;

    const sourceBudgets = budgets.filter(b => b.month === fromMonth);
    if (sourceBudgets.length === 0) return 0;

    setBudgets(prev => {
      const next = [...prev];
      sourceBudgets.forEach(source => {
        const existingIndex = next.findIndex(b => b.month === toMonth && b.categoryId === source.categoryId);
        if (existingIndex >= 0) {
          next[existingIndex] = { ...next[existingIndex], limit: source.limit, month: toMonth };
        } else {
          next.push({
            id: createId(),
            categoryId: source.categoryId,
            limit: source.limit,
            month: toMonth,
          });
        }
      });

      return next;
    });

    return sourceBudgets.length;
  }, [budgets]);

  const openSheet = useCallback(() => {
    setEditingTransaction(null);
    setIsSheetOpen(true);
  }, []);

  const openEditSheet = useCallback((t: Transaction) => {
    setEditingTransaction(t);
    setIsSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setIsSheetOpen(false);
    setEditingTransaction(null);
  }, []);

  const addRecurring = useCallback((r: Omit<RecurringExpense, 'id' | 'lastGeneratedMonth'>) => {
    setRecurringExpenses(prev => [...prev, { ...r, id: createId() }]);
  }, []);

  const updateRecurring = useCallback((id: string, updates: Omit<RecurringExpense, 'id'>) => {
    setRecurringExpenses(prev => prev.map(r => r.id === id ? { ...updates, id } : r));
  }, []);

  const deleteRecurring = useCallback((id: string) => {
    setRecurringExpenses(prev => prev.filter(r => r.id !== id));
  }, []);

  const toggleRecurringActive = useCallback((id: string) => {
    setRecurringExpenses(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));
  }, []);

  const setSavingsGoal = useCallback((goal: SavingsGoal) => {
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
    setSavingsGoalState(prev => ({
      goal: stamp(goal.goal, prev.goal),
      emergency: stamp(goal.emergency, prev.emergency),
    }));
  }, []);

  const reloadFromStorage = useCallback(() => {
    // Re-read all five entities from localStorage. Used after a Drive restore.
    const txns = loadArrayFromStorage('transactions', [], isValidTransaction).map(t => ({ ...t, note: t.note || '' }));
    setTransactions(txns);

    const storedCats = loadArrayFromStorage('categories', [], isValidCategory);
    setCategories(storedCats.length === 0 ? DEFAULT_CATEGORIES : ensureSavingsCategories(storedCats));

    const storedBudgets = loadArrayFromStorage('budgets', [], isValidBudget).map(b => ({ ...b, month: b.month || currentMonth() }));
    setBudgets(storedBudgets);

    setRecurringExpenses(loadArrayFromStorage('recurring', [], isValidRecurring));

    try {
      const raw = localStorage.getItem(getStorageKey('savings-goal'));
      const empty: SavingsGoal = { goal: { monthly: 0, annual: 0 }, emergency: { monthly: 0, annual: 0 } };
      if (!raw) {
        setSavingsGoalState(empty);
      } else {
        const parsed = JSON.parse(raw) as unknown;
        const validEntry = (v: unknown): v is { monthly: number; annual: number; createdAt?: string } =>
          isObject(v) && typeof v.monthly === 'number' && Number.isFinite(v.monthly)
          && typeof v.annual === 'number' && Number.isFinite(v.annual)
          && (v.createdAt === undefined || typeof v.createdAt === 'string');
        const pickEntry = (v: unknown) => {
          if (!validEntry(v)) return { monthly: 0, annual: 0 };
          const out: { monthly: number; annual: number; createdAt?: string } = { monthly: v.monthly, annual: v.annual };
          if (v.createdAt) out.createdAt = v.createdAt;
          return out;
        };
        if (isObject(parsed) && (validEntry(parsed.goal) || validEntry(parsed.emergency))) {
          setSavingsGoalState({
            goal: pickEntry(parsed.goal),
            emergency: pickEntry(parsed.emergency),
          });
        } else if (isObject(parsed) && validEntry(parsed)) {
          setSavingsGoalState({ goal: pickEntry(parsed), emergency: { monthly: 0, annual: 0 } });
        } else {
          setSavingsGoalState(empty);
        }
      }
    } catch {
      // ignore
    }
    setLastChangedAt(Date.now());
  }, []);

  // Recurring materializer: for each active recurring expense, generate one
  // transaction per month from startMonth..currentMonth that hasn't been generated yet.
  // For the CURRENT month, we wait until today's date reaches the rule's dayOfMonth
  // before stamping. Future months are never materialized here.
  useEffect(() => {
    const cur = currentMonth();
    const todayDay = new Date().getDate();
    const pending: { recurringId: string; lastMonth: string; newTx: Omit<Transaction, 'id'>[] }[] = [];

    recurringExpenses.forEach(r => {
      if (!r.active) return;
      if (!r.startMonth || r.startMonth > cur) return;

      const startFrom = r.lastGeneratedMonth && r.lastGeneratedMonth >= r.startMonth
        ? addOneMonth(r.lastGeneratedMonth)
        : r.startMonth;
      if (startFrom > cur) return;

      const monthsToGenerate: string[] = [];
      let m = startFrom;
      while (m <= cur) {
        // Current month: only materialize once today has reached the rule's day-of-month.
        if (m === cur && todayDay < r.dayOfMonth) break;
        monthsToGenerate.push(m);
        m = addOneMonth(m);
      }
      if (monthsToGenerate.length === 0) return;

      const newTx: Omit<Transaction, 'id'>[] = [];
      monthsToGenerate.forEach(monthKey => {
        const [y, mm] = monthKey.split('-').map(Number);
        const daysInMonth = new Date(y, mm, 0).getDate();
        const day = Math.min(r.dayOfMonth, daysInMonth);
        const date = `${monthKey}-${String(day).padStart(2, '0')}`;
        const note = r.description;

        // Dedupe: skip if same description+amount already exists in this month
        const exists = transactions.some(t =>
          t.type === 'expense' &&
          t.date.startsWith(monthKey) &&
          t.amount === r.amount &&
          (t.note || '').trim().toLowerCase() === note.trim().toLowerCase() &&
          t.categoryId === r.categoryId
        );
        if (exists) return;

        newTx.push({ type: 'expense', amount: r.amount, categoryId: r.categoryId, note, date });
      });

      pending.push({ recurringId: r.id, lastMonth: monthsToGenerate[monthsToGenerate.length - 1], newTx });
    });

    if (pending.length === 0) return;

    const allNew: Transaction[] = pending.flatMap(p => p.newTx.map(t => ({ ...t, id: createId() })));
    if (allNew.length > 0) {
      setTransactions(prev => [...allNew, ...prev]);
    }
    setRecurringExpenses(prev => prev.map(r => {
      const match = pending.find(p => p.recurringId === r.id);
      return match ? { ...r, lastGeneratedMonth: match.lastMonth } : r;
    }));
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

  const getBalance = useCallback((month?: string) => {
    return getTotalIncome(month) - getTotalExpenses(month) - getTotalSavings(month);
  }, [getTotalIncome, getTotalExpenses, getTotalSavings]);

  // Carry forward = cumulative balance of all months BEFORE the given month
  const getCarryForward = useCallback((month: string) => {
    const prevTransactions = transactions.filter(t => t.date < month);
    const income = prevTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = prevTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return income - expenses;
  }, [transactions]);

  // Total pocket cash through today, ignoring the selected month.
  // Future-dated transactions are excluded so projections don't move the number.
  const getNetBalanceToDate = useCallback(() => {
    const todayStr = localDateStr(new Date());
    let income = 0;
    let outflow = 0;
    for (const t of transactions) {
      if (t.date > todayStr) continue;
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') outflow += t.amount; // savings count as outflow
    }
    return income - outflow;
  }, [transactions]);

  const getSpentForCategory = useCallback((categoryId: string, month: string) => {
    return transactions
      .filter(t => t.type === 'expense' && t.categoryId === categoryId && t.date.startsWith(month))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

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
      addTransaction, importTransactions, updateTransaction, deleteTransaction,
      addCategory, updateCategory, deleteCategory,
      addBudget, updateBudget, deleteBudget, transferBudgetsToMonth,
      addRecurring, updateRecurring, deleteRecurring, toggleRecurringActive,
      setSavingsGoal,
      selectedMonth, setSelectedMonth,
      isSheetOpen, editingTransaction,
      openSheet, openEditSheet, closeSheet,
      getTotalIncome, getTotalExpenses, getTotalSavings, getBalance, getCarryForward, getNetBalanceToDate, getSpentForCategory,
      getMonthSummary,
      reloadFromStorage, lastChangedAt,
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
