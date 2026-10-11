import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, stat, readFile, writeFile, access, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { scanDirectory, imagesFromFiles, filterImages, adjacentImage, allowFolderWrites, writeEditedCopy } from '../folder-library.js';

function directoryHandle(directory) {
  return {
    kind: 'directory', name: path.basename(directory), queryPermission: async () => 'granted',
    async *values() {
      for (const item of await readdir(directory, { withFileTypes: true })) yield item.isDirectory() ? directoryHandle(path.join(directory, item.name)) : { kind: 'file', name: item.name };
    },
    async getDirectoryHandle(name, options = {}) {
      const target = path.join(directory, name); if (options.create) await mkdir(target, { recursive: true }); await stat(target); return directoryHandle(target);
    },
    async getFileHandle(name, options = {}) {
      const target = path.join(directory, name);
      if (!options.create) try { await access(target); } catch { throw new DOMException('Not found', 'NotFoundError'); }
      return { async createWritable() {
        let bytes; return { async write(blob) { bytes = Buffer.from(await blob.arrayBuffer()); }, async close() { await writeFile(target, bytes); }, async abort() {} };
      } };
    },
  };
}
async function fixture(t) {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'vibe-folder-test-'));
  t.after(async () => {
    const resolved = path.resolve(temp);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('vibe-folder-test-')) throw new Error('Unsafe test cleanup path');
    await rm(resolved, { recursive: true, force: true });
  });
  return temp;
}
test('folder scan finds supported formats recursively, naturally sorts names, and excludes edited folders', async t => {
  const root = await fixture(t);
  await mkdir(path.join(root, 'portrait')); await mkdir(path.join(root, 'portrait', 'EDITED')); await mkdir(path.join(root, 'edited'));
  for (const name of ['photo10.JPG', 'photo2.png', 'portrait/skin.heic', 'portrait/frame.HEIF', 'notes.txt', 'edited/out.jpg', 'portrait/EDITED/out.png']) await writeFile(path.join(root, name), 'fixture');
  const entries = await scanDirectory(directoryHandle(root));
  assert.deepEqual(entries.map(entry => entry.path), ['portrait/frame.HEIF', 'photo2.png', 'photo10.JPG', 'portrait/skin.heic']);
  assert.equal(filterImages(entries, ' PORTRAIT ').length, 2);
  assert.equal(adjacentImage(entries, 'photo2.png', 1).name, 'photo10.JPG');
  assert.equal(adjacentImage(entries, entries[0].path, -1), null);
  assert.equal(adjacentImage(filterImages(entries, 'skin'), 'photo2.png', 1).name, 'skin.heic');
  assert.equal(adjacentImage([], '', 1), null);
});
test('directory input preserves relative names and filters unsupported files and prior output', () => {
  const files = ['Library/a.jpg', 'Library/sub/a.jpg', 'Library/edited/a.jpg', 'Library/no.txt'].map(webkitRelativePath => ({ name: webkitRelativePath.split('/').at(-1), webkitRelativePath }));
  const entries = imagesFromFiles([...files, files[0]]);
  assert.deepEqual(entries.map(entry => entry.path), ['a.jpg', 'sub/a.jpg']);
});
test('Save writes real bytes to edited with nested paths and numbered copies, preserving originals', async t => {
  const root = await fixture(t); await mkdir(path.join(root, 'sub')); await writeFile(path.join(root, 'sub', 'portrait.png'), 'original');
  const handle = directoryHandle(root), blob = new Blob(['encoded photo'], { type: 'image/png' });
  assert.equal(await writeEditedCopy(handle, 'sub/portrait.png', blob, 'image/png'), 'edited/sub/portrait-edited.png');
  assert.equal(await writeEditedCopy(handle, 'sub/portrait.jpg', new Blob(['new edit']), 'image/png'), 'edited/sub/portrait-edited-2.png');
  assert.equal(await readFile(path.join(root, 'sub', 'portrait.png'), 'utf8'), 'original');
  assert.equal(await readFile(path.join(root, 'edited/sub/portrait-edited.png'), 'utf8'), 'encoded photo');
  assert.equal(await readFile(path.join(root, 'edited/sub/portrait-edited-2.png'), 'utf8'), 'new edit');
  await assert.rejects(writeEditedCopy(handle, '../outside.png', blob, 'image/png'), /Invalid image path/);
  await assert.rejects(writeEditedCopy(handle, 'sub\\outside.png', blob, 'image/png'), /Invalid image path/);
});
test('write permissions are requested only when needed and denied access is explicit', async () => {
  let requests = 0;
  const handle = { queryPermission: async () => 'granted', requestPermission: async () => { requests++; return 'granted'; } };
  await allowFolderWrites(handle); assert.equal(requests, 0);
  handle.queryPermission = async () => 'prompt'; await allowFolderWrites(handle); assert.equal(requests, 1);
  handle.requestPermission = async () => 'denied'; await assert.rejects(allowFolderWrites(handle), /not granted/);
});
test('failed writes abort the stream, report failure, and never attempt a success close', async () => {
  let aborted = false, closed = false;
  const output = { getFileHandle: async (name, options) => {
    if (!options?.create) throw new DOMException('Missing', 'NotFoundError');
    return { createWritable: async () => ({ write: async () => { throw new Error('Disk full'); }, close: async () => { closed = true; }, abort: async () => { aborted = true; } }) };
  } };
  const root = { getDirectoryHandle: async () => output };
  await assert.rejects(writeEditedCopy(root, 'photo.png', new Blob(['x']), 'image/png'), /Disk full/);
  assert.equal(aborted, true); assert.equal(closed, false);
});
