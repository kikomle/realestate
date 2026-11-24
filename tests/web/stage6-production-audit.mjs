import { createHash } from "node:crypto";
import { readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Against a local `next start`, not the private preview development server.
const port = Number(process.env.PROD_PORT ?? "3214");
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PROD_PORT");
const origin = `http://127.0.0.1:${port}`;
const root = fileURLToPath(new URL("../../", import.meta.url));
const fromRoot = path => join(root, path);
const printable = path => relative(root, path);
const json = path => JSON.parse(readFileSync(fromRoot(path), "utf8"));
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const list = path => readdirSync(path, { withFileTypes: true }).flatMap(entry => {
  const name = join(path, entry.name);
  return entry.isDirectory() ? list(name) : [name];
});
const build = fromRoot(".next");
const { floors } = json("src/data/floors.json");
const { units } = json("src/data/apartments.json");
const ledger = json("assets/source/mocire-zadar-h/stage2-manifest.json");
const exteriorManifest = json("assets/source/mocire-zadar-h/raw/stage3/exterior/manifest.json");
const planRecords = floors.flatMap(floor => floor.plans);
const exterior = "/exterior-preview";
const plans = `${exterior}/plans`;
const issues = [];

const privateDigests = new Set([
  ...ledger.assets.flatMap(asset => [asset.sha256, asset.optimized?.sha256]),
  ...Object.values(exteriorManifest.views).flatMap(view => Object.values(view.variants).map(variant => variant.sha256)),
  ...planRecords.map(plan => plan.overlay_sha256),
  ...list(fromRoot("assets/geometry/stage2/private")).map(path => sha256(readFileSync(path))),
  ...["src/data/apartments.json", "src/data/floors.json", "assets/source/mocire-zadar-h/stage2-manifest.json"]
    .map(path => sha256(readFileSync(fromRoot(path)))),
].filter(Boolean));
const privateMarkers = [
  units[0].sheet.source_url,
  units.at(-1).sheet.source_url,
  planRecords[0].private_overlay,
  planRecords.at(-1).private_plan,
].filter(Boolean);
const markerHits = bytes => {
  const text = bytes.toString("utf8").replaceAll('\\"', '"');
  // Source maps legitimately list property names. Probe for actual inventory
  // values, not just a symbol used by code that reads local files.
  return [
    ...privateMarkers.filter(marker => text.includes(marker)),
    ...(/"unit_type_source_label"\s*:\s*"[^"]+"/.test(text) ? ["unit_type_source_label value"] : []),
    ...(/"registered_units"\s*:\s*\d+/.test(text) ? ["registered_units value"] : []),
  ];
};

const tracePaths = [
  ...readdirSync(build).filter(path => path.endsWith(".nft.json")).map(path => join(build, path)),
  ...list(join(build, "server")).filter(path => path.endsWith(".nft.json")),
];
if (!tracePaths.some(path => path.startsWith(join(build, "server", "app") + "/"))) {
  throw new Error("No Next.js production app traces found; run npm run build first");
}
const privatePath = /(?:^|\/)(?:assets\/source\/|assets\/geometry\/stage2\/private\/|reports\/qa\/stage2\/private\/|src\/data\/(?:apartments|floors)\.json$)/;
const traces = tracePaths.sort().map(path => {
  const trace = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(trace.files) || trace.files.length === 0) throw new Error(`Unreadable trace: ${printable(path)}`);
  const privateFiles = trace.files.filter(file => {
    const target = resolve(dirname(path), file);
    if (privatePath.test(target)) return true;
    try { return privatePath.test(realpathSync(target)); } catch { return false; }
  });
  if (privateFiles.length) issues.push(`Private file dependencies in ${printable(path)}`);
  return { file: printable(path), entries: trace.files.length, privateFiles };
});

function scan(files) {
  const exactPrivateFiles = [];
  const dataMarkerFiles = [];
  for (const path of files) {
    const bytes = readFileSync(path);
    if (privateDigests.has(sha256(bytes))) exactPrivateFiles.push(printable(path));
    if (/\.(?:js|json|map|rsc|html|svg|txt)$/.test(path) && markerHits(bytes).length) {
      dataMarkerFiles.push(printable(path));
    }
  }
  return { files: files.length, exactPrivateFiles, dataMarkerFiles };
}

