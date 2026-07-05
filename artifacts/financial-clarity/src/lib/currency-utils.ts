import { z } from 'zod';

/**
 * Safe currency input parser for the Financial Clarity app.
 * 
 * Validates and sanitizes user-entered monetary amounts before performing
 * calculations. Prevents NaN, Infinity, and negative values from corrupting
 * money math.
 * 
 * @param input - User-entered string (e.g., from <input> fields)
 * @returns Non-negative finite number, or 0 if invalid
 * 
 * @example
 * parseCurrencyInput("1234.56")  // → 1234.56
 * parseCurrencyInput("  42  ")    // → 42
 * parseCurrencyInput("abc")       // → 0
 * parseCurrencyInput("-100")      // → 0
 * parseCurrencyInput("")          // → 0
 * parseCurrencyInput("Infinity")  // → 0
 */
export function parseCurrencyInput(input: string): number {
  // Trim whitespace
  const trimmed = input.trim();
  
  // Empty string → 0
  if (trimmed === '') return 0;
  
  // Validate: must be a valid number string (digits, optional decimal, optional leading -)
  // Reject strings with non-numeric characters like "12abc"
  if (!/^-?\d*\.?\d+$/.test(trimmed)) return 0;
  
  // Parse as number
  const parsed = Number.parseFloat(trimmed);
  
  // Reject NaN, Infinity, -Infinity, or negative values
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  
  // Clamp to reasonable upper bound (1 billion INR)
  // Prevents overflow in UI and keeps amounts sane for personal finance
  const MAX_AMOUNT = 1_000_000_000;
  if (parsed > MAX_AMOUNT) return MAX_AMOUNT;
  
  return parsed;
}

/**
 * Zod schema for validating currency input strings.
 * Use this in forms to validate before calling parseCurrencyInput.
 */
export const currencyInputSchema = z.string().refine(
  (val) => {
    const parsed = parseCurrencyInput(val);
    return parsed > 0;
  },
  { message: 'Amount must be a positive number' }
);

/**
 * Zod schema for non-zero positive currency amounts.
 * Returns the parsed number after validation.
 */
export const positiveAmountSchema = z.string().transform((val) => {
  const parsed = parseCurrencyInput(val);
  if (parsed <= 0) throw new Error('Amount must be greater than 0');
  return parsed;
});
