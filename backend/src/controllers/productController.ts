import { Request, Response } from 'express';
import { ProductStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';

const mapStatus = (statusStr?: string): ProductStatus => {
  if (!statusStr) return ProductStatus.ACTIVE;
  const lower = statusStr.toLowerCase();
  if (lower === 'active') return ProductStatus.ACTIVE;
  if (lower === 'inactive') return ProductStatus.INACTIVE;
  if (lower === 'disconnected') return ProductStatus.DISCONTINUED;
  return ProductStatus.ACTIVE;
};

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      include: {
        masterClass: {
          include: {
            category: true,
            subCategory: true,
            brand: true,
            supplier: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, data: products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      productStructure, name, categoryId, subCategoryId, brandId, supplierId, imageUrl,
      barcode, unitType, costPrice, sellingPrice, currentStock, reorderLevel, targetCapacity,
      variants, status
    } = req.body;

    const cleanName = name?.trim();
    if (!cleanName || !categoryId || !brandId || !supplierId) {
      res.status(400).json({ success: false, message: 'Missing required master fields (name, categoryId, brandId, supplierId)' });
      return;
    }

    const hasVariants = productStructure === 'variant' && variants && variants.length > 0;

    if (!hasVariants) {
      const cost = Number(costPrice);
      const sell = Number(sellingPrice);
      const stock = Number(currentStock || 0);
      const reorder = Number(reorderLevel || 10);
      const capacity = Number(targetCapacity || 50);

      if (isNaN(cost) || cost <= 0) {
        res.status(400).json({ success: false, message: 'Cost price must be a positive number.' });
        return;
      }
      if (isNaN(sell) || sell <= 0) {
        res.status(400).json({ success: false, message: 'Selling price must be a positive number.' });
        return;
      }
      if (sell < cost) {
        res.status(400).json({ success: false, message: 'Selling price cannot be less than cost price.' });
        return;
      }
      if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
        res.status(400).json({ success: false, message: 'Current stock must be a non-negative integer.' });
        return;
      }
      if (isNaN(reorder) || reorder < 0 || !Number.isInteger(reorder)) {
        res.status(400).json({ success: false, message: 'Reorder level must be a non-negative integer.' });
        return;
      }
      if (isNaN(capacity) || capacity <= 0 || !Number.isInteger(capacity)) {
        res.status(400).json({ success: false, message: 'Target capacity must be a positive integer.' });
        return;
      }

      if (req.body.mfgDate && req.body.expiryDate) {
        const mfg = new Date(req.body.mfgDate);
        const exp = new Date(req.body.expiryDate);
        if (exp <= mfg) {
          res.status(400).json({ success: false, message: 'Expiry date must be after manufacturing date.' });
          return;
        }
      }
    } else {
      // Validate variants
      for (const v of variants) {
        if (!v.sku || !v.sku.trim()) {
          res.status(400).json({ success: false, message: 'SKU is required for all variants.' });
          return;
        }
        const vCost = Number(v.costPrice);
        const vSell = Number(v.sellingPrice);
        const vStock = Number(v.stock || 0);
        const vReorder = Number(v.reorderLevel || 10);
        const vCapacity = Number(v.targetCapacity || 50);

        if (isNaN(vCost) || vCost <= 0) {
          res.status(400).json({ success: false, message: `Cost price for variant ${v.variantName || v.sku} must be a positive number.` });
          return;
        }
        if (isNaN(vSell) || vSell <= 0) {
          res.status(400).json({ success: false, message: `Selling price for variant ${v.variantName || v.sku} must be a positive number.` });
          return;
        }
        if (vSell < vCost) {
          res.status(400).json({ success: false, message: `Selling price for variant ${v.variantName || v.sku} cannot be less than cost price.` });
          return;
        }
        if (isNaN(vStock) || vStock < 0 || !Number.isInteger(vStock)) {
          res.status(400).json({ success: false, message: `Stock for variant ${v.variantName || v.sku} must be a non-negative integer.` });
          return;
        }
        if (isNaN(vReorder) || vReorder < 0 || !Number.isInteger(vReorder)) {
          res.status(400).json({ success: false, message: `Reorder level for variant ${v.variantName || v.sku} must be a non-negative integer.` });
          return;
        }
        if (isNaN(vCapacity) || vCapacity <= 0 || !Number.isInteger(vCapacity)) {
          res.status(400).json({ success: false, message: `Target capacity for variant ${v.variantName || v.sku} must be a positive integer.` });
          return;
        }
        if (v.mfgDate && v.expiryDate) {
          const mfg = new Date(v.mfgDate);
          const exp = new Date(v.expiryDate);
          if (exp <= mfg) {
            res.status(400).json({ success: false, message: `Expiry date must be after manufacturing date for variant ${v.variantName || v.sku}.` });
            return;
          }
        }
      }
    }

    // 1. Create Master Product Class
    const master = await prisma.masterProductClass.create({
      data: {
        name: cleanName,
        categoryId,
        subCategoryId: subCategoryId || null,
        brandId,
        supplierId,
        hasVariant: hasVariants
      }
    });

    const createdProducts = [];

    // 2. Create products based on structure
    if (hasVariants) {
      // Loop and create variants
      for (const v of variants) {
        const p = await prisma.product.create({
          data: {
            sku: v.sku.trim(),
            masterId: master.id,
            barcode: v.barcode?.trim() || `479${Math.floor(1000000000 + Math.random() * 9000000000)}`,
            name: (v.variantName || name).trim(),
            unitType: v.unit || 'Piece',
            costPrice: Number(v.costPrice || 0),
            sellingPrice: Number(v.sellingPrice || 0),
            currentStock: Number(v.stock || 0),
            reorderLevel: Number(v.reorderLevel || 10),
            targetCapacity: Number(v.targetCapacity || 50),
            status: mapStatus(status),
            imageUrl: v.imageUrl || imageUrl || '',
            variantAttributeType: v.attributeType ? `${v.attributeType}: ${v.attributeValue}` : null,
            batchNumber: v.batchNumber?.trim() || null,
            mfgDate: v.mfgDate ? new Date(v.mfgDate) : null,
            expiryDate: v.expiryDate ? new Date(v.expiryDate) : null
          }
        });
        createdProducts.push(p);
      }
    } else {
      // Single product
      const newSku = (req.body.sku || `MANUAL-${Date.now()}`).trim();
      const p = await prisma.product.create({
        data: {
          sku: newSku,
          masterId: master.id,
          barcode: barcode?.trim() || `479${Math.floor(1000000000 + Math.random() * 9000000000)}`,
          name: cleanName, // Single product inherits master name
          unitType: unitType || 'Piece',
          costPrice: Number(costPrice || 0),
          sellingPrice: Number(sellingPrice || 0),
          currentStock: Number(currentStock || 0),
          reorderLevel: Number(reorderLevel || 10),
          targetCapacity: Number(targetCapacity || 50),
          status: mapStatus(status),
          imageUrl: imageUrl || '',
          mfgDate: req.body.mfgDate ? new Date(req.body.mfgDate) : null,
          expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : null,
          batchNumber: req.body.batchNumber?.trim() || null
        }
      });
      createdProducts.push(p);
    }

    res.status(201).json({ 
      success: true, 
      message: 'Product(s) created successfully',
      data: { master, products: createdProducts }
    });

  } catch (error: any) {
    console.error('Error creating product:', error);
    if (error.code === 'P2002') {
      const targets = error.meta?.target || [];
      const field = targets.join(', ');
      res.status(400).json({ success: false, message: `Duplicate entry error: The field(s) (${field}) already exist.` });
      return;
    }
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sku } = req.params;
    const { 
      productStructure, name, categoryId, subCategoryId, brandId, supplierId, imageUrl,
      barcode, unitType, costPrice, sellingPrice, currentStock, reorderLevel, targetCapacity,
      variants, mfgDate, expiryDate, batchNumber, status
    } = req.body;

    if (!sku || typeof sku !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid or missing SKU' });
      return;
    }

    const cleanName = name?.trim();
    if (!cleanName || !categoryId || !brandId || !supplierId) {
      res.status(400).json({ success: false, message: 'Missing required master fields (name, categoryId, brandId, supplierId)' });
      return;
    }

    const hasVariants = productStructure === 'variant' && variants && variants.length > 0;

    if (!hasVariants) {
      const cost = Number(costPrice);
      const sell = Number(sellingPrice);
      const stock = Number(currentStock || 0);
      const reorder = Number(reorderLevel || 10);
      const capacity = Number(targetCapacity || 50);

      if (isNaN(cost) || cost <= 0) {
        res.status(400).json({ success: false, message: 'Cost price must be a positive number.' });
        return;
      }
      if (isNaN(sell) || sell <= 0) {
        res.status(400).json({ success: false, message: 'Selling price must be a positive number.' });
        return;
      }
      if (sell < cost) {
        res.status(400).json({ success: false, message: 'Selling price cannot be less than cost price.' });
        return;
      }
      if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
        res.status(400).json({ success: false, message: 'Current stock must be a non-negative integer.' });
        return;
      }
      if (isNaN(reorder) || reorder < 0 || !Number.isInteger(reorder)) {
        res.status(400).json({ success: false, message: 'Reorder level must be a non-negative integer.' });
        return;
      }
      if (isNaN(capacity) || capacity <= 0 || !Number.isInteger(capacity)) {
        res.status(400).json({ success: false, message: 'Target capacity must be a positive integer.' });
        return;
      }

      if (mfgDate && expiryDate) {
        const mfg = new Date(mfgDate);
        const exp = new Date(expiryDate);
        if (exp <= mfg) {
          res.status(400).json({ success: false, message: 'Expiry date must be after manufacturing date.' });
          return;
        }
      }
    } else {
      // Validate variants
      for (const v of variants) {
        if (!v.sku || !v.sku.trim()) {
          res.status(400).json({ success: false, message: 'SKU is required for all variants.' });
          return;
        }
        const vCost = Number(v.costPrice);
        const vSell = Number(v.sellingPrice);
        const vStock = Number(v.stock || 0);
        const vReorder = Number(v.reorderLevel || 10);
        const vCapacity = Number(v.targetCapacity || 50);

        if (isNaN(vCost) || vCost <= 0) {
          res.status(400).json({ success: false, message: `Cost price for variant ${v.variantName || v.sku} must be a positive number.` });
          return;
        }
        if (isNaN(vSell) || vSell <= 0) {
          res.status(400).json({ success: false, message: `Selling price for variant ${v.variantName || v.sku} must be a positive number.` });
          return;
        }
        if (vSell < vCost) {
          res.status(400).json({ success: false, message: `Selling price for variant ${v.variantName || v.sku} cannot be less than cost price.` });
          return;
        }
        if (isNaN(vStock) || vStock < 0 || !Number.isInteger(vStock)) {
          res.status(400).json({ success: false, message: `Stock for variant ${v.variantName || v.sku} must be a non-negative integer.` });
          return;
        }
        if (isNaN(vReorder) || vReorder < 0 || !Number.isInteger(vReorder)) {
          res.status(400).json({ success: false, message: `Reorder level for variant ${v.variantName || v.sku} must be a non-negative integer.` });
          return;
        }
        if (isNaN(vCapacity) || vCapacity <= 0 || !Number.isInteger(vCapacity)) {
          res.status(400).json({ success: false, message: `Target capacity for variant ${v.variantName || v.sku} must be a positive integer.` });
          return;
        }
        if (v.mfgDate && v.expiryDate) {
          const mfg = new Date(v.mfgDate);
          const exp = new Date(v.expiryDate);
          if (exp <= mfg) {
            res.status(400).json({ success: false, message: `Expiry date must be after manufacturing date for variant ${v.variantName || v.sku}.` });
            return;
          }
        }
      }
    }

    // Find the product and its master class
    const product = await prisma.product.findUnique({
      where: { sku },
      include: { masterClass: true }
    });

    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    const masterId = product.masterId;

    // 1. Update Master Product Class
    await prisma.masterProductClass.update({
      where: { id: masterId },
      data: {
        name: cleanName,
        categoryId,
        subCategoryId: subCategoryId || null,
        brandId,
        supplierId,
        hasVariant: hasVariants
      }
    });

    const updatedProducts = [];

    if (hasVariants) {
      // It's a variant product. We need to upsert all variants and remove missing ones.
      const existingVariants = await prisma.product.findMany({
        where: { masterId }
      });

      const existingSkus = existingVariants.map((v) => v.sku);
      const incomingSkus = variants.map((v: any) => v.sku).filter(Boolean);

      // Identify variants to delete/deactivate
      const skusToDelete = existingSkus.filter((s) => !incomingSkus.includes(s));

      if (skusToDelete.length > 0) {
        try {
          await prisma.product.deleteMany({
            where: { sku: { in: skusToDelete } }
          });
        } catch (delError) {
          // If referenced in transactions, set their status to INACTIVE instead of throwing
          await prisma.product.updateMany({
            where: { sku: { in: skusToDelete } },
            data: { status: ProductStatus.INACTIVE }
          });
        }
      }

      // Upsert incoming variants
      for (const v of variants) {
        const variantSku = v.sku || `VAR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const p = await prisma.product.upsert({
          where: { sku: variantSku },
          update: {
            barcode: v.barcode || `479${Math.floor(1000000000 + Math.random() * 9000000000)}`,
            name: v.variantName || name,
            unitType: v.unit || 'Piece',
            costPrice: Number(v.costPrice || 0),
            sellingPrice: Number(v.sellingPrice || 0),
            currentStock: Number(v.stock || 0),
            reorderLevel: Number(v.reorderLevel || 10),
            targetCapacity: Number(v.targetCapacity || 50),
            imageUrl: v.imageUrl || imageUrl || '',
            variantAttributeType: v.attributeType ? `${v.attributeType}: ${v.attributeValue}` : null,
            batchNumber: v.batchNumber || null,
            mfgDate: v.mfgDate ? new Date(v.mfgDate) : null,
            expiryDate: v.expiryDate ? new Date(v.expiryDate) : null,
            status: mapStatus(status)
          },
          create: {
            sku: variantSku,
            masterId: masterId,
            barcode: v.barcode || `479${Math.floor(1000000000 + Math.random() * 9000000000)}`,
            name: v.variantName || name,
            unitType: v.unit || 'Piece',
            costPrice: Number(v.costPrice || 0),
            sellingPrice: Number(v.sellingPrice || 0),
            currentStock: Number(v.stock || 0),
            reorderLevel: Number(v.reorderLevel || 10),
            targetCapacity: Number(v.targetCapacity || 50),
            status: mapStatus(status),
            imageUrl: v.imageUrl || imageUrl || '',
            variantAttributeType: v.attributeType ? `${v.attributeType}: ${v.attributeValue}` : null,
            batchNumber: v.batchNumber || null,
            mfgDate: v.mfgDate ? new Date(v.mfgDate) : null,
            expiryDate: v.expiryDate ? new Date(v.expiryDate) : null
          }
        });
        updatedProducts.push(p);
      }
    } else {
      // Single product.
      // Update the product itself.
      // Since it is single, if there were previously variants, delete them (or deactivate if unsafe)
      const existingVariants = await prisma.product.findMany({
        where: { masterId, sku: { not: sku } }
      });

      if (existingVariants.length > 0) {
        const otherSkus = existingVariants.map((v) => v.sku);
        try {
          await prisma.product.deleteMany({
            where: { sku: { in: otherSkus } }
          });
        } catch (delError) {
          await prisma.product.updateMany({
            where: { sku: { in: otherSkus } },
            data: { status: ProductStatus.INACTIVE }
          });
        }
      }

      const p = await prisma.product.update({
        where: { sku },
        data: {
          barcode: barcode || product.barcode,
          name: name,
          unitType: unitType || 'Piece',
          costPrice: Number(costPrice || 0),
          sellingPrice: Number(sellingPrice || 0),
          currentStock: Number(currentStock || 0),
          reorderLevel: Number(reorderLevel || 10),
          targetCapacity: Number(targetCapacity || 50),
          imageUrl: imageUrl || '',
          variantAttributeType: null, // Clear attributes for single product
          mfgDate: mfgDate ? new Date(mfgDate) : null,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          batchNumber: batchNumber || null,
          status: mapStatus(status)
        }
      });
      updatedProducts.push(p);
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: updatedProducts
    });
  } catch (error: any) {
    console.error('Error updating product:', error);
    if (error.code === 'P2002') {
      const targets = error.meta?.target || [];
      const field = targets.join(', ');
      res.status(400).json({ success: false, message: `Duplicate entry error: The field(s) (${field}) already exist.` });
      return;
    }
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
