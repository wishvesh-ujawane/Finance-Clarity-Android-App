import { Capacitor } from '@capacitor/core';
import type { AvailableResult, BiometricAuthError } from '@capgo/capacitor-native-biometric';

interface BiometricPlugin {
  isAvailable: (options?: { useFallback?: boolean }) => Promise<AvailableResult>;
  addListener?: (eventName: 'biometryChange', listener: (result: AvailableResult) => void) => Promise<{ remove: () => Promise<void> }>;
  verifyIdentity: (options: {
    reason?: string;
    title?: string;
    subtitle?: string;
    description?: string;
    useFallback?: boolean;
    maxAttempts?: number;
  }) => Promise<void>;
}

export interface BiometricAvailability {
  isAvailable: boolean;
  reason: string;
  details?: AvailableResult;
}

let cachedPlugin: BiometricPlugin | null | undefined;

async function getPlugin(): Promise<BiometricPlugin | null> {
  if (cachedPlugin !== undefined) return cachedPlugin;
  if (!Capacitor.isNativePlatform()) {
    cachedPlugin = null;
    return null;
  }
  try {
    const mod = await import('@capgo/capacitor-native-biometric');
    cachedPlugin = (mod as unknown as { NativeBiometric: BiometricPlugin }).NativeBiometric ?? null;
  } catch {
    cachedPlugin = null;
  }
  return cachedPlugin;
}

function messageFromAvailability(result: AvailableResult): string {
  if (result.isAvailable) return 'Biometric authentication is available.';
  if (result.deviceIsSecure === false) {
    return 'Device lock screen is not configured. Set PIN/Pattern/Password in Android settings first.';
  }
  if (result.errorCode === 3 as BiometricAuthError) {
    return 'No biometrics enrolled. Add fingerprint or face in Android settings.';
  }
  if (result.errorCode === 1 as BiometricAuthError) {
    return 'Biometric hardware is unavailable on this device.';
  }
  if (result.errorCode === 2 as BiometricAuthError || result.errorCode === 4 as BiometricAuthError) {
    return 'Biometric is temporarily locked. Wait and try again.';
  }
  return 'Biometric authentication is not available right now.';
}

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  const plugin = await getPlugin();
  if (!plugin) {
    return {
      isAvailable: false,
      reason: 'Biometrics are only available in the Android app runtime, not browser preview.',
    };
  }
  try {
    const result = await plugin.isAvailable({ useFallback: false });
    return {
      isAvailable: Boolean(result?.isAvailable),
      reason: messageFromAvailability(result),
      details: result,
    };
  } catch {
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
  const plugin = await getPlugin();
  if (!plugin?.addListener) return null;
  try {
    const handle = await plugin.addListener('biometryChange', listener);
    return async () => {
      await handle.remove();
    };
  } catch {
    return null;
  }
}

export async function verifyBiometric(reason = 'Unlock Fiscal Focus'): Promise<boolean> {
  const plugin = await getPlugin();
  if (!plugin) return false;
  try {
    await plugin.verifyIdentity({
      reason,
      title: 'Unlock Fiscal Focus',
      subtitle: 'Use biometrics to continue',
      useFallback: false,
      maxAttempts: 3,
    });
    return true;
  } catch {
    return false;
  }
}
