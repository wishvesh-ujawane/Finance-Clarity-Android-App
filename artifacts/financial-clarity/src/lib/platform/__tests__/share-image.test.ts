import { afterEach, describe, expect, it, vi } from 'vitest';
import { isShareCancellation, shareImage } from '../share-image';

describe('shareImage (browser)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('downloads the image and reports success', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await expect(shareImage('data:image/png;base64,AAA', 'analysis.png', 'text')).resolves.toEqual({ ok: true });
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('returns a failure instead of throwing', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw new Error('blocked'); });
    await expect(shareImage('data:image/png;base64,AAA', 'analysis.png', 'text')).resolves.toEqual({ ok: false, error: 'failed' });
  });

  it('treats a dismissed share sheet as a cancellation, not an error', () => {
    expect(isShareCancellation(new Error('Share canceled'))).toBe(true);
    expect(isShareCancellation('User cancelled')).toBe(true);
    expect(isShareCancellation(new Error('Disk full'))).toBe(false);
  });
});
