/**
 * Extract dominant colors from an image file using Canvas API.
 * No external dependencies — pure browser Canvas.
 */

const SAMPLE_SIZE = 50; // resize to 50x50 for fast pixel sampling

/**
 * WCAG relative luminance from hex color
 */
function luminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * HSL saturation from RGB (0-255)
 */
function saturation(r, g, b) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === min) return 0;
  const l = (max + min) / 2;
  return l > 0.5
    ? (max - min) / (2 - max - min)
    : (max - min) / (max + min);
}

/**
 * Convert RGB to hex string
 */
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
}

/**
 * Euclidean distance between two RGB colors
 */
function colorDistance(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/**
 * Simple color quantization using median-cut-like binning.
 * Returns array of { rgb: [r,g,b], count } sorted by count desc.
 */
function quantizeColors(pixels, maxColors = 8) {
  // Bin colors into 4-bit per channel buckets (16^3 = 4096 buckets)
  const buckets = new Map();
  for (const [r, g, b] of pixels) {
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const existing = buckets.get(key);
    if (existing) {
      existing.r += r;
      existing.g += g;
      existing.b += b;
      existing.count++;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  }

  // Average each bucket and sort by count
  let colors = Array.from(buckets.values()).map(b => ({
    rgb: [Math.round(b.r / b.count), Math.round(b.g / b.count), Math.round(b.b / b.count)],
    count: b.count,
  }));
  colors.sort((a, b) => b.count - a.count);

  // Merge similar colors (distance < 50)
  const merged = [];
  for (const c of colors) {
    const similar = merged.find(m => colorDistance(m.rgb, c.rgb) < 50);
    if (similar) {
      // Weighted average
      const total = similar.count + c.count;
      similar.rgb = similar.rgb.map((v, i) =>
        Math.round((v * similar.count + c.rgb[i] * c.count) / total)
      );
      similar.count = total;
    } else {
      merged.push({ ...c });
    }
  }

  merged.sort((a, b) => b.count - a.count);
  return merged.slice(0, maxColors);
}

/**
 * Extract dominant colors from an image File object.
 * Returns { palette: string[], suggested: { primaryColor, accentColor, backgroundColor, textColor } }
 */
export async function extractColorsFromImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

        const imageData = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const data = imageData.data;

        // Collect non-white, non-black, non-transparent pixels
        const pixels = [];
        for (let i = 0; i < data.length; i += 4) {
          const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
          // Skip transparent pixels
          if (a < 128) continue;
          // Skip near-white (luminance > 0.9) and near-black (luminance < 0.05)
          const lum = luminance(r, g, b);
          if (lum > 0.9 || lum < 0.05) continue;
          pixels.push([r, g, b]);
        }

        // If too few meaningful pixels, include everything non-transparent
        if (pixels.length < 20) {
          pixels.length = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue;
            pixels.push([data[i], data[i + 1], data[i + 2]]);
          }
        }

        if (pixels.length === 0) {
          resolve(null);
          return;
        }

        const quantized = quantizeColors(pixels, 6);
        const palette = quantized.map(c => rgbToHex(...c.rgb));

        // Find best primary (darkest with decent saturation)
        const primaryCandidates = [...quantized].sort((a, b) => {
          const lumA = luminance(...a.rgb);
          const lumB = luminance(...b.rgb);
          // Prefer darker colors, but give weight to frequency
          return (lumA - lumB) + (b.count - a.count) * 0.001;
        });
        const primary = primaryCandidates[0]?.rgb || quantized[0].rgb;

        // Find best accent (most saturated, distinct from primary)
        const accentCandidates = [...quantized]
          .filter(c => colorDistance(c.rgb, primary) > 40)
          .sort((a, b) => {
            const satA = saturation(...a.rgb);
            const satB = saturation(...b.rgb);
            return satB - satA;
          });
        const accent = accentCandidates[0]?.rgb || quantized[Math.min(1, quantized.length - 1)].rgb;

        // Background stays white
        const backgroundColor = '#ffffff';

        // Text color based on background via WCAG
        const textColor = '#333333';

        resolve({
          palette,
          suggested: {
            primaryColor: rgbToHex(...primary),
            accentColor: rgbToHex(...accent),
            backgroundColor,
            textColor,
          },
        });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}
