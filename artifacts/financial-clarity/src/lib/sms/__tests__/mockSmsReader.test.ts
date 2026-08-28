/**
 * Tests for mockSmsReader (Phase 1).
 * Verifies fixture data structure and timestamp filtering.
 */

import { describe, it, expect } from 'vitest';
import { mockSmsReader, FIXTURE_SMSES } from '../mockSmsReader';

describe('mockSmsReader', () => {
  it('FIXTURE_SMSES contains 15 messages', () => {
    expect(FIXTURE_SMSES).toHaveLength(15);
  });

  it('all fixtures have required fields', () => {
    for (const msg of FIXTURE_SMSES) {
      expect(msg.id).toBeTruthy();
      expect(typeof msg.id).toBe('string');
      expect(msg.sender).toBeTruthy();
      expect(typeof msg.sender).toBe('string');
      expect(msg.body).toBeTruthy();
      expect(typeof msg.body).toBe('string');
      expect(typeof msg.timestamp).toBe('number');
      expect(msg.timestamp).toBeGreaterThan(0);
    }
  });

  it('fixtures include major Indian banks', () => {
    const senders = FIXTURE_SMSES.map(m => m.sender);
    expect(senders).toContain('HDFCBK');
    expect(senders).toContain('ICICIB');
    expect(senders).toContain('SBIATM');
    expect(senders).toContain('SCBANK');
    expect(senders).toContain('BKOFMH');
    expect(senders).toContain('BOBATM');
  });

  it('fixtures include diverse transaction types', () => {
    const bodies = FIXTURE_SMSES.map(m => m.body.toLowerCase());
    const hasDebit = bodies.some(b => b.includes('debited') || b.includes('withdrawn'));
    const hasCredit = bodies.some(b => b.includes('credited') || b.includes('salary'));
    const hasOTP = bodies.some(b => b.includes('otp'));
    const hasPromo = bodies.some(b => b.includes('offer') || b.includes('cashback'));

    expect(hasDebit).toBe(true);
    expect(hasCredit).toBe(true);
    expect(hasOTP).toBe(true);
    expect(hasPromo).toBe(true);
  });

  it('readMessages filters by timestamp range (inclusive)', async () => {
    // July 5, 2026 00:00 to July 10, 2026 23:59
    const start = new Date('2026-07-05T00:00:00+05:30').getTime();
    const end = new Date('2026-07-10T23:59:59+05:30').getTime();

    const messages = await mockSmsReader.readMessages(start, end);

    expect(messages.length).toBeGreaterThan(0);
    for (const msg of messages) {
      expect(msg.timestamp).toBeGreaterThanOrEqual(start);
      expect(msg.timestamp).toBeLessThanOrEqual(end);
    }
  });

  it('readMessages returns messages in chronological order', async () => {
    const start = new Date('2026-07-01T00:00:00+05:30').getTime();
    const end = new Date('2026-07-31T23:59:59+05:30').getTime();

    const messages = await mockSmsReader.readMessages(start, end);

    for (let i = 1; i < messages.length; i++) {
      expect(messages[i].timestamp).toBeGreaterThanOrEqual(messages[i - 1].timestamp);
    }
  });

  it('readMessages returns empty array when no messages in range', async () => {
    const start = new Date('2025-01-01T00:00:00+05:30').getTime();
    const end = new Date('2025-01-31T23:59:59+05:30').getTime();

    const messages = await mockSmsReader.readMessages(start, end);
    expect(messages).toEqual([]);
  });

  it('readMessages includes boundary timestamps', async () => {
    // Pick the exact timestamp of the first fixture
    const firstMsg = FIXTURE_SMSES[0];
    const start = firstMsg.timestamp;
    const end = firstMsg.timestamp;

    const messages = await mockSmsReader.readMessages(start, end);
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages.some(m => m.id === firstMsg.id)).toBe(true);
  });
});
