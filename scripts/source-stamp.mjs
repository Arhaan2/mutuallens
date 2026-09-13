import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
export async function sourceStamp() {
  const hash = createHash('sha256');
  const paths = [];
  async function visit(path) {
    for (const entry of (
      await readdir(root + path, { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name))) {
      if (
        ['node_modules', 'dist', '.astro', '.wrangler'].includes(entry.name) ||
        entry.name.startsWith('.env') ||
        entry.name.startsWith('.dev.vars')
      )
        continue;
      const next = `${path}/${entry.name}`;
      if (entry.isDirectory()) await visit(next);
      else if (entry.isFile()) paths.push(next);
    }
  }
  for (const folder of ['apps', 'packages', 'scripts']) await visit(folder);
  paths.push('package.json', 'package-lock.json');
  for (const path of paths) {
    hash.update(path);
    hash.update(await readFile(root + path));
  }
  return {
    commit: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
    sourceHash: hash.digest('hex'),
    builtAt: new Date().toISOString(),
  };
}
