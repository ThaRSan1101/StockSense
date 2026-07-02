import React from 'react';
import { AiComboItem } from '../../../../services/aiService';

interface CombosTabProps {
  aiCombos: AiComboItem[];
}

export default function CombosTab({ aiCombos }: CombosTabProps) {
  return (
    <div className="space-y-6">
      {/* Overview Intro Banner */}
      <div className="bg-gradient-to-br from-slate-900 to-[#0c3624] border border-slate-800 rounded-2xl p-6 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-emerald-400 text-3xl">join_inner</span>
          <div>
            <h3 className="font-extrabold text-lg">AI Market Basket Association Miner</h3>
            <p className="text-xs text-slate-300 mt-1 font-medium leading-relaxed">
              Mines customer checkouts using the Apriori algorithm to identify pairs of products frequently purchased together.
              Pairs are filtered for category compatibility (e.g. pairing food with snacks, not cleaning items) and checked by Gemini AI to suggest dynamic discount packages.
            </p>
          </div>
        </div>
      </div>

      {/* Combos list */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {aiCombos.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 col-span-full shadow-sm">
            <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">inventory_2</span>
            No combo associations detected in current sales logs. Click "Run AI Sync" to process transactions.
          </div>
        ) : (
          aiCombos.map((item, idx) => (
            <div 
              key={idx} 
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-sm font-extrabold text-slate-800 leading-snug">{item.name}</span>
                  <span className="px-2.5 py-1 bg-emerald-50 text-[#0b8252] rounded-lg text-[10px] font-black border border-emerald-100 shrink-0">
                    {item.discountValue}% OFF
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">{item.reason}</p>
              </div>

              {/* Combo products breakdown */}
              <div className="border-t border-b border-slate-100 py-3 space-y-2 text-xs font-semibold text-slate-700">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 truncate max-w-[170px]">{item.product_a}</span>
                  <span className="text-slate-800 font-bold">Rs. {item.price_a.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 truncate max-w-[170px]">{item.product_b}</span>
                  <span className="text-slate-800 font-bold">Rs. {item.price_b.toFixed(2)}</span>
                </div>
              </div>

              {/* Pricing comparison */}
              <div className="flex justify-between items-baseline pt-1">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Combo Price</span>
                  <span className="text-base font-black text-primary">Rs. {item.comboPrice.toFixed(2)}</span>
                </div>
                <div className="text-right text-[10px] text-slate-400 font-bold">
                  <span>Regular: </span>
                  <span className="line-through">Rs. {item.originalPrice.toFixed(2)}</span>
                </div>
              </div>

              {/* Mined parameters */}
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[10px] text-slate-400 font-bold">
                <span>Support: {(item.support * 100).toFixed(1)}%</span>
                <span>Confidence: {(item.confidence * 100).toFixed(0)}%</span>
                <span>Lift: {item.lift.toFixed(1)}x</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
