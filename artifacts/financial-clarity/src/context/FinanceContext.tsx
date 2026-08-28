import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Transaction, Category, Budget, RecurringExpense, SavingsGoal, SAVINGS_CATEGORY_IDS, PaymentMethod } from '@/lib/types';
import { currentMonth, localDateStr, isConsumptionExpense } from '@/lib/finance-utils';
import type { ParsedSms } from '@/lib/sms/parser/types';
import { parseSms } from '@/lib/sms/parser';
import { smsFingerprint, matchesExistingBySourceRef } from '@/lib/sms/dedup';
import { classifyMatch } from '@/lib/sms/reconcile';
import { formatSmsDescription } from '@/lib/sms/description';
import { getSmsReader } from '@/lib/sms/SmsReader';
import { SmsReaderPermissionError, SmsReaderQueryError } from '@/lib/sms/androidSmsReader';

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

  // SMS auto-import state and methods (Phase 4)
  pendingSms: ParsedSms[];
  pendingSmsCount: number;
  linkedSmsCount: number;
  lastScanMs: number;
  getLinkedTransactions: () => Transaction[];
  runSmsScan: (opts: {
    sinceDays: number;
    mode: 'first' | 'incremental';
    onProgress?: (event: {
      phase: 'reading' | 'parsing' | 'matching' | 'done';
      sender?: string;
      read: number;
      parsed: number;
      newCandidates: number;
      autoLinked: number;
    }) => void;
  }) => Promise<
    | { ok: true; newCandidates: number; autoLinked: number; needsReview: number }
    | { ok: false; reason: 'permission-denied' | 'query-failed' | 'unknown'; error?: string }
  >;
  approveSms: (fingerprints: string[]) => Promise<{ approved: number }>;
  dismissSms: (fingerprints: string[]) => void;
  linkSmsToTransaction: (fingerprint: string, existingTxnId: string) => void;
  unlinkSmsFromTransaction: (fingerprint: string) => void;
  dismissSmsBefore: (dateISO: string, onProgress?: (read: number) => void) => Promise<void>;
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

const VALID_PAYMENT_METHODS = new Set(['cash', 'bank', 'credit-card', 'credit-card-payment']);

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
    (value.paymentMethod === undefined ||
      (typeof value.paymentMethod === 'string' && VALID_PAYMENT_METHODS.has(value.paymentMethod))) &&
    (value.sourceSmsFingerprint === undefined || typeof value.sourceSmsFingerprint === 'string') &&
    (value.merchant === undefined || typeof value.merchant === 'string')
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

