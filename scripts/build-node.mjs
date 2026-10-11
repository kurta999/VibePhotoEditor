import './check-release.mjs';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const output = path.join(root, 'dist');
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run this script with npm run build:node.');
await mkdir(output, { recursive: true });
const staging = await mkdtemp(path.join(output, 'node-stage-'));
try {
  // Share the editor/codec file list with Electron, excluding its native wrapper.
  const files = manifest.build.files
    .filter(file => !file.startsWith('desktop/'))
    .map(file => file.replace(/\/\*\*$/, ''));
  files.push('server.mjs', 'Start Editor.cmd', 'README.md', 'docs');
  for (const file of files) {
    await cp(path.join(root, file), path.join(staging, file), { recursive: true });
  }
  // A runnable browser distribution with no Electron or development dependencies.
  await writeFile(path.join(staging, 'package.json'), JSON.stringify({
    name: manifest.name,
    version: manifest.version,
    private: true,
    type: 'module',
    description: manifest.description,
    license: manifest.license,
    author: manifest.author,
    repository: manifest.repository,
    engines: { node: '>=18' },
    scripts: { start: 'node server.mjs' },
  }, null, 2) + '\n');
  const { stdout } = await promisify(execFile)(process.execPath, [
    npm, 'pack', '--json', '--ignore-scripts', '--offline', '--pack-destination', output,
  ], { cwd: staging, maxBuffer: 4 * 1024 * 1024 });
  const [packed] = JSON.parse(stdout);
  const artifact = path.join(output, `Vibe-Photo-Editor-${manifest.version}-node.tgz`);
  await rename(path.join(output, packed.filename), artifact);
  console.log(`Node release: ${artifact}`);
} finally {
  const resolved = path.resolve(staging);
  if (path.dirname(resolved) !== path.resolve(output) || !path.basename(resolved).startsWith('node-stage-')) {
    throw new Error('Unsafe Node staging cleanup path.');
  }
  await rm(resolved, { recursive: true, force: true });
}
