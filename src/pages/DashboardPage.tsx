import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Repeat,
  PackageCheck,
  DollarSign,
  User,
  History,
  Plus,
  ArrowLeft,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import {
  BookingModel,
  ListingModel,
  MemberActivity,
  TrustGroupModel,
  UserModel,
} from '../types';
import { HostListing, MemberDashboard, api } from '../api/client';
import { cn } from '../lib/utils';
import { OverviewSection } from '../components/dashboard/OverviewSection';
import { RentalCard } from '../components/dashboard/RentalCard';
import { CoopPanel } from '../components/dashboard/CoopPanel';
import { MyListingsSection } from '../components/dashboard/MyListingsSection';
import { EarningsSection } from '../components/dashboard/EarningsSection';
import { ProfileSection } from '../components/dashboard/ProfileSection';
import { HistorySection } from '../components/dashboard/HistorySection';

export type DashboardSection =
  | 'overview'
  | 'rentals'
  | 'memberships'
  | 'listings'
  | 'earnings'
  | 'profile'
  | 'history';

export interface DashboardPageProps {
  currentUser: UserModel;
  initialSection?: DashboardSection;
  onNavigateSection: (section: DashboardSection) => void;
  onBackToHome: () => void;
  activity: MemberActivity;
  refreshActivity: () => Promise<MemberActivity>;
  circles: TrustGroupModel[];
  onOpenCreateListing: () => void;
  onEditListing: (listing: ListingModel) => void;
  onViewListing: (listing: ListingModel) => void;
  onPay: (booking: BookingModel) => void;
  onCheckReturn: (booking: BookingModel) => void;
  onReview: (booking: BookingModel) => void;
  onSignOut: () => void;
  onUserUpdated: (user: UserModel) => void;
  showToast: (msg: string, tone?: 'success' | 'info') => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  currentUser,
  initialSection = 'overview',
  onNavigateSection,
  onBackToHome,
  activity,
  refreshActivity,
  circles,
  onOpenCreateListing,
  onEditListing,
  onViewListing,
  onPay,
  onCheckReturn,
  onReview,
  onSignOut,
  onUserUpdated,
  showToast,
}) => {
  const [section, setSection] = useState<DashboardSection>(initialSection);
  const [dashboardData, setDashboardData] = useState<MemberDashboard | null>(null);
  const [hostListings, setHostListings] = useState<HostListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rentalFilter, setRentalFilter] = useState<'all' | 'active' | 'upcoming' | 'completed'>('all');

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dash, listings] = await Promise.all([
        api.dashboard().catch(() => null),
        api.myListings().catch(() => []),
      ]);
      setDashboardData(dash);
      setHostListings(listings);
    } catch {
      // Handled gracefully with null
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectSection = (next: DashboardSection) => {
    setSection(next);
    onNavigateSection(next);
  };

  const handleConfirmPickup = async (bookingId: string, code: string) => {
    await api.confirmPickup(bookingId, code);
    await refreshActivity();
    await loadData();
    showToast('Pickup confirmed! Enjoy your rental.');
  };

  const handleLogUsage = async (subscriptionId: string, notes: string) => {
    const result = await api.logUsage(subscriptionId, notes);
    await refreshActivity();
    await loadData();
    const left = result.subscription.remainingUses;
    showToast(`Turn logged! You have ${left} ${left === 1 ? 'turn' : 'turns'} remaining.`);
  };

  // Filter renter bookings
  const renterBookings = activity.bookings.filter((b) => b.viewerRole === 'renter');
  const filteredRentals = renterBookings.filter((b) => {
    if (rentalFilter === 'active') return b.status === 'ACTIVE' || b.status === 'PENDING_HANDOVER';
    if (rentalFilter === 'upcoming') return b.status === 'PENDING_PAYMENT';
    if (rentalFilter === 'completed') return b.status === 'COMPLETED' || b.status === 'CANCELLED';
    return true;
  });

  const pendingPickups = activity.bookings.filter((b) => b.status === 'PENDING_HANDOVER').length;
  const pendingPayments = activity.bookings.filter((b) => b.status === 'PENDING_PAYMENT').length;

  const navItems: Array<{ id: DashboardSection; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      id: 'rentals',
      label: 'My Rentals',
      icon: <CalendarDays className="w-4 h-4" />,
      badge: pendingPickups + pendingPayments > 0 ? pendingPickups + pendingPayments : undefined,
    },
    {
      id: 'memberships',
      label: 'Co-op Memberships',
      icon: <Repeat className="w-4 h-4" />,
      badge: activity.subscriptions.length > 0 ? activity.subscriptions.length : undefined,
    },
    {
      id: 'listings',
      label: 'My Listings & Gear',
      icon: <PackageCheck className="w-4 h-4" />,
      badge: hostListings.length > 0 ? hostListings.length : undefined,
    },
    { id: 'earnings', label: 'Earnings & Payouts', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'profile', label: 'Profile & Settings', icon: <User className="w-4 h-4" /> },
    { id: 'history', label: 'Activity Log', icon: <History className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
      {/* Top Breadcrumb & User Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToHome}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            title="Back to marketplace"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Member Dashboard</h1>
              {currentUser.role === 'VERIFIED_HOST' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" /> Verified Host
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {currentUser.neighborhood ? `${currentUser.neighborhood} · ` : ''}Member since {new Date(currentUser.createdAt).getFullYear()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenCreateListing}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Share an item</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Sidebar + Active Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Desktop Sidebar / Mobile Tabs */}
        <div className="lg:col-span-3">
          {/* Mobile Horizontal Tabs */}
          <div className="flex lg:hidden overflow-x-auto gap-1.5 pb-3 -mx-4 px-4 sm:mx-0 sm:px-0">
            {navItems.map((item) => {
              const isActive = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectSection(item.id)}
                  className={cn(
                    'px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer border',
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={cn(
                        'px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Desktop Sticky Vertical Navigation */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3 space-y-1 sticky top-24">
            <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Navigation
            </div>
            {navItems.map((item) => {
              const isActive = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectSection(item.id)}
                  className={cn(
                    'w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer',
                    isActive
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={cn(isActive ? 'text-amber-400' : 'text-slate-400')}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold',
                        isActive ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section Content View */}
        <div className="lg:col-span-9 min-h-[500px]">
          {section === 'overview' && (
            <OverviewSection
              currentUser={currentUser}
              dashboardData={dashboardData}
              bookings={activity.bookings}
              onNavigateSection={handleSelectSection}
              onPay={onPay}
              onCheckReturn={onCheckReturn}
              onReview={onReview}
              onCreateListing={onOpenCreateListing}
            />
          )}

          {section === 'rentals' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Items I've Booked</h2>
                  <p className="text-xs text-slate-500">Track pickups, rental dates and return handovers</p>
                </div>

                {/* Status Filter */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs">
                  {(
                    [
                      ['all', 'All'],
                      ['active', 'Active & Pickup'],
                      ['upcoming', 'Awaiting payment'],
                      ['completed', 'Past'],
                    ] as const
                  ).map(([f, label]) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setRentalFilter(f)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer',
                        rentalFilter === f
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredRentals.length === 0 ? (
                <div className="text-center py-16 px-4 bg-white rounded-3xl border border-slate-200/90 shadow-2xs space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <CalendarDays className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">No rentals found</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Borrow tools, kit, and equipment from neighbours instead of buying new.
                  </p>
                  <button
                    type="button"
                    onClick={onBackToHome}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer transition-colors shadow-xs"
                  >
                    Browse marketplace
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRentals.map((b) => (
                    <RentalCard
                      key={b.id}
                      booking={b}
                      onConfirmPickup={handleConfirmPickup}
                      onPay={onPay}
                      onCheckReturn={onCheckReturn}
                      onReview={onReview}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {section === 'memberships' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Co-op Subscriptions</h2>
                <p className="text-xs text-slate-500">Shared appliances in your building, street or makerspace</p>
              </div>
              <CoopPanel
                subscriptions={activity.subscriptions}
                usageLogs={activity.usageLogs}
                onLogUsage={handleLogUsage}
                onBrowse={onBackToHome}
              />
            </div>
          )}

          {section === 'listings' && (
            <MyListingsSection
              hostListings={hostListings}
              bookings={activity.bookings}
              onRefresh={loadData}
              onEdit={onEditListing}
              onView={onViewListing}
              onCreateNew={onOpenCreateListing}
              onConfirmPickup={handleConfirmPickup}
              onPay={onPay}
              onCheckReturn={onCheckReturn}
              onReview={onReview}
              showToast={showToast}
            />
          )}

          {section === 'earnings' && (
            <EarningsSection dashboardData={dashboardData} onBrowseListings={onBackToHome} />
          )}

          {section === 'profile' && (
            <ProfileSection
              currentUser={currentUser}
              onUserUpdated={onUserUpdated}
              onSignOut={onSignOut}
              showToast={showToast}
            />
          )}

          {section === 'history' && <HistorySection history={activity.history} />}
        </div>
      </div>
    </div>
  );
};
