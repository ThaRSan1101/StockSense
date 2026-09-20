import { useEffect, useState, useMemo } from 'react';
import { DiscountService } from '../../services/discountService';
import { comboService } from '../../services/comboService';
import { Sparkles, Flame, Calendar, ShoppingBag, Clock, CheckCircle2 } from 'lucide-react';

export default function OffersPage() {
  const [mounted, setMounted] = useState(false);
  const [publicCombos, setPublicCombos] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  useEffect(() => {
    setMounted(true);
    
    const fetchOffers = async () => {
      try {
        setLoading(true);
        const [discRes, comboRes] = await Promise.all([
          DiscountService.getDiscounts(),
          comboService.getPublicActiveCombos()
        ]);

        if (discRes.success) {
          const todayStr = new Date().toISOString().split('T')[0];
          const activeApproved = discRes.data.filter((d: any) => {
            if (!d.isActive || d.approvalStatus !== 'APPROVED') return false;
            if (d.endDate && d.endDate < todayStr) return false;
            return true;
          });
          setDiscounts(activeApproved);
        }

        if (comboRes.success) {
          setPublicCombos(comboRes.data);
        }
      } catch (error) {
        console.error("Failed to fetch discounts or combos", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchOffers();
  }, []);

  // 1. Combos (Both AI-generated approved combos and Manager-created standard combos)
  const allCombos = useMemo(() => {
    const existingIds = new Set(publicCombos.map(c => c.id));
    const mappedDiscounts = discounts
      .filter(d => d.type === 'COMBO' && !existingIds.has(d.id))
      .map(d => {
        const regularTotal = (d.comboItems || []).reduce((acc: number, item: any) => acc + (Number(item.sellingPrice || 0) * (Number(item.minQty) || 1)), 0);
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
          endDate: d.endDate || '2099-12-31',
          items: (d.comboItems || []).map((item: any) => ({
            productId: item.productId,
            role: 'BUNDLE',
            quantity: item.minQty || 1,
            normalUnitPrice: item.sellingPrice || 0,
            product: {
              name: item.productName || item.productId,
              sku: item.productId,
              imageUrl: item.imageUrl || d.imageUrl
            }
          }))
        };
      });

    return [...publicCombos, ...mappedDiscounts];
  }, [publicCombos, discounts]);

  // 2. Seasonal Discount Campaigns & Packages
  const seasonalCampaigns = useMemo(() => {
    return discounts.filter(d => d.type === 'SEASONAL');
  }, [discounts]);

  // 3. Daily Flash Deals (Deduplicated by SKU)
  const dailyProducts = useMemo(() => {
    const seenSkus = new Set<string>();
    const items: any[] = [];
    discounts.filter(d => d.type === 'DAILY').forEach(discount => {
      (discount.products || []).forEach((prod: any) => {
        if (!seenSkus.has(prod.sku)) {
          seenSkus.add(prod.sku);
          items.push({ discount, prod });
        }
      });
    });
    return items;
  }, [discounts]);

  const showCombosSection = (activeFilter === 'ALL' || activeFilter === 'COMBOS') && allCombos.length > 0;
  const showDailySection = (activeFilter === 'ALL' || activeFilter === 'DAILY') && dailyProducts.length > 0;
  const showSeasonalSection = (activeFilter === 'ALL' || activeFilter === 'SEASONAL') && seasonalCampaigns.length > 0;

  const totalOffersCount = allCombos.length + dailyProducts.length + seasonalCampaigns.length;

  return (
    <div className="min-h-screen bg-[#f8f9fc] relative overflow-hidden font-sans pb-32">
      {/* Decorative Background Glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute top-48 left-10 w-80 h-80 bg-emerald-50/50 rounded-full blur-3xl pointer-events-none -z-0" />

      <div className={`relative z-10 max-w-7xl mx-auto px-6 md:px-12 pt-16 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
        
        {/* Page Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight">
            Special Offers & Combos
          </h1>
          <p className="text-gray-500 text-sm md:text-base leading-relaxed">
            Discover hand-crafted bundle promotions, AI-optimized smart combinations, and limited-time discounts designed to bring you the best value.
          </p>
        </div>

        {/* Category Navigation Pills */}
        <div className="flex items-center justify-center gap-2.5 overflow-x-auto pb-4 mb-12 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveFilter('ALL')}
            className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeFilter === 'ALL'
                ? 'bg-[#103e2c] text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-emerald-50/60 border border-gray-200/80 shadow-xs'
            }`}
          >
            All Offers ({totalOffersCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('COMBOS')}
            className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeFilter === 'COMBOS'
                ? 'bg-[#103e2c] text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-emerald-50/60 border border-gray-200/80 shadow-xs'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            Combos ({allCombos.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('DAILY')}
            className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeFilter === 'DAILY'
                ? 'bg-[#103e2c] text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-emerald-50/60 border border-gray-200/80 shadow-xs'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-emerald-600" />
            Daily Flash Deals ({dailyProducts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('SEASONAL')}
            className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeFilter === 'SEASONAL'
                ? 'bg-[#103e2c] text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-emerald-50/60 border border-gray-200/80 shadow-xs'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-700" />
            Seasonal Specials ({seasonalCampaigns.length})
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col justify-center items-center h-64 space-y-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#103e2c]"></div>
            <p className="text-xs font-bold text-gray-400">Loading current store promotions...</p>
          </div>
        ) : totalOffersCount === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center border border-gray-100 shadow-sm max-w-xl mx-auto space-y-3">
            <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto" />
            <h3 className="text-xl font-bold text-gray-800">No active promotions right now</h3>
            <p className="text-xs text-gray-400">Check back shortly as new smart bundles and seasonal offers are updated daily!</p>
          </div>
        ) : (
          <div className="space-y-20">
            
            {/* 1. Combos (AI-Generated & Store Combos) */}
            {showCombosSection && (
              <section className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 border-b border-gray-200/60 pb-4">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black text-gray-900">Combos</h2>
                    <p className="text-gray-500 text-xs mt-1">High-demand pairing combos and curated bundle deals specially designed for maximum savings.</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80">
                    {allCombos.length} Combos Available
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {allCombos.map(combo => {
                    return (
                      <div key={combo.id} className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col justify-between group">
                        
                        {/* Products Stack & Visual Header */}
                        <div className="relative bg-gradient-to-br from-emerald-50/60 to-gray-50/80 p-6 border-b border-gray-100 flex items-center justify-center">
                          <div className="absolute top-4 left-4 bg-[#103e2c] text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                            Save {combo.discountPercentage.toFixed(0)}%
                          </div>
                          <div className="absolute top-4 right-4 text-[10px] font-mono font-bold text-gray-400">
                            {combo.comboCode}
                          </div>

                          {/* Product Thumbnails Stack */}
                          <div className="flex items-center justify-center gap-4 py-4">
                            {combo.items.map((item: any, idx: number) => (
                              <div key={idx} className="flex flex-col items-center">
                                <div className="w-20 h-20 bg-white rounded-2xl p-1.5 shadow-sm border border-gray-200/80 flex items-center justify-center relative group-hover:scale-105 transition-transform">
                                  <img
                                    src={item.product?.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=400&auto=format&fit=crop"}
                                    alt={item.product?.name}
                                    className="w-full h-full object-cover rounded-xl"
                                  />
                                  <span className="bg-[#103e2c] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full absolute -top-2 -right-2 shadow-xs">
                                    {item.quantity}x
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold text-gray-700 text-center mt-2 line-clamp-1 w-20">
                                  {item.product?.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Content & Pricing */}
                        <div className="p-6 md:p-8 flex flex-col justify-between flex-1 space-y-6">
                          <div>
                            <div className="mb-2 flex items-center gap-2">
                              <span className="text-[10px] font-black bg-emerald-50 text-[#103e2c] border border-emerald-200 px-2 py-0.5 rounded uppercase">
                                Combo Deal
                              </span>
                            </div>
                            <h3 className="text-xl font-black text-gray-900 mb-2 leading-tight">{combo.name}</h3>
                            <p className="text-gray-500 text-xs line-clamp-2 leading-relaxed">
                              {combo.description || `Special bundle deal: save Rs. ${(combo.normalTotalPrice - combo.comboPrice).toFixed(0)} when purchased together.`}
                            </p>

                            <div className="mt-4 space-y-1 bg-gray-50/80 p-3 rounded-xl border border-gray-100">
                              <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Includes:</p>
                              {combo.items.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-xs font-semibold text-gray-700">
                                  <span className="line-clamp-1">• {item.quantity}x {item.product?.name || item.productId}</span>
                                  <span className="text-gray-400 font-mono text-[10px]">Rs. {((item.normalUnitPrice || item.product?.sellingPrice || 0) * item.quantity).toFixed(0)}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Price & CTA */}
                          <div className="pt-4 border-t border-gray-100 flex items-end justify-between">
                            <div>
                              <div className="flex items-baseline gap-2">
                                <span className="text-xs text-gray-400 line-through font-semibold">Rs. {combo.normalTotalPrice.toFixed(2)}</span>
                                <span className="text-2xl font-black text-[#103e2c]">Rs. {combo.comboPrice.toFixed(2)}</span>
                              </div>
                              <p className="text-xs font-black text-emerald-800 mt-0.5">
                                Instant Saving: Rs. {(combo.normalTotalPrice - combo.comboPrice).toFixed(2)}
                              </p>
                            </div>

                            <div className="text-right text-[10px] text-gray-400 font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3 text-gray-400" />
                              Valid till {new Date(combo.endDate).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 2. Today's Flash Daily Offers */}
            {showDailySection && (
              <section className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 border-b border-gray-200/60 pb-4">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black text-gray-900">Today's Daily Specials</h2>
                    <p className="text-gray-500 text-xs mt-1">Limited-time daily promotions available while stocks last.</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80">
                    {dailyProducts.length} Items on Sale
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {dailyProducts.map(({ discount, prod }, idx) => {
                    const discountedPrice = prod.sellingPrice * (1 - discount.discountValue / 100);
                    return (
                      <div key={`${discount.id}-${prod.sku}-${idx}`} className="relative h-72 rounded-3xl overflow-hidden group shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:shadow-2xl transition-all duration-300 border border-gray-100">
                        <img 
                          src={prod.imageUrl || "https://images.unsplash.com/photo-1559553156-2e97137af16f?q=80&w=800&auto=format&fit=crop"} 
                          alt={prod.name} 
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-gray-900/40 to-transparent"></div>
                        
                        <div className="absolute top-3 left-3 bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/30 flex items-center gap-1.5">
                           <Clock className="w-3 h-3 text-white" />
                           <span className="text-[9px] font-black tracking-wider text-white uppercase">
                             {discount.dailyEndTime ? `Ends ${discount.dailyEndTime}` : 'Ends Today'}
                           </span>
                        </div>

                        <div className="absolute top-3 right-3">
                           <span className="bg-[#103e2c] text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm tracking-wide border border-emerald-500/30">
                             {discount.discountValue}% OFF
                           </span>
                        </div>
                        
                        <div className="absolute bottom-0 left-0 w-full p-5 flex flex-col justify-end">
                          <span className="text-emerald-300 font-bold text-[10px] mb-1 uppercase tracking-wider line-clamp-1">{discount.label || 'Daily Special'}</span>
                          <h3 className="text-white text-sm font-black mb-2 leading-snug line-clamp-2 min-h-[36px]">{prod.name}</h3>
                          
                          <div className="flex items-baseline gap-2">
                            <span className="text-white font-black text-xl">Rs. {discountedPrice.toFixed(2)}</span>
                            <span className="text-white/60 line-through text-xs font-semibold">Rs. {prod.sellingPrice.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 3. Seasonal & Festival Specials */}
            {showSeasonalSection && (
              <section className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 border-b border-gray-200/60 pb-4">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black text-gray-900">Festive & Seasonal Offer Packages</h2>
                    <p className="text-gray-500 text-xs mt-1">Celebrate the season with exclusive festival package discounts on selected items.</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80">
                    {seasonalCampaigns.length} Active Seasonal Offers
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {seasonalCampaigns.map((discount: any) => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isUpcoming = discount.startDate && discount.startDate > todayStr;

                    return (
                      <div key={discount.id} className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col justify-between group">
                        
                        {/* Campaign Header & Badge */}
                        <div className="relative bg-gradient-to-br from-emerald-50/80 to-teal-50/40 p-6 border-b border-gray-100 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            {isUpcoming ? (
                              <span className="bg-amber-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-200" />
                                {discount.discountValue}% OFF UPCOMING DEAL
                              </span>
                            ) : (
                              <span className="bg-[#103e2c] text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-emerald-200" />
                                {discount.discountValue}% OFF SEASONAL DEAL
                              </span>
                            )}
                            <span className="text-[10px] font-black text-[#103e2c] bg-emerald-100/90 px-2.5 py-0.5 rounded uppercase tracking-wide border border-emerald-200/60">
                              {discount.label || 'FESTIVE'}
                            </span>
                          </div>

                          <div className="mt-4">
                            <h3 className="text-xl font-black text-gray-900 leading-tight">{discount.name}</h3>
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 mt-1">
                              <Clock className="w-3.5 h-3.5 text-[#103e2c]" />
                              <span>
                                Valid: {discount.startDate} to {discount.endDate}
                                {isUpcoming && (
                                  <span className="ml-2 text-amber-800 font-bold bg-amber-100/80 px-2 py-0.5 rounded-full text-[10px]">
                                    Starts {discount.startDate}
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Package Items Included */}
                        <div className="p-6 flex flex-col justify-between flex-1 space-y-4">
                          <div>
                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2">
                              Included Package Items ({discount.products?.length || 0} Items):
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {(discount.products || []).map((prod: any, idx: number) => {
                                const discountedPrice = prod.sellingPrice * (1 - discount.discountValue / 100);
                                return (
                                  <div key={idx} className="flex items-center gap-3 p-2.5 rounded-2xl bg-gray-50/80 border border-gray-100">
                                    <img
                                      src={prod.imageUrl || "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?q=80&w=600&auto=format&fit=crop"}
                                      alt={prod.name}
                                      className="w-12 h-12 object-cover rounded-xl border border-gray-200/80 bg-white"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <h4 className="text-xs font-bold text-gray-900 truncate">{prod.name}</h4>
                                      <div className="flex items-baseline gap-1.5 mt-0.5">
                                        <span className="text-xs font-black text-[#103e2c]">Rs. {discountedPrice.toFixed(0)}</span>
                                        <span className="text-[10px] text-gray-400 line-through">Rs. {prod.sellingPrice.toFixed(0)}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-emerald-900 font-bold">
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                              {isUpcoming
                                ? `Upcoming promotion: ${discount.discountValue}% discount active from ${discount.startDate}`
                                : `${discount.discountValue}% Promotional Discount Applied at POS`
                              }
                            </span>
                          </div>
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
}
