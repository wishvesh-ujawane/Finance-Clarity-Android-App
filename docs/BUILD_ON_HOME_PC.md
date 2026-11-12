# Fiscal Focus — Home-PC APK Build Manual

How to build an APK of **Fiscal Focus** on your own Windows PC and install it on
your phone for personal use.

> **Why a separate PC?** The corporate work machine blocks
> `services.gradle.org`, so Gradle cannot download its dependencies there. Do
> the web checks (typecheck, tests, build) anywhere; run Gradle on a personal
> machine.

---

## 0. Before you start

### 0.1 The code you want must be on GitHub

Your home PC can only build what has been **pushed**. Before leaving the work
machine, confirm the branch you want to build is pushed:

```powershell
git status --short          # should print nothing
git log --oneline -1
git ls-remote --heads origin <branch-name>   # must print the same commit
```

If `main` on GitHub still contains the SMS feature, building `main` gives you
the old SMS app (with the `READ_SMS` permission). Build the branch that holds
the SMS removal until it is merged.

### 0.2 What you are building

| Item | Value |
|---|---|
| App name | Fiscal Focus |
| Application ID | `com.bytetobrain.fiscalfocus` |
| minSdk / compileSdk / targetSdk | 24 / 36 / 36 |
| Web stack | Vite + React 18 + TypeScript |
| Native shell | Capacitor 8 |
| Android Gradle Plugin / Gradle wrapper | 8.13.0 / 8.14.3 (downloaded automatically) |
| **JDK** | **21** (required — see §1.2) |
| Package manager | pnpm 10 (`npm` and `yarn` are rejected) |
| Android permissions | `INTERNET`, `USE_BIOMETRIC`, `USE_FINGERPRINT` (Android ≤ 9 only) |

### 0.3 Debug or release APK?

| | Debug APK | Release APK (recommended for real data) |
|---|---|---|
| Signing | Automatic Android debug key | Your own keystore (§6) |
| Effort | One script | One-time keystore setup |
| Data exposure | **Debuggable**: anyone with your unlocked phone and a USB cable can read all app data (`adb run-as`, Chrome WebView inspector) | Not debuggable |
| Use for | Trying a build | Daily use with your real finances |

**Pick one signing key and stay with it.** Android refuses to update an app
signed with a different key; the only way across is uninstall, which **deletes
all local data**. See §8 before switching.

---

## 1. One-time toolchain install

### 1.1 Node.js 24 and pnpm 10

Install Node.js **24 LTS** (Windows x64) from <https://nodejs.org/en/download>,
then in a new PowerShell window:

```powershell
node --version                      # v24.x
corepack enable
corepack prepare pnpm@10.33.2 --activate
pnpm --version                      # 10.33.2
```

### 1.2 JDK 21

Capacitor 8 compiles with Java 21, so **JDK 17 fails** with
`invalid source release: 21`. Avoid JDK 24+ too: Gradle 8.14.3 cannot run on
Java 25.

Install any JDK **21** build (Microsoft Build of OpenJDK, Eclipse Temurin, or
Oracle), for example from <https://learn.microsoft.com/java/openjdk/download#openjdk-21>.

### 1.3 Android SDK command-line tools

You do not need Android Studio. Download **Command line tools only** from
<https://developer.android.com/studio> (bottom of the page) and unpack it into
this exact layout (create the `latest` folder yourself):

```
C:\Android\cmdline-tools\latest\bin\sdkmanager.bat
C:\Android\cmdline-tools\latest\lib\...
```

### 1.4 Environment variables

```powershell
notepad $PROFILE
```

