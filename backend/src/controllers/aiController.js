import Site from '../models/Site.js';
import Page from '../models/Page.js';
import * as aiService from '../services/ai.service.js';

export const generatePage = async (req, res, next) => {
  try {
    const { siteId, keyword, serviceFocus, tone } = req.body;
    if (!siteId || !keyword) {
      return res.status(400).json({ error: 'siteId and keyword required' });
    }

    const site = await Site.findById(siteId).lean();
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const content = await aiService.generatePageContent(site, { keyword, serviceFocus, tone });
    res.json({ content });
  } catch (err) { next(err); }
};

export const generateContact = async (req, res, next) => {
  try {
    const { siteId } = req.body;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });

    const site = await Site.findById(siteId).lean();
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const content = await aiService.generateContactContent(site);
    res.json({ content });
  } catch (err) { next(err); }
};

export const generateSeo = async (req, res, next) => {
  try {
    const { siteId, pageContent } = req.body;
    const site = await Site.findById(siteId).lean();
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const seo = await aiService.generateSeoMetadata(site, pageContent);
    res.json({ seo });
  } catch (err) { next(err); }
};

export const optimizeSeo = async (req, res, next) => {
  try {
    const { siteId } = req.body;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });

    const site = await Site.findById(siteId).lean();
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const pages = await Page.find({ siteId }).lean();
    const pagesData = pages.map(p => ({
      _id: p._id,
      title: p.title,
      keyword: p.title,
      serviceFocus: p.title,
      seo: p.seo || {},
    }));

    const optimized = await aiService.optimizeSeoAcrossPages(site, pagesData);

    // Apply optimized SEO to each page
    const results = [];
    for (const opt of optimized) {
      const page = pages[opt.index];
      if (page && opt.seo) {
        await Page.findByIdAndUpdate(page._id, { seo: opt.seo });
        results.push({ pageId: page._id, title: page.title, seo: opt.seo });
      }
    }

    res.json({ pages: results });
  } catch (err) { next(err); }
};

export const generateCityPage = async (req, res, next) => {
  try {
    const { siteId, keyword, cityTarget } = req.body;
    if (!siteId || !keyword || !cityTarget) {
      return res.status(400).json({ error: 'siteId, keyword, and cityTarget are required' });
    }
    const site = await Site.findById(siteId).lean();
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const content = await aiService.generateCityPageContent(site, { keyword, cityTarget });
    res.json({ content });
  } catch (err) { next(err); }
};

export const rewrite = async (req, res, next) => {
  try {
    const { text, instruction } = req.body;
    if (!text || !instruction) {
      return res.status(400).json({ error: 'text and instruction required' });
    }

    const result = await aiService.rewriteText(text, instruction);
    res.json({ text: result });
  } catch (err) { next(err); }
};

export const generateAlt = async (req, res, next) => {
  try {
    const { description } = req.body;
    if (!description) return res.status(400).json({ error: 'description required' });

    const alt = await aiService.generateAltText(description);
    res.json({ alt });
  } catch (err) { next(err); }
};
