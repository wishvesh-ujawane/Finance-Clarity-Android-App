/**
 * Category hint generator based on merchant keyword matching.
 * Phase 2 seed table — extensible in later phases.
 */

/**
 * Mapping of merchant keywords to category IDs.
 * Keys are lowercase substrings; first match wins.
 */
const MERCHANT_CATEGORY_HINTS: Array<{ pattern: RegExp; categoryId: string }> = [
  // Dining & food delivery
  { pattern: /swiggy|zomato|domino|pizza|kfc|mcdonald/i, categoryId: 'dining' },
  
  // Transport
  { pattern: /uber|ola|rapido|irctc|metro|petrol|hp|iocl|bpcl/i, categoryId: 'transport' },
  
  // Groceries
  { pattern: /bigbasket|blinkit|instamart|grofers|dmart|reliance fresh|milk/i, categoryId: 'groceries' },
  
  // Leisure / shopping
  { pattern: /amazon|flipkart|myntra|ajio|meesho/i, categoryId: 'leisure' },
  
  // Health
  { pattern: /apollo|pharmacy|medplus|1mg|netmeds|hospital|clinic/i, categoryId: 'health' },
  
  // Utilities / rent (broad bucket for bills)
  { pattern: /airtel|jio|vi|vodafone|electricity|water|gas|rent/i, categoryId: 'rent' },
];

/**
 * Suggests a category ID based on merchant name and direction.
 * Returns null if no keyword match is found.
 */
export function suggestCategoryId(
  merchant: string | null,
  direction: 'debit' | 'credit',
): string | null {
  // Credits: check for salary
  if (direction === 'credit' && merchant) {
    if (/salary|payroll|sal/i.test(merchant)) {
      return 'salary';
    }
  }

  // Debits: match merchant keywords
  if (direction === 'debit' && merchant) {
    const lower = merchant.toLowerCase();
    for (const { pattern, categoryId } of MERCHANT_CATEGORY_HINTS) {
      if (pattern.test(lower)) {
        return categoryId;
      }
    }
  }

  return null;
}
