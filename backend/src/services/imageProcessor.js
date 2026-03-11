import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

const VARIANTS = [
  { suffix: '-400w', width: 400 },
  { suffix: '-800w', width: 800 },
  { suffix: '-1200w', width: 1200 },
];

const WEBP_QUALITY = 80;

export async function processImage(buffer, originalFilename, siteSlug) {
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  const siteDir = path.join(uploadDir, siteSlug);
  const originalDir = path.join(siteDir, 'original');
  const webpDir = path.join(siteDir, 'webp');

  await fs.mkdir(originalDir, { recursive: true });
  await fs.mkdir(webpDir, { recursive: true });

  // Get image metadata
  const metadata = await sharp(buffer).metadata();
  const baseName = path.parse(originalFilename).name;
  const timestamp = Date.now();
  const safeBaseName = baseName
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
  const finalBase = `${safeBaseName}-${timestamp}`;

  // Save original
  const ext = path.extname(originalFilename) || '.jpg';
  const originalPath = path.join(originalDir, `${finalBase}${ext}`);
  await fs.writeFile(originalPath, buffer);

  // Generate WebP variants
  const variants = [];
  for (const variant of VARIANTS) {
    // Skip variants larger than original
    if (metadata.width && variant.width > metadata.width) continue;

    const webpFilename = `${finalBase}${variant.suffix}.webp`;
    const webpPath = path.join(webpDir, webpFilename);

    const result = await sharp(buffer)
      .resize(variant.width, null, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(webpPath);

    variants.push({
      suffix: variant.suffix,
      storagePath: path.join(siteSlug, 'webp', webpFilename),
      width: result.width,
      height: result.height,
      size: result.size,
    });
  }

  // Also create a full-size WebP
  const fullWebpFilename = `${finalBase}.webp`;
  const fullWebpPath = path.join(webpDir, fullWebpFilename);
  const fullResult = await sharp(buffer)
    .webp({ quality: WEBP_QUALITY })
    .toFile(fullWebpPath);

  return {
    filename: `${finalBase}${ext}`,
    storagePath: path.join(siteSlug, 'original', `${finalBase}${ext}`),
    mimeType: `image/${ext.replace('.', '')}`,
    size: buffer.length,
    width: metadata.width,
    height: metadata.height,
    variants,
    webpPath: path.join(siteSlug, 'webp', fullWebpFilename),
    webpWidth: fullResult.width,
    webpHeight: fullResult.height,
  };
}

export async function deleteMediaFiles(media) {
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  const files = [
    path.join(uploadDir, media.storagePath),
    ...media.variants.map(v => path.join(uploadDir, v.storagePath)),
  ];
  for (const file of files) {
    await fs.unlink(file).catch(() => {});
  }
}
