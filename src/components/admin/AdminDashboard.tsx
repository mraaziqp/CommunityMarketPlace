import React, { useState, useEffect, useTransition, Suspense, lazy } from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  Repeat,
  ShieldCheck,
  AlertTriangle,
  Layers,
  MapPin,
  Compass,
  Zap,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Search,
  Filter,
  Code2,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Clock,
  Wrench,
  FileSpreadsheet,
  X,
  ExternalLink,
  Shield,
  Eye,
  UserCheck,
  UserX,
} from 'lucide-react';
import { AdminAnalyticsReport, ListingModel, SystemLogModel, UserModel } from '../../types';
import { AdminListingRow, AdminMemberRow, api } from '../../api/client';
import { PaymentsPanel } from './PaymentsPanel';
import { formatCurrency } from '../../lib/utils';
import { cn } from '../../lib/utils';

const CategoryRevenueChart = lazy(() => import('./CategoryRevenueChart'));

export type AdminTab =
  | 'payments'
  | 'members'
  | 'listings'
  | 'analytics'
  | 'neighbourhoods'
  | 'velocity'
  | 'appliances'
  | 'audit';

export interface AdminDashboardProps {
  currentUser: UserModel;
  onClose?: () => void;
  isPage?: boolean;
  initialTab?: AdminTab;
  onSelectTab?: (tab: AdminTab) => void;
  onViewListing?: (listing: ListingModel) => void;
}

const rand = (zar: number) => formatCurrency(Math.round(zar * 100));

/**
 * Operator dashboard. App only mounts this for admins, and the report action
 * re-checks the requester's role before returning any data.
 */
