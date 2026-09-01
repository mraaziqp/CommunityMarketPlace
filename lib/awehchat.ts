/**
 * ============================================================================
 * AWEHCHAT EXTERNAL P2P MESSAGING INTEGRATION UTILITY
 * Platform: https://www.awehchat.co.za/
 * Deep-links ShareHub renters directly into AwehChat with context & prefilled inquiry.
 * ============================================================================
 */

export interface AwehChatLinkOptions {
  hostId: string;
  listingId: string;
  listingTitle: string;
  hostName?: string;
  renterName?: string;
  customGreeting?: string;
}

export const AWEHCHAT_BASE_URL = 'https://www.awehchat.co.za';

/**
 * Constructs a formatted deep-link URL to initiate or continue a chat session on AwehChat.
 *
 * Example URL generated:
 * https://www.awehchat.co.za/chat/new?target=usr_host_02&context=sharehub&listing=list_wm_001&text=Hi%2C%20I%20am%20interested%20in%20renting%20your%20Bosch%20Serie%208%20Washer%20on%20ShareHub.
 */
export function generateAwehChatLink(
  hostId: string,
  listingId: string,
  listingTitle: string,
  options?: Partial<AwehChatLinkOptions>
): string {
  const cleanHostId = hostId.trim();
  const cleanListingId = listingId.trim();
  const cleanTitle = listingTitle.trim();

  const greeting =
    options?.customGreeting ||
    `Hi${options?.hostName ? ` ${options.hostName}` : ''}, I am interested in renting your "${cleanTitle}" on ShareHub. Is it currently available?`;

  const params = new URLSearchParams();
  params.set('target', cleanHostId);
  params.set('context', 'sharehub');
  params.set('listing', cleanListingId);
  params.set('text', greeting);

  if (options?.renterName) {
    params.set('from', options.renterName);
  }

  return `${AWEHCHAT_BASE_URL}/chat/new?${params.toString()}`;
}

/**
 * Returns a formatted URL for the main AwehChat community portal.
 */
export function getAwehChatPortalUrl(): string {
  return `${AWEHCHAT_BASE_URL}/`;
}
