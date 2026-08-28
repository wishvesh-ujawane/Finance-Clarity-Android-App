/**
 * Test suite for SMS deduplication utilities.
 */

import { describe, it, expect } from 'vitest';
import { smsFingerprint, matchesExistingBySourceRef, findFuzzyDuplicate } from '../dedup';
import type { SmsMessage } from '../SmsReader';
import type { ParsedSms } from '../parser/types';
import type { Transaction } from '../../types';

describe('smsFingerprint', () => {
  const baseMessage: SmsMessage = {
    id: 'msg-001',
    sender: 'HDFCBK',
    body: 'Rs 1,250.00 debited from A/c **4532 on 05-Jul-26 at Reliance Fresh using Debit Card.',
    timestamp: new Date('2026-07-05T10:30:00+05:30').getTime(),
  };

  it('should produce a 64-character hex fingerprint', async () => {
    const fp = await smsFingerprint(baseMessage);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should produce stable fingerprints for identical messages', async () => {
    const fp1 = await smsFingerprint(baseMessage);
    const fp2 = await smsFingerprint(baseMessage);
    expect(fp1).toBe(fp2);
  });

  it('should produce identical fingerprints for whitespace variants', async () => {
    const msg1 = { ...baseMessage };
    const msg2 = { ...baseMessage, body: baseMessage.body.replace(/\s+/g, '  ') };
    const fp1 = await smsFingerprint(msg1);
    const fp2 = await smsFingerprint(msg2);
    expect(fp1).toBe(fp2);
  });

  it('should strip DLT headers when normalizing sender', async () => {
    const msg1 = { ...baseMessage, sender: 'HDFCBK' };
    const msg2 = { ...baseMessage, sender: 'AX-HDFCBK' };
    const msg3 = { ...baseMessage, sender: 'VM-HDFCBK' };
    const fp1 = await smsFingerprint(msg1);
    const fp2 = await smsFingerprint(msg2);
    const fp3 = await smsFingerprint(msg3);
    expect(fp1).toBe(fp2);
    expect(fp2).toBe(fp3);
  });

  it('should collapse same-minute timestamps', async () => {
    const ts1 = new Date('2026-07-05T10:30:00+05:30').getTime();
    const ts2 = new Date('2026-07-05T10:30:45+05:30').getTime();
    const msg1 = { ...baseMessage, timestamp: ts1 };
    const msg2 = { ...baseMessage, timestamp: ts2 };
    const fp1 = await smsFingerprint(msg1);
    const fp2 = await smsFingerprint(msg2);
    expect(fp1).toBe(fp2);
  });

  it('should differentiate different senders', async () => {
    const msg1 = { ...baseMessage, sender: 'HDFCBK' };
    const msg2 = { ...baseMessage, sender: 'ICICIB' };
    const fp1 = await smsFingerprint(msg1);
    const fp2 = await smsFingerprint(msg2);
    expect(fp1).not.toBe(fp2);
  });

  it('should differentiate different bodies', async () => {
    const msg1 = { ...baseMessage };
    const msg2 = { ...baseMessage, body: 'Rs 2,500.00 debited from A/c **4532' };
    const fp1 = await smsFingerprint(msg1);
    const fp2 = await smsFingerprint(msg2);
    expect(fp1).not.toBe(fp2);
  });

  it('should differentiate different minutes', async () => {
    const ts1 = new Date('2026-07-05T10:30:00+05:30').getTime();
    const ts2 = new Date('2026-07-05T10:31:00+05:30').getTime();
    const msg1 = { ...baseMessage, timestamp: ts1 };
    const msg2 = { ...baseMessage, timestamp: ts2 };
    const fp1 = await smsFingerprint(msg1);
    const fp2 = await smsFingerprint(msg2);
    expect(fp1).not.toBe(fp2);
  });
});

