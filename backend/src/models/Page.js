import mongoose from 'mongoose';

const sectionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'hero', 'text-highlight', 'description', 'why-us', 'google-reviews', 'cta-banner',
      'services-grid', 'guarantee', 'testimonials',
      'faq', 'team', 'map',
      'city-about', 'city-guarantee', 'city-reviews',
    ],
  },
  order: { type: Number, required: true },
  visible: { type: Boolean, default: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: true });

const pageSchema = new mongoose.Schema({
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true, index: true },
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true },
  type: { type: String, enum: ['homepage', 'subpage', 'contact', 'legal', 'city'], required: true },
  isMainHomepage: { type: Boolean, default: false },
  cityTarget: { type: String, trim: true, default: '' },

  // SEO
  seo: {
    title: String,
    description: String,
    keywords: [String],
    canonicalUrl: String,
    ogImageMediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Media' },
    jsonLd: {
      type: { type: String, default: 'LocalBusiness' },
      customFields: mongoose.Schema.Types.Mixed,
    },
  },

  // Sections
  sections: [sectionSchema],

  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

pageSchema.index({ siteId: 1, slug: 1 }, { unique: true });

export default mongoose.model('Page', pageSchema);
