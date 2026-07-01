import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { DiscountType, ApprovalStatus } from '@prisma/client';
import { NotificationService } from '../services/notificationService.js';

// Get all discounts
export const getDiscounts = async (_req: Request, res: Response): Promise<void> => {
  try {
    const discounts = await prisma.discount.findMany({
      include: {
        discountProducts: {
          include: {
            product: {
              select: {
                sku: true,
                name: true,
                sellingPrice: true,
                currentStock: true,
                imageUrl: true
              }
            }
          }
        },
        comboItems: {
          include: {
            product: {
              select: {
                sku: true,
                name: true,
                sellingPrice: true,
                currentStock: true,
                imageUrl: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Map to frontend-friendly structure
    const formattedDiscounts = discounts.map(d => ({
      id: d.id,
      name: d.name,
      type: d.type,
      discountValue: d.discountValue,
      comboPrice: d.comboPrice,
      minBillAmount: d.minBillAmount || undefined,
      label: d.label || undefined,
      imageUrl: d.imageUrl || undefined,
      startDate: d.startDate ? d.startDate.toISOString().split('T')[0] : undefined,
      endDate: d.endDate ? d.endDate.toISOString().split('T')[0] : undefined,
      dailyStartTime: d.dailyStartTime || undefined,
      dailyEndTime: d.dailyEndTime || undefined,
      applicableDate: d.applicableDate ? d.applicableDate.toISOString().split('T')[0] : undefined,
      isActive: d.isActive,
      approvalStatus: d.approvalStatus,
      createdAt: d.createdAt.toISOString(),
      // Include full product details for popup display
      productIds: d.discountProducts.map(p => p.sku),
      products: d.discountProducts.map(p => ({
        sku: p.product.sku,
        name: p.product.name,
        currentStock: p.product.currentStock,
        sellingPrice: p.product.sellingPrice,
        imageUrl: p.product.imageUrl || undefined,
      })),
      comboItems: d.comboItems.map(item => ({
        productId: item.sku,
        minQty: item.minQty,
        productName: item.product.name,
        sellingPrice: item.product.sellingPrice,
        currentStock: item.product.currentStock,
      }))
    }));

    res.status(200).json({ success: true, data: formattedDiscounts });
  } catch (error) {
    console.error('Error fetching discounts:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const createDiscount = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      type,
      discountValue,
      comboPrice,
      label,
      imageUrl,
      startDate,
      endDate,
      dailyStartTime,
      dailyEndTime,
      applicableDate,
      minBillAmount,
      productIds, // array of skus
      comboItems,  // array of { productId, minQty }
    } = req.body;

    const cleanName = name?.trim();
    const cleanLabel = label?.trim() || null;
    const cleanImageUrl = imageUrl?.trim() || null;

    if (!cleanName || !type) {
      res.status(400).json({ success: false, message: 'Name and type are required' });
      return;
    }
    if (cleanName.length > 100) {
      res.status(400).json({ success: false, message: 'Discount campaign name must be 100 characters or less.' });
      return;
    }

    const val = parseFloat(discountValue) || 0;
    if (isNaN(val) || val <= 0 || val > 100) {
      res.status(400).json({ success: false, message: 'Discount value must be a positive percentage between 0 and 100.' });
      return;
    }

    if (type === 'SEASONAL') {
      if (!startDate || !endDate) {
        res.status(400).json({ success: false, message: 'Seasonal campaigns require start and end dates.' });
        return;
      }
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end <= start) {
        res.status(400).json({ success: false, message: 'End date must be after start date.' });
        return;
      }
    }

    // Prepare data
    const data: any = {
      name: cleanName,
      type: type as DiscountType,
      discountValue: val,
      comboPrice: null,
      label: cleanLabel,
      imageUrl: cleanImageUrl,
      startDate: (type === 'SEASONAL' && startDate) ? new Date(startDate) : null,
      endDate: (type === 'SEASONAL' && endDate) ? new Date(endDate) : null,
      dailyStartTime: type === 'DAILY' ? dailyStartTime : null,
      dailyEndTime: type === 'DAILY' ? dailyEndTime : null,
      applicableDate: (type === 'DAILY' && applicableDate) ? new Date(applicableDate) : null,
      minBillAmount: (type === 'BILL' && minBillAmount) ? parseFloat(minBillAmount) : null,
      isActive: true,
      approvalStatus: ApprovalStatus.DRAFT,
    };

    // Create the discount campaign inside a Prisma transaction
    const newDiscount = await prisma.$transaction(async (tx) => {
      const discount = await tx.discount.create({ data });

      // Create target product mappings if seasonal or daily
      if (type !== 'COMBO' && Array.isArray(productIds)) {
        await tx.discountProduct.createMany({
          data: productIds.map((sku: string) => ({
            discountId: discount.id,
            sku
          }))
        });
      }

      // Create combo items if combo
      if (type === 'COMBO' && Array.isArray(comboItems)) {
        await tx.discountComboItem.createMany({
          data: comboItems.map((item: any) => ({
            discountId: discount.id,
            sku: item.productId, // maps to product SKU
            minQty: parseInt(item.minQty) || 1
          }))
        });
      }

      return discount;
    });

    // Notify ADMIN of new discount awaiting approval
    try {
      await NotificationService.createNotification({
        type: 'DISCOUNT_APPROVAL',
        severity: 'INFO',
        title: 'Discount Campaign Approval Needed',
        message: `A new discount campaign "${newDiscount.name}" was created by the Inventory Manager and requires Admin approval.`,
        suggestedAction: 'View Request',
        metadata: {
          discountId: newDiscount.id,
          campaignName: newDiscount.name,
          discountValue: newDiscount.discountValue,
          type: newDiscount.type
        },
        targetRole: 'ADMIN'
      });
    } catch (err) {
      console.error('Error creating discount approval notification:', err);
    }

    res.status(201).json({ success: true, data: newDiscount });
  } catch (error) {
    console.error('Error creating discount:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const updateDiscount = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const {
      name,
      type,
      discountValue,
      comboPrice,
      label,
      imageUrl,
      startDate,
      endDate,
      dailyStartTime,
      dailyEndTime,
      applicableDate,
      minBillAmount,
      productIds, // array of skus
      comboItems,  // array of { productId, minQty }
      isActive,
      approvalStatus
    } = req.body;

    const discount = await prisma.discount.findUnique({ where: { id } });
    if (!discount) {
      res.status(404).json({ success: false, message: 'Discount not found' });
      return;
    }

    const cleanName = name !== undefined ? name?.trim() : undefined;
    const cleanLabel = label !== undefined ? (label !== null ? label?.trim() : null) : undefined;
    const cleanImageUrl = imageUrl !== undefined ? (imageUrl !== null ? imageUrl?.trim() : null) : undefined;

    if (cleanName !== undefined && !cleanName) {
      res.status(400).json({ success: false, message: 'Discount campaign name cannot be empty.' });
      return;
    }
    if (cleanName !== undefined && cleanName.length > 100) {
      res.status(400).json({ success: false, message: 'Discount campaign name must be 100 characters or less.' });
      return;
    }

    if (discountValue !== undefined) {
      const val = parseFloat(discountValue) || 0;
      if (isNaN(val) || val <= 0 || val > 100) {
        res.status(400).json({ success: false, message: 'Discount value must be a positive percentage between 0 and 100.' });
        return;
      }
    }

    const finalType = type || discount.type;
    const finalStartDate = startDate !== undefined ? startDate : discount.startDate;
    const finalEndDate = endDate !== undefined ? endDate : discount.endDate;

    if (finalType === 'SEASONAL') {
      if (!finalStartDate || !finalEndDate) {
        res.status(400).json({ success: false, message: 'Seasonal campaigns require start and end dates.' });
        return;
      }
      const start = new Date(finalStartDate);
      const end = new Date(finalEndDate);
      if (end <= start) {
        res.status(400).json({ success: false, message: 'End date must be after start date.' });
        return;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedDiscount = await tx.discount.update({
        where: { id },
        data: {
          name: cleanName,
          type: type !== undefined ? (type as DiscountType) : undefined,
          discountValue: discountValue !== undefined ? parseFloat(discountValue) || 0 : undefined,
          comboPrice: null,
          label: cleanLabel,
          imageUrl: cleanImageUrl,
          startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : undefined,
          endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined,
          dailyStartTime: dailyStartTime !== undefined ? dailyStartTime || null : undefined,
          dailyEndTime: dailyEndTime !== undefined ? dailyEndTime || null : undefined,
          applicableDate: applicableDate !== undefined ? (applicableDate ? new Date(applicableDate) : null) : undefined,
          minBillAmount: minBillAmount !== undefined ? (minBillAmount ? parseFloat(minBillAmount) : null) : undefined,
          isActive: isActive !== undefined ? isActive : undefined,
          approvalStatus: ApprovalStatus.DRAFT // Auto reset to DRAFT when edited
        }
      });

      const finalType = type || discount.type;

      // Update product IDs for seasonal/daily
      if (productIds !== undefined && finalType !== 'COMBO') {
        // Clear old relations
        await tx.discountProduct.deleteMany({ where: { discountId: id } });
        // Add new relations
        if (Array.isArray(productIds)) {
          await tx.discountProduct.createMany({
            data: productIds.map((sku: string) => ({
              discountId: id,
              sku
            }))
          });
        }
      }

      // Update combo items
      if (comboItems !== undefined && finalType === 'COMBO') {
        // Clear old combo items
        await tx.discountComboItem.deleteMany({ where: { discountId: id } });
        // Add new combo items
        if (Array.isArray(comboItems)) {
          await tx.discountComboItem.createMany({
            data: comboItems.map((item: any) => ({
              discountId: id,
              sku: item.productId,
              minQty: parseInt(item.minQty) || 1
            }))
          });
        }
      }

      return updatedDiscount;
    });

    // Notify Admin of the updated discount pending re-approval
    try {
      // Remove any existing stale approval notifications for this discount
      const oldApprovals = await prisma.notification.findMany({
        where: { type: 'DISCOUNT_APPROVAL' }
      });
      const toDelete = oldApprovals
        .filter(n => (n.metadata as any)?.discountId === id)
        .map(n => n.id);
      if (toDelete.length > 0) {
        await prisma.notification.deleteMany({ where: { id: { in: toDelete } } });
      }

      await NotificationService.createNotification({
        type: 'DISCOUNT_APPROVAL',
        severity: 'INFO',
        title: 'Discount Campaign Updated — Re-approval Needed',
        message: `The discount campaign "${updated.name}" was updated by the Inventory Manager and requires Admin re-approval.`,
        suggestedAction: 'View Request',
        metadata: {
          discountId: updated.id,
          campaignName: updated.name,
          discountValue: updated.discountValue,
          type: updated.type
        },
        targetRole: 'ADMIN'
      });
    } catch (err) {
      console.error('Error creating update approval notification:', err);
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating discount:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Toggle Active/Approval status
export const toggleStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { isActive, approvalStatus } = req.body;

    const discount = await prisma.discount.findUnique({ where: { id } });
    if (!discount) {
      res.status(404).json({ success: false, message: 'Discount not found' });
      return;
    }

    const updated = await prisma.discount.update({
      where: { id },
      data: {
        isActive: isActive !== undefined ? isActive : undefined,
        approvalStatus: approvalStatus !== undefined ? (approvalStatus as ApprovalStatus) : ApprovalStatus.DRAFT
      }
    });

    // Clean up approval requests for this discount
    try {
      const oldApprovals = await prisma.notification.findMany({
        where: { type: 'DISCOUNT_APPROVAL' }
      });
      const toDelete = oldApprovals.filter(n => {
        const meta = n.metadata as any;
        return meta && meta.discountId === id;
      }).map(n => n.id);
      if (toDelete.length > 0) {
        await prisma.notification.deleteMany({
          where: { id: { in: toDelete } }
        });
      }
    } catch (err) {
      console.error('Error cleaning up old approval alerts:', err);
    }

    // Trigger response notifications based on status change
    try {
      if (approvalStatus === 'APPROVED') {
        await NotificationService.createNotification({
          type: 'DISCOUNT_RESPONSE',
          severity: 'INFO',
          title: 'Discount Request Approved',
          message: `Your discount campaign "${discount.name}" has been APPROVED by the Admin.`,
          metadata: {
            discountId: discount.id,
            campaignName: discount.name,
            status: 'APPROVED'
          },
          targetRole: 'INVENTORY_MANAGER'
        });
      } else if (approvalStatus === 'DRAFT' && discount.approvalStatus === 'APPROVED') {
        // If Admin sets it back to DRAFT or rejects
        await NotificationService.createNotification({
          type: 'DISCOUNT_RESPONSE',
          severity: 'WARNING',
          title: 'Discount Request Revoked/Declined',
          message: `Your discount campaign "${discount.name}" has been declined or set to draft state.`,
          metadata: {
            discountId: discount.id,
            campaignName: discount.name,
            status: 'DRAFT'
          },
          targetRole: 'INVENTORY_MANAGER'
        });
      }
    } catch (err) {
      console.error('Error creating approval response/revoke alert:', err);
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Error toggling status:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Delete a discount
export const deleteDiscount = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const discount = await prisma.discount.findUnique({ where: { id } });
    if (!discount) {
      res.status(404).json({ success: false, message: 'Discount not found' });
      return;
    }

    if (discount.approvalStatus === ApprovalStatus.APPROVED) {
      res.status(400).json({
        success: false,
        message: 'This discount campaign is already approved by the admin. You cannot delete it. Please contact the admin.'
      });
      return;
    }

    await prisma.discount.delete({ where: { id } });

    res.status(200).json({ success: true, message: 'Discount deleted successfully' });
  } catch (error) {
    console.error('Error deleting discount:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
