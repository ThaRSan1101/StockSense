import Sidebar from '../Shared/Sidebar';
import AdminHeader from '../Shared/AdminHeader';
import AiInsightsTab from '../../inventory/InventoryAnalytics/analytics/AiInsightsTab';

export default function AdminAiOptimizations() {
  const handleRefresh = () => {
    console.log("[AdminAiOptimizations] AI analytics refreshed.");
  };

  return (
    <div className="flex h-screen bg-[#f8f9fa] text-slate-800 font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <AdminHeader />

        <main className="flex-1 overflow-y-auto px-6 py-6 bg-[#f8f9fa]">
          <div className="max-w-[1400px] w-full mx-auto space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-6">
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">AI Optimization Engine</h1>
                <p className="text-slate-500 text-sm mt-1 font-medium">Verify suggested clearance promotions, bundles, and restock levels</p>
              </div>
            </div>
            
            <AiInsightsTab onRefreshParent={handleRefresh} />
          </div>
        </main>
      </div>
    </div>
  );
}
