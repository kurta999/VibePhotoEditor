const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
export const freshHealing = () => ({ spots: [], size: 24, strength: 100, feather: 65, texture: 100 });

function sample(pixels, width, height, x, y) {
  if (x < 0 || y < 0 || x > width - 1 || y > height - 1) return null;
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const result = [0, 0, 0, 0];
  for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
    const i = (Math.min(height - 1, iy + dy) * width + Math.min(width - 1, ix + dx)) * 4;
    const weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
    for (let c = 0; c < 4; c++) result[c] += pixels[i + c] * weight;
  }
  return result[3] < 250 ? null : result;
}
// Fit the surrounding color and lighting as a plane, with trimmed means to
// reduce contamination from isolated neighboring blemishes.
function skinPlane(pixels, width, height, x, y, radius) {
  const ring = [];
  for (let i = 0; i < 32; i++) {
    const angle = i / 32 * Math.PI * 2, dx = Math.cos(angle), dy = Math.sin(angle);
    const color = sample(pixels, width, height, x + dx * radius * 1.15, y + dy * radius * 1.15);
    if (color) ring.push({ dx: dx * 1.15, dy: dy * 1.15, color });
  }
  if (ring.length < 20) return null;
  return [0, 1, 2].map(c => {
    const values = ring.map(point => point.color[c]).sort((a, b) => a - b), trim = Math.floor(values.length * .15);
    const mean = values.slice(trim, -trim).reduce((sum, value) => sum + value, 0) / (values.length - 2 * trim);
    let xx = 0, yy = 0, xy = 0, bx = 0, by = 0;
    for (const point of ring) {
      const delta = clamp(point.color[c] - mean, -35, 35);
      xx += point.dx ** 2; yy += point.dy ** 2; xy += point.dx * point.dy; bx += point.dx * delta; by += point.dy * delta;
    }
    const determinant = xx * yy - xy * xy;
    return [mean, (bx * yy - by * xy) / determinant, (by * xx - bx * xy) / determinant];
  });
}
const planeAt = (plane, c, dx, dy) => plane[c][0] + plane[c][1] * dx + plane[c][2] * dy;

export function healPixels(pixels, width, height, spots = []) {
  const out = new Uint8ClampedArray(pixels), unit = Math.min(width, height);
  const repairs = spots.slice(0, 80).filter(spot => [spot.x, spot.y, spot.radius, spot.strength, spot.feather, spot.texture].every(Number.isFinite) && spot.radius > 0 && spot.strength > 0);
  for (const spot of repairs) {
    const x = clamp(spot.x) * width, y = clamp(spot.y) * height, radius = Math.max(1, Math.min(unit * .2, spot.radius * unit));
    const target = skinPlane(pixels, width, height, x, y, radius);
    if (!target) continue;
    let best = null, bestScore = Infinity;
    for (const distance of [2.6, 4, 5.5]) for (let angle = 0; angle < 16; angle++) {
      const a = angle / 16 * Math.PI * 2, sx = x + Math.cos(a) * radius * distance, sy = y + Math.sin(a) * radius * distance;
      if (sx - radius * 1.2 < 0 || sy - radius * 1.2 < 0 || sx + radius * 1.2 >= width || sy + radius * 1.2 >= height) continue;
      if (repairs.some(other => Math.hypot(sx - other.x * width, sy - other.y * height) < radius * 1.2 + other.radius * unit)) continue;
      const donor = skinPlane(pixels, width, height, sx, sy, radius); if (!donor) continue;
      let score = 0;
      for (let c = 0; c < 3; c++) score += (donor[c][0] - target[c][0]) ** 2 * .15 + (donor[c][1] - target[c][1]) ** 2 + (donor[c][2] - target[c][2]) ** 2;
      let roughness = 0, samples = 0;
      for (let i = 0; i < 25; i++) {
        const dx = ((i % 5) - 2) * .3, dy = (Math.floor(i / 5) - 2) * .3;
        const color = sample(pixels, width, height, sx + dx * radius, sy + dy * radius);
        if (!color) { roughness = Infinity; break; }
        for (let c = 0; c < 3; c++) roughness += (color[c] - planeAt(donor, c, dx, dy)) ** 2;
        samples++;
      }
      score += roughness / Math.max(1, samples) * .7 + distance * .15;
      if (score < bestScore) { bestScore = score; best = { x: sx, y: sy, plane: donor }; }
    }
    if (!best) continue;
    const feather = clamp(spot.feather / 100) * .85, amount = clamp(spot.strength / 100), texture = clamp(spot.texture / 100);
    for (let py = Math.max(0, Math.ceil(y - radius)); py <= Math.min(height - 1, Math.floor(y + radius)); py++) {
      for (let px = Math.max(0, Math.ceil(x - radius)); px <= Math.min(width - 1, Math.floor(x + radius)); px++) {
        const dx = (px - x) / radius, dy = (py - y) / radius, distance = Math.hypot(dx, dy);
        if (distance >= 1) continue;
        const i = (py * width + px) * 4;
        if (pixels[i + 3] < 250) continue;
        // Use whole-pixel donor offsets so high-frequency pores are copied,
        // rather than softened by a second bilinear resampling pass.
        const donor = sample(pixels, width, height, Math.round(best.x + px - x), Math.round(best.y + py - y)); if (!donor) continue;
        const blend = amount * (feather ? 1 - smooth((distance - 1 + feather) / feather) : 1);
        for (let c = 0; c < 3; c++) {
          const detail = donor[c] - planeAt(best.plane, c, dx, dy);
          const healed = clamp(planeAt(target, c, dx, dy) + detail * texture, 0, 255);
          out[i + c] += (healed - out[i + c]) * blend;
        }
      }
    }
  }
  return out;
}
