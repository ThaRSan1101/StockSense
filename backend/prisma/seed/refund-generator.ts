import { SeededRandom } from './deterministic-random.js';
import { BillInput, BillItemInput } from './bill-generator.js';

export interface RefundInput {
  id: string;
  refundNumber: string;
  originalBillId: string;
  cashierId: string;
  refundAmount: number;
  createdAt: Date;
}

export interface RefundItemInput {
  id: string;
  refundId: string;
  sku: string;
  qty: number;
  refundValue: number;
}

let refundCounter = 0;

export function generateRefundsForBills(
  bills: BillInput[],
  billItems: BillItemInput[],
  runningStock: Map<string, number>,
  cashiers: string[],
  random: SeededRandom
): { refunds: RefundInput[]; refundItems: RefundItemInput[] } {
  const refunds: RefundInput[] = [];
  const refundItems: RefundItemInput[] = [];

  bills.forEach((bill) => {
    // Check if bill is draft (no refunds for draft bills)
    if (bill.draft) return;

    // 1% probability of refund
    if (random.next() > 0.01) return;

    // Find items for this bill
    const items = billItems.filter((bi) => bi.billId === bill.id);
    if (items.length === 0) return;

    // Pick 1 to 2 items to refund
    const itemsToRefund = random.pickN(items, random.nextInt(1, 2));

    let billRefundAmount = 0;
    refundCounter++;
    const refundId = `ref-uuid-${refundCounter}`;
    const refundNumber = `REF-${bill.createdAt.getUTCFullYear()}-${refundCounter.toString().padStart(6, '0')}`;

    // Refund date is 1 to 4 days after bill date (strictly <= 2025-12-31)
    const refundDate = new Date(bill.createdAt);
    refundDate.setUTCDate(refundDate.getUTCDate() + random.nextInt(1, 4));
    refundDate.setUTCHours(random.nextInt(9, 18), random.nextInt(0, 59));

    const maxRefundDate = new Date('2025-12-31T20:00:00Z');
    if (refundDate > maxRefundDate) {
      // If purchase was in late December, refund within same day 2-4 hours later
      refundDate.setTime(bill.createdAt.getTime() + (random.nextInt(2, 4) * 3600 * 1000));
    }

    const currentRefundItems: RefundItemInput[] = [];

    itemsToRefund.forEach((item: BillItemInput, idx: number) => {
      // Pick refund quantity (1 up to purchased qty)
      const qty = random.nextInt(1, item.qty);
      const refundValue = (item.total / item.qty) * qty;

      currentRefundItems.push({
        id: `refi-uuid-${refundCounter}-${idx + 1}`,
        refundId,
        sku: item.sku,
        qty,
        refundValue,
      });

      billRefundAmount += refundValue;

      // Add back to running stock
      const stock = runningStock.get(item.sku) || 0;
      runningStock.set(item.sku, stock + qty);
    });

    if (currentRefundItems.length === 0) return;

    refunds.push({
      id: refundId,
      refundNumber,
      originalBillId: bill.id,
      cashierId: random.pick(cashiers),
      refundAmount: billRefundAmount,
      createdAt: refundDate,
    });

    currentRefundItems.forEach((ri) => refundItems.push(ri));
  });

  return { refunds, refundItems };
}
