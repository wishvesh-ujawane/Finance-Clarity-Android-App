/**
 * Tests for backup schema version 2 migration (Phase 1).
 * Verifies that v1 backups migrate cleanly to v2 without data loss.
 */

import { describe, it, expect } from 'vitest';
import { validateBackup, BACKUP_VERSION } from '../backup';
import type { BackupFile } from '../backup';

describe('Backup migration v1 → v2', () => {
  it('current BACKUP_VERSION is 2', () => {
    expect(BACKUP_VERSION).toBe(2);
  });

  it('accepts a valid v2 backup with paymentMethod field', () => {
    const v2Backup: BackupFile = {
      schemaVersion: 2,
      appVersion: '1.0.0',
      exportedAt: '2026-07-20T10:00:00.000Z',
      device: { platform: 'android' },
      counts: { transactions: 1, categories: 1, budgets: 0, recurringExpenses: 0, savingsGoal: 0 },
      data: {
        transactions: [
          {
            id: 'tx-001',
            type: 'expense',
            amount: 1000,
            categoryId: 'groceries',
            note: 'Test',
            date: '2026-07-10',
            paymentMethod: 'credit-card',
            merchant: 'Reliance Fresh',
            sourceSmsFingerprint: 'sha256-abc123',
          },
        ],
        categories: [
          { id: 'groceries', name: 'Groceries', icon: 'ShoppingCart', color: '#10B981', type: 'expense' },
        ],
        budgets: [],
        recurringExpenses: [],
        savingsGoal: null,
      },
    };

    const result = validateBackup(v2Backup);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup.schemaVersion).toBe(2);
      expect(result.backup.data.transactions[0].paymentMethod).toBe('credit-card');
      expect(result.backup.data.transactions[0].merchant).toBe('Reliance Fresh');
      expect(result.backup.data.transactions[0].sourceSmsFingerprint).toBe('sha256-abc123');
    }
  });

  it('migrates a v1 backup to v2 (no-op data transform)', () => {
    const v1Backup: unknown = {
      schemaVersion: 1,
      appVersion: '1.0.0',
      exportedAt: '2026-07-01T10:00:00.000Z',
      device: { platform: 'android' },
      counts: { transactions: 2, categories: 1, budgets: 0, recurringExpenses: 0, savingsGoal: 0 },
      data: {
        transactions: [
          {
            id: 'tx-001',
            type: 'income',
            amount: 50000,
            categoryId: 'salary',
            note: 'Salary',
            date: '2026-07-01',
          },
          {
            id: 'tx-002',
            type: 'expense',
            amount: 5000,
            categoryId: 'groceries',
            note: 'Groceries',
            date: '2026-07-05',
          },
        ],
        categories: [
          { id: 'salary', name: 'Salary', icon: 'Briefcase', color: '#10B981', type: 'income' },
        ],
        budgets: [],
        recurringExpenses: [],
        savingsGoal: null,
      },
    };

    const result = validateBackup(v1Backup);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup.schemaVersion).toBe(2);
      expect(result.backup.data.transactions).toHaveLength(2);
      // Transactions should still be valid (paymentMethod is optional)
      expect(result.backup.data.transactions[0].id).toBe('tx-001');
      expect(result.backup.data.transactions[1].id).toBe('tx-002');
    }
  });

  it('rejects a backup with schemaVersion > current', () => {
    const futureBackup: unknown = {
      schemaVersion: 3,
      appVersion: '2.0.0',
      exportedAt: '2027-01-01T00:00:00.000Z',
      device: { platform: 'android' },
      counts: { transactions: 0, categories: 0, budgets: 0, recurringExpenses: 0, savingsGoal: 0 },
      data: {
        transactions: [],
        categories: [],
        budgets: [],
        recurringExpenses: [],
        savingsGoal: null,
      },
    };

    const result = validateBackup(futureBackup);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('newer-version');
    }
  });

  it('accepts v1 transactions without paymentMethod', () => {
    const v1Backup: unknown = {
      schemaVersion: 1,
      appVersion: '1.0.0',
      exportedAt: '2026-07-01T10:00:00.000Z',
      device: { platform: 'android' },
      counts: { transactions: 1, categories: 1, budgets: 0, recurringExpenses: 0, savingsGoal: 0 },
      data: {
        transactions: [
          {
            id: 'tx-legacy',
            type: 'expense',
            amount: 1234,
            categoryId: 'groceries',
            note: 'No payment method',
            date: '2026-07-01',
            // paymentMethod field intentionally absent
          },
        ],
        categories: [
          { id: 'groceries', name: 'Groceries', icon: 'ShoppingCart', color: '#10B981', type: 'expense' },
        ],
        budgets: [],
        recurringExpenses: [],
        savingsGoal: null,
      },
    };

    const result = validateBackup(v1Backup);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup.data.transactions[0].paymentMethod).toBeUndefined();
    }
  });
});
