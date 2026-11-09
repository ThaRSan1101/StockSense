import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { prisma } from '../config/prisma.js';
import { ComboValidationService } from '../services/comboValidationService.js';
import { Role } from '@prisma/client';

const getComboServiceUrl = (): string => {
  const base = (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000')
    .replace(':8080', ':8000')
    .replace(/\/+$/, '');
  return base.includes('/api/combo-analysis') ? base : `${base}/api/combo-analysis`;
};

// ── PROXY TO FASTAPI AI RUNS ─────────────────────────────────────────

export async function runComboAnalysis(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { cutoffDate } = req.body;
    const response = await fetch(`${getComboServiceUrl()}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cutoffDate: cutoffDate || null,
        createdBy: req.user?.name || 'SYSTEM'
      })
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ success: false, message: data.detail || 'Failed to trigger combo analysis run.' });
      return;
    }
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('Error running combo analysis:', error);
    res.status(500).json({ success: false, message: 'AI service is currently unavailable.' });
  }
}

export async function getComboAnalysisStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const response = await fetch(`${getComboServiceUrl()}/runs/${id}`);
    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ success: false, message: data.detail || 'Failed to fetch analysis status.' });
      return;
    }
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching analysis status:', error);
    res.status(500).json({ success: false, message: 'AI service is currently unavailable.' });
  }
}

// ── OPPORTUNITIES & SUGGESTIONS DIRECT QUERIES ───────────────────────

export async function getOpportunities(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { type, status } = req.query;

    const opportunities = await (prisma as any).comboOpportunity.findMany({
      where: {
        opportunityStatus: { notIn: ['IGNORED', 'EXPIRED'] }
      },
      include: {
        targetProduct: true
      },
      orderBy: [
        { priorityScore: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    // Fetch all active/approved combo commitments for target products
    const activeComboItems = await (prisma as any).comboItem.findMany({
      where: {
        role: 'TARGET',
        combo: {
          status: { in: ['APPROVED', 'ACTIVE'] },
          endDate: { gte: new Date() }
        }
      },
      include: {
        combo: {
          select: {
            maximumQuantity: true,
            soldQuantity: true
          }
        }
      }
    });

    const commitmentsMap: Record<string, number> = {};
    for (const item of activeComboItems) {
      const remainingPacks = Math.max(0, (item.combo?.maximumQuantity || 0) - (item.combo?.soldQuantity || 0));
      const committedUnits = item.quantity * remainingPacks;
      commitmentsMap[item.productId] = (commitmentsMap[item.productId] || 0) + committedUnits;
    }

    // Deduplicate: Guarantee exactly 1 highest-priority opportunity per target product
    const uniqueProductMap = new Map<string, any>();
    for (const opp of opportunities) {
      if (!uniqueProductMap.has(opp.targetProductId)) {
        uniqueProductMap.set(opp.targetProductId, opp);
      } else {
        const existing = uniqueProductMap.get(opp.targetProductId);
        if ((opp.priorityScore || 0) > (existing.priorityScore || 0)) {
          uniqueProductMap.set(opp.targetProductId, opp);
        }
      }
    }
    const distinctOpportunities = Array.from(uniqueProductMap.values());

    const enhancedOpportunities = distinctOpportunities.map((opp: any) => {
      const targetExcess = opp.excessStock || opp.currentStock || 0;
      const committedQty = commitmentsMap[opp.targetProductId] || 0;
      const remainingExcess = Math.max(0, targetExcess - committedQty);
      const coveragePercentage = targetExcess > 0 ? Math.min(100, Math.round((committedQty / targetExcess) * 100)) : 0;

      let clearanceStatus = 'UNCOVERED';
      if (coveragePercentage >= 100) {
        clearanceStatus = 'FULLY_CONVERTED';
      } else if (coveragePercentage > 0) {
        clearanceStatus = 'PARTIALLY_CONVERTED';
      }

      return {
        ...opp,
        targetExcessStock: targetExcess,
        committedStock: committedQty,
        remainingExcessStock: remainingExcess,
        coveragePercentage,
        clearanceStatus
      };
    });

    // Apply Filter 1: Type / Reason filter (SLOW_MOVING, DEAD_STOCK, NEAR_EXPIRY, OVERSTOCK, SEASONAL)
    let filteredData = enhancedOpportunities;
    if (typeof type === 'string' && type) {
      filteredData = filteredData.filter((o: any) => o.opportunityType === type);
    }

    // Apply Filter 2: Clearance Status filter (UNCOVERED, PARTIALLY_CONVERTED, FULLY_CONVERTED)
    if (typeof status === 'string' && status) {
      if (status === 'UNCOVERED' || status === 'DETECTED') {
        filteredData = filteredData.filter((o: any) => o.clearanceStatus === 'UNCOVERED');
      } else if (status === 'PARTIALLY_CONVERTED') {
        filteredData = filteredData.filter((o: any) => o.clearanceStatus === 'PARTIALLY_CONVERTED');
      } else if (status === 'FULLY_CONVERTED' || status === 'CONVERTED') {
        filteredData = filteredData.filter((o: any) => o.clearanceStatus === 'FULLY_CONVERTED');
      }
    }

    res.status(200).json({ success: true, data: filteredData });
  } catch (error: any) {
    console.error('Error fetching opportunities:', error);
    res.status(500).json({ success: false, message: 'Database error fetching opportunities.' });
  }
}

export async function getOpportunityDetails(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const opportunity = await (prisma as any).comboOpportunity.findUnique({
      where: { id },
      include: {
        targetProduct: true,
        targetBatch: true,
        anchorCandidates: {
          include: {
            anchorProduct: true
          },
          orderBy: {
            candidateRank: 'asc'
          }
        },
        comboSuggestions: {
          include: {
            targetProduct: true,
            primaryAnchorProduct: true,
            items: true
          },
          orderBy: {
            recommendationScore: 'desc'
          }
        }
      }
    });

    if (!opportunity) {
      res.status(404).json({ success: false, message: 'Opportunity not found.' });
      return;
    }

    res.status(200).json({ success: true, data: opportunity });
  } catch (error: any) {
    console.error('Error fetching opportunity details:', error);
    res.status(500).json({ success: false, message: 'Database error fetching details.' });
  }
}

export async function ignoreOpportunity(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    await (prisma as any).comboOpportunity.update({
      where: { id },
      data: { opportunityStatus: 'IGNORED' }
    });
    res.status(200).json({ success: true, message: 'Opportunity ignored.' });
  } catch (error: any) {
    console.error('Error ignoring opportunity:', error);
    res.status(500).json({ success: false, message: 'Database error updating opportunity.' });
  }
}

export async function getSuggestions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const status = req.query.status as string;
    const where: any = {};
    if (status) {
      where.suggestionStatus = status;
    }

    const suggestions = await (prisma as any).comboSuggestion.findMany({
      where,
      include: {
        targetProduct: true,
        primaryAnchorProduct: true
      },
      orderBy: {
        recommendationScore: 'desc'
      }
    });

    res.status(200).json({ success: true, data: suggestions });
  } catch (error: any) {
    console.error('Error fetching suggestions:', error);
    res.status(500).json({ success: false, message: 'Database error fetching suggestions.' });
  }
}

export async function getSuggestionDetails(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const suggestion = await (prisma as any).comboSuggestion.findUnique({
      where: { id },
      include: {
        targetProduct: true,
        primaryAnchorProduct: true,
        items: {
          include: {
            product: true,
            batch: true
          }
        },
        evidence: true
      }
    });

    if (!suggestion) {
      res.status(404).json({ success: false, message: 'Suggestion not found.' });
      return;
    }

    res.status(200).json({ success: true, data: suggestion });
  } catch (error: any) {
    console.error('Error fetching suggestion details:', error);
    res.status(500).json({ success: false, message: 'Database error fetching details.' });
  }
}

export async function generateSuggestions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const opportunityId = req.params.id as string;
    const response = await fetch(`${getComboServiceUrl()}/suggestions/generate/${opportunityId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ success: false, message: data.detail || 'Failed to generate suggestions.' });
      return;
    }

    res.status(200).json({ success: true, suggestions: data.suggestions });
  } catch (error: any) {
    console.error('Error generating suggestions:', error);
    res.status(500).json({ success: false, message: 'AI service is currently unavailable.' });
  }
}

