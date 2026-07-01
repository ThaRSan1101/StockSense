import express from 'express';
import { getBrands, createBrand, updateBrand } from '../controllers/brandController.js';
import { authenticate, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(getBrands)
  .post(authenticate, requireRole('ADMIN', 'INVENTORY_MANAGER'), createBrand);

router.route('/:id')
  .put(authenticate, requireRole('ADMIN', 'INVENTORY_MANAGER'), updateBrand);

export default router;
