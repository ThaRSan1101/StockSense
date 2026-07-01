import { Response } from 'express';
import { prisma } from '../config/prisma.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { AdjustmentReason } from '@prisma/client';

export const createRefund = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cashierId = req.user?.id;
    if (!cashierId) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const { originalBillId, refundItems } = req.body;

    if (!originalBillId || !refundItems || !Array.isArray(refundItems) || refundItems.length === 0) {
      res.status(400).json({ success: false, message: 'Invalid payload. Original bill and refund items are required.' });
      return;
    }

    // 1. Fetch original bill to verify items and prices
    const originalBill = await prisma.bill.findUnique({
      where: { id: originalBillId },
      include: {
        billItems: true,
        refunds: {
          include: { refundItems: true }
        }
      }
    });

    if (!originalBill) {
      res.status(404).json({ success: false, message: 'Original bill not found.' });
      return;
    }

    // Calculate previously refunded quantities map
    const previouslyRefundedQtyMap = new Map<string, number>();
    for (const pastRefund of originalBill.refunds) {
      for (const pItem of pastRefund.refundItems) {
        const current = previouslyRefundedQtyMap.get(pItem.sku) || 0;
        previouslyRefundedQtyMap.set(pItem.sku, current + pItem.qty);
      }
    }

    let calculatedTotalRefundAmount = 0;
    const verifiedRefundItems: any[] = [];

    // Verify each refund item
    for (const item of refundItems) {
      const billItem = originalBill.billItems.find(bi => bi.sku === item.sku);
      if (!billItem) {
        res.status(400).json({ success: false, message: `Item SKU ${item.sku} was not found in the original bill.` });
        return;
      }

      const reqQty = parseInt(item.qty);
      if (isNaN(reqQty) || reqQty <= 0) {
        res.status(400).json({ success: false, message: `Invalid quantity for SKU ${item.sku}.` });
        return;
      }

      const pastRefundedQty = previouslyRefundedQtyMap.get(item.sku) || 0;
      const maxRefundableQty = billItem.qty - pastRefundedQty;

      if (reqQty > maxRefundableQty) {
        res.status(400).json({ 
          success: false, 
          message: `Cannot refund ${reqQty} of SKU ${item.sku}. Only ${maxRefundableQty} unit(s) available for refund.` 
        });
        return;
      }

      // Automatically calculate exact refund value per unit from the original bill
      const unitPaidPrice = billItem.total / billItem.qty;
      const itemRefundValue = unitPaidPrice * reqQty;

      calculatedTotalRefundAmount += itemRefundValue;

      verifiedRefundItems.push({
        sku: item.sku,
        qty: reqQty,
        refundValue: itemRefundValue
      });
    }

    // Generate next sequential refund number (RF-1001, RF-1002...)
    const prefix = 'RF';
    const latestRefund = await prisma.refund.findFirst({
      where: {
        refundNumber: {
          startsWith: `${prefix}-`
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    let nextNum = 1001;
    if (latestRefund) {
      const parts = latestRefund.refundNumber.split('-');
      const lastPart = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastPart)) {
        nextNum = lastPart + 1;
      }
    }
    const refundNumber = `${prefix}-${nextNum}`;

    // Execute in a database transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the Refund record
      const refund = await tx.refund.create({
        data: {
          refundNumber,
          originalBillId,
          cashierId,
          refundAmount: calculatedTotalRefundAmount,
          refundItems: {
            create: verifiedRefundItems
          }
        },
        include: {
          refundItems: {
            include: {
              product: true
            }
          }
        }
      });

      // 2. Increment stock & create stock adjustments
      for (const item of refundItems) {
        const product = await tx.product.findUnique({
          where: { sku: item.sku }
        });

        if (product) {
          const newQty = product.currentStock + parseInt(item.qty);
          // Increment stock
          await tx.product.update({
            where: { sku: item.sku },
            data: { currentStock: newQty }
          });

          // Log stock adjustment
          await tx.stockAdjustment.create({
            data: {
              sku: item.sku,
              qtyChanged: parseInt(item.qty),
              reason: AdjustmentReason.RETURNED,
              adjustedById: cashierId,
              finalQuantity: newQty
            }
          });
        }
      }

      return refund;
    });

    res.status(201).json({
      success: true,
      message: 'Refund processed successfully.',
      data: result
    });
  } catch (error: any) {
    console.error('Error creating refund:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const getRefundHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cashierId = req.user?.id;
    if (!cashierId) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const refunds = await prisma.refund.findMany({
      where: { cashierId },
      include: {
        refundItems: {
          include: {
            product: {
              select: {
                sku: true,
                name: true
              }
            }
          }
        },
        originalBill: {
          select: {
            billNumber: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      success: true,
      data: refunds
    });
  } catch (error: any) {
    console.error('Error fetching refunds:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};
