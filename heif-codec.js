import './vendor/elheif-wasm.js';

let ready;
export function heifCodec() {
  if (!ready) ready = new Promise((resolve, reject) => {
    const codec = { onRuntimeInitialized: () => resolve(codec), onAbort: reason => reject(new Error(String(reason))) };
    try { globalThis.__init__ELHEIF_MODULE(codec); } catch (error) { reject(error); }
  });
  return ready;
}

export async function encodeHeif(pixels, width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 16000000 || pixels.length !== width * height * 4) throw new Error('Invalid HEIF image dimensions.');
  const codec = await heifCodec();
  const result = codec.jsEncodeImage(new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength), width, height);
  if (result.err || !result.data?.length) throw new Error(result.err || 'HEIF encoding failed.');
  // Copy out of the codec heap before calling it again or transferring the result.
  return new Uint8Array(result.data);
}
