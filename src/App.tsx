import React, { useState, useEffect, useTransition, useCallback } from 'react';
import {
  Sparkles,
  SlidersHorizontal,
  Zap,
  BedDouble,
  Wrench,
  ShieldCheck,
  Users,
  Repeat,
  PlusCircle,
  FileCode,
  MapPin,
  CheckCircle2,
  ChevronDown,
  Info,
  ArrowUpRight,
  TrendingUp,
  Compass,
  Layers,
  Car,
  Navigation,
  X,
  Lock,
} from 'lucide-react';
import { Navbar } from './components/layout/Navbar';
import { MobileNav } from './components/layout/MobileNav';
import { PwaInstallBanner } from './components/layout/PwaInstallBanner';
import { Footer } from './components/layout/Footer';
import { CategoryNav } from './components/discovery/CategoryNav';
import { SearchHeader, LocationState } from './components/discovery/SearchHeader';
import { ProximityFeed } from './components/discovery/ProximityFeed';
import { ListingDetailModal } from './components/listings/ListingDetailModal';
import { FractionalUsageLogger } from './components/usage/FractionalUsageLogger';
import { ArchitectureViewer } from './components/docs/ArchitectureViewer';
import { CreateListingModal } from './components/listings/CreateListingModal';
import { AuthModal } from './components/auth/AuthModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { EscrowPaymentModal } from './components/payments/EscrowPaymentModal';
import { ReviewModal } from './components/reviews/ReviewModal';
import { ReturnHandoverModal } from './components/bookings/ReturnHandoverModal';
import { TrustGroupHub } from './components/groups/TrustGroupHub';
import { INITIAL_LISTINGS } from './data/mockListings';
import { searchListings } from '../actions/search';
import { DEMO_ACCOUNTS } from '../actions/auth';
import {
  ListingCategory,
  ListingModel,
  PricingTierModel,
  UserSubscriptionModel,
  UsageLogModel,
  SystemLogModel,
  BookingModel,
  UserModel,
  UserRole,
  AuthSession,
} from './types';
import { cn } from './lib/utils';

