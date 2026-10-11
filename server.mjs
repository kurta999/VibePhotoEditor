import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
const root = path.dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.heic': 'image/heic', '.heif': 'image/heif', '.wasm': 'application/wasm', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let name;
  try { name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if (!file.startsWith(root + path.sep) || name.split('/').some(p => p.startsWith('.')) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
  fs.createReadStream(file).pipe(res);
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'This port is already in use. If the editor is already running, open its browser tab. Otherwise set PORT to another number.' : error.message); process.exitCode = 1; });
server.listen(Number(process.env.PORT) || 5173, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}`;
  console.log(`Vibe Photo Editor: ${url}`);
  if (process.argv.includes('--open')) {
    if (process.platform === 'win32') execFile('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', `Start-Process '${url}'`]);
    else execFile(process.platform === 'darwin' ? 'open' : 'xdg-open', [url]);
  }
});
