# Clean build from scratch
# Usage: .\clean-build.ps1

Write-Host "🧹 Clean Build - Financial Clarity" -ForegroundColor Cyan
Write-Host "===================================`n" -ForegroundColor Cyan

Write-Host "⚠️  This will delete all build caches and rebuild from scratch." -ForegroundColor Yellow
$confirm = Read-Host "Continue? (y/n)"
if ($confirm -ne "y") {
    Write-Host "❌ Cancelled." -ForegroundColor Red
    exit 0
}

# Clean Gradle cache
Write-Host "`n🧹 Step 1/5: Cleaning Gradle cache..." -ForegroundColor Yellow
Set-Location artifacts/financial-clarity/android
.\gradlew clean
Remove-Item -Recurse -Force .gradle -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force build -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force app/build -ErrorAction SilentlyContinue
Write-Host "✓ Gradle cache cleared" -ForegroundColor Green

Set-Location ../../..

# Clean node_modules (optional, commented out by default)
# Uncomment these lines if you also want to reinstall node dependencies
# Write-Host "`n🧹 Step 2/5: Cleaning node_modules..." -ForegroundColor Yellow
# Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
# Remove-Item -Recurse -Force artifacts/financial-clarity/node_modules -ErrorAction SilentlyContinue
# Write-Host "✓ node_modules cleared" -ForegroundColor Green

# Reinstall dependencies
Write-Host "`n📦 Step 2/5: Installing dependencies..." -ForegroundColor Yellow
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Dependency installation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Dependencies installed" -ForegroundColor Green

# Build web assets
Write-Host "`n🔨 Step 3/5: Building web assets..." -ForegroundColor Yellow
pnpm --filter @workspace/financial-clarity run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Web build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Web assets built" -ForegroundColor Green

# Sync to Android
Write-Host "`n🔄 Step 4/5: Syncing to Android..." -ForegroundColor Yellow
Set-Location artifacts/financial-clarity
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Capacitor sync failed!" -ForegroundColor Red
    Set-Location ../..
    exit 1
}
Write-Host "✓ Synced to Android" -ForegroundColor Green

# Build fresh APK
Write-Host "`n🏗️  Step 5/5: Building fresh APK..." -ForegroundColor Yellow
Set-Location android
.\gradlew assembleDebug --refresh-dependencies
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Gradle build failed!" -ForegroundColor Red
    Set-Location ../../..
    exit 1
}
Write-Host "✓ APK built" -ForegroundColor Green

Set-Location ../../..

Write-Host "`n✅ Clean build completed successfully!" -ForegroundColor Green
Write-Host "📍 APK Location: artifacts/financial-clarity/android/app/build/outputs/apk/debug/app-debug.apk" -ForegroundColor Cyan
Write-Host "`n💡 To install: adb install -r artifacts/financial-clarity/android/app/build/outputs/apk/debug/app-debug.apk" -ForegroundColor Yellow
