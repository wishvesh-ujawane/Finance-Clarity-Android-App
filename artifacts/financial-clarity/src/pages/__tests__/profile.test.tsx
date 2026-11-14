import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as auth from '@/lib/googleAuth';
import { FinanceProvider } from '@/context/FinanceContext';
import { BackupProvider } from '@/context/BackupContext';
import Profile from '../Profile';
import Settings from '../Settings';

const SYNTHETIC_USER = {
  id: 'u1',
  email: 'synthetic@example.invalid',
  name: 'Synthetic User',
  imageUrl: 'https://example.invalid/photo.png',
};

const session = vi.hoisted(() => ({ user: null as null | { id: string; email: string; name: string; imageUrl?: string } }));

vi.mock('@capacitor/app', () => ({
  App: { addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }) },
}));

vi.mock('@/lib/googleAuth', () => ({
  getCurrentUser: () => session.user,
  isSignedIn: () => session.user !== null,
  signIn: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
  trySilentRefresh: vi.fn(async () => session.user),
}));

vi.mock('@/lib/googleDrive', () => ({
  BACKUP_FILE_NAME: 'finance-clarity-backup.json',
  DriveError: class DriveError extends Error {},
  downloadBackup: vi.fn(),
  findBackupFile: vi.fn(),
  findOrCreateBackupFolder: vi.fn(),
  uploadBackup: vi.fn(),
  uploadSnapshot: vi.fn(),
}));

const security = vi.hoisted(() => ({ isAppLockEnabled: false, settings: { biometricEnabled: false } }));
vi.mock('@/context/SecurityContext', () => ({
  useSecurity: () => security,
}));

function renderPage(page: ReactNode) {
  return render(
    <FinanceProvider>
      <BackupProvider>{page}</BackupProvider>
    </FinanceProvider>,
  );
}

async function renderProfile() {
  const view = renderPage(<Profile />);
  await waitFor(() => expect(auth.trySilentRefresh).toHaveBeenCalled());
  return view;
}

