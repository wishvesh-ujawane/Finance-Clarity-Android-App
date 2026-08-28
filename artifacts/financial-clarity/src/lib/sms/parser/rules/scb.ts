/**
 * SMS parsing rules for Standard Chartered Bank (SC).
 * Handles credit-card purchases, salary credits, and other transactions.
 */

import type { SmsRule } from '../types';
import { parseCurrencyInput } from '../../../currency-utils';

/**
 * Extract amount from SC formats (uses "INR" instead of "Rs").
 */
function extractAmount(body: string): number | null {
  const match = body.match(/INR\s*([\d,]+(?:\.\d{2})?)/i);
  if (!match) return null;
  const cleaned = match[1].replace(/,/g, '');
  const amt = parseCurrencyInput(cleaned);
  return amt > 0 ? amt : null;
}

/**
 * Extract last 4 digits from SC account/card patterns.
 */
function extractAccountTail(body: string): string | null {
  const patterns = [
    /XX(\d{4})/i,                // XX4512
    /A\/c\s+XX(\d{4})/i,         // A/c XX6789
    /ending\s+(\d{4})/i,         // ending 1234
    /\*\*(\d{4})/,               // **1234
  ];
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract merchant from "at MERCHANT on" pattern.
 */
function extractMerchant(body: string): string | null {
  const match = body.match(/\bat\s+([A-Z][A-Za-z0-9\s&]+?)\s+on\s+\d{2}-[A-Za-z]{3}-\d{2}/i);
  if (!match) return null;
  return match[1].trim();
}

/**
 * Extract narration from "Narration: ..." pattern.
 */
function extractNarration(body: string): string | null {
  const match = body.match(/Narration:\s*([A-Z0-9-]+)/i);
  if (!match) return null;
  return match[1].trim();
}

export const scbRules: SmsRule[] = [
  // Rule: SC credit card purchase
  {
    id: 'scb.credit-card-purchase',
    senderMatches: /^SCBANK$/i,
    bodyMatches: /Credit\s+Card.*used\s+for\s+INR/i,
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
        paymentMethod: 'credit-card',
        txnRef: null,
        reason: 'purchase',
      };
    },
  },

  // Rule: SC salary credit
  {
    id: 'scb.salary-credit',
    senderMatches: /^SCBANK$/i,
    bodyMatches: /credited.*Narration:\s*SALARY/i,
    parse: (msg) => {
      const amount = extractAmount(msg.body);
      if (!amount) return null;

      const accountTail = extractAccountTail(msg.body);
      const narration = extractNarration(msg.body);

      return {
        amount,
        direction: 'credit',
        merchant: narration || 'Salary',
        accountTail,
        paymentMethod: 'bank',
        txnRef: null,
        reason: 'salary',
      };
    },
  },

  // Rule: SC generic debit
  {
    id: 'scb.generic-debit',
    senderMatches: /^SCBANK$/i,
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

  // Rule: SC generic credit
  {
    id: 'scb.generic-credit',
    senderMatches: /^SCBANK$/i,
    bodyMatches: /credited/i,
    parse: (msg) => {
      const amount = extractAmount(msg.body);
      if (!amount) return null;

      const accountTail = extractAccountTail(msg.body);
      const narration = extractNarration(msg.body);

      return {
        amount,
        direction: 'credit',
        merchant: narration,
        accountTail,
        paymentMethod: 'bank',
        txnRef: null,
        reason: 'transfer',
      };
    },
  },
];
