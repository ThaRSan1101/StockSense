import React from 'react';
import { Search, ScanLine, ShoppingCart, Trash2, FileText, Minus, Plus, ChevronRight, Tag } from 'lucide-react';

interface BillTabProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchMatches: any[];
  setSearchMatches: React.Dispatch<React.SetStateAction<any[]>>;
  searchMatchQuantities: Record<string, number>;
  setSearchMatchQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  products: any[];
  addToCart: (product: any, qty?: number) => void;
  setShowBarcodeModal: (show: boolean) => void;
  scannedProduct: any | null;
  setScannedProduct: (prod: any | null) => void;
  scannedProductQty: number;
  setScannedProductQty: (qty: number) => void;
  cart: any[];
  setCart: React.Dispatch<React.SetStateAction<any[]>>;
  cartWithDiscounts: any[];
  passBillToDraft: () => void;
  discountType: 'item' | 'bill' | 'both';
  setDiscountType: (type: 'item' | 'bill' | 'both') => void;
  setManualDiscount: (val: number) => void;
  setDiscountInput: (val: string) => void;
  isOverallDiscountActive: boolean;
  autoBillDiscount: { percentage: number; name: string };
  manualDiscount: number;
  customerPaidInput: string;
  setCustomerPaidInput: (val: string) => void;
  grossTotal: number;
  totalSavedAmount: number;
  total: number;
  handleCompleteTransaction: () => void;
  updateQuantity: (id: number | string, delta: number) => void;
  ungroupCombo: (id: string) => void;
}

