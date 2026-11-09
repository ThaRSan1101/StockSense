import express from 'express';
import { getProducts, createProduct, updateProduct } from '../controllers/productController.js';
import { authenticate, requireRole, optionalAuthenticate } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(optionalAuthenticate, getProducts)
  .post(authenticate, requireRole('ADMIN', 'INVENTORY_MANAGER'), createProduct);

router.route('/:sku')
  .put(authenticate, requireRole('ADMIN', 'INVENTORY_MANAGER'), updateProduct);

export default router;
