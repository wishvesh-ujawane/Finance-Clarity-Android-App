import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Owner decision D9 (2026-11-12): crash reporting is removed. The app sends no
// diagnostics, so none of this may come back without a new decision.
const appRoot = path.resolve(import.meta.dirname, '..', '..');
const androidRoot = path.join(appRoot, 'android');

function read(...segments: string[]): string {
  return readFileSync(path.join(...segments), 'utf-8');
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe('crash reporting removal (D9)', () => {
  it('depends on no Firebase or Crashlytics package', () => {
    const pkg = JSON.parse(read(appRoot, 'package.json')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
    expect(names.filter(name => /firebase|crashlytics/i.test(name))).toEqual([]);
  });

  it('applies no Crashlytics Gradle plugin and links no Firebase Capacitor module', () => {
    for (const file of [
      [androidRoot, 'build.gradle'],
      [androidRoot, 'app', 'build.gradle'],
      [androidRoot, 'app', 'capacitor.build.gradle'],
      [androidRoot, 'capacitor.settings.gradle'],
    ]) {
      expect(read(...file)).not.toMatch(/crashlytics|capacitor-firebase/i);
    }
  });

  it('imports no crash-reporting module from app code', () => {
    const offenders = sourceFiles(path.join(appRoot, 'src')).filter(file =>
      /@capacitor-firebase|crashlytics/i.test(read(file)),
    );
    expect(offenders).toEqual([]);
  });
});
