import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Document, NodeIO } from "@gltf-transform/core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outPath = resolve(root, "public/models/test/placeholder-building.glb");

const LEVEL_H = 3.0;
const SLAB_T = 0.25;
const WALL_T = 0.3;
const UNIT_W = 6.0;
const UNIT_D = 8.0;
const BUILDING = "B01";
const LEVELS = ["L00", "L01"];
const UNITS = ["U101", "U102"];

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene("placeholder");
const building = doc.createNode(BUILDING);
scene.addChild(building);

const materials = {
  wall: doc.createMaterial("wall").setBaseColorFactor([0.86, 0.82, 0.74, 1]).setRoughnessFactor(0.9),
  slab: doc.createMaterial("slab").setBaseColorFactor([0.62, 0.6, 0.56, 1]).setRoughnessFactor(0.95),
  window: doc.createMaterial("window").setBaseColorFactor([0.55, 0.7, 0.78, 1]).setRoughnessFactor(0.2),
  roof: doc.createMaterial("roof").setBaseColorFactor([0.3, 0.3, 0.32, 1]).setRoughnessFactor(0.8),
  site: doc.createMaterial("site").setBaseColorFactor([0.7, 0.68, 0.6, 1]).setRoughnessFactor(1.0),
};

function boxPrimitive([x0, y0, z0], [x1, y1, z1], material) {
  const corners = [
    [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
    [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]],
    [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]],
    [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
    [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]],
    [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]],
  ];
  const normals = [[0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]];
  const positions = [];
  const nrm = [];
  const indices = [];
  corners.forEach((face, f) => {
    const base = f * 4;
    positions.push(...face.flat());
    for (let i = 0; i < 4; i++) nrm.push(...normals[f]);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  const position = doc.createAccessor().setType("VEC3").setArray(new Float32Array(positions)).setBuffer(buffer);
  const normal = doc.createAccessor().setType("VEC3").setArray(new Float32Array(nrm)).setBuffer(buffer);
  const index = doc.createAccessor().setType("SCALAR").setArray(new Uint16Array(indices)).setBuffer(buffer);
  return doc
    .createPrimitive()
    .setAttribute("POSITION", position)
    .setAttribute("NORMAL", normal)
    .setIndices(index)
    .setMaterial(material);
}

function addBox(parent, semanticId, min, max, materialKey) {
  const mesh = doc.createMesh(semanticId).addPrimitive(boxPrimitive(min, max, materials[materialKey]));
  const node = doc.createNode(semanticId).setMesh(mesh);
  node.setExtras({ semantic_id: semanticId, source_ref: "UNKNOWN", confidence: 1.0 });
  parent.addChild(node);
  return node;
}

const pad = (n) => String(n).padStart(3, "0");
const sid = (level, unit, type, index) => `${BUILDING}__${level}__${unit}__${type}__${pad(index)}`;

addBox(building, sid("L00", "NONE", "site", 1), [-2, -2, -0.05], [UNIT_W * 2 + 2, UNIT_D + 2, 0], "site");

LEVELS.forEach((level, li) => {
  const z0 = li * LEVEL_H;
  const z1 = z0 + LEVEL_H;
  addBox(building, sid(level, "NONE", "slab", 1), [0, 0, z0], [UNIT_W * 2, UNIT_D, z0 + SLAB_T], "slab");
  UNITS.forEach((unit, ui) => {
    const x0 = ui * UNIT_W;
    const x1 = x0 + UNIT_W;
    const wallTop = z1 - SLAB_T;
    const wallBase = z0 + SLAB_T;
    const walls = [
      [[x0, 0, wallBase], [x1, WALL_T, wallTop]],
      [[x0, UNIT_D - WALL_T, wallBase], [x1, UNIT_D, wallTop]],
      [[x0, 0, wallBase], [x0 + WALL_T, UNIT_D, wallTop]],
      [[x1 - WALL_T, 0, wallBase], [x1, UNIT_D, wallTop]],
    ];
    walls.forEach(([min, max], wi) => addBox(building, sid(level, unit, "wall", wi + 1), min, max, "wall"));
    addBox(
      building,
      sid(level, unit, "window", 1),
      [x0 + 1.5, -0.02, wallBase + 0.9],
      [x0 + 4.5, 0.0, wallBase + 2.1],
      "window",
    );
  });
});

const roofZ = LEVELS.length * LEVEL_H;
addBox(building, sid("L02", "NONE", "roof", 1), [0, 0, roofZ], [UNIT_W * 2, UNIT_D, roofZ + SLAB_T], "roof");

const glb = await new NodeIO().writeBinary(doc);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, glb);
console.log(`wrote ${outPath} (${glb.byteLength} bytes)`);
