import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { comboService } from '../../../services/comboService';
import Sidebar from '../Shared/Sidebar';
import InventoryHeader from '../Shared/InventoryHeader';

export default function OpportunityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [data, setData] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);

  const fetchOpportunityDetails = async () => {
    try {
      setLoading(true);
      const payload = await comboService.getOpportunityDetails(id as string);
      if (payload.success) {
        setData(payload.data);
        // Load any previously generated suggestions
        if (payload.data.comboSuggestions?.length > 0) {
          setSuggestions(payload.data.comboSuggestions);
        }
      }
    } catch (error) {
      console.error('Failed to load opportunity details', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunityDetails();
  }, [id]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const payload = await comboService.generateSuggestions(id as string);
      if (payload.success) {
        setSuggestions(payload.suggestions || []);
        toast.success(`Successfully generated ${payload.suggestions?.length || 0} ranked suggestion(s).`);
      } else {
        toast.error(payload.message || 'Failed to generate suggestions.');
      }
    } catch (error: any) {
      // Axios interceptor already shows toast for non-401 errors, so only handle connection failures here
      if (!error?.response) {
        toast.error('AI service is unreachable. Please ensure the AI engine is running on port 8000.');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleConvertToDraft = async (sugId: string) => {
    try {
      const payload = await comboService.convertToDraft(sugId);
      if (payload.success) {
        toast.success('Successfully promoted suggestion to draft!');
        navigate(`/inventory-combo/builder?id=${payload.data.id}`);
      } else {
        toast.error(payload.message || 'Failed to promote suggestion.');
      }
    } catch (error: any) {
      if (!error?.response) {
        toast.error('Failed to promote suggestion. Please try again.');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-[#f8f9fa] text-slate-800 font-sans overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <InventoryHeader />
          <main className="flex-1 overflow-y-auto px-6 py-6 bg-[#f8f9fa]">
            <div className="text-center py-20 text-gray-400">Loading opportunity details...</div>
          </main>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-screen bg-[#f8f9fa] text-slate-800 font-sans overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <InventoryHeader />
          <main className="flex-1 overflow-y-auto px-6 py-6 bg-[#f8f9fa]">
            <div className="text-center py-20 text-gray-400">Opportunity not found.</div>
          </main>
        </div>
      </div>
    );
  }

  const opportunity = data;
  const candidates = data?.anchorCandidates || [];

  // Determine active selected anchor candidate (defaults to Rank 1)
  const activeAnchorId = selectedAnchorId || (candidates.length > 0 ? candidates[0].anchorProductId : null);
  const activeCandidate = candidates.find((c: any) => c.anchorProductId === activeAnchorId) || candidates[0];
  const activeSuggestion = suggestions.find((s: any) => s.primaryAnchorProductId === activeAnchorId)
    || (candidates.length > 0 && activeAnchorId === candidates[0]?.anchorProductId && suggestions.length > 0 ? suggestions[0] : null);

  return (
    <div className="flex h-screen bg-[#f8f9fa] text-slate-800 font-sans overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <InventoryHeader />

        <main className="flex-1 overflow-y-auto px-6 py-6 bg-[#f8f9fa]">
          <div className="max-w-[1400px] w-full mx-auto space-y-6">
      
      {/* Top Navigation */}
      <button 
        onClick={() => navigate('/inventory-combo')}
        className="flex items-center gap-1 text-gray-500 hover:text-[#103e2c] font-bold text-sm cursor-pointer"
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span> Back to Opportunities
      </button>

      {/* Hero Block: Opportunity Target Details */}
      <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-2 space-y-4">
          <div>
            <span className="bg-[#103e2c] text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
              {opportunity.opportunityType}
            </span>
          </div>
          <h2 className="text-2xl font-black text-gray-900">{opportunity.targetProduct?.name || opportunity.targetProductName || opportunity.targetProductId}</h2>
          <p className="text-sm text-gray-400 font-mono">SKU ID: {opportunity.targetProduct?.sku || opportunity.targetProductId}</p>
          <div className="flex gap-4 text-sm mt-4">
            <div>
              <p className="text-gray-400 font-medium">Selling Price</p>
              <p className="font-bold text-gray-800">Rs. {(opportunity.targetProduct?.sellingPrice ?? opportunity.normalPrice ?? 0).toFixed(2)}</p>
            </div>
            <div className="border-r border-gray-200"></div>
            <div>
              <p className="text-gray-400 font-medium">Cost Price</p>
              <p className="font-bold text-gray-800">Rs. {(opportunity.targetProduct?.costPrice ?? opportunity.costPrice ?? 0).toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-2xl space-y-2 border border-gray-100">
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Stock Metrics</p>
          <div className="flex justify-between items-baseline pt-2">
            <span className="text-gray-600 text-sm">Available Quantity</span>
            <span className="font-black text-lg text-gray-800">{opportunity.targetProduct?.currentStock ?? opportunity.currentStock} Units</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-gray-600 text-sm">Predicted Demand</span>
            <span className="font-bold text-gray-800">{opportunity.predictedDemand} Units</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-gray-600 text-sm">Stock Coverage</span>
            <span className="font-bold text-emerald-800">{opportunity.stockCoverageDays?.toFixed(0) || '0'} Days</span>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-2xl flex flex-col justify-between border border-gray-100">
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">AI Run Parameters</p>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              Target excess stock: <strong>{opportunity.excessStock || '0'} Units</strong>.
              Priority Rank Score is compiled based on shelf margins and coverage.
            </p>
          </div>
          <div className="pt-4 flex justify-between items-center border-t border-gray-200/50 mt-4">
            <span className="text-xs text-gray-400 font-bold">Priority Level</span>
            {(opportunity.priorityScore ?? 0) >= 80 ? (
              <span className="bg-rose-50 text-rose-700 font-black text-xs px-2.5 py-1 rounded-md border border-rose-200 uppercase">
                High ({Math.round(opportunity.priorityScore || 0)})
              </span>
            ) : (opportunity.priorityScore ?? 0) >= 50 ? (
              <span className="bg-amber-50 text-amber-800 font-black text-xs px-2.5 py-1 rounded-md border border-amber-200 uppercase">
                Medium ({Math.round(opportunity.priorityScore || 0)})
              </span>
            ) : (
              <span className="bg-blue-50 text-blue-700 font-black text-xs px-2.5 py-1 rounded-md border border-blue-200 uppercase">
                Low ({Math.round(opportunity.priorityScore || 0)})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Candidates (Left) & Suggestions (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Mined Anchor Candidates */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-6">
          <div className="flex justify-between items-center border-b border-gray-50 pb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Mined Anchor Candidates</h3>
              <p className="text-xs text-gray-400">Click any companion candidate to view its custom combo proposal.</p>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-[#103e2c] text-white hover:bg-[#165a40] font-bold px-4 py-2 text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
            >
              {generating ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                  Running AI Engine...
                </>
              ) : suggestions.length > 0 ? (
                <>
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                  Re-generate
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                  Generate Suggestions
                </>
              )}
            </button>
          </div>

          {candidates.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No companion anchor products found in transaction rules.</div>
          ) : (
            <div className="space-y-3.5 max-h-[600px] overflow-y-auto pr-1">
              {candidates.map((cand: any) => {
                const isSelected = activeAnchorId === cand.anchorProductId;
                return (
                  <div 
                    key={cand.id}
                    onClick={() => setSelectedAnchorId(cand.anchorProductId)}
                    className={`p-4 rounded-2xl border transition-all grid grid-cols-1 md:grid-cols-3 gap-4 cursor-pointer ${
                      isSelected 
                        ? 'border-[#103e2c] bg-emerald-50/40 shadow-sm ring-2 ring-[#103e2c]/30' 
                        : 'border-gray-100 bg-gray-50/30 hover:border-gray-300 hover:bg-white'
                    }`}
                  >
                    <div className="md:col-span-2 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-gray-900">{cand.anchorProduct?.name || cand.anchorProductName || cand.anchorProductId}</h4>
                        {isSelected && (
                          <span className="bg-[#103e2c] text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[10px]">check</span> Active Selection
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 font-mono">{cand.anchorProduct?.sku ? `SKU: ${cand.anchorProduct.sku}` : cand.anchorProductId}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 pt-1">
                        <span>Conf: <strong>{(cand.confidence * 100).toFixed(0)}%</strong></span>
                        <span>Lift: <strong>{cand.lift.toFixed(2)}</strong></span>
                        <span className="text-emerald-800 font-semibold">Safe Promo: <strong>{cand.anchorPromotionalStock || 0} Units</strong></span>
                      </div>
                    </div>
                    <div className="flex flex-col justify-between items-end border-l border-gray-100/80 pl-4 md:border-l-0 md:pl-0 md:items-end">
                      <div className="text-right">
                        <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Candidate Score</span>
                        <p className="text-lg font-black text-[#103e2c]">{cand.finalCandidateScore?.toFixed(0)}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        isSelected 
                          ? 'bg-[#103e2c] text-white border-[#103e2c]' 
                          : 'bg-emerald-50 text-emerald-800 border-emerald-100'
                      }`}>
                        Rank #{cand.candidateRank}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Active AI Suggestion Preview */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-6">
          <div className="flex justify-between items-center border-b border-gray-50 pb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Ranked AI Combo Proposal</h3>
              <p className="text-xs text-gray-400">
                {activeCandidate ? `Showing proposal with Rank #${activeCandidate.candidateRank} companion partner.` : 'AI pricing proposal.'}
              </p>
            </div>
          </div>

          {!activeSuggestion ? (
            <div className="text-center py-20 text-gray-400 space-y-3">
              <span className="material-symbols-outlined text-[48px] text-gray-200">auto_awesome</span>
              <p className="text-sm font-medium">
                {suggestions.length === 0 
                  ? 'Click "Generate Ranked Suggestions" on the left to activate the pricing engine.'
                  : 'Proposal not found for this partner. Click "Re-generate Suggestions" to calculate.'}
              </p>
            </div>
          ) : (() => {
            const sug = activeSuggestion;
            const normalTotal = Number(sug.normalTotalPrice || 0);
            const promoPrice = Number(sug.recommendedPrice || 0);
            const savings = Math.max(0, normalTotal - promoPrice);
            const discountPct = Number(sug.discountPercentage || (normalTotal > 0 ? (savings / normalTotal) * 100 : 0));
            const marginPct = Number(sug.expectedMarginPercentage || 0);
            const maxQty = sug.maximumQuantity || opportunity.targetProduct?.currentStock || opportunity.currentStock || 10;
            const isClearance = marginPct < 15;

            return (
              <div 
                key={sug.id} 
                className="p-6 rounded-2xl border border-emerald-100/80 bg-gradient-to-b from-emerald-50/30 to-white shadow-sm hover:shadow-md transition-all space-y-5"
              >
                {/* Header: Title + Risk Badge */}
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-[#103e2c] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        AI Recommended Deal
                      </span>
                      <span className="text-xs text-gray-400 font-bold">
                        Rank #{activeCandidate?.candidateRank ?? (sug.recommendationScore ? Math.round(sug.recommendationScore) : 1)}
                      </span>
                    </div>
                    <h4 className="font-extrabold text-gray-900 text-base mt-1.5 flex items-center gap-1.5">
                      <span className="text-[#103e2c]">{sug.targetProduct?.name || opportunity.targetProduct?.name || sug.targetProductId}</span>
                      <span className="text-gray-400 font-normal text-xs">+</span>
                      <span className="text-gray-800">{sug.primaryAnchorProduct?.name || activeCandidate?.anchorProduct?.name || sug.primaryAnchorProductId}</span>
                    </h4>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-lg border ${
                      sug.riskLevel === 'LOW' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : sug.riskLevel === 'MODERATE' || isClearance
                        ? 'bg-amber-50 text-amber-700 border-amber-200' 
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      <span className="material-symbols-outlined text-[14px]">
                        {sug.riskLevel === 'LOW' ? 'verified' : 'info'}
                      </span>
                      {isClearance ? 'Clearance Margin' : `${sug.riskLevel} Risk`}
                    </span>
                  </div>
                </div>

                {/* Price & Savings Comparison Card */}
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="border-r border-gray-100 last:border-0 pr-2">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Regular Price</p>
                    <p className="text-sm font-semibold text-gray-400 line-through mt-1">
                      Rs. {normalTotal.toFixed(0)}
                    </p>
                  </div>

                  <div className="border-r border-gray-100 last:border-0 px-2">
                    <p className="text-[10px] text-[#103e2c] font-bold uppercase tracking-wider">Combo Price</p>
                    <p className="text-lg font-black text-[#103e2c] mt-0.5">
                      Rs. {promoPrice.toFixed(0)}
                    </p>
                  </div>

                  <div className="border-r border-gray-100 last:border-0 px-2">
                    <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Customer Saves</p>
                    <p className="text-sm font-extrabold text-emerald-700 mt-1">
                      Rs. {savings.toFixed(0)} <span className="text-[10px] font-normal">({discountPct.toFixed(0)}% OFF)</span>
                    </p>
                  </div>

                  <div className="pl-2">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Store Margin</p>
                    <p className={`text-sm font-extrabold mt-1 ${marginPct >= 15 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {marginPct.toFixed(1)}% <span className="text-[10px] text-gray-400 font-normal">Profit</span>
                    </p>
                  </div>
                </div>

                {/* Clean Key Rationale Points (Simplified highlights) */}
                <div className="bg-gray-50/70 rounded-xl p-3.5 border border-gray-100 space-y-2 text-xs text-gray-700">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[16px] text-emerald-700 shrink-0 mt-0.5">trending_up</span>
                    <span>
                      <strong>High Sales Affinity:</strong> Pairs this {opportunity.opportunityType?.toLowerCase().replace('_', ' ')} item with frequently bought companion product to trigger fast sell-through.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[16px] text-emerald-700 shrink-0 mt-0.5">shield</span>
                    <span>
                      <strong>Capital Recovery:</strong> Guarantees sales above wholesale cost price, ensuring zero write-off loss on expiring stock.
                    </span>
                  </div>
                </div>

                {/* Footer: Max Quantity & Action Button */}
                <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span className="material-symbols-outlined text-[18px] text-gray-400">inventory_2</span>
                    <span>Max Campaign Volume: <strong className="text-gray-900 font-bold">{maxQty} Packs</strong></span>
                  </div>

                  <button
                    onClick={() => handleConvertToDraft(sug.id)}
                    className="bg-[#103e2c] text-white hover:bg-[#165a40] font-bold px-5 py-2.5 text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm hover:scale-[1.02]"
                  >
                    <span>Promote to Draft</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        </div>
      </div>
    </main>
  </div>
</div>
  );
}
