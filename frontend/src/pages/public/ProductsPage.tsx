import CategoryMarquee from '../../components/shared/CategoryMarquee/CategoryMarquee';
export default function ProductsPage() {

  const products = [
    {
      id: 1,
      name: 'Midnight Velvet Roast',
      price: 'Rs. 24.99',
      badge: 'Limited',
      badgeClass: 'bg-[#1b4332] text-white',
      image: 'https://images.unsplash.com/photo-1559525839-b184a4d698c7?q=80&w=600&auto=format&fit=crop'
    },
    {
      id: 2,
      name: 'Golden Maple Granola',
      price: 'Rs. 14.50',
      image: 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?q=80&w=600&auto=format&fit=crop'
    },
    {
      id: 3,
      name: 'Pure Alpine Sparkling',
      price: 'Rs. 8.95',
      image: 'https://images.unsplash.com/photo-1559553156-2e97137af16f?q=80&w=600&auto=format&fit=crop'
    },
    {
      id: 4,
      name: 'Botanical Defense',
      price: 'Rs. 22.00',
      image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?q=80&w=600&auto=format&fit=crop'
    },
    {
      id: 5,
      name: 'Artisan Sourdough',
      price: 'Rs. 6.50',
      image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=600&auto=format&fit=crop'
    },
    {
      id: 6,
      name: 'Cold Brew Conc.',
      price: 'Rs. 12.00',
      badge: 'Special',
      badgeClass: 'bg-[#ffe4e6] text-[#be123c]',
      image: 'https://images.unsplash.com/photo-1611162458324-aae1eb4129a4?q=80&w=600&auto=format&fit=crop'
    },
    {
      id: 7,
      name: 'Organic Honey',
      price: 'Rs. 9.00',
      image: 'https://images.unsplash.com/photo-1664273586932-ab870d61f7e9?q=80&w=600&auto=format&fit=crop'
    },
    {
      id: 8,
      name: 'Handcrafted Sea Salt',
      price: 'Rs. 14.00',
      image: 'https://images.unsplash.com/photo-1507048331197-7d4ac70811cf?q=80&w=600&auto=format&fit=crop'
    },
    {
      id: 9,
      name: 'Artisanal Cocoa Cru',
      price: 'Rs. 14.00',
      image: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?q=80&w=600&auto=format&fit=crop'
    },
    {
      id: 10,
      name: 'Premium Green Tea',
      price: 'Rs. 18.50',
      image: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?q=80&w=600&auto=format&fit=crop'
    },
    {
      id: 11,
      name: 'Handcrafted Terra Mug',
      price: 'Rs. 26.00',
      image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?q=80&w=600&auto=format&fit=crop'
    },
    {
      id: 12,
      name: 'Small-Batch Olive Oil',
      price: 'Rs. 32.00',
      image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?q=80&w=600&auto=format&fit=crop'
    }
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fc] relative overflow-hidden font-sans">
      {/* Background Soft Glow */}
      <div className="absolute top-[-15%] left-[-5%] w-[600px] h-[600px] bg-teal-800/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 pt-16 pb-24 relative z-10">
        {/* Header Section */}
        <div className="mb-12">
          <h1 className="text-[36px] md:text-[44px] lg:text-[48px] font-extrabold text-[#111827] leading-tight mb-6 tracking-tight">
            Shop by Categories
          </h1>
          <CategoryMarquee />
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <div 
              key={product.id} 
              className="bg-white rounded-[20px] p-3 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-100 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all duration-300 group cursor-pointer"
            >
              {/* Image Container */}
              <div className="bg-[#f4f6f8] rounded-[14px] h-48 relative overflow-hidden mb-4">
                <img 
                  src={product.image} 
                  alt={product.name} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                
                {/* Badge */}
                {product.badge && (
                  <span className={`absolute top-3 left-3 px-3 py-1 text-[10px] font-bold rounded-full shadow-sm z-10 ${product.badgeClass}`}>
                    {product.badge}
                  </span>
                )}
              </div>

              {/* Product Info */}
              <div className="px-2 pb-2">
                <h3 className="text-[13px] font-bold text-gray-800 mb-1.5 truncate">
                  {product.name}
                </h3>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-gray-600 text-[15px] font-semibold">
                    {product.price}
                  </span>
                  <button className="w-7 h-7 rounded-full bg-[#eff6ff] text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors">
                    <span className="text-[16px] leading-none font-medium mb-[1px]">+</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
