import { app, BrowserWindow, dialog, ipcMain, protocol, session } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { FolderAccess } from './folder-access.mjs';

protocol.registerSchemesAsPrivileged([{ scheme: 'vibe', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
const folders = new FolderAccess();
const smoke = process.argv.includes('--smoke-test');
const root = app.getAppPath();
const files = new Set(['index.html', 'styles.css', 'app.js', 'engine.js', 'cameras.js', 'worker.js', 'preview-zoom.js', 'heif-codec.js', 'heif-worker.js', 'advanced.js', 'advanced-ui.js', 'folder-library.js', 'folder-ui.js', 'healing.js', 'healing-ui.js']);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm' };
// The bundled HEIC decoder uses generated functions. Its runtime needs unsafe-eval;
// all executable resources remain restricted to the packaged application origin.
const csp = "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' blob: data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'";
let window;
function isAppURL(value) {
  try { const url = new URL(value); return url.protocol === 'vibe:' && url.hostname === 'app' && !url.username && !url.password && !url.port; }
  catch { return false; }
}
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (event.sender !== window?.webContents || event.senderFrame !== window.webContents.mainFrame || !isAppURL(event.senderFrame.url)) throw new Error('Access denied.');
    return fn(...args);
  });
}
app.whenReady().then(async () => {
  app.setAppUserModelId('org.vibe.photoeditor');
  protocol.handle('vibe', async request => {
    try {
      const url = new URL(request.url), name = decodeURIComponent(url.pathname).slice(1) || 'index.html';
      if (!isAppURL(request.url) || request.method !== 'GET' || name.includes('\\') || name.split('/').some(part => !part || part.startsWith('.')) || !(files.has(name) || /^(assets|vendor)\/[\w.-]+$/.test(name))) return new Response('Not found', { status: 404 });
      const bytes = await readFile(path.join(root, name));
      return new Response(bytes, { headers: { 'Content-Type': mime[path.extname(name)] || 'application/octet-stream', 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff' } });
    } catch { return new Response('Not found', { status: 404 }); }
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !isAppURL(details.url) && !/^(blob:|data:)/.test(details.url) });
  });
  session.defaultSession.on('will-download', (_event, item) => {
    item.setSaveDialogOptions({ title: 'Save edited photo', defaultPath: path.join(app.getPath('pictures'), item.getFilename()) });
  });
  handle('vibe:choose-folder', async outputOnly => {
    if (typeof outputOnly !== 'boolean') throw new Error('Invalid folder request.');
    const result = await dialog.showOpenDialog(window, { title: outputOnly ? 'Choose a folder for edited copies' : 'Open photo folder', properties: ['openDirectory'] });
    return result.canceled ? null : folders.select(result.filePaths[0], outputOnly);
  });
  handle('vibe:read-image', (id, imagePath) => folders.read(id, imagePath));
  handle('vibe:save-edited', (id, imagePath, bytes, type) => folders.save(id, imagePath, bytes, type));

  async function createWindow() {
    window = new BrowserWindow({
      title: 'Vibe Photo Editor', width: 1440, height: 1000, minWidth: 420, minHeight: 640,
      backgroundColor: '#f7f7f4', icon: path.join(root, 'assets', 'icon.ico'), show: false,
      webPreferences: { preload: path.join(root, 'desktop', 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, devTools: !app.isPackaged },
    });
    window.removeMenu();
    window.webContents.on('will-prevent-unload', event => {
      const discard = dialog.showMessageBoxSync(window, { type: 'question', title: 'Unsaved folder edits', message: 'Close and discard unsaved folder edits?', detail: 'Save edited copies before closing to keep your work.', buttons: ['Keep editing', 'Discard edits'], defaultId: 0, cancelId: 0 });
      if (discard === 1) event.preventDefault();
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, url) => { if (!isAppURL(url)) event.preventDefault(); });
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.once('ready-to-show', () => { if (!smoke) window.show(); });
    if (smoke) {
      const errors = [];
      window.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
      window.webContents.on('preload-error', (_event, _path, error) => errors.push(error.message));
      await window.loadURL('vibe://app/');
      const { runSmoke } = await import('./smoke.mjs');
      const result = await runSmoke(window, folders, root);
      if (errors.length || Object.values(result).some(value => value === false)) throw new Error(JSON.stringify({ result, errors }));
      console.log('DESKTOP_SMOKE_OK ' + JSON.stringify(result));
      if (process.env.VIBE_SMOKE_REPORT) await writeFile(process.env.VIBE_SMOKE_REPORT, JSON.stringify({ ok: true, result }));
      app.exit(0);
    } else await window.loadURL('vibe://app/');
  }
  await createWindow();
}).catch(async error => {
  console.error(error);
  if (smoke && process.env.VIBE_SMOKE_REPORT) await writeFile(process.env.VIBE_SMOKE_REPORT, JSON.stringify({ ok: false, error: error.stack || error.message }));
  app.exit(1);
});
app.on('window-all-closed', () => app.quit());
