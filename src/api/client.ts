import type {
  AdminAnalyticsReport,
  ItemConditionStatus,
  ListingModel,
  MemberActivity,
  ReviewModel,
  SearchResultModel,
  TrustGroupModel,
  UserModel,
  UserRole,
} from '../types';

/**
 * Typed client for the ShareHub server. The session lives in an HTTP-only
 * cookie, so nothing sensitive is kept in the page. Every call rejects with an
 * Error whose message is written for members and safe to show.
 */

export interface CheckoutForm {
  actionUrl: string;
  fields: Record<string, string>;
}

export interface PaymentSummary {
  id: string;
  kind: 'booking' | 'subscription' | 'test';
  status: string;
  amountInCents: number;
  gatewayRef: string | null;
  recurring: boolean;
  createdAt: string;
  updatedAt: string;
  listingTitle?: string;
  hostPayout: { status: string; amountInCents: number; hostId?: string; hostName?: string };
  depositRefund: { status: string; amountInCents: number; renterId?: string; renterName?: string };
}

export interface HostListingStats {
  totalBookings: number;
  upcomingBookings: number;
  activeMembers: number;
  earningsCents: number;
  rating: number | null;
  reviewCount: number;
}

export interface HostListing {
  listing: ListingModel;
  stats: HostListingStats;
}

export interface ListingPatch {
  title?: string;
  description?: string;
  images?: string[];
  rules?: string | null;
  address?: string;
  neighborhood?: string;
  city?: string;
  depositRequiredInCents?: number;
  maxSubscribers?: number;
  isAvailable?: boolean;
  visibilityGroupId?: string | null;
  tiers?: Array<{ id?: string; name: string; type?: string; priceInCents: number; usageLimitPerPeriod?: number | null; isActive?: boolean }>;
}

export interface EarningRow {
  paymentId: string;
  date: string;
  listingTitle: string;
  kind: string;
  grossCents: number;
  payoutCents: number;
  status: 'due' | 'done';
}

export interface MemberDashboard {
  stats: {
    upcomingRentals: number;
    activeMemberships: number;
    spentCents: number;
    listings: number;
    activeListings: number;
    upcomingHostBookings: number;
    earningsDueCents: number;
    earningsPaidCents: number;
    averageRating: number | null;
  };
  earnings: EarningRow[];
}

export interface AdminMemberRow {
  user: UserModel;
  listings: number;
  bookings: number;
  memberships: number;
  lastActiveAt: string | null;
}

export interface AdminListingRow {
  listing: ListingModel;
  ownerEmail: string;
  ownerSuspended: boolean;
  stats: HostListingStats;
}

export interface ServerConfig {
  demoMode: boolean;
  payments: { provider: 'payfast'; mode: 'sandbox' | 'live' };
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        'x-sharehub-client': 'web',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("We can't reach ShareHub right now. Please check your connection and try again.", 0);
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) throw new ApiError(data?.error || 'Something went wrong. Please try again.', res.status);
  return data as T;
}

const get = <T>(path: string) => request<T>('GET', path);
const post = <T>(path: string, body: unknown = {}) => request<T>('POST', path, body);

