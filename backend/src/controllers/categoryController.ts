import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';

// Get all categories including subcategories
export const getCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        subCategories: {
          orderBy: { name: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Create a new category
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, categoryImageUrl } = req.body;
    const cleanName = name?.trim();
    const cleanDescription = description?.trim() || null;
    const cleanImageUrl = categoryImageUrl?.trim() || null;

    if (!cleanName) {
      res.status(400).json({ success: false, message: 'Category name is required' });
      return;
    }
    if (cleanName.length > 50) {
      res.status(400).json({ success: false, message: 'Category name must be 50 characters or less.' });
      return;
    }
    if (cleanDescription && cleanDescription.length > 250) {
      res.status(400).json({ success: false, message: 'Category description must be 250 characters or less.' });
      return;
    }

    const newCategory = await prisma.category.create({
      data: { name: cleanName, description: cleanDescription, categoryImageUrl: cleanImageUrl }
    });

    res.status(201).json({ success: true, data: newCategory });
  } catch (error: any) {
    console.error('Error creating category:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ success: false, message: 'Category name already exists' });
      return;
    }
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Update a category (supports status toggles and cascading)
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, description, categoryImageUrl, isActive } = req.body;

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      res.status(404).json({ success: false, message: 'Category not found' });
      return;
    }

    const cleanName = name !== undefined ? name?.trim() : undefined;
    const cleanDescription = description !== undefined ? description?.trim() : undefined;
    const cleanImageUrl = categoryImageUrl !== undefined ? categoryImageUrl?.trim() : undefined;

    if (cleanName !== undefined && !cleanName) {
      res.status(400).json({ success: false, message: 'Category name cannot be empty.' });
      return;
    }
    if (cleanName !== undefined && cleanName.length > 50) {
      res.status(400).json({ success: false, message: 'Category name must be 50 characters or less.' });
      return;
    }
    if (cleanDescription !== undefined && cleanDescription && cleanDescription.length > 250) {
      res.status(400).json({ success: false, message: 'Category description must be 250 characters or less.' });
      return;
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: {
        name: cleanName,
        description: cleanDescription,
        categoryImageUrl: cleanImageUrl,
        isActive: isActive !== undefined ? isActive : undefined
      }
    });

    // Cascade isActive status to subcategories and products
    if (isActive !== undefined) {
      await prisma.subCategory.updateMany({
        where: { categoryId: id },
        data: { isActive }
      });

      await prisma.product.updateMany({
        where: { masterClass: { categoryId: id } },
        data: { status: isActive ? 'ACTIVE' : 'INACTIVE' }
      });
    }

    res.status(200).json({ success: true, data: updatedCategory });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Create a new subcategory
export const createSubCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, categoryId } = req.body;
    const cleanName = name?.trim();
    const cleanDescription = description?.trim() || null;

    if (!cleanName || !categoryId) {
      res.status(400).json({ success: false, message: 'Name and categoryId are required' });
      return;
    }
    if (cleanName.length > 50) {
      res.status(400).json({ success: false, message: 'Subcategory name must be 50 characters or less.' });
      return;
    }
    if (cleanDescription && cleanDescription.length > 250) {
      res.status(400).json({ success: false, message: 'Subcategory description must be 250 characters or less.' });
      return;
    }

    const newSubCategory = await prisma.subCategory.create({
      data: { name: cleanName, description: cleanDescription, categoryId }
    });

    res.status(201).json({ success: true, data: newSubCategory });
  } catch (error: any) {
    console.error('Error creating subcategory:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ success: false, message: 'Subcategory name already exists' });
      return;
    }
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Update a subcategory (supports status toggles and cascading)
export const updateSubCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, description, categoryId, isActive } = req.body;

    const subCategory = await prisma.subCategory.findUnique({ where: { id } });
    if (!subCategory) {
      res.status(404).json({ success: false, message: 'Subcategory not found' });
      return;
    }

    const cleanName = name !== undefined ? name?.trim() : undefined;
    const cleanDescription = description !== undefined ? description?.trim() : undefined;

    if (cleanName !== undefined && !cleanName) {
      res.status(400).json({ success: false, message: 'Subcategory name cannot be empty.' });
      return;
    }
    if (cleanName !== undefined && cleanName.length > 50) {
      res.status(400).json({ success: false, message: 'Subcategory name must be 50 characters or less.' });
      return;
    }
    if (cleanDescription !== undefined && cleanDescription && cleanDescription.length > 250) {
      res.status(400).json({ success: false, message: 'Subcategory description must be 250 characters or less.' });
      return;
    }

    const updatedSubCategory = await prisma.subCategory.update({
      where: { id },
      data: {
        name: cleanName,
        description: cleanDescription,
        categoryId: categoryId !== undefined ? categoryId : undefined,
        isActive: isActive !== undefined ? isActive : undefined
      }
    });

    // Cascade status to products under this subcategory
    if (isActive !== undefined) {
      await prisma.product.updateMany({
        where: { masterClass: { subCategoryId: id } },
        data: { status: isActive ? 'ACTIVE' : 'INACTIVE' }
      });
    }

    res.status(200).json({ success: true, data: updatedSubCategory });
  } catch (error) {
    console.error('Error updating subcategory:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
