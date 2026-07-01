import React from 'react';
import { Search } from 'lucide-react';
import CategoryMarquee from '../../../components/shared/CategoryMarquee/CategoryMarquee';

interface ProductsTabProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  selectedCategory: string | null;
  setSelectedCategory: React.Dispatch<React.SetStateAction<string | null>>;
  loading: boolean;
  filteredProducts: any[];
  addToCart: (product: any, qty?: number) => void;
}

export const ProductsTab: React.FC<ProductsTabProps> = ({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  loading,
  filteredProducts,
  addToCart
}) => {
  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
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

      <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9fc] relative">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-[28px] md:text-[36px] font-extrabold text-[#111827] leading-tight tracking-tight">
                Shop by Categories
              </h1>
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-xs font-bold text-[#166534] hover:underline px-3 py-1.5 bg-[#dcfce7] rounded-lg transition-colors border border-green-200"
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
              filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white rounded-[20px] p-3 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-100 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all duration-300 group cursor-pointer"
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
                  </div>

                  <div className="px-2 pb-2">
                    <h3 className="text-[13px] font-bold text-gray-800 mb-1.5 truncate">
                      {product.name}
                    </h3>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-gray-600 text-[15px] font-semibold">Rs. {product.price.toFixed(2)}
                      </span>
                      <button className="w-7 h-7 rounded-full bg-[#eff6ff] text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors">
                        <span className="text-[16px] leading-none font-medium mb-[1px]">+</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
