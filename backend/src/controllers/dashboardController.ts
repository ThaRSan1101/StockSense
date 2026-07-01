import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { prisma } from '../config/prisma.js';

export const getAdminDashboardMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Gross Sales Today
    const todayBills = await prisma.bill.findMany({
      where: {
        createdAt: {
          gte: today,
          lte: endOfDay,
        },
        draft: false
      },
      include: {
        cashier: {
          select: { name: true }
        }
      }
    });

    const grossSalesToday = todayBills.reduce((sum, bill) => sum + bill.totalBill, 0);

    // Get yesterday's sales to calculate percentage change
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const yesterdayBills = await prisma.bill.findMany({
      where: {
        createdAt: {
          gte: yesterday,
          lte: yesterdayEnd,
        },
        draft: false
      },
    });

    const grossSalesYesterday = yesterdayBills.reduce((sum, bill) => sum + bill.totalBill, 0);
    
    let salesPercentageChange = 0;
    if (grossSalesYesterday > 0) {
      salesPercentageChange = ((grossSalesToday - grossSalesYesterday) / grossSalesYesterday) * 100;
    }

    // 2. POS Registers (Active Cashiers)
    const activeRegisters = await prisma.user.count({
      where: {
        role: 'CASHIER',
        isActive: true,
      }
    });

    // 3. Active Stock Alerts
    const products = await prisma.product.findMany({
      select: { currentStock: true, reorderLevel: true, status: true }
    });
    
    const activeStockAlerts = products.filter(p => p.status === 'ACTIVE' && p.currentStock <= p.reorderLevel).length;

    // 4. Supermarket Health (Percentage of products in stock vs total)
    const activeProducts = products.filter(p => p.status === 'ACTIVE');
    const inStockProducts = activeProducts.filter(p => p.currentStock > 0).length;
    const supermarketHealth = activeProducts.length > 0 ? (inStockProducts / activeProducts.length) * 100 : 100;

    // 5. Sales Curve (Hourly for today)
    const salesHourly = Array(24).fill(0);
    todayBills.forEach(bill => {
      const hour = new Date(bill.createdAt).getHours();
      salesHourly[hour] += bill.totalBill;
    });

    // 6. Top Selling Products (Today)
    const todayBillItems = await prisma.billItem.findMany({
      where: {
        bill: {
          createdAt: {
            gte: today,
            lte: endOfDay,
          },
          draft: false
        }
      },
      include: {
        product: true
      }
    });

    const productSalesMap: Record<string, { name: string, total: number, qty: number }> = {};
    todayBillItems.forEach(item => {
      const sku = item.sku;
      if (!productSalesMap[sku]) {
        productSalesMap[sku] = {
          name: item.product?.name || sku,
          total: 0,
          qty: 0,
        };
      }
      productSalesMap[sku].total += item.total;
      productSalesMap[sku].qty += item.qty;
    });

    const topSellingProducts = Object.values(productSalesMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);

    // 7. Register Terminal Activity (Group by cashier today)
    const cashierActivityMap: Record<string, { user: string, sales: number, items: number }> = {};
    todayBills.forEach(bill => {
      const cashierId = bill.cashierId;
      if (!cashierActivityMap[cashierId]) {
        cashierActivityMap[cashierId] = {
          user: bill.cashier?.name || 'Unknown',
          sales: 0,
          items: 0,
        };
      }
      cashierActivityMap[cashierId].sales += bill.totalBill;
      cashierActivityMap[cashierId].items += bill.totalQty;
    });

    const registerActivity = Object.keys(cashierActivityMap).map((id, index) => ({
      num: String(index + 1).padStart(2, '0'),
      user: cashierActivityMap[id].user,
      sales: cashierActivityMap[id].sales,
      items: cashierActivityMap[id].items,
      status: 'Active'
    }));

    // 8. Recent Activity (Mix of recent bills and stock adjustments)
    const recentBills = await prisma.bill.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      include: { cashier: { select: { name: true } } }
    });

    const recentAdjustments = await prisma.stockAdjustment.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      include: { adjustedBy: { select: { name: true } }, product: { select: { name: true } } }
    });

    const recentActivity = [
      ...recentBills.map(b => ({
        type: 'SALE',
        label: 'Sale Completed',
        desc: `Bill ${b.billNumber} total Rs. ${b.totalBill.toFixed(2)}`,
        user: b.cashier?.name || 'Unknown',
        time: b.createdAt.toISOString(),
      })),
      ...recentAdjustments.map(a => ({
        type: 'ADJUSTMENT',
        label: 'Stock Adjustment',
        desc: `Adjusted ${a.product?.name || a.sku} by ${a.qtyChanged} (${a.reason})`,
        user: a.adjustedBy?.name || 'System',
        time: a.createdAt.toISOString(),
      }))
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);

    res.status(200).json({
      success: true,
      data: {
        grossSalesToday,
        salesPercentageChange,
        activeRegisters,
        activeStockAlerts,
        supermarketHealth,
        salesHourly,
        topSellingProducts,
        registerActivity,
        recentActivity,
      }
    });

  } catch (err) {
    console.error('[getAdminDashboardMetrics error]', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
