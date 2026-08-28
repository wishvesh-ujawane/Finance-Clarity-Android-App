/**
 * Android SMS reader via Capacitor plugin (Phase 3).
 * Bridges the native SmsInboxPlugin to the SmsReader interface.
 */

import { registerPlugin } from '@capacitor/core';
import type { SmsMessage, SmsReader } from './SmsReader';

/** Native plugin interface matching the Java surface. */
interface SmsInboxPluginNative {
  hasPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ state: 'granted' | 'denied' | 'prompt' }>;
  readInbox(options: { sinceMs: number }): Promise<{ messages: SmsMessage[] }>;
}

const SmsInbox = registerPlugin<SmsInboxPluginNative>('SmsInbox');

/** Thrown when SMS permission is denied. */
export class SmsReaderPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SmsReaderPermissionError';
  }
}

/** Thrown when SMS inbox query fails. */
export class SmsReaderQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SmsReaderQueryError';
  }
}

/** Android SmsReader implementation via Capacitor plugin. */
class AndroidSmsReader implements SmsReader {
  /**
   * Read messages in the given time range.
   * Internally calls native readInbox(start) and filters to end.
   */
  async readMessages(start: number, end: number): Promise<SmsMessage[]> {
    try {
      const result = await SmsInbox.readInbox({ sinceMs: start });
      // Filter to end range (native returns all messages >= start)
      return result.messages
        .filter(msg => msg.timestamp <= end)
        .sort((a, b) => a.timestamp - b.timestamp); // Chronological order
    } catch (error: any) {
      // Translate native error codes to typed exceptions
      if (error?.message?.includes('PERMISSION_DENIED')) {
        throw new SmsReaderPermissionError(error.message);
      }
      if (error?.message?.includes('QUERY_FAILED')) {
        throw new SmsReaderQueryError(error.message);
      }
      // Pass through other errors
      throw error;
    }
  }

  /** Check if READ_SMS permission is granted. */
  async hasPermission(): Promise<boolean> {
    const result = await SmsInbox.hasPermission();
    return result.granted;
  }

  /** Request READ_SMS permission from the user. */
  async requestPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    const result = await SmsInbox.requestPermission();
    return result.state;
  }
}

/** Singleton instance for use in getSmsReader(). */
export const androidSmsReader: SmsReader = new AndroidSmsReader();
