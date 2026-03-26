import Site from '../models/Site.js';
import Page from '../models/Page.js';
import Media from '../models/Media.js';
import slugify from 'slugify';
import { getGoogleReviews } from '../services/google-reviews.service.js';
import { cleanupSiteFiles } from '../services/deploy.service.js';
import { markSiteDeleted } from '../services/billing.service.js';

export const list = async (req, res, next) => {
  try {
    const query = req.user.role === 'client'
      ? { _id: { $in: req.user.assignedSites } }
      : {};
    const sites = await Site.find(query).sort({ updatedAt: -1 });
    res.json({ sites });
  } catch (err) { next(err); }
};

export const getOne = async (req, res, next) => {
  try {
    const site = await Site.findById(req.params.id)
      .populate('design.logoMediaId')
      .populate('design.faviconMediaId');
    if (!site) return res.status(404).json({ error: 'Site not found' });
    res.json({ site });
  } catch (err) { next(err); }
};

export const create = async (req, res, next) => {
  try {
    const data = req.body;
    if (!data.slug && data.name) {
      let baseSlug = slugify(data.name, { lower: true, strict: true });
      let slug = baseSlug;
      let suffix = 2;
      while (await Site.exists({ slug })) {
        slug = `${baseSlug}-${suffix}`;
        suffix++;
      }
      data.slug = slug;
    }
    const site = await Site.create(data);
    res.status(201).json({ site });
  } catch (err) { next(err); }
};

export const update = async (req, res, next) => {
  try {
    const site = await Site.findById(req.params.id);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    // Deep merge to support nested objects like header, design, etc.
    for (const [key, value] of Object.entries(req.body)) {
      if (value && typeof value === 'object' && !Array.isArray(value) && site[key] && typeof site[key] === 'object') {
        Object.assign(site[key], value);
        site.markModified(key);
      } else {
        site[key] = value;
      }
    }
    await site.save();
    res.json({ site });
  } catch (err) { next(err); }
};

export const remove = async (req, res, next) => {
  try {
    const site = await Site.findByIdAndDelete(req.params.id);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    // Cascade delete pages and media
    await Page.deleteMany({ siteId: site._id });
    await Media.deleteMany({ siteId: site._id });
    // Mark deployment as deleted for billing
    await markSiteDeleted(site._id);
    // Cleanup server files, nginx config, local build
    const cleaned = await cleanupSiteFiles(site);
    res.json({ message: 'Site deleted', cleaned });
  } catch (err) { next(err); }
};

export const fetchGoogleReviews = async (req, res, next) => {
  try {
    const site = await Site.findById(req.params.id);
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const result = await getGoogleReviews(site);

    // Cache placeId and update business metadata
    site.business.googlePlaceId = result.placeId;
    if (result.rating) site.business.googleReviewRating = result.rating;
    if (result.totalReviews) site.business.googleReviewCount = result.totalReviews;
    if (result.googleMapsUri) site.business.googleReviewUrl = result.googleMapsUri;
    site.markModified('business');
    await site.save();

    res.json({
      reviews: result.reviews,
      rating: result.rating,
      totalReviews: result.totalReviews,
      googleMapsUri: result.googleMapsUri,
    });
  } catch (err) {
    console.error('[GoogleReviews] Fetch failed:', err.message);
    res.status(400).json({ error: err.message });
  }
};

export const duplicate = async (req, res, next) => {
  try {
    const source = await Site.findById(req.params.id).lean();
    if (!source) return res.status(404).json({ error: 'Site not found' });

    delete source._id;
    delete source.createdAt;
    delete source.updatedAt;
    source.name = `${source.name} (copy)`;
    source.slug = `${source.slug}-copy-${Date.now()}`;
    source.domain = null;
    source.status = 'draft';
    source.lastBuiltAt = null;
    source.lastPublishedAt = null;

    const newSite = await Site.create(source);

    // Duplicate pages
    const pages = await Page.find({ siteId: req.params.id }).lean();
    for (const page of pages) {
      delete page._id;
      delete page.createdAt;
      delete page.updatedAt;
      page.siteId = newSite._id;
      await Page.create(page);
    }

    res.status(201).json({ site: newSite });
  } catch (err) { next(err); }
};
