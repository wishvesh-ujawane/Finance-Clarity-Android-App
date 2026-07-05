# Financial Clarity - Build and Deploy Guide

Complete guide for building the Android APK and deploying to mobile devices.

## 📋 Table of Contents
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Daily Development Workflow](#daily-development-workflow)
- [Build Debug APK](#build-debug-apk)
- [Clean Build (From Scratch)](#clean-build-from-scratch)
- [Install APK on Device](#install-apk-on-device)
- [Build Release APK](#build-release-apk)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
1. **Node.js 24+** and **pnpm 10+**
   ```powershell
   node --version  # Should be v24.x.x or higher
   corepack enable
   corepack prepare pnpm@latest --activate
   pnpm --version  # Should be 10.x.x or higher
   ```

2. **Android SDK** (Command Line Tools)
   - Download from: https://developer.android.com/studio#command-line-tools-only
   - Extract to: `C:\Android\cmdline-tools\latest\`

3. **Java Development Kit (JDK) 17+**
   ```powershell
   java -version  # Should be 17 or higher
   ```

---

## Environment Setup

### 1. Set Android Environment Variables

Create or edit your PowerShell profile:
```powershell
notepad $PROFILE
```

Add these lines:
```powershell
$env:ANDROID_HOME = "C:\Android"
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"  # Adjust to your JDK path
$env:PATH += ";C:\Android\cmdline-tools\latest\bin"
$env:PATH += ";C:\Android\platform-tools"
$env:PATH += ";C:\Android\build-tools\34.0.0"
```

Reload profile:
```powershell
. $PROFILE
```

### 2. Install Android SDK Components

```powershell
# Accept licenses first
sdkmanager --licenses

# Install required SDK components
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# Verify installation
sdkmanager --list_installed
```

### 3. Enable USB Debugging on Your Android Device

1. Go to **Settings** → **About Phone**
2. Tap **Build Number** 7 times (enables Developer Mode)
3. Go to **Settings** → **Developer Options**
4. Enable **USB Debugging**
5. Connect device via USB cable

### 4. Verify Device Connection

```powershell
adb devices
```

Expected output:
```
List of devices attached
ABC123XYZ       device
```

If you see `unauthorized`, check your phone for USB debugging authorization prompt.

---

## Daily Development Workflow

### Option A: Web Development (Fastest)

Use this for rapid development and testing UI/logic without building APK:

```powershell
# Pull latest changes
git pull

# Install dependencies
pnpm install

# Run development server
pnpm --filter @workspace/financial-clarity run dev
```

Open browser at `http://localhost:5173`

**Advantages:**
- ✅ Instant hot-reload
- ✅ Chrome DevTools for debugging
- ✅ Faster iteration
- ✅ No device required

**Test mobile view in browser:**
1. Press `F12` to open DevTools
2. Press `Ctrl+Shift+M` to toggle device toolbar
3. Select device (e.g., "Pixel 5" or "iPhone 12 Pro")

### Option B: Android APK (For Device Testing)

Use this when you need to test:
- Android-specific features (biometrics, native file system)
- Performance on real device
- Touch gestures and haptics
- APK distribution

---

## Build Debug APK

### Quick Build (No Changes to Android Native Code)

```powershell
# 1. Navigate to project root
cd C:\FinanceFiscal\Finance-Clarity-Android-App

# 2. Pull latest changes
git pull

# 3. Install dependencies (if package.json changed)
pnpm install

# 4. Build web assets
pnpm --filter @workspace/financial-clarity run build

# 5. Sync to Android (copies web assets to android/app/src/main/assets/)
cd artifacts/financial-clarity
npx cap sync android

# 6. Build APK
cd android
.\gradlew assembleDebug

# 7. APK location (ready to install)
# artifacts/financial-clarity/android/app/build/outputs/apk/debug/app-debug.apk
```

**Build time:** ~30-60 seconds (after first build)

---

## Clean Build (From Scratch)

Use this when:
- Gradle cache is corrupted
- Strange build errors appear
- After major dependency updates
- First build on a new machine

```powershell
# 1. Navigate to Android project
cd C:\FinanceFiscal\Finance-Clarity-Android-App\artifacts\financial-clarity\android

# 2. Clean Gradle cache and build artifacts
.\gradlew clean

# 3. (Optional) Delete Gradle cache completely
Remove-Item -Recurse -Force .gradle
Remove-Item -Recurse -Force build
Remove-Item -Recurse -Force app/build

# 4. (Optional) Clear global Gradle cache
Remove-Item -Recurse -Force $env:USERPROFILE\.gradle\caches

# 5. Go back to project root
cd ../../..

# 6. Reinstall dependencies
Remove-Item -Recurse -Force node_modules
pnpm install

# 7. Rebuild web assets
pnpm --filter @workspace/financial-clarity run build

# 8. Sync to Android
cd artifacts/financial-clarity
npx cap sync android

# 9. Build fresh APK
cd android
.\gradlew assembleDebug --refresh-dependencies
```

**Build time:** ~2-5 minutes (downloads all dependencies fresh)

---

## Install APK on Device

### Method 1: Direct Install via ADB (Recommended)

```powershell
# 1. Make sure device is connected
adb devices

# 2. Navigate to APK location
cd C:\FinanceFiscal\Finance-Clarity-Android-App\artifacts\financial-clarity\android

# 3. Install APK (-r flag allows reinstall/upgrade)
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

**Expected output:**
```
Performing Streamed Install
Success
```

### Method 2: Install and Launch App Immediately

```powershell
# Install APK
adb install -r app/build/outputs/apk/debug/app-debug.apk

# Launch app (replace com.financeclarity.app with your actual package name)
adb shell monkey -p com.financeclarity.app -c android.intent.category.LAUNCHER 1
```

### Method 3: Copy APK to Device (Manual Install)

```powershell
# Push APK to device
adb push app/build/outputs/apk/debug/app-debug.apk /sdcard/Download/

# On your phone:
# 1. Open "Files" or "My Files" app
# 2. Navigate to "Downloads"
# 3. Tap "app-debug.apk"
# 4. Tap "Install" (may need to allow "Install from unknown sources")
```

### Uninstall Previous Version (If Install Fails)

```powershell
# Uninstall app (replace with your package name)
adb uninstall com.financeclarity.app

# Then install fresh
adb install app/build/outputs/apk/debug/app-debug.apk
```

---

## Build Release APK

### 1. Generate Signing Key (First Time Only)

```powershell
# Navigate to android folder
cd C:\FinanceFiscal\Finance-Clarity-Android-App\artifacts\financial-clarity\android\app

# Generate keystore
keytool -genkeypair -v -storetype PKCS12 -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

**Important:** Save the keystore file and passwords securely. You cannot recover them!

### 2. Configure Signing in build.gradle

Edit `artifacts/financial-clarity/android/app/build.gradle`:

```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file('my-release-key.keystore')
            storePassword 'YOUR_KEYSTORE_PASSWORD'
            keyAlias 'my-key-alias'
            keyPassword 'YOUR_KEY_PASSWORD'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 3. Build Release APK

```powershell
# Build web assets for production
pnpm --filter @workspace/financial-clarity run build

# Sync to Android
cd artifacts/financial-clarity
npx cap sync android

# Build release APK
cd android
.\gradlew assembleRelease

# Release APK location:
# app/build/outputs/apk/release/app-release.apk
```

### 4. Build AAB for Google Play Store

```powershell
.\gradlew bundleRelease

# AAB location:
# app/build/outputs/bundle/release/app-release.aab
```

---

## One-Command Build Scripts

### Create `build-debug-apk.ps1` in Project Root

```powershell
# Quick debug build and install
Write-Host "🔨 Building debug APK..." -ForegroundColor Cyan

# Build web assets
Write-Host "📦 Building web assets..." -ForegroundColor Yellow
pnpm --filter @workspace/financial-clarity run build

# Sync to Android
Write-Host "🔄 Syncing to Android..." -ForegroundColor Yellow
Set-Location artifacts/financial-clarity
npx cap sync android

# Build APK
Write-Host "🏗️  Building APK..." -ForegroundColor Yellow
Set-Location android
.\gradlew assembleDebug

# Install on device
Write-Host "📲 Installing on device..." -ForegroundColor Yellow
adb install -r app/build/outputs/apk/debug/app-debug.apk

Write-Host "✅ Done! App installed." -ForegroundColor Green
Set-Location ../../..
```

### Create `clean-build.ps1` in Project Root

```powershell
# Clean build from scratch
Write-Host "🧹 Cleaning Gradle cache..." -ForegroundColor Cyan

Set-Location artifacts/financial-clarity/android
.\gradlew clean
Remove-Item -Recurse -Force .gradle -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force build -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force app/build -ErrorAction SilentlyContinue

Set-Location ../../..

Write-Host "📦 Rebuilding dependencies..." -ForegroundColor Yellow
pnpm install

Write-Host "🔨 Building fresh APK..." -ForegroundColor Yellow
.\build-debug-apk.ps1
```

### Usage

```powershell
# Regular build and install
.\build-debug-apk.ps1

# Clean build (when things break)
.\clean-build.ps1
```

---

## Troubleshooting

### Error: "SDK location not found"

**Fix:** Create `local.properties` file:
```powershell
cd artifacts/financial-clarity/android
echo "sdk.dir=C:\\Android" > local.properties
```

### Error: "adb is not recognized as the name of a cmdlet" / "adb not found"

**Cause:** Android platform-tools not installed or not in PATH.

**Fix Option 1 - Install platform-tools standalone:**
```powershell
# Download platform-tools directly (no Android SDK needed)
Invoke-WebRequest -Uri "https://dl.google.com/android/repository/platform-tools-latest-windows.zip" -OutFile "$env:TEMP\platform-tools.zip"
Expand-Archive -Path "$env:TEMP\platform-tools.zip" -DestinationPath "C:\Android" -Force

# Add to PATH (permanent)
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Android\platform-tools", [EnvironmentVariableTarget]::User)

# Restart PowerShell, then verify:
adb version
```

**Fix Option 2 - Use Android SDK Manager (if you have Android SDK):**
```powershell
sdkmanager "platform-tools"
$env:PATH += ";C:\Android\platform-tools"
```

**Fix Option 3 - Find existing ADB installation:**
```powershell
# Search for adb.exe on your system
Get-ChildItem -Path C:\ -Filter adb.exe -Recurse -ErrorAction SilentlyContinue | Select-Object FullName

# Add that directory to PATH:
# Example: if adb.exe is at C:\Users\YourName\AppData\Local\Android\Sdk\platform-tools\adb.exe
$env:PATH += ";C:\Users\$env:USERNAME\AppData\Local\Android\Sdk\platform-tools"
```

### Error: "Execution failed for task ':app:mergeDebugResources'"

**Fix:** Clean and rebuild:
```powershell
cd artifacts/financial-clarity/android
.\gradlew clean
.\gradlew assembleDebug --refresh-dependencies
```

### Error: "INSTALL_FAILED_UPDATE_INCOMPATIBLE"

**Fix:** Uninstall old version first:
```powershell
adb uninstall com.financeclarity.app
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Error: Device shows as "unauthorized"

**Fix:** 
1. Disconnect USB cable
2. On phone: Revoke USB debugging authorizations (Developer Options)
3. Reconnect USB cable
4. Accept authorization popup on phone

### Build is extremely slow

**Fix:** Increase Gradle memory:
```powershell
# Create/edit gradle.properties
cd artifacts/financial-clarity/android
echo "org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m" >> gradle.properties
```

### Error: "Unsupported class file major version 65"

**Fix:** Java version mismatch. Use JDK 17:
```powershell
java -version  # Should show version 17
# Update JAVA_HOME if needed
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
```

---

## Quick Reference Commands

```powershell
# ========================================
# DAILY WORKFLOW
# ========================================

# Pull latest code
git pull

# Install dependencies
pnpm install

# Build and install APK
pnpm --filter @workspace/financial-clarity run build
cd artifacts/financial-clarity
npx cap sync android
cd android
.\gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk

# ========================================
# CLEAN BUILD
# ========================================

cd artifacts/financial-clarity/android
.\gradlew clean
.\gradlew assembleDebug --refresh-dependencies

# ========================================
# DEVICE MANAGEMENT
# ========================================

# List connected devices
adb devices

# Uninstall app
adb uninstall com.financeclarity.app

# Install APK
adb install -r app/build/outputs/apk/debug/app-debug.apk

# View device logs (for debugging)
adb logcat | Select-String "FinanceClarity"

# ========================================
# BUILD VARIANTS
# ========================================

# Debug APK
.\gradlew assembleDebug

# Release APK
.\gradlew assembleRelease

# Release AAB (for Play Store)
.\gradlew bundleRelease
```

---

## APK Output Locations

After building, APKs are located at:

```
Debug APK:
artifacts/financial-clarity/android/app/build/outputs/apk/debug/app-debug.apk

Release APK:
artifacts/financial-clarity/android/app/build/outputs/apk/release/app-release.apk

Release AAB (Play Store):
artifacts/financial-clarity/android/app/build/outputs/bundle/release/app-release.aab
```

---

## Additional Resources

- **Android Developer Docs:** https://developer.android.com/studio/build/building-cmdline
- **Capacitor Docs:** https://capacitorjs.com/docs/android
- **Gradle User Guide:** https://docs.gradle.org/current/userguide/userguide.html
- **ADB Documentation:** https://developer.android.com/studio/command-line/adb

---

**Last Updated:** 2026-07-05
