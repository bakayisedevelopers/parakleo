import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = process.env.PREVIEW_MANIFEST_PATH ?? path.join(projectDirectory, 'preview.json');
const appId = process.argv[2];
const extraViteArguments = process.argv.slice(3);
const previewRouterCli = process.env.PREVIEW_ROUTER_CLI ?? 'C:\\Commander\\PreviewRouter\\src\\cli.js';

if (!appId) throw new Error('Usage: node scripts/start-preview-vite.mjs <app-id> [Vite arguments]');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const app = manifest.apps?.find((entry) => entry.id === appId);
if (!app || app.type !== 'vite-web' || !Number.isInteger(app.port) || !app.hostname || !app.directory) {
  throw new Error(`preview.json must define a Vite app named '${appId}' with a directory, hostname, and port.`);
}

const appDirectory = path.resolve(projectDirectory, app.directory);
const localVite = path.join(appDirectory, 'node_modules', 'vite', 'bin', 'vite.js');
const require = createRequire(import.meta.url);
const vite = existsSync(localVite)
  ? localVite
  : path.resolve(path.dirname(require.resolve('vite')), '..', '..', 'bin', 'vite.js');
const isPortListening = () => new Promise((resolve) => {
  const socket = new net.Socket();
  const done = (result) => { socket.destroy(); resolve(result); };
  socket.once('connect', () => done(true)); socket.once('error', () => done(false)); socket.connect(app.port, '127.0.0.1');
});
const waitForPort = (timeoutMs = 30_000) => new Promise((resolve, reject) => {
  const deadline = Date.now() + timeoutMs;
  const attempt = async () => {
    if (await isPortListening()) return resolve();
    if (Date.now() >= deadline) return reject(new Error(`Timed out waiting for 127.0.0.1:${app.port}.`));
    setTimeout(attempt, 250);
  };
  void attempt();
});
const routerCommand = (arguments_) => new Promise((resolve, reject) => {
  execFile(process.execPath, [previewRouterCli, ...arguments_], { windowsHide: true }, (error, stdout, stderr) => {
    if (error) return reject(new Error(stderr || error.message));
    resolve(stdout);
  });
});

if (await isPortListening()) throw new Error(`Refusing to start '${app.id}': 127.0.0.1:${app.port} is already in use.`);
const child = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(app.port), '--strictPort', ...extraViteArguments], {
  cwd: appDirectory,
  stdio: 'inherit',
  env: { ...process.env, ...app.environment, PREVIEW_PUBLIC_HOST: app.hostname, PREVIEW_APP_ID: app.id, PREVIEW_MANIFEST_PATH: manifestPath },
});
try {
  await waitForPort();
  await routerCommand(['register', '--config', manifestPath, '--app', app.id]);
  process.stdout.write(`Preview available at https://${app.hostname}\n`);
} catch (error) {
  child.kill();
  throw error;
}
child.once('exit', async (code, signal) => {
  try { await routerCommand(['unregister', '--hostname', app.hostname]); } catch { /* Router may be offline during shutdown. */ }
  process.exitCode = code ?? (signal ? 1 : 0);
});
