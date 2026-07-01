import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';

export const getSuppliers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, data: suppliers });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const createSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, companyName, email, phone, address } = req.body;
    const cleanName = name?.trim();
    const cleanCompanyName = companyName?.trim();
    const cleanEmail = email?.trim() || null;
    const cleanPhone = phone?.trim();
    const cleanAddress = address?.trim();

    if (!cleanName || !cleanCompanyName) {
      res.status(400).json({ success: false, message: 'Name and Company Name are required' });
      return;
    }
    if (cleanName.length > 100) {
      res.status(400).json({ success: false, message: 'Supplier name must be 100 characters or less.' });
      return;
    }
    if (!/^[a-zA-Z\s]+$/.test(cleanName)) {
      res.status(400).json({ success: false, message: 'Supplier name must contain letters only.' });
      return;
    }
    if (cleanCompanyName.length > 100) {
      res.status(400).json({ success: false, message: 'Company name must be 100 characters or less.' });
      return;
    }
    if (!/^[a-zA-Z0-9\s.,&'()-]+$/.test(cleanCompanyName)) {
      res.status(400).json({ success: false, message: 'Company name can only contain letters, numbers, and basic punctuation.' });
      return;
    }
    if (cleanEmail) {
      if (cleanEmail.length > 100) {
        res.status(400).json({ success: false, message: 'Email must be 100 characters or less.' });
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        res.status(400).json({ success: false, message: 'Enter a valid email address.' });
        return;
      }
      const existingEmail = await prisma.supplier.findFirst({ where: { email: cleanEmail } });
      if (existingEmail) {
        res.status(400).json({ success: false, message: 'This email address is already registered.' });
        return;
      }
    }
    if (cleanPhone) {
      if (!/^\d{10}$/.test(cleanPhone)) {
        res.status(400).json({ success: false, message: 'Phone number must be exactly 10 digits.' });
        return;
      }
    }
    if (cleanAddress && cleanAddress.length > 300) {
      res.status(400).json({ success: false, message: 'Address must be 300 characters or less.' });
      return;
    }

    const newSupplier = await prisma.supplier.create({
      data: {
        name: cleanName,
        companyName: cleanCompanyName,
        email: cleanEmail,
        phone: cleanPhone || '',
        address: cleanAddress || ''
      }
    });

    res.status(201).json({ success: true, data: newSupplier });
  } catch (error: any) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const updateSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, companyName, email, phone, address } = req.body;

    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) {
      res.status(404).json({ success: false, message: 'Supplier not found' });
      return;
    }

    const cleanName = name !== undefined ? name?.trim() : undefined;
    const cleanCompanyName = companyName !== undefined ? companyName?.trim() : undefined;
    const cleanEmail = email !== undefined ? (email !== null ? email?.trim() : null) : undefined;
    const cleanPhone = phone !== undefined ? phone?.trim() : undefined;
    const cleanAddress = address !== undefined ? address?.trim() : undefined;

    if (cleanName !== undefined && !cleanName) {
      res.status(400).json({ success: false, message: 'Supplier name cannot be empty.' });
      return;
    }
    if (cleanName !== undefined && cleanName.length > 100) {
      res.status(400).json({ success: false, message: 'Supplier name must be 100 characters or less.' });
      return;
    }
    if (cleanName !== undefined && !/^[a-zA-Z\s]+$/.test(cleanName)) {
      res.status(400).json({ success: false, message: 'Supplier name must contain letters only.' });
      return;
    }

    if (cleanCompanyName !== undefined && !cleanCompanyName) {
      res.status(400).json({ success: false, message: 'Company name cannot be empty.' });
      return;
    }
    if (cleanCompanyName !== undefined && cleanCompanyName.length > 100) {
      res.status(400).json({ success: false, message: 'Company name must be 100 characters or less.' });
      return;
    }
    if (cleanCompanyName !== undefined && !/^[a-zA-Z0-9\s.,&'()-]+$/.test(cleanCompanyName)) {
      res.status(400).json({ success: false, message: 'Company name can only contain letters, numbers, and basic punctuation.' });
      return;
    }

    if (cleanEmail !== undefined && cleanEmail) {
      if (cleanEmail.length > 100) {
        res.status(400).json({ success: false, message: 'Email must be 100 characters or less.' });
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        res.status(400).json({ success: false, message: 'Enter a valid email address.' });
        return;
      }
      const existingEmail = await prisma.supplier.findFirst({
        where: {
          email: cleanEmail,
          id: { not: id }
        }
      });
      if (existingEmail) {
        res.status(400).json({ success: false, message: 'This email address is already registered.' });
        return;
      }
    }

    if (cleanPhone !== undefined && cleanPhone) {
      if (!/^\d{10}$/.test(cleanPhone)) {
        res.status(400).json({ success: false, message: 'Phone number must be exactly 10 digits.' });
        return;
      }
    }

    if (cleanAddress !== undefined && cleanAddress && cleanAddress.length > 300) {
      res.status(400).json({ success: false, message: 'Address must be 300 characters or less.' });
      return;
    }

    const updatedSupplier = await prisma.supplier.update({
      where: { id },
      data: {
        name: cleanName,
        companyName: cleanCompanyName,
        email: cleanEmail,
        phone: cleanPhone,
        address: cleanAddress
      }
    });

    res.status(200).json({ success: true, data: updatedSupplier });
  } catch (error: any) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const deleteSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) {
      res.status(404).json({ success: false, message: 'Supplier not found' });
      return;
    }

    // Check if supplier is referenced in master product classes
    const classCount = await prisma.masterProductClass.count({
      where: { supplierId: id }
    });
    if (classCount > 0) {
      res.status(400).json({
        success: false,
        message: 'Cannot delete supplier because it is associated with products.'
      });
      return;
    }

    await prisma.supplier.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
