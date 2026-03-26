import { buildSite } from '../services/ssg.service.js';
import { deploySite, unpublishSite } from '../services/deploy.service.js';
import Site from '../models/Site.js';

export const publish = async (req, res, next) => {
  try {
    const site = await Site.findById(req.params.siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    if (!site.domain) return res.status(400).json({ error: 'Domain not configured' });

    site.status = 'building';
    site.deployStep = 'building';
    site.deployProgress = 5;
    site.buildError = null;
    await site.save();

    // Build then deploy — async
    (async () => {
      try {
        await buildSite(site._id);
        await deploySite(site._id);
      } catch (err) {
        await Site.findByIdAndUpdate(site._id, { status: 'error', buildError: err.message });
      }
    })();

    res.json({ message: 'Build and deploy started', siteId: site._id });
  } catch (err) { next(err); }
};

export const unpublish = async (req, res, next) => {
  try {
    await unpublishSite(req.params.siteId);
    res.json({ message: 'Site unpublished' });
  } catch (err) { next(err); }
};

export const getDeployStatus = async (req, res, next) => {
  try {
    const site = await Site.findById(req.params.siteId)
      .select('status lastBuiltAt lastPublishedAt buildError domain deployStep deployProgress');
    if (!site) return res.status(404).json({ error: 'Site not found' });
    res.json({
      status: site.status,
      deployStep: site.deployStep,
      deployProgress: site.deployProgress || 0,
      lastBuiltAt: site.lastBuiltAt,
      lastPublishedAt: site.lastPublishedAt,
      buildError: site.buildError,
      url: site.domain ? `https://${site.domain}` : null,
    });
  } catch (err) { next(err); }
};
