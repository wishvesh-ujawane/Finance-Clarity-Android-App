import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { createSecuritySettings, loadSecuritySettings, saveSecuritySettings } from '@/lib/security';
import * as biometric from '@/lib/biometric';
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

describe('SecurityContext unlock attempts', () => {
  beforeEach(() => {
    localStorage.clear();
    // restoreAllMocks in other tests clears the module mock's return values.
    vi.mocked(biometric.addBiometryChangeListener).mockResolvedValue(null);
    vi.mocked(biometric.getBiometricAvailability).mockResolvedValue({ isAvailable: false, reason: 'Unavailable' });
    vi.mocked(biometric.verifyBiometric).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the cooldown after a remount and clears attempts on a correct PIN', async () => {
    expect(saveSecuritySettings(await createSecuritySettings('1234'))).toEqual({ ok: true });
    const first = renderHook(() => useSecurity(), { wrapper });
    await waitFor(() => expect(first.result.current.isLocked).toBe(true));

    for (const wrong of ['0000', '0001', '0002', '0003', '0004']) {
      await act(async () => {
        expect(await first.result.current.unlockWithPin(wrong)).toBe(false);
      });
    }
    expect(loadSecuritySettings()?.failedAttempts).toBe(5);
    expect(loadSecuritySettings()?.cooldownUntil).toBeGreaterThan(Date.now());
    first.unmount();

    const second = renderHook(() => useSecurity(), { wrapper });
    await waitFor(() => expect(second.result.current.isReady).toBe(true));
    await act(async () => {
      expect(await second.result.current.unlockWithPin('1234')).toBe(false);
    });
    expect(second.result.current.isLocked).toBe(true);

    const stored = loadSecuritySettings();
    if (!stored) throw new Error('security settings missing');
    expect(saveSecuritySettings({ ...stored, cooldownUntil: Date.now() - 1 })).toEqual({ ok: true });
    second.unmount();

    const third = renderHook(() => useSecurity(), { wrapper });
    await waitFor(() => expect(third.result.current.isReady).toBe(true));
    await act(async () => {
      expect(await third.result.current.unlockWithPin('1234')).toBe(true);
    });
    expect(third.result.current.isLocked).toBe(false);
    expect(loadSecuritySettings()?.failedAttempts).toBeUndefined();
    expect(loadSecuritySettings()?.cooldownUntil).toBeUndefined();
  });
});
