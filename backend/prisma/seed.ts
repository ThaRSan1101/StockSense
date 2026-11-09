import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

import {
  SEED_MODE,
  START_DATE,
  END_DATE,
  PRODUCT_COUNT,
  INACTIVE_PRODUCT_COUNT,
  BILL_TARGET_COUNT,
  RANDOM_SEED,
} from './seed/config.js';
import { SeededRandom } from './seed/deterministic-random.js';
import { generateMasterData } from './seed/master-data.js';
import { generateProductCatalog, ProductCatalogItem } from './seed/product-catalog.js';
import { calculateDailyDemand } from './seed/daily-demand-simulator.js';
import { generateDiscounts } from './seed/discount-generator.js';
import { createRestockGrn, GrnInput, GrnItemInput } from './seed/grn-generator.js';
import { generateDailyBills, BillInput, BillItemInput } from './seed/bill-generator.js';
import { generateRefundsForBills, RefundInput, RefundItemInput } from './seed/refund-generator.js';
import { generateDailyAdjustments, StockAdjustmentInput } from './seed/adjustment-generator.js';
import { runValidationChecks } from './seed/validation.js';
import { batchInsert } from './seed/batch-insert.js';
import { seedComboSettings } from './seed/seed_combo_settings.js';

// Driver adapter connection setup matching existing pattern
const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const startTime = Date.now();
  console.log(`==================================================`);
  console.log(`STOCK SENSE DETERMINISTIC SEEDER`);
  console.log(`==================================================`);
  console.log(`Seed Mode:   ${SEED_MODE.toUpperCase()}`);
  console.log(`Random Seed: ${RANDOM_SEED}`);
  console.log(`Date Range:  ${START_DATE.toISOString().split('T')[0]} to ${END_DATE.toISOString().split('T')[0]}`);
  console.log(`--------------------------------------------------`);

  const random = new SeededRandom(RANDOM_SEED);

  // 1. Clear database tables dynamically
  console.log('Clearing existing operational and master data...');
  const tables = await prisma.$queryRawUnsafe<any[]>(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE' 
      AND table_name != '_prisma_migrations';
  `);

  for (const t of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${t.table_name}" CASCADE;`);
    } catch (err: any) {
      console.warn(`Could not truncate ${t.table_name}:`, err.message);
    }
  }
  console.log('Database cleared.');

  // 2. Generate Master Data
  console.log('Generating master records (users, suppliers, categories, subcategories, brands)...');
  const master = generateMasterData(random);

  // 3. Generate Catalog
  console.log(`Generating product catalog (Active: ${PRODUCT_COUNT}, Inactive: ${INACTIVE_PRODUCT_COUNT})...`);
  const catalog = generateProductCatalog(
    random,
    master.categories,
    master.subCategories,
    master.brands,
    master.suppliers,
    PRODUCT_COUNT,
    INACTIVE_PRODUCT_COUNT
  );

  // 4. Generate Discounts
  console.log('Generating discount campaigns...');
  const discountData = generateDiscounts(random, catalog.products);

  // 5. Initialize chronological variables
  const runningStock = new Map<string, number>();
  // Initialize all products with 0 stock
  catalog.products.forEach((p: ProductCatalogItem) => {
    runningStock.set(p.sku, 0);
  });

  const grns: GrnInput[] = [];
  const grnItems: GrnItemInput[] = [];
  const bills: BillInput[] = [];
  const billItems: BillItemInput[] = [];
  const refunds: RefundInput[] = [];
  const refundItems: RefundItemInput[] = [];
  const adjustments: StockAdjustmentInput[] = [];

  const cashiers = master.users.filter((u: any) => u.role === 'CASHIER').map((u: any) => u.id);
  const operatorId = master.users.find((u: any) => u.role === 'INVENTORY_MANAGER' || u.role === 'ADMIN')?.id || master.users[0].id;

  // Average daily bills calculation
  const totalDays = Math.ceil((END_DATE.getTime() - START_DATE.getTime()) / (24 * 3600 * 1000));
  const baseAverageBillsPerDay = BILL_TARGET_COUNT / totalDays;

  console.log(`Starting daily simulation for ${totalDays} days...`);

  // Chronological daily loop
  const currentDate = new Date(START_DATE);
  while (currentDate <= END_DATE) {
    const dateStr = currentDate.toISOString().split('T')[0];

    // Check restocking triggers (GRNs)
    const restockItems: { product: ProductCatalogItem; currentStock: number; addedQty: number }[] = [];
    catalog.products.forEach((prod: ProductCatalogItem) => {
      // Products can only be restocked if launched and not discontinued
      if (currentDate < prod.launchDate) return;
      if (prod.discontinuationDate && currentDate > prod.discontinuationDate) return;

      const stock = runningStock.get(prod.sku) || 0;

      // Controlled presentation scenarios in late 2025:
      // 1. Out of stock: Sunlight Soap has supplier factory maintenance after Aug 15, 2025
      if (currentDate >= new Date('2025-08-15T00:00:00Z') && prod.name.includes('Sunlight Soap 120g')) {
        return; // do not restock; sales will naturally deplete stock to 0
      }

      // 2. Low stock / Reorder needed: Anchor Milk Powder experiences delivery delay after Oct 15, 2025
      if (currentDate >= new Date('2025-10-15T00:00:00Z') && prod.name.includes('Anchor Milk Powder 400g')) {
        return; // do not restock; sales bring stock below reorder level (75)
      }

      // Initial restock on launch day or when below reorderLevel
      const isLaunchDay = currentDate.getTime() - prod.launchDate.getTime() < 24 * 3600 * 1000;
      if (isLaunchDay && stock === 0) {
        restockItems.push({
          product: prod,
          currentStock: 0,
          addedQty: prod.targetCapacity,
        });
      } else if (stock <= prod.reorderLevel) {
        // Trigger restocking up to target capacity
        let needed = prod.targetCapacity - stock;

        // 3. Overstock: Prima Wheat Flour receives extra seasonal shipment on Dec 15, 2025
        if (dateStr === '2025-12-15' && prod.name.includes('Prima Wheat Flour')) {
          needed += 350;
        }

        if (needed > 0) {
          restockItems.push({
            product: prod,
            currentStock: stock,
            addedQty: needed,
          });
        }
      } else if (dateStr === '2025-12-15' && prod.name.includes('Prima Wheat Flour')) {
        // Bulk overstock delivery on Dec 15
        restockItems.push({
          product: prod,
          currentStock: stock,
          addedQty: 350,
        });
      }
    });

    if (restockItems.length > 0) {
      // Group restocks by supplier to make realistic GRNs
      const supplierGroups = new Map<string, typeof restockItems>();
      restockItems.forEach((item) => {
        if (!supplierGroups.has(item.product.supplierId)) {
          supplierGroups.set(item.product.supplierId, []);
        }
        supplierGroups.get(item.product.supplierId)!.push(item);
      });

      supplierGroups.forEach((items: any, supplierId: string) => {
        // Create GRN
        const grnResult = createRestockGrn(new Date(currentDate), supplierId, operatorId, items, random);
        grns.push(grnResult.grn);
        grnResult.grnItems.forEach((gi: GrnItemInput) => {
          grnItems.push(gi);
          // Apply restock to running stock immediately
          runningStock.set(gi.sku, gi.finalQuantity);
        });
      });
    }

    // Calculate daily demands
    const dailyDemands = new Map<string, number>();
    catalog.products.forEach((prod: ProductCatalogItem) => {
      const demand = calculateDailyDemand(new Date(currentDate), prod, discountData.discounts, random);
      dailyDemands.set(prod.sku, demand);
    });

    // Determine target bill count for today
    const dayOfWeek = currentDate.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const month = currentDate.getUTCMonth() + 1;

    let dayMultiplier = 1.0;
    if (isWeekend) dayMultiplier *= 1.45; // Higher traffic on weekends
    if (month === 12) dayMultiplier *= 1.35; // December shopping spike
    if (month === 4) dayMultiplier *= 1.25;  // April Avurudu spike
    if (month === 1) dayMultiplier *= 1.15;  // January school season spike

    const targetBills = Math.max(
      1,
      Math.round(baseAverageBillsPerDay * dayMultiplier * random.nextFloat(0.8, 1.2))
    );

    // Generate Bills & BillItems
    const salesResult = generateDailyBills(
      new Date(currentDate),
      catalog.products,
      runningStock,
      dailyDemands,
      discountData.discounts,
      discountData.discountProducts,
      discountData.discountComboItems,
      cashiers,
      random,
      targetBills
    );

    salesResult.bills.forEach((b: BillInput) => bills.push(b));
    salesResult.billItems.forEach((bi: BillItemInput) => billItems.push(bi));

    // Generate Refunds (1% of today's completed bills)
    const refundResult = generateRefundsForBills(
      salesResult.bills,
      salesResult.billItems,
      runningStock,
      cashiers,
      random
    );
    refundResult.refunds.forEach((r: RefundInput) => refunds.push(r));
    refundResult.refundItems.forEach((ri: RefundItemInput) => refundItems.push(ri));

    // Generate Stock Adjustments
    const adjResult = generateDailyAdjustments(new Date(currentDate), catalog.products, runningStock, cashiers, random);
    adjResult.forEach((adj: StockAdjustmentInput) => adjustments.push(adj));

    // Increment current date
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  console.log('Chronological simulation finished.');

  // 6. Set final product stock values as of 2025-12-31
  const productsToInsert = catalog.products.map((p: ProductCatalogItem) => ({
    sku: p.sku,
    masterId: p.masterId,
    barcode: p.barcode,
    name: p.name,
    unitType: p.unitType,
    costPrice: p.costPrice,
    sellingPrice: p.sellingPrice,
    currentStock: runningStock.get(p.sku) || 0,
    reorderLevel: p.reorderLevel,
    targetCapacity: p.targetCapacity,
    status: p.status,
    seasonal: p.seasonal,
    imageUrl: p.imageUrl,
    createdAt: p.launchDate,
    updatedAt: new Date('2025-12-31T23:59:59Z'),
  }));

  // 7. Validate all generated data BEFORE database insertion
  runValidationChecks(
    catalog.products,
    discountData.discounts,
    discountData.discountProducts,
    discountData.discountComboItems,
    grns,
    grnItems,
    bills,
    billItems,
    refunds,
    refundItems,
    adjustments,
    runningStock
  );

  // 8. Batch Insert in precise foreign-key dependency order
  console.log('\n[Database Insertion] Writing seeded data to PostgreSQL database...');

  await batchInsert(prisma, 'user', master.users, 'Users');
  await batchInsert(prisma, 'supplier', master.suppliers, 'Suppliers');
  await batchInsert(prisma, 'category', master.categories, 'Categories');
  await batchInsert(prisma, 'subCategory', master.subCategories, 'Subcategories');
  await batchInsert(prisma, 'brand', master.brands, 'Brands');
  await batchInsert(prisma, 'masterProductClass', catalog.masterClasses, 'MasterProductClasses');
  await batchInsert(prisma, 'product', productsToInsert, 'Products');
  await batchInsert(prisma, 'discount', discountData.discounts, 'Discounts');
  await batchInsert(prisma, 'discountProduct', discountData.discountProducts, 'DiscountProducts');
  await batchInsert(prisma, 'discountComboItem', discountData.discountComboItems, 'DiscountComboItems');
  await batchInsert(prisma, 'goodsReceivingNote', grns, 'GoodsReceivingNotes');
  await batchInsert(prisma, 'grnItem', grnItems, 'GrnItems');
  await batchInsert(prisma, 'bill', bills, 'Bills');
  await batchInsert(prisma, 'billItem', billItems, 'BillItems');
  await batchInsert(prisma, 'refund', refunds, 'Refunds');
  await batchInsert(prisma, 'refundItem', refundItems, 'RefundItems');
  await batchInsert(prisma, 'stockAdjustment', adjustments, 'StockAdjustments');

  await seedComboSettings(prisma);

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

  // 9. Seeding Summary Report
  console.log(`\n==================================================`);
  console.log(`SEEDING PROCESS SUMMARY REPORT`);
  console.log(`==================================================`);
  console.log(`Status:              SUCCESS`);
  console.log(`Seed Mode:           ${SEED_MODE.toUpperCase()}`);
  console.log(`Random Seed:         ${RANDOM_SEED}`);
  console.log(`Simulated Period:    ${START_DATE.toISOString().split('T')[0]} to ${END_DATE.toISOString().split('T')[0]}`);
  console.log(`--------------------------------------------------`);
  console.log(`Users:               ${master.users.length}`);
  console.log(`Suppliers:           ${master.suppliers.length}`);
  console.log(`Categories:          ${master.categories.length}`);
  console.log(`Subcategories:       ${master.subCategories.length}`);
  console.log(`Brands:              ${master.brands.length}`);
  console.log(`Products:            ${productsToInsert.length}`);
  console.log(`Discounts Mapped:    ${discountData.discountProducts.length} seasonal/daily, ${discountData.discountComboItems.length} combos`);
  console.log(`Goods Recv Notes:    ${grns.length}`);
  console.log(`GRN Items:           ${grnItems.length}`);
  console.log(`Sales Bills:         ${bills.length} (${bills.filter(b => b.draft).length} Draft)`);
  console.log(`Bill Items:          ${billItems.length}`);
  console.log(`Refunds:             ${refunds.length}`);
  console.log(`Refund Items:        ${refundItems.length}`);
  console.log(`Stock Adjustments:   ${adjustments.length}`);
  console.log(`Total Sales Qty:     ${billItems.reduce((acc: number, curr: BillItemInput) => acc + curr.qty, 0)}`);
  
  // Final inventory valuation
  const inventoryValue = productsToInsert.reduce((val: number, p: any) => val + p.currentStock * p.costPrice, 0);
  console.log(`Final Inv Value:     LKR ${inventoryValue.toLocaleString()}`);
  
  // Profile breakdown
  const profileBreakdown: Record<string, number> = {};
  catalog.products.forEach((p: ProductCatalogItem) => {
    profileBreakdown[p.demandProfile] = (profileBreakdown[p.demandProfile] || 0) + 1;
  });
  console.log(`\nDemand Profile Distribution:`);
  Object.keys(profileBreakdown).forEach((prof: string) => {
    console.log(`  - ${prof}: ${profileBreakdown[prof]} products`);
  });

  console.log(`--------------------------------------------------`);
  console.log(`Validation Results:  Passed 100%`);
  console.log(`Total Execution Time: ${totalDuration}s`);
  console.log(`==================================================\n`);
}

main()
  .catch((e) => {
    console.error('Fatal seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
