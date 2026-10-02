import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, CreditCard, Loader2, RefreshCw } from 'lucide-react';
import { api, submitCheckout, type PaymentSummary, type ServerConfig } from '../../api/client';
import { cn, formatCurrency } from '../../lib/utils';

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-700 border-slate-200',
  HELD_IN_ESCROW: 'bg-amber-50 text-amber-800 border-amber-200',
  CAPTURED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  REFUNDED: 'bg-sky-50 text-sky-800 border-sky-200',
  FROZEN_ESCROW: 'bg-rose-50 text-rose-800 border-rose-200',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Waiting for PayFast',
  HELD_IN_ESCROW: 'Paid · held',
  CAPTURED: 'Paid',
  REFUNDED: 'Refunded',
  FROZEN_ESCROW: 'Frozen (dispute)',
};

/**
 * Admin payments: a live gateway test for any amount, recent payments, and
 * host payouts / deposit refunds that still need to be settled by hand.
 */
export function PaymentsPanel() {
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [amount, setAmount] = useState('5.00');
  const [recurring, setRecurring] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [payments, setPayments] = useState<PaymentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setPayments(await api.adminPayments());
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Payments could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api.config().then(setServerConfig).catch(() => undefined);
  }, [load]);

  const startTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cents = Math.round(Number(amount.replace(',', '.')) * 100);
    if (!Number.isFinite(cents) || cents < 500) {
      setError('PayFast needs at least R5.00.');
      return;
    }
    const kind = recurring ? `a monthly payment of ${formatCurrency(cents)}` : `a once-off payment of ${formatCurrency(cents)}`;
    const mode = serverConfig?.payments.mode === 'live' ? 'This is LIVE: real money will be charged.' : 'This is the PayFast sandbox.';
    if (!window.confirm(`Start ${kind}?\n\n${mode}`)) return;
    setIsStarting(true);
    try {
      submitCheckout(await api.startTestPayment(cents, recurring));
    } catch (err: any) {
      setError(err?.message || 'The test payment could not be started.');
      setIsStarting(false);
    }
  };

  const settle = async (id: string, what: 'hostPayout' | 'depositRefund') => {
    try {
      await api.settlePayment(id, what);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not update that payment.');
    }
  };

  const owed = payments.filter((p) => p.hostPayout.status === 'due' || p.depositRefund.status === 'due');
  const isLive = serverConfig?.payments.mode === 'live';

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={startTest} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-600" /> Test the payment gateway
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pay any amount through PayFast to check checkout, the payment notification and confirmation end to end.
            </p>
          </div>
          {serverConfig && (
            <span
              className={cn(
                'px-2.5 py-1 rounded-full text-[11px] font-bold border',
                isLive ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-sky-50 text-sky-700 border-sky-200'
              )}
            >
              {isLive ? 'LIVE — real money' : 'Sandbox'}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-700 block mb-1">Amount (ZAR)</span>
            <span className="relative block">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R</span>
              <input
                type="number"
                min={5}
                max={10000}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-36 pl-7 pr-3 py-2 text-sm bg-white rounded-xl border border-slate-200 outline-none font-semibold"
              />
            </span>
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 pb-2.5 cursor-pointer">
            <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="w-4 h-4" />
            Repeat monthly (tests subscriptions)
          </label>
          <button
            type="submit"
            disabled={isStarting}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            {isStarting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
            Pay with PayFast
          </button>
        </div>
        {recurring && (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
            A monthly test keeps charging until you cancel it in your PayFast dashboard (Subscriptions). Your PayFast account
            must have recurring billing enabled.
          </p>
        )}
      </form>

      {owed.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-amber-50/60">
            <h3 className="text-sm font-bold text-slate-900">Money to pay out</h3>
            <p className="text-[11px] text-slate-600">PayFast collects into your merchant account. Pay these out, then mark them done.</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {owed.map((p) => (
              <li key={p.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-slate-800 font-semibold">{p.listingTitle ?? 'Payment'}</span>
                <span className="flex flex-wrap gap-2">
                  {p.hostPayout.status === 'due' && (
                    <button type="button" onClick={() => settle(p.id, 'hostPayout')} className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-bold cursor-pointer">
                      Paid {formatCurrency(p.hostPayout.amountInCents)} to {p.hostPayout.hostName ?? 'host'}
                    </button>
                  )}
                  {p.depositRefund.status === 'due' && (
                    <button type="button" onClick={() => settle(p.id, 'depositRefund')} className="px-3 py-1.5 rounded-lg bg-sky-700 text-white font-bold cursor-pointer">
                      Refunded {formatCurrency(p.depositRefund.amountInCents)} to {p.depositRefund.renterName ?? 'renter'}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Recent payments</h3>
          <button type="button" onClick={load} aria-label="Refresh" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer">
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
        </div>
        {payments.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">{isLoading ? 'Loading…' : 'No payments yet.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-2.5">When</th>
                  <th className="px-4 py-2.5">What</th>
                  <th className="px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">PayFast ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-2.5 text-slate-500 whitespace-nowrap">{new Date(p.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-slate-800">
                      {p.kind === 'test' ? `Gateway test${p.recurring ? ' (monthly)' : ''}` : p.listingTitle ?? p.kind}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900">{formatCurrency(p.amountInCents)}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border', STATUS_STYLE[p.status])}>
                        {p.status === 'CAPTURED' && <CheckCircle2 className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{p.gatewayRef ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
