import React, { useState, useTransition } from 'react';
import {
  Zap,
  Repeat,
  CheckCircle2,
  Clock,
  AlertCircle,
  QrCode,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  History,
  X,
  Database,
  KeyRound,
  FileJson,
  Layers,
  ArrowRight,
  Loader2,
  Check,
  Star,
  Lock,
  Award,
} from 'lucide-react';
import {
  UserSubscriptionModel,
  UsageLogModel,
  SystemLogModel,
  BookingModel,
} from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { logFractionalUse } from '../../actions/usage';
import { confirmHandover } from '../../actions/bookings';

export interface FractionalUsageLoggerProps {
  subscriptions: UserSubscriptionModel[];
  usageLogs: UsageLogModel[];
  systemLogs?: SystemLogModel[];
  bookings?: BookingModel[];
  onLogUsageSuccess?: (
    updatedSub: { id: string; remainingUses: number },
    newUsageLog: UsageLogModel,
    newSystemLog: SystemLogModel
  ) => void;
  onConfirmHandoverSuccess?: (
    updatedBooking: BookingModel,
    newSystemLog: SystemLogModel
  ) => void;
  onResetMonth: (subscriptionId: string) => void;
  onClose: () => void;
  onOpenReviewModal?: (booking: BookingModel) => void;
  onOpenEscrowModal?: (booking: BookingModel) => void;
  onOpenReturnModal?: (booking: BookingModel) => void;
}

