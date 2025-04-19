import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.Speed-share.app',
  appName: 'Speed-share',
  webDir: './build', 
  server: {
    androidScheme: 'https',
    allowNavigation: ['*'] // allow all internal routes like /offer, /answer
  }
};

export default config;
