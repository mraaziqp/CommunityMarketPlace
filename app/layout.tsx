import React from 'react';
import type { Metadata, Viewport } from 'next';
import '../src/index.css';

/**
 * ============================================================================
 * SHAREHUB APP ROUTER ROOT LAYOUT (app/layout.tsx)
 * 
 * Configures:
 * - Dynamic Viewport & iOS/Android Safe Area support (viewport-fit=cover).
 * - Apple Touch Web App integration (standalone mode, status bar styling).
 * - Web App Manifest & theme color metadata (#0f172a).
 * - Plus Jakarta Sans & JetBrains Mono typography fonts.
 * ============================================================================
 */

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0f172a' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export const metadata: Metadata = {
  title: 'ShareHub — Community P2P Rental & Fractional Sharing Marketplace',
  description:
    'A trusted P2P community rental marketplace for rooms, equipment, and fractional appliance subscriptions within walking distance.',
  manifest: '/manifest.webmanifest',
  applicationName: 'ShareHub',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ShareHub',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon.svg', sizes: '180x180', type: 'image/svg+xml' },
    ],
  },
  openGraph: {
    title: 'ShareHub — Community P2P Rental & Fractional Sharing Marketplace',
    description:
      'Hyper-local fractional appliance co-ops, power tool library, and physical asset sharing in Cape Town.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="h-full bg-slate-50 text-slate-900 antialiased selection:bg-indigo-600 selection:text-white font-sans">
        {children}
      </body>
    </html>
  );
}