Add (adjust `JAVA_HOME` to where your JDK 21 is installed):

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.8.9-hotspot"
$env:ANDROID_HOME = "C:\Android"
$env:ANDROID_SDK_ROOT = "C:\Android"
$env:PATH = "$env:JAVA_HOME\bin;C:\Android\cmdline-tools\latest\bin;C:\Android\platform-tools;$env:PATH"
```

Reload and check:

```powershell
. $PROFILE
java -version            # must print 21.x
```

### 1.5 SDK packages

```powershell
sdkmanager --licenses    # answer y to each prompt
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
adb --version
```

### 1.6 Git

```powershell
git --version            # install from https://git-scm.com/download/win if missing
```

---

## 2. Get the code

```powershell
cd C:\
git clone https://github.com/wishvesh-ujawane/Finance-Clarity-Android-App.git
cd Finance-Clarity-Android-App
git checkout <branch-name>          # see §0.1
git log --oneline -1                # matches the commit you pushed
```

Later updates: `git pull`.

---

## 3. Install dependencies and run the checks

From the repository root:

```powershell
pnpm install
pnpm run typecheck
pnpm --filter @workspace/financial-clarity run test:run
```

All three must succeed before you build an APK.

### 3.1 Optional: `google-services.json`

`artifacts\financial-clarity\android\app\google-services.json` is **not** in
git and is optional; the app builds and runs normally without it. Crash
reporting (Firebase Crashlytics) was removed on 2026-11-12 (PRD D9), so the
file no longer enables any diagnostics. **Never commit it.**

After pulling this change, run `pnpm install` and then
`pnpm --filter @workspace/financial-clarity exec cap sync android` so the
generated `capacitor.plugins.json` no longer lists the Firebase plugins.

---

## 4. Build a debug APK

```powershell
.\scripts\build-debug-apk.ps1
```

The script builds the web bundle, runs `cap sync android`, runs
`gradlew assembleDebug`, and installs onto a USB-connected phone if one is
found. **The first Gradle run downloads about 500 MB and takes 5–15 minutes.**

Output:

```
artifacts\financial-clarity\android\app\build\outputs\apk\debug\app-debug.apk
```

Step by step (use this when the script hides an error):

```powershell
pnpm --filter @workspace/financial-clarity run build
cd artifacts\financial-clarity
pnpm exec cap sync android
cd android
.\gradlew assembleDebug
```

---

## 5. Google Drive backup on your own build

Google sign-in on Android only works when the **SHA-1 fingerprint of the key
that signed the APK** is registered for `com.bytetobrain.fiscalfocus` in the
Google Cloud project. Your home PC has its own debug key, so sign-in **fails**
(usually reported as error code `10` / `DEVELOPER_ERROR`) until you do one of
the following.

### Option A — register your PC's fingerprint (recommended)

1. Print the fingerprints:

   ```powershell
   cd artifacts\financial-clarity\android
   .\gradlew signingReport
   ```

   Copy the `SHA1` line for `Variant: debug` (and later your release key, §6).
2. Google Cloud Console → the project that owns the app's OAuth clients →
   **APIs & Services → Credentials → Create credentials → OAuth client ID →
   Android**. Package name `com.bytetobrain.fiscalfocus`, paste the SHA-1.
   Create one Android client per key you use.
3. **OAuth consent screen → Test users**: add the Google account you will sign
   in with. While the consent screen is in *Testing*, only listed accounts can
   sign in.

Leave `serverClientId` in `capacitor.config.ts` and `server_client_id` in
`strings.xml` unchanged — that is the Web client ID and is the same for every
build.

### Option B — reuse the already-registered debug key

Copy `%USERPROFILE%\.android\debug.keystore` from the machine whose SHA-1 is
already registered to the same path on your home PC, then rebuild.

### Before you trust it

- Do one manual **Back up now** and confirm the backup appears in Drive.
- Auto-backup runs at most once every 7 days and only after a successful
  manual backup.
- On a freshly installed app, **restore first**. If you tap **Back up now**
  while Drive holds more transactions than the phone, the app asks before
  replacing it and saves a `pre-overwrite` copy in the same Drive folder.

---

## 6. Build a release APK (recommended for real data)

### 6.1 Create your keystore — once, outside the repository

```powershell
New-Item -ItemType Directory -Force C:\keys | Out-Null
keytool -genkeypair -v -storetype PKCS12 `
  -keystore C:\keys\fiscal-focus-release.jks `
  -alias fiscal-focus -keyalg RSA -keysize 2048 -validity 10000
```

Back up the `.jks` file and both passwords somewhere safe (a password manager
plus an offline copy). **If you lose them you can never update the installed
app again** without uninstalling it and losing local data.

Register this key's SHA-1 for Google Drive (§5, Option A):

```powershell
keytool -list -v -keystore C:\keys\fiscal-focus-release.jks -alias fiscal-focus
```

### 6.2 Build and sign

This passes the signing details to Gradle on the command line, so nothing
secret is written into the repository:

```powershell
cd C:\Finance-Clarity-Android-App
pnpm --filter @workspace/financial-clarity run build
cd artifacts\financial-clarity
pnpm exec cap sync android
cd android

$storePass = Read-Host "Keystore password" -AsSecureString
$keyPass   = Read-Host "Key password" -AsSecureString
$plain = { param($s) [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)) }

