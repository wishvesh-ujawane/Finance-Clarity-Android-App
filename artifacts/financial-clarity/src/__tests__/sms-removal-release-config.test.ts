import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Static guard for PRD FR-10: the Android build must not regain SMS access.
// The merged release manifest still needs a manual check (ARCHITECTURE §16.1).
const appRoot = path.resolve(import.meta.dirname, '..', '..');
const androidMain = path.join(appRoot, 'android', 'app', 'src', 'main');

function readAppFile(...segments: string[]): string {
  return readFileSync(path.join(...segments), 'utf-8');
}

describe('SMS removal release configuration', () => {
  it('declares only the approved Android permissions', () => {
    const manifest = readAppFile(androidMain, 'AndroidManifest.xml');
    const permissions = [...manifest.matchAll(/<uses-permission[^>]*android:name="([^"]+)"/g)].map(
      match => match[1],
    );

    expect(permissions.sort()).toEqual([
      'android.permission.INTERNET',
      'android.permission.USE_BIOMETRIC',
      'android.permission.USE_FINGERPRINT',
    ]);
    expect(manifest).not.toMatch(/sms/i);
  });

  it('registers no SMS native plugin', () => {
    const mainActivity = readAppFile(
      androidMain,
      'java',
      'com',
      'bytetobrain',
      'fiscalfocus',
      'MainActivity.java',
    );

    expect(mainActivity).not.toMatch(/sms/i);
  });

  // capacitor.plugins.json is generated from these packages by `cap sync`.
  it('depends on no SMS package', () => {
    const pkg = JSON.parse(readAppFile(appRoot, 'package.json')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];

    expect(names.filter(name => /sms/i.test(name))).toEqual([]);
  });
});
