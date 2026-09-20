import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { aiDemandService, ForecastRun, ProductForecastSummary, ProductForecastDetail } from '../../../../services/aiDemandService';

interface AiDemandTabProps {
  categories?: string[];
}

export default function AiDemandTab({ categories = [] }: AiDemandTabProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-01');
  const [latestRun, setLatestRun] = useState<ForecastRun | null>(null);
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

  // Selected Product Detail State
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [productDetail, setProductDetail] = useState<ProductForecastDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [isExplanationExpanded, setIsExplanationExpanded] = useState<boolean>(false);

  // Total status counts (across entire run, not just current page)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [reorderProductsCount, setReorderProductsCount] = useState<number>(0);

  // ── Fetch Latest Run ───────────────────────────────────────────────────────
  const fetchLatestRun = async () => {
    try {
      setLoading(true);
      const run = await aiDemandService.getLatestForecastRun();
      setLatestRun(run);
      if (run) {
        await loadForecastDetails(run.id);
      }
    } catch (err: any) {
      toast.error('Failed to load latest forecasting run.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestRun();
  }, []);

  // ── Load Run Details ───────────────────────────────────────────────────────
  const loadForecastDetails = async (runId: string) => {
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
      if (response.reorderProductsCount !== undefined) {
        setReorderProductsCount(response.reorderProductsCount);
      } else if (response.forecasts.length > 0) {
        setReorderProductsCount(response.forecasts.filter(f => f.recommendedQuantity > 0).length);
      }
    } catch (err: any) {
      toast.error('Failed to load forecast list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (latestRun) {
      loadForecastDetails(latestRun.id);
    }
  }, [search, statusFilter, categoryFilter, sortBy, sortOrder, page, latestRun]);

  // ── Trigger Forecast Generation ───────────────────────────────────────────
  const handleGenerateForecast = async () => {
    setShowConfirm(false);
    try {
      setGenerating(true);
      toast.info('Generating AI monthly forecast... This will take a moment.');
      await aiDemandService.generateForecast(selectedMonth + '-01', true);
      toast.success('AI demand forecast generated successfully!');
      fetchLatestRun();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Forecasting execution failed.');
    } finally {
      setGenerating(false);
    }
  };

  // ── View Product Details ──────────────────────────────────────────────────
  const handleViewDetails = async (sku: string) => {
    if (!latestRun) return;
    try {
      setSelectedSku(sku);
      setIsExplanationExpanded(false);
      setDetailLoading(true);
      const detail = await aiDemandService.getProductForecastDetail(latestRun.id, sku);
      setProductDetail(detail);
    } catch (err: any) {
      toast.error('Failed to load product forecast details.');
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Category & Status List ─────────────────────────────────────────────────
  const categoryNames = categories.length > 0 ? categories : [
    "Fresh Produce", "Dairy & Eggs", "Bakery & Bread", "Meat & Seafood", 
    "Pantry Staples", "Beverages", "Frozen Foods", "Snacks & Sweets", 
    "Household Supplies", "Personal Care"
  ];

  // Aggregate stats from run if loaded — use full-run statusCounts from backend
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl border border-slate-100 shadow-sm gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">AI Demand Forecasting</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Predict SKU demand and generate purchase recommendations using historical sales, seasonality, discounts, and current stock.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">Target Month:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded outline-none cursor-pointer hover:bg-slate-100"
            />
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={generating}
            className="flex items-center gap-2 bg-[#0b8252] hover:bg-[#096a43] text-white text-xs font-extrabold px-4 py-2 rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">psychology</span>
            {generating ? 'Forecasting...' : 'Generate Forecast'}
          </button>
          <button
            onClick={fetchLatestRun}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
            title="Refresh latest run"
          >
            <span className="material-symbols-outlined text-[16px] block">refresh</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-[#0b8252] mb-3">
              <span className="material-symbols-outlined text-[28px]">psychology</span>
              <h3 className="text-md font-bold text-slate-800">Generate Forecast</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Generate product demand forecasts for <strong>{selectedMonth}</strong> using data available until the end of the previous month? This will evaluate seasonality, price shifts, and historical discount campaigns.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateForecast}
                className="px-4 py-2 text-xs font-bold bg-[#0b8252] hover:bg-[#096a43] text-white rounded-lg"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* State Indicators */}
      {!latestRun && !loading && (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
          <span className="material-symbols-outlined text-slate-300 text-[64px]">monitoring</span>
          <h3 className="text-md font-bold text-slate-700 mt-4">No Forecast Generated Yet</h3>
          <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto">
            Select a target month and click "Generate Forecast" above to run the machine learning models.
          </p>
        </div>
      )}

      {/* Summary Stats Cards */}
      {latestRun && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Card 1: Total Forecasted */}
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <span className="material-symbols-outlined text-[24px]">inventory_2</span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Products Forecasted</p>
              <p className="text-xl font-black text-slate-800 mt-1">{totalCount}</p>
            </div>
          </div>

          {/* Card 2: Critical Actions */}
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
              <span className="material-symbols-outlined text-[24px]">error</span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Critical Action</p>
              <p className="text-xl font-black text-slate-800 mt-1">{statusCounts['CRITICAL_ACTION'] || 0}</p>
            </div>
          </div>

          {/* Card 3: Reorder Required */}
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <span className="material-symbols-outlined text-[24px]">reorder</span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Reorder Required</p>
              <p className="text-xl font-black text-slate-800 mt-1">{statusCounts['REORDER_REQUIRED'] || 0}</p>
            </div>
          </div>

          {/* Card 4: Sufficient */}
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <span className="material-symbols-outlined text-[24px]">check_circle</span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Sufficient Stock</p>
              <p className="text-xl font-black text-slate-800 mt-1">{statusCounts['SUFFICIENT'] || 0}</p>
            </div>
          </div>

          {/* Card 5: Overstock Risk */}
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <span className="material-symbols-outlined text-[24px]">warning</span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Overstock Risk</p>
              <p className="text-xl font-black text-slate-800 mt-1">{statusCounts['OVERSTOCK_RISK'] || 0}</p>
            </div>
          </div>

          {/* Card 6: Recommended Order */}
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <span className="material-symbols-outlined text-[24px]">shopping_cart</span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Recommended Order</p>
              <p className="text-xl font-black text-slate-800 mt-1">{reorderProductsCount} Products</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Table and Filters */}
      {latestRun && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Table Header Filter bar */}
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[300px]">
              <div className="relative flex-1 max-w-xs">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400">search</span>
                <input
                  type="text"
                  placeholder="Search by name, SKU or barcode..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-1.5 w-full text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-[#0b8252] transition-colors placeholder-slate-400"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-600 outline-none hover:bg-slate-100"
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
                className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-600 outline-none hover:bg-slate-100"
              >
                <option value="">All Categories</option>
                {categoryNames.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing {forecasts.length} of {totalCount} predictions
            </div>
          </div>

          {/* Table Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-400 border-b border-slate-100">
                  <th className="py-3 px-4">Product / Barcode</th>
                  <th className="py-3 px-4 cursor-pointer" onClick={() => { setSortBy('currentStock'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>Current Stock</th>
                  <th className="py-3 px-4 cursor-pointer" onClick={() => { setSortBy('stockCoverage'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>Estimated Coverage</th>
                  <th className="py-3 px-4 cursor-pointer" onClick={() => { setSortBy('predictedDemand'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>Predicted Monthly Demand</th>
                  <th className="py-3 px-4 cursor-pointer" onClick={() => { setSortBy('recommendedQuantity'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>Recommended Qty</th>
                  <th className="py-3 px-4">Prediction Reason</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <span className="animate-spin inline-block h-5 w-5 border-2 border-[#0b8252] border-t-transparent rounded-full mr-2"></span>
                      Loading forecasts...
                    </td>
                  </tr>
                ) : forecasts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      No matching forecast records found.
                    </td>
                  </tr>
                ) : (
                  forecasts.map((row) => (
                    <tr
                      key={row.sku}
                      onClick={() => handleViewDetails(row.sku)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-800">{row.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {row.barcode ? `Barcode: ${row.barcode}` : `SKU: ${row.sku}`} • {row.categoryName}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700">{row.currentStockSnapshot} units</td>
                      <td className="py-3 px-4 text-slate-600">
                        {row.stockCoverageDays !== undefined && row.stockCoverageDays !== null
                          ? `${Math.round(row.stockCoverageDays)} days`
                          : 'N/A'}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">{row.predictedDemand} units</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{row.recommendedQuantity} units</td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate" title={row.predictionReason}>
                        {row.predictionReason}
                      </td>
                      <td className="py-3 px-4">
                        {row.status === 'CRITICAL_ACTION' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold">
                            <span className="material-symbols-outlined text-[12px]">error</span>
                            Critical Action
                          </span>
                        )}
                        {row.status === 'REORDER_REQUIRED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">
                            <span className="material-symbols-outlined text-[12px]">reorder</span>
                            Reorder Required
                          </span>
                        )}
                        {row.status === 'SUFFICIENT' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                            <span className="material-symbols-outlined text-[12px]">check_circle</span>
                            Sufficient
                          </span>
                        )}
                        {row.status === 'OVERSTOCK_RISK' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">
                            <span className="material-symbols-outlined text-[12px]">warning</span>
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

          {/* Pagination bar */}
          {totalCount > limit && (
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                Previous
              </button>
              <div className="text-xs font-bold text-slate-500">
                Page {page} of {Math.ceil(totalCount / limit)}
              </div>
              <button
                disabled={page >= Math.ceil(totalCount / limit)}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Product Detail Modal/Drawer */}
      {selectedSku && createPortal(
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setSelectedSku(null)}
        >
          <div
            className="bg-white max-w-lg w-full max-h-[90vh] rounded-2xl shadow-2xl border border-slate-100 overflow-y-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-400 gap-2 p-6">
                <span className="animate-spin inline-block h-6 w-6 border-2 border-[#0b8252] border-t-transparent rounded-full"></span>
                <span>Fetching product insights...</span>
              </div>
            ) : productDetail ? (
              <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] font-bold text-[#0b8252] uppercase tracking-wide">Product Insights</span>
                    <h3 className="text-md font-bold text-slate-800 mt-1">{productDetail.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{productDetail.sku} • {productDetail.categoryName}</p>
                  </div>
                  <button
                    onClick={() => setSelectedSku(null)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                  >
                    <span className="material-symbols-outlined text-[20px] block">close</span>
                  </button>
                </div>

                {/* Status and selected model */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-extrabold uppercase text-slate-400">Forecasting Model</p>
                    <p className="text-xs font-bold text-slate-700 mt-1">{productDetail.selectedModel}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Accuracy: {(productDetail.accuracyScore !== undefined && productDetail.accuracyScore !== null) ? `${productDetail.accuracyScore.toFixed(1)}%` : 'N/A'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-extrabold uppercase text-slate-400">Forecast Status</p>
                    <div className="mt-1">
                      {productDetail.status === 'CRITICAL_ACTION' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold">
                          Critical Action
                        </span>
                      )}
                      {productDetail.status === 'SUFFICIENT' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                          Sufficient
                        </span>
                      )}
                      {productDetail.status === 'OVERSTOCK_RISK' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">
                          Overstock Risk
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Target: {productDetail.targetMonth.slice(0, 7)}</p>
                  </div>
                </div>

                {/* Prediction values */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <div className="text-center border-r border-slate-200/60">
                    <p className="text-[9px] font-extrabold uppercase text-slate-400">Current Stock</p>
                    <p className="text-md font-bold text-slate-700 mt-1">{productDetail.currentStock}</p>
                  </div>
                  <div className="text-center border-r border-slate-200/60">
                    <p className="text-[9px] font-extrabold uppercase text-slate-400">Next Month Demand</p>
                    <p className="text-md font-bold text-[#0b8252] mt-1">{productDetail.predictedDemand}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-extrabold uppercase text-slate-400">Recommended Qty</p>
                    <p className="text-md font-bold text-slate-800 mt-1">{productDetail.recommendedQuantity}</p>
                  </div>
                </div>

                {/* Explanation text */}
                <div className="bg-[#0b8252]/5 p-4 rounded-xl border border-[#0b8252]/10 space-y-2 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[#0b8252] text-[10px] font-extrabold uppercase">
                      <span className="material-symbols-outlined text-[14px]">info</span>
                      Explanation & Reason
                    </div>
                    {productDetail.predictionReason && productDetail.predictionReason.length > 120 && (
                      <button
                        type="button"
                        onClick={() => setIsExplanationExpanded(prev => !prev)}
                        className="text-[11px] font-bold text-[#0b8252] hover:text-[#0b8252]/80 inline-flex items-center gap-0.5 transition-colors cursor-pointer"
                      >
                        <span>{isExplanationExpanded ? 'Show less' : 'Read more'}</span>
                        <span className="material-symbols-outlined text-[15px]">
                          {isExplanationExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>
                    )}
                  </div>
                  <p className={`text-xs text-slate-600 leading-relaxed font-medium transition-all ${isExplanationExpanded ? '' : 'line-clamp-2'}`}>
                    {productDetail.predictionReason}
                  </p>
                </div>

                {/* Measured Metrics */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">Measured Demand Analytics</h4>
                  
                  <div className="space-y-2 border border-slate-100 rounded-xl p-4 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Recent 30-Day Sales</span>
                      <span className="font-bold text-slate-700">{productDetail.recent30DaySales} units</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Previous 30-Day Sales</span>
                      <span className="font-bold text-slate-700">{productDetail.previous30DaySales} units</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Recent Growth Rate</span>
                      <span className={`font-bold ${productDetail.recentGrowthPercent && productDetail.recentGrowthPercent > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {productDetail.recentGrowthPercent ? `${(productDetail.recentGrowthPercent * 100).toFixed(1)}%` : '0%'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">3-Month Monthly Average</span>
                      <span className="font-bold text-slate-700">{Math.round(productDetail.threeMonthAverage)} units</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">6-Month Monthly Average</span>
                      <span className="font-bold text-slate-700">{Math.round(productDetail.sixMonthAverage)} units</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Same-Month Historical Average</span>
                      <span className="font-bold text-slate-700">
                        {productDetail.sameMonthHistoricalAverage ? `${Math.round(productDetail.sameMonthHistoricalAverage)} units` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Discount Uplift Factor</span>
                      <span className="font-bold text-[#0b8252]">
                        {productDetail.discountUpliftPercent ? `+${(productDetail.discountUpliftPercent * 100).toFixed(1)}%` : '0%'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-500">Recent Refund Volume</span>
                      <span className="font-bold text-slate-700">{productDetail.refundQuantity} units</span>
                    </div>
                  </div>
                </div>
                {/* Close button footer */}
                <div className="border-t border-slate-100 pt-4">
                  <button
                    onClick={() => setSelectedSku(null)}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
