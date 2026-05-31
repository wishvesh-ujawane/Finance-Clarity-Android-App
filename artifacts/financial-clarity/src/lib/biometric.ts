import { Capacitor } from '@capacitor/core';
import type { AvailableResult, NativeBiometricPlugin } from '@capgo/capacitor-native-biometric';

export interface BiometricAvailability {
  isAvailable: boolean;
  reason: string;
  details?: AvailableResult;
}

const BIOMETRIC_ERROR = {
  BIOMETRICS_UNAVAILABLE: 1,
  USER_LOCKOUT: 2,
  BIOMETRICS_NOT_ENROLLED: 3,
  USER_TEMPORARY_LOCKOUT: 4,
  PASSCODE_NOT_SET: 14,
} as const;

let pluginInitialized = false;
let pluginAvailable = false;

async function ensurePluginLoaded(): Promise<void> {
  if (pluginInitialized) return;
  pluginInitialized = true;
  
  if (!Capacitor.isNativePlatform()) {
    pluginAvailable = false;
    return;
  }

  try {
    // Dynamically import to ensure it's loaded on native platform
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
    // Verify the plugin has the expected methods
    if (NativeBiometric && typeof NativeBiometric.isAvailable === 'function') {
      pluginAvailable = true;
    }
  } catch (error) {
    console.error('[biometric] Failed to load plugin', error);
    pluginAvailable = false;
  }
}

async function getPlugin(): Promise<NativeBiometricPlugin | null> {
  await ensurePluginLoaded();
  if (!pluginAvailable) return null;
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
    return NativeBiometric;
  } catch {
    return null;
  }
}

export function describeBiometricAvailability(result: AvailableResult): string {
  if (result.isAvailable) return 'Biometric authentication is available.';
  if (result.deviceIsSecure === false) {
    return 'Device lock screen is not configured. Set a PIN, pattern, or password in Android settings first.';
  }
  if (result.errorCode === BIOMETRIC_ERROR.BIOMETRICS_NOT_ENROLLED) {
    return 'No biometrics enrolled. Add fingerprint or face in Android settings.';
  }
  if (result.errorCode === BIOMETRIC_ERROR.BIOMETRICS_UNAVAILABLE) {
    return 'Biometric hardware is unavailable on this device.';
  }
  if (
    result.errorCode === BIOMETRIC_ERROR.USER_LOCKOUT ||
    result.errorCode === BIOMETRIC_ERROR.USER_TEMPORARY_LOCKOUT
  ) {
    return 'Biometric unlock is temporarily locked. Wait and try again.';
  }
  if (result.errorCode === BIOMETRIC_ERROR.PASSCODE_NOT_SET) {
    return 'Device credential fallback is not configured.';
  }
  return 'Biometric authentication is not available right now.';
}

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  try {
    const plugin = await getPlugin();
    if (!plugin) {
      return {
        isAvailable: false,
        reason: 'Biometrics are only available in the Android app runtime, not browser preview.',
      };
    }
    
    const result = await plugin.isAvailable({ useFallback: false });
    return {
      isAvailable: Boolean(result?.isAvailable),
      reason: describeBiometricAvailability(result),
      details: result,
    };
  } catch (error) {
    console.error('[biometric] isAvailable error', error);
    return {
      isAvailable: false,
      reason: 'Failed to query biometric status from native plugin.',
    };
  }
}

export async function isBiometricAvailable(): Promise<boolean> {
  const result = await getBiometricAvailability();
  return result.isAvailable;
}

export async function addBiometryChangeListener(
  listener: (result: AvailableResult) => void
): Promise<(() => Promise<void>) | null> {
  try {
    const plugin = await getPlugin();
    if (!plugin || !('addListener' in plugin)) {
      return null;
    }
    
    const handle = await (plugin as any).addListener('biometryChange', listener);
    if (!handle) return null;
    
    return async () => {
      try {
        if (handle.remove) {
          await handle.remove();
        }
      } catch (error) {
        console.error('[biometric] Failed to remove listener', error);
      }
    };
  } catch (error) {
    console.error('[biometric] addListener error', error);
    return null;
  }
}

export async function verifyBiometric(reason = 'Unlock Fiscal Focus'): Promise<boolean> {
  try {
    const plugin = await getPlugin();
    if (!plugin) return false;
    
    await (plugin as any).verifyIdentity({
      reason,
      title: 'Unlock Fiscal Focus',
      subtitle: 'Use biometrics to continue',
      useFallback: true,
      maxAttempts: 3,
    });
    return true;
  } catch (error) {
    console.error('[biometric] verifyIdentity error', error);
    return false;
  }
}
