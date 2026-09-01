import React from 'react';
import {
  Sparkles,
  Search,
  Zap,
  FileCode,
  Shield,
  PlusCircle,
  Clock,
  Compass,
  LayoutDashboard,
  MessageCircle,
  ExternalLink,
  Users,
  Lock,
} from 'lucide-react';
import { UserModel, UserRole } from '../../types';
import { UserMenu } from '../auth/UserMenu';
import { getAwehChatPortalUrl } from '../../lib/awehchat';
import { cn } from '../../lib/utils';

export interface NavbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeSubscriptionsCount: number;
  onOpenSubscriptions: () => void;
  onOpenArchitecture: () => void;
  onOpenCreateListing: () => void;
  onOpenTrustGroups?: () => void;
  currentUser: UserModel | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onSwitchRole: (newRole: UserRole) => void;
  onOpenAdminDashboard: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  activeSubscriptionsCount,
  onOpenSubscriptions,
  onOpenArchitecture,
  onOpenCreateListing,
  onOpenTrustGroups,
  onOpenChat,
  unreadMessagesCount = 1,
  currentUser,
  onOpenAuth,
  onSignOut,
  onSwitchRole,
  onOpenAdminDashboard,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 transition-all pt-[env(safe-area-inset-top,0rem)]">
      {/* Top Brand & Utility Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3 sm:gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <Zap className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-lg tracking-tight">
                  Share<span className="text-indigo-600">Hub</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  Discovery Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block font-medium">
                Geospatial P2P Marketplace & Co-Ops
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="main-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search car parts, power tools, washer co-ops, studios..."
                className="w-full pl-9.5 pr-4 py-2 text-xs sm:text-sm bg-slate-100/80 hover:bg-slate-100 focus:bg-white rounded-full border border-slate-200/90 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all placeholder:text-slate-400 text-slate-900"
              />
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Executive Admin Link if role is ADMIN */}
            {currentUser?.role === 'ADMIN' && (
              <button
                id="admin-dashboard-btn"
                type="button"
                onClick={onOpenAdminDashboard}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-xs transition-all cursor-pointer animate-in fade-in"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-purple-200" />
                <span className="hidden sm:inline">Executive Admin</span>
                <span className="text-[9px] bg-purple-900/80 px-1 py-0.2 rounded font-mono">
                  /admin
                </span>
              </button>
            )}

            {/* View Architecture & Schema Trigger */}
            <button
              id="view-architecture-btn"
              type="button"
              onClick={onOpenArchitecture}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100/90 hover:bg-slate-200/80 rounded-xl border border-slate-200/80 transition-colors cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden lg:inline">Design & Schema</span>
            </button>

            {/* Trust Groups Hub Trigger */}
            {onOpenTrustGroups && (
              <button
                id="open-trust-groups-nav-btn"
                type="button"
                onClick={onOpenTrustGroups}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 shadow-2xs transition-colors cursor-pointer"
                title="Private Trust Groups & Co-Ops"
              >
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Trust Groups</span>
              </button>
            )}

            {/* AwehChat External Messaging Portal Link */}
            <a
              id="open-awehchat-nav-btn"
              href={getAwehChatPortalUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-300 shadow-2xs transition-all hover:shadow-xs cursor-pointer"
              title="Open AwehChat P2P Communication Portal"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-700 fill-emerald-100" />
              <span className="hidden md:inline">AwehChat</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <ExternalLink className="w-3 h-3 text-emerald-600 hidden lg:inline" />
            </a>

            {/* Active Quota / Subscriptions Pill */}
            <button
              id="view-my-quotas-btn"
              type="button"
              onClick={onOpenSubscriptions}
              className="relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">My Quotas</span>
              {activeSubscriptionsCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {activeSubscriptionsCount}
                </span>
              )}
            </button>

            {/* List an Asset Button */}
            <button
              id="create-listing-btn"
              type="button"
              onClick={onOpenCreateListing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-slate-300" />
              <span className="hidden sm:inline">Host an Asset</span>
            </button>

            {/* Better Auth User Menu & Role Session Header */}
            <div className="pl-1 sm:pl-2 border-l border-slate-200">
              <UserMenu
                user={currentUser}
                onOpenAuth={onOpenAuth}
                onSignOut={onSignOut}
                onSwitchRole={onSwitchRole}
                onOpenAdminDashboard={onOpenAdminDashboard}
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