export default function App({ initialListings }: { initialListings?: ListingModel[] } = {}) {
  // 1. URL-Based State Initialization
  const parseInitialUrlParams = () => {
    if (typeof window === 'undefined') {
      return {
        category: 'all',
        sub: null,
        query: '',
        lat: null,
        lng: null,
        radius: 10,
        label: 'All Cape Town',
        city: 'all',
        view: null,
      };
    }

    const params = new URLSearchParams(window.location.search);
    const category = params.get('category') || 'all';
    const sub = params.get('sub') || null;
    const query = params.get('q') || '';
    const latStr = params.get('lat');
    const lngStr = params.get('lng');
    const radiusStr = params.get('radius');
    const label = params.get('loc') || (latStr ? 'Custom Pin' : 'All Cape Town');
    const city = params.get('city') || 'all';
    const view = params.get('view') || (window.location.pathname === '/admin' ? 'admin' : null);

    const lat = latStr ? parseFloat(latStr) : null;
    const lng = lngStr ? parseFloat(lngStr) : null;
    const radius = radiusStr ? parseInt(radiusStr, 10) : 10;

    return { category, sub, query, lat, lng, radius, label, city, view };
  };

  const initialParams = parseInitialUrlParams();

  // Active Authenticated User Session (Defaulted to Admin for immediate evaluation)
  const [currentUser, setCurrentUser] = useState<UserModel | null>(DEMO_ACCOUNTS.ADMIN);

  // State Management
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

  const [listings, setListings] = useState<ListingModel[]>(
    initialListings && initialListings.length > 0 ? initialListings : INITIAL_LISTINGS
  );
  const [isPending, startTransition] = useTransition();

  // Active user subscriptions state
  const [subscriptions, setSubscriptions] = useState<UserSubscriptionModel[]>([
    {
      id: 'sub_init_wm',
      userId: 'usr_me',
      listingId: 'list_wm_001',
      listing: INITIAL_LISTINGS[0],
      pricingTierId: 'tier_wm_10uses',
      pricingTier: INITIAL_LISTINGS[0].pricingTiers[0],
      status: 'active',
      remainingUsesThisPeriod: 7, // 7 left out of 10
      totalUsesUsed: 3,
      currentPeriodStart: '2026-08-01',
      currentPeriodEnd: '2026-08-31',
      accessKeyOrCode: 'PIN-8842',
    },
  ]);

  // Tamper-evident usage audit logs state
  const [usageLogs, setUsageLogs] = useState<UsageLogModel[]>([
    {
      id: 'log_001',
      subscriptionId: 'sub_init_wm',
      listingId: 'list_wm_001',
      listingTitle: 'Bosch Serie 8 (9kg) High-Efficiency Washer Co-Op',
      userId: 'usr_me',
      userName: 'Alex Rivera',
      startedAt: '2026-08-18 14:22',
      unitsUsed: 1,
      status: 'completed',
      notes: 'Cotton 40°C Standard Cycle (60 min)',
      verificationCode: 'IOT_AUTH_8842',
    },
    {
      id: 'log_002',
      subscriptionId: 'sub_init_wm',
      listingId: 'list_wm_001',
      listingTitle: 'Bosch Serie 8 (9kg) High-Efficiency Washer Co-Op',
      userId: 'usr_me',
      userName: 'Alex Rivera',
      startedAt: '2026-08-15 09:10',
      unitsUsed: 1,
      status: 'completed',
      notes: 'Delicates / Silk 30°C Cycle (35 min)',
      verificationCode: 'IOT_AUTH_8842',
    },
  ]);

  // Immutable SystemLogs state (tracks state changes with JSONB metadata)
  const [systemLogs, setSystemLogs] = useState<SystemLogModel[]>([
    {
      id: 'sys_log_init_01',
      eventType: 'LISTING_CREATED',
      userId: 'usr_me',
      targetId: 'list_wm_001',
      metadata: {
        listingTitle: 'Bosch Serie 8 (9kg) High-Efficiency Washer Co-Op',
        category: 'fractional_appliance',
        maxSubscribers: 4,
        pricingTiersCount: 2,
        initialQuota: 10,
        hardwareAccess: 'pin_code',
      },
      createdAt: '2026-08-01T10:00:00Z',
    },
    {
      id: 'sys_log_init_02',
      eventType: 'FRACTIONAL_USE_LOGGED',
      userId: 'usr_me',
      targetId: 'sub_init_wm',
      metadata: {
        action: 'FRACTIONAL_QUOTA_DEDUCTION',
        subscriptionId: 'sub_init_wm',
        listingId: 'list_wm_001',
        previousRemainingUses: 8,
        newRemainingUses: 7,
        unitsDeducted: 1,
        cycleNotes: 'Cotton 40°C Standard Cycle',
      },
      createdAt: '2026-08-18T14:22:00Z',
    },
    {
      id: 'sys_log_init_03',
      eventType: 'AUTH_SIGNIN',
      userId: 'usr_admin_01',
      targetId: 'usr_admin_01',
      metadata: {
        provider: 'BETTER_AUTH',
        role: 'ADMIN',
        email: 'admin@sharehub.community',
      },
      createdAt: '2026-08-21T00:00:00Z',
    },
  ]);

  // Bookings with digital handover state machine
  const [bookings, setBookings] = useState<BookingModel[]>([
    {
      id: 'book_drill_001',
      listingId: 'list_drill_002',
      listingTitle: 'DeWalt 20V MAX Cordless Rotary Hammer Drill Kit',
      renterId: 'usr_me',
      renterName: 'Alex Rivera',
      status: 'PENDING_HANDOVER',
      verificationCode: 'HANDOVER-8842',
      totalAmountInCents: 15000,
      depositAmountInCents: 50000,
      startDate: '2026-08-21 09:00',
      endDate: '2026-08-23 18:00',
      handoverCompletedAt: null,
      handoverNotes: 'Includes 2x 4.0Ah batteries and bit set',
    },
  ]);

  // Modals state
  const [selectedListing, setSelectedListing] = useState<ListingModel | null>(null);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [showArchitectureModal, setShowArchitectureModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(initialParams.view === 'admin');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatListing, setChatListing] = useState<ListingModel | null>(null);
  const [isEscrowModalOpen, setIsEscrowModalOpen] = useState(false);
  const [activeEscrowBooking, setActiveEscrowBooking] = useState<BookingModel | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [activeReviewBooking, setActiveReviewBooking] = useState<BookingModel | null>(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [activeReturnBooking, setActiveReturnBooking] = useState<BookingModel | null>(null);
  const [showTrustGroupHub, setShowTrustGroupHub] = useState(false);
  const [selectedTrustGroupId, setSelectedTrustGroupId] = useState<string | null>(null);
  const [selectedTrustGroupName, setSelectedTrustGroupName] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'explore' | 'circles' | 'activity' | 'messages' | 'profile'>('explore');
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setNotificationToast(message);
    setTimeout(() => {
      setNotificationToast(null);
    }, 4000);
  };

  // 2. Synchronize URL search parameters with current filters
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams();
    if (selectedCategory && selectedCategory !== 'all') {
      params.set('category', selectedCategory);
    }
    if (selectedSubcategory) {
      params.set('sub', selectedSubcategory);
    }
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
    }
    if (locationState.latitude !== null && locationState.longitude !== null) {
      params.set('lat', locationState.latitude.toString());
      params.set('lng', locationState.longitude.toString());
      params.set('radius', radiusKm.toString());
      if (locationState.label) {
        params.set('loc', locationState.label);
      }
    }
    if (cityFilter && cityFilter !== 'all') {
      params.set('city', cityFilter);
    }
    if (selectedTrustGroupId) {
      params.set('group', selectedTrustGroupId);
    }
    if (showAdminDashboard) {
      params.set('view', 'admin');
    }

    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState(null, '', newUrl);
  }, [selectedCategory, selectedSubcategory, searchQuery, locationState, radiusKm, cityFilter, selectedTrustGroupId, showAdminDashboard]);

  // 3. Execute Discovery Engine Search Action
  const executeSearch = useCallback(async () => {
    startTransition(async () => {
      const targetCategory = selectedSubcategory || (selectedCategory !== 'all' ? selectedCategory : undefined);

      const searchParams = {
        query: searchQuery,
        categorySlug: targetCategory,
        latitude: locationState.latitude,
        longitude: locationState.longitude,
        radiusKm: locationState.latitude !== null ? radiusKm : undefined,
        city: cityFilter !== 'all' ? cityFilter : undefined,
        visibilityGroupId: selectedTrustGroupId || undefined,
        userMemberGroupIds: ['grp_woodstock_coop', 'grp_obs_ecovillage'],
      };

      const result = await searchListings(searchParams);

      if (result && Array.isArray(result.listings)) {
        setListings(result.listings);
      }
    });
  }, [searchQuery, selectedCategory, selectedSubcategory, locationState, radiusKm, cityFilter, selectedTrustGroupId]);

  // Trigger search on parameter changes
  useEffect(() => {
    executeSearch();
  }, [executeSearch]);

  // Handlers for category selection
  const handleSelectCategory = (catSlug: string, subSlug?: string | null) => {
    setSelectedCategory(catSlug);
    setSelectedSubcategory(subSlug || null);
  };

  // Location change handler
  const handleLocationChange = (partial: Partial<LocationState>) => {
    setLocationState((prev) => ({ ...prev, ...partial }));
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSelectedSubcategory(null);
    setSearchQuery('');
    setCityFilter('all');
    setRadiusKm(10);
    setLocationState({
      latitude: null,
      longitude: null,
      label: 'All Cape Town',
      isGeoActive: false,
      error: null,
    });
  };

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    selectedSubcategory !== null ||
    searchQuery.trim() !== '' ||
    locationState.latitude !== null ||
    cityFilter !== 'all';

  // Handler to subscribe to a listing / co-op tier
  const handleSubscribe = (listing: ListingModel, tier: PricingTierModel) => {
    const existing = subscriptions.find((s) => s.listingId === listing.id);
    if (existing) {
      showToast(`You already have an active subscription for ${listing.title}.`);
      return;
    }

    const newSub: UserSubscriptionModel = {
      id: `sub_${Date.now()}`,
      userId: currentUser?.id || 'usr_me',
      listingId: listing.id,
      listing,
      pricingTierId: tier.id,
      pricingTier: tier,
      status: 'active',
      remainingUsesThisPeriod: tier.usageLimitPerPeriod || 10,
      totalUsesUsed: 0,
      currentPeriodStart: new Date().toISOString().split('T')[0],
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      accessKeyOrCode:
        listing.accessMethod === 'smart_plug'
          ? `IOT-TOKEN-${Math.floor(1000 + Math.random() * 9000)}`
          : `PIN-${Math.floor(1000 + Math.random() * 9000)}`,
    };

    const newSystemLog: SystemLogModel = {
      id: `sys_log_${Date.now()}`,
      eventType: 'BOOKING_CREATED',
      userId: currentUser?.id || 'usr_me',
      targetId: newSub.id,
      metadata: {
        action: 'SUBSCRIPTION_ENROLLED',
        listingId: listing.id,
        listingTitle: listing.title,
        tierName: tier.name,
        priceInCents: tier.priceInCents,
        quotaGranted: tier.usageLimitPerPeriod || 10,
      },
      createdAt: new Date().toISOString(),
    };

    setSubscriptions((prev) => [newSub, ...prev]);
    setSystemLogs((prev) => [newSystemLog, ...prev]);
    showToast(`Successfully subscribed to ${listing.title}! Access code generated.`);
  };

  const handleLogUsage = (sub: UserSubscriptionModel, notes?: string) => {
    if (sub.remainingUsesThisPeriod <= 0) {
      showToast('Monthly quota exhausted. Reset your period or upgrade tier.');
      return;
    }

    const updatedSub = {
      ...sub,
      remainingUsesThisPeriod: sub.remainingUsesThisPeriod - 1,
      totalUsesUsed: sub.totalUsesUsed + 1,
    };

    const newUsageLog: UsageLogModel = {
      id: `log_${Date.now()}`,
      subscriptionId: sub.id,
      listingId: sub.listingId,
      listingTitle: sub.listing.title,
      userId: currentUser?.id || 'usr_me',
      userName: currentUser?.name || 'Alex Rivera',
      startedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      unitsUsed: 1,
      status: 'completed',
      notes: notes || 'Standard Scheduled Cycle',
      verificationCode: `IOT_VERIFY_${Math.floor(1000 + Math.random() * 9000)}`,
    };

    const newSystemLog: SystemLogModel = {
      id: `sys_log_${Date.now()}`,
      eventType: 'FRACTIONAL_USE_LOGGED',
      userId: currentUser?.id || 'usr_me',
      targetId: sub.id,
      metadata: {
        action: 'FRACTIONAL_QUOTA_DEDUCTION',
        subscriptionId: sub.id,
        listingId: sub.listingId,
        previousRemainingUses: sub.remainingUsesThisPeriod,
        newRemainingUses: updatedSub.remainingUsesThisPeriod,
        unitsDeducted: 1,
        notes: notes || 'Standard Scheduled Cycle',
      },
      createdAt: new Date().toISOString(),
    };

    setSubscriptions((prev) => prev.map((s) => (s.id === sub.id ? updatedSub : s)));
    setUsageLogs((prev) => [newUsageLog, ...prev]);
    setSystemLogs((prev) => [newSystemLog, ...prev]);
    showToast(`1 cycle logged for ${sub.listing.title}. ${updatedSub.remainingUsesThisPeriod} remaining.`);
  };

  const handleResetMonth = (subId: string) => {
    setSubscriptions((prev) =>
      prev.map((s) =>
        s.id === subId
          ? {
              ...s,
              remainingUsesThisPeriod: s.pricingTier.usageLimitPerPeriod || 10,
              totalUsesUsed: 0,
            }
          : s
      )
    );
    showToast('Subscription quota refreshed for the new billing cycle.');
  };

  const handleCreateListing = (newListing: ListingModel) => {
    setListings((prev) => [newListing, ...prev]);
    const newSystemLog: SystemLogModel = {
      id: `sys_log_${Date.now()}`,
      eventType: 'LISTING_CREATED',
      userId: currentUser?.id || 'usr_me',
      targetId: newListing.id,
      metadata: {
        title: newListing.title,
        category: newListing.category,
        neighborhood: newListing.neighborhood,
        city: newListing.city,
        imagesCount: newListing.images.length,
      },
      createdAt: new Date().toISOString(),
    };
    setSystemLogs((prev) => [newSystemLog, ...prev]);
    showToast(`Listing "${newListing.title}" created & published to Discovery Engine!`);
  };

  // Auth session handlers
  const handleAuthSuccess = (session: AuthSession) => {
    if (session.user) {
      setCurrentUser(session.user);
      showToast(`Welcome back, ${session.user.name} (${session.user.role})!`);
    }
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    showToast('Signed out of ShareHub.');
  };

  const handleSwitchRole = (newRole: UserRole) => {
    const demoUser = DEMO_ACCOUNTS[newRole];
    setCurrentUser(demoUser);
    showToast(`Switched active role to: ${newRole} (${demoUser.name})`);
  };

  const handleElevateToAdmin = () => {
    handleSwitchRole('ADMIN');
    setShowAdminDashboard(true);
  };

  return (
    <div className="min-h-screen bg-[#fcfcfd] text-slate-900 flex flex-col selection:bg-indigo-100 selection:text-indigo-900 pb-20 md:pb-0">
      {/* PWA Install Banner */}
      <PwaInstallBanner />

      {/* Toast Notification */}
      {notificationToast && (
        <div className="fixed top-20 right-4 z-50 p-4 rounded-xl bg-slate-900 text-white shadow-xl flex items-center gap-3 border border-slate-800 animate-in slide-in-from-top-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium">{notificationToast}</span>
        </div>
      )}

      {/* Main Responsive Header with Better Auth Session */}
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeSubscriptionsCount={subscriptions.length}
        onOpenSubscriptions={() => setShowUsageModal(true)}
        onOpenArchitecture={() => setShowArchitectureModal(true)}
        onOpenCreateListing={() => setShowCreateModal(true)}
        onOpenTrustGroups={() => setShowTrustGroupHub(true)}
        onOpenChat={() => setIsChatOpen(true)}
        currentUser={currentUser}
        onOpenAuth={() => setShowAuthModal(true)}
        onSignOut={handleSignOut}
        onSwitchRole={handleSwitchRole}
        onOpenAdminDashboard={() => setShowAdminDashboard(true)}
      />

      {/* Discovery Category Navigation (Hierarchical Multi-Level Pills) */}
      <CategoryNav
        selectedCategorySlug={selectedCategory}
        selectedSubcategorySlug={selectedSubcategory}
        onSelectCategory={handleSelectCategory}
        totalListingsCount={listings.length}
      />

      {/* Discovery Search & Geolocation Filter Bar */}
      <SearchHeader
        searchTerm={searchQuery}
        onSearchTermChange={setSearchQuery}
        locationState={locationState}
        onLocationChange={handleLocationChange}
        radiusKm={radiusKm}
        onRadiusChange={setRadiusKm}
        cityFilter={cityFilter}
        onCityFilterChange={setCityFilter}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
        totalResultsCount={listings.length}
      />

      {/* Trust Group Active Filter Banner */}
      {selectedTrustGroupId && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3">
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-emerald-950">
                Exclusive Inventory Filter: <strong className="font-bold text-emerald-900">{selectedTrustGroupName || 'Private Trust Group'}</strong>
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedTrustGroupId(null);
                setSelectedTrustGroupName(null);
              }}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
            >
              Reset to Public Marketplace
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area: Proximity Feed & Search Results */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 flex-1 w-full">
        <ProximityFeed
          listings={listings}
          locationState={locationState}
          radiusKm={radiusKm}
          selectedCategorySlug={selectedCategory}
          selectedSubcategorySlug={selectedSubcategory}
          searchTerm={searchQuery}
          onSelectListing={(l) => setSelectedListing(l)}
          onQuickSubscribe={(l, tier) => handleSubscribe(l, tier)}
          isSubscribedCheck={(listingId) =>
            subscriptions.some((s) => s.listingId === listingId)
          }
          onExpandRadius={(newRadius) => setRadiusKm(newRadius)}
          onResetFilters={handleResetFilters}
          isLoading={isPending}
        />
      </main>

      {/* Listing Detail & Subscription Modal */}
      {selectedListing && (
        <ListingDetailModal
          listing={selectedListing}
          onClose={() => setSelectedListing(null)}
          onSubscribe={handleSubscribe}
          userSubscription={subscriptions.find(
            (s) => s.listingId === selectedListing.id
          )}
          onLogUsage={handleLogUsage}
          onMessageHost={(listing) => {
            setChatListing(listing);
            setIsChatOpen(true);
          }}
        />
      )}

      {/* Fractional Usage & Ledger Modal */}
      {showUsageModal && (
        <FractionalUsageLogger
          subscriptions={subscriptions}
          usageLogs={usageLogs}
          systemLogs={systemLogs}
          bookings={bookings}
          onLogUsageSuccess={(updatedSub, newUsageLog, newSystemLog) => {
            setSubscriptions((prev) =>
              prev.map((s) =>
                s.id === updatedSub.id
                  ? { ...s, remainingUsesThisPeriod: updatedSub.remainingUses }
                  : s
              )
            );
            setUsageLogs((prev) => [newUsageLog, ...prev]);
            setSystemLogs((prev) => [newSystemLog, ...prev]);
          }}
          onConfirmHandoverSuccess={(updatedBooking, newSystemLog) => {
            setBookings((prev) =>
              prev.map((b) => (b.id === updatedBooking.id ? updatedBooking : b))
            );
            setSystemLogs((prev) => [newSystemLog, ...prev]);
            showToast('Handover confirmed! Escrow funds captured.');
          }}
          onResetMonth={handleResetMonth}
          onClose={() => setShowUsageModal(false)}
          onOpenEscrowModal={(booking) => {
            setActiveEscrowBooking(booking);
            setIsEscrowModalOpen(true);
          }}
          onOpenReviewModal={(booking) => {
            setActiveReviewBooking(booking);
            setIsReviewModalOpen(true);
          }}
          onOpenReturnModal={(booking) => {
            setActiveReturnBooking(booking);
            setIsReturnModalOpen(true);
          }}
        />
      )}

      {/* Return Handover & Escrow Sign-Off Modal */}
      {isReturnModalOpen && activeReturnBooking && (
        <ReturnHandoverModal
          isOpen={isReturnModalOpen}
          onClose={() => setIsReturnModalOpen(false)}
          booking={activeReturnBooking}
          currentUserId={currentUser?.id || 'usr_me'}
          onReturnCompleted={(updatedBooking) => {
            setBookings((prev) =>
              prev.map((b) => (b.id === updatedBooking.id ? updatedBooking : b))
            );
            showToast(
              updatedBooking.disputeStatus === 'PENDING_REVIEW'
                ? 'Dispute logged! Escrow security deposit frozen for arbitration.'
                : 'Return verified! Escrow payout captured and deposit released.'
            );
          }}
        />
      )}

      {/* Private Trust Groups Hub Modal */}
      {showTrustGroupHub && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-900 text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400 border border-slate-700">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Trust Groups & Co-Ops</h2>
                  <p className="text-[11px] text-slate-400">
                    Manage private building clusters, makerspaces, and verified sharing circles
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTrustGroupHub(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <TrustGroupHub
                currentUserId={currentUser?.id || 'usr_me'}
                activeSelectedGroupId={selectedTrustGroupId}
                onFilterByGroup={(groupId, groupName) => {
                  setSelectedTrustGroupId(groupId);
                  setSelectedTrustGroupName(groupName || null);
                  setShowTrustGroupHub(false);
                  showToast(
                    groupId
                      ? `Marketplace inventory filtered to "${groupName}"`
                      : 'Showing all public marketplace assets'
                  );
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Escrow Payment Authorization Modal */}
      {isEscrowModalOpen && activeEscrowBooking && (
        <EscrowPaymentModal
          isOpen={isEscrowModalOpen}
          onClose={() => setIsEscrowModalOpen(false)}
          booking={activeEscrowBooking}
          onPaymentAuthorized={(payment) => {
            showToast(`Escrow authorized! Hold ref: ${payment.paymentGatewayRef}`);
            setIsEscrowModalOpen(false);
          }}
        />
      )}

      {/* Two-Way Trust Review Modal */}
      {isReviewModalOpen && activeReviewBooking && (
        <ReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          booking={activeReviewBooking}
          onReviewSubmitted={(review, newTrustScore) => {
            showToast(`Review posted! Host trust score updated to ${newTrustScore}%`);
          }}
        />
      )}

      {/* Architecture & Drizzle Schema Viewer */}
      {showArchitectureModal && (
        <ArchitectureViewer onClose={() => setShowArchitectureModal(false)} />
      )}

      {/* Create Listing Modal with Pre-Signed Media Storage */}
      {showCreateModal && (
        <CreateListingModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateListing}
        />
      )}

      {/* Better Auth Modal (Sign In & Sign Up) */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Executive Admin Intelligence Dashboard (/admin protected by role === 'ADMIN') */}
      {showAdminDashboard && (
        <AdminDashboard
          currentUser={currentUser}
          onClose={() => setShowAdminDashboard(false)}
          onElevateToAdmin={handleElevateToAdmin}
        />
      )}

      {/* Responsive Footer */}
      <Footer />

      {/* Mobile-First Safe-Area Bottom Navigation Bar (md:hidden) */}
      <MobileNav
        activeTab={mobileTab}
        onSelectTab={(tab) => setMobileTab(tab)}
        activeSubscriptionsCount={subscriptions.length}
        pendingHandoverCount={bookings.filter((b) => b.status === 'PENDING_HANDOVER').length}
        currentUser={currentUser}
        onOpenCreateListing={() => setShowCreateModal(true)}
        onOpenTrustGroups={() => setShowTrustGroupHub(true)}
        onOpenSubscriptions={() => setShowUsageModal(true)}
        onOpenAuth={() => setShowAuthModal(true)}
        onOpenAdminDashboard={() => setShowAdminDashboard(true)}
      />
    </div>
  );
}
