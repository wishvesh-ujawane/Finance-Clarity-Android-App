/**
 * SMS reader abstraction for Phase 1 foundation.
 * Defines the contract; mockSmsReader provides test/dev fixtures.
 * Real Capacitor plugin integration deferred to Phase 2+.
 */

import { Capacitor } from '@capacitor/core';
import { androidSmsReader } from './androidSmsReader';
import { mockSmsReader } from './mockSmsReader';

/** Raw SMS message from device inbox. */
export interface SmsMessage {
  /** Unique message ID from device database. */
  id: string;
  /** Sender identifier (phone number, shortcode, or alpha name). */
  sender: string;
  /** Message body text. */
  body: string;
  /** Received timestamp (milliseconds since epoch). */
  timestamp: number;
}

/**
 * Abstraction for reading SMS messages.
 * Phase 1: mockSmsReader returns fixtures.
 * Phase 2+: native reader via Capacitor plugin.
 */
export interface SmsReader {
  /**
   * Read all SMS messages in the given time range.
   * @param start - Start of range (ms since epoch, inclusive).
   * @param end - End of range (ms since epoch, inclusive).
   * @returns Array of messages in chronological order (oldest first).
   */
  readMessages(start: number, end: number): Promise<SmsMessage[]>;
}

/**
 * Get the appropriate SmsReader for the current platform.
 * Returns native Android reader on Android, mock reader elsewhere.
 */
export function getSmsReader(): SmsReader {
  if (Capacitor.getPlatform() === 'android') {
    return androidSmsReader;
  }
  return mockSmsReader;
}
