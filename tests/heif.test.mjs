import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeHeif, heifCodec } from '../heif-codec.js';

test('HEIF exports contain HEVC and round-trip dimensions and photo colors', async () => {
  // Odd dimensions catch encoders that silently round image size to even numbers.
  const width = 33, height = 25;
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([205, 72, 38, 255], i);
  const bytes = await encodeHeif(pixels, width, height);
  assert.equal(new TextDecoder().decode(bytes.slice(4, 8)), 'ftyp');
  assert.equal(new TextDecoder().decode(bytes.slice(8, 12)), 'heic');
  const result = (await heifCodec()).jsDecodeImage(bytes);
  assert.equal(result.err, '');
  assert.equal(result.data[0].width, width); assert.equal(result.data[0].height, height);
  for (let channel = 0; channel < 3; channel++) assert.ok(Math.abs(result.data[0].data[channel] - pixels[channel]) < 15);
});
test('HEIF rejects invalid buffers before entering the codec', async () => {
  await assert.rejects(encodeHeif(new Uint8Array(3), 1, 1), /dimensions/);
  await assert.rejects(encodeHeif(new Uint8Array(0), 0, 10), /dimensions/);
});
