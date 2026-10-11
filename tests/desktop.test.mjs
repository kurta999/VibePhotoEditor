import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { FolderAccess } from '../desktop/folder-access.mjs';

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'vibe-desktop-test-'));
  t.after(async () => {
    const resolved = path.resolve(directory);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('vibe-desktop-test-')) throw new Error('Unsafe test cleanup');
    await rm(resolved, { recursive: true, force: true });
  });
  await mkdir(path.join(directory, 'source')); await mkdir(path.join(directory, 'outside'));
  return { directory, source: path.join(directory, 'source'), outside: path.join(directory, 'outside') };
}
test('desktop folder bridge reads only enumerated images and saves fresh nested copies', async t => {
  const { source } = await fixture(t);
  await mkdir(path.join(source, 'portraits')); await mkdir(path.join(source, 'edited'));
  await writeFile(path.join(source, 'portraits/skin.png'), 'original');
  await writeFile(path.join(source, 'notes.txt'), 'private notes'); await writeFile(path.join(source, 'edited/old.png'), 'old');
  const access = new FolderAccess(), folder = await access.select(source);
  assert.deepEqual(folder.images, [{ path: 'portraits/skin.png', name: 'skin.png' }]);
  assert.equal(Buffer.from(await access.read(folder.id, 'portraits/skin.png')).toString(), 'original');
  await assert.rejects(access.read(folder.id, 'notes.txt'), /not in the selected/);
  await assert.rejects(access.read('unknown', 'portraits/skin.png'), /grant access/);
  const bytes = new Uint8Array(Buffer.from('edited bytes'));
  assert.equal(await access.save(folder.id, 'portraits/skin.png', bytes, 'image/png'), 'edited/portraits/skin-edited.png');
  assert.equal(await access.save(folder.id, 'portraits/skin.png', bytes, 'image/png'), 'edited/portraits/skin-edited-2.png');
  assert.equal(await readFile(path.join(source, 'portraits/skin.png'), 'utf8'), 'original');
  assert.equal(await readFile(path.join(source, 'edited/portraits/skin-edited.png'), 'utf8'), 'edited bytes');
});
test('desktop output-folder access cannot read files or escape its selected destination', async t => {
  const { source } = await fixture(t);
  await writeFile(path.join(source, 'secret.png'), 'secret');
  const access = new FolderAccess(), folder = await access.select(source, true), bytes = new Uint8Array([1, 2]);
  await assert.rejects(access.read(folder.id, 'secret.png'), /not in the selected/);
  for (const invalid of ['../outside.png', 'sub/../../outside.png', 'C:/outside.png', 'sub\\outside.png']) await assert.rejects(access.save(folder.id, invalid, bytes, 'image/png'), /Invalid/);
  await assert.rejects(access.save(folder.id, 'photo.png', bytes, 'text/html'), /Unsupported/);
  await assert.rejects(access.save(folder.id, 'photo.png', new Uint8Array(), 'image/png'), /Invalid export/);
  assert.equal(await access.save(folder.id, 'from-another-folder.png', bytes, 'image/png'), 'edited/from-another-folder-edited.png');
});
test('desktop bridge skips junctions and refuses output junctions outside the chosen folder', async t => {
  const { source, outside } = await fixture(t);
  await writeFile(path.join(outside, 'outside.png'), 'outside original');
  await symlink(outside, path.join(source, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const access = new FolderAccess(), folder = await access.select(source);
  assert.deepEqual(folder.images, []);
  await symlink(outside, path.join(source, 'edited'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(access.save(folder.id, 'outside.png', new Uint8Array([7]), 'image/png'), /outside the selected/);
  assert.equal(await readFile(path.join(outside, 'outside.png'), 'utf8'), 'outside original');
});
