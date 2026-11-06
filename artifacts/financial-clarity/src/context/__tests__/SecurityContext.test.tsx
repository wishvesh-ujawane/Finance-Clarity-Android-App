import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { createSecuritySettings, loadSecuritySettings, saveSecuritySettings } from '@/lib/security';
import { SecurityProvider, useSecurity } from '../SecurityContext';

vi.mock('@/lib/biometric', () => ({
  addBiometryChangeListener: vi.fn().mockResolvedValue(null),
  describeBiometricAvailability: vi.fn().mockReturnValue('Available'),
  getBiometricAvailability: vi.fn().mockResolvedValue({ isAvailable: true, reason: 'Available' }),
  openBiometricEnrollmentSettings: vi.fn().mockResolvedValue(false),
  verifyBiometric: vi.fn().mockResolvedValue(true),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <SecurityProvider>{children}</SecurityProvider>;
}

describe('SecurityContext persistence failures', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the previous biometric state when enabling or disabling cannot be saved', async () => {
    const settings = await createSecuritySettings('1234');
    expect(saveSecuritySettings(settings)).toEqual({ ok: true });
    const { result } = renderHook(() => useSecurity(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    });
    await act(async () => {
      await expect(result.current.enableBiometric()).rejects.toThrow('Could not save security settings');
    });
    expect(result.current.settings?.biometricEnabled).toBe(false);
    expect(loadSecuritySettings()?.biometricEnabled).toBe(false);

    write.mockRestore();
    await act(async () => {
      expect(await result.current.enableBiometric()).toBe(true);
    });
    expect(result.current.settings?.biometricEnabled).toBe(true);

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    });
    act(() => {
      expect(() => result.current.disableBiometric()).toThrow('Could not save security settings');
    });
    expect(result.current.settings?.biometricEnabled).toBe(true);
    expect(loadSecuritySettings()?.biometricEnabled).toBe(true);
  });
});
