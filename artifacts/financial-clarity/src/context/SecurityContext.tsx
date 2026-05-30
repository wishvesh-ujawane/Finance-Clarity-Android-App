import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  clearSecuritySettings,
  createSecuritySettings,
  hashPin,
  isValidPinFormat,
  loadSecuritySettings,
  saveSecuritySettings,
  verifyPin,
  wipeAllAppData,
  type SecuritySettings,
} from '@/lib/security';
import { addBiometryChangeListener, getBiometricAvailability, verifyBiometric } from '@/lib/biometric';

interface SecurityContextType {
  settings: SecuritySettings | null;
  isReady: boolean;
  isLocked: boolean;
  biometricAvailable: boolean;
  biometricReason: string;
  isAppLockEnabled: boolean;
  setupPin: (pin: string) => Promise<void>;
  changePin: (currentPin: string, newPin: string) => Promise<boolean>;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => void;
  disableAppLock: (currentPin: string) => Promise<boolean>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometric: () => Promise<boolean>;
  lockNow: () => void;
  resetAllData: () => void;
}

const SecurityContext = createContext<SecurityContextType | null>(null);

export function SecurityProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricReason, setBiometricReason] = useState('Checking biometric support...');
  const lastBackgroundedAt = useRef<number | null>(null);

  // Initial load
  useEffect(() => {
    const loaded = loadSecuritySettings();
    setSettings(loaded);
    setIsLocked(Boolean(loaded));
    setIsReady(true);
  }, []);

  const refreshBiometricState = useCallback(async () => {
    const status = await getBiometricAvailability();
    setBiometricAvailable(status.isAvailable);
    setBiometricReason(status.reason);
  }, []);

  useEffect(() => {
    void refreshBiometricState();
  }, [refreshBiometricState]);

  // Keep status fresh when app resumes or when native biometry state changes.
  useEffect(() => {
    let removeListener: (() => Promise<void>) | null = null;

    addBiometryChangeListener((result) => {
      setBiometricAvailable(Boolean(result.isAvailable));
      if (result.isAvailable) {
        setBiometricReason('Biometric authentication is available.');
      } else if (result.deviceIsSecure === false) {
        setBiometricReason('Device lock screen is not configured. Set PIN/Pattern/Password in Android settings first.');
      } else if (result.errorCode === 3) {
        setBiometricReason('No biometrics enrolled. Add fingerprint or face in Android settings.');
      } else {
        setBiometricReason('Biometric authentication is not available right now.');
      }
    }).then((cleanup) => {
      removeListener = cleanup;
    }).catch(() => {
      // ignore
    });

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshBiometricState();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (removeListener) {
        void removeListener();
      }
    };
  }, [refreshBiometricState]);

  // Lock on resume after configurable timeout
  useEffect(() => {
    if (!settings) return;
    const timeoutMs = settings.lockTimeoutMs;

    const handleHidden = () => {
      lastBackgroundedAt.current = Date.now();
    };
    const handleVisible = () => {
      const last = lastBackgroundedAt.current;
      lastBackgroundedAt.current = null;
      if (last !== null && Date.now() - last >= timeoutMs) {
        setIsLocked(true);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') handleHidden();
      else if (document.visibilityState === 'visible') handleVisible();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    let removeNativeListener: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) handleVisible();
          else handleHidden();
        }).then(handle => {
          removeNativeListener = () => { handle.remove(); };
        }).catch(() => { /* plugin not installed; visibilitychange suffices */ });
      }).catch(() => { /* ignore */ });
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      removeNativeListener?.();
    };
  }, [settings]);

  const setupPin = useCallback(async (pin: string) => {
    if (!isValidPinFormat(pin)) throw new Error('PIN must be 4 digits.');
    const next = await createSecuritySettings(pin);
    saveSecuritySettings(next);
    setSettings(next);
    setIsLocked(false);
  }, []);

  const changePin = useCallback(async (currentPin: string, newPin: string) => {
    if (!settings) return false;
    if (!isValidPinFormat(newPin)) throw new Error('PIN must be 4 digits.');
    const ok = await verifyPin(currentPin, settings);
    if (!ok) return false;
    const newHash = await hashPin(newPin, settings.pinSalt);
    const next: SecuritySettings = { ...settings, pinHash: newHash, updatedAt: Date.now() };
    saveSecuritySettings(next);
    setSettings(next);
    return true;
  }, [settings]);

  const enableBiometric = useCallback(async () => {
    if (!settings) return false;
    const ok = await verifyBiometric('Confirm biometrics to enable unlock');
    if (!ok) {
      void refreshBiometricState();
      return false;
    }
    const next: SecuritySettings = { ...settings, biometricEnabled: true, updatedAt: Date.now() };
    saveSecuritySettings(next);
    setSettings(next);
    setBiometricAvailable(true);
    setBiometricReason('Biometric authentication is available.');
    return true;
  }, [settings, refreshBiometricState]);

  const disableBiometric = useCallback(() => {
    if (!settings) return;
    const next: SecuritySettings = { ...settings, biometricEnabled: false, updatedAt: Date.now() };
    saveSecuritySettings(next);
    setSettings(next);
  }, [settings]);

  const disableAppLock = useCallback(async (currentPin: string) => {
    if (!settings) return false;
    const ok = await verifyPin(currentPin, settings);
    if (!ok) return false;
    clearSecuritySettings();
    setSettings(null);
    setIsLocked(false);
    return true;
  }, [settings]);

  const unlockWithPin = useCallback(async (pin: string) => {
    if (!settings) return false;
    const ok = await verifyPin(pin, settings);
    if (ok) setIsLocked(false);
    return ok;
  }, [settings]);

  const unlockWithBiometric = useCallback(async () => {
    if (!settings || !settings.biometricEnabled) return false;
    const ok = await verifyBiometric();
    if (ok) setIsLocked(false);
    else void refreshBiometricState();
    return ok;
  }, [settings, refreshBiometricState]);

  const lockNow = useCallback(() => {
    if (settings) setIsLocked(true);
  }, [settings]);

  const resetAllData = useCallback(() => {
    wipeAllAppData();
    setSettings(null);
    setIsLocked(false);
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, []);

  const value = useMemo<SecurityContextType>(() => ({
    settings,
    isReady,
    isLocked,
    biometricAvailable,
    biometricReason,
    isAppLockEnabled: Boolean(settings),
    setupPin,
    changePin,
    enableBiometric,
    disableBiometric,
    disableAppLock,
    unlockWithPin,
    unlockWithBiometric,
    lockNow,
    resetAllData,
  }), [settings, isReady, isLocked, biometricAvailable, biometricReason, setupPin, changePin, enableBiometric, disableBiometric, disableAppLock, unlockWithPin, unlockWithBiometric, lockNow, resetAllData]);

  return <SecurityContext.Provider value={value}>{children}</SecurityContext.Provider>;
}

export function useSecurity(): SecurityContextType {
  const ctx = useContext(SecurityContext);
  if (!ctx) throw new Error('useSecurity must be used within a SecurityProvider');
  return ctx;
}
