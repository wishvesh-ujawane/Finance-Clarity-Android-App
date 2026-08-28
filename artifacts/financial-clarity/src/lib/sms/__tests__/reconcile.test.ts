/**
 * Test suite for SMS-to-transaction reconciliation logic.
 */

import { describe, it, expect } from 'vitest';
import { classifyMatch } from '../reconcile';
import type { ParsedSms } from '../parser/types';
import type { Transaction } from '../../types';

describe('classifyMatch', () => {
  const baseParsed: ParsedSms = {
    smsId: 'msg-001',
    fingerprint: 'abc123' + '0'.repeat(58),
    senderId: 'HDFCBK',
    amount: 1250,
    direction: 'debit',
    merchant: 'Swiggy',
    accountTail: '4532',
    paymentMethod: 'bank',
    txnRef: null,
    timestamp: Date.now(),
    dateISO: '2026-07-05',
    suggestedCategoryId: 'dining',
    reason: 'purchase',
    rawBody: 'test body',
  };

  describe('High confidence matches', () => {
    it('should return high when merchant token appears in note', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx-001',
          type: 'expense',
          amount: 1250,
          categoryId: 'dining',
          note: 'Ordered from Swiggy',
          date: '2026-07-05',
        },
      ];

      const result = classifyMatch(baseParsed, transactions);
      expect(result.kind).toBe('high');
      expect(result.existingId).toBe('tx-001');
      expect(result.reason).toContain('merchant token match');
    });

    it('should return high when merchant token appears in merchant field', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx-001',
          type: 'expense',
          amount: 1250,
          categoryId: 'leisure',
          note: 'Food delivery',
          date: '2026-07-05',
          merchant: 'Swiggy',
        },
      ];

      const result = classifyMatch(baseParsed, transactions);
      expect(result.kind).toBe('high');
      expect(result.existingId).toBe('tx-001');
      expect(result.reason).toContain('merchant token match');
    });

    it('should return high when category matches suggestion', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx-001',
          type: 'expense',
          amount: 1250,
          categoryId: 'dining',
          note: 'Food order',
          date: '2026-07-05',
        },
      ];

      const result = classifyMatch(baseParsed, transactions);
      expect(result.kind).toBe('high');
      expect(result.existingId).toBe('tx-001');
      expect(result.reason).toContain('category match');
    });

    it('should return high when direction matches', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx-001',
          type: 'expense', // matches 'debit' direction
          amount: 1250,
          categoryId: 'leisure',
          note: 'Purchase',
          date: '2026-07-05',
        },
      ];

      const result = classifyMatch(baseParsed, transactions);
      expect(result.kind).toBe('high');
      expect(result.existingId).toBe('tx-001');
      expect(result.reason).toContain('direction match');
    });

    it('should return high when multiple signals match', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx-001',
          type: 'expense',
          amount: 1250,
          categoryId: 'dining',
          note: 'Swiggy order',
          date: '2026-07-05',
        },
      ];

      const result = classifyMatch(baseParsed, transactions);
      expect(result.kind).toBe('high');
      expect(result.reason).toContain('merchant token match');
      expect(result.reason).toContain('category match');
      expect(result.reason).toContain('direction match');
    });

    it('should match credit direction to income type', () => {
      const creditParsed: ParsedSms = {
        ...baseParsed,
        amount: 75000,
        direction: 'credit',
        merchant: 'Salary',
        dateISO: '2026-07-01',
        suggestedCategoryId: 'salary',
        reason: 'salary',
      };

      const transactions: Transaction[] = [
        {
          id: 'tx-001',
          type: 'income',
          amount: 75000,
          categoryId: 'salary',
          note: 'Monthly salary',
          date: '2026-07-01',
        },
      ];

      const result = classifyMatch(creditParsed, transactions);
      expect(result.kind).toBe('high');
      expect(result.reason).toContain('direction match');
    });
  });

  describe('Medium confidence matches', () => {
    it('should return medium when only amount and date match', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx-001',
          type: 'income', // wrong direction
          amount: 1250,
          categoryId: 'leisure', // wrong category
          note: 'Random note', // no merchant token
          date: '2026-07-05',
        },
      ];

      const result = classifyMatch(baseParsed, transactions);
      expect(result.kind).toBe('medium');
      expect(result.existingId).toBe('tx-001');
      expect(result.reason).toBe('Amount + date match, no corroborating signals');
    });

    it('should match within ±1 day window', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx-001',
          type: 'income',
          amount: 1250,
          categoryId: 'leisure',
          note: 'Random',
          date: '2026-07-04', // day before
        },
      ];

      const result = classifyMatch(baseParsed, transactions);
      expect(result.kind).toBe('medium');
      expect(result.existingId).toBe('tx-001');
    });
  });

  describe('No match cases', () => {
    it('should return none when amount differs', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx-001',
          type: 'expense',
          amount: 1251, // off by ₹1
          categoryId: 'dining',
          note: 'Swiggy',
          date: '2026-07-05',
        },
      ];

      const result = classifyMatch(baseParsed, transactions);
      expect(result.kind).toBe('none');
      expect(result.existingId).toBeNull();
    });

    it('should return none when date is >1 day off', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx-001',
          type: 'expense',
          amount: 1250,
          categoryId: 'dining',
          note: 'Swiggy',
          date: '2026-07-03', // 2 days before
        },
      ];

      const result = classifyMatch(baseParsed, transactions);
      expect(result.kind).toBe('none');
      expect(result.existingId).toBeNull();
    });

    it('should return none when no transactions provided', () => {
      const result = classifyMatch(baseParsed, []);
      expect(result.kind).toBe('none');
      expect(result.existingId).toBeNull();
    });
  });

  describe('Tie-breaking', () => {
    it('should prefer higher-scored candidate', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx-001',
          type: 'income', // wrong direction, score 0
          amount: 1250,
          categoryId: 'leisure',
          note: 'Random',
          date: '2026-07-05',
        },
        {
          id: 'tx-002',
          type: 'expense', // correct direction, score 1
          amount: 1250,
          categoryId: 'leisure',
          note: 'Random',
          date: '2026-07-05',
        },
      ];

      const result = classifyMatch(baseParsed, transactions);
      expect(result.kind).toBe('high');
      expect(result.existingId).toBe('tx-002');
    });

    it('should prefer nearest date when scores tie', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx-001',
          type: 'expense',
          amount: 1250,
          categoryId: 'leisure',
          note: 'Random',
          date: '2026-07-04', // 1 day before
        },
        {
          id: 'tx-002',
          type: 'expense',
          amount: 1250,
          categoryId: 'leisure',
          note: 'Random',
          date: '2026-07-05', // exact date
        },
      ];

      const result = classifyMatch(baseParsed, transactions);
      expect(result.existingId).toBe('tx-002');
    });

    it('should prefer earliest tx id when scores and dates tie', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx-002',
          type: 'expense',
          amount: 1250,
          categoryId: 'leisure',
          note: 'Random',
          date: '2026-07-05',
        },
        {
          id: 'tx-001',
          type: 'expense',
          amount: 1250,
          categoryId: 'leisure',
          note: 'Random',
          date: '2026-07-05',
        },
      ];

      const result = classifyMatch(baseParsed, transactions);
      expect(result.existingId).toBe('tx-001');
    });
  });

  describe('Merchant token matching', () => {
    it('should match multi-word merchant tokens', () => {
      const parsed = { ...baseParsed, merchant: 'Reliance Fresh' };
      const transactions: Transaction[] = [
        {
          id: 'tx-001',
          type: 'expense',
          amount: 1250,
          categoryId: 'groceries',
          note: 'Bought groceries at Reliance',
          date: '2026-07-05',
        },
      ];

      const result = classifyMatch(parsed, transactions);
      expect(result.kind).toBe('high');
      expect(result.reason).toContain('merchant token match');
    });

    it('should be case-insensitive', () => {
      const parsed = { ...baseParsed, merchant: 'SWIGGY' };
      const transactions: Transaction[] = [
        {
          id: 'tx-001',
          type: 'expense',
          amount: 1250,
          categoryId: 'dining',
          note: 'swiggy order',
          date: '2026-07-05',
        },
      ];

      const result = classifyMatch(parsed, transactions);
      expect(result.kind).toBe('high');
      expect(result.reason).toContain('merchant token match');
    });

    it('should ignore tokens shorter than 3 characters', () => {
      const parsed = { ...baseParsed, merchant: 'at HP' }; // "at" and "HP" both < 3 chars
      const transactions: Transaction[] = [
        {
          id: 'tx-001',
          type: 'expense',
          amount: 1250,
          categoryId: 'transport',
          note: 'Fuel at HP',
          date: '2026-07-05',
        },
      ];

      const result = classifyMatch(parsed, transactions);
      // Should still match on direction
      expect(result.kind).toBe('high');
      expect(result.reason).not.toContain('merchant token match');
    });
  });
});
