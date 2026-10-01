import React from 'react';
import { DollarSign, Clock, CheckCircle2, ShieldCheck, Info } from 'lucide-react';
import { EarningRow, MemberDashboard } from '../../api/client';
import { formatCurrency, cn } from '../../lib/utils';

export interface EarningsSectionProps {
  dashboardData: MemberDashboard | null;
  onBrowseListings: () => void;
}

export const EarningsSection: React.FC<EarningsSectionProps> = ({ dashboardData, onBrowseListings }) => {
  const stats = dashboardData?.stats;
  const earnings = dashboardData?.earnings ?? [];

  const totalEarnedCents = (stats?.earningsDueCents ?? 0) + (stats?.earningsPaidCents ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Host Earnings & Payouts</h2>
        <p className="text-xs text-slate-500">Track incoming revenue from your rentals and shared appliances</p>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Earned</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatCurrency(totalEarnedCents)}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">90% net host payout across all bookings</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Due for Payout</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 tracking-tight">
            {formatCurrency(stats?.earningsDueCents ?? 0)}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Ready after return handover check-in</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Paid Out</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-600 tracking-tight">
            {formatCurrency(stats?.earningsPaidCents ?? 0)}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Transferred to your bank account</p>
        </div>
      </div>

      {/* Explanatory Banner */}
      <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-950">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold">How payouts work:</span>
          <p className="text-emerald-900 leading-relaxed">
            When a neighbour books your gear or joins your co-op, payments are held securely in escrow by PayFast.
            Once you inspect and check the item back in, your 90% host payout is marked due and transferred directly to your bank account.
          </p>
        </div>
      </div>

      {/* Earnings Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Payout History</h3>
          <span className="text-xs text-slate-400 font-semibold">{earnings.length} transactions</span>
        </div>

        {earnings.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Info className="w-6 h-6" />
            </div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No earnings recorded yet. Once neighbours borrow your equipment or join your co-op, your payouts will show up here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-4 py-3">Listing</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Gross Amount</th>
                  <th className="px-4 py-3 font-bold text-slate-900">Your Payout (90%)</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {earnings.map((row) => (
                  <tr key={row.paymentId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 text-slate-600 font-medium">
                      {new Date(row.date).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-900">{row.listingTitle}</td>
                    <td className="px-4 py-3.5 text-slate-600 capitalize">{row.kind}</td>
                    <td className="px-4 py-3.5 text-slate-600 font-medium">{formatCurrency(row.grossCents)}</td>
                    <td className="px-4 py-3.5 font-bold text-emerald-600">{formatCurrency(row.payoutCents)}</td>
                    <td className="px-6 py-3.5 text-right">
                      <span
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[10px] font-bold border inline-block uppercase tracking-wider',
                          row.status === 'done'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        )}
                      >
                        {row.status === 'done' ? 'Paid out' : 'Due'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
