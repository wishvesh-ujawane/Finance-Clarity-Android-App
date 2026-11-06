import { vi } from 'vitest';
import {
  clearSecuritySettings,
  createSecuritySettings,
  isValidPinFormat,
  loadSecuritySettings,
  saveSecuritySettings,
  verifyPin,
} from '../security';

describe('security settings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts only exactly four numeric digits as a PIN', () => {
    expect(isValidPinFormat('1234')).toBe(true);
    expect(isValidPinFormat('123')).toBe(false);
    expect(isValidPinFormat('12345')).toBe(false);
    expect(isValidPinFormat('12a4')).toBe(false);
    expect(isValidPinFormat(' 123')).toBe(false);
  });

  it('hashes PINs with a unique salt and verifies only the matching PIN', async () => {
    const first = await createSecuritySettings('1234');
    const second = await createSecuritySettings('1234');

    expect(first.pinHash).not.toBe('1234');
    expect(first.pinHash).not.toBe(second.pinHash);
    expect(first.pinSalt).not.toBe(second.pinSalt);
    await expect(verifyPin('1234', first)).resolves.toBe(true);
    await expect(verifyPin('0000', first)).resolves.toBe(false);
  });

  it('persists and removes valid security settings', async () => {
    const settings = await createSecuritySettings('1234');

    expect(saveSecuritySettings(settings)).toEqual({ ok: true });
    expect(loadSecuritySettings()).toEqual(settings);

    expect(clearSecuritySettings()).toEqual({ ok: true });
    expect(loadSecuritySettings()).toBeNull();
  });

  it('reports a failed write without changing previously stored settings', async () => {
    const previous = await createSecuritySettings('1234');
    const next = await createSecuritySettings('5678');
    expect(saveSecuritySettings(previous)).toEqual({ ok: true });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    });

    expect(saveSecuritySettings(next)).toEqual({
      ok: false,
      message: expect.stringContaining('previous settings are unchanged'),
    });
    expect(loadSecuritySettings()).toEqual(previous);
  });

  it('reports a failed removal without deleting the existing lock', async () => {
    const settings = await createSecuritySettings('1234');
    expect(saveSecuritySettings(settings)).toEqual({ ok: true });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Storage unavailable', 'SecurityError');
    });

    expect(clearSecuritySettings()).toEqual({
      ok: false,
      message: expect.stringContaining('app lock is still enabled'),
    });
    expect(loadSecuritySettings()).toEqual(settings);
  });

  it('rejects malformed or invalid stored settings', () => {
    localStorage.setItem('financial-clarity:security', '{invalid');
    expect(loadSecuritySettings()).toBeNull();

    localStorage.setItem('financial-clarity:security', JSON.stringify({
      pinHash: '',
      pinSalt: 'salt',
      biometricEnabled: false,
      lockTimeoutMs: 30_000,
      updatedAt: Date.now(),
    }));
    expect(loadSecuritySettings()).toBeNull();
  });
});
