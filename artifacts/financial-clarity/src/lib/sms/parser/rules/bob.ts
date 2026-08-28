/**
 * SMS parsing rules for Bank of Baroda (BoB).
 * Handles ATM withdrawals, credits, and other transactions.
 */

import type { SmsRule } from '../types';
import { parseCurrencyInput } from '../../../currency-utils';

/**
 * Extract amount from BoB formats (uses "INR").
 */
function extractAmount(body: string): number | null {
  const match = body.match(/INR\s*([\d,]+(?:\.\d{2})?)/i);
  if (!match) return null;
  const cleaned = match[1].replace(/,/g, '');
  const amt = parseCurrencyInput(cleaned);
  return amt > 0 ? amt : null;
}

/**
 * Extract last 4 digits from BoB account patterns.
 */
function extractAccountTail(body: string): string | null {
  const patterns = [
    /A\/c\s+XX(\d{4})/i,         // A/c XX5544
    /XX(\d{4})/i,                // XX5544
    /\*\*(\d{4})/,               // **1234
    /ending\s+(\d{4})/i,         // ending 1234
  ];
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract transaction reference.
 */
function extractTxnRef(body: string): string | null {
  const match = body.match(/(?:Ref|REF):\s*([A-Z0-9-]+)/i);
  if (!match) return null;
  return match[1];
}

export const bobRules: SmsRule[] = [
  // Rule: BoB ATM withdrawal
  {
    id: 'bob.atm-withdrawal',
    senderMatches: /^BOBATM$/i,
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

  // Rule: BoB salary credit
  {
    id: 'bob.salary-credit',
    senderMatches: /^BOBATM$/i,
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

  // Rule: BoB generic credit
  {
    id: 'bob.generic-credit',
    senderMatches: /^BOBATM$/i,
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

  // Rule: BoB generic debit
  {
    id: 'bob.generic-debit',
    senderMatches: /^BOBATM$/i,
    bodyMatches: /debited/i,
    parse: (msg) => {
      const amount = extractAmount(msg.body);
      if (!amount) return null;

      const accountTail = extractAccountTail(msg.body);

      return {
        amount,
        direction: 'debit',
        merchant: null,
        accountTail,
        paymentMethod: 'bank',
        txnRef: null,
        reason: 'purchase',
      };
    },
  },
];
