import { writable } from 'svelte/store';

// Create a store for navigation state
export const currentPath = writable(window.location.pathname);

// History navigation function that updates the store
export function navigate(path: string) {
  window.history.pushState({}, '', path);
  currentPath.set(path);
  // Dispatch event for components that need to know about navigation
  window.dispatchEvent(new CustomEvent('app-navigation'));
}