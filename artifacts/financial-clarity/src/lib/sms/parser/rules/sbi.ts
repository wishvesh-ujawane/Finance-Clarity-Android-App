/**
 * SMS parsing rules for State Bank of India (SBI).
 * Handles debit-card purchases, UPI payments, and credits.
 */

import type { SmsRule } from '../types';
import { parseCurrencyInput } from '../../../currency-utils';

/**
 * Extract amount from SBI formats.
 */
function extractAmount(body: string): number | null {
  const match = body.match(/Rs\.?\s*([\d,]+(?:\.\d{2})?)/i);
  if (!match) return null;
  const cleaned = match[1].replace(/,/g, '');
  const amt = parseCurrencyInput(cleaned);
  return amt > 0 ? amt : null;
}

/**
 * Extract last 4 digits from SBI account/card patterns.
 */
function extractAccountTail(body: string): string | null {
  const patterns = [
    /A\/c\s+\*\*(\d{4})/i,       // A/c **3421
    /\*\*(\d{4})/,               // **3421
    /XX(\d{4})/i,                // XX9987
    /ending\s+(\d{4})/i,         // ending 1234
  ];
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract merchant from "at MERCHANT by" pattern.
 */
function extractMerchantAt(body: string): string | null {
  const match = body.match(/\bat\s+([A-Z][A-Za-z0-9\s&]+?)\s+(?:by|via)/i);
  if (!match) return null;
  return match[1].trim();
}

/**
 * Extract UPI payee from "to merchant@..." pattern.
 */
function extractUpiPayee(body: string): string | null {
  const match = body.match(/\bto\s+([a-z0-9._-]+@[a-z]+)/i);
  if (!match) return null;
  // Return just the username part before @
  const parts = match[1].split('@');
  return parts[0];
}

/**
 * Extract transaction reference from "(REF: ...)" pattern.
 */
function extractTxnRef(body: string): string | null {
  const match = body.match(/(?:REF|Ref):\s*([A-Z0-9]+)/i);
  if (!match) return null;
  return match[1];
}

export const sbiRules: SmsRule[] = [
  // Rule: SBI debit card purchase
  {
    id: 'sbi.debit-card-purchase',
    senderMatches: /^SBIATM$/i,
    bodyMatches: /debited.*at.*by\s+Debit\s+Card/i,
    parse: (msg) => {
      const amount = extractAmount(msg.body);
      if (!amount) return null;

      const merchant = extractMerchantAt(msg.body);
      const accountTail = extractAccountTail(msg.body);

      return {
        amount,
        direction: 'debit',
        merchant,
        accountTail,
        paymentMethod: 'bank',
        txnRef: null,
        reason: 'purchase',
      };
    },
  },

  // Rule: SBI ATM withdrawal
  {
    id: 'sbi.atm-withdrawal',
    senderMatches: /^SBIATM$/i,
    bodyMatches: /withdrawn.*ATM/i,
    parse: (msg) => {
      const amount = extractAmount(msg.body);
      if (!amount) return null;

      const accountTail = extractAccountTail(msg.body);

      return {
        amount,
        direction: 'debit',
        merchant: 'ATM Withdrawal',
        accountTail,
        paymentMethod: 'bank',
        txnRef: null,
        reason: 'purchase',
      };
    },
  },

  // Rule: SBI UPI payment
  {
    id: 'sbi.upi-payment',
    senderMatches: /^SBIPSG$/i,
    bodyMatches: /debited.*via\s+UPI/i,
    parse: (msg) => {
      const amount = extractAmount(msg.body);
      if (!amount) return null;

      const merchant = extractUpiPayee(msg.body);
      const accountTail = extractAccountTail(msg.body);
      const txnRef = extractTxnRef(msg.body);

      return {
        amount,
        direction: 'debit',
        merchant,
        accountTail,
        paymentMethod: 'bank',
        txnRef,
        reason: 'purchase',
      };
    },
  },

  // Rule: SBI salary credit
  {
    id: 'sbi.salary-credit',
    senderMatches: /^SBI/i,
    bodyMatches: /credited.*SALARY|SALARY.*credited/i,
    parse: (msg) => {
      const amount = extractAmount(msg.body);
      if (!amount) return null;

      const accountTail = extractAccountTail(msg.body);

      return {
        amount,
        direction: 'credit',
        merchant: 'Salary',
        accountTail,
        paymentMethod: 'bank',
        txnRef: null,
        reason: 'salary',
      };
    },
  },

  // Rule: SBI generic credit
  {
    id: 'sbi.generic-credit',
    senderMatches: /^SBI/i,
    bodyMatches: /credited/i,
    parse: (msg) => {
      const amount = extractAmount(msg.body);
      if (!amount) return null;

      const accountTail = extractAccountTail(msg.body);
      const txnRef = extractTxnRef(msg.body);

      return {
        amount,
        direction: 'credit',
        merchant: null,
        accountTail,
        paymentMethod: 'bank',
        txnRef,
        reason: 'transfer',
      };
    },
  },
];
