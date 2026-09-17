import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, open, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';

const projectRoot = 'C:/Users/Jabu Babb/Documents/Code/Parakleo';
const manifestPath = path.join(projectRoot, 'preview.json');
const appRoot = path.join(projectRoot, 'tutors');
const outputRoot = path.join(appRoot, 'dist-download');
const statePath = path.join(outputRoot, 'build-coordinator-state.json');
const statusPath = path.join(outputRoot, 'preview-status.json');
const lockPath = path.join(outputRoot, 'build-coordinator.lock');
const supervisorUrl = 'http://127.0.0.1:9001';
const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const javaHome = 'C:/Program Files/Eclipse Adoptium/jdk-21.0.10.7-hotspot';
const androidHome = 'C:/Users/Jabu Babb/AppData/Local/Android/Sdk';
// Keep this path deliberately short: Windows JDK NIO uses it for AF_UNIX
// wake-up sockets, whose path length is capped by Windows.
const buildTemp = 'C:/jtmp/pk';
const tutorMetroPort = 10015;

const ignoredDirectories = new Set(['.git', '.gradle', 'build', 'dist-download', 'node_modules']);
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const portOpen = (port) => new Promise((resolve) => {
  const socket = net.createConnection({ host: '127.0.0.1', port });
  const done = (value) => { socket.destroy(); resolve(value); };
  socket.once('connect', () => done(true));
  socket.once('error', () => done(false));
});
const now = () => new Date().toISOString();
const sortedObject = (value) => Object.fromEntries(Object.entries(value ?? {}).sort(([left], [right]) => left.localeCompare(right)));
const hashValue = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

