import { spawn } from 'node:child_process';
import path from 'node:path';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
// Invoke a built Windows executable and capture its hidden smoke test's exit status.
const executable = process.argv[2];
if (!executable) throw new Error('Usage: node scripts/smoke-desktop.mjs <built exe>');
const report = path.resolve('test-output', 'desktop-smoke-result.json');
mkdirSync(path.dirname(report), { recursive: true }); rmSync(report, { force: true });
const child = spawn(path.resolve(executable), ['--smoke-test'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, VIBE_SMOKE_REPORT: report } });
let output = '';
child.stdout.on('data', chunk => { output += chunk; process.stdout.write(chunk); });
child.stderr.on('data', chunk => process.stderr.write(chunk));
const timeout = setTimeout(() => { child.kill(); process.exitCode = 1; console.error('Desktop smoke test timed out.'); }, 60000);
child.on('error', error => { clearTimeout(timeout); console.error(error.message); process.exitCode = 1; });
child.on('exit', code => {
  clearTimeout(timeout);
  let result;
  try { result = JSON.parse(readFileSync(report, 'utf8')); console.log(JSON.stringify(result)); } catch { /* A startup failure may not reach the main process. */ }
  process.exitCode = code === 0 && (result?.ok || output.includes('DESKTOP_SMOKE_OK')) ? 0 : 1;
});
