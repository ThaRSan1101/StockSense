import { PaymentMethod, ApprovalStatus } from '@prisma/client';
import { SeededRandom } from './deterministic-random.js';
import { ProductCatalogItem } from './product-catalog.js';
import { DiscountInput } from './discount-generator.js';
import { getHistoricalTemporalFactor } from './grn-generator.js';

export interface BillInput {
  id: string;
  billNumber: string;
  cashierId: string;
  subtotal: number;
  totalDiscount: number;
  totalBill: number;
  paymentMethod: PaymentMethod;
  draft: boolean;
  totalQty: number;
  paidAmount: number | null;
  changeAmount: number | null;
  createdAt: Date;
}

export interface BillItemInput {
  id: string;
  billId: string;
  sku: string;
  qty: number;
  unitPrice: number;
  total: number;
  discountId: string | null;
  discountValue: number | null; // per unit discount
}

let billCounter = 0;

// Authentic retail affinity pairs: Primary product name -> potential companion product names
const AFFINITY_MAP: Record<string, string[]> = {
  'Watawala Kahata Tea 200g': ['White Sugar', 'Maliban Ginger Biscuits 200g'],
  'Dilmah Premium Tea 200g': ['White Sugar', 'Munchee Cream Cracker 190g'],
  'Anchor Milk Powder 400g': ['White Sugar'],
  'Pelwatte Milk Powder 400g': ['White Sugar'],
  'Atlas CR Book 80 pgs': ['Atlas Blue Gel Pen'],
  'Harischandra Instant Noodles 350g': ['Lanka Soy Chicken Flavor 90g'],
  'Prima Special Noodles 350g': ['Lanka Soy Chicken Flavor 90g'],
  'Munchee Cream Cracker 190g': ['Highland Salted Butter 200g', 'Watawala Kahata Tea 200g'],
  'Sunlight Detergent Powder 1Kg': ['Vim Dishwash Bar 100g', 'Sunlight Soap 120g'],
};

