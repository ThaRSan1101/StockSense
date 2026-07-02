import React from 'react';
import { ReorderItem } from './analyticsTypes';

interface ForecastTabProps {
  aiForecasts: any[];
  dynamicReorderSuggestions: ReorderItem[];
  triggerToast: (msg: string) => void;
}

export default function ForecastTab({ aiForecasts, dynamicReorderSuggestions, triggerToast }: ForecastTabProps) {
  return (
    <div className="space-y-6">
      {/* Smart Reorder Cards */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="font-extrabold text-base text-slate-800 mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">notifications_active</span>
          Smart Restock Alerts
        </h3>
        {dynamicReorderSuggestions.length === 0 ? (
          <p className="text-xs font-semibold text-slate-400 py-6 text-center">No restock recommendations at this time.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {dynamicReorderSuggestions.map((item, idx) => {
              const isCritical = item.urgency === 'Critical';
              const isWarning = item.urgency === 'Warning';
              return (
                <div 
                  key={idx} 
                  className={`border rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow ${
                    isCritical ? 'border-rose-200 bg-rose-50/10' :
                    isWarning ? 'border-amber-200 bg-amber-50/10' :
                    'border-slate-200 bg-slate-50/10'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-black text-slate-800 leading-snug">{item.name}</span>
                      <span className={`px-2 py-0.5 text-[8px] font-black rounded uppercase tracking-wider ${
                        isCritical ? 'bg-rose-100 text-rose-700' :
                        isWarning ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {item.urgency}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      <span>Stock: </span>
                      <span className="font-bold text-slate-700">{item.stock}</span>
                      <span> / Threshold: </span>
                      <span className="font-bold text-slate-700">{item.threshold}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-baseline pt-1">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Suggested Order</span>
                      <span className="text-lg font-black text-slate-800">{item.suggestedQty} units</span>
                    </div>
                    <button
                      onClick={() => triggerToast(`Restock order of ${item.suggestedQty} units queued for ${item.name}`)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                        isCritical ? 'bg-rose-600 hover:bg-rose-700 text-white' :
                        isWarning ? 'bg-amber-500 hover:bg-amber-600 text-white' :
                        'bg-slate-800 hover:bg-slate-900 text-white'
                      }`}
                    >
                      Reorder Now
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Demand Forecast List */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-extrabold text-base text-slate-800 leading-tight">AI 30-Day Demand Forecast & Stock Planning</h3>
            <p className="text-[11px] font-medium text-slate-500 mt-1">Linear regression projections for active catalog products</p>
          </div>
          <span className="material-symbols-outlined text-primary text-[20px] animate-pulse">auto_awesome</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-black uppercase tracking-wider">
                <th className="p-3">Product Name</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-center">Current Stock</th>
                <th className="p-3 text-center">Reorder Threshold</th>
                <th className="p-3 text-center">AI Projected Demand (30d)</th>
                <th className="p-3 text-center">Recommended Order</th>
                <th className="p-3 text-center">Urgency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
              {aiForecasts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400 font-bold">
                    No forecast predictions loaded. Click "Run AI Sync" in the header to synchronize.
                  </td>
                </tr>
              ) : (
                aiForecasts.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-extrabold text-slate-800">{item.name}</td>
                    <td className="p-3 text-slate-500 text-[11px]">{item.category}</td>
                    <td className="p-3 text-center font-bold">{item.currentStock}</td>
                    <td className="p-3 text-center font-bold text-slate-400">{item.reorderLevel}</td>
                    <td className="p-3 text-center font-black text-primary">{item.forecastedDemand} units</td>
                    <td className="p-3 text-center font-black text-[#0b8252]">
                      {item.suggestedQty > 0 ? `${item.suggestedQty} units` : '—'}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 text-[8px] font-black rounded uppercase tracking-wider ${
                        item.urgency === 'Critical' ? 'bg-rose-100 text-rose-700' :
                        item.urgency === 'Warning' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {item.urgency}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
