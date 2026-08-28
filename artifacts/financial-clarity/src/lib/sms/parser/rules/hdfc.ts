/**
 * SMS parsing rules for HDFC Bank.
 * Handles debit-card purchases, credit-card purchases, salary credits, and card bill payments.
 */

import type { SmsRule } from '../types';
import { parseCurrencyInput } from '../../../currency-utils';

/**
 * Extract amount from common HDFC formats:
 * "Rs 1,250.00", "Rs 3,499.00", etc.
 */
function extractAmount(body: string): number | null {
  // Match "Rs" followed by digits with optional commas and decimals
  const match = body.match(/Rs\.?\s*([\d,]+(?:\.\d{2})?)/i);
  if (!match) return null;
  const cleaned = match[1].replace(/,/g, '');
  const amt = parseCurrencyInput(cleaned);
  return amt > 0 ? amt : null;
}

/**
 * Extract last 4 digits after masking characters.
 * Looks for patterns like **4532, XX9876, ending 7845, etc.
 */
function extractAccountTail(body: string): string | null {
  const patterns = [
    /\*\*(\d{4})/,          // **4532
    /XX(\d{4})/i,           // XX9876
    /ending\s+(\d{4})/i,    // ending 7845
    /xxxx(\d{4})/i,         // xxxx1234
  ];
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract merchant name from "at MERCHANT on DD-MMM-YY" pattern.
 */
function extractMerchantAt(body: string): string | null {
  const match = body.match(/\bat\s+([A-Z][A-Za-z0-9\s&]+?)\s+(?:on|using)/i);
  if (!match) return null;
  return match[1].trim();
}

/**
 * Extract merchant from credit card transaction format.
 */
function extractMerchantCreditCard(body: string): string | null {
  // "at FLIPKART on 06-Jul-26"
  const match = body.match(/\bat\s+([A-Z][A-Za-z0-9\s&]+?)\s+on\s+\d{2}-[A-Za-z]{3}-\d{2}/i);
  if (!match) return null;
  return match[1].trim();
}

/**
 * Extract narration from credit transactions.
 */
function extractNarration(body: string): string | null {
  const match = body.match(/\(([^)]+)\)/);
  if (!match) return null;
  return match[1].trim();
}

export const hdfcRules: SmsRule[] = [
  // Rule: HDFC debit card purchase
  {
    id: 'hdfc.debit-card-purchase',
    senderMatches: /^HDFCBK$/i,
    bodyMatches: /debited.*using\s+Debit\s+Card/i,
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

  // Rule: HDFC credit card purchase
  {
    id: 'hdfc.credit-card-purchase',
    senderMatches: /^HDFCBK$/i,
    bodyMatches: /HDFC\s+Bank\s+Card.*used\s+for\s+a\s+transaction/i,
    parse: (msg) => {
      const amount = extractAmount(msg.body);
      if (!amount) return null;

      const merchant = extractMerchantCreditCard(msg.body);
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

  // Rule: HDFC salary credit
  {
    id: 'hdfc.salary-credit',
    senderMatches: /^HDFCBK$/i,
    bodyMatches: /credited.*SALARY/i,
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

  // Rule: HDFC card bill payment
  {
    id: 'hdfc.card-bill-payment',
    senderMatches: /^HDFCBK$/i,
    bodyMatches: /payment\s+received.*card|card\s+payment/i,
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

  // Rule: HDFC generic credit
  {
    id: 'hdfc.generic-credit',
    senderMatches: /^HDFCBK$/i,
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
