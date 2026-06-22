import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Sidebar from '../Shared/Sidebar';
import InventoryHeader from '../Shared/InventoryHeader';
import { inventoryOperationsService, ProductItem, LedgerEntry } from '../StockOperations/operations/inventoryOperationsService';

// Analytics subcomponents — organized in Components/analytics/
import KpiDashboardCards from './analytics/KpiDashboardCards';
import OverviewTab from './analytics/OverviewTab';
import VelocityTab from './analytics/VelocityTab';
import RiskTab from './analytics/RiskTab';
import AiInsightsTab from './analytics/AiInsightsTab';

export default function InventoryAnalytics() {
  // ── UI State ────────────────────────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as 'overview' | 'velocity' | 'risk' | 'ai') || 'overview';
  const setActiveTab = (tab: 'overview' | 'velocity' | 'risk' | 'ai') => {
    setSearchParams({ tab });
  };
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [hoveredChartBar, setHoveredChartBar] = useState<string | null>(null);
  const [hoveredDonutSegment, setHoveredDonutSegment] = useState<string | null>(null);
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  // ── Database State ───────────────────────────────────────────────────────────
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  useEffect(() => {
    async function loadData() {
      const prods = await inventoryOperationsService.getProducts();
      setProducts(prods);
      const ledgerData = await inventoryOperationsService.getLedger();
      setLedger(ledgerData);
    }
    loadData();
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const triggerToast = (msg: string) => {
    toast.success(msg);
  };

  const handleExport = () => {
    triggerToast('📊 Preparing your executive PDF report... print controller opening!');
    setTimeout(() => window.print(), 1200);
  };

  const handleRefresh = async () => {
    const prods = await inventoryOperationsService.getProducts();
    setProducts(prods);
    const ledgerData = await inventoryOperationsService.getLedger();
    setLedger(ledgerData);
    triggerToast('🔄 Analytics datasets refreshed successfully from active databases!');
  };

  // ── Date-filtered ledger ────────────────────────────────────────────────────
  const filteredLedger = useMemo(() => {
    const now = Date.now();
    return ledger.filter(item => {
      const itemTime = new Date(item.timestamp).getTime();
      const diffDays = (now - itemTime) / (1000 * 60 * 60 * 24);
      if (dateRange === 'today') return diffDays <= 1;
      if (dateRange === 'week') return diffDays <= 7;
      if (dateRange === 'month') return diffDays <= 30;
      if (dateRange === 'year') return diffDays <= 365;
      if (dateRange === 'custom') {
        const fromTime = customFrom ? new Date(customFrom).getTime() : 0;
        const toTime = customTo ? new Date(customTo).getTime() + 86400000 : Infinity;
        return itemTime >= fromTime && itemTime <= toTime;
      }
      return true;
    });
  }, [ledger, dateRange, customFrom, customTo]);

  // ── Derived Data Memos ───────────────────────────────────────────────────────

  const dynamicExpiryLoss = useMemo(() => {
    const removals = filteredLedger.filter(l => l.movementType === 'Expiry Removal');
    if (removals.length > 0) {
      return removals.map(r => {
        const p = products.find(prod => prod.name === r.productName || prod.sku === r.sku);
        return {
          name: r.productName,
          expiredQty: Math.abs(r.quantityChange),
          lossValue: p ? Math.abs(r.quantityChange) * p.costPrice : Math.abs(r.quantityChange) * 150,
          expiryDate: p?.expiryDate || new Date().toISOString().split('T')[0]
        };
      });
    }
    return [];
  }, [filteredLedger, products]);

  const totalExpiryLoss = useMemo(() =>
    dynamicExpiryLoss.reduce((sum, item) => sum + item.lossValue, 0),
    [dynamicExpiryLoss]);

  const dynamicFastMoving = useMemo(() => {
    const counts: { [key: string]: { movements: number; qty: number } } = {};
    filteredLedger.filter(l => l.movementType === 'Sale').forEach(s => {
      const prod = products.find(p => p.name === s.productName || p.sku === s.sku);
      if (!prod) return;
      if (!counts[prod.sku]) counts[prod.sku] = { movements: 0, qty: 0 };
      counts[prod.sku].movements += 1;
      counts[prod.sku].qty += Math.abs(s.quantityChange);
    });
    return products
      .map(p => {
        const log = counts[p.sku] || { movements: 0, qty: 0 };
        return {
          name: p.name,
          category: p.category,
          movementCount: log.movements,
          salesVolume: `Rs. ${(log.qty * p.sellingPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          stockRemaining: p.stock,
          rating: log.movements > 50 ? 'High Demand' : log.movements > 10 ? 'Normal' : 'Low Demand'
        };
      })
      .filter(item => item.movementCount > 0)
      .sort((a, b) => b.movementCount - a.movementCount)
      .slice(0, 5);
  }, [filteredLedger, products]);

  const dynamicDeadStock = useMemo(() => {
    return products.map((p) => {
      const productMovements = ledger.filter(l => l.sku === p.sku || l.productName === p.name);
      
      let lastMovementDate = new Date(p.lastUpdated || Date.now());
      if (productMovements.length > 0) {
        const times = productMovements.map(m => new Date(m.timestamp).getTime());
        lastMovementDate = new Date(Math.max(...times));
      }
      
      const diffMs = Date.now() - lastMovementDate.getTime();
      const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      const status = p.stock === 0 ? 'Healthy' : (days > 60 ? 'Critical' : days > 30 ? 'Slow Moving' : 'Healthy');

      return {
        name: p.name,
        lastMovement: lastMovementDate.toISOString().split('T')[0],
        daysInactive: days,
        stock: p.stock,
        costValue: p.stock * p.costPrice,
        status
      };
    })
    .filter(item => item.stock > 0 && item.daysInactive > 14)
    .sort((a, b) => b.daysInactive - a.daysInactive);
  }, [ledger, products]);

  const dynamicCategoryPerformance = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category)));
    const saleMovements = filteredLedger.filter(l => l.movementType === 'Sale');

    return cats.map((cat) => {
      const catProducts = products.filter(p => p.category === cat);
      const stockVal = catProducts.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
      
      let totalSalesVal = 0;
      catProducts.forEach(p => {
        const prodSales = saleMovements.filter(l => l.sku === p.sku || l.productName === p.name);
        const units = prodSales.reduce((sum, l) => sum + Math.abs(l.quantityChange), 0);
        totalSalesVal += units * p.sellingPrice;
      });
      
      const avgStockVal = stockVal || 1;
      const rotVal = totalSalesVal / avgStockVal;
      const rot = `${rotVal.toFixed(1)}x`;
      const perf = rotVal > 1.5 ? 'Best' : rotVal < 0.2 ? 'Weak' : 'Normal';

      return {
        name: cat,
        totalSales: `Rs. ${totalSalesVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        stockValue: `Rs. ${stockVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        movementRate: rot,
        performance: perf
      };
    });
  }, [filteredLedger, products]);

  const dynamicReorderSuggestions = useMemo(() => {
    const lowItems = products.filter(p => p.stock <= p.reorderLevel);
    return lowItems.map(p => ({
      name: p.name,
      stock: p.stock,
      threshold: p.reorderLevel,
      suggestedQty: Math.max(50, p.reorderLevel * 3 - p.stock),
      urgency: p.stock === 0 ? 'Critical' : p.stock <= p.reorderLevel ? 'Warning' : 'Normal'
    })).slice(0, 4);
  }, [products]);

  const dynamicHealthStats = useMemo(() => {
    const total = products.length || 1;
    const outStock = products.filter(p => p.stock === 0).length;
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.reorderLevel).length;
    const healthy = Math.max(0, products.length - outStock - lowStock);
    const hPct = Math.round((healthy / total) * 100);
    const wPct = Math.round((lowStock / total) * 100);
    const cPct = Math.round((outStock / total) * 100);
    const diff = 100 - (hPct + wPct + cPct);
    return {
      healthy: hPct + diff,
      warning: wPct,
      critical: cPct,
      healthyCount: healthy,
      warningCount: lowStock,
      criticalCount: outStock
    };
  }, [products]);

  const dynamicMovementInsights = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category)));
    const targetCats = cats.length > 0 ? cats.slice(0, 5) : ['Beverages', 'Dairy', 'Bakery', 'Produce', 'Snacks'];
    const fallbacks = ['Beverages', 'Dairy', 'Bakery', 'Produce', 'Snacks'];
    while (targetCats.length < 5) {
      const next = fallbacks.find(f => !targetCats.includes(f));
      if (next) targetCats.push(next); else break;
    }

    const calculated = targetCats.map(cat => {
      const byCategory = (type: string) =>
        filteredLedger
          .filter(l => l.movementType === type && products.find(p => p.name === l.productName)?.category === cat)
          .reduce((sum, l) => sum + Math.abs(l.quantityChange), 0);
      return {
        label: cat,
        rawIn: byCategory('GRN'),
        rawOut: byCategory('Sale'),
        rawAdj: filteredLedger
          .filter(l => (l.movementType === 'Adjustment' || l.movementType === 'Expiry Removal') &&
            products.find(p => p.name === l.productName)?.category === cat)
          .reduce((sum, l) => sum + Math.abs(l.quantityChange), 0)
      };
    });

    const maxVal = Math.max(...calculated.flatMap(c => [c.rawIn, c.rawOut, c.rawAdj]), 10);
    return calculated.map(c => ({
      ...c,
      inPct: Math.max(c.rawIn > 0 ? 8 : 4, Math.min(100, (c.rawIn / maxVal) * 90)),
      outPct: Math.max(c.rawOut > 0 ? 8 : 4, Math.min(100, (c.rawOut / maxVal) * 90)),
      adjPct: Math.max(c.rawAdj > 0 ? 8 : 4, Math.min(100, (c.rawAdj / maxVal) * 90))
    }));
  }, [filteredLedger, products]);

  const totalInventoryValue = useMemo(() =>
    products.reduce((acc, p) => acc + p.stock * p.costPrice, 0),
    [products]);

  const salesVolumeTotal = useMemo(() =>
    filteredLedger.filter(l => l.movementType === 'Sale').reduce((acc, l) => acc + Math.abs(l.quantityChange), 0),
    [filteredLedger]);

  const turnoverRate = useMemo(() => {
    if (products.length === 0) return '0.0x';
    const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
    if (totalStock === 0) return '0.0x';
    const rate = salesVolumeTotal / (totalStock / products.length);
    return `${rate.toFixed(1)}x`;
  }, [products, salesVolumeTotal]);

  const deadStockCount = useMemo(() =>
    dynamicDeadStock.filter(d => d.status === 'Critical').length,
    [dynamicDeadStock]);

  const lowStockCount = useMemo(() =>
    products.filter(p => p.stock <= p.reorderLevel).length,
    [products]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#f8f9fa] text-slate-800 font-sans overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <InventoryHeader />

        <main className="flex-1 overflow-y-auto px-6 py-6 bg-[#f8f9fa]">
          <div className="max-w-[1400px] w-full mx-auto space-y-6">

            {/* Page Header */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-6">
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Inventory Analytics</h1>
                <p className="text-slate-500 text-sm mt-1 font-medium">Business insights and inventory performance overview</p>
              </div>

              <div className="flex flex-wrap items-center gap-3.5 xl:justify-end">
                {/* Date Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex bg-[#f1f5f9] p-1 rounded-lg border border-slate-200">
                    {(['today', 'week', 'month', 'year', 'custom'] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => setDateRange(range)}
                        className={`px-3 py-1.5 text-xs font-bold capitalize rounded-md transition-all ${dateRange === range
                          ? 'text-[#0b8252] bg-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                          }`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>

                  {dateRange === 'custom' && (
                    <div className="flex items-center gap-2 bg-[#f1f5f9] p-1 rounded-lg border border-slate-200 animate-in fade-in slide-in-from-right-4 duration-200">
                      <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="px-2 py-1 text-[11px] font-bold text-slate-700 bg-white border border-slate-200 rounded outline-none cursor-pointer"
                      />
                      <span className="text-[10px] font-black text-slate-400">to</span>
                      <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="px-2 py-1 text-[11px] font-bold text-slate-700 bg-white border border-slate-200 rounded outline-none cursor-pointer"
                      />
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleRefresh}
                    className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-slate-800 hover:bg-slate-50 shadow-sm flex items-center justify-center transition-colors h-[34px] w-[34px]"
                    title="Refresh Data"
                  >
                    <span className="material-symbols-outlined text-[20px] font-bold">refresh</span>
                  </button>
                  <button
                    onClick={handleExport}
                    className="px-4 py-2 bg-[#0b8252] hover:bg-[#096e45] text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-2 transition-colors h-[34px]"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    Export Report
                  </button>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 gap-6">
              {([
                { id: 'overview', label: 'Overview & Health', icon: 'dashboard' },
                { id: 'velocity', label: 'Product Velocity', icon: 'bolt' },
                { id: 'risk', label: 'Risk & Loss Audits', icon: 'warning_amber' },
                { id: 'ai', label: 'AI Recommendations', icon: 'auto_awesome' }
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === tab.id
                    ? 'border-[#0b8252] text-[#0b8252]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* KPI Cards — always visible */}
            <KpiDashboardCards
              totalInventoryValue={totalInventoryValue}
              turnoverRate={turnoverRate}
              totalExpiryLoss={totalExpiryLoss}
              productsCount={products.length}
              deadStockCount={deadStockCount}
              lowStockCount={lowStockCount}
            />

            {/* Tab: Overview & Health */}
            {activeTab === 'overview' && (
              <OverviewTab
                dynamicHealthStats={dynamicHealthStats}
                hoveredDonutSegment={hoveredDonutSegment}
                setHoveredDonutSegment={setHoveredDonutSegment}
                dynamicMovementInsights={dynamicMovementInsights}
                hoveredChartBar={hoveredChartBar}
                setHoveredChartBar={setHoveredChartBar}
                dynamicCategoryPerformance={dynamicCategoryPerformance}
              />
            )}

            {/* Tab: Product Velocity */}
            {activeTab === 'velocity' && (
              <VelocityTab
                dynamicFastMoving={dynamicFastMoving}
                products={products}
                dynamicReorderSuggestions={dynamicReorderSuggestions}
                triggerToast={triggerToast}
              />
            )}

            {/* Tab: Risk & Loss Audits */}
            {activeTab === 'risk' && (
              <RiskTab
                dynamicDeadStock={dynamicDeadStock}
                dynamicExpiryLoss={dynamicExpiryLoss}
                totalExpiryLoss={totalExpiryLoss}
                triggerToast={triggerToast}
              />
            )}

            {/* Tab: AI Recommendations */}
            {activeTab === 'ai' && (
              <AiInsightsTab onRefreshParent={handleRefresh} />
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
