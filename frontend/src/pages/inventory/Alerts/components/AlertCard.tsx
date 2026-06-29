import React from 'react';
import { AlertItem, AlertSeverity } from '../types/alertTypes';
import { Link } from 'react-router-dom';

interface AlertCardProps {
  alert: AlertItem;
  handlePrimary: (a: AlertItem) => void;
  dismiss: (id: number | string) => void;
  markRead: (id: number | string) => void;
  onViewProduct: (a: AlertItem) => void;
}

// Derive SKU from dynamic alert IDs like dyn_out_SKU-001
const extractSku = (id: string | number): string | null => {
  if (typeof id !== 'string') return null;
  const parts = id.split('_');
  if (id.startsWith('dyn_') && parts.length >= 3) return parts.slice(2).join('_');
  return null;
};

const getSeverityBadgeClass = (severity: AlertSeverity) => {
  if (severity === 'Critical') return 'bg-red-100 text-red-700 border border-red-200';
  if (severity === 'Warning') return 'bg-amber-100 text-amber-700 border border-amber-200';
  return 'bg-blue-100 text-blue-700 border border-blue-200';
};

const getCategoryBadgeClass = (category: string) => {
  if (category === 'Out of Stock') return 'bg-red-50 text-red-700 border border-red-100';
  if (category === 'Low Stock') return 'bg-amber-50 text-amber-700 border border-amber-100';
  if (category === 'Expiring Soon') return 'bg-orange-50 text-orange-700 border border-orange-100';
  if (category === 'Dead Stock') return 'bg-purple-50 text-purple-700 border border-purple-100';
  if (category === 'Overstock') return 'bg-blue-50 text-blue-700 border border-blue-100';
  if (category === 'Discount') return 'bg-teal-50 text-teal-700 border border-teal-100';
  return 'bg-slate-100 text-slate-600';
};

const getStockBarColor = (pct: number) => {
  if (pct === 0) return 'bg-red-500';
  if (pct <= 15) return 'bg-red-500';
  if (pct <= 30) return 'bg-amber-500';
  if (pct >= 80) return 'bg-purple-500';
  return 'bg-[#0b8252]';
};

