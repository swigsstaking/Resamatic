import Deployment from '../models/Deployment.js';
import { sendBillingReport } from './email.service.js';

export async function recordFirstDeployment(site) {
  const type = site.posthog?.enabled ? 'posthog' : 'standard';

  try {
    await Deployment.create({
      siteId: site._id,
      siteName: site.name,
      domain: site.domain,
      type,
      firstPublishedAt: new Date(),
    });
    console.log(`[billing] Recorded first deployment: ${site.name} (${type})`);
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate — site already has a deployment record, skip
      return;
    }
    console.error('[billing] Failed to record deployment:', err.message);
  }
}

export async function markSiteDeleted(siteId) {
  try {
    await Deployment.findOneAndUpdate(
      { siteId, deletedAt: null },
      { deletedAt: new Date() }
    );
    console.log(`[billing] Marked deployment as deleted: ${siteId}`);
  } catch (err) {
    console.error('[billing] Failed to mark deletion:', err.message);
  }
}

export async function getBillingStats(month, year) {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 1);

  // Deployments this month
  const monthDeployments = await Deployment.find({
    firstPublishedAt: { $gte: startOfMonth, $lt: endOfMonth },
  }).sort({ firstPublishedAt: 1 }).lean();

  const standardCount = monthDeployments.filter(d => d.type === 'standard').length;
  const posthogCount = monthDeployments.filter(d => d.type === 'posthog').length;

  // All-time totals
  const totalStandard = await Deployment.countDocuments({ type: 'standard' });
  const totalPosthog = await Deployment.countDocuments({ type: 'posthog' });

  // Active vs deleted
  const activeCount = await Deployment.countDocuments({ deletedAt: null });
  const deletedCount = await Deployment.countDocuments({ deletedAt: { $ne: null } });

  return {
    month, year,
    standardCount, posthogCount,
    deployments: monthDeployments,
    totalStandard, totalPosthog,
    activeCount, deletedCount,
  };
}

export async function generateAndSendReport(month, year) {
  const stats = await getBillingStats(month, year);
  await sendBillingReport(stats);
  return stats;
}
