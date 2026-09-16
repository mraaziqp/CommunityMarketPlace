import { useState, useEffect, useCallback } from 'react';

/**
 * ============================================================================
 * PWA INSTALLATION HOOK (src/hooks/usePwaInstall.ts)
 * 
 * Manages:
 * - Listening to 'beforeinstallprompt' event on modern mobile/desktop browsers.
 * - Checking if app is already running in standalone PWA mode (iOS & Android).
 * - Triggering native installation prompts on user action.
 * - Safe memory cleanup of event listeners on component unmount.
 * ============================================================================
 */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Register the service worker first. It has to happen before the
    // standalone check below returns early, because an installed app running
    // standalone is precisely the case that needs the offline shell. React
    // effects also run after 'load' has already fired, so waiting for that
    // event would mean the registration never happens at all.
    let cancelled = false;

    const registerServiceWorker = () => {
      if (cancelled || !('serviceWorker' in navigator)) return;
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registered with scope:', registration.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration note:', err);
        });
    };

    if (document.readyState === 'complete') {
      registerServiceWorker();
    } else {
      window.addEventListener('load', registerServiceWorker, { once: true });
    }

    // Check if already in standalone display mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
      return () => {
        cancelled = true;
        window.removeEventListener('load', registerServiceWorker);
      };
    }

    // Check session dismissal
    const dismissedSession = sessionStorage.getItem('sharehub_pwa_dismissed');
    if (dismissedSession === 'true') {
      setIsDismissed(true);
    }

    // Handle beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent standard browser mini-infobar to show custom branded banner
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    // Handle appinstalled
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      console.log('[PWA] ShareHub was successfully installed as a standalone app.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Clean up event listeners on unmount
    return () => {
      cancelled = true;
      window.removeEventListener('load', registerServiceWorker);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      } else {
        return false;
      }
    } catch (err) {
      console.warn('[PWA] Install prompt error:', err);
      return false;
    }
  }, [deferredPrompt]);

  const dismissPrompt = useCallback(() => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('sharehub_pwa_dismissed', 'true');
    } catch (e) {
      // Ignore sessionStorage exceptions
    }
  }, []);

  return {
    isInstallable: isInstallable && !isInstalled && !isDismissed,
    isInstalled,
    promptInstall,
    dismissPrompt,
  };
}

export default usePwaInstall;
