import Handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Site from '../models/Site.js';
import Page from '../models/Page.js';
import Media from '../models/Media.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, '../../../templates');
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Cache compiled templates
let templatesCompiled = false;
let baseTemplate;
const sectionTemplates = {};

async function loadTemplates() {
  // Always reload templates to ensure latest versions across PM2 cluster workers

  const base = await fs.readFile(path.join(TEMPLATES_DIR, 'layouts/base.hbs'), 'utf-8');
  baseTemplate = Handlebars.compile(base);

  // Register partials
  const partials = ['header', 'footer', 'cookie-consent'];
  for (const name of partials) {
    const content = await fs.readFile(path.join(TEMPLATES_DIR, `partials/${name}.hbs`), 'utf-8');
    Handlebars.registerPartial(name, content);
  }

  // Register section partials
  const sectionTypes = [
    'hero', 'description', 'why-us', 'google-reviews', 'cta-banner',
    'services-grid', 'guarantee', 'testimonials',
    'faq', 'team', 'map', 'text-highlight',
    'city-about', 'city-guarantee', 'city-reviews',
  ];
  for (const type of sectionTypes) {
    try {
      const content = await fs.readFile(path.join(TEMPLATES_DIR, `sections/${type}.hbs`), 'utf-8');
      sectionTemplates[type] = Handlebars.compile(content);
      Handlebars.registerPartial(`section-${type}`, content);
    } catch {
      // Template not yet created — skip
    }
  }

  registerHelpers();
  templatesCompiled = true;
}

function registerHelpers() {
  Handlebars.registerHelper('eq', (a, b) => a === b);
  Handlebars.registerHelper('times', (n, block) => {
    let result = '';
    for (let i = 0; i < n; i++) result += block.fn(i);
    return result;
  });
  Handlebars.registerHelper('json', (obj) => JSON.stringify(obj, null, 2));
  Handlebars.registerHelper('year', () => new Date().getFullYear());
  Handlebars.registerHelper('encodeURI', (str) => encodeURIComponent(str || '').replace(/%20/g, '+'));
  Handlebars.registerHelper('isEven', (n) => n % 2 === 0);
  Handlebars.registerHelper('ifEnabled', function (val, options) {
    return val ? options.fn(this) : options.inverse(this);
  });
  Handlebars.registerHelper('firstLetter', (str) => (str && typeof str === 'string') ? str.charAt(0).toUpperCase() : '?');
}

function hexToRgb(hex) {
  const h = (hex || '').replace('#', '');
  const bigint = parseInt(h, 16);
  return `${(bigint >> 16) & 255}, ${(bigint >> 8) & 255}, ${bigint & 255}`;
}

function getContrastColor(hexBg) {
  const h = (hexBg || '').replace('#', '');
  if (h.length < 6) return '#333333';
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  // sRGB luminance (WCAG)
  const lum = 0.2126 * (r <= 0.03928 ? r / 12.92 : ((r + 0.055) / 1.055) ** 2.4)
            + 0.7152 * (g <= 0.03928 ? g / 12.92 : ((g + 0.055) / 1.055) ** 2.4)
            + 0.0722 * (b <= 0.03928 ? b / 12.92 : ((b + 0.055) / 1.055) ** 2.4);
  return lum > 0.35 ? '#333333' : '#ffffff';
}

function generateCssVars(design) {
  const primary = design.primaryColor || '#12203e';
  const isSquare = design.borderRadius === 'square';
  return `:root {
  --color-primary: ${primary};
  --color-primary-rgb: ${hexToRgb(primary)};
  --color-accent: ${design.accentColor || '#c8a97e'};
  --color-bg: ${design.backgroundColor || '#ffffff'};
  --color-text: ${design.textColor || '#333333'};
  --font-heading: '${design.fontHeading || 'Playfair Display'}', serif;
  --font-body: '${design.fontBody || 'Inter'}', sans-serif;
  --radius-sm: ${isSquare ? '2px' : '8px'};
  --radius-md: ${isSquare ? '4px' : '16px'};
  --radius-lg: ${isSquare ? '6px' : '20px'};
  --radius-pill: ${isSquare ? '4px' : '50px'};
}`;
}

function generateJsonLd(site, page) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': page.seo?.jsonLd?.type || 'LocalBusiness',
    name: site.business?.name || site.name,
    description: page.seo?.description || site.seoDefaults?.defaultDescription || '',
    url: `https://${site.domain}/${page.isMainHomepage ? '' : page.slug + '.html'}`,
  };
  if (site.business?.address) {
    ld.address = {
      '@type': 'PostalAddress',
      streetAddress: site.business.address,
      addressLocality: site.business.city,
      postalCode: site.business.zip,
      addressCountry: site.business.country,
    };
  }
  if (site.business?.phone) ld.telephone = site.business.phone;
  if (site.business?.email) ld.email = site.business.email;
  if (site.business?.googleReviewRating) {
    ld.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: site.business.googleReviewRating,
      reviewCount: site.business.googleReviewCount,
    };
  }
  // Merge custom fields
  if (page.seo?.jsonLd?.customFields) {
    Object.assign(ld, page.seo.jsonLd.customFields);
  }
  return ld;
}

