import { prisma } from '../config/prisma.js';

const getAiDemandServiceUrl = (): string => {
  const base = (process.env.AI_DEMAND_SERVICE_URL || process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000')
    .replace(':8080', ':8000')
    .replace(/\/+$/, '');
  return base.includes('/api/ai-demand') ? base : `${base}/api/ai-demand`;
};
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every 1 hour

export function startForecastScheduler() {
  console.log('[Scheduler] AI Demand Forecasting Scheduler initialized.');

  // Run initial check after 10 seconds, then check every hour
  setTimeout(checkAndTriggerForecast, 10000);
  setInterval(checkAndTriggerForecast, CHECK_INTERVAL_MS);
}

async function checkAndTriggerForecast() {
  try {
    const now = new Date();
    
    // Configurable scheduled day & hour (e.g. 1st day of the month at 01:00 AM)
    // For local testing, we can check if it's the 1st day of the month.
    const isFirstDayOfMonth = now.getDate() === 1;
    const isScheduledHour = now.getHours() === 1;

    // In a production scenario, we trigger on the 1st of month.
    // For safety, we can run the duplicate-prevention check regardless of date/time
    // to see if we should trigger a new month forecast automatically.
    if (!isFirstDayOfMonth || !isScheduledHour) {
      return;
    }

    // Target month is current month in YYYY-MM format
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const targetMonthStr = `${year}-${month}`;
    const targetMonthDate = new Date(`${targetMonthStr}-01T00:00:00.000Z`);

    console.log(`[Scheduler] Checking scheduled forecast requirements for target: ${targetMonthStr}`);

    // Check if a completed forecast already exists for this target month
    const existingRun = await prisma.demandForecastRun.findFirst({
      where: {
        targetMonth: targetMonthDate,
        status: 'COMPLETED'
      }
    });

    if (existingRun) {
      console.log(`[Scheduler] Completed forecast already exists for target: ${targetMonthStr}. Scheduled run skipped to prevent duplicates.`);
      return;
    }

    // Check if there is an active running forecast to prevent overlapping runs
    const runningRun = await prisma.demandForecastRun.findFirst({
      where: {
        targetMonth: targetMonthDate,
        status: 'RUNNING'
      }
    });

    if (runningRun) {
      console.log(`[Scheduler] Forecast is already currently generating for target: ${targetMonthStr}. Overlap execution skipped.`);
      return;
    }

    console.log(`[Scheduler] Launching automated monthly forecasting task for: ${targetMonthStr}`);

    const response = await fetch(`${getAiDemandServiceUrl()}/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        targetMonth: targetMonthStr, 
        force: false,
        regenerate: false,
        triggerType: 'SCHEDULED' 
      }),
    });

    const data = await response.json();
    if (response.ok) {
      console.log(`[Scheduler] Scheduled forecasting run successfully started. Run ID: ${data.runId}`);
    } else {
      console.error(`[Scheduler] Scheduled forecast generation returned error:`, data.detail || data.message);
    }

  } catch (error) {
    console.error('[Scheduler] Error occurred in forecasting cron job:', error);
  }
}
