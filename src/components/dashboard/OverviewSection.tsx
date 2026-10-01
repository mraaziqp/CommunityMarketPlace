import React from 'react';
import {
  CalendarDays,
  Repeat,
  DollarSign,
  PackageCheck,
  Star,
  CheckCircle2,
  Clock,
  ArrowRight,
  KeyRound,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { MemberDashboard } from '../../api/client';
import { BookingModel, UserModel } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';

export interface OverviewSectionProps {
  currentUser: UserModel;
  dashboardData: MemberDashboard | null;
  bookings: BookingModel[];
  onNavigateSection: (section: 'rentals' | 'memberships' | 'listings' | 'earnings' | 'profile' | 'history') => void;
  onPay: (b: BookingModel) => void;
  onCheckReturn: (b: BookingModel) => void;
  onReview: (b: BookingModel) => void;
  onCreateListing: () => void;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  currentUser,
  dashboardData,
  bookings,
  onNavigateSection,
  onPay,
  onCheckReturn,
  onReview,
  onCreateListing,
}) => {
  const stats = dashboardData?.stats;

  // Derive Actionable To-Do Items
  const todos: Array<{
    id: string;
    title: string;
    description: string;
    actionLabel: string;
    actionIcon: React.ReactNode;
    tone: 'urgent' | 'action' | 'review';
    onClick: () => void;
  }> = [];

  bookings.forEach((b) => {
    const isRenter = b.viewerRole === 'renter';
    const isHost = b.viewerRole === 'host';
    const hostFirst = (b.hostName ?? 'Host').split(' ')[0];
    const renterFirst = b.renterName.split(' ')[0];

    if (isRenter && b.status === 'PENDING_PAYMENT') {
      todos.push({
        id: `pay-${b.id}`,
        title: `Pay for ${b.listingTitle}`,
        description: `Hold your booking dates (${formatCurrency(b.totalAmountInCents)}). Payment held in escrow.`,
        actionLabel: 'Pay now',
        actionIcon: <DollarSign className="w-3.5 h-3.5" />,
        tone: 'urgent',
        onClick: () => onPay(b),
      });
    } else if (isRenter && b.status === 'PENDING_HANDOVER') {
      todos.push({
        id: `collect-${b.id}`,
        title: `Collect ${b.listingTitle}`,
        description: `Enter the pickup code from ${hostFirst} when you collect the item.`,
        actionLabel: 'Enter code',
        actionIcon: <KeyRound className="w-3.5 h-3.5" />,
        tone: 'action',
        onClick: () => onNavigateSection('rentals'),
      });
    } else if (isHost && b.status === 'PENDING_HANDOVER') {
      todos.push({
        id: `code-${b.id}`,
        title: `Hand over ${b.listingTitle} to ${renterFirst}`,
        description: `Give pickup verification code: ${b.verificationCode}`,
        actionLabel: 'View details',
        actionIcon: <CheckCircle2 className="w-3.5 h-3.5" />,
        tone: 'action',
        onClick: () => onNavigateSection('listings'),
      });
    } else if (isHost && b.status === 'ACTIVE') {
      todos.push({
        id: `return-${b.id}`,
        title: `Check ${b.listingTitle} back in`,
        description: `${renterFirst} has completed their booking. Inspect and check it in to release your payout.`,
        actionLabel: 'Check in',
        actionIcon: <CheckCircle2 className="w-3.5 h-3.5" />,
        tone: 'action',
        onClick: () => onCheckReturn(b),
      });
    } else if (isRenter && b.status === 'COMPLETED' && !b.hasReview) {
      todos.push({
        id: `review-${b.id}`,
        title: `Review your rental of ${b.listingTitle}`,
        description: `Help neighbours know what to expect from ${hostFirst}.`,
        actionLabel: 'Leave review',
        actionIcon: <Star className="w-3.5 h-3.5" />,
        tone: 'review',
        onClick: () => onReview(b),
      });
    }
  });

  return (
    <div className="space-y-7">
      {/* Welcome Banner */}
      <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-md relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative z-10 space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-emerald-300 text-[11px] font-bold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Welcome back, {currentUser.name.split(' ')[0]}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">Your Neighbourhood Hub</h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Borrow what you need, share what you own, and earn securely with escrow protection.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onCreateListing}
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-colors"
          >
            <span>+ Share an item</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection('rentals')}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer backdrop-blur-md transition-colors"
          >
            <span>My Rentals</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Subtle decorative circles */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-10 -top-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Actionable To-Do List */}
      {todos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Needs Your Attention ({todos.length})</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {todos.map((todo) => (
              <div
                key={todo.id}
                className={cn(
                  'p-4 rounded-2xl border transition-all duration-200 flex items-start justify-between gap-3 shadow-2xs',
                  todo.tone === 'urgent'
                    ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                    : todo.tone === 'review'
                    ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                    : 'bg-indigo-50/70 border-indigo-200 text-indigo-950'
                )}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <h4 className="font-bold text-xs sm:text-sm leading-snug">{todo.title}</h4>
                  <p className="text-[11px] opacity-80 leading-relaxed line-clamp-2">{todo.description}</p>
                </div>
                <button
                  type="button"
                  onClick={todo.onClick}
                  className={cn(
                    'px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs transition-colors',
                    todo.tone === 'urgent'
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : todo.tone === 'review'
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  )}
                >
                  {todo.actionIcon}
                  <span>{todo.actionLabel}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Upcoming Rentals */}
        <div
          onClick={() => onNavigateSection('rentals')}
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-md cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Booked items</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {stats?.upcomingRentals ?? 0}
          </div>
          <span className="text-[10px] text-slate-500 block font-medium">Active & upcoming</span>
        </div>

        {/* Co-op Memberships */}
        <div
          onClick={() => onNavigateSection('memberships')}
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-md cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Co-ops</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-amber-50 text-amber-700">
              <Repeat className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {stats?.activeMemberships ?? 0}
          </div>
          <span className="text-[10px] text-slate-500 block font-medium">Shared appliances</span>
        </div>

        {/* My Live Listings */}
        <div
          onClick={() => onNavigateSection('listings')}
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-md cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">My Listings</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {stats?.activeListings ?? 0}{' '}
            <span className="text-xs font-normal text-slate-400">/ {stats?.listings ?? 0}</span>
          </div>
          <span className="text-[10px] text-slate-500 block font-medium">Live on marketplace</span>
        </div>

        {/* Earnings */}
        <div
          onClick={() => onNavigateSection('earnings')}
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-md cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Earned</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-purple-50 text-purple-700">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">
            {formatCurrency((stats?.earningsDueCents ?? 0) + (stats?.earningsPaidCents ?? 0))}
          </div>
          <span className="text-[10px] text-slate-500 block font-medium">
            {stats?.earningsDueCents ? `${formatCurrency(stats.earningsDueCents)} due` : 'All settled'}
          </span>
        </div>
      </div>
    </div>
  );
};
