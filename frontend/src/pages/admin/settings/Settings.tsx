import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

import AdminSidebar from "../Shared/Sidebar";
import ManagerSidebar from "../../inventory/Shared/Sidebar";
import AdminHeader from "../Shared/AdminHeader";
import ManagerHeader from "../../inventory/Shared/InventoryHeader";

import SettingsProfile from "./SettingComponent/SettingsProfile";
import SettingsAccount from "./SettingComponent/SettingsAccount";
import SettingsStockRules from "./SettingComponent/SettingsStockRules";
import SettingsAlerts from "./SettingComponent/SettingsAlerts";
import { StockRulesConfig } from "./SettingComponent/types";
import { api } from '@/services/axiosInstance';


const DEFAULT_RULES: StockRulesConfig = {
  defaultReorderLevel: '50',
  minimumStockThreshold: '20',
  maximumStockLimit: 'No limit',
  stockUpdateMode: 'Real-time',
  allowNegativeStock: false,
  autoDeductStock: true,
  enableLowStockAlerts: true,
  enableOutOfStockAlerts: true,
  enableDeadStockAlerts: false,
  enableExpiringSoonAlerts: true,
  enableOverstockAlerts: false,
  notifyInApp: true,
  notifyEmail: true,
  notifySMS: false,
};

export default function Settings() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'My Profile';

  const [rules, setRules] = useState<StockRulesConfig>(DEFAULT_RULES);
  const [applyToAll, setApplyToAll] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get('/settings/STOCK_RULES');
        if (response.data && response.data.data) {
          setRules(response.data.data);
        }
      } catch (error: any) {
        if (error.response && error.response.status === 404) {
          // Setting not found, use default
          setRules(DEFAULT_RULES);
        } else {
          console.error("Failed to fetch settings:", error);
          toast.error("Failed to load settings from server.");
        }
      }
    };
    fetchSettings();
  }, []);

  const validateRules = () => {
    const newErrors: { [key: string]: string } = {};
    if (!/^\d+$/.test(rules.defaultReorderLevel)) {
      newErrors.defaultReorderLevel = 'Must be a valid number';
    }
    if (!/^\d+$/.test(rules.minimumStockThreshold)) {
      newErrors.minimumStockThreshold = 'Must be a valid number';
    }
    // If maximumStockLimit is supposed to be a number unless it's "No limit", we can check it
    if (rules.maximumStockLimit !== 'No limit' && !/^\d+$/.test(rules.maximumStockLimit)) {
      newErrors.maximumStockLimit = 'Must be a valid number or "No limit"';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveSettings = async () => {
    if (['Stock Rules', 'Alerts'].includes(activeTab)) {
      if (!validateRules()) {
        toast.error('Please fix the errors in the form.');
        return;
      }
    }

    try {
      await api.put('/settings/STOCK_RULES', { value: rules });
      
      if (applyToAll && activeTab === 'Stock Rules') {
        await api.post('/settings/apply-stock-rules');
        toast.success("Settings saved and applied to all existing products!");
        setApplyToAll(false); // reset after applying
      } else {
        toast.success("Settings saved successfully!");
      }
    } catch (error: any) {
      console.error("Failed to save settings:", error);
      // toast.error is handled globally in axiosInstance.ts
    }
  };

  const resetSettings = async () => {
    setRules(DEFAULT_RULES);
    try {
      await api.put('/settings/STOCK_RULES', { value: DEFAULT_RULES });
      toast.success("Settings reset to defaults.");
    } catch (error) {
      console.error("Failed to reset settings:", error);
      toast.error("Failed to reset settings on server.");
    }
  };

  const tabs = [
    { id: 'My Profile', icon: 'person' },
    { id: 'Account Settings', icon: 'settings' },
    { id: 'Stock Rules', icon: 'rule' },
    { id: 'Alerts', icon: 'notifications' },
  ];

  const setActiveTab = (tabId: string) => {
    setSearchParams({ tab: tabId });
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="flex h-screen bg-[#f8f9fa] text-slate-800 font-sans overflow-hidden">
      {isAdmin ? <AdminSidebar /> : <ManagerSidebar />}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {isAdmin ? <AdminHeader /> : <ManagerHeader />}

        <main className="flex-1 overflow-y-auto bg-[#f8f9fa] p-6 md:p-8">
          <div className="max-w-[1200px] mx-auto space-y-6 h-full flex flex-col">

            <div className="flex-shrink-0">
              <h1 className="text-3xl font-bold text-slate-800">Inventory Settings</h1>
              <p className="text-slate-500 mt-1">Configure stock rules, alerts, and inventory behavior for your supermarket system.</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-1 overflow-hidden min-h-[600px]">

              {/* Left Settings Sidebar */}
              <div className="w-64 border-r border-slate-200 p-4 flex flex-col gap-1 overflow-y-auto bg-white flex-shrink-0">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id
                      ? 'bg-[#0b8252] text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                    {tab.id}
                  </button>
                ))}
              </div>

              {/* Right Content Area */}
              <div className="flex-1 flex flex-col bg-white overflow-hidden">
                <div className="p-8 flex-1 overflow-y-auto bg-slate-50/30">

                  {activeTab === 'My Profile' && (
                    <SettingsProfile />
                  )}
                  {activeTab === 'Account Settings' && (
                    <SettingsAccount />
                  )}
                  {activeTab === 'Stock Rules' && (
                    <SettingsStockRules rules={rules} errors={errors} onChange={(updated) => setRules(updated)} />
                  )}
                  {activeTab === 'Alerts' && (
                    <SettingsAlerts rules={rules} onChange={(updated) => setRules(updated)} />
                  )}

                </div>

                {/* Footer */}
                {['Stock Rules', 'Alerts'].includes(activeTab) && (
                  <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-4">
                      <p className="text-sm text-slate-500 italic">Unsaved changes will be lost.</p>
                      {activeTab === 'Stock Rules' && (
                        <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer bg-white px-3 py-1.5 rounded-md border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors">
                          <input 
                            type="checkbox" 
                            checked={applyToAll} 
                            onChange={(e) => setApplyToAll(e.target.checked)}
                            className="rounded border-slate-300 text-[#0b8252] focus:ring-[#0b8252] w-4 h-4 cursor-pointer"
                          />
                          Apply to all existing products
                        </label>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={resetSettings}
                        className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 font-bold text-sm rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
                      >
                        Reset
                      </button>
                      <button
                        onClick={saveSettings}
                        className="px-6 py-2.5 bg-[#0b8252] text-white font-bold text-sm rounded-lg shadow-sm hover:bg-[#096b43] transition-colors"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
