# Google OAuth Setup for Android Backup/Restore

This app uses Google sign-in to access `drive.appdata` for encrypted backups and PIN recovery. To make the native Android workflow work correctly, you should configure both the Android OAuth client and the Web OAuth client in Google Cloud.

## Required credentials

- **Android OAuth Client ID**
  - Package name: `com.bytetobrain.fiscalfocus`
  - SHA-1 fingerprint: `7D:8C:57:8F:B3:3C:A2:C0:DF:8D:51:88:57:63:95:FD:70:CA:99:73`

- **Web OAuth Client ID**
  - Used for the `serverClientId` and fallback web identity flow
  - Same client ID is currently configured in the app as:
    `263589833123-90dnia4dgb2plcgkj12d8k8u9k6drgef.apps.googleusercontent.com`

## App config

In `capacitor.config.ts`, the app now configures:

- `clientId` → Web OAuth client ID
- `serverClientId` → Web OAuth client ID
- `androidClientId` → Android OAuth client ID

This lets the native GoogleAuth plugin sign in on Android while still using the Web client for backend token exchange and fallback.

## Android strings

In `android/app/src/main/res/values/strings.xml`, the app now also defines:

- `server_client_id`
- `android_client_id`

## Environment variables

If you prefer not to hardcode IDs, you can set:

- `VITE_GOOGLE_CLIENT_ID` for the Web client ID
- `VITE_GOOGLE_ANDROID_CLIENT_ID` for the Android client ID

## Checklist

- [ ] Android OAuth client exists in Google Cloud using package `com.bytetobrain.fiscalfocus`
- [ ] SHA-1 fingerprint is registered in the Android OAuth client
- [ ] OAuth consent screen includes scopes: `profile`, `email`, `https://www.googleapis.com/auth/drive.appdata`
- [ ] App is rebuilt after configuration changes and installed on test device

## If you still see Code 10

- Verify the Android client uses the same package name and SHA-1 as the installed app
- Verify the Web client is the one used for `serverClientId`
- Run the app on a real device and use `adb logcat` to inspect GoogleAuth messages
