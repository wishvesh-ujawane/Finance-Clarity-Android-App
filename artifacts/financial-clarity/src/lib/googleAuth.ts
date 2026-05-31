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

let initialized = false;
let initPromise: Promise<void> | null = null;

let currentAccessToken: string | null = null;
let currentTokenIssuedAt = 0;
/** Treat tokens older than this as needing refresh before reuse. */
const TOKEN_REFRESH_BEFORE_MS = 50 * 60 * 1000; // 50 minutes
let cachedUser: GoogleUser | null = null;

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
  }
}

/**
 * Silently refresh the existing session. Returns the user if a session exists,
 * or null if the user has never signed in / session expired.
 */
export async function trySilentRefresh(): Promise<GoogleUser | null> {
  await initGoogleAuth();
  try {
    const auth = await GoogleAuth.refresh();
    storeAuthentication(auth);
    // refresh() doesn't return profile info; preserve cached user if any.
    return cachedUser;
  } catch {
    currentAccessToken = null;
    currentTokenIssuedAt = 0;
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
