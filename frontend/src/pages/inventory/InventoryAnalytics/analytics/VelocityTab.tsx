/**
 * VelocityTab.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders the "Product Velocity" tab on the Inventory Analytics page.
 * This file integrates three sections that analyse stock movement speed:
 *
 *   ┌───────────────────────────────────────┬──────────────────────────────────┐
 *   │ FastMovingProductsSection             │ StockTurnoverVisualSection        │
 *   │ (lg:col-span-2)                       │                                  │
 *   │ Ranked table of top-selling products  │ Horizontal rotation ratio bars   │
 *   │ with High Demand / Steady badges      │ showing each product's velocity  │
 *   └───────────────────────────────────────┴──────────────────────────────────┘
 *   ┌──────────────────────────────────────────────────────────────────────────┐
 *   │ SmartReorderSuggestionsSection  (lg:col-span-3)                         │
 *   │ Cards for each below-threshold product with urgency-coded Reorder Now   │
 *   │ buttons that trigger a toast confirmation on click                       │
 *   └──────────────────────────────────────────────────────────────────────────┘
 *
 * Data flow:
 *   InventoryAnalytics (state + useMemo) → VelocityTab (props) →
 *   FastMovingProductsSection / StockTurnoverVisualSection / SmartReorderSuggestionsSection
 *
 * All sub-functions are local (not exported) — tightly coupled to this tab.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { FastMovingProps, FastMovingItem, DeadStockItem } from './analyticsTypes';
import { ProductItem } from '../../StockOperations/operations/inventoryOperationsService';
import { AiVelocityItem } from '../../../../services/aiService';

// ─── Combined props for the Product Velocity tab ─────────────────────────────
interface VelocityTabProps {
  dynamicFastMoving: FastMovingItem[];
  products: ProductItem[];
  aiVelocity: AiVelocityItem[];
  dynamicDeadStock: DeadStockItem[];
}

// ─── Main Tab Wrapper ─────────────────────────────────────────────────────────
export default function VelocityTab({
  dynamicFastMoving,
  products,
  aiVelocity,
  dynamicDeadStock
}: VelocityTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <FastMovingProductsSection dynamicFastMoving={dynamicFastMoving} />
      </div>
      <div className="lg:col-span-1">
        <StockTurnoverVisualSection aiVelocity={aiVelocity} />
      </div>
      <div className="lg:col-span-3">
        <DeadStockAnalysisSection dynamicDeadStock={dynamicDeadStock} />
      </div>
    </div>
  );
}

// ─── Fast Moving Products Ranked Table ────────────────────────────────────────
function FastMovingProductsSection({ dynamicFastMoving }: FastMovingProps) {
  const rankColors = [
    'bg-amber-100 text-amber-700 border border-amber-200',
    'bg-slate-200 text-slate-700 border border-slate-300',
    'bg-[#ffedd5] text-[#c2410c] border border-[#fed7aa]',
    'bg-slate-100 text-slate-500'
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm lg:col-span-2 flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-extrabold text-base text-slate-800 leading-tight">Fast Moving Products</h3>
            <p className="text-[11px] font-medium text-slate-500 mt-1">Highest sales transaction velocities this period</p>
          </div>
          <span className="material-symbols-outlined text-amber-500 text-[20px]">local_fire_department</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                {['Rank & Product Name', 'Category', 'Movements', 'Revenue', 'Status'].map((h, i) => (
                  <th key={i} className={`p-3 text-xs font-black text-slate-500 uppercase tracking-widest ${i === 2 ? 'text-center' : i === 3 ? 'text-right' : i === 4 ? 'text-center' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
              {dynamicFastMoving.map((item, idx) => {
                const isTop3 = idx < 3;
                return (
                  <tr key={idx} className={`transition-colors ${isTop3 ? 'bg-emerald-50/20 hover:bg-emerald-50/40 font-bold' : 'hover:bg-slate-50'}`}>
                    <td className="p-3 flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm ${rankColors[Math.min(idx, 3)]}`}>
                        {idx + 1}
                      </div>
                      <span className="text-slate-800 font-extrabold">{item.name}</span>
                    </td>
                    <td className="p-3 text-slate-500 text-xs font-bold">{item.category}</td>
                    <td className="p-3 text-center font-black text-[#0b8252]">{item.movementCount} times</td>
                    <td className="p-3 text-right font-extrabold text-slate-800">{item.salesVolume}</td>
                    <td className="p-3 text-center">
                      {isTop3
                        ? <span className="px-2 py-0.5 text-[9px] font-black rounded bg-emerald-100 text-[#0b8252] uppercase tracking-wide border border-emerald-200">High Demand</span>
                        : <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-slate-100 text-slate-500 uppercase tracking-wide">Steady</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Stock Turnover Horizontal Bars ──────────────────────────────────────────
function StockTurnoverVisualSection({ aiVelocity }: { aiVelocity: AiVelocityItem[] }) {
  const sortedVelocity = [...aiVelocity].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-extrabold text-base text-slate-800 leading-tight">Stock Turnover Rates</h3>
            <p className="text-[11px] font-medium text-slate-500 mt-1">Relative inventory rotation ratios</p>
          </div>
          <span className="material-symbols-outlined text-[#0b8252] text-[20px]">bar_chart</span>
        </div>

        <div className="space-y-4">
          {sortedVelocity.length === 0 ? (
            <p className="text-xs font-semibold text-slate-400 py-4 text-center">Loading AI turnover rates...</p>
          ) : (
            sortedVelocity.map((item, idx) => {
              const turnOverRate = item.avgUnitsPerDay > 0 ? Math.max(1.0, item.avgUnitsPerDay * 8.5) : 0.8;
              const barPercentage = Math.max(10, Math.min(100, (turnOverRate / 20) * 100));
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span className="truncate max-w-[190px]">{item.name}</span>
                    <span className="text-[#0b8252] font-black">{turnOverRate.toFixed(1)}x</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#0b8252] h-full rounded-full transition-all duration-500"
                      style={{ width: `${barPercentage}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4 mt-6 text-center">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Target Rotation: &gt; 7.0x</p>
      </div>
    </div>
  );
}

// ─── Dead Stock Inactivity Audit Table ────────────────────────────────────────
function DeadStockAnalysisSection({ dynamicDeadStock }: { dynamicDeadStock: DeadStockItem[] }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="font-extrabold text-base text-slate-800 leading-tight">Dead Stock Analysis</h3>
          <p className="text-[11px] font-medium text-slate-500 mt-1">Products inactive with zero movement over 45 days</p>
        </div>
        <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-bold">
          Auditor Flagged
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70">
              {['Product Name', 'Last Active', 'Days Inactive', 'Cost Value', 'Urgency'].map((h, i) => (
                <th key={i} className={`p-3 text-xs font-black text-slate-500 uppercase tracking-widest ${i === 1 || i === 2 || i === 4 ? 'text-center' : i === 3 ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
            {dynamicDeadStock.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-400 font-bold">
                  No dead stock items detected in catalog.
                </td>
              </tr>
            ) : (
              dynamicDeadStock.map((item, idx) => {
                const isCritical  = item.status === 'Critical';
                const isSlow      = item.status === 'Slow Moving';
                return (
                  <tr key={idx} className={`transition-colors ${
                    isCritical ? 'bg-rose-50/20 hover:bg-rose-50/40' :
                    isSlow     ? 'bg-amber-50/20 hover:bg-amber-50/40' :
                                 'opacity-60 bg-slate-50 hover:opacity-100'
                  }`}>
                    <td className="p-3 font-extrabold text-slate-800">{item.name}</td>
                    <td className="p-3 text-center font-bold text-slate-500">{item.lastMovement}</td>
                    <td className="p-3 text-center font-black text-slate-800">{item.daysInactive} days</td>
                    <td className="p-3 text-right font-extrabold text-slate-800">Rs. {item.costValue.toLocaleString()}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase tracking-wider ${
                        isCritical ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                        isSlow     ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                     'bg-slate-100 text-slate-600'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
