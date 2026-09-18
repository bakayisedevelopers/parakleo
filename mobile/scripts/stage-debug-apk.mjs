import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(mobileRoot, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const destinationDirectory = path.join(mobileRoot, 'dist-download');
const metadata = path.join(destinationDirectory, 'parakleo-student-debug.json');
const statusPath = path.join(destinationDirectory, 'preview-status.json');
const downloadUrl = 'https://preview.bakayisedevelopers.co.za/downloads/parakleo/students/latest.apk';

function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(filePath).on('data', (chunk) => hash.update(chunk)).once('error', reject).once('end', () => resolve(hash.digest('hex')));
  });
}

async function readJson(filePath, fallback = undefined) {
  try { return JSON.parse(await readFile(filePath, 'utf8')); }
  catch { return fallback; }
}

async function writeJsonAtomic(filePath, value) {
  const temporary = `${filePath}.${process.pid}.${Date.now()}.next`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await unlink(filePath).catch(() => {});
  await rename(temporary, filePath);
}

await stat(source);
await mkdir(destinationDirectory, { recursive: true });

const stagedAt = new Date().toISOString();
const sourceHash = await sha256(source);
const buildId = `${stagedAt.replace(/[-:.TZ]/g, '').slice(0, 14)}-${sourceHash.slice(0, 12)}`;
const artifact = `parakleo-student-debug-${buildId}.apk`;
const destination = path.join(destinationDirectory, artifact);
const temporaryArtifact = `${destination}.${process.pid}.next`;
await unlink(temporaryArtifact).catch(() => {});
await copyFile(source, temporaryArtifact);
await rename(temporaryArtifact, destination);

const details = await stat(destination);
const artifactDetails = { developmentClient: true, buildId, artifact, sha256: sourceHash, size: details.size, stagedAt };
const nextMetadata = `${metadata}.${process.pid}.next`;
await writeFile(nextMetadata, `${JSON.stringify(artifactDetails, null, 2)}\n`, 'utf8');
await unlink(metadata).catch(() => {});
await rename(nextMetadata, metadata);

const existingStatus = await readJson(statusPath, { history: [] });
const completedAt = stagedAt;
const statusArtifact = { ...artifactDetails, downloadUrl };
const historyEntry = {
  action: 'full-build',
  status: 'ready',
  startedAt: existingStatus.phase === 'building' ? existingStatus.startedAt ?? stagedAt : stagedAt,
  completedAt,
  artifact: statusArtifact,
  message: 'Student APK manually staged and ready for download.',
};
await writeJsonAtomic(statusPath, {
  ...existingStatus,
  schemaVersion: 1,
  projectName: 'parakleo',
  appId: 'mobile-metro',
  displayName: 'Student mobile',
  history: [historyEntry, ...(existingStatus.history ?? [])].slice(0, 20),
  phase: 'ready',
  action: 'full-build',
  message: historyEntry.message,
  startedAt: historyEntry.startedAt,
  completedAt,
  updatedAt: completedAt,
  error: null,
  artifact: statusArtifact,
});

const retained = (await readdir(destinationDirectory))
  .filter((name) => /^parakleo-student-debug-\d{14}-[a-f0-9]{12}\.apk$/.test(name))
  .sort()
  .reverse();
for (const oldArtifact of retained.slice(3)) await unlink(path.join(destinationDirectory, oldArtifact)).catch(() => {});

process.stdout.write(`Staged ${details.size} bytes as ${artifact}\n`);
