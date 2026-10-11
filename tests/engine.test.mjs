import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, PRESETS, GROUPS, effectiveParams, processPixels, cropRect, outputSize } from '../engine.js';
import { CAMERAS } from '../cameras.js';
const pixel = [42, 100, 180, 128, 240, 250, 200, 255, 0, 0, 0, 0, 100, 100, 100, 255];
test('neutral adjustments preserve every channel, including transparency', () => {
  const original = new Uint8ClampedArray(pixel);
  assert.deepEqual(processPixels(original, 2, 2, DEFAULTS), original);
  assert.deepEqual(original, new Uint8ClampedArray(pixel), 'input is not mutated');
});
test('brightness, highlight recovery, and shadow lifting affect the intended tones', () => {
  const source = new Uint8ClampedArray([20, 20, 20, 255, 220, 220, 220, 255]);
  assert.ok(processPixels(source, 2, 1, { ...DEFAULTS, exposure: 30 })[0] > 20);
  const shadows = processPixels(source, 2, 1, { ...DEFAULTS, shadows: 50 });
  assert.ok(shadows[0] - 20 > shadows[4] - 220);
  const highlights = processPixels(source, 2, 1, { ...DEFAULTS, highlights: -50 });
  assert.ok(220 - highlights[4] > 20 - highlights[0]);
});
test('zero saturation and the monochrome look create neutral RGB', () => {
  for (const params of [{ ...DEFAULTS, saturation: -100 }, { ...DEFAULTS, mono: 1 }]) {
    const out = processPixels(new Uint8ClampedArray(pixel), 2, 2, params);
    for (let i = 0; i < out.length; i += 4) { assert.equal(out[i], out[i + 1]); assert.equal(out[i], out[i + 2]); }
  }
});
test('preset strength and manual offsets compose without exceeding slider bounds', () => {
  const state = { preset: 'alpine', strength: 0, adjustments: { ...DEFAULTS } };
  assert.equal(effectiveParams(state).contrast, 0);
  state.strength = 100;
  assert.equal(effectiveParams(state).contrast, 17);
  state.adjustments.contrast = 100;
  state.adjustments.sharpen = -100;
  assert.equal(effectiveParams(state).contrast, 100);
  assert.equal(effectiveParams(state).sharpen, 0);
});
test('all camera and creative presets produce a real image change', () => {
  const source = new Uint8ClampedArray(pixel);
  for (const preset of PRESETS) {
    const params = effectiveParams({ preset: preset.id, strength: 80, adjustments: DEFAULTS });
    assert.notDeepEqual(processPixels(source, 2, 2, params), source, preset.id);
  }
});
test('sharpening preserves flat surfaces and transparency at image boundaries', () => {
  const flat = new Uint8ClampedArray(12 * 9 * 4);
  for (let i = 0; i < flat.length; i += 4) flat.set([100, 100, 100, 123], i);
  assert.deepEqual(processPixels(flat, 12, 9, { ...DEFAULTS, clarity: 100, sharpen: 100 }), flat);
});
test('grain is deterministic and effects preserve the alpha channel', () => {
  const params = { ...DEFAULTS, grain: 60, vignette: 30, softness: 80, glow: 50 };
  const a = processPixels(new Uint8ClampedArray(pixel), 2, 2, params);
  const b = processPixels(new Uint8ClampedArray(pixel), 2, 2, params);
  assert.deepEqual(a, b);
  for (let i = 3; i < pixel.length; i += 4) assert.equal(a[i], pixel[i]);
});
test('each of the 16 adjustment controls changes image pixels', () => {
  const width = 20, height = 16;
  const source = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    source.set([20 + x * 10, 30 + y * 12, (x % 3 === 0 ? 210 : 50), 200], (y * width + x) * 4);
  }
  for (const [key] of GROUPS.flatMap(group => group.sliders)) {
    const out = processPixels(source, width, height, { ...DEFAULTS, [key]: 60 });
    assert.notDeepEqual(out, source, `${key} should visibly affect the image`);
    for (let i = 3; i < out.length; i += 4) assert.equal(out[i], 200, `${key} must preserve alpha`);
  }
});
test('15 named camera simulations produce distinct pixel results', () => {
  assert.equal(CAMERAS.length, 15);
  assert.equal(new Set(CAMERAS.map(c => c.id)).size, 15);
  assert.equal(new Set(CAMERAS.map(c => `${c.brand} ${c.model}`)).size, 15);
  const source = new Uint8ClampedArray(pixel);
  const results = new Set();
  for (const camera of CAMERAS) {
    const params = effectiveParams({ camera: camera.id, cameraStrength: 100, preset: null, strength: 0, adjustments: DEFAULTS });
    const output = processPixels(source, 2, 2, params);
    assert.notDeepEqual(output, source, camera.id);
    results.add(Array.from(output).join(','));
  }
  assert.equal(results.size, 15, 'each camera has a different output, not just a different label');
});
test('camera strength blends from neutral and stacks with a look and manual edits', () => {
  const camera = CAMERAS[0];
  const base = { camera: camera.id, cameraStrength: 0, preset: null, strength: 0, adjustments: { ...DEFAULTS } };
  assert.deepEqual(processPixels(new Uint8ClampedArray(pixel), 2, 2, effectiveParams(base)), new Uint8ClampedArray(pixel));
  base.cameraStrength = 50;
  assert.equal(effectiveParams(base).contrast, camera.params.contrast * .5);
  base.preset = 'alpine'; base.strength = 100; base.adjustments.contrast = 5;
  assert.equal(effectiveParams(base).contrast, camera.params.contrast * .5 + 17 + 5);
  base.camera = null;
  assert.equal(effectiveParams(base).contrast, 22, 'removing a camera retains the look and manual edits');
});
test('portrait crop moves across the full available source width', () => {
  const left = cropRect(4000, 3000, '4:5', 0, 50);
  const right = cropRect(4000, 3000, '4:5', 100, 50);
  assert.equal(left.width, 2400); assert.equal(left.height, 3000);
  assert.equal(left.x, 0); assert.equal(right.x, 1600);
});
test('square, story, wide, and original crops stay inside the source', () => {
  for (const ratio of ['1:1', '9:16', '1.91:1', 'original']) {
    for (const [width, height] of [[4000, 3000], [3000, 4000]]) {
      const rect = cropRect(width, height, ratio, 100, 100);
      assert.ok(rect.x >= 0 && rect.y >= 0);
      assert.ok(rect.x + rect.width <= width + .001 && rect.y + rect.height <= height + .001);
    }
  }
});
test('export sizing preserves ratio and never upscales smaller photos', () => {
  assert.deepEqual(outputSize(2400, 3000, 'instagram'), { width: 1080, height: 1350 });
  assert.deepEqual(outputSize(2160, 3840, 'instagram'), { width: 1080, height: 1920 });
  assert.deepEqual(outputSize(4000, 3000, '2048'), { width: 2048, height: 1536 });
  assert.deepEqual(outputSize(600, 800, 'instagram'), { width: 600, height: 800 });
  assert.deepEqual(outputSize(4000, 3000, 'full'), { width: 4000, height: 3000 });
});
