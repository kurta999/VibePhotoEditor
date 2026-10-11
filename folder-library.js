const IMAGE_NAME = /\.(jpe?g|png|hei[cf])$/i;
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export const MAX_FOLDER_IMAGES = 10000;

export function pathParts(path) {
  const parts = path.split('/');
  if (!parts.length || parts.some(part => !part || part === '.' || part === '..' || /[\\\x00-\x1f]/.test(part))) throw new Error('Invalid image path.');
  return parts;
}
export function isFolderImage(path) {
  const parts = pathParts(path);
  return IMAGE_NAME.test(parts.at(-1)) && !parts.slice(0, -1).some(part => part.toLowerCase() === 'edited');
}
export function sortImages(entries) {
  return entries.sort((a, b) => collator.compare(a.name, b.name) || collator.compare(a.path, b.path) || a.path.localeCompare(b.path));
}
export function filterImages(entries, query) {
  const text = query.trim().toLocaleLowerCase();
  return entries.filter(entry => entry.path.toLocaleLowerCase().includes(text));
}
export function adjacentImage(entries, currentPath, direction) {
  if (!entries.length) return null;
  const index = entries.findIndex(entry => entry.path === currentPath);
  if (index < 0) return direction < 0 ? entries.at(-1) : entries[0];
  return entries[index + direction] || null;
}
export async function scanDirectory(root) {
  const entries = [];
  async function walk(directory, prefix = '', depth = 0) {
    if (depth > 100) throw new Error('This folder has too many nested subfolders. Open a smaller folder.');
    for await (const handle of directory.values()) {
      const path = prefix + handle.name;
      if (handle.kind === 'directory') {
        if (handle.name.toLowerCase() !== 'edited') await walk(handle, `${path}/`, depth + 1);
      } else if (isFolderImage(path)) {
        entries.push({ path, name: handle.name, handle });
        if (entries.length > MAX_FOLDER_IMAGES) throw new Error('This folder has more than 10,000 images. Open a smaller folder.');
      }
    }
  }
  await walk(root);
  return sortImages(entries);
}
export function imagesFromFiles(files) {
  const entries = [], seen = new Set();
  for (const file of files) {
    const relative = file.webkitRelativePath || file.name;
    const path = file.webkitRelativePath ? relative.split('/').slice(1).join('/') : relative;
    if (!isFolderImage(path) || seen.has(path)) continue;
    entries.push({ path, name: file.name, file }); seen.add(path);
    if (entries.length > MAX_FOLDER_IMAGES) throw new Error('This folder has more than 10,000 images. Open a smaller folder.');
  }
  return sortImages(entries);
}
export async function allowFolderWrites(root) {
  const options = { mode: 'readwrite' };
  if (await root.queryPermission(options) === 'granted') return;
  if (await root.requestPermission(options) !== 'granted') throw new Error('Folder write access was not granted. Allow access to save into edited, or use download export.');
}
export function exportExtension(type) {
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heif': 'heif' }[type];
  if (!extension) throw new Error('Unsupported export format.');
  return extension;
}
// Always create a new copy. Source folders and existing edited files are never replaced.
export async function writeEditedCopy(root, sourcePath, blob, type) {
  const parts = pathParts(sourcePath), name = parts.pop(), extension = exportExtension(type);
  const base = name.replace(/\.[^.]+$/, '').replace(/[<>:"|?*\x00-\x1f]/g, '-').slice(0, 100) || 'photo';
  let directory = await root.getDirectoryHandle('edited', { create: true });
  for (const part of parts) directory = await directory.getDirectoryHandle(part, { create: true });
  for (let number = 1; number <= 10000; number++) {
    const filename = `${base}-edited${number === 1 ? '' : `-${number}`}.${extension}`;
    try { await directory.getFileHandle(filename); continue; }
    catch (error) { if (error.name !== 'NotFoundError') throw error; }
    const file = await directory.getFileHandle(filename, { create: true });
    const stream = await file.createWritable();
    try { await stream.write(blob); await stream.close(); }
    catch (error) { try { await stream.abort(); } catch { /* Preserve the original write failure. */ } throw error; }
    return ['edited', ...parts, filename].join('/');
  }
  throw new Error('There are too many edited copies with this name. Choose another output folder.');
}
