import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export async function runSmoke(window, folders, appRoot) {
  const directory = await mkdtemp(path.join(tmpdir(), 'vibe-desktop-smoke-'));
  try {
    const original = await readFile(path.join(appRoot, 'assets', 'icon.png'));
    await writeFile(path.join(directory, 'sample.png'), original);
    const folder = await folders.select(directory);
    const result = await window.webContents.executeJavaScript(`(async () => {
      const start = Date.now();
      while (!document.querySelector('#healing-panel') || document.querySelector('#preview')?.width <= 300) {
        if (Date.now() - start > 20000) throw new Error('Editor did not initialize');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const { encodeHeif, heifCodec } = await import('./heif-codec.js');
      const pixels = new Uint8Array(16 * 16 * 4).fill(150);
      for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
      const encoded = await encodeHeif(pixels, 16, 16);
      const codec = await heifCodec(); const decoded = codec.jsDecodeImage(encoded);
      const { heicTo } = await import('./vendor/heic-to.js');
      const bitmap = await heicTo({ blob: new Blob([encoded], { type: 'image/heif' }), type: 'bitmap' });
      const heicImport = bitmap.width === 16 && bitmap.height === 16; bitmap.close();
      const worker = new Worker('./worker.js', { type: 'module' });
      const workerOK = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Pixel worker timed out')), 10000);
        worker.onmessage = ({ data }) => { clearTimeout(timer); data.error ? reject(new Error(data.error)) : resolve(true); };
        worker.onerror = reject;
        worker.postMessage({ id: 1, pixels: new Uint8ClampedArray([10,20,30,255]), width: 1, height: 1, params: { spots: [] }, operation: 'heal' });
      });
      worker.terminate();
      const bytes = await window.vibeDesktop.readImage(${JSON.stringify(folder.id)}, 'sample.png');
      const saved = await window.vibeDesktop.saveEdited(${JSON.stringify(folder.id)}, 'sample.png', bytes, 'image/png');
      return { title: document.title, bridge: !!window.vibeDesktop, nodeIsolated: typeof require === 'undefined' && typeof process === 'undefined', magicEraser: !!document.querySelector('#healing-panel'), heif: encoded.length > 0 && !decoded.err && decoded.data[0].width === 16, heicImport, worker: workerOK, saved };
    })()`);
    if (result.saved !== 'edited/sample-edited.png') throw new Error('Unexpected desktop output path.');
    const saved = await readFile(path.join(directory, result.saved));
    const source = await readFile(path.join(directory, 'sample.png'));
    result.nativeFolderSave = saved.equals(original) && source.equals(original);
    delete result.saved;
    return result;
  } finally {
    const resolved = path.resolve(directory);
    if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith('vibe-desktop-smoke-')) throw new Error('Unsafe smoke fixture cleanup path.');
    await rm(resolved, { recursive: true, force: true });
  }
}