async function readJson(filePath, fallback = undefined) {
  try { return JSON.parse(await readFile(filePath, 'utf8')); }
  catch { return fallback; }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  const temporary = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.next`;
  await writeFile(temporary, serialized, 'utf8');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await unlink(filePath).catch((error) => {
        if (error?.code !== 'ENOENT') throw error;
      });
      await rename(temporary, filePath);
      return;
    } catch (error) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error?.code) || attempt === 19) {
        await unlink(temporary).catch(() => {});
        if (attempt === 19) {
          await writeFile(filePath, serialized, 'utf8');
          return;
        }
        throw error;
      }
      await sleep(50 * (attempt + 1));
    }
  }
}

async function filesWithin(target) {
  if (!existsSync(target)) return [];
  const details = await stat(target);
  if (details.isFile()) return [target];
  const entries = await readdir(target, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) files.push(...await filesWithin(child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

async function hashInputs(root, inputs) {
  const hash = createHash('sha256');
  const files = [];
  for (const input of inputs) files.push(...await filesWithin(path.resolve(root, input)));
  for (const file of [...new Set(files)].sort()) {
    hash.update(path.relative(root, file).replaceAll('\\', '/'));
    hash.update(await readFile(file));
  }
  return hash.digest('hex');
}

function productionLockSnapshot(lock) {
  if (!lock?.packages) return lock ?? {};
  return Object.fromEntries(Object.entries(lock.packages)
    .filter(([, details]) => !details?.dev)
    .map(([packagePath, details]) => [packagePath, {
      version: details?.version,
      resolved: details?.resolved,
      integrity: details?.integrity,
      optional: Boolean(details?.optional),
    }])
    .sort(([left], [right]) => left.localeCompare(right)));
}

export function classifyChange(previous, current) {
  if (!previous) return 'baseline';
  if (previous.native !== current.native) return 'full-build';
  if (previous.tooling !== current.tooling) return 'clear-cache';
  if (previous.source !== current.source) return 'fast-refresh';
  return 'none';
}

async function loadTarget() {
  const manifest = await readJson(manifestPath);
  const app = manifest?.apps?.find((entry) => entry.id === 'tutors-metro');
  if (!app?.build?.automation?.enabled) throw new Error('tutors-metro build automation is not enabled in preview.json.');
  return { manifest, app, automation: app.build.automation };
}

async function fingerprint(target) {
  const packageJson = await readJson(path.join(appRoot, 'package.json'), {});
  const packageLock = await readJson(path.join(appRoot, 'package-lock.json'), {});
  const nativeInputs = await hashInputs(appRoot, target.automation.nativeInputs ?? []);
  const toolingInputs = await hashInputs(appRoot, target.automation.toolingInputs ?? []);
  const sourceInputs = await hashInputs(appRoot, target.automation.sourceInputs ?? []);
  const native = hashValue({
    dependencies: sortedObject(packageJson.dependencies),
    productionLock: productionLockSnapshot(packageLock),
    nativeInputs,
  });
  const tooling = hashValue({
    devDependencies: sortedObject(packageJson.devDependencies),
    packageManager: packageJson.packageManager,
    lock: packageLock,
    toolingInputs,
  });
  const source = hashValue(sourceInputs);
  return { native, tooling, source, combined: hashValue({ native, tooling, source }) };
}

function tokenize(command) {
  return String(command ?? '').match(/"[^"]*"|'[^']*'|[^\s]+/g)?.map((token) => token.replace(/^['"]|['"]$/g, '')) ?? [];
}

async function runCommand(command, onProgress) {
  const [program, ...args] = tokenize(command);
  if (!program) throw new Error('Build command is empty.');
  const executable = process.platform === 'win32' && program === 'npm' && existsSync(npmCli) ? process.execPath : program;
  const commandArgs = executable === process.execPath ? [npmCli, ...args] : args;
  await mkdir(buildTemp, { recursive: true });
  const child = spawn(executable, commandArgs, {
    cwd: appRoot,
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      JAVA_HOME: javaHome,
      ANDROID_HOME: androidHome,
      ANDROID_SDK_ROOT: androidHome,
      NODE_ENV: process.env.NODE_ENV || 'development',
      TEMP: buildTemp,
      TMP: buildTemp,
      PATH: `${javaHome}/bin;${androidHome}/platform-tools;${path.dirname(process.execPath)};${process.env.PATH ?? ''}`,
    },
  });
  let output = '';
  let lastProgressAt = 0;
  const collect = (chunk) => {
    output = `${output}${chunk}`.slice(-16_000);
    const line = String(chunk).trim().split(/\r?\n/).filter(Boolean).at(-1);
    if (line && Date.now() - lastProgressAt > 1_000) {
      lastProgressAt = Date.now();
      onProgress?.(line.slice(0, 240));
    }
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
  if (exitCode !== 0) throw new Error(output.trim() || `${command} exited with code ${exitCode}.`);
  return output;
}

async function restartMetro(clearCache = true) {
  const request = async () => {
    const response = await fetch(`${supervisorUrl}/restart`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ configPath: manifestPath, appId: 'tutors-metro', clearCache }),
      signal: AbortSignal.timeout(90_000),
    });
    const body = await response.json();
    return { response, body };
  };
  let restartError;
  try {
    const { response, body } = await request();
    if (response.ok) return body;
    restartError = new Error(body.error ?? 'Tutor Metro restart failed.');
  } catch (error) {
    restartError = error;
  }

  // A clean Tutor Metro start can exceed the Supervisor's startup window.
  // Treat a late listener as success instead of launching a competing process.
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await portOpen(tutorMetroPort)) {
      return { app: { local_port: tutorMetroPort }, state: 'recovered-running' };
    }
    await sleep(1_000);
  }

  // If the first process genuinely exited, make one clean app-scoped retry and
  // again allow Metro enough time to finish rebuilding its cache.
  try {
    const { response, body } = await request();
    if (response.ok) return body;
    restartError = new Error(body.error ?? restartError?.message ?? 'Tutor Metro restart failed.');
  } catch (error) {
    restartError = error;
  }
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await portOpen(tutorMetroPort)) {
      return { app: { local_port: tutorMetroPort }, state: 'recovered-running' };
    }
    await sleep(1_000);
  }
  throw restartError ?? new Error('Tutor Metro restart failed.');
}

async function verifyMetro(port) {
  const bundleUrl = `http://127.0.0.1:${port}/node_modules/expo/AppEntry.bundle?platform=android&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1`;
  const response = await fetch(bundleUrl, { signal: AbortSignal.timeout(180_000) });
  if (!response.ok) throw new Error(`Metro verification returned HTTP ${response.status}.`);
  const bundle = await response.arrayBuffer();
  return bundle.byteLength;
}

