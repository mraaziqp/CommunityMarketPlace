import React from 'react';
import { getListings } from '../actions/listings';
import { ShareHubClient } from './ShareHubClient';

/**
 * ============================================================================
 * NEXT.JS 15 APP ROUTER HOME PAGE (React Server Component)
 * Queries live data directly from Neon PostgreSQL using Drizzle ORM.
 * Eliminates static mock arrays on the server.
 * ============================================================================
 */

export const metadata = {
  title: 'ShareHub | Hyper-Local Fractional Appliance & Asset Co-Op',
  description:
    'Discover fractional washers, commercial tools, and creative workspaces within walking distance in Cape Town.',
};

export default async function HomePage() {
  // 1. Direct Server-Side Query to Neon Database / Drizzle ORM
  let initialListings = [];
  try {
    initialListings = await getListings();
  } catch (error) {
    console.error('Error in RSC getListings:', error);
  }

  // 2. Render Client Application with real server-fetched records
  return <ShareHubClient initialListings={initialListings} />;
}
