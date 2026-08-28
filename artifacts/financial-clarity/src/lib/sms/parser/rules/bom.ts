/**
 * SMS parsing rules for Bank of Maharashtra (BoM).
 * Handles debit-card purchases, bill payments, and credits.
 */

import type { SmsRule } from '../types';
import { parseCurrencyInput } from '../../../currency-utils';

/**
 * Extract amount from BoM formats.
 */
function extractAmount(body: string): number | null {
  const match = body.match(/Rs\.?\s*([\d,]+(?:\.\d{2})?)/i);
  if (!match) return null;
  const cleaned = match[1].replace(/,/g, '');
  const amt = parseCurrencyInput(cleaned);
  return amt > 0 ? amt : null;
}

/**
 * Extract last 4 digits from BoM account/card patterns.
 */
function extractAccountTail(body: string): string | null {
  const patterns = [
    /A\/c\s+\*\*(\d{4})/i,       // A/c **8765
    /\*\*(\d{4})/,               // **8765
    /XX(\d{4})/i,                // XX1234
    /ending\s+(\d{4})/i,         // ending 1234
  ];
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract merchant from "at MERCHANT via" pattern.
 */
function extractMerchant(body: string): string | null {
  const match = body.match(/\bat\s+([A-Z][A-Za-z0-9\s&]+?)\s+via/i);
  if (!match) return null;
  return match[1].trim();
}

/**
 * Extract bill payment description from "for ... Bill Payment" pattern.
 */
function extractBillPayment(body: string): string | null {
  const match = body.match(/\bfor\s+([A-Za-z\s]+)\s+Bill\s+Payment/i);
  if (!match) return null;
  return match[1].trim();
}

/**
 * Extract transaction reference.
 */
function extractTxnRef(body: string): string | null {
  const match = body.match(/(?:Ref|REF):\s*([A-Z0-9]+)/i);
  if (!match) return null;
  return match[1];
}

export const bomRules: SmsRule[] = [
  // Rule: BoM debit card purchase
  {
    id: 'bom.debit-card-purchase',
    senderMatches: /^BKOFMH$/i,
    bodyMatches: /debited.*at.*via\s+Debit\s+Card/i,
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

  // Rule: BoM bill payment
  {
    id: 'bom.bill-payment',
    senderMatches: /^BKOFMH$/i,
    bodyMatches: /debited.*Bill\s+Payment/i,
    parse: (msg) => {
      const amount = extractAmount(msg.body);
      if (!amount) return null;

      const billType = extractBillPayment(msg.body);
      const accountTail = extractAccountTail(msg.body);
      const txnRef = extractTxnRef(msg.body);

      return {
        amount,
        direction: 'debit',
        merchant: billType ? `${billType} Bill Payment` : 'Bill Payment',
        accountTail,
        paymentMethod: 'bank',
        txnRef,
        reason: 'purchase',
      };
    },
  },

  // Rule: BoM salary credit
  {
    id: 'bom.salary-credit',
    senderMatches: /^BKOFMH$/i,
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

  // Rule: BoM generic credit
  {
    id: 'bom.generic-credit',
    senderMatches: /^BKOFMH$/i,
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
