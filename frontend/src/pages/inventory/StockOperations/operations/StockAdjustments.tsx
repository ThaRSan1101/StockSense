import { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { inventoryOperationsService, ProductItem, AdjustmentRecord } from './inventoryOperationsService';
import { api } from '../../../../services/axiosInstance';

const SearchableProductSelect = ({ products, value, onChange }: { products: ProductItem[], value: string, onChange: (val: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current && !wrapperRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const updatePosition = () => {
      if (isOpen && wrapperRef.current) {
        setRect(wrapperRef.current.getBoundingClientRect());
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  const handleOpenToggle = () => {
    if (!isOpen && wrapperRef.current) {
      setRect(wrapperRef.current.getBoundingClientRect());
    }
    setIsOpen(!isOpen);
  };

  const selectedProduct = products.find(p => p.name === value);
  const displayValue = selectedProduct ? `${selectedProduct.name} - ${selectedProduct.barcode || selectedProduct.sku}` : 'Select Product...';

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.barcode && p.barcode.includes(search)) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 cursor-pointer flex justify-between items-center hover:bg-slate-100 transition-colors"
        onClick={handleOpenToggle}
      >
        <span className="truncate pr-2">{displayValue}</span>
        <span className="material-symbols-outlined text-[14px] text-slate-500 shrink-0">expand_more</span>
      </div>
      {isOpen && rect && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed z-[9999] mt-1 bg-white border border-slate-200 rounded-lg shadow-2xl flex flex-col overflow-hidden"
          style={{
            top: rect.bottom,
            left: rect.left,
            width: Math.max(rect.width, 280),
            maxHeight: '250px'
          }}
        >
          <div className="p-2 border-b border-slate-100 bg-slate-50">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2 top-1.5 text-[16px] text-slate-400">search</span>
              <input 
                type="text" 
                autoFocus
                placeholder="Search by name, barcode or SKU..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium focus:outline-none focus:border-[#0b8252] focus:ring-1 focus:ring-[#0b8252] transition-all"
              />
            </div>
          </div>
          <div className="overflow-y-auto p-1 flex-1">
            {filtered.length === 0 ? (
              <div className="p-3 text-xs text-slate-400 text-center font-medium">No products found</div>
            ) : (
              filtered.map(p => (
                <div 
                  key={p.id}
                  className="px-3 py-2 hover:bg-emerald-50 cursor-pointer rounded-md text-xs border-b border-slate-50 last:border-0 transition-colors"
                  onClick={() => {
                    onChange(p.name);
                    setIsOpen(false);
                    setSearch('');
                  }}
                >
                  <div className="font-bold text-slate-800">{p.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">{p.barcode || p.sku}</div>
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default function StockAdjustments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Operators (admins + managers) for the Authorized Operator dropdown
  const [operators, setOperators] = useState<{ id: string; name: string; role: string }[]>([]);

  // Form state
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);
  const [qtyDelta, setQtyDelta] = useState<number>(-5);
  const [selectedReason, setSelectedReason] = useState<'Damaged' | 'Lost' | 'Expired' | 'Returned' | 'Counting error' | 'System correction'>('Damaged');
  const [adjustedBy, setAdjustedBy] = useState('');

  // Selected adjustment for detail timeline modal
  const [viewingAdjustment, setViewingAdjustment] = useState<AdjustmentRecord | null>(null);

  useEffect(() => {
    loadAdjustmentData();
    loadOperators();
  }, []);

  const loadOperators = async () => {
    try {
      const res = await api.get('/auth/operators');
      if (res.data?.success && res.data.data?.length > 0) {
        setOperators(res.data.data);
        setAdjustedBy(res.data.data[0].name);
      }
    } catch (err) {
      console.error('Failed to load operators:', err);
    }
  };

  const loadAdjustmentData = async () => {
    const prods = await inventoryOperationsService.getProducts();
    setProducts(prods);
    const adjs = await inventoryOperationsService.getAdjustments();
    setAdjustments(adjs);
  };

  // Handle URL SKU, Reason, and Qty trigger
  useEffect(() => {
    const sku = searchParams.get('sku');
    const reason = searchParams.get('reason');
    const qtyParam = searchParams.get('qty');
    if (sku && products.length > 0) {
      const idx = products.findIndex(
        p => p.sku.toLowerCase() === sku.toLowerCase() || (p.barcode && p.barcode.toLowerCase() === sku.toLowerCase())
      );
      if (idx !== -1) {
        setSelectedProductIndex(idx);
        // Pre-fill qty: use URL qty param, otherwise default to negative of product's current stock
        if (qtyParam !== null) {
          const parsedQty = parseInt(qtyParam, 10);
          setQtyDelta(isNaN(parsedQty) ? -products[idx].stock : parsedQty);
        } else {
          setQtyDelta(-Math.abs(products[idx].stock));
        }
      }

      // Clear query parameters so it does not loop
      setSearchParams(prev => {
        prev.delete('sku');
        prev.delete('reason');
        prev.delete('qty');
        return prev;
      }, { replace: true });
    }

    if (reason) {
      const matchedReason = ['Damaged', 'Lost', 'Expired', 'Returned', 'Counting error', 'System correction'].find(
        r => r.toLowerCase() === reason.toLowerCase()
      );
      if (matchedReason) {
        setSelectedReason(matchedReason as any);
      }
    }
  }, [searchParams, products, setSearchParams]);

  const triggerToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // 1. ACTIVE SELECTION DETAILS
  const activeProduct = useMemo(() => {
    if (products.length === 0) return null;
    return products[selectedProductIndex] || null;
  }, [products, selectedProductIndex]);

  // 2. LIVE HIGH DISCREPANCY WARNING DETECTOR
  const liveWarning = useMemo(() => {
    if (!activeProduct) return null;
    const value = Math.abs(qtyDelta * activeProduct.sellingPrice);
    const count = Math.abs(qtyDelta);
    
    if (count >= 50 || value >= 5000) {
      return {
        value,
        count,
        msg: `⚠️ RESTRICTED TRANSACTION VALUE WARNING: This adjustment exceeds standard operation bounds (volume ${count} items, value Rs. ${value.toLocaleString()}). This correction will be logged under "Needs Review" status and locked pending Secondary Auditor authentication.`
      };
    }
    return null;
  }, [activeProduct, qtyDelta]);

  // 3. ADJUSTMENT ANALYTICS SUMMARY
  const analyticsSummary = useMemo(() => {
    let totalValue = 0;
    let totalItemsCount = 0;
    let approvedCount = 0;
    let reviewCount = 0;

    adjustments.forEach(a => {
      totalValue += a.totalValue;
      totalItemsCount += Math.abs(a.qtyChanged);
      if (a.status === 'Approved') approvedCount++;
      if (a.status === 'Needs Review') reviewCount++;
    });

    const averageVal = adjustments.length > 0 ? Math.round(totalValue / adjustments.length) : 0;

    return {
      totalValue,
      totalItemsCount,
      approvedCount,
      reviewCount,
      averageVal,
      totalCount: adjustments.length
    };
  }, [adjustments]);

  // 4. SUBMIT ADJUSTMENT FLOW
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct) return;
    if (qtyDelta === 0) {
      triggerToast('Stock change quantity delta cannot be zero.');
      return;
    }

    try {
      const newAdj = await inventoryOperationsService.createAdjustment({
        productName: activeProduct.name,
        sku: activeProduct.sku,
        qtyChanged: qtyDelta,
        reason: selectedReason,
        adjustedBy,
        date: new Date().toISOString().split('T')[0]
      });

      // Reload
      const adjs = await inventoryOperationsService.getAdjustments();
      setAdjustments(adjs);
      
    // Reset qty delta to negative of new product stock
      setQtyDelta(-Math.abs(products[selectedProductIndex] ? products[selectedProductIndex].stock : 5));
      
      triggerToast(`Stock adjustment record ${newAdj.adjustmentNumber} synchronized successfully!`);
    } catch (err: any) {
      triggerToast(err.message || 'Error occurred while saving stock adjustment.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast alert */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-4 duration-200">
          <span className="material-symbols-outlined text-emerald-400">check_circle</span>
          <span className="text-xs font-extrabold text-white">{toast}</span>
        </div>
      )}

      {/* DOCK ADJUSTMENTS ANALYTICS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest block">Total Adjusted Value</span>
          <span className="text-2xl font-black text-slate-800">Rs. {analyticsSummary.totalValue.toLocaleString()}</span>
          <span className="text-[10px] text-slate-400 font-extrabold block">Absolute monetary correction value</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest block">Total Adjusted Stock</span>
          <span className="text-2xl font-black text-slate-800">{analyticsSummary.totalItemsCount} units</span>
          <span className="text-[10px] text-slate-400 font-extrabold block">Sum volume of corrected stock lines</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest block">Review Lock Ratio</span>
          <span className="text-2xl font-black text-amber-600">{analyticsSummary.reviewCount} locked</span>
          <span className="text-[10px] text-slate-400 font-extrabold block">Awaiting manager authentication checks</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest block">Average Discrepancy Size</span>
          <span className="text-2xl font-black text-slate-800">Rs. {analyticsSummary.averageVal.toLocaleString()}</span>
          <span className="text-[10px] text-slate-400 font-extrabold block">Average value corrected per audit item</span>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* INTERACTIVE FORM CONTAINER */}
        <div className="w-full">
          <form onSubmit={handleSaveAdjustment} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Log Stock Discrepancy</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Select Product */}
              <div className="lg:col-span-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Select Product Node</label>
                {products.length > 0 && activeProduct && (
                  <SearchableProductSelect
                    products={products}
                    value={activeProduct.name}
                    onChange={(val) => {
                      const idx = products.findIndex(p => p.name === val);
                      if (idx !== -1) setSelectedProductIndex(idx);
                    }}
                  />
                )}
              </div>

              {/* Qty delta changes */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Quantity Change (+/-)</label>
                <input
                  type="number"
                  value={qtyDelta}
                  onChange={(e) => setQtyDelta(parseInt(e.target.value) || 0)}
                  placeholder="-5 for damages, +5 for found stock"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0b8252]"
                />
              </div>

              {/* Adjustment Reason */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Discrepancy Category</label>
                <select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0b8252]"
                >
                  <option value="Damaged">Damaged Goods</option>
                  <option value="Lost">Lost / Stolen Items</option>
                  <option value="Expired">Expired Batches</option>
                  <option value="Returned">Customer Returns</option>
                  <option value="Counting error">Counting Inventory Error</option>
                  <option value="System correction">System Database Correction</option>
                </select>
              </div>

              {/* Operator — dropdown of all admins + managers */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Authorized Operator</label>
                <select
                  value={adjustedBy}
                  onChange={(e) => setAdjustedBy(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0b8252]"
                >
                  {operators.length === 0 ? (
                    <option value="">Loading operators...</option>
                  ) : (
                    operators.map(op => (
                      <option key={op.id} value={op.name}>
                        {op.name} ({op.role === 'ADMIN' ? 'Admin' : 'Manager'})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 items-center">
              {/* Current Product Stats Panel */}
              <div className="md:col-span-3">
                {activeProduct ? (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="col-span-2">
                      <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">SKU ID</span>
                      <span className="font-mono font-bold text-slate-700">{activeProduct.sku}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">Stock Transition Preview</span>
                      <span className="font-mono font-bold text-slate-500">
                        {activeProduct.stock} <span className="text-slate-300 mx-1">→</span> <span className="text-slate-800 font-black">{Math.max(0, activeProduct.stock + qtyDelta)}</span>
                      </span>
                    </div>
                  </div>
                ) : <div />}
              </div>

              <div className="md:col-span-1">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-[#0b8252] text-white rounded-lg text-xs font-black hover:bg-[#096a43] transition-colors shadow-sm text-center h-full"
                >
                  Commit Stock Correction
                </button>
              </div>
            </div>

            {/* REAL-TIME WARNING BANNER */}
            {liveWarning && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 animate-pulse">
                <p className="text-[10px] text-amber-800 font-black leading-relaxed">
                  {liveWarning.msg}
                </p>
              </div>
            )}
          </form>
        </div>

        {/* ADJUSTMENT HISTORY TABLE */}
        <div className="w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Adjustment Audit Log</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-100 max-h-[480px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] border-b border-slate-100">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Product Profile</th>
                  <th className="px-4 py-3">SKU ID</th>
                  <th className="px-4 py-3 text-center">Movement Type</th>
                  <th className="px-4 py-3 text-center">Qty Delta</th>
                  <th className="px-4 py-3 text-center">Stock Transitions</th>
                  <th className="px-4 py-3">Description Reason</th>
                  <th className="px-4 py-3">Authorized By</th>
                  <th className="px-4 py-3 text-center">Audit Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {adjustments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400 font-bold">
                      No adjustments logged yet.
                    </td>
                  </tr>
                ) : (
                  adjustments.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/50 select-none transition-colors">
                      <td className="px-4 py-3 text-slate-500 font-mono font-bold">
                        {new Date(a.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-black text-slate-800 text-xs">{a.productName}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 font-bold">{a.sku}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block px-2.5 py-0.5 font-extrabold text-[10px] rounded-full border bg-amber-50 text-amber-700 border-amber-100">
                          Adjustment
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-center font-black ${a.qtyChanged > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {a.qtyChanged > 0 ? `+${a.qtyChanged}` : a.qtyChanged}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 font-mono font-bold">
                        {a.beforeStock} <span className="text-slate-300 mx-1">→</span> <span className="text-slate-800 font-black">{a.afterStock}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-medium truncate max-w-xs">
                        Manual Correction: {a.reason} ({a.adjustmentNumber})
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-bold">{a.adjustedBy}</td>
                      <td className="px-4 py-3 text-center">
                        {a.status === 'Approved' ? (
                          <span className="material-symbols-outlined text-emerald-500 text-[18px]">check_circle</span>
                        ) : a.status === 'Needs Review' ? (
                          <span className="material-symbols-outlined text-amber-500 text-[18px]">warning</span>
                        ) : (
                          <span className="material-symbols-outlined text-rose-500 text-[18px]">cancel</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* APPROVAL WORKFLOW DETAIL TIMELINE MODAL */}
      {viewingAdjustment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Correction verification</span>
                <h3 className="text-sm font-black text-slate-800">Approval Workflow Timeline</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingAdjustment(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined text-md">close</span>
              </button>
            </div>

            {/* Product description card */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-xs space-y-1.5">
              <div className="flex justify-between font-black text-slate-800">
                <span>{viewingAdjustment.productName}</span>
                <span className="font-mono text-[#0b8252]">{viewingAdjustment.adjustmentNumber}</span>
              </div>
              <div className="flex justify-between text-slate-500 font-bold">
                <span>Quantity Change:</span>
                <span className={viewingAdjustment.qtyChanged > 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                  {viewingAdjustment.qtyChanged} units
                </span>
              </div>
              <div className="flex justify-between text-slate-500 font-bold">
                <span>Corrective Value:</span>
                <span className="font-black text-slate-700">Rs. {viewingAdjustment.totalValue.toLocaleString()}</span>
              </div>
            </div>

            {/* DYNAMIC TIMELINE WORKFLOW FLOW */}
            <div className="space-y-4 pt-2">
              <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Verification Steps</span>
              
              <div className="relative border-l-2 border-slate-100 pl-6 ml-3 space-y-6 text-xs">
                {/* Step 1: Logged */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-0.5 bg-emerald-500 text-white rounded-full w-4 h-4 flex items-center justify-center border border-white">
                    <span className="material-symbols-outlined text-[10px] font-black">check</span>
                  </div>
                  <h4 className="font-black text-slate-800">Step 1: Correction Logged</h4>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Logged by Operator {viewingAdjustment.adjustedBy} for reason "{viewingAdjustment.reason}"</p>
                </div>

                {/* Step 2: Verification */}
                <div className="relative">
                  {viewingAdjustment.status === 'Approved' ? (
                    <>
                      <div className="absolute -left-[31px] top-0.5 bg-emerald-500 text-white rounded-full w-4 h-4 flex items-center justify-center border border-white">
                        <span className="material-symbols-outlined text-[10px] font-black">check</span>
                      </div>
                      <h4 className="font-black text-slate-800">Step 2: Auditor Verification Passed</h4>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">Transaction verified automatically under operational value safety bounds.</p>
                    </>
                  ) : (
                    <>
                      <div className="absolute -left-[31px] top-0.5 bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center border border-white animate-pulse">
                        <span className="material-symbols-outlined text-[10px] font-black">lock</span>
                      </div>
                      <h4 className="font-black text-amber-800">Step 2: Awaiting Manager Verification</h4>
                      <p className="text-[10px] text-amber-600/80 font-medium mt-0.5">Adjustment requires secondary double-signature review due to threshold limits.</p>
                    </>
                  )}
                </div>

                {/* Step 3: Ledger Synced */}
                <div className="relative">
                  {viewingAdjustment.status === 'Approved' ? (
                    <>
                      <div className="absolute -left-[31px] top-0.5 bg-emerald-500 text-white rounded-full w-4 h-4 flex items-center justify-center border border-white">
                        <span className="material-symbols-outlined text-[10px] font-black">check</span>
                      </div>
                      <h4 className="font-black text-slate-800">Step 3: Unified Ledger Synchronized</h4>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">Stock quantities decremented/incremented successfully and audits closed.</p>
                    </>
                  ) : (
                    <>
                      <div className="absolute -left-[31px] top-0.5 bg-slate-200 text-slate-400 rounded-full w-4 h-4 flex items-center justify-center border border-white">
                        <span className="material-symbols-outlined text-[10px] font-black">hourglass_empty</span>
                      </div>
                      <h4 className="font-bold text-slate-400">Step 3: Ledger Synchronized Pending</h4>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">Transaction waiting for Step 2 completion before finalized write operations.</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Controls */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewingAdjustment(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-black rounded-lg text-xs hover:bg-slate-200 transition-colors shadow-sm w-full text-center"
              >
                Close Timeline Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
