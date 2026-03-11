import Site from '../models/Site.js';
import Page from '../models/Page.js';
import Media from '../models/Media.js';
import slugify from 'slugify';

export const list = async (req, res, next) => {
  try {
    const sites = await Site.find().sort({ updatedAt: -1 });
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
      data.slug = slugify(data.name, { lower: true, strict: true });
    }
    const site = await Site.create(data);
    res.status(201).json({ site });
  } catch (err) { next(err); }
};

export const update = async (req, res, next) => {
  try {
    const site = await Site.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    });
    if (!site) return res.status(404).json({ error: 'Site not found' });
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
    res.json({ message: 'Site deleted' });
  } catch (err) { next(err); }
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
