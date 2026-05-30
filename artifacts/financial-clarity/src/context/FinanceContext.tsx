import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  Transaction,
  Category,
  Budget,
  RecurringEntry,
  SecuritySettings,
  BackupManifest,
} from '@/lib/types';
import { currentMonth, localDateStr } from '@/lib/finance-utils';
import { createPinHash, decryptPayload, encryptPayload, verifyPin } from '@/lib/security';
import {
  backupStorageKey,
  getOrCreateDeviceSecret,
  loadEncryptedObject,
  removeStorageKeys,
  saveEncryptedObject,
  storageKey,
} from '@/lib/secure-storage';

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
];

const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  appLockEnabled: false,
  biometricEnabled: false,
  lockTimeoutMinutes: 5,
  pinHash: '',
  pinSalt: '',
  lastUnlockAt: null,
  failedAttempts: 0,
};

const SECURE_FINANCE_KEY = 'secure-finance-v1';
const LEGACY_KEYS = ['transactions', 'categories', 'budgets', 'recurringEntries', 'securitySettings'];

interface FinancePayload {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  recurringEntries: RecurringEntry[];
  securitySettings: SecuritySettings;
}

interface FinanceContextType {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  recurringEntries: RecurringEntry[];
  securitySettings: SecuritySettings;
  hasHydrated: boolean;
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
  addRecurringEntry: (entry: Omit<RecurringEntry, 'id' | 'generatedCycles'>) => RecurringEntry;
  updateRecurringEntry: (id: string, updates: Omit<RecurringEntry, 'id' | 'generatedCycles'>) => void;
  deleteRecurringEntry: (id: string) => void;
  toggleRecurringEntry: (id: string, enabled: boolean) => void;
  updateSecuritySettings: (updates: Partial<SecuritySettings>) => void;
  setSecurityPin: (pin: string) => Promise<void>;
  clearSecurityPin: () => void;
  verifySecurityPin: (pin: string) => Promise<boolean>;
  markSecurityUnlocked: () => void;
  buildEncryptedBackup: () => Promise<BackupManifest>;
  restoreEncryptedBackup: (manifest: BackupManifest, mode: 'merge' | 'replace') => Promise<void>;
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  isSheetOpen: boolean;
  editingTransaction: Transaction | null;
  openSheet: () => void;
  openEditSheet: (t: Transaction) => void;
  closeSheet: () => void;
  getTotalIncome: (month?: string) => number;
  getTotalExpenses: (month?: string) => number;
  getBalance: (month?: string) => number;
  getCarryForward: (month: string) => number;
  getSpentForCategory: (categoryId: string, month: string) => number;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

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
    value.date.length > 0
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
    (value.type === 'income' || value.type === 'expense' || value.type === 'both')
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

function isValidRecurringEntry(value: unknown): value is RecurringEntry {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    (value.type === 'income' || value.type === 'expense') &&
    typeof value.amount === 'number' &&
    Number.isFinite(value.amount) &&
    value.amount > 0 &&
    typeof value.categoryId === 'string' &&
    value.categoryId.length > 0 &&
    typeof value.startDate === 'string' &&
    value.startDate.length > 0 &&
    (value.description === undefined || typeof value.description === 'string') &&
    value.frequency === 'monthly' &&
    typeof value.enabled === 'boolean' &&
    Array.isArray(value.generatedCycles) &&
    value.generatedCycles.every(cycle => typeof cycle === 'string' && cycle.length === 7)
  );
}

