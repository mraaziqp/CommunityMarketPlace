import React, { useState, useEffect, useTransition, useCallback, lazy, Suspense } from 'react';
import { CheckCircle2, Info, Users, X, ShieldAlert, Loader2 } from 'lucide-react';
import { Navbar } from './components/layout/Navbar';
import { MobileNav, MobileTab } from './components/layout/MobileNav';
import { PwaInstallBanner } from './components/layout/PwaInstallBanner';
import { Footer } from './components/layout/Footer';
import { CategoryNav } from './components/discovery/CategoryNav';
import { SearchHeader, LocationState } from './components/discovery/SearchHeader';
import { ProximityFeed } from './components/discovery/ProximityFeed';
import { ListingDetailModal } from './components/listings/ListingDetailModal';
import { FractionalUsageLogger } from './components/usage/FractionalUsageLogger';
import { CreateListingModal } from './components/listings/CreateListingModal';
import { AuthModal } from './components/auth/AuthModal';
import { AuthGate } from './components/auth/AuthGate';
import { EscrowPaymentModal } from './components/payments/EscrowPaymentModal';
import { ReviewModal } from './components/reviews/ReviewModal';
import { ReturnHandoverModal } from './components/bookings/ReturnHandoverModal';
import { TrustGroupHub } from './components/groups/TrustGroupHub';
import { DashboardPage } from './pages/DashboardPage';
import { useRoute, parseMeSection, parseAdminTab } from './lib/router';
import { api, submitCheckout } from './api/client';
import {
  ListingModel,
  PricingTierModel,
  BookingModel,
  UserModel,
  UserRole,
  AuthSession,
  MemberActivity,
  TrustGroupModel,
} from './types';

