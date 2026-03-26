import Media from '../models/Media.js';
import Site from '../models/Site.js';
import { processImage, deleteMediaFiles } from '../services/imageProcessor.js';

export const upload = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const site = await Site.findById(req.params.siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const result = await processImage(req.file.buffer, req.file.originalname, site.slug);

    const media = await Media.create({
      siteId: site._id,
      filename: result.filename,
      originalName: req.file.originalname,
      storagePath: result.storagePath,
      mimeType: result.mimeType,
      size: result.size,
      width: result.width,
      height: result.height,
      alt: req.body.alt || '',
      folder: req.body.folder || '/',
      variants: result.variants,
    });

    res.status(201).json({ media });
  } catch (err) { next(err); }
};

export const listBySite = async (req, res, next) => {
  try {
    const filter = { siteId: req.params.siteId };
    if (req.query.folder) filter.folder = req.query.folder;
    const media = await Media.find(filter).sort({ createdAt: -1 });
    res.json({ media });
  } catch (err) { next(err); }
};

export const getOne = async (req, res, next) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ error: 'Media not found' });
    if (req.user.role === 'client' && !req.user.assignedSites.some(id => id.toString() === media.siteId.toString())) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json({ media });
  } catch (err) { next(err); }
};

export const update = async (req, res, next) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ error: 'Media not found' });
    if (req.user.role === 'client' && !req.user.assignedSites.some(id => id.toString() === media.siteId.toString())) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.body.alt !== undefined) media.alt = req.body.alt;
    if (req.body.folder !== undefined) media.folder = req.body.folder;
    await media.save();
    res.json({ media });
  } catch (err) { next(err); }
};

export const remove = async (req, res, next) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ error: 'Media not found' });
    if (req.user.role === 'client' && !req.user.assignedSites.some(id => id.toString() === media.siteId.toString())) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await media.deleteOne();
    await deleteMediaFiles(media);
    res.json({ message: 'Media deleted' });
  } catch (err) { next(err); }
};
