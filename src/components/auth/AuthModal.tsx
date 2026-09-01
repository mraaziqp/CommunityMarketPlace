import React, { useState } from 'react';
import {
  X,
  Lock,
  Mail,
  User,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  KeyRound,
  Shield,
} from 'lucide-react';
import { UserRole, UserModel, AuthSession } from '../../types';
import {
  signUpWithEmailPassword,
  signInWithEmailPassword,
  signInWithGoogleOAuth,
  DEMO_ACCOUNTS,
} from '../../../actions/auth';
import { cn } from '../../lib/utils';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (session: AuthSession) => void;
  defaultMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  defaultMode = 'signin',
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(defaultMode);
  const [role, setRole] = useState<UserRole>('USER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [neighborhood, setNeighborhood] = useState('City Bowl / Gardens');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (mode === 'signup') {
        const res = await signUpWithEmailPassword({
          name,
          email,
          password,
          role,
          neighborhood,
          isHost: role === 'VERIFIED_HOST' || role === 'ADMIN',
        });

        if (res.success && res.session) {
          onAuthSuccess(res.session);
          onClose();
        } else {
          setErrorMsg(res.error || 'Failed to create account.');
        }
      } else {
        const res = await signInWithEmailPassword({ email, password });
        if (res.success && res.session) {
          onAuthSuccess(res.session);
          onClose();
        } else {
          setErrorMsg(res.error || 'Invalid email or credentials.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await signInWithGoogleOAuth(role);
      if (res.success && res.session) {
        onAuthSuccess(res.session);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg('Google OAuth sign-in failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = (demoRole: UserRole) => {
    const demoUser = DEMO_ACCOUNTS[demoRole];
    onAuthSuccess({
      user: demoUser,
      token: `demo_token_${demoRole.toLowerCase()}`,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-white border border-slate-700">
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                {mode === 'signin' ? 'Sign In to ShareHub' : 'Join ShareHub Co-Op'}
              </h2>
              <p className="text-[11px] text-slate-400">
                Better Auth • Role-Based Access Control
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: Sign In vs Sign Up */}
        <div className="flex border-b border-slate-100 bg-slate-50 p-1.5">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMsg(null);
            }}
            className={cn(
              'flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center',
              mode === 'signin'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            )}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMsg(null);
            }}
            className={cn(
              'flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center',
              mode === 'signup'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            )}
          >
            Create Account
          </button>
        </div>

        {/* Quick Demo Credentials Banner */}
        <div className="px-6 pt-4 pb-2">
          <div className="p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-100 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                1-Click Role Sandbox:
              </span>
              <span className="text-[10px] text-indigo-600 font-medium">Instant Test</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('ADMIN')}
                className="px-2 py-1.5 rounded-lg bg-white hover:bg-indigo-600 hover:text-white text-indigo-950 text-[10px] font-bold border border-indigo-200 transition-colors shadow-2xs cursor-pointer text-center"
              >
                👑 Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('VERIFIED_HOST')}
                className="px-2 py-1.5 rounded-lg bg-white hover:bg-emerald-600 hover:text-white text-slate-800 text-[10px] font-bold border border-emerald-200 transition-colors shadow-2xs cursor-pointer text-center"
              >
                🛡️ Host
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('USER')}
                className="px-2 py-1.5 rounded-lg bg-white hover:bg-slate-800 hover:text-white text-slate-700 text-[10px] font-bold border border-slate-200 transition-colors shadow-2xs cursor-pointer text-center"
              >
                👤 Member
              </button>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 pt-2 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Google OAuth Provider Button */}
          <button
            type="button"
            disabled={isLoading}
            onClick={handleGoogleSignIn}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2.5 shadow-2xs transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continue with Google OAuth
          </button>

          <div className="flex items-center gap-2 my-2">
            <div className="h-px bg-slate-200 flex-1" />
            <span className="text-[10px] uppercase font-bold text-slate-400">Or with email</span>
            <div className="h-px bg-slate-200 flex-1" />
          </div>

          {/* Role Picker (for Sign Up) */}
          {mode === 'signup' && (
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
                Account Role
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('USER')}
                  className={cn(
                    'p-2 rounded-xl border text-center transition-all text-xs font-semibold cursor-pointer',
                    role === 'USER'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  )}
                >
                  <User className="w-3.5 h-3.5 mx-auto mb-1 opacity-80" />
                  Member
                </button>
                <button
                  type="button"
                  onClick={() => setRole('VERIFIED_HOST')}
                  className={cn(
                    'p-2 rounded-xl border text-center transition-all text-xs font-semibold cursor-pointer',
                    role === 'VERIFIED_HOST'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  )}
                >
                  <ShieldCheck className="w-3.5 h-3.5 mx-auto mb-1 text-emerald-400" />
                  Host
                </button>
                <button
                  type="button"
                  onClick={() => setRole('ADMIN')}
                  className={cn(
                    'p-2 rounded-xl border text-center transition-all text-xs font-semibold cursor-pointer',
                    role === 'ADMIN'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  )}
                >
                  <Shield className="w-3.5 h-3.5 mx-auto mb-1 text-amber-400" />
                  Admin
                </button>
              </div>
            </div>
          )}

          {/* Name Field (Sign Up only) */}
          {mode === 'signup' && (
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:border-slate-400 outline-none"
                />
              </div>
            </div>
          )}

          {/* Email Field */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 block mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@community.org"
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:border-slate-400 outline-none"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 block mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:border-slate-400 outline-none"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-slate-900 hover:bg-slate-800 shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Authenticating...
              </span>
            ) : mode === 'signin' ? (
              <>
                <span>Sign In to Co-Op</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
              </>
            ) : (
              <>
                <span>Create Co-Op Account</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
