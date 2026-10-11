import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, processPixels, cropRect, effectiveParams } from '../engine.js';
import { freshColor, curveLut, rangeWeights, applyColor, frameToSource, sourceToFrame, straightenScale, rasterMask, customOutputSize } from '../advanced.js';

const geometry = (rotation = 0, straighten = 0, ratio = 'original') => {
  const width = rotation % 180 ? 100 : 160, height = rotation % 180 ? 160 : 100;
  return { sourceWidth: 160, sourceHeight: 100, width, height, rect: cropRect(width, height, ratio), rotation, straighten };
};
const radial = overrides => ({ type: 'radial', enabled: true, invert: false, x: .5, y: .5, radius: .3, feather: 50, adjustments: { exposure: 50 }, ...overrides });
const nearly = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const sample = (alpha, width, height, x, y) => alpha[Math.min(height - 1, Math.max(0, Math.floor(y * height))) * width + Math.min(width - 1, Math.max(0, Math.floor(x * width)))];

test('neutral curves/HSL and disabled masks preserve pixels including alpha', () => {
  const pixels = new Uint8ClampedArray([19, 72, 215, 34, 150, 150, 150, 0]);
  assert.deepEqual(processPixels(pixels, 2, 1, { ...DEFAULTS, color: freshColor(), masks: [radial({ enabled: false })], geometry: geometry() }), pixels);
  const state = { preset: null, strength: 0, adjustments: DEFAULTS, color: freshColor(), masks: [radial()] };
  assert.equal(effectiveParams(state).color, state.color); assert.equal(effectiveParams(state).masks, state.masks);
});
test('curves pass through every anchor and preserve monotonicity without overshoot', () => {
  const points = [[0, 10], [32, 20], [127, 170], [222, 245], [255, 250]], lut = curveLut(points);
  for (const [x, y] of points) nearly(lut[x], y, .0001);
  for (let i = 0; i < lut.length; i++) { assert.ok(lut[i] >= 10 && lut[i] <= 250); if (i) assert.ok(lut[i] >= lut[i - 1]); }
  assert.throws(() => curveLut([[0, 0], [0, 20]]), /distinct/);
});
test('master and RGB channel curves compose and do not change alpha', () => {
  const color = freshColor(); color.curves.rgb = [[0, 0], [128, 160], [255, 255]]; color.curves.red = [[0, 0], [160, 210], [255, 255]];
  const result = applyColor(new Uint8ClampedArray([128, 128, 128, 80]), color);
  assert.deepEqual([...result], [210, 160, 160, 80]);
});
test('HSL targets chosen hue ranges and preserves neutral grays', () => {
  const color = freshColor(); color.hsl.red.hue = 60;
  const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 127, 128, 128, 128, 20]);
  const result = applyColor(pixels, color);
  assert.deepEqual([...result], [255, 255, 0, 255, 0, 0, 255, 127, 128, 128, 128, 20]);
  color.hsl.red = { hue: 0, saturation: -100, luminance: 0 };
  assert.deepEqual([...applyColor(new Uint8ClampedArray([255, 0, 0, 17]), color)], [128, 128, 128, 17]);
});
test('HSL hue wrap blends smoothly and every range can adjust luminance', () => {
  const before = Object.fromEntries(rangeWeights(359.9)), after = Object.fromEntries(rangeWeights(.1));
  nearly(before.red, after.red, .001);
  const colors = [[255, 0, 0], [255, 128, 0], [255, 255, 0], [0, 255, 0], [0, 255, 255], [0, 0, 255], [128, 0, 255], [255, 0, 255]];
  const color = freshColor(); for (const key of Object.keys(color.hsl)) color.hsl[key].luminance = 50;
  for (const rgb of colors) {
    const result = applyColor(new Uint8ClampedArray([...rgb, 255]), color);
    assert.ok(result[0] + result[1] + result[2] > rgb[0] + rgb[1] + rgb[2]);
  }
});
test('mask coordinate mapping round-trips across quarter turns, straightening, and crops', () => {
  for (const rotation of [0, 90, 180, 270]) for (const angle of [-15, 0, 15]) for (const ratio of ['original', '4:5', '1.91:1']) {
    const g = geometry(rotation, angle, ratio);
    for (const [x, y] of [[.2, .3], [.5, .5], [.8, .7]]) { const frame = sourceToFrame(x, y, g), source = frameToSource(frame.x, frame.y, g); nearly(source.x, x); nearly(source.y, y); }
  }
});
test('straightening removes empty corners for portrait, landscape, and extreme ratios', () => {
  for (const [sw, sh] of [[160, 100], [100, 160], [1000, 40]]) for (const degrees of [-15, -5, 0, 5, 15]) {
    const g = { sourceWidth: sw, sourceHeight: sh, width: sw, height: sh, rect: { x: 0, y: 0, width: sw, height: sh }, rotation: 0, straighten: degrees };
    assert.ok(straightenScale(sw, sh, degrees) >= 1);
    for (const [x, y] of [[0, 0], [0, 1], [1, 0], [1, 1]]) { const p = frameToSource(x, y, g); assert.ok(p.x >= -1e-10 && p.x <= 1 + 1e-10 && p.y >= -1e-10 && p.y <= 1 + 1e-10); }
  }
});
test('radial masks feather, invert, and preserve pixels outside the selected area', () => {
  const g = geometry(), m = radial(), alpha = rasterMask(m, 160, 100, g);
  nearly(sample(alpha, 160, 100, .5, .5), 1); nearly(alpha[0], 0);
  const feather = sample(alpha, 160, 100, .64, .5); assert.ok(feather > 0 && feather < 1);
  const inverse = rasterMask({ ...m, invert: true }, 160, 100, g);
  for (let i = 0; i < alpha.length; i++) nearly(alpha[i] + inverse[i], 1, 1e-6);
  const pixels = new Uint8ClampedArray(160 * 100 * 4); for (let i = 0; i < pixels.length; i += 4) pixels.set([80, 100, 120, 71], i);
  const result = processPixels(pixels, 160, 100, { ...DEFAULTS, geometry: g, masks: [m] });
  assert.deepEqual([...result.slice(0, 4)], [80, 100, 120, 71]); assert.ok(result[(50 * 160 + 80) * 4] > 80); assert.equal(result[(50 * 160 + 80) * 4 + 3], 71);
});
test('linear masks have full and zero effect at their two edges', () => {
  const alpha = rasterMask({ type: 'linear', start: [.5, .2], end: [.5, .8] }, 160, 100, geometry());
  nearly(sample(alpha, 160, 100, .5, .1), 1); nearly(sample(alpha, 160, 100, .5, .9), 0);
  nearly(sample(alpha, 160, 100, .5, .5), .5, .02);
  assert.ok(rasterMask({ type: 'linear', start: [.5, .5], end: [.5, .5] }, 160, 100, geometry()).every(value => value === 0));
});
test('brush add/erase strokes form continuous paths and survive transforms', () => {
  const stroke = { points: [[.2, .5], [.8, .5]], radius: .1, feather: 0 };
  const m = { type: 'brush', strokes: [stroke, { points: [[.5, .5]], radius: .04, feather: 0, erase: true }] };
  const alpha = rasterMask(m, 160, 100, geometry());
  nearly(sample(alpha, 160, 100, .3, .5), 1); nearly(sample(alpha, 160, 100, .5, .5), 0); nearly(sample(alpha, 160, 100, .5, .8), 0);
  const g = geometry(90, 8, '4:5'), p = sourceToFrame(.3, .5, g), transformed = rasterMask(m, 160, 200, g);
  nearly(sample(transformed, 160, 200, p.x, p.y), 1);
});
test('mask positions and feather are consistent between preview and export resolutions', () => {
  const m = radial(), g = geometry(270, -7, '4:5'), p = sourceToFrame(.64, .5, g);
  const preview = rasterMask(m, 160, 200, g), output = rasterMask(m, 320, 400, g);
  nearly(sample(preview, 160, 200, p.x, p.y), sample(output, 320, 400, p.x, p.y), .03);
});
test('custom export accepts linked dimensions and rejects stretching, upscaling, and invalid sizes', () => {
  assert.deepEqual(customOutputSize(2000, 1500, 800, 600), { width: 800, height: 600 });
  assert.deepEqual(customOutputSize(1110, 825, 800, 595), { width: 800, height: 595 });
  assert.throws(() => customOutputSize(2000, 1500, 1000, 1000), /aspect ratio/);
  assert.throws(() => customOutputSize(2000, 1500, 4000, 3000), /exceed/);
  for (const invalid of [0, -1, NaN, 3.5, 8193]) assert.throws(() => customOutputSize(2000, 1500, invalid, 600), /whole-number/);
  assert.throws(() => customOutputSize(8192, 8192, 5000, 5000), /megapixels/);
});
