import Page from '../models/Page.js';
import Site from '../models/Site.js';
import slugify from 'slugify';

const DEFAULT_SECTIONS = [
  { type: 'hero', order: 0, data: { headline: '', subheadline: '', ctaText: '', ctaUrl: 'contact.html', backgroundMediaId: null, overlayOpacity: 0.5, style: { backgroundColor: '', textColor: '' } } },
  { type: 'text-highlight', order: 1, data: { text: '', style: { backgroundColor: '', textColor: '' } } },
  { type: 'description', order: 2, data: { title: '', body: '', imageMediaId: null, imagePosition: 'right', bulletPoints: [], style: { backgroundColor: '', textColor: '' } } },
  { type: 'why-us', order: 3, data: { title: 'Pourquoi nous choisir ?', reasons: [], style: { backgroundColor: '', textColor: '' } } },
  { type: 'google-reviews', order: 4, data: { title: 'Avis Google', reviewCount: 0, rating: 5, ctaText: 'Voir nos avis', ctaUrl: '', style: { backgroundColor: '', textColor: '' } } },
  { type: 'cta-banner', order: 5, data: { text: '', ctaText: 'Contactez-nous', ctaUrl: 'contact.html', bannerStyle: 'dark', style: { backgroundColor: '', textColor: '' } } },
  { type: 'services-grid', order: 6, data: { title: 'Nos services', services: [], style: { backgroundColor: '', textColor: '' } } },
  { type: 'services-detail', order: 7, data: { title: '', services: [], style: { backgroundColor: '', textColor: '' } } },
  { type: 'guarantee', order: 8, data: { title: 'Garantie de satisfaction', text: '', percentage: 100, icon: 'shield-check', style: { backgroundColor: '', textColor: '' } } },
  { type: 'testimonials', order: 9, data: { title: 'Ce que nos clients en pensent', items: [], style: { backgroundColor: '', textColor: '' } } },
  { type: 'faq', order: 10, data: { title: 'Questions fréquentes', items: [], style: { backgroundColor: '', textColor: '' } } },
  { type: 'team', order: 11, data: { title: 'Notre équipe', members: [], style: { backgroundColor: '', textColor: '' } } },
  { type: 'map', order: 12, data: { title: 'Nous trouver', embedUrl: '', address: '', phone: '', email: '', style: { backgroundColor: '', textColor: '' } } },
];

const DEFAULT_CONTACT_SECTIONS = [
  { type: 'hero', order: 0, data: { headline: 'Contactez-nous', subheadline: '', ctaText: '', ctaUrl: '', backgroundMediaId: null, overlayOpacity: 0.5, style: { backgroundColor: '', textColor: '' } } },
  { type: 'testimonials', order: 1, data: { title: 'Ce que nos clients en pensent', items: [], style: { backgroundColor: '', textColor: '' } } },
  { type: 'map', order: 2, data: { title: 'Nous trouver', embedUrl: '', address: '', phone: '', email: '', style: { backgroundColor: '', textColor: '' } } },
];

export const listBySite = async (req, res, next) => {
  try {
    const pages = await Page.find({ siteId: req.params.siteId }).sort({ sortOrder: 1 });
    res.json({ pages });
  } catch (err) { next(err); }
};

export const getOne = async (req, res, next) => {
  try {
    const page = await Page.findById(req.params.id);
    if (!page) return res.status(404).json({ error: 'Page not found' });
    res.json({ page });
  } catch (err) { next(err); }
};

