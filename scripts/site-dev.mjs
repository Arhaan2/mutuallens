// Use Astro's pinned programmatic API so agent-detected CLI runs cannot daemonize.
process.env.ASTRO_TELEMETRY_DISABLED = '1';
const { dev } = await import('astro');
let server;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await server?.stop();
  process.exit(0);
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
server = await dev({
  root: new URL('../apps/site/', import.meta.url),
  server: { host: '127.0.0.1', port: 4321 },
  vite: { server: { strictPort: true } },
});
console.log(
  `[MutualLens] Public development server PID ${process.pid} at http://127.0.0.1:${server.address.port}`,
);
