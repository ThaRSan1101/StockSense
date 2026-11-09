import { Router } from 'express';
import {
  getNotifications,
  markNotificationRead,
  dismissNotification,
  createNotificationApi
} from '../controllers/notificationController.js';
import { authenticate, requireRole } from '../middlewares/authMiddleware.js';

const router = Router();

// User notification endpoints
router.get('/', authenticate, getNotifications);
router.patch('/:id/read', authenticate, markNotificationRead);
router.patch('/:id/dismiss', authenticate, dismissNotification);

// Protected notification creation endpoint (ADMIN & INVENTORY_MANAGER only)
router.post('/', authenticate, requireRole('ADMIN', 'INVENTORY_MANAGER'), createNotificationApi);

export default router;
