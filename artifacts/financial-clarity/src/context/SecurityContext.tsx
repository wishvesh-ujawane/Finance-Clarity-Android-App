import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  clearSecuritySettings,
  createSecuritySettings,
  hashPin,
  isInCooldown,
  isValidPinFormat,
  loadSecuritySettings,
  saveSecuritySettings,
  verifyPin,
  wipeAllAppData,
  withFailedAttempt,
  withoutFailedAttempts,
  type SecuritySettings,
} from '@/lib/security';
import { setScreenSecure } from '@/lib/screen-security';
import {
  addBiometryChangeListener,
  describeBiometricAvailability,
  getBiometricAvailability,
  openBiometricEnrollmentSettings,
  verifyBiometric,
} from '@/lib/biometric';

interface SecurityContextType {
  settings: SecuritySettings | null;
  isReady: boolean;
  isLocked: boolean;
  biometricAvailable: boolean;
  biometricReason: string;
  isAppLockEnabled: boolean;
  setupPin: (pin: string) => Promise<boolean>;
  changePin: (currentPin: string, newPin: string) => Promise<boolean>;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => void;
  openBiometricEnrollment: () => Promise<boolean>;
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

  // Hide app content from Recents and screenshots whenever the app lock is on.
  const isAppLockEnabled = Boolean(settings);
  useEffect(() => {
    if (!isReady) return;
    // Best effort: in the browser this is unsupported, and on failure the
    // lock itself still protects the app.
    void setScreenSecure(isAppLockEnabled);
  }, [isReady, isAppLockEnabled]);

  useEffect(() => {
    void refreshBiometricState();
  }, [refreshBiometricState]);