const publicScan = scan([...list(fromRoot("public")), ...list(join(build, "static"))]);
if (publicScan.exactPrivateFiles.length || publicScan.dataMarkerFiles.length) issues.push("Private content in a public or client build file");
const serverFiles = list(join(build, "server"));
const pagePayloadScan = scan(serverFiles.filter(path => /\.(html|rsc)$/.test(path)));
if (pagePayloadScan.exactPrivateFiles.length || pagePayloadScan.dataMarkerFiles.length) issues.push("Private content in a pre-rendered page payload");
const serverChunkScan = scan(serverFiles.filter(path => path.startsWith(join(build, "server", "chunks") + "/")));
if (serverChunkScan.exactPrivateFiles.length) issues.push("Exact private file contents in server chunks");
if (serverChunkScan.dataMarkerFiles.length) issues.push("Private inventory or registration markers in server chunks");

const planPages = floors.flatMap(floor => floor.plans.flatMap(plan => {
  const path = `${plans}?floor=${floor.floor_id}${plan.variant === "gallery" ? "&plan=gallery" : ""}`;
  return [path, ...floor.unit_ids.map(id => `${path}&unit=${encodeURIComponent(id)}`)];
}));
const groups = {
  homepage: ["/"],
  exteriorPages: [exterior, `${exterior}?view=facade`, ...floors.map(floor => `${exterior}?floor=${floor.floor_id}`)],
  planPages: [plans, ...planPages],
  exteriorMedia: Object.values(exteriorManifest.views).flatMap(view => Object.keys(view.variants).map(name => `${exterior}/media/${name}`)),
  floorMedia: planRecords.map(plan => `${plans}/media/${plan.image_id}.webp`),
  unitMedia: units.map(unit => `${plans}/unit-media/${unit.unit_id.replace(" ", "-")}.webp`),
  sourceAndPublicPathProbes: [
    "/assets/source/mocire-zadar-h/stage2-manifest.json",
    "/assets/source/mocire-zadar-h/raw/stage2/exterior/Mocire_H-Zadar_000.jpg",
    "/data/apartments.json",
    "/data/floors.json",
    "/data/registration.json",
    "/floorplans/L00.webp",
    "/overlays/L00.svg",
    "/overlays/L04-gallery.svg",
    "/overlays/provisional-floor-bands.svg",
    `${plans}/media/L00.svg`,
    `${plans}/unit-media/H-0.1.pdf`,
  ],
};
const http = {};
for (const [group, paths] of Object.entries(groups)) {
  if (paths.length === 0) throw new Error(`No production probes in group ${group}`);
  const expected = group === "homepage" ? 200 : 404;
  http[group] = [];
  for (const path of new Set(paths)) {
    const response = await fetch(`${origin}${path}`, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    const bytes = Buffer.from(await response.arrayBuffer());
    const unexpectedPayload = /^(image\/|application\/pdf)/i.test(response.headers.get("content-type") ?? "") ||
      (bytes.length > 0 && (privateDigests.has(sha256(bytes)) || markerHits(bytes).length > 0));
    if (response.status !== expected || unexpectedPayload) {
      issues.push(`${path}: HTTP ${response.status}, expected ${expected}; unexpected payload ${unexpectedPayload}`);
    }
    http[group].push({ path, status: response.status });
  }
  const counts = new Map();
  for (const { status } of http[group]) counts.set(status, (counts.get(status) ?? 0) + 1);
  console.log(`${group}: ${[...counts].map(([status, count]) => `${count} × HTTP ${status}`).join(", ")}`);
}

const appTraceCount = traces.filter(trace => trace.file.startsWith(".next/server/app/")).length;
console.log(`Trace audit: ${traces.length} traced manifests (${appTraceCount} app), ${traces.flatMap(trace => trace.privateFiles).length} private file dependencies`);
console.log(`Public/client files: ${publicScan.files}, exact private matches=${publicScan.exactPrivateFiles.length}, data marker matches=${publicScan.dataMarkerFiles.length}`);
console.log(`Pre-rendered HTML/RSC: ${pagePayloadScan.files}, exact private matches=${pagePayloadScan.exactPrivateFiles.length}, data marker matches=${pagePayloadScan.dataMarkerFiles.length}`);
console.log(`Server chunks/maps (not public HTML or client assets): ${serverChunkScan.dataMarkerFiles.length} files with known private source/data markers`);
console.log(`${issues.length} failures in the HTTP/file-trace checks; no publication or rights verdict.`);
if (process.argv[2]) {
  writeFileSync(process.argv[2], `${JSON.stringify({ origin, http, traces, publicScan, pagePayloadScan, serverChunkScan, issues }, null, 2)}\n`);
}
if (issues.length) {
  issues.forEach(issue => console.error(issue));
  process.exitCode = 1;
}
