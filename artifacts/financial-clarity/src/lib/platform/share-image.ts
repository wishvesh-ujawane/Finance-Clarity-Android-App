/**
 * Image sharing (platform layer, API §6.6). Pages call this instead of
 * Capacitor plugins. Failures are returned as values; a user closing the
 * share sheet is `cancelled`, which callers treat as "not an error".
 */
export type ShareImageResult = { ok: true } | { ok: false; error: 'cancelled' | 'failed' };

/** True when the error means the user dismissed the share sheet. */
export function isShareCancellation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return /cancel/i.test(message);
}

function isNativePlatform(): boolean {
  const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(capacitor?.isNativePlatform?.());
}

/** Shares a PNG data URL through the system share sheet, or downloads it in a browser. */
export async function shareImage(dataUrl: string, filename: string, text: string): Promise<ShareImageResult> {
  try {
    if (isNativePlatform()) {
      const [{ Filesystem, Directory }, { Share }] = await Promise.all([
        import('@capacitor/filesystem'),
        import('@capacitor/share'),
      ]);
      const written = await Filesystem.writeFile({
        path: filename,
        data: dataUrl.split(',')[1] ?? '',
        directory: Directory.Cache,
      });
      await Share.share({ title: 'Fiscal Focus analysis', text, url: written.uri, dialogTitle: 'Share analysis' });
    } else {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      link.click();
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: isShareCancellation(error) ? 'cancelled' : 'failed' };
  }
}
