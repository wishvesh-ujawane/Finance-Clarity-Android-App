# Fiscal Focus — Home-PC APK Build Manual

Self-contained guide to install the toolchain and produce a signed-for-sideload
debug APK of **Fiscal Focus** on your personal Windows PC. Written for the
current branch `feature/sms-auto-import-phase-1-foundation` (tip: `5e9e32c`),
which includes the SMS auto-import feature (Phases 1-5a).

> **Why this exists.** The corporate work machine blocks
> `services.gradle.org` at the TLS layer, so `gradlew assembleDebug` can never
> download its dependencies there. Any off-network machine (home PC, personal
> laptop, hotspot) will build cleanly. Everything below is the exact end-to-end
> sequence on a fresh Windows install.

---

## 0. What you are building

| Item | Value |
|------|-------|
| App name | Fiscal Focus |
| Application ID | `com.bytetobrain.fiscalfocus` |
| minSdkVersion | 24 (Android 7.0) |
| compileSdkVersion / targetSdkVersion | 36 |
| Web stack | Vite 5 + React 18 + TypeScript strict |
| Native shell | Capacitor 8.3.1 |
| Package manager | **pnpm 10** (npm/yarn will fail on `preinstall`) |
| Feature freshly landed | SMS auto-import with `READ_SMS` runtime permission |

The debug APK produced by this manual is signed by the Android debug
keystore. It is **sideload-only**; it is NOT distributable through Play Store
(that requires the release-signing flow at the end of this doc).

---

## 1. One-time toolchain install

### 1.1 Node.js 24 + pnpm 10

Download the Windows x64 installer from <https://nodejs.org/en/download> and
pick the **24 LTS** channel. Then in a fresh PowerShell window:

```powershell
node --version           # expect v24.x
corepack enable
corepack prepare pnpm@10.33.2 --activate
pnpm --version           # expect 10.33.2
```

`preinstall` in the root [package.json](../package.json) hard-rejects npm and
yarn — do not shortcut with `npm install`.

### 1.2 Java Development Kit 17

Any JDK 17 build works — Microsoft, Adoptium/Temurin, or Oracle are all fine.
Microsoft build:

```
https://learn.microsoft.com/java/openjdk/download
```

After installing, in a fresh PowerShell:

```powershell
java -version            # expect 17.x
```

If `java` is not on `PATH`, set both env vars in the same profile as step 1.4
below.

### 1.3 Android SDK command-line tools

You do NOT need the full Android Studio download. Grab the tiny "command line
tools only" archive from <https://developer.android.com/studio> (bottom of the
page).

Then unpack it into this exact layout — Android's SDK manager is picky:

```
C:\Android\cmdline-tools\latest\bin\sdkmanager.bat
C:\Android\cmdline-tools\latest\bin\avdmanager.bat
C:\Android\cmdline-tools\latest\lib\...
```

