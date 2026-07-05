# Quick debug build and install script
# Usage: .\build-debug-apk.ps1

Write-Host "🔨 Building Financial Clarity Debug APK" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Build web assets
Write-Host "📦 Step 1/5: Building web assets..." -ForegroundColor Yellow
pnpm --filter @workspace/financial-clarity run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Web build failed!" -ForegroundColor Red
    exit 1
}

# Sync to Android
Write-Host "`n🔄 Step 2/5: Syncing to Android..." -ForegroundColor Yellow
Set-Location artifacts/financial-clarity
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Capacitor sync failed!" -ForegroundColor Red
    Set-Location ../..
    exit 1
}

# Build APK
Write-Host "`n🏗️  Step 3/5: Building APK..." -ForegroundColor Yellow
Set-Location android
.\gradlew assembleDebug
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Gradle build failed!" -ForegroundColor Red
    Set-Location ../../..
    exit 1
}

# Check if device is connected
Write-Host "`n📱 Step 4/5: Checking for connected device..." -ForegroundColor Yellow
$devices = adb devices | Select-String "device$"
if ($devices.Count -eq 0) {
    Write-Host "⚠️  No device connected. Skipping installation." -ForegroundColor Yellow
    Write-Host "`n✅ APK built successfully!" -ForegroundColor Green
    Write-Host "📍 Location: artifacts/financial-clarity/android/app/build/outputs/apk/debug/app-debug.apk" -ForegroundColor Cyan
    Set-Location ../../..
    exit 0
}

# Install on device
Write-Host "`n📲 Step 5/5: Installing on device..." -ForegroundColor Yellow
adb install -r app/build/outputs/apk/debug/app-debug.apk
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Installation failed!" -ForegroundColor Red
    Write-Host "💡 Try: adb uninstall com.financeclarity.app" -ForegroundColor Yellow
    Set-Location ../../..
    exit 1
}

Write-Host "`n✅ Done! App installed successfully." -ForegroundColor Green
Write-Host "🚀 Launch the app on your device." -ForegroundColor Cyan
Set-Location ../../..
