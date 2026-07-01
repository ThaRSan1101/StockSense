import express from 'express';
import { 
  getCategories, 
  createCategory, 
  updateCategory, 
  createSubCategory, 
  updateSubCategory 
} from '../controllers/categoryController.js';
import { authenticate, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(getCategories)
  .post(authenticate, requireRole('ADMIN', 'INVENTORY_MANAGER'), createCategory);

router.route('/:id')
  .put(authenticate, requireRole('ADMIN', 'INVENTORY_MANAGER'), updateCategory);

router.route('/subcategories')
  .post(authenticate, requireRole('ADMIN', 'INVENTORY_MANAGER'), createSubCategory);

router.route('/subcategories/:id')
  .put(authenticate, requireRole('ADMIN', 'INVENTORY_MANAGER'), updateSubCategory);

export default router;
