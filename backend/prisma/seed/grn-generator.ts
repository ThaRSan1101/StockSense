import { SeededRandom } from './deterministic-random.js';
import { ProductCatalogItem } from './product-catalog.js';

export interface GrnInput {
  id: string;
  grnId: string;
  supplierId: string;
  operatorId: string;
  grnDate: Date;
  notes: string | null;
}

export interface GrnItemInput {
  id: string;
  grnId: string;
  sku: string;
  addedQuantity: number;
  finalQuantity: number;
  unitCost: number;
  mfd: Date | null;
  epd: Date | null;
}

/**
 * Calculates a controlled, realistic historical temporal factor across 2023-2025.
 * 2023: scales ~0.88 to 0.92
 * 2024: scales ~0.93 to 0.97
 * 2025: scales ~0.98 to 1.00
 */
export function getHistoricalTemporalFactor(date: Date): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-11
  const monthIndex = Math.max(0, Math.min(35, (year - 2023) * 12 + month));
  const factor = 0.88 + 0.12 * (monthIndex / 35);
  return Number(factor.toFixed(4));
}

let grnCounter = 0;

export function createRestockGrn(
  date: Date,
  supplierId: string,
  operatorId: string,
  restockItems: { product: ProductCatalogItem; currentStock: number; addedQty: number }[],
  random: SeededRandom
): { grn: GrnInput; grnItems: GrnItemInput[] } {
  grnCounter++;
  const grnId = `GRN-${date.getUTCFullYear()}-${grnCounter.toString().padStart(6, '0')}`;
  const dbGrnId = `grn-uuid-${grnCounter}`;

  const grn: GrnInput = {
    id: dbGrnId,
    grnId,
    supplierId,
    operatorId,
    grnDate: date,
    notes: `Restock shipment received on ${date.toISOString().split('T')[0]}`,
  };

  const temporalFactor = getHistoricalTemporalFactor(date);

  let itemIdx = 0;
  const grnItems: GrnItemInput[] = restockItems.map((item) => {
    itemIdx++;
    const finalQty = item.currentStock + item.addedQty;
    
    // Manufacturing date is 5 to 15 days before GRN date
    const mfd = new Date(date);
    mfd.setUTCDate(mfd.getUTCDate() - random.nextInt(5, 15));

    // Expiry date is based on shelf life
    let epd: Date | null = null;
    if (item.product.shelfLifeDays) {
      epd = new Date(mfd);
      epd.setUTCDate(epd.getUTCDate() + item.product.shelfLifeDays);
    }

    const unitCost = Math.round(item.product.costPrice * temporalFactor);

    return {
      id: `grni-uuid-${grnCounter}-${itemIdx}`,
      grnId: dbGrnId,
      sku: item.product.sku,
      addedQuantity: item.addedQty,
      finalQuantity: finalQty,
      unitCost,
      mfd,
      epd,
    };
  });

  return { grn, grnItems };
}
