import { Request, Response } from 'express';
import { BrandState } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export const getBrands = async (_req: Request, res: Response): Promise<void> => {
  try {
    const brands = await prisma.brand.findMany();
    res.status(200).json({ success: true, data: brands });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const createBrand = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;
    const cleanName = name?.trim();
    const cleanDescription = description?.trim() || null;

    if (!cleanName) {
      res.status(400).json({ success: false, message: 'Brand name is required' });
      return;
    }
    if (cleanName.length > 50) {
      res.status(400).json({ success: false, message: 'Brand name must be 50 characters or less.' });
      return;
    }
    if (cleanDescription && cleanDescription.length > 250) {
      res.status(400).json({ success: false, message: 'Brand description must be 250 characters or less.' });
      return;
    }

    const newBrand = await prisma.brand.create({
      data: { 
        name: cleanName, 
        description: cleanDescription, 
        state: BrandState.ACTIVE 
      }
    });

    res.status(201).json({ success: true, data: newBrand });
  } catch (error: any) {
    console.error('Error creating brand:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ success: false, message: 'Brand name already exists' });
      return;
    }
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const updateBrand = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, description, state } = req.body;

    const brand = await prisma.brand.findUnique({ where: { id } });
    if (!brand) {
      res.status(404).json({ success: false, message: 'Brand not found' });
      return;
    }

    const cleanName = name !== undefined ? name?.trim() : undefined;
    const cleanDescription = description !== undefined ? description?.trim() : undefined;

    if (cleanName !== undefined && !cleanName) {
      res.status(400).json({ success: false, message: 'Brand name cannot be empty.' });
      return;
    }
    if (cleanName !== undefined && cleanName.length > 50) {
      res.status(400).json({ success: false, message: 'Brand name must be 50 characters or less.' });
      return;
    }
    if (cleanDescription !== undefined && cleanDescription && cleanDescription.length > 250) {
      res.status(400).json({ success: false, message: 'Brand description must be 250 characters or less.' });
      return;
    }

    const updatedBrand = await prisma.brand.update({
      where: { id },
      data: {
        name: cleanName,
        description: cleanDescription,
        state: state !== undefined ? state : undefined
      }
    });

    // Cascade status to products under this brand
    if (state !== undefined) {
      // Find all master product classes for this brand
      const masterClasses = await prisma.masterProductClass.findMany({
        where: { brandId: id },
        select: { id: true }
      });
      const masterClassIds = masterClasses.map((m) => m.id);

      if (masterClassIds.length > 0) {
        await prisma.product.updateMany({
          where: { masterId: { in: masterClassIds } },
          data: { status: state === BrandState.ACTIVE ? 'ACTIVE' : 'INACTIVE' }
        });
      }
    }

    res.status(200).json({ success: true, data: updatedBrand });
  } catch (error: any) {
    console.error('Error updating brand:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ success: false, message: 'Brand name already exists' });
      return;
    }
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
