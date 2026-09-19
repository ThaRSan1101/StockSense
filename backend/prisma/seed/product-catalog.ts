import { ProductStatus } from '@prisma/client';
import { SeededRandom } from './deterministic-random.js';
import { DemandProfileType } from './product-demand-profiles.js';

export interface ProductCatalogItem {
  sku: string;
  name: string;
  masterId: string;
  barcode: string;
  subCategoryId: string;
  brandId: string;
  supplierId: string;
  unitType: string;
  costPrice: number;
  sellingPrice: number;
  reorderLevel: number;
  targetCapacity: number;
  status: ProductStatus;
  demandProfile: DemandProfileType;
  seasonal: string | null;
  launchDate: Date;
  discontinuationDate: Date | null;
  shelfLifeDays?: number;
  imageUrl: string;
}

/**
 * Deterministic, domain-coherent supplier routing by brand.
 */
function getSupplierForBrand(
  brandName: string,
  suppliers: { id: string; name: string }[]
): { id: string; name: string } {
  const brandToSupplierMap: Record<string, string> = {
    'Nestle': 'Nestle Distributors',
    'Anchor': 'Lanka Dairies',
    'Highland': 'Lanka Dairies',
    'Ambewela': 'Lanka Dairies',
    'Pelwatte': 'Lanka Dairies',
    'Munchee': 'Ceylon Biscuits Supply',
    'Ritzbury': 'Ceylon Biscuits Supply',
    'Maliban': 'Maliban Distributors',
    'Sunlight': 'Unilever Supply',
    'Sunsilk': 'Unilever Supply',
    'Vim': 'Unilever Supply',
    'Signal': 'Unilever Supply',
    'Atlas': 'Wijeya Stationery',
    'Richard': 'Wijeya Stationery',
    'Flora': 'Wijeya Stationery',
    'Harischandra': 'Harischandra Mills',
    'Lanka Soy': 'Convenience Foods',
    'Dilmah': 'Dilmah Tea Supply',
    'Watawala': 'Dilmah Tea Supply',
    'Prima': 'Cargills Distributors',
    'Elephant House': 'Keells Logistics',
    'Smak': 'Keells Logistics',
    'Clogard': 'Hemas Logistics',
    'Velvet': 'Hemas Logistics',
    'Diva': 'Hemas Logistics',
    'Orange Electric': 'Richard Distributors',
    'Rainco': 'DSI Distributors',
    'Heinz': 'Keells Logistics',
    'Ferrero': 'Keells Logistics',
    'Lanka Organics': 'Lanka Organics',
  };

  const targetSupplierName = brandToSupplierMap[brandName] || 'Cargills Distributors';
  const matched = suppliers.find((s) => s.name === targetSupplierName);
  return matched || suppliers[0];
}

