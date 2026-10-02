import React from 'react';
import { Search, Zap, PlusCircle, Clock, LayoutDashboard, MessageCircle, Users } from 'lucide-react';
import { UserModel, UserRole } from '../../types';
import { UserMenu } from '../auth/UserMenu';
import { getAwehChatPortalUrl } from '../../lib/awehchat';

export interface NavbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activityCount: number;
  onOpenActivity: () => void;
  onOpenCreateListing: () => void;
  onOpenCircles: () => void;
  currentUser: UserModel | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onOpenAdminDashboard: () => void;
  onNavigateHome?: () => void;
  onNavigateDashboard?: (section?: string) => void;
  /** Development builds only. */
  onSwitchDemoAccount?: (role: UserRole) => void;
  /** Development builds only. */
  onOpenArchitecture?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  activityCount,
  onOpenActivity,
  onOpenCreateListing,
  onOpenCircles,
  currentUser,
  onOpenAuth,
  onSignOut,
  onOpenAdminDashboard,
  onNavigateHome,
  onNavigateDashboard,
  onSwitchDemoAccount,
  onOpenArchitecture,
}) => {
  const isAdmin = currentUser?.role === 'ADMIN';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 transition-all pt-[env(safe-area-inset-top,0rem)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3 sm:gap-4">
          {/* Logo */}
          <button
            type="button"
            onClick={onNavigateHome ? onNavigateHome : undefined}
            className="flex items-center gap-2.5 sm:gap-3 shrink-0 cursor-pointer text-left"
            aria-label="ShareHub home"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <Zap className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-lg tracking-tight">
                Share<span className="text-indigo-600">Hub</span>
              </span>
              <p className="text-[11px] text-slate-500 hidden sm:block font-medium">
                Borrow more, buy less
              </p>
            </div>
          </button>

          {/* Search */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="main-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search drills, washers, studios, roof boxes…"
                aria-label="Search listings"
                className="w-full pl-9.5 pr-4 py-2 text-xs sm:text-sm bg-slate-100/80 hover:bg-slate-100 focus:bg-white rounded-full border border-slate-200/90 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all placeholder:text-slate-400 text-slate-900"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Only rendered for admins; everyone else never receives this button. */}
            {isAdmin && (
              <button
                id="admin-dashboard-btn"
                type="button"
                onClick={onOpenAdminDashboard}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-purple-200" />
                <span>Admin</span>
              </button>
            )}

            <button
              id="open-circles-nav-btn"
              type="button"
              onClick={onOpenCircles}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 shadow-2xs transition-colors cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              <span>Circles</span>
            </button>

            <a
              id="open-awehchat-nav-btn"
              href={getAwehChatPortalUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-2xs transition-colors cursor-pointer"
              title="Opens AwehChat in a new tab"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Messages</span>
            </a>

            {currentUser && (
              <button
                id="view-activity-btn"
                type="button"
                onClick={onOpenActivity}
                className="hidden md:inline-flex relative items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-2xs transition-colors cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>My activity</span>
                {activityCount > 0 && (
                  <span className="min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">
                    {activityCount}
                  </span>
                )}
              </button>
            )}

            <button
              id="create-listing-btn"
              type="button"
              onClick={onOpenCreateListing}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-slate-300" />
              <span>Share an item</span>
            </button>

            <div className="pl-1 sm:pl-2 border-l border-slate-200">
              <UserMenu
                user={currentUser}
                onOpenAuth={onOpenAuth}
                onSignOut={onSignOut}
                onOpenAdminDashboard={onOpenAdminDashboard}
                onOpenActivity={onOpenActivity}
                onNavigateDashboard={onNavigateDashboard}
                onSwitchDemoAccount={onSwitchDemoAccount}
                onOpenArchitecture={onOpenArchitecture}
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
