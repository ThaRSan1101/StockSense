import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { prisma } from '../config/prisma.js';

const getAiDemandServiceUrl = (): string => {
  const base = (process.env.AI_DEMAND_SERVICE_URL || process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000')
    .replace(':8080', ':8000')
    .replace(/\/+$/, '');
  return base.includes('/api/ai-demand') ? base : `${base}/api/ai-demand`;
};

export async function generateForecast(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { targetMonth, regenerate, force } = req.body;
    if (!targetMonth) {
      res.status(400).json({ success: false, message: 'targetMonth is required.' });
      return;
    }

    const isForce = !!(force || regenerate);

    // Call Python FastAPI service to trigger forecast generation
    // We send force as true if regenerate is requested
    const response = await fetch(`${getAiDemandServiceUrl()}/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetMonth, force: isForce, regenerate: isForce }),
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ success: false, message: data.detail || 'Failed to generate forecast.' });
      return;
    }

    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('Error generating forecast:', error);
    res.status(500).json({ success: false, message: 'AI service is currently unavailable.' });
  }
}

export async function getLatestForecastRun(req: AuthRequest, res: Response): Promise<void> {
  try {
    const run = await prisma.demandForecastRun.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: [
        { targetMonth: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    if (!run) {
      res.status(200).json({ success: true, data: null });
      return;
    }

    res.status(200).json({ success: true, data: run });
  } catch (error: any) {
    console.error('Error fetching latest run:', error);
    res.status(500).json({ success: false, message: 'Database error fetching latest run.' });
  }
}

export async function getForecastRunByMonth(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { month } = req.params; // YYYY-MM
    if (!month) {
      res.status(400).json({ success: false, message: 'Month is required.' });
      return;
    }

    const parsedDate = new Date(`${month}-01T00:00:00.000Z`);

    const run = await prisma.demandForecastRun.findFirst({
      where: { 
        targetMonth: parsedDate, 
        status: 'COMPLETED' 
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ success: true, data: run });
  } catch (error: any) {
    console.error('Error fetching run by month:', error);
    res.status(500).json({ success: false, message: 'Database error fetching run by month.' });
  }
}

export async function getForecastRunDetails(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { runId } = req.params;
    const { search, status, category, sortBy, sortOrder, page = '1', limit = '10' } = req.query;

    const run = await prisma.demandForecastRun.findUnique({
      where: { id: runId as string }
    });

    if (!run) {
      res.status(404).json({ success: false, message: 'Forecast run not found.' });
      return;
    }

    const parsedPage = parseInt(page as string) || 1;
    const parsedLimit = parseInt(limit as string) || 10;
    const skip = (parsedPage - 1) * parsedLimit;

    // Build conditions
    const whereConditions: any = {
      forecastRunId: runId
    };

    if (typeof status === 'string' && status) {
      whereConditions.status = status;
    }

    const productFilter: any = {};
    if (typeof search === 'string' && search) {
      productFilter.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (typeof category === 'string' && category) {
      productFilter.masterClass = {
        category: {
          name: { equals: category, mode: 'insensitive' }
        }
      };
    }

    if (Object.keys(productFilter).length > 0) {
      whereConditions.product = productFilter;
    }

    // Order mapping
    const sortMap: Record<string, string> = {
      predictedDemand: 'predictedDemand',
      recommendedQuantity: 'recommendedOrderQuantity',
      stockCoverage: 'stockCoverageDays',
      currentStock: 'currentStock',
      accuracyScore: 'accuracyScore'
    };

    const orderByCol = sortMap[sortBy as string] || 'predictedDemand';
    const orderByOrder = (sortOrder as string)?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    // Query databases directly via Prisma client
    const totalCount = await prisma.demandForecast.count({
      where: whereConditions
    });

    const forecasts = await prisma.demandForecast.findMany({
      where: whereConditions,
      include: {
        product: {
          include: {
            masterClass: {
              include: {
                category: true
              }
            }
          }
        }
      },
      orderBy: {
        [orderByCol]: orderByOrder
      },
      skip,
      take: parsedLimit
    });

    const formattedForecasts = forecasts.map((f: any) => {
      const prod = f.product;
      return {
        sku: f.productId,
        barcode: prod?.barcode || '',
        name: prod?.name || '',
        categoryName: prod?.masterClass?.category?.name || '',
        currentStockSnapshot: f.currentStock,
        stockCoverageDays: f.stockCoverageDays,
        predictedDemand: f.predictedDemand,
        recommendedQuantity: f.recommendedOrderQuantity,
        selectedModel: f.selectedModel,
        accuracyScore: f.accuracyScore,
        predictionReason: f.predictionReason,
        status: f.status
      };
    });

    // Status counts for the ENTIRE run (not paginated)
    const statusCountsRaw = (await prisma.demandForecast.groupBy({
      by: ['status'],
      where: { forecastRunId: runId as string },
      _count: { _all: true }
    } as any)) as any[];

    const statusCounts: Record<string, number> = {};
    statusCountsRaw.forEach(group => {
      if (group._count) {
        statusCounts[group.status] = group._count._all || group._count;
      }
    });

    // Count of distinct products with recommended order quantity > 0 across the ENTIRE run
    const reorderProductsCount = await prisma.demandForecast.count({
      where: {
        forecastRunId: runId as string,
        recommendedOrderQuantity: { gt: 0 }
      }
    });

    res.status(200).json({
      success: true,
      data: {
        run,
        forecasts: formattedForecasts,
        totalCount,
        page: parsedPage,
        limit: parsedLimit,
        statusCounts,
        reorderProductsCount
      }
    });
  } catch (error: any) {
    console.error('Error fetching run details:', error);
    res.status(500).json({ success: false, message: 'Database error fetching forecast details.' });
  }
}

export async function getProductForecastDetail(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { runId, sku } = req.params;

    const forecast = await prisma.demandForecast.findFirst({
      where: {
        forecastRunId: runId as string,
        productId: sku as string
      } as any,
      include: {
        product: {
          include: {
            masterClass: {
              include: {
                category: true
              }
            }
          }
        }
      }
    }) as any;

    if (!forecast) {
      res.status(404).json({ success: false, message: 'Product forecast details not found.' });
      return;
    }

    const analysis = await prisma.demandAnalysis.findFirst({
      where: {
        forecastRunId: runId as string,
        productId: sku as string
      } as any
    }) as any;

    if (!analysis) {
      res.status(404).json({ success: false, message: 'Product analysis metrics not found.' });
      return;
    }

    const prod = (forecast as any).product;
    const paramsObj = typeof forecast.modelParameters === 'string'
      ? JSON.parse(forecast.modelParameters || '{}')
      : (forecast.modelParameters || {});

    const monthlyBias = paramsObj.monthlyBias !== undefined ? paramsObj.monthlyBias : null;
    const avgForecastDaily = paramsObj.averageForecastDailyDemand !== undefined
      ? paramsObj.averageForecastDailyDemand
      : (forecast.predictedDemand ? forecast.predictedDemand / 30.0 : 0.0);

    // Map to expected structure
    const data = {
      sku: forecast.productId,
      name: prod?.name || '',
      categoryName: prod?.masterClass?.category?.name || '',
      currentStock: forecast.currentStock,
      predictedDemand: forecast.predictedDemand,
      safetyStock: forecast.safetyStock,
      requiredStock: forecast.requiredStock,
      recommendedQuantity: forecast.recommendedOrderQuantity,
      stockCoverageDays: forecast.stockCoverageDays,
      averageForecastDailyDemand: avgForecastDaily,
      status: forecast.status,
      selectedModel: forecast.selectedModel,
      accuracyScore: forecast.accuracyScore,
      predictionReason: forecast.predictionReason,
      targetMonth: forecast.targetMonth,
      createdAt: forecast.createdAt,
      
      // Backtests & Validation
      mae: forecast.MAE,
      rmse: forecast.RMSE,
      wape: forecast.WAPE,
      monthlyBias: monthlyBias,
      reliabilityLevel: forecast.reliabilityLevel,
      stockVsRequiredPercentage: forecast.requiredStock > 0 ? (forecast.currentStock / forecast.requiredStock) * 100.0 : 100.0,

      // Analysis
      recent30DaySales: analysis.recent30Sales,
      previous30DaySales: analysis.previous30Sales,
      recentGrowthPercent: analysis.recentGrowthPercentage !== null ? analysis.recentGrowthPercentage / 100.0 : null,
      threeMonthAverage: analysis.threeMonthAverage,
      sixMonthAverage: analysis.sixMonthAverage,
      sameMonthHistoricalAverage: analysis.sameMonthHistoricalAverage,
      averageDailySales: analysis.recent30Sales / 30.0,
      discountUpliftPercent: analysis.discountUpliftPercentage !== null ? analysis.discountUpliftPercentage / 100.0 : null,
      refundQuantity: analysis.refundQuantity,
      stockOutEstimate: analysis.stockOutDays,
      demandTrend: analysis.primaryBehaviour,
      primaryBehaviour: analysis.primaryBehaviour,
      additionalBehaviourTags: (analysis.additionalBehaviourTags as any) || [],
      dataQuality: analysis.dataQuality
    };

    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching product details:', error);
    res.status(500).json({ success: false, message: 'Database error fetching product details.' });
  }
}

export async function getForecastHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const runs = await prisma.demandForecastRun.findMany({
      orderBy: { targetMonth: 'desc' }
    });
    res.status(200).json({ success: true, data: runs });
  } catch (error: any) {
    console.error('Error fetching history:', error);
    res.status(500).json({ success: false, message: 'Database error fetching forecast history.' });
  }
}
