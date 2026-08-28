/**
 * Tests for getSmsReader platform switch (Phase 3).
 * Verifies correct reader selection based on Capacitor platform.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Capacitor before any imports
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: vi.fn(),
  },
  registerPlugin: vi.fn(() => ({
    hasPermission: vi.fn(),
    requestPermission: vi.fn(),
    readInbox: vi.fn(),
  })),
}));

describe('getSmsReader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mockSmsReader on web platform', async () => {
    const { Capacitor } = await import('@capacitor/core');
    (Capacitor.getPlatform as any).mockReturnValue('web');

    // Re-import to get fresh module with mocked platform
    vi.resetModules();
    const { getSmsReader } = await import('../SmsReader');
    const { mockSmsReader } = await import('../mockSmsReader');

    const reader = getSmsReader();
    
    expect(reader).toBe(mockSmsReader);
  });

  it('returns androidSmsReader on android platform', async () => {
    const { Capacitor } = await import('@capacitor/core');
    (Capacitor.getPlatform as any).mockReturnValue('android');

    // Re-import to get fresh module with mocked platform
    vi.resetModules();
    const { getSmsReader } = await import('../SmsReader');
    const { androidSmsReader } = await import('../androidSmsReader');

    const reader = getSmsReader();
    
    expect(reader).toBe(androidSmsReader);
  });

  it('returns mockSmsReader on ios platform', async () => {
    const { Capacitor } = await import('@capacitor/core');
    (Capacitor.getPlatform as any).mockReturnValue('ios');

    // Re-import to get fresh module with mocked platform
    vi.resetModules();
    const { getSmsReader } = await import('../SmsReader');
    const { mockSmsReader } = await import('../mockSmsReader');

    const reader = getSmsReader();
    
    expect(reader).toBe(mockSmsReader);
  });
});
