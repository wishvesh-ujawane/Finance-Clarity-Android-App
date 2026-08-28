/**
 * Tests for backup schema versions and migrations.
 * - Phase 1: added Transaction.paymentMethod (v1 -> v2).
 * - Phase 5: added SMS auto-import state (v2 -> v3).
 */

import { describe, it, expect } from 'vitest';
import { validateBackup, BACKUP_VERSION } from '../backup';
import type { BackupFile } from '../backup';

describe('Backup schema versioning', () => {
  it('current BACKUP_VERSION is 3', () => {
    expect(BACKUP_VERSION).toBe(3);
  });

  it('accepts a valid v3 backup with an empty SMS block', () => {
    const v3Backup: BackupFile = {
      schemaVersion: 3,
      appVersion: '1.0.0',
      exportedAt: '2026-07-20T10:00:00.000Z',
      device: { platform: 'android' },
      counts: {
        transactions: 1,
        categories: 1,
        budgets: 0,
        recurringExpenses: 0,
        savingsGoal: 0,
        pendingSms: 0,
        dismissedSmsFingerprints: 0,
        linkedSms: 0,
      },
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
        sms: {
          pendingSms: [],
          dismissedSmsFingerprints: [],
          linkedSms: {},
          lastScanMs: 0,
        },
      },
    };

    const result = validateBackup(v3Backup);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup.schemaVersion).toBe(3);
      expect(result.backup.data.transactions[0].paymentMethod).toBe('credit-card');
      expect(result.backup.data.transactions[0].merchant).toBe('Reliance Fresh');
      expect(result.backup.data.transactions[0].sourceSmsFingerprint).toBe('sha256-abc123');
      expect(result.backup.data.sms.pendingSms).toEqual([]);
      expect(result.backup.data.sms.lastScanMs).toBe(0);
    }
  });

  it('accepts a valid v3 backup with SMS data present', () => {
    const v3Backup: BackupFile = {
      schemaVersion: 3,
      appVersion: '1.0.0',
      exportedAt: '2026-07-20T10:00:00.000Z',
      device: { platform: 'android' },
      counts: {
        transactions: 0, categories: 0, budgets: 0, recurringExpenses: 0, savingsGoal: 0,
        pendingSms: 1, dismissedSmsFingerprints: 1, linkedSms: 1,
      },
      data: {
        transactions: [],
        categories: [],
        budgets: [],
        recurringExpenses: [],
        savingsGoal: null,
        sms: {
          pendingSms: [
            {
              smsId: 'msg-001',
              fingerprint: 'a'.repeat(64),
              senderId: 'HDFCBK',
              amount: 1250,
              direction: 'debit',
              merchant: 'Reliance Fresh',
              accountTail: '4532',
              paymentMethod: 'bank',
              txnRef: null,
              timestamp: 1_752_000_000_000,
              dateISO: '2026-07-05',
              suggestedCategoryId: 'groceries',
              reason: 'purchase',
              rawBody: 'Rs 1,250 debited...',
            },
          ],
          dismissedSmsFingerprints: ['b'.repeat(64)],
          linkedSms: {
            ['c'.repeat(64)]: {
              smsId: 'msg-002',
              fingerprint: 'c'.repeat(64),
              senderId: 'HDFCBK',
              amount: 3499,
              direction: 'debit',
              merchant: 'Flipkart',
              accountTail: '7845',
              paymentMethod: 'credit-card',
              txnRef: null,
              timestamp: 1_752_100_000_000,
              dateISO: '2026-07-06',
              suggestedCategoryId: 'leisure',
              reason: 'purchase',
              rawBody: 'Card ending 7845...',
            },
          },
          lastScanMs: 1_753_000_000_000,
        },
      },
    };

    const result = validateBackup(v3Backup);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup.data.sms.pendingSms).toHaveLength(1);
      expect(Object.keys(result.backup.data.sms.linkedSms)).toHaveLength(1);
      expect(result.backup.data.sms.lastScanMs).toBe(1_753_000_000_000);
    }
  });

  it('migrates a v1 backup up to v3 (adds paymentMethod support + empty SMS block)', () => {
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
      expect(result.backup.schemaVersion).toBe(3);
      expect(result.backup.data.transactions).toHaveLength(2);
      expect(result.backup.data.transactions[0].id).toBe('tx-001');
      expect(result.backup.data.transactions[1].id).toBe('tx-002');
      // v3 migration adds an empty sms block.
      expect(result.backup.data.sms).toBeDefined();
      expect(result.backup.data.sms.pendingSms).toEqual([]);
      expect(result.backup.data.sms.lastScanMs).toBe(0);
    }
  });

  it('migrates a v2 backup up to v3 (adds empty SMS block)', () => {
    const v2Backup: unknown = {
      schemaVersion: 2,
      appVersion: '1.0.0',
      exportedAt: '2026-07-10T10:00:00.000Z',
      device: { platform: 'android' },
      counts: { transactions: 1, categories: 1, budgets: 0, recurringExpenses: 0, savingsGoal: 0 },
      data: {
        transactions: [
          {
            id: 'tx-legacy-v2',
            type: 'expense',
            amount: 1234,
            categoryId: 'groceries',
            note: 'v2 entry',
            date: '2026-07-10',
            paymentMethod: 'credit-card',
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
      expect(result.backup.schemaVersion).toBe(3);
      expect(result.backup.data.transactions[0].paymentMethod).toBe('credit-card');
      expect(result.backup.data.sms.pendingSms).toEqual([]);
      expect(result.backup.data.sms.dismissedSmsFingerprints).toEqual([]);
      expect(result.backup.data.sms.linkedSms).toEqual({});
    }
  });

  it('rejects a backup with schemaVersion > current (v4)', () => {
    const futureBackup: unknown = {
      schemaVersion: 4,
      appVersion: '2.0.0',
      exportedAt: '2027-01-01T00:00:00.000Z',
      device: { platform: 'android' },
      counts: {
        transactions: 0, categories: 0, budgets: 0, recurringExpenses: 0, savingsGoal: 0,
        pendingSms: 0, dismissedSmsFingerprints: 0, linkedSms: 0,
      },
      data: {
        transactions: [],
        categories: [],
        budgets: [],
        recurringExpenses: [],
        savingsGoal: null,
        sms: { pendingSms: [], dismissedSmsFingerprints: [], linkedSms: {}, lastScanMs: 0 },
      },
    };

    const result = validateBackup(futureBackup);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('newer-version');
    }
  });

  it('accepts v1 transactions without paymentMethod (migrates cleanly to v3)', () => {
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
      expect(result.backup.schemaVersion).toBe(3);
      expect(result.backup.data.transactions[0].paymentMethod).toBeUndefined();
      expect(result.backup.data.sms.pendingSms).toEqual([]);
    }
  });
});
