import React from 'react';
import { ShieldCheck, Users, Repeat, Lock, HeartHandshake } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-12 pb-8 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Core Value Props Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-slate-800 text-left">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-slate-800 text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-1">Capped Co-Ops</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Appliance subscriptions are hard-capped at 3-5 users to eliminate waiting lines.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-slate-800 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-1">Community Trust</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Every member is identity-verified and backed by community security deposits.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-slate-800 text-amber-400">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-1">Usage Ledger</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Timestamped records ensure transparent quota tracking and fair machine sharing.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-slate-800 text-sky-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-1">Smart Access</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Secure digital PINs, IoT smart plugs, and QR codes control physical access.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom copyright & attribution */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">ShareHub</span>
            <span>· P2P Community Rental & Fractional Marketplace</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="hover:text-slate-400 cursor-pointer">Neighborhood Charter</span>
            <span className="hover:text-slate-400 cursor-pointer">Dispute Escrow</span>
            <span className="hover:text-slate-400 cursor-pointer">Drizzle Schema Docs</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
