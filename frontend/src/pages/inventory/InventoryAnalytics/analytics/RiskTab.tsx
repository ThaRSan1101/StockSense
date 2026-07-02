/**
 * RiskTab.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders the "Risk & Loss Audits" tab on the Inventory Analytics page.
 * This file integrates two audit panels used by shop managers to identify
 * stock risks and perishable wastage:
 *
 *   ┌──────────────────────────────────────┬───────────────────────────────────┐
 *   │ DeadStockAnalysisSection             │ ExpiryLossAnalysisSection         │
 *   │ (lg:col-span-2)                      │                                   │
 *   │ Table of products with 0 movement    │ Summary banner showing total Rs.  │
 *   │ over 45+ days — row colour reflects  │ lost to expiry, then a detail     │
 *   │ Critical (red) / Slow (amber) status │ table + Markdown Discount button  │
 *   └──────────────────────────────────────┴───────────────────────────────────┘
 *
 * Data flow:
 *   InventoryAnalytics (state + useMemo) → RiskTab (props) →
 *   DeadStockAnalysisSection / ExpiryLossAnalysisSection
 *
 * The triggerToast callback is forwarded to ExpiryLossAnalysisSection so the
 * "Auto-Apply Markdown Discount" button can display a feedback notification
 * without the child knowing about global state.
 *
 * All sub-functions are local (not exported) — tightly coupled to this tab.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState } from 'react';
import { ExpiryLossProps, ExpiryLossItem } from './analyticsTypes';
import { AiService, AiDiscountItem } from '../../../../services/aiService';

// ─── Combined props for the Risk & Loss Audits tab ───────────────────────────
interface RiskTabProps {
  dynamicExpiryLoss: ExpiryLossItem[];
  totalExpiryLoss: number;
  aiDiscounts: AiDiscountItem[];
  triggerToast: (msg: string) => void;
}

// ─── Main Tab Wrapper ─────────────────────────────────────────────────────────
export default function RiskTab({
  dynamicExpiryLoss,
  totalExpiryLoss,
  aiDiscounts,
  triggerToast
}: RiskTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <ExpiryLossAnalysisSection
        dynamicExpiryLoss={dynamicExpiryLoss}
        totalExpiryLoss={totalExpiryLoss}
        triggerToast={triggerToast}
      />

      {/* Smart Markdown Suggestions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm lg:col-span-2 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-extrabold text-base text-slate-800 leading-tight">AI Smart Markdowns</h3>
            <p className="text-[11px] font-medium text-slate-500 mt-1">AI-calculated discounts for near-expiry products</p>
          </div>
          <span className="material-symbols-outlined text-emerald-500 text-[20px] animate-pulse">auto_awesome</span>
        </div>

        <div className="overflow-y-auto max-h-[400px] flex-1">
          {aiDiscounts.length === 0 ? (
            <p className="text-xs font-semibold text-slate-400 py-8 text-center">No active markdown suggestions. Run AI Sync to check.</p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  {['Product', 'Stock', 'Markdown', 'Reason'].map((h, i) => (
                    <th key={i} className="p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs font-semibold">
                {aiDiscounts.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-extrabold text-slate-800">{item.name}</td>
                    <td className="p-3 text-slate-600">{item.currentStock} units</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded-md font-extrabold border border-rose-100">
                        {item.suggestedDiscount}% Off
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 leading-relaxed">{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}



// ─── Expiry Wastage Summary Panel ─────────────────────────────────────────────
function ExpiryLossAnalysisSection({ dynamicExpiryLoss, totalExpiryLoss, triggerToast }: ExpiryLossProps) {
  const [syncing, setSyncing] = useState(false);

  const handleMarkdownClick = async () => {
    try {
      setSyncing(true);
      triggerToast("Running AI Clearance models to analyze near-expiry stock...");
      const res = await AiService.runAiSync();
      if (res.success) {
        triggerToast("AI Clearance markdowns and Apriori combos queued for Admin approval!");
      }
    } catch (err: any) {
      triggerToast(err.message || "Failed to trigger AI optimization engine.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-extrabold text-base text-slate-800 leading-tight">Expiry Loss Analysis</h3>
            <p className="text-[11px] font-medium text-slate-500 mt-1">Perishable stock wastage and value losses</p>
          </div>
          <span className="material-symbols-outlined text-rose-500 text-[20px]">event_busy</span>
        </div>

        {/* Summary Banner */}
        <div className="bg-gradient-to-br from-rose-50 to-[#fff2f2] border border-rose-200 rounded-xl p-4 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Total Expiry Wastage</p>
              <p className="text-xl font-black text-rose-700 tracking-tight leading-none">Rs. {totalExpiryLoss.toLocaleString()}</p>
            </div>
            <span className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-black uppercase tracking-wider shadow-sm animate-pulse">
              Action Needed
            </span>
          </div>
        </div>

        {/* Expiry Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                {['Product', 'Qty', 'Value Loss', 'Expiry'].map((h, i) => (
                  <th key={i} className={`p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest ${i === 1 || i === 3 ? 'text-center' : i === 2 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
              {dynamicExpiryLoss.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-extrabold text-slate-800">{item.name}</td>
                  <td className="p-3 text-center font-black text-slate-500">{item.expiredQty} units</td>
                  <td className="p-3 text-right font-black text-rose-600">-Rs. {item.lossValue.toLocaleString()}</td>
                  <td className="p-3 text-center font-bold text-slate-500">{item.expiryDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Footer */}
      <div className="border-t border-slate-100 pt-4 mt-6">
        <button
          onClick={handleMarkdownClick}
          disabled={syncing}
          className={`w-full text-white font-bold py-2.5 rounded-lg text-xs transition-colors shadow-sm cursor-pointer ${
            syncing ? 'bg-slate-400 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700'
          }`}
        >
          {syncing ? "Running AI Clearance..." : "Auto-Apply Markdown Discount"}
        </button>
      </div>
    </div>
  );
}
