import { writable } from 'svelte/store';

// Create stores for navigation
export const currentPath = writable(typeof window !== 'undefined' ? window.location.pathname : '/');
export const params = writable({});

// Path matching utility
function matchPath(path: string, pattern: string) {
  const pathSegments = path.split('/').filter(Boolean);
  const patternSegments = pattern.split('/').filter(Boolean);
  
  if (pathSegments.length !== patternSegments.length) return false;
  
  const extractedParams: Record<string, string> = {};
  
  for (let i = 0; i < patternSegments.length; i++) {
    const patternSegment = patternSegments[i];
    const pathSegment = pathSegments[i];
    
    if (patternSegment.startsWith(':')) {
      const paramName = patternSegment.slice(1);
      extractedParams[paramName] = pathSegment;
    } else if (patternSegment !== pathSegment) {
      return false;
    }
  }
  
  return extractedParams;
}

// Navigation function
export function navigate(path: string) {
  if (typeof window === 'undefined') return;
  
  window.history.pushState({}, '', path);
  currentPath.set(path);
  window.dispatchEvent(new CustomEvent('app-navigation'));
}

// Initialize router (call this in your app entry point)
export function initRouter() {
  if (typeof window === 'undefined') return;
  
  window.addEventListener('popstate', () => {
    currentPath.set(window.location.pathname);
  });
  
  currentPath.set(window.location.pathname);
}

// Route matcher for component rendering
export function createRouteMatcher(routes: Record<string, any>) {
  return (path: string) => {
    for (const [pattern, component] of Object.entries(routes)) {
      const matchResult = matchPath(path, pattern);
      if (matchResult) {
        params.set(matchResult);
        return component;
      }
    }
    return null; // Not found
  };
}