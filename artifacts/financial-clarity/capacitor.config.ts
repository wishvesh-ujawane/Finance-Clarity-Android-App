import type { CapacitorConfig } from '@capacitor/cli';

// Codetrix GoogleAuth on Android expects a Web OAuth client in server_client_id/clientId.
const GOOGLE_WEB_CLIENT_ID = '263589833123-90dnia4dgb2plcgkj12d8k8u9k6drgef.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = '263589833123-i54ot12cb62b0eihpriium5km8gu4s96.apps.googleusercontent.com';

const config: CapacitorConfig = {
  appId: 'com.bytetobrain.fiscalfocus',
  appName: 'Fiscal Focus',
  webDir: 'dist/public',
  plugins: {
    GoogleAuth: {
      clientId: GOOGLE_WEB_CLIENT_ID,
      androidClientId: GOOGLE_ANDROID_CLIENT_ID,
      serverClientId: GOOGLE_WEB_CLIENT_ID,
      scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.appdata'],
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
