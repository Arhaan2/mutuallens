import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as pause } from 'node:timers/promises';
import { mkdir, writeFile } from 'node:fs/promises';

const output = 'test-results/startup';
await mkdir(output, { recursive: true });
const evidence = [];
function launch(mode) {
  const child = spawn('npm', ['run', mode], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: 'false',
      ASTRO_TELEMETRY_DISABLED: '1',
    },
  });
  let log = '';
  child.stdout.on('data', (data) => {
    log += data;
  });
  child.stderr.on('data', (data) => {
    log += data;
  });
  const closed = new Promise((resolve) =>
    child.once('exit', (code, signal) => resolve({ code, signal })),
  );
  return { child, closed, log: () => log };
}
async function waitFor(predicate, deadline = 60000) {
  const until = Date.now() + deadline;
  while (!(await predicate())) {
    if (Date.now() > until)
      throw new Error('Startup verification deadline exceeded.');
    await pause(100);
  }
}
async function portFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}
// Occupied-port safety: the existing listener must survive a refused startup.
const sentinel = createServer();
await new Promise((resolve, reject) => {
  sentinel.once('error', reject);
  sentinel.listen(4321, '127.0.0.1', resolve);
});
try {
  const run = launch('preview');
  const result = await run.closed;
  if (
    result.code !== 1 ||
    !run.log().includes('Port 4321 is occupied') ||
    !sentinel.listening
  )
    throw new Error('Occupied-port protection failed.');
  evidence.push({
    scenario: 'occupied port refused without changing existing listener',
    result: 'PASS',
    exit: result,
  });
  await writeFile(`${output}/occupied-port.txt`, run.log());
} finally {
  await new Promise((resolve) => sentinel.close(resolve));
}
for (const mode of ['dev', 'preview']) {
  const run = launch(mode);
  try {
    await waitFor(() => run.log().includes(`[MutualLens] READY ${mode}`));
    const api = await (
      await fetch('http://localhost:5173/api/capabilities')
    ).json();
    if (api.automatic?.enabled !== false || api.ads !== false)
      throw new Error('Wrong capability runtime.');
    // A terminal Ctrl+C sends SIGINT to its foreground group. Exercise that behavior.
    process.kill(-run.child.pid, 'SIGINT');
    await Promise.race([
      run.closed,
      pause(5000).then(() => {
        throw new Error('Root command did not stop after SIGINT.');
      }),
    ]);
    await waitFor(
      async () =>
        (await Promise.all([4321, 5173, 8788].map(portFree))).every(Boolean),
      5000,
    );
    evidence.push({
      scenario: `${mode}: readiness, real API, foreground SIGINT cleanup`,
      result: 'PASS',
      portsReleased: [4321, 5173, 8788],
    });
  } finally {
    try {
      process.kill(-run.child.pid, 'SIGTERM');
    } catch {
      /* Already stopped. */
    }
    await writeFile(`${output}/${mode}.txt`, run.log());
  }
}
await writeFile(
  `${output}/results.json`,
  JSON.stringify({ testedAt: new Date().toISOString(), evidence }, null, 2),
);
console.log(JSON.stringify(evidence, null, 2));
