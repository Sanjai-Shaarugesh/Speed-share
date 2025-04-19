import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { navigate, currentPath } from '../lib/router';

export function initCapacitorNavigation() {
  if (!Capacitor.isNativePlatform()) return;
  
  // Handle Android back button
  App.addListener('backButton', () => {
    if (window.history.length > 1) {
      window.history.back();
      currentPath.set(window.location.pathname);
    } else {
      App.exitApp();
    }
  });

  // Handle deep links
  App.addListener('appUrlOpen', (data) => {
    try {
      const url = new URL(data.url);
      const path = url.pathname;
      
      // Navigate to the path
      navigate(path);
    } catch (error) {
      console.error('Failed to handle app URL open', error);
    }
  });
}