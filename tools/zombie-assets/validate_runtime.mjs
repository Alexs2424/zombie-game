// Run with the project's installed development dependencies: node tools/zombie-assets/validate_runtime.mjs
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'zombie-runtime-'));
try {
  const output = join(dir, 'audit.mjs');
  await build({
    entryPoints: [fileURLToPath(new URL('./runtime-check.mjs', import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', outfile: output, logLevel: 'silent',
  });
  process.stdout.write(execFileSync(process.execPath, [output, join(root, 'public/models/zombies.json')], { encoding: 'utf8' }));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
