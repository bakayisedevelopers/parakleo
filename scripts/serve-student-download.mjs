import { createReadStream, existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStudentBuildCoordinator } from './student-build-coordinator.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactDirectory = path.join(projectRoot, 'mobile', 'dist-download');
const metadataPath = path.join(artifactDirectory, 'parakleo-student-debug.json');
const buildStatusPath = path.join(artifactDirectory, 'preview-status.json');
const dashboardUrl = 'https://preview.bakayisedevelopers.co.za/projects/parakleo';
const host = '127.0.0.1';
const port = Number(process.env.PREVIEW_PORT ?? 10121);

function send(response, status, headers, body = '') {
  response.writeHead(status, headers);
  response.end(body);
}

async function publishedArtifact() {
  if (!existsSync(metadataPath)) return undefined;
  try {
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
    const artifactName = path.basename(metadata.artifact ?? 'parakleo-student-debug.apk');
    const apkPath = path.join(artifactDirectory, artifactName);
    return metadata.developmentClient === true && existsSync(apkPath) ? { ...metadata, apkPath } : undefined;
  } catch {
    return undefined;
  }
}

async function publicStatus() {
  let build = null;
  try { build = JSON.parse(await readFile(buildStatusPath, 'utf8')); } catch {}
  const artifact = await publishedArtifact();
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    app: { id: 'mobile-metro', name: 'Student mobile' },
    build,
    artifact: artifact ? {
      developmentClient: artifact.developmentClient,
      buildId: artifact.buildId ?? null,
      sha256: artifact.sha256 ?? null,
      size: artifact.size,
      stagedAt: artifact.stagedAt,
      downloadUrl: '/downloads/parakleo-student-debug.apk',
    } : null,
  };
}

async function serveApk(request, response) {
  const artifact = await publishedArtifact();
  if (!artifact) return send(response, 404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }, 'Student debug APK is not available yet.');
  const details = await stat(artifact.apkPath);
  const headers = {
    'content-type': 'application/vnd.android.package-archive',
    'content-disposition': 'attachment; filename="parakleo-student-debug.apk"',
    'content-length': details.size,
    'cache-control': 'no-store, max-age=0',
  };
  if (request.method === 'HEAD') return send(response, 200, headers);
  response.writeHead(200, headers);
  createReadStream(artifact.apkPath).once('error', () => response.destroy()).pipe(response);
}

const server = http.createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return send(response, 405, { allow: 'GET, HEAD' });
  if (request.url === '/health') return send(response, 200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, request.method === 'HEAD' ? '' : '{"status":"ok"}');
  if (request.url === '/api/preview-status' || request.url === '/api/student-preview-status') {
    const body = JSON.stringify(await publicStatus());
    return send(response, 200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store, max-age=0', 'access-control-allow-origin': '*' }, request.method === 'HEAD' ? '' : body);
  }
  if (request.url === '/downloads/parakleo-student-debug.apk') return serveApk(request, response);
  if (request.url === '/' || request.url === '/index.html') return send(response, 302, { location: dashboardUrl, 'cache-control': 'no-store' });
  return send(response, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Not found');
});

server.listen(port, host, () => {
  process.stdout.write(`Student APK download and build coordinator listening on http://${host}:${port}\n`);
});

const coordinator = await startStudentBuildCoordinator().catch((error) => {
  process.stderr.write(`Student build coordinator could not start: ${error instanceof Error ? error.message : String(error)}\n`);
  return null;
});

const stop = async () => {
  await coordinator?.close();
  server.close(() => process.exit(0));
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
