import React, { useState } from 'react';
import { X, Lock, Mail, User, MapPin, Zap, AlertCircle, ArrowRight, Wrench } from 'lucide-react';
import { AuthSession, UserRole } from '../../types';
import { api } from '../../api/client';
import { cn } from '../../lib/utils';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (session: AuthSession) => void;
  defaultMode?: 'signin' | 'signup';
}

const inputClass =
  'w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-100 outline-none';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess, defaultMode = 'signin' }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(defaultMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const finish = (session: AuthSession) => {
    onAuthSuccess(session);
    setPassword('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { user } =
        mode === 'signup' ? await api.signUp({ name, email, password, neighborhood }) : await api.signIn({ email, password });
      finish({ user });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemo = async (role: UserRole) => {
    try {
      const { user } = await api.signInDemo(role);
      finish({ user });
    } catch (err: any) {
      setErrorMsg(err?.message || 'That demo account is not available.');
    }
  };

  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next);
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 id="auth-title" className="text-base font-bold text-slate-900 tracking-tight">
                {mode === 'signin' ? 'Welcome back' : 'Join your neighbours'}
              </h2>
              <p className="text-xs text-slate-500">Borrow, share and save with people nearby</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-slate-100 bg-slate-50 p-1.5">
          {(['signin', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={cn(
                'flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center',
                mode === m ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              )}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {mode === 'signup' && (
            <label className="block">
              <span className="text-xs font-semibold text-slate-700 block mb-1">Your name</span>
              <span className="relative block">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Thandi Nkosi" className={inputClass} />
              </span>
            </label>
          )}

          <label className="block">
            <span className="text-xs font-semibold text-slate-700 block mb-1">Email</span>
            <span className="relative block">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-700 block mb-1">Password</span>
            <span className="relative block">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                minLength={mode === 'signup' ? 8 : undefined}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                className={inputClass}
              />
            </span>
          </label>

          {mode === 'signup' && (
            <label className="block">
              <span className="text-xs font-semibold text-slate-700 block mb-1">
                Neighbourhood <span className="font-normal text-slate-400">(optional)</span>
              </span>
              <span className="relative block">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" autoComplete="address-level3" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Observatory" className={inputClass} />
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-slate-900 hover:bg-slate-800 shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>{mode === 'signin' ? 'Sign in' : 'Create my account'}</span>
                <ArrowRight className="w-4 h-4 text-slate-300" />
              </>
            )}
          </button>

          <p className="text-center text-xs text-slate-500">
            {mode === 'signin' ? 'New to ShareHub? ' : 'Already have an account? '}
            <button
              type="button"
              onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
              className="font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              {mode === 'signin' ? 'Create an account' : 'Sign in'}
            </button>
          </p>

          {import.meta.env.DEV && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                <Wrench className="w-3 h-3" />
                Demo accounts (dev build only)
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['USER', 'Member'],
                    ['VERIFIED_HOST', 'Host'],
                    ['ADMIN', 'Admin'],
                  ] as [UserRole, string][]
                ).map(([role, label]) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleDemo(role)}
                    className="px-2 py-1.5 rounded-lg bg-white hover:bg-amber-100 text-amber-950 text-[11px] font-bold border border-amber-200 transition-colors cursor-pointer"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
