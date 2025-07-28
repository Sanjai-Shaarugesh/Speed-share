import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.speed_share.app',
  appName: 'Speed-share',
  webDir: './build',
  server: {
    androidScheme: 'https',
    allowNavigation: ['/','/answer']
  },
  plugins: {
      SplashScreen: {
        launchShowDuration: 100,
        launchAutoHide: true,
        launchFadeOutDuration: 300,
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
      LiveUpdates: {
            appId: '042a1261',
            channel: 'Production',
            autoUpdateMethod: 'background',
            maxVersions: 2
          }
    },
    android: {
      allowMixedContent: true
    }
};

export default config;
