import { useState, useEffect } from 'react';
import Sidebar from '../Shared/Sidebar';
import AdminHeader from '../Shared/AdminHeader';
import { useAuth } from '@/hooks/useAuth';
import { dashboardService, DashboardMetrics } from '@/services/dashboardService';

export default function DashboardPage() {
  const { user: currentAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview'>('overview');

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dashboardService.getAdminDashboardMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load metrics', err);
      setError('Failed to load dashboard metrics. Please check your connection or try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'overview') {
      loadMetrics();
    }
  }, [activeTab]);

  return (
    <div className="flex h-screen bg-[radial-gradient(circle_at_top_right,_rgba(11,130,82,0.10),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#f5f7fb_100%)] text-slate-800 font-sans overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative">
        <AdminHeader />

        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Top Dashboard Welcome Banner */}
            <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(11,130,82,0.08),transparent_30%,rgba(15,118,110,0.03))]" />
              <div className="relative p-6 sm:p-8 lg:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">Admin Control Center</h1>
                  <p className="mt-2 text-sm sm:text-base text-slate-600">
                    Welcome back, <strong className="text-emerald-700">{currentAdmin?.name || 'Administrator'}</strong>. Oversee store performance, manage team credentials, and configure global inventory system rules.
                  </p>
                </div>
              </div>
            </section>

            {/* TAB CONTENT: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                
                {error ? (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                      <span className="material-symbols-outlined text-3xl">error</span>
                    </div>
                    <h3 className="text-xl font-bold text-red-900 mb-2">Unable to load dashboard</h3>
                    <p className="text-red-700 max-w-md mx-auto mb-6">{error}</p>
                    <button 
                      onClick={loadMetrics}
                      disabled={loading}
                      className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold shadow-sm hover:bg-red-700 transition-colors disabled:opacity-70 flex items-center gap-2"
                    >
                      <span className={`material-symbols-outlined text-[20px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
                      {loading ? 'Retrying...' : 'Retry'}
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Snapshot Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-inner">
                          <span className="material-symbols-outlined text-2xl">payments</span>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Gross Sales Today</p>
                          <p className="text-2xl font-black text-slate-900">Rs. {metrics?.grossSalesToday.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${metrics?.salesPercentageChange && metrics.salesPercentageChange > 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-slate-600 bg-slate-50 border-slate-200'}`}>
                            {metrics?.salesPercentageChange && metrics.salesPercentageChange > 0 ? '+' : ''}{metrics?.salesPercentageChange?.toFixed(1) || 0}% vs yesterday
                          </span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shadow-inner">
                          <span className="material-symbols-outlined text-2xl">point_of_sale</span>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">POS Registers</p>
                          <p className="text-2xl font-black text-slate-900">{metrics?.activeRegisters || 0} Active</p>
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Cashier Users</span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shadow-inner">
                          <span className="material-symbols-outlined text-2xl">warning</span>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Stock Alerts</p>
                          <p className="text-2xl font-black text-amber-600">{metrics?.activeStockAlerts || 0} Items</p>
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">Below threshold rules</span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shadow-inner">
                          <span className="material-symbols-outlined text-2xl">dns</span>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Supermarket Health</p>
                          <p className="text-2xl font-black text-slate-900">{metrics?.supermarketHealth?.toFixed(1) || '100.0'}%</p>
                          <span className="text-[10px] font-bold text-[#0b8252] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Stock Availability</span>
                        </div>
                      </div>
                    </div>

                    {/* Analytical Charts and Tickers */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Sales Hourly Bar Chart */}
                      <div className="bg-white rounded-[1.75rem] border border-slate-200 p-6 shadow-sm lg:col-span-2">
                        <div className="flex justify-between items-center mb-6">
                          <div>
                            <h3 className="font-bold text-lg text-slate-800">Today's Sales Curve</h3>
                            <p className="text-xs text-slate-500">Hourly gross revenue tracking (LKR)</p>
                          </div>
                          <span className="text-xs font-bold text-[#0b8252] bg-emerald-50 px-2 py-1 rounded border border-emerald-100">Live Counter</span>
                        </div>
                        <div className="h-[220px] flex items-end justify-between px-2 gap-4 border-b border-slate-100 pb-2 relative">
                          <div className="absolute top-[25%] w-full border-t border-dashed border-slate-100"></div>
                          <div className="absolute top-[50%] w-full border-t border-dashed border-slate-100"></div>
                          <div className="absolute top-[75%] w-full border-t border-dashed border-slate-100"></div>
                          
                          {[8, 10, 12, 14, 16, 18, 20].map((hour, i) => {
                            const val = metrics?.salesHourly?.[hour] || 0;
                            const maxSales = Math.max(...(metrics?.salesHourly || [1]), 1);
                            const height = Math.max((val / maxSales) * 100, 5);
                            const t = hour > 12 ? `${hour - 12} PM` : (hour === 12 ? '12 PM' : `${hour} AM`);
                            return (
                              <div key={i} className="flex flex-col items-center gap-2 w-full h-full justify-end group cursor-pointer relative z-10" title={`Rs. ${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}>
                                <div className="w-full max-w-[44px] bg-gradient-to-t from-[#0b8252]/20 to-[#0b8252] rounded-t-lg transition-all group-hover:scale-y-[1.03]" style={{ height: `${height}%` }}></div>
                                <span className="text-[10px] font-bold text-slate-400 mt-1">{t}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Top Selling Products */}
                      <div className="bg-white rounded-[1.75rem] border border-slate-200 p-6 shadow-sm flex flex-col">
                        <div className="mb-4">
                          <h3 className="font-bold text-lg text-slate-800">Top Performing Products</h3>
                          <p className="text-xs text-slate-500">By gross revenue (Today)</p>
                        </div>
                        <div className="flex flex-col gap-4 flex-1 justify-center">
                          {metrics?.topSellingProducts && metrics.topSellingProducts.length > 0 ? (
                            metrics.topSellingProducts.map((prod, idx) => {
                              const maxTotal = metrics.topSellingProducts[0].total;
                              const widthPct = Math.max((prod.total / maxTotal) * 100, 5);
                              return (
                                <div key={idx} className="space-y-1.5">
                                  <div className="flex justify-between text-xs">
                                    <span className="font-bold text-slate-800 truncate pr-2">{prod.name}</span>
                                    <span className="font-black text-[#0b8252] whitespace-nowrap">Rs. {(prod.total / 1000).toFixed(1)}K</span>
                                  </div>
                                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                                    <div className="bg-gradient-to-r from-[#0b8252]/60 to-[#0b8252] h-1.5 rounded-full" style={{ width: `${widthPct}%` }}></div>
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-medium">{prod.qty} units sold</p>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-center py-6 text-slate-400">
                              <span className="material-symbols-outlined text-3xl mb-2 opacity-50">inventory_2</span>
                              <p className="text-sm">No product sales today</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Cashier Counters & Recent Overrides */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Active Register counters */}
                      <div className="bg-white rounded-[1.75rem] border border-slate-200 p-6 shadow-sm">
                        <h3 className="font-bold text-lg text-slate-800 mb-4">Register Terminal Activity</h3>
                        <div className="space-y-4">
                          {metrics?.registerActivity && metrics.registerActivity.length > 0 ? (
                            metrics.registerActivity.map((reg) => (
                              <div key={reg.num} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center font-bold text-[#0b8252]">
                                    #{reg.num}
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-800 text-sm">{reg.user}</p>
                                    <p className="text-xs text-slate-500">{reg.items} items processed</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-slate-900 text-sm">Rs. {reg.sales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                  <span className={`inline-block px-2 py-0.5 text-[9px] font-bold rounded-full text-emerald-600 bg-emerald-50`}>{reg.status}</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-slate-500 text-center py-4">No register activity today.</p>
                          )}
                        </div>
                      </div>

                      {/* Admin Audit timeline */}
                      <div className="bg-white rounded-[1.75rem] border border-slate-200 p-6 shadow-sm">
                        <h3 className="font-bold text-lg text-slate-800 mb-4">Security & Override Audit</h3>
                        <div className="space-y-4 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                          {metrics?.recentActivity && metrics.recentActivity.length > 0 ? (
                            metrics.recentActivity.map((evt, idx) => (
                              <div key={idx} className="relative flex gap-4 pl-6">
                                <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center shadow-sm ${
                                  evt.type === 'SALE' ? "bg-[#0b8252]" : "bg-amber-500"
                                }`} />
                                <div className="flex-1">
                                  <div className="flex justify-between items-baseline gap-2">
                                    <h4 className="font-bold text-sm text-slate-800">{evt.label}</h4>
                                    <span className="text-[10px] text-slate-400 font-medium shrink-0">{new Date(evt.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                  <p className="text-xs text-slate-500 mt-0.5">{evt.desc}</p>
                                  <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">User: {evt.user}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-slate-500 text-center py-4">No recent system activity.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
