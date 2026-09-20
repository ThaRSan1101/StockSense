import React, { useState, useMemo } from 'react';
import { ShoppingCart, Search, Sparkles, Flame, Calendar, Clock } from 'lucide-react';

interface DiscountsTabProps {
  discounts: any[];
  posCombos?: any[];
  products: any[];
  addComboToCart: (discount: any) => void;
  addApprovedComboToCart?: (combo: any) => void;
  addDiscountProductsToCart: (discount: any) => void;
  addSingleDiscountProduct?: (product: any, discount: any) => void;
}

export const DiscountsTab: React.FC<DiscountsTabProps> = ({
  discounts,
  posCombos = [],
  products,
  addApprovedComboToCart,
  addDiscountProductsToCart,
  addSingleDiscountProduct
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // 1. Combos (Both AI-generated approved combos and Manager-created standard combos)
  const allCombos = useMemo(() => {
    const existingIds = new Set(posCombos.map(c => c.id));
    const todayStr = new Date().toISOString().split('T')[0];
    
    const mappedDiscounts = discounts
      .filter(d => {
        if (d.type !== 'COMBO') return false;
        if (!d.isActive || d.approvalStatus !== 'APPROVED') return false;
        if (d.endDate && d.endDate < todayStr) return false;
        return !existingIds.has(d.id);
      })
      .map(d => {
        const regularTotal = (d.comboItems || []).reduce((acc: number, item: any) => {
          const prod = products.find(p => p.sku === item.productId || p.id === item.productId);
          const price = item.sellingPrice || (prod ? prod.sellingPrice : 0);
          return acc + (Number(price) * (Number(item.minQty) || 1));
        }, 0);
        const comboPrice = d.comboPrice ? Number(d.comboPrice) : (regularTotal * (1 - (d.discountValue || 0) / 100));

        return {
          id: d.id,
          comboCode: d.label || `COMBO-${d.id.substring(0, 6).toUpperCase()}`,
          name: d.name,
          description: d.label ? `${d.name} (${d.label})` : `Special store combo bundle with ${d.discountValue}% discount.`,
          comboType: 'STORE_BUNDLE',
          sourceSuggestionId: null,
          comboPrice,
          normalTotalPrice: regularTotal,
          discountPercentage: d.discountValue || 0,
          maximumQuantity: 100,
          soldQuantity: 0,
          startDate: d.startDate,
          endDate: d.endDate,
          items: (d.comboItems || []).map((item: any) => {
            const prod = products.find(p => p.sku === item.productId || p.id === item.productId);
            return {
              productId: item.productId,
              role: 'BUNDLE',
              quantity: item.minQty || 1,
              normalUnitPrice: item.sellingPrice || (prod ? prod.sellingPrice : 0),
              product: {
                name: item.productName || (prod ? prod.name : item.productId),
                sku: item.productId,
                imageUrl: prod?.imageUrl || d.imageUrl
              }
            };
          })
        };
      });

    return [...posCombos, ...mappedDiscounts];
  }, [posCombos, discounts, products]);

  // 2. Seasonal Discounts & Packages
  const seasonalCampaigns = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return discounts.filter(d => {
      if (d.type !== 'SEASONAL') return false;
      if (!d.isActive || d.approvalStatus !== 'APPROVED') return false;
      if (d.endDate && d.endDate < todayStr) return false;
      return true;
    });
  }, [discounts]);

  // 3. Daily Flash Deals (Deduplicated by SKU)
  const dailyProducts = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const seenSkus = new Set<string>();
    const items: any[] = [];
    
    discounts.filter(d => {
      if (d.type !== 'DAILY') return false;
      if (!d.isActive || d.approvalStatus !== 'APPROVED') return false;
      if (d.endDate && d.endDate < todayStr) return false;
      return true;
    }).forEach(discount => {
      // 1. Check direct discount.products array (populated by backend endpoint)
      if (discount.products && discount.products.length > 0) {
        discount.products.forEach((prod: any) => {
          if (prod && prod.sku && !seenSkus.has(prod.sku)) {
            seenSkus.add(prod.sku);
            items.push({
              discount,
              prod: {
                ...prod,
                price: prod.price || prod.sellingPrice || 0
              },
              skuId: prod.sku
            });
          }
        });
      } else {
        // 2. Fallback to productIds matching with products state
        (discount.productIds || []).forEach((skuId: string) => {
          if (!seenSkus.has(skuId)) {
            const prod = products.find(p => p.sku === skuId || p.id === skuId);
            if (prod) {
              seenSkus.add(skuId);
              items.push({
                discount,
                prod: {
                  ...prod,
                  price: prod.price || prod.sellingPrice || 0
                },
                skuId
              });
            }
          }
        });
      }
    });
    return items;
  }, [discounts, products]);

  // Search filtering
  const q = searchQuery.toLowerCase().trim();

  const filteredCombos = useMemo(() => {
    if (!q) return allCombos;
    return allCombos.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.comboCode.toLowerCase().includes(q) ||
      (c.items || []).some((i: any) => (i.product?.name || '').toLowerCase().includes(q) || (i.product?.sku || '').toLowerCase().includes(q))
    );
  }, [allCombos, q]);

  const filteredSeasonalCampaigns = useMemo(() => {
    if (!q) return seasonalCampaigns;
    return seasonalCampaigns.filter(d => {
      const nameMatch = (d.name || '').toLowerCase().includes(q);
      const labelMatch = (d.label || '').toLowerCase().includes(q);
      const prodMatch = (d.productIds || []).some((skuId: string) => {
        const p = products.find(prod => prod.sku === skuId || prod.id === skuId);
        return p && (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
      });
      return nameMatch || labelMatch || prodMatch;
    });
  }, [seasonalCampaigns, q, products]);

  const filteredDaily = useMemo(() => {
    if (!q) return dailyProducts;
    return dailyProducts.filter(item => 
      (item.prod.name || '').toLowerCase().includes(q) || 
      (item.prod.sku || '').toLowerCase().includes(q) ||
      (item.discount.name || '').toLowerCase().includes(q)
    );
  }, [dailyProducts, q]);

  const showCombosSection = (selectedCategory === 'ALL' || selectedCategory === 'COMBOS') && filteredCombos.length > 0;
  const showDailySection = (selectedCategory === 'ALL' || selectedCategory === 'DAILY') && filteredDaily.length > 0;
  const showSeasonalSection = (selectedCategory === 'ALL' || selectedCategory === 'SEASONAL') && filteredSeasonalCampaigns.length > 0;

  const totalResults = filteredCombos.length + filteredDaily.length + filteredSeasonalCampaigns.length;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fc] relative font-sans">
      <div className="max-w-7xl mx-auto relative z-10 pb-16 space-y-8">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              Special Offers & Combos
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Discover hand-crafted bundle promotions, AI-optimized smart combinations, and limited-time discounts.</p>
          </div>

          <div className="w-full md:w-80 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by combo name, SKU, barcode..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-700 transition-colors"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'ALL' 
                ? 'bg-[#103e2c] text-white shadow-sm' 
                : 'bg-white text-gray-600 hover:bg-emerald-50/60 border border-gray-200/60'
            }`}
          >
            All Active Deals ({totalResults})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('COMBOS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'COMBOS' 
                ? 'bg-[#103e2c] text-white shadow-sm' 
                : 'bg-white text-gray-600 hover:bg-emerald-50/60 border border-gray-200/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            Combos ({filteredCombos.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('DAILY')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'DAILY' 
                ? 'bg-[#103e2c] text-white shadow-sm' 
                : 'bg-white text-gray-600 hover:bg-emerald-50/60 border border-gray-200/60'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-emerald-600" />
            Daily Flash Deals ({filteredDaily.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('SEASONAL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'SEASONAL' 
                ? 'bg-[#103e2c] text-white shadow-sm' 
                : 'bg-white text-gray-600 hover:bg-emerald-50/60 border border-gray-200/60'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-700" />
            Seasonal Specials ({filteredSeasonalCampaigns.length})
          </button>
        </div>

        {totalResults === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center border border-gray-100 shadow-sm text-gray-400 space-y-2">
            <p className="text-base font-bold text-gray-600">No matching promotions or combo deals found.</p>
            <p className="text-xs">Try adjusting your search keywords or filter category.</p>
          </div>
        ) : (
          <div className="space-y-12">
            
            {/* 1. Combos */}
            {showCombosSection && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-emerald-700" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-gray-900">Combos</h2>
                      <p className="text-gray-400 text-xs">High-demand pairing bundles and store combos for customers.</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80">
                    {filteredCombos.length} Combos Active
                  </span>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {filteredCombos.map(combo => {
                    return (
                      <div key={combo.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                        <div>
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <div>
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-[#103e2c] text-[10px] font-black uppercase px-2 py-0.5 rounded border border-emerald-200/80 mb-1">
                                Combo Offer
                              </span>
                              <h3 className="font-extrabold text-gray-900 text-sm leading-snug">{combo.name}</h3>
                              <p className="text-[10px] text-gray-400 font-mono mt-0.5">CODE: {combo.comboCode}</p>
                            </div>
                            <span className="bg-[#103e2c] text-white text-[10px] font-black px-2.5 py-1 rounded-lg shrink-0 shadow-xs">
                              {combo.discountPercentage.toFixed(0)}% OFF
                            </span>
                          </div>

                        {/* Items Breakdown */}
                        <div className="space-y-1.5 bg-gray-50/80 p-3 rounded-xl border border-gray-100 mt-3">
                          <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Bundle Items:</p>
                          {combo.items.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-xs font-semibold text-gray-700">
                              <span className="line-clamp-1 pr-2">
                                • {item.quantity}x {item.product?.name || item.productId}
                              </span>
                              <span className="text-gray-400 font-mono text-[10px] shrink-0">Rs. {((item.normalUnitPrice || item.product?.sellingPrice || 0) * item.quantity).toFixed(0)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Footer & Add to Cart */}
                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-4">
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs text-gray-400 line-through">Rs. {combo.normalTotalPrice.toFixed(0)}</span>
                            <span className="text-lg font-black text-[#103e2c]">Rs. {combo.comboPrice.toFixed(0)}</span>
                          </div>
                          <p className="text-[10px] text-emerald-800 font-bold">
                            Save Rs. {(combo.normalTotalPrice - combo.comboPrice).toFixed(0)} per pack
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => addApprovedComboToCart && addApprovedComboToCart(combo)}
                          className="bg-[#103e2c] text-white hover:bg-[#165a40] px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          Add Combo to Bill
                        </button>
                      </div>
                    </div>
                  );
                })}
                </div>
              </section>
            )}

            {/* 2. Today's Flash Daily Deals */}
            {showDailySection && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                      <Flame className="w-4 h-4 text-emerald-700" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-gray-900">Today's Daily Flash Deals</h2>
                      <p className="text-gray-400 text-xs">Time-limited special daily item discounts.</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80">
                    {filteredDaily.length} Products on Sale
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredDaily.map(({ discount, prod }, idx) => {
                    const discountedPrice = prod.price * (1 - discount.discountValue / 100);
                    return (
                      <div key={`${discount.id}-${prod.sku}-${idx}`} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-md transition-all flex flex-col justify-between space-y-3">
                        <div>
                          <div className="flex justify-between items-start gap-1 mb-2">
                            <span className="bg-emerald-50 text-[#103e2c] text-[9px] font-black uppercase px-2 py-0.5 rounded border border-emerald-200/80">
                              {discount.dailyEndTime ? `Ends ${discount.dailyEndTime}` : 'Daily Deal'}
                            </span>
                            <span className="bg-[#103e2c] text-white text-[9px] font-black px-2 py-0.5 rounded shadow-xs">
                              {discount.discountValue}% OFF
                            </span>
                          </div>
                          <h4 className="font-extrabold text-gray-900 text-xs line-clamp-2 min-h-[32px] leading-snug">{prod.name}</h4>
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5">SKU: {prod.sku}</p>
                        </div>

                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] text-gray-400 line-through block">Rs. {prod.price.toFixed(2)}</span>
                            <span className="text-sm font-black text-gray-900">Rs. {discountedPrice.toFixed(2)}</span>
                          </div>
                          {addSingleDiscountProduct && (
                            <button
                              type="button"
                              onClick={() => addSingleDiscountProduct(prod, discount)}
                              className="p-2 bg-emerald-50 hover:bg-emerald-100 text-[#103e2c] rounded-xl transition-colors cursor-pointer"
                              title="Add discounted product"
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 3. Seasonal & Festival Specials */}
            {showSeasonalSection && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-emerald-700" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-gray-900">Seasonal & Festival Specials</h2>
                      <p className="text-gray-400 text-xs">Exclusive seasonal promotions & multi-item packages.</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80">
                    {filteredSeasonalCampaigns.length} Active Seasonal Offers
                  </span>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {filteredSeasonalCampaigns.map((discount: any) => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isUpcoming = Boolean(discount.startDate && discount.startDate > todayStr);

                    const packageProds = (discount.productIds || []).map((skuId: string) => {
                      const found = products.find(p => p.sku === skuId || p.id === skuId);
                      if (found) return found;
                      const dp = (discount.products || []).find((p: any) => p.sku === skuId);
                      if (dp) {
                        return {
                          id: dp.sku,
                          sku: dp.sku,
                          name: dp.name,
                          price: dp.sellingPrice,
                          sellingPrice: dp.sellingPrice,
                          currentStock: dp.currentStock,
                          image: dp.imageUrl
                        };
                      }
                      return null;
                    }).filter(Boolean);

                    return (
                      <div key={discount.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                        <div>
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <div>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-[#103e2c] text-[10px] font-black uppercase px-2 py-0.5 rounded border border-emerald-200/80">
                                  <Calendar className="w-2.5 h-2.5" />
                                  {discount.label || 'Seasonal Offer'}
                                </span>
                                {isUpcoming ? (
                                  <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border border-amber-200">
                                    <Clock className="w-2.5 h-2.5" />
                                    Starts {discount.startDate}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-emerald-100/70 text-emerald-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded">
                                    Active Now
                                  </span>
                                )}
                              </div>
                              <h3 className="font-extrabold text-gray-900 text-sm leading-snug">{discount.name}</h3>
                              {discount.endDate && (
                                <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                                  Valid: {discount.startDate ? `${discount.startDate} to ` : ''}{discount.endDate}
                                  {isUpcoming && <span className="text-amber-600 font-bold ml-1.5">(Starts soon)</span>}
                                </p>
                              )}
                            </div>
                            <span className="bg-[#103e2c] text-white text-[10px] font-black px-2.5 py-1 rounded-lg shrink-0 shadow-xs">
                              {discount.discountValue}% OFF
                            </span>
                          </div>

                          {/* Package Items Breakdown */}
                          <div className="space-y-2 bg-gray-50/80 p-3 rounded-xl border border-gray-100 mt-3">
                            <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider">
                              Package Items Included ({packageProds.length} Products):
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {packageProds.map((prod: any, idx: number) => {
                                const prodPrice = prod.price ?? prod.sellingPrice ?? 0;
                                const discountedPrice = prodPrice * (1 - discount.discountValue / 100);
                                return (
                                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-100 shadow-xs">
                                    <div className="min-w-0 pr-2">
                                      <p className="text-xs font-bold text-gray-800 truncate">{prod.name}</p>
                                      <div className="flex items-baseline gap-1">
                                        <span className="text-[11px] font-black text-emerald-800">Rs. {discountedPrice.toFixed(0)}</span>
                                        <span className="text-[9px] text-gray-400 line-through">Rs. {prodPrice.toFixed(0)}</span>
                                      </div>
                                    </div>
                                    {addSingleDiscountProduct && (
                                      <button
                                        type="button"
                                        onClick={() => addSingleDiscountProduct(prod, discount)}
                                        className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#103e2c] rounded-lg transition-colors cursor-pointer shrink-0"
                                        title="Add this item only"
                                      >
                                        <ShoppingCart className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Footer & Add All to Cart */}
                        <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-4">
                          <span className="text-[10px] font-bold text-emerald-800">
                            {isUpcoming
                              ? `Scheduled promotional deal (${discount.discountValue}% OFF)`
                              : `${discount.discountValue}% Promotional Discount Applied`
                            }
                          </span>

                          <button
                            type="button"
                            onClick={() => addDiscountProductsToCart(discount)}
                            className="bg-[#103e2c] text-white hover:bg-[#165a40] px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            Add Package Deal to Bill
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

          </div>
        )}

      </div>
    </div>
  );
};
