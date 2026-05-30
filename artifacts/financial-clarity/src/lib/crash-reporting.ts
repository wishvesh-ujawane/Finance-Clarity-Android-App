const CRASH_LOG_KEY = 'financial-clarity:crash-events';
const MAX_CRASH_EVENTS = 30;
const RELEASE_TAG = (import.meta.env.VITE_APP_VERSION as string | undefined) || 'dev';
const ENV_TAG = (import.meta.env.MODE as string | undefined) || 'unknown';

interface CrashEvent {
  at: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}

function loadEvents(): CrashEvent[] {
  try {
    const raw = localStorage.getItem(CRASH_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(event => typeof event?.message === 'string');
  } catch {
    return [];
  }
}

function saveEvents(events: CrashEvent[]) {
  try {
    localStorage.setItem(CRASH_LOG_KEY, JSON.stringify(events.slice(0, MAX_CRASH_EVENTS)));
  } catch {
    // ignore
  }
}

export function recordCrash(error: unknown, context?: Record<string, unknown>) {
  const normalized = error instanceof Error ? error : new Error(String(error));
  const event: CrashEvent = {
    at: new Date().toISOString(),
    message: normalized.message,
    stack: normalized.stack,
    context: {
      release: RELEASE_TAG,
      env: ENV_TAG,
      ...context,
    },
  };

  const existing = loadEvents();
  saveEvents([event, ...existing]);

  const globalSentry = (globalThis as { Sentry?: { captureException?: (err: unknown, ctx?: object) => void } }).Sentry;
  if (globalSentry?.captureException) {
    globalSentry.captureException(normalized, { extra: context });
  }
}

export function initCrashReporting() {
  window.addEventListener('error', event => {
    recordCrash(event.error || new Error(event.message), { source: 'window.error' });
  });

  window.addEventListener('unhandledrejection', event => {
    recordCrash(event.reason, { source: 'window.unhandledrejection' });
  });
}
