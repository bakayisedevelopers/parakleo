import { createReadStream, existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startTutorsBuildCoordinator } from './tutors-build-coordinator.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactDirectory = path.join(projectRoot, 'tutors', 'dist-download');
const metadataPath = path.join(artifactDirectory, 'parakleo-tutors-debug.json');
const buildStatusPath = path.join(artifactDirectory, 'preview-status.json');
const studentArtifactDirectory = path.join(projectRoot, 'mobile', 'dist-download');
const studentMetadataPath = path.join(studentArtifactDirectory, 'parakleo-student-debug.json');
const studentBuildStatusPath = path.join(studentArtifactDirectory, 'preview-status.json');
const manifestPath = path.join(projectRoot, 'preview.json');
const dashboardUrl = 'https://preview.bakayisedevelopers.co.za/projects/parakleo';
const host = '127.0.0.1';
const port = Number(process.env.PREVIEW_PORT ?? 10120);

function send(response, status, headers, body = '') {
  response.writeHead(status, headers);
  response.end(body);
}

async function publishedArtifact() {
  if (!existsSync(metadataPath)) return undefined;
  try {
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
    const artifactName = path.basename(metadata.artifact ?? 'parakleo-tutors-debug.apk');
    const apkPath = path.join(artifactDirectory, artifactName);
    return metadata.developmentClient === true && existsSync(apkPath) ? { ...metadata, apkPath } : undefined;
  } catch {
    return undefined;
  }
}

async function publishedStudentArtifact() {
  if (!existsSync(studentMetadataPath)) return undefined;
  try {
    const metadata = JSON.parse(await readFile(studentMetadataPath, 'utf8'));
    const artifactName = path.basename(metadata.artifact ?? 'parakleo-student-debug.apk');
    const apkPath = path.join(studentArtifactDirectory, artifactName);
    return metadata.developmentClient === true && existsSync(apkPath) ? { ...metadata, apkPath } : undefined;
  } catch {
    return undefined;
  }
}

async function serveApk(response) {
  const artifact = await publishedArtifact();
  if (!artifact) {
    send(response, 404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }, 'Tutor debug APK is not available yet.');
    return;
  }
  response.writeHead(200, {
    'content-type': 'application/vnd.android.package-archive',
    'content-disposition': 'attachment; filename="parakleo-tutors-debug.apk"',
    'content-length': artifact.size,
    'cache-control': 'no-store, max-age=0',
  });
  createReadStream(artifact.apkPath).once('error', () => response.destroy()).pipe(response);
}

async function previewStatus() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  let supervisor = { instances: [], routes: [], error: null };
  try {
    const response = await fetch('http://127.0.0.1:9001/status', {
      signal: AbortSignal.timeout(5_000),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? 'Preview Supervisor request failed.');
    supervisor = body;
  } catch (error) {
    supervisor = { instances: [], routes: [], error: error instanceof Error ? error.message : String(error) };
  }
  let build = null;
  try { build = JSON.parse(await readFile(buildStatusPath, 'utf8')); } catch {}
  let studentBuild = null;
  try { studentBuild = JSON.parse(await readFile(studentBuildStatusPath, 'utf8')); } catch {}
  const artifact = await publishedArtifact();
  const studentArtifact = await publishedStudentArtifact();
  const routes = new Map((supervisor.routes ?? []).filter((route) => route.project_id === manifest.commanderProjectId).map((route) => [route.app_id, route]));
  const instances = new Map((supervisor.instances ?? []).filter((instance) => String(instance.app_id ?? instance.appId).startsWith(`${manifest.commanderProjectId}_`)).map((instance) => [String(instance.app_id ?? instance.appId).slice(manifest.commanderProjectId.length + 1), instance]));
  const tutorArtifact = artifact ? {
    developmentClient: artifact.developmentClient,
    buildId: artifact.buildId ?? null,
    sha256: artifact.sha256 ?? null,
    size: artifact.size,
    stagedAt: artifact.stagedAt,
    downloadUrl: '/downloads/parakleo-tutors-debug.apk',
  } : null;
  const publicStudentArtifact = studentArtifact ? {
    developmentClient: studentArtifact.developmentClient,
    buildId: studentArtifact.buildId ?? null,
    sha256: studentArtifact.sha256 ?? null,
    size: studentArtifact.size,
    stagedAt: studentArtifact.stagedAt,
    downloadUrl: 'https://parakleo-student-download.bakayisedevelopers.co.za/downloads/parakleo-student-debug.apk',
  } : null;
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    project: { id: manifest.commanderProjectId, name: manifest.projectName },
    apps: manifest.apps.map((app) => ({ app, route: routes.get(app.id) ?? null, instance: instances.get(app.id) ?? null })),
    supervisorError: supervisor.error ?? null,
    build,
    artifact: tutorArtifact,
    mobileBuilds: [
      { key: 'tutors', name: 'Tutor mobile', metroAppId: 'tutors-metro', downloadAppId: 'tutors-apk-download', build, artifact: tutorArtifact, downloadUrl: 'https://preview.bakayisedevelopers.co.za/downloads/parakleo/tutors/latest.apk' },
      { key: 'students', name: 'Student mobile', metroAppId: 'mobile-metro', downloadAppId: 'student-apk-download', build: studentBuild, artifact: publicStudentArtifact, downloadUrl: 'https://parakleo-student-download.bakayisedevelopers.co.za/downloads/parakleo-student-debug.apk' },
    ],
  };
}

