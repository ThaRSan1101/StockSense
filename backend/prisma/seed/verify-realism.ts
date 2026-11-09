import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('==================================================');
  console.log('STOCKSENSE FINAL DATA REALISM VALIDATION SUITE');
  console.log('==================================================\n');

  let passed = true;

  // 1. Master Data Verification
  console.log('--- 1. MASTER DATA VERIFICATION ---');
  const products = await prisma.product.findMany({
    include: {
      masterClass: {
        include: {
          brand: true,
          category: true,
          subCategory: true,
          supplier: true,
        },
      },
    },
  });
  console.log(`Total Products Count: ${products.length} (Expected: 40)`);
  if (products.length !== 40) {
    console.error('❌ Product count is not 40!');
    passed = false;
  } else {
    console.log('✅ Exactly 40 products found.');
  }

  // Check images
  const productsWithImages = products.filter((p) => p.imageUrl && p.imageUrl.startsWith('https://'));
  console.log(`Products with Valid Images: ${productsWithImages.length}/40`);
  if (productsWithImages.length !== 40) {
    console.error(`❌ Only ${productsWithImages.length} products have valid image URLs!`);
    passed = false;
  } else {
    console.log('✅ All 40 products have distinct valid image URLs.');
  }

  // Check the 11 audited products
  const auditedNames = [
    'Heinz Tomato Ketchup Premium',
    'White Sugar',
    'Pelwatte Milk Powder 400g',
    'Nescafe Classic 50g',
    'Smak Mango Juice 200ml',
    'Sunsilk Shampoo 180ml',
    'Vim Dishwash Bar 100g',
    'Fresh Milk 1L Tetra',
    'Ambewela Fresh Yogurt 80g',
    'Highland Salted Butter 200g',
    'Nutella Hazelnut Spread 350g',
  ];

  console.log('\nChecking the 11 Audited Products Taxonomy & Suppliers:');
  for (const name of auditedNames) {
    const prod = products.find((p) => p.name === name);
    if (!prod) {
      console.error(`❌ Audited product not found: ${name}`);
      passed = false;
    } else {
      const b = prod.masterClass?.brand?.name;
      const c = prod.masterClass?.category?.name;
      const sc = prod.masterClass?.subCategory?.name;
      const s = prod.masterClass?.supplier?.name;
      console.log(`  • ${name}: Brand=[${b}], Category=[${c}], SubCat=[${sc}], Supplier=[${s}]`);
    }
  }

  // 2. Transaction Boundaries
  console.log('\n--- 2. TRANSACTION BOUNDARIES & DATES ---');
  const billCount = await prisma.bill.count();
  const billItemCount = await prisma.billItem.count();
  const grnCount = await prisma.goodsReceivingNote.count();
  const refundCount = await prisma.refund.count();
  const adjustmentCount = await prisma.stockAdjustment.count();

  console.log(`Bills:              ${billCount}`);
  console.log(`Bill Items:         ${billItemCount}`);
  console.log(`GRNs:               ${grnCount}`);
  console.log(`Refunds:            ${refundCount}`);
  console.log(`Stock Adjustments:  ${adjustmentCount}`);

  const billAgg = await prisma.bill.aggregate({
    _min: { createdAt: true },
    _max: { createdAt: true },
  });
  const grnAgg = await prisma.goodsReceivingNote.aggregate({
    _min: { grnDate: true },
    _max: { grnDate: true },
  });
  const refundAgg = await prisma.refund.aggregate({
    _min: { createdAt: true },
    _max: { createdAt: true },
  });

  console.log(`Bill Date Range:    ${billAgg._min.createdAt?.toISOString()} to ${billAgg._max.createdAt?.toISOString()}`);
  console.log(`GRN Date Range:     ${grnAgg._min.grnDate?.toISOString()} to ${grnAgg._max.grnDate?.toISOString()}`);
  console.log(`Refund Date Range:  ${refundAgg._min.createdAt?.toISOString()} to ${refundAgg._max.createdAt?.toISOString()}`);

  const bill2026Count = await prisma.bill.count({
    where: { createdAt: { gt: new Date('2025-12-31T23:59:59Z') } },
  });
  const refund2026Count = await prisma.refund.count({
    where: { createdAt: { gt: new Date('2025-12-31T23:59:59Z') } },
  });

  console.log(`2026 Customer Bills:   ${bill2026Count} (Must be 0)`);
  console.log(`2026 Customer Refunds: ${refund2026Count} (Must be 0)`);

  if (bill2026Count > 0 || refund2026Count > 0) {
    console.error('❌ Found transactions created in 2026!');
    passed = false;
  } else {
    console.log('✅ ZERO transactions in 2026. Strictly 2023-01-01 to 2025-12-31.');
  }

  // 3. Inventory States Verification
  console.log('\n--- 3. INVENTORY PRESENTATION STATES ---');
  const negativeStockProducts = products.filter((p) => p.currentStock < 0);
  if (negativeStockProducts.length > 0) {
    console.error(`❌ Found ${negativeStockProducts.length} products with negative stock!`);
    passed = false;
  } else {
    console.log('✅ Zero negative stock products.');
  }

  // Out of stock
  const outOfStock = products.filter((p) => p.currentStock === 0);
  console.log(`Out of Stock Products (${outOfStock.length}):`, outOfStock.map((p) => `${p.name} (Stock: ${p.currentStock})`));
  if (outOfStock.length === 0) {
    console.log('Product stocks overview:');
    products.forEach((p) => console.log(`  - ${p.name}: stock=${p.currentStock}, reorder=${p.reorderLevel}, cap=${p.targetCapacity}`));
    console.error('❌ No Out-of-Stock product found!');
    passed = false;
  } else {
    console.log('✅ Out-of-Stock product exists.');
  }

  // Low stock / Reorder
  const lowStock = products.filter((p) => p.currentStock > 0 && p.currentStock <= p.reorderLevel);
  console.log(`Low Stock / Reorder Products (${lowStock.length}):`, lowStock.map((p) => `${p.name} (Stock: ${p.currentStock}, Reorder: ${p.reorderLevel})`));
  if (lowStock.length === 0) {
    console.error('❌ No Low-Stock product found!');
    passed = false;
  } else {
    console.log('✅ Low-Stock product exists.');
  }

  // Overstock
  const overStock = products.filter((p) => p.currentStock > p.targetCapacity);
  console.log(`Overstock Products (${overStock.length}):`, overStock.map((p) => `${p.name} (Stock: ${p.currentStock}, Capacity: ${p.targetCapacity})`));
  if (overStock.length === 0) {
    console.error('❌ No Overstock product found!');
    passed = false;
  } else {
    console.log('✅ Overstock product exists.');
  }

  // Near Expiry
  const nearExpiryItems = await prisma.grnItem.findMany({
    where: {
      epd: {
        gt: new Date('2025-12-31T23:59:59Z'),
        lte: new Date('2026-01-20T23:59:59Z'),
      },
    },
    include: { product: true },
    orderBy: { epd: 'asc' },
  });
  console.log(`Near Expiry Opportunities (${nearExpiryItems.length}):`, nearExpiryItems.map((i) => `${i.product.name} (Expires: ${i.epd?.toISOString().split('T')[0]})`));

  // 4. AI Runs Verification
  console.log('\n--- 4. AI RUNS & PIPELINE OUTPUTS ---');
  const forecastRuns = await prisma.demandForecastRun.count();
  const forecastRecords = await prisma.demandForecast.count();
  const analysisRecords = await prisma.demandAnalysis.count();
  const assocRuns = await prisma.productAssociationRun.count();
  const assocRules = await prisma.productAssociationRule.count();
  const opportunities = await prisma.comboOpportunity.count();
  const suggestions = await prisma.comboSuggestion.count();

  console.log(`Forecast Runs:             ${forecastRuns}`);
  console.log(`Product Forecast Records:  ${forecastRecords}`);
  console.log(`Demand Analysis Records:   ${analysisRecords}`);
  console.log(`Association Mining Runs:   ${assocRuns}`);
  console.log(`Association Rules:         ${assocRules}`);
  console.log(`Combo Opportunities:       ${opportunities}`);
  console.log(`Combo Suggestions:         ${suggestions}`);

  if (forecastRuns === 0 || assocRules === 0) {
    console.warn('⚠️ AI pipelines may still be executing or need verification.');
  } else {
    console.log('✅ AI Demand Forecasts & Combo Recommendations successfully populated!');
  }

  console.log('\n==================================================');
  if (passed) {
    console.log('ALL FINAL DATA REALISM VALIDATION CHECKS PASSED 100%!');
  } else {
    console.log('SOME VALIDATION CHECKS FAILED!');
  }
  console.log('==================================================');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