export const BillTab: React.FC<BillTabProps> = ({
  searchQuery, setSearchQuery,
  searchMatches, setSearchMatches,
  searchMatchQuantities, setSearchMatchQuantities,
  products, addToCart, setShowBarcodeModal,
  scannedProduct, setScannedProduct,
  scannedProductQty, setScannedProductQty,
  cart, setCart, cartWithDiscounts, passBillToDraft,
  discountType, setDiscountType, setManualDiscount, setDiscountInput,
  isOverallDiscountActive, autoBillDiscount, manualDiscount,
  customerPaidInput, setCustomerPaidInput,
  grossTotal, totalSavedAmount, total, handleCompleteTransaction,
  updateQuantity, ungroupCombo
}) => {
  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#f8f9fc] relative z-0">
      {/* Top Header */}
      <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white shrink-0">
        <div className="relative flex-1 mr-6">
          <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search product by name or SKU..."
            className="w-full bg-[#f3f4f6] text-gray-800 rounded-lg pl-12 pr-4 py-3 focus:outline-none transition-all font-medium border border-transparent focus:border-gray-300"
            value={searchQuery}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchMatches.length > 0) {
                const firstMatch = searchMatches[0];
                const qty = searchMatchQuantities[firstMatch.id] || 1;
                addToCart(firstMatch, qty);
                setSearchMatches([]);
                setSearchQuery('');
              }
            }}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              if (val.length > 1) {
                const matches = products.filter(p =>
                  p.name.toLowerCase().includes(val.toLowerCase()) ||
                  (p.barcode && p.barcode.includes(val))
                ).slice(0, 5);
                setSearchMatches(matches);
              } else {
                setSearchMatches([]);
              }
            }}
          />
        </div>
        <div className="flex items-center shrink-0">
          <button
            onClick={() => setShowBarcodeModal(true)}
            className="flex items-center px-6 py-3 bg-[#e0e7ff] text-[#1e3a8a] rounded-lg font-bold hover:bg-[#c7d2fe] transition-colors text-sm"
          >
            <ScanLine className="w-4 h-4 mr-2" /> Scan Barcode
          </button>
        </div>
      </div>

      {/* Search Matches & Scanned Product Banner Area */}
      {(scannedProduct || searchMatches.length > 0) && (
        <div className="border-b border-gray-200 bg-white shrink-0 divide-y divide-gray-100 animate-in fade-in slide-in-from-top-2 duration-200">
          {scannedProduct && (
            <div className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-12 bg-[#22c55e] rounded-full shrink-0"></div>
                <img src={scannedProduct.image} alt={scannedProduct.name} className="w-16 h-16 rounded-lg object-cover bg-gray-50 border border-gray-200 shrink-0" />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-[#dcfce7] text-[#166534] text-[10px] font-bold rounded uppercase tracking-wide">IN STOCK</span>
                    <span className="text-xs text-gray-500 font-bold tracking-wide">Barcode: {scannedProduct.barcode}</span>
                  </div>
                  <h3 className="text-base font-extrabold text-gray-900 leading-tight">{scannedProduct.name}</h3>
                  <div className="text-[#047857] font-extrabold text-sm mt-0.5">Rs. {scannedProduct.price.toFixed(2)}</div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                  <button onClick={() => setScannedProductQty(Math.max(1, scannedProductQty - 1))} className="w-8 h-8 flex items-center justify-center rounded text-gray-600 hover:bg-gray-100 transition-colors">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-10 text-center text-sm font-bold text-gray-900">{scannedProductQty}</span>
                  <button onClick={() => setScannedProductQty(scannedProductQty + 1)} className="w-8 h-8 flex items-center justify-center rounded text-gray-600 hover:bg-gray-100 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => {
                    addToCart(scannedProduct, scannedProductQty);
                    setScannedProduct(null);
                    setScannedProductQty(1);
                  }}
                  className="bg-[#047857] hover:bg-[#065f46] text-white px-5 py-2.5 rounded-lg font-bold text-sm flex items-center transition-colors shadow-sm"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
                </button>
                <button onClick={() => setScannedProduct(null)} className="text-gray-400 hover:text-gray-600 transition-colors p-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            </div>
          )}

          {searchMatches.map((match) => {
            const qty = searchMatchQuantities[match.id] || 1;
            return (
              <div key={match.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-12 bg-[#22c55e] rounded-full shrink-0"></div>
                  <img src={match.image} alt={match.name} className="w-16 h-16 rounded-lg object-cover bg-gray-50 border border-gray-200 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-[#dcfce7] text-[#166534] text-[10px] font-bold rounded uppercase tracking-wide">IN STOCK</span>
                      <span className="text-xs text-gray-500 font-bold tracking-wide">Barcode: {match.barcode}</span>
                    </div>
                    <h3 className="text-base font-extrabold text-gray-900 leading-tight">{match.name}</h3>
                    <div className="text-[#047857] font-extrabold text-sm mt-0.5">Rs. {match.price.toFixed(2)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                    <button
                      onClick={() => setSearchMatchQuantities(prev => ({ ...prev, [match.id]: Math.max(1, qty - 1) }))}
                      className="w-8 h-8 flex items-center justify-center rounded text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-10 text-center text-sm font-bold text-gray-900">{qty}</span>
                    <button
                      onClick={() => setSearchMatchQuantities(prev => ({ ...prev, [match.id]: qty + 1 }))}
                      className="w-8 h-8 flex items-center justify-center rounded text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      addToCart(match, qty);
                      setSearchMatches([]);
                      setSearchQuery('');
                    }}
                    className="bg-[#047857] hover:bg-[#065f46] text-white px-5 py-2.5 rounded-lg font-bold text-sm flex items-center transition-colors shadow-sm"
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
                  </button>
                  <button
                    onClick={() => {
                      setSearchMatches(prev => prev.filter(p => p.id !== match.id));
                      if (searchMatches.length <= 1) {
                        setSearchQuery('');
                      }
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 p-8 flex flex-col overflow-hidden bg-[#f8f9fc] w-full max-w-full">
        <div className="shrink-0 mb-8 flex items-start justify-between">
          <div>
            <h2 className="text-[24px] font-bold text-gray-900 mb-1 tracking-tight">Cart Summary</h2>
            <p className="text-sm text-gray-500 font-medium">Review items before finalizing transaction</p>
          </div>
          {cart.length > 0 && (
            <div className="flex items-center gap-3">
              <button onClick={passBillToDraft} className="text-[#d97706] bg-orange-50 hover:bg-orange-100 transition-colors text-sm font-bold flex items-center px-4 py-2.5 rounded-lg shadow-sm border border-orange-100">
                <FileText className="w-4 h-4 mr-2" /> Pass Bill
              </button>
              <button onClick={() => setCart([])} className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-bold flex items-center px-4 py-2.5 bg-white hover:bg-gray-50 rounded-lg shadow-sm border border-gray-200">
                <Trash2 className="w-4 h-4 mr-2" /> Clear All
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Cart Table Header */}
          <div className="grid grid-cols-12 gap-4 text-[11px] font-bold text-gray-500 tracking-wider pb-3 uppercase border-b border-gray-200 shrink-0">
            <div className="col-span-3">ITEM DETAILS</div>
            <div className="col-span-2 text-center">UNIT PRICE</div>
            <div className="col-span-2 text-center">QTY</div>
            <div className="col-span-2 text-center">DISCOUNT (%)</div>
            <div className="col-span-1 text-center">BIN</div>
            <div className="col-span-2 text-right">TOTAL</div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto py-2">
            {cartWithDiscounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <ShoppingCart className="w-12 h-12 opacity-20 mb-3" />
                <p className="font-medium">Cart is empty</p>
              </div>
            ) : (
              <div className="space-y-6 pt-4">
                {cartWithDiscounts.map(item => {
                  const itemDisc = discountType === 'bill' ? 0 : (item.discount || 0);
                  const itemTotal = (item.price * item.quantity) * (1 - itemDisc / 100);
                  return (
                    <div key={item.id} className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-3 flex items-center gap-3">
                        <img src={item.image} alt={item.name} className="w-10 h-10 rounded bg-white object-cover border border-gray-100 shrink-0" />
                        <div className="overflow-hidden w-full">
                          <h4 className="text-[13px] font-bold text-gray-900 truncate flex items-center gap-1.5">
                            {item.isCombo && <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded shrink-0">COMBO</span>}
                            <span className="truncate">{item.name}</span>
                          </h4>
                          {item.isCombo ? (
                            <div className="text-[10px] text-gray-500 font-semibold mt-1 space-y-0.5 max-w-full">
                              {item.comboItems?.map((ci: any, idx: number) => {
                                const prod = products.find(p => p.sku === ci.sku || p.id === ci.sku);
                                return (
                                  <div key={idx} className="truncate">
                                    • {prod ? prod.name : ci.sku} (x{ci.qty})
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div>
                              <p className="text-[11px] text-gray-500 font-medium mt-0.5 truncate">SKU: {item.barcode || `PRD-${item.id}`}</p>
                              {itemDisc > 0 && (
                                <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                  <Tag className="w-3 h-3 shrink-0" />
                                  {itemDisc}% OFF
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="col-span-2 text-center font-semibold text-[14px]">
                        <span className="text-gray-700">Rs. {item.price.toFixed(2)}</span>
                      </div>
                      <div className="col-span-2 flex justify-center">
                        {item.isCombo ? (
                          <button
                            onClick={() => ungroupCombo(item.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-all border border-blue-100 shadow-sm"
                          >
                            Ungroup
                          </button>
                        ) : (
                          <div className="flex items-center bg-[#f0f4f8] rounded-lg p-1">
                            <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white text-gray-600 hover:shadow-sm transition-all"><Minus className="w-3 h-3" /></button>
                            <span className="w-10 text-center text-sm font-bold text-gray-800">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white text-gray-600 hover:shadow-sm transition-all"><Plus className="w-3 h-3" /></button>
                          </div>
                        )}
                      </div>
                      <div className="col-span-2 text-center font-medium text-gray-600 text-[14px]">
                        {itemDisc}%
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button onClick={() => setCart(prev => prev.filter(p => p.id !== item.id))} className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded transition-colors" title="Remove item">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="col-span-2 text-right text-[15px] font-bold text-[#047857]">
                        Rs. {itemTotal.toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom Controls */}
          <div className="border-t border-gray-200 pt-6 mt-4 shrink-0 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div>
                <label className="block text-xs font-bold text-gray-900 mb-2 tracking-wide">Discount Type</label>
                <div className="relative">
                  <select
                    value={discountType}
                    onChange={(e) => {
                      const type = e.target.value as 'item' | 'bill' | 'both';
                      setDiscountType(type);
                      if (type === 'item') { setManualDiscount(0); setDiscountInput(''); }
                    }}
                    className="w-full bg-[#f3f4f6] border border-[#e5e7eb] text-gray-800 rounded-lg px-4 py-3 text-sm font-medium focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="item">Item Value (Individual)</option>
                    <option value="bill">Bill Value (Overall)</option>
                    <option value="both">Both (Item &amp; Bill)</option>
                  </select>
                  <ChevronRight className="w-4 h-4 text-gray-500 absolute right-4 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                </div>
              </div>
              <div className={`transition-all duration-300 ${!isOverallDiscountActive ? 'opacity-40 blur-[0.75px] pointer-events-none select-none' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-gray-900 tracking-wide">Overall Discount (%)</label>
                  {autoBillDiscount.percentage > 0 && (
                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 animate-pulse">
                      Auto Offer: {autoBillDiscount.percentage}% OFF ({autoBillDiscount.name})
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder={autoBillDiscount.percentage > 0 ? `Auto applied: ${autoBillDiscount.percentage}%` : "Enter discount (%)"}
                    value={manualDiscount || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setManualDiscount(isNaN(val) ? 0 : val);
                    }}
                    disabled={!isOverallDiscountActive}
                    className="w-full bg-[#f3f4f6] border border-[#e5e7eb] text-gray-800 rounded-lg px-4 py-3 text-sm font-medium focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Customer Paid (Rs.)</label>
                <input
                  type="number"
                  placeholder="Enter amount paid"
                  value={customerPaidInput}
                  onChange={e => setCustomerPaidInput(e.target.value)}
                  className="w-full bg-[#f3f4f6] border border-[#e5e7eb] text-gray-800 rounded-lg px-4 py-3 text-sm font-medium focus:outline-none"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full mb-6 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Items Subtotal</span>
                <div className="w-28 h-10 flex items-center justify-center bg-white border border-gray-300 rounded-lg text-sm font-extrabold text-gray-800 shrink-0">
                  Rs. {grossTotal.toFixed(2)}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Total Discount</span>
                <div className="w-28 h-10 flex items-center justify-center bg-white border border-gray-300 rounded-lg text-sm font-extrabold text-gray-800 shrink-0">
                  -Rs. {totalSavedAmount.toFixed(2)}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Bill Total</span>
                <div className="w-28 h-10 flex items-center justify-center bg-white border border-gray-300 rounded-lg text-sm font-extrabold text-gray-800 shrink-0">
                  Rs. {total.toFixed(2)}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Change Due</span>
                <div className="w-28 h-10 flex items-center justify-center bg-white border border-gray-300 rounded-lg text-sm font-extrabold text-gray-800 shrink-0">
                  Rs. {(() => {
                    const paid = parseFloat(customerPaidInput);
                    if (isNaN(paid) || paid <= 0) return '0.00';
                    return Math.max(0, paid - total).toFixed(2);
                  })()}
                </div>
              </div>
            </div>

            <div className="flex justify-end w-full">
              <button
                onClick={handleCompleteTransaction}
                disabled={cartWithDiscounts.length === 0 || !customerPaidInput}
                className={`px-8 h-12 rounded-xl font-bold text-base flex items-center justify-center transition-all shadow-sm shrink-0 w-full sm:w-auto ${
                  cartWithDiscounts.length > 0 && customerPaidInput
                    ? 'bg-[#047857] hover:bg-[#065f46] text-white shadow-md cursor-pointer'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Complete Transaction
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
