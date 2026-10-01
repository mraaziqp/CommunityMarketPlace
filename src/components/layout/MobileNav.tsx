import React from 'react';
import { Compass, Users, Clock, MessageCircle, PlusCircle } from 'lucide-react';
import { UserModel } from '../../types';
import { getAwehChatPortalUrl } from '../../lib/awehchat';
import { cn } from '../../lib/utils';

export type MobileTab = 'explore' | 'circles' | 'activity' | 'messages' | 'share';

export interface MobileNavProps {
  activeTab?: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  activityCount: number;
  currentUser: UserModel | null;
  onOpenCreateListing: () => void;
  onOpenCircles: () => void;
  onOpenActivity: () => void;
}

/**
 * Bottom tab bar for phones (hidden from md up). Account options, including
 * the admin link for admins, live in the user menu in the top bar.
 */
export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab = 'explore',
  onSelectTab,
  activityCount,
  currentUser,
  onOpenCreateListing,
  onOpenCircles,
  onOpenActivity,
}) => {
  const tabClass = (tab: MobileTab, activeColor: string) =>
    cn(
      'flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer select-none',
      activeTab === tab ? `${activeColor} font-bold` : 'text-slate-500 hover:text-slate-800'
    );

  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Main"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg px-2 pt-2 pb-[env(safe-area-inset-bottom,0.75rem)] transition-all"
    >
      <div className="grid grid-cols-5 items-center max-w-md mx-auto">
        <button
          id="mobile-nav-explore-btn"
          type="button"
          onClick={() => {
            onSelectTab('explore');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={tabClass('explore', 'text-indigo-600')}
        >
          <Compass className={cn('w-5 h-5 transition-transform', activeTab === 'explore' && 'scale-110')} />
          <span className="text-[10px] mt-1 tracking-tight">Explore</span>
        </button>

        <button
          id="mobile-nav-circles-btn"
          type="button"
          onClick={() => {
            onSelectTab('circles');
            onOpenCircles();
          }}
          className={tabClass('circles', 'text-emerald-700')}
        >
          <Users className={cn('w-5 h-5 transition-transform', activeTab === 'circles' && 'scale-110')} />
          <span className="text-[10px] mt-1 tracking-tight">Circles</span>
        </button>

        <button
          id="mobile-nav-share-btn"
          type="button"
          onClick={() => {
            onSelectTab('share');
            onOpenCreateListing();
          }}
          className={tabClass('share', 'text-slate-900')}
        >
          <PlusCircle className={cn('w-6 h-6 transition-transform', activeTab === 'share' && 'scale-110')} />
          <span className="text-[10px] mt-0.5 tracking-tight">Share</span>
        </button>

        <button
          id="mobile-nav-activity-btn"
          type="button"
          onClick={() => {
            onSelectTab('activity');
            onOpenActivity();
          }}
          className={tabClass('activity', 'text-amber-600')}
        >
          <div className="relative">
            <Clock className={cn('w-5 h-5 transition-transform', activeTab === 'activity' && 'scale-110')} />
            {currentUser && activityCount > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1 min-w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                {activityCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Activity</span>
        </button>

        <a
          id="mobile-nav-messages-btn"
          href={getAwehChatPortalUrl()}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onSelectTab('messages')}
          className="flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer select-none text-slate-500 hover:text-emerald-700"
        >
          <MessageCircle className="w-5 h-5 text-emerald-600" />
          <span className="text-[10px] mt-1 tracking-tight">Messages</span>
        </a>
      </div>
    </nav>
  );
};

export default MobileNav;