function isValidSecuritySettings(value: unknown): value is SecuritySettings {
  return (
    isObject(value) &&
    typeof value.appLockEnabled === 'boolean' &&
    typeof value.biometricEnabled === 'boolean' &&
    typeof value.lockTimeoutMinutes === 'number' &&
    Number.isFinite(value.lockTimeoutMinutes) &&
    value.lockTimeoutMinutes > 0 &&
    typeof value.pinHash === 'string' &&
    typeof value.pinSalt === 'string' &&
    (value.lastUnlockAt === null || typeof value.lastUnlockAt === 'string') &&
    typeof value.failedAttempts === 'number' &&
    Number.isFinite(value.failedAttempts)
  );
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function preserveRawStorage(key: string, raw: string): void {
  try {
    localStorage.setItem(backupStorageKey(key), raw);
  } catch {
    // ignore
  }
}

function loadLegacyArray<T>(key: string, fallback: T[], isValid: (value: unknown) => value is T): T[] {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      preserveRawStorage(key, raw);
      return fallback;
    }
    const filtered = parsed.filter(isValid);
    if (filtered.length !== parsed.length) preserveRawStorage(key, raw);
    return filtered;
  } catch {
    return fallback;
  }
}

function loadLegacyObject<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!isValid(parsed)) {
      preserveRawStorage(key, raw);
      return fallback;
    }
    return parsed;
  } catch {
    return fallback;
  }
}

function parseMonthKey(key: string): { year: number; month: number } | null {
  const [yearText, monthText] = key.split('-');
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, month };
}

