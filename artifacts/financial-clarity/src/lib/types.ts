export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  categoryId: string;
  note: string;
  date: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense' | 'both';
}

export interface Budget {
  id: string;
  categoryId: string;
  limit: number;
  month?: string;
}

export interface RecurringEntry {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  categoryId: string;
  startDate: string;
  description: string;
  frequency: 'monthly';
  enabled: boolean;
  generatedCycles: string[];
}

export interface SecuritySettings {
  appLockEnabled: boolean;
  biometricEnabled: boolean;
  lockTimeoutMinutes: number;
  pinHash: string;
  pinSalt: string;
  lastUnlockAt: string | null;
  failedAttempts: number;
}

export interface BackupManifest {
  version: number;
  createdAt: string;
  deviceId: string;
  checksum: string;
  ciphertext: string;
  nonce: string;
  summary?: {
    transactions: number;
    categories: number;
    budgets: number;
    recurringEntries: number;
  };
  kdfParams: {
    salt: string;
    iterations: number;
    hash: 'SHA-256';
  };
}
