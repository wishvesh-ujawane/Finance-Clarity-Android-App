/**
 * SMS deduplication utilities.
 * Provides fingerprinting, source-ref matching, and fuzzy duplicate detection.
 */

import type { SmsMessage } from './SmsReader';
import type { ParsedSms } from './parser/types';
import type { Transaction } from '../types';
import { sha256Hex } from '../backupHash';

/**
 * Normalize SMS sender by uppercasing and stripping DLT TRAI headers.
 * DLT headers are 2-letter prefixes followed by hyphen (e.g. AX-HDFCBK, VM-ICICIB).
 */
function normalizeSender(sender: string): string {
  return sender.replace(/^[A-Z]{2}-/i, '').toUpperCase().trim();
}

/**
 * Normalize SMS body for fingerprinting:
 * - Collapse whitespace
 * - Strip trailing bank name tags (e.g. "-HDFC Bank")
 */
function normalizeBody(body: string): string {
  return body
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/-[A-Za-z\s]+Bank$/i, '');
}

/**
 * Floor timestamp to the nearest minute (60,000 ms).
 * Same-minute variants of the same SMS will have identical fingerprints.
 */
function floorToMinute(timestamp: number): number {
  return Math.floor(timestamp / 60000) * 60000;
}

/**
 * Computes a SHA-256 fingerprint of an SMS message.
 * Fingerprint is based on: normalized sender | normalized body | timestamp floored to minute.
 * Returns a 64-character hex string.
 */
export async function smsFingerprint(msg: SmsMessage): Promise<string> {
  const sender = normalizeSender(msg.sender);
  const body = normalizeBody(msg.body);
  const ts = floorToMinute(msg.timestamp);
  const composite = `${sender}|${body}|${ts}`;
  return sha256Hex(composite);
}

/**
 * Checks if a parsed SMS matches an existing transaction by source fingerprint.
 * Returns the matching transaction, or null if none found.
 */
export function matchesExistingBySourceRef(
  parsed: ParsedSms,
  transactions: Transaction[],
): Transaction | null {
  for (const tx of transactions) {
    if (tx.sourceSmsFingerprint === parsed.fingerprint) {
      return tx;
    }
  }
  return null;
}

/**
 * Finds a possible fuzzy duplicate: same amount (to 2 decimal places) and date within ±1 day.
 * Returns the first matching transaction, or null if none found.
 */
export function findFuzzyDuplicate(
  parsed: ParsedSms,
  transactions: Transaction[],
): Transaction | null {
  const parsedAmount = Math.round(parsed.amount * 100);
  const parsedDate = new Date(parsed.dateISO);
  const dayBefore = new Date(parsedDate);
  dayBefore.setDate(parsedDate.getDate() - 1);
  const dayAfter = new Date(parsedDate);
  dayAfter.setDate(parsedDate.getDate() + 1);

  const dateMin = dayBefore.toISOString().slice(0, 10);
  const dateMax = dayAfter.toISOString().slice(0, 10);

  for (const tx of transactions) {
    const txAmount = Math.round(tx.amount * 100);
    if (txAmount !== parsedAmount) continue;

    if (tx.date >= dateMin && tx.date <= dateMax) {
      return tx;
    }
  }

  return null;
}