function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthKeyFromDateString(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function getMonthKeysInclusive(startMonthKey: string, endMonthKey: string): string[] {
  const start = parseMonthKey(startMonthKey);
  const end = parseMonthKey(endMonthKey);
  if (!start || !end) return [];
  const startIndex = start.year * 12 + (start.month - 1);
  const endIndex = end.year * 12 + (end.month - 1);
  if (startIndex > endIndex) return [];

  const keys: string[] = [];
  for (let index = startIndex; index <= endIndex; index += 1) {
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    keys.push(`${year}-${String(month).padStart(2, '0')}`);
  }
  return keys;
}

function resolveMonthlyDate(startDate: string, cycleMonth: string): string | null {
  const startParts = startDate.split('-').map(Number);
  const cycleParts = cycleMonth.split('-').map(Number);
  if (startParts.length < 3 || cycleParts.length < 2) return null;

  const startDay = startParts[2];
  const year = cycleParts[0];
  const month = cycleParts[1];
  if (!Number.isFinite(startDay) || !Number.isFinite(year) || !Number.isFinite(month) || startDay < 1) return null;

  const daysInTarget = new Date(year, month, 0).getDate();
  const day = Math.min(startDay, daysInTarget);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeRecurringEntry(entry: RecurringEntry): RecurringEntry {
  return {
    ...entry,
    description: entry.description || '',
    frequency: 'monthly',
    generatedCycles: entry.generatedCycles || [],
  };
}

function normalizeBudget(budget: Budget): Budget {
  return {
    ...budget,
    month: budget.month || currentMonth(),
  };
}

function normalizeTransaction(transaction: Transaction): Transaction {
  return {
    ...transaction,
    note: transaction.note || '',
  };
}

function mergeTransactions(local: Transaction[], cloud: Transaction[]): Transaction[] {
  const key = (transaction: Transaction) =>
    [transaction.date, transaction.type, transaction.amount.toFixed(2), transaction.categoryId, transaction.note || ''].join('|');
  const seen = new Set(local.map(key));
  const merged = [...local];
  cloud.forEach(transaction => {
    const k = key(transaction);
    if (seen.has(k)) return;
    seen.add(k);
    merged.unshift(transaction);
  });
  return merged;
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurringEntries, setRecurringEntries] = useState<RecurringEntry[]>([]);
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>(DEFAULT_SECURITY_SETTINGS);
  const [hasHydrated, setHasHydrated] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      // Prefer encrypted snapshot first; fallback to one-time legacy migration.
      const encrypted = await loadEncryptedObject<FinancePayload>(SECURE_FINANCE_KEY);
      if (cancelled) return;

      if (encrypted) {
        setTransactions(encrypted.transactions.filter(isValidTransaction).map(normalizeTransaction));
        const restoredCategories = encrypted.categories.filter(isValidCategory);
        setCategories(restoredCategories.length > 0 ? restoredCategories : DEFAULT_CATEGORIES);
        setBudgets(encrypted.budgets.filter(isValidBudget).map(normalizeBudget));
        setRecurringEntries(encrypted.recurringEntries.filter(isValidRecurringEntry).map(normalizeRecurringEntry));
        setSecuritySettings(isValidSecuritySettings(encrypted.securitySettings) ? encrypted.securitySettings : DEFAULT_SECURITY_SETTINGS);
        setHasHydrated(true);
        return;
      }

      const legacyTransactions = loadLegacyArray('transactions', [], isValidTransaction).map(normalizeTransaction);
      const legacyCategories = loadLegacyArray('categories', [], isValidCategory);
      const legacyBudgets = loadLegacyArray('budgets', [], isValidBudget).map(normalizeBudget);
      const legacyRecurring = loadLegacyArray('recurringEntries', [], isValidRecurringEntry).map(normalizeRecurringEntry);
      const legacySecurity = loadLegacyObject('securitySettings', DEFAULT_SECURITY_SETTINGS, isValidSecuritySettings);

      const payload: FinancePayload = {
        transactions: legacyTransactions,
        categories: legacyCategories.length > 0 ? legacyCategories : DEFAULT_CATEGORIES,
        budgets: legacyBudgets,
        recurringEntries: legacyRecurring,
        securitySettings: legacySecurity,
      };

      setTransactions(payload.transactions);
      setCategories(payload.categories);
      setBudgets(payload.budgets);
      setRecurringEntries(payload.recurringEntries);
      setSecuritySettings(payload.securitySettings);
      setHasHydrated(true);

      await saveEncryptedObject(SECURE_FINANCE_KEY, payload);
      removeStorageKeys(LEGACY_KEYS);
    };

    hydrate().catch(() => {
      if (!cancelled) {
        setHasHydrated(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    // Persist full finance state as one encrypted payload.
    const payload: FinancePayload = {
      transactions,
      categories,
      budgets,
      recurringEntries,
      securitySettings,
    };
    saveEncryptedObject(SECURE_FINANCE_KEY, payload).catch(() => {
      // keep app usable even when secure storage write fails
    });
  }, [transactions, categories, budgets, recurringEntries, securitySettings, hasHydrated]);

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
    const newCat: Category = { ...c, id: createId() };
    setCategories(prev => [...prev, newCat]);
    return newCat;
  }, []);

  const updateCategory = useCallback((id: string, updates: Omit<Category, 'id'>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...updates, id } : c));
  }, []);

  const deleteCategory = useCallback((id: string) => {
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

  const addRecurringEntry = useCallback((entry: Omit<RecurringEntry, 'id' | 'generatedCycles'>): RecurringEntry => {
    const created: RecurringEntry = {
      ...entry,
      id: createId(),
      description: entry.description || '',
      frequency: 'monthly',
      generatedCycles: [],
    };
    setRecurringEntries(prev => [...prev, created]);
    return created;
  }, []);

  const updateRecurringEntry = useCallback((id: string, updates: Omit<RecurringEntry, 'id' | 'generatedCycles'>) => {
    setRecurringEntries(prev =>
      prev.map(entry => entry.id === id ? {
        ...entry,
        ...updates,
        description: updates.description || '',
        id,
        frequency: 'monthly',
      } : entry)
    );
  }, []);

  const deleteRecurringEntry = useCallback((id: string) => {
    setRecurringEntries(prev => prev.filter(entry => entry.id !== id));
  }, []);

  const toggleRecurringEntry = useCallback((id: string, enabled: boolean) => {
    setRecurringEntries(prev => prev.map(entry => entry.id === id ? { ...entry, enabled } : entry));
  }, []);

  const updateSecuritySettings = useCallback((updates: Partial<SecuritySettings>) => {
    setSecuritySettings(prev => ({
      ...prev,
      ...updates,
      lockTimeoutMinutes: updates.lockTimeoutMinutes || prev.lockTimeoutMinutes || 5,
    }));
  }, []);

  const setSecurityPin = useCallback(async (pin: string) => {
    const normalized = pin.trim();
    if (normalized.length < 4) return;
    const { hash, salt } = await createPinHash(normalized);
    setSecuritySettings(prev => ({
      ...prev,
      pinHash: hash,
      pinSalt: salt,
      failedAttempts: 0,
    }));
  }, []);

  const clearSecurityPin = useCallback(() => {
    setSecuritySettings(prev => ({
      ...prev,
      pinHash: '',
      pinSalt: '',
      failedAttempts: 0,
      appLockEnabled: false,
      biometricEnabled: false,
      lastUnlockAt: null,
    }));
  }, []);

  const verifySecurityPin = useCallback(async (pin: string) => {
    const { pinHash, pinSalt } = securitySettings;
    const success = await verifyPin(pin.trim(), pinHash, pinSalt);
    setSecuritySettings(prev => ({
      ...prev,
      failedAttempts: success ? 0 : prev.failedAttempts + 1,
      lastUnlockAt: success ? new Date().toISOString() : prev.lastUnlockAt,
    }));
    return success;
  }, [securitySettings]);

  const markSecurityUnlocked = useCallback(() => {
    setSecuritySettings(prev => ({
      ...prev,
      lastUnlockAt: new Date().toISOString(),
      failedAttempts: 0,
    }));
  }, []);

  const buildEncryptedBackup = useCallback(async (): Promise<BackupManifest> => {
    const payload: FinancePayload = {
      transactions,
      categories,
      budgets,
      recurringEntries,
      securitySettings,
    };
    return encryptPayload(payload, getOrCreateDeviceSecret(), 'android-local');
  }, [transactions, categories, budgets, recurringEntries, securitySettings]);

  const restoreEncryptedBackup = useCallback(async (manifest: BackupManifest, mode: 'merge' | 'replace') => {
    const payload = await decryptPayload<FinancePayload>(manifest, getOrCreateDeviceSecret());
    const normalizedPayload: FinancePayload = {
      transactions: payload.transactions.filter(isValidTransaction).map(normalizeTransaction),
      categories: payload.categories.filter(isValidCategory),
      budgets: payload.budgets.filter(isValidBudget).map(normalizeBudget),
      recurringEntries: payload.recurringEntries.filter(isValidRecurringEntry).map(normalizeRecurringEntry),
      securitySettings: isValidSecuritySettings(payload.securitySettings) ? payload.securitySettings : DEFAULT_SECURITY_SETTINGS,
    };

    if (mode === 'replace') {
      setTransactions(normalizedPayload.transactions);
      setCategories(normalizedPayload.categories.length > 0 ? normalizedPayload.categories : DEFAULT_CATEGORIES);
      setBudgets(normalizedPayload.budgets);
      setRecurringEntries(normalizedPayload.recurringEntries);
      setSecuritySettings(normalizedPayload.securitySettings);
      return;
    }

    setTransactions(prev => mergeTransactions(prev, normalizedPayload.transactions));
    setCategories(prev => {
      const existing = new Map(prev.map(category => [category.id, category]));
      normalizedPayload.categories.forEach(category => {
        if (!existing.has(category.id)) existing.set(category.id, category);
      });
      return Array.from(existing.values());
    });
    setBudgets(prev => {
      const merged = [...prev];
      normalizedPayload.budgets.forEach(cloudBudget => {
        const index = merged.findIndex(b => b.categoryId === cloudBudget.categoryId && b.month === cloudBudget.month);
        if (index >= 0) {
          merged[index] = cloudBudget;
        } else {
          merged.push(cloudBudget);
        }
      });
      return merged;
    });
    setRecurringEntries(prev => {
      const merged = [...prev];
      normalizedPayload.recurringEntries.forEach(cloudEntry => {
        const index = merged.findIndex(entry => entry.id === cloudEntry.id);
        if (index >= 0) {
          merged[index] = cloudEntry;
        } else {
          merged.push(cloudEntry);
        }
      });
      return merged;
    });
  }, []);

  // Materialize due monthly recurring entries as real transactions.
  useEffect(() => {
    if (!hasHydrated || recurringEntries.length === 0) return;

    const todayStr = localDateStr(new Date());
    const currentMonthKey = monthKeyFromDate(new Date());
    const categoriesById = new Set(categories.map(category => category.id));

    const generatedTransactions: Transaction[] = [];
    let didUpdateCycles = false;

    const nextRecurringEntries = recurringEntries.map(entry => {
      if (!entry.enabled || entry.frequency !== 'monthly') return entry;

      const startMonthKey = monthKeyFromDateString(entry.startDate);
      const cycles = getMonthKeysInclusive(startMonthKey, currentMonthKey);
      if (cycles.length === 0) return entry;

      const generatedSet = new Set(entry.generatedCycles);
      const newGeneratedCycles: string[] = [];

      cycles.forEach(cycleKey => {
        if (generatedSet.has(cycleKey)) return;

        const dueDate = resolveMonthlyDate(entry.startDate, cycleKey);
        if (!dueDate || dueDate > todayStr) return;
        if (!categoriesById.has(entry.categoryId)) return;

        generatedTransactions.push({
          id: createId(),
          type: entry.type,
          amount: entry.amount,
          categoryId: entry.categoryId,
          date: dueDate,
          note: entry.description.trim() || 'Recurring',
        });
        newGeneratedCycles.push(cycleKey);
      });

      if (newGeneratedCycles.length === 0) return entry;
      didUpdateCycles = true;
      return {
        ...entry,
        generatedCycles: [...entry.generatedCycles, ...newGeneratedCycles],
      };
    });

    if (generatedTransactions.length === 0 || !didUpdateCycles) return;

    setTransactions(prev => [...generatedTransactions, ...prev]);
    setRecurringEntries(nextRecurringEntries);
  }, [recurringEntries, categories, hasHydrated]);

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
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [getTransactionsForMonth]);

  const getBalance = useCallback((month?: string) => {
    return getTotalIncome(month) - getTotalExpenses(month);
  }, [getTotalIncome, getTotalExpenses]);

  const getCarryForward = useCallback((month: string) => {
    const prevTransactions = transactions.filter(t => t.date < month);
    const income = prevTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = prevTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    return income - expenses;
  }, [transactions]);

  const getSpentForCategory = useCallback((categoryId: string, month: string) => {
    return transactions
      .filter(t => t.type === 'expense' && t.categoryId === categoryId && t.date.startsWith(month))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  return (
    <FinanceContext.Provider value={{
      transactions,
      categories,
      budgets,
      recurringEntries,
      securitySettings,
      hasHydrated,
      addTransaction,
      importTransactions,
      updateTransaction,
      deleteTransaction,
      addCategory,
      updateCategory,
      deleteCategory,
      addBudget,
      updateBudget,
      deleteBudget,
      transferBudgetsToMonth,
      addRecurringEntry,
      updateRecurringEntry,
      deleteRecurringEntry,
      toggleRecurringEntry,
      updateSecuritySettings,
      setSecurityPin,
      clearSecurityPin,
      verifySecurityPin,
      markSecurityUnlocked,
      buildEncryptedBackup,
      restoreEncryptedBackup,
      selectedMonth,
      setSelectedMonth,
      isSheetOpen,
      editingTransaction,
      openSheet,
      openEditSheet,
      closeSheet,
      getTotalIncome,
      getTotalExpenses,
      getBalance,
      getCarryForward,
      getSpentForCategory,
    }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
