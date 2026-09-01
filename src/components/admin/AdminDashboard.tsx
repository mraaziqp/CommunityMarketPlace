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
} from 'lucide-react';
import {
  AdminAnalyticsReport,
  ExecutiveKPIs,
  CategoryPerformanceData,
  RentalVelocityItem,
  GeospatialDensityData,
  FractionalApplianceTelemetry,
  SystemLogModel,
  UserModel,
} from '../../types';
import { getExecutiveAdminReport, bootstrapAdmin } from '../../../actions/admin';
import { cn } from '../../lib/utils';

const CategoryRevenueChart = lazy(() => import('./CategoryRevenueChart'));

export interface AdminDashboardProps {
  currentUser: UserModel | null;
  onClose: () => void;
  onElevateToAdmin?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  onClose,
  onElevateToAdmin,
}) => {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [activeTab, setActiveTab] = useState<'analytics' | 'velocity' | 'geospatial' | 'fleet' | 'audit'>(
    'analytics'
  );
  const [report, setReport] = useState<AdminAnalyticsReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Audit Log State
  const [logFilter, setLogFilter] = useState<string>('ALL');
  const [searchLogQuery, setSearchLogQuery] = useState<string>('');
  const [selectedLogForJson, setSelectedLogForJson] = useState<SystemLogModel | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  // Founder Bootstrap Form State
  const [bootstrapEmailInput, setBootstrapEmailInput] = useState<string>(
    currentUser?.email || 'admin@sharehub.community'
  );
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [bootstrapMessage, setBootstrapMessage] = useState<string | null>(null);

  // Fetch report from Server Action
  const fetchReport = () => {
    setIsLoading(true);
    startTransition(async () => {
      const res = await getExecutiveAdminReport(dateRange);
      if (res.success && res.data) {
        setReport(res.data);
        if (!selectedLogForJson && res.data.recentSystemLogs.length > 0) {
          setSelectedLogForJson(res.data.recentSystemLogs[0]);
        }
      }
      setIsLoading(false);
    });
  };

  const handleRunBootstrap = async (emailToBootstrap: string) => {
    setIsBootstrapping(true);
    setBootstrapMessage(null);
    try {
      const res = await bootstrapAdmin(emailToBootstrap);
      if (res.success) {
        setBootstrapMessage(res.message || `Account ${emailToBootstrap} elevated to ADMIN.`);
        if (onElevateToAdmin) {
          onElevateToAdmin();
        }
        fetchReport();
      } else {
        setBootstrapMessage(res.error || 'Failed to bootstrap account.');
      }
    } catch (err: any) {
      setBootstrapMessage(err.message || 'Error executing bootstrapAdmin.');
    } finally {
      setIsBootstrapping(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [dateRange]);

  const handleCopyJson = (obj: any) => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  // If user is not admin, show security access notice with instant founder bootstrapping
  if (!currentUser || currentUser.role !== 'ADMIN') {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 text-center space-y-4 border border-slate-200 shadow-2xl animate-in zoom-in-95">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Restricted Executive Command Center</h3>
            <p className="text-xs text-slate-500 mt-1">
              Access to <code>/admin</code> requires verified <code>ADMIN</code> privileges.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs text-slate-600 space-y-1">
            <span className="font-semibold text-slate-800 block">Current Session Role:</span>
            <div className="flex items-center justify-between">
              <span>{currentUser ? `${currentUser.name} (${currentUser.role})` : 'Not signed in'}</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                UNAUTHORIZED
              </span>
            </div>
          </div>

          {/* Interactive Founder Bootstrap Tool */}
          <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-200 text-left space-y-2.5">
            <div className="flex items-center gap-1.5 font-bold text-xs text-purple-900">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>Founder Account Elevation Action</span>
            </div>
            <p className="text-[11px] text-purple-700 leading-relaxed">
              Enter your email to run the <code>bootstrapAdmin</code> Server Action and permanently unlock Executive Admin privileges.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={bootstrapEmailInput}
                onChange={(e) => setBootstrapEmailInput(e.target.value)}
                placeholder="founder@example.com"
                className="flex-1 px-3 py-1.5 text-xs bg-white rounded-xl border border-purple-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono"
              />
              <button
                type="button"
                onClick={() => handleRunBootstrap(bootstrapEmailInput)}
                disabled={isBootstrapping || !bootstrapEmailInput}
                className="px-3 py-1.5 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 disabled:opacity-50 rounded-xl shadow-xs transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
              >
                {isBootstrapping ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Bootstrap</span>
              </button>
            </div>
            {bootstrapMessage && (
              <p className="text-[10px] font-mono text-purple-900 bg-purple-100/80 p-2 rounded-lg border border-purple-200">
                {bootstrapMessage}
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Back to Marketplace
            </button>
          </div>
        </div>
      </div>
    );
  }

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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-7xl bg-[#f8fafc] rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        {/* Top Executive Header */}
        <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 text-white gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/90 text-white flex items-center justify-center border border-purple-400/30 shadow-xs">
              <Activity className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">
                  Executive Admin Intelligence
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-700">
                  /admin • Live Neon Aggregations
                </span>
              </div>
              <p className="text-xs text-slate-400">
                P2P Market Liquidity, PostGIS Geospatial Hotspots & Fleet Telemetry
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
              title="Refresh Analytics"
            >
              <RefreshCw className={cn('w-4 h-4', (isLoading || isPending) && 'animate-spin')} />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-white border-b border-slate-200 overflow-x-auto shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap',
                activeTab === 'analytics'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              Category & Revenue Metrics
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('geospatial')}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap',
                activeTab === 'geospatial'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              Geospatial Demand & Supply Deficits
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('velocity')}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap',
                activeTab === 'velocity'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              Rental Velocity & Asset Yield
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('fleet')}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap',
                activeTab === 'fleet'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              <Wrench className="w-3.5 h-3.5 text-sky-400" />
              Fractional Fleet Telemetry
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap',
                activeTab === 'audit'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              <Code2 className="w-3.5 h-3.5 text-purple-400" />
              SystemLogs Audit Stream
            </button>
          </div>
        </div>

        {/* Dashboard Main Content Scroll Container */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-6 flex-1">
          {/* 1. Core Executive KPIs (4 Aggregated Metric Cards) */}
          {report && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* GMV Metric */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Total GMV / Volume
                  </span>
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    R {report.kpis.totalGMVZAR.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="inline-flex items-center text-xs font-bold text-emerald-600">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      +{report.kpis.gmvGrowthPct}%
                    </span>
                    <span className="text-[11px] text-slate-400">vs prior period</span>
                  </div>
                </div>
              </div>

              {/* Active Subscriptions & Fractional Utilization */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Active Co-Ops & Utilization
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
                      {report.kpis.fractionalUtilizationRate}% fleet capacity
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                      Zero Waste
                    </span>
                  </div>
                </div>
              </div>

              {/* Community Users & Verified Host Ratio */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Community & Host Ratio
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
                      {report.kpis.verifiedHostRatio}% Verified Hosts
                    </span>
                    <span className="text-[10px] text-slate-400">• Trust {report.kpis.averageTrustScore}/100</span>
                  </div>
                </div>
              </div>

              {/* Handovers vs Disputes */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Completed Handovers
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
                      {report.kpis.activeDisputesCount} active dispute ({report.kpis.disputeRate}%)
                    </span>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                      99.7% Trust Index
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
                      Category Revenue & Booking Volume Breakdown
                    </h3>
                    <p className="text-xs text-slate-500">
                      Comparison of Gross Revenue (ZAR) against total completed booking transactions
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
                      Loading analytics visualization...
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
                    Category Unit Economics & Average Ticket Value
                  </h4>
                  <span className="text-[11px] text-slate-500 font-mono">5 Categories Indexed</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3">Category Name</th>
                        <th className="px-4 py-3">Gross Revenue</th>
                        <th className="px-4 py-3">Bookings</th>
                        <th className="px-4 py-3">Active Listings</th>
                        <th className="px-4 py-3">Subscribers</th>
                        <th className="px-4 py-3 text-right">Avg Ticket Size</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.categoryPerformance.map((cat) => (
                        <tr key={cat.categoryId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-3.5 font-bold text-slate-900">{cat.categoryName}</td>
                          <td className="px-4 py-3.5 font-semibold text-indigo-600">
                            R {cat.revenueZAR.toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 text-slate-700 font-medium">{cat.bookingCount}</td>
                          <td className="px-4 py-3.5 text-slate-700">{cat.activeListingsCount}</td>
                          <td className="px-4 py-3.5 text-slate-700">{cat.subscriberCount}</td>
                          <td className="px-4 py-3.5 font-bold text-slate-900 text-right">
                            R {cat.avgTicketZAR}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Geospatial Demand & Density Heatmap */}
          {activeTab === 'geospatial' && report && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Compass className="w-4 h-4 text-emerald-600" />
                      PostGIS Proximity & Neighborhood Supply Deficit Index
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Identifies high-demand zones where user search queries outpace local available supply.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                    Host Recruitment Target Map
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {report.geospatialDemand.map((geo) => (
                    <div
                      key={geo.zone}
                      className={cn(
                        'p-4 rounded-2xl border transition-all flex flex-col justify-between',
                        geo.status === 'deficit'
                          ? 'bg-rose-50/40 border-rose-200'
                          : geo.status === 'balanced'
                          ? 'bg-emerald-50/30 border-emerald-200'
                          : 'bg-slate-50 border-slate-200'
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-slate-900">{geo.zone}</span>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                              geo.status === 'deficit'
                                ? 'bg-rose-100 text-rose-800'
                                : geo.status === 'balanced'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-800'
                            )}
                          >
                            {geo.status === 'deficit'
                              ? '⚠️ Supply Deficit'
                              : geo.status === 'balanced'
                              ? '✓ Balanced'
                              : 'Surplus'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mb-3">{geo.neighborhood}</p>

                        <div className="grid grid-cols-2 gap-2 text-xs mb-3 bg-white p-2.5 rounded-xl border border-slate-200/80">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-semibold">
                              ACTIVE SUPPLY
                            </span>
                            <span className="font-bold text-slate-900">{geo.activeListings} listings</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-semibold">
                              SEARCH DEMAND
                            </span>
                            <span className="font-bold text-indigo-600">{geo.searchDemandCount} searches</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/80 text-[11px]">
                        <span className="text-slate-500 font-medium">Recruit Hosts for: </span>
                        <span className="font-bold text-slate-800">{geo.topMissingCategory}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Rental Velocity & Trending Items */}
          {activeTab === 'velocity' && report && (
            <div className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Highest Utilization Assets & Rental Velocity
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Ranked by booking frequency, occupancy rate, and turnaround hours
                  </p>
                </div>
                <span className="text-xs text-indigo-600 font-semibold">Top Performing Fleet</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3">Asset Title</th>
                      <th className="px-4 py-3">Neighborhood</th>
                      <th className="px-4 py-3">Host</th>
                      <th className="px-4 py-3">Utilization</th>
                      <th className="px-4 py-3">Total Volume</th>
                      <th className="px-4 py-3">Turnaround</th>
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
                          R {item.totalRevenueZAR.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">{item.avgTurnaroundHours} hrs</td>
                        <td className="px-4 py-3.5 font-bold text-amber-500 text-right">
                          ★ {item.rating.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Fractional Fleet Telemetry & Preventive Maintenance */}
          {activeTab === 'fleet' && report && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-sky-600" />
                      Shared Appliance Telemetry & Operational Health
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Monitors duty cycles across washing machines, solar stations, and 3D printers to dispatch preventive maintenance before breakdowns.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.fractionalTelemetry.map((app) => (
                    <div
                      key={app.listingId}
                      className={cn(
                        'p-4.5 rounded-2xl border transition-all flex flex-col justify-between',
                        app.maintenanceStatus === 'maintenance_due'
                          ? 'bg-amber-50/40 border-amber-200'
                          : app.maintenanceStatus === 'inspection_required'
                          ? 'bg-purple-50/40 border-purple-200'
                          : 'bg-white border-slate-200'
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-900">{app.title}</span>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold',
                              app.maintenanceStatus === 'healthy'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : app.maintenanceStatus === 'maintenance_due'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-purple-100 text-purple-800 border border-purple-300'
                            )}
                          >
                            {app.maintenanceStatus === 'healthy'
                              ? '✓ Fleet Healthy'
                              : app.maintenanceStatus === 'maintenance_due'
                              ? '⚠️ Service Due'
                              : '🔍 Inspection Required'}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 mb-3">
                          Host: <strong>{app.hostName}</strong> • {app.neighborhood} • Active Co-Op Members:{' '}
                          <strong>{app.activeSubscribers}/{app.maxCapacity}</strong>
                        </div>

                        <div className="space-y-2 mb-3">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-600">Wear & Tear Index</span>
                            <span
                              className={cn(
                                app.wearTearPct > 80 ? 'text-amber-600 font-bold' : 'text-slate-800'
                              )}
                            >
                              {app.wearTearPct}% wear
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                app.wearTearPct > 80
                                  ? 'bg-amber-500'
                                  : app.wearTearPct > 60
                                  ? 'bg-indigo-500'
                                  : 'bg-emerald-500'
                              )}
                              style={{ width: `${app.wearTearPct}%` }}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-semibold">
                              MONTHLY CYCLES
                            </span>
                            <span className="font-bold text-slate-900">
                              {app.cyclesLoggedThisMonth} runs logged
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-semibold">
                              EST. LIFESPAN LEFT
                            </span>
                            <span className="font-bold text-slate-900">
                              ~{app.estimatedLifespanRemainingCycles} cycles
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2.5 mt-3 border-t border-slate-200/80 text-[10px] text-slate-400 flex items-center justify-between">
                        <span>Last Cycle Triggered: {app.lastCycleAt}</span>
                        <span className="text-indigo-600 font-semibold">IoT Relay Active</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SystemLogs Real-Time Operations Stream & JSON Inspector */}
          {activeTab === 'audit' && report && (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider shrink-0">
                    Event Filter:
                  </span>
                  <select
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 font-semibold outline-none text-slate-800"
                  >
                    <option value="ALL">All Event Types ({report.recentSystemLogs.length})</option>
                    <option value="BOOKING_CREATED">BOOKING_CREATED</option>
                    <option value="HANDOVER_COMPLETED">HANDOVER_COMPLETED</option>
                    <option value="FRACTIONAL_USE_LOGGED">FRACTIONAL_USE_LOGGED</option>
                    <option value="AUTH_SIGNIN">AUTH_SIGNIN</option>
                    <option value="AUTH_SIGNUP">AUTH_SIGNUP</option>
                    <option value="IMAGE_UPLOADED">IMAGE_UPLOADED</option>
                    <option value="LISTING_CREATED">LISTING_CREATED</option>
                  </select>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchLogQuery}
                    onChange={(e) => setSearchLogQuery(e.target.value)}
                    placeholder="Search payload metadata or user..."
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
                      Immutable System Logs ({filteredLogs.length})
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Neon JSONB Audit Trail</span>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {filteredLogs.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        No system events match current filter.
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
                          <span>JSONB Metadata Inspector</span>
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
                      Select a log record from the stream to inspect its JSONB metadata payload.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
