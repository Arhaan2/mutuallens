import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as pause } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const mode = process.argv[2] || 'preview';
if (!['dev', 'preview'].includes(mode))
  throw new Error('Use npm run dev or npm run preview.');
const ports = mode === 'dev' ? [4321, 5173, 8788] : [4321, 5173];
const children = new Set();
let stopping = false;
const env = {
  ...process.env,
  WRANGLER_SEND_METRICS: 'false',
  ASTRO_TELEMETRY_DISABLED: '1',
  PUBLIC_SITE_ORIGIN: 'http://localhost:4321',
  PUBLIC_CHECKER_ORIGIN: 'http://localhost:5173',
  VITE_SITE_ORIGIN: 'http://localhost:4321',
};

function start(command, args, cwd = root) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    detached: true,
  });
  children.add(child);
  console.log(
    `[MutualLens] ${mode} PID ${child.pid}: ${command} ${args.join(' ')}`,
  );
  child.once('error', (error) => {
    console.error(error.message);
    void stop(1);
  });
  return child;
}
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      /* Already stopped. */
    }
  }
  // Only signal process groups that this invocation created, even on startup failure.
  await Promise.all(
    [...children].map((child) =>
      child.exitCode !== null || child.signalCode
        ? Promise.resolve()
        : Promise.race([
            new Promise((resolve) => child.once('exit', resolve)),
            pause(3000),
          ]),
    ),
  );
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      /* Group already stopped. */
    }
  }
  process.exit(code);
}
// npm and a foreground process group can deliver the same signal twice.
// Keep handlers installed while cleanup awaits child exits.
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
process.on('SIGHUP', () => void stop());
process.once('exit', () => {
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      /* Already stopped. */
    }
  }
});

try {
  // Never reuse or terminate someone else's server. Check before building or spawning.
  for (const port of ports) {
    await new Promise((resolve, reject) => {
      const probe = createServer();
      probe.once('error', (error) =>
        reject(
          new Error(
            error.code === 'EADDRINUSE'
              ? `Port ${port} is occupied. Stop its owning process yourself, then retry. No existing process was changed.`
              : `Cannot bind local port ${port} (${error.code ?? 'unknown error'}). Check local runtime permissions before retrying. No existing process was changed.`,
          ),
        ),
      );
      probe.listen(port, '127.0.0.1', () => probe.close(resolve));
    });
  }
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  const dirty = !!execFileSync('git', ['status', '--porcelain'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  console.log(
    `[MutualLens] ${mode} from ${revision}${dirty ? ' (working tree has changes)' : ''}. Building current files before serving.`,
  );
  const build = start('npm', ['run', 'build']);
  const exit = await new Promise((resolve) => build.once('exit', resolve));
  children.delete(build);
  if (exit !== 0) throw new Error('Build failed; no site was started.');
  const wrangler = fileURLToPath(
    new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url),
  );
  function pages(app, port) {
    return start(
      process.execPath,
      [
        wrangler,
        'pages',
        'dev',
        'dist',
        '--port',
        String(port),
        '--ip',
        '127.0.0.1',
        '--inspector-port',
        '0',
      ],
      `${root}apps/${app}`,
    );
  }
  if (mode === 'dev') {
    pages('checker', 8788);
    start('npm', ['run', 'dev:checker']);
    start('npm', ['run', 'dev:site']);
  } else {
    pages('checker', 5173);
    pages('site', 4321);
  }
  for (const child of children)
    child.once('exit', (code) => {
      if (!stopping) {
        console.error(
          `[MutualLens] Required server PID ${child.pid} exited (${code}). Shutting down this session.`,
        );
        void stop(1);
      }
    });
  const deadline = Date.now() + 45000;
  while (!stopping) {
    try {
      const api = await fetch('http://127.0.0.1:5173/api/capabilities', {
        signal: AbortSignal.timeout(1500),
      });
      const payload = await api.json();
      if (
        !api.ok ||
        payload.release !== 'preview' ||
        payload.automatic?.enabled !== false ||
        payload.automatic?.status !== 'blocked' ||
        payload.ads !== false
      )
        throw new Error('Incorrect capability runtime.');
      for (const port of [4321, 5173]) {
        const response = await fetch(`http://127.0.0.1:${port}`, {
          signal: AbortSignal.timeout(1500),
        });
        const html = await response.text();
        if (
          !response.ok ||
          !html.includes('MutualLens') ||
          !html.includes('noindex')
        )
          throw new Error(`Port ${port} did not serve the expected preview.`);
      }
      const stamp = JSON.parse(
        await readFile(`${root}apps/checker/dist/build-info.json`, 'utf8'),
      );
      console.log(
        `[MutualLens] READY ${mode}; source ${stamp.sourceHash}. Public http://localhost:4321 · checker + API http://localhost:5173. Ctrl+C stops this session.`,
      );
      break;
    } catch (error) {
      if (Date.now() >= deadline)
        throw new Error(`Readiness failed: ${error.message}`, { cause: error });
      await pause(200);
    }
  }
} catch (error) {
  console.error(`[MutualLens] ${error.message}`);
  await stop(1);
}
