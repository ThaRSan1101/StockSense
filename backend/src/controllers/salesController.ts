import { Response } from 'express';
import { prisma } from '../config/prisma.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { PaymentMethod } from '@prisma/client';
import { NotificationService } from '../services/notificationService.js';

// Create a new bill (either completed or draft)
export const createBill = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cashierId = req.user?.id;
    if (!cashierId) {
      res.status(401).json({ success: false, message: 'Unauthorized. Cashier session not found.' });
      return;
    }

    const {
      paymentMethod,
      draft = false,
      items,
      resumeDraftId,
      totalDiscount: requestedTotalDiscount,
      paidAmount,
      changeAmount
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'Bill must contain at least one item.' });
      return;
    }

    // 1. Fetch system settings for stock rules
    const settings = await prisma.systemSetting.findUnique({
      where: { key: 'STOCK_RULES' }
    });
    const allowNegativeStock = settings?.value ? (settings.value as any).allowNegativeStock : false;

    // 2. Fetch all products to verify prices and stock
    const skus = items.map((i: any) => i.sku);
    const products = await prisma.product.findMany({
      where: { sku: { in: skus } }
    });
    const productMap = new Map(products.map(p => [p.sku, p]));

    let calculatedSubtotal = 0;
    let calculatedTotalQty = 0;
    const verifiedItems: any[] = [];

    for (const item of items) {
      const product = productMap.get(item.sku);
      if (!product) {
        res.status(400).json({ success: false, message: `Product with SKU ${item.sku} not found.` });
        return;
      }

      const qty = parseInt(item.qty);
      if (isNaN(qty) || qty <= 0) {
        res.status(400).json({ success: false, message: `Invalid quantity for SKU ${item.sku}.` });
        return;
      }

      // Check stock if not draft and negative stock is not allowed
      if (!draft && !allowNegativeStock) {
        if (product.currentStock < qty) {
          res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}. Available: ${product.currentStock}` });
          return;
        }
      }

      // Enforce the backend's selling price
      const unitPrice = product.sellingPrice;
      const discountValue = item.discountValue ? parseFloat(item.discountValue) : 0;
      
      // Calculate item total (price * qty * (1 - discount%))
      const itemTotal = (unitPrice * qty) * (1 - (discountValue / 100));

      calculatedSubtotal += (unitPrice * qty);
      calculatedTotalQty += qty;

      verifiedItems.push({
        sku: item.sku,
        qty,
        unitPrice,
        total: itemTotal,
        discountId: item.discountId || null,
        discountValue
      });
    }

    const finalTotalDiscount = parseFloat(requestedTotalDiscount || 0);
    const calculatedTotalBill = calculatedSubtotal - finalTotalDiscount;

    if (calculatedTotalBill < 0) {
      res.status(400).json({ success: false, message: 'Total bill cannot be negative.' });
      return;
    }

    const prefix = draft ? 'DFT' : 'SB';
    
    // Find the latest bill with this prefix to determine the next sequential number
    const latestBill = await prisma.bill.findFirst({
      where: {
        billNumber: {
          startsWith: `${prefix}-`,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    let nextNum = 1001;
    if (latestBill) {
      const parts = latestBill.billNumber.split('-');
      const lastPart = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastPart)) {
        nextNum = lastPart + 1;
      }
    }
    const billNumber = `${prefix}-${nextNum}`;

    // Execute in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the Bill
      const bill = await tx.bill.create({
        data: {
          billNumber,
          cashierId,
          subtotal: calculatedSubtotal,
          totalDiscount: finalTotalDiscount,
          totalBill: calculatedTotalBill,
          paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.CASH,
          totalQty: calculatedTotalQty,
          draft,
          paidAmount: paidAmount !== undefined ? parseFloat(paidAmount) : null,
          changeAmount: changeAmount !== undefined ? parseFloat(changeAmount) : null,
          billItems: {
            create: verifiedItems
          }
        },
        include: {
          billItems: {
            include: {
              product: true
            }
          }
        }
      });

      // 2. If it's a completed transaction (not draft):
      //    - Decrement product stock levels
      if (!draft) {
        for (const item of items) {
          // Verify product exists and get current stock
          const product = await tx.product.findUnique({
            where: { sku: item.sku }
          });

          if (product) {
            await tx.product.update({
              where: { sku: item.sku },
              data: {
                currentStock: {
                  decrement: parseInt(item.qty)
                }
              }
            });
          }
        }

        // 3. Delete original draft if we are resuming/completing an on-hold bill
        if (resumeDraftId) {
          // Verify it exists and is a draft
          const existingDraft = await tx.bill.findFirst({
            where: { id: resumeDraftId, draft: true }
          });

          if (existingDraft) {
            // Cascade delete bill items first
            await tx.billItem.deleteMany({
              where: { billId: resumeDraftId }
            });
            // Delete the bill itself
            await tx.bill.delete({
              where: { id: resumeDraftId }
            });
          }
        }
      }

      return bill;
    });

    // After transaction completes successfully, check stock levels for alerts
    if (!draft) {
      for (const item of items) {
        NotificationService.checkAndTriggerStockAlerts(item.sku).catch(err => 
          console.error(`Error checking stock alerts for SKU ${item.sku}:`, err)
        );
      }
    }

    res.status(201).json({
      success: true,
      message: draft ? 'Bill put on hold (Draft saved).' : 'Transaction completed successfully.',
      data: result
    });
  } catch (error: any) {
    console.error('Error creating bill:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// Get completed sales history for the current cashier
export const getSalesHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whereClause: any = { draft: false };
    if (req.user?.role !== 'ADMIN') {
      whereClause.cashierId = req.user?.id;
    }

    const bills = await prisma.bill.findMany({
      where: whereClause,
      include: {
        billItems: {
          include: {
            product: {
              select: {
                sku: true,
                name: true,
                imageUrl: true,
                sellingPrice: true
              }
            },
            discount: true
          }
        },
        cashier: {
          select: {
            name: true,
            email: true
          }
        },
        refunds: {
          include: {
            refundItems: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      success: true,
      data: bills
    });
  } catch (error: any) {
    console.error('Error fetching sales history:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// Get all active draft (on-hold) bills
export const getDraftBills = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const drafts = await prisma.bill.findMany({
      where: {
        draft: true
      },
      include: {
        billItems: {
          include: {
            product: {
              select: {
                sku: true,
                name: true,
                imageUrl: true,
                sellingPrice: true,
                barcode: true
              }
            },
            discount: true
          }
        },
        cashier: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      success: true,
      data: drafts
    });
  } catch (error: any) {
    console.error('Error fetching draft bills:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// Delete a draft bill
export const deleteDraftBill = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const draft = await prisma.bill.findFirst({
      where: {
        id,
        draft: true
      }
    });

    if (!draft) {
      res.status(404).json({ success: false, message: 'Draft bill not found.' });
      return;
    }

    await prisma.$transaction([
      prisma.billItem.deleteMany({
        where: { billId: id }
      }),
      prisma.bill.delete({
        where: { id }
      })
    ]);

    res.status(200).json({
      success: true,
      message: 'Draft bill discarded successfully.'
    });
  } catch (error: any) {
    console.error('Error deleting draft bill:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};
