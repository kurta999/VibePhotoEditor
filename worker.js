import { processPixels } from './engine.js';
self.onmessage = ({ data }) => {
  try {
    const output = processPixels(new Uint8ClampedArray(data.pixels), data.width, data.height, data.params);
    self.postMessage({ id: data.id, pixels: output.buffer, width: data.width, height: data.height }, [output.buffer]);
  } catch (error) { self.postMessage({ id: data.id, error: error.message }); }
};
