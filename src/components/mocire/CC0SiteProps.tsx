"use client";

import { useMemo } from "react";
import { Clone, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { BuildingCalibration } from "@/lib/mocire/types";

const TREE_URL = "/models/cc0/tree_small.glb?v=4";
const SHRUB_URL = "/models/cc0/shrub.glb?v=4";
const CAR_URL = "/models/cc0/car_modern.glb?v=4";

type Placement = {
  // Blender (x, y, z) -> Three.js (x, z, -y)
  x: number;
  y: number;
  z: number;
  rotY: number;
  scale: number;
};

type CarPlacement = Placement & {
  paintHex: string;
};

function TreeInstances({ placements }: { placements: readonly Placement[] }) {
  const { scene } = useGLTF(TREE_URL);

  useMemo(() => {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        const mat = obj.material;
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.transparent = false;
          mat.alphaTest = 0;
          mat.side = THREE.DoubleSide;
          mat.roughness = 0.82;
          mat.needsUpdate = true;
        }
      }
    });
  }, [scene]);

  return (
    <group name="cc0-trees">
      {placements.map((p, i) => (
        <Clone
          key={`tree-${i}`}
          object={scene}
          position={[p.x, p.z, -p.y]}
          rotation={[0, p.rotY, 0]}
          scale={p.scale}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

function ShrubInstances({ placements }: { placements: readonly Placement[] }) {
  const { scene } = useGLTF(SHRUB_URL);

  useMemo(() => {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        const mat = obj.material;
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.transparent = false;
          mat.alphaTest = 0;
          mat.side = THREE.DoubleSide;
          mat.roughness = 0.85;
          mat.needsUpdate = true;
        }
      }
    });
  }, [scene]);

  return (
    <group name="cc0-shrubs">
      {placements.map((p, i) => (
        <Clone
          key={`shrub-${i}`}
          object={scene}
          position={[p.x, p.z, -p.y]}
          rotation={[0, p.rotY, 0]}
          scale={p.scale}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

function CarInstances({ placements }: { placements: readonly CarPlacement[] }) {
  const { scene } = useGLTF(CAR_URL);

  // Clone once per car color variant so each parked car gets authentic European body paint
  const coloredCars = useMemo(() => {
    return placements.map((p) => {
      const copy = scene.clone(true);
      const paintColor = new THREE.Color(p.paintHex);
      copy.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          const lname = obj.name.toLowerCase();
          if (
            (lname.includes("body") || lname.includes("hood") || lname.includes("door") || lname.includes("roof") || lname.includes("fender") || lname.includes("bumper")) &&
            !lname.includes("window") &&
            !lname.includes("windshield") &&
            !lname.includes("gasket") &&
            !lname.includes("light") &&
            !lname.includes("wiper") &&
            !lname.includes("underside")
          ) {
            const origMat = obj.material;
            if (origMat instanceof THREE.MeshStandardMaterial) {
              const tinted = origMat.clone();
              tinted.color.copy(paintColor);
              tinted.metalness = 0.65;
              tinted.roughness = 0.22;
              obj.material = tinted;
            }
          }
        }
      });
      return { placement: p, object: copy };
    });
  }, [scene, placements]);

  return (
    <group name="cc0-cars">
      {coloredCars.map(({ placement: p, object }, i) => (
        <primitive
          key={`car-${i}`}
          object={object}
          position={[p.x, p.z, -p.y]}
          rotation={[0, p.rotY, 0]}
          scale={p.scale}
        />
      ))}
    </group>
  );
}

export function CC0SiteProps({ building }: { building: BuildingCalibration }) {
  const W = building.width_x;
  const D = building.depth_y;

  const trees = useMemo<Placement[]>(
    () => [
      // Front courtyard planter trees (matching Mocire_H-Zadar_000 & _001)
      { x: 5.5, y: -8.3, z: 0.5, rotY: 0.4, scale: 1.02 },
      { x: 12.8, y: -8.3, z: 0.5, rotY: 1.9, scale: 1.12 },
      { x: 20.2, y: -8.3, z: 0.5, rotY: 3.1, scale: 0.96 },
      { x: 39.8, y: -8.3, z: 0.5, rotY: 0.9, scale: 1.05 },
      { x: 48.0, y: -8.3, z: 0.5, rotY: 2.5, scale: 1.15 },
      { x: 56.5, y: -8.3, z: 0.5, rotY: 4.2, scale: 1.0 },
      // SE stepped stone planter trees (matching _001 foreground)
      { x: W + 5.5, y: -12.5, z: 0.4, rotY: 1.2, scale: 1.18 },
      { x: W + 10.2, y: -14.8, z: 0.4, rotY: 2.8, scale: 1.08 },
      { x: W + 8.5, y: -9.2, z: 0.4, rotY: 5.1, scale: 1.0 },
      // North promenade trees (matching _003 & _004)
      { x: 5.0, y: D + 6.4, z: 0.0, rotY: 0.6, scale: 1.0 },
      { x: 14.5, y: D + 6.4, z: 0.0, rotY: 2.1, scale: 1.05 },
      { x: 24.5, y: D + 6.4, z: 0.0, rotY: 3.7, scale: 0.96 },
      { x: 35.0, y: D + 6.4, z: 0.0, rotY: 1.4, scale: 1.04 },
      { x: 45.5, y: D + 6.4, z: 0.0, rotY: 4.6, scale: 1.0 },
      { x: 56.5, y: D + 6.4, z: 0.0, rotY: 2.9, scale: 1.08 },
      // Building H side trees
      { x: -10.5, y: 4.0, z: 0.0, rotY: 1.1, scale: 1.22 },
      { x: -10.5, y: 15.0, z: 0.0, rotY: 3.4, scale: 1.15 },
      { x: W + 10.5, y: 4.5, z: 0.0, rotY: 2.2, scale: 1.2 },
      { x: W + 10.5, y: 15.5, z: 0.0, rotY: 4.9, scale: 1.14 },
      // J2 & J1 central courtyard & promenade trees (exact IRL layout from mocire-zadar-h-1.jpg & h-8.jpg!)
      { x: 30.8, y: -56.0, z: 0.58, rotY: 0.7, scale: 1.04 },
      { x: 30.8, y: -68.0, z: 0.58, rotY: 2.6, scale: 1.12 },
      { x: 29.0, y: -86.0, z: 0.0, rotY: 1.8, scale: 1.08 },
      { x: -7.5, y: -46.0, z: 0.0, rotY: 3.9, scale: 1.1 },
      { x: -7.5, y: -66.0, z: 0.0, rotY: 5.2, scale: 1.16 },
      { x: -7.5, y: -86.0, z: 0.0, rotY: 1.3, scale: 1.08 },
      // Pine-woodland belt behind Building H's North facade (matching July 2025 drone photo v2-1!)
      { x: -22.0, y: D + 24.0, z: 0.0, rotY: 0.5, scale: 1.65 },
      { x: -6.0, y: D + 28.0, z: 0.0, rotY: 2.1, scale: 1.8 },
      { x: 12.0, y: D + 24.0, z: 0.0, rotY: 3.8, scale: 1.7 },
      { x: 30.0, y: D + 26.0, z: 0.0, rotY: 1.2, scale: 1.85 },
      { x: 48.0, y: D + 24.0, z: 0.0, rotY: 4.7, scale: 1.75 },
      { x: 68.0, y: D + 22.0, z: 0.0, rotY: 2.9, scale: 1.65 },
    ],
    [W, D],
  );

  const shrubs = useMemo<Placement[]>(
    () => [
      { x: 4.0, y: -8.3, z: 0.45, rotY: 0.3, scale: 1.15 },
      { x: 9.2, y: -8.1, z: 0.45, rotY: 1.8, scale: 1.05 },
      { x: 16.5, y: -8.3, z: 0.45, rotY: 2.9, scale: 1.2 },
      { x: 23.0, y: -8.0, z: 0.45, rotY: 0.8, scale: 1.0 },
      { x: 42.5, y: -8.3, z: 0.45, rotY: 3.5, scale: 1.15 },
      { x: 51.5, y: -8.1, z: 0.45, rotY: 1.4, scale: 1.1 },
      { x: 60.0, y: -8.3, z: 0.45, rotY: 4.2, scale: 1.05 },
      { x: W + 4.0, y: -15.5, z: 0.35, rotY: 1.1, scale: 1.25 },
      { x: W + 7.5, y: -16.2, z: 0.35, rotY: 2.7, scale: 1.15 },
      { x: W + 11.2, y: -12.0, z: 0.35, rotY: 4.0, scale: 1.2 },
      { x: 30.8, y: -53.0, z: 0.58, rotY: 0.9, scale: 1.1 },
      { x: 30.8, y: -71.5, z: 0.58, rotY: 2.4, scale: 1.1 },
    ],
    [W],
  );

  const cars = useMemo<CarPlacement[]>(
    () => [
      // Parked in Building H permeable grass-grid bays (South)
      { x: 6.5, y: -13.1, z: 0.0, rotY: 0.03, scale: 1.0, paintHex: "#1c2026" },
      { x: 12.5, y: -13.1, z: 0.0, rotY: -0.02, scale: 1.0, paintHex: "#c2c7ce" },
      { x: 21.5, y: -13.1, z: 0.0, rotY: 0.02, scale: 1.0, paintHex: "#edece8" },
      { x: 42.5, y: -13.1, z: 0.0, rotY: -0.03, scale: 1.0, paintHex: "#263447" },
      { x: 51.5, y: -13.1, z: 0.0, rotY: 0.02, scale: 1.0, paintHex: "#55595e" },
      { x: 57.5, y: -13.1, z: 0.0, rotY: -0.04, scale: 1.0, paintHex: "#e6e4de" },
      // Parked in J1 & J2 SW surface parking court (exact IRL bays seen in mocire-zadar-h-8.jpg!)
      { x: 44.5, y: -83.8, z: 0.0, rotY: 0.02, scale: 1.0, paintHex: "#22252a" },
      { x: 50.5, y: -83.8, z: 0.0, rotY: -0.03, scale: 1.0, paintHex: "#bfc5cc" },
      { x: 56.5, y: -83.8, z: 0.0, rotY: 0.02, scale: 1.0, paintHex: "#6e2528" },
      { x: 35.5, y: -93.8, z: 0.0, rotY: Math.PI + 0.02, scale: 1.0, paintHex: "#e8e7e2" },
      { x: 47.5, y: -93.8, z: 0.0, rotY: Math.PI - 0.02, scale: 1.0, paintHex: "#24334a" },
    ],
    [],
  );

  return (
    <>
      <TreeInstances placements={trees} />
      <ShrubInstances placements={shrubs} />
      <CarInstances placements={cars} />
    </>
  );
}