export const create = async (req, res, next) => {
  try {
    const data = req.body;
    data.siteId = req.params.siteId;
    if (!data.slug && data.title) {
      data.slug = slugify(data.title, { lower: true, strict: true });
    }
    // Auto-populate default sections based on page type
    if (!data.sections?.length) {
      if (data.type === 'contact') {
        data.sections = JSON.parse(JSON.stringify(DEFAULT_CONTACT_SECTIONS));
      } else if (data.type === 'homepage' || data.type === 'subpage') {
        data.sections = JSON.parse(JSON.stringify(DEFAULT_SECTIONS));
      }
    }
    // Pre-fill sections with business data
    const site = await Site.findById(data.siteId).lean();
    if (site && data.sections) {
      const biz = site.business || {};
      const pageTitle = data.title || '';
      const cityStr = biz.city ? ` à ${biz.city}` : '';

      for (const section of data.sections) {
        switch (section.type) {
          case 'hero':
            if (data.type === 'contact') {
              const phoneDisplay = biz.phone ? biz.phone.replace(/(\d{2})(?=\d)/g, '$1 ') : '';
              section.data.headline = `Contactez ${biz.name || 'nous'}`;
              section.data.subheadline = biz.phone
                ? `Vous pouvez nous contacter par téléphone au ${phoneDisplay} ou par email`
                : `Contactez-nous par email${biz.email ? ' à ' + biz.email : ''}`;
              section.data.ctaText = biz.phone ? `Appelez le ${phoneDisplay}` : (biz.email ? `Envoyer un email` : '');
              section.data.ctaUrl = biz.phone ? `tel:${biz.phone}` : (biz.email ? `mailto:${biz.email}` : '');
            } else {
              section.data.headline = pageTitle + cityStr;
              section.data.subheadline = biz.activity ? `Votre spécialiste ${biz.activity.toLowerCase()}${cityStr}` : '';
              section.data.ctaText = biz.phone ? `Contactez-nous au ${biz.phone.replace(/(\d{2})(?=\d)/g, '$1 ')}` : 'Contactez-nous';
              section.data.ctaUrl = 'contact.html';
            }
            break;
          case 'description':
            section.data.title = `Pourquoi choisir ${biz.name || 'notre entreprise'} ?`;
            section.data.body = `<p>Découvrez ${biz.name || 'notre entreprise'}, spécialisé dans ${biz.activity ? biz.activity.toLowerCase() : 'nos services'}${cityStr}.</p>`;
            break;
          case 'google-reviews':
            section.data.reviewCount = biz.googleReviewCount || 0;
            section.data.rating = biz.googleReviewRating || 5;
            break;
          case 'cta-banner':
            section.data.text = `Besoin d'un devis ? Contactez ${biz.name || 'notre équipe'} dès maintenant.`;
            section.data.ctaUrl = 'contact.html';
            break;
          case 'guarantee':
            section.data.text = `Chez ${biz.name || 'nous'}, votre satisfaction est notre priorité.`;
            break;
          case 'map':
            section.data.address = biz.address || '';
            section.data.phone = biz.phone || '';
            section.data.email = biz.email || '';
            break;
        }
      }
    }
    const page = await Page.create(data);
    res.status(201).json({ page });
  } catch (err) { next(err); }
};

export const update = async (req, res, next) => {
  try {
    const page = await Page.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    });
    if (!page) return res.status(404).json({ error: 'Page not found' });
    res.json({ page });
  } catch (err) { next(err); }
};

export const remove = async (req, res, next) => {
  try {
    const page = await Page.findByIdAndDelete(req.params.id);
    if (!page) return res.status(404).json({ error: 'Page not found' });
    res.json({ message: 'Page deleted' });
  } catch (err) { next(err); }
};

export const updateSection = async (req, res, next) => {
  try {
    const { id, sectionIdx } = req.params;
    const page = await Page.findById(id);
    if (!page) return res.status(404).json({ error: 'Page not found' });

    const idx = parseInt(sectionIdx);
    if (idx < 0 || idx >= page.sections.length) {
      return res.status(400).json({ error: 'Invalid section index' });
    }

    // Merge update into existing section
    const update = req.body;
    if (update.data) {
      page.sections[idx].data = { ...page.sections[idx].data, ...update.data };
    }
    if (update.visible !== undefined) page.sections[idx].visible = update.visible;
    if (update.order !== undefined) page.sections[idx].order = update.order;

    page.markModified('sections');
    await page.save();
    res.json({ page });
  } catch (err) { next(err); }
};

export const updateSections = async (req, res, next) => {
  try {
    const page = await Page.findById(req.params.id);
    if (!page) return res.status(404).json({ error: 'Page not found' });

    page.sections = req.body.sections;

    // Auto-inject service links: each service points to another keyword page
    const hasServicesGrid = page.sections.some(s => s.type === 'services-grid');
    if (hasServicesGrid) {
      const siblingPages = await Page.find({
        siteId: page.siteId,
        _id: { $ne: page._id },
        type: { $in: ['homepage', 'subpage'] },
      }).select('slug isMainHomepage').sort({ sortOrder: 1 }).lean();

      if (siblingPages.length > 0) {
        const siblingHrefs = siblingPages.map(p =>
          p.isMainHomepage ? 'index.html' : `${p.slug}.html`
        );
        for (const section of page.sections) {
          if (section.type === 'services-grid' && section.data?.services?.length) {
            section.data.services.forEach((svc, idx) => {
              svc.linkUrl = siblingHrefs[idx % siblingHrefs.length];
            });
          }
        }
      }
    }

    page.markModified('sections');
    await page.save();
    res.json({ page });
  } catch (err) { next(err); }
};
