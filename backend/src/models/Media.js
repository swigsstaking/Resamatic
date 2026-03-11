import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
  suffix: { type: String, required: true },
  storagePath: { type: String, required: true },
  width: Number,
  height: Number,
  size: Number,
}, { _id: false });

const mediaSchema = new mongoose.Schema({
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true, index: true },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  storagePath: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: Number,
  width: Number,
  height: Number,
  alt: { type: String, default: '' },
  folder: { type: String, default: '/' },
  variants: [variantSchema],
}, { timestamps: true });

mediaSchema.index({ siteId: 1, folder: 1 });

export default mongoose.model('Media', mediaSchema);
