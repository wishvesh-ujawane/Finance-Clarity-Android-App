import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';

interface BiometricResult {
  success: boolean;
  message?: string;
}

export async function ensureBiometricReady(): Promise<BiometricResult> {
  try {
    const info = await BiometricAuth.checkBiometry();
    if (!info.deviceIsSecure) {
      return {
        success: false,
        message: 'Device lock is not enabled. Set a PIN/pattern/password in system settings first.',
      };
    }
    if (!info.isAvailable) {
      return {
        success: false,
        message: info.reason || 'Biometric is not enrolled on this device.',
      };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Biometric setup failed.',
    };
  }
}

export async function tryBiometricUnlock(): Promise<BiometricResult> {
  try {
    await BiometricAuth.authenticate({
      reason: 'Unlock Financial Clarity',
      allowDeviceCredential: true,
      androidTitle: 'Biometric unlock',
      androidSubtitle: 'Verify to continue',
      cancelTitle: 'Cancel',
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Biometric verification failed.',
    };
  }
}

