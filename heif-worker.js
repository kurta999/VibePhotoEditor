import { encodeHeif } from './heif-codec.js';
self.onmessage = async ({ data }) => {
  try {
    const bytes = await encodeHeif(new Uint8Array(data.pixels), data.width, data.height);
    self.postMessage({ bytes: bytes.buffer }, [bytes.buffer]);
  } catch (error) { self.postMessage({ error: error.message || 'HEIF export failed.' }); }
};
