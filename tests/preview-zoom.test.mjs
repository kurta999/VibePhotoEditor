import test from 'node:test';
import assert from 'node:assert/strict';
import { viewGeometry } from '../preview-zoom.js';

test('fit contains wide and tall photos and centers the image', () => {
  for (const [width, height] of [[3000, 1000], [1000, 3000]]) {
    const view = viewGeometry(width, height, 600, 400, 'fit', 100, -100);
    assert.ok(view.width <= 600 && view.height <= 400);
    assert.equal(view.x, 0); assert.equal(view.y, 0);
  }
});
test('100 percent uses image pixels and panning cannot lose the image', () => {
  const view = viewGeometry(1200, 800, 600, 400, 1, 10000, -10000);
  assert.equal(view.width, 1200); assert.equal(view.height, 800);
  assert.equal(view.x, 300); assert.equal(view.y, -200);
  const small = viewGeometry(200, 100, 600, 400, 1, 100, 100);
  assert.equal(small.x, 0); assert.equal(small.y, 0);
});
