import React from 'react';

export type ProductSpecItem = {
  id?: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  subcategory?: string;
  supplier?: string;
  brand?: string;
  unitType: string;
  stock: number;
  reorderLevel: number;
  targetCapacity?: number;
  costPrice: number;
  sellingPrice: number;
  status: string;
  imageUrl?: string | null;
  description?: string;
  mfgDate?: string;
  expiryDate?: string;
  batchNumber?: string;
};

interface ProductSpecModalProps {
  product: ProductSpecItem;
  onClose: () => void;
}

export default function ProductSpecModal({ product, onClose }: ProductSpecModalProps) {
  const targetCapacity = product.targetCapacity || 100;
  const reorderLimit = product.reorderLevel;
  const stockPct = Math.round((product.stock / targetCapacity) * 100);

  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= reorderLimit;

  const profitMargin = product.sellingPrice - product.costPrice;
  const markupPct = product.costPrice > 0
    ? ((profitMargin / product.costPrice) * 100).toFixed(1)
    : '0.0';
  const marginPct = product.sellingPrice > 0
    ? ((profitMargin / product.sellingPrice) * 100).toFixed(1)
    : '0.0';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#0b8252]">inventory</span>
            <h3 className="text-sm font-bold text-slate-800">Product Specification Details</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">

          {/* Product Header Card */}
          <div className="flex items-start gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0 bg-white"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl flex items-center justify-center bg-[#0b8252] text-white font-black text-2xl uppercase shrink-0 shadow-sm">
                {product.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <span className="inline-block bg-[#0b8252]/10 text-[#0b8252] px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider mb-1">
                {product.status}
              </span>
              <h4 className="text-base font-extrabold text-slate-800 leading-snug line-clamp-2">{product.name}</h4>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                {product.brand ? `${product.brand} • ` : ''}{product.subcategory || 'General'}
              </p>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="space-y-1.5">
              <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Description</span>
              <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 border border-slate-200 rounded-lg">
                {product.description}
              </p>
            </div>
          )}

          {/* Key Specs Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3 border border-slate-200 rounded-lg">
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">SKU ID</span>
              <span className="block text-xs font-bold text-slate-800 mt-0.5">{product.sku}</span>
            </div>
            <div className="bg-slate-50 p-3 border border-slate-200 rounded-lg">
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Barcode / EAN</span>
              <span className="block text-xs font-bold text-slate-800 mt-0.5">{product.barcode}</span>
            </div>
            <div className="bg-slate-50 p-3 border border-slate-200 rounded-lg">
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Category</span>
              <span className="block text-xs font-bold text-slate-800 mt-0.5">{product.category}</span>
            </div>
            <div className="bg-slate-50 p-3 border border-slate-200 rounded-lg">
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Supplier</span>
              <span className="block text-xs font-bold text-slate-800 mt-0.5">{product.supplier || '—'}</span>
            </div>
          </div>

          {/* Stock Levels & Capacity */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Stock Levels & Capacity</h5>
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-500 font-semibold">Current Stock / Target Capacity</span>
                <span className="text-sm font-extrabold text-slate-800 mt-0.5">
                  {product.stock} / {targetCapacity} {product.unitType}(s)
                </span>
              </div>
              <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md ${
                isOutOfStock ? 'bg-red-50 text-red-600' :
                isLowStock   ? 'bg-amber-50 text-amber-600' :
                               'bg-emerald-50 text-emerald-600'
              }`}>
                {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
              </span>
            </div>

            {/* Stock progress bar */}
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div
                style={{ width: `${Math.min(100, stockPct)}%` }}
                className={`h-full rounded-full transition-all duration-500 ${
                  isOutOfStock ? 'bg-red-500' : isLowStock ? 'bg-amber-500' : 'bg-[#0b8252]'
                }`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
              <span>Reorder Point: {reorderLimit} units</span>
              <span>{stockPct}% Filled</span>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-emerald-50/20">
            <h5 className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Financial Breakdown</h5>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-semibold">Cost Price</span>
                <span className="text-xs font-extrabold text-slate-800">Rs. {product.costPrice.toFixed(2)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-semibold">Selling Price</span>
                <span className="text-xs font-extrabold text-slate-800">Rs. {product.sellingPrice.toFixed(2)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-semibold">Profit Margin</span>
                <span className="text-xs font-extrabold text-emerald-600">
                  Rs. {profitMargin.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-[10px] font-bold text-slate-400">
              <span>Markup: {markupPct}%</span>
              <span>Profit Margin %: {marginPct}%</span>
            </div>
          </div>

          {/* Expiry & Batch Details */}
          {(product.mfgDate || product.expiryDate || product.batchNumber) && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <h5 className="text-[10px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#0b8252]">event_note</span>
                Expiry & Batch Details
              </h5>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <span className="block text-[9px] text-slate-400 font-semibold">Mfg Date</span>
                  <span className="font-bold text-slate-800">{product.mfgDate || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-[9px] text-slate-400 font-semibold">Expiry Date</span>
                  <span className="font-bold text-slate-800">{product.expiryDate || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-[9px] text-slate-400 font-semibold">Batch Number</span>
                  <span className="font-bold text-slate-800">{product.batchNumber || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-4 bg-slate-50 border-t flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#0b8252] text-white rounded-lg text-xs font-bold hover:bg-[#096b43] transition-all shadow-sm"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
