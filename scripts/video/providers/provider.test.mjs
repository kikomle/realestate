import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { getProvider, assertReferenceConstraints } from "./index.mjs";

const tmp = resolve("video/renders/test-tmp");
const img = join(tmp, "ref.png");
const shot = {
  id: "test-aerial",
  duration_s: 6,
  camera: { path: "orbit", focal_mm: 35 },
  reference_constraints: {
    reference_image: "ref.png",
    locked_geometry: ["building massing", "window grid"],
    negative: ["new windows", "extra floors"],
  },
};

test("dry_run writes a manifest with reference-frame constraints", async () => {
  mkdirSync(tmp, { recursive: true });
  writeFileSync(img, "stub");
  const outDir = join(tmp, "manifests");
  try {
    const job = await getProvider("dry_run").generate({
      imagePath: img,
      prompt: "slow orbit around the building",
      shot,
      options: { outDir },
    });
    assert.equal(job.status, "dry_run_not_submitted");
    const m = JSON.parse(readFileSync(job.manifestPath, "utf8"));
    assert.equal(m.provider, "dry_run");
    assert.equal(m.estimated_cost_usd, 0);
    assert.equal(m.reference_constraints.reference_image, "ref.png");
    assert.deepEqual(m.reference_constraints.locked_geometry, shot.reference_constraints.locked_geometry);
    assert.ok(m.reference_constraints.negative.length > 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("dry_run rejects a shot without reference constraints", async () => {
  mkdirSync(tmp, { recursive: true });
  writeFileSync(img, "stub");
  try {
    await assert.rejects(
      getProvider("dry_run").generate({ imagePath: img, prompt: "x", shot: { id: "bad" }, options: { outDir: tmp } }),
      /reference_constraints is required/,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("anonrouter is disabled by default and never spends", async () => {
  delete process.env.VIDEO_ANONROUTER_ENABLED;
  await assert.rejects(getProvider("anonrouter").generate({ imagePath: img, prompt: "x", shot }), /disabled/);
});

test("local_comfyui is disabled by default", async () => {
  delete process.env.VIDEO_LOCAL_COMFYUI;
  await assert.rejects(getProvider("local_comfyui").generate({ imagePath: img, prompt: "x", shot }), /disabled/);
});

test("assertReferenceConstraints rejects empty locked_geometry", () => {
  assert.throws(
    () => assertReferenceConstraints({ reference_constraints: { reference_image: "a", locked_geometry: [], negative: ["x"] } }),
    /locked_geometry/,
  );
});
