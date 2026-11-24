// Separate loopback-only server for the pre-gate registration proof. Never deploy this server.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const port = Number(process.argv[2] ?? 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Expected an unprivileged port');
const host = `127.0.0.1:${port}`;
const sourceRoot = resolve(root, 'assets/source/mocire-zadar-h');
const manifestPath = resolve(sourceRoot, 'raw/stage3/exterior/manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8').catch(error => {
  if (error.code === 'ENOENT') throw new Error('Run .venv/bin/python scripts/source/prepare_stage3_exterior.py first.');
  throw error;
}));
if (manifest.use !== 'PRIVATE_PREVIEW_ONLY') throw new Error('Wrong asset scope');

const shellPath = resolve(root, 'reports/qa/stage3-exterior-proof.html');
const floorInventoryPath = resolve(root, 'src/data/floors.json');
const allow = new Map([
  ['/', [shellPath, 'text/html; charset=utf-8']],
  ['/plan-review', [shellPath, 'text/html; charset=utf-8']],
  ['/assets/preview.css', [resolve(root, 'reports/qa/stage3-exterior-proof.css'), 'text/css; charset=utf-8']],
  ['/assets/preview.js', [resolve(root, 'reports/qa/stage3-exterior-proof.mjs'), 'application/javascript; charset=utf-8']],
  ['/assets/camera.js', [resolve(root, 'reports/qa/stage3-preview-camera.mjs'), 'application/javascript; charset=utf-8']],
  ['/assets/gsap.min.js', [resolve(root, 'node_modules/gsap/dist/gsap.min.js'), 'application/javascript; charset=utf-8']],
  ['/data/floors.json', [floorInventoryPath, 'application/json; charset=utf-8']],
  ['/data/registration.json', [resolve(root, 'assets/geometry/stage2/private/stage3-exterior/registration.json'), 'application/json; charset=utf-8']],
]);

for (const view of ['arrival', 'facade']) {
  const variants = manifest.views[view].variants;
  for (const width of [960, 1280, 1920]) {
    for (const format of ['avif', 'webp']) {
      const key = `${view}-${width}.${format}`;
      const asset = variants[key];
      const file = resolve(sourceRoot, asset.path);
      if (!file.startsWith(`${sourceRoot}${sep}raw${sep}`) || asset.format !== format) throw new Error(`Invalid variant ${key}`);
      const route = [`${file}`, `image/${format}`, asset.sha256];
      allow.set(`/assets/${key}`, route);
      if (width === 1920 && format === 'webp') allow.set(`/assets/${view}.webp`, route);
    }
  }
}

const headers = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
};

const server = createServer(async (req, res) => {
  function send(code, body = '', type = 'text/plain; charset=utf-8') {
    res.writeHead(code, { ...headers, 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
    res.end(req.method === 'HEAD' ? undefined : body);
  }
  if (req.headers.host !== host || req.headers['sec-fetch-site'] === 'cross-site') return send(403, 'Local preview only');
  if (!['GET', 'HEAD'].includes(req.method)) return send(405, 'Method not allowed');
  const pathname = req.url?.split('?')[0];
  if (pathname === '/favicon.ico') return send(204);
  const allowed = allow.get(pathname);
  if (!allowed) return send(404, 'Not found');
  const [file, contentType, sha256] = allowed;
  try {
    let body = await readFile(file);
    if (sha256 && createHash('sha256').update(body).digest('hex') !== sha256) return send(409, 'Preview image version mismatch');
    if (pathname === '/data/floors.json') {
      body = JSON.stringify({ floors: JSON.parse(body).floors.map(({ floor_id, label, plans }) => ({
        floor_id, label, plans: plans.map(({ image_id, variant }) => ({ image_id, variant })),
      })) });
    }
    if (pathname === '/data/registration.json' && JSON.parse(body).source_sha256 !== manifest.views.facade.source.sha256) {
      return send(409, 'The map is not registered to this image version');
    }
    return send(200, body, contentType);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error(error.message);
    return send(error.code === 'ENOENT' ? 404 : 500, 'Preview input unavailable');
  }
});

server.listen(port, '127.0.0.1', () => console.log(`Private Močire exterior preview: http://${host}/`));
