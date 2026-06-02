import { Capacitor } from '@capacitor/core';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';

let initialized = false;

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function recordError(message: string, stack?: string): Promise<void> {
  if (!isNative()) return;
  try {
    const stackTrace = stack
      ? stack
          .split('\n')
          .map((line) => ({ fileName: line.trim() }))
          .filter((frame) => frame.fileName.length > 0)
      : undefined;
    await FirebaseCrashlytics.recordException({
      message,
      stacktrace: stackTrace,
    });
  } catch {
    // Swallow — never let crash reporting itself crash the app.
  }
}

/**
 * Enables Firebase Crashlytics collection on native platforms and installs
 * global handlers so uncaught JS errors and promise rejections are reported
 * as non-fatal exceptions.
 *
 * Safe to call on web — becomes a no-op.
 */
export async function initCrashlytics(): Promise<void> {
  if (initialized) return;
  initialized = true;

  if (!isNative()) return;

  try {
    await FirebaseCrashlytics.setEnabled({ enabled: true });
  } catch {
    // If the native plugin isn't available (e.g. google-services.json missing
    // at build time) just bail quietly.
    return;
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      const error = event.error as Error | undefined;
      void recordError(
        error?.message ?? event.message ?? 'Uncaught error',
        error?.stack,
      );
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason as unknown;
      if (reason instanceof Error) {
        void recordError(reason.message, reason.stack);
      } else {
        void recordError(`Unhandled rejection: ${String(reason)}`);
      }
    });
  }
}

/**
 * Manually report a handled exception to Crashlytics.
 */
export async function reportHandledError(error: unknown): Promise<void> {
  if (error instanceof Error) {
    await recordError(error.message, error.stack);
  } else {
    await recordError(`Non-Error thrown: ${String(error)}`);
  }
}

/**
 * Attach a user identifier to subsequent Crashlytics reports. Pass an opaque,
 * non-PII id.
 */
export async function setCrashlyticsUserId(userId: string): Promise<void> {
  if (!isNative()) return;
  try {
    await FirebaseCrashlytics.setUserId({ userId });
  } catch {
    // ignore
  }
}
