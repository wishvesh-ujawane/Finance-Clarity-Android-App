import { describe, it, expect } from 'vitest';
import { parseCurrencyInput } from '../currency-utils';

describe('parseCurrencyInput', () => {
  it('parses valid positive numbers', () => {
    expect(parseCurrencyInput('100')).toBe(100);
    expect(parseCurrencyInput('1234.56')).toBe(1234.56);
    expect(parseCurrencyInput('0.01')).toBe(0.01);
    expect(parseCurrencyInput('999999')).toBe(999999);
  });

  it('handles whitespace', () => {
    expect(parseCurrencyInput('  42  ')).toBe(42);
    expect(parseCurrencyInput('\t100\n')).toBe(100);
  });

  it('returns 0 for empty strings', () => {
    expect(parseCurrencyInput('')).toBe(0);
    expect(parseCurrencyInput('   ')).toBe(0);
  });

  it('returns 0 for invalid inputs', () => {
    expect(parseCurrencyInput('abc')).toBe(0);
    expect(parseCurrencyInput('12abc')).toBe(0); // parseFloat would return 12
    expect(parseCurrencyInput('not-a-number')).toBe(0);
  });

  it('returns 0 for negative numbers', () => {
    expect(parseCurrencyInput('-100')).toBe(0);
    expect(parseCurrencyInput('-0.01')).toBe(0);
  });

  it('returns 0 for special numeric values', () => {
    expect(parseCurrencyInput('NaN')).toBe(0);
    expect(parseCurrencyInput('Infinity')).toBe(0);
    expect(parseCurrencyInput('-Infinity')).toBe(0);
  });

  it('clamps to max amount (1 billion)', () => {
    expect(parseCurrencyInput('1000000000')).toBe(1_000_000_000);
    expect(parseCurrencyInput('2000000000')).toBe(1_000_000_000);
    expect(parseCurrencyInput('999999999999')).toBe(1_000_000_000);
  });

  it('handles decimal precision', () => {
    expect(parseCurrencyInput('123.456789')).toBe(123.456789);
    expect(parseCurrencyInput('0.123456')).toBe(0.123456);
  });

  it('handles leading zeros', () => {
    expect(parseCurrencyInput('0100')).toBe(100);
    expect(parseCurrencyInput('00.50')).toBe(0.5);
  });
});
