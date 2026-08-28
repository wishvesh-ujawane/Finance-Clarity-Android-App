/**
 * SMS-to-transaction reconciliation logic.
 * Classifies match confidence based on corroborating signals.
 */

import type { ParsedSms } from './parser/types';
import type { Transaction } from '../types';

export interface MatchClassification {
  kind: 'high' | 'medium' | 'none';
  existingId: string | null;
  reason: string;
}

/**
 * Classifies the match confidence between a parsed SMS and existing transactions.
 * 
 * Logic:
 * - High: amount + date match with ≥1 corroborating signal (merchant, category, direction)
 * - Medium: amount + date match but no corroborating signals
 * - None: no candidates match amount + date
 * 
 * Corroborating signals (each worth +1):
 * - Merchant token appears in existing transaction note or merchant field
 * - Category ID matches suggestion
 * - Direction matches (debit ↔ expense, credit ↔ income)
 */
export function classifyMatch(
  parsed: ParsedSms,
  transactions: Transaction[],
): MatchClassification {
  const parsedAmount = Math.round(parsed.amount * 100);
  const parsedDate = new Date(parsed.dateISO);
  const dayBefore = new Date(parsedDate);
  dayBefore.setDate(parsedDate.getDate() - 1);
  const dayAfter = new Date(parsedDate);
  dayAfter.setDate(parsedDate.getDate() + 1);

  const dateMin = dayBefore.toISOString().slice(0, 10);
  const dateMax = dayAfter.toISOString().slice(0, 10);

  // Find candidates: amount exact + date within ±1 day
  const candidates: Array<{ tx: Transaction; score: number; signals: string[] }> = [];

  for (const tx of transactions) {
    const txAmount = Math.round(tx.amount * 100);
    if (txAmount !== parsedAmount) continue;
    if (tx.date < dateMin || tx.date > dateMax) continue;

    // This is a candidate — score corroborating signals
    let score = 0;
    const signals: string[] = [];

    // Signal 1: Merchant token match
    if (parsed.merchant && parsed.merchant.length >= 3) {
      const merchantLower = parsed.merchant.toLowerCase();
      // Split into tokens (words) and check if any appear in tx note or merchant
      const tokens = merchantLower.split(/\s+/).filter(t => t.length >= 3);
      for (const token of tokens) {
        if (
          tx.note.toLowerCase().includes(token) ||
          (tx.merchant && tx.merchant.toLowerCase().includes(token))
        ) {
          score++;
          signals.push('merchant token match');
          break; // Only count once
        }
      }
    }

    // Signal 2: Category ID match
    if (
      parsed.suggestedCategoryId &&
      tx.categoryId === parsed.suggestedCategoryId
    ) {
      score++;
      signals.push('category match');
    }

    // Signal 3: Direction match
    const directionMatches =
      (parsed.direction === 'debit' && tx.type === 'expense') ||
      (parsed.direction === 'credit' && tx.type === 'income');
    if (directionMatches) {
      score++;
      signals.push('direction match');
    }

    candidates.push({ tx, score, signals });
  }

  if (candidates.length === 0) {
    return { kind: 'none', existingId: null, reason: 'No amount + date match found' };
  }

  // Sort candidates: highest score first, then nearest date, then earliest tx id
  candidates.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    const dateDistA = Math.abs(new Date(a.tx.date).getTime() - parsedDate.getTime());
    const dateDistB = Math.abs(new Date(b.tx.date).getTime() - parsedDate.getTime());
    if (dateDistA !== dateDistB) return dateDistA - dateDistB;
    return a.tx.id.localeCompare(b.tx.id);
  });

  const best = candidates[0];

  if (best.score >= 1) {
    return {
      kind: 'high',
      existingId: best.tx.id,
      reason: `Amount + date match with: ${best.signals.join(', ')}`,
    };
  }

  return {
    kind: 'medium',
    existingId: best.tx.id,
    reason: 'Amount + date match, no corroborating signals',
  };
}
