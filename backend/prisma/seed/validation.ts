import { ProductCatalogItem } from './product-catalog.js';
import { DiscountInput, DiscountProductInput, DiscountComboItemInput } from './discount-generator.js';
import { BillInput, BillItemInput } from './bill-generator.js';
import { GrnInput, GrnItemInput } from './grn-generator.js';
import { RefundInput, RefundItemInput } from './refund-generator.js';
import { StockAdjustmentInput } from './adjustment-generator.js';

export function runValidationChecks(
  products: ProductCatalogItem[],
  discounts: DiscountInput[],
  discountProducts: DiscountProductInput[],
  discountComboItems: DiscountComboItemInput[],
  grns: GrnInput[],
  grnItems: GrnItemInput[],
  bills: BillInput[],
  billItems: BillItemInput[],
  refunds: RefundInput[],
  refundItems: RefundItemInput[],
  adjustments: StockAdjustmentInput[],
  finalStocks: Map<string, number>
) {
  console.log('\n[Validation] Running comprehensive data validation checks...');

  const errors: string[] = [];

  // Helper to log error
  const addError = (msg: string) => {
    errors.push(msg);
  };

  const productMap = new Map(products.map((p) => [p.sku, p]));
  const discountMap = new Map(discounts.map((d) => [d.id, d]));
  const billMap = new Map(bills.map((b) => [b.id, b]));

  // 1. Historical dates check: only between 2023-01-01 and 2025-12-31
  const minDate = new Date('2023-01-01T00:00:00Z');
  const maxDate = new Date('2025-12-31T23:59:59Z');

  bills.forEach((b) => {
    if (b.createdAt < minDate || b.createdAt > maxDate) {
      addError(`Bill ${b.billNumber} has date ${b.createdAt.toISOString()} out of range.`);
    }
  });

  grns.forEach((g) => {
    if (g.grnDate < minDate || g.grnDate > maxDate) {
      addError(`GRN ${g.grnId} has date ${g.grnDate.toISOString()} out of range.`);
    }
  });

  adjustments.forEach((a) => {
    if (a.createdAt < minDate || a.createdAt > maxDate) {
      addError(`Adjustment ${a.id} has date ${a.createdAt.toISOString()} out of range.`);
    }
  });

  refunds.forEach((r) => {
    if (r.createdAt < minDate || r.createdAt > maxDate) {
      addError(`Refund ${r.refundNumber} has date ${r.createdAt.toISOString()} out of range.`);
    }
  });

  // No January 2026 sales
  const jan2026 = new Date('2026-01-01T00:00:00Z');
  bills.forEach((b) => {
    if (b.createdAt >= jan2026) {
      addError(`Bill ${b.billNumber} has date in Jan 2026 or later: ${b.createdAt.toISOString()}`);
    }
  });

  // 2. Stock levels must match final computed stocks, and no negative stocks
  finalStocks.forEach((stock, sku) => {
    if (stock < 0) {
      addError(`Product ${sku} has negative final stock: ${stock}`);
    }
    const prod = productMap.get(sku);
    if (prod && prod.status === 'ACTIVE' && stock < 0) {
      addError(`Active product ${sku} has negative stock.`);
    }
  });

  // 3. Bill Items validations
  const billToItemsMap = new Map<string, BillItemInput[]>();
  billItems.forEach((bi) => {
    if (!billToItemsMap.has(bi.billId)) {
      billToItemsMap.set(bi.billId, []);
    }
    billToItemsMap.get(bi.billId)!.push(bi);

    // Orphan check
    if (!billMap.has(bi.billId)) {
      addError(`BillItem ${bi.id} references non-existent Bill ID ${bi.billId}`);
    }
    // Product existence check
    const prod = productMap.get(bi.sku);
    if (!prod) {
      addError(`BillItem ${bi.id} references non-existent SKU ${bi.sku}`);
    } else {
      // No sales before product launch date
      const bill = billMap.get(bi.billId);
      if (bill && bill.createdAt < prod.launchDate) {
        addError(`BillItem ${bi.id} sold on ${bill.createdAt.toISOString()} before product launch date ${prod.launchDate.toISOString()}`);
      }
      // No sales after product discontinuation date
      if (bill && prod.discontinuationDate && bill.createdAt > prod.discontinuationDate) {
        addError(`BillItem ${bi.id} sold on ${bill.createdAt.toISOString()} after product discontinuation date ${prod.discontinuationDate.toISOString()}`);
      }
    }

    // Active discount periods
    if (bi.discountId) {
      const disc = discountMap.get(bi.discountId);
      if (!disc) {
        addError(`BillItem ${bi.id} references non-existent Discount ID ${bi.discountId}`);
      } else {
        if (disc.approvalStatus === 'DRAFT') {
          addError(`BillItem ${bi.id} has draft discount ${disc.name}`);
        }
        const bill = billMap.get(bi.billId);
        if (bill) {
          if (disc.startDate && bill.createdAt < disc.startDate) {
            addError(`Discount ${disc.name} applied on bill ${bill.billNumber} before start date.`);
          }
          if (disc.endDate && bill.createdAt > disc.endDate) {
            addError(`Discount ${disc.name} applied on bill ${bill.billNumber} after end date.`);
          }
        }
      }
    }
  });

  // 4. Bill totals reconcile
  bills.forEach((b) => {
    const items = billToItemsMap.get(b.id) || [];
    if (items.length === 0) {
      addError(`Bill ${b.billNumber} has no items.`);
    }

    let calcSubtotal = 0;
    let calcDiscount = 0;
    let calcQty = 0;

    items.forEach((item) => {
      calcSubtotal += item.unitPrice * item.qty;
      calcDiscount += (item.discountValue || 0) * item.qty;
      calcQty += item.qty;

      // Reconcile item total
      const itemSub = item.unitPrice * item.qty - (item.discountValue || 0) * item.qty;
      if (Math.abs(item.total - itemSub) > 0.01) {
        addError(`BillItem ${item.id} has invalid total. Expected ${itemSub}, got ${item.total}`);
      }
    });

    if (Math.abs(b.subtotal - calcSubtotal) > 0.01) {
      addError(`Bill ${b.billNumber} subtotal mismatch. Expected ${calcSubtotal}, got ${b.subtotal}`);
    }

    // Account for bill-level discount in totals
    const billLevelDiscount = b.totalDiscount - calcDiscount;
    if (billLevelDiscount < -0.01) {
      addError(`Bill ${b.billNumber} has negative bill-level discount.`);
    }

    const calcTotalBill = calcSubtotal - b.totalDiscount;
    if (Math.abs(b.totalBill - calcTotalBill) > 0.01) {
      addError(`Bill ${b.billNumber} total mismatch. Expected ${calcTotalBill}, got ${b.totalBill}`);
    }

    if (b.totalQty !== calcQty) {
      addError(`Bill ${b.billNumber} quantity mismatch. Expected ${calcQty}, got ${b.totalQty}`);
    }

    // Cash paid/change check
    if (b.paymentMethod === 'CASH' && !b.draft) {
      if (b.paidAmount === null || b.changeAmount === null) {
        addError(`Bill ${b.billNumber} is CASH but has null paid/change amounts.`);
      } else {
        const diff = b.paidAmount - b.totalBill;
        if (Math.abs(b.changeAmount - diff) > 0.01) {
          addError(`Bill ${b.billNumber} change amount mismatch. Expected ${diff}, got ${b.changeAmount}`);
        }
      }
    }
  });

  // 5. Refunds validations
  const refundToItemsMap = new Map<string, RefundItemInput[]>();
  refundItems.forEach((ri) => {
    if (!refundToItemsMap.has(ri.refundId)) {
      refundToItemsMap.set(ri.refundId, []);
    }
    refundToItemsMap.get(ri.refundId)!.push(ri);

    // SKU exists
    if (!productMap.has(ri.sku)) {
      addError(`RefundItem ${ri.id} references non-existent SKU ${ri.sku}`);
    }
  });

  refunds.forEach((ref) => {
    const items = refundToItemsMap.get(ref.id) || [];
    if (items.length === 0) {
      addError(`Refund ${ref.refundNumber} has no items.`);
    }

    // Check original bill exists
    const bill = billMap.get(ref.originalBillId);
    if (!bill) {
      addError(`Refund ${ref.refundNumber} references non-existent original bill ${ref.originalBillId}`);
    } else {
      // Refund date is equal to or after bill date
      if (ref.createdAt < bill.createdAt) {
        addError(`Refund ${ref.refundNumber} date ${ref.createdAt.toISOString()} is before bill date ${bill.createdAt.toISOString()}`);
      }

      // Check item quantities do not exceed purchased quantity
      const originalBillItems = billToItemsMap.get(bill.id) || [];
      items.forEach((ri) => {
        const matchingBillItem = originalBillItems.find((bi) => bi.sku === ri.sku);
        if (!matchingBillItem) {
          addError(`RefundItem ${ri.id} SKU ${ri.sku} was not purchased in original bill ${bill.billNumber}`);
        } else if (ri.qty > matchingBillItem.qty) {
          addError(`RefundItem ${ri.id} SKU ${ri.sku} quantity ${ri.qty} exceeds original purchased quantity ${matchingBillItem.qty}`);
        }
      });
    }

    // Refund totals reconcile
    const calcRefundSum = items.reduce((sum, ri) => sum + ri.refundValue, 0);
    if (Math.abs(ref.refundAmount - calcRefundSum) > 0.01) {
      addError(`Refund ${ref.refundNumber} total mismatch. Expected ${calcRefundSum}, got ${ref.refundAmount}`);
    }
  });

  // 6. GRNs validations
  grnItems.forEach((gi) => {
    if (gi.addedQuantity <= 0) {
      addError(`GRN item ${gi.id} has non-positive quantity: ${gi.addedQuantity}`);
    }

    // Manufacturing date is before expiry date
    if (gi.mfd && gi.epd && gi.mfd >= gi.epd) {
      addError(`GRN item ${gi.id} has mfd ${gi.mfd.toISOString()} >= epd ${gi.epd.toISOString()}`);
    }

    const prod = productMap.get(gi.sku);
    if (!prod) {
      addError(`GRN item ${gi.id} has invalid SKU ${gi.sku}`);
    } else {
      // No GRN before product launch date
      const grn = grns.find((g) => g.id === gi.grnId);
      if (grn && grn.grnDate < prod.launchDate) {
        addError(`GRN Item ${gi.id} received on ${grn.grnDate.toISOString()} before product launch date ${prod.launchDate.toISOString()}`);
      }
    }
  });

  // 7. Adjustments validation
  adjustments.forEach((adj) => {
    if (adj.qtyChanged === 0) {
      addError(`Adjustment ${adj.id} has zero quantity change.`);
    }
    if (adj.finalQuantity < 0) {
      addError(`Adjustment ${adj.id} resulted in negative final stock: ${adj.finalQuantity}`);
    }
    const prod = productMap.get(adj.sku);
    if (!prod) {
      addError(`Adjustment ${adj.id} references invalid SKU ${adj.sku}`);
    }
  });

  // Output results
  if (errors.length > 0) {
    console.error(`\n❌ Validation Failed! Found ${errors.length} errors:`);
    errors.slice(0, 20).forEach((err, idx) => {
      console.error(`  ${idx + 1}. ${err}`);
    });
    if (errors.length > 20) {
      console.error(`  ... and ${errors.length - 20} more errors.`);
    }
    throw new Error('Automated validation check failed. Seeding stopped.');
  } else {
    console.log('✅ All validation checks passed successfully!');
  }
}