const dashboard = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Parakleo Preview</title><meta name="description" content="Live Parakleo preview, build, Metro and APK status.">
<style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#07110f;color:#effaf4}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 15% 0,#183c32 0,transparent 35rem),#07110f;min-height:100vh}.shell{width:min(1120px,calc(100% - 32px));margin:auto;padding:42px 0 64px}.eyebrow{color:#8ee8bd;font-size:.76rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.head{display:flex;gap:24px;justify-content:space-between;align-items:flex-end;margin:10px 0 30px}h1{font-size:clamp(2rem,7vw,4.7rem);line-height:.95;letter-spacing:-.055em;margin:0;max-width:700px}.lede{color:#9eb5ad;max-width:400px;line-height:1.6}.grid{display:grid;grid-template-columns:1.25fr .75fr;gap:16px}.card{background:rgba(14,30,26,.88);border:1px solid #29473e;border-radius:22px;padding:22px;box-shadow:0 18px 55px #0006}.statusline{display:flex;justify-content:space-between;gap:12px;align-items:center}.badge{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:8px 12px;background:#173a30;color:#a8f5ce;font-weight:800;font-size:.78rem}.badge:before{content:'';width:8px;height:8px;border-radius:50%;background:#5ff0a8;box-shadow:0 0 16px #5ff0a8}.badge.busy:before{background:#ffc96b;box-shadow:0 0 16px #ffc96b;animation:pulse 1s infinite}.badge.failed:before{background:#ff7b7b;box-shadow:0 0 16px #ff7b7b}@keyframes pulse{50%{opacity:.25}}h2{font-size:1.35rem;margin:24px 0 8px}.muted{color:#93aaa2}.apps{display:grid;gap:10px;margin-top:18px}.app{display:grid;grid-template-columns:1fr auto;gap:8px;padding:15px 0;border-top:1px solid #223b34}.app strong{display:block}.meta{font-size:.82rem;color:#78938a;margin-top:4px}.button{display:inline-flex;justify-content:center;text-decoration:none;background:#69e9ad;color:#062017;padding:14px 18px;border-radius:13px;font-weight:900;margin-top:18px;width:100%}.history{display:grid;gap:12px;margin-top:18px}.event{padding-left:14px;border-left:2px solid #31564a}.event time{display:block;color:#769088;font-size:.78rem;margin-top:4px}.error{color:#ffaaaa;white-space:pre-wrap;font-size:.8rem;max-height:150px;overflow:auto}.footer{color:#688179;font-size:.78rem;margin-top:18px}@media(max-width:760px){.head{display:block}.lede{margin-top:18px}.grid{grid-template-columns:1fr}.shell{padding-top:26px}}
</style></head><body><main class="shell"><div class="eyebrow">Bakayise Developers · Live operations</div><div class="head"><h1>Parakleo Preview</h1><p class="lede">One clear view of the Tutor APK, Metro, and every application managed by this project.</p></div><section class="grid"><article class="card"><div class="statusline"><div><div class="eyebrow">Current activity</div><h2 id="activity">Connecting…</h2></div><span class="badge busy" id="badge">Checking</span></div><p class="muted" id="message">Reading live build and supervisor status.</p><div id="error" class="error"></div><div class="apps" id="apps"></div></article><aside class="card"><div class="eyebrow">Android development build</div><h2 id="buildId">No published build</h2><p class="muted" id="artifactMeta">The latest verified APK will appear here.</p><a class="button" id="download" href="/downloads/parakleo-tutors-debug.apk">Download latest APK</a><h2>Recent activity</h2><div class="history" id="history"><div class="muted">No build events yet.</div></div><div class="footer" id="updated">Waiting for status…</div></aside></section></main>
<script>
const esc=(value)=>String(value??'').replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const formatBytes=(bytes)=>bytes?new Intl.NumberFormat(undefined,{maximumFractionDigits:1}).format(bytes/1024/1024)+' MB':'Unknown size';
const formatTime=(value)=>value?new Date(value).toLocaleString():'Not available';
async function refresh(){try{const response=await fetch('/api/preview-status',{cache:'no-store'});if(!response.ok)throw new Error('Status returned HTTP '+response.status);const data=await response.json();const build=data.build||{};const busy=['settling','building','publishing','restarting-metro','verifying'].includes(build.phase);const failed=build.phase==='failed';const badge=document.getElementById('badge');badge.className='badge'+(busy?' busy':failed?' failed':'');badge.textContent=failed?'Needs attention':busy?'Do not change files':'Ready';document.getElementById('activity').textContent=(build.phase||'ready').replaceAll('-',' ');document.getElementById('message').textContent=build.message||'All monitored services are ready.';document.getElementById('error').textContent=build.error||data.supervisorError||'';document.getElementById('apps').innerHTML=(data.apps||[]).map((entry)=>{const app=entry.app||{};const route=entry.route||{};const instance=entry.instance||{};const state=instance.status||route.status||'unknown';return '<div class="app"><div><strong>'+esc(app.app_key||app.id)+'</strong><div class="meta">'+esc(route.hostname||app.hostname||'Internal')+' · port '+esc(route.local_port||app.local_port||'—')+'</div></div><span class="badge '+(state==='running'?'':'failed')+'">'+esc(state)+'</span></div>'}).join('')||'<div class="muted">No application records available.</div>';const artifact=data.artifact;document.getElementById('buildId').textContent=artifact?.buildId?'Build '+artifact.buildId:'Current development APK';document.getElementById('artifactMeta').textContent=artifact?formatBytes(artifact.size)+' · published '+formatTime(artifact.stagedAt):'No verified APK is currently published.';document.getElementById('download').style.display=artifact?'inline-flex':'none';document.getElementById('history').innerHTML=(build.history||[]).slice(0,6).map((event)=>'<div class="event"><strong>'+esc((event.action||'event').replaceAll('-',' '))+'</strong><div class="muted">'+esc(event.message||event.status)+'</div><time>'+esc(formatTime(event.completedAt||event.startedAt))+'</time></div>').join('')||'<div class="muted">No build events yet.</div>';document.getElementById('updated').textContent='Live status · refreshed '+formatTime(data.generatedAt)}catch(error){const badge=document.getElementById('badge');badge.className='badge failed';badge.textContent='Offline';document.getElementById('activity').textContent='Status unavailable';document.getElementById('message').textContent=error.message}}refresh();setInterval(refresh,5000);
</script></body></html>`;

const server = http.createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    send(response, 405, { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' }, 'Method not allowed');
    return;
  }
  if (request.url === '/health') {
    send(response, 200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, JSON.stringify({ status: 'ok' }));
    return;
  }
  if (request.url === '/api/preview-status') {
    const body = JSON.stringify(await previewStatus());
    send(response, 200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store, max-age=0', 'access-control-allow-origin': '*' }, request.method === 'HEAD' ? '' : body);
    return;
  }
  if (request.url === '/downloads/parakleo-tutors-debug.apk') {
    if (request.method === 'HEAD') {
      const artifact = await publishedArtifact();
      if (!artifact) return send(response, 404, { 'cache-control': 'no-store' });
      const details = await stat(artifact.apkPath);
      return send(response, 200, { 'content-type': 'application/vnd.android.package-archive', 'content-length': details.size, 'cache-control': 'no-store, max-age=0' });
    }
    await serveApk(response);
    return;
  }
  if (request.url === '/' || request.url === '/index.html') {
    send(response, 302, { location: dashboardUrl, 'cache-control': 'no-store' });
    return;
  }
  send(response, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Not found');
});

server.listen(port, host, () => {
  process.stdout.write(`Tutor APK download and preview status service listening on http://${host}:${port}\n`);
});

const coordinator = await startTutorsBuildCoordinator().catch((error) => {
  process.stderr.write(`Tutor build coordinator could not start: ${error instanceof Error ? error.message : String(error)}\n`);
  return null;
});

const stop = async () => {
  await coordinator?.close();
  server.close(() => process.exit(0));
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
