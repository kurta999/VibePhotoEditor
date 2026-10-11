import test from 'node:test';
import assert from 'node:assert/strict';
import { healPixels, freshHealing } from '../healing.js';
const width = 180, height = 160;
function skin() {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4, texture = Math.sin(x * 1.7 + y * 2.1) * 3;
    [185, 132, 103].forEach((base, c) => data[i + c] = base + x * .05 + y * .04 + texture);
    data[i + 3] = 255;
  }
  return data;
}
const spot = overrides => ({ x: .5, y: .5, radius: .065, strength: 100, feather: 60, texture: 100, ...overrides });
const index = (x, y) => (y * width + x) * 4;
function blemish(data) {
  for (let y = 76; y <= 84; y++) for (let x = 86; x <= 94; x++) if (Math.hypot(x - 90, y - 80) <= 4) {
    data[index(x, y)] = 215; data[index(x, y) + 1] = 70; data[index(x, y) + 2] = 65;
  }
  return data;
}
test('healing removes a colored blemish, retains nearby skin texture, and changes only the repair circle', () => {
  const clean = skin(), marked = blemish(new Uint8ClampedArray(clean)), output = healPixels(marked, width, height, [spot()]);
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(output[index(90, 80) + c] - clean[index(90, 80) + c]) < 8);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (Math.hypot(x - 90, y - 80) >= .065 * height) assert.deepEqual(output.slice(index(x, y), index(x, y) + 4), marked.slice(index(x, y), index(x, y) + 4));
  const values = [88, 89, 90, 91, 92].map(x => output[index(x, 80)]);
  assert.ok(Math.max(...values) - Math.min(...values) >= 3, 'donor texture should remain visible');
});
test('zero strength and empty/invalid repairs preserve every pixel and alpha', () => {
  const pixels = skin(); pixels[index(90, 80) + 3] = 40;
  assert.deepEqual(healPixels(pixels, width, height, []), pixels);
  assert.deepEqual(healPixels(pixels, width, height, [spot({ strength: 0 }), spot({ x: NaN })]), pixels);
  const output = healPixels(pixels, width, height, [spot()]);
  for (let i = 3; i < pixels.length; i += 4) assert.equal(output[i], pixels[i]);
  assert.deepEqual(output.slice(index(90, 80), index(90, 80) + 4), pixels.slice(index(90, 80), index(90, 80) + 4));
  assert.equal(freshHealing().spots.length, 0);
});
test('strength blends repairs, and texture retention controls detail without recovering the blemish', () => {
  const marked = blemish(skin()), full = healPixels(marked, width, height, [spot()]), half = healPixels(marked, width, height, [spot({ strength: 50 })]);
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(half[index(90, 80) + c] - (full[index(90, 80) + c] + marked[index(90, 80) + c]) / 2) <= 1);
  const smooth = healPixels(marked, width, height, [spot({ texture: 0 })]);
  assert.ok(Math.abs(smooth[index(89, 80)] - smooth[index(90, 80)]) <= 1);
  assert.ok(smooth[index(90, 80) + 1] > 120);
});
test('healing is deterministic and handles edges, tiny images, and fully transparent photos', () => {
  const marked = blemish(skin());
  assert.deepEqual(healPixels(marked, width, height, [spot(), spot({ x: .35 })]), healPixels(marked, width, height, [spot(), spot({ x: .35 })]));
  const tiny = new Uint8ClampedArray([10, 20, 30, 0]); assert.deepEqual(healPixels(tiny, 1, 1, [spot()]), tiny);
  const transparent = new Uint8ClampedArray(width * height * 4); assert.deepEqual(healPixels(transparent, width, height, [spot()]), transparent);
  assert.deepEqual(healPixels(marked, width, height, [spot({ x: 0, y: 0 })]), marked);
});
