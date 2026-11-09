import { prisma } from './src/config/prisma.js';

const categoryImages: Record<string, string> = {
  'Grocery Essentials': 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=600&auto=format&fit=crop',
  'Dairy & Beverages': 'https://images.unsplash.com/photo-1559553156-2e97137af16f?q=80&w=600&auto=format&fit=crop',
  'Snacks & Confectionery': 'https://images.unsplash.com/photo-1582228116348-73595b225547?q=80&w=600&auto=format&fit=crop',
  'Personal Care & Hygiene': 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?q=80&w=600&auto=format&fit=crop',
  'Household & Cleaning': 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?q=80&w=600&auto=format&fit=crop',
  'Stationery & School': 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?q=80&w=600&auto=format&fit=crop',
  'Baking & Festival Special': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=600&auto=format&fit=crop',
  'Imported & Specialty': 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=600&auto=format&fit=crop',
  'Wellness & Health': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=600&auto=format&fit=crop',
  'Home Accessories': 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?q=80&w=600&auto=format&fit=crop',
  'Apparel & Wearables': 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?q=80&w=600&auto=format&fit=crop',
  'Fresh Fruits & Veg': 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=600&auto=format&fit=crop',
};

const productSpecificImages: Record<string, string> = {
  'Keeri Samba Rice': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=80',
  'White Raw Rice': 'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?w=500&auto=format&fit=crop&q=80',
  'Red Raw Rice': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=500&auto=format&fit=crop&q=80',
  'White Sugar': 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=500&auto=format&fit=crop&q=80',
  'Brown Sugar': 'https://images.unsplash.com/photo-1622484212850-cab596d66e0d?w=500&auto=format&fit=crop&q=80',
  'Prima Wheat Flour': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=80',
  'Harischandra Rice Flour': 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=500&auto=format&fit=crop&q=80',
  'Coconut Oil 750ml': 'https://images.unsplash.com/photo-1620706857370-e1b9770e8bb1?w=500&auto=format&fit=crop&q=80',
  'Vegetable Oil 1L': 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=80',
  'MD Tomato Sauce 400g': 'https://images.unsplash.com/photo-1607532941433-304659e8198a?w=500&auto=format&fit=crop&q=80',
  'Lanka Soy Meat Curry 90g': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
  'Harischandra Instant Noodles 350g': 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500&auto=format&fit=crop&q=80',
  'Prima Special Noodles 350g': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&auto=format&fit=crop&q=80',
  'Anchor Milk Powder 400g': 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=500&auto=format&fit=crop&q=80',
  'Pelwatte Milk Powder 400g': 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=80',
  'Highland Full Cream Milk 1L': 'https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=500&auto=format&fit=crop&q=80',
  'Ambewela Fresh Milk 1L': 'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=500&auto=format&fit=crop&q=80',
  'Dilmah Premium Ceylon Tea 400g': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=80',
  'Watawala Kahata Tea 400g': 'https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=500&auto=format&fit=crop&q=80',
  'Nescafe Classic 50g': 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80',
  'Coca-Cola 1.5L': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80',
  'Sprite 1.5L': 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=500&auto=format&fit=crop&q=80',
  'E/House Cream Soda 1.5L': 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500&auto=format&fit=crop&q=80',
  'E/House Ginger Beer 1.5L': 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=500&auto=format&fit=crop&q=80',
  'Smak Mango Juice 200ml': 'https://images.unsplash.com/photo-1546173159-315724a31696?w=500&auto=format&fit=crop&q=80',
  'Smak Mixed Fruit Juice 200ml': 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&auto=format&fit=crop&q=80',
  'Munchee Super Cream Cracker 490g': 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=500&auto=format&fit=crop&q=80',
  'Maliban Lemon Puff 200g': 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=80',
  'Munchee Chocolate Puff 200g': 'https://images.unsplash.com/photo-1548907040-4baa42d10919?w=500&auto=format&fit=crop&q=80',
  'Ritzbury Revello Dark Chocolate 50g': 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&auto=format&fit=crop&q=80',
  'Sunlight Soap 120g': 'https://images.unsplash.com/photo-1607006314181-420a7b453e19?w=500&auto=format&fit=crop&q=80',
  'Lifebuoy Total Soap 100g': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
  'Signal Strong Teeth 120g': 'https://images.unsplash.com/photo-1528740561666-dc2479dc08ab?w=500&auto=format&fit=crop&q=80',
  'Sunsilk Black Shine Shampoo 180ml': 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=500&auto=format&fit=crop&q=80',
  'Sunlight Detergent Powder 1Kg': 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=500&auto=format&fit=crop&q=80',
  'Vim Dishwash Bar 500g': 'https://images.unsplash.com/photo-158542151284-efb74c2b69ba?w=500&auto=format&fit=crop&q=80',
  'Atlas CR Book 120 Pages': 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&auto=format&fit=crop&q=80',
  'Atlas Blue Gel Pen': 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=500&auto=format&fit=crop&q=80',
  'Baking Powder 100g': 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=500&auto=format&fit=crop&q=80',
};

async function updateDbImages() {
  console.log('Updating Categories with High-Quality Images...');
  const categories = await prisma.category.findMany();
  for (const cat of categories) {
    const img = categoryImages[cat.name] || 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=600&auto=format&fit=crop';
    await prisma.category.update({
      where: { id: cat.id },
      data: { categoryImageUrl: img }
    });
  }
  console.log(`Updated ${categories.length} categories.`);

  console.log('Updating Products with Curated Photos...');
  const products = await prisma.product.findMany({ include: { masterClass: { include: { category: true } } } });
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const catName = p.masterClass?.category?.name || 'Grocery Essentials';
    const specificImg = productSpecificImages[p.name];
    const fallbackImg = categoryImages[catName] || categoryImages['Grocery Essentials'];
    const img = specificImg || `${fallbackImg}&sig=${i}`;
    
    await prisma.product.update({
      where: { sku: p.sku },
      data: { imageUrl: img }
    });
  }
  console.log(`Updated ${products.length} products.`);
  console.log('Done!');
}

updateDbImages().finally(() => prisma.$disconnect());
