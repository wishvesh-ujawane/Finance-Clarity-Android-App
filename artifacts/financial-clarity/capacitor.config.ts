import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bytetobrain.fiscalfocus',
  appName: 'Fiscal Focus',
  webDir: 'dist/public',
  plugins: {
    GoogleAuth: {
      scopes: [
        'profile',
        'email',
        'https://www.googleapis.com/auth/drive.file',
      ],
      serverClientId: '263589833123-90dnia4dgb2plcgkj12d8k8u9k6drgef.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
