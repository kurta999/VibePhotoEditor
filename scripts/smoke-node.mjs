import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, readdir } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';

if (!process.argv[2]) throw new Error('Usage: node scripts/smoke-node.mjs <extracted release directory>');
const root = path.resolve(process.argv[2]);
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
assert.equal(manifest.scripts.start, 'node server.mjs');
assert.equal(Object.keys(manifest.dependencies || {}).length, 0);
assert.equal(Object.keys(manifest.devDependencies || {}).length, 0);
assert.ok(!(await readdir(root)).includes('node_modules'));

// Reserve an available port before starting the unmodified release server.
const listener = net.createServer();
listener.listen(0, '127.0.0.1');
await once(listener, 'listening');
const port = listener.address().port;
await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: root, env: { ...process.env, PORT: String(port) },
  windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stderr.on('data', chunk => { output += chunk; });
const exited = new Promise(resolve => {
  child.once('exit', resolve);
  child.once('error', resolve);
});
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server startup timed out: ${output}`)), 10000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited with ${code}: ${output}`)); });
    child.stdout.on('data', chunk => {
      output += chunk;
      if (output.includes(`http://127.0.0.1:${port}`)) { clearTimeout(timer); resolve(); }
    });
  });
  async function verify(directory = '') {
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
      const relative = directory ? `${directory}/${entry.name}` : entry.name;
      if (entry.isDirectory()) { await verify(relative); continue; }
      const response = await fetch(`http://127.0.0.1:${port}/${relative.split('/').map(encodeURIComponent).join('/')}`, {
        signal: AbortSignal.timeout(10000),
      });
      assert.equal(response.status, 200, `Missing release resource: ${relative}`);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(path.join(root, relative)), relative);
    }
  }
  await verify();
  const home = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(10000) });
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-type'), /text\/html/);
  assert.equal(await home.text(), await readFile(path.join(root, 'index.html'), 'utf8'));
  console.log(`NODE_SMOKE_OK ${manifest.version}: all bundled files served without dependencies`);
} finally {
  child.kill();
  await exited;
}
