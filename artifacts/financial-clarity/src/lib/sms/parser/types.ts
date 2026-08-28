/**
 * Public types for the SMS parser layer.
 * Phase 2 foundation — defines the parsed structure and rule contract.
 */

import type { SmsMessage } from '../SmsReader';

/**
 * Parsed SMS transaction. Includes both semantic fields (amount, merchant)
 * and technical bookkeeping (fingerprint, timestamps).
 */
export interface ParsedSms {
  /** Original SMS id from device. */
  smsId: string;
  /** SHA-256 fingerprint (64 hex chars) for deduplication. */
  fingerprint: string;
  /** Normalized sender identifier (e.g. 'HDFCBK', 'ICICIB'). */
  senderId: string;
  /** Transaction amount in INR (positive number). */
  amount: number;
  /** Debit or credit. */
  direction: 'debit' | 'credit';
  /** Merchant / payee name (null if not extractable). */
  merchant: string | null;
  /** Last 4 digits of account/card, e.g. '4532' (null if not extractable). */
  accountTail: string | null;
  /** Payment method. Note: 'cash' never appears here — parser only sees electronic transactions. */
  paymentMethod: 'bank' | 'credit-card' | 'credit-card-payment';
  /** Transaction reference (UPI ref / RRN). Hard dedup key when present. */
  txnRef: string | null;
  /** Timestamp from SMS (ms since epoch). */
  timestamp: number;
  /** Date in YYYY-MM-DD format, device local timezone. */
  dateISO: string;
  /** Suggested category id based on merchant keyword matching. */
  suggestedCategoryId: string | null;
  /** Transaction reason / type. */
  reason: 'purchase' | 'refund' | 'salary' | 'card-payment' | 'transfer' | 'unknown';
  /** Raw SMS body (preserved for UI display, never logged). */
  rawBody: string;
}

/**
 * An SMS parsing rule. Rules are organized by sender (bank) and tested in
 * order until one matches.
 */
export interface SmsRule {
  /** Rule identifier for debugging (e.g. 'hdfc.debit-card-purchase'). */
  id: string;
  /** Regex to test normalized sender. */
  senderMatches: RegExp;
  /** Regex to test SMS body. Rule skipped if this doesn't match. */
  bodyMatches: RegExp;
  /**
   * Extract semantic fields from the SMS.
   * Returns null if the SMS is non-financial (OTP, promo, etc.).
   * The main parser adds technical fields (fingerprint, timestamps, etc.).
   */
  parse: (
    msg: SmsMessage,
  ) =>
    | Omit<
        ParsedSms,
        | 'smsId'
        | 'fingerprint'
        | 'senderId'
        | 'timestamp'
        | 'dateISO'
        | 'rawBody'
        | 'suggestedCategoryId'
      >
    | null;
}