export const FractionalUsageLogger: React.FC<FractionalUsageLoggerProps> = ({
  subscriptions: initialSubscriptions,
  usageLogs: initialUsageLogs,
  systemLogs: initialSystemLogs = [],
  bookings: initialBookings = [],
  onLogUsageSuccess,
  onConfirmHandoverSuccess,
  onResetMonth,
  onClose,
  onOpenReviewModal,
  onOpenEscrowModal,
  onOpenReturnModal,
}) => {
  // Active state
  const [subscriptions, setSubscriptions] = useState<UserSubscriptionModel[]>(initialSubscriptions);
  const [usageLogs, setUsageLogs] = useState<UsageLogModel[]>(initialUsageLogs);
  const [systemLogs, setSystemLogs] = useState<SystemLogModel[]>(initialSystemLogs);
  const [bookings, setBookings] = useState<BookingModel[]>(
    initialBookings.length > 0
      ? initialBookings
      : [
          {
            id: 'book_drill_001',
            listingId: 'list_drill_002',
            listingTitle: 'DeWalt 20V MAX Cordless Rotary Hammer Drill Kit',
            renterId: 'usr_me',
            renterName: 'Alex Rivera',
            status: 'PENDING_HANDOVER',
            disputeStatus: 'NONE',
            verificationCode: 'HANDOVER-8842',
            totalAmountInCents: 15000,
            depositAmountInCents: 50000,
            startDate: '2026-08-21 09:00',
            endDate: '2026-08-23 18:00',
            handoverCompletedAt: null,
            handoverNotes: 'Includes 2x 4.0Ah batteries and bit set',
          },
        ]
  );

  const [activeTab, setActiveTab] = useState<'quotas' | 'system_logs' | 'handover'>('quotas');
  const [selectedSubId, setSelectedSubId] = useState<string>(
    subscriptions[0]?.id || ''
  );
  const [cycleNotes, setCycleNotes] = useState<string>('Daily 40°C Eco Cycle (60 min)');
  const [handoverPin, setHandoverPin] = useState<string>('HANDOVER-8842');
  
  // React 19 Transition for Optimistic Server Action UI Updates
  const [isPending, startTransition] = useTransition();
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [expandedJsonLogId, setExpandedJsonLogId] = useState<string | null>(null);

  const activeSub =
    subscriptions.find((s) => s.id === selectedSubId) || subscriptions[0];

  /**
   * OPTIMISTIC UI: Trigger fractional usage via Next.js Server Action
   * Drops progress meter from 10 -> 9 immediately, gracefully reverting if the action fails.
   */
  const handleTriggerCycle = () => {
    if (!activeSub || isPending) return;

    if (activeSub.remainingUsesThisPeriod <= 0) {
      setErrorToast(`Quota depleted: 0 remaining uses for ${activeSub.listing.title}.`);
      setTimeout(() => setErrorToast(null), 4000);
      return;
    }

    const previousSubscriptions = [...subscriptions];
    const previousLogs = [...usageLogs];
    const previousSystemLogs = [...systemLogs];

    const currentRemaining = activeSub.remainingUsesThisPeriod;
    const optimisticRemaining = Math.max(0, currentRemaining - 1);
    const optimisticTotalUsed = activeSub.totalUsesUsed + 1;
    const notesToSubmit = cycleNotes.trim() || 'Standard fractional cycle';

    // 1. Instant Optimistic State Update
    setSubscriptions((prev) =>
      prev.map((sub) =>
        sub.id === activeSub.id
          ? {
              ...sub,
              remainingUsesThisPeriod: optimisticRemaining,
              totalUsesUsed: optimisticTotalUsed,
            }
          : sub
      )
    );

    // 2. Dispatch Server Action in a Transition
    startTransition(async () => {
      try {
        const result = await logFractionalUse(
          activeSub.id,
          activeSub.userId,
          notesToSubmit
        );

        if (result.success) {
          const newUsageLogModel: UsageLogModel = {
            id: result.usageLog.id,
            subscriptionId: result.usageLog.subscriptionId,
            listingId: result.usageLog.listingId,
            listingTitle: activeSub.listing.title,
            userId: result.usageLog.userId,
            userName: 'Alex Rivera',
            startedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            unitsUsed: result.usageLog.unitsUsed,
            status: 'completed',
            notes: result.usageLog.notes || notesToSubmit,
            verificationCode: result.usageLog.verificationCode || undefined,
          };

          const newSystemLogModel: SystemLogModel = {
            id: result.systemLog.id,
            eventType: result.systemLog.eventType as any,
            userId: result.systemLog.userId,
            targetId: result.systemLog.targetId,
            metadata: result.systemLog.metadata,
            createdAt: result.systemLog.createdAt,
          };

          setUsageLogs((prev) => [newUsageLogModel, ...prev]);
          setSystemLogs((prev) => [newSystemLogModel, ...prev]);

          if (onLogUsageSuccess) {
            onLogUsageSuccess(
              { id: activeSub.id, remainingUses: result.subscription.remainingUses },
              newUsageLogModel,
              newSystemLogModel
            );
          }

          setSuccessToast(
            `Transaction verified! 1 use deducted (${result.subscription.remainingUses} remaining). Logged to SystemLogs.`
          );
          setTimeout(() => setSuccessToast(null), 4500);
        }
      } catch (err: any) {
        // Rollback Optimistic State on Error
        setSubscriptions(previousSubscriptions);
        setUsageLogs(previousLogs);
        setSystemLogs(previousSystemLogs);

        console.error('Fractional usage server action error:', err);
        setErrorToast(err?.message || 'Failed to process fractional transaction. Reverting state.');
        setTimeout(() => setErrorToast(null), 5000);
      }
    });
  };

  /**
   * DIGITAL HANDOVER STATE MACHINE: Confirm handover via Server Action
   * Transitions booking status from PENDING_HANDOVER to ACTIVE
   */
  const handleConfirmHandover = (bookingId: string) => {
    if (isPending) return;

    const previousBookings = [...bookings];

    // Optimistic Update
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              status: 'ACTIVE',
              handoverCompletedAt: new Date().toISOString(),
            }
          : b
      )
    );

    startTransition(async () => {
      try {
        const result = await confirmHandover(bookingId, handoverPin, 'usr_me');

        if (result.success) {
          const newSystemLogModel: SystemLogModel = {
            id: result.systemLog.id,
            eventType: result.systemLog.eventType as any,
            userId: result.systemLog.userId,
            targetId: result.systemLog.targetId,
            metadata: result.systemLog.metadata,
            createdAt: result.systemLog.createdAt,
          };

          setSystemLogs((prev) => [newSystemLogModel, ...prev]);

          const updatedBooking: BookingModel = {
            id: result.booking.id,
            listingId: result.booking.listingId,
            listingTitle:
              bookings.find((b) => b.id === bookingId)?.listingTitle ||
              'DeWalt Cordless Rotary Hammer Drill',
            renterId: result.booking.renterId,
            renterName: 'Alex Rivera',
            status: 'ACTIVE',
            disputeStatus: 'NONE',
            verificationCode: result.booking.verificationCode,
            totalAmountInCents: result.booking.totalAmountInCents,
            depositAmountInCents: result.booking.depositAmountInCents,
            startDate: result.booking.startDate,
            endDate: result.booking.endDate,
            handoverCompletedAt: result.booking.handoverCompletedAt,
          };

          if (onConfirmHandoverSuccess) {
            onConfirmHandoverSuccess(updatedBooking, newSystemLogModel);
          }

          setSuccessToast(
            'Handover confirmed! Status changed to ACTIVE. Liability transfer logged in SystemLogs.'
          );
          setTimeout(() => setSuccessToast(null), 5000);
        }
      } catch (err: any) {
        setBookings(previousBookings);
        setErrorToast(err?.message || 'Handover confirmation failed.');
        setTimeout(() => setErrorToast(null), 5000);
      }
    });
  };

  const handleMonthlyCycleReset = () => {
    if (!activeSub) return;
    onResetMonth(activeSub.id);
    const limit = activeSub.pricingTier.usageLimitPerPeriod || 10;
    setSubscriptions((prev) =>
      prev.map((s) =>
        s.id === activeSub.id ? { ...s, remainingUsesThisPeriod: limit } : s
      )
    );
    setSuccessToast(`Monthly cycle reset! Quota replenished to ${limit} uses.`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const filteredLogs = usageLogs.filter(
    (l) => !selectedSubId || l.subscriptionId === selectedSubId
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center border border-slate-700">
              <Clock className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                My Active Quotas & Fractional Usage Engine
              </h2>
              <p className="text-xs text-slate-400">
                Optimistic UI, atomic Drizzle transactions (`db.transaction`), & immutable SystemLogs
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-Header Tab Bar */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('quotas')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer',
                activeTab === 'quotas'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              )}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Fractional Quota Meter</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('handover')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer',
                activeTab === 'handover'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              )}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Digital Handover</span>
              {bookings.some((b) => b.status === 'PENDING_HANDOVER') && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('system_logs')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer',
                activeTab === 'system_logs'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              )}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Immutable SystemLogs ({systemLogs.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            <span>Neon Serverless Ready</span>
          </div>
        </div>

        {/* Global Toast Banners */}
        {successToast && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {errorToast && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorToast}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="overflow-y-auto p-6 space-y-6">
          {activeTab === 'quotas' && (
            <>
              {subscriptions.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <Zap className="w-12 h-12 text-slate-300 mx-auto" />
                  <h3 className="text-base font-semibold text-slate-900">
                    No active subscriptions yet
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Browse our community listings to join a fractional washing machine co-op, 3D printer hub, or clean energy station.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Left Column: Subscription Selector & Active Meter */}
                  <div className="md:col-span-6 space-y-4">
                    <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                      Select Active Subscription
                    </label>

                    <div className="space-y-2">
                      {subscriptions.map((sub) => {
                        const isSelected = sub.id === selectedSubId;
                        const maxQuota = sub.pricingTier.usageLimitPerPeriod || 10;
                        const percentage = (sub.remainingUsesThisPeriod / maxQuota) * 100;

                        return (
                          <div
                            key={sub.id}
                            onClick={() => setSelectedSubId(sub.id)}
                            className={cn(
                              'p-3.5 rounded-2xl border text-left cursor-pointer transition-all',
                              isSelected
                                ? 'bg-slate-50 border-slate-900 ring-2 ring-slate-200 shadow-xs'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            )}
                          >
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <h4 className="font-bold text-xs text-slate-900 line-clamp-1">
                                {sub.listing.title}
                              </h4>
                              <span className="text-[11px] font-bold text-slate-900 whitespace-nowrap bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70">
                                {formatCurrency(sub.pricingTier.priceInCents, sub.pricingTier.currency)}/mo
                              </span>
                            </div>

                            {/* Progress Bar with Instant Optimistic Visual Feedback */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-500 font-medium">Monthly Allocation</span>
                                <span className="font-bold text-slate-800">
                                  {sub.remainingUsesThisPeriod} / {maxQuota} uses remaining
                                </span>
                              </div>
                              <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden flex">
                                <div
                                  className={cn(
                                    'h-full transition-all duration-300 ease-out',
                                    sub.remainingUsesThisPeriod > 3
                                      ? 'bg-slate-900'
                                      : sub.remainingUsesThisPeriod > 0
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500'
                                  )}
                                  style={{ width: `${Math.max(4, percentage)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Quota Action Simulator */}
                    {activeSub && (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-amber-500" />
                            Trigger Fractional Use (Server Action)
                          </span>
                          <button
                            type="button"
                            onClick={handleMonthlyCycleReset}
                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Simulate Month Reset
                          </button>
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-slate-600 block mb-1">
                            Cycle / Workload Description:
                          </label>
                          <input
                            type="text"
                            value={cycleNotes}
                            onChange={(e) => setCycleNotes(e.target.value)}
                            placeholder="e.g. 60 min Cotton Eco Wash"
                            className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:border-slate-400 outline-none"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleTriggerCycle}
                          disabled={isPending || activeSub.remainingUsesThisPeriod <= 0}
                          className={cn(
                            'w-full py-2.5 px-4 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer',
                            isPending
                              ? 'bg-slate-700 cursor-wait'
                              : activeSub.remainingUsesThisPeriod > 0
                              ? 'bg-slate-900 hover:bg-slate-800'
                              : 'bg-slate-400 cursor-not-allowed'
                          )}
                        >
                          {isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                              <span>Executing Drizzle Transaction (`db.transaction`)...</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4 text-amber-400" />
                              <span>
                                {activeSub.remainingUsesThisPeriod > 0
                                  ? `Log 1 Usage (${activeSub.remainingUsesThisPeriod} Remaining)`
                                  : 'Quota Depleted'}
                              </span>
                            </>
                          )}
                        </button>

                        <div className="p-3 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center gap-2.5 text-[11px] text-slate-800">
                          <QrCode className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span>
                            Access Key / Smart Plug Passcode: <strong className="font-mono">{activeSub.accessKeyOrCode}</strong>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Immutable Audit Ledger (`UsageLogs`) */}
                  <div className="md:col-span-6 flex flex-col space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-indigo-600" />
                        Timestamped Usage Ledger (`UsageLogs`)
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {filteredLogs.length} logged events
                      </span>
                    </div>

                    <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-200 p-3 overflow-y-auto max-h-[380px] space-y-2">
                      {filteredLogs.length === 0 ? (
                        <div className="text-center py-10 text-xs text-slate-400">
                          No usage records yet for this listing. Trigger a cycle to see live audit logs.
                        </div>
                      ) : (
                        filteredLogs.map((log) => (
                          <div
                            key={log.id}
                            className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-start justify-between gap-3 text-xs"
                          >
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 truncate">
                                  {log.listingTitle}
                                </span>
                                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/70">
                                  -1 Quota
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600">{log.notes || 'Standard Usage Run'}</p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                Log ID: {log.id} · Verified Code: {log.verificationCode || 'IOT_VERIFIED'}
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-[10px] text-slate-400 block font-medium">{log.startedAt}</span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Completed
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Tab 2: Digital Handover State Machine */}
          {activeTab === 'handover' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                  <KeyRound className="w-4 h-4" />
                  <span>Digital Handover State Machine (`actions/bookings.ts`)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Time-based physical item rentals transition from <code>PENDING_HANDOVER</code> to <code>ACTIVE</code> upon physical or QR token verification. This records the legal liability transfer timestamp directly into <code>SystemLogs</code>.
                </p>
              </div>

              <div className="space-y-4">
                {bookings.map((booking) => {
                  const isPendingHandover = booking.status === 'PENDING_HANDOVER';

                  return (
                    <div
                      key={booking.id}
                      className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-slate-900">
                              {booking.listingTitle}
                            </h3>
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                                isPendingHandover
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              )}
                            >
                              {booking.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Renter: <strong>{booking.renterName}</strong> · Rental Window: {booking.startDate} to {booking.endDate}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-900 block">
                            {formatCurrency(booking.totalAmountInCents, 'ZAR')}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Deposit: {formatCurrency(booking.depositAmountInCents, 'ZAR')} held
                          </span>
                        </div>
                      </div>

                      {/* State transition triggers & actions */}
                      {isPendingHandover ? (
                        <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-xs font-bold text-amber-900">
                              Step 1: Escrow & Handover Verification
                            </span>
                            <div className="flex items-center gap-2">
                              {onOpenEscrowModal && (
                                <button
                                  type="button"
                                  onClick={() => onOpenEscrowModal(booking)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-200/80 hover:bg-amber-300 text-amber-900 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                                >
                                  <Lock className="w-3 h-3 text-amber-800" />
                                  <span>Manage Escrow Hold</span>
                                </button>
                              )}
                              <span className="text-[11px] font-mono text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300/50">
                                PIN: {booking.verificationCode}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={handoverPin}
                              onChange={(e) => setHandoverPin(e.target.value)}
                              placeholder="Enter scanned PIN / token"
                              className="flex-1 px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:border-slate-400 outline-none font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => handleConfirmHandover(booking.id)}
                              disabled={isPending}
                              className="py-2 px-4 rounded-xl font-bold text-xs text-white bg-slate-900 hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              {isPending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              )}
                              Confirm & Capture Escrow
                            </button>
                          </div>
                        </div>
                      ) : booking.status === 'ACTIVE' ? (
                        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <div>
                              <span>
                                <strong>Active Rental</strong> · Escrow Captured & Handover Verified at{' '}
                                {booking.handoverCompletedAt
                                  ? new Date(booking.handoverCompletedAt).toLocaleTimeString()
                                  : 'Verified'}
                              </span>
                              <div className="text-[10px] text-emerald-700 font-mono mt-0.5">
                                Funds secured · Deposit held safely in escrow until return
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (onOpenReturnModal) {
                                  onOpenReturnModal(booking);
                                } else {
                                  setBookings((prev) =>
                                    prev.map((b) =>
                                      b.id === booking.id
                                        ? { ...b, status: 'COMPLETED' }
                                        : b
                                    )
                                  );
                                  setSuccessToast('Return completed! Security deposit released.');
                                }
                              }}
                              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                              <span>Inspect & Return Handover</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Completed status with Review trigger */
                        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-amber-600" />
                            <div>
                              <span className="font-semibold text-stone-800">
                                Rental Completed & Escrow Reconciled
                              </span>
                              <p className="text-[11px] text-stone-500">
                                Deposit released. Leave a review to elevate community trust score.
                              </p>
                            </div>
                          </div>

                          {onOpenReviewModal && (
                            <button
                              type="button"
                              onClick={() => onOpenReviewModal(booking)}
                              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
                            >
                              <Star className="w-3.5 h-3.5 fill-stone-950 text-stone-950" />
                              <span>Review Host</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 3: Immutable System Logs (JSONB Metadata Viewer) */}
          {activeTab === 'system_logs' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                    <Database className="w-4 h-4 text-amber-400" />
                    <span>Immutable Audit Ledger (`system_logs`)</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    JSONB Metadata Enabled
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Every state transition, fractional deduction, and digital handover produces an immutable cryptographic audit record.
                </p>
              </div>

              <div className="space-y-2">
                {systemLogs.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                    No system logs generated yet. Trigger a fractional use or digital handover to write new records.
                  </div>
                ) : (
                  systemLogs.map((log) => {
                    const isExpanded = expandedJsonLogId === log.id;

                    return (
                      <div
                        key={log.id}
                        className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2.5 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-md text-[10px] font-bold font-mono tracking-wider',
                                log.eventType === 'FRACTIONAL_USE_LOGGED'
                                  ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                  : log.eventType === 'HANDOVER_COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-800 border border-slate-200'
                              )}
                            >
                              {log.eventType}
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                              Target ID: <code className="text-slate-600">{log.targetId}</code>
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-right">
                            <span className="text-[11px] text-slate-400 font-mono">
                              {new Date(log.createdAt).toLocaleTimeString()}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedJsonLogId(isExpanded ? null : log.id)
                              }
                              className="text-[11px] text-slate-600 hover:text-slate-900 font-medium inline-flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md"
                            >
                              <FileJson className="w-3.5 h-3.5 text-indigo-600" />
                              <span>{isExpanded ? 'Hide JSONB' : 'Inspect JSONB'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Expandable JSONB context viewer */}
                        {isExpanded && (
                          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto">
                            <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
