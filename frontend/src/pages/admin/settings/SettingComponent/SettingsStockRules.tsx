
import { StockRulesConfig } from "./types";
import { Toggle } from './Toggle';

interface Props {
  rules: StockRulesConfig;
  errors?: { [key: string]: string };
  onChange: (updated: StockRulesConfig) => void;
}

export default function SettingsStockRules({ rules, errors = {}, onChange }: Props) {
  const updateField = (field: keyof StockRulesConfig, value: any) => {
    onChange({
      ...rules,
      [field]: value
    });
  };

  return (
    <div className="max-w-4xl animate-in fade-in duration-300 space-y-6">
      {/* Top Card */}
      <div className="bg-white border border-slate-100 rounded-xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="flex items-center text-base font-bold text-slate-800">
              <span className="material-symbols-outlined text-[#0b8252] mr-2 text-[22px]">inventory_2</span>
              Global Stock Thresholds
            </h3>
            <p className="text-[14px] text-slate-400 mt-1">Set the default percentages based on product target capacity.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-8">
          {/* Default Reorder Level */}
          <div>
            <label className="flex items-center text-xs font-bold text-slate-500 mb-3 tracking-wider uppercase">
              <span className="material-symbols-outlined text-[#0b8252] text-[18px] mr-2">notifications_active</span>
              Default Reorder Level (%)
            </label>
            <div className="relative">
              <input 
                type="text" 
                value={rules.defaultReorderLevel} 
                onChange={(e) => updateField('defaultReorderLevel', e.target.value)}
                className={`w-full bg-white border ${errors.defaultReorderLevel ? 'border-rose-500' : 'border-slate-200'} text-slate-800 text-base rounded-xl px-4 py-3 focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252] transition-shadow`} 
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="bg-[#e6f4ef] text-[#0b8252] text-xs font-bold px-2 py-1 rounded-md">%</span>
              </div>
            </div>
            {errors.defaultReorderLevel && <p className="text-[10px] text-rose-500 font-medium mt-1">{errors.defaultReorderLevel}</p>}
            <p className="text-[13px] text-slate-400 mt-2 leading-relaxed">
              Reorders item when stock falls below this percentage of its capacity.
            </p>
          </div>

          {/* Minimum Stock Threshold */}
          <div>
            <label className="flex items-center text-xs font-bold text-slate-500 mb-3 tracking-wider uppercase">
              <span className="material-symbols-outlined text-[#0b8252] text-[18px] mr-2">warning_amber</span>
              Minimum Stock Threshold (%)
            </label>
            <div className="relative">
              <input 
                type="text" 
                value={rules.minimumStockThreshold} 
                onChange={(e) => updateField('minimumStockThreshold', e.target.value)}
                className={`w-full bg-white border ${errors.minimumStockThreshold ? 'border-rose-500' : 'border-slate-200'} text-slate-800 text-base rounded-xl px-4 py-3 focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252] transition-shadow`} 
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="bg-[#e6f4ef] text-[#0b8252] text-xs font-bold px-2 py-1 rounded-md">%</span>
              </div>
            </div>
            {errors.minimumStockThreshold && <p className="text-[10px] text-rose-500 font-medium mt-1">{errors.minimumStockThreshold}</p>}
            <p className="text-[13px] text-slate-400 mt-2 leading-relaxed">
              Triggers high-priority alerts when stock falls below this safety margin.
            </p>
          </div>

          {/* Maximum Stock Limit */}
          <div>
            <label className="flex items-center text-xs font-bold text-slate-500 mb-3 tracking-wider uppercase">
              <span className="material-symbols-outlined text-[#0b8252] text-[18px] mr-2">production_quantity_limits</span>
              Maximum Stock Limit (%)
            </label>
            <div className="relative">
              <input 
                type="text" 
                value={rules.maximumStockLimit} 
                onChange={(e) => updateField('maximumStockLimit', e.target.value)}
                className={`w-full bg-white border ${errors.maximumStockLimit ? 'border-rose-500' : 'border-slate-200'} text-slate-800 text-base rounded-xl px-4 py-3 focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252] transition-shadow`} 
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="bg-[#e6f4ef] text-[#0b8252] text-xs font-bold px-2 py-1 rounded-md">%</span>
              </div>
            </div>
            {errors.maximumStockLimit && <p className="text-[10px] text-rose-500 font-medium mt-1">{errors.maximumStockLimit}</p>}
            <p className="text-[13px] text-slate-400 mt-2 leading-relaxed">
              Upper ceiling capacity percentage to prevent warehouse overstocking.
            </p>
          </div>

          {/* Stock Update Mode */}
          <div>
            <label className="flex items-center text-xs font-bold text-slate-500 mb-3 tracking-wider uppercase">
              <span className="material-symbols-outlined text-[#0b8252] text-[18px] mr-2">sync</span>
              Stock Update Mode
            </label>
            <div className="relative">
              <select 
                value={rules.stockUpdateMode}
                onChange={(e) => updateField('stockUpdateMode', e.target.value)}
                className="w-full appearance-none bg-white border border-slate-200 text-slate-800 text-base rounded-xl px-4 py-3 pr-10 focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252] transition-shadow cursor-pointer"
              >
                <option>Real-time</option>
                <option>Batch</option>
              </select>
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[20px]">expand_more</span>
            </div>
            <p className="text-[13px] text-slate-400 mt-2 leading-relaxed">
              Real-time subtracts units instantly on transaction checkout.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Card */}
      <div className="bg-white border border-slate-100 rounded-xl p-8 shadow-sm">
        <h3 className="flex items-center text-base font-bold text-slate-800 mb-6">
          <span className="material-symbols-outlined text-[#0b8252] mr-2 text-[22px]">settings_suggest</span>
          POS Checkout Rules
        </h3>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-50 pb-6">
            <div>
              <h4 className="text-[15px] font-bold text-slate-800">Allow Negative Stock</h4>
              <p className="text-[14px] text-slate-400 mt-1">Permit cashiers to scan and sell grocery items even if computer stock count is zero.</p>
            </div>
            <div className="cursor-pointer ml-4" onClick={() => updateField('allowNegativeStock', !rules.allowNegativeStock)}>
              <Toggle active={rules.allowNegativeStock} />
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-2">
            <div>
              <h4 className="text-[15px] font-bold text-slate-800">Auto Deduct Stock</h4>
              <p className="text-[14px] text-slate-400 mt-1">Automatically update inventory levels on the database upon receipt generation.</p>
            </div>
            <div className="cursor-pointer ml-4" onClick={() => updateField('autoDeductStock', !rules.autoDeductStock)}>
              <Toggle active={rules.autoDeductStock} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
