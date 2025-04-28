import { App } from '@capacitor/app';
import { navigate, currentPath } from '../stores/navigationStore';

export function initCapacitorNavigation() {
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
    const url = new URL(data.url);
    const path = url.pathname;

    // Navigate to the path
    navigate(path);
  });

  // Handle browser history navigation
  window.addEventListener('popstate', () => {
    currentPath.set(window.location.pathname);
  });
}
