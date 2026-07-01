import React from 'react';
import { ShoppingCart } from 'lucide-react';

interface DiscountsTabProps {
  discounts: any[];
  products: any[];
  addComboToCart: (discount: any) => void;
  addDiscountProductsToCart: (discount: any) => void;
}

export const DiscountsTab: React.FC<DiscountsTabProps> = ({
  discounts,
  products,
  addComboToCart,
  addDiscountProductsToCart
}) => {
  const combos = discounts.filter(d => d.type === 'COMBO');
  const seasonal = discounts.filter(d => d.type === 'SEASONAL');
  const daily = discounts.filter(d => d.type === 'DAILY');

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fc] relative">
      <div className="max-w-7xl mx-auto relative z-10 font-sans pb-16 space-y-12">
        
        {/* 1. Curated Combos Section */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-black text-[#103e2c] mb-1">Curated Combos</h2>
            <p className="text-gray-500 text-xs">Buy these products together to unlock bundle deals.</p>
          </div>

          {combos.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 text-gray-500 font-bold text-xs shadow-sm">
              No active combo bundles available.
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {combos.map(discount => {
                const originalTotal = discount.comboItems.reduce((sum: number, item: any) => {
                  const prod = products.find(p => p.sku === item.productId || p.id === item.productId);
                  return sum + (prod ? prod.price * item.minQty : 0);
                }, 0);
                const finalTotal = originalTotal * (1 - discount.discountValue / 100);

                return (
                  <div key={discount.id} className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col sm:flex-row border border-gray-100 hover:shadow-lg transition-shadow">
                    <div className="relative w-full sm:w-1/2 h-44 sm:h-auto bg-gray-50 shrink-0">
                      <img 
                        src={discount.imageUrl || "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=800&auto=format&fit=crop"} 
                        alt={discount.name} 
                        className="w-full h-full object-cover" 
                      />
                      <div className="absolute top-4 left-4 bg-[#0a3822] text-white text-[9px] font-bold px-3 py-1 rounded-full tracking-wide shadow-sm">
                        {discount.label || 'COMBO SAVER'}
                      </div>
                    </div>
                    <div className="w-full sm:w-1/2 p-6 flex flex-col justify-between">
                      <div>
                        <h3 className="text-base font-extrabold text-gray-900 mb-1 leading-snug">{discount.name}</h3>
                        <div className="mt-2 space-y-1">
                          <p className="text-gray-400 text-[9px] font-bold uppercase tracking-wider">Required Items:</p>
                          {discount.comboItems.map((item: any, idx: number) => {
                            const prod = products.find(p => p.sku === item.productId || p.id === item.productId);
                            return (
                              <div key={idx} className="text-xs text-gray-700 font-bold flex justify-between">
                                <span className="truncate pr-1">• {prod ? prod.name : 'Unknown Product'}</span>
                                <span className="text-[#0a3822] shrink-0">Qty: {item.minQty}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="mt-4 border-t border-gray-100 pt-3 flex flex-col justify-end">
                        <div className="mb-3 flex items-baseline gap-1.5 justify-between">
                          <span className="text-gray-500 text-[10px] font-bold">Bundle Price:</span>
                          <div className="text-right">
                            <span className="text-gray-900 font-extrabold text-lg block">Rs. {finalTotal.toFixed(2)}</span>
                            <span className="text-gray-400 line-through text-xs font-medium">Rs. {originalTotal.toFixed(2)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => addComboToCart(discount)}
                          className="w-full bg-[#0a3822] text-white hover:bg-[#072a19] py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <ShoppingCart className="w-4 h-4" />
                          Add Combo to Cart
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 2. Seasonal Specials Section */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-black text-[#103e2c] mb-1">Seasonal Deals</h2>
            <p className="text-gray-500 text-xs">Fresh savings for the current season.</p>
          </div>

          {seasonal.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 text-gray-500 font-bold text-xs shadow-sm">
              No active seasonal deals available.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {seasonal.map(discount => (
                <div key={discount.id} className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow flex flex-col">
                  <div className="h-40 w-full relative bg-gray-50 shrink-0">
                    <img 
                      src={discount.imageUrl || "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?q=80&w=600&auto=format&fit=crop"} 
                      alt={discount.name} 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute top-4 right-4 bg-emerald-500/90 backdrop-blur-sm text-white text-[10px] font-black px-3 py-1 rounded-full shadow-sm">
                      {discount.discountValue}% OFF
                    </div>
                    <div className="absolute bottom-4 left-4 bg-black/70 text-white text-[9px] font-bold px-3 py-1 rounded shadow-sm">
                      VALIDITY: {discount.startDate} TO {discount.endDate}
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="text-base font-extrabold text-gray-900 mb-1 leading-snug">{discount.name}</h3>
                      {discount.label && <p className="text-emerald-700 text-xs font-bold flex items-center gap-1">★ {discount.label}</p>}
                      <div className="mt-3 space-y-1 border-t border-gray-50 pt-2">
                        <p className="text-gray-400 text-[9px] font-bold uppercase tracking-wider">Applicable to Products:</p>
                        {discount.productIds?.map((skuId: string, idx: number) => {
                          const prod = products.find(p => p.sku === skuId || p.id === skuId);
                          return (
                            <div key={idx} className="text-xs text-gray-700 font-bold truncate flex flex-wrap gap-x-2">
                              <span>• {prod ? prod.name : skuId}</span>
                              <span className="text-gray-400 line-through font-semibold">(Original: Rs. {prod ? prod.price.toFixed(2) : '0.00'})</span>
                              <span className="text-emerald-700 font-extrabold">(Offer: Rs. {prod ? (prod.price * (1 - discount.discountValue / 100)).toFixed(2) : '0.00'})</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      onClick={() => addDiscountProductsToCart(discount)}
                      className="w-full bg-[#0a3822] text-white hover:bg-[#072a19] py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Add Products to Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3. Daily Specials Section */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-black text-[#103e2c] mb-1 flex items-center gap-1.5">Daily Offers ⚡</h2>
            <p className="text-gray-500 text-xs">Happy hour value deals active today.</p>
          </div>

          {daily.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 text-gray-500 font-bold text-xs shadow-sm">
              No active daily specials available.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {daily.map(discount => (
                <div key={discount.id} className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow flex flex-col">
                  <div className="h-40 w-full relative bg-gray-50 shrink-0">
                    <img 
                      src={discount.imageUrl || "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=600&auto=format&fit=crop"} 
                      alt={discount.name} 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute top-4 right-4 bg-emerald-500/90 backdrop-blur-sm text-white text-[10px] font-black px-3 py-1 rounded-full shadow-sm">
                      {discount.discountValue}% OFF
                    </div>
                    <div className="absolute bottom-4 left-4 bg-black/70 text-white text-[9px] font-bold px-3 py-1 rounded shadow-sm flex flex-col gap-0.5">
                      {discount.applicableDate && <span>DATE: {discount.applicableDate}</span>}
                      <span>HOURS: {discount.dailyStartTime} - {discount.dailyEndTime}</span>
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="text-base font-extrabold text-gray-900 mb-1 leading-snug">{discount.name}</h3>
                      {discount.label && <p className="text-emerald-700 text-xs font-bold flex items-center gap-1">★ {discount.label}</p>}
                      <div className="mt-3 space-y-1 border-t border-gray-50 pt-2">
                        <p className="text-gray-400 text-[9px] font-bold uppercase tracking-wider">Applicable to Products:</p>
                        {discount.productIds?.map((skuId: string, idx: number) => {
                          const prod = products.find(p => p.sku === skuId || p.id === skuId);
                          return (
                            <div key={idx} className="text-xs text-gray-700 font-bold truncate flex flex-wrap gap-x-2">
                              <span>• {prod ? prod.name : skuId}</span>
                              <span className="text-gray-400 line-through font-semibold">(Original: Rs. {prod ? prod.price.toFixed(2) : '0.00'})</span>
                              <span className="text-emerald-700 font-extrabold">(Offer: Rs. {prod ? (prod.price * (1 - discount.discountValue / 100)).toFixed(2) : '0.00'})</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      onClick={() => addDiscountProductsToCart(discount)}
                      className="w-full bg-[#0a3822] text-white hover:bg-[#072a19] py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Add Products to Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
};
