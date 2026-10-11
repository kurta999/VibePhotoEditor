export const COLOR_RANGES = [
  ['red', 'Red', 0, '#df615a'], ['orange', 'Orange', 30, '#df9957'], ['yellow', 'Yellow', 60, '#c5ad45'],
  ['green', 'Green', 120, '#6eaa71'], ['aqua', 'Aqua', 180, '#53a6ac'], ['blue', 'Blue', 240, '#688cc6'],
  ['purple', 'Purple', 270, '#a180c5'], ['magenta', 'Magenta', 300, '#c475a5']
];
export const identityCurve = () => [[0, 0], [255, 255]];
export const freshColor = () => ({ curves: Object.fromEntries(['rgb', 'red', 'green', 'blue'].map(key => [key, identityCurve()])), hsl: Object.fromEntries(COLOR_RANGES.map(([key]) => [key, { hue: 0, saturation: 0, luminance: 0 }])) });
const bound = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const smoothstep = value => { const t = bound(value); return t * t * (3 - 2 * t); };

// Shape-preserving cubic interpolation avoids ringing around control points.
export function curveLut(points = identityCurve()) {
  const p = points.map(([x, y]) => [bound(x, 0, 255), bound(y, 0, 255)]).sort((a, b) => a[0] - b[0]);
  if (p.length < 2 || p.some((point, i) => i && point[0] <= p[i - 1][0])) throw new Error('Curve points must have distinct input values.');
  const h = [], delta = [], slopes = [];
  for (let i = 0; i < p.length - 1; i++) { h[i] = p[i + 1][0] - p[i][0]; delta[i] = (p[i + 1][1] - p[i][1]) / h[i]; }
  slopes[0] = delta[0]; slopes[p.length - 1] = delta.at(-1);
  for (let i = 1; i < p.length - 1; i++) {
    if (delta[i - 1] * delta[i] <= 0) slopes[i] = 0;
    else { const a = 2 * h[i] + h[i - 1], b = h[i] + 2 * h[i - 1]; slopes[i] = (a + b) / (a / delta[i - 1] + b / delta[i]); }
  }
  const lut = new Float32Array(256);
  let segment = 0;
  for (let x = 0; x < 256; x++) {
    while (segment < p.length - 2 && x > p[segment + 1][0]) segment++;
    const i = segment, t = bound((x - p[i][0]) / h[i]), t2 = t * t, t3 = t2 * t;
    lut[x] = bound((2 * t3 - 3 * t2 + 1) * p[i][1] + (t3 - 2 * t2 + t) * h[i] * slopes[i] + (-2 * t3 + 3 * t2) * p[i + 1][1] + (t3 - t2) * h[i] * slopes[i + 1], 0, 255);
  }
  return lut;
}
function lookup(lut, value) { const x = bound(value, 0, 255), i = Math.floor(x); return lut[i] + (lut[Math.min(255, i + 1)] - lut[i]) * (x - i); }
export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min, l = (max + min) / 2;
  if (!delta) return [0, 0, l];
  let h = max === r ? (g - b) / delta + (g < b ? 6 : 0) : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return [h * 60, delta / (1 - Math.abs(2 * l - 1)), l];
}
export function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s = bound(s); l = bound(l);
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const colors = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return colors.map(value => (value + m) * 255);
}
export function rangeWeights(hue) {
  const h = ((hue % 360) + 360) % 360;
  let i = COLOR_RANGES.findLastIndex(([, , center]) => center <= h);
  const next = (i + 1) % COLOR_RANGES.length, start = COLOR_RANGES[i][2], end = next ? COLOR_RANGES[next][2] : 360;
  const t = smoothstep((h - start) / (end - start));
  return [[COLOR_RANGES[i][0], 1 - t], [COLOR_RANGES[next][0], t]];
}
export function applyColor(pixels, color) {
  if (!color) return pixels;
  const curves = color.curves || {}, luts = {};
  for (const key of ['rgb', 'red', 'green', 'blue']) if (curves[key]?.some(([x, y]) => x !== y)) luts[key] = curveLut(curves[key]);
  const hslActive = Object.values(color.hsl || {}).some(p => p.hue || p.saturation || p.luminance);
  if (!Object.keys(luts).length && !hslActive) return pixels;
  for (let i = 0; i < pixels.length; i += 4) {
    let rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
    if (luts.rgb) rgb = rgb.map(value => lookup(luts.rgb, value));
    ['red', 'green', 'blue'].forEach((key, channel) => { if (luts[key]) rgb[channel] = lookup(luts[key], rgb[channel]); });
    if (hslActive) {
      let [h, s, l] = rgbToHsl(...rgb);
      if (s > 0) {
        let hue = 0, saturation = 0, luminance = 0;
        for (const [key, weight] of rangeWeights(h)) { const p = color.hsl[key] || {}; hue += (p.hue || 0) * weight; saturation += (p.saturation || 0) * weight; luminance += (p.luminance || 0) * weight; }
        const chromaWeight = Math.min(1, s / .1);
        h += hue * chromaWeight; s = bound(s * (1 + saturation / 100 * chromaWeight));
        l += (luminance > 0 ? 1 - l : l) * luminance / 100 * chromaWeight;
        rgb = hslToRgb(h, s, l);
      }
    }
    pixels[i] = rgb[0]; pixels[i + 1] = rgb[1]; pixels[i + 2] = rgb[2];
  }
  return pixels;
}

