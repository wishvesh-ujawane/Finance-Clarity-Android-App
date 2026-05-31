import { getAccessToken } from './googleAuth';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

export const BACKUP_FOLDER_NAME = 'Finance Clarity Backups';
export const BACKUP_FILE_NAME = 'finance-clarity-backup.json';
export const BACKUP_MIME = 'application/json';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
  appProperties?: Record<string, string>;
}

export class DriveError extends Error {
  readonly status: number;
  readonly reason?: string;
  constructor(message: string, status: number, reason?: string) {
    super(message);
    this.name = 'DriveError';
    this.status = status;
    this.reason = reason;
  }
}

async function driveFetch(url: string, init: RequestInit, retry = true): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers });

  if (response.status === 401 && retry) {
    // Force token refresh and try again exactly once.
    await getAccessToken({ forceRefresh: true });
    return driveFetch(url, init, false);
  }
  if (!response.ok) {
    let reason: string | undefined;
    let message = `Drive request failed (${response.status})`;
    let rawBody = '';
    try {
      rawBody = await response.text();
      const body = rawBody ? JSON.parse(rawBody) : null;
      const error = body?.error;
      if (error?.message) message = error.message;
      reason = error?.errors?.[0]?.reason;
    } catch {
      // body wasn't JSON; keep rawBody for logging
    }
    // Verbose diagnostic so 403/401 root-cause is visible in DevTools / logcat.
    // eslint-disable-next-line no-console
    console.error('[Drive]', init.method ?? 'GET', url, '\u2192', response.status, { reason, message, body: rawBody });
    throw new DriveError(message, response.status, reason);
  }
  return response;
}

async function listFiles(query: string, fields: string): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    q: query,
    fields: `files(${fields})`,
    spaces: 'drive',
    pageSize: '10',
  });
  const response = await driveFetch(`${DRIVE_API}/files?${params}`, { method: 'GET' });
  const data = (await response.json()) as { files?: DriveFile[] };
  return data.files ?? [];
}

export async function findOrCreateBackupFolder(): Promise<string> {
  const escaped = BACKUP_FOLDER_NAME.replace(/'/g, "\\'");
  const existing = await listFiles(
    `name='${escaped}' and mimeType='${FOLDER_MIME}' and trashed=false`,
    'id,name',
  );
  if (existing.length > 0 && existing[0].id) return existing[0].id;

  const response = await driveFetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: BACKUP_FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  const data = (await response.json()) as DriveFile;
  return data.id;
}

export async function findBackupFile(folderId: string): Promise<DriveFile | null> {
  const escapedName = BACKUP_FILE_NAME.replace(/'/g, "\\'");
  const files = await listFiles(
    `name='${escapedName}' and '${folderId}' in parents and trashed=false`,
    'id,name,modifiedTime,size,appProperties',
  );
  return files[0] ?? null;
}

export async function downloadBackup(fileId: string): Promise<string> {
  const response = await driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,
    { method: 'GET' },
  );
  return await response.text();
}

interface UploadOptions {
  /** If supplied, updates this file in place; otherwise creates a new file in the folder. */
  fileId?: string;
  folderId?: string;
  appProperties?: Record<string, string>;
}

export async function uploadBackup(jsonString: string, options: UploadOptions): Promise<DriveFile> {
  if (options.fileId) {
    return updateBackupContent(options.fileId, jsonString, options.appProperties);
  }
  if (!options.folderId) throw new Error('folderId is required when creating a new backup file');
  return createBackup(options.folderId, jsonString, options.appProperties);
}

async function createBackup(
  folderId: string,
  jsonString: string,
  appProperties?: Record<string, string>,
): Promise<DriveFile> {
  const boundary = `-------fc-${Math.random().toString(36).slice(2)}`;
  const metadata = {
    name: BACKUP_FILE_NAME,
    parents: [folderId],
    mimeType: BACKUP_MIME,
    ...(appProperties ? { appProperties } : {}),
  };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${BACKUP_MIME}\r\n\r\n` +
    `${jsonString}\r\n` +
    `--${boundary}--`;

  const response = await driveFetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,modifiedTime,size,appProperties`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  return (await response.json()) as DriveFile;
}

async function updateBackupContent(
  fileId: string,
  jsonString: string,
  appProperties?: Record<string, string>,
): Promise<DriveFile> {
  // 1) PATCH metadata (appProperties) if provided.
  if (appProperties) {
    await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appProperties }),
    });
  }
  // 2) Update file content.
  const response = await driveFetch(
    `${DRIVE_UPLOAD_API}/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,name,modifiedTime,size,appProperties`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': BACKUP_MIME },
      body: jsonString,
    },
  );
  return (await response.json()) as DriveFile;
}

/** Save a one-off pre-restore safety snapshot under a unique name (kept by user manually). */
export async function uploadSnapshot(
  folderId: string,
  name: string,
  jsonString: string,
): Promise<DriveFile> {
  const boundary = `-------fc-${Math.random().toString(36).slice(2)}`;
  const metadata = { name, parents: [folderId], mimeType: BACKUP_MIME };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${BACKUP_MIME}\r\n\r\n` +
    `${jsonString}\r\n` +
    `--${boundary}--`;

  const response = await driveFetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,modifiedTime,size`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  return (await response.json()) as DriveFile;
}