async function artifactDetails() {
  const metadata = await readJson(path.join(outputRoot, 'parakleo-tutors-debug.json'));
  if (!metadata) return null;
  return {
    ...metadata,
    downloadUrl: 'https://preview.bakayisedevelopers.co.za/downloads/parakleo/tutors/latest.apk',
  };
}

export class TutorsBuildCoordinator {
  constructor({ pollIntervalMs = 5_000 } = {}) {
    this.pollIntervalMs = pollIntervalMs;
    this.candidate = null;
    this.active = false;
    this.timer = null;
    this.statusWrite = Promise.resolve();
  }

  async publish(patch, historyEntry) {
    this.status = {
      schemaVersion: 1,
      projectName: 'parakleo',
      appId: 'tutors-metro',
      history: this.status?.history ?? [],
      ...this.status,
      ...patch,
      updatedAt: now(),
    };
    if (historyEntry) this.status.history = [historyEntry, ...(this.status.history ?? [])].slice(0, 20);
    this.statusWrite = this.statusWrite.catch(() => {}).then(() => writeJson(statusPath, this.status));
    await this.statusWrite;
  }

  async start() {
    await mkdir(outputRoot, { recursive: true });
    try {
      this.lockHandle = await open(lockPath, 'wx');
      await this.lockHandle.writeFile(String(process.pid));
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const existingPid = Number.parseInt(await readFile(lockPath, 'utf8').catch(() => ''), 10);
      if (existingPid) {
        try { process.kill(existingPid, 0); throw new Error(`Tutor build coordinator is already running on PID ${existingPid}.`); }
        catch (probeError) { if (probeError?.code !== 'ESRCH') throw probeError; }
      }
      await unlink(lockPath).catch(() => {});
      this.lockHandle = await open(lockPath, 'wx');
      await this.lockHandle.writeFile(String(process.pid));
    }
    this.state = await readJson(statePath, {});
    this.status = await readJson(statusPath, { history: [] });
    const recovered = await this.recoverPublishedBuild().catch(() => false);
    if (!recovered) await this.inspect();
    this.timer = setInterval(() => void this.inspect().catch((error) => this.fail('Watcher check failed', error)), this.pollIntervalMs);
    return this;
  }

  async close() {
    if (this.timer) clearInterval(this.timer);
    await this.lockHandle?.close().catch(() => {});
    await unlink(lockPath).catch(() => {});
  }

  async fail(message, error, action = this.status?.action ?? 'none', attemptFingerprint = undefined) {
    if (attemptFingerprint) {
      this.state.lastAttemptFingerprint = attemptFingerprint;
      await writeJson(statePath, this.state);
    }
    const details = error instanceof Error ? error.message : String(error);
    const entry = { action, status: 'failed', startedAt: this.status?.startedAt ?? now(), completedAt: now(), message: details.slice(-2_000) };
    await this.publish({ phase: 'failed', action, message, error: details.slice(-4_000), completedAt: entry.completedAt, artifact: await artifactDetails() }, entry);
  }

  async recoverPublishedBuild() {
    if (this.status?.phase !== 'failed' || this.status?.action !== 'full-build') return false;
    const artifact = await artifactDetails();
    const startedAt = Date.parse(this.status?.startedAt ?? '');
    const stagedAt = Date.parse(artifact?.stagedAt ?? '');
    if (!artifact || !Number.isFinite(startedAt) || !Number.isFinite(stagedAt) || stagedAt < startedAt) return false;
    if (!await portOpen(tutorMetroPort)) return false;

    const bundleBytes = await verifyMetro(tutorMetroPort);
    const current = await fingerprint(await loadTarget());
    this.state = { fingerprints: current, lastAttemptFingerprint: null };
    await writeJson(statePath, this.state);
    const completedAt = now();
    const entry = {
      action: 'full-build',
      status: 'ready',
      startedAt: this.status.startedAt,
      completedAt,
      bundleBytes,
      artifact,
      message: 'Published APK retained; late Tutor Metro startup recovered and verified.',
    };
    await this.publish({ phase: 'ready', action: 'full-build', message: entry.message, completedAt, error: null, bundleBytes, artifact }, entry);
    return true;
  }