function query(params: Record<string, string | number | null | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** Sends the browser to PayFast with the server-signed checkout form. */
export function submitCheckout(checkout: CheckoutForm) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = checkout.actionUrl;
  for (const [name, value] of Object.entries(checkout.fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export const api = {
  config: () => get<ServerConfig>('/config'),

  // Accounts
  session: () => get<{ user: UserModel | null }>('/auth/session'),
  signUp: (input: { name: string; email: string; password: string; neighborhood?: string }) =>
    post<{ user: UserModel }>('/auth/signup', input),
  signIn: (input: { email: string; password: string }) => post<{ user: UserModel }>('/auth/signin', input),
  signInDemo: (role: UserRole) => post<{ user: UserModel }>('/auth/demo', { role }),
  signOut: () => post<{ ok: true }>('/auth/signout'),

  // Discovery
  searchListings: (params: {
    searchTerm?: string;
    categorySlug?: string;
    lat?: number | null;
    lng?: number | null;
    radiusKm?: number;
    city?: string;
    groupId?: string | null;
  }) => get<SearchResultModel>(`/listings${query(params)}`),
  getListing: (id: string) => get<{ listing: ListingModel }>(`/listings/${encodeURIComponent(id)}`).then((r) => r.listing),
  createListing: (input: Record<string, unknown>) => post<{ listing: ListingModel }>('/listings', input).then((r) => r.listing),

  // Circles
  circles: () => get<{ circles: TrustGroupModel[] }>('/circles').then((r) => r.circles),
  createCircle: (input: { name: string; description?: string; icon?: string }) =>
    post<{ circle: TrustGroupModel }>('/circles', input).then((r) => r.circle),
  joinCircle: (inviteCode: string) => post<{ circle: TrustGroupModel }>('/circles/join', { inviteCode }).then((r) => r.circle),

  // Member
  activity: () => get<MemberActivity>('/me/activity'),
  joinCoop: (listingId: string, tierId: string) =>
    post<{ subscriptionId: string; checkout: CheckoutForm }>('/coops/join', { listingId, tierId }),
  subscriptionCheckout: (id: string) => post<{ checkout: CheckoutForm }>(`/subscriptions/${id}/checkout`).then((r) => r.checkout),
  logUsage: (subscriptionId: string, notes: string) =>
    post<{ subscription: { remainingUses: number } }>(`/subscriptions/${subscriptionId}/use`, { notes }),
  createBooking: (input: { listingId: string; tierId: string; startDate: string; endDate: string }) =>
    post<{ booking: { id: string }; checkout: CheckoutForm }>('/bookings', input),
  bookingCheckout: (id: string) => post<{ checkout: CheckoutForm }>(`/bookings/${id}/checkout`).then((r) => r.checkout),
  confirmPickup: (id: string, code: string) => post(`/bookings/${id}/pickup`, { code }),
  confirmReturn: (id: string, condition: Exclude<ItemConditionStatus, 'DAMAGED'>, notes: string, photos: string[]) =>
    post(`/bookings/${id}/return`, { condition, notes, photos }),
  reportProblem: (id: string, notes: string, photos: string[]) => post(`/bookings/${id}/dispute`, { notes, photos }),
  review: (
    id: string,
    input: { rating: number; comment: string; cleanlinessRating?: number; communicationRating?: number; accuracyRating?: number }
  ) => post<{ review: ReviewModel; newTrustScore: number }>(`/bookings/${id}/review`, input),

  // Personal dashboard
  dashboard: () => get<MemberDashboard>('/me/dashboard'),
  myListings: () => get<{ listings: HostListing[] }>('/me/listings').then((r) => r.listings),
  updateListing: (id: string, patch: ListingPatch) =>
    post<{ listing: ListingModel }>(`/listings/${encodeURIComponent(id)}/update`, patch).then((r) => r.listing),
  deleteListing: (id: string) => post(`/listings/${encodeURIComponent(id)}/delete`),
  updateProfile: (patch: { name?: string; bio?: string | null; neighborhood?: string | null; phoneNumber?: string | null; image?: string | null }) =>
    post<{ user: UserModel }>('/me/profile', patch).then((r) => r.user),
  changePassword: (currentPassword: string, newPassword: string) => post('/me/password', { currentPassword, newPassword }),

  // Admin
  adminMembers: (search = '') => get<{ members: AdminMemberRow[] }>(`/admin/members${query({ search })}`).then((r) => r.members),
  setMemberRole: (id: string, role: 'USER' | 'VERIFIED_HOST') => post<{ user: UserModel }>(`/admin/members/${id}/role`, { role }),
  setMemberSuspended: (id: string, suspended: boolean) => post<{ user: UserModel }>(`/admin/members/${id}/suspend`, { suspended }),
  adminListings: (search = '') => get<{ listings: AdminListingRow[] }>(`/admin/listings${query({ search })}`).then((r) => r.listings),
  adminReport: (range: '7d' | '30d' | '90d' | 'all') => get<AdminAnalyticsReport>(`/admin/report${query({ range })}`),
  adminPayments: (params: { kind?: string; owed?: boolean } = {}) =>
    get<{ payments: PaymentSummary[] }>(`/admin/payments${query({ kind: params.kind, owed: params.owed ? 'true' : undefined })}`).then(
      (r) => r.payments
    ),
  settlePayment: (id: string, what: 'hostPayout' | 'depositRefund') => post(`/admin/payments/${id}/settle`, { what }),
  startTestPayment: (amountInCents: number, recurring: boolean) =>
    post<{ checkout: CheckoutForm }>('/admin/test-payment', { amountInCents, recurring }).then((r) => r.checkout),
};
