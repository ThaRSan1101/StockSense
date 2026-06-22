import 'dotenv/config';
import { PrismaClient, Role, BrandState, ProductStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
const SALES_START_DATE = new Date('2025-06-01T00:00:00Z');
const SALES_END_DATE   = new Date('2026-06-22T23:59:59Z');
const BASE_BILLS_PER_DAY = 15;
const STORE_OPEN_DATE  = new Date('2023-06-01T00:00:00Z');

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE CONNECTION
// ═══════════════════════════════════════════════════════════════════════════════
const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════
let barcodeSeq = 479100000000;
function generateBarcode(): string {
  barcodeSeq++;
  const base = barcodeSeq.toString();
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return `${base}${check}`;
}

function makeSku(brand: string, product: string, size: string, seq: number): string {
  const b = brand.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
  const p = product.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
  const s = size.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `${b}-${p}-${s}-${seq.toString().padStart(4, '0')}`;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function weightedRandom<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * High-performance batch INSERT using raw pg with support for PostgreSQL enum casts.
 * @param typeCasts  Map of column index → SQL type cast (e.g. { 6: '"PaymentMethod"' })
 */
async function batchInsert(
  p: Pool, table: string, columns: string[], rows: any[][],
  batchSize = 1000, typeCasts?: Record<number, string>
): Promise<void> {
  const colCount = columns.length;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values: any[] = [];
    const placeholders: string[] = [];
    batch.forEach((row, rowIdx) => {
      const rp = row.map((_, colIdx) => {
        const pi = rowIdx * colCount + colIdx + 1;
        const cast = typeCasts?.[colIdx];
        return cast ? `$${pi}::${cast}` : `$${pi}`;
      });
      placeholders.push(`(${rp.join(', ')})`);
      values.push(...row);
    });
    await p.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`, values);
  }
}

// Hour-of-day weights for realistic bill time distribution
const HOUR_WEIGHTS: [number, number][] = [
  [7,3],[8,8],[9,8],[10,4],[11,4],[12,6],[13,3],[14,3],[15,4],[16,4],[17,7],[18,8],[19,8],[20,2]
];
function pickBillHour(): number {
  const tw = HOUR_WEIGHTS.reduce((s,[_,w]) => s+w, 0);
  let r = Math.random() * tw;
  for (const [h,w] of HOUR_WEIGHTS) { r -= w; if (r <= 0) return h; }
  return 17;
}

// Sri Lankan seasonal sales multipliers by month (0=Jan)
const MONTH_MULT: Record<number,number> = {
  0:1.15, 1:1.0, 2:1.0, 3:1.35, 4:1.1, 5:0.95,
  6:0.95, 7:1.0, 8:1.05, 9:1.1, 10:1.1, 11:1.4
};
// Day-of-week multipliers (0=Sun)
const DOW_MULT = [0.85, 1.0, 1.0, 1.0, 1.05, 1.2, 1.25];

// ═══════════════════════════════════════════════════════════════════════════════
// IMAGE URLS (Unsplash — free, no auth required)
// ═══════════════════════════════════════════════════════════════════════════════
const IMG = {
  // Category hero images (800px wide)
  catGrocery:     'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&q=80',
  catBeverages:   'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&q=80',
  catSnacks:      'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=800&q=80',
  catPersonal:    'https://images.unsplash.com/photo-1556228720-195a672e68b0?w=800&q=80',
  catHousehold:   'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=800&q=80',
  catDairy:       'https://images.unsplash.com/photo-1628088062854-d1870b14eb09?w=800&q=80',
  catFrozen:      'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=800&q=80',
  catBaby:        'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=800&q=80',
  catBakery:      'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80',
  catLocal:       'https://images.unsplash.com/photo-1606756790138-261d2b21cd75?w=800&q=80',
  // Product images (400px crop)
  rice:       'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=400&fit=crop',
  dhal:       'https://images.unsplash.com/photo-1585011664466-b7bbe92f34ef?w=400&h=400&fit=crop',
  flour:      'https://images.unsplash.com/photo-1627485937980-221c8bc3e478?w=400&h=400&fit=crop',
  sugar:      'https://images.unsplash.com/photo-1550411294-098dc0204cb0?w=400&h=400&fit=crop',
  spices:     'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&h=400&fit=crop',
  oil:        'https://images.unsplash.com/photo-1474979266404-7eaacbcd87fe?w=400&h=400&fit=crop',
  tea:        'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400&h=400&fit=crop',
  coffee:     'https://images.unsplash.com/photo-1447933601403-56dc2a4ee5be?w=400&h=400&fit=crop',
  malt:       'https://images.unsplash.com/photo-1544252890-c9e39e8e8a5a?w=400&h=400&fit=crop',
  softDrink:  'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=400&h=400&fit=crop',
  juice:      'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=400&h=400&fit=crop',
  water:      'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&h=400&fit=crop',
  biscuit:    'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&h=400&fit=crop',
  chocolate:  'https://images.unsplash.com/photo-1481391319762-47dff72954d9?w=400&h=400&fit=crop',
  chips:      'https://images.unsplash.com/photo-1621447504864-d8686e12698c?w=400&h=400&fit=crop',
  shampoo:    'https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?w=400&h=400&fit=crop',
  soap:       'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=400&h=400&fit=crop',
  toothpaste: 'https://images.unsplash.com/photo-1609840114035-3c981b782dfe?w=400&h=400&fit=crop',
  hairOil:    'https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=400&h=400&fit=crop',
  detergent:  'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=400&h=400&fit=crop',
  dishwash:   'https://images.unsplash.com/photo-1622735810652-7e6c71ae65af?w=400&h=400&fit=crop',
  cleaner:    'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=400&h=400&fit=crop',
  milkPowder: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&h=400&fit=crop',
  freshMilk:  'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&h=400&fit=crop',
  yoghurt:    'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=400&fit=crop',
  cheese:     'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&h=400&fit=crop',
  butter:     'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&h=400&fit=crop',
  iceCream:   'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400&h=400&fit=crop',
  chicken:    'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&h=400&fit=crop',
  sausage:    'https://images.unsplash.com/photo-1612871689353-ccd8b3ee5de1?w=400&h=400&fit=crop',
  babySoap:   'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=400&h=400&fit=crop',
  babyFood:   'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=400&h=400&fit=crop',
  diaper:     'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=400&fit=crop',
  bread:      'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=400&fit=crop',
  cake:       'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop',
  noodles:    'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400&h=400&fit=crop',
  sauce:      'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=400&h=400&fit=crop',
  dryFish:    'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=400&fit=crop',
  sweets:     'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=400&h=400&fit=crop',
  defaultProd:'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=400&fit=crop',
};

/** Resolve the best product image based on product name keywords */
function getProductImage(name: string): string {
  const n = name.toLowerCase();
  const map: [string[], string][] = [
    [['rice','basmati','samba','nadu','keeri'], IMG.rice],
    [['dhal','gram','chickpea'], IMG.dhal],
    [['flour','kurakkan'], IMG.flour],
    [['sugar'], IMG.sugar],
    [['chilli','curry powder','turmeric','cubes','knorr'], IMG.spices],
    [['coconut oil','vegetable oil'], IMG.oil],
    [['tea dust','tea leaves'], IMG.tea],
    [['nescafe','coffee'], IMG.coffee],
    [['milo','nestomalt','sustagen','viva'], IMG.malt],
    [['coca-cola','sprite','fanta'], IMG.softDrink],
    [['sunquick','juice'], IMG.juice],
    [['water'], IMG.water],
    [['lemon puff','cream cracker','marie','chocolate cream biscuit'], IMG.biscuit],
    [['kandos','ritzbury','revello','chocolate'], IMG.chocolate],
    [['chips','murukku','cassava','manioc'], IMG.chips],
    [['shampoo','sunsilk','clear anti'], IMG.shampoo],
    [['lifebuoy','dove','soap','body wash','bathing'], IMG.soap],
    [['signal','toothpaste','clogard','sensodyne'], IMG.toothpaste],
    [['hair oil','kumarika','vatika'], IMG.hairOil],
    [['surf','detergent','washing','diva','sunlight'], IMG.detergent],
    [['vim','dishwash'], IMG.dishwash],
    [['lysol','harpic','cleaner'], IMG.cleaner],
    [['milk powder','anchor full','highland milk','ratthi'], IMG.milkPowder],
    [['fresh milk','kotmale fresh','kotmale milk'], IMG.freshMilk],
    [['yoghurt','yogurt'], IMG.yoghurt],
    [['cheese','happy cow'], IMG.cheese],
    [['margarine','astra','butter'], IMG.butter],
    [['ice cream'], IMG.iceCream],
    [['whole chicken','meatball'], IMG.chicken],
    [['sausage'], IMG.sausage],
    [['baby cheramy','pears baby','baby lotion','baby cologne','baby toiletries'], IMG.babySoap],
    [['cerelac','baby food'], IMG.babyFood],
    [['diaper','velona','cuddles'], IMG.diaper],
    [['bread','sliced bread','roast bread'], IMG.bread],
    [['bun','cake','butter cake'], IMG.cake],
    [['noodle','maggi chicken','maggi kottu','kottu mee'], IMG.noodles],
    [['sauce','kist tomato','md chilli'], IMG.sauce],
    [['karuvadu','sprats','dry fish','kumbalava','keeramin'], IMG.dryFish],
    [['sweet'], IMG.sweets],
  ];
  for (const [keywords, img] of map) {
    if (keywords.some(k => n.includes(k))) return img;
  }
  return IMG.defaultProd;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════
const suppliersRaw = [
  { name: 'Unilever Sri Lanka', company: 'Unilever Sri Lanka (Pvt) Ltd', email: 'orders@unilever.lk', phone: '+94 11 246 8000', address: 'No. 258, Grandpass Road, Colombo 14, Sri Lanka' },
  { name: 'Hemas Consumer Brands', company: 'Hemas Holdings PLC', email: 'sales@hemas.com', phone: '+94 11 269 1200', address: 'Hemas House, 75 Braybrooke Place, Colombo 02, Sri Lanka' },
  { name: 'CBL (Munchee)', company: 'Ceylon Biscuits Ltd', email: 'orders@munchee.lk', phone: '+94 11 276 0880', address: 'No. 100, Pannipitiya Road, Pannipitiya, Sri Lanka' },
  { name: 'Maliban Biscuit', company: 'Maliban Biscuit Manufactories (Pvt) Ltd', email: 'sales@maliban.lk', phone: '+94 11 263 6240', address: 'No. 24/2, New Maliban Drive, Ratmalana, Sri Lanka' },
  { name: 'Nestle Lanka', company: 'Nestle Lanka PLC', email: 'orders@nestle.lk', phone: '+94 37 220 5000', address: 'No. 440, T.B. Jayah Mawatha, Colombo 10, Sri Lanka' },
  { name: 'Fonterra Brands', company: 'Fonterra Brands Lanka (Pvt) Ltd', email: 'sales@fonterra.lk', phone: '+94 11 265 8000', address: 'No. 100, Biyagama Export Processing Zone, Malwana, Sri Lanka' },
  { name: 'Cargills PLC', company: 'Cargills (Ceylon) PLC', email: 'orders@cargills.lk', phone: '+94 11 242 7777', address: 'No. 40, York Street, Colombo 01, Sri Lanka' },
  { name: 'Ceylon Cold Stores', company: 'Ceylon Cold Stores PLC', email: 'sales@elephanthouse.lk', phone: '+94 11 230 5000', address: 'No. 100, Grandpass Road, Colombo 14, Sri Lanka' },
  { name: 'CIC Holdings', company: 'CIC Holdings PLC', email: 'sales@cic.lk', phone: '+94 11 238 3000', address: 'No. 199, Kew Road, Colombo 02, Sri Lanka' },
  { name: 'Dilmah Ceylon Tea', company: 'MJF Holdings Ltd', email: 'sales@dilmahtea.com', phone: '+94 11 282 2000', address: 'No. 111, Negombo Road, Peliyagoda, Sri Lanka' },
  { name: 'Bairaha Farms', company: 'Bairaha Farms PLC', email: 'orders@bairaha.com', phone: '+94 33 228 3500', address: 'No. 10, Minuwangoda Road, Ja-Ela, Sri Lanka' },
  { name: 'Reckitt Benckiser', company: 'Reckitt Benckiser Lanka Ltd', email: 'sales@reckitt.lk', phone: '+94 11 244 5656', address: 'No. 20, Alfred Place, Colombo 03, Sri Lanka' },
  { name: 'Haleon', company: 'Haleon Sri Lanka (Pvt) Ltd', email: 'sales@haleon.com', phone: '+94 11 250 1500', address: 'No. 36, Dharmapala Mawatha, Colombo 03, Sri Lanka' },
  { name: 'Mannar Wholesale Distributors', company: 'Mannar Wholesale Distributors', email: 'mannarwd@gmail.com', phone: '+94 23 222 3456', address: 'No. 15, Main Street, Mannar Town, Mannar, Sri Lanka' },
  { name: 'Northern Traders', company: 'Northern Traders (Pvt) Ltd', email: 'northerntraders@yahoo.com', phone: '+94 23 222 4567', address: 'No. 42, Talaimannar Road, Mannar, Sri Lanka' },
  { name: 'St. Marys Dry Fish Exporters', company: 'St. Marys Fish Exporters', email: 'stmarys@mannar.lk', phone: '+94 23 222 5678', address: 'Pesalai Junction, Pesalai, Mannar Island, Sri Lanka' },
  { name: 'Mannar Rice Mill', company: 'Sivakumar Rice Mill', email: 'ricemill@mannar.com', phone: '+94 23 222 6789', address: 'Murunkan – Mannar Road, Murunkan, Mannar, Sri Lanka' },
  { name: 'Sathosa Mannar Hub', company: 'Lanka Sathosa Ltd – Mannar', email: 'sathosa.mannar@gov.lk', phone: '+94 23 222 7890', address: 'No. 5, Hospital Road, Mannar Town, Mannar, Sri Lanka' },
];

const categoriesRaw = [
  { name: 'Grocery & Staples', desc: 'Rice, flour, sugar, spices, oil, dhal and everyday cooking essentials', img: IMG.catGrocery, subs: ['Rice','Dhal & Pulses','Flour','Sugar','Spices & Condiments','Oil'] },
  { name: 'Beverages', desc: 'Tea, coffee, soft drinks, juices, malt beverages and water', img: IMG.catBeverages, subs: ['Tea','Coffee','Soft Drinks','Fruit Juices','Water','Malt & Energy Drinks'] },
  { name: 'Snacks & Confectionery', desc: 'Biscuits, chocolates, chips, murukku and traditional sweets', img: IMG.catSnacks, subs: ['Biscuits','Chocolates','Chips & Murukku','Sweets'] },
  { name: 'Personal Care', desc: 'Soaps, shampoo, toothpaste, skincare and grooming products', img: IMG.catPersonal, subs: ['Soaps & Body Wash','Hair Care','Oral Care','Skin Care'] },
  { name: 'Household Care', desc: 'Laundry detergents, surface cleaners, dishwashing and repellents', img: IMG.catHousehold, subs: ['Laundry Detergents','Surface Cleaners','Dishwashing','Repellents'] },
  { name: 'Dairy & Chilled', desc: 'Milk powder, fresh milk, butter, cheese, yoghurt and chilled products', img: IMG.catDairy, subs: ['Milk Powder','Fresh Milk','Butter & Cheese','Yoghurt'] },
  { name: 'Frozen Foods', desc: 'Ice cream, frozen meats, sausages and ready-to-cook frozen items', img: IMG.catFrozen, subs: ['Ice Cream','Processed Meats'] },
  { name: 'Baby Care', desc: 'Diapers, baby food, baby toiletries and infant care products', img: IMG.catBaby, subs: ['Baby Diapers','Baby Food','Baby Toiletries'] },
  { name: 'Bakery', desc: 'Fresh bread, buns, cakes and baked goods', img: IMG.catBakery, subs: ['Bread','Buns & Cakes'] },
  { name: 'Local & Dry Goods', desc: 'Mannar dry fish (karuvadu), local sweets and traditional products', img: IMG.catLocal, subs: ['Dry Fish (Karuvadu)','Local Sweets'] },
];

const brandsRaw = [
  'Sunsilk','Lifebuoy','Signal','Clogard','Baby Cheramy','Munchee','Maliban','Maggi','Milo',
  'Anchor','Ratthi','Kotmale','Elephant House','Kist','Dettol','Harpic','Prima','Roza','Dilmah',
  'Zesta','Sustagen','Viva','Nestomalt','Nescafe','Gold Leaf','Ritzbury','Kandos','Edinborough',
  'Araliya','Nipuna','CIC','Marina','Fortune','Sunquick','Coca-Cola','Sprite','Fanta','Knorr',
  'MD','Sera','Bairaha','Crysbro','Keells','Magic','Highland','Pelwatte','Velona','Pears',
  'Lysol','Vim','Sunlight','Surf Excel','Diva','Kumarika','Vatika','Clear','Dove','Sensodyne',
  'Local','Pesalai Dry Fish','Mannar Mill','Sathosa Mannar Hub'
];

// Master product definitions — pop = popularity (1-10), shelf = shelf life in days
const masterProducts = [
  // ═══ RICE ═══
  { name:'Keeri Samba Rice', cat:'Grocery & Staples', sub:'Rice', brand:'Araliya', sup:'Northern Traders', pop:10, shelf:365,
    variants:[{v:'1Kg',p:380,c:350},{v:'5Kg',p:1850,c:1750},{v:'10Kg',p:3650,c:3450},{v:'25Kg',p:9000,c:8600}] },
  { name:'Nadu Rice', cat:'Grocery & Staples', sub:'Rice', brand:'Nipuna', sup:'Mannar Rice Mill', pop:10, shelf:365,
    variants:[{v:'1Kg',p:220,c:200},{v:'5Kg',p:1080,c:1000},{v:'10Kg',p:2150,c:1950},{v:'25Kg',p:5300,c:4850}] },
  { name:'Samba Rice', cat:'Grocery & Staples', sub:'Rice', brand:'Local', sup:'Mannar Rice Mill', pop:9, shelf:365,
    variants:[{v:'1Kg',p:240,c:220},{v:'5Kg',p:1180,c:1100},{v:'10Kg',p:2350,c:2150},{v:'25Kg',p:5800,c:5300}] },
  { name:'Basmati Rice', cat:'Grocery & Staples', sub:'Rice', brand:'CIC', sup:'CIC Holdings', pop:5, shelf:365,
    variants:[{v:'1Kg',p:850,c:780},{v:'5Kg',p:4200,c:3850}] },
  // ═══ DHAL & PULSES ═══
  { name:'Mysore Dhal', cat:'Grocery & Staples', sub:'Dhal & Pulses', brand:'Local', sup:'Mannar Wholesale Distributors', pop:9, shelf:365,
    variants:[{v:'250g',p:110,c:95},{v:'500g',p:210,c:185},{v:'1Kg',p:400,c:360},{v:'5Kg',p:1950,c:1780}] },
  { name:'Green Gram', cat:'Grocery & Staples', sub:'Dhal & Pulses', brand:'Sathosa Mannar Hub', sup:'Sathosa Mannar Hub', pop:6, shelf:365,
    variants:[{v:'500g',p:350,c:300},{v:'1Kg',p:680,c:590}] },
  { name:'Chickpeas', cat:'Grocery & Staples', sub:'Dhal & Pulses', brand:'Local', sup:'Northern Traders', pop:5, shelf:365,
    variants:[{v:'500g',p:450,c:390},{v:'1Kg',p:880,c:770}] },
  // ═══ FLOUR & SUGAR ═══
  { name:'Wheat Flour', cat:'Grocery & Staples', sub:'Flour', brand:'Prima', sup:'Mannar Wholesale Distributors', pop:8, shelf:270,
    variants:[{v:'1Kg',p:210,c:190},{v:'5Kg',p:1030,c:940},{v:'50Kg',p:10000,c:9200}] },
  { name:'Kurakkan Flour', cat:'Grocery & Staples', sub:'Flour', brand:'Local', sup:'Northern Traders', pop:4, shelf:270,
    variants:[{v:'500g',p:320,c:280},{v:'1Kg',p:620,c:550}] },
  { name:'White Sugar', cat:'Grocery & Staples', sub:'Sugar', brand:'Local', sup:'Mannar Wholesale Distributors', pop:10, shelf:730,
    variants:[{v:'500g',p:160,c:145},{v:'1Kg',p:310,c:285},{v:'5Kg',p:1530,c:1420},{v:'50Kg',p:15000,c:14000}] },
  { name:'Brown Sugar', cat:'Grocery & Staples', sub:'Sugar', brand:'Sathosa Mannar Hub', sup:'Sathosa Mannar Hub', pop:3, shelf:730,
    variants:[{v:'1Kg',p:350,c:310},{v:'5Kg',p:1720,c:1540}] },
  // ═══ SPICES & OIL ═══
  { name:'Chilli Powder', cat:'Grocery & Staples', sub:'Spices & Condiments', brand:'Local', sup:'Northern Traders', pop:8, shelf:365,
    variants:[{v:'100g',p:180,c:150},{v:'250g',p:420,c:360},{v:'500g',p:800,c:700},{v:'1Kg',p:1550,c:1350}] },
  { name:'Curry Powder (Roasted)', cat:'Grocery & Staples', sub:'Spices & Condiments', brand:'Local', sup:'Northern Traders', pop:7, shelf:365,
    variants:[{v:'100g',p:160,c:130},{v:'250g',p:380,c:310},{v:'500g',p:720,c:600}] },
  { name:'Turmeric Powder', cat:'Grocery & Staples', sub:'Spices & Condiments', brand:'Local', sup:'Mannar Wholesale Distributors', pop:7, shelf:365,
    variants:[{v:'50g',p:90,c:75},{v:'100g',p:170,c:140},{v:'250g',p:400,c:340}] },
  { name:'Coconut Oil', cat:'Grocery & Staples', sub:'Oil', brand:'Marina', sup:'Mannar Wholesale Distributors', pop:9, shelf:365,
    variants:[{v:'500ml',p:480,c:430},{v:'1L',p:950,c:850},{v:'5L',p:4600,c:4200}] },
  { name:'Vegetable Oil', cat:'Grocery & Staples', sub:'Oil', brand:'Fortune', sup:'Northern Traders', pop:7, shelf:365,
    variants:[{v:'1L',p:750,c:680},{v:'2L',p:1480,c:1350},{v:'5L',p:3650,c:3350}] },
  // ═══ DRY FISH (MANNAR SPECIAL) ═══
  { name:'Katta Karuvadu', cat:'Local & Dry Goods', sub:'Dry Fish (Karuvadu)', brand:'Pesalai Dry Fish', sup:'St. Marys Dry Fish Exporters', pop:7, shelf:270,
    variants:[{v:'100g',p:400,c:320},{v:'250g',p:950,c:780},{v:'500g',p:1850,c:1550},{v:'1Kg',p:3600,c:3000}] },
  { name:'Sprats (Keeramin)', cat:'Local & Dry Goods', sub:'Dry Fish (Karuvadu)', brand:'Pesalai Dry Fish', sup:'St. Marys Dry Fish Exporters', pop:6, shelf:270,
    variants:[{v:'100g',p:150,c:120},{v:'250g',p:360,c:290},{v:'500g',p:700,c:560},{v:'1Kg',p:1350,c:1100}] },
  { name:'Kumbalava Dry Fish', cat:'Local & Dry Goods', sub:'Dry Fish (Karuvadu)', brand:'Pesalai Dry Fish', sup:'St. Marys Dry Fish Exporters', pop:4, shelf:270,
    variants:[{v:'250g',p:550,c:450},{v:'500g',p:1050,c:880},{v:'1Kg',p:2000,c:1700}] },
  // ═══ BEVERAGES ═══
  { name:'Tea Dust', cat:'Beverages', sub:'Tea', brand:'Zesta', sup:'Mannar Wholesale Distributors', pop:10, shelf:540,
    variants:[{v:'100g',p:250,c:220},{v:'200g',p:490,c:430},{v:'500g',p:1200,c:1050},{v:'1Kg',p:2350,c:2080}] },
  { name:'Premium Tea Leaves', cat:'Beverages', sub:'Tea', brand:'Dilmah', sup:'Dilmah Ceylon Tea', pop:6, shelf:540,
    variants:[{v:'100g',p:380,c:320},{v:'200g',p:740,c:630},{v:'400g',p:1450,c:1250}] },
  { name:'Milo Powder', cat:'Beverages', sub:'Malt & Energy Drinks', brand:'Milo', sup:'Nestle Lanka', pop:8, shelf:365,
    variants:[{v:'200g',p:500,c:440},{v:'400g',p:980,c:870},{v:'1Kg',p:2400,c:2150}] },
  { name:'Nestomalt', cat:'Beverages', sub:'Malt & Energy Drinks', brand:'Nestomalt', sup:'Nestle Lanka', pop:7, shelf:365,
    variants:[{v:'200g',p:480,c:420},{v:'400g',p:940,c:830},{v:'1Kg',p:2300,c:2050}] },
  { name:'Nescafe Classic', cat:'Beverages', sub:'Coffee', brand:'Nescafe', sup:'Nestle Lanka', pop:7, shelf:540,
    variants:[{v:'50g',p:750,c:650},{v:'100g',p:1450,c:1250},{v:'200g',p:2800,c:2450}] },
  { name:'Coca-Cola', cat:'Beverages', sub:'Soft Drinks', brand:'Coca-Cola', sup:'Northern Traders', pop:7, shelf:270,
    variants:[{v:'400ml',p:120,c:100},{v:'1L',p:280,c:240},{v:'1.5L',p:380,c:330},{v:'2L',p:480,c:420}] },
  { name:'Sprite', cat:'Beverages', sub:'Soft Drinks', brand:'Sprite', sup:'Northern Traders', pop:5, shelf:270,
    variants:[{v:'400ml',p:120,c:100},{v:'1.5L',p:380,c:330}] },
  { name:'Sunquick Orange', cat:'Beverages', sub:'Fruit Juices', brand:'Sunquick', sup:'Northern Traders', pop:5, shelf:365,
    variants:[{v:'330ml',p:850,c:740},{v:'840ml',p:1850,c:1600}] },
  // ═══ SNACKS & BISCUITS ═══
  { name:'Lemon Puff', cat:'Snacks & Confectionery', sub:'Biscuits', brand:'Munchee', sup:'CBL (Munchee)', pop:8, shelf:240,
    variants:[{v:'100g',p:100,c:85},{v:'200g',p:190,c:165},{v:'400g',p:370,c:320}] },
  { name:'Cream Cracker', cat:'Snacks & Confectionery', sub:'Biscuits', brand:'Maliban', sup:'Maliban Biscuit', pop:8, shelf:240,
    variants:[{v:'125g',p:90,c:75},{v:'190g',p:140,c:120},{v:'330g',p:240,c:205},{v:'500g',p:360,c:310}] },
  { name:'Chocolate Cream Biscuit', cat:'Snacks & Confectionery', sub:'Biscuits', brand:'Munchee', sup:'CBL (Munchee)', pop:6, shelf:240,
    variants:[{v:'100g',p:120,c:100},{v:'400g',p:450,c:390}] },
  { name:'Marie Biscuit', cat:'Snacks & Confectionery', sub:'Biscuits', brand:'Maliban', sup:'Maliban Biscuit', pop:7, shelf:240,
    variants:[{v:'80g',p:80,c:65},{v:'300g',p:280,c:240}] },
  { name:'Kandos Milk Chocolate', cat:'Snacks & Confectionery', sub:'Chocolates', brand:'Kandos', sup:'Northern Traders', pop:5, shelf:365,
    variants:[{v:'45g',p:150,c:130},{v:'100g',p:320,c:280},{v:'200g',p:620,c:540}] },
  { name:'Ritzbury Revello', cat:'Snacks & Confectionery', sub:'Chocolates', brand:'Ritzbury', sup:'CBL (Munchee)', pop:5, shelf:365,
    variants:[{v:'50g',p:180,c:155},{v:'100g',p:350,c:300}] },
  { name:'Cassava Chips (Manioc)', cat:'Snacks & Confectionery', sub:'Chips & Murukku', brand:'Local', sup:'Mannar Wholesale Distributors', pop:5, shelf:120,
    variants:[{v:'50g',p:80,c:65},{v:'100g',p:150,c:120},{v:'250g',p:350,c:280}] },
  { name:'Murukku Packet', cat:'Snacks & Confectionery', sub:'Chips & Murukku', brand:'Local', sup:'Northern Traders', pop:4, shelf:120,
    variants:[{v:'100g',p:100,c:80},{v:'200g',p:190,c:150}] },
  // ═══ PERSONAL CARE ═══
  { name:'Sunsilk Black Shine Shampoo', cat:'Personal Care', sub:'Hair Care', brand:'Sunsilk', sup:'Unilever Sri Lanka', pop:6, shelf:730,
    variants:[{v:'90ml',p:320,c:280},{v:'180ml',p:580,c:510},{v:'340ml',p:1050,c:920},{v:'680ml',p:1950,c:1720}] },
  { name:'Clear Anti-Dandruff Shampoo', cat:'Personal Care', sub:'Hair Care', brand:'Clear', sup:'Unilever Sri Lanka', pop:5, shelf:730,
    variants:[{v:'80ml',p:350,c:310},{v:'170ml',p:650,c:570},{v:'330ml',p:1200,c:1050}] },
  { name:'Lifebuoy Soap Total 10', cat:'Personal Care', sub:'Soaps & Body Wash', brand:'Lifebuoy', sup:'Unilever Sri Lanka', pop:8, shelf:730,
    variants:[{v:'50g',p:65,c:55},{v:'100g',p:120,c:100},{v:'100g x 4',p:450,c:390}] },
  { name:'Signal Toothpaste', cat:'Personal Care', sub:'Oral Care', brand:'Signal', sup:'Unilever Sri Lanka', pop:8, shelf:730,
    variants:[{v:'40g',p:95,c:80},{v:'120g',p:240,c:210},{v:'160g',p:320,c:280}] },
  { name:'Sensodyne Repair', cat:'Personal Care', sub:'Oral Care', brand:'Sensodyne', sup:'Haleon', pop:4, shelf:730,
    variants:[{v:'100g',p:750,c:650}] },
  { name:'Kumarika Hair Oil', cat:'Personal Care', sub:'Hair Care', brand:'Kumarika', sup:'Hemas Consumer Brands', pop:5, shelf:730,
    variants:[{v:'100ml',p:220,c:190},{v:'200ml',p:420,c:360}] },
  { name:'Dove Beauty Bathing Bar', cat:'Personal Care', sub:'Soaps & Body Wash', brand:'Dove', sup:'Unilever Sri Lanka', pop:5, shelf:730,
    variants:[{v:'100g',p:350,c:300}] },
  // ═══ HOUSEHOLD CARE ═══
  { name:'Surf Excel Detergent Powder', cat:'Household Care', sub:'Laundry Detergents', brand:'Surf Excel', sup:'Unilever Sri Lanka', pop:7, shelf:730,
    variants:[{v:'200g',p:180,c:155},{v:'500g',p:420,c:370},{v:'1Kg',p:820,c:720}] },
  { name:'Sunlight Washing Soap', cat:'Household Care', sub:'Laundry Detergents', brand:'Sunlight', sup:'Unilever Sri Lanka', pop:8, shelf:730,
    variants:[{v:'120g',p:80,c:70},{v:'120g x 4',p:310,c:275}] },
  { name:'Diva Washing Powder', cat:'Household Care', sub:'Laundry Detergents', brand:'Diva', sup:'Hemas Consumer Brands', pop:6, shelf:730,
    variants:[{v:'400g',p:280,c:240},{v:'1Kg',p:650,c:560}] },
  { name:'Vim Dishwash Liquid', cat:'Household Care', sub:'Dishwashing', brand:'Vim', sup:'Unilever Sri Lanka', pop:6, shelf:730,
    variants:[{v:'250ml',p:250,c:220},{v:'500ml',p:480,c:420}] },
  { name:'Lysol Floor Cleaner', cat:'Household Care', sub:'Surface Cleaners', brand:'Lysol', sup:'Reckitt Benckiser', pop:4, shelf:730,
    variants:[{v:'500ml',p:550,c:480},{v:'1L',p:1050,c:920}] },
  { name:'Harpic Toilet Cleaner', cat:'Household Care', sub:'Surface Cleaners', brand:'Harpic', sup:'Reckitt Benckiser', pop:5, shelf:730,
    variants:[{v:'500ml',p:480,c:420},{v:'750ml',p:680,c:590}] },
  // ═══ DAIRY & CHILLED ═══
  { name:'Anchor Full Cream Milk Powder', cat:'Dairy & Chilled', sub:'Milk Powder', brand:'Anchor', sup:'Fonterra Brands', pop:10, shelf:365,
    variants:[{v:'75g',p:250,c:230},{v:'400g',p:1200,c:1120},{v:'1Kg',p:2950,c:2780}] },
  { name:'Highland Milk Powder', cat:'Dairy & Chilled', sub:'Milk Powder', brand:'Highland', sup:'Mannar Wholesale Distributors', pop:8, shelf:365,
    variants:[{v:'400g',p:1150,c:1080},{v:'1Kg',p:2850,c:2680}] },
  { name:'Ratthi Milk Powder', cat:'Dairy & Chilled', sub:'Milk Powder', brand:'Ratthi', sup:'Fonterra Brands', pop:7, shelf:365,
    variants:[{v:'400g',p:1180,c:1100}] },
  { name:'Kotmale Fresh Milk', cat:'Dairy & Chilled', sub:'Fresh Milk', brand:'Kotmale', sup:'Cargills PLC', pop:6, shelf:10,
    variants:[{v:'500ml',p:280,c:250},{v:'1L',p:520,c:460}] },
  { name:'Highland Yoghurt', cat:'Dairy & Chilled', sub:'Yoghurt', brand:'Highland', sup:'Mannar Wholesale Distributors', pop:5, shelf:14,
    variants:[{v:'80g',p:70,c:60}] },
  { name:'Kotmale Set Yoghurt', cat:'Dairy & Chilled', sub:'Yoghurt', brand:'Kotmale', sup:'Cargills PLC', pop:5, shelf:14,
    variants:[{v:'80g',p:75,c:65}] },
  { name:'Astra Margarine', cat:'Dairy & Chilled', sub:'Butter & Cheese', brand:'Anchor', sup:'Fonterra Brands', pop:5, shelf:120,
    variants:[{v:'100g',p:250,c:220},{v:'250g',p:580,c:510}] },
  { name:'Happy Cow Cheese', cat:'Dairy & Chilled', sub:'Butter & Cheese', brand:'Anchor', sup:'Mannar Wholesale Distributors', pop:4, shelf:120,
    variants:[{v:'120g (8 Portions)',p:780,c:680}] },
  // ═══ FROZEN FOODS ═══
  { name:'Elephant House Vanilla Ice Cream', cat:'Frozen Foods', sub:'Ice Cream', brand:'Elephant House', sup:'Ceylon Cold Stores', pop:6, shelf:270,
    variants:[{v:'1L',p:750,c:650},{v:'2L',p:1450,c:1280},{v:'4L',p:2800,c:2480}] },
  { name:'Elephant House Chocolate Ice Cream', cat:'Frozen Foods', sub:'Ice Cream', brand:'Elephant House', sup:'Ceylon Cold Stores', pop:5, shelf:270,
    variants:[{v:'1L',p:800,c:700},{v:'2L',p:1550,c:1350}] },
  { name:'Magic Fruit & Nut Ice Cream', cat:'Frozen Foods', sub:'Ice Cream', brand:'Magic', sup:'Cargills PLC', pop:4, shelf:270,
    variants:[{v:'1L',p:950,c:820}] },
  { name:'Bairaha Chicken Sausages', cat:'Frozen Foods', sub:'Processed Meats', brand:'Bairaha', sup:'Bairaha Farms', pop:5, shelf:180,
    variants:[{v:'250g',p:480,c:420},{v:'500g',p:920,c:810}] },
  { name:'Keells Chicken Meatballs', cat:'Frozen Foods', sub:'Processed Meats', brand:'Keells', sup:'Northern Traders', pop:4, shelf:180,
    variants:[{v:'200g',p:450,c:390},{v:'500g',p:1050,c:920}] },
  { name:'Bairaha Whole Chicken (Frozen)', cat:'Frozen Foods', sub:'Processed Meats', brand:'Bairaha', sup:'Bairaha Farms', pop:5, shelf:180,
    variants:[{v:'1Kg',p:1250,c:1120},{v:'1.2Kg',p:1500,c:1350}] },
  // ═══ BABY CARE ═══
  { name:'Baby Cheramy Soap', cat:'Baby Care', sub:'Baby Toiletries', brand:'Baby Cheramy', sup:'Hemas Consumer Brands', pop:4, shelf:730,
    variants:[{v:'100g',p:150,c:130}] },
  { name:'Baby Cheramy Cologne', cat:'Baby Care', sub:'Baby Toiletries', brand:'Baby Cheramy', sup:'Hemas Consumer Brands', pop:3, shelf:730,
    variants:[{v:'100ml',p:350,c:300}] },
  { name:'Pears Baby Lotion', cat:'Baby Care', sub:'Baby Toiletries', brand:'Pears', sup:'Unilever Sri Lanka', pop:3, shelf:730,
    variants:[{v:'100ml',p:420,c:360},{v:'200ml',p:780,c:680}] },
  { name:'Velona Cuddles Diapers', cat:'Baby Care', sub:'Baby Diapers', brand:'Velona', sup:'Northern Traders', pop:4, shelf:730,
    variants:[{v:'Small (10pcs)',p:850,c:750},{v:'Medium (10pcs)',p:950,c:840},{v:'Large (10pcs)',p:1050,c:930}] },
  { name:'Cerelac Wheat & Milk', cat:'Baby Care', sub:'Baby Food', brand:'Maggi', sup:'Nestle Lanka', pop:3, shelf:365,
    variants:[{v:'400g',p:1250,c:1100}] },
  // ═══ BAKERY ═══
  { name:'Sliced Bread', cat:'Bakery', sub:'Bread', brand:'Local', sup:'Mannar Wholesale Distributors', pop:10, shelf:5,
    variants:[{v:'450g',p:180,c:150}] },
  { name:'Roast Bread', cat:'Bakery', sub:'Bread', brand:'Local', sup:'Mannar Wholesale Distributors', pop:8, shelf:5,
    variants:[{v:'450g',p:200,c:170}] },
  { name:'Tea Bun', cat:'Bakery', sub:'Buns & Cakes', brand:'Local', sup:'Northern Traders', pop:7, shelf:3,
    variants:[{v:'1 piece',p:80,c:65},{v:'5 pieces',p:380,c:310}] },
  { name:'Butter Cake', cat:'Bakery', sub:'Buns & Cakes', brand:'Local', sup:'Mannar Wholesale Distributors', pop:5, shelf:5,
    variants:[{v:'250g',p:350,c:290},{v:'500g',p:680,c:560}] },
  // ═══ NOODLES & CONDIMENTS ═══
  { name:'Maggi Chicken Noodles', cat:'Grocery & Staples', sub:'Flour', brand:'Maggi', sup:'Nestle Lanka', pop:8, shelf:270,
    variants:[{v:'73g',p:110,c:95},{v:'350g (Family)',p:520,c:450}] },
  { name:'Maggi Kottu Mee', cat:'Grocery & Staples', sub:'Flour', brand:'Maggi', sup:'Nestle Lanka', pop:6, shelf:270,
    variants:[{v:'80g',p:130,c:110}] },
  { name:'Kist Tomato Sauce', cat:'Grocery & Staples', sub:'Spices & Condiments', brand:'Kist', sup:'Cargills PLC', pop:6, shelf:365,
    variants:[{v:'400g',p:450,c:390},{v:'1Kg',p:950,c:840}] },
  { name:'MD Chilli Sauce', cat:'Grocery & Staples', sub:'Spices & Condiments', brand:'MD', sup:'Northern Traders', pop:5, shelf:365,
    variants:[{v:'400g',p:480,c:410}] },
  { name:'Knorr Chicken Cubes', cat:'Grocery & Staples', sub:'Spices & Condiments', brand:'Knorr', sup:'Unilever Sri Lanka', pop:6, shelf:365,
    variants:[{v:'20g (2 Cubes)',p:90,c:75},{v:'60g (6 Cubes)',p:250,c:210}] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  const t0 = Date.now();
  console.log('🚀 StockSense Full Database Seeder — Sri Lankan Supermarket (Mannar)');
  console.log('═'.repeat(65));
  console.log(`📅 Sales period: ${SALES_START_DATE.toISOString().slice(0,10)} → ${SALES_END_DATE.toISOString().slice(0,10)}`);
  console.log(`📊 Target: ~${BASE_BILLS_PER_DAY} bills/day with seasonal variation`);
  console.log('═'.repeat(65));

  // ─── PHASE 1: CLEAR ALL DATA ─────────────────────────────────────────
  console.log('\n🧹 Phase 1: Truncating all tables for instant clean up...');
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE 
      user_notification_states, notifications, sales_refund_items, sales_refunds, 
      sales_bill_items, sales_bills, grn_items, goods_receiving_notes, 
      stock_adjustments, discount_combo_items, seasonal_or_daily_products, 
      discounts, products, master_product_class, brands, sub_categories, 
      categories, suppliers, generated_reports, system_settings 
    CASCADE;
  `);
  // Keep existing users — we'll upsert below
  console.log('   ✓ All tables truncated instantly');

  // ─── PHASE 2: SEED REFERENCE DATA ────────────────────────────────────
  console.log('\n📦 Phase 2: Seeding reference data...');

  const supplierMap: Record<string, any> = {};
  for (const s of suppliersRaw) {
    supplierMap[s.name] = await prisma.supplier.create({
      data: { name: s.name, companyName: s.company, email: s.email, phone: s.phone, address: s.address, createdAt: STORE_OPEN_DATE }
    });
  }
  console.log(`   ✓ ${suppliersRaw.length} suppliers seeded`);

  const categoryMap: Record<string, any> = {};
  const subCategoryMap: Record<string, any> = {};
  for (const c of categoriesRaw) {
    const cat = await prisma.category.create({ data: { name: c.name, description: c.desc, categoryImageUrl: c.img } });
    categoryMap[c.name] = cat;
    for (const sub of c.subs) {
      subCategoryMap[`${c.name}-${sub}`] = await prisma.subCategory.create({ data: { name: sub, categoryId: cat.id } });
    }
  }
  console.log(`   ✓ ${categoriesRaw.length} categories with ${Object.keys(subCategoryMap).length} subcategories seeded`);

  const brandMap: Record<string, any> = {};
  for (const b of brandsRaw) {
    brandMap[b] = await prisma.brand.create({ data: { name: b, state: BrandState.ACTIVE } });
  }
  console.log(`   ✓ ${brandsRaw.length} brands seeded`);

  // ─── PHASE 3: SEED PRODUCTS ──────────────────────────────────────────
  console.log('\n🛒 Phase 3: Seeding products...');
  const now = new Date();
  let totalSkus = 0;
  let currentSeq = 1;
  const allProducts: { sku:string; sellingPrice:number; costPrice:number; pop:number; name:string }[] = [];

  for (const mp of masterProducts) {
    const category = categoryMap[mp.cat];
    const subCategory = subCategoryMap[`${mp.cat}-${mp.sub}`];
    const brand = brandMap[mp.brand];
    const supplier = supplierMap[mp.sup];
    if (!category||!subCategory||!brand||!supplier) { console.error(`   ⚠ Missing ref: ${mp.name}`); continue; }

    const master = await prisma.masterProductClass.create({
      data: { name: mp.name, categoryId: category.id, subCategoryId: subCategory.id, brandId: brand.id, supplierId: supplier.id, hasVariant: mp.variants.length > 1, createdAt: STORE_OPEN_DATE }
    });

    const productImage = getProductImage(mp.name);

    for (const variant of mp.variants) {
      const sku = makeSku(mp.brand, mp.name, variant.v, currentSeq++);
      const unitType = variant.v.replace(/[0-9.]/g, '').trim().toUpperCase() || 'PCS';

      // Realistic stock distribution
      let stock: number;
      const r = Math.random();
      if (r < 0.03) stock = 0;                       // 3% OUT_OF_STOCK
      else if (r < 0.13) stock = randomInt(1, 15);    // 10% LOW_STOCK
      else if (r < 0.18) stock = randomInt(160, 250); // 5% OVERSTOCK
      else stock = randomInt(20, 130);                 // 82% normal

      // Mfg & Expiry dates with some near-expiry for AI alerts
      const mfgDaysAgo = randomInt(7, Math.min(mp.shelf, 180));
      const mfgDate = new Date(now.getTime() - mfgDaysAgo * 86400000);
      let expiryDate = new Date(mfgDate.getTime() + mp.shelf * 86400000);
      const expiryRoll = Math.random();
      if (expiryRoll < 0.02) expiryDate = new Date(now.getTime() - randomInt(1, 30) * 86400000);       // 2% expired
      else if (expiryRoll < 0.07) expiryDate = new Date(now.getTime() + randomInt(1, 30) * 86400000);  // 5% expiring soon

      await prisma.product.create({
        data: {
          sku, masterId: master.id, barcode: generateBarcode(), name: `${mp.name} ${variant.v}`,
          unitType, costPrice: variant.c, sellingPrice: variant.p, currentStock: stock,
          reorderLevel: 20, targetCapacity: 150, mfgDate, expiryDate,
          status: ProductStatus.ACTIVE, imageUrl: productImage,
          batchNumber: `BN-${mfgDate.getFullYear()}-${randomInt(100, 999)}`,
          variantAttributeType: variant.v, createdAt: STORE_OPEN_DATE, updatedAt: now
        }
      });
      allProducts.push({ sku, sellingPrice: variant.p, costPrice: variant.c, pop: mp.pop, name: `${mp.name} ${variant.v}` });
      totalSkus++;
    }
  }

  // Multipacks (Pack of 3 & Pack of 6) to reach 500+ SKUs
  console.log('   🔄 Creating multipack variants...');
  for (const mp of masterProducts) {
    const master = await prisma.masterProductClass.findFirst({ where: { name: mp.name } });
    if (!master) continue;
    const productImage = getProductImage(mp.name);

    for (const variant of mp.variants) {
      for (const [packQty, discPct] of [[3, 0.95], [6, 0.90]] as [number, number][]) {
        const skuPack = makeSku(mp.brand, mp.name, `${packQty}x${variant.v}`, currentSeq++);
        const pricePack = Math.round(variant.p * packQty * discPct);
        const costPack = variant.c * packQty;
        await prisma.product.create({
          data: {
            sku: skuPack, masterId: master.id, barcode: generateBarcode(),
            name: `${mp.name} ${variant.v} (Pack of ${packQty})`, unitType: 'PACK',
            costPrice: costPack, sellingPrice: pricePack, currentStock: randomInt(3, 35),
            reorderLevel: 10, targetCapacity: 50, status: ProductStatus.ACTIVE, imageUrl: productImage,
            variantAttributeType: `Pack of ${packQty}`, createdAt: STORE_OPEN_DATE, updatedAt: now
          }
        });
        allProducts.push({ sku: skuPack, sellingPrice: pricePack, costPrice: costPack, pop: Math.max(1, mp.pop - packQty), name: `${mp.name} ${variant.v} (Pack of ${packQty})` });
        totalSkus++;
      }
    }
  }
  console.log(`   ✓ ${totalSkus} product SKUs seeded`);

  // ─── PHASE 4: SEED USERS ─────────────────────────────────────────────
  console.log('\n👥 Phase 4: Seeding users...');
  const pw = {
    admin: await bcrypt.hash('Admin@123', 12),
    cashier: await bcrypt.hash('Cashier@123', 12),
    manager: await bcrypt.hash('Manager@123', 12)
  };
  const adminUser = await prisma.user.upsert({ where:{email:'admin@stocksense.com'}, update:{},
    create:{name:'Super Admin',email:'admin@stocksense.com',passwordHash:pw.admin,role:Role.ADMIN,isActive:true,createdAt:STORE_OPEN_DATE,updatedAt:STORE_OPEN_DATE} });
  const cashier1 = await prisma.user.upsert({ where:{email:'cashier@stocksense.com'}, update:{},
    create:{name:'Priya Kumari',email:'cashier@stocksense.com',passwordHash:pw.cashier,role:Role.CASHIER,isActive:true,createdAt:STORE_OPEN_DATE,updatedAt:STORE_OPEN_DATE} });
  const cashier2 = await prisma.user.upsert({ where:{email:'cashier2@stocksense.com'}, update:{},
    create:{name:'Ramesh Selvan',email:'cashier2@stocksense.com',passwordHash:pw.cashier,role:Role.CASHIER,isActive:true,createdAt:new Date('2024-06-01'),updatedAt:new Date('2024-06-01')} });
  const cashier3 = await prisma.user.upsert({ where:{email:'cashier3@stocksense.com'}, update:{},
    create:{name:'Saranya Devi',email:'cashier3@stocksense.com',passwordHash:pw.cashier,role:Role.CASHIER,isActive:true,createdAt:new Date('2025-01-15'),updatedAt:new Date('2025-01-15')} });
  const managerUser = await prisma.user.upsert({ where:{email:'manager@stocksense.com'}, update:{},
    create:{name:'Kamal Perera',email:'manager@stocksense.com',passwordHash:pw.manager,role:Role.INVENTORY_MANAGER,isActive:true,createdAt:STORE_OPEN_DATE,updatedAt:STORE_OPEN_DATE} });
  const cashierIds = [cashier1.id, cashier2.id, cashier3.id];
  const operatorIds = [adminUser.id, managerUser.id];
  console.log('   ✓ 5 users seeded (1 admin, 3 cashiers, 1 manager)');

  // Weighted product selection helper
  const productWeights = allProducts.map(p => Math.max(1, p.pop));
  function pickProduct() { return weightedRandom(allProducts, productWeights); }

  // ─── PHASE 5: SEED GRNs ──────────────────────────────────────────────
  console.log('\n📦 Phase 5: Generating Goods Receiving Notes...');
  const allSupplierIds = Object.values(supplierMap).map((s:any) => s.id);
  const grnRows: any[][] = [];
  const grnItemRows: any[][] = [];
  let grnCount = 0;
  let grnDate = SALES_START_DATE.getTime();
  const endMs = SALES_END_DATE.getTime();

  while (grnDate < endMs) {
    grnCount++;
    const grnId = crypto.randomUUID();
    const gDate = new Date(grnDate);
    grnRows.push([grnId, `GRN-${grnCount.toString().padStart(5,'0')}`, allSupplierIds[randomInt(0,allSupplierIds.length-1)],
      operatorIds[randomInt(0,operatorIds.length-1)], gDate, 'Routine stock replenishment']);

    const usedSkus = new Set<string>();
    for (let j = 0; j < randomInt(3, 8); j++) {
      const prod = pickProduct();
      if (usedSkus.has(prod.sku)) continue;
      usedSkus.add(prod.sku);
      const addedQty = randomInt(20, 150);
      grnItemRows.push([crypto.randomUUID(), grnId, prod.sku, addedQty, addedQty + randomInt(0, 50), prod.costPrice, null, null]);
    }
    grnDate += randomInt(1, 2) * 86400000;
  }

  await batchInsert(pool, 'goods_receiving_notes', ['id','grn_id','supplier_id','operator_id','grn_date','notes'], grnRows);
  await batchInsert(pool, 'grn_items', ['id','grn_id','sku','added_quantity','final_quantity','unit_cost','mfd','epd'], grnItemRows);
  console.log(`   ✓ ${grnCount} GRNs with ${grnItemRows.length} items seeded`);

  // ─── PHASE 6: SEED SALES BILLS (THE BIG ONE) ─────────────────────────
  console.log('\n🧾 Phase 6: Generating historical sales bills...');
  console.log('   ⏳ This may take 1-3 minutes for ~80,000 bills...');

  const billRows: any[][] = [];
  const billItemRows: any[][] = [];
  let billCount = 0;
  const dayMs = 86400000;
  let curDay = SALES_START_DATE.getTime();

  while (curDay < endMs) {
    const dayDate = new Date(curDay);
    const month = dayDate.getUTCMonth();
    const dow = dayDate.getUTCDay();
    const billsToday = Math.round(BASE_BILLS_PER_DAY * (MONTH_MULT[month]||1) * (DOW_MULT[dow]||1) * (0.85 + Math.random() * 0.3));

    for (let b = 0; b < billsToday; b++) {
      billCount++;
      const billId = crypto.randomUUID();
      const hour = pickBillHour();
      const billDate = new Date(dayDate);
      billDate.setUTCHours(hour, randomInt(0,59), randomInt(0,59));

      const numItems = randomInt(1, 12);
      let subtotal = 0, totalQty = 0;
      const usedSkus = new Set<string>();

      for (let i = 0; i < numItems; i++) {
        const prod = pickProduct();
        if (usedSkus.has(prod.sku)) continue;
        usedSkus.add(prod.sku);
        const qty = randomInt(1, 5);
        const itemTotal = qty * prod.sellingPrice;
        subtotal += itemTotal;
        totalQty += qty;
        billItemRows.push([crypto.randomUUID(), billId, prod.sku, qty, prod.sellingPrice, itemTotal, null, null]);
      }

      const totalDiscount = Math.random() > 0.9 ? Math.round(subtotal * randomFloat(0.05, 0.15)) : 0;
      const totalBill = Math.max(0, subtotal - totalDiscount);
      const payRoll = Math.random();
      const pm = payRoll < 0.6 ? 'CASH' : payRoll < 0.9 ? 'CARD' : 'ONLINE';

      billRows.push([billId, `INV-${billCount.toString().padStart(6,'0')}`, cashierIds[randomInt(0,cashierIds.length-1)],
        subtotal, totalDiscount, totalBill, pm, false, totalQty, billDate]);
    }

    curDay += dayMs;
    const daysDone = Math.round((curDay - SALES_START_DATE.getTime()) / dayMs);
    const totalDays = Math.round((endMs - SALES_START_DATE.getTime()) / dayMs);
    if (daysDone % 100 === 0) console.log(`   📊 Progress: ${daysDone}/${totalDays} days — ${billCount.toLocaleString()} bills`);
  }

  console.log(`   📊 Generated ${billCount.toLocaleString()} bills with ${billItemRows.length.toLocaleString()} items`);
  console.log('   💾 Inserting bills...');
  await batchInsert(pool, 'sales_bills',
    ['id','bill_number','cashier_id','subtotal','total_discount','total_bill','payment_method','draft','total_qty','created_at'],
    billRows, 1000, { 6: '"PaymentMethod"' });
  console.log('   💾 Inserting bill items...');
  await batchInsert(pool, 'sales_bill_items',
    ['id','bill_id','sku','qty','unit_price','total','discount_id','discount_value'],
    billItemRows, 1000);
  console.log('   ✓ Sales bills inserted');

  // ─── PHASE 7: STOCK ADJUSTMENTS ──────────────────────────────────────
  console.log('\n⚖️ Phase 7: Generating stock adjustments...');
  const adjReasons = ['DAMAGED','LOST','EXPIRED','RETURNED','COUNTING_ERROR','SYSTEM_CORRECTION'] as const;
  const adjRows: any[][] = [];
  for (let i = 0; i < 350; i++) {
    const prod = pickProduct();
    const reason = adjReasons[randomInt(0, adjReasons.length-1)];
    const qtyChanged = reason === 'RETURNED' ? randomInt(1, 5) : -randomInt(1, 15);
    if (qtyChanged === 0) continue;
    adjRows.push([crypto.randomUUID(), prod.sku, qtyChanged, reason, operatorIds[randomInt(0,operatorIds.length-1)],
      Math.max(0, randomInt(10,100)+qtyChanged), randomDate(SALES_START_DATE, SALES_END_DATE)]);
  }
  await batchInsert(pool, 'stock_adjustments',
    ['id','sku','qty_changed','reason','adjusted_by','final_quantity','created_at'],
    adjRows, 500, { 3: '"AdjustmentReason"' });
  console.log(`   ✓ ${adjRows.length} stock adjustments seeded`);

  // ─── PHASE 8: DISCOUNT CAMPAIGNS ─────────────────────────────────────
  console.log('\n🏷️ Phase 8: Seeding discount campaigns...');
  let discountCount = 0;

  // Helper: find product by name fragment
  const findProd = (frag: string) => allProducts.find(p => p.name.includes(frag));
  const pRice = findProd('Nadu Rice 5Kg'), pTea = findProd('Tea Dust 200g'),
        pMilk = findProd('Anchor Full Cream Milk Powder 400g'), pBread = findProd('Sliced Bread'),
        pLemonPuff = findProd('Lemon Puff 200g'), pCoffee = findProd('Nescafe Classic 100g'),
        pIceCream = findProd('Elephant House Vanilla Ice Cream 1L'), pDhal = findProd('Mysore Dhal 1Kg'),
        pOil = findProd('Coconut Oil 1L'), pSugar = findProd('White Sugar 1Kg'),
        pSoap = findProd('Lifebuoy Soap Total 10 100g'), pDetergent = findProd('Surf Excel Detergent Powder 1Kg'),
        pChocolate = findProd('Kandos Milk Chocolate 100g'), pBiscuit = findProd('Cream Cracker 330g');

  // Helper to create seasonal discounts
  async function createSeasonalDiscount(name: string, value: number, label: string, imgUrl: string,
    start: string, end: string, isActive: boolean, skus: string[]) {
    await prisma.discount.create({ data: { name, type: 'SEASONAL', discountValue: value, label, imageUrl: imgUrl,
      startDate: new Date(start), endDate: new Date(end), isActive, approvalStatus: 'APPROVED',
      discountProducts: { create: skus.map(sku => ({ sku })) } } });
    discountCount++;
  }

  // Seasonal campaigns across 2024–2026
  if (pRice && pDhal)
    await createSeasonalDiscount('Avurudu Mega Sale 2024', 20, 'Avurudu 2024 🎉', 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&q=80', '2024-04-01','2024-04-21', false, [pRice.sku,pDhal.sku]);
  if (pChocolate && pIceCream)
    await createSeasonalDiscount('Christmas Joy Sale 2024', 25, 'Christmas 2024 🎄', 'https://images.unsplash.com/photo-1512389142860-9c449e58a814?w=600&q=80', '2024-12-15','2025-01-05', false, [pChocolate.sku,pIceCream.sku]);
  if (pSugar && pOil)
    await createSeasonalDiscount('Vesak Blessings Sale 2025', 15, 'Vesak Special 🪷', 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80', '2025-05-01','2025-05-20', false, [pSugar.sku,pOil.sku]);
  if (pRice && pSugar)
    await createSeasonalDiscount('Avurudu Mega Sale 2025', 25, 'Avurudu 2025 🎊', 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&q=80', '2025-04-01','2025-04-21', false, [pRice.sku,pSugar.sku]);
  if (pChocolate && pBiscuit)
    await createSeasonalDiscount('Christmas Cheer Sale 2025', 30, 'Christmas 2025 🎅', 'https://images.unsplash.com/photo-1512389142860-9c449e58a814?w=600&q=80', '2025-12-15','2026-01-05', false, [pChocolate.sku,pBiscuit.sku]);
  if (pBread && pMilk)
    await createSeasonalDiscount('Back to School 2026', 10, 'School Opening 📚', 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&q=80', '2026-01-05','2026-01-31', false, [pBread.sku,pMilk.sku]);
  if (pTea && pSugar)
    await createSeasonalDiscount('Independence Day Special 2026', 12, 'Feb 4th 🇱🇰', 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80', '2026-02-01','2026-02-10', false, [pTea.sku,pSugar.sku]);
  if (pRice && pDhal && pOil)
    await createSeasonalDiscount('Avurudu Festival Sale 2026', 20, 'Avurudu 2026 🎉', 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&q=80', '2026-04-01','2026-04-21', true, [pRice.sku,pDhal.sku,pOil.sku]);

  // Daily discounts
  if (pBread) {
    await prisma.discount.create({ data: { name:'Morning Bakery Deal', type:'DAILY', discountValue:15, label:'Breakfast Special 🍞',
      imageUrl:'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80', dailyStartTime:'07:00', dailyEndTime:'10:00',
      isActive:true, approvalStatus:'APPROVED', discountProducts:{ create:[{sku:pBread.sku}] } } });
    discountCount++;
  }
  if (pIceCream) {
    await prisma.discount.create({ data: { name:'Evening Chill Deal', type:'DAILY', discountValue:10, label:'Cool Off 🍦',
      imageUrl:'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=600&q=80', dailyStartTime:'16:00', dailyEndTime:'20:00',
      isActive:true, approvalStatus:'APPROVED', discountProducts:{ create:[{sku:pIceCream.sku}] } } });
    discountCount++;
  }

  // Combo discounts
  if (pCoffee && pLemonPuff) {
    await prisma.discount.create({ data: { name:'Morning Ritual Combo', type:'COMBO', discountValue:20, label:'Morning Ritual ☕',
      imageUrl:'https://images.unsplash.com/photo-1559553156-2e97137af16f?w=600&q=80', isActive:true, approvalStatus:'APPROVED',
      comboItems:{ create:[{sku:pCoffee.sku,minQty:1},{sku:pLemonPuff.sku,minQty:1}] } } });
    discountCount++;
  }
  if (pRice && pDhal && pOil) {
    await prisma.discount.create({ data: { name:'Family Meal Bundle', type:'COMBO', discountValue:15, label:'Family Saver 👨‍👩‍👧‍👦',
      imageUrl:'https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=600&q=80', isActive:true, approvalStatus:'APPROVED',
      comboItems:{ create:[{sku:pRice.sku,minQty:1},{sku:pDhal.sku,minQty:1},{sku:pOil.sku,minQty:1}] } } });
    discountCount++;
  }
  if (pSoap && pDetergent) {
    await prisma.discount.create({ data: { name:'Clean Home Bundle', type:'COMBO', discountValue:12, label:'Clean & Fresh 🧹',
      imageUrl:'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=600&q=80', isActive:true, approvalStatus:'DRAFT',
      comboItems:{ create:[{sku:pSoap.sku,minQty:2},{sku:pDetergent.sku,minQty:1}] } } });
    discountCount++;
  }
  if (pTea && pBread) {
    await prisma.discount.create({ data: { name:'Breakfast Starter Pack', type:'COMBO', discountValue:10, label:'Breakfast Pack 🌅',
      imageUrl:'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=600&q=80', isActive:true, approvalStatus:'APPROVED',
      comboItems:{ create:[{sku:pTea.sku,minQty:1},{sku:pBread.sku,minQty:1}] } } });
    discountCount++;
  }

  // Bill threshold discounts
  await prisma.discount.create({ data: { name:'Super Saver – Rs. 5000+', type:'BILL', discountValue:5, minBillAmount:5000, label:'BILL SAVER 💰', isActive:true, approvalStatus:'APPROVED' } });
  await prisma.discount.create({ data: { name:'Mega Saver – Rs. 10000+', type:'BILL', discountValue:10, minBillAmount:10000, label:'MEGA DEAL 🔥', isActive:true, approvalStatus:'APPROVED' } });
  discountCount += 2;
  console.log(`   ✓ ${discountCount} discount campaigns seeded`);

  // ─── PHASE 9: SEED REFUNDS ───────────────────────────────────────────
  console.log('\n🔄 Phase 9: Generating refunds...');
  const refundBillCount = Math.min(400, Math.round(billCount * 0.005));
  const refundBills = await pool.query(`SELECT id, cashier_id, created_at FROM sales_bills ORDER BY RANDOM() LIMIT $1`, [refundBillCount]);

  const refundRows: any[][] = [];
  const refundItemRows: any[][] = [];
  let refundNum = 1;

  for (const bill of refundBills.rows) {
    const items = await pool.query(`SELECT sku, qty, unit_price FROM sales_bill_items WHERE bill_id = $1 LIMIT 2`, [bill.id]);
    if (items.rows.length === 0) continue;

    const refundId = crypto.randomUUID();
    let totalRefund = 0;
    const itemCount = Math.min(items.rows.length, randomInt(1, 2));
    for (let i = 0; i < itemCount; i++) {
      const item = items.rows[i];
      const rqty = Math.min(item.qty, randomInt(1, 2));
      const rval = rqty * item.unit_price;
      totalRefund += rval;
      refundItemRows.push([crypto.randomUUID(), refundId, item.sku, rqty, rval]);
    }

    const refundDate = new Date(new Date(bill.created_at).getTime() + randomInt(1, 7) * 86400000);
    refundRows.push([refundId, `RF-${(refundNum++).toString().padStart(6,'0')}`, bill.id, bill.cashier_id, totalRefund, refundDate]);
  }

  if (refundRows.length > 0) {
    await batchInsert(pool, 'sales_refunds', ['id','refund_number','original_bill_id','cashier_id','refund_amount','created_at'], refundRows);
    await batchInsert(pool, 'sales_refund_items', ['id','refund_id','sku','qty','refund_value'], refundItemRows);
  }
  console.log(`   ✓ ${refundRows.length} refunds with ${refundItemRows.length} items seeded`);

  // ─── SUMMARY ─────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n' + '═'.repeat(65));
  console.log('✅ StockSense database seeding complete!');
  console.log('═'.repeat(65));
  console.log(`   📊 ${suppliersRaw.length} Suppliers (real Sri Lankan addresses)`);
  console.log(`   📂 ${categoriesRaw.length} Categories (with Unsplash images)`);
  console.log(`   📁 ${Object.keys(subCategoryMap).length} Sub-categories`);
  console.log(`   🏷️ ${brandsRaw.length} Brands`);
  console.log(`   🛒 ${totalSkus} Product SKUs (individual images, mfg/expiry dates)`);
  console.log(`   👥 5 Users (1 admin, 3 cashiers, 1 manager)`);
  console.log(`   📦 ${grnCount} Goods Receiving Notes`);
  console.log(`   🧾 ${billCount.toLocaleString()} Sales Bills`);
  console.log(`   📋 ${billItemRows.length.toLocaleString()} Bill Items`);
  console.log(`   ⚖️ ${adjRows.length} Stock Adjustments`);
  console.log(`   🏷️ ${discountCount} Discount Campaigns`);
  console.log(`   🔄 ${refundRows.length} Refunds`);
  console.log(`   ⏱️ Completed in ${elapsed} seconds`);
  console.log('═'.repeat(65));
}

main()
  .catch((e) => { console.error('❌ Seeding failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