export function generateProductCatalog(
  random: SeededRandom,
  categories: { id: string; name: string }[],
  subCategories: { id: string; name: string; categoryId: string }[],
  brands: { id: string; name: string }[],
  suppliers: { id: string; name: string }[],
  activeCount: number,
  inactiveCount: number
): { products: ProductCatalogItem[]; masterClasses: any[] } {
  
  // Base master list of Sri Lankan grocery products (Exactly aligned 40 presentation SKUs)
  const productTemplates = [
    // 1. Grocery Essentials - Rice & Grains
    {
      name: 'Keeri Samba Rice',
      sub: 'Rice & Grains',
      brand: 'Lanka Organics',
      unit: 'Kg',
      cost: 240,
      markup: 1.15,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 500,
      reorder: 100,
      shelfLife: 365,
      imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'White Raw Rice',
      sub: 'Rice & Grains',
      brand: 'Lanka Organics',
      unit: 'Kg',
      cost: 210,
      markup: 1.12,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 600,
      reorder: 120,
      shelfLife: 365,
      imageUrl: 'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Red Raw Rice',
      sub: 'Rice & Grains',
      brand: 'Harischandra',
      unit: 'Kg',
      cost: 220,
      markup: 1.12,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 400,
      reorder: 80,
      shelfLife: 365,
      imageUrl: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=500&auto=format&fit=crop&q=80',
    },

    // 2. Grocery Essentials - Sugar & Sweeteners
    {
      name: 'White Sugar',
      sub: 'Sugar & Sweeteners',
      brand: 'Pelwatte',
      unit: 'Kg',
      cost: 260,
      markup: 1.10,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 800,
      reorder: 150,
      shelfLife: 730,
      imageUrl: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Brown Sugar',
      sub: 'Sugar & Sweeteners',
      brand: 'Lanka Organics',
      unit: 'Kg',
      cost: 320,
      markup: 1.15,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 300,
      reorder: 60,
      shelfLife: 730,
      imageUrl: 'https://images.unsplash.com/photo-1622484212850-cab596d66e0d?w=500&auto=format&fit=crop&q=80',
    },

    // 3. Grocery Essentials - Flours & Powders
    {
      name: 'Prima Wheat Flour',
      sub: 'Flours & Powders',
      brand: 'Prima',
      unit: 'Kg',
      cost: 180,
      markup: 1.10,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 500,
      reorder: 100,
      shelfLife: 180,
      imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Harischandra Rice Flour',
      sub: 'Flours & Powders',
      brand: 'Harischandra',
      unit: 'Pkt',
      cost: 140,
      markup: 1.15,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 200,
      reorder: 50,
      shelfLife: 180,
      imageUrl: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=500&auto=format&fit=crop&q=80',
    },

    // 4. Grocery Essentials - Cooking Oils & Fats
    {
      name: 'Coconut Oil 1L',
      sub: 'Cooking Oils & Fats',
      brand: 'Lanka Organics',
      unit: 'Bottle',
      cost: 650,
      markup: 1.15,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 150,
      reorder: 30,
      shelfLife: 730,
      imageUrl: 'https://images.unsplash.com/photo-1620706857370-e1b9770e8bb1?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Vegetable Oil 1L',
      sub: 'Cooking Oils & Fats',
      brand: 'Prima',
      unit: 'Bottle',
      cost: 580,
      markup: 1.12,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 150,
      reorder: 30,
      shelfLife: 365,
      imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=80',
    },

    // 5. Grocery Essentials - Sauces & Condiments
    {
      name: 'Heinz Tomato Ketchup Premium',
      sub: 'Sauces & Condiments',
      brand: 'Heinz',
      unit: 'Bottle',
      cost: 1100,
      markup: 1.30,
      profile: DemandProfileType.INTERMITTENT,
      cap: 25,
      reorder: 6,
      shelfLife: 365,
      imageUrl: 'https://images.unsplash.com/photo-1607532941433-304659e8198a?w=500&auto=format&fit=crop&q=80',
    },

    // 6. Grocery Essentials - Soya & Noodles
    {
      name: 'Lanka Soy Chicken Flavor 90g',
      sub: 'Soya & Vegetarian',
      brand: 'Lanka Soy',
      unit: 'Pkt',
      cost: 110,
      markup: 1.15,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 300,
      reorder: 60,
      shelfLife: 180,
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Harischandra Instant Noodles 350g',
      sub: 'Noodles & Pasta',
      brand: 'Harischandra',
      unit: 'Pkt',
      cost: 280,
      markup: 1.15,
      profile: DemandProfileType.FAST_GROWING,
      cap: 200,
      reorder: 50,
      shelfLife: 180,
      imageUrl: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Prima Special Noodles 350g',
      sub: 'Noodles & Pasta',
      brand: 'Prima',
      unit: 'Pkt',
      cost: 290,
      markup: 1.15,
      profile: DemandProfileType.FAST_GROWING,
      cap: 250,
      reorder: 60,
      shelfLife: 180,
      imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&auto=format&fit=crop&q=80',
    },

    // 7. Dairy & Beverages - Milk Powders
    {
      name: 'Anchor Milk Powder 400g',
      sub: 'Milk Powders',
      brand: 'Anchor',
      unit: 'Pkt',
      cost: 1050,
      markup: 1.08,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 300,
      reorder: 75,
      shelfLife: 365,
      imageUrl: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Highland Milk Powder 400g',
      sub: 'Milk Powders',
      brand: 'Highland',
      unit: 'Pkt',
      cost: 980,
      markup: 1.07,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 300,
      reorder: 75,
      shelfLife: 365,
      imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Pelwatte Milk Powder 400g',
      sub: 'Milk Powders',
      brand: 'Pelwatte',
      unit: 'Pkt',
      cost: 950,
      markup: 1.07,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 200,
      reorder: 50,
      shelfLife: 365,
      imageUrl: 'https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?w=500&auto=format&fit=crop&q=80',
    },

    // 8. Dairy & Beverages - Fresh Milk & Dairy (Short Shelf Life)
    {
      name: 'Fresh Milk 1L Tetra',
      sub: 'Fresh Milk & Dairy',
      brand: 'Highland',
      unit: 'Pkt',
      cost: 450,
      markup: 1.12,
      profile: DemandProfileType.EXPIRY_SENSITIVE,
      cap: 80,
      reorder: 20,
      shelfLife: 60,
      imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Ambewela Fresh Yogurt 80g',
      sub: 'Fresh Milk & Dairy',
      brand: 'Ambewela',
      unit: 'Cup',
      cost: 80,
      markup: 1.15,
      profile: DemandProfileType.EXPIRY_SENSITIVE,
      cap: 150,
      reorder: 40,
      shelfLife: 21,
      imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Highland Salted Butter 200g',
      sub: 'Fresh Milk & Dairy',
      brand: 'Highland',
      unit: 'Pcs',
      cost: 720,
      markup: 1.12,
      profile: DemandProfileType.EXPIRY_SENSITIVE,
      cap: 80,
      reorder: 20,
      shelfLife: 90,
      imageUrl: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=500&auto=format&fit=crop&q=80',
    },

    // 9. Dairy & Beverages - Teas & Coffees
    {
      name: 'Watawala Kahata Tea 200g',
      sub: 'Teas & Coffees',
      brand: 'Watawala',
      unit: 'Pkt',
      cost: 380,
      markup: 1.15,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 150,
      reorder: 40,
      shelfLife: 730,
      imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Dilmah Premium Tea 200g',
      sub: 'Teas & Coffees',
      brand: 'Dilmah',
      unit: 'Pkt',
      cost: 550,
      markup: 1.20,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 100,
      reorder: 25,
      shelfLife: 730,
      imageUrl: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Nescafe Classic 50g',
      sub: 'Teas & Coffees',
      brand: 'Nestle',
      unit: 'Jar',
      cost: 720,
      markup: 1.18,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 80,
      reorder: 20,
      shelfLife: 730,
      imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80',
    },

    // 10. Dairy & Beverages - Soft Drinks & Fruit Juices
    {
      name: 'Coca-Cola 1.5L',
      sub: 'Soft Drinks & Sodas',
      brand: 'Elephant House',
      unit: 'Bottle',
      cost: 310,
      markup: 1.15,
      profile: DemandProfileType.WEEKEND_SENSITIVE,
      cap: 200,
      reorder: 50,
      shelfLife: 180,
      imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Sprite 1.5L',
      sub: 'Soft Drinks & Sodas',
      brand: 'Elephant House',
      unit: 'Bottle',
      cost: 310,
      markup: 1.15,
      profile: DemandProfileType.WEEKEND_SENSITIVE,
      cap: 150,
      reorder: 40,
      shelfLife: 180,
      imageUrl: 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'E/House Ginger Beer 1.5L',
      sub: 'Soft Drinks & Sodas',
      brand: 'Elephant House',
      unit: 'Bottle',
      cost: 300,
      markup: 1.15,
      profile: DemandProfileType.WEEKEND_SENSITIVE,
      cap: 250,
      reorder: 60,
      shelfLife: 180,
      imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Smak Mango Juice 200ml',
      sub: 'Fruit Juices',
      brand: 'Smak',
      unit: 'Pkt',
      cost: 70,
      markup: 1.20,
      profile: DemandProfileType.WEEKEND_SENSITIVE,
      cap: 400,
      reorder: 100,
      shelfLife: 270,
      imageUrl: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=500&auto=format&fit=crop&q=80',
    },

    // 11. Snacks & Confectionery - Biscuits & Crackers
    {
      name: 'Munchee Cream Cracker 190g',
      sub: 'Savoury Crackers',
      brand: 'Munchee',
      unit: 'Pkt',
      cost: 170,
      markup: 1.12,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 400,
      reorder: 80,
      shelfLife: 240,
      imageUrl: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Maliban Lemon Puff 200g',
      sub: 'Sweet Biscuits',
      brand: 'Maliban',
      unit: 'Pkt',
      cost: 180,
      markup: 1.12,
      profile: DemandProfileType.WEEKEND_SENSITIVE,
      cap: 300,
      reorder: 60,
      shelfLife: 240,
      imageUrl: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Maliban Ginger Biscuits 200g',
      sub: 'Sweet Biscuits',
      brand: 'Maliban',
      unit: 'Pkt',
      cost: 160,
      markup: 1.12,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 250,
      reorder: 50,
      shelfLife: 240,
      imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Munchee Chocolate Biscuits 200g',
      sub: 'Sweet Biscuits',
      brand: 'Munchee',
      unit: 'Pkt',
      cost: 220,
      markup: 1.15,
      profile: DemandProfileType.DISCOUNT_SENSITIVE,
      cap: 200,
      reorder: 50,
      shelfLife: 240,
      imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&auto=format&fit=crop&q=80',
    },

    // 12. Snacks & Confectionery - Chocolates & Spreads
    {
      name: 'Ritzbury Milk Chocolate 50g',
      sub: 'Chocolates & Candy',
      brand: 'Ritzbury',
      unit: 'Bar',
      cost: 150,
      markup: 1.20,
      profile: DemandProfileType.DISCOUNT_SENSITIVE,
      cap: 150,
      reorder: 30,
      shelfLife: 365,
      imageUrl: 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Nutella Hazelnut Spread 350g',
      sub: 'Chocolates & Candy',
      brand: 'Ferrero',
      unit: 'Jar',
      cost: 2400,
      markup: 1.25,
      profile: DemandProfileType.INTERMITTENT,
      cap: 15,
      reorder: 4,
      shelfLife: 365,
      imageUrl: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=500&auto=format&fit=crop&q=80',
    },

    // 13. Personal Care & Hygiene
    {
      name: 'Sunlight Soap 120g',
      sub: 'Bath Soaps & Washes',
      brand: 'Sunlight',
      unit: 'Bar',
      cost: 95,
      markup: 1.10,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 400,
      reorder: 80,
      shelfLife: 1095,
      imageUrl: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Sunsilk Shampoo 180ml',
      sub: 'Hair Care',
      brand: 'Sunsilk',
      unit: 'Bottle',
      cost: 380,
      markup: 1.15,
      profile: DemandProfileType.DISCOUNT_SENSITIVE,
      cap: 100,
      reorder: 20,
      shelfLife: 1095,
      imageUrl: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Signal Strong Teeth 120g',
      sub: 'Oral Care',
      brand: 'Signal',
      unit: 'Pkt',
      cost: 240,
      markup: 1.12,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 200,
      reorder: 40,
      shelfLife: 1095,
      imageUrl: 'https://images.unsplash.com/photo-1559591937-e1069df77054?w=500&auto=format&fit=crop&q=80',
    },

    // 14. Household & Cleaning
    {
      name: 'Vim Dishwash Bar 100g',
      sub: 'Dishwashers',
      brand: 'Vim',
      unit: 'Bar',
      cost: 65,
      markup: 1.10,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 400,
      reorder: 80,
      shelfLife: 1095,
      imageUrl: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Sunlight Detergent Powder 1Kg',
      sub: 'Laundry Detergents',
      brand: 'Sunlight',
      unit: 'Pkt',
      cost: 550,
      markup: 1.12,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 150,
      reorder: 30,
      shelfLife: 1095,
      imageUrl: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=500&auto=format&fit=crop&q=80',
    },

    // 15. Stationery & Seasonal School
    {
      name: 'Atlas CR Book 80 pgs',
      sub: 'Exercise Books',
      brand: 'Atlas',
      unit: 'Book',
      cost: 120,
      markup: 1.25,
      profile: DemandProfileType.HIGHLY_SEASONAL,
      cap: 1000,
      reorder: 200,
      seasonal: 'SCHOOL_JAN',
      shelfLife: 1825,
      imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Atlas Blue Gel Pen',
      sub: 'Writing Instruments',
      brand: 'Atlas',
      unit: 'Pcs',
      cost: 35,
      markup: 1.30,
      profile: DemandProfileType.HIGHLY_SEASONAL,
      cap: 2000,
      reorder: 300,
      seasonal: 'SCHOOL_JAN',
      shelfLife: 1095,
      imageUrl: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=500&auto=format&fit=crop&q=80',
    },

    // 16. Baking & Festival Special
    {
      name: 'Cake Vanilla Essence 20ml',
      sub: 'Cake Ingredients',
      brand: 'Harischandra',
      unit: 'Bottle',
      cost: 180,
      markup: 1.25,
      profile: DemandProfileType.HIGHLY_SEASONAL,
      cap: 200,
      reorder: 45,
      seasonal: 'FESTIVAL_DEC',
      shelfLife: 730,
      imageUrl: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=500&auto=format&fit=crop&q=80',
    },

    // --- Extra templates (Used if count > 40 in full mode) ---
    {
      name: 'Orange 9W LED Bulb',
      sub: 'Batteries & Bulbs',
      brand: 'Orange Electric',
      unit: 'Pcs',
      cost: 420,
      markup: 1.25,
      profile: DemandProfileType.SLOW_DECLINING,
      cap: 100,
      reorder: 20,
      shelfLife: 1095,
      imageUrl: 'https://images.unsplash.com/photo-1550985616-10810253b84d?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Rainco Classic Umbrella',
      sub: 'Umbrellas & Rainwear',
      brand: 'Rainco',
      unit: 'Pcs',
      cost: 1250,
      markup: 1.30,
      profile: DemandProfileType.HIGHLY_SEASONAL,
      cap: 100,
      reorder: 20,
      seasonal: 'RAINY_MAY_OCT',
      shelfLife: 1825,
      imageUrl: 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Flora Pocket Tissues x4',
      sub: 'Sanitary & Tissues',
      brand: 'Flora',
      unit: 'Pkt',
      cost: 180,
      markup: 1.20,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 150,
      reorder: 35,
      shelfLife: 1095,
      imageUrl: 'https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Clogard Toothpaste 120g',
      sub: 'Oral Care',
      brand: 'Clogard',
      unit: 'Pkt',
      cost: 230,
      markup: 1.12,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 200,
      reorder: 40,
      shelfLife: 1095,
      imageUrl: 'https://images.unsplash.com/photo-1528740561666-dc2479dc08ab?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Diva Detergent Powder 1Kg',
      sub: 'Laundry Detergents',
      brand: 'Diva',
      unit: 'Pkt',
      cost: 480,
      markup: 1.10,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 150,
      reorder: 30,
      shelfLife: 1095,
      imageUrl: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Kandos Milk Chocolate 100g',
      sub: 'Chocolates & Candy',
      brand: 'Ritzbury',
      unit: 'Bar',
      cost: 320,
      markup: 1.20,
      profile: DemandProfileType.DISCOUNT_SENSITIVE,
      cap: 100,
      reorder: 25,
      shelfLife: 365,
      imageUrl: 'https://images.unsplash.com/photo-1548907040-4baa42d10919?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Lifebuoy Total 100g',
      sub: 'Bath Soaps & Washes',
      brand: 'Sunlight',
      unit: 'Bar',
      cost: 110,
      markup: 1.12,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 300,
      reorder: 60,
      shelfLife: 1095,
      imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Velvet Rose & Milk 100g',
      sub: 'Bath Soaps & Washes',
      brand: 'Velvet',
      unit: 'Bar',
      cost: 120,
      markup: 1.12,
      profile: DemandProfileType.STABLE_ESSENTIAL,
      cap: 250,
      reorder: 50,
      shelfLife: 1095,
      imageUrl: 'https://images.unsplash.com/photo-1607006314181-420a7b453e19?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Baking Powder 100g',
      sub: 'Cake Ingredients',
      brand: 'Maliban',
      unit: 'Pkt',
      cost: 120,
      markup: 1.20,
      profile: DemandProfileType.HIGHLY_SEASONAL,
      cap: 150,
      reorder: 30,
      seasonal: 'FESTIVAL_DEC',
      shelfLife: 365,
      imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'E/House Cream Soda 1.5L',
      sub: 'Soft Drinks & Sodas',
      brand: 'Elephant House',
      unit: 'Bottle',
      cost: 290,
      markup: 1.15,
      profile: DemandProfileType.WEEKEND_SENSITIVE,
      cap: 300,
      reorder: 80,
      shelfLife: 180,
      imageUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500&auto=format&fit=crop&q=80',
    },
  ];

  const products: ProductCatalogItem[] = [];
  const masterClasses: any[] = [];
  const masterClassMap = new Map<string, string>(); // key: subCategoryId-brandId-supplierId -> masterClassId

  // Determine target counts
  const totalWanted = activeCount + inactiveCount;
  
  for (let i = 0; i < totalWanted; i++) {
    const tmpl = productTemplates[i % productTemplates.length];
    
    // Add uniqueness if repeating templates
    const suffix = i >= productTemplates.length ? ` V${Math.floor(i / productTemplates.length)}` : '';
    const name = tmpl.name + suffix;

    // Resolve IDs
    const subCat = subCategories.find((s) => s.name === tmpl.sub) || subCategories[0];
    const brand = brands.find((b) => b.name === tmpl.brand) || brands[0];
    
    // Deterministic, domain-coherent supplier routing
    const supplier = getSupplierForBrand(brand.name, suppliers);

    // Master Product Class lookup or create
    const mcKey = `${subCat.id}-${brand.id}-${supplier.id}`;
    let mcId = masterClassMap.get(mcKey);
    if (!mcId) {
      mcId = `mc-${(masterClassMap.size + 1).toString().padStart(3, '0')}`;
      masterClassMap.set(mcKey, mcId);
      masterClasses.push({
        id: mcId,
        name: `${brand.name} ${subCat.name} Class`,
        categoryId: subCat.categoryId,
        subCategoryId: subCat.id,
        brandId: brand.id,
        supplierId: supplier.id,
        hasVariant: false,
        createdAt: new Date('2022-01-01T00:00:00Z'),
      });
    }

    // SKU Generation
    const cleanBrand = brand.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
    const cleanProd = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
    const sku = `${cleanBrand}-${cleanProd}-${tmpl.unit.toUpperCase()}-${i.toString().padStart(4, '0')}`;

    // Barcode Generation (deterministic based on index)
    const baseBarcode = (479100000000 + i).toString();
    let barcodeSum = 0;
    for (let c = 0; c < 12; c++) {
      barcodeSum += parseInt(baseBarcode[c]) * (c % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (barcodeSum % 10)) % 10;
    const barcode = `${baseBarcode}${checkDigit}`;

    // Launch date and Status logic
    let status: ProductStatus = ProductStatus.ACTIVE;
    let launchDate = new Date('2022-12-01T00:00:00Z'); // default launched before simulation start
    let discontinuationDate: Date | null = null;
    let profile = tmpl.profile;

    if (i >= activeCount) {
      // These are inactive or discontinued
      const isDiscontinued = i % 2 === 0;
      status = isDiscontinued ? ProductStatus.DISCONTINUED : ProductStatus.INACTIVE;
      
      if (isDiscontinued) {
        // Discontinued halfway through simulation
        discontinuationDate = new Date('2024-06-30T00:00:00Z');
      } else {
        // Inactive since late 2024
        discontinuationDate = new Date('2024-11-15T00:00:00Z');
      }
    } else {
      // Active products
      // Introduce some "new products" launched in 2025 (limited history)
      if (profile === DemandProfileType.NEW_PRODUCT || (i % 10 === 0 && i > 0)) {
        profile = DemandProfileType.NEW_PRODUCT;
        // Deterministic launch date in 2025 (e.g. Feb 15, June 1, Oct 10)
        const launchMonths = [1, 5, 9]; // index 0 = Feb, 1 = June, 2 = Oct
        const chosenMonth = launchMonths[i % launchMonths.length];
        launchDate = new Date(Date.UTC(2025, chosenMonth, 15));
      }
    }

    products.push({
      sku,
      name,
      masterId: mcId,
      barcode,
      subCategoryId: subCat.id,
      brandId: brand.id,
      supplierId: supplier.id,
      unitType: tmpl.unit,
      costPrice: tmpl.cost,
      sellingPrice: Math.round(tmpl.cost * tmpl.markup),
      reorderLevel: tmpl.reorder,
      targetCapacity: tmpl.cap,
      status,
      demandProfile: profile,
      seasonal: tmpl.seasonal || null,
      launchDate,
      discontinuationDate,
      shelfLifeDays: tmpl.shelfLife,
      imageUrl: tmpl.imageUrl,
    });
  }

  return { products, masterClasses };
}
