import { Capacitor, registerPlugin } from '@capacitor/core';

interface ScreenSecurityPlugin {
  setSecure(options: { enabled: boolean }): Promise<void>;
}

const ScreenSecurity = registerPlugin<ScreenSecurityPlugin>('ScreenSecurity');

export type ScreenSecurityResult = { ok: true } | { ok: false; reason: 'unsupported' | 'failed' };

/**
 * Turns Android FLAG_SECURE on or off: when on, the app is blank in the
 * recent-apps screen and screenshots/recordings are blocked.
 */
export async function setScreenSecure(enabled: boolean): Promise<ScreenSecurityResult> {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('ScreenSecurity')) {
    return { ok: false, reason: 'unsupported' };
  }
  try {
    await ScreenSecurity.setSecure({ enabled });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
