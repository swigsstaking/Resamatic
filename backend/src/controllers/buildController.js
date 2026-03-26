import { buildSite, invalidateTemplates } from '../services/ssg.service.js';
import Site from '../models/Site.js';
import path from 'path';
import fs from 'fs/promises';
import express from 'express';

export const triggerBuild = async (req, res, next) => {
  try {
    const site = await Site.findById(req.params.siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });

    // Always invalidate template cache to pick up new/updated templates
    invalidateTemplates();

    site.status = 'building';
    await site.save();

    // Build async — don't block the response
    buildSite(site._id)
      .then(() => Site.findByIdAndUpdate(site._id, { status: 'draft', buildError: null }))
      .catch(async (err) => {
        await Site.findByIdAndUpdate(site._id, { status: 'error', buildError: err.message });
      });

    res.json({ message: 'Build started', siteId: site._id });
  } catch (err) { next(err); }
};

export const getBuildStatus = async (req, res, next) => {
  try {
    const site = await Site.findById(req.params.siteId).select('status lastBuiltAt buildError');
    if (!site) return res.status(404).json({ error: 'Site not found' });
    res.json({
      status: site.status,
      lastBuiltAt: site.lastBuiltAt,
      buildError: site.buildError,
    });
  } catch (err) { next(err); }
};

export const servePreview = async (req, res, next) => {
  try {
    const site = await Site.findById(req.params.siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const buildDir = path.resolve(process.env.BUILD_OUTPUT_DIR || './builds', site.slug);
    const filePath = req.params[0] || 'index.html';

    // Prevent path traversal
    const resolved = path.resolve(buildDir, filePath);
    if (!resolved.startsWith(buildDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // For HTML files, inline CSS and set base URL to prevent HTTPS upgrade issues
    if (filePath.endsWith('.html')) {
      try {
        let html = await fs.readFile(resolved, 'utf-8');
        const baseUrl = `${req.protocol}://${req.get('host')}/api/build/${req.params.siteId}/preview/`;
        html = html.replace('<head>', `<head>\n  <base href="${baseUrl}">`);

        // Inline the main.css to avoid HTTPS upgrade issues in iframe
        try {
          const css = await fs.readFile(path.join(buildDir, 'main.css'), 'utf-8');
          html = html.replace(
            '<link rel="stylesheet" href="main.css">',
            `<style>${css}</style>`
          );
        } catch { /* no main.css */ }

        // Allow inline scripts for the edit bridge in iframe preview
        res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;");
        res.type('html').send(html);
      } catch {
        res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;");
        res.type('html').status(404).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Aperçu non disponible</title>
<style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:system-ui,sans-serif;background:#f9fafb;color:#6b7280;}
.box{text-align:center;max-width:360px;}.box h2{color:#374151;margin-bottom:.5rem;font-size:1.125rem;}.box p{font-size:.875rem;line-height:1.6;}</style></head>
<body><div class="box"><h2>Aperçu non disponible</h2><p>Cette page n'a pas encore été construite. Cliquez sur "Sauver" ou "Rafraîchir" dans l'éditeur pour générer l'aperçu.</p></div></body></html>`);
      }
      return;
    }

    res.sendFile(filePath, { root: buildDir }, (err) => {
      if (err) res.status(404).type('html').send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Fichier introuvable</title>
<style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:system-ui,sans-serif;background:#f9fafb;color:#6b7280;}</style></head>
<body><p>Fichier introuvable</p></body></html>`);
    });
  } catch (err) { next(err); }
};
