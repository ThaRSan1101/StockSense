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

    // 3. Verify discount IDs to ensure foreign key constraint integrity
    const candidateDiscountIds = items
      .map((i: any) => i.discountId)
      .filter((id: any): id is string => typeof id === 'string' && id.trim().length > 0);

    const validDiscounts = candidateDiscountIds.length > 0
      ? await prisma.discount.findMany({
          where: { id: { in: candidateDiscountIds } },
          select: { id: true }
        })
      : [];
    const validDiscountIdSet = new Set(validDiscounts.map(d => d.id));

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

      const validDiscountId = (item.discountId && validDiscountIdSet.has(item.discountId))
        ? item.discountId
        : null;

      verifiedItems.push({
        sku: item.sku,
        qty,
        unitPrice,
        total: itemTotal,
        discountId: validDiscountId,
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

    // Execute in an atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Generate sequential bill number atomically inside transaction
      const latestBill = await tx.bill.findFirst({
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

      // 2. Re-verify stock inside transaction to prevent race-condition overselling
      if (!draft && !allowNegativeStock) {
        for (const item of items) {
          const product = await tx.product.findUnique({
            where: { sku: item.sku }
          });
          if (product && product.currentStock < parseInt(item.qty)) {
            throw new Error(`Insufficient stock for ${product.name}. Available: ${product.currentStock}`);
          }
        }
      }

      // 3. Create the Bill
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

      // 4. If it's a completed transaction (not draft):
      //    - Decrement product stock levels
      if (!draft) {
        for (const item of items) {
          await tx.product.update({
            where: { sku: item.sku },
            data: {
              currentStock: {
                decrement: parseInt(item.qty)
              }
            }
          });
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

        // 4. Real-Time Combo Sales & Performance Tracking Sync
        const comboItemsMap: Record<string, { sku: string; qty: number; unitPrice: number }[]> = {};
        for (const item of items) {
          const comboRef = item.comboId || item.discountId;
          if (comboRef) {
            if (!comboItemsMap[comboRef]) {
              comboItemsMap[comboRef] = [];
            }
            comboItemsMap[comboRef].push({
              sku: item.sku,
              qty: parseInt(item.qty),
              unitPrice: productMap.get(item.sku)?.sellingPrice || 0
            });
          }
        }

        for (const [comboRef, soldItems] of Object.entries(comboItemsMap)) {
          const combo = await tx.combo.findFirst({
            where: {
              OR: [
                { id: comboRef },
                { comboCode: comboRef }
              ]
            },
            include: {
              items: true
            }
          });

          if (combo) {
            const targetItem = combo.items.find(i => i.role === 'TARGET') || combo.items[0];
            const soldTarget = soldItems.find(si => si.sku === targetItem?.productId);
            const packsSold = soldTarget && targetItem ? Math.max(1, Math.floor(soldTarget.qty / targetItem.quantity)) : 1;

            const targetClearanceQty = targetItem ? targetItem.quantity * packsSold : packsSold;
            const newSoldQty = combo.soldQuantity + packsSold;
            const isCompleted = combo.maximumQuantity > 0 && newSoldQty >= combo.maximumQuantity;

            // Update Combo sold quantity and mark COMPLETED if promo cap reached
            await tx.combo.update({
              where: { id: combo.id },
              data: {
                soldQuantity: newSoldQty,
                status: isCompleted ? 'COMPLETED' : combo.status
              }
            });

            // Create ComboSale audit entry
            await tx.comboSale.create({
              data: {
                comboId: combo.id,
                saleId: bill.id,
                quantity: packsSold,
                normalValue: combo.normalTotalPrice * packsSold,
                comboValue: combo.comboPrice * packsSold,
                customerSaving: (combo.normalTotalPrice - combo.comboPrice) * packsSold,
                totalCost: combo.totalCost * packsSold,
                realizedProfit: (combo.comboPrice - combo.totalCost) * packsSold,
                realizedMarginPercentage: combo.comboPrice > 0 ? (((combo.comboPrice - combo.totalCost) / combo.comboPrice) * 100) : 0
              }
            });

            // Upsert ComboPerformance metrics in real-time
            const existingPerf = await tx.comboPerformance.findFirst({
              where: { comboId: combo.id }
            });

            if (existingPerf) {
              await tx.comboPerformance.update({
                where: { id: existingPerf.id },
                data: {
                  unitsSold: { increment: packsSold },
                  purchaseCount: { increment: 1 },
                  revenueGenerated: { increment: combo.comboPrice * packsSold },
                  profitGenerated: { increment: (combo.comboPrice - combo.totalCost) * packsSold },
                  customerSavings: { increment: (combo.normalTotalPrice - combo.comboPrice) * packsSold },
                  targetStockCleared: { increment: targetClearanceQty },
                  status: isCompleted ? 'COMPLETED' : 'ACTIVE'
                }
              });
            } else {
              await tx.comboPerformance.create({
                data: {
                  comboId: combo.id,
                  evaluationStartDate: combo.startDate,
                  evaluationEndDate: combo.endDate,
                  purchaseCount: 1,
                  unitsSold: packsSold,
                  revenueGenerated: combo.comboPrice * packsSold,
                  profitGenerated: (combo.comboPrice - combo.totalCost) * packsSold,
                  customerSavings: (combo.normalTotalPrice - combo.comboPrice) * packsSold,
                  targetStockCleared: targetClearanceQty,
                  status: isCompleted ? 'COMPLETED' : 'ACTIVE'
                }
              });
            }
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
    if (req.user?.role === 'CASHIER') {
      whereClause.cashierId = req.user?.id;
    }

    const take = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const skip = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const bills = await prisma.bill.findMany({
      where: whereClause,
      take,
      skip,
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