export function generateDailyBills(
  date: Date,
  products: ProductCatalogItem[],
  runningStock: Map<string, number>,
  dailyDemands: Map<string, number>,
  activeDiscounts: DiscountInput[],
  discountProducts: { discountId: string; sku: string }[],
  discountComboItems: { discountId: string; sku: string; minQty: number }[],
  cashiers: string[],
  random: SeededRandom,
  targetBillCount: number
): { bills: BillInput[]; billItems: BillItemInput[] } {
  const bills: BillInput[] = [];
  const billItems: BillItemInput[] = [];

  const temporalFactor = getHistoricalTemporalFactor(date);

  // Filter products that are active and launched
  const availableProducts = products.filter((p) => {
    if (date < p.launchDate) return false;
    if (p.discontinuationDate && date >= p.discontinuationDate) return false;
    return true;
  });

  if (availableProducts.length === 0) {
    return { bills, billItems };
  }

  // Pre-calculate active seasonal/daily discounts mapped by SKU for today
  const skuToDiscountMap = new Map<string, DiscountInput>();
  const activeApprovedDiscounts = activeDiscounts.filter(
    (d) =>
      d.approvalStatus === ApprovalStatus.APPROVED &&
      (!d.startDate || date >= d.startDate) &&
      (!d.endDate || date <= d.endDate)
  );

  activeApprovedDiscounts.forEach((disc) => {
    if (disc.type === 'SEASONAL' || disc.type === 'DAILY') {
      const mappedSkus = discountProducts
        .filter((dp) => dp.discountId === disc.id)
        .map((dp) => dp.sku);
      mappedSkus.forEach((sku) => {
        skuToDiscountMap.set(sku, disc);
      });
    }
  });

  // Find combo discounts
  const comboDiscounts = activeApprovedDiscounts.filter((d) => d.type === 'COMBO');
  const billDiscounts = activeApprovedDiscounts.filter((d) => d.type === 'BILL');

  // Loop to generate bills
  for (let b = 0; b < targetBillCount; b++) {
    // Determine opening hours: 07:30 to 21:30
    const billTime = new Date(date);
    // Busy evening hours (17:00 to 20:00) get more probability
    let hour = 8;
    const hourRoll = random.next();
    if (hourRoll < 0.15) {
      hour = random.nextInt(7, 11); // Morning
    } else if (hourRoll < 0.35) {
      hour = random.nextInt(12, 16); // Afternoon
    } else if (hourRoll < 0.85) {
      hour = random.nextInt(17, 20); // Evening rush
    } else {
      hour = random.nextInt(21, 21); // Late night
    }
    billTime.setUTCHours(hour, random.nextInt(0, 59), random.nextInt(0, 59), 0);

    billCounter++;
    const billId = `bill-uuid-${billCounter}`;
    const billNumber = `INV-${billTime.getUTCFullYear()}-${billCounter.toString().padStart(7, '0')}`;

    // Select number of items (1 to 8)
    const itemTypeCount = random.nextInt(1, 8);
    const selectedCashier = random.pick(cashiers);

    // Is it a draft bill (0.5% probability)
    const isDraft = random.next() < 0.005;

    // Pick unique products with positive remaining demand & stock
    const candidateProducts = availableProducts.filter((p) => {
      const demand = dailyDemands.get(p.sku) || 0;
      const stock = runningStock.get(p.sku) || 0;
      return demand > 0 && stock > 0;
    });

    if (candidateProducts.length === 0) {
      // Out of active demand or stock for the day
      break;
    }

    // Pick N products weighted by remaining demand + market-basket affinity
    const chosenProducts: ProductCatalogItem[] = [];
    const tempCandidates = [...candidateProducts];
    const itemsToPick = Math.min(itemTypeCount, tempCandidates.length);

    for (let i = 0; i < itemsToPick && chosenProducts.length < 8; i++) {
      // Weighted pick based on remaining demand
      let totalWeight = 0;
      tempCandidates.forEach((p) => {
        totalWeight += dailyDemands.get(p.sku) || 0;
      });

      if (totalWeight <= 0) break;

      let rVal = random.next() * totalWeight;
      let cumulativeWeight = 0;
      let chosenIdx = 0;

      for (let j = 0; j < tempCandidates.length; j++) {
        cumulativeWeight += dailyDemands.get(tempCandidates[j].sku) || 0;
        if (rVal <= cumulativeWeight) {
          chosenIdx = j;
          break;
        }
      }

      const chosen = tempCandidates[chosenIdx];
      chosenProducts.push(chosen);
      tempCandidates.splice(chosenIdx, 1);

      // Market-Basket Affinity check: Roll to include companion product
      const companions = AFFINITY_MAP[chosen.name];
      if (companions && companions.length > 0 && random.next() < 0.60 && chosenProducts.length < 8) {
        const companionName = random.pick(companions);
        const compIdx = tempCandidates.findIndex(
          (c) =>
            c.name === companionName &&
            (runningStock.get(c.sku) || 0) > 0 &&
            (dailyDemands.get(c.sku) || 0) > 0
        );
        if (compIdx !== -1) {
          chosenProducts.push(tempCandidates[compIdx]);
          tempCandidates.splice(compIdx, 1);
        }
      }
    }

    if (chosenProducts.length === 0) continue;

    // Generate BillItems
    const currentBillItems: BillItemInput[] = [];
    let billSubtotal = 0;
    let billItemDiscountTotal = 0;
    let billQtyTotal = 0;

    chosenProducts.forEach((prod, itemIdx) => {
      const stock = runningStock.get(prod.sku) || 0;
      const remainingDemand = dailyDemands.get(prod.sku) || 0;

      if (stock <= 0) return;

      // Quantity bought (normally 1-3, occasionally bulk)
      let qty = random.nextInt(1, 3);
      if (prod.demandProfile === 'BULK_PURCHASE_SENSITIVE' && random.next() < 0.1) {
        qty = random.nextInt(5, 12);
      }

      // Cap by stock and demand
      qty = Math.min(qty, stock, Math.max(1, Math.ceil(remainingDemand)));

      if (qty <= 0) return;

      // Deduct from stock and demand if NOT draft
      if (!isDraft) {
        runningStock.set(prod.sku, stock - qty);
        dailyDemands.set(prod.sku, Math.max(0, remainingDemand - qty));
      }

      // Temporal unit price based on controlled annual progression
      const unitPrice = Math.round(prod.sellingPrice * temporalFactor);

      // Check seasonal/daily discount
      let discountId: string | null = null;
      let discountValue: number | null = null;

      const activeDisc = skuToDiscountMap.get(prod.sku);
      if (activeDisc) {
        discountId = activeDisc.id;
        discountValue = Math.round(unitPrice * (activeDisc.discountValue / 100));
      }

      const totalItemDiscount = (discountValue || 0) * qty;
      const itemSubtotal = unitPrice * qty;
      const itemTotal = itemSubtotal - totalItemDiscount;

      currentBillItems.push({
        id: `bi-uuid-${billCounter}-${itemIdx + 1}`,
        billId,
        sku: prod.sku,
        qty,
        unitPrice,
        total: itemTotal,
        discountId,
        discountValue,
      });

      billSubtotal += itemSubtotal;
      billItemDiscountTotal += totalItemDiscount;
      billQtyTotal += qty;
    });

    if (currentBillItems.length === 0) continue;

    // Apply Combo Discounts if applicable
    comboDiscounts.forEach((combo) => {
      // Find combo products
      const comboSkus = discountComboItems
        .filter((dci) => dci.discountId === combo.id)
        .map((dci) => dci.sku);

      // Check if all combo products are in this bill
      const hasAllComboParts = comboSkus.every((sku) =>
        currentBillItems.some((bi) => bi.sku === sku)
      );

      if (hasAllComboParts && combo.comboPrice !== null) {
        // Find current bill items that are part of the combo
        const comboBillItems = currentBillItems.filter((bi) => comboSkus.includes(bi.sku));
        // Original subtotal of combo items
        const originalComboSubtotal = comboBillItems.reduce((sum, bi) => sum + (bi.unitPrice * bi.qty), 0);
        
        // If combo price is cheaper than original subtotal
        if (originalComboSubtotal > combo.comboPrice) {
          const discountDiff = originalComboSubtotal - combo.comboPrice;
          // Distribute discount proportionally
          comboBillItems.forEach((bi) => {
            const portion = (bi.unitPrice * bi.qty) / originalComboSubtotal;
            const itemDisc = portion * discountDiff;
            
            // Set combo discount
            bi.discountId = combo.id;
            bi.discountValue = (bi.discountValue || 0) + (itemDisc / bi.qty);
            bi.total = (bi.unitPrice * bi.qty) - (bi.discountValue * bi.qty);
            
            // Update running sums
            billItemDiscountTotal += itemDisc;
          });
        }
      }
    });

    // Recompute item discount total to eliminate float precision drift
    billItemDiscountTotal = currentBillItems.reduce((sum, bi) => sum + ((bi.discountValue || 0) * bi.qty), 0);

    // Apply Bill-level Discounts if subtotal exceeds threshold
    let billLevelDiscount = 0;
    let appliedBillDiscountId: string | null = null;
    const eligibleBillDiscounts = billDiscounts.filter(
      (bd) => bd.minBillAmount !== null && billSubtotal >= bd.minBillAmount
    );

    if (eligibleBillDiscounts.length > 0) {
      // Pick the best discount
      const bestDiscount = eligibleBillDiscounts.reduce((prev, curr) =>
        prev.discountValue > curr.discountValue ? prev : curr
      );
      billLevelDiscount = bestDiscount.discountValue;
      appliedBillDiscountId = bestDiscount.id;
    }

    const totalDiscount = billItemDiscountTotal + billLevelDiscount;
    const totalBill = Math.max(0, billSubtotal - totalDiscount);

    // Payment details
    const paymentMethodRoll = random.next();
    let paymentMethod: PaymentMethod = PaymentMethod.CASH;
    if (paymentMethodRoll < 0.6) {
      paymentMethod = PaymentMethod.CASH;
    } else if (paymentMethodRoll < 0.9) {
      paymentMethod = PaymentMethod.CARD;
    } else {
      paymentMethod = PaymentMethod.ONLINE;
    }

    let paidAmount: number | null = null;
    let changeAmount: number | null = null;

    if (paymentMethod === PaymentMethod.CASH && !isDraft) {
      // CASH paid amount rounded to nearest 100/500/1000 higher than totalBill
      const possibleDenominations = [100, 500, 1000, 5000];
      const den = possibleDenominations.find((d) => d >= totalBill) || 5000;
      paidAmount = Math.ceil(totalBill / 100) * 100;
      if (paidAmount < totalBill) paidAmount = totalBill;
      changeAmount = paidAmount - totalBill;
    } else if (!isDraft) {
      paidAmount = totalBill;
      changeAmount = 0;
    }

    bills.push({
      id: billId,
      billNumber,
      cashierId: selectedCashier,
      subtotal: billSubtotal,
      totalDiscount,
      totalBill,
      paymentMethod,
      draft: isDraft,
      totalQty: billQtyTotal,
      paidAmount,
      changeAmount,
      createdAt: billTime,
    });

    currentBillItems.forEach((bi) => billItems.push(bi));
  }

  return { bills, billItems };
}
