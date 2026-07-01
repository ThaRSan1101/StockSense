import { Router } from 'express';
import { getGRNs, createGRN, getAdjustments, createAdjustment, getLedger } from '../controllers/inventoryController.js';
import { authenticate, requireRole } from '../middlewares/authMiddleware.js';

const router = Router();

// Require authenticate and ADMIN/INVENTORY_MANAGER role for all endpoints in this file
router.use(authenticate, requireRole('ADMIN', 'INVENTORY_MANAGER'));

router.get('/grns', getGRNs);
router.post('/grns', createGRN);

router.get('/adjustments', getAdjustments);
router.post('/adjustments', createAdjustment);

router.get('/ledger', getLedger);

export default router;
