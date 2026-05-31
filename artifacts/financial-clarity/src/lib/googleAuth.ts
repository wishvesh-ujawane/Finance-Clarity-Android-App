import { Capacitor } from '@capacitor/core';
import {
  GoogleAuth,
  type Authentication,
  type User,
} from '@codetrix-studio/capacitor-google-auth';

/**
 * Web OAuth client ID. On Android the plugin reads `server_client_id`
 * from `strings.xml` and `serverClientId` from `capacitor.config.ts`,
 * so this value is only required for the web build.
 */
const WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined;

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const SCOPES = ['profile', 'email', DRIVE_SCOPE];

/**
 * localStorage key for the cached Google user profile. The plugin persists
 * the OAuth refresh token natively (Android keystore / web sessionStorage),
 * but the profile fields (name, email, photo) are only returned from
 * `signIn()` — never from `refresh()`. We cache them here so the UI can show
 * the connected account immediately on cold start while we silently refresh
 * the access token in the background.
 */
const USER_CACHE_KEY = 'financial-clarity:google-user';

let initialized = false;
let initPromise: Promise<void> | null = null;

let currentAccessToken: string | null = null;
let currentTokenIssuedAt = 0;
/** Treat tokens older than this as needing refresh before reuse. */
const TOKEN_REFRESH_BEFORE_MS = 50 * 60 * 1000; // 50 minutes
let cachedUser: GoogleUser | null = loadCachedUser();

function loadCachedUser(): GoogleUser | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(USER_CACHE_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GoogleUser>;
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.email !== 'string' || typeof parsed.name !== 'string') {
      return null;
    }
    return {
      id: parsed.id,
      email: parsed.email,
      name: parsed.name,
      imageUrl: typeof parsed.imageUrl === 'string' ? parsed.imageUrl : undefined,
    };
  } catch {
    return null;
  }
}

function persistCachedUser(user: GoogleUser | null) {
  try {
    if (user) {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch {
    /* ignore quota / unavailable storage */
  }
}

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  imageUrl?: string;
}

function toGoogleUser(user: User): GoogleUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    imageUrl: user.imageUrl,
  };
}

function storeAuthentication(auth: Authentication) {
  currentAccessToken = auth.accessToken;
  currentTokenIssuedAt = Date.now();
}

export function initGoogleAuth(): Promise<void> {
  if (initialized) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const options: { clientId?: string; scopes: string[]; grantOfflineAccess: boolean } = {
        scopes: SCOPES,
        grantOfflineAccess: true,
      };
      // On web the plugin needs the client ID at init time.
      if (!Capacitor.isNativePlatform() && WEB_CLIENT_ID) {
        options.clientId = WEB_CLIENT_ID;
      }
      await GoogleAuth.initialize(options);
      initialized = true;
    } catch (err) {
      initPromise = null;
      throw err;
    }
  })();
  return initPromise;
}

export async function signIn(): Promise<GoogleUser> {
  await initGoogleAuth();
  const user = await GoogleAuth.signIn();
  storeAuthentication(user.authentication);
  cachedUser = toGoogleUser(user);
  persistCachedUser(cachedUser);
  return cachedUser;
}

export async function signOut(): Promise<void> {
  await initGoogleAuth();
  try {
    await GoogleAuth.signOut();
  } finally {
    currentAccessToken = null;
    currentTokenIssuedAt = 0;
    cachedUser = null;
    persistCachedUser(null);
  }
}

/**
 * Silently refresh the existing session. Returns the cached user when the
 * native plugin can refresh the access token (i.e. the OAuth grant is still
 * valid on the device), or null if no session can be restored.
 *
 * The codetrix plugin stores the refresh token natively, but `refresh()`
 * doesn't echo profile info back, so we rely on the localStorage profile
 * cache populated during the previous `signIn()`.
 */
export async function trySilentRefresh(): Promise<GoogleUser | null> {
  await initGoogleAuth();
  try {
    const auth = await GoogleAuth.refresh();
    storeAuthentication(auth);
    return cachedUser;
  } catch {
    currentAccessToken = null;
    currentTokenIssuedAt = 0;
    // Refresh failed → the device-side grant is gone. Drop the stale
    // profile cache so the UI doesn't claim we're connected.
    cachedUser = null;
    persistCachedUser(null);
    return null;
  }
}

interface AccessTokenOptions {
  forceRefresh?: boolean;
}

export async function getAccessToken(options: AccessTokenOptions = {}): Promise<string> {
  await initGoogleAuth();
  const age = Date.now() - currentTokenIssuedAt;
  if (
    !options.forceRefresh &&
    currentAccessToken &&
    age < TOKEN_REFRESH_BEFORE_MS
  ) {
    return currentAccessToken;
  }
  const auth = await GoogleAuth.refresh();
  storeAuthentication(auth);
  return auth.accessToken;
}

export function getCurrentUser(): GoogleUser | null {
  return cachedUser;
}

export function isSignedIn(): boolean {
  return cachedUser !== null && currentAccessToken !== null;
}
