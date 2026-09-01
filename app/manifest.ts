import { MetadataRoute } from 'next';

/**
 * ============================================================================
 * NEXT.JS 15 WEB APPLICATION MANIFEST (app/manifest.ts)
 * 
 * Features:
 * - Standalone display mode with portrait-first orientation.
 * - Slate-900 (#0f172a) theme color & Slate-50 (#f8fafc) background color.
 * - Standard, any, and maskable icons for Android, iOS, Samsung Internet, and Desktop Chrome.
 * - Category tags and shortcuts for direct access to Explore, Co-Ops, and Activity.
 * ============================================================================
 */

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ShareHub — Community P2P Rental & Fractional Sharing Marketplace',
    short_name: 'ShareHub',
    description:
      'Hyper-local fractional appliance co-ops, power tool library, and physical asset sharing within walking distance.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f8fafc',
    theme_color: '#0f172a',
    scope: '/',
    categories: ['lifestyle', 'shopping', 'utilities', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Explore Listings',
        short_name: 'Explore',
        description: 'Browse local appliances and rentals',
        url: '/?tab=explore',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'My Quotas & Activity',
        short_name: 'Activity',
        description: 'View active usages and handover status',
        url: '/?tab=activity',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Trust Circles',
        short_name: 'Circles',
        description: 'Access private building and neighbourhood co-ops',
        url: '/?tab=circles',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}
