import express from 'express';
import {
  getDiscounts,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  toggleStatus
} from '../controllers/discountController.js';
import { authenticate, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(authenticate, requireRole('ADMIN', 'INVENTORY_MANAGER', 'CASHIER'), getDiscounts)
  .post(authenticate, requireRole('ADMIN', 'INVENTORY_MANAGER'), createDiscount);

router.route('/:id')
  .put(authenticate, requireRole('ADMIN', 'INVENTORY_MANAGER'), updateDiscount)
  .delete(authenticate, requireRole('ADMIN', 'INVENTORY_MANAGER'), deleteDiscount);

router.route('/:id/status')
  .patch(authenticate, requireRole('ADMIN', 'INVENTORY_MANAGER'), toggleStatus);

export default router;
