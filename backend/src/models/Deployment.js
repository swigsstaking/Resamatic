import mongoose from 'mongoose';

const deploymentSchema = new mongoose.Schema({
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  siteName: { type: String, required: true },
  domain: { type: String, required: true },
  type: { type: String, enum: ['standard', 'posthog'], required: true },
  firstPublishedAt: { type: Date, required: true },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

// One deployment record per site (first deploy only)
deploymentSchema.index({ siteId: 1 }, { unique: true });

export default mongoose.model('Deployment', deploymentSchema);
