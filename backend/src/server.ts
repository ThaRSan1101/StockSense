import app from './app.js';
import { startForecastScheduler } from './services/forecastScheduler.js';
import { getJwtAccessSecret, getJwtRefreshSecret } from './utils/jwt.js';

// Validate mandatory JWT security configuration on startup
try {
  getJwtAccessSecret();
  getJwtRefreshSecret();
} catch (err: any) {
  console.error('[FATAL CONFIG ERROR]', err.message);
  process.exit(1);
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // Start the background forecast scheduler
  startForecastScheduler();
});