const getExpiryBadge = (days: number | undefined) => {
  if (days === undefined) return null;
  if (days < 0) return { label: 'EXPIRED', cls: 'bg-red-100 text-red-700 border-red-200 animate-pulse' };
  if (days === 0) return { label: 'EXPIRES TODAY', cls: 'bg-red-100 text-red-700 border-red-200 animate-pulse' };
  if (days <= 3) return { label: `${days}d LEFT`, cls: 'bg-red-100 text-red-700 border-red-200' };
  if (days <= 7) return { label: `${days} DAYS LEFT`, cls: 'bg-orange-100 text-orange-700 border-orange-200' };
  if (days <= 30) return { label: `${days} DAYS`, cls: 'bg-amber-100 text-amber-700 border-amber-200' };
  return { label: `${Math.ceil(days / 7)} WEEKS`, cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
};

// Primary action is hidden for Low Stock, Out of Stock, and Overstock
const showPrimaryAction = (category: string): boolean => {
  return category !== 'Low Stock' && category !== 'Out of Stock' && category !== 'Overstock';
};

export default function AlertCard({ alert, handlePrimary, dismiss, markRead, onViewProduct }: AlertCardProps) {
  const expiryBadge = getExpiryBadge(alert.daysUntilExpiry);
  const stockPct = alert.stockPercentage ?? null;
  const sku = alert.sku || extractSku(alert.id);

  // All product-related alerts (including Overstock) open the spec modal.
  // Only Discount links away to the discounts tab.
  const isProductAlert = alert.category !== 'Discount';

  const viewLabel = alert.category === 'Discount'
    ? 'View Discounts'
    : 'View Product';

  const hasPrimary = showPrimaryAction(alert.category);

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm flex overflow-hidden transition-all hover:shadow-md ${
        alert.read ? 'opacity-80 border-emerald-200 bg-emerald-50/30' : 'border-slate-200'
      }`}
    >
      {/* Left accent bar */}
      <div className={`w-1.5 flex-shrink-0 ${alert.read ? 'bg-emerald-400' : alert.accentColor}`} />

      <div className="p-5 flex flex-col sm:flex-row gap-5 flex-1">

        {/* Icon */}
        <div className={`w-14 h-14 rounded-xl ${alert.iconBg} flex items-center justify-center flex-shrink-0 border border-slate-100`}>
          <span className={`material-symbols-outlined ${alert.iconColor} text-[28px]`}>{alert.icon}</span>
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase tracking-wider ${getSeverityBadgeClass(alert.severity)}`}>
              {alert.severity}
            </span>
            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase tracking-wider ${getCategoryBadgeClass(alert.category)}`}>
              {alert.issueType}
            </span>
            {expiryBadge && (
              <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase tracking-wider border ${expiryBadge.cls}`}>
                ⏰ {expiryBadge.label}
              </span>
            )}
            {alert.read && (
              <span className="px-2 py-0.5 text-[9px] font-bold rounded-full uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <span className="material-symbols-outlined text-[10px]">check_circle</span>
                Read
              </span>
            )}
            <span className="text-[10px] text-slate-400 font-medium ml-auto">{alert.time}</span>
            {!alert.read && (
              <span className="w-2 h-2 bg-[#0b8252] rounded-full" title="Unread" />
            )}
          </div>

          <h3 className="text-sm font-bold text-slate-800 mb-1 leading-snug">{alert.title}</h3>
          <p className="text-xs text-slate-600 leading-relaxed">{alert.description}</p>

          {/* Metrics row */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <span className="block text-[9px] font-bold uppercase text-slate-400 mb-1 tracking-wider">Current Stock</span>
              <span className="font-extrabold text-slate-800 text-sm">{alert.currentStock} units</span>
              {stockPct !== null && (
                <div className="mt-2">
                  <div className="flex justify-between mb-1">
                    <span className="text-[8px] text-slate-400 font-bold">Stock Level</span>
                    <span className="text-[8px] font-bold text-slate-600">{stockPct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getStockBarColor(stockPct)}`}
                      style={{ width: `${Math.min(100, stockPct)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <span className="block text-[9px] font-bold uppercase text-slate-400 mb-1 tracking-wider">Suggested Action</span>
              <span className="font-extrabold text-slate-800 text-sm">{alert.suggestedAction}</span>
              {alert.expiryDate && (
                <span className="block text-[9px] text-slate-400 mt-1.5 font-medium">Expiry: {alert.expiryDate}</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 mt-4 sm:mt-0 min-w-[180px] self-start sm:self-center">

          {/* Primary action — hidden for Low Stock and Out of Stock */}
          {hasPrimary && (
            <button
              onClick={() => handlePrimary(alert)}
              className={`w-full px-3 py-2 rounded-lg text-xs font-bold border transition-colors text-white ${alert.primaryBtnClass}`}
            >
              {alert.primaryAction}
            </button>
          )}

          {/* View Product — opens Product Specification Details modal inline */}
          {isProductAlert && sku ? (
            <button
              onClick={() => onViewProduct(alert)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">inventory</span>
              {viewLabel}
            </button>
          ) : (
            <Link
              to={alert.category === 'Discount' ? '/manage-products?tab=discounts' : '/procurement'}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              {viewLabel}
            </Link>
          )}

          {/* Mark Read — hidden for Overstock alerts */}
          {alert.category !== 'Overstock' && (
            <button
              onClick={() => markRead(alert.id)}
              className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                alert.read
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">
                {alert.read ? 'check_circle' : 'radio_button_unchecked'}
              </span>
              {alert.read ? 'Marked Read' : 'Mark Read'}
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
