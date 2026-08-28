/**
 * Tests for androidSmsReader (Phase 3).
 * Verifies TypeScript bridge behavior with mocked Capacitor plugin.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SmsMessage } from '../SmsReader';

// Create mock plugin methods
const mockHasPermission = vi.fn();
const mockRequestPermission = vi.fn();
const mockReadInbox = vi.fn();

// Mock the Capacitor core module with a stable mock instance
vi.mock('@capacitor/core', () => ({
  registerPlugin: vi.fn(() => ({
    hasPermission: mockHasPermission,
    requestPermission: mockRequestPermission,
    readInbox: mockReadInbox,
  })),
  Capacitor: {
    getPlatform: vi.fn(),
  },
}));

describe('androidSmsReader', () => {
  let androidSmsReader: any;
  let SmsReaderPermissionError: any;
  let SmsReaderQueryError: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import module (will use the mocked registerPlugin)
    const module = await import('../androidSmsReader');
    androidSmsReader = module.androidSmsReader;
    SmsReaderPermissionError = module.SmsReaderPermissionError;
    SmsReaderQueryError = module.SmsReaderQueryError;
  });

  describe('readMessages', () => {
    it('calls native readInbox with start timestamp', async () => {
      const mockMessages: SmsMessage[] = [
        { id: '1', sender: 'BANK', body: 'Test', timestamp: 1000 },
        { id: '2', sender: 'BANK', body: 'Test2', timestamp: 2000 },
      ];
      mockReadInbox.mockResolvedValue({ messages: mockMessages });

      await androidSmsReader.readMessages(1000, 3000);

      expect(mockReadInbox).toHaveBeenCalledWith({ sinceMs: 1000 });
    });

    it('filters messages to end timestamp', async () => {
      const mockMessages: SmsMessage[] = [
        { id: '1', sender: 'BANK', body: 'Test', timestamp: 1000 },
        { id: '2', sender: 'BANK', body: 'Test2', timestamp: 2000 },
        { id: '3', sender: 'BANK', body: 'Test3', timestamp: 3000 },
        { id: '4', sender: 'BANK', body: 'Test4', timestamp: 4000 }, // Beyond end
      ];
      mockReadInbox.mockResolvedValue({ messages: mockMessages });

      const result = await androidSmsReader.readMessages(1000, 3000);

      expect(result).toHaveLength(3);
      expect(result.map((m: SmsMessage) => m.id)).toEqual(['1', '2', '3']);
    });

    it('returns messages in chronological order', async () => {
      const mockMessages: SmsMessage[] = [
        { id: '3', sender: 'BANK', body: 'Test3', timestamp: 3000 },
        { id: '1', sender: 'BANK', body: 'Test', timestamp: 1000 },
        { id: '2', sender: 'BANK', body: 'Test2', timestamp: 2000 },
      ];
      mockReadInbox.mockResolvedValue({ messages: mockMessages });

      const result = await androidSmsReader.readMessages(1000, 3000);

      expect(result.map((m: SmsMessage) => m.timestamp)).toEqual([1000, 2000, 3000]);
    });

    it('throws SmsReaderPermissionError when permission denied', async () => {
      mockReadInbox.mockRejectedValue(new Error('PERMISSION_DENIED: READ_SMS not granted'));

      await expect(androidSmsReader.readMessages(1000, 2000)).rejects.toThrow(SmsReaderPermissionError);
      await expect(androidSmsReader.readMessages(1000, 2000)).rejects.toThrow('PERMISSION_DENIED');
    });

    it('throws SmsReaderQueryError when query fails', async () => {
      mockReadInbox.mockRejectedValue(new Error('QUERY_FAILED: Database error'));

      await expect(androidSmsReader.readMessages(1000, 2000)).rejects.toThrow(SmsReaderQueryError);
      await expect(androidSmsReader.readMessages(1000, 2000)).rejects.toThrow('QUERY_FAILED');
    });

    it('passes through other errors', async () => {
      const otherError = new Error('Network timeout');
      mockReadInbox.mockRejectedValue(otherError);

      await expect(androidSmsReader.readMessages(1000, 2000)).rejects.toThrow('Network timeout');
      await expect(androidSmsReader.readMessages(1000, 2000)).rejects.not.toThrow(SmsReaderPermissionError);
      await expect(androidSmsReader.readMessages(1000, 2000)).rejects.not.toThrow(SmsReaderQueryError);
    });
  });

  describe('hasPermission', () => {
    it('returns granted status from native', async () => {
      mockHasPermission.mockResolvedValue({ granted: true });

      const result = await (androidSmsReader as any).hasPermission();

      expect(result).toBe(true);
      expect(mockHasPermission).toHaveBeenCalled();
    });

    it('returns false when not granted', async () => {
      mockHasPermission.mockResolvedValue({ granted: false });

      const result = await (androidSmsReader as any).hasPermission();

      expect(result).toBe(false);
    });
  });

  describe('requestPermission', () => {
    it('returns state from native', async () => {
      mockRequestPermission.mockResolvedValue({ state: 'granted' });

      const result = await (androidSmsReader as any).requestPermission();

      expect(result).toBe('granted');
      expect(mockRequestPermission).toHaveBeenCalled();
    });

    it('handles denied state', async () => {
      mockRequestPermission.mockResolvedValue({ state: 'denied' });

      const result = await (androidSmsReader as any).requestPermission();

      expect(result).toBe('denied');
    });

    it('handles prompt state', async () => {
      mockRequestPermission.mockResolvedValue({ state: 'prompt' });

      const result = await (androidSmsReader as any).requestPermission();

      expect(result).toBe('prompt');
    });
  });
});
