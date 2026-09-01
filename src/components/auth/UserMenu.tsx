import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  ShieldCheck,
  Shield,
  LogOut,
  ChevronDown,
  LayoutDashboard,
  Sparkles,
  Sliders,
  Check,
} from 'lucide-react';
import { UserModel, UserRole } from '../../types';
import { DEMO_ACCOUNTS } from '../../../actions/auth';
import { cn } from '../../lib/utils';

export interface UserMenuProps {
  user: UserModel | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onSwitchRole: (newRole: UserRole) => void;
  onOpenAdminDashboard: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({
  user,
  onOpenAuth,
  onSignOut,
  onSwitchRole,
  onOpenAdminDashboard,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenAuth}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <User className="w-3.5 h-3.5" />
          <span>Sign In</span>
        </button>
      </div>
    );
  }

  const roleConfig = {
    ADMIN: {
      label: 'Admin',
      badgeBg: 'bg-purple-50 text-purple-700 border-purple-200/90',
      icon: Shield,
      iconColor: 'text-purple-600',
    },
    VERIFIED_HOST: {
      label: 'Verified Host',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200/90',
      icon: ShieldCheck,
      iconColor: 'text-emerald-600',
    },
    USER: {
      label: 'Member',
      badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: User,
      iconColor: 'text-slate-600',
    },
  }[user.role] || {
    label: 'Member',
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: User,
    iconColor: 'text-slate-600',
  };

  const RoleIcon = roleConfig.icon;

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
      >
        <div className="relative">
          <img
            src={
              user.image ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
            }
            alt={user.name}
            referrerPolicy="no-referrer"
            className="w-7 h-7 rounded-full object-cover border border-slate-200"
          />
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
        </div>

        <div className="flex flex-col text-left hidden sm:flex">
          <span className="text-xs font-bold text-slate-900 leading-tight">
            {user.name.split(' ')[0]}
          </span>
          <span className="text-[10px] text-slate-500 font-medium leading-tight">
            {roleConfig.label}
          </span>
        </div>

        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* User Profile Summary */}
          <div className="px-4 py-2.5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-900">{user.name}</span>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1',
                  roleConfig.badgeBg
                )}
              >
                <RoleIcon className={cn('w-3 h-3', roleConfig.iconColor)} />
                {roleConfig.label}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
            {user.neighborhood && (
              <p className="text-[10px] text-slate-400 mt-0.5">📍 {user.neighborhood}</p>
            )}
          </div>

          {/* Executive Admin Link (Prominent for Admins) */}
          {user.role === 'ADMIN' && (
            <div className="p-2 border-b border-slate-100 bg-purple-50/50">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenAdminDashboard();
                }}
                className="w-full px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-between transition-colors shadow-xs cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 text-purple-200" />
                  <span>Executive Admin Center</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-500 text-white font-mono">
                  /admin
                </span>
              </button>
            </div>
          )}

          {/* Quick Role Switcher for Developer Testing */}
          <div className="px-3 py-2 border-b border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              Switch Active Role:
            </span>
            <div className="space-y-1">
              {(['ADMIN', 'VERIFIED_HOST', 'USER'] as UserRole[]).map((r) => {
                const isCurrent = user.role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      onSwitchRole(r);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer',
                      isCurrent
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    )}
                  >
                    <span>
                      {r === 'ADMIN' && '👑 Admin (Full Access)'}
                      {r === 'VERIFIED_HOST' && '🛡️ Verified Host'}
                      {r === 'USER' && '👤 Community Member'}
                    </span>
                    {isCurrent && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sign Out Trigger */}
          <div className="p-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onSignOut();
              }}
              className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
