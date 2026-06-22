import { Router } from 'express';
import {
  getDemandForecast,
  getSmartDiscounts,
  getStockVelocity,
  getAprioriCombos,
  runAiSync
} from '../controllers/aiController.js';
import { authenticate, requireRole } from '../middlewares/authMiddleware.js';

const router = Router();

// Secure all AI paths to authenticated managers and admins
router.use(authenticate);

router.get('/forecast', getDemandForecast);
router.get('/discounts', getSmartDiscounts);
router.get('/velocity', getStockVelocity);
router.get('/combos', getAprioriCombos);

// Sync pipeline requires either ADMIN or INVENTORY_MANAGER role
router.post('/sync', requireRole('ADMIN', 'INVENTORY_MANAGER'), runAiSync);

export default router;
