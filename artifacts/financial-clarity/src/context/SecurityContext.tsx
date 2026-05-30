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
import { isBiometricAvailable, verifyBiometric } from '@/lib/biometric';

interface SecurityContextType {
  settings: SecuritySettings | null;
  isReady: boolean;
  isLocked: boolean;
  biometricAvailable: boolean;
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
  const lastBackgroundedAt = useRef<number | null>(null);

  // Initial load
  useEffect(() => {
    const loaded = loadSecuritySettings();
    setSettings(loaded);
    setIsLocked(Boolean(loaded));
    setIsReady(true);
  }, []);

  // Detect biometric hardware availability
  useEffect(() => {
    let cancelled = false;
    isBiometricAvailable().then(available => {
      if (!cancelled) setBiometricAvailable(available);
    });
    return () => { cancelled = true; };
  }, []);

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
    if (!biometricAvailable) return false;
    const ok = await verifyBiometric('Confirm biometrics to enable unlock');
    if (!ok) return false;
    const next: SecuritySettings = { ...settings, biometricEnabled: true, updatedAt: Date.now() };
    saveSecuritySettings(next);
    setSettings(next);
    return true;
  }, [settings, biometricAvailable]);

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
    if (!settings || !settings.biometricEnabled || !biometricAvailable) return false;
    const ok = await verifyBiometric();
    if (ok) setIsLocked(false);
    return ok;
  }, [settings, biometricAvailable]);

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
  }), [settings, isReady, isLocked, biometricAvailable, setupPin, changePin, enableBiometric, disableBiometric, disableAppLock, unlockWithPin, unlockWithBiometric, lockNow, resetAllData]);

  return <SecurityContext.Provider value={value}>{children}</SecurityContext.Provider>;
}

export function useSecurity(): SecurityContextType {
  const ctx = useContext(SecurityContext);
  if (!ctx) throw new Error('useSecurity must be used within a SecurityProvider');
  return ctx;
}
