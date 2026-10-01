import React, { useState, useRef, useEffect } from 'react';
import { User, ShieldCheck, Shield, LogOut, ChevronDown, LayoutDashboard, Clock, Wrench, FileCode } from 'lucide-react';
import { UserModel, UserRole } from '../../types';
import { cn } from '../../lib/utils';

export interface UserMenuProps {
  user: UserModel | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onOpenAdminDashboard: () => void;
  onOpenActivity: () => void;
  /** Development builds only. */
  onSwitchDemoAccount?: (role: UserRole) => void;
  /** Development builds only. */
  onOpenArchitecture?: () => void;
}

const ROLE_BADGES: Record<UserRole, { label: string; className: string; icon: typeof User }> = {
  ADMIN: { label: 'Admin', className: 'bg-purple-50 text-purple-700 border-purple-200/90', icon: Shield },
  VERIFIED_HOST: { label: 'Verified host', className: 'bg-emerald-50 text-emerald-700 border-emerald-200/90', icon: ShieldCheck },
  USER: { label: 'Member', className: 'bg-slate-100 text-slate-700 border-slate-200', icon: User },
};

export function Avatar({ user, size = 'w-7 h-7' }: { user: Pick<UserModel, 'name' | 'image'>; size?: string }) {
  if (user.image) {
    return (
      <img
        src={user.image}
        alt=""
        referrerPolicy="no-referrer"
        className={cn(size, 'rounded-full object-cover border border-slate-200')}
      />
    );
  }
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span className={cn(size, 'rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center justify-center')}>
      {initials}
    </span>
  );
}

export const UserMenu: React.FC<UserMenuProps> = ({
  user,
  onOpenAuth,
  onSignOut,
  onOpenAdminDashboard,
  onOpenActivity,
  onSwitchDemoAccount,
  onOpenArchitecture,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  if (!user) {
    return (
      <button
        type="button"
        onClick={onOpenAuth}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-all cursor-pointer"
      >
        <User className="w-3.5 h-3.5" />
        <span>Sign in</span>
      </button>
    );
  }

  const badge = ROLE_BADGES[user.role] ?? ROLE_BADGES.USER;
  const BadgeIcon = badge.icon;
  const close = () => setIsOpen(false);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
      >
        <Avatar user={user} />
        <span className="text-xs font-bold text-slate-900 leading-tight hidden sm:inline">{user.name.split(' ')[0]}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="px-4 py-2.5 border-b border-slate-100">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-slate-900 truncate">{user.name}</span>
              <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 shrink-0', badge.className)}>
                <BadgeIcon className="w-3 h-3" />
                {badge.label}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
          </div>

          <div className="p-1 border-b border-slate-100">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                onOpenActivity();
              }}
              className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>My activity</span>
            </button>

            {user.role === 'ADMIN' && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  onOpenAdminDashboard();
                }}
                className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-purple-700 hover:bg-purple-50 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Admin dashboard</span>
              </button>
            )}
          </div>

          {import.meta.env.DEV && (onSwitchDemoAccount || onOpenArchitecture) && (
            <div className="px-3 py-2 border-b border-slate-100 bg-amber-50/60">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Wrench className="w-3 h-3" />
                Developer tools (dev build only)
              </span>
              {onSwitchDemoAccount && (
                <div className="grid grid-cols-3 gap-1 mb-1.5">
                  {(['USER', 'VERIFIED_HOST', 'ADMIN'] as UserRole[]).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        close();
                        onSwitchDemoAccount(role);
                      }}
                      className={cn(
                        'px-1.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors cursor-pointer',
                        user.role === role ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      )}
                    >
                      {ROLE_BADGES[role].label}
                    </button>
                  ))}
                </div>
              )}
              {onOpenArchitecture && (
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onOpenArchitecture();
                  }}
                  className="w-full px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-700 hover:bg-white flex items-center gap-1.5 cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5 text-indigo-600" />
                  Architecture notes
                </button>
              )}
            </div>
          )}

          <div className="p-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                onSignOut();
              }}
              className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
