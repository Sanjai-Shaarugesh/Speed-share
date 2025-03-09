import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.app',
  appName: 'Speed-share-mobile',
  webDir: 'build',
  plugins: {
    Camera: {
      // Required for iOS
      iosUseDocumentPicker: false
    }
  }
};

export default config;