function generateFaqJsonLd(faqSection) {
  if (!faqSection?.data?.items?.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqSection.data.items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

function generateRobotsTxt(domain) {
  let txt = `User-agent: *\nAllow: /\n`;
  if (domain) txt += `\nSitemap: https://${domain}/sitemap.xml\n`;
  return txt;
}

function generateSitemapXml(domain, pages) {
  const now = new Date().toISOString().split('T')[0];
  const urls = pages.map(page => {
    const loc = page.isMainHomepage ? '' : `${page.slug}.html`;
    const priority = page.isMainHomepage ? '1.0' : page.type === 'homepage' ? '0.8' : page.type === 'city' ? '0.6' : '0.5';
    return `  <url>
    <loc>https://${domain}/${loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

function generateLlmsTxt(site, pages) {
  const lines = [`# ${site.business?.name || site.name}`];
  if (site.business?.description) lines.push(`> ${site.business.description}`);
  if (site.business?.activity) lines.push(`> Activity: ${site.business.activity}`);
  if (site.business?.city) lines.push(`> Location: ${site.business.city}, ${site.business.country || 'FR'}`);
  if (site.business?.phone) lines.push(`> Phone: ${site.business.phone}`);

  lines.push('', '## Pages');
  for (const page of pages) {
    const url = page.isMainHomepage ? '/' : `/${page.slug}.html`;
    const desc = page.seo?.description || page.title;
    lines.push(`- [${page.title}](https://${site.domain}${url}): ${desc}`);
  }
  return lines.join('\n');
}

function generateLlmsFullTxt(site, pages) {
  const lines = [`# ${site.business?.name || site.name}`, ''];
  if (site.business?.description) lines.push(site.business.description, '');

  for (const page of pages) {
    lines.push(`## ${page.title}`, '');
    for (const section of page.sections.filter(s => s.visible)) {
      const d = section.data || {};
      if (d.headline) lines.push(`### ${d.headline}`);
      if (d.title) lines.push(`### ${d.title}`);
      if (d.body) lines.push(d.body.replace(/<[^>]*>/g, ''));
      if (d.text) lines.push(d.text);
      if (d.items) {
        for (const item of d.items) {
          if (item.question) lines.push(`**Q: ${item.question}**`, item.answer);
          if (item.name && item.text) lines.push(`"${item.text}" - ${item.name}`);
        }
      }
      if (d.services) {
        for (const svc of d.services) {
          lines.push(`- **${svc.name}**: ${svc.description || svc.shortDescription || ''}`);
        }
      }
      if (d.reasons) {
        for (const r of d.reasons) {
          lines.push(`- **${r.title}**: ${r.text}`);
        }
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

export async function buildSite(siteId) {
  await Site.findByIdAndUpdate(siteId, { deployStep: 'building', deployProgress: 10 });
  await loadTemplates();

  const site = await Site.findById(siteId)
    .populate('design.logoMediaId')
    .populate('design.faviconMediaId')
    .lean();
  if (!site) throw new Error('Site not found');

  // Inject default PostHog client key if enabled but no custom key
  if (site.posthog?.enabled && !site.posthog.apiKey) {
    site.posthog.apiKey = process.env.POSTHOG_CLIENT_KEY || '';
    site.posthog.apiHost = site.posthog.apiHost || process.env.POSTHOG_CLIENT_HOST || 'https://eu.i.posthog.com';
  }

  const pages = await Page.find({ siteId }).sort({ sortOrder: 1 }).lean();
  const allMedia = await Media.find({ siteId }).lean();

  // Create media lookup map
  const mediaMap = {};
  for (const m of allMedia) {
    mediaMap[m._id.toString()] = m;
  }

  const buildDir = path.join(process.env.BUILD_OUTPUT_DIR || './builds', site.slug);
  const imagesDir = path.join(buildDir, 'images');
  await fs.mkdir(imagesDir, { recursive: true });

  // Clean stale HTML files from previous builds (deleted pages)
  try {
    const existing = await fs.readdir(buildDir);
    for (const f of existing) {
      if (f.endsWith('.html')) await fs.unlink(path.join(buildDir, f));
    }
  } catch {}


  // Copy CSS
  try {
    const mainCss = await fs.readFile(path.join(TEMPLATES_DIR, 'assets/main.css'), 'utf-8');
    const cssWithVars = generateCssVars(site.design) + '\n\n' + mainCss;
    await fs.writeFile(path.join(buildDir, 'main.css'), cssWithVars);
  } catch {
    await fs.writeFile(path.join(buildDir, 'main.css'), generateCssVars(site.design));
  }

  // Copy media files to build
  for (const media of allMedia) {
    for (const variant of media.variants) {
      const src = path.join(UPLOAD_DIR, variant.storagePath);
      const dest = path.join(imagesDir, path.basename(variant.storagePath));
      try {
        await fs.copyFile(src, dest);
      } catch { /* skip missing */ }
    }
    // Copy original too
    const origSrc = path.join(UPLOAD_DIR, media.storagePath);
    const origDest = path.join(imagesDir, path.basename(media.storagePath));
    try { await fs.copyFile(origSrc, origDest); } catch {}
  }

  // Copy favicon
  if (site.design?.faviconMediaId?.storagePath) {
    const favSrc = path.join(UPLOAD_DIR, site.design.faviconMediaId.storagePath);
    try { await fs.copyFile(favSrc, path.join(buildDir, 'favicon.ico')); } catch {}
    // Also copy with original extension
    const favFilename = site.design.faviconMediaId.filename;
    if (favFilename) {
      try { await fs.copyFile(favSrc, path.join(imagesDir, favFilename)); } catch {}
    }
  }

  // Build each page
  for (const page of pages) {
    const jsonLd = [generateJsonLd(site, page)];
    const faqSection = page.sections.find(s => s.type === 'faq' && s.visible);
    const faqLd = generateFaqJsonLd(faqSection);
    if (faqLd) jsonLd.push(faqLd);

    // Render sections
    const renderedSections = [];
    for (const section of page.sections.filter(s => s.visible).sort((a, b) => a.order - b.order)) {
      if (sectionTemplates[section.type]) {
        // Resolve media IDs to URLs for the template
        let sectionData = resolveMediaInData(section.data, mediaMap);

        // Inject business data into sections that need it
        if (section.type === 'google-reviews') {
          const allTestimonials = sectionData.testimonials || [];
          sectionData = {
            ...sectionData,
            reviewCount: sectionData.reviewCount || site.business?.googleReviewCount || 0,
            rating: sectionData.rating || site.business?.googleReviewRating || 5,
            aiReviews: allTestimonials.filter(t => !t.isGoogle).slice(0, 2),
            googleReviews: allTestimonials.filter(t => t.isGoogle),
          };
        }
        if (section.type === 'city-about') {
          const biz = site.business || {};
          if (biz.name && biz.city) {
            sectionData.mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(biz.name + ' ' + biz.city)}&output=embed`;
          }
        }
        if (section.type === 'city-reviews') {
          const allTestimonials = sectionData.testimonials || [];
          sectionData = {
            ...sectionData,
            reviewCount: sectionData.reviewCount || site.business?.googleReviewCount || 0,
            rating: sectionData.rating || site.business?.googleReviewRating || 5,
            testimonials: allTestimonials.filter(t => t.isGoogle).slice(0, 3),
          };
        }
        if (section.type === 'map') {
          const biz = site.business || {};
          const mapAddress = sectionData.address || biz.address || '';
          const mapCity = biz.city || '';
          const mapZip = biz.zip || '';
          sectionData = {
            ...sectionData,
            businessName: biz.name || '',
            address: mapAddress,
            city: mapCity,
            zip: mapZip,
            phone: sectionData.phone || biz.phone || '',
            email: sectionData.email || biz.email || '',
          };
          // Embed with business name for richer display (fiche with stars, reviews)
          if (biz.name && mapCity) {
            sectionData.embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(biz.name + ' ' + mapCity)}&output=embed`;
          } else if (!sectionData.embedUrl && mapAddress) {
            const parts = [mapAddress, mapZip, mapCity].filter(Boolean);
            sectionData.embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(parts.join(' '))}&output=embed`;
          }
        }
        // Service links are set at creation time by the frontend (no round-robin needed)
        let renderedHtml = sectionTemplates[section.type]({
          ...sectionData,
          site,
          page,
          sectionType: section.type,
        });

        // Inject inline styles for section color overrides (auto-contrast if textColor missing)
        const sectionStyle = section.data?.style;
        if (sectionStyle?.backgroundColor || sectionStyle?.textColor) {
          const bg = sectionStyle.backgroundColor;
          const textColor = sectionStyle.textColor || (bg ? getContrastColor(bg) : '');
          const inlineStyle = [
            bg ? `background-color:${bg}` : '',
            textColor ? `color:${textColor}` : '',
          ].filter(Boolean).join(';');
          const cssClass = textColor === '#ffffff' ? ' section-dark-bg' : '';
          renderedHtml = renderedHtml.replace(/^<section(\s)/, `<section style="${inlineStyle}"$1`);
          if (cssClass) renderedHtml = renderedHtml.replace(/class="([^"]*)"/, `class="$1${cssClass}"`);
        }

        renderedSections.push(renderedHtml);
      }
    }

    // Extract hero image URL for preload hint (with srcset for responsive preloading)
    const heroSection = page.sections.find(s => s.type === 'hero' && s.visible);
    let heroImagePreload = '';
    let heroImageSrcset = '';
    if (heroSection?.data?.backgroundMediaId) {
      const heroMedia = mediaMap[heroSection.data.backgroundMediaId.toString()];
      if (heroMedia) {
        const best = heroMedia.variants?.find(v => v.suffix === '800w') || heroMedia.variants?.[0];
        if (best) heroImagePreload = `images/${best.storagePath.split('/').pop()}`;
        // Build srcset for responsive preload
        if (heroMedia.variants?.length) {
          heroImageSrcset = heroMedia.variants
            .map(v => `images/${v.storagePath.split('/').pop()} ${v.width}w`)
            .join(', ');
        }
      }
    }

    // Determine favicon MIME type from filename extension
    let faviconType = 'x-icon';
    if (site.design?.faviconMediaId?.filename) {
      const favExt = path.extname(site.design.faviconMediaId.filename).toLowerCase();
      if (favExt === '.png') faviconType = 'png';
      else if (favExt === '.webp') faviconType = 'webp';
      else if (favExt === '.svg') faviconType = 'svg+xml';
      else if (favExt === '.ico') faviconType = 'x-icon';
    }

    const pageHtml = baseTemplate({
      site,
      page,
      sections: renderedSections.join('\n'),
      jsonLd: jsonLd.map(ld => JSON.stringify(ld)).join('</script>\n<script type="application/ld+json">'),
      cssVars: generateCssVars(site.design),
      allPages: pages,
      faviconType,
      showLegalLinks: site.footer?.showLegalLinks !== false,
      buildTimestamp: Date.now(),
      heroImagePreload,
      heroImageSrcset,
    });

    const filename = page.isMainHomepage ? 'index.html' : `${page.slug}.html`;
    await fs.writeFile(path.join(buildDir, filename), pageHtml);
  }

  // Generate SEO files (always generate robots.txt for Lighthouse)
  await fs.writeFile(path.join(buildDir, 'robots.txt'), generateRobotsTxt(site.domain));
  if (site.domain) {
    await fs.writeFile(path.join(buildDir, 'sitemap.xml'), generateSitemapXml(site.domain, pages));
    await fs.writeFile(path.join(buildDir, 'llms.txt'), generateLlmsTxt(site, pages));
    await fs.writeFile(path.join(buildDir, 'llms-full.txt'), generateLlmsFullTxt(site, pages));
  }

  // Update site build timestamp
  await Site.findByIdAndUpdate(siteId, {
    lastBuiltAt: new Date(),
    buildError: null,
  });

  return buildDir;
}

function resolveMediaInData(data, mediaMap) {
  if (!data) return data;
  const resolved = { ...data };

  // Resolve single media fields
  for (const key of Object.keys(resolved)) {
    if (key.endsWith('MediaId') && resolved[key]) {
      const media = mediaMap[resolved[key].toString()];
      if (media) {
        const urlKey = key.replace('MediaId', 'Url');
        // Use middle variant (800w) as src fallback — srcset handles responsive selection
        const midVariant = media.variants?.find(v => v.suffix === '800w')
          || media.variants?.[Math.floor((media.variants?.length || 1) / 2)]
          || media.variants?.[media.variants.length - 1];
        resolved[urlKey] = `images/${path.basename(midVariant?.storagePath || media.storagePath)}`;
        resolved[key + '_srcset'] = media.variants?.map(v =>
          `images/${path.basename(v.storagePath)} ${v.width}w`
        ).join(', ');
        resolved[key + '_width'] = media.width;
        resolved[key + '_height'] = media.height;
        resolved[key + '_alt'] = media.alt || '';
      }
    }
  }

  // Resolve media in arrays (services, team members, etc.)
  for (const key of Object.keys(resolved)) {
    if (Array.isArray(resolved[key])) {
      resolved[key] = resolved[key].map(item =>
        typeof item === 'object' ? resolveMediaInData(item, mediaMap) : item
      );
    }
  }

  return resolved;
}

// Force reload templates (for dev)
export function invalidateTemplates() {
  templatesCompiled = false;
}
