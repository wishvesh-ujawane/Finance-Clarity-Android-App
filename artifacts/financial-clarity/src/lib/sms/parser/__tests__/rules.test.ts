/**
 * Test suite for SMS parsing rules.
 * Uses fixture-driven approach to validate all bank rules.
 */

import { describe, it, expect } from 'vitest';
import { parseSms } from '../index';
import { FIXTURE_SMSES } from '../../mockSmsReader';
import type { SmsMessage } from '../../SmsReader';
import type { ParsedSms } from '../types';

// Import all fixtures
import hdfcDebit from './fixtures/hdfc/debit-upi-purchase.json';
import hdfcCC from './fixtures/hdfc/credit-card-purchase.json';
import hdfcSalary from './fixtures/hdfc/salary-credit.json';
import hdfcOtp from './fixtures/hdfc/otp-decline.json';
import hdfcPayment from './fixtures/hdfc/card-bill-payment.json';

import iciciDebit from './fixtures/icici/debit-card-purchase.json';
import iciciPayment from './fixtures/icici/card-bill-payment.json';
import iciciSalary from './fixtures/icici/salary-credit.json';
import iciciPromo from './fixtures/icici/promo-decline.json';

import sbiDebit from './fixtures/sbi/debit-card-purchase.json';
import sbiUpi from './fixtures/sbi/upi-payment.json';
import sbiSalary from './fixtures/sbi/salary-credit.json';

import scbCC from './fixtures/scb/credit-card-purchase.json';
import scbSalary from './fixtures/scb/salary-credit.json';

import bomDebit from './fixtures/bom/debit-card-purchase.json';
import bomBill from './fixtures/bom/bill-payment.json';

import bobAtm from './fixtures/bob/atm-withdrawal.json';
import bobCredit from './fixtures/bob/generic-credit.json';

interface Fixture {
  input: SmsMessage;
  expected: Partial<ParsedSms> | null;
}

const ALL_FIXTURES: Array<{ name: string; fixture: Fixture }> = [
  { name: 'HDFC debit purchase', fixture: hdfcDebit as Fixture },
  { name: 'HDFC credit card purchase', fixture: hdfcCC as Fixture },
  { name: 'HDFC salary credit', fixture: hdfcSalary as Fixture },
  { name: 'HDFC OTP (decline)', fixture: hdfcOtp as Fixture },
  { name: 'HDFC card bill payment', fixture: hdfcPayment as Fixture },
  { name: 'ICICI debit purchase', fixture: iciciDebit as Fixture },
  { name: 'ICICI card bill payment', fixture: iciciPayment as Fixture },
  { name: 'ICICI salary credit', fixture: iciciSalary as Fixture },
  { name: 'ICICI promo (decline)', fixture: iciciPromo as Fixture },
  { name: 'SBI debit purchase', fixture: sbiDebit as Fixture },
  { name: 'SBI UPI payment', fixture: sbiUpi as Fixture },
  { name: 'SBI salary credit', fixture: sbiSalary as Fixture },
  { name: 'SCB credit card purchase', fixture: scbCC as Fixture },
  { name: 'SCB salary credit', fixture: scbSalary as Fixture },
  { name: 'BoM debit purchase', fixture: bomDebit as Fixture },
  { name: 'BoM bill payment', fixture: bomBill as Fixture },
  { name: 'BoB ATM withdrawal', fixture: bobAtm as Fixture },
  { name: 'BoB generic credit', fixture: bobCredit as Fixture },
];

describe('SMS Parser Rules', () => {
  describe.each(ALL_FIXTURES)('$name', ({ fixture }) => {
    it('should parse correctly', async () => {
      const result = await parseSms(fixture.input);

      if (fixture.expected === null) {
        expect(result).toBeNull();
      } else {
        expect(result).not.toBeNull();
        if (result) {
          // Verify all expected fields match
          for (const [key, value] of Object.entries(fixture.expected)) {
            expect(result[key as keyof ParsedSms]).toEqual(value);
          }

          // Verify technical fields are present
          expect(result.fingerprint).toMatch(/^[0-9a-f]{64}$/);
          expect(result.smsId).toBe(fixture.input.id);
          expect(result.senderId).toBeTruthy();
          expect(result.timestamp).toBe(fixture.input.timestamp);
          expect(result.dateISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(result.rawBody).toBe(fixture.input.body);
        }
      }
    });

    it('should produce stable fingerprints', async () => {
      const result1 = await parseSms(fixture.input);
      const result2 = await parseSms(fixture.input);

      if (fixture.expected !== null) {
        expect(result1).not.toBeNull();
        expect(result2).not.toBeNull();
        expect(result1?.fingerprint).toBe(result2?.fingerprint);
      }
    });
  });

  describe('FIXTURE_SMSES coverage', () => {
    // OTP and promo messages that should be rejected
    const INTENTIONAL_DECLINES = new Set(['msg-014', 'msg-015']);

    it('should parse all transactional FIXTURE_SMSES', async () => {
      const results = await Promise.all(
        FIXTURE_SMSES.map(async msg => ({
          id: msg.id,
          parsed: await parseSms(msg),
        })),
      );

      for (const { id, parsed } of results) {
        if (INTENTIONAL_DECLINES.has(id)) {
          expect(parsed).toBeNull();
        } else {
          expect(parsed).not.toBeNull();
          expect(parsed?.amount).toBeGreaterThan(0);
        }
      }
    });

    it('should have expected parse/reject counts', async () => {
      const results = await Promise.all(FIXTURE_SMSES.map(msg => parseSms(msg)));
      const parsed = results.filter(r => r !== null);
      const rejected = results.filter(r => r === null);

      expect(parsed.length).toBe(13); // 15 total - 2 intentional declines
      expect(rejected.length).toBe(2);
    });
  });
});