// Admin tooling is loaded on demand, so its code never reaches members' browsers.
const AdminDashboard = lazy(() =>
  import('./components/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);

// Internal architecture notes: development builds only; compiled out of production.
const ArchitectureViewer = import.meta.env.DEV
  ? lazy(() => import('./components/docs/ArchitectureViewer').then((m) => ({ default: m.ArchitectureViewer })))
  : null;

const EMPTY_ACTIVITY: MemberActivity = { subscriptions: [], bookings: [], usageLogs: [], history: [] };

type Toast = { message: string; tone: 'success' | 'info' };

function parseInitialUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const latStr = params.get('lat');
  const lngStr = params.get('lng');
  return {
    category: params.get('category') || 'all',
    sub: params.get('sub') || null,
    query: params.get('q') || '',
    lat: latStr ? parseFloat(latStr) : null,
    lng: lngStr ? parseFloat(lngStr) : null,
    radius: params.get('radius') ? parseInt(params.get('radius')!, 10) : 10,
    label: params.get('loc') || (latStr ? 'Custom Pin' : 'All Cape Town'),
    city: params.get('city') || 'all',
    wantsAdmin: params.get('view') === 'admin' || window.location.pathname === '/admin',
    /** Set when PayFast sends the member back after checkout. */
    paymentReturn: (params.get('payment') as 'return' | 'cancelled' | null) ?? null,
  };
}

export default function App() {
  const [initialParams] = useState(parseInitialUrlParams);
  const { path, navigate } = useRoute();

  // Authentication session state
  const [currentUser, setCurrentUser] = useState<UserModel | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const isAdmin = currentUser?.role === 'ADMIN';

  // Discovery filters
  const [selectedCategory, setSelectedCategory] = useState<string>(initialParams.category);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(initialParams.sub);
  const [searchQuery, setSearchQuery] = useState<string>(initialParams.query);
  const [cityFilter, setCityFilter] = useState<string>(initialParams.city);
  const [radiusKm, setRadiusKm] = useState<number>(initialParams.radius);
  const [locationState, setLocationState] = useState<LocationState>({
    latitude: initialParams.lat,
    longitude: initialParams.lng,
    label: initialParams.label,
    isGeoActive: initialParams.lat !== null,
    error: null,
  });

  const [listings, setListings] = useState<ListingModel[]>([]);
  const [isPending, startTransition] = useTransition();

  // Member data, always read from the store
  const [activity, setActivity] = useState<MemberActivity>(EMPTY_ACTIVITY);
  const [myCircles, setMyCircles] = useState<TrustGroupModel[]>([]);

  // Screens & modals
  const [selectedListing, setSelectedListing] = useState<ListingModel | null>(null);
  const [editingListing, setEditingListing] = useState<ListingModel | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [showArchitectureModal, setShowArchitectureModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [paymentBooking, setPaymentBooking] = useState<BookingModel | null>(null);
  const [reviewBooking, setReviewBooking] = useState<BookingModel | null>(null);
  const [returnBooking, setReturnBooking] = useState<BookingModel | null>(null);
  const [showCircles, setShowCircles] = useState(false);
  const [selectedTrustGroupId, setSelectedTrustGroupId] = useState<string | null>(null);
  const [selectedTrustGroupName, setSelectedTrustGroupName] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('explore');
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    setToast({ message, tone });
    window.setTimeout(() => setToast((t) => (t?.message === message ? null : t)), 4000);
  }, []);

  // Who is signed in (from the session cookie).
  useEffect(() => {
    api
      .session()
      .then(({ user }) => {
        setCurrentUser(user);
        if (user?.role === 'ADMIN' && initialParams.wantsAdmin) {
          navigate('/admin');
        }
      })
      .catch(() => setCurrentUser(null))
      .finally(() => setIsAuthChecking(false));
  }, [initialParams.wantsAdmin, navigate]);

  // Keep the address bar in step with filters so searches can be shared (marketplace home view only).
  useEffect(() => {
    if (path !== '/') return;
    const params = new URLSearchParams();
    if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory);
    if (selectedSubcategory) params.set('sub', selectedSubcategory);
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (locationState.latitude !== null && locationState.longitude !== null) {
      params.set('lat', locationState.latitude.toString());
      params.set('lng', locationState.longitude.toString());
      params.set('radius', radiusKm.toString());
      if (locationState.label) params.set('loc', locationState.label);
    }
    if (cityFilter && cityFilter !== 'all') params.set('city', cityFilter);
    if (selectedTrustGroupId) params.set('group', selectedTrustGroupId);

    const query = params.toString();
    window.history.replaceState(null, '', `/${query ? '?' + query : ''}`);
  }, [path, selectedCategory, selectedSubcategory, searchQuery, locationState, radiusKm, cityFilter, selectedTrustGroupId]);

  // --- Loading member data ---

  const refreshActivity = useCallback(async () => {
    const next = currentUser ? await api.activity().catch(() => EMPTY_ACTIVITY) : EMPTY_ACTIVITY;
    setActivity(next);
    return next;
  }, [currentUser]);

  const refreshCircles = useCallback(async () => {
    const groups = currentUser ? await api.circles().catch(() => []) : [];
    setMyCircles(groups.filter((g) => g.isCurrentUserMember));
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      refreshActivity();
      refreshCircles();
    }
  }, [currentUser, refreshActivity, refreshCircles]);

  // Back from PayFast: the payment notification usually lands within seconds.
  useEffect(() => {
    const outcome = initialParams.paymentReturn;
    if (!outcome || !currentUser) return;
    if (outcome === 'cancelled') {
      showToast('Payment cancelled. Your booking is held for 30 minutes if you want to try again.', 'info');
      navigate('/me/rentals');
      return;
    }
    navigate('/me/rentals');
    showToast("Thanks! We're confirming your payment with PayFast…", 'info');
    let attempts = 0;
    const timer = window.setInterval(async () => {
      attempts++;
      const next = await refreshActivity();
      const stillWaiting = next.bookings.some((b) => b.viewerRole === 'renter' && b.status === 'PENDING_PAYMENT');
      if (!stillWaiting) {
        window.clearInterval(timer);
        showToast('Payment confirmed. You are all set!');
      } else if (attempts >= 10) {
        window.clearInterval(timer);
        showToast('Your payment is still being confirmed. We will update My activity as soon as PayFast lets us know.', 'info');
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [currentUser?.id, initialParams.paymentReturn, navigate, refreshActivity, showToast]);

  const [searchError, setSearchError] = useState<string | null>(null);
  const runSearch = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await api.searchListings({
          searchTerm: searchQuery,
          categorySlug: selectedSubcategory || (selectedCategory !== 'all' ? selectedCategory : undefined),
          lat: locationState.latitude,
          lng: locationState.longitude,
          radiusKm: locationState.latitude !== null ? radiusKm : undefined,
          city: cityFilter !== 'all' ? cityFilter : undefined,
          groupId: selectedTrustGroupId,
        });
        setListings(result.listings);
        setSearchError(null);
      } catch (err: any) {
        setSearchError(err?.message || 'We could not load listings.');
      }
    });
  }, [searchQuery, selectedCategory, selectedSubcategory, locationState, radiusKm, cityFilter, selectedTrustGroupId]);

  useEffect(() => {
    if (currentUser) {
      runSearch();
    }
  }, [currentUser, runSearch]);

  // --- Filters ---

  const handleSelectCategory = (catSlug: string, subSlug?: string | null) => {
    setSelectedCategory(catSlug);
    setSelectedSubcategory(subSlug || null);
  };

  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSelectedSubcategory(null);
    setSearchQuery('');
    setCityFilter('all');
    setRadiusKm(10);
    setLocationState({ latitude: null, longitude: null, label: 'All Cape Town', isGeoActive: false, error: null });
  };

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    selectedSubcategory !== null ||
    searchQuery.trim() !== '' ||
    locationState.latitude !== null ||
    cityFilter !== 'all';

  // --- Member actions ---

  const requireSignIn = (): UserModel | null => {
    if (currentUser) return currentUser;
    setShowAuthModal(true);
    showToast('Sign in or create an account to continue.', 'info');
    return null;
  };

  const handleJoinCoop = async (listing: ListingModel, tier: PricingTierModel) => {
    const user = requireSignIn();
    if (!user) return;
    const { checkout } = await api.joinCoop(listing.id, tier.id);
    submitCheckout(checkout);
  };

  const handleBook = async (listing: ListingModel, tier: PricingTierModel, start: Date, end: Date) => {
    const user = requireSignIn();
    if (!user) return;
    const { checkout } = await api.createBooking({
      listingId: listing.id,
      tierId: tier.id,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
    submitCheckout(checkout);
  };

  const handleLogUsage = async (subscriptionId: string, notes: string) => {
    if (!currentUser) return;
    const result = await api.logUsage(subscriptionId, notes);
    await refreshActivity();
    const left = result.subscription.remainingUses;
    showToast(`Enjoy! You have ${left} ${left === 1 ? 'turn' : 'turns'} left this period.`);
  };

  const handleConfirmPickup = async (bookingId: string, code: string) => {
    if (!currentUser) return;
    await api.confirmPickup(bookingId, code);
    await refreshActivity();
    showToast('Pickup confirmed. Enjoy!');
  };

  // --- Account & Auth ---

  const handleAuthSuccess = (session: AuthSession) => {
    if (!session.user) return;
    setCurrentUser(session.user);
    showToast(`Welcome, ${session.user.name.split(' ')[0]}!`);
  };

  const handleSignOut = async () => {
    await api.signOut().catch(() => undefined);
    setCurrentUser(null);
    setShowActivity(false);
    setShowCreateModal(false);
    setEditingListing(null);
    setSelectedTrustGroupId(null);
    setSelectedTrustGroupName(null);
    navigate('/');
    showToast('You have signed out.', 'info');
  };

  const handleSwitchDemoAccount = async (role: UserRole) => {
    try {
      const { user } = await api.signInDemo(role);
      setCurrentUser(user);
      showToast(`Signed in as ${user.name}.`, 'info');
    } catch (err: any) {
      showToast(err?.message || 'Could not switch account.', 'info');
    }
  };

  const openActivity = () => {
    if (requireSignIn()) {
      navigate('/me/rentals');
    }
  };

  const openCreateListing = () => {
    if (requireSignIn()) setShowCreateModal(true);
  };

  const pendingPickups = activity.bookings.filter((b) => b.status === 'PENDING_HANDOVER').length;
  const activityBadge = activity.subscriptions.length + pendingPickups;

  // 1. Initial Auth Checking Screen
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center text-white selection:bg-emerald-500/30 selection:text-emerald-200">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 flex items-center justify-center font-black text-2xl shadow-xl shadow-emerald-500/20">
            S
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold tracking-tight text-white text-lg">
              Share<span className="text-emerald-400">Hub</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium">Cape Town's Community Marketplace</p>
          <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mt-3" />
        </div>
      </div>
    );
  }

  // 2. Mandatory Sign-up / Sign-in Gate
  if (!currentUser) {
    return (
      <>
        {toast && (
          <div
            role="status"
            className="fixed top-6 right-4 left-4 sm:left-auto sm:right-6 z-[70] p-4 rounded-xl bg-slate-900 text-white shadow-xl flex items-center gap-3 border border-slate-800 animate-in slide-in-from-top-3"
          >
            {toast.tone === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-sky-400 shrink-0" />
            )}
            <span className="text-xs font-medium">{toast.message}</span>
          </div>
        )}
        <AuthGate onAuthSuccess={handleAuthSuccess} />
      </>
    );
  }

  // 3. Authenticated App Experience
  const isMeRoute = path.startsWith('/me');
  const isAdminRoute = path.startsWith('/admin');

  return (
    <div className="min-h-screen bg-[#fcfcfd] text-slate-900 flex flex-col selection:bg-indigo-100 selection:text-indigo-900 pb-20 md:pb-0">
      <PwaInstallBanner />

      {toast && (
        <div
          role="status"
          className="fixed top-20 right-4 left-4 sm:left-auto z-[60] p-4 rounded-xl bg-slate-900 text-white shadow-xl flex items-center gap-3 border border-slate-800 animate-in slide-in-from-top-3"
        >
          {toast.tone === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <Info className="w-5 h-5 text-sky-400 shrink-0" />
          )}
          <span className="text-xs font-medium">{toast.message}</span>
        </div>
      )}

      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activityCount={activityBadge}
        onOpenActivity={openActivity}
        onOpenCreateListing={openCreateListing}
        onOpenCircles={() => setShowCircles(true)}
        currentUser={currentUser}
        onOpenAuth={() => setShowAuthModal(true)}
        onSignOut={handleSignOut}
        onOpenAdminDashboard={() => navigate('/admin')}
        onNavigateHome={() => navigate('/')}
        onNavigateDashboard={(sec) => navigate(sec && sec !== 'overview' ? `/me/${sec}` : '/me')}
        onSwitchDemoAccount={import.meta.env.DEV ? handleSwitchDemoAccount : undefined}
        onOpenArchitecture={import.meta.env.DEV ? () => setShowArchitectureModal(true) : undefined}
      />

      {/* Main Routed Content */}
      {isAdminRoute ? (
        isAdmin ? (
          <main className="flex-1 w-full py-6">
            <Suspense
              fallback={
                <div className="min-h-[50vh] flex flex-col items-center justify-center text-slate-500 gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                  <span className="text-sm font-semibold">Loading admin console…</span>
                </div>
              }
            >
              <AdminDashboard
                isPage
                currentUser={currentUser}
                initialTab={parseAdminTab(path)}
                onSelectTab={(tab) => navigate(`/admin/${tab}`)}
                onClose={() => navigate('/')}
                onViewListing={(l) => setSelectedListing(l)}
              />
            </Suspense>
          </main>
        ) : (
          <main className="max-w-xl mx-auto my-20 p-8 bg-white rounded-3xl border border-slate-200 text-center shadow-lg">
            <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
            <h2 className="text-xl font-black text-slate-900 mb-2">Admin Access Required</h2>
            <p className="text-sm text-slate-600 mb-6">You must be an administrator to view this area.</p>
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all cursor-pointer"
            >
              Return to marketplace
            </button>
          </main>
        )
      ) : isMeRoute ? (
        <main className="flex-1 w-full py-6">
          <DashboardPage
            currentUser={currentUser}
            initialSection={parseMeSection(path)}
            onNavigateSection={(sec) => navigate(sec === 'overview' ? '/me' : `/me/${sec}`)}
            onBackToHome={() => navigate('/')}
            activity={activity}
            refreshActivity={refreshActivity}
            circles={myCircles}
            onOpenCreateListing={openCreateListing}
            onEditListing={(listing) => setEditingListing(listing)}
            onViewListing={(listing) => setSelectedListing(listing)}
            onPay={(booking) => setPaymentBooking(booking)}
            onCheckReturn={(booking) => setReturnBooking(booking)}
            onReview={(booking) => setReviewBooking(booking)}
            onSignOut={handleSignOut}
            onUserUpdated={(updatedUser) => {
              setCurrentUser(updatedUser);
              showToast('Profile updated!');
            }}
            showToast={showToast}
          />
        </main>
      ) : (
        <>
          <CategoryNav
            selectedCategorySlug={selectedCategory}
            selectedSubcategorySlug={selectedSubcategory}
            onSelectCategory={handleSelectCategory}
            totalListingsCount={listings.length}
          />

          <SearchHeader
            searchTerm={searchQuery}
            onSearchTermChange={setSearchQuery}
            locationState={locationState}
            onLocationChange={(partial) => setLocationState((prev) => ({ ...prev, ...partial }))}
            radiusKm={radiusKm}
            onRadiusChange={setRadiusKm}
            cityFilter={cityFilter}
            onCityFilterChange={setCityFilter}
            onResetFilters={handleResetFilters}
            hasActiveFilters={hasActiveFilters}
            totalResultsCount={listings.length}
          />

          {selectedTrustGroupId && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 w-full">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-emerald-950">
                    Showing listings from <strong className="font-bold text-emerald-900">{selectedTrustGroupName || 'your circle'}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTrustGroupId(null);
                    setSelectedTrustGroupName(null);
                  }}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                >
                  Show everything
                </button>
              </div>
            </div>
          )}

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 flex-1 w-full">
            {searchError && (
              <div role="alert" className="mb-5 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-sm text-rose-800 flex flex-wrap items-center justify-between gap-2">
                <span>{searchError}</span>
                <button type="button" onClick={runSearch} className="font-bold underline cursor-pointer">
                  Try again
                </button>
              </div>
            )}
            <ProximityFeed
              listings={listings}
              locationState={locationState}
              radiusKm={radiusKm}
              selectedCategorySlug={selectedCategory}
              selectedSubcategorySlug={selectedSubcategory}
              searchTerm={searchQuery}
              onSelectListing={(l) => setSelectedListing(l)}
              isSubscribedCheck={(listingId) => activity.subscriptions.some((s) => s.listingId === listingId)}
              onExpandRadius={(newRadius) => setRadiusKm(newRadius)}
              onResetFilters={handleResetFilters}
              isLoading={isPending}
            />
          </main>
        </>
      )}

      {/* Listing Detail Modal */}
      {selectedListing && (
        <ListingDetailModal
          listing={selectedListing}
          currentUserId={currentUser.id}
          userSubscription={activity.subscriptions.find((s) => s.listingId === selectedListing.id)}
          onClose={() => setSelectedListing(null)}
          onJoinCoop={handleJoinCoop}
          onBook={handleBook}
          onLogUsage={handleLogUsage}
          onRequireSignIn={() => setShowAuthModal(true)}
        />
      )}

      {/* Quick Activity Modal (fallback) */}
      {showActivity && (
        <FractionalUsageLogger
          activity={activity}
          onClose={() => setShowActivity(false)}
          onLogUsage={handleLogUsage}
          onConfirmPickup={handleConfirmPickup}
          onPay={(booking) => setPaymentBooking(booking)}
          onCheckReturn={(booking) => setReturnBooking(booking)}
          onReview={(booking) => setReviewBooking(booking)}
          onBrowse={() => setShowActivity(false)}
        />
      )}

      {/* Return Handover Modal */}
      {returnBooking && (
        <ReturnHandoverModal
          isOpen
          booking={returnBooking}
          onClose={() => setReturnBooking(null)}
          onReturnCompleted={async (outcome) => {
            await refreshActivity();
            showToast(
              outcome === 'dispute'
                ? "Thanks for letting us know. We've paused the payout while we look into it."
                : 'All checked in. The payment is on its way to you.'
            );
          }}
        />
      )}

      {/* Circles Modal */}
      {showCircles && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Your circles</h2>
                <p className="text-[11px] text-slate-500">
                  Private groups for your building, makerspace or street
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowCircles(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <TrustGroupHub
                currentUserId={currentUser.id}
                activeSelectedGroupId={selectedTrustGroupId}
                onRequireSignIn={() => {
                  setShowCircles(false);
                  setShowAuthModal(true);
                }}
                onMembershipChange={refreshCircles}
                onFilterByGroup={(groupId, groupName) => {
                  setSelectedTrustGroupId(groupId);
                  setSelectedTrustGroupName(groupName || null);
                  setShowCircles(false);
                  if (groupId) showToast(`Showing listings from ${groupName}.`, 'info');
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Escrow Payment Modal */}
      {paymentBooking && (
        <EscrowPaymentModal isOpen booking={paymentBooking} onClose={() => setPaymentBooking(null)} />
      )}

      {/* Review Modal */}
      {reviewBooking && (
        <ReviewModal
          isOpen
          booking={reviewBooking}
          onClose={() => setReviewBooking(null)}
          onReviewSubmitted={async () => {
            await refreshActivity();
            runSearch();
            showToast('Thanks for your review!');
          }}
        />
      )}

      {/* Architecture Viewer (Dev only) */}
      {ArchitectureViewer && showArchitectureModal && (
        <Suspense fallback={null}>
          <ArchitectureViewer onClose={() => setShowArchitectureModal(false)} />
        </Suspense>
      )}

      {/* Create Listing Modal */}
      {showCreateModal && (
        <CreateListingModal
          circles={myCircles}
          onClose={() => setShowCreateModal(false)}
          onCreate={(listing) => {
            runSearch();
            refreshActivity();
            showToast(`"${listing.title}" is live. Nice one!`);
          }}
        />
      )}

      {/* Edit Listing Modal */}
      {editingListing && (
        <CreateListingModal
          circles={myCircles}
          initial={editingListing}
          onClose={() => setEditingListing(null)}
          onUpdate={(listing) => {
            setEditingListing(null);
            runSearch();
            refreshActivity();
            showToast(`Listing "${listing.title}" updated.`);
          }}
        />
      )}

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} onAuthSuccess={handleAuthSuccess} />

      <Footer />

      <MobileNav
        activeTab={isMeRoute ? 'activity' : mobileTab}
        onSelectTab={setMobileTab}
        activityCount={activityBadge}
        currentUser={currentUser}
        onOpenCreateListing={openCreateListing}
        onOpenCircles={() => setShowCircles(true)}
        onOpenActivity={openActivity}
        onNavigateHome={() => navigate('/')}
        onNavigateDashboard={(sec) => navigate(sec && sec !== 'overview' ? `/me/${sec}` : '/me')}
      />
    </div>
  );
}
