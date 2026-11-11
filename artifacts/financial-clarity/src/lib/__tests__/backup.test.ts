/**
 * Tests for backup schema versions and migrations.
 * - Phase 1: added Transaction.paymentMethod (v1 -> v2).
 * - v3 backups migrate to v4 recurring occurrence identity support.
 * - v4 backups migrate to v5 (category status, required budget month).
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { applyBackup, buildBackup, validateBackup, BACKUP_READ_FAILED_MESSAGE, BACKUP_VERSION } from '../backup';
import type { BackupFile } from '../backup';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Backup storage boundary', () => {
  const backupWith = (savingsGoal: BackupFile['data']['savingsGoal']): BackupFile => ({
    schemaVersion: BACKUP_VERSION,
    appVersion: '1.0.0',
    exportedAt: '2026-11-11T10:00:00.000Z',
    device: { platform: 'android' },
    counts: {
      transactions: 1, categories: 0, budgets: 0, recurringExpenses: 0, savingsGoal: savingsGoal ? 1 : 0,
      pendingSms: 0, dismissedSmsFingerprints: 0, linkedSms: 0,
    },
    data: {
      transactions: [{ id: 'restored', type: 'expense', amount: 10, categoryId: 'groceries', note: '', date: '2026-11-01' }],
      categories: [],
      budgets: [],
      recurringExpenses: [],
      savingsGoal,
      sms: { pendingSms: [], dismissedSmsFingerprints: [], linkedSms: {}, lastScanMs: 0 },
    },
  });

  it('returns a typed failure and leaves every key unchanged when a restore write fails', () => {
    localStorage.setItem('financial-clarity:transactions', '[{"id":"local"}]');
    localStorage.setItem('financial-clarity:savings-goal', '{"goal":{"monthly":1,"annual":12}}');
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === 'financial-clarity:recurring') throw new DOMException('full', 'QuotaExceededError');
      return original.call(this, k, v);
    });

    const result = applyBackup(backupWith(null));

    expect(result).toMatchObject({ ok: false, error: 'quota' });
    expect(localStorage.getItem('financial-clarity:transactions')).toBe('[{"id":"local"}]');
    expect(localStorage.getItem('financial-clarity:categories')).toBeNull();
    expect(localStorage.getItem('financial-clarity:savings-goal')).toBe('{"goal":{"monthly":1,"annual":12}}');
  });

  it('returns the counts after a successful restore', () => {
    const backup = backupWith({ goal: { monthly: 5, annual: 60 }, emergency: { monthly: 0, annual: 0 } });
    expect(applyBackup(backup)).toEqual({ ok: true, counts: backup.counts });
    expect(JSON.parse(localStorage.getItem('financial-clarity:savings-goal') ?? 'null')).toEqual(backup.data.savingsGoal);
  });

  it('refuses to build a backup when local storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(() => buildBackup()).toThrow(BACKUP_READ_FAILED_MESSAGE);
  });

  it('includes a legacy single-bucket savings goal in the backup', () => {
    localStorage.setItem('financial-clarity:savings-goal', '{"monthly":500,"annual":6000}');
    expect(buildBackup().data.savingsGoal).toEqual({
      goal: { monthly: 500, annual: 6000 },
      emergency: { monthly: 0, annual: 0 },
    });
  });

  it('does not write quarantine copies while building a backup', () => {
    localStorage.setItem('financial-clarity:transactions', '[{"id":1}]');
    buildBackup();
    expect(Object.keys(localStorage).filter(k => k.startsWith('financial-clarity:backup:'))).toEqual([]);
  });

  it('records the build version instead of a hard-coded one', () => {
    expect(buildBackup().appVersion).toBe(__APP_VERSION__);
  });

  it('round-trips a v5 backup: build, serialize, validate, restore', () => {
    const categories = [
      { id: 'groceries', name: 'Groceries', icon: 'ShoppingCart', color: '#10B981', type: 'expense', active: true },
      { id: 'old', name: 'Old', icon: 'X', color: '#000000', type: 'expense', active: false },
    ];
    const transactions = [
      { id: 't1', type: 'expense', amount: 120, categoryId: 'old', note: 'synthetic', date: '2026-11-02', paymentMethod: 'cash' },
      { id: 't2', type: 'expense', amount: 500, categoryId: 'groceries', note: '', date: '2026-11-05', recurringRuleId: 'r1', recurringMonth: '2026-11' },
    ];
    const budgets = [{ id: 'b1', categoryId: 'groceries', limit: 3000, month: '2026-11' }];
    const recurring = [{ id: 'r1', description: 'Weekly box', amount: 500, categoryId: 'groceries', dayOfMonth: 5, active: true, startMonth: '2026-11', lastGeneratedMonth: '2026-11' }];
    const savingsGoal = { goal: { monthly: 1000, annual: 12000, createdAt: '2026-01-01' }, emergency: { monthly: 0, annual: 0 } };
    localStorage.setItem('financial-clarity:categories', JSON.stringify(categories));
    localStorage.setItem('financial-clarity:transactions', JSON.stringify(transactions));
    localStorage.setItem('financial-clarity:budgets', JSON.stringify(budgets));
    localStorage.setItem('financial-clarity:recurring', JSON.stringify(recurring));
    localStorage.setItem('financial-clarity:savings-goal', JSON.stringify(savingsGoal));

    const file = JSON.parse(JSON.stringify(buildBackup())) as unknown;
    localStorage.clear();
    const validation = validateBackup(file);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(validation.backup.schemaVersion).toBe(5);
    expect(applyBackup(validation.backup)).toMatchObject({ ok: true });

    expect(JSON.parse(localStorage.getItem('financial-clarity:categories') ?? '[]')).toEqual(categories);
    expect(JSON.parse(localStorage.getItem('financial-clarity:transactions') ?? '[]')).toEqual(transactions);
    expect(JSON.parse(localStorage.getItem('financial-clarity:budgets') ?? '[]')).toEqual(budgets);
    expect(JSON.parse(localStorage.getItem('financial-clarity:recurring') ?? '[]')).toEqual(recurring);
    expect(JSON.parse(localStorage.getItem('financial-clarity:savings-goal') ?? 'null')).toEqual(savingsGoal);
  });
});

describe('Backup schema versioning', () => {
  it('current BACKUP_VERSION is 5', () => {
    expect(BACKUP_VERSION).toBe(5);
  });

  it('migrates a v4 backup to v5: categories default to active and every budget gets a month', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 15));
    try {
      const v4Backup: unknown = {
        schemaVersion: 4,
        appVersion: '1.0.0',
        exportedAt: '2026-11-01T00:00:00.000Z',
        device: { platform: 'android' },
        counts: {
          transactions: 0, categories: 2, budgets: 3, recurringExpenses: 0, savingsGoal: 0,
          pendingSms: 0, dismissedSmsFingerprints: 0, linkedSms: 0,
        },
        data: {
          transactions: [],
          categories: [
            { id: 'rent', name: 'Rent', icon: 'Home', color: '#6366F1', type: 'commitment' },
            { id: 'fun', name: 'Fun', icon: 'Smile', color: '#F59E0B', type: 'expense', active: false },
          ],
          budgets: [
            { id: 'old', categoryId: 'rent', limit: 100 },
            { id: 'kept', categoryId: 'rent', limit: 200, month: '2026-11' },
            { id: 'fun-old', categoryId: 'fun', limit: 50 },
          ],
          recurringExpenses: [],
          savingsGoal: null,
          sms: { pendingSms: [], dismissedSmsFingerprints: [], linkedSms: {}, lastScanMs: 0 },
        },
      };

      const result = validateBackup(v4Backup);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.backup.schemaVersion).toBe(5);
      expect(result.backup.data.categories.map(c => c.active)).toEqual([true, false]);
      expect(result.backup.data.budgets).toEqual([
        { id: 'kept', categoryId: 'rent', limit: 200, month: '2026-11' },
        { id: 'fun-old', categoryId: 'fun', limit: 50, month: '2026-11' },
      ]);
      expect(result.backup.counts.budgets).toBe(2);
    } finally {
      vi.useRealTimers();
    }
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
      expect(result.backup.schemaVersion).toBe(5);
      expect(result.backup.data.transactions[0].paymentMethod).toBe('credit-card');
      expect(result.backup.data.transactions[0].merchant).toBe('Reliance Fresh');
      expect(result.backup.data.transactions[0].sourceSmsFingerprint).toBe('sha256-abc123');
      expect(result.backup.data.sms.pendingSms).toEqual([]);
      expect(result.backup.data.sms.lastScanMs).toBe(0);
    }
  });

  it('carries forward legacy local SMS data without changing its storage', () => {
    const pending = '[{"smsId":"old-message","rawBody":"legacy content"}]';
    const dismissed = '["old-fingerprint"]';
    const linked = '{"old-fingerprint":{"smsId":"linked-message","rawBody":"linked content"}}';
    const lastScan = '1753000000000';
    localStorage.setItem('financial-clarity:sms-pending', pending);
    localStorage.setItem('financial-clarity:sms-dismissed', dismissed);
    localStorage.setItem('financial-clarity:sms-linked', linked);
    localStorage.setItem('financial-clarity:sms-last-scan', lastScan);

    const backup = buildBackup();

    expect(backup.data.sms.pendingSms).toEqual(JSON.parse(pending));
    expect(backup.data.sms.dismissedSmsFingerprints).toEqual(JSON.parse(dismissed));
    expect(backup.data.sms.linkedSms).toEqual(JSON.parse(linked));
    expect(backup.data.sms.lastScanMs).toBe(Number(lastScan));
    expect(localStorage.getItem('financial-clarity:sms-pending')).toBe(pending);
    expect(localStorage.getItem('financial-clarity:sms-dismissed')).toBe(dismissed);
    expect(localStorage.getItem('financial-clarity:sms-linked')).toBe(linked);
    expect(localStorage.getItem('financial-clarity:sms-last-scan')).toBe(lastScan);
  });

  it('restores legacy v3 SMS data without making it active runtime state', () => {
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
      applyBackup(result.backup);
      expect(localStorage.getItem('financial-clarity:sms-pending')).toBe(
        JSON.stringify(result.backup.data.sms.pendingSms),
      );
      expect(localStorage.getItem('financial-clarity:sms-dismissed')).toBe(
        JSON.stringify(result.backup.data.sms.dismissedSmsFingerprints),
      );
      expect(localStorage.getItem('financial-clarity:sms-linked')).toBe(
        JSON.stringify(result.backup.data.sms.linkedSms),
      );
      expect(localStorage.getItem('financial-clarity:sms-last-scan')).toBe('1753000000000');
    }
  });

  it('migrates a v1 backup up to v5 (adds paymentMethod support + empty SMS block)', () => {
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
      expect(result.backup.schemaVersion).toBe(5);
      expect(result.backup.data.transactions).toHaveLength(2);
      expect(result.backup.data.transactions[0].id).toBe('tx-001');
      expect(result.backup.data.transactions[1].id).toBe('tx-002');
      // v3 migration adds an empty SMS block; v4 adds optional occurrence keys.
      expect(result.backup.data.sms).toBeDefined();
      expect(result.backup.data.sms.pendingSms).toEqual([]);
      expect(result.backup.data.sms.lastScanMs).toBe(0);
    }
  });

  it('migrates a v2 backup up to v5 (adds SMS compatibility and occurrence support)', () => {
    const existingLegacySms = {
      pending: '[{"rawBody":"keep existing legacy record"}]',
      dismissed: '["keep-this-fingerprint"]',
      linked: '{"keep-this-fingerprint":{"rawBody":"keep linked record"}}',
      lastScan: '1753000000000',
    };
    localStorage.setItem('financial-clarity:sms-pending', existingLegacySms.pending);
    localStorage.setItem('financial-clarity:sms-dismissed', existingLegacySms.dismissed);
    localStorage.setItem('financial-clarity:sms-linked', existingLegacySms.linked);
    localStorage.setItem('financial-clarity:sms-last-scan', existingLegacySms.lastScan);

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
      expect(result.backup.schemaVersion).toBe(5);
      expect(result.backup.data.transactions[0].paymentMethod).toBe('credit-card');
      expect(result.backup.data.sms.pendingSms).toEqual([]);
      expect(result.backup.data.sms.dismissedSmsFingerprints).toEqual([]);
      expect(result.backup.data.sms.linkedSms).toEqual({});
      applyBackup(result.backup);
      expect(localStorage.getItem('financial-clarity:sms-pending')).toBe(existingLegacySms.pending);
      expect(localStorage.getItem('financial-clarity:sms-dismissed')).toBe(existingLegacySms.dismissed);
      expect(localStorage.getItem('financial-clarity:sms-linked')).toBe(existingLegacySms.linked);
      expect(localStorage.getItem('financial-clarity:sms-last-scan')).toBe(existingLegacySms.lastScan);
      expect(JSON.parse(localStorage.getItem('financial-clarity:transactions') || '[]')).toEqual(
        result.backup.data.transactions,
      );
    }
  });

  it('rejects a backup with schemaVersion > current (v6)', () => {
    const futureBackup: unknown = {
      schemaVersion: 6,
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

  it('accepts v1 transactions without optional metadata (migrates cleanly to v5)', () => {
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
      expect(result.backup.schemaVersion).toBe(5);
      expect(result.backup.data.transactions[0].paymentMethod).toBeUndefined();
      expect(result.backup.data.sms.pendingSms).toEqual([]);
    }
  });

  it('accepts paired recurring occurrence identity and rejects a partial pair', () => {
    const backup = buildBackup();
    backup.data.transactions.push({
      id: 'recurring-tx', type: 'expense', amount: 100, categoryId: 'rent', note: 'Rent',
      date: '2026-11-01', recurringRuleId: 'rule-1', recurringMonth: '2026-11',
    });
    backup.counts.transactions = 1;
    expect(validateBackup(backup).ok).toBe(true);

    backup.data.transactions[0].recurringMonth = undefined;
    expect(validateBackup(backup)).toMatchObject({ ok: false, reason: 'invalid-data' });
  });
});
