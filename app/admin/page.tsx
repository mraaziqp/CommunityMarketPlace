import React from 'react';
import { auth } from '../../lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { bootstrapAdmin, getExecutiveAdminReport } from '../../actions/admin';
import { AdminDashboard } from '../../src/components/admin/AdminDashboard';
import { ShieldAlert, ShieldCheck, ArrowLeft, Sparkles, Lock } from 'lucide-react';
import Link from 'next/link';

/**
 * ============================================================================
 * NEXT.JS 15 EXECUTIVE ADMIN ROUTE (app/admin/page.tsx)
 * Strictly verifies the session user's role is 'ADMIN'.
 * Returns 403 / access-denied state or redirects unauthorized users.
 * ============================================================================
 */

export const metadata = {
  title: 'Executive Admin Command Center | ShareHub',
  description: 'Real-time Neon PostgreSQL analytics, PostGIS demand heatmaps, and appliance telemetry.',
};

export default async function AdminPage() {
  let session = null;

  try {
    const requestHeaders = await headers();
    session = await auth.api.getSession({
      headers: requestHeaders,
    });
  } catch (err) {
    console.warn('Session verification fallback in server component:', err);
  }

  // Strict Role Check: Only 'ADMIN' role is permitted
  const user = session?.user;
  const isAuthorizedAdmin = user?.role === 'ADMIN';

  if (!isAuthorizedAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-950/80 text-rose-400 border border-rose-800 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              403 • Restricted Executive Portal
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Access to the ShareHub Executive Command Center requires verified <code>ADMIN</code> privileges.
            </p>
          </div>

          {/* Current Status Box */}
          <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 text-left text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Session Status:</span>
              <span className="px-2 py-0.5 rounded-md bg-rose-950 text-rose-300 font-mono font-bold text-[10px] border border-rose-800">
                {user ? `ROLE: ${user.role || 'USER'}` : 'UNAUTHENTICATED'}
              </span>
            </div>
            {user && (
              <div className="text-slate-300 font-mono truncate text-[11px]">
                {user.email}
              </div>
            )}
          </div>

          {/* Founder Bootstrap Instruction */}
          <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-800/60 text-purple-200 text-left text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-purple-300">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Founder Admin Bootstrapping</span>
            </div>
            <p className="text-[11px] text-purple-300/80 leading-relaxed">
              To permanently unlock this route for your founder account, run the <code>bootstrapAdmin</code> Server Action or use the in-app elevation trigger in the ShareHub dashboard.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <Link
              href="/"
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Marketplace</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // User is authenticated as ADMIN: render Executive Command Center
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminDashboard
        currentUser={{
          id: user.id,
          name: user.name || 'Principal Administrator',
          email: user.email || 'admin@sharehub.community',
          emailVerified: true,
          role: 'ADMIN',
          image: user.image || undefined,
          trustScore: 100,
          isHost: true,
          neighborhood: 'City Bowl',
        }}
        onClose={() => {
          redirect('/');
        }}
      />
    </div>
  );
}
