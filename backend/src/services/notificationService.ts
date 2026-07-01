import { prisma } from '../config/prisma.js';
import { NotificationType, NotificationSeverity, Role } from '@prisma/client';

export class NotificationService {
  /**
   * Create a new notification in the database
   */
  static async createNotification(params: {
    type: NotificationType;
    severity?: NotificationSeverity;
    title: string;
    message: string;
    sku?: string;
    suggestedAction?: string;
    metadata?: any;
    targetRole?: Role;
  }) {
    try {
      const notification = await prisma.notification.create({
        data: {
          type: params.type,
          severity: params.severity || 'INFO',
          title: params.title,
          message: params.message,
          sku: params.sku || null,
          suggestedAction: params.suggestedAction || null,
          metadata: params.metadata || null,
          targetRole: params.targetRole || null,
        },
      });
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Scan all active products and generate alerts for all categories (low stock, overstock, expiry, dead stock, reorders)
   */
  static async scanAndGenerateStockAlerts() {
    try {
      // 0. Clean up any duplicate notifications in the database first
      const allNotifications = await prisma.notification.findMany({
        orderBy: { createdAt: 'desc' }
      });
      const seen = new Set<string>();
      const toDelete: string[] = [];
      for (const n of allNotifications) {
        if (n.sku) {
          const key = `${n.type}:${n.sku}`;
          if (seen.has(key)) {
            toDelete.push(n.id);
          } else {
            seen.add(key);
          }
        }
      }
      if (toDelete.length > 0) {
        // Delete in batches to avoid query parameter limit issues if toDelete is very large
        const batchSize = 100;
        for (let i = 0; i < toDelete.length; i += batchSize) {
          const batch = toDelete.slice(i, i + batchSize);
          await prisma.notification.deleteMany({
            where: { id: { in: batch } }
          });
        }
        console.log(`[Deduplication] Cleaned up ${toDelete.length} duplicate alerts from the database.`);
      }

      // 1. Fetch system settings rules
      const rulesSetting = await prisma.systemSetting.findUnique({
        where: { key: 'STOCK_RULES' }
      });
      const rules = (rulesSetting?.value as any) || {};

      let maxStockPercent = 100;
      if (rules.maximumStockLimit && rules.maximumStockLimit !== 'No limit') {
        const parsed = parseInt(rules.maximumStockLimit, 10);
        if (!isNaN(parsed)) {
          maxStockPercent = parsed;
        }
      }
      const enableLowStockAlerts = rules.enableLowStockAlerts !== false;
      const enableOutOfStockAlerts = rules.enableOutOfStockAlerts !== false;
      const enableExpiringSoonAlerts = rules.enableExpiringSoonAlerts !== false;
      const enableDeadStockAlerts = rules.enableDeadStockAlerts === true;
      const enableOverstockAlerts = rules.enableOverstockAlerts === true;

      // 2. Fetch all active products
      const products = await prisma.product.findMany({
        where: { status: 'ACTIVE' }
      });

      const now = new Date();

      for (const product of products) {
        await this.checkAndTriggerAllAlertsForProduct(product, {
          maxStockPercent,
          enableLowStockAlerts,
          enableOutOfStockAlerts,
          enableExpiringSoonAlerts,
          enableDeadStockAlerts,
          enableOverstockAlerts
        }, now);
      }
    } catch (error) {
      console.error('Error scanning all stock alerts:', error);
    }
  }

  /**
   * Check stock levels and automatically delegate to unified check function
   */
  static async checkAndTriggerStockAlerts(sku: string) {
    try {
      const product = await prisma.product.findUnique({
        where: { sku },
      });

      if (!product) return;

      const rulesSetting = await prisma.systemSetting.findUnique({
        where: { key: 'STOCK_RULES' }
      });
      const rules = (rulesSetting?.value as any) || {};

      let maxStockPercent = 100;
      if (rules.maximumStockLimit && rules.maximumStockLimit !== 'No limit') {
        const parsed = parseInt(rules.maximumStockLimit, 10);
        if (!isNaN(parsed)) {
          maxStockPercent = parsed;
        }
      }
      const enableLowStockAlerts = rules.enableLowStockAlerts !== false;
      const enableOutOfStockAlerts = rules.enableOutOfStockAlerts !== false;
      const enableExpiringSoonAlerts = rules.enableExpiringSoonAlerts !== false;
      const enableDeadStockAlerts = rules.enableDeadStockAlerts === true;
      const enableOverstockAlerts = rules.enableOverstockAlerts === true;

      const now = new Date();

      await this.checkAndTriggerAllAlertsForProduct(product, {
        maxStockPercent,
        enableLowStockAlerts,
        enableOutOfStockAlerts,
        enableExpiringSoonAlerts,
        enableDeadStockAlerts,
        enableOverstockAlerts
      }, now);
    } catch (error) {
      console.error('Error checking stock alerts:', error);
    }
  }

  /**
   * Run all checks for a single product and generate/resolve notifications in the database
   */
  static async checkAndTriggerAllAlertsForProduct(
    product: any,
    config: {
      maxStockPercent: number;
      enableLowStockAlerts: boolean;
      enableOutOfStockAlerts: boolean;
      enableExpiringSoonAlerts: boolean;
      enableDeadStockAlerts: boolean;
      enableOverstockAlerts: boolean;
    },
    now: Date
  ) {
    const sku = product.sku;
    const currentStock = product.currentStock;
    const reorderLevel = product.reorderLevel;
    const targetCapacity = product.targetCapacity || 100;

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Low Stock & Out of Stock Alerts
    // ─────────────────────────────────────────────────────────────────────────
    if (config.enableOutOfStockAlerts && currentStock === 0) {
      // Out of Stock Alert
      const existing = await prisma.notification.findFirst({
        where: { sku, type: 'OUT_OF_STOCK' }
      });
      if (!existing) {
        await this.createNotification({
          type: 'OUT_OF_STOCK',
          severity: 'CRITICAL',
          title: `${product.name} — Out of Stock`,
          message: `No stock available for SKU ${sku}. Immediate restock is recommended to prevent missed sales.`,
          sku,
          suggestedAction: 'Restock Now',
        });
      }
      // Resolve Low Stock
      await prisma.notification.deleteMany({
        where: { sku, type: 'LOW_STOCK' }
      });
    } else if (config.enableLowStockAlerts && currentStock > 0 && currentStock <= reorderLevel) {
      // Low Stock Alert
      const existing = await prisma.notification.findFirst({
        where: { sku, type: 'LOW_STOCK' }
      });
      if (!existing) {
        await this.createNotification({
          type: 'LOW_STOCK',
          severity: 'WARNING',
          title: `${product.name} — Low Stock Alert`,
          message: `Inventory is at ${currentStock} ${currentStock === 1 ? 'unit' : 'units'}. This is below the reorder threshold of ${reorderLevel} ${reorderLevel === 1 ? 'unit' : 'units'}.`,
          sku,
          suggestedAction: 'Restock Now',
        });
      }
      // Resolve Out of Stock
      await prisma.notification.deleteMany({
        where: { sku, type: 'OUT_OF_STOCK' }
      });
    } else {
      // Healthy stock - Resolve both
      await prisma.notification.deleteMany({
        where: {
          sku,
          type: { in: ['LOW_STOCK', 'OUT_OF_STOCK'] }
        }
      });
    }

    // Explicitly delete disabled alert types if they were generated previously
    if (!config.enableOutOfStockAlerts) {
      await prisma.notification.deleteMany({
        where: { sku, type: 'OUT_OF_STOCK' }
      });
    }
    if (!config.enableLowStockAlerts) {
      await prisma.notification.deleteMany({
        where: { sku, type: 'LOW_STOCK' }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Overstock Alert
    // ─────────────────────────────────────────────────────────────────────────
    if (config.enableOverstockAlerts) {
      const overstockLimit = Math.round((config.maxStockPercent / 100) * targetCapacity);
      if (currentStock > overstockLimit) {
        const existing = await prisma.notification.findFirst({
          where: { sku, type: 'OVERSTOCK' }
        });
        if (!existing) {
          const pct = Math.round((currentStock / targetCapacity) * 100);
          await this.createNotification({
            type: 'OVERSTOCK',
            severity: 'WARNING',
            title: `${product.name} — Overstock Alert`,
            message: `Stock is at ${currentStock} ${currentStock === 1 ? 'unit' : 'units'} (${pct}% of ${targetCapacity} capacity), exceeding the limit of ${overstockLimit} ${overstockLimit === 1 ? 'unit' : 'units'}.`,
            sku,
            suggestedAction: 'Remove Shelf',
          });
        }
      } else {
        // Resolve Overstock
        await prisma.notification.deleteMany({
          where: { sku, type: 'OVERSTOCK' }
        });
      }
    } else {
      // Disabled - Resolve Overstock
      await prisma.notification.deleteMany({
        where: { sku, type: 'OVERSTOCK' }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Expiry Alerts (EXPIRING_SOON & EXPIRED)
    // ─────────────────────────────────────────────────────────────────────────
    if (config.enableExpiringSoonAlerts && product.expiryDate && currentStock > 0) {
      const expiryDate = new Date(product.expiryDate);
      // Clear time components for day calculation
      const todayZero = new Date(now);
      todayZero.setHours(0, 0, 0, 0);
      const expiryZero = new Date(expiryDate);
      expiryZero.setHours(0, 0, 0, 0);

      const days = Math.floor((expiryZero.getTime() - todayZero.getTime()) / (1000 * 60 * 60 * 24));

      if (days < 0) {
        // Expired Alert
        const existing = await prisma.notification.findFirst({
          where: { sku, type: 'EXPIRED' }
        });
        if (!existing) {
          await this.createNotification({
            type: 'EXPIRED',
            severity: 'CRITICAL',
            title: `${product.name} — Product Expired`,
            message: `Expired on ${expiryDate.toLocaleDateString('en-GB')}. ${currentStock} ${currentStock === 1 ? 'unit' : 'units'} remain on shelf.`,
            sku,
            suggestedAction: 'Remove Shelf',
          });
        }
        // Resolve Expiring Soon
        await prisma.notification.deleteMany({
          where: { sku, type: 'EXPIRING_SOON' }
        });
      } else if (days <= 90) {
        // Expiring Soon Alert
        const targetSeverity = days <= 7 ? 'CRITICAL' : 'WARNING';
        const existing = await prisma.notification.findFirst({
          where: { sku, type: 'EXPIRING_SOON' }
        });
        const msg = `${currentStock} ${currentStock === 1 ? 'unit' : 'units'} expiring on ${expiryDate.toLocaleDateString('en-GB')} (${days} days remaining).`;

        if (!existing) {
          await this.createNotification({
            type: 'EXPIRING_SOON',
            severity: targetSeverity,
            title: `${product.name} — Expiring Soon`,
            message: msg,
            sku,
            suggestedAction: 'Remove Shelf',
          });
        } else if (existing.severity !== targetSeverity || existing.message !== msg) {
          await prisma.notification.update({
            where: { id: existing.id },
            data: { severity: targetSeverity, message: msg }
          });
        }
        // Resolve Expired
        await prisma.notification.deleteMany({
          where: { sku, type: 'EXPIRED' }
        });
      } else {
        // Safe (expires > 90 days) - Resolve both
        await prisma.notification.deleteMany({
          where: {
            sku,
            type: { in: ['EXPIRING_SOON', 'EXPIRED'] }
          }
        });
      }
    } else {
      // Resolve both if no expiry date / stock is 0 / rules disabled
      await prisma.notification.deleteMany({
        where: {
          sku,
          type: { in: ['EXPIRING_SOON', 'EXPIRED'] }
        }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Dead Stock Alert (STOCK_VELOCITY)
    // ─────────────────────────────────────────────────────────────────────────
    if (config.enableDeadStockAlerts) {
      // Check products created at least 30 days ago
      const productAgeDays = Math.floor((now.getTime() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      if (productAgeDays >= 30) {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const saleCount = await prisma.billItem.count({
          where: {
            sku,
            bill: {
              createdAt: { gte: thirtyDaysAgo }
            }
          }
        });

        if (saleCount === 0 && currentStock > 0) {
          const existing = await prisma.notification.findFirst({
            where: { sku, type: 'STOCK_VELOCITY' }
          });
          if (!existing) {
            await this.createNotification({
              type: 'STOCK_VELOCITY',
              severity: 'WARNING',
              title: `${product.name} — Dead Stock Warning`,
              message: `No sales recorded for this product in the last 30 days. Consider creating a bundle discount or clearance markdown.`,
              sku,
              suggestedAction: 'Create Promotion',
            });
          }
        } else {
          // Has sales or stock is 0 - Resolve Dead Stock
          await prisma.notification.deleteMany({
            where: { sku, type: 'STOCK_VELOCITY' }
          });
        }
      } else {
        // New product - Resolve Dead Stock
        await prisma.notification.deleteMany({
          where: { sku, type: 'STOCK_VELOCITY' }
        });
      }
    } else {
      // Disabled - Resolve Dead Stock
      await prisma.notification.deleteMany({
        where: { sku, type: 'STOCK_VELOCITY' }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Reorder Recommendation Alert (DEMAND_FORECAST)
    // ─────────────────────────────────────────────────────────────────────────
    if (config.enableLowStockAlerts && currentStock <= reorderLevel) {
      const suggestedQty = targetCapacity > currentStock ? targetCapacity - currentStock : 50;
      const existing = await prisma.notification.findFirst({
        where: { sku, type: 'DEMAND_FORECAST' }
      });
      if (!existing) {
        await this.createNotification({
          type: 'DEMAND_FORECAST',
          severity: 'INFO',
          title: `${product.name} — Reorder Recommendation`,
          message: `Demand forecast suggests restocking ${suggestedQty} ${suggestedQty === 1 ? 'unit' : 'units'}. AI predicts high sales velocity for this item.`,
          sku,
          suggestedAction: 'Review Stock Levels',
        });
      }
    } else {
      // Resolve Reorder Recommendation
      await prisma.notification.deleteMany({
        where: { sku, type: 'DEMAND_FORECAST' }
      });
    }
  }

  /**
   * Fetch active notifications for a specific user based on their ID and Role
   */
  static async getNotificationsForUser(userId: string, role: Role, includeDismissed: boolean = false) {
    try {
      const userStateFilter = includeDismissed
        ? {
            // Exclude ONLY read notifications (include dismissed)
            isRead: true
          }
        : {
            // Exclude read OR dismissed
            OR: [
              { isRead: true },
              { isDismissed: true }
            ]
          };

      const notifications = await prisma.notification.findMany({
        where: {
          OR: [
            { targetRole: role },
            { targetRole: null }
          ],
          userStates: {
            none: {
              userId,
              ...userStateFilter
            }
          }
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          product: {
            select: {
              sku: true,
              name: true,
              imageUrl: true,
              currentStock: true,
              reorderLevel: true,
              sellingPrice: true,
            }
          },
          userStates: {
            where: {
              userId
            }
          }
        }
      });
      return notifications;
    } catch (error) {
      console.error('Error fetching user notifications:', error);
      throw error;
    }
  }

  /**
   * Mark a notification as read for a specific user
   */
  static async markAsRead(notificationId: string, userId: string) {
    try {
      // Guard: check the notification still exists (may have been auto-cleaned by alert scanner)
      const exists = await prisma.notification.findUnique({ where: { id: notificationId } });
      if (!exists) {
        console.warn(`markAsRead skipped — notification ${notificationId} no longer exists.`);
        return null;
      }

      const state = await prisma.userNotificationState.upsert({
        where: {
          userId_notificationId: {
            userId,
            notificationId,
          },
        },
        update: {
          isRead: true,
          readAt: new Date(),
        },
        create: {
          userId,
          notificationId,
          isRead: true,
          readAt: new Date(),
        },
      });
      return state;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Dismiss a notification for a specific user
   */
  static async dismissNotification(notificationId: string, userId: string) {
    try {
      // Guard: check the notification still exists (may have been auto-cleaned by alert scanner)
      const exists = await prisma.notification.findUnique({ where: { id: notificationId } });
      if (!exists) {
        console.warn(`dismissNotification skipped — notification ${notificationId} no longer exists.`);
        return null;
      }

      const state = await prisma.userNotificationState.upsert({
        where: {
          userId_notificationId: {
            userId,
            notificationId,
          },
        },
        update: {
          isDismissed: true,
          dismissedAt: new Date(),
        },
        create: {
          userId,
          notificationId,
          isDismissed: true,
          dismissedAt: new Date(),
        },
      });
      return state;
    } catch (error) {
      console.error('Error dismissing notification:', error);
      throw error;
    }
  }
}
