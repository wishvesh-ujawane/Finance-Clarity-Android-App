/**
 * Mock SMS reader for Phase 1 dev/test.
 * Provides realistic Indian bank transaction SMSes as fixtures.
 */

import type { SmsMessage, SmsReader } from './SmsReader';

/**
 * Fixture SMSes: 15 realistic messages from 6 Indian banks.
 * Mix: debit-card purchases, credit-card purchases, salary credit, bill payment, OTP, promotional.
 * All timestamps in July 2026 for consistency with existing test data.
 */
export const FIXTURE_SMSES: SmsMessage[] = [
  // HDFC Bank - Debit card purchase
  {
    id: 'msg-001',
    sender: 'HDFCBK',
    body: 'Rs 1,250.00 debited from A/c **4532 on 05-Jul-26 at Reliance Fresh using Debit Card. Avl Bal: Rs 45,320.50. Call 18002586161 for dispute.',
    timestamp: new Date('2026-07-05T10:30:00+05:30').getTime(),
  },
  // HDFC Bank - Credit card purchase
  {
    id: 'msg-002',
    sender: 'HDFCBK',
    body: 'Your HDFC Bank Card ending 7845 has been used for a transaction of Rs 3,499.00 at FLIPKART on 06-Jul-26. Avl limit: Rs 1,25,000.00.',
    timestamp: new Date('2026-07-06T14:22:00+05:30').getTime(),
  },
  // HDFC Bank - Salary credit
  {
    id: 'msg-003',
    sender: 'HDFCBK',
    body: 'Rs 75,000.00 credited to A/c **4532 on 01-Jul-26 (SALARY-JUN26). Avl Bal: Rs 1,15,320.50.',
    timestamp: new Date('2026-07-01T09:15:00+05:30').getTime(),
  },
  // ICICI Bank - Debit card swipe
  {
    id: 'msg-004',
    sender: 'ICICIB',
    body: 'Dear Customer, your A/c XX9876 has been debited with Rs 850.00 on 07-Jul-26 for a purchase at UBER INDIA via Debit Card. Available Balance: Rs 32,450.00.',
    timestamp: new Date('2026-07-07T20:10:00+05:30').getTime(),
  },
  // ICICI Bank - Credit card payment
  {
    id: 'msg-005',
    sender: 'ICICIB',
    body: 'Rs 12,300.00 paid towards your ICICI Bank Credit Card ending 5623 on 10-Jul-26. Payment received. Outstanding: Rs 2,145.00.',
    timestamp: new Date('2026-07-10T11:40:00+05:30').getTime(),
  },
  // SBI - Debit card purchase
  {
    id: 'msg-006',
    sender: 'SBIATM',
    body: 'Dear SBI User, Rs 2,100.50 debited from A/c **3421 on 08-Jul-26 at BIG BAZAAR by Debit Card XX9987. Avl Bal Rs 58,200.00. Not you? Call 1800112211.',
    timestamp: new Date('2026-07-08T16:55:00+05:30').getTime(),
  },
  // SBI - UPI payment
  {
    id: 'msg-007',
    sender: 'SBIPSG',
    body: 'Rs 450.00 debited from SBI A/c **3421 on 09-Jul-26 via UPI to merchant@paytm (REF: 234567890123). Avl Bal: Rs 57,750.00.',
    timestamp: new Date('2026-07-09T12:30:00+05:30').getTime(),
  },
  // Standard Chartered - Credit card
  {
    id: 'msg-008',
    sender: 'SCBANK',
    body: 'Your SC Credit Card XX4512 was used for INR 6,750.00 at SWIGGY on 11-Jul-26 at 19:45. If not you, call 18001034444.',
    timestamp: new Date('2026-07-11T19:45:00+05:30').getTime(),
  },
  // Standard Chartered - Salary credit
  {
    id: 'msg-009',
    sender: 'SCBANK',
    body: 'INR 92,500.00 has been credited to your SC A/c XX6789 on 01-Jul-26. Narration: SALARY-JUNE2026. Current Balance: INR 1,15,200.00.',
    timestamp: new Date('2026-07-01T10:05:00+05:30').getTime(),
  },
  // Bank of Maharashtra - Debit card
  {
    id: 'msg-010',
    sender: 'BKOFMH',
    body: 'Rs 1,599.00 debited from your BoM A/c **8765 on 12-Jul-26 at AMAZON via Debit Card. Avl Bal: Rs 29,850.00. For help, SMS BLOCK to 9222281818.',
    timestamp: new Date('2026-07-12T15:20:00+05:30').getTime(),
  },
  // Bank of Maharashtra - Bill payment
  {
    id: 'msg-011',
    sender: 'BKOFMH',
    body: 'Rs 2,450.00 debited from BoM A/c **8765 on 13-Jul-26 for Electricity Bill Payment (Ref: MSEDCL202607). Avl Bal: Rs 27,400.00.',
    timestamp: new Date('2026-07-13T10:15:00+05:30').getTime(),
  },
  // Bank of Baroda - Debit card
  {
    id: 'msg-012',
    sender: 'BOBATM',
    body: 'Dear Customer, INR 3,200.00 withdrawn from your BOB A/c XX5544 on 14-Jul-26 at ATM 123456, PUNE. Avl Bal: INR 41,800.00.',
    timestamp: new Date('2026-07-14T18:30:00+05:30').getTime(),
  },
  // Bank of Baroda - Credit
  {
    id: 'msg-013',
    sender: 'BOBATM',
    body: 'INR 5,000.00 credited to your BOB A/c XX5544 on 15-Jul-26. Ref: NEFT-N234567890. Avl Bal: INR 46,800.00.',
    timestamp: new Date('2026-07-15T11:25:00+05:30').getTime(),
  },
  // OTP message (non-financial, should be ignored by parser)
  {
    id: 'msg-014',
    sender: 'HDFCBK',
    body: 'Your OTP for login to HDFC NetBanking is 482956. Valid for 10 minutes. Do not share with anyone. -HDFC Bank',
    timestamp: new Date('2026-07-16T09:10:00+05:30').getTime(),
  },
  // Promotional message (non-financial)
  {
    id: 'msg-015',
    sender: 'ICICIB',
    body: 'Exclusive offer! Get 10% cashback on all dining transactions this weekend with your ICICI Credit Card. T&C apply. Reply STOP to opt-out.',
    timestamp: new Date('2026-07-17T08:00:00+05:30').getTime(),
  },
];

/**
 * Mock implementation returning the above fixtures.
 * Filters by timestamp range as the real reader will.
 */
export class MockSmsReader implements SmsReader {
  async readMessages(start: number, end: number): Promise<SmsMessage[]> {
    return FIXTURE_SMSES.filter(msg => msg.timestamp >= start && msg.timestamp <= end).sort(
      (a, b) => a.timestamp - b.timestamp,
    );
  }

  async hasPermission(): Promise<boolean> {
    // Mock reader always has permission (no permissions needed on web)
    return true;
  }

  async requestPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    // Mock reader always grants permission
    return 'granted';
  }
}

/** Singleton instance for convenience. */
export const mockSmsReader = new MockSmsReader();
