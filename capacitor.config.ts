import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.speed_share.app',
  appName: 'Speed-share',
  webDir: './build',
  server: {
    androidScheme: 'https',
    allowNavigation: ['*'] // allow all internal routes like /offer, /answer
  },
  plugins: {
      SplashScreen: {
        launchShowDuration: 1000,
        launchAutoHide: true,
        launchFadeOutDuration: 3000,
        backgroundColor: "#00000000",
        androidSplashResourceName: "splash",
        androidScaleType: "CENTER_CROP",
        showSpinner: true,
        androidSpinnerStyle: "large",
        iosSpinnerStyle: "small",
        spinnerColor: "#999999",
        splashFullScreen: true,
        splashImmersive: true,
        layoutName: "launch_screen",
        useDialog: true,
      },
    },
    android: {
      allowMixedContent: true
    }
};

export default config;
