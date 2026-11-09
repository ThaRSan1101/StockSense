import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import Sidebar from '../Shared/Sidebar';
import InventoryHeader from '../Shared/InventoryHeader';
import { aiDemandService, ForecastRun, ProductForecastSummary } from '../../../services/aiDemandService';

const getNextMonthStr = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function AiDemandForecastingPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [maxMonthStr] = useState<string>(getNextMonthStr());
  const [selectedMonth, setSelectedMonth] = useState<string>(getNextMonthStr());
  const [historyRuns, setHistoryRuns] = useState<ForecastRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  
  // Forecast products grid
  const [forecasts, setForecasts] = useState<ProductForecastSummary[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  
  // Table query state
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('predictedDemand');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState<number>(1);
  const limit = 10;

  // Total status counts and recommended purchase products count
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [reorderProductsCount, setReorderProductsCount] = useState<number>(0);

  // Categories list fallback
  const categories = [
    "Fresh Produce", "Dairy & Eggs", "Bakery & Bread", "Meat & Seafood", 
    "Pantry Staples", "Beverages", "Frozen Foods", "Snacks & Sweets", 
    "Household Supplies", "Personal Care"
  ];

  // Helper to safely extract YYYY-MM month key
  const toMonthKey = (val?: string | Date): string => {
    if (!val) return '';
    if (typeof val === 'string' && /^\d{4}-\d{2}/.test(val)) {
      return val.slice(0, 7);
    }
    try {
      return new Date(val).toISOString().slice(0, 7);
    } catch {
      return '';
    }
  };

  // ── Fetch History & Latest Run ─────────────────────────────────────────────
  const loadHistoryAndLatest = async (selectLatest = true) => {
    try {
      setLoading(true);
      const history = await aiDemandService.getForecastHistory();
      setHistoryRuns(history);
      
      const completedRuns = history.filter(r => r.status === 'COMPLETED');
      if (completedRuns.length > 0) {
        // Default to the newest completed run
        const newest = completedRuns[0];
        const newestMonthStr = toMonthKey(newest.targetMonth);
        if (newestMonthStr) {
          setSelectedMonth(newestMonthStr);
        }
        if (selectLatest || !selectedRunId) {
          setSelectedRunId(newest.id);
          await loadForecastDetails(newest.id);
        } else {
          await loadForecastDetails(selectedRunId);
        }
      } else {
        setForecasts([]);
        setTotalCount(0);
        setStatusCounts({});
        setReorderProductsCount(0);
      }
    } catch (err: any) {
      toast.error('Failed to load forecast history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistoryAndLatest(true);
  }, []);

  // ── Load Run Details ───────────────────────────────────────────────────────
  const loadForecastDetails = async (runId: string) => {
    if (!runId) return;
    try {
      setLoading(true);
      const response = await aiDemandService.getForecastRunDetails(runId, {
        search,
        status: statusFilter,
        category: categoryFilter,
        sortBy,
        sortOrder,
        page,
        limit
      });
      setForecasts(response.forecasts);
      setTotalCount(response.totalCount);
      setStatusCounts(response.statusCounts || {});
      
      // Calculate summary aggregations (Count of reorder products, mean accuracy)
      if (response.reorderProductsCount !== undefined) {
        setReorderProductsCount(response.reorderProductsCount);
      } else if (response.forecasts.length > 0) {
        setReorderProductsCount(response.forecasts.filter(f => f.recommendedQuantity > 0).length);
      }
    } catch (err: any) {
      toast.error('Failed to load forecast details.');
    } finally {
      setLoading(false);
    }
  };

  // Reload when query params change
  useEffect(() => {
    if (selectedRunId) {
      loadForecastDetails(selectedRunId);
    }
  }, [search, statusFilter, categoryFilter, sortBy, sortOrder, page, selectedRunId]);

  // Synchronize selectedRunId when selectedMonth changes
  useEffect(() => {
    if (historyRuns.length > 0) {
      const currentRun = historyRuns.find(r => r.id === selectedRunId);
      const isCurrentRunMatchingMonth = currentRun && toMonthKey(currentRun.targetMonth) === selectedMonth;
      
      if (!isCurrentRunMatchingMonth) {
        const existingRun = historyRuns.find(r => toMonthKey(r.targetMonth) === selectedMonth && r.status === 'COMPLETED');
        if (existingRun) {
          setSelectedRunId(existingRun.id);
          setPage(1);
        } else {
          setSelectedRunId('');
          setForecasts([]);
          setTotalCount(0);
          setStatusCounts({});
          setReorderProductsCount(0);
        }
      }
    }
  }, [selectedMonth, historyRuns]);

  // Handle run selection dropdown change
  const handleRunChange = (runId: string) => {
    setSelectedRunId(runId);
    setPage(1);
    const run = historyRuns.find(r => r.id === runId);
    if (run) {
      const monthStr = toMonthKey(run.targetMonth);
      if (monthStr) {
        setSelectedMonth(monthStr);
      }
    }
  };

  // ── Trigger Forecast Generation ───────────────────────────────────────────
  const handleGenerateForecast = async (regenerate: boolean) => {
    setShowConfirm(false);
    try {
      setGenerating(true);
      toast.info(regenerate ? 'Regenerating AI Forecast version...' : 'Generating AI monthly forecast...');
      
      // Call backend to trigger forecast run
      const res = await aiDemandService.generateForecast(selectedMonth + '-01', regenerate);
      
      if (res.success) {
        toast.success(`AI demand forecast run completed successfully!`);
        // Reload history and automatically select the newly generated run
        await loadHistoryAndLatest(true);
      } else {
        toast.error(res.message || 'Forecast generation failed.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Forecasting execution failed.');
    } finally {
      setGenerating(false);
    }
  };

  // Check if a completed run already exists for the selected month to show confirmation
  const triggerGenerateClick = () => {
    const exists = historyRuns.some(r => toMonthKey(r.targetMonth) === selectedMonth && r.status === 'COMPLETED');
    if (exists) {
      setShowConfirm(true);
    } else {
      handleGenerateForecast(false);
    }
  };


  // Format Date safely
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Current selected run metadata details
  const activeRun = historyRuns.find(r => r.id === selectedRunId);

  return (
    <div className="flex h-screen bg-[#f8f9fa] text-slate-800 font-sans overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <InventoryHeader />

        <main className="flex-1 overflow-y-auto px-6 py-6 bg-[#f8f9fa]">
          <div className="max-w-[1400px] w-full mx-auto space-y-6 animate-in fade-in duration-300">
            
            {/* Header section with generation controls */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-6">
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">AI Demand Forecasting</h1>
                <p className="text-slate-500 text-sm mt-1 font-medium">Predict product demand and generate restock order recommendations using ML algorithms</p>
              </div>

              <div className="flex flex-wrap items-center gap-4 xl:justify-end">
                {/* target month input */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg shadow-inner">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target:</span>
                  <input
                    type="month"
                    max={maxMonthStr}
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-transparent text-xs font-black text-slate-700 outline-none cursor-pointer"
                  />
                </div>

                {/* Generate / Regenerate */}
                <button
                  onClick={triggerGenerateClick}
                  disabled={generating}
                  className="flex items-center gap-2 bg-[#0b8252] hover:bg-[#096a43] text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px] block">psychology</span>
                  {generating ? 'Running Models...' : 'Generate Forecast'}
                </button>

                <button
                  onClick={() => loadHistoryAndLatest(false)}
                  className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 bg-white shadow-sm"
                  title="Refresh data"
                >
                  <span className="material-symbols-outlined text-[16px] block">refresh</span>
                </button>
              </div>
            </div>

            {/* Run Selection and Version Details */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Run / Version:</span>
                <select
                  value={selectedRunId}
                  onChange={(e) => handleRunChange(e.target.value)}
                  className="px-4 py-2 text-xs font-black text-slate-700 bg-slate-50 border border-slate-200 rounded-lg outline-none hover:bg-slate-100 cursor-pointer shadow-sm min-w-[240px]"
                >
                  {historyRuns.length === 0 ? (
                    <option value="">No runs generated yet</option>
                  ) : (
                    (() => {
                      // Filter historyRuns so that for completed runs in the same target month, only the latest version shows
                      const monthMap: Record<string, typeof historyRuns> = {};
                      historyRuns.forEach(r => {
                        const monthKey = new Date(r.targetMonth).toISOString().slice(0, 7);
                        if (!monthMap[monthKey]) monthMap[monthKey] = [];
                        monthMap[monthKey].push(r);
                      });

                      const filteredRuns: typeof historyRuns = [];
                      Object.values(monthMap).forEach(group => {
                        const completed = group.filter(r => r.status === 'COMPLETED');
                        const maxCompVersion = completed.length > 0
                          ? Math.max(...completed.map(r => r.version || 1))
                          : -1;

                        group.forEach(r => {
                          if (r.status === 'COMPLETED') {
                            if ((r.version || 1) === maxCompVersion) {
                              filteredRuns.push(r);
                            }
                          } else {
                            filteredRuns.push(r);
                          }
                        });
                      });

                      return filteredRuns.map(run => {
                        const runMonthStr = new Date(run.targetMonth).toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
                        const triggerText = run.triggerType === 'SCHEDULED' ? '(Auto)' : '';
                        return (
                          <option key={run.id} value={run.id}>
                            {runMonthStr} - Version {run.version || 1} {triggerText} [{run.status}]
                          </option>
                        );
                      });
                    })()
                  )}
                </select>
              </div>

              {activeRun && (
                <div className="flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-slate-500 font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-slate-400">schedule</span>
                    <span>Ran at: <strong className="text-slate-700">{formatDate(activeRun.createdAt)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-slate-400">settings</span>
                    <span>Trigger: <strong className="text-slate-700">{activeRun.triggerType || 'MANUAL'}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-slate-400">date_range</span>
                    <span>History range: <strong className="text-slate-700">{activeRun.dataStartDate ? activeRun.dataStartDate.slice(0,10) : '2023-01-01'} to {activeRun.dataEndDate ? activeRun.dataEndDate.slice(0,10) : '2025-12-31'}</strong></span>
                  </div>

                  {activeRun.status === 'FAILED' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold border border-rose-100" title={activeRun.errorMessage || ''}>
                      Failed
                    </span>
                  )}
                  {activeRun.status === 'RUNNING' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-100 animate-pulse">
                      Running...
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Confirmation Regeneration Modal */}
            {showConfirm && createPortal(
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-3 text-amber-500 mb-3">
                    <span className="material-symbols-outlined text-[28px]">warning</span>
                    <h3 className="text-md font-extrabold text-slate-800">Forecast Already Exists</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    A completed demand forecast already exists for <strong>{selectedMonth}</strong>. Running this will generate a **new version** (preserving the history of old runs for audit comparison).
                  </p>
                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => setShowConfirm(false)}
                      className="px-4 py-2 text-xs font-extrabold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleGenerateForecast(true)}
                      className="px-4 py-2 text-xs font-extrabold bg-[#0b8252] hover:bg-[#096a43] text-white rounded-lg transition-colors shadow-sm"
                    >
                      Generate New Version
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}

            {/* No Data State */}
            {historyRuns.length === 0 && !loading && (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200 p-8 shadow-sm">
                <span className="material-symbols-outlined text-slate-300 text-[64px] block mb-4">monitoring</span>
                <h3 className="text-md font-bold text-slate-700">No Forecast Generated Yet</h3>
                <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
                  Select a target month and click **Generate Forecast** above to train models and create order recommendations.
                </p>
              </div>
            )}

            {/* Summary Cards */}
            {activeRun && activeRun.status === 'COMPLETED' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                    <span className="material-symbols-outlined text-[22px] block">inventory_2</span>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Total SKUs</p>
                    <p className="text-lg font-black text-slate-800 mt-0.5">{activeRun.totalProducts || totalCount}</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                  <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                    <span className="material-symbols-outlined text-[22px] block">error</span>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Critical Action</p>
                    <p className="text-lg font-black text-slate-800 mt-0.5">{statusCounts['CRITICAL_ACTION'] || 0}</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                    <span className="material-symbols-outlined text-[22px] block">reorder</span>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Reorder Required</p>
                    <p className="text-lg font-black text-slate-800 mt-0.5">{statusCounts['REORDER_REQUIRED'] || 0}</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                    <span className="material-symbols-outlined text-[22px] block">check_circle</span>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Sufficient</p>
                    <p className="text-lg font-black text-slate-800 mt-0.5">{statusCounts['SUFFICIENT'] || 0}</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                    <span className="material-symbols-outlined text-[22px] block">warning</span>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Overstock Risk</p>
                    <p className="text-lg font-black text-slate-800 mt-0.5">{statusCounts['OVERSTOCK_RISK'] || 0}</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                  <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                    <span className="material-symbols-outlined text-[22px] block">shopping_cart</span>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Recommended Order</p>
                    <p className="text-lg font-black text-slate-800 mt-0.5">{reorderProductsCount} Products</p>
                  </div>
                </div>
              </div>
            )}

            {/* Main forecasts datagrid */}
            {activeRun && activeRun.status === 'COMPLETED' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                
                {/* Search and filter toolbar */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[300px]">
                    <div className="relative flex-1 max-w-xs">
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400">search</span>
                      <input
                        type="text"
                        placeholder="Search by name, SKU or barcode..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 pr-4 py-2 w-full text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-[#0b8252] transition-colors placeholder-slate-400 shadow-sm"
                      />
                    </div>

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-600 outline-none hover:bg-slate-100 cursor-pointer shadow-sm font-semibold"
                    >
                      <option value="">All Statuses</option>
                      <option value="CRITICAL_ACTION">Critical Action</option>
                      <option value="REORDER_REQUIRED">Reorder Required</option>
                      <option value="SUFFICIENT">Sufficient</option>
                      <option value="OVERSTOCK_RISK">Overstock Risk</option>
                    </select>

                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-600 outline-none hover:bg-slate-100 cursor-pointer shadow-sm font-semibold"
                    >
                      <option value="">All Categories</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="text-xs text-slate-500 font-bold">
                    Showing {forecasts.length} of {totalCount} records
                  </div>
                </div>

                {/* Table grid */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-400 border-b border-slate-200">
                        <th className="py-3 px-4">Product / Barcode</th>
                        <th className="py-3 px-4 cursor-pointer" onClick={() => { setSortBy('currentStock'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>Current Stock</th>
                        <th className="py-3 px-4 cursor-pointer" onClick={() => { setSortBy('stockCoverage'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>Estimated Coverage</th>
                        <th className="py-3 px-4 cursor-pointer" onClick={() => { setSortBy('predictedDemand'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>Predicted Monthly Demand</th>
                        <th className="py-3 px-4 cursor-pointer" onClick={() => { setSortBy('recommendedQuantity'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>Safety / Recommended Order</th>
                        <th className="py-3 px-4">Prediction Reason</th>
                        <th className="py-3 px-4">Selected Model / Accuracy</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {loading ? (
                        <tr>
                          <td colSpan={8} className="text-center py-12 text-slate-400">
                            <span className="animate-spin inline-block h-5 w-5 border-2 border-[#0b8252] border-t-transparent rounded-full mr-2"></span>
                            Loading forecast run details...
                          </td>
                        </tr>
                      ) : forecasts.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-12 text-slate-400 font-medium">
                            No matching demand forecast records found.
                          </td>
                        </tr>
                      ) : (
                        forecasts.map((row) => (
                          <tr
                            key={row.sku}
                            className="hover:bg-slate-50/80 transition-all border-b border-slate-100"
                          >
                            <td className="py-3 px-4">
                              <p className="font-extrabold text-slate-800">{row.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                {row.barcode ? `Barcode: ${row.barcode}` : `SKU: ${row.sku}`} • {row.categoryName}
                              </p>
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-700">{row.currentStockSnapshot} units</td>
                            <td className="py-3 px-4 text-slate-600 font-medium" title="Estimated coverage derived from average forecast daily demand">
                              {row.stockCoverageDays !== undefined && row.stockCoverageDays !== null && row.stockCoverageDays < 900
                                ? `~${Math.round(row.stockCoverageDays)} days`
                                : '>90 days'}
                            </td>
                            <td className="py-3 px-4 font-black text-slate-800">{row.predictedDemand} units</td>
                            <td className="py-3 px-4 font-extrabold text-slate-700">
                              <span className="text-slate-400 font-medium text-[10px] mr-1">Order:</span>
                              <span className={row.recommendedQuantity > 0 ? 'text-[#0b8252]' : ''}>
                                {row.recommendedQuantity} units
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500 max-w-xs truncate" title={row.predictionReason}>
                              {row.predictionReason}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-600">
                              <p className="font-bold text-slate-700">{row.selectedModel}</p>
                              <p className="text-[10px] text-slate-400 font-bold mt-0.5">Accuracy: {row.accuracyScore !== null && row.accuracyScore !== undefined ? `${row.accuracyScore.toFixed(1)}%` : 'N/A'}</p>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {row.status === 'CRITICAL_ACTION' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-100">
                                  <span className="material-symbols-outlined text-[12px] block">error</span>
                                  Critical Action
                                </span>
                              )}
                              {row.status === 'REORDER_REQUIRED' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-100">
                                  <span className="material-symbols-outlined text-[12px] block">reorder</span>
                                  Reorder Required
                                </span>
                              )}
                              {row.status === 'SUFFICIENT' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100">
                                  <span className="material-symbols-outlined text-[12px] block">check_circle</span>
                                  Sufficient
                                </span>
                              )}
                              {row.status === 'OVERSTOCK_RISK' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                                  <span className="material-symbols-outlined text-[12px] block">warning</span>
                                  Overstock Risk
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalCount > limit && (
                  <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      Previous
                    </button>
                    <div className="text-xs font-bold text-slate-500">
                      Page {page} of {Math.ceil(totalCount / limit)}
                    </div>
                    <button
                      disabled={page >= Math.ceil(totalCount / limit)}
                      onClick={() => setPage(page + 1)}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
