import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const BASIC_SCOPES = ['profile', 'email'];
const BACKUP_FILE_NAME = 'financial-clarity-backup.json';
const APP_DEFAULT_GOOGLE_CLIENT_ID = '263589833123-90dnia4dgb2plcgkj12d8k8u9k6drgef.apps.googleusercontent.com';
const APP_DEFAULT_GOOGLE_ANDROID_CLIENT_ID = APP_DEFAULT_GOOGLE_CLIENT_ID;

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: (options?: { prompt?: string }) => void };
        };
      };
    };
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google identity script.'));
    document.head.appendChild(script);
  });
}

function getGoogleAuthErrorMessage(error: unknown): string {
  const asObject = typeof error === 'object' && error !== null ? error as Record<string, unknown> : null;
  const rawCode = asObject?.code;
  const errorCode = typeof rawCode === 'number' || typeof rawCode === 'string' ? String(rawCode) : '';
  const serialized = error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
  const lowerSerialized = serialized.toLowerCase();

  if (
    errorCode === '10' ||
    lowerSerialized.includes('developer_error') ||
    lowerSerialized.includes('develper_error') ||
    lowerSerialized.includes('code 10')
  ) {
    return 'Google Sign-In configuration issue (code 10). In Google Cloud, keep OAuth consent configured and use the Web OAuth client ID in app config for native sign-in.';
  }

  if (lowerSerialized.includes('something went wrong while retrieving access token')) {
    return 'Google token retrieval failed after account selection. Verify OAuth consent screen and ensure the configured client ID is the Web OAuth client.';
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }
  return serialized || 'Google sign-in failed.';
}

async function requestTokenUsingWebIdentity(clientId: string, scope: string): Promise<string> {
  await loadScript(GOOGLE_IDENTITY_SCRIPT);

  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error('Google identity services are unavailable on this device.');

  return new Promise((resolve, reject) => {
    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope,
      callback: response => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error || 'Google sign-in failed.'));
          return;
        }
        resolve(response.access_token);
      },
    });
    tokenClient.requestAccessToken({ prompt: 'select_account consent' });
  });
}

async function requestGoogleToken(androidClientId: string, webClientId: string, scopes: string[]): Promise<string> {
  if (!webClientId) throw new Error('Google web client ID is not configured.');
  if (!androidClientId) throw new Error('Google Android client ID is not configured.');

  const clientId = webClientId;
  const scopeList = Array.from(new Set(scopes));

  if (Capacitor.isNativePlatform()) {
    try {
      GoogleAuth.initialize({
        clientId,
        serverClientId: webClientId,
        androidClientId,
        grantOfflineAccess: true,
        scopes: scopeList,
      });

      // Force account picker each time so the user can switch accounts explicitly.
      await GoogleAuth.signOut().catch(() => undefined);

      const user = await GoogleAuth.signIn();
      if (user.authentication?.accessToken) {
        return user.authentication.accessToken;
      }

      const refreshed = await GoogleAuth.refresh();
      if (refreshed.accessToken) {
        return refreshed.accessToken;
      }

      throw new Error('Google sign-in succeeded but no access token was returned.');
    } catch (error) {
      const payload = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('[google-drive] Native GoogleAuth error', {
        androidClientId,
        webClientId,
        scopes: scopeList,
        payload,
        error,
      });

      // Fallback to GIS token flow when native token retrieval fails after account selection.
      try {
        return await requestTokenUsingWebIdentity(webClientId, scopes.join(' '));
      } catch (fallbackError) {
        console.error('[google-drive] Web identity fallback error', {
          fallbackError,
          originalError: error,
        });
        throw new Error(getGoogleAuthErrorMessage(error));
      }
    }
  }

  return requestTokenUsingWebIdentity(webClientId, scopes.join(' '));
}

export async function requestGoogleDriveToken(androidClientId: string, webClientId: string): Promise<string> {
  return requestGoogleToken(androidClientId, webClientId, [...BASIC_SCOPES, DRIVE_SCOPE]);
}

export async function requestGoogleIdentityToken(androidClientId: string, webClientId: string): Promise<string> {
  return requestGoogleToken(androidClientId, webClientId, BASIC_SCOPES);
}

export function getConfiguredGoogleWebClientId(): string {
  const envClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
  if (envClientId) return envClientId;
  return APP_DEFAULT_GOOGLE_CLIENT_ID;
}

export function getConfiguredGoogleAndroidClientId(): string {
  const envClientId = (import.meta.env.VITE_GOOGLE_ANDROID_CLIENT_ID as string | undefined)?.trim();
  if (envClientId) return envClientId;
  return APP_DEFAULT_GOOGLE_ANDROID_CLIENT_ID;
}

async function findBackupFileId(token: string): Promise<string | null> {
  const query = encodeURIComponent(`name='${BACKUP_FILE_NAME.replace(/'/g, "\\'")}' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=1`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new Error('Unable to access Google Drive app data folder.');
  const json = await response.json() as { files?: Array<{ id: string }> };
  return json.files?.[0]?.id || null;
}

export async function uploadBackupToDrive(token: string, fileContent: string): Promise<void> {
  const existingFileId = await findBackupFileId(token);

  const metadata = existingFileId
    ? { name: BACKUP_FILE_NAME }
    : { name: BACKUP_FILE_NAME, parents: ['appDataFolder'] };

  const boundary = `-------financial-clarity-${Date.now()}`;
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    `${fileContent}\r\n` +
    `--${boundary}--`;

  const endpoint = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const method = existingFileId ? 'PATCH' : 'POST';

  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    throw new Error('Google Drive backup failed.');
  }
}

export async function downloadBackupFromDrive(token: string): Promise<string | null> {
  const fileId = await findBackupFileId(token);
  if (!fileId) return null;

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new Error('Google Drive restore failed.');
  return response.text();
}
