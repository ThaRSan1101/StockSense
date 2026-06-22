import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../hooks/useAuth';
import { 
  AiService, 
  AiForecastItem, 
  AiDiscountItem, 
  AiVelocityItem, 
  AiComboItem 
} from '../../../../services/aiService';
import { DiscountService } from '../../../../services/discountService';

interface AiInsightsTabProps {
  onRefreshParent: () => void;
}

export default function AiInsightsTab({ onRefreshParent }: AiInsightsTabProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  
  // ─── State variables ──────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [forecasts, setForecasts] = useState<AiForecastItem[]>([]);
  const [discounts, setDiscounts] = useState<AiDiscountItem[]>([]);
  const [combos, setCombos] = useState<AiComboItem[]>([]);
  const [velocity, setVelocity] = useState<AiVelocityItem[]>([]);
  const [draftDiscounts, setDraftDiscounts] = useState<any[]>([]);

  // ─── Fetch data ───────────────────────────────────────────────────────────
  const loadAiData = async () => {
    try {
      setLoading(true);
      const [forecastRes, discountRes, comboRes, velocityRes, draftRes] = await Promise.all([
        AiService.getDemandForecast(),
        AiService.getSmartDiscounts(),
        AiService.getAprioriCombos(),
        AiService.getStockVelocity(),
        DiscountService.getDiscounts()
      ]);

      if (forecastRes.success) setForecasts(forecastRes.data);
      if (discountRes.success) setDiscounts(discountRes.data);
      if (comboRes.success) setCombos(comboRes.data);
      if (velocityRes.success) setVelocity(velocityRes.data);
      if (draftRes.success) setDraftDiscounts(draftRes.data);
    } catch (err: any) {
      console.error("Error loading AI analytics:", err);
      toast.error(err.message || "Failed to contact Python AI engine. Ensure FastAPI is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAiData();
  }, []);

  // ─── Actions ──────────────────────────────────────────────────────────────
  const handleRunAiSync = async () => {
    try {
      setSyncing(true);
      toast.info("Running AI optimization engine on historical database transactions...");
      const res = await AiService.runAiSync();
      if (res.success) {
        toast.success("AI sync successful! Draft campaigns and alerts generated.");
        await loadAiData();
        onRefreshParent();
      } else {
        toast.error("Failed to execute AI synchronization.");
      }
    } catch (err: any) {
      toast.error(err.message || "Sync failed. Check connection to python service.");
    } finally {
      setSyncing(false);
    }
  };

  const handleApproveCampaign = async (discountName: string, approve: boolean) => {
    // Find matching draft discount in the database
    const matchingDraft = draftDiscounts.find(
      (d: any) => d.name === discountName && d.approvalStatus === 'DRAFT'
    );

    if (!matchingDraft) {
      // If it has already been approved
      const matchingApproved = draftDiscounts.find(
        (d: any) => d.name === discountName && d.approvalStatus === 'APPROVED'
      );
      if (matchingApproved) {
        toast.info("This AI recommendation is already approved and active!");
        return;
      }
      toast.error("Draft campaign not found. Try running AI Sync to regenerate.");
      return;
    }

    try {
      setLoading(true);
      const res = await DiscountService.toggleStatus(matchingDraft.id, {
        approvalStatus: approve ? 'APPROVED' : 'DRAFT',
        isActive: approve ? true : false
      });
      if (res.success) {
        toast.success(approve ? `"${discountName}" approved and activated!` : `Campaign declined.`);
        loadAiData();
      }
    } catch (err: any) {
      toast.error(err.message || "Server error updating campaign.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Rendering Helper ─────────────────────────────────────────────────────
  const getVelocityBadgeColor = (status: string) => {
    switch (status) {
      case 'Fast Moving':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Dead Stock':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'Slow Moving':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Orchestrator Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#0e4e34] rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-6 border border-slate-700">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-400 text-[24px] animate-pulse">auto_awesome</span>
            <h2 className="text-xl font-black tracking-tight">
              {isAdmin ? "AI Optimization Core (Admin Console)" : "AI Optimization Suggestions (Manager Console)"}
            </h2>
          </div>
          <p className="text-slate-300 text-xs max-w-xl font-medium leading-relaxed">
            Mined from transaction history using linear regression forecasting, Apriori rule mining, and Gemini AI validation. 
            <strong> Objective:</strong> Target dead stock, slow-moving items, and near-expiry goods to reduce wastage, prioritizing stock turnover over short-term margins.
          </p>
        </div>
        <div>
          <button
            onClick={handleRunAiSync}
            disabled={syncing || loading}
            className={`px-5 py-3 rounded-xl font-extrabold text-xs shadow-md transition-all flex items-center gap-2 ${
              syncing 
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                : 'bg-emerald-500 hover:bg-emerald-400 text-white cursor-pointer hover:scale-[1.02]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px] animate-spin-slow">
              {syncing ? 'refresh' : 'physics'}
            </span>
            {syncing ? "Running Optimization..." : "Execute AI Sync Pipeline"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
          <div className="w-8 h-8 border-4 border-[#0b8252] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm font-semibold">Retrieving AI models and transaction forecasts...</p>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Column 1: AI Combo Suggestions (Takes 2 Cols on lg) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
              {/* AI Distinct Marker */}
              <div className="absolute top-0 right-0 p-2">
                <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-300 text-emerald-700 text-[8px] font-black rounded-full uppercase flex items-center gap-1">
                  <span className="material-symbols-outlined text-[10px] animate-spin-slow">auto_awesome</span>
                  AI Engine
                </span>
              </div>

              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-extrabold text-base text-slate-800 leading-tight">AI Combo Suggestions</h3>
                  <p className="text-[11px] font-medium text-slate-500 mt-1">Cross-selling combos validating via Gemini AI to clear slow stock</p>
                </div>
                <span className="material-symbols-outlined text-emerald-600">point_of_sale</span>
              </div>

              {/* Combo Explanation Alert */}
              <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-3.5 mb-6 text-xs text-slate-600 leading-relaxed">
                <p className="font-black text-[#0b8252] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">info</span>
                  Inventory Turnover Purpose
                </p>
                <p className="mt-1 font-medium">
                  These combinations are designed to pack **Fast Moving** items together with **Dead Stock** or **Slow Moving** products. By discounting the bundle, we incentivize customers to clear slow inventory and minimize wastage. Admin approval is required to activate these campaigns at POS checkout.
                </p>
              </div>

              {combos.length === 0 ? (
                <div className="text-center py-10 text-xs font-semibold text-slate-400">
                  No purchase pattern combos generated yet. Click "Execute AI Sync Pipeline" to mine rules.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {combos.map((item, idx) => {
                    const isDraft = draftDiscounts.some(
                      (d: any) => d.name === item.name && d.approvalStatus === 'DRAFT'
                    );
                    const isApproved = draftDiscounts.some(
                      (d: any) => d.name === item.name && d.approvalStatus === 'APPROVED'
                    );

                    return (
                      <div key={idx} className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-all bg-slate-50/50">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="font-extrabold text-xs text-slate-800 truncate" title={item.name}>{item.name}</h4>
                            {item.isClearingSlow && (
                              <span className="px-1.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-600 text-[8px] font-black rounded uppercase shrink-0">
                                Clearance Focus
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 leading-relaxed font-medium">{item.reason}</p>
                          
                          <div className="bg-white border border-slate-100 rounded-lg p-2.5 space-y-1.5 text-[11px]">
                            <div className="flex justify-between text-slate-600">
                              <span>{item.product_a}</span>
                              <span className="font-bold">Rs. {item.price_a.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>{item.product_b}</span>
                              <span className="font-bold">Rs. {item.price_b.toFixed(2)}</span>
                            </div>
                            <div className="h-px bg-slate-100 my-1" />
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400 font-bold">Orig: <del>Rs. {item.originalPrice.toFixed(2)}</del></span>
                              <span className="text-emerald-600 font-black">AI Bundle: Rs. {item.comboPrice.toFixed(2)} ({item.discountValue}% Off)</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                            <span>Support: {(item.support * 100).toFixed(1)}%</span>
                            <span>Confidence: {(item.confidence * 100).toFixed(0)}%</span>
                            <span>Lift: {item.lift.toFixed(1)}x</span>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                          {isApproved ? (
                            <span className="w-full text-center py-2 bg-emerald-50 text-[#0b8252] border border-emerald-200 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">check_circle</span>
                              Active &amp; Approved
                            </span>
                          ) : isDraft ? (
                            isAdmin ? (
                              <>
                                <button
                                  onClick={() => handleApproveCampaign(item.name, true)}
                                  className="flex-1 py-2 bg-[#0b8252] hover:bg-[#096b43] text-white font-extrabold rounded-lg text-[10px] transition-colors cursor-pointer shadow-sm uppercase tracking-wider"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleApproveCampaign(item.name, false)}
                                  className="px-3 py-2 border border-slate-200 text-slate-500 hover:bg-slate-100 font-extrabold rounded-lg text-[10px] transition-colors cursor-pointer"
                                >
                                  Decline
                                </button>
                              </>
                            ) : (
                              <span className="w-full text-center py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1">
                                <span className="material-symbols-outlined text-[14px] animate-pulse">pending</span>
                                Pending Admin Approval
                              </span>
                            )
                          ) : (
                            <span className="w-full text-center py-2 text-slate-400 text-[10px] font-bold">
                              Sync required to activate
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Smart Clearance Markdowns */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
              {/* AI Distinct Marker */}
              <div className="absolute top-0 right-0 p-2">
                <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-300 text-emerald-700 text-[8px] font-black rounded-full uppercase flex items-center gap-1">
                  <span className="material-symbols-outlined text-[10px] animate-spin-slow">auto_awesome</span>
                  AI Engine
                </span>
              </div>

              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-extrabold text-base text-slate-800 leading-tight">Smart Expiry &amp; Seasonal Markdowns</h3>
                  <p className="text-[11px] font-medium text-slate-500 mt-1">Clearance suggestions for near-expiry and seasonal inventory</p>
                </div>
                <span className="material-symbols-outlined text-emerald-600">local_offer</span>
              </div>

              {/* Expiry Explanation Notice */}
              <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-3.5 mb-6 text-xs text-slate-600 leading-relaxed">
                <p className="font-black text-[#0b8252] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">info</span>
                  Markdown Clearance Purpose
                </p>
                <p className="mt-1 font-medium">
                  Products nearing their expiry date are flagged automatically. AI clearance suggests promotional discounts to sell this stock before write-off dates, minimizing wastage costs. Admins must approve the markdown campaigns to deploy them to the cash registers.
                </p>
              </div>

              {discounts.length === 0 ? (
                <div className="text-center py-8 text-xs font-semibold text-slate-400">
                  All active products have healthy expiry windows and are in season.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70">
                        {['Product SKU & Name', 'Stock', 'Reason', 'Orig Price', 'Markdown', 'Action'].map((h, i) => (
                          <th key={i} className={`p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest ${i === 1 || i === 4 ? 'text-center' : i === 3 ? 'text-right' : ''}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                      {discounts.map((item, idx) => {
                        const campaignName = `AI Clearance: ${item.name}`;
                        const isDraft = draftDiscounts.some(
                          (d: any) => d.name === campaignName && d.approvalStatus === 'DRAFT'
                        );
                        const isApproved = draftDiscounts.some(
                          (d: any) => d.name === campaignName && d.approvalStatus === 'APPROVED'
                        );

                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3">
                              <span className="block font-bold text-slate-800 truncate max-w-[200px]">{item.name}</span>
                              <span className="text-[9px] text-slate-400 font-medium">SKU: {item.sku} ({item.category})</span>
                            </td>
                            <td className="p-3 text-center font-bold text-slate-500">{item.currentStock} units</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 bg-rose-50 text-rose-700 font-bold border border-rose-100 rounded text-[10px]">
                                {item.reason}
                              </span>
                            </td>
                            <td className="p-3 text-right text-slate-400 font-semibold">Rs. {item.originalPrice.toFixed(2)}</td>
                            <td className="p-3 text-center text-rose-600 font-black">
                              Rs. {item.promoPrice.toFixed(2)} (-{item.suggestedDiscount}%)
                            </td>
                            <td className="p-3">
                              {isApproved ? (
                                <span className="px-2 py-1 text-[8px] bg-emerald-100 text-emerald-800 font-black rounded uppercase flex items-center gap-1 w-max">
                                  <span className="material-symbols-outlined text-[10px]">check</span>
                                  Approved
                                </span>
                              ) : isDraft ? (
                                isAdmin ? (
                                  <button
                                    onClick={() => handleApproveCampaign(campaignName, true)}
                                    className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded text-[9px] transition-colors cursor-pointer shadow-sm"
                                  >
                                    Approve
                                  </button>
                                ) : (
                                  <span className="px-2 py-1 text-[8px] bg-amber-50 text-amber-700 border border-amber-200 font-black rounded uppercase flex items-center gap-1 w-max">
                                    <span className="material-symbols-outlined text-[10px] animate-pulse">pending</span>
                                    Pending
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-400 text-[9px] font-medium">Sync Needed</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Column 2: AI Demand Forecasting & Replenishment (1 Col on lg) */}
          <div className="space-y-6">
            
            {/* Stock Velocity Classification */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-extrabold text-base text-slate-800 leading-tight">Velocity Statistics</h3>
                  <p className="text-[11px] font-medium text-slate-500 mt-1">Live turnover ratios of all products in past 30 days</p>
                </div>
                <span className="material-symbols-outlined text-emerald-600">query_stats</span>
              </div>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {velocity.slice(0, 8).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-xs text-slate-800 truncate max-w-[170px]" title={item.name}>
                        {item.name}
                      </h4>
                      <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                        Sold: <span className="font-bold text-slate-700">{item.unitsSold} units</span> ({item.saleEvents} tx)
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 text-[8px] font-black rounded border uppercase tracking-wider shrink-0 ${getVelocityBadgeColor(item.status)}`}>
                      {item.status.replace(" Stock", "")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Demand Forecasting */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-extrabold text-base text-slate-800 leading-tight">AI Restock Advisor</h3>
                  <p className="text-[11px] font-medium text-slate-500 mt-1">Linear Regression forecasts of 30-day product demand</p>
                </div>
                <span className="material-symbols-outlined text-emerald-600">reorder</span>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {forecasts.filter(f => f.suggestedQty > 0).slice(0, 8).map((item, idx) => {
                  const isCrit = item.urgency === 'Critical';
                  return (
                    <div key={idx} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
                      <div className="flex justify-between items-start">
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-xs text-slate-800 truncate max-w-[180px]" title={item.name}>
                            {item.name}
                          </h4>
                          <p className="text-[9px] text-slate-400 font-medium">
                            Stock: <span className="font-extrabold text-slate-600">{item.currentStock}</span> / Threshold: {item.reorderLevel}
                          </p>
                        </div>
                        <span className={`px-1.5 py-0.5 text-[8px] font-black rounded border uppercase tracking-wider ${
                          isCrit ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-amber-50 border-amber-200 text-amber-600'
                        }`}>
                          {item.urgency}
                        </span>
                      </div>

                      <div className="flex justify-between items-end bg-white border border-slate-100 rounded-lg p-2 text-[10px]">
                        <div>
                          <span className="text-slate-400 font-bold block uppercase text-[8px]">Predicted Sales</span>
                          <span className="font-extrabold text-slate-700">{item.forecastedDemand} units</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block uppercase text-[8px]">Restock Advice</span>
                          <span className="font-black text-[#0b8252] text-xs">+{item.suggestedQty} Units</span>
                        </div>
                        <button
                          onClick={() => {
                            navigate(`/inventory-operations?tab=grn&action=add&sku=${item.sku}`);
                            toast.info(`Redirected to Procurement GRN for SKU ${item.sku}`);
                          }}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[8px] transition-colors cursor-pointer shadow-sm"
                        >
                          Restock
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
