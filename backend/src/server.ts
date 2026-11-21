import app from './app.js';
import { prisma, pool } from './config/prisma.js';
import { startForecastScheduler, stopForecastScheduler } from './services/forecastScheduler.js';
import { getJwtAccessSecret, getJwtRefreshSecret } from './utils/jwt.js';

// Validate mandatory JWT security configuration on startup
try {
  getJwtAccessSecret();
  getJwtRefreshSecret();
} catch (err: any) {
  console.error('[FATAL CONFIG ERROR]', err.message);
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 5000;
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
  // Start the background forecast scheduler
  startForecastScheduler();
});

// ── Graceful Shutdown ──────────────────────────────────
let isShuttingDown = false;

async function handleShutdown(signal: string) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  console.log(`\n[${signal}] Initiating graceful shutdown...`);

  // 1. Stop background scheduler timers
  try {
    stopForecastScheduler();
  } catch (err) {
    console.error('Error stopping forecast scheduler:', err);
  }

  // 2. Stop accepting new HTTP requests and close active connections
  server.close(async (err) => {
    if (err) {
      console.error('Error closing HTTP server:', err);
    } else {
      console.log('HTTP server closed.');
    }

    // 3. Disconnect Prisma client and PostgreSQL pool
    try {
      await prisma.$disconnect();
      await pool.end();
      console.log('Database connections closed cleanly.');
    } catch (dbErr) {
      console.error('Error closing database connections:', dbErr);
    }

    console.log('StockSense backend shutdown complete.');
    process.exit(0);
  });

  // Force shutdown after 10s if connections refuse to close
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
