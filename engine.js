import { CAMERAS } from './cameras.js';
import { applyColor, rasterMask } from './advanced.js';
export const DEFAULTS = Object.freeze({ exposure: 0, contrast: 0, highlights: 0, shadows: 0, blacks: 0, saturation: 0, vibrance: 0, warmth: 0, tint: 0, clarity: 0, dehaze: 0, sharpen: 0, grain: 0, vignette: 0, glow: 0, softness: 0 });
export const PRESETS = [
  { id: 'natural', name: 'True to life', subtitle: 'Clean · everyday', category: 'camera', params: { contrast: 5, shadows: 10, vibrance: 8, sharpen: 10 } },
  { id: 'alpine', name: 'Alpine glow', subtitle: 'Vivid · adventurous', category: 'creative', params: { contrast: 17, highlights: -22, shadows: 17, vibrance: 30, saturation: 12, warmth: 5, clarity: 20, dehaze: 12, sharpen: 20 } },
  { id: 'fullframe', name: 'Full-frame crisp', subtitle: 'Detailed · balanced', category: 'camera', params: { contrast: 12, highlights: -20, shadows: 15, vibrance: 13, clarity: 16, sharpen: 30, blacks: -7 } },
  { id: 'portrait', name: 'Portrait prime', subtitle: 'Soft · warm', category: 'camera', params: { exposure: 8, contrast: -5, highlights: -15, shadows: 10, warmth: 10, tint: 3, vibrance: 8, softness: 25, glow: 10, vignette: 12 } },
  { id: 'film', name: 'Sunday on film', subtitle: 'Nostalgic · mellow', category: 'creative', params: { contrast: -10, highlights: -15, shadows: 12, blacks: 16, saturation: -12, warmth: 14, grain: 22, vignette: 12 } },
  { id: 'golden', name: 'Golden hour', subtitle: 'Warm · sun-kissed', category: 'creative', params: { exposure: 5, contrast: 10, warmth: 25, highlights: -10, shadows: 15, vibrance: 15, glow: 22, vignette: 9 } },
  { id: 'cinema', name: 'Cinema mood', subtitle: 'Deep · atmospheric', category: 'creative', params: { contrast: 24, saturation: -15, warmth: -12, tint: 5, highlights: -20, shadows: -8, blacks: -15, vignette: 26, grain: 8 } },
  { id: 'mono', name: 'Silver & shadow', subtitle: 'Monochrome · timeless', category: 'camera', mono: true, params: { contrast: 20, highlights: -10, shadows: 10, clarity: 10, grain: 12, vignette: 15 } },
  { id: 'coastal', name: 'Coastal breeze', subtitle: 'Cool · airy', category: 'creative', params: { exposure: 10, contrast: -8, highlights: -18, shadows: 24, blacks: 7, warmth: -15, tint: -3, vibrance: 13, clarity: -7, glow: 6 } },
  { id: 'autumn', name: 'Autumn warmth', subtitle: 'Earthy · golden', category: 'creative', params: { contrast: 13, highlights: -17, shadows: 10, blacks: -5, warmth: 21, tint: 5, vibrance: 21, saturation: 5, clarity: 10, vignette: 12 } },
  { id: 'pastel', name: 'Pastel day', subtitle: 'Gentle · dreamy', category: 'creative', params: { exposure: 12, contrast: -22, highlights: -20, shadows: 26, blacks: 17, saturation: -18, warmth: 6, tint: 8, clarity: -18, glow: 18 } },
  { id: 'velvet', name: 'Velvet portrait', subtitle: 'Soft · flattering', category: 'creative', params: { exposure: 6, contrast: -12, highlights: -24, shadows: 15, warmth: 12, tint: 6, saturation: -7, vibrance: 9, clarity: -14, softness: 16, glow: 9, vignette: 8 } },
  { id: 'urban', name: 'Urban chrome', subtitle: 'Cool · crisp', category: 'creative', params: { contrast: 23, highlights: -16, shadows: 9, blacks: -14, warmth: -16, tint: 2, saturation: -20, clarity: 26, sharpen: 24, dehaze: 6 } },
  { id: 'postcard', name: 'Vintage postcard', subtitle: 'Faded · retro film', category: 'creative', params: { contrast: -16, highlights: -22, shadows: 17, blacks: 25, warmth: 19, tint: -6, saturation: -23, grain: 32, clarity: -8, vignette: 20 } },
  { id: 'peach', name: 'Peach sunset', subtitle: 'Rosy · warm', category: 'creative', params: { exposure: 8, contrast: 4, highlights: -23, shadows: 17, warmth: 20, tint: 15, saturation: -4, vibrance: 14, glow: 27, vignette: 5 } },
  { id: 'forest', name: 'Forest walk', subtitle: 'Lush · moody', category: 'creative', params: { exposure: -7, contrast: 18, highlights: -27, shadows: 12, blacks: -12, warmth: -5, tint: -12, vibrance: 24, clarity: 17, dehaze: 9, vignette: 19 } },
  { id: 'midnight', name: 'Midnight blue', subtitle: 'Cool · dramatic', category: 'creative', params: { exposure: -16, contrast: 26, highlights: -18, shadows: -7, blacks: -18, warmth: -30, tint: 6, saturation: -13, clarity: 12, grain: 12, vignette: 28 } },
  { id: 'desert', name: 'Desert light', subtitle: 'Warm · matte', category: 'creative', params: { exposure: 4, contrast: 5, highlights: -24, shadows: 21, blacks: 14, warmth: 27, tint: -4, saturation: -10, vibrance: 9, clarity: 8, grain: 7 } },
  { id: 'pop', name: 'Punchy pop', subtitle: 'Bold · colorful', category: 'creative', params: { exposure: 3, contrast: 21, highlights: -15, shadows: 14, blacks: -8, saturation: 22, vibrance: 32, clarity: 18, sharpen: 22, dehaze: 5 } },
  { id: 'noir', name: 'Soft noir', subtitle: 'Black & white · cinematic', category: 'creative', mono: true, params: { contrast: 11, highlights: -29, shadows: 20, blacks: 8, clarity: -9, grain: 19, glow: 7, vignette: 24 } }
];
export const GROUPS = [
  { name: 'Light', icon: '☼', sliders: [
    ['exposure', 'Brightness', -100, 100, 'Lift the light or set a darker mood.'],
    ['contrast', 'Contrast', -100, 100, 'The difference between light and dark.'],
    ['highlights', 'Highlights', -100, 100, 'Bring back detail in bright skies.'],
    ['shadows', 'Shadows', -100, 100, 'Reveal details in the darker areas.'],
    ['blacks', 'Black point', -100, 100, 'Deep blacks or a gentle faded finish.']
  ] },
  { name: 'Color', icon: '◉', sliders: [
    ['vibrance', 'Vibrance', -100, 100, 'Boost quieter colors with a lighter touch.'],
    ['saturation', 'Color intensity', -100, 100, 'Turn all the colors up or down.'],
    ['warmth', 'Warmth', -100, 100, 'Cool blue to warm, golden tones.'],
    ['tint', 'Tint', -100, 100, 'Balance green and magenta casts.']
  ] },
  { name: 'Detail & atmosphere', icon: '✧', sliders: [
    ['clarity', 'Clarity', -100, 100, 'Make texture stand out, or soften it.'],
    ['dehaze', 'Haze removal', 0, 100, 'Add depth to hazy landscapes.'],
    ['sharpen', 'Sharpness', 0, 100, 'Give fine edges a crisper finish.'],
    ['grain', 'Film grain', 0, 100, 'A little analog texture.'],
    ['vignette', 'Vignette', 0, 100, 'Darken the edges to draw the eye inward.'],
    ['glow', 'Soft glow', 0, 100, 'A gentle bloom around bright areas.'],
    ['softness', 'Background softness', 0, 100, 'Soften the edges; keep the center clear.']
  ] }
];
export function effectiveParams(state) {
  const preset = PRESETS.find(p => p.id === state.preset);
  const camera = CAMERAS.find(c => c.id === state.camera);
  const strength = state.strength / 100;
  const cameraStrength = (state.cameraStrength ?? 75) / 100;
  const params = {};
  for (const key of Object.keys(DEFAULTS)) {
    const minimum = ['dehaze', 'sharpen', 'grain', 'vignette', 'glow', 'softness'].includes(key) ? 0 : -100;
    params[key] = Math.max(minimum, Math.min(100, (preset?.params[key] || 0) * strength + (camera?.params[key] || 0) * cameraStrength + (state.adjustments[key] || 0)));
  }
  params.mono = preset?.mono ? strength : 0;
  if (state.color) params.color = state.color;
  if (state.masks) params.masks = state.masks;
  return params;
}
export function cropRect(width, height, ratio = 'original', x = 50, y = 50) {
  if (ratio === 'original') return { x: 0, y: 0, width, height };
  const [a, b] = ratio.split(':').map(Number);
  const target = a / b;
  if (!(target > 0)) throw new Error('Invalid crop ratio');
  const w = width / height > target ? height * target : width;
  const h = width / height > target ? height : width / target;
  return { x: (width - w) * x / 100, y: (height - h) * y / 100, width: w, height: h };
}
export function outputSize(width, height, size) {
  const scale = size === 'instagram' ? Math.min(1, 1080 / width) : size === '2048' ? Math.min(1, 2048 / Math.max(width, height)) : 1;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
const clamp = v => Math.max(0, Math.min(255, v));
// Separable box blur: constant work per pixel, even on full-resolution exports.
function blurRGB(source, width, height, radius) {
  radius = Math.max(1, Math.round(radius));
  const horizontal = new Uint8ClampedArray(source.length);
  const result = new Uint8ClampedArray(source.length);
  const length = radius * 2 + 1;
  for (let y = 0; y < height; y++) {
    const base = y * width * 4;
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let dx = -radius; dx <= radius; dx++) sum += source[base + Math.max(0, Math.min(width - 1, dx)) * 4 + c];
      for (let x = 0; x < width; x++) {
        horizontal[base + x * 4 + c] = sum / length;
        sum += source[base + Math.min(width - 1, x + radius + 1) * 4 + c] - source[base + Math.max(0, x - radius) * 4 + c];
      }
    }
  }
  for (let x = 0; x < width; x++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let dy = -radius; dy <= radius; dy++) sum += horizontal[(Math.max(0, Math.min(height - 1, dy)) * width + x) * 4 + c];
      for (let y = 0; y < height; y++) {
        result[(y * width + x) * 4 + c] = sum / length;
        sum += horizontal[(Math.min(height - 1, y + radius + 1) * width + x) * 4 + c] - horizontal[(Math.max(0, y - radius) * width + x) * 4 + c];
      }
    }
  }
  return result;
}
// This function is shared by thumbnails, the preview worker, and export.
export function processPixels(pixels, width, height, p) {
  const out = new Uint8ClampedArray(pixels);
  const exposure = 2 ** (p.exposure / 65);
  const contrast = 1 + p.contrast / 130;
  const warm = p.warmth * .30;
  const tint = p.tint * .18;
  const haze = p.dehaze / 100;
  for (let i = 0; i < out.length; i += 4) {
    let r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const lum = (.2126 * r + .7152 * g + .0722 * b) / 255;
    const shadow = (1 - lum) ** 3 * p.shadows * .9;
    const highlight = lum ** 3 * p.highlights * .8;
    const black = (1 - lum) ** 5 * p.blacks * .8;
    r = (r * exposure + shadow + highlight + black - 128) * contrast + 128 + warm + tint;
    g = (g * exposure + shadow + highlight + black - 128) * contrast + 128 - tint;
    b = (b * exposure + shadow + highlight + black - 128) * contrast + 128 - warm + tint;
    if (haze) { r = (r - 17 * haze) / (1 - .22 * haze); g = (g - 17 * haze) / (1 - .22 * haze); b = (b - 20 * haze) / (1 - .22 * haze); }
    const gray = .2126 * r + .7152 * g + .0722 * b;
    const currentSat = (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, Math.max(r, g, b));
    const sat = Math.max(0, 1 + p.saturation / 100 + p.vibrance / 100 * (1 - currentSat) * .85);
    r = gray + (r - gray) * sat * (1 - (p.mono || 0));
    g = gray + (g - gray) * sat * (1 - (p.mono || 0));
    b = gray + (b - gray) * sat * (1 - (p.mono || 0));
    out[i] = clamp(r); out[i + 1] = clamp(g); out[i + 2] = clamp(b);
  }
  const unit = Math.max(width, height) / 1400;
  if (p.clarity) {
    const broad = blurRGB(out, width, height, Math.max(2, 12 * unit));
    for (let i = 0; i < out.length; i += 4) for (let c = 0; c < 3; c++) out[i + c] = clamp(out[i + c] + (out[i + c] - broad[i + c]) * p.clarity / 85);
  }
  if (p.sharpen) {
    const fine = blurRGB(out, width, height, Math.max(1, unit));
    for (let i = 0; i < out.length; i += 4) for (let c = 0; c < 3; c++) {
      const detail = out[i + c] - fine[i + c];
      if (Math.abs(detail) > 2) out[i + c] = clamp(out[i + c] + detail * p.sharpen / 90);
    }
  }
  if (p.glow || p.softness) {
    const soft = blurRGB(out, width, height, Math.max(2, 16 * unit));
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const distance = ((x / width - .5) * 2) ** 2 + ((y / height - .5) * 2) ** 2;
      const mix = Math.max(0, Math.min(1, (distance - .16) * 1.1)) * p.softness / 100;
      const glow = p.glow / 100 * .26 * (Math.max(soft[i], soft[i + 1], soft[i + 2]) / 255) ** 2;
      for (let c = 0; c < 3; c++) out[i + c] = clamp(out[i + c] * (1 - mix) + soft[i + c] * mix + (255 - out[i + c]) * glow);
    }
  }
  if (p.grain || p.vignette) {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const distance = ((x / width - .5) * 2) ** 2 + ((y / height - .5) * 2) ** 2;
      const vignette = 1 - Math.min(1, distance / 1.6) ** 1.3 * p.vignette / 100 * .7;
      // Deterministic noise means the photo doesn't flicker during adjustments.
      let hash = Math.imul(x + 17, 374761393) ^ Math.imul(y + 23, 668265263);
      hash = Math.imul(hash ^ hash >>> 13, 1274126177);
      const noise = ((hash >>> 0) / 4294967295 - .5) * p.grain * .48;
      for (let c = 0; c < 3; c++) out[i + c] = clamp(out[i + c] * vignette + noise);
    }
  }
  applyColor(out, p.color);
  if (p.geometry) for (const mask of p.masks || []) {
    if (!mask.enabled || !Object.values(mask.adjustments).some(value => value)) continue;
    const alpha = rasterMask(mask, width, height, p.geometry);
    const local = processPixels(out, width, height, { ...DEFAULTS, ...mask.adjustments });
    for (let i = 0; i < alpha.length; i++) for (let c = 0; c < 3; c++) out[i * 4 + c] += (local[i * 4 + c] - out[i * 4 + c]) * alpha[i];
  }
  return out;
}
