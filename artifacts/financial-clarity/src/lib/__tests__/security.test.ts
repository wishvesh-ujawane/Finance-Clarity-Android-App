import { vi } from 'vitest';
import {
  clearSecuritySettings,
  createSecuritySettings,
  isInCooldown,
  isValidPinFormat,
  loadSecuritySettings,
  saveSecuritySettings,
  verifyPin,
  withFailedAttempt,
  withoutFailedAttempts,
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

describe('failed-attempt cooldown', () => {
  const NOW = 1_800_000_000_000;

  async function failTimes(count: number) {
    let settings = await createSecuritySettings('1234');
    for (let i = 0; i < count; i++) settings = withFailedAttempt(settings, NOW);
    return settings;
  }

  it('starts no cooldown before the fifth failure', async () => {
    const settings = await failTimes(4);
    expect(settings.failedAttempts).toBe(4);
    expect(settings.cooldownUntil).toBeUndefined();
    expect(isInCooldown(settings, NOW)).toBe(false);
  });

  it('escalates 30 s, 1 min, 5 min, then stays at 15 min', async () => {
    expect((await failTimes(5)).cooldownUntil).toBe(NOW + 30_000);
    expect((await failTimes(10)).cooldownUntil).toBe(NOW + 60_000);
    expect((await failTimes(15)).cooldownUntil).toBe(NOW + 5 * 60_000);
    expect((await failTimes(20)).cooldownUntil).toBe(NOW + 15 * 60_000);
    expect((await failTimes(25)).cooldownUntil).toBe(NOW + 15 * 60_000);
  });

  it('reports the cooldown only until it expires', async () => {
    const settings = await failTimes(5);
    expect(isInCooldown(settings, NOW + 29_999)).toBe(true);
    expect(isInCooldown(settings, NOW + 30_000)).toBe(false);
  });

  it('clears attempts and cooldown after a successful unlock', async () => {
    const cleared = withoutFailedAttempts(await failTimes(5));
    expect(cleared.failedAttempts).toBeUndefined();
    expect(cleared.cooldownUntil).toBeUndefined();
    expect(cleared.pinHash).toBeTruthy();
  });

  it('persists the cooldown across a reload', async () => {
    const settings = await failTimes(5);
    expect(saveSecuritySettings(settings)).toEqual({ ok: true });
    expect(loadSecuritySettings()).toEqual(settings);
  });

  it('keeps the lock when stored attempt fields are damaged', async () => {
    const settings = await createSecuritySettings('1234');
    localStorage.setItem('financial-clarity:security', JSON.stringify({
      ...settings,
      failedAttempts: 'many',
      cooldownUntil: null,
    }));
    expect(loadSecuritySettings()).toEqual(settings);
  });
});
