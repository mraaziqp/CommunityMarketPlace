import { useState, useEffect, useCallback } from 'react';

/**
 * Lightweight client-side router using window.history.pushState / popstate.
 * Deep linking works out of the box because the server falls back to index.html.
 */

export interface RouterState {
  path: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
}

export function useRoute(): RouterState {
  const [path, setPath] = useState(() => window.location.pathname || '/');

  useEffect(() => {
    const handleLocationChange = () => {
      setPath(window.location.pathname || '/');
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('sharehub:navigate', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('sharehub:navigate', handleLocationChange);
    };
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    const url = new URL(to, window.location.origin);
    const target = `${url.pathname}${url.search}${url.hash}`;

    if (options?.replace) {
      window.history.replaceState(null, '', target);
    } else {
      window.history.pushState(null, '', target);
    }

    setPath(url.pathname);
    window.dispatchEvent(new Event('sharehub:navigate'));
  }, []);

  return { path, navigate };
}

/** Parses `/me/:section` routes */
export function parseMeSection(pathname: string): 'overview' | 'rentals' | 'memberships' | 'listings' | 'earnings' | 'profile' | 'history' {
  const parts = pathname.replace(/\/$/, '').split('/');
  if (parts[1] === 'me' && parts[2]) {
    const sec = parts[2].toLowerCase();
    if (['rentals', 'memberships', 'listings', 'earnings', 'profile', 'history'].includes(sec)) {
      return sec as any;
    }
  }
  return 'overview';
}

/** Parses `/admin/:tab` routes */
export function parseAdminTab(pathname: string): 'payments' | 'members' | 'listings' | 'analytics' | 'neighbourhoods' | 'velocity' | 'appliances' | 'audit' {
  const parts = pathname.replace(/\/$/, '').split('/');
  if (parts[1] === 'admin' && parts[2]) {
    const tab = parts[2].toLowerCase();
    if (['payments', 'members', 'listings', 'analytics', 'neighbourhoods', 'velocity', 'appliances', 'audit'].includes(tab)) {
      return tab as any;
    }
  }
  return 'payments';
}
