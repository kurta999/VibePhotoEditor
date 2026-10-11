import { readdir, realpath, stat, mkdir, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { scanDirectory, pathParts, writeEditedCopy } from '../folder-library.js';

const MAX_BYTES = 120 * 1024 * 1024;
function component(name) {
  if (typeof name !== 'string' || pathParts(name).length !== 1 || /[:<>"|?*]/.test(name)) throw new Error('Invalid file name.');
  return name;
}
function contains(root, target) {
  const relative = path.relative(root, target);
  return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`);
}
async function checked(root, target) {
  if (!contains(root, target) || !contains(root, await realpath(target))) throw new Error('This path is outside the selected folder.');
  return target;
}
// The same edited-copy logic is used in browsers and Electron. Exclusive file creation
// also prevents an existing copy from being replaced between the existence check and write.
function directoryHandle(root, directory) {
  return {
    kind: 'directory', name: path.basename(directory),
    async *values() {
      await checked(root, directory);
      for (const item of await readdir(directory, { withFileTypes: true })) {
        if (item.isDirectory()) yield directoryHandle(root, path.join(directory, item.name));
        else if (item.isFile()) yield { kind: 'file', name: item.name };
        // Symbolic links and junctions are deliberately not followed.
      }
    },
    async getDirectoryHandle(name, options = {}) {
      component(name); await checked(root, directory);
      const target = path.join(directory, name);
      if (options.create) await mkdir(target).catch(error => { if (error.code !== 'EEXIST') throw error; });
      await checked(root, target);
      if (!(await stat(target)).isDirectory()) throw new Error('The destination is not a folder.');
      return directoryHandle(root, target);
    },
    async getFileHandle(name, options = {}) {
      component(name); await checked(root, directory);
      const target = path.join(directory, name);
      if (!options.create) {
        try { await stat(target); }
        catch (error) { if (error.code === 'ENOENT') throw new DOMException('File not found', 'NotFoundError'); throw error; }
      }
      return { async createWritable() {
        await checked(root, directory);
        const file = await open(target, 'wx');
        return {
          async write(blob) { await file.writeFile(Buffer.from(await blob.arrayBuffer())); },
          async close() { await file.close(); },
          async abort() { await file.close(); await unlink(target); },
        };
      } };
    },
  };
}

export class FolderAccess {
  #folders = new Map();
  async select(directory, outputOnly = false) {
    const root = await realpath(directory);
    if (!(await stat(root)).isDirectory()) throw new Error('Choose a folder.');
    const entries = outputOnly ? [] : await scanDirectory(directoryHandle(root, root));
    const id = randomUUID(), images = entries.map(({ path, name }) => ({ path, name }));
    this.#folders.set(id, { root, images: new Set(images.map(image => image.path)) });
    return { id, name: path.basename(root), images };
  }
  #folder(id) {
    const folder = this.#folders.get(id);
    if (!folder) throw new Error('Open the folder again to grant access.');
    return folder;
  }
  async read(id, imagePath) {
    const folder = this.#folder(id);
    if (!folder.images.has(imagePath)) throw new Error('This image was not in the selected folder.');
    const parts = pathParts(imagePath); parts.forEach(component);
    const file = await checked(folder.root, path.join(folder.root, ...parts));
    const info = await stat(file);
    if (!info.isFile() || info.size > MAX_BYTES) throw new Error('Choose an image smaller than 120 MB.');
    const bytes = await readFile(file);
    if (bytes.length > MAX_BYTES) throw new Error('Choose an image smaller than 120 MB.');
    return new Uint8Array(bytes);
  }
  async save(id, imagePath, bytes, type) {
    const folder = this.#folder(id);
    if (typeof imagePath !== 'string' || imagePath.length > 32768) throw new Error('Invalid image path.');
    pathParts(imagePath).forEach(component);
    if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > MAX_BYTES) throw new Error('Invalid export data.');
    return writeEditedCopy(directoryHandle(folder.root, folder.root), imagePath, new Blob([bytes], { type }), type);
  }
}
