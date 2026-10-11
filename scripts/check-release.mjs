import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
assert.equal(lock.version, manifest.version, 'package-lock.json version must match package.json');
assert.equal(lock.packages[''].version, manifest.version, 'Lockfile root version must match package.json');
if (process.env.RELEASE_TAG) {
  assert.equal(process.env.RELEASE_TAG, `v${manifest.version}`, 'Release tag must be v followed by the package.json version');
}
console.log(`Release version verified: ${manifest.version}`);
