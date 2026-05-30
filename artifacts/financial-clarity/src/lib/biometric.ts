import { Capacitor } from '@capacitor/core';

interface BiometricPlugin {
  isAvailable: () => Promise<{ isAvailable: boolean; biometryType?: number }>;
  verifyIdentity: (options: {
    reason?: string;
    title?: string;
    subtitle?: string;
    description?: string;
  }) => Promise<void>;
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

export async function isBiometricAvailable(): Promise<boolean> {
  const plugin = await getPlugin();
  if (!plugin) return false;
  try {
    const result = await plugin.isAvailable();
    return Boolean(result?.isAvailable);
  } catch {
    return false;
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
    });
    return true;
  } catch {
    return false;
  }
}