export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  onClose,
  isPage = false,
  initialTab = 'payments',
  onSelectTab,
  onViewListing,
}) => {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [report, setReport] = useState<AdminAnalyticsReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Members Management State
  const [members, setMembers] = useState<AdminMemberRow[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [isMembersLoading, setIsMembersLoading] = useState(false);

  // Listings Management State
  const [adminListings, setAdminListings] = useState<AdminListingRow[]>([]);
  const [listingSearch, setListingSearch] = useState('');
  const [isListingsLoading, setIsListingsLoading] = useState(false);

  // Audit Log State
  const [logFilter, setLogFilter] = useState<string>('ALL');
  const [searchLogQuery, setSearchLogQuery] = useState<string>('');
  const [selectedLogForJson, setSelectedLogForJson] = useState<SystemLogModel | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  const isAdmin = currentUser.role === 'ADMIN';

  const fetchReport = () => {
    if (!isAdmin) return;
    setIsLoading(true);
    startTransition(async () => {
      try {
        const data = await api.adminReport(dateRange);
        setReport(data);
        setLoadError(null);
        if (!selectedLogForJson && data.recentSystemLogs.length > 0) {
          setSelectedLogForJson(data.recentSystemLogs[0]);
        }
      } catch (err: any) {
        setLoadError(err?.message || 'The report could not be loaded.');
      }
      setIsLoading(false);
    });
  };

  useEffect(() => {
    fetchReport();
  }, [dateRange]);

  const fetchMembers = React.useCallback(async () => {
    if (!isAdmin) return;
    setIsMembersLoading(true);
    try {
      const data = await api.adminMembers(memberSearch);
      setMembers(data);
    } catch {
      // Ignored
    } finally {
      setIsMembersLoading(false);
    }
  }, [isAdmin, memberSearch]);

  const fetchListings = React.useCallback(async () => {
    if (!isAdmin) return;
    setIsListingsLoading(true);
    try {
      const data = await api.adminListings(listingSearch);
      setAdminListings(data);
    } catch {
      // Ignored
    } finally {
      setIsListingsLoading(false);
    }
  }, [isAdmin, listingSearch]);

  useEffect(() => {
    if (activeTab === 'members') fetchMembers();
  }, [activeTab, fetchMembers]);

  useEffect(() => {
    if (activeTab === 'listings') fetchListings();
  }, [activeTab, fetchListings]);

  const handleToggleVerifiedRole = async (userId: string, currentRole: string) => {
    const nextRole = currentRole === 'VERIFIED_HOST' ? 'USER' : 'VERIFIED_HOST';
    await api.setMemberRole(userId, nextRole);
    await fetchMembers();
  };

  const handleToggleSuspend = async (userId: string, isSuspended: boolean, userName: string) => {
    const action = isSuspended ? 'unsuspend' : 'suspend';
    if (!window.confirm(`Are you sure you want to ${action} ${userName}?`)) return;
    await api.setMemberSuspended(userId, !isSuspended);
    await fetchMembers();
  };

  const handleToggleListingVisibility = async (listingId: string, currentAvailable: boolean) => {
    await api.updateListing(listingId, { isAvailable: !currentAvailable });
    await fetchListings();
  };

  const handleCopyJson = (obj: any) => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  // Defence in depth: never render any admin UI for anyone else.
  if (!isAdmin) return null;

  // Filter system logs
  const filteredLogs = report?.recentSystemLogs.filter((log) => {
    const matchesFilter = logFilter === 'ALL' || log.eventType === logFilter;
    const matchesSearch =
      searchLogQuery.trim() === '' ||
      log.eventType.toLowerCase().includes(searchLogQuery.toLowerCase()) ||
      log.userId.toLowerCase().includes(searchLogQuery.toLowerCase()) ||
      JSON.stringify(log.metadata).toLowerCase().includes(searchLogQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  }) || [];

  const dashboardContent = (
    <div className={cn(
      'relative w-full max-w-7xl bg-[#f8fafc] rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col',
      isPage ? 'min-h-[calc(100vh-6rem)]' : 'max-h-[calc(100dvh-2rem)]'
    )}>
      {/* Top Executive Header */}
        <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 text-white gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/90 text-white flex items-center justify-center border border-purple-400/30 shadow-xs">
              <Activity className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">Admin dashboard</h1>
              </div>
              <p className="text-xs text-slate-400">
                Bookings, co-ops and payments recorded in this browser
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Date Range Selector */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
              {(['7d', '30d', '90d', 'all'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDateRange(r)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer',
                    dateRange === r
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'text-slate-400 hover:text-white'
                  )}
                >
                  {r === 'all' ? 'All Time' : r.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={fetchReport}
              disabled={isLoading || isPending}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('w-4 h-4', (isLoading || isPending) && 'animate-spin')} />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-white border-b border-slate-200 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('payments');
                onSelectTab?.('payments');
              }}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap',
                activeTab === 'payments' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Payments
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('members');
                onSelectTab?.('members');
              }}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap',
                activeTab === 'members' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              <Users className="w-3.5 h-3.5 text-purple-400" />
              Members
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('listings');
                onSelectTab?.('listings');
              }}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap',
                activeTab === 'listings' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              Listings
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('analytics');
                onSelectTab?.('analytics');
              }}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap',
                activeTab === 'analytics'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              Overview
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('neighbourhoods');
                onSelectTab?.('neighbourhoods');
              }}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap',
                activeTab === 'neighbourhoods'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              Neighbourhoods
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('velocity');
                onSelectTab?.('velocity');
              }}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap',
                activeTab === 'velocity'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              Top listings
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('appliances');
                onSelectTab?.('appliances');
              }}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap',
                activeTab === 'appliances'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              <Wrench className="w-3.5 h-3.5 text-sky-400" />
              Shared appliances
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('audit');
                onSelectTab?.('audit');
              }}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap',
                activeTab === 'audit'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              <Code2 className="w-3.5 h-3.5 text-purple-400" />
              Event log
            </button>
          </div>
        </div>

        {/* Dashboard Main Content Scroll Container */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-6 flex-1">
          {loadError && (
            <div role="alert" className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-sm text-rose-800">
              {loadError}
            </div>
          )}

          {/* Headline figures */}
          {report && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* GMV Metric */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Gross bookings
                  </span>
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {rand(report.kpis.totalGMVZAR)}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {report.kpis.gmvGrowthPct === null ? (
                      <span className="text-[11px] text-slate-400">No earlier period to compare</span>
                    ) : (
                      <>
                        <span
                          className={cn(
                            'inline-flex items-center text-xs font-bold',
                            report.kpis.gmvGrowthPct >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          )}
                        >
                          {report.kpis.gmvGrowthPct >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          {report.kpis.gmvGrowthPct >= 0 ? '+' : ''}
                          {report.kpis.gmvGrowthPct}%
                        </span>
                        <span className="text-[11px] text-slate-400">vs previous period</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Active Subscriptions & Fractional Utilization */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Co-op members
                  </span>
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
                    <Repeat className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {report.kpis.activeSubscriptionsCount}{' '}
                    <span className="text-xs font-semibold text-slate-400">active</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-bold text-indigo-600">
                      {report.kpis.fractionalUtilizationRate}% of this month's turns used
                    </span>
                  </div>
                </div>
              </div>

              {/* Community Users & Verified Host Ratio */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Members
                  </span>
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-100">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {report.kpis.totalUsersCount}{' '}
                    <span className="text-xs font-semibold text-slate-400">members</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-purple-700">
                      {report.kpis.verifiedHostRatio}% verified hosts
                    </span>
                    <span className="text-[10px] text-slate-400">· avg trust {report.kpis.averageTrustScore}</span>
                  </div>
                </div>
              </div>

              {/* Handovers vs Disputes */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Pickups completed
                  </span>
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-100">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {report.kpis.completedHandoversCount}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-semibold text-slate-500">
                      {report.kpis.activeDisputesCount} open {report.kpis.activeDisputesCount === 1 ? 'dispute' : 'disputes'}
                      {report.kpis.activeDisputesCount > 0 ? ` (${report.kpis.disputeRate}% of bookings)` : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Tab Contents */}

          {/* TAB 1: Analytics & Category Performance */}
          {activeTab === 'analytics' && report && (
            <div className="space-y-6">
              {/* Category Performance Chart */}
              <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Revenue and bookings by category
                    </h3>
                    <p className="text-xs text-slate-500">
                      Rental and co-op fees in the selected period
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-indigo-700 font-semibold">
                      <span className="w-3 h-3 rounded-sm bg-indigo-600" /> Revenue (Rands)
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-700 font-semibold">
                      <span className="w-3 h-3 rounded-sm bg-amber-500" /> Booking Volume
                    </span>
                  </div>
                </div>

                <Suspense
                  fallback={
                    <div className="h-72 w-full flex items-center justify-center bg-slate-50/50 rounded-xl border border-slate-100 animate-pulse text-xs text-slate-400">
                      Loading chart…
                    </div>
                  }
                >
                  <CategoryRevenueChart data={report.categoryPerformance} />
                </Suspense>
              </div>

              {/* Detailed Category Table */}
              <div className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xs">
                <div className="px-6 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Categories
                  </h4>

                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3">Category</th>
                        <th className="px-4 py-3">Revenue</th>
                        <th className="px-4 py-3">Bookings</th>
                        <th className="px-4 py-3">Listings</th>
                        <th className="px-4 py-3">Co-op members</th>
                        <th className="px-4 py-3 text-right">Average sale</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.categoryPerformance.map((cat) => (
                        <tr key={cat.categoryId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-3.5 font-bold text-slate-900">{cat.categoryName}</td>
                          <td className="px-4 py-3.5 font-semibold text-indigo-600">
                            {rand(cat.revenueZAR)}
                          </td>
                          <td className="px-4 py-3.5 text-slate-700 font-medium">{cat.bookingCount}</td>
                          <td className="px-4 py-3.5 text-slate-700">{cat.activeListingsCount}</td>
                          <td className="px-4 py-3.5 text-slate-700">{cat.subscriberCount}</td>
                          <td className="px-4 py-3.5 font-bold text-slate-900 text-right">
                            {rand(cat.avgTicketZAR)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Neighbourhoods */}
          {activeTab === 'neighbourhoods' && report && (
            <div className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                <h3 className="text-sm font-bold text-slate-900">Activity by neighbourhood</h3>
                <p className="text-[11px] text-slate-500">Where listings are, and where they are being used</p>
              </div>
              {report.neighbourhoodActivity.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-500">No listings yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3">Neighbourhood</th>
                        <th className="px-4 py-3">Listings</th>
                        <th className="px-4 py-3">Bookings</th>
                        <th className="px-4 py-3">Co-op members</th>
                        <th className="px-4 py-3 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.neighbourhoodActivity.map((n) => (
                        <tr key={n.neighborhood} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-3.5 font-bold text-slate-900">{n.neighborhood}</td>
                          <td className="px-4 py-3.5 text-slate-700">{n.activeListings}</td>
                          <td className="px-4 py-3.5 text-slate-700">{n.totalBookings}</td>
                          <td className="px-4 py-3.5 text-slate-700">{n.activeSubscribers}</td>
                          <td className="px-4 py-3.5 font-semibold text-indigo-600 text-right">{rand(n.revenueZAR)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Rental Velocity & Trending Items */}
          {activeTab === 'velocity' && report && (
            <div className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Top listings
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Ranked by revenue in the selected period
                  </p>
                </div>

              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3">Listing</th>
                      <th className="px-4 py-3">Neighborhood</th>
                      <th className="px-4 py-3">Host</th>
                      <th className="px-4 py-3">Bookings / turns</th>
                      <th className="px-4 py-3">Utilisation</th>
                      <th className="px-4 py-3">Revenue</th>
                      <th className="px-4 py-3">Avg. rental</th>
                      <th className="px-4 py-3 text-right">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.rentalVelocity.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-3.5">
                          <div className="font-bold text-slate-900">{item.title}</div>
                          <span className="text-[10px] text-slate-400">{item.categoryName}</span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">{item.neighborhood}</td>
                        <td className="px-4 py-3.5 font-medium text-slate-800">{item.ownerName}</td>
                        <td className="px-4 py-3.5 text-slate-700">{item.totalBookings}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{item.utilizationRatePct}%</span>
                            <div className="w-16 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${item.utilizationRatePct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-bold text-indigo-600">
                          {rand(item.totalRevenueZAR)}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">{item.avgRentalHours === null ? '—' : item.avgRentalHours >= 24 ? `${Math.round((item.avgRentalHours / 24) * 10) / 10} days` : `${item.avgRentalHours} hrs`}</td>
                        <td className="px-4 py-3.5 font-bold text-amber-500 text-right">
                          {item.rating === null ? 'New' : `★ ${item.rating.toFixed(2)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Shared appliances */}
          {activeTab === 'appliances' && report && (
            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-sky-600" />
                  Shared appliances
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">How full each co-op is and how much it is being used this month</p>
              </div>
              {report.sharedAppliances.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-500">No shared appliances listed yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.sharedAppliances.map((app) => {
                    const isFull = app.activeSubscribers >= app.maxCapacity;
                    return (
                      <div key={app.listingId} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900">{app.title}</span>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap',
                              isFull ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            )}
                          >
                            {isFull ? 'Full' : `${app.maxCapacity - app.activeSubscribers} open`}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {app.hostName} · {app.neighborhood} · {app.activeSubscribers} of {app.maxCapacity} households
                        </p>
                        <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-semibold">TURNS THIS MONTH</span>
                            <span className="font-bold text-slate-900">{app.cyclesLoggedThisMonth}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-semibold">TURNS LEFT</span>
                            <span className="font-bold text-slate-900">{app.remainingQuotaThisMonth}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-semibold">LAST USED</span>
                            <span className="font-bold text-slate-900">
                              {app.lastCycleAt ? new Date(app.lastCycleAt).toLocaleDateString() : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: Payments */}
          {activeTab === 'payments' && <PaymentsPanel />}

          {/* TAB: Members */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Members Directory</h3>
                  <p className="text-xs text-slate-500">Manage member privileges, verified hosts, and suspensions</p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search name, email..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 outline-none"
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xs">
                {isMembersLoading ? (
                  <div className="p-12 text-center text-xs text-slate-400">Loading members…</div>
                ) : members.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400">No members found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-3">Member</th>
                          <th className="px-4 py-3">Role</th>
                          <th className="px-4 py-3">Joined</th>
                          <th className="px-4 py-3">Listings</th>
                          <th className="px-4 py-3">Bookings</th>
                          <th className="px-4 py-3">Last Active</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {members.map((m) => (
                          <tr key={m.user.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-6 py-3.5">
                              <div className="font-bold text-slate-900">{m.user.name}</div>
                              <div className="text-[11px] text-slate-500">{m.user.email}</div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                                  m.user.role === 'ADMIN'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : m.user.role === 'VERIFIED_HOST'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                )}
                              >
                                {m.user.role}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-600">
                              {new Date(m.user.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-4 py-3.5 text-slate-700 font-semibold">{m.listings}</td>
                            <td className="px-4 py-3.5 text-slate-700 font-semibold">{m.bookings}</td>
                            <td className="px-4 py-3.5 text-slate-500">
                              {m.lastActiveAt ? new Date(m.lastActiveAt).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-4 py-3.5">
                              {m.user.suspended ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  Suspended
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Active
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-3.5 text-right space-x-2 whitespace-nowrap">
                              {m.user.role !== 'ADMIN' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleVerifiedRole(m.user.id, m.user.role)}
                                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer transition-colors"
                                  >
                                    {m.user.role === 'VERIFIED_HOST' ? 'Remove verified' : 'Make verified'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSuspend(m.user.id, !!m.user.suspended, m.user.name)}
                                    className={cn(
                                      'px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors',
                                      m.user.suspended
                                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                        : 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                                    )}
                                  >
                                    {m.user.suspended ? 'Unsuspend' : 'Suspend'}
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: Listings */}
          {activeTab === 'listings' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Listings Moderation</h3>
                  <p className="text-xs text-slate-500">Inspect equipment, check host status and moderate visibility</p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={listingSearch}
                    onChange={(e) => setListingSearch(e.target.value)}
                    placeholder="Search listing title, host..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 outline-none"
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xs">
                {isListingsLoading ? (
                  <div className="p-12 text-center text-xs text-slate-400">Loading listings…</div>
                ) : adminListings.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400">No listings found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-3">Listing</th>
                          <th className="px-4 py-3">Host</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Price / Rate</th>
                          <th className="px-4 py-3">Bookings</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-6 py-3 text-right">Moderation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {adminListings.map((row) => (
                          <tr key={row.listing.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-6 py-3.5">
                              <div className="flex items-center gap-3">
                                {row.listing.images?.[0] ? (
                                  <img
                                    src={row.listing.images[0]}
                                    alt=""
                                    referrerPolicy="no-referrer"
                                    className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 font-bold text-[10px]">
                                    Item
                                  </div>
                                )}
                                <div>
                                  <div className="font-bold text-slate-900 line-clamp-1">{row.listing.title}</div>
                                  <div className="text-[11px] text-slate-500">{row.listing.neighborhood || row.listing.city}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="font-medium text-slate-900">{row.listing.owner.name}</div>
                              <div className="text-[11px] text-slate-500">{row.ownerEmail}</div>
                              {row.ownerSuspended && (
                                <span className="text-[10px] text-rose-600 font-bold">Host suspended</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-slate-600 capitalize">
                              {row.listing.category.replace('_', ' ')}
                            </td>
                            <td className="px-4 py-3.5 font-bold text-slate-900">
                              {formatCurrency(row.listing.pricingTiers?.[0]?.priceInCents ?? 0)}
                            </td>
                            <td className="px-4 py-3.5 text-slate-700 font-semibold">
                              {row.stats.totalBookings}
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                                  row.listing.isAvailable
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                )}
                              >
                                {row.listing.isAvailable ? 'Live' : 'Hidden'}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-right space-x-2 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => onViewListing?.(row.listing)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer transition-colors"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleListingVisibility(row.listing.id, row.listing.isAvailable)}
                                className={cn(
                                  'px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors',
                                  row.listing.isAvailable
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                                )}
                              >
                                {row.listing.isAvailable ? 'Hide' : 'Show'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: Audit / Event Log */}
          {activeTab === 'audit' && report && (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider shrink-0">
                    Show:
                  </span>
                  <select
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 font-semibold outline-none text-slate-800"
                  >
                    <option value="ALL">All events ({report.recentSystemLogs.length})</option>
                    {Array.from(new Set(report.recentSystemLogs.map((l) => l.eventType)))
                      .sort()
                      .map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchLogQuery}
                    onChange={(e) => setSearchLogQuery(e.target.value)}
                    placeholder="Search events…"
                    aria-label="Search events"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 outline-none"
                  />
                </div>
              </div>

              {/* Master-Detail Audit Stream + JSON Inspector */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left Stream List */}
                <div className="lg:col-span-7 overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xs">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Events ({filteredLogs.length})
                    </span>

                  </div>

                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {filteredLogs.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        No events match this filter.
                      </div>
                    ) : (
                      filteredLogs.map((log) => {
                        const isSelected = selectedLogForJson?.id === log.id;
                        return (
                          <div
                            key={log.id}
                            onClick={() => setSelectedLogForJson(log)}
                            className={cn(
                              'p-3.5 transition-all cursor-pointer flex items-center justify-between text-xs',
                              isSelected
                                ? 'bg-indigo-50/70 border-l-4 border-indigo-600'
                                : 'hover:bg-slate-50'
                            )}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    'px-2 py-0.5 rounded text-[10px] font-mono font-bold',
                                    log.eventType === 'BOOKING_CREATED' && 'bg-blue-100 text-blue-800',
                                    log.eventType === 'HANDOVER_COMPLETED' && 'bg-emerald-100 text-emerald-800',
                                    log.eventType === 'FRACTIONAL_USE_LOGGED' && 'bg-amber-100 text-amber-800',
                                    log.eventType === 'AUTH_SIGNIN' && 'bg-purple-100 text-purple-800',
                                    log.eventType === 'AUTH_SIGNUP' && 'bg-indigo-100 text-indigo-800',
                                    log.eventType === 'IMAGE_UPLOADED' && 'bg-sky-100 text-sky-800',
                                    log.eventType === 'LISTING_CREATED' && 'bg-slate-200 text-slate-800'
                                  )}
                                >
                                  {log.eventType}
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  User: {log.userId}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 font-mono truncate max-w-sm">
                                target: {log.targetId}
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-[10px] text-slate-400 block font-mono">
                                {new Date(log.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 ml-auto mt-1" />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Interactive JSON Inspector */}
                <div className="lg:col-span-5 rounded-2xl bg-slate-950 text-slate-200 border border-slate-800 p-4 font-mono text-xs flex flex-col justify-between max-h-96 overflow-hidden shadow-2xs">
                  {selectedLogForJson ? (
                    <div className="flex flex-col h-full overflow-hidden">
                      <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-800 shrink-0">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                          <Code2 className="w-3.5 h-3.5" />
                          <span>Event details</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyJson(selectedLogForJson)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors cursor-pointer"
                        >
                          {copiedJson ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400 font-bold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy JSON</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="overflow-y-auto flex-1 text-[11px] leading-relaxed text-sky-300">
                        <pre className="selection:bg-slate-800 selection:text-white">
                          {JSON.stringify(
                            {
                              id: selectedLogForJson.id,
                              eventType: selectedLogForJson.eventType,
                              userId: selectedLogForJson.userId,
                              targetId: selectedLogForJson.targetId,
                              createdAt: selectedLogForJson.createdAt,
                              metadata: selectedLogForJson.metadata,
                            },
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                      Select an event to see its details.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
  );

  if (isPage) {
    return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">{dashboardContent}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      {dashboardContent}
    </div>
  );
};
