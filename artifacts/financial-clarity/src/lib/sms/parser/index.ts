/**
 * SMS parser entry point.
 * Orchestrates rule matching and adds technical fields (fingerprint, timestamps, category hints).
 */

import type { SmsMessage } from '../SmsReader';
import type { ParsedSms, SmsRule } from './types';
import { smsFingerprint } from '../dedup';
import { suggestCategoryId } from '../categoryHint';
import { hdfcRules } from './rules/hdfc';
import { iciciRules } from './rules/icici';
import { sbiRules } from './rules/sbi';
import { scbRules } from './rules/scb';
import { bomRules } from './rules/bom';
import { bobRules } from './rules/bob';

/** All rule packs, flattened into a single array. */
const ALL_RULES: SmsRule[] = [
  ...hdfcRules,
  ...iciciRules,
  ...sbiRules,
  ...scbRules,
  ...bomRules,
  ...bobRules,
];

/**
 * Normalize sender ID by uppercasing and stripping DLT TRAI headers.
 * DLT headers are 2-letter prefixes followed by hyphen (e.g. AX-HDFCBK, VM-ICICIB).
 */
function normalizeSenderId(sender: string): string {
  return sender.replace(/^[A-Z]{2}-/i, '').toUpperCase().trim();
}

/**
 * Convert SMS timestamp to YYYY-MM-DD in device local timezone.
 */
function timestampToDateISO(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse an SMS message into a structured transaction.
 * Returns null if the message is non-financial (OTP, promo, etc.) or unrecognized.
 * Async due to fingerprint computation.
 */
export async function parseSms(msg: SmsMessage): Promise<ParsedSms | null> {
  const senderId = normalizeSenderId(msg.sender);

  // Walk rules in order; first match wins
  for (const rule of ALL_RULES) {
    // Fast reject: sender doesn't match
    if (!rule.senderMatches.test(senderId)) {
      continue;
    }

    // Fast reject: body doesn't match
    if (!rule.bodyMatches.test(msg.body)) {
      continue;
    }

    // Try to parse semantic fields
    const parsed = rule.parse(msg);
    if (!parsed) {
      continue;
    }

    // Add technical fields
    const fingerprint = await smsFingerprint(msg);
    const dateISO = timestampToDateISO(msg.timestamp);
    const suggestedCategoryId = suggestCategoryId(parsed.merchant, parsed.direction);

    return {
      smsId: msg.id,
      fingerprint,
      senderId,
      timestamp: msg.timestamp,
      dateISO,
      rawBody: msg.body,
      suggestedCategoryId,
      ...parsed,
    };
  }

  // No rule matched — non-financial or unsupported sender
  return null;
}
