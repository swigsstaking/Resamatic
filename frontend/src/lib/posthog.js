import posthog from 'posthog-js';

const POSTHOG_KEY = 'phc_VUxzTEM5D9D93yvhkjbok6kTL3BbnQM1AnqdTLgRbrF';
const POSTHOG_HOST = 'https://eu.posthog.com';
const APP_NAME = 'resamatic';

let initialized = false;

export function initPostHog() {
  if (initialized || typeof window === 'undefined') return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: true,
    capture_pageview: false,
    capture_pageleave: true,
    persistence: 'localStorage',
    session_recording: { maskAllInputs: false },
    loaded: (ph) => {
      ph.register({ app: APP_NAME });
    },
  });

  initialized = true;
}

export function identifyUser(email) {
  if (!initialized || !email) return;
  posthog.identify(email, { email, app: APP_NAME });
}

export function trackEvent(eventName, properties = {}) {
  if (!initialized) return;
  posthog.capture(eventName, { ...properties, app: APP_NAME });
}

export function trackPageView(path) {
  if (!initialized) return;
  posthog.capture('$pageview', { $current_url: window.location.href, path, app: APP_NAME });
}

// ── Resamatic-specific events ────────────────────────────────

export function trackSiteCreated(site, { pageCount, useAI, imageCount }) {
  trackEvent('site_created', {
    site_id: site._id,
    site_name: site.name,
    page_count: pageCount,
    use_ai: useAI,
    image_count: imageCount,
  });
}

export function trackPageGenerated(siteId, pageTitle, keyword) {
  trackEvent('page_generated', { site_id: siteId, page_title: pageTitle, keyword });
}

export function trackSitePublished(siteId, siteName, domain) {
  trackEvent('site_published', { site_id: siteId, site_name: siteName, domain });
}

export function trackSitePreview(siteId) {
  trackEvent('site_preview', { site_id: siteId });
}

export function trackMediaUploaded(siteId, count) {
  trackEvent('media_uploaded', { site_id: siteId, count });
}

export function trackAIGeneration(siteId, pageTitle, durationMs) {
  trackEvent('ai_generation', { site_id: siteId, page_title: pageTitle, duration_ms: durationMs });
}

export { posthog };
