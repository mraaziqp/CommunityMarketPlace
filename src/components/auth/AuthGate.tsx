import React, { useState } from 'react';
import {
  Zap,
  Lock,
  Mail,
  User,
  MapPin,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Wrench,
  Users,
  Repeat,
  HeartHandshake,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthSession, UserRole } from '../../types';
import { api } from '../../api/client';
import { cn } from '../../lib/utils';

export interface AuthGateProps {
  onAuthSuccess: (session: AuthSession) => void;
}

const inputClass =
  'w-full pl-9 pr-3.5 py-3 text-sm bg-slate-50/90 rounded-xl border border-slate-200 focus:bg-white focus:border-slate-500 focus:ring-2 focus:ring-slate-100 outline-none transition-all';

export const AuthGate: React.FC<AuthGateProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { user } =
        mode === 'signup'
          ? await api.signUp({ name, email, password, neighborhood: neighborhood || undefined })
          : await api.signIn({ email, password });
      onAuthSuccess({ user });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Something went wrong. Please check your details and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemo = async (role: UserRole) => {
    try {
      const { user } = await api.signInDemo(role);
      onAuthSuccess({ user });
    } catch (err: any) {
      setErrorMsg(err?.message || 'That demo account is not available.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white flex flex-col justify-between selection:bg-emerald-500/30 selection:text-emerald-200 relative overflow-hidden">
      {/* Background glowing orbs */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Brand */}
      <header className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg shadow-emerald-500/20">
            S
          </div>
          <div>
            <span className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
              ShareHub
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </span>
            <span className="text-[10px] font-semibold text-slate-400 block tracking-wider uppercase">
              Community Marketplace
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-300 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>PayFast Escrow Protected</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16">
        {/* Left Hero & Value Proposition */}
        <div className="max-w-xl space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Join your neighbourhood sharing economy</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            Borrow what you need. <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-300 bg-clip-text text-transparent">
              Share what you own.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-lg mx-auto lg:mx-0">
            Why buy what you only use once? Access quality tools, camping equipment, event gear, and shared appliances from verified neighbours right down your street.
          </p>

          {/* Three Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2 text-left">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1">
                <Wrench className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-xs text-white">Borrow & Rent</h3>
              <p className="text-[11px] text-slate-400 leading-snug">
                Power tools, lawn care & camping kit with deposit hold.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-1">
                <Repeat className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-xs text-white">Appliance Co-ops</h3>
              <p className="text-[11px] text-slate-400 leading-snug">
                Shared washers, 3D printers and batteries on subscription.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center mb-1">
                <HeartHandshake className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-xs text-white">90% Host Payout</h3>
              <p className="text-[11px] text-slate-400 leading-snug">
                Earn passive income from gear sitting in your garage.
              </p>
            </div>
          </div>
        </div>

        {/* Right Auth Card */}
        <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8 backdrop-blur-md">
          {/* Card Tabs */}
          <div className="flex border-b border-slate-100 bg-slate-50 p-1 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
              }}
              className={cn(
                'flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer text-center',
                mode === 'signup' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              )}
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
              }}
              className={cn(
                'flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer text-center',
                mode === 'signin' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              )}
            >
              Sign In
            </button>
          </div>

          <div className="mb-5">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {mode === 'signup' ? 'Get started on ShareHub' : 'Welcome back, neighbour'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {mode === 'signup'
                ? 'Sign up in seconds to access your neighbourhood marketplace'
                : 'Sign in to access your rentals, listings, and messages'}
            </p>
          </div>

          {errorMsg && (
            <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' && (
              <label className="block">
                <span className="text-xs font-semibold text-slate-700 block mb-1">Your Full Name</span>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Thandi Nkosi"
                    className={inputClass}
                  />
                </div>
              </label>
            )}

            <label className="block">
              <span className="text-xs font-semibold text-slate-700 block mb-1">Email Address</span>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-700 block mb-1">Password</span>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  minLength={mode === 'signup' ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                  className={inputClass}
                />
              </div>
            </label>

            {mode === 'signup' && (
              <label className="block">
                <span className="text-xs font-semibold text-slate-700 block mb-1">
                  Neighbourhood <span className="font-normal text-slate-400">(optional)</span>
                </span>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="e.g. Observatory, Rondebosch, Sea Point"
                    className={inputClass}
                  />
                </div>
              </label>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-slate-900 hover:bg-slate-800 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{mode === 'signup' ? 'Create Account & Start' : 'Sign In to ShareHub'}</span>
                  <ArrowRight className="w-4 h-4 text-emerald-400" />
                </>
              )}
            </button>
          </form>

          {/* Dev Demo Account Switcher */}
          {import.meta.env.DEV && (
            <div className="mt-5 p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                  <Wrench className="w-3 h-3 text-amber-700" />
                  Quick Demo Access (Dev)
                </span>
                <span className="text-[10px] text-amber-600 font-semibold">1-click test</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['USER', 'Member (Borrower)'],
                    ['VERIFIED_HOST', 'Host (Tariq)'],
                    ['ADMIN', 'Admin Operator'],
                  ] as [UserRole, string][]
                ).map(([role, label]) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleDemo(role)}
                    className="p-1.5 rounded-lg bg-white hover:bg-amber-100/80 text-amber-950 text-[11px] font-bold border border-amber-200 transition-colors cursor-pointer text-center"
                  >
                    {label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-500 text-center">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>By joining, you agree to neighbourhood respect & honest handovers.</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 w-full text-center text-xs text-slate-500">
        ShareHub © {new Date().getFullYear()} · Part of the ARP Cloud Solutions ecosystem · Live on PayFast Gateway
      </footer>
    </div>
  );
};