  async inspect() {
    if (this.active) return;
    const target = await loadTarget();
    const current = await fingerprint(target);
    const action = classifyChange(this.state?.fingerprints, current);
    if (action === 'baseline') {
      this.state = { fingerprints: current, lastAttemptFingerprint: null };
      await writeJson(statePath, this.state);
      await this.publish({ phase: 'ready', action: 'none', message: 'Monitoring Tutor native dependencies and source changes.', completedAt: now(), artifact: await artifactDetails() });
      return;
    }
    if (action === 'none') { this.candidate = null; return; }
    if (this.state.lastAttemptFingerprint === current.combined) return;

    const settleMs = action === 'fast-refresh' ? Number(target.automation.sourceSettleMs ?? 3_000) : Number(target.automation.settleMs ?? 45_000);
    if (!this.candidate || this.candidate.fingerprint !== current.combined || this.candidate.action !== action) {
      this.candidate = { fingerprint: current.combined, action, observedAt: Date.now() };
      await this.publish({ phase: 'settling', action, message: `Waiting for ${action === 'full-build' ? 'native dependency or configuration' : action === 'clear-cache' ? 'tooling dependency' : 'JavaScript'} changes to settle.`, startedAt: now(), completedAt: null });
      return;
    }
    if (Date.now() - this.candidate.observedAt < settleMs) return;
    this.active = true;
    const startedAt = now();
    try {
      if (action === 'fast-refresh') {
        this.state = { fingerprints: current, lastAttemptFingerprint: null };
        await writeJson(statePath, this.state);
        const entry = { action, status: 'ready', startedAt, completedAt: now(), message: 'JavaScript changes are available through Metro Fast Refresh.' };
        await this.publish({ phase: 'ready', action, message: entry.message, startedAt, completedAt: entry.completedAt, error: null }, entry);
        return;
      }

      if (action === 'full-build') {
        await this.publish({ phase: 'building', action, message: 'Compiling a new Android debug APK.', startedAt, completedAt: null, error: null });
        await runCommand(target.app.build.command, (message) => void this.publish({ message }));
        const afterBuild = await fingerprint(await loadTarget());
        if (afterBuild.native !== current.native || afterBuild.tooling !== current.tooling) {
          this.candidate = null;
          await this.publish({ phase: 'settling', action, message: 'Relevant files changed during the build; the completed artifact was not published.', startedAt, completedAt: null });
          return;
        }
        await this.publish({ phase: 'publishing', action, message: 'Publishing the verified APK to the download endpoint.' });
        await runCommand(target.app.build.publishCommand);
      }

      await this.publish({ phase: 'restarting-metro', action, message: 'Restarting only Tutor Metro with an isolated clean cache.' });
      const restarted = await restartMetro(true);
      const port = Number(restarted?.app?.local_port);
      await this.publish({ phase: 'verifying', action, message: 'Compiling a fresh Android bundle to verify Metro.' });
      const bundleBytes = await verifyMetro(port);
      const finalFingerprint = await fingerprint(await loadTarget());
      this.state = { fingerprints: finalFingerprint, lastAttemptFingerprint: null };
      await writeJson(statePath, this.state);
      const completedAt = now();
      const artifact = await artifactDetails();
      const entry = { action, status: 'ready', startedAt, completedAt, bundleBytes, artifact, message: action === 'full-build' ? 'APK published and Tutor Metro verified.' : 'Tutor Metro cache cleared and bundle verified.' };
      await this.publish({ phase: 'ready', action, message: entry.message, startedAt, completedAt, error: null, bundleBytes, artifact }, entry);
    } catch (error) {
      await this.fail(action === 'full-build' ? 'Tutor APK build failed.' : 'Tutor Metro restart failed.', error, action, current.combined);
    } finally {
      this.active = false;
      this.candidate = null;
    }
  }
}

export async function startTutorsBuildCoordinator(options) {
  return new TutorsBuildCoordinator(options).start();
}
