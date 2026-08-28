/**
 * Test suite for category hint generator.
 */

import { describe, it, expect } from 'vitest';
import { suggestCategoryId } from '../categoryHint';

describe('suggestCategoryId', () => {
  describe('Debit (expense) hints', () => {
    it('should suggest dining for food delivery merchants', () => {
      expect(suggestCategoryId('Swiggy', 'debit')).toBe('dining');
      expect(suggestCategoryId('ZOMATO', 'debit')).toBe('dining');
      expect(suggestCategoryId('Dominos Pizza', 'debit')).toBe('dining');
      expect(suggestCategoryId('KFC BANGALORE', 'debit')).toBe('dining');
      expect(suggestCategoryId('McDonalds', 'debit')).toBe('dining');
    });

    it('should suggest transport for ride-sharing and travel', () => {
      expect(suggestCategoryId('UBER INDIA', 'debit')).toBe('transport');
      expect(suggestCategoryId('Ola Cabs', 'debit')).toBe('transport');
      expect(suggestCategoryId('RAPIDO', 'debit')).toBe('transport');
      expect(suggestCategoryId('IRCTC', 'debit')).toBe('transport');
      expect(suggestCategoryId('Metro Card', 'debit')).toBe('transport');
    });

    it('should suggest transport for fuel merchants', () => {
      expect(suggestCategoryId('PETROL PUMP', 'debit')).toBe('transport');
      expect(suggestCategoryId('HP FUEL', 'debit')).toBe('transport');
      expect(suggestCategoryId('IOCL', 'debit')).toBe('transport');
      expect(suggestCategoryId('BPCL STATION', 'debit')).toBe('transport');
    });

    it('should suggest groceries for grocery merchants', () => {
      expect(suggestCategoryId('BigBasket', 'debit')).toBe('groceries');
      expect(suggestCategoryId('BLINKIT', 'debit')).toBe('groceries');
      expect(suggestCategoryId('Instamart', 'debit')).toBe('groceries');
      expect(suggestCategoryId('GROFERS', 'debit')).toBe('groceries');
      expect(suggestCategoryId('DMart', 'debit')).toBe('groceries');
      expect(suggestCategoryId('Reliance Fresh', 'debit')).toBe('groceries');
      expect(suggestCategoryId('MILK BOOTH', 'debit')).toBe('groceries');
    });

    it('should suggest leisure for e-commerce', () => {
      expect(suggestCategoryId('AMAZON', 'debit')).toBe('leisure');
      expect(suggestCategoryId('Flipkart', 'debit')).toBe('leisure');
      expect(suggestCategoryId('MYNTRA', 'debit')).toBe('leisure');
      expect(suggestCategoryId('Ajio Fashion', 'debit')).toBe('leisure');
      expect(suggestCategoryId('MEESHO', 'debit')).toBe('leisure');
    });

    it('should suggest health for medical merchants', () => {
      expect(suggestCategoryId('Apollo Pharmacy', 'debit')).toBe('health');
      expect(suggestCategoryId('MEDPLUS', 'debit')).toBe('health');
      expect(suggestCategoryId('1MG', 'debit')).toBe('health');
      expect(suggestCategoryId('NetMeds', 'debit')).toBe('health');
      expect(suggestCategoryId('City Hospital', 'debit')).toBe('health');
      expect(suggestCategoryId('Dental Clinic', 'debit')).toBe('health');
    });

    it('should suggest rent for utilities and bills', () => {
      expect(suggestCategoryId('Airtel', 'debit')).toBe('rent');
      expect(suggestCategoryId('JIO RECHARGE', 'debit')).toBe('rent');
      expect(suggestCategoryId('VI Vodafone', 'debit')).toBe('rent');
      expect(suggestCategoryId('Electricity Bill', 'debit')).toBe('rent');
      expect(suggestCategoryId('Water Bill', 'debit')).toBe('rent');
      expect(suggestCategoryId('Gas Payment', 'debit')).toBe('rent');
      expect(suggestCategoryId('Monthly Rent', 'debit')).toBe('rent');
    });

    it('should be case-insensitive', () => {
      expect(suggestCategoryId('SWIGGY', 'debit')).toBe('dining');
      expect(suggestCategoryId('swiggy', 'debit')).toBe('dining');
      expect(suggestCategoryId('SwIgGy', 'debit')).toBe('dining');
    });

    it('should match substrings', () => {
      expect(suggestCategoryId('AMAZON.COM/SHOP', 'debit')).toBe('leisure');
      expect(suggestCategoryId('UBER INDIA PVT LTD', 'debit')).toBe('transport');
    });

    it('should return first match when multiple patterns could apply', () => {
      // "jio" matches transport pattern before rent pattern (based on order)
      expect(suggestCategoryId('JIO', 'debit')).toBe('rent');
    });
  });

  describe('Credit (income) hints', () => {
    it('should suggest salary for salary credits', () => {
      expect(suggestCategoryId('SALARY-JUN26', 'credit')).toBe('salary');
      expect(suggestCategoryId('Monthly Salary', 'credit')).toBe('salary');
      expect(suggestCategoryId('PAYROLL JUNE', 'credit')).toBe('salary');
      expect(suggestCategoryId('SAL CREDIT', 'credit')).toBe('salary');
    });

    it('should be case-insensitive for salary matching', () => {
      expect(suggestCategoryId('SALARY', 'credit')).toBe('salary');
      expect(suggestCategoryId('salary', 'credit')).toBe('salary');
      expect(suggestCategoryId('SaLaRy', 'credit')).toBe('salary');
    });

    it('should return null for non-salary credits', () => {
      expect(suggestCategoryId('NEFT Transfer', 'credit')).toBeNull();
      expect(suggestCategoryId('IMPS Received', 'credit')).toBeNull();
      expect(suggestCategoryId('Refund from Amazon', 'credit')).toBeNull();
    });
  });

  describe('Null / edge cases', () => {
    it('should return null for null merchant', () => {
      expect(suggestCategoryId(null, 'debit')).toBeNull();
      expect(suggestCategoryId(null, 'credit')).toBeNull();
    });

    it('should return null for empty merchant', () => {
      expect(suggestCategoryId('', 'debit')).toBeNull();
      expect(suggestCategoryId('', 'credit')).toBeNull();
    });

    it('should return null for unrecognized merchants', () => {
      expect(suggestCategoryId('Random Shop ABC', 'debit')).toBeNull();
      expect(suggestCategoryId('Unknown Merchant', 'debit')).toBeNull();
    });

    it('should return null for whitespace-only merchant', () => {
      expect(suggestCategoryId('   ', 'debit')).toBeNull();
    });
  });

  describe('Partial keyword matches', () => {
    it('should match "pay" within merchant name', () => {
      // "pay" could match "payroll" for salary
      expect(suggestCategoryId('Acme Corp Payroll', 'credit')).toBe('salary');
    });

    it('should not over-match short substrings', () => {
      // "a" in "Amazon" shouldn't false-positive on unrelated pattern
      const result = suggestCategoryId('Amazon', 'debit');
      expect(result).toBe('leisure'); // correct match
    });
  });
});