beforeEach(() => {
  localStorage.clear();
  session.user = null;
  security.isAppLockEnabled = false;
  security.settings = { biometricEnabled: false };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Profile page when not signed in to Google', () => {
  it('asks the user to sign in and still offers security settings', async () => {
    await renderProfile();

    expect(screen.getByText('You\u2019re not signed in')).toBeTruthy();
    expect(screen.getByTestId('profile-sign-in').textContent).toContain('Sign in with Google');
    expect(screen.queryByTestId('profile-disconnect')).toBeNull();
    const securityLink = screen.getByTestId('profile-security-link');
    expect(securityLink.getAttribute('href')).toBe('/settings/security');
    expect(securityLink.textContent).toContain('Set a PIN to lock the app.');
  });

  it('shows the Google name, email, and photo after signing in', async () => {
    vi.mocked(auth.signIn).mockResolvedValueOnce(SYNTHETIC_USER);
    await renderProfile();

    await act(async () => { fireEvent.click(screen.getByTestId('profile-sign-in')); });

    expect(await screen.findByText(`Signed in as ${SYNTHETIC_USER.email}.`)).toBeTruthy();
    expect(screen.getByTestId('profile-name').textContent).toBe(SYNTHETIC_USER.name);
    expect(screen.getByTestId('profile-email').textContent).toBe(SYNTHETIC_USER.email);
    expect(screen.getByTestId('profile-account-card').querySelector('img')?.getAttribute('src')).toBe(SYNTHETIC_USER.imageUrl);
  });

  it('shows a busy button and ignores repeated taps while signing in', async () => {
    let resolveSignIn: (user: typeof SYNTHETIC_USER) => void = () => {};
    vi.mocked(auth.signIn).mockReturnValueOnce(new Promise(resolve => { resolveSignIn = resolve; }));
    await renderProfile();

    const button = screen.getByTestId('profile-sign-in') as HTMLButtonElement;
    fireEvent.click(button);
    await waitFor(() => expect(button.textContent).toContain('Signing in\u2026'));
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(auth.signIn).toHaveBeenCalledTimes(1);

    await act(async () => { resolveSignIn(SYNTHETIC_USER); });
    expect(await screen.findByTestId('profile-name')).toBeTruthy();
  });

  it('shows an error that says data is safe when sign-in fails', async () => {
    vi.mocked(auth.signIn).mockRejectedValueOnce(new Error('Something went wrong: 10'));
    await renderProfile();

    await act(async () => { fireEvent.click(screen.getByTestId('profile-sign-in')); });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Couldn\u2019t sign in to Google\. Your data on this phone is safe\./);
    expect(alert.textContent).not.toContain('10');
    expect(screen.getByTestId('profile-sign-in')).toBeTruthy();
  });

  it('stays quiet when the user cancels the Google prompt', async () => {
    vi.mocked(auth.signIn).mockRejectedValueOnce(new Error('The user canceled the sign-in flow.'));
    await renderProfile();

    await act(async () => { fireEvent.click(screen.getByTestId('profile-sign-in')); });

    await waitFor(() => expect((screen.getByTestId('profile-sign-in') as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not start sign-in while offline', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      await renderProfile();

      fireEvent.click(screen.getByTestId('profile-sign-in'));

      expect((await screen.findByRole('alert')).textContent).toMatch(/You\u2019re offline/);
      expect(auth.signIn).not.toHaveBeenCalled();
    } finally {
      onLine.mockRestore();
    }
  });
});

describe('Profile page when signed in to Google', () => {
  beforeEach(() => {
    session.user = SYNTHETIC_USER;
  });

  it('refreshes the profile from Google', async () => {
    const renamed = { ...SYNTHETIC_USER, name: 'Renamed User' };
    vi.mocked(auth.signIn).mockResolvedValueOnce(renamed);
    await renderProfile();
    expect(screen.getByTestId('profile-name').textContent).toBe(SYNTHETIC_USER.name);

    await act(async () => { fireEvent.click(screen.getByTestId('profile-refresh')); });

    expect(await screen.findByText('Profile updated from Google.')).toBeTruthy();
    expect(screen.getByTestId('profile-name').textContent).toBe('Renamed User');
  });

  it('says so when the user picks a different Google account', async () => {
    const other = { id: 'u2', email: 'other@example.invalid', name: 'Other User' };
    vi.mocked(auth.signIn).mockResolvedValueOnce(other);
    await renderProfile();

    await act(async () => { fireEvent.click(screen.getByTestId('profile-refresh')); });

    expect(await screen.findByText(`Switched to ${other.email}.`)).toBeTruthy();
    expect(screen.getByTestId('profile-email').textContent).toBe(other.email);
  });

  it('disconnects Google and returns to the sign-in prompt', async () => {
    await renderProfile();

    await act(async () => { fireEvent.click(screen.getByTestId('profile-disconnect')); });

    expect(await screen.findByText(/Google disconnected\. Your data on this phone and your Drive backups are kept\./)).toBeTruthy();
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('profile-sign-in')).toBeTruthy();
  });

  it('falls back to the initial when the Google photo cannot load', async () => {
    await renderProfile();
    const img = screen.getByTestId('profile-account-card').querySelector('img');
    if (!img) throw new Error('profile photo not rendered');

    fireEvent.error(img);

    expect(screen.getByTestId('profile-account-card').querySelector('img')).toBeNull();
    expect(screen.getByTestId('profile-account-card').querySelector('[data-testid="profile-avatar"]')?.textContent).toBe('S');
  });

  it('shows app lock status on the security row', async () => {
    security.isAppLockEnabled = true;
    security.settings = { biometricEnabled: true };
    await renderProfile();

    expect(screen.getByTestId('profile-security-link').textContent).toContain('App lock is on \u2022 biometrics enabled');
  });
});

describe('Settings profile button', () => {
  it('links to the profile page and no longer lists Security', async () => {
    renderPage(<Settings />);
    await waitFor(() => expect(auth.trySilentRefresh).toHaveBeenCalled());

    const link = screen.getByTestId('settings-profile-link');
    expect(link.getAttribute('href')).toBe('/settings/profile');
    expect(link.getAttribute('aria-label')).toBe('Profile and security, not signed in');
    expect(screen.queryByTestId('settings-security-link')).toBeNull();
  });

  it('shows the signed-in account on the profile button', async () => {
    session.user = SYNTHETIC_USER;
    renderPage(<Settings />);
    await waitFor(() => expect(auth.trySilentRefresh).toHaveBeenCalled());

    const link = screen.getByTestId('settings-profile-link');
    expect(link.getAttribute('aria-label')).toBe(`Profile and security, signed in as ${SYNTHETIC_USER.name}`);
    expect(link.querySelector('img')?.getAttribute('src')).toBe(SYNTHETIC_USER.imageUrl);
  });
});
