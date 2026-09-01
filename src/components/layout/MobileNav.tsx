import React from 'react';
import {
  Compass,
  Users,
  Zap,
  MessageCircle,
  User,
  PlusCircle,
  Clock,
  LayoutDashboard,
  Shield,
  Layers,
} from 'lucide-react';
import { UserModel, UserRole } from '../../types';
import { getAwehChatPortalUrl } from '../../lib/awehchat';
import { cn } from '../../lib/utils';

export interface MobileNavProps {
  activeTab?: 'explore' | 'circles' | 'activity' | 'messages' | 'profile';
  onSelectTab: (tab: 'explore' | 'circles' | 'activity' | 'messages' | 'profile') => void;
  activeSubscriptionsCount: number;
  pendingHandoverCount?: number;
  currentUser: UserModel | null;
  onOpenCreateListing: () => void;
  onOpenTrustGroups: () => void;
  onOpenSubscriptions: () => void;
  onOpenAuth: () => void;
  onOpenAdminDashboard: () => void;
}

/**
 * ============================================================================
 * SHAREHUB MOBILE-FIRST BOTTOM NAVIGATION BAR (MobileNav.tsx)
 * 
 * Features:
 * - Hidden on medium+ screens (md:hidden) for full desktop-first precision.
 * - Dynamic Safe-Area Inset: `pb-[env(safe-area-inset-bottom,0.75rem)]` prevents
 *   clipping by iOS Home Indicator bars and Android Navigation gesture pills.
 * - 5 Primary Micro-App Entry Points:
 *   1. 🔍 Explore (Discovery Engine & Feed)
 *   2. 👥 Circles (Private Trust Groups & Co-Ops)
 *   3. ⚡ Activity (Fractional Quotas & Handover Bookings)
 *   4. 💬 Messages (AwehChat Direct Link)
 *   5. 👤 Profile / Host Command Center
 * ============================================================================
 */

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab = 'explore',
  onSelectTab,
  activeSubscriptionsCount,
  pendingHandoverCount = 0,
  currentUser,
  onOpenCreateListing,
  onOpenTrustGroups,
  onOpenSubscriptions,
  onOpenAuth,
  onOpenAdminDashboard,
}) => {
  const awehChatUrl = getAwehChatPortalUrl();
  const totalActivityBadge = activeSubscriptionsCount + pendingHandoverCount;

  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg px-2 pt-2 pb-[env(safe-area-inset-bottom,0.75rem)] transition-all"
    >
      <div className="grid grid-cols-5 items-center justify-around max-w-md mx-auto">
        {/* 1. EXPLORE */}
        <button
          id="mobile-nav-explore-btn"
          type="button"
          onClick={() => {
            onSelectTab('explore');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={cn(
            'flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer select-none',
            activeTab === 'explore'
              ? 'text-indigo-600 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          )}
        >
          <div className="relative">
            <Compass className={cn('w-5 h-5 transition-transform', activeTab === 'explore' && 'scale-110')} />
            {activeTab === 'explore' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-600" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Explore</span>
        </button>

        {/* 2. CIRCLES (Trust Groups) */}
        <button
          id="mobile-nav-circles-btn"
          type="button"
          onClick={() => {
            onSelectTab('circles');
            onOpenTrustGroups();
          }}
          className={cn(
            'flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer select-none',
            activeTab === 'circles'
              ? 'text-emerald-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          )}
        >
          <div className="relative">
            <Users className={cn('w-5 h-5 transition-transform', activeTab === 'circles' && 'scale-110')} />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Circles</span>
        </button>

        {/* 3. ACTIVITY (Fractional Quotas & Bookings) */}
        <button
          id="mobile-nav-activity-btn"
          type="button"
          onClick={() => {
            onSelectTab('activity');
            onOpenSubscriptions();
          }}
          className={cn(
            'flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer select-none',
            activeTab === 'activity'
              ? 'text-amber-600 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          )}
        >
          <div className="relative">
            <Zap className={cn('w-5 h-5 transition-transform', activeTab === 'activity' && 'scale-110')} />
            {totalActivityBadge > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 min-w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                {totalActivityBadge}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Activity</span>
        </button>

        {/* 4. MESSAGES (AwehChat Portal Link) */}
        <a
          id="mobile-nav-messages-btn"
          href={awehChatUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onSelectTab('messages')}
          className={cn(
            'flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer select-none text-slate-500 hover:text-emerald-700'
          )}
        >
          <div className="relative">
            <MessageCircle className="w-5 h-5 text-emerald-600" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse ring-2 ring-white" />
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Messages</span>
        </a>

        {/* 5. PROFILE / HOST COMMAND */}
        <button
          id="mobile-nav-profile-btn"
          type="button"
          onClick={() => {
            onSelectTab('profile');
            if (currentUser) {
              if (currentUser.role === 'ADMIN') {
                onOpenAdminDashboard();
              } else {
                onOpenCreateListing();
              }
            } else {
              onOpenAuth();
            }
          }}
          className={cn(
            'flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer select-none',
            activeTab === 'profile'
              ? 'text-slate-900 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          )}
        >
          <div className="relative">
            {currentUser?.image ? (
              <img
                src={currentUser.image}
                alt={currentUser.name}
                className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-300"
              />
            ) : currentUser?.role === 'ADMIN' ? (
              <LayoutDashboard className="w-5 h-5 text-purple-600" />
            ) : (
              <User className="w-5 h-5" />
            )}
            {currentUser?.role === 'ADMIN' && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-600 ring-2 ring-white" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight truncate max-w-14">
            {currentUser ? (currentUser.role === 'ADMIN' ? 'Admin' : 'Host') : 'Sign In'}
          </span>
        </button>
      </div>
    </nav>
  );
};

export default MobileNav;
