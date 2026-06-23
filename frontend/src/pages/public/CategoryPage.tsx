import { useParams, useNavigate } from 'react-router-dom';
import CategoryMarquee from '../../components/shared/CategoryMarquee/CategoryMarquee';

export default function CategoryPage() {
  const { categoryId } = useParams();
  const navigate = useNavigate();

  // Format category name for display (e.g., 'dairy-products' -> 'Dairy Products')
  const title = categoryId 
    ? categoryId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    : 'Category';

  // Helper to generate dynamic mock data based on the category route
  const getProductsByCategory = (categorySlug: string) => {
    switch (categorySlug) {
      case 'beverages':
        return [
          { id: 1, name: 'Cold Pressed Orange Juice', price: 'Rs. 5.99', image: 'https://images.unsplash.com/photo-1622597467836-f382490d3d52?q=80&w=600&auto=format&fit=crop' },
          { id: 2, name: 'Sparkling Mineral Water', price: 'Rs. 2.50', image: 'https://images.unsplash.com/photo-1559553156-2e97137af16f?q=80&w=600&auto=format&fit=crop' },
          { id: 3, name: 'Organic Green Tea', price: 'Rs. 4.00', image: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?q=80&w=600&auto=format&fit=crop' },
          { id: 4, name: 'Artisan Kombucha', price: 'Rs. 6.50', image: 'https://images.unsplash.com/photo-1595180120863-87fbd52a5518?q=80&w=600&auto=format&fit=crop' },
        ];
      case 'snacks':
        return [
          { id: 1, name: 'Sea Salt Popcorn', price: 'Rs. 3.50', image: 'https://images.unsplash.com/photo-1572620786524-7eb3907eb641?q=80&w=600&auto=format&fit=crop' },
          { id: 2, name: 'Kettle Cooked Chips', price: 'Rs. 4.00', image: 'https://images.unsplash.com/photo-1566478989037-e924e50cb0c2?q=80&w=600&auto=format&fit=crop' },
          { id: 3, name: 'Mixed Roasted Nuts', price: 'Rs. 8.99', image: 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?q=80&w=600&auto=format&fit=crop' },
          { id: 4, name: 'Dark Chocolate Bar', price: 'Rs. 5.50', image: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?q=80&w=600&auto=format&fit=crop' },
        ];
      case 'dairy-products':
        return [
          { id: 1, name: 'Whole Milk 1 Gallon', price: 'Rs. 4.50', image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?q=80&w=600&auto=format&fit=crop' },
          { id: 2, name: 'Aged Cheddar Cheese', price: 'Rs. 7.00', image: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?q=80&w=600&auto=format&fit=crop' },
          { id: 3, name: 'Greek Yogurt Vanilla', price: 'Rs. 5.99', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=600&auto=format&fit=crop' },
          { id: 4, name: 'Farm Fresh Butter', price: 'Rs. 6.50', image: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?q=80&w=600&auto=format&fit=crop' },
        ];
      case 'fruits-vegetables':
        return [
          { id: 1, name: 'Organic Hass Avocados', price: 'Rs. 4.99', image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?q=80&w=600&auto=format&fit=crop' },
          { id: 2, name: 'Fresh Strawberries', price: 'Rs. 3.99', image: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?q=80&w=600&auto=format&fit=crop' },
          { id: 3, name: 'Crisp Romaine Lettuce', price: 'Rs. 2.50', image: 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?q=80&w=600&auto=format&fit=crop' },
          { id: 4, name: 'Heirloom Tomatoes', price: 'Rs. 5.00', image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?q=80&w=600&auto=format&fit=crop' },
        ];
      case 'bakery-items':
        return [
          { id: 1, name: 'Artisan Sourdough', price: 'Rs. 6.50', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=600&auto=format&fit=crop' },
          { id: 2, name: 'Butter Croissants', price: 'Rs. 4.99', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=600&auto=format&fit=crop' },
          { id: 3, name: 'Blueberry Muffins', price: 'Rs. 5.50', image: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?q=80&w=600&auto=format&fit=crop' },
          { id: 4, name: 'French Baguette', price: 'Rs. 3.00', image: 'https://images.unsplash.com/photo-1597079910443-60c43fc4f729?q=80&w=600&auto=format&fit=crop' },
        ];
      default:
        // Generic fallback for any other category
        return [
          { id: 1, name: `Premium ${title} Item 1`, price: 'Rs. 12.99', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=600&auto=format&fit=crop' },
          { id: 2, name: `Organic ${title} Selection`, price: 'Rs. 8.50', image: 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?q=80&w=600&auto=format&fit=crop' },
          { id: 3, name: `Classic ${title} Variant`, price: 'Rs. 15.00', image: 'https://images.unsplash.com/photo-1559553156-2e97137af16f?q=80&w=600&auto=format&fit=crop' },
          { id: 4, name: `Artisan ${title} Pack`, price: 'Rs. 22.00', image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?q=80&w=600&auto=format&fit=crop' }
        ];
    }
  };

  const products = getProductsByCategory(categoryId || '');

  return (
    <div className="min-h-screen bg-[#f8f9fc] relative overflow-hidden font-sans">
      <div className="absolute top-[-15%] left-[-5%] w-[600px] h-[600px] bg-teal-800/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 pt-16 pb-24 relative z-10">
        
        {/* Header Section */}
        <div className="mb-12">
          <button 
            onClick={() => navigate('/products')}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-6 transition-colors font-medium text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            All Categories
          </button>
          
          <h1 className="text-[36px] md:text-[44px] lg:text-[48px] font-extrabold text-[#111827] leading-tight mb-6 tracking-tight">
            {title}
          </h1>
          
          {/* Running Bar Marquee */}
          <CategoryMarquee />
        </div>

        {/* Product Grid (No Add Option) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <div 
              key={product.id} 
              className="bg-white rounded-[20px] p-3 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-100 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all duration-300 group cursor-default"
            >
              {/* Image Container */}
              <div className="bg-[#f4f6f8] rounded-[14px] h-48 relative overflow-hidden mb-4">
                <img 
                  src={product.image} 
                  alt={product.name} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>

              {/* Product Info */}
              <div className="px-2 pb-2">
                <h3 className="text-[13px] font-bold text-gray-800 mb-1.5 truncate">
                  {product.name}
                </h3>
                <div className="mt-1">
                  <span className="text-gray-600 text-[15px] font-semibold">
                    {product.price}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
