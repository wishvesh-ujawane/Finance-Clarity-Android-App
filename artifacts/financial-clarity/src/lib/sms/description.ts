/**
 * SMS description formatter for UI display.
 * Produces human-readable one-line descriptions from parsed SMS data.
 */

import type { ParsedSms } from './parser/types';

/**
 * Formats a parsed SMS into a display-friendly description.
 * 
 * Template: `{Merchant}{ · Sender ...tail}{ · MethodLabel}`
 * 
 * Fallbacks:
 * - Missing merchant + debit: Use payment method as prefix
 * - Missing tail: Omit the middle segment
 * - Salary credits: Use "Salary" as merchant if missing
 * 
 * Examples:
 * - "Swiggy · HDFC …4521 · Credit Card"
 * - "UPI · ICICI …9812 · Bank"
 * - "Salary · HDFC …4532 · Bank"
 * - "Card bill payment · HDFC …4521 · Credit Card Payment"
 */
export function formatSmsDescription(parsed: ParsedSms): string {
  const methodLabel = formatPaymentMethod(parsed.paymentMethod);
  
  // Determine merchant display
  let merchantPart: string;
  if (parsed.merchant) {
    merchantPart = parsed.merchant;
  } else if (parsed.reason === 'salary') {
    merchantPart = 'Salary';
  } else if (parsed.direction === 'debit') {
    // Debit without merchant: use a generic label
    merchantPart = parsed.paymentMethod === 'credit-card' ? 'Purchase' : 'Payment';
  } else {
    // Credit without merchant
    merchantPart = 'Transfer';
  }

  // Build middle segment: Sender ...tail (if tail available)
  const middlePart = parsed.accountTail
    ? `${parsed.senderId} …${parsed.accountTail}`
    : parsed.senderId;

  // Assemble final description
  return `${merchantPart} · ${middlePart} · ${methodLabel}`;
}

/**
 * Formats payment method into a human-readable label.
 */
function formatPaymentMethod(method: 'bank' | 'credit-card' | 'credit-card-payment'): string {
  switch (method) {
    case 'bank':
      return 'Bank';
    case 'credit-card':
      return 'Credit Card';
    case 'credit-card-payment':
      return 'Credit Card Payment';
  }
}
