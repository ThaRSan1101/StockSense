import { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import AdminSidebar from "../../admin/Shared/Sidebar";
import AdminHeader from "../../admin/Shared/AdminHeader";
import InventorySidebar from "../Shared/Sidebar";
import InventoryHeader from "../Shared/InventoryHeader";
import { useAlerts } from './hooks/useAlerts';
import AlertSummary from './components/AlertSummary';
import AlertFilterBar from './components/AlertFilterBar';
import EmptyAlertsState from './components/EmptyAlertsState';
import AlertCard from './components/AlertCard';
import NotificationDetailsPopup from '../../../components/shared/NotificationDetailsPopup';
import ProductSpecModal, { ProductSpecItem } from '../../../components/shared/ProductSpecModal';
import { api } from '../../../services/axiosInstance';
import { AlertItem } from './types/alertTypes';

export default function Alerts() {
  const {
    visible,
    unread,
    criticalAlerts,
    lowStockAlerts,
    outOfStockAlerts,
    expiryAlerts,
    deadStockAlerts,
    overstockAlerts,
    reorderSuggestions,
    discountAlerts,
    smartInsights,
    filtered,
    activeTab,
    setActiveTab,
    showFilters,
    setShowFilters,
    sevFilter,
    setSevFilter,
    readFilter,
    setReadFilter,
    filtersActive,
    tabCount,
    dismiss,
    markRead,
    markAllRead,
    handlePrimary,
    loading,
    selectedNotification,
    setSelectedNotification,
    loadDynamicAlerts
  } = useAlerts();

  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // ── Product Spec Modal state ───────────────────────────────────────────────
  const [viewingProduct, setViewingProduct] = useState<ProductSpecItem | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(false);

  const handleViewProduct = async (alert: AlertItem) => {
    const sku = alert.sku;
    if (!sku) return;

    try {
      setLoadingProduct(true);
      // Fetch all products and find the one matching this SKU
      const res = await api.get('/products');
      const products: any[] = res.data?.data ?? res.data ?? [];
      const found = products.find((p: any) => p.sku === sku);
      if (!found) return;

      // Map backend product shape to ProductSpecItem
      const specProduct: ProductSpecItem = {
        id: found.sku,
        name: found.name,
        sku: found.sku,
        barcode: found.barcode,
        category: found.masterClass?.category?.name ?? found.category ?? '—',
        subcategory: found.masterClass?.subCategory?.name ?? found.subcategory ?? '',
        supplier: found.masterClass?.supplier?.name ?? found.supplier ?? '—',
        brand: found.masterClass?.brand?.name ?? found.brand ?? '',
        unitType: found.unitType,
        stock: found.currentStock,
        reorderLevel: found.reorderLevel,
        targetCapacity: found.targetCapacity,
        costPrice: found.costPrice,
        sellingPrice: found.sellingPrice,
        status: found.status,
        imageUrl: found.imageUrl ?? null,
        description: found.description ?? '',
        mfgDate: found.mfgDate ? new Date(found.mfgDate).toLocaleDateString('en-GB') : undefined,
        expiryDate: found.expiryDate ? new Date(found.expiryDate).toLocaleDateString('en-GB') : undefined,
        batchNumber: found.batchNumber ?? undefined,
      };
      setViewingProduct(specProduct);
    } catch (err) {
      console.error('Failed to fetch product details:', err);
    } finally {
      setLoadingProduct(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f8f9fa] text-slate-800 font-sans overflow-hidden">
      {isAdmin ? <AdminSidebar /> : <InventorySidebar />}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Header */}
        {isAdmin ? <AdminHeader /> : <InventoryHeader />}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto px-6 py-6 bg-[#f8f9fa]">
          <div className="max-w-[1400px] w-full mx-auto space-y-6">

            {/* Top Header */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Alerts &amp; Notifications</h1>
                <p className="text-slate-500 text-sm mt-1">
                  Monitor inventory health — low stock, expiry dates, dead stock, and reorder needs.
                  {unread > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                      {unread} unread
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Filters button */}
                <button
                  onClick={() => setShowFilters(true)}
                  className={`flex items-center gap-2 px-4 py-2.5 border font-bold text-sm rounded-lg shadow-sm transition-colors ${
                    filtersActive
                      ? 'bg-[#eef8f2] border-[#0b8252] text-[#0b8252]'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">filter_list</span>
                  Filters
                  {filtersActive && <span className="w-2 h-2 bg-[#0b8252] rounded-full" />}
                </button>

                {/* Mark All Read */}
                <button
                  onClick={markAllRead}
                  disabled={unread === 0}
                  className="flex items-center gap-2 bg-[#0b8252] text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-sm hover:bg-[#096b43] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[18px]">done_all</span>
                  Mark All Read
                </button>
              </div>
            </div>

            {/* Alert Summary KPIs & Smart Insights */}
            <AlertSummary
              totalAlerts={visible.length}
              criticalAlerts={criticalAlerts}
              lowStockAlerts={lowStockAlerts}
              outOfStockAlerts={outOfStockAlerts}
              expiryAlerts={expiryAlerts}
              deadStockAlerts={deadStockAlerts}
              overstockAlerts={overstockAlerts}
              reorderSuggestions={reorderSuggestions}
              discountAlerts={discountAlerts}
              smartInsights={smartInsights}
              setActiveTab={setActiveTab}
              setSevFilter={setSevFilter}
            />

            {/* Tabs & Filter Bar */}
            <AlertFilterBar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              tabCount={tabCount}
              showFilters={showFilters}
              setShowFilters={setShowFilters}
              sevFilter={sevFilter}
              setSevFilter={setSevFilter}
              readFilter={readFilter}
              setReadFilter={setReadFilter}
            />

            {/* Alert Cards */}
            <div className="space-y-4">
              {loading && filtered.length === 0 ? (
                <div className="text-center py-12 text-sm font-bold text-slate-500">
                  Loading active alerts...
                </div>
              ) : filtered.length === 0 ? (
                <EmptyAlertsState
                  setActiveTab={setActiveTab}
                  setSevFilter={setSevFilter}
                  setReadFilter={setReadFilter}
                />
              ) : (
                filtered.map(alert => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    handlePrimary={handlePrimary}
                    dismiss={dismiss}
                    markRead={markRead}
                    onViewProduct={handleViewProduct}
                  />
                ))
              )}
            </div>

            {/* Loading overlay while fetching product */}
            {loadingProduct && (
              <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-xl p-6 flex items-center gap-3 shadow-xl">
                  <span className="material-symbols-outlined text-[#0b8252] animate-spin text-[24px]">progress_activity</span>
                  <span className="text-sm font-bold text-slate-700">Loading product details...</span>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Notification Details Dialog Popup */}
      {selectedNotification && (
        <NotificationDetailsPopup
          notification={selectedNotification}
          onClose={() => setSelectedNotification(null)}
          onActionComplete={loadDynamicAlerts}
        />
      )}

      {/* Product Specification Details Modal */}
      {viewingProduct && (
        <ProductSpecModal
          product={viewingProduct}
          onClose={() => setViewingProduct(null)}
        />
      )}
    </div>
  );
}