// A small zoom fills empty corners while retaining the oriented image aspect ratio.
export function straightenScale(width, height, degrees = 0) {
  const angle = Math.abs(degrees) * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  return Math.max(c + height / width * s, c + width / height * s);
}
export function frameToSource(x, y, geometry) {
  const { sourceWidth: sw, sourceHeight: sh, width, height, rect, rotation = 0, straighten = 0 } = geometry;
  const a = -straighten * Math.PI / 180, scale = straightenScale(width, height, straighten);
  const fx = rect.x + x * rect.width - width / 2, fy = rect.y + y * rect.height - height / 2;
  const rx = (fx * Math.cos(a) - fy * Math.sin(a)) / scale, ry = (fx * Math.sin(a) + fy * Math.cos(a)) / scale;
  const q = -rotation * Math.PI / 180;
  return { x: (rx * Math.cos(q) - ry * Math.sin(q) + sw / 2) / sw, y: (rx * Math.sin(q) + ry * Math.cos(q) + sh / 2) / sh };
}
export function sourceToFrame(x, y, geometry) {
  const { sourceWidth: sw, sourceHeight: sh, width, height, rect, rotation = 0, straighten = 0 } = geometry;
  const q = rotation * Math.PI / 180, a = straighten * Math.PI / 180, scale = straightenScale(width, height, straighten);
  const sx = x * sw - sw / 2, sy = y * sh - sh / 2;
  const rx = sx * Math.cos(q) - sy * Math.sin(q), ry = sx * Math.sin(q) + sy * Math.cos(q);
  return { x: ((rx * Math.cos(a) - ry * Math.sin(a)) * scale + width / 2 - rect.x) / rect.width, y: ((rx * Math.sin(a) + ry * Math.cos(a)) * scale + height / 2 - rect.y) / rect.height };
}
function distanceToSegment(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
  const t = length ? bound(((x - ax) * dx + (y - ay) * dy) / length) : 0;
  return Math.hypot(x - ax - dx * t, y - ay - dy * t);
}
function featherWeight(distance, radius, feather) {
  const hard = radius * (1 - bound(feather / 100));
  return distance <= hard ? 1 : distance >= radius ? 0 : 1 - smoothstep((distance - hard) / Math.max(.00001, radius - hard));
}
export function rasterMask(mask, outputWidth, outputHeight, geometry) {
  const alpha = new Float32Array(outputWidth * outputHeight);
  const sw = geometry.sourceWidth, sh = geometry.sourceHeight, unit = Math.min(sw, sh);
  const origin = frameToSource(0, 0, geometry), px = frameToSource(1, 0, geometry), py = frameToSource(0, 1, geometry);
  const ax = (px.x - origin.x) * sw / outputWidth, ay = (px.y - origin.y) * sh / outputWidth;
  const bx = (py.x - origin.x) * sw / outputHeight, by = (py.y - origin.y) * sh / outputHeight;
  function coordinates(x, y) { return [origin.x * sw + (x + .5) * ax + (y + .5) * bx, origin.y * sh + (x + .5) * ay + (y + .5) * by]; }
  if (mask.type === 'brush') {
    for (const stroke of mask.strokes || []) {
      const layer = new Float32Array(alpha.length), radius = stroke.radius * unit;
      const points = stroke.points;
      for (let n = 0; n < points.length; n++) {
        const start = points[Math.max(0, n - 1)], end = points[n];
        const f = sourceToFrame(start[0], start[1], geometry), t = sourceToFrame(end[0], end[1], geometry);
        const extent = radius * straightenScale(geometry.width, geometry.height, geometry.straighten) * Math.max(outputWidth / geometry.rect.width, outputHeight / geometry.rect.height) + 1;
        const left = Math.max(0, Math.floor(Math.min(f.x, t.x) * outputWidth - extent)), right = Math.min(outputWidth - 1, Math.ceil(Math.max(f.x, t.x) * outputWidth + extent));
        const top = Math.max(0, Math.floor(Math.min(f.y, t.y) * outputHeight - extent)), bottom = Math.min(outputHeight - 1, Math.ceil(Math.max(f.y, t.y) * outputHeight + extent));
        for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
          const [sx, sy] = coordinates(x, y), index = y * outputWidth + x;
          layer[index] = Math.max(layer[index], featherWeight(distanceToSegment(sx, sy, start[0] * sw, start[1] * sh, end[0] * sw, end[1] * sh), radius, stroke.feather));
        }
      }
      for (let i = 0; i < alpha.length; i++) alpha[i] = stroke.erase ? alpha[i] * (1 - layer[i]) : Math.max(alpha[i], layer[i]);
    }
  } else {
    for (let y = 0; y < outputHeight; y++) for (let x = 0; x < outputWidth; x++) {
      const [sx, sy] = coordinates(x, y);
      if (mask.type === 'linear') {
        const dx = (mask.end[0] - mask.start[0]) * sw, dy = (mask.end[1] - mask.start[1]) * sh;
        const length = dx * dx + dy * dy;
        if (length < .001) continue;
        const dot = ((sx - mask.start[0] * sw) * dx + (sy - mask.start[1] * sh) * dy) / length;
        alpha[y * outputWidth + x] = 1 - smoothstep(dot);
      } else {
        alpha[y * outputWidth + x] = featherWeight(Math.hypot(sx - mask.x * sw, sy - mask.y * sh), mask.radius * unit, mask.feather);
      }
    }
  }
  if (mask.invert) for (let i = 0; i < alpha.length; i++) alpha[i] = 1 - alpha[i];
  return alpha;
}

export function customOutputSize(width, height, targetWidth, targetHeight) {
  for (const value of [targetWidth, targetHeight]) if (!Number.isInteger(value) || value < 1 || value > 8192) throw new Error('Use whole-number dimensions from 1 to 8192 px.');
  if (targetWidth * targetHeight > 16000000) throw new Error('Custom export is limited to 16 megapixels.');
  const expected = width / height;
  if (Math.abs(targetWidth - targetHeight * expected) > Math.max(1, expected)) throw new Error('Custom dimensions must match your crop aspect ratio.');
  if (targetWidth > Math.round(width) || targetHeight > Math.round(height)) throw new Error('Custom export cannot exceed the working crop resolution.');
  return { width: targetWidth, height: targetHeight };
}