function isValidParsedSms(value: unknown): value is ParsedSms {
  return (
    isObject(value) &&
    typeof value.smsId === 'string' &&
    typeof value.fingerprint === 'string' &&
    typeof value.senderId === 'string' &&
    typeof value.amount === 'number' &&
    Number.isFinite(value.amount) &&
    (value.direction === 'debit' || value.direction === 'credit') &&
    (value.merchant === null || typeof value.merchant === 'string') &&
    (value.accountTail === null || typeof value.accountTail === 'string') &&
    (value.paymentMethod === 'bank' || value.paymentMethod === 'credit-card' || value.paymentMethod === 'credit-card-payment') &&
    (value.txnRef === null || typeof value.txnRef === 'string') &&
    typeof value.timestamp === 'number' &&
    typeof value.dateISO === 'string' &&
    (value.suggestedCategoryId === null || typeof value.suggestedCategoryId === 'string') &&
    typeof value.reason === 'string' &&
    typeof value.rawBody === 'string'
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

function loadNumberFromStorage(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(getStorageKey(key));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function loadStringArrayFromStorage(key: string, fallback: string[]): string[] {
  try {
    const raw = localStorage.getItem(getStorageKey(key));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    return parsed.every((item): item is string => typeof item === 'string') ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function loadSmsMapFromStorage(key: string): Record<string, ParsedSms> {
  try {
    const raw = localStorage.getItem(getStorageKey(key));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!isObject(parsed)) return {};
    const valid: Record<string, ParsedSms> = {};
    for (const [fingerprint, value] of Object.entries(parsed)) {
      if (typeof fingerprint === 'string' && isValidParsedSms(value)) {
        valid[fingerprint] = value;
      }
    }
    return valid;
  } catch {
    return {};
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

  // SMS auto-import state (Phase 4)
  const [pendingSms, setPendingSms] = useState<ParsedSms[]>(() =>
    loadArrayFromStorage('sms-pending', [], isValidParsedSms)
  );
  const [dismissedSmsFingerprints, setDismissedSmsFingerprints] = useState<Set<string>>(() =>
    new Set(loadStringArrayFromStorage('sms-dismissed', []))
  );
  const [linkedSms, setLinkedSms] = useState<Record<string, ParsedSms>>(() =>
    loadSmsMapFromStorage('sms-linked')
  );
  const [lastScanMs, setLastScanMs] = useState<number>(() =>
    loadNumberFromStorage('sms-last-scan', 0)
  );

  useEffect(() => { saveToStorage('transactions', transactions); setLastChangedAt(Date.now()); }, [transactions]);
  useEffect(() => { saveToStorage('categories', categories); setLastChangedAt(Date.now()); }, [categories]);
  useEffect(() => { saveToStorage('budgets', budgets); setLastChangedAt(Date.now()); }, [budgets]);
  useEffect(() => { saveToStorage('recurring', recurringExpenses); setLastChangedAt(Date.now()); }, [recurringExpenses]);
  useEffect(() => {
    try { localStorage.setItem(getStorageKey('savings-goal'), JSON.stringify(savingsGoal)); } catch { /* ignore */ }
    setLastChangedAt(Date.now());
  }, [savingsGoal]);

  // Persist SMS state (Phase 4)
  useEffect(() => { saveToStorage('sms-pending', pendingSms); }, [pendingSms]);
  useEffect(() => { saveToStorage('sms-dismissed', Array.from(dismissedSmsFingerprints)); }, [dismissedSmsFingerprints]);
  useEffect(() => { saveToStorage('sms-linked', linkedSms); }, [linkedSms]);
  useEffect(() => { saveToStorage('sms-last-scan', lastScanMs); }, [lastScanMs]);

  // Garbage-collect linkedSms: drop entries whose transaction no longer exists (Phase 4)
  useEffect(() => {
    const txnFingerprints = new Set(
      transactions.filter(t => t.sourceSmsFingerprint).map(t => t.sourceSmsFingerprint!)
    );
    const cleanedLinked: Record<string, ParsedSms> = {};
    let changed = false;
    for (const [fp, parsed] of Object.entries(linkedSms)) {
      if (txnFingerprints.has(fp)) {
        cleanedLinked[fp] = parsed;
      } else {
        changed = true;
      }
    }
    if (changed) {
      setLinkedSms(cleanedLinked);
    }
  }, [transactions, linkedSms]);

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

  // ========== SMS auto-import methods (Phase 4) ==========

  const runSmsScan = useCallback(
    async (opts: {
      sinceDays: number;
      mode: 'first' | 'incremental';
      onProgress?: (event: {
        phase: 'reading' | 'parsing' | 'matching' | 'done';
        sender?: string;
        read: number;
        parsed: number;
        newCandidates: number;
        autoLinked: number;
      }) => void;
    }) => {
      const reader = getSmsReader();
      const now = Date.now();

      // Check and request permission
      try {
        const hasPermission = await reader.hasPermission();
        if (!hasPermission) {
          const state = await reader.requestPermission();
          if (state !== 'granted') {
            return { ok: false as const, reason: 'permission-denied' as const };
          }
        }
      } catch (error) {
        if (error instanceof SmsReaderPermissionError) {
          return { ok: false as const, reason: 'permission-denied' as const, error: error.message };
        }
        return { ok: false as const, reason: 'unknown' as const, error: String(error) };
      }

      // Compute time range
      const sinceMs =
        opts.mode === 'incremental'
          ? Math.max(lastScanMs, now - opts.sinceDays * 86400000)
          : now - opts.sinceDays * 86400000;

      // Read inbox
      opts.onProgress?.({ phase: 'reading', read: 0, parsed: 0, newCandidates: 0, autoLinked: 0 });
      let messages;
      try {
        messages = await reader.readMessages(sinceMs, now);
      } catch (error) {
        if (error instanceof SmsReaderPermissionError) {
          return { ok: false as const, reason: 'permission-denied' as const, error: error.message };
        }
        if (error instanceof SmsReaderQueryError) {
          return { ok: false as const, reason: 'query-failed' as const, error: error.message };
        }
        return { ok: false as const, reason: 'unknown' as const, error: String(error) };
      }

      let read = 0;
      let parsed = 0;
      let newCandidates = 0;
      let autoLinked = 0;
      const newPending: ParsedSms[] = [];

      for (const msg of messages) {
        read++;

        // Batch progress updates every 10 messages
        if (read % 10 === 0 || read === messages.length) {
          opts.onProgress?.({
            phase: 'parsing',
            sender: msg.sender,
            read,
            parsed,
            newCandidates,
            autoLinked,
          });
        }

        // Compute fingerprint
        const fingerprint = await smsFingerprint(msg);

        // Tier-1 skip: dismissed
        if (dismissedSmsFingerprints.has(fingerprint)) continue;

        // Tier-2 skip: already linked to a transaction
        if (transactions.some(t => t.sourceSmsFingerprint === fingerprint)) continue;

        // Parse
        const parsedSms = await parseSms(msg);
        if (!parsedSms) continue;

        parsed++;

        // On first scan only: attempt auto-link
        if (opts.mode === 'first') {
          const match = classifyMatch(parsedSms, transactions);
          if (match.kind === 'high' && match.existingId) {
            // Auto-link
            opts.onProgress?.({
              phase: 'matching',
              sender: msg.sender,
              read,
              parsed,
              newCandidates,
              autoLinked,
            });

            const existingTx = transactions.find(t => t.id === match.existingId);
            if (existingTx) {
              // Update the transaction
              const updates: Omit<Transaction, 'id'> = {
                ...existingTx,
                sourceSmsFingerprint: parsedSms.fingerprint,
              };
              if (!existingTx.paymentMethod) {
                updates.paymentMethod = parsedSms.paymentMethod;
              }
              if (!existingTx.merchant && parsedSms.merchant) {
                updates.merchant = parsedSms.merchant;
              }
              updateTransaction(existingTx.id, updates);

              // Store in linkedSms for potential unlink
              setLinkedSms(prev => ({ ...prev, [parsedSms.fingerprint]: parsedSms }));

              autoLinked++;
              continue;
            }
          }
        }

        // Add to pending
        newPending.push(parsedSms);
        newCandidates++;
      }

      // Merge new pending with existing
      setPendingSms(prev => [...newPending, ...prev]);
      setLastScanMs(now);

      opts.onProgress?.({ phase: 'done', read, parsed, newCandidates, autoLinked });

      return {
        ok: true as const,
        newCandidates,
        autoLinked,
        needsReview: newPending.length + pendingSms.length,
      };
    },
    [transactions, pendingSms, dismissedSmsFingerprints, lastScanMs, updateTransaction]
  );

  const approveSms = useCallback(
    async (fingerprints: string[]) => {
      const toApprove = pendingSms.filter(p => fingerprints.includes(p.fingerprint));
      const newTransactions: Transaction[] = [];

      for (const parsed of toApprove) {
        const tx: Transaction = {
          id: createId(),
          type: parsed.direction === 'credit' ? 'income' : 'expense',
          amount: parsed.amount,
          categoryId: parsed.suggestedCategoryId || 'leisure', // fallback to leisure if no suggestion
          note: formatSmsDescription(parsed),
          date: parsed.dateISO,
          paymentMethod: parsed.paymentMethod,
          merchant: parsed.merchant ?? undefined,
          sourceSmsFingerprint: parsed.fingerprint,
        };
        newTransactions.push(tx);
      }

      // Add all transactions at once
      setTransactions(prev => [...newTransactions, ...prev]);

      // Remove from pending
      setPendingSms(prev => prev.filter(p => !fingerprints.includes(p.fingerprint)));

      return { approved: newTransactions.length };
    },
    [pendingSms]
  );

  const dismissSms = useCallback((fingerprints: string[]) => {
    setDismissedSmsFingerprints(prev => {
      const next = new Set(prev);
      fingerprints.forEach(fp => next.add(fp));
      return next;
    });
    setPendingSms(prev => prev.filter(p => !fingerprints.includes(p.fingerprint)));
  }, []);

  const linkSmsToTransaction = useCallback(
    (fingerprint: string, existingTxnId: string) => {
      const parsed = pendingSms.find(p => p.fingerprint === fingerprint);
      if (!parsed) return;

      const existingTx = transactions.find(t => t.id === existingTxnId);
      if (!existingTx) return;

      // Update transaction
      const updates: Omit<Transaction, 'id'> = {
        ...existingTx,
        sourceSmsFingerprint: fingerprint,
      };
      if (!existingTx.paymentMethod) {
        updates.paymentMethod = parsed.paymentMethod;
      }
      if (!existingTx.merchant && parsed.merchant) {
        updates.merchant = parsed.merchant;
      }
      updateTransaction(existingTxnId, updates);

      // Store in linkedSms
      setLinkedSms(prev => ({ ...prev, [fingerprint]: parsed }));

      // Remove from pending
      setPendingSms(prev => prev.filter(p => p.fingerprint !== fingerprint));
    },
    [pendingSms, transactions, updateTransaction]
  );

  const unlinkSmsFromTransaction = useCallback(
    (fingerprint: string) => {
      const linked = linkedSms[fingerprint];
      if (!linked) return;

      const tx = transactions.find(t => t.sourceSmsFingerprint === fingerprint);
      if (tx) {
        const updates: Omit<Transaction, 'id'> = {
          ...tx,
          sourceSmsFingerprint: undefined,
        };
        updateTransaction(tx.id, updates);
      }

      // Move back to pending
      setPendingSms(prev => [linked, ...prev]);

      // Remove from linkedSms
      setLinkedSms(prev => {
        const next = { ...prev };
        delete next[fingerprint];
        return next;
      });
    },
    [linkedSms, transactions, updateTransaction]
  );

  const dismissSmsBefore = useCallback(
    async (dateISO: string, onProgress?: (read: number) => void) => {
      const reader = getSmsReader();
      try {
        const messages = await reader.readMessages(0, Date.now());
        const toDismiss: string[] = [];

        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          if (i % 50 === 0) {
            onProgress?.(i);
          }

          const fingerprint = await smsFingerprint(msg);
          const parsedSms = await parseSms(msg);

          if (parsedSms && parsedSms.dateISO < dateISO) {
            toDismiss.push(fingerprint);
          }
        }

        // Add to dismissed set
        setDismissedSmsFingerprints(prev => {
          const next = new Set(prev);
          toDismiss.forEach(fp => next.add(fp));
          return next;
        });

        // Remove from pending
        setPendingSms(prev => prev.filter(p => !toDismiss.includes(p.fingerprint)));

        onProgress?.(messages.length);
      } catch {
        // Ignore errors — if we can't read the inbox, we can't dismiss
      }
    },
    []
  );

  const getLinkedTransactions = useCallback(() => {
    return transactions.filter(t => t.sourceSmsFingerprint);
  }, [transactions]);

  const pendingSmsCount = pendingSms.length;
  const linkedSmsCount = Object.keys(linkedSms).length;

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
      // SMS auto-import (Phase 4)
      pendingSms, pendingSmsCount, linkedSmsCount, lastScanMs,
      getLinkedTransactions,
      runSmsScan, approveSms, dismissSms,
      linkSmsToTransaction, unlinkSmsFromTransaction, dismissSmsBefore,
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
