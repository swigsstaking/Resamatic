import mongoose from 'mongoose';

const siteSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  domain: { type: String, unique: true, sparse: true, trim: true },
  status: { type: String, enum: ['draft', 'building', 'published', 'error'], default: 'draft' },

  // Business info
  business: {
    name: { type: String, trim: true },
    activity: { type: String, trim: true },
    description: { type: String },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    zip: { type: String, trim: true },
    country: { type: String, default: 'FR' },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    siret: { type: String, trim: true },
    socialLinks: {
      facebook: String,
      instagram: String,
      tiktok: String,
      youtube: String,
      linkedin: String,
    },
    openingHours: [{ day: String, hours: String }],
    googleMapsEmbed: String,
    googleReviewCount: Number,
    googleReviewRating: Number,
  },

  // Design
  design: {
    primaryColor: { type: String, default: '#12203e' },
    accentColor: { type: String, default: '#c8a97e' },
    backgroundColor: { type: String, default: '#ffffff' },
    textColor: { type: String, default: '#333333' },
    fontHeading: { type: String, default: 'Playfair Display' },
    fontBody: { type: String, default: 'Inter' },
    logoMediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Media' },
    faviconMediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Media' },
  },

  // PostHog integration
  posthog: {
    enabled: { type: Boolean, default: false },
    apiKey: String,
    apiHost: { type: String, default: 'https://eu.i.posthog.com' },
  },

  // SEO defaults
  seoDefaults: {
    titleSuffix: String,
    defaultDescription: String,
    defaultKeywords: [String],
  },

  // Header CTA
  headerCtaText: { type: String, trim: true },
  headerCtaUrl: { type: String, trim: true },

  // Footer config
  footer: {
    copyrightText: { type: String, trim: true },
    showLegalLinks: { type: Boolean, default: true },
    legalPageSlug: { type: String, default: 'mentions-legales' },
    cgvPageSlug: { type: String, default: 'cgv' },
  },

  // Build / Deploy metadata
  lastBuiltAt: Date,
  lastPublishedAt: Date,
  buildError: String,
}, { timestamps: true });

export default mongoose.model('Site', siteSchema);
