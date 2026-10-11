import { processPixels } from './engine.js';
import { healPixels } from './healing.js';
self.onmessage = ({ data }) => {
  try {
    const pixels = new Uint8ClampedArray(data.pixels);
    const output = data.operation === 'heal' ? healPixels(pixels, data.width, data.height, data.params.spots) : processPixels(pixels, data.width, data.height, data.params);
    self.postMessage({ id: data.id, pixels: output.buffer, width: data.width, height: data.height }, [output.buffer]);
  } catch (error) { self.postMessage({ id: data.id, error: error.message }); }
};