describe('matchesExistingBySourceRef', () => {
  const parsed: ParsedSms = {
    smsId: 'msg-001',
    fingerprint: 'abc123' + '0'.repeat(58),
    senderId: 'HDFCBK',
    amount: 1250,
    direction: 'debit',
    merchant: 'Reliance Fresh',
    accountTail: '4532',
    paymentMethod: 'bank',
    txnRef: null,
    timestamp: Date.now(),
    dateISO: '2026-07-05',
    suggestedCategoryId: 'groceries',
    reason: 'purchase',
    rawBody: 'test body',
  };

  it('should return transaction when fingerprint matches', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-001',
        type: 'expense',
        amount: 1250,
        categoryId: 'groceries',
        note: 'Reliance Fresh',
        date: '2026-07-05',
        sourceSmsFingerprint: 'abc123' + '0'.repeat(58),
      },
    ];

    const result = matchesExistingBySourceRef(parsed, transactions);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('tx-001');
  });

  it('should return null when no fingerprint matches', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-001',
        type: 'expense',
        amount: 1250,
        categoryId: 'groceries',
        note: 'Reliance Fresh',
        date: '2026-07-05',
        sourceSmsFingerprint: 'different' + '0'.repeat(56),
      },
    ];

    const result = matchesExistingBySourceRef(parsed, transactions);
    expect(result).toBeNull();
  });

  it('should return null when transaction has no sourceSmsFingerprint', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-001',
        type: 'expense',
        amount: 1250,
        categoryId: 'groceries',
        note: 'Reliance Fresh',
        date: '2026-07-05',
      },
    ];

    const result = matchesExistingBySourceRef(parsed, transactions);
    expect(result).toBeNull();
  });
});

describe('findFuzzyDuplicate', () => {
  const parsed: ParsedSms = {
    smsId: 'msg-001',
    fingerprint: 'abc123' + '0'.repeat(58),
    senderId: 'HDFCBK',
    amount: 1250.5,
    direction: 'debit',
    merchant: 'Reliance Fresh',
    accountTail: '4532',
    paymentMethod: 'bank',
    txnRef: null,
    timestamp: Date.now(),
    dateISO: '2026-07-05',
    suggestedCategoryId: 'groceries',
    reason: 'purchase',
    rawBody: 'test body',
  };

  it('should find exact amount and date match', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-001',
        type: 'expense',
        amount: 1250.5,
        categoryId: 'groceries',
        note: 'Reliance',
        date: '2026-07-05',
      },
    ];

    const result = findFuzzyDuplicate(parsed, transactions);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('tx-001');
  });

  it('should find match within ±1 day', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-001',
        type: 'expense',
        amount: 1250.5,
        categoryId: 'groceries',
        note: 'Reliance',
        date: '2026-07-04', // day before
      },
      {
        id: 'tx-002',
        type: 'expense',
        amount: 1250.5,
        categoryId: 'groceries',
        note: 'Reliance',
        date: '2026-07-06', // day after
      },
    ];

    const result1 = findFuzzyDuplicate(parsed, [transactions[0]]);
    expect(result1).not.toBeNull();

    const result2 = findFuzzyDuplicate(parsed, [transactions[1]]);
    expect(result2).not.toBeNull();
  });

  it('should return null when amount differs by more than 2 decimal places', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-001',
        type: 'expense',
        amount: 1250.51, // differs in hundredths
        categoryId: 'groceries',
        note: 'Reliance',
        date: '2026-07-05',
      },
    ];

    const result = findFuzzyDuplicate(parsed, transactions);
    expect(result).toBeNull();
  });

  it('should return null when date is >1 day off', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-001',
        type: 'expense',
        amount: 1250.5,
        categoryId: 'groceries',
        note: 'Reliance',
        date: '2026-07-03', // 2 days before
      },
      {
        id: 'tx-002',
        type: 'expense',
        amount: 1250.5,
        categoryId: 'groceries',
        note: 'Reliance',
        date: '2026-07-07', // 2 days after
      },
    ];

    const result1 = findFuzzyDuplicate(parsed, [transactions[0]]);
    expect(result1).toBeNull();

    const result2 = findFuzzyDuplicate(parsed, [transactions[1]]);
    expect(result2).toBeNull();
  });

  it('should return first match when multiple candidates exist', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-001',
        type: 'expense',
        amount: 1250.5,
        categoryId: 'groceries',
        note: 'First',
        date: '2026-07-05',
      },
      {
        id: 'tx-002',
        type: 'expense',
        amount: 1250.5,
        categoryId: 'groceries',
        note: 'Second',
        date: '2026-07-05',
      },
    ];

    const result = findFuzzyDuplicate(parsed, transactions);
    expect(result?.id).toBe('tx-001');
  });
});
