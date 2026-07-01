import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { z } from 'zod';

const stockRulesSchema = z.object({
  defaultReorderLevel: z.string().regex(/^\d+$/, 'Must be a valid number'),
  minimumStockThreshold: z.string().regex(/^\d+$/, 'Must be a valid number'),
  maximumStockLimit: z.string(),
  stockUpdateMode: z.string(),
  allowNegativeStock: z.boolean(),
  autoDeductStock: z.boolean(),
  enableLowStockAlerts: z.boolean(),
  enableOutOfStockAlerts: z.boolean(),
  enableDeadStockAlerts: z.boolean(),
  enableExpiringSoonAlerts: z.boolean(),
  enableOverstockAlerts: z.boolean(),
  notifyInApp: z.boolean(),
  notifyEmail: z.boolean(),
  notifySMS: z.boolean(),
});

export const getSettings = async (req: Request, res: Response) => {
  try {
    const key = req.params.key as string;

    const setting = await prisma.systemSetting.findUnique({
      where: { key }
    });

    if (!setting) {
      return res.status(200).json({ message: "Setting not found, returning null", data: null });
    }

    res.status(200).json({ message: "Setting retrieved successfully", data: setting.value });
  } catch (error) {
    console.error("Error retrieving setting:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const key = req.params.key as string;
    const { value } = req.body;

    let finalValue = value;

    if (key === 'STOCK_RULES') {
      const parsed = stockRulesSchema.safeParse(value);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: 'Invalid settings format: ' + parsed.error.issues[0].message });
      }
      finalValue = parsed.data;
    }

    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value: finalValue },
      create: { key, value: finalValue }
    });

    res.status(200).json({ message: "Setting updated successfully", data: setting.value });
  } catch (error) {
    console.error("Error updating setting:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const applyStockRulesToAllProducts = async (req: Request, res: Response) => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'STOCK_RULES' }
    });

    if (!setting || !setting.value) {
      return res.status(400).json({ message: "Global stock rules not found. Please save them first." });
    }

    const rules = setting.value as any;
    const defaultReorderLevelPct = parseFloat(rules.defaultReorderLevel) || 0;
    // const minimumStockThresholdPct = parseFloat(rules.minimumStockThreshold) || 0;

    const products = await prisma.product.findMany({
      select: { sku: true, targetCapacity: true }
    });

    const updates = products.map(product => {
      const calculatedReorderLevel = Math.round((product.targetCapacity * defaultReorderLevelPct) / 100);
      
      return prisma.product.update({
        where: { sku: product.sku },
        data: { 
          reorderLevel: calculatedReorderLevel,
          // If you ever add minimumStockLevel to the Product schema, you can update it here:
          // minimumStockLevel: Math.round((product.targetCapacity * minimumStockThresholdPct) / 100)
        }
      });
    });

    await prisma.$transaction(updates);

    res.status(200).json({ 
      message: `Successfully applied stock rules to ${products.length} products.`,
      updatedCount: products.length
    });

  } catch (error) {
    console.error("Error applying stock rules to products:", error);
    res.status(500).json({ message: "Internal server error while applying rules." });
  }
};
