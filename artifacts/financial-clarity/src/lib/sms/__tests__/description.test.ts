/**
 * Test suite for SMS description formatting.
 */

import { describe, it, expect } from 'vitest';
import { formatSmsDescription } from '../description';
import type { ParsedSms } from '../parser/types';

describe('formatSmsDescription', () => {
  const baseProps = {
    smsId: 'msg-001',
    fingerprint: 'abc123' + '0'.repeat(58),
    senderId: 'HDFCBK',
    timestamp: Date.now(),
    dateISO: '2026-07-05',
    suggestedCategoryId: null,
    rawBody: 'test body',
  };

  describe('Full format with all fields', () => {
    it('should format bank debit with merchant and account tail', () => {
      const parsed: ParsedSms = {
        ...baseProps,
        amount: 1250,
        direction: 'debit',
        merchant: 'Reliance Fresh',
        accountTail: '4532',
        paymentMethod: 'bank',
        txnRef: null,
        reason: 'purchase',
      };

      const result = formatSmsDescription(parsed);
      expect(result).toBe('Reliance Fresh · HDFCBK …4532 · Bank');
    });

    it('should format credit card purchase with merchant and tail', () => {
      const parsed: ParsedSms = {
        ...baseProps,
        amount: 3499,
        direction: 'debit',
        merchant: 'Swiggy',
        accountTail: '7845',
        paymentMethod: 'credit-card',
        txnRef: null,
        reason: 'purchase',
      };

      const result = formatSmsDescription(parsed);
      expect(result).toBe('Swiggy · HDFCBK …7845 · Credit Card');
    });

    it('should format card bill payment', () => {
      const parsed: ParsedSms = {
        ...baseProps,
        amount: 12300,
        direction: 'debit',
        merchant: 'Card bill payment',
        accountTail: '5623',
        paymentMethod: 'credit-card-payment',
        txnRef: null,
        reason: 'card-payment',
      };

      const result = formatSmsDescription(parsed);
      expect(result).toBe('Card bill payment · HDFCBK …5623 · Credit Card Payment');
    });
  });

  describe('Missing merchant fallbacks', () => {
    it('should use "Payment" for bank debit without merchant', () => {
      const parsed: ParsedSms = {
        ...baseProps,
        amount: 850,
        direction: 'debit',
        merchant: null,
        accountTail: '9876',
        paymentMethod: 'bank',
        txnRef: null,
        reason: 'purchase',
      };

      const result = formatSmsDescription(parsed);
      expect(result).toBe('Payment · HDFCBK …9876 · Bank');
    });

    it('should use "Purchase" for credit card debit without merchant', () => {
      const parsed: ParsedSms = {
        ...baseProps,
        amount: 1599,
        direction: 'debit',
        merchant: null,
        accountTail: '8765',
        paymentMethod: 'credit-card',
        txnRef: null,
        reason: 'purchase',
      };

      const result = formatSmsDescription(parsed);
      expect(result).toBe('Purchase · HDFCBK …8765 · Credit Card');
    });

    it('should use "Salary" for salary credits without merchant', () => {
      const parsed: ParsedSms = {
        ...baseProps,
        amount: 75000,
        direction: 'credit',
        merchant: null,
        accountTail: '4532',
        paymentMethod: 'bank',
        txnRef: null,
        reason: 'salary',
      };

      const result = formatSmsDescription(parsed);
      expect(result).toBe('Salary · HDFCBK …4532 · Bank');
    });

    it('should use "Transfer" for credit without merchant', () => {
      const parsed: ParsedSms = {
        ...baseProps,
        amount: 5000,
        direction: 'credit',
        merchant: null,
        accountTail: '5544',
        paymentMethod: 'bank',
        txnRef: 'NEFT-N234567890',
        reason: 'transfer',
      };

      const result = formatSmsDescription(parsed);
      expect(result).toBe('Transfer · HDFCBK …5544 · Bank');
    });
  });

  describe('Missing account tail', () => {
    it('should omit tail segment when not available', () => {
      const parsed: ParsedSms = {
        ...baseProps,
        amount: 450,
        direction: 'debit',
        merchant: 'UPI Payment',
        accountTail: null,
        paymentMethod: 'bank',
        txnRef: '234567890123',
        reason: 'purchase',
      };

      const result = formatSmsDescription(parsed);
      expect(result).toBe('UPI Payment · HDFCBK · Bank');
    });
  });

  describe('Salary credits', () => {
    it('should preserve merchant when provided for salary', () => {
      const parsed: ParsedSms = {
        ...baseProps,
        senderId: 'SCBANK',
        amount: 92500,
        direction: 'credit',
        merchant: 'SALARY-JUNE2026',
        accountTail: '6789',
        paymentMethod: 'bank',
        txnRef: null,
        reason: 'salary',
      };

      const result = formatSmsDescription(parsed);
      expect(result).toBe('SALARY-JUNE2026 · SCBANK …6789 · Bank');
    });
  });

  describe('Different senders', () => {
    it('should work with ICICI sender', () => {
      const parsed: ParsedSms = {
        ...baseProps,
        senderId: 'ICICIB',
        amount: 850,
        direction: 'debit',
        merchant: 'UBER INDIA',
        accountTail: '9876',
        paymentMethod: 'bank',
        txnRef: null,
        reason: 'purchase',
      };

      const result = formatSmsDescription(parsed);
      expect(result).toBe('UBER INDIA · ICICIB …9876 · Bank');
    });

    it('should work with SBI sender', () => {
      const parsed: ParsedSms = {
        ...baseProps,
        senderId: 'SBIATM',
        amount: 2100.5,
        direction: 'debit',
        merchant: 'BIG BAZAAR',
        accountTail: '3421',
        paymentMethod: 'bank',
        txnRef: null,
        reason: 'purchase',
      };

      const result = formatSmsDescription(parsed);
      expect(result).toBe('BIG BAZAAR · SBIATM …3421 · Bank');
    });
  });

  describe('Real-world examples from FIXTURE_SMSES', () => {
    it('msg-001: HDFC debit at Reliance Fresh', () => {
      const parsed: ParsedSms = {
        ...baseProps,
        amount: 1250,
        direction: 'debit',
        merchant: 'Reliance Fresh',
        accountTail: '4532',
        paymentMethod: 'bank',
        txnRef: null,
        reason: 'purchase',
      };

      expect(formatSmsDescription(parsed)).toBe('Reliance Fresh · HDFCBK …4532 · Bank');
    });

    it('msg-002: HDFC credit card at FLIPKART', () => {
      const parsed: ParsedSms = {
        ...baseProps,
        amount: 3499,
        direction: 'debit',
        merchant: 'FLIPKART',
        accountTail: '7845',
        paymentMethod: 'credit-card',
        txnRef: null,
        reason: 'purchase',
      };

      expect(formatSmsDescription(parsed)).toBe('FLIPKART · HDFCBK …7845 · Credit Card');
    });

    it('msg-005: ICICI card bill payment', () => {
      const parsed: ParsedSms = {
        ...baseProps,
        senderId: 'ICICIB',
        amount: 12300,
        direction: 'debit',
        merchant: 'Card bill payment',
        accountTail: '5623',
        paymentMethod: 'credit-card-payment',
        txnRef: null,
        reason: 'card-payment',
      };

      expect(formatSmsDescription(parsed)).toBe(
        'Card bill payment · ICICIB …5623 · Credit Card Payment',
      );
    });

    it('msg-012: BoB ATM withdrawal', () => {
      const parsed: ParsedSms = {
        ...baseProps,
        senderId: 'BOBATM',
        amount: 3200,
        direction: 'debit',
        merchant: 'ATM Withdrawal',
        accountTail: '5544',
        paymentMethod: 'bank',
        txnRef: null,
        reason: 'purchase',
      };

      expect(formatSmsDescription(parsed)).toBe('ATM Withdrawal · BOBATM …5544 · Bank');
    });
  });
});
