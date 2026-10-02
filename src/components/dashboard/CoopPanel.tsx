import React, { useState } from 'react';
import {
  Zap,
  KeyRound,
  History,
  AlertCircle,
  Loader2,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { MemberActivity, UserSubscriptionModel } from '../../types';
import { cn } from '../../lib/utils';

export interface CoopPanelProps {
  subscriptions: UserSubscriptionModel[];
  usageLogs: MemberActivity['usageLogs'];
  onLogUsage: (subscriptionId: string, notes: string) => Promise<void>;
  onBrowse: () => void;
}

const dateFmt: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
const fmtDate = (iso: string) => new Date(iso).toLocaleString([], dateFmt);

export const CoopPanel: React.FC<CoopPanelProps> = ({
  subscriptions,
  usageLogs,
  onLogUsage,
  onBrowse,
}) => {
  const [selectedId, setSelectedId] = useState(subscriptions[0]?.id ?? '');
  const [notes, setNotes] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);

  const active = subscriptions.find((s) => s.id === selectedId) ?? subscriptions[0];
  const logs = usageLogs.filter((l) => l.subscriptionId === active?.id);

  if (subscriptions.length === 0) {
    return (
      <div className="text-center py-12 px-4 space-y-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
          <Zap className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">No active memberships yet</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Share washing machines, solar batteries, tools, and 3D printers with your neighbours at a fraction of the cost.
        </p>
        <button
          type="button"
          onClick={onBrowse}
          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition-colors shadow-xs"
        >
          Explore shared appliances
        </button>
      </div>
    );
  }

  const startTurn = async () => {
    if (!active) return;
    setError(null);
    setIsWorking(true);
    try {
      await onLogUsage(active.id, notes.trim());
      setNotes('');
    } catch (err: any) {
      setError(err?.message || 'That did not work. Please try again.');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Selector if multiple memberships */}
      {subscriptions.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {subscriptions.map((sub) => {
            const isSelected = sub.id === (active?.id ?? '');
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => {
                  setSelectedId(sub.id);
                  setShowCode(false);
                  setError(null);
                }}
                className={cn(
                  'px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer',
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                )}
              >
                {sub.listing?.title || 'Shared Appliance'}
              </button>
            );
          })}
        </div>
      )}

      {active && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Card */}
          <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wider inline-block mb-1.5">
                  Monthly Co-op
                </span>
                <h3 className="text-lg font-bold text-slate-900">{active.listing?.title || 'Shared Appliance'}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{active.pricingTier?.name || 'Co-op tier'}</p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black text-indigo-600">{active.remainingUsesThisPeriod}</span>
                <span className="text-xs text-slate-400 block font-semibold">turns left</span>
              </div>
            </div>

            {/* Access Code Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Appliance Access Code</h4>
                  <p className="text-[11px] text-slate-500">Keypad or lockbox combination</p>
                </div>
              </div>
              <div>
                {showCode ? (
                  <span className="font-mono text-base font-bold bg-white px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900">
                    {active.accessKeyOrCode || '1234'}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCode(true)}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer shadow-2xs transition-colors"
                  >
                    Reveal code
                  </button>
                )}
              </div>
            </div>

            {/* Log Usage Action */}
            <div className="pt-2 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-700 block mb-1">
                  Ready to use it? Start a turn:
                </span>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional note: e.g. 40°C wash cycle, 2h 3D print"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:border-slate-400 outline-none"
                />
              </label>

              {error && (
                <div role="alert" className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="button"
                onClick={startTurn}
                disabled={isWorking || active.remainingUsesThisPeriod <= 0}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                {isWorking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>Log turn ({active.remainingUsesThisPeriod} left)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Usage History for this appliance */}
          <div className="lg:col-span-5 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <History className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Usage history</h4>
            </div>

            {logs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No turns logged for this co-op yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {logs.map((log) => (
                  <div key={log.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="flex items-center gap-1 font-semibold text-slate-700">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {fmtDate(log.startedAt)}
                      </span>
                    </div>
                    {log.notes && <p className="text-slate-600 text-[11px] font-medium">{log.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
