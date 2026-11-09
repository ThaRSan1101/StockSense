import React, { useMemo } from 'react';
import { Search, Check, ShoppingCart, ArrowRight } from 'lucide-react';
import CategoryMarquee from '../../../components/shared/CategoryMarquee/CategoryMarquee';

interface ProductsTabProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  selectedCategory: string | null;
  setSelectedCategory: React.Dispatch<React.SetStateAction<string | null>>;
  loading: boolean;
  filteredProducts: any[];
  addToCart: (product: any, qty?: number) => void;
  cart?: any[];
  setActiveTab?: (tab: 'bill' | 'products' | 'discounts' | 'orders' | 'drafts') => void;
}

export const ProductsTab: React.FC<ProductsTabProps> = ({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  loading,
  filteredProducts,
  addToCart,
  cart = [],
  setActiveTab
}) => {
  // Map product id/sku to quantity currently in bill
  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((item: any) => {
      const key = item.id || item.sku;
      if (key) {
        map.set(key, (map.get(key) || 0) + (item.quantity || 1));
      }
    });
    return map;
  }, [cart]);

  const totalBillItems = useMemo(() => {
    return cart.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
  }, [cart]);

  const totalBillAmount = useMemo(() => {
    return cart.reduce((sum: number, item: any) => {
      const price = item.price ?? item.sellingPrice ?? 0;
      const qty = item.quantity || 1;
      const disc = item.discount ? (price * (item.discount / 100)) : 0;
      return sum + ((price - disc) * qty);
    }, 0);
  }, [cart]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white relative">
      <div className="border-b border-gray-100 px-6 py-4 flex flex-col gap-4 shrink-0 bg-white">
        <div className="relative flex-1 max-w-2xl">
          <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter products..."
            className="w-full bg-[#f3f4f6] text-gray-800 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#166534]/20 transition-all font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fc] relative pb-28">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-[28px] md:text-[36px] font-extrabold text-[#111827] leading-tight tracking-tight">
                Shop by Categories
              </h1>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="text-xs font-bold text-[#166534] hover:underline px-3 py-1.5 bg-[#dcfce7] rounded-lg transition-colors border border-green-200 cursor-pointer"
                >
                  Clear Filter
                </button>
              )}
            </div>
            <CategoryMarquee
              onCategorySelect={(categoryName) => {
                setSelectedCategory(prev => prev === categoryName ? null : categoryName);
              }}
              activeCategory={selectedCategory || undefined}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white rounded-[20px] p-3 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-100 animate-pulse">
                  <div className="bg-gray-100 rounded-[14px] h-48 mb-4"></div>
                  <div className="h-4 bg-gray-100 rounded w-2/3 mb-2"></div>
                  <div className="h-4 bg-gray-100 rounded w-1/3"></div>
                </div>
              ))
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full py-12 text-center text-gray-500 font-medium">
                No products found in category.
              </div>
            ) : (
              filteredProducts.map((product) => {
                const inCartQty = cartQtyMap.get(product.id) || cartQtyMap.get(product.sku) || 0;
                const isInCart = inCartQty > 0;

                return (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={`bg-white rounded-[20px] p-3 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border transition-all duration-300 group cursor-pointer relative flex flex-col justify-between ${
                      isInCart
                        ? 'border-emerald-400 ring-2 ring-emerald-500/20 shadow-[0_6px_20px_rgba(22,101,52,0.08)]'
                        : 'border-gray-100 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]'
                    }`}
                  >
                    <div className="bg-[#f4f6f8] rounded-[14px] h-48 relative overflow-hidden mb-4">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      {product.category && (
                        <span className="absolute top-3 left-3 px-3 py-1 text-[10px] font-bold rounded-full shadow-sm z-10 bg-[#1b4332] text-white">
                          {product.category}
                        </span>
                      )}

                      {/* In-Bill Indicator Badge */}
                      {isInCart && (
                        <span className="absolute top-3 right-3 px-2.5 py-1 text-[11px] font-black rounded-full shadow-md z-10 bg-[#166534] text-white flex items-center gap-1 animate-in zoom-in">
                          <Check className="w-3 h-3 text-emerald-200" />
                          {inCartQty} in Bill
                        </span>
                      )}
                    </div>

                    <div className="px-2 pb-2">
                      <h3 className="text-[13px] font-bold text-gray-800 mb-1.5 truncate">
                        {product.name}
                      </h3>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-gray-900 text-[15px] font-extrabold">
                          Rs. {product.price.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(product);
                          }}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                            isInCart
                              ? 'bg-[#166534] text-white hover:bg-[#14532d]'
                              : 'bg-[#eff6ff] text-blue-600 hover:bg-blue-100'
                          }`}
                          title="Add item to bill"
                        >
                          <span className="text-[16px] leading-none font-bold mb-[1px]">+</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Floating Bill Summary & Quick Jump Bar */}
      {totalBillItems > 0 && setActiveTab && (
        <div className="fixed bottom-6 right-8 z-30 animate-in slide-in-from-bottom-5">
          <button
            type="button"
            onClick={() => setActiveTab('bill')}
            className="flex items-center gap-3.5 px-5 py-3.5 bg-[#103e2c] hover:bg-[#165a40] text-white rounded-2xl shadow-xl hover:shadow-2xl transition-all cursor-pointer group border border-emerald-600/40"
          >
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="text-left">
              <div className="text-[10px] text-emerald-200/80 font-bold uppercase tracking-wider">Current Bill</div>
              <div className="text-sm font-black flex items-center gap-2">
                <span>{totalBillItems} Item{totalBillItems > 1 ? 's' : ''}</span>
                <span className="text-emerald-400">•</span>
                <span className="text-emerald-200 font-extrabold">Rs. {totalBillAmount.toFixed(2)}</span>
              </div>
            </div>
            <div className="ml-2 pl-3 border-l border-white/20 flex items-center gap-1 text-xs font-bold text-emerald-200 group-hover:translate-x-1 transition-transform">
              <span>View Bill</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
