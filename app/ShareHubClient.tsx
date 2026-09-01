'use client';

import React from 'react';
import App from '../src/App';
import { ListingModel } from '../src/types';

interface ShareHubClientProps {
  initialListings?: ListingModel[];
}

export function ShareHubClient({ initialListings }: ShareHubClientProps) {
  return <App initialListings={initialListings} />;
}
