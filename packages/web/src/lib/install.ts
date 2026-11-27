import { useSyncExternalStore } from 'react';

/** Chrome's (and Edge's, Samsung Internet's) install prompt event, which isn't in the DOM types. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// The event comes once, early (often before React has rendered), so it's caught here, when the module loads, and
// kept for whoever offers to install.
let deferred: BeforeInstallPromptEvent | undefined;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    deferred = undefined;
    changed();
  });
}

/** Opened from the home screen (installed), not in a browser tab. */
export function isStandalone(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

/** iPhone/iPad Safari, not already opened from the home screen. iOS has no install prompt, so we explain how. */
export function canAddToHomeScreen(): boolean {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && !isStandalone();
}

/** Shows the browser's own install prompt, where it has one (Android Chrome); undefined where it doesn't. */
export function useInstallPrompt(): (() => Promise<void>) | undefined {
  const event = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => deferred,
  );
  if (!event) return undefined;
  return async () => {
    await event.prompt();
    await event.userChoice;
    // A prompt can only be shown once.
    deferred = undefined;
    changed();
  };
}