// ── CONVERT SUGGESTION TO OPERATIONAL COMBO DRAFT ──────────────────

export async function convertToDraft(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const managerId = req.user?.id;

    if (!managerId) {
      res.status(401).json({ success: false, message: 'Unauthorized user.' });
      return;
    }

    // 1. Fetch suggestion with product names
    const sug = (await (prisma as any).comboSuggestion.findUnique({
      where: { id },
      include: { 
        items: true,
        targetProduct: true,
        primaryAnchorProduct: true
      }
    })) as any;

    if (!sug) {
      res.status(404).json({ success: false, message: 'Suggestion not found.' });
      return;
    }

    // Generate unique combo code
    const comboCode = `COMBO-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const targetName = sug.targetProduct?.name || sug.targetProductId;
    const anchorName = sug.primaryAnchorProduct?.name || sug.primaryAnchorProductId;
    const humanName = `${targetName} + ${anchorName} Combo Pack`;
    const cleanDescription = `Special Combo Deal: Buy ${targetName} with ${anchorName} and save Rs. ${Math.round(sug.recommendedDiscountAmount || 0)} (${Math.round(sug.recommendedDiscountPercentage || 0)}% OFF).`;

    // 2. Create Combo Draft in a transaction
    const combo = await (prisma as any).$transaction(async (tx: any) => {
      const newCombo = await tx.combo.create({
        data: {
          sourceSuggestionId: sug.id,
          comboCode,
          name: humanName,
          description: cleanDescription,
          comboType: sug.suggestionType,
          normalTotalPrice: sug.normalTotalPrice,
          comboPrice: sug.recommendedPrice,
          discountAmount: sug.recommendedDiscountAmount,
          discountPercentage: sug.recommendedDiscountPercentage,
          totalCost: sug.totalCost,
          expectedProfit: sug.expectedProfit,
          expectedMarginPercentage: sug.expectedMarginPercentage,
          maximumQuantity: sug.maximumComboQuantity,
          startDate: new Date(),
          endDate: sug.expiresAt || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          status: 'DRAFT',
          createdByInventoryManagerId: managerId
        }
      });

      // Insert combo items
      for (const item of sug.items) {
        await tx.comboItem.create({
          data: {
            comboId: newCombo.id,
            productId: item.productId,
            batchId: item.batchId,
            role: item.role,
            quantity: item.quantity,
            normalUnitPrice: item.normalUnitPrice,
            costPrice: item.costPrice,
            allocatedDiscount: item.allocatedDiscount,
            effectivePrice: item.effectiveSellingPrice,
            stockReserved: 0
          }
        });
      }

      // Update Suggestion and Opportunity status
      await tx.comboSuggestion.update({
        where: { id: sug.id },
        data: { suggestionStatus: 'CONVERTED_TO_DRAFT' }
      });

      await tx.comboOpportunity.update({
        where: { id: sug.opportunityId },
        data: { opportunityStatus: 'CONVERTED' }
      });

      // Record first action history log
      await tx.comboApprovalHistory.create({
        data: {
          comboId: newCombo.id,
          action: 'CREATED',
          previousStatus: 'NONE',
          newStatus: 'DRAFT',
          performedBy: managerId,
          performedByRole: req.user?.role || Role.INVENTORY_MANAGER,
          comment: 'Converted from AI Combo Suggestion'
        }
      });

      return newCombo;
    });

    res.status(201).json({ success: true, data: combo });
  } catch (error: any) {
    console.error('Error converting suggestion to draft:', error);
    res.status(500).json({ success: false, message: 'Database error converting suggestion.' });
  }
}

// ── CUSTOM COMBO DRAFTS AND CRUD ─────────────────────────────────────

export async function createComboDraft(req: AuthRequest, res: Response): Promise<void> {
  try {
    const managerId = req.user?.id;
    if (!managerId) {
      res.status(401).json({ success: false, message: 'Unauthorized user.' });
      return;
    }

    const { name, comboCode, description, comboType, comboPrice, startDate, endDate, items, adminOverride } = req.body;

    const parseDate = (val: any, fallbackDays: number = 0) => {
      if (!val) return new Date(Date.now() + fallbackDays * 24 * 60 * 60 * 1000);
      const d = new Date(val);
      return isNaN(d.getTime()) ? new Date(Date.now() + fallbackDays * 24 * 60 * 60 * 1000) : d;
    };

    const draftInput = {
      name,
      comboCode,
      description,
      comboType,
      comboPrice,
      startDate: parseDate(startDate, 0),
      endDate: parseDate(endDate, 30),
      createdByInventoryManagerId: managerId,
      adminOverride,
      items
    };

    // 1. Basic draft input validation
    if (!name || !name.trim()) {
      res.status(400).json({ success: false, message: 'Combo campaign name is required.' });
      return;
    }
    if (!items || items.length === 0) {
      res.status(400).json({ success: false, message: 'Please add at least 1 product to save a draft.' });
      return;
    }

    let normalTotalPrice = 0;
    let totalCost = 0;
    for (const item of items) {
      normalTotalPrice += item.normalUnitPrice * item.quantity;
      totalCost += item.costPrice * item.quantity;
    }

    const discountAmount = normalTotalPrice - comboPrice;
    const discountPercentage = normalTotalPrice > 0 ? Math.max(0, (discountAmount / normalTotalPrice) * 100) : 0;
    const expectedProfit = comboPrice - totalCost;
    const expectedMarginPercentage = comboPrice > 0 ? (expectedProfit / comboPrice) * 100 : 0;

    // Use requested maximum quantity or fallback to safe promo capacity
    const maxQty = req.body.maximumQuantity !== undefined ? parseInt(req.body.maximumQuantity) : 80;

    // 2. Write to DB
    const combo = await (prisma as any).$transaction(async (tx: any) => {
      const newCombo = await tx.combo.create({
        data: {
          comboCode,
          name,
          description,
          comboType,
          normalTotalPrice,
          comboPrice,
          discountAmount,
          discountPercentage,
          totalCost,
          expectedProfit,
          expectedMarginPercentage,
          maximumQuantity: maxQty,
          startDate: draftInput.startDate,
          endDate: draftInput.endDate,
          status: 'DRAFT',
          createdByInventoryManagerId: managerId
        }
      });

      for (const item of items) {
        await tx.comboItem.create({
          data: {
            comboId: newCombo.id,
            productId: item.productId,
            batchId: item.batchId || null,
            role: item.role,
            quantity: item.quantity,
            normalUnitPrice: item.normalUnitPrice,
            costPrice: item.costPrice,
            allocatedDiscount: item.allocatedDiscount || (discountAmount / items.length),
            effectivePrice: item.effectivePrice || (item.normalUnitPrice - (discountAmount / items.length)),
            stockReserved: 0
          }
        });
      }

      await tx.comboApprovalHistory.create({
        data: {
          comboId: newCombo.id,
          action: 'CREATED',
          previousStatus: 'NONE',
          newStatus: 'DRAFT',
          performedBy: managerId,
          performedByRole: req.user?.role || Role.INVENTORY_MANAGER,
          comment: 'Manually drafted custom combo'
        }
      });

      // Mark matching target opportunities as CONVERTED
      const targetProductIds = items.filter((i: any) => i.role === 'TARGET').map((i: any) => i.productId);
      if (targetProductIds.length > 0) {
        await tx.comboOpportunity.updateMany({
          where: {
            targetProductId: { in: targetProductIds },
            opportunityStatus: { notIn: ['CONVERTED', 'IGNORED'] }
          },
          data: {
            opportunityStatus: 'CONVERTED'
          }
        });
      }

      return newCombo;
    });

    res.status(201).json({ success: true, data: combo });
  } catch (error: any) {
    console.error('Error creating combo draft:', error);
    res.status(500).json({ success: false, message: 'Database error creating combo draft.' });
  }
}

export async function getCombosList(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { status } = req.query;
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const combos = await (prisma as any).combo.findMany({
      where,
      include: {
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ success: true, data: combos });
  } catch (error: any) {
    console.error('Error fetching combos list:', error);
    res.status(500).json({ success: false, message: 'Database error fetching combos.' });
  }
}

export async function getComboDetails(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const combo = await (prisma as any).combo.findUnique({
      where: { id },
      include: {
        items: { include: { product: true, batch: true } },
        approvals: { include: { performer: true }, orderBy: { performedAt: 'desc' } }
      }
    });

    if (!combo) {
      res.status(404).json({ success: false, message: 'Combo not found.' });
      return;
    }

    res.status(200).json({ success: true, data: combo });
  } catch (error: any) {
    console.error('Error fetching combo details:', error);
    res.status(500).json({ success: false, message: 'Database error fetching combo details.' });
  }
}

export async function updateComboDraft(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const managerId = req.user?.id;

    if (!managerId) {
      res.status(401).json({ success: false, message: 'Unauthorized user.' });
      return;
    }

    const { name, comboPrice, maximumQuantity, startDate, endDate, items, adminOverride } = req.body;

    const originalCombo = await (prisma as any).combo.findUnique({ where: { id } });
    if (!originalCombo || originalCombo.status !== 'DRAFT' && originalCombo.status !== 'CHANGES_REQUESTED') {
      res.status(400).json({ success: false, message: 'Combo can only be edited when in DRAFT or CHANGES_REQUESTED states.' });
      return;
    }

    const parseDate = (val: any, fallbackDays: number = 0) => {
      if (!val) return new Date(Date.now() + fallbackDays * 24 * 60 * 60 * 1000);
      const d = new Date(val);
      return isNaN(d.getTime()) ? new Date(Date.now() + fallbackDays * 24 * 60 * 60 * 1000) : d;
    };

    const draftInput = {
      name,
      comboCode: originalCombo.comboCode,
      comboType: originalCombo.comboType,
      comboPrice,
      maximumQuantity: maximumQuantity !== undefined ? parseInt(maximumQuantity) : originalCombo.maximumQuantity,
      startDate: parseDate(startDate, 0),
      endDate: parseDate(endDate, 30),
      createdByInventoryManagerId: originalCombo.createdByInventoryManagerId,
      adminOverride,
      items
    };

    // Basic draft input validation
    if (!name || !name.trim()) {
      res.status(400).json({ success: false, message: 'Combo campaign name is required.' });
      return;
    }
    if (!items || items.length === 0) {
      res.status(400).json({ success: false, message: 'Please add at least 1 product to save a draft.' });
      return;
    }

    let normalTotalPrice = 0;
    let totalCost = 0;
    for (const item of items) {
      normalTotalPrice += item.normalUnitPrice * item.quantity;
      totalCost += item.costPrice * item.quantity;
    }

    const discountAmount = normalTotalPrice - comboPrice;
    const discountPercentage = normalTotalPrice > 0 ? Math.max(0, (discountAmount / normalTotalPrice) * 100) : 0;
    const expectedProfit = comboPrice - totalCost;
    const expectedMarginPercentage = comboPrice > 0 ? (expectedProfit / comboPrice) * 100 : 0;

    await (prisma as any).$transaction(async (tx: any) => {
      await tx.combo.update({
        where: { id },
        data: {
          name,
          normalTotalPrice,
          comboPrice,
          discountAmount,
          discountPercentage,
          totalCost,
          expectedProfit,
          expectedMarginPercentage,
          maximumQuantity: draftInput.maximumQuantity || 50,
          startDate: draftInput.startDate,
          endDate: draftInput.endDate,
        }
      });

      // Clear older items
      await tx.comboItem.deleteMany({ where: { comboId: id } });

      // Insert updated items
      for (const item of items) {
        await tx.comboItem.create({
          data: {
            comboId: id,
            productId: item.productId,
            batchId: item.batchId || null,
            role: item.role,
            quantity: item.quantity,
            normalUnitPrice: item.normalUnitPrice,
            costPrice: item.costPrice,
            allocatedDiscount: item.allocatedDiscount || (discountAmount / items.length),
            effectivePrice: item.effectivePrice || (item.normalUnitPrice - (discountAmount / items.length)),
            stockReserved: 0
          }
        });
      }

      // Record update log
      await tx.comboApprovalHistory.create({
        data: {
          comboId: id,
          action: 'UPDATED',
          previousStatus: originalCombo.status,
          newStatus: originalCombo.status,
          performedBy: managerId,
          performedByRole: req.user?.role || Role.INVENTORY_MANAGER,
          comment: 'Modified combo draft values'
        }
      });
    });

    res.status(200).json({ success: true, message: 'Combo draft updated successfully.' });
  } catch (error: any) {
    console.error('Error updating combo draft:', error);
    res.status(500).json({ success: false, message: 'Database error updating draft.' });
  }
}

export async function deleteCombo(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const combo = await (prisma as any).combo.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!combo) {
      res.status(404).json({ success: false, message: 'Combo not found.' });
      return;
    }

    if (combo.status !== 'DRAFT' && combo.status !== 'REJECTED' && combo.status !== 'CANCELLED' && combo.status !== 'CHANGES_REQUESTED') {
      res.status(400).json({ success: false, message: 'Only Draft, Rejected, or Cancelled combos can be deleted.' });
      return;
    }

    await (prisma as any).$transaction(async (tx: any) => {
      // If linked to suggestion, revert suggestion status
      if (combo.sourceSuggestionId) {
        await tx.comboSuggestion.update({
          where: { id: combo.sourceSuggestionId },
          data: { suggestionStatus: 'GENERATED' }
        });
      }

      // Revert target product opportunities back to DETECTED so they reappear in opportunity analysis
      const targetProductIds = combo.items.filter((i: any) => i.role === 'TARGET').map((i: any) => i.productId);
      if (targetProductIds.length > 0) {
        await tx.comboOpportunity.updateMany({
          where: {
            targetProductId: { in: targetProductIds },
            opportunityStatus: 'CONVERTED'
          },
          data: {
            opportunityStatus: 'DETECTED'
          }
        });
      }

      await tx.comboApprovalHistory.deleteMany({ where: { comboId: id } });
      await tx.comboItem.deleteMany({ where: { comboId: id } });
      await tx.combo.delete({ where: { id } });
    });

    res.status(200).json({ success: true, message: 'Combo deleted successfully.' });
  } catch (error: any) {
    console.error('Error deleting combo:', error);
    res.status(500).json({ success: false, message: 'Database error deleting combo.' });
  }
}

// ── APPROVAL WORKFLOW TRANSITIONS ────────────────────────────────────

export async function submitComboForApproval(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params.id as string;
  const user = req.user!;
  const result = await ComboValidationService.transitionComboStatus(prisma, id, 'PENDING_APPROVAL', user.id, user.role);
  if (!result.success) {
    res.status(400).json({ success: false, message: result.error });
    return;
  }
  res.status(200).json({ success: true, message: 'Combo submitted for approval.' });
}

export async function approveCombo(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params.id as string;
  const user = req.user!;
  const result = await ComboValidationService.transitionComboStatus(prisma, id, 'APPROVED', user.id, user.role);
  if (!result.success) {
    res.status(400).json({ success: false, message: result.error });
    return;
  }
  res.status(200).json({ success: true, message: 'Combo approved by Administrator.' });
}

export async function rejectCombo(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { comment } = req.body;
  const user = req.user!;
  const result = await ComboValidationService.transitionComboStatus(prisma, id, 'REJECTED', user.id, user.role, comment);
  if (!result.success) {
    res.status(400).json({ success: false, message: result.error });
    return;
  }
  res.status(200).json({ success: true, message: 'Combo rejected.' });
}

export async function requestComboChanges(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { comment } = req.body;
  const user = req.user!;
  const result = await ComboValidationService.transitionComboStatus(prisma, id, 'CHANGES_REQUESTED', user.id, user.role, comment);
  if (!result.success) {
    res.status(400).json({ success: false, message: result.error });
    return;
  }
  res.status(200).json({ success: true, message: 'Revision feedback sent to Inventory Manager.' });
}

export async function activateCombo(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params.id as string;
  const user = req.user!;
  const result = await ComboValidationService.transitionComboStatus(prisma, id, 'ACTIVE', user.id, user.role);
  if (!result.success) {
    res.status(400).json({ success: false, message: result.error });
    return;
  }
  res.status(200).json({ success: true, message: 'Combo activated and stock buffers reserved.' });
}

export async function pauseCombo(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params.id as string;
  const user = req.user!;
  const result = await ComboValidationService.transitionComboStatus(prisma, id, 'PAUSED', user.id, user.role);
  if (!result.success) {
    res.status(400).json({ success: false, message: result.error });
    return;
  }
  res.status(200).json({ success: true, message: 'Combo campaign paused.' });
}

export async function cancelCombo(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params.id as string;
  const user = req.user!;
  const result = await ComboValidationService.transitionComboStatus(prisma, id, 'CANCELLED', user.id, user.role);
  if (!result.success) {
    res.status(400).json({ success: false, message: result.error });
    return;
  }
  res.status(200).json({ success: true, message: 'Combo cancelled; unused reserved stock buffers released.' });
}

// ── CUSTOMER & POS LOOKUPS ───────────────────────────────────────────

export async function getPublicActiveCombos(req: any, res: Response): Promise<void> {
  try {
    const active = await (prisma as any).combo.findMany({
      where: {
        status: { in: ['ACTIVE', 'APPROVED'] },
        endDate: { gte: new Date() }
      },
      select: {
        id: true,
        comboCode: true,
        name: true,
        description: true,
        comboType: true,
        sourceSuggestionId: true,
        comboPrice: true,
        normalTotalPrice: true,
        discountPercentage: true,
        maximumQuantity: true,
        soldQuantity: true,
        startDate: true,
        endDate: true,
        items: {
          select: {
            productId: true,
            role: true,
            quantity: true,
            normalUnitPrice: true,
            product: {
              select: {
                name: true,
                imageUrl: true,
                sku: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Filter out sold-out combos
    const availableCombos = active.filter((c: any) => c.maximumQuantity <= 0 || c.soldQuantity < c.maximumQuantity);
    res.status(200).json({ success: true, data: availableCombos });
  } catch (error: any) {
    console.error('Error fetching public combos:', error);
    res.status(500).json({ success: false, message: 'Database error fetching offers.' });
  }
}

export async function getPosActiveCombos(req: AuthRequest, res: Response): Promise<void> {
  try {
    const active = await (prisma as any).combo.findMany({
      where: {
        status: { in: ['ACTIVE', 'APPROVED'] },
        endDate: { gte: new Date() }
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                sku: true,
                name: true,
                barcode: true,
                costPrice: true,
                sellingPrice: true,
                imageUrl: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Filter out sold-out combos
    const availableCombos = active.filter((c: any) => c.maximumQuantity <= 0 || c.soldQuantity < c.maximumQuantity);
    res.status(200).json({ success: true, data: availableCombos });
  } catch (error: any) {
    console.error('Error fetching POS combos:', error);
    res.status(500).json({ success: false, message: 'Database error fetching POS lookup.' });
  }
}

// ── COMBO PERFORMANCE & ANALYTICS MONITORING ───────────────────────

export async function getComboPerformanceSummary(req: AuthRequest, res: Response): Promise<void> {
  try {
    const performances = await (prisma as any).comboPerformance.findMany({
      include: {
        combo: true
      },
      orderBy: {
        profitGenerated: 'desc'
      }
    });
    res.status(200).json({ success: true, data: performances });
  } catch (error: any) {
    console.error('Error fetching performance summary:', error);
    res.status(500).json({ success: false, message: 'Database error compiling performance indicators.' });
  }
}

export async function getSingleComboPerformance(req: AuthRequest, res: Response): Promise<void> {
  try {
    const comboId = req.params.comboId as string;
    const performance = await (prisma as any).comboPerformance.findFirst({
      where: { comboId },
      include: { combo: true }
    });
    res.status(200).json({ success: true, data: performance || null });
  } catch (error: any) {
    console.error('Error fetching single combo performance:', error);
    res.status(500).json({ success: false, message: 'Database error compiling details.' });
  }
}
