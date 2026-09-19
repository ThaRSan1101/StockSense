import { Role, BrandState } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { SeededRandom } from './deterministic-random.js';

export interface UserInput {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  phone: string;
  isActive: boolean;
}

export interface SupplierInput {
  id: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
}

export interface CategoryInput {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

export interface SubCategoryInput {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  isActive: boolean;
}

export interface BrandInput {
  id: string;
  name: string;
  description: string;
  state: BrandState;
}

export function generateMasterData(random: SeededRandom) {
  // Pre-generated password hash for 'Password123!' to speed up
  const passwordHash = bcrypt.hashSync('Password123!', 4);

  const users: UserInput[] = [
    {
      id: 'usr-admin-001',
      name: 'Tharsan Admin',
      email: 'admin@stocksense.lk',
      passwordHash,
      role: Role.ADMIN,
      phone: '0771112222',
      isActive: true,
    },
    {
      id: 'usr-manager-001',
      name: 'Nimal Inventory',
      email: 'manager@stocksense.lk',
      passwordHash,
      role: Role.INVENTORY_MANAGER,
      phone: '0773334444',
      isActive: true,
    },
    {
      id: 'usr-cashier-001',
      name: 'Fathima Cashier',
      email: 'cashier1@stocksense.lk',
      passwordHash,
      role: Role.CASHIER,
      phone: '0775556666',
      isActive: true,
    },
    {
      id: 'usr-cashier-002',
      name: 'Ravi Cashier',
      email: 'cashier2@stocksense.lk',
      passwordHash,
      role: Role.CASHIER,
      phone: '0777778888',
      isActive: true,
    },
  ];

  const suppliersRaw = [
    { name: 'Cargills Distributors', companyName: 'Cargills (Ceylon) PLC', email: 'dist@cargills.lk', phone: '0112300000', address: 'York Street, Colombo 01' },
    { name: 'Keells Logistics', companyName: 'John Keells Holdings', email: 'info@keellslogistics.lk', phone: '0112111111', address: 'Glenn Aber Place, Colombo 03' },
    { name: 'Ceylon Biscuits Supply', companyName: 'Ceylon Biscuits Limited', email: 'sales@munchee.lk', phone: '0112855555', address: 'High Level Road, Pannipitiya' },
    { name: 'Maliban Distributors', companyName: 'Maliban Biscuit Manufactories', email: 'supply@maliban.lk', phone: '0112738551', address: 'Galle Road, Ratmalana' },
    { name: 'Unilever Supply', companyName: 'Unilever Sri Lanka Ltd', email: 'customerservice@unilever.com', phone: '0112661000', address: 'Galle Road, Colombo 03' },
    { name: 'Nestle Distributors', companyName: 'Nestle Lanka PLC', email: 'sales@nestle.lk', phone: '0112699991', address: 'D.R. Wijewardene Mawatha, Colombo 10' },
    { name: 'Hemas Logistics', companyName: 'Hemas Holdings PLC', email: 'logistics@hemas.lk', phone: '0114731731', address: 'Braybrooke Place, Colombo 02' },
    { name: 'Harischandra Mills', companyName: 'Harischandra Mills PLC', email: 'info@harischandra.lk', phone: '0412222441', address: 'C.A. Harischandra Mawatha, Matara' },
    { name: 'Dilmah Tea Supply', companyName: 'Dilmah Ceylon Tea Company', email: 'info@dilmahtea.com', phone: '0114822000', address: 'Peliyagoda, Kelaniya' },
    { name: 'Wijeya Stationery', companyName: 'Wijeya Newspapers Ltd', email: 'stationery@wijeya.lk', phone: '0112479200', address: 'Hokandara Road, Hokandara' },
    { name: 'Richard Distributors', companyName: 'Richard Pieris & Co', email: 'arpico@richardpieris.com', phone: '0114310500', address: 'Hyde Park Corner, Colombo 02' },
    { name: 'Convenience Foods', companyName: 'Convenience Foods (Lanka) PLC', email: 'soya@cargills.lk', phone: '0112920251', address: 'Rathmalgoda, Polgahawela' },
    { name: 'Lanka Dairies', companyName: 'Lanka Dairies (Pvt) Ltd', email: 'ambewela@ldl.lk', phone: '0112865500', address: 'Welisara, Ragama' },
    { name: 'DSI Distributors', companyName: 'D. Samson & Sons (Pvt) Ltd', email: 'dsi@samson.lk', phone: '0112136200', address: 'High Level Road, Maharagama' },
    { name: 'Lanka Organics', companyName: 'Lanka Organics PLC', email: 'info@lankaorganics.lk', phone: '0112345678', address: 'Kandy Road, Yakkala' },
  ];

  const suppliers: SupplierInput[] = suppliersRaw.map((s, idx) => ({
    id: `sup-${(idx + 1).toString().padStart(3, '0')}`,
    ...s,
  }));

  const categoriesRaw = [
    { name: 'Grocery Essentials', description: 'Daily essential grocery items like rice, sugar, flour, oil' },
    { name: 'Dairy & Beverages', description: 'Milk powder, fresh milk, tea, coffee, soft drinks, juices' },
    { name: 'Snacks & Confectionery', description: 'Biscuits, chocolates, chips, local sweetmeats' },
    { name: 'Personal Care & Hygiene', description: 'Soaps, shampoos, toothpaste, sanitizers' },
    { name: 'Household & Cleaning', description: 'Detergents, cleaners, toilet rolls, garbage bags' },
    { name: 'Stationery & School', description: 'Exercise books, pens, pencils, folders, school supplies' },
    { name: 'Baking & Festival Special', description: 'Cake ingredients, icing sugar, yeast, dry fruits' },
    { name: 'Imported & Specialty', description: 'Premium items, imported sauces, canned food' },
    { name: 'Wellness & Health', description: 'Vitamins, health drinks, supplements' },
    { name: 'Home Accessories', description: 'Light bulbs, batteries, matches, small tools' },
    { name: 'Apparel & Wearables', description: 'Local slippers, socks, umbrellas' },
    { name: 'Fresh Fruits & Veg', description: 'Local farm-fresh items (non-perishables/packaged)' },
  ];

  const categories: CategoryInput[] = categoriesRaw.map((c, idx) => ({
    id: `cat-${(idx + 1).toString().padStart(3, '0')}`,
    name: c.name,
    description: c.description,
    isActive: true,
  }));

  const subCategoriesRaw = [
    { name: 'Rice & Grains', categoryName: 'Grocery Essentials', description: 'Samba, Keeri Samba, Red Rice' },
    { name: 'Sugar & Sweeteners', categoryName: 'Grocery Essentials', description: 'White sugar, brown sugar, jaggery' },
    { name: 'Cooking Oils & Fats', categoryName: 'Grocery Essentials', description: 'Coconut oil, vegetable oil, ghee' },
    { name: 'Flours & Powders', categoryName: 'Grocery Essentials', description: 'Wheat flour, rice flour, kurakkan flour' },
    { name: 'Milk Powders', categoryName: 'Dairy & Beverages', description: 'Anchor, Highland, Lakspray, Pelwatte' },
    { name: 'Teas & Coffees', categoryName: 'Dairy & Beverages', description: 'Dilmah, Watawala, Laufs Tea, Nescafe' },
    { name: 'Soft Drinks & Sodas', categoryName: 'Dairy & Beverages', description: 'Coca-cola, Fanta, Sprite, Elephant House' },
    { name: 'Fruit Juices', categoryName: 'Dairy & Beverages', description: 'Smak, Real, local fruit cordials' },
    { name: 'Sweet Biscuits', categoryName: 'Snacks & Confectionery', description: 'Munchee, Maliban chocolate/cream biscuits' },
    { name: 'Savoury Crackers', categoryName: 'Snacks & Confectionery', description: 'Cream crackers, cheese crackers' },
    { name: 'Chocolates & Candy', categoryName: 'Snacks & Confectionery', description: 'Kandos, Ritzbury, imported candy' },
    { name: 'Bath Soaps & Washes', categoryName: 'Personal Care & Hygiene', description: 'Lifebuoy, Lux, Velvet, Kohomba' },
    { name: 'Hair Care', categoryName: 'Personal Care & Hygiene', description: 'Sunsilk, Kumarika, Clinic Plus' },
    { name: 'Oral Care', categoryName: 'Personal Care & Hygiene', description: 'Clogard, Signal, Colgate' },
    { name: 'Laundry Detergents', categoryName: 'Household & Cleaning', description: 'Rin, Sunlight, Diva' },
    { name: 'Dishwashers', categoryName: 'Household & Cleaning', description: 'Vim bars and liquids' },
    { name: 'Exercise Books', categoryName: 'Stationery & School', description: 'Atlas, Richard exercise books' },
    { name: 'Writing Instruments', categoryName: 'Stationery & School', description: 'Pens, pencils, markers' },
    { name: 'Cake Ingredients', categoryName: 'Baking & Festival Special', description: 'Vanilla, baking powder, yeast, plums' },
    { name: 'Spices & Condiments', categoryName: 'Grocery Essentials', description: 'Chilli powder, turmeric, pepper' },
    { name: 'Sauces & Condiments', categoryName: 'Grocery Essentials', description: 'Tomato ketchup, chilli sauces, and dressings' },
    { name: 'Fresh Milk & Dairy', categoryName: 'Dairy & Beverages', description: 'Pasteurized fresh milk, yogurt, curd, and butter' },
    { name: 'Soya & Vegetarian', categoryName: 'Grocery Essentials', description: 'Lanka Soy, TVP products' },
    { name: 'Noodles & Pasta', categoryName: 'Grocery Essentials', description: 'Harischandra noodles, Prima noodles' },
    { name: 'Batteries & Bulbs', categoryName: 'Home Accessories', description: 'Panasonic batteries, Orange bulbs' },
    { name: 'Umbrellas & Rainwear', categoryName: 'Apparel & Wearables', description: 'Rainco umbrellas, local raincoats' },
    { name: 'Sanitary & Tissues', categoryName: 'Personal Care & Hygiene', description: 'Flora tissues, napkins' },
  ];

  const subCategories: SubCategoryInput[] = subCategoriesRaw.map((sc, idx) => {
    const parentCat = categories.find((c) => c.name === sc.categoryName);
    return {
      id: `subc-${(idx + 1).toString().padStart(3, '0')}`,
      name: sc.name,
      description: sc.description,
      categoryId: parentCat ? parentCat.id : categories[0].id,
      isActive: true,
    };
  });

  const brandsRaw = [
    { name: 'Munchee', description: 'CBL Brand' },
    { name: 'Maliban', description: 'Maliban Biscuit Brand' },
    { name: 'Anchor', description: 'Fonterra Dairy Brand' },
    { name: 'Highland', description: 'Milco Dairy Brand' },
    { name: 'Elephant House', description: 'EH Beverages and Ice Cream' },
    { name: 'Watawala', description: 'Watawala Tea' },
    { name: 'Dilmah', description: 'Premium Ceylon Tea' },
    { name: 'Sunlight', description: 'Unilever Soap & Laundry' },
    { name: 'Clogard', description: 'Hemas Oral Care' },
    { name: 'Signal', description: 'Unilever Oral Care' },
    { name: 'Atlas', description: 'Leading Stationery Brand' },
    { name: 'Harischandra', description: 'Local Spices & Noodles' },
    { name: 'Lanka Soy', description: 'Soy meat products' },
    { name: 'Prima', description: 'Flour & Noodles' },
    { name: 'Orange Electric', description: 'Electrical appliances and bulbs' },
    { name: 'Rainco', description: 'Umbrellas and rain gear' },
    { name: 'Flora', description: 'Tissues and paper products' },
    { name: 'Velvet', description: 'Hemas soap brand' },
    { name: 'Diva', description: 'Hemas laundry brand' },
    { name: 'Ritzbury', description: 'CBL Chocolates' },
    { name: 'Nestle', description: 'Nestle Lanka Dairy & Beverages' },
    { name: 'Pelwatte', description: 'Pelwatte Dairy & Sugar' },
    { name: 'Smak', description: 'Country Style Fruit Drinks' },
    { name: 'Sunsilk', description: 'Unilever Hair Care' },
    { name: 'Vim', description: 'Unilever Dishwash Brand' },
    { name: 'Ambewela', description: 'Lanka Milk Foods Fresh Dairy' },
    { name: 'Heinz', description: 'Kraft Heinz Sauces' },
    { name: 'Ferrero', description: 'Ferrero Hazelnut & Chocolate' },
    { name: 'Lanka Organics', description: 'Local Organic Essentials & Grains' },
  ];

  const brands: BrandInput[] = brandsRaw.map((b, idx) => ({
    id: `br-${(idx + 1).toString().padStart(3, '0')}`,
    name: b.name,
    description: b.description,
    state: BrandState.ACTIVE,
  }));

  return {
    users,
    suppliers,
    categories,
    subCategories,
    brands,
  };
}
