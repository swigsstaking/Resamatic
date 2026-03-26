import cron from 'node-cron';
import cluster from 'cluster';
import { generateAndSendReport } from '../services/billing.service.js';

export function startBillingCron() {
  // In PM2 cluster mode, only run cron on the primary worker (id 0)
  const workerId = process.env.NODE_APP_INSTANCE || process.env.pm_id || '0';
  if (workerId !== '0') return;

  // Run on the 1st of each month at 08:00 UTC
  cron.schedule('0 8 1 * *', async () => {
    console.log('[cron] Running monthly billing report...');
    try {
      // Report for the previous month
      const now = new Date();
      const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const stats = await generateAndSendReport(prevMonth, prevYear);
      console.log(`[cron] Billing report sent: ${stats.standardCount} standard, ${stats.posthogCount} posthog`);
    } catch (err) {
      console.error('[cron] Failed to send billing report:', err.message);
    }
  });

  console.log('[cron] Billing report scheduled: 1st of each month at 08:00 UTC (worker 0 only)');
}