  // Keep status fresh when app resumes or when native biometry state changes.
  useEffect(() => {
    let removeListener: (() => Promise<void>) | null = null;
    let mounted = true;

    const setupListener = async () => {
      try {
        const cleanup = await addBiometryChangeListener((result) => {
          if (!mounted) return;
          setBiometricAvailable(Boolean(result.isAvailable));
          setBiometricReason(describeBiometricAvailability(result));
        });
        if (mounted) {
          removeListener = cleanup;
        } else if (cleanup) {
          await cleanup();
        }
      } catch (error) {
        console.error('[security] Failed to setup biometry listener', error);
      }
    };

    void setupListener();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshBiometricState();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mounted = false;
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
    let lifecycleMounted = true;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        if (!lifecycleMounted) return;
        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) handleVisible();
          else handleHidden();
        }).then(handle => {
          if (lifecycleMounted) {
            removeNativeListener = () => { void handle.remove(); };
          } else {
            void handle.remove();
          }
        }).catch(() => { /* plugin not installed; visibilitychange suffices */ });
      }).catch(() => { /* ignore */ });
    }

    return () => {
      lifecycleMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      removeNativeListener?.();
    };
  }, [settings]);

  const setupPin = useCallback(async (pin: string) => {
    if (!isValidPinFormat(pin)) throw new Error('PIN must be 4 digits.');
    const availability = await getBiometricAvailability();
    const biometricEnabled = availability.isAvailable
      ? await verifyBiometric('Confirm biometrics to enable unlock')
      : false;
    const next = await createSecuritySettings(pin, { biometricEnabled });
    const result = saveSecuritySettings(next);
    if (!result.ok) throw new Error(result.message);
    setSettings(next);
    setIsLocked(false);
    void refreshBiometricState();
    return biometricEnabled;
  }, [refreshBiometricState]);

  const changePin = useCallback(async (currentPin: string, newPin: string) => {
    if (!settings) return false;
    if (!isValidPinFormat(newPin)) throw new Error('PIN must be 4 digits.');
    const ok = await verifyPin(currentPin, settings);
    if (!ok) return false;
    const newHash = await hashPin(newPin, settings.pinSalt);
    const next: SecuritySettings = { ...settings, pinHash: newHash, updatedAt: Date.now() };
    const result = saveSecuritySettings(next);
    if (!result.ok) throw new Error(result.message);
    setSettings(next);
    return true;
  }, [settings]);

  const enableBiometric = useCallback(async () => {
    if (!settings) return false;
    const availability = await getBiometricAvailability();
    setBiometricAvailable(availability.isAvailable);
    setBiometricReason(availability.reason);
    if (!availability.isAvailable) return false;

    const ok = await verifyBiometric('Confirm biometrics to enable unlock');
    if (!ok) {
      void refreshBiometricState();
      return false;
    }
    const next: SecuritySettings = { ...settings, biometricEnabled: true, updatedAt: Date.now() };
    const result = saveSecuritySettings(next);
    if (!result.ok) throw new Error(result.message);
    setSettings(next);
    setBiometricAvailable(true);
    setBiometricReason('Biometric authentication is available.');
    return true;
  }, [settings, refreshBiometricState]);

  const disableBiometric = useCallback(() => {
    if (!settings) return;
    const next: SecuritySettings = { ...settings, biometricEnabled: false, updatedAt: Date.now() };
    const result = saveSecuritySettings(next);
    if (!result.ok) throw new Error(result.message);
    setSettings(next);
  }, [settings]);

  const openBiometricEnrollment = useCallback(async () => {
    const opened = await openBiometricEnrollmentSettings();
    if (opened) {
      window.setTimeout(() => {
        void refreshBiometricState();
      }, 500);
    }
    return opened;
  }, [refreshBiometricState]);

  const disableAppLock = useCallback(async (currentPin: string) => {
    if (!settings) return false;
    const ok = await verifyPin(currentPin, settings);
    if (!ok) return false;
    const result = clearSecuritySettings();
    if (!result.ok) throw new Error(result.message);
    setSettings(null);
    setIsLocked(false);
    return true;
  }, [settings]);

  // Lockout state is saved so a restart does not reset the cooldown. If the
  // save fails, the in-memory state still applies for this session (fail closed).
  const recordUnlockResult = useCallback((current: SecuritySettings, ok: boolean) => {
    const hasLockout = current.failedAttempts !== undefined || current.cooldownUntil !== undefined;
    if (ok && !hasLockout) return;
    const next = ok ? withoutFailedAttempts(current) : withFailedAttempt(current, Date.now());
    saveSecuritySettings(next);
    setSettings(next);
  }, []);

  const unlockWithPin = useCallback(async (pin: string) => {
    if (!settings) return false;
    if (isInCooldown(settings, Date.now())) return false;
    const ok = await verifyPin(pin, settings);
    recordUnlockResult(settings, ok);
    if (ok) setIsLocked(false);
    return ok;
  }, [settings, recordUnlockResult]);

  const unlockWithBiometric = useCallback(async () => {
    if (!settings || !settings.biometricEnabled || !biometricAvailable) return false;
    if (isInCooldown(settings, Date.now())) return false;
    const ok = await verifyBiometric();
    if (ok) {
      recordUnlockResult(settings, true);
      setIsLocked(false);
    } else {
      void refreshBiometricState();
    }
    return ok;
  }, [settings, biometricAvailable, refreshBiometricState, recordUnlockResult]);

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
    isAppLockEnabled,
    setupPin,
    changePin,
    enableBiometric,
    disableBiometric,
    openBiometricEnrollment,
    disableAppLock,
    unlockWithPin,
    unlockWithBiometric,
    lockNow,
    resetAllData,
  }), [settings, isReady, isLocked, biometricAvailable, biometricReason, setupPin, changePin, enableBiometric, disableBiometric, openBiometricEnrollment, disableAppLock, unlockWithPin, unlockWithBiometric, lockNow, resetAllData]);

  return <SecurityContext.Provider value={value}>{children}</SecurityContext.Provider>;
}

export function useSecurity(): SecurityContextType {
  const ctx = useContext(SecurityContext);
  if (!ctx) throw new Error('useSecurity must be used within a SecurityProvider');
  return ctx;
}
