/**
 * SMS parsing rules for ICICI Bank.
 * Handles debit-card purchases, credit-card bill payments, and credits.
 */

import type { SmsRule } from '../types';
import { parseCurrencyInput } from '../../../currency-utils';

/**
 * Extract amount from ICICI formats:
 * "Rs 850.00", "Rs 12,300.00", etc.
 */
function extractAmount(body: string): number | null {
  const match = body.match(/Rs\.?\s*([\d,]+(?:\.\d{2})?)/i);
  if (!match) return null;
  const cleaned = match[1].replace(/,/g, '');
  const amt = parseCurrencyInput(cleaned);
  return amt > 0 ? amt : null;
}

/**
 * Extract last 4 digits from ICICI account/card patterns.
 */
function extractAccountTail(body: string): string | null {
  const patterns = [
    /A\/c\s+XX(\d{4})/i,        // A/c XX9876
    /XX(\d{4})/i,                // XX9876
    /ending\s+(\d{4})/i,         // ending 5623
    /\*\*(\d{4})/,               // **4532
  ];
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract merchant from "purchase at MERCHANT via" pattern.
 */
function extractMerchant(body: string): string | null {
  const match = body.match(/(?:purchase|transaction)\s+at\s+([A-Z][A-Za-z0-9\s&]+?)\s+(?:via|on)/i);
  if (!match) return null;
  return match[1].trim();
}

export const iciciRules: SmsRule[] = [
  // Rule: ICICI debit card purchase
  {
    id: 'icici.debit-card-purchase',
    senderMatches: /^ICICIB$/i,
    bodyMatches: /debited.*purchase.*Debit\s+Card/i,
    parse: (msg) => {
      const amount = extractAmount(msg.body);
      if (!amount) return null;

      const merchant = extractMerchant(msg.body);
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

  // Rule: ICICI credit card bill payment
  {
    id: 'icici.card-bill-payment',
    senderMatches: /^ICICIB$/i,
    bodyMatches: /paid\s+towards.*Credit\s+Card|Payment\s+received/i,
    parse: (msg) => {
      const amount = extractAmount(msg.body);
      if (!amount) return null;

      const accountTail = extractAccountTail(msg.body);

      return {
        amount,
        direction: 'debit',
        merchant: 'Card bill payment',
        accountTail,
        paymentMethod: 'credit-card-payment',
        txnRef: null,
        reason: 'card-payment',
      };
    },
  },

  // Rule: ICICI salary credit
  {
    id: 'icici.salary-credit',
    senderMatches: /^ICICIB$/i,
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

  // Rule: ICICI generic credit
  {
    id: 'icici.generic-credit',
    senderMatches: /^ICICIB$/i,
    bodyMatches: /credited/i,
    parse: (msg) => {
      const amount = extractAmount(msg.body);
      if (!amount) return null;

      const accountTail = extractAccountTail(msg.body);

      return {
        amount,
        direction: 'credit',
        merchant: null,
        accountTail,
        paymentMethod: 'bank',
        txnRef: null,
        reason: 'transfer',
      };
    },
  },
];