.\gradlew assembleRelease `
  "-Pandroid.injected.signing.store.file=C:\keys\fiscal-focus-release.jks" `
  "-Pandroid.injected.signing.store.password=$(& $plain $storePass)" `
  "-Pandroid.injected.signing.key.alias=fiscal-focus" `
  "-Pandroid.injected.signing.key.password=$(& $plain $keyPass)"
```

Output:

```
artifacts\financial-clarity\android\app\build\outputs\apk\release\app-release.apk
```

Never commit the keystore, its passwords, or a `keystore.properties` file.

---

## 7. Install on the phone

**USB (needs Developer options → USB debugging):**

```powershell
adb devices                          # phone listed as "device", not "unauthorized"
adb install -r <path-to-apk>
```

**Without USB:** copy the APK to the phone (cable, Drive, messaging app), open
it, and allow installs from that source when Android asks. Play Protect may
warn about an unknown developer; that is expected for a sideloaded build.

**Updating:** `git pull`, rebuild with the **same key**, install over the top.
Data is kept.

---

## 8. Moving data between differently signed builds

Switching debug ↔ release, or to a new keystore, requires uninstalling, which
wipes all local data. Before switching:

1. **Google Drive (preferred):** Settings → Backup & Restore → **Back up now**,
   and confirm the counts. After installing the new build, sign in and
   **Restore**.
2. **CSV (partial):** CSV holds transactions only — not budgets, recurring
   rules, savings targets, or custom category settings. Import shows a
   preview and skips duplicates, so re-importing your own export is safe.
   Use it only as a fallback to Drive.

Note: the app lock (PIN/biometrics) is not part of any backup; set it up again.

---

## 9. Phone checklist after installing

1. The app opens on onboarding (fresh install) or the Dashboard.
2. Add an expense and an income; Dashboard totals update.
3. Settings → Security: set a PIN, background the app for over 30 seconds,
   reopen — the lock screen appears.
4. With the PIN set, open the recent-apps screen: Fiscal Focus shows a blank
   card, and taking a screenshot is blocked. Disable the PIN: screenshots work
   again.
5. On the lock screen, enter a wrong PIN five times, then force-stop and
   reopen the app — the "Too many attempts" countdown is still running.
6. Settings → Backup & Restore → Connect Google Drive succeeds (§5).
7. Android Settings → Apps → Fiscal Focus → Permissions shows **no SMS
   permission**.

---

## 10. Clean rebuild

```powershell
.\scripts\clean-build.ps1
```

Or manually:

```powershell
cd artifacts\financial-clarity\android
.\gradlew clean
Remove-Item -Recurse -Force .gradle, build, app\build -ErrorAction SilentlyContinue
# Only when truly stuck:
Remove-Item -Recurse -Force $env:USERPROFILE\.gradle\caches -ErrorAction SilentlyContinue
cd ..\..\..
pnpm install
.\scripts\build-debug-apk.ps1
```

---

## 11. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `invalid source release: 21` | Gradle is running on JDK 17. Install JDK 21 and point `JAVA_HOME` at it (§1.2, §1.4). |
| `Unsupported class file major version 69` or Gradle fails to start | Gradle is running on JDK 25+. Use JDK 21. |
| `SDK location not found` | `ANDROID_HOME` not set in this shell. Reload the profile, or create `artifacts\financial-clarity\android\local.properties` with `sdk.dir=C:\\Android`. |
| Hangs or `Connection reset` downloading `gradle-8.14.3-all.zip` | The network blocks `services.gradle.org`. Use another network or tether. |
| `pnpm install` says to use pnpm | You ran `npm` or `yarn`. Use `pnpm install`. |
| Google sign-in fails with code `10` | The APK's SHA-1 is not registered, or your account is not a test user (§5). |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | The installed app was signed with a different key. Back up first, then `adb uninstall com.bytetobrain.fiscalfocus` (wipes data) — see §8. |
| `adb devices` shows `unauthorized` | Accept the *Allow USB debugging?* prompt on the phone. |

---

## 12. Command summary

| Command | Purpose |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm run typecheck` | TypeScript gate (app + e2e) |
| `pnpm --filter @workspace/financial-clarity run test:run` | Unit tests |
| `.\scripts\build-debug-apk.ps1` | Web build → `cap sync` → debug APK → optional install |
| `.\gradlew signingReport` | Print SHA-1 fingerprints for Google sign-in |
| `.\gradlew assembleRelease -P…` | Signed release APK (§6.2) |
