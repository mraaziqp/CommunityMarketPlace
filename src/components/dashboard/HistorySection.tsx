import React from 'react';
import {
  CalendarDays,
  Package,
  CheckCircle2,
  Zap,
  CreditCard,
  Star,
  Sparkles,
  Users,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import { ActivityHistoryItem } from '../../types';

export interface HistorySectionProps {
  history: ActivityHistoryItem[];
}

const HISTORY_ICON: Record<ActivityHistoryItem['kind'], React.ReactNode> = {
  booking: <CalendarDays className="w-4 h-4 text-indigo-600" />,
  pickup: <Package className="w-4 h-4 text-amber-600" />,
  return: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  usage: <Zap className="w-4 h-4 text-amber-500" />,
  payment: <CreditCard className="w-4 h-4 text-slate-600" />,
  review: <Star className="w-4 h-4 text-amber-500" />,
  listing: <Sparkles className="w-4 h-4 text-indigo-600" />,
  circle: <Users className="w-4 h-4 text-emerald-600" />,
  account: <Sparkles className="w-4 h-4 text-indigo-600" />,
  dispute: <ShieldAlert className="w-4 h-4 text-rose-600" />,
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export const HistorySection: React.FC<HistorySectionProps> = ({ history }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Activity Log</h2>
        <p className="text-xs text-slate-500">A timeline of your rentals, handovers, payments and reviews</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-6">
        {history.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Clock className="w-6 h-6" />
            </div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No activity recorded yet. As you book items, complete handovers, and leave reviews, your history will be logged here.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5 divide-y divide-slate-100">
            {history.map((item) => (
              <div key={item.id} className="pt-3.5 first:pt-0 flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center shrink-0">
                  {HISTORY_ICON[item.kind] ?? <Sparkles className="w-4 h-4 text-slate-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-snug">{item.title}</h4>
                    <span className="text-[11px] text-slate-400 font-medium shrink-0">
                      {relativeTime(item.createdAt)}
                    </span>
                  </div>
                  {item.detail && <p className="text-xs text-slate-500 mt-0.5">{item.detail}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
