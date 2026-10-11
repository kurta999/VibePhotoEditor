import { scanDirectory, imagesFromFiles, filterImages, adjacentImage, allowFolderWrites, writeEditedCopy, exportExtension } from './folder-library.js';

const $ = selector => document.querySelector(selector);
export function setupFolder({ capture, load, encode, notify, lock, download }) {
  let root = null, name = '', entries = [], current = null, busy = false, records = new Map(), byPath = new Map();
  const desktop = window.vibeDesktop;
  const directAccess = !!desktop || typeof window.showDirectoryPicker === 'function';
  function desktopRoot(folder) {
    return { id: folder.id, name: folder.name, desktop: true, queryPermission: async () => 'granted' };
  }
  async function chooseDirectory(outputOnly = false) {
    if (!desktop) return window.showDirectoryPicker({ id: outputOnly ? 'vibe-output' : 'vibe-photos', mode: outputOnly ? 'readwrite' : 'read' });
    const folder = await desktop.chooseFolder(outputOnly);
    if (!folder) throw new DOMException('Folder selection canceled', 'AbortError');
    const root = desktopRoot(folder);
    root.images = folder.images.map(entry => ({ ...entry, handle: { async getFile() {
      const bytes = await desktop.readImage(folder.id, entry.path);
      return new File([bytes], entry.name);
    } } }));
    return root;
  }
  const panel = $('#folder-panel'), list = $('#folder-images');
  function filtered() { return filterImages(entries, $('#folder-search').value); }
  function status(entry) {
    const record = records.get(entry.path);
    if (record?.error) return 'Could not open';
    if (record?.saved === record?.fingerprint && record?.saved) return record.destination ? 'Saved' : 'Downloaded';
    if (record && record.fingerprint !== record.baseline) return 'Unsaved edits';
    return 'Ready';
  }
  function hasDrafts() { return entries.some(entry => status(entry) === 'Unsaved edits'); }
  function stash() {
    if (!current) return;
    const record = records.get(current.path);
    record.draft = capture(); record.fingerprint = JSON.stringify(record.draft.state);
  }
  function renderList() {
    const fragment = document.createDocumentFragment(), results = filtered();
    for (const entry of results) {
      const row = document.createElement('button'); row.type = 'button'; row.className = 'folder-image'; row.dataset.path = entry.path; row.title = entry.path;
      const filename = document.createElement('strong'); filename.textContent = entry.name;
      const path = document.createElement('small'); path.textContent = entry.path.includes('/') ? entry.path.slice(0, entry.path.lastIndexOf('/')) : 'Top-level folder';
      const badge = document.createElement('span'); badge.className = 'folder-image-status'; badge.textContent = status(entry);
      row.append(filename, path, badge); row.setAttribute('aria-current', current?.path === entry.path ? 'true' : 'false'); row.disabled = busy;
      row.addEventListener('click', () => select(entry)); fragment.append(row);
    }
    list.replaceChildren(fragment); $('#folder-empty').hidden = results.length !== 0;
    update();
  }
  function update() {
    const results = filtered(), index = results.findIndex(entry => entry.path === current?.path);
    $('#folder-name').textContent = name;
    $('#folder-count').textContent = `${results.length.toLocaleString()} of ${entries.length.toLocaleString()} images`;
    $('#folder-position').textContent = current ? index >= 0 ? `${index + 1} / ${results.length}` : 'Current photo is outside search results' : 'Select a photo';
    $('#folder-prev').disabled = busy || !adjacentImage(results, current?.path, -1);
    $('#folder-next').disabled = busy || !adjacentImage(results, current?.path, 1);
    $('#folder-save').disabled = busy || !current;
    $('#folder-save').textContent = busy ? 'Working…' : root ? 'Save to edited' : 'Save download';
    $('#folder-format').disabled = busy; $('#folder-close').disabled = busy; $('#folder-connect').disabled = busy;
    $('#folder-connect').hidden = !!root || !directAccess;
    $('#folder-save-hint').textContent = root ? `Save creates a new full-resolution copy in ${root.name}/edited. Existing copies are kept.` : 'Browsing only. Save downloads a copy. Direct folder saving needs a browser with folder access, such as desktop Chrome or Edge.';
    if (root) {
      if (!$('#folder-output').textContent.startsWith('Saved:')) $('#folder-output').textContent = `Destination: ${root.name}/edited`;
    } else if (!$('#folder-output').textContent.startsWith('Downloaded:')) $('#folder-output').textContent = 'Destination: browser downloads';
    for (const row of list.children) {
      row.disabled = busy; row.setAttribute('aria-current', row.dataset.path === current?.path ? 'true' : 'false');
      const entry = byPath.get(row.dataset.path);
      row.querySelector('.folder-image-status').textContent = status(entry);
    }
  }
  function setBusy(value) { busy = value; lock(value); update(); }
  async function select(entry) {
    if (busy || entry.path === current?.path) return;
    stash(); setBusy(true);
    try {
      const file = entry.handle ? await entry.handle.getFile() : entry.file;
      const record = records.get(entry.path);
      if (!await load(file, entry.name, record?.draft)) throw new Error(`Could not open ${entry.name}. Choose another image.`);
      current = entry;
      const draft = capture(), fingerprint = JSON.stringify(draft.state);
      records.set(entry.path, { ...record, draft, fingerprint, baseline: record?.baseline || fingerprint, error: false });
      $('#folder-message').textContent = `Opened ${entry.path}. Edits stay with each image while this folder is open.`;
    } catch (error) {
      const record = records.get(entry.path) || {};
      records.set(entry.path, { ...record, error: true }); $('#folder-message').textContent = error.message; notify(error.message);
    } finally { setBusy(false); }
  }
  function canReplace() { stash(); return !hasDrafts() || window.confirm('This folder has unsaved edits. Close it and discard those drafts?'); }
  async function accept(nextEntries, nextName, nextRoot) {
    if (!nextEntries.length) { notify('No JPG, PNG, HEIC, or HEIF images found. The edited subfolders are skipped.'); return; }
    if (!canReplace()) return;
    root = nextRoot; name = nextName; entries = nextEntries; current = null; records = new Map(); byPath = new Map(entries.map(entry => [entry.path, entry]));
    $('#folder-search').value = ''; $('#folder-output').textContent = ''; panel.hidden = false;
    renderList(); await select(entries[0]);
  }
  $('#folder-open').addEventListener('click', async () => {
    if (busy) return;
    if (!directAccess) { $('#folder-file').click(); return; }
    try {
      // The picker must run directly in the button gesture, before scanning or rendering.
      const directory = await chooseDirectory();
      setBusy(true); $('#folder-message').textContent = 'Reading image names…';
      let images;
      try { images = directory.desktop ? directory.images : await scanDirectory(directory); } finally { setBusy(false); }
      await accept(images, directory.name, directory);
    } catch (error) {
      if (error.name !== 'AbortError') notify(`${error.message} Try Browse folder files in the folder opening menu.`);
    }
  });
  $('#folder-files-open').addEventListener('click', () => { $('#folder-open-options').open = false; if (!busy) $('#folder-file').click(); });
  $('#folder-file').addEventListener('change', async () => {
    const files = [...$('#folder-file').files]; $('#folder-file').value = '';
    if (!files.length || busy) return;
    try { await accept(imagesFromFiles(files), files[0].webkitRelativePath?.split('/')[0] || 'Selected images', null); }
    catch (error) { notify(error.message); }
  });
  $('#folder-connect').addEventListener('click', async () => {
    if (busy) return;
    try { root = await chooseDirectory(true); $('#folder-output').textContent = ''; update(); notify(`Copies will be saved under ${root.name}/edited.`); }
    catch (error) { if (error.name !== 'AbortError') notify(error.message); }
  });
  $('#folder-search').addEventListener('input', renderList);
  $('#folder-prev').addEventListener('click', () => { const entry = adjacentImage(filtered(), current?.path, -1); if (entry) select(entry); });
  $('#folder-next').addEventListener('click', () => { const entry = adjacentImage(filtered(), current?.path, 1); if (entry) select(entry); });
  $('#folder-close').addEventListener('click', () => {
    if (busy || !canReplace()) return;
    root = null; entries = []; records.clear(); byPath.clear(); current = null; panel.hidden = true; list.replaceChildren();
  });
  async function save(blob = null, type = $('#folder-format').value, fingerprint = null) {
    if (busy || !current) return;
    stash(); const entry = current, record = records.get(entry.path), destination = root;
    setBusy(true);
    try {
      // Ask for write permission before encoding consumes the click's user activation.
      if (destination) await allowFolderWrites(destination);
      fingerprint ||= record.fingerprint;
      $('#folder-message').textContent = 'Preparing the edited photo…';
      blob ||= await encode(type);
      if (destination) {
        const path = destination.desktop
          ? await desktop.saveEdited(destination.id, entry.path, new Uint8Array(await blob.arrayBuffer()), type)
          : await writeEditedCopy(destination, entry.path, blob, type);
        record.destination = path; $('#folder-output').textContent = `Saved: ${destination.name}/${path}`;
        $('#folder-message').textContent = `Saved ${entry.name} to ${path}. Your original is untouched.`;
      } else {
        const filename = `${entry.name.replace(/\.[^.]+$/, '')}-edited.${exportExtension(type)}`;
        download(blob, filename); record.destination = null; $('#folder-output').textContent = `Downloaded: ${filename}`;
        $('#folder-message').textContent = 'Downloaded a copy. No file was written to the source folder.';
      }
      record.saved = fingerprint; notify($('#folder-message').textContent);
    } catch (error) { $('#folder-message').textContent = `Save failed: ${error.message}`; notify($('#folder-message').textContent); }
    finally { setBusy(false); }
  }
  $('#folder-save').addEventListener('click', () => save());
  document.addEventListener('keydown', event => {
    if (panel.hidden || busy || document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
    if (event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault(); const entry = adjacentImage(filtered(), current?.path, event.key === 'ArrowLeft' ? -1 : 1); if (entry) select(entry);
    }
  });
  window.addEventListener('beforeunload', event => { if (hasDrafts()) { event.preventDefault(); event.returnValue = ''; } });
  return {
    get active() { return !!current; }, get busy() { return busy; }, save,
    async openPhoto(file) {
      if (busy) return;
      stash(); setBusy(true);
      try { if (await load(file, file.name)) current = null; }
      finally { setBusy(false); }
    },
    edited(fingerprint) { if (!current || busy) return; records.get(current.path).fingerprint = fingerprint; update(); },
    detach() { stash(); current = null; update(); },
  };
}