(The zip unpacks as `cmdline-tools\` at the top — you must add the `latest\`
folder yourself and move the contents into it.)

### 1.4 PowerShell environment variables

Open your PowerShell profile once:

```powershell
notepad $PROFILE
```

Paste and save (adjust `JAVA_HOME` to your JDK path):

```powershell
$env:ANDROID_HOME = "C:\Android"
$env:ANDROID_SDK_ROOT = "C:\Android"
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17"
$env:PATH += ";$env:JAVA_HOME\bin"
$env:PATH += ";C:\Android\cmdline-tools\latest\bin"
$env:PATH += ";C:\Android\platform-tools"
```

Reload:

```powershell
. $PROFILE
```

### 1.5 Accept SDK licenses + install platforms

```powershell
sdkmanager --licenses     # press y to each (about 6-8 prompts)

sdkmanager `
  "platform-tools" `
  "platforms;android-36" `
  "build-tools;36.0.0"

sdkmanager --list_installed
```

Expect to see `platform-tools`, `platforms;android-36`, `build-tools;36.0.0`.
`adb` should now be on `PATH`:

```powershell
adb --version             # expect Android Debug Bridge 1.0.41 or newer
```

### 1.6 Git

```powershell
git --version
```

If it prints "not recognized", install from <https://git-scm.com/download/win>
and re-open PowerShell.

---

## 2. Clone the repo

```powershell
cd C:\
git clone https://github.com/wishvesh-ujawane/Finance-Clarity-Android-App.git
cd Finance-Clarity-Android-App
git checkout feature/sms-auto-import-phase-1-foundation
git log --oneline -3        # tip should be 5e9e32c or newer
```

The corporate machine and the home PC can share the same branch — GitHub is
reachable from both. Push from either.

---

## 3. Install workspace dependencies

Still in the repo root:

```powershell
pnpm install
```

First run downloads ~1.5 GB of node_modules across the workspace (frontend +
API server + shared libs). Subsequent runs are seconds.

Sanity gate:

```powershell
pnpm run typecheck
```

Expected: all four projects (`api-server`, `financial-clarity`, `mockup-sandbox`,
`scripts`) print `Done`, and the process exits 0.

(Optional but recommended before your first APK build.)

```powershell
pnpm --filter @workspace/financial-clarity run test:run
```

Expect **187 passed** at the current tip.

---

## 4. Build the debug APK — the one-liner path

There is a wrapper script in the repo root that does everything:

```powershell
.\build-debug-apk.ps1
```

The script runs five steps:

1. `pnpm --filter @workspace/financial-clarity run build` — Vite production
   bundle into [artifacts/financial-clarity/dist/public](../artifacts/financial-clarity/dist/public).
2. `npx cap sync android` — copies the web bundle into the Android assets
   folder and refreshes Capacitor plugins (including the new **SmsInbox**
   plugin from Phase 3).
3. `.\gradlew assembleDebug` — builds the APK. **First run downloads Gradle
   8.14.3 + all AndroidX dependencies (~500 MB, 5-15 min).** Subsequent runs
   take ~30-60 seconds.
4. `adb devices` — checks if a phone is connected via USB.
5. `adb install -r ...\app-debug.apk` — installs onto the connected phone
   (skipped if no device).

Output APK path:

```
artifacts\financial-clarity\android\app\build\outputs\apk\debug\app-debug.apk
```

Copy that `.apk` to your phone by USB, cloud drive, or share sheet, and open
it — Android will prompt you to allow installs from this source, then install
"Fiscal Focus".

---

## 5. Manual build — the same thing, step by step

Use this when the wrapper script hides an error you need to see.

```powershell
# Repo root
cd C:\Finance-Clarity-Android-App

# 1. Web bundle
pnpm --filter @workspace/financial-clarity run build

# 2. Copy web bundle + Capacitor plugin metadata into the Android project
cd artifacts\financial-clarity
npx cap sync android

# 3. Build the APK
cd android
.\gradlew assembleDebug

# 4. (Optional) Install onto a USB-connected phone
adb devices
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

---

## 6. What you need on the phone

### 6.1 Enable sideload

- **Settings → About phone** — tap "Build number" seven times to unlock
  Developer options.
- **Settings → Developer options** — turn on **USB debugging** (only needed
  for `adb install`; not needed if you copy the APK manually).
- The first time you plug the phone into this PC, accept the "Allow USB
  debugging?" prompt on the phone and check "Always allow from this
  computer".

### 6.2 Grant `READ_SMS` at runtime (SMS auto-import feature)

`READ_SMS` is declared in [AndroidManifest.xml](../artifacts/financial-clarity/android/app/src/main/AndroidManifest.xml)
and requested at runtime by the SmsInbox Capacitor plugin.

> **Sideload trap — the standard permission page won't grant this.**
>
> `READ_SMS` is an Android **restricted permission** (along with `READ_CALL_LOG`,
> `SEND_SMS`, etc.). Since Android 10, restricted permissions on sideloaded
> APKs are hard-gated by the OS: the *Allow* radio in
> **Settings → Apps → Fiscal Focus → Permissions → SMS** is **disabled**, and
> tapping it shows *"App was denied access — access to this permission can put
> your personal and financial info at risk"*. Play Store's SMS/Call-Log policy
> exempts vetted apps by pre-whitelisting the permission at install time; a
> sideloaded APK has no such whitelist.
>
> Android exposes an on-device bypass — no ADB, no USB debugging required.
> Pick the option that matches your workflow.
>
> **Option A (no-ADB, on-device only — the transfer-and-tap path):**
>
> 1. On the phone, open **Settings → Apps → Fiscal Focus**.
> 2. Tap the **⋮ three-dot menu** in the top-right of the app-info page.
> 3. Tap **"Allow restricted settings"** (Samsung One UI / stock Android
>    13+; some vendors say **"Allow restricted permissions"** or just
>    **"Restricted settings"**).
>    - If the menu item is missing or greyed out, first open the SMS
>      permission page and tap *Allow* once to trigger the *"App was denied
>      access"* dialog. That arms the restricted-settings toggle in the
>      ⋮ menu — return to the app-info page and it will be tappable.
> 4. Go back to **Permissions → SMS** and tap **Allow**. The radio now
>    sticks.
>
> **Option B (if you have USB debugging + `adb`):** install with `-g` which
> pre-grants every runtime permission at install time:
>
> ```powershell
> adb uninstall com.bytetobrain.fiscalfocus
> adb install -g artifacts\financial-clarity\android\app\build\outputs\apk\debug\app-debug.apk
> ```
>
> Or, install normally and then:
>
> ```powershell
> adb shell pm grant com.bytetobrain.fiscalfocus android.permission.READ_SMS
> ```

Once permission is granted (either path), the in-app flow:

1. Open **Fiscal Focus → Transactions** and tap the **Scan SMS** chip in the
   header (top-right, to the LEFT of *Export CSV*). Or from
   **Settings → SMS Auto-Import**.
2. First time only: pick a lookback window (7 / 30 / 90 / 365 days). The
   parser scans the inbox, groups by sender, produces candidates, and
   auto-links to any transactions already on the same date/amount.
3. Review the candidates in the approval sheet — tap the row checkbox and
   **Approve selected**, or tap **Approve all**.

> **Distribution note.** `READ_SMS` is a Play-Store-restricted permission.
> The APK produced here is intended for personal sideload only. Do not
> publish this build to Play Store without either removing SMS auto-import
> or applying for the SMS/Call-Log exemption first.

---

## 7. Verification checklist after install

On the phone, run this quick smoke test to confirm the SMS auto-import
feature landed intact:

1. Fresh install (or Clear Data) — the app opens on **Dashboard** with
   `First-Scan Wizard` **not** shown yet (Wizard is triggered from the SMS
   Auto-Import page, not on cold start).
2. Add a manual transaction — the payment method chooser shows **Cash /
   Bank / Credit Card** (the fourth option `credit-card-payment` is
   intentionally SMS-only and should NOT appear here).
3. **Settings → SMS Auto-Import → Scan my SMS inbox** — grant `READ_SMS`.
4. In the approval sheet, any credit-card payment SMS (like an ICICI bill
   payment) approves as `paymentMethod: 'credit-card-payment'` and does
   **not** inflate the month's Total Expenses on the Dashboard — this
   guards a money-math invariant.
5. Backup: **Settings → Backup & Restore → Export backup** produces a JSON
   file whose `schemaVersion: 3` and contains a `data.sms` object with
   `pendingSms`, `dismissedSmsFingerprints`, `linkedSms`, `lastScanMs`.

If any of the above is wrong, capture the exact screen + steps and open an
issue — the state machine has full unit coverage (see
[FinanceContext.test.tsx](../artifacts/financial-clarity/src/context/__tests__/FinanceContext.test.tsx))
so most regressions surface in `pnpm run test:run` before you ever hit the
APK.

---

## 8. Clean rebuild — when Gradle gets weird

```powershell
cd C:\Finance-Clarity-Android-App
.\clean-build.ps1
```

Or manually:

```powershell
cd artifacts\financial-clarity\android
.\gradlew clean
Remove-Item -Recurse -Force .gradle, build, app\build -ErrorAction SilentlyContinue

# Nuke the global Gradle cache too — only when truly stuck
Remove-Item -Recurse -Force $env:USERPROFILE\.gradle\caches -ErrorAction SilentlyContinue

cd ..\..\..
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
pnpm install
.\build-debug-apk.ps1
```

Full nuke-and-rebuild takes ~10-20 min on a home connection.

---

## 9. Optional — release-signed APK / AAB

Debug APKs are enough for personal sideload. If you ever want a
release-signed build:

```powershell
cd C:\Finance-Clarity-Android-App\artifacts\financial-clarity\android\app

# One-time: create keystore. STORE the file + passwords somewhere safe;
# you cannot recover them, and losing them locks you out of future Play
# updates.
keytool -genkeypair -v -storetype PKCS12 `
  -keystore fiscal-focus-release.keystore `
  -alias fiscal-focus `
  -keyalg RSA -keysize 2048 -validity 10000
```

Then wire the keystore into `app/build.gradle` under `signingConfigs` (see
[BUILD_AND_DEPLOY.md § Build Release APK](BUILD_AND_DEPLOY.md#build-release-apk)),
and:

```powershell
cd C:\Finance-Clarity-Android-App
pnpm --filter @workspace/financial-clarity run build
cd artifacts\financial-clarity
npx cap sync android
cd android
.\gradlew assembleRelease            # APK for direct sideload
.\gradlew bundleRelease              # AAB for Play Store upload
```

---

## 10. Troubleshooting

### `pnpm install` prints "Use pnpm instead" and exits

You launched with `npm install` or `yarn`. Run `pnpm install` — see step 1.1.

### `sdkmanager --licenses` prints "Java exception" / "NoClassDefFoundError"

`JAVA_HOME` is not set or points at a JRE instead of a JDK. Fix step 1.4 and
reload the profile (`. $PROFILE`).

### `gradlew assembleDebug` hangs at "Downloading gradle-8.14.3-all.zip"

Normal on first build if you are on a slow link. It's ~130 MB. If it fails
outright with `Connection reset`, you are on a network that blocks
`services.gradle.org` — that is the exact reason this manual exists. Retry
on a different network, or tether from your phone.

### `gradlew assembleDebug` fails with `SDK location not found`

You skipped step 1.4 or the shell you're in didn't reload. Confirm:

```powershell
echo $env:ANDROID_HOME
```

Should print `C:\Android`. Alternatively drop this into
`artifacts\financial-clarity\android\local.properties` (create if missing):

```
sdk.dir=C:\\Android
```

### `adb install` fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`

You already have an older `com.bytetobrain.fiscalfocus` installed and the
signatures don't match (or the build type differs). Nuke it:

```powershell
adb uninstall com.bytetobrain.fiscalfocus
adb install app\build\outputs\apk\debug\app-debug.apk
```

You will lose local data — Fiscal Focus stores everything client-side in
localStorage, so uninstall wipes budgets, categories, and any un-backed-up
transactions. Export a backup first if you care about the data.

### `adb devices` shows `unauthorized`

Look at the phone screen — there is an "Allow USB debugging?" dialog waiting
for you. Check "Always allow from this computer" and tap **Allow**.

### SMS auto-import shows "0 candidates" after granting permission

First, make sure you actually granted it via `adb install -g` or `pm grant`
— the Settings-app radio does **not** work for `READ_SMS` on sideload
builds (see § 6.2). If the in-app scan still runs and produces zero:

- Confirm the phone actually has SMSes in the inbox for the lookback window
  you picked (the parser only sees the last N days you selected in the
  wizard).
- Confirm the sender IDs are ones the parser knows — currently 6 banks
  (HDFC, ICICI, SBI, Axis, Kotak, Yes). Others fall through as
  `no-match`. See [artifacts/financial-clarity/src/lib/sms/parser](../artifacts/financial-clarity/src/lib/sms/parser)
  for the rule pack.
- If the sender is right and the format is right, capture the raw SMS body
  (redact your name/amount/card tail as needed) and file it — Phase 2 rules
  are unit-tested and easy to extend.

### The Transactions screen has no "Scan SMS" chip / Settings has no "SMS Auto-Import" row

You are running a stale APK built from a commit that predates Phase 4
(`a3fd13a`). The Android manifest permission was added in Phase 3
(`7cb6358`) but the UI wiring landed in Phase 4. Rebuild:

```powershell
cd C:\Finance-Clarity-Android-App
git pull
pnpm --filter @workspace/financial-clarity run build
cd artifacts\financial-clarity
npx cap sync android
cd android
.\gradlew assembleDebug
```

APK output:

```
artifacts\financial-clarity\android\app\build\outputs\apk\debug\app-debug.apk
```

Transfer it to your phone (USB, cloud, messaging app), long-press the
old *Fiscal Focus* icon → *Uninstall* (export a backup first if you have
transactions to keep), tap the new APK to install. Then handle the SMS
permission per § 6.2 — the standard permissions page will still refuse
to grant it; use the ⋮ menu "Allow restricted settings" bypass.

### `Settings → SMS permission → Allow` is greyed out ("App was denied access")

This is the Android restricted-permission sideload trap covered in
§ 6.2 — not a bug in the app. The manifest permission is present but
Android will not let you grant it from the standard permissions page on a
sideloaded APK. **On-device fix, no ADB required:**

1. **Settings → Apps → Fiscal Focus** (the app-info page).
2. Tap the **⋮ three-dot menu** in the top-right.
3. Tap **"Allow restricted settings"** (or on some vendors,
   **"Allow restricted permissions"**).
   - If the menu item is missing, first open the SMS permission page and
     tap *Allow* once to trigger the *"App was denied access"* dialog.
     That arms the toggle. Go back to the app-info ⋮ menu and it will
     appear.
4. Return to **Permissions → SMS** and tap **Allow**. The radio now
   sticks.

If you happen to have USB debugging + `adb` set up, an alternative one-liner
is `adb shell pm grant com.bytetobrain.fiscalfocus android.permission.READ_SMS`.
Not required — the on-device path above is the officially supported one.

### Backup exported before Phase 5a doesn't restore

Any `schemaVersion: 1` or `2` backup migrates cleanly through `migrations[]`
in [backup.ts](../artifacts/financial-clarity/src/lib/backup.ts) — it just
stamps an empty `data.sms` block. If restore fails, check the browser
console (or `adb logcat` on device) for the exact validator error; the
schema is strict on `ParsedSms` shape.

---

## 11. Sanity summary

| Command | Purpose | Time |
|---------|---------|------|
| `pnpm install` | Install workspace deps | 30 s - 5 min |
| `pnpm run typecheck` | Full TS gate across 4 projects | 20 s |
| `pnpm --filter @workspace/financial-clarity run test:run` | 187 unit tests | 15 s |
| `pnpm --filter @workspace/financial-clarity run build` | Vite prod bundle | 10 s |
| `.\build-debug-apk.ps1` | web build → cap sync → APK → install | 45 s - 15 min* |

\* first APK build after clean is slow (Gradle + AndroidX download).

Repo tip when this manual was written: **`5e9e32c`** on
`feature/sms-auto-import-phase-1-foundation`.
