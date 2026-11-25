"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Edges, Environment, OrbitControls, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { BuildingCalibration, SelectorFloor, SelectorUnit } from "@/lib/mocire/types";
import { STATUS_META } from "@/lib/mocire/status-colors";
import { CC0SiteProps } from "./CC0SiteProps";

export type CameraPresetId = "se" | "south" | "sw" | "north" | "aerial";
export type LightingMood = "day" | "golden";

export type CameraPreset = {
  id: CameraPresetId;
  label: string;
  shortLabel: string;
  position: [number, number, number];
  target: [number, number, number];
};

// Blender (X, Y, Z) maps to Three.js (X, Z, -Y).
// Wide cinematic architectural presets framing the full building + surroundings.
export function getCameraPresets(b: BuildingCalibration): CameraPreset[] {
  const cx = b.width_x * 0.5;
  const cy = b.total_height_z * 0.44;
  const cz = -b.depth_y * 0.5;
  return [
    {
      id: "se",
      label: "Kosi JI",
      shortLabel: "JI",
      position: [cx + 58, 22, cz + 44],
      target: [cx, cy, cz],
    },
    {
      id: "south",
      label: "Pročelje Jug",
      shortLabel: "Jug",
      position: [cx, 19, cz + 60],
      target: [cx, cy + 0.6, cz],
    },
    {
      id: "sw",
      label: "Kosi JZ",
      shortLabel: "JZ",
      position: [cx - 58, 22, cz + 44],
      target: [cx, cy, cz],
    },
    {
      id: "north",
      label: "Sjever",
      shortLabel: "Sjever",
      position: [cx + 28, 18, cz - 54],
      target: [cx, cy, cz],
    },
    {
      id: "aerial",
      label: "Ptičja",
      shortLabel: "Zrak",
      position: [cx - 66, 72, cz + 168],
      target: [cx - 2, 5, cz + 38],
    },
  ];
}

/** Custom cinematic atmospheric sky dome with rich sunset gradient, glowing sun halo, and warm cloud veil. */
function CinematicSkyDome({ isGolden }: { isGolden: boolean }) {
  const uniforms = useMemo(
    () => ({
      uZenith: { value: new THREE.Color(isGolden ? "#284166" : "#4a82bd") },
      uMidSky: { value: new THREE.Color(isGolden ? "#9b7274" : "#8fbce0") },
      uHorizon: { value: new THREE.Color(isGolden ? "#f5a462" : "#d9e8f5") },
      uSunColor: { value: new THREE.Color(isGolden ? "#ffdfa0" : "#fff8e8") },
      uSunDir: {
        value: new THREE.Vector3(isGolden ? -0.58 : 0.55, isGolden ? 0.16 : 0.62, isGolden ? -0.8 : 0.56).normalize(),
      },
      uWarmth: { value: isGolden ? 1.0 : 0.25 },
    }),
    [isGolden],
  );

  return (
    <mesh scale={[580, 580, 580]} frustumCulled={false}>
      <sphereGeometry args={[1, 32, 24]} />
      <shaderMaterial
        key={isGolden ? "golden" : "day"}
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vWorldDir;
          void main() {
            vWorldDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uZenith;
          uniform vec3 uMidSky;
          uniform vec3 uHorizon;
          uniform vec3 uSunColor;
          uniform vec3 uSunDir;
          uniform float uWarmth;
          varying vec3 vWorldDir;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
          }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
          }
          float fbm(vec2 p) {
            float v = 0.0;
            float a = 0.5;
            for (int i = 0; i < 4; i++) {
              v += a * noise(p);
              p *= 2.03;
              a *= 0.5;
            }
            return v;
          }

          void main() {
            vec3 dir = normalize(vWorldDir);
            float h = clamp(dir.y, 0.0, 1.0);

            // Smooth 3-stop atmospheric sky gradient
            vec3 col = mix(uHorizon, uMidSky, smoothstep(0.0, 0.28, h));
            col = mix(col, uZenith, smoothstep(0.20, 0.78, h));

            // Backlit golden sunset sun glow & crisp solar disc
            float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
            float wideGlow = pow(sunDot, 5.0) * 0.42 * uWarmth;
            float tightHalo = pow(sunDot, 64.0) * 0.65;
            float sunDisc = smoothstep(0.9985, 0.9996, sunDot) * 1.1;
            col += uSunColor * (wideGlow + tightHalo + sunDisc);

            // Soft sunlit high-altitude Adriatic clouds
            if (dir.y > 0.03) {
              vec2 cloudUV = dir.xz / (dir.y + 0.22) * 1.45;
              float c = fbm(cloudUV + vec2(1.4, -0.8));
              float cloudMask = smoothstep(0.50, 0.80, c) * smoothstep(0.03, 0.18, dir.y) * smoothstep(0.88, 0.35, dir.y);
              vec3 cloudTint = mix(vec3(0.96, 0.94, 0.92), vec3(1.0, 0.74, 0.48), uWarmth * (0.55 + 0.45 * pow(sunDot, 2.0)));
              col = mix(col, cloudTint, cloudMask * 0.52);
            }

            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}

export type HoverPointerInfo = {
  unit: SelectorUnit;
  x: number;
  y: number;
};

type Props = {
  modelUrl: string;
  building: BuildingCalibration;
  floors: readonly SelectorFloor[];
  units: readonly SelectorUnit[];
  matchingUnitIds: ReadonlySet<string>;
  viewMode: "3d" | "plan3d";
  activeFloorId: string;
  planVariant: "main" | "gallery";
  presetId: CameraPresetId;
  presetVersion: number;
  focusVersion: number;
  sidebarOpen: boolean;
  lightingMood: LightingMood;
  selectedUnitId: string | null;
  hoveredUnitId: string | null;
  showAllOverlays: boolean;
  onHoverUnit: (info: HoverPointerInfo | null) => void;
  onSelectUnit: (unit: SelectorUnit) => void;
  onCompassAngle: (deg: number) => void;
};

const FLOOR_ORDER: Record<string, number> = { L00: 0, L01: 1, L02: 2, L03: 3, L04: 4 };

// Must match scripts/blender/calibrate_mocire_h.py wall boxes for exact pixel-to-meter alignment.
const L00_WALL_BOX = { x0: 141, x1: 1674, y0: 122, y1: 561 };
const UPPER_WALL_BOX = { x0: 1, x1: 1919, y0: 0, y1: 558 };

type ControlsLike = {
  target: THREE.Vector3;
  update: () => void;
};

function computeFloorplanPlane(
  floor: SelectorFloor,
  variant: "main" | "gallery",
  b: BuildingCalibration,
) {
  const plan =
    floor.plans.find((p) => p.variant === variant) ?? floor.plans[0];
  if (!plan) return null;

  const W = b.width_x;
  const D = b.depth_y;

  if (floor.floor_id === "L00") {
    const uScale = W / (L00_WALL_BOX.x1 - L00_WALL_BOX.x0);
    const vScale = D / (L00_WALL_BOX.y1 - L00_WALL_BOX.y0);
    const planeW = plan.width_px * uScale;
    const planeD = plan.height_px * vScale;
    const xLeft = -L00_WALL_BOX.x0 * uScale;
    const zNorth = -D - L00_WALL_BOX.y0 * vScale;
    return {
      url: plan.image_url,
      width: planeW,
      depth: planeD,
      position: [xLeft + planeW * 0.5, floor.z0 + 0.275, zNorth + planeD * 0.5] as [number, number, number],
    };
  }

  if (variant === "gallery" && floor.floor_id === "L04") {
    return {
      url: plan.image_url,
      width: W,
      depth: D,
      position: [W * 0.5, floor.z0 + 0.275, -D * 0.5] as [number, number, number],
    };
  }

  const uScale = W / (UPPER_WALL_BOX.x1 - UPPER_WALL_BOX.x0);
  const vScale = D / (UPPER_WALL_BOX.y1 - UPPER_WALL_BOX.y0);
  const planeW = plan.width_px * uScale;
  const planeD = plan.height_px * vScale;
  const xLeft = -UPPER_WALL_BOX.x0 * uScale;
  const zNorth = -D;
  return {
    url: plan.image_url,
    width: planeW,
    depth: planeD,
    position: [xLeft + planeW * 0.5, floor.z0 + 0.275, zNorth + planeD * 0.5] as [number, number, number],
  };
}

/** Projects the exact Sigma architectural floorplan image directly onto the 3D floor slab. */
function FloorplanSlabTexture({
  url,
  width,
  depth,
  position,
}: {
  url: string;
  width: number;
  depth: number;
  position: [number, number, number];
}) {
  const gl = useThree((s) => s.gl);
  const texture = useTexture(url, (loaded) => {
    const tex = Array.isArray(loaded) ? loaded[0] : loaded;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
    tex.needsUpdate = true;
  });

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.86}
        metalness={0.0}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
}

/** Build facade rectangle transforms in Three.js Y-up coordinates (X = bx, Y = bz, Z = -by). */
function getUnitFacadeRects(unit: SelectorUnit, b: BuildingCalibration) {
  const bb = unit.geometry3d.building_bbox_m;
  const padX = 0.12;
  const padZ = 0.12;
  const h = Math.max(0.5, bb.z1 - bb.z0 - padZ * 2);
  const cy = (bb.z0 + bb.z1) * 0.5;
  const isL00 = unit.floor_id === "L00";
  const inset = isL00 ? 0.22 : 0.0;
  // Slightly proud of balconies/walls/hoods so rectangles are crisp and always hover-pickable
  const southZ = unit.geometry3d.has_south_balcony
    ? 1.24
    : unit.floor_id === "L04"
      ? 1.18
      : isL00
        ? -inset + 0.22
        : 0.22;
  const northZ = -(b.depth_y - inset) - (unit.floor_id === "L04" ? 0.54 : 0.22);
  const westX = inset - 0.24;
  const eastX = b.width_x - inset + 0.24;

  const rects: {
    key: string;
    position: [number, number, number];
    rotation: [number, number, number];
    width: number;
    height: number;
  }[] = [];

  for (const side of unit.geometry3d.facades) {
    if (side === "south") {
      const w = Math.max(0.6, bb.x1 - bb.x0 - padX * 2);
      rects.push({
        key: `${unit.unit_id}-south`,
        position: [(bb.x0 + bb.x1) * 0.5, cy, southZ],
        rotation: [0, 0, 0],
        width: w,
        height: h,
      });
    } else if (side === "north") {
      const w = Math.max(0.6, bb.x1 - bb.x0 - padX * 2);
      rects.push({
        key: `${unit.unit_id}-north`,
        position: [(bb.x0 + bb.x1) * 0.5, cy, northZ],
        rotation: [0, Math.PI, 0],
        width: w,
        height: h,
      });
    } else if (side === "west") {
      const w = Math.max(0.6, bb.y1 - bb.y0 - padX * 2);
      rects.push({
        key: `${unit.unit_id}-west`,
        position: [westX, cy, -(bb.y0 + bb.y1) * 0.5],
        rotation: [0, -Math.PI * 0.5, 0],
        width: w,
        height: h,
      });
    } else if (side === "east") {
      const w = Math.max(0.6, bb.y1 - bb.y0 - padX * 2);
      rects.push({
        key: `${unit.unit_id}-east`,
        position: [eastX, cy, -(bb.y0 + bb.y1) * 0.5],
        rotation: [0, Math.PI * 0.5, 0],
        width: w,
        height: h,
      });
    }
  }
  return rects;
}

/** Build a sleek low-profile extruded footprint overlay so the real floorplan stays legible underneath. */
function buildUnitCutawayGeometry(unit: SelectorUnit): THREE.BufferGeometry {
  const pts = unit.geometry3d.polygon_m;
  const shape = new THREE.Shape();
  if (pts.length >= 3) {
    shape.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      shape.lineTo(pts[i][0], pts[i][1]);
    }
    shape.closePath();
  } else {
    const bb = unit.geometry3d.building_bbox_m;
    shape.moveTo(bb.x0, bb.y0);
    shape.lineTo(bb.x1, bb.y0);
    shape.lineTo(bb.x1, bb.y1);
    shape.lineTo(bb.x0, bb.y1);
    shape.closePath();
  }
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: false,
  });
  geom.rotateX(-Math.PI * 0.5);
  return geom;
}

function ExteriorRectOverlays({
  building,
  units,
  matchingUnitIds,
  selectedUnitId,
  hoveredUnitId,
  showAllOverlays,
  onHoverUnit,
  onSelectUnit,
}: {
  building: BuildingCalibration;
  units: readonly SelectorUnit[];
  matchingUnitIds: ReadonlySet<string>;
  selectedUnitId: string | null;
  hoveredUnitId: string | null;
  showAllOverlays: boolean;
  onHoverUnit: (info: HoverPointerInfo | null) => void;
  onSelectUnit: (unit: SelectorUnit) => void;
}) {
  const unitRects = useMemo(
    () => units.map((unit) => ({ unit, rects: getUnitFacadeRects(unit, building) })),
    [units, building],
  );

  return (
    <group name="apartment-facade-rectangles">
      {unitRects.map(({ unit, rects }) => {
        const meta = STATUS_META[unit.status];
        const isMatched = matchingUnitIds.has(unit.unit_id);
        const isHovered = hoveredUnitId === unit.unit_id;
        const isSelected = selectedUnitId === unit.unit_id;

        // Refined Vinode-style glass tint; when showAllOverlays is OFF, hide resting rectangles cleanly
        const baseOpacity = showAllOverlays ? (isMatched ? 0.26 : 0.03) : 0.0;
        const opacity = isSelected ? 0.62 : isHovered ? 0.52 : baseOpacity;
        const edgeColor = isSelected || isHovered ? "#ffffff" : meta.strokeHex;
        const edgeOpacity = isSelected || isHovered ? 1.0 : showAllOverlays ? (isMatched ? 0.92 : 0.14) : 0.0;

        return (
          <group key={unit.unit_id}>
            {rects.map((r) => (
              <mesh
                key={r.key}
                position={r.position}
                rotation={r.rotation}
                onPointerOver={(e: ThreeEvent<PointerEvent>) => {
                  e.stopPropagation();
                  document.body.style.cursor = "pointer";
                  onHoverUnit({ unit, x: e.clientX, y: e.clientY });
                }}
                onPointerMove={(e: ThreeEvent<PointerEvent>) => {
                  e.stopPropagation();
                  onHoverUnit({ unit, x: e.clientX, y: e.clientY });
                }}
                onPointerOut={(e: ThreeEvent<PointerEvent>) => {
                  e.stopPropagation();
                  document.body.style.cursor = "auto";
                  onHoverUnit(null);
                }}
                onClick={(e: ThreeEvent<MouseEvent>) => {
                  e.stopPropagation();
                  onSelectUnit(unit);
                }}
              >
                <planeGeometry args={[r.width, r.height]} />
                <meshStandardMaterial
                  color={meta.hex}
                  emissive={meta.hex}
                  emissiveIntensity={isSelected ? 0.6 : isHovered ? 0.48 : 0.22}
                  transparent
                  opacity={opacity}
                  roughness={0.25}
                  metalness={0.05}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
                <Edges
                  scale={1.0}
                  threshold={15}
                  color={edgeColor}
                  transparent
                  opacity={edgeOpacity}
                />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function CutawayFloorOverlays({
  units,
  activeFloorId,
  matchingUnitIds,
  selectedUnitId,
  hoveredUnitId,
  onHoverUnit,
  onSelectUnit,
}: {
  units: readonly SelectorUnit[];
  activeFloorId: string;
  matchingUnitIds: ReadonlySet<string>;
  selectedUnitId: string | null;
  hoveredUnitId: string | null;
  onHoverUnit: (info: HoverPointerInfo | null) => void;
  onSelectUnit: (unit: SelectorUnit) => void;
}) {
  const floorUnits = useMemo(
    () => units.filter((u) => u.floor_id === activeFloorId),
    [units, activeFloorId],
  );

  const geometries = useMemo(() => {
    return floorUnits.map((u) => ({
      unit: u,
      geometry: buildUnitCutawayGeometry(u),
      yBase: u.geometry3d.building_bbox_m.z0 + 0.3,
    }));
  }, [floorUnits]);

  useEffect(() => {
    return () => {
      geometries.forEach((item) => item.geometry.dispose());
    };
  }, [geometries]);

  return (
    <group name="apartment-cutaway-blocks">
      {geometries.map(({ unit, geometry, yBase }) => {
        const meta = STATUS_META[unit.status];
        const isMatched = matchingUnitIds.has(unit.unit_id);
        const isHovered = hoveredUnitId === unit.unit_id;
        const isSelected = selectedUnitId === unit.unit_id;
        const hasOtherSelected = selectedUnitId !== null && !isSelected;
        // Translucent Vinode-style floorplan carpet tint; gently dim neighbors when one apartment is zoomed
        const opacity = isSelected
          ? 0.44
          : isHovered
            ? 0.42
            : hasOtherSelected
              ? 0.1
              : isMatched
                ? 0.24
                : 0.05;

        return (
          <mesh
            key={unit.unit_id}
            geometry={geometry}
            position={[0, yBase, 0]}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
              onHoverUnit({ unit, x: e.clientX, y: e.clientY });
            }}
            onPointerMove={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              onHoverUnit({ unit, x: e.clientX, y: e.clientY });
            }}
            onPointerOut={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              document.body.style.cursor = "auto";
              onHoverUnit(null);
            }}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              onSelectUnit(unit);
            }}
          >
            <meshStandardMaterial
              color={meta.hex}
              emissive={meta.hex}
              emissiveIntensity={isSelected ? 0.45 : isHovered ? 0.35 : 0.14}
              transparent
              opacity={opacity}
              roughness={0.3}
              depthWrite={false}
            />
            <Edges
              threshold={25}
              color={isSelected || isHovered ? "#ffffff" : meta.strokeHex}
              transparent
              opacity={isSelected || isHovered ? 1 : isMatched ? 0.95 : 0.2}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function MocireBuildingModel({
  modelUrl,
  viewMode,
  activeFloorId,
  lightingMood,
}: {
  modelUrl: string;
  viewMode: "3d" | "plan3d";
  activeFloorId: string;
  lightingMood: LightingMood;
}) {
  const { scene } = useGLTF(modelUrl);

  useEffect(() => {
    const activeIdx = FLOOR_ORDER[activeFloorId] ?? 4;
    const isGolden = lightingMood === "golden";
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        // Boost reflective realism on architectural glazing and toggle warm interior sunset glow
        const mat = obj.material;
        if (mat instanceof THREE.MeshStandardMaterial) {
          if (mat.name === "Mocire_Glass") {
            mat.envMapIntensity = isGolden ? 2.2 : 2.0;
            mat.roughness = 0.05;
            mat.metalness = 0.24;
            mat.transparent = true;
            mat.depthWrite = false;
            mat.opacity = isGolden ? 0.46 : 0.68;
            mat.needsUpdate = true;
          } else if (mat.name === "Mocire_Warm_Interior") {
            mat.color.set("#ffad54");
            mat.emissive.set("#ff9028");
            mat.emissiveIntensity = isGolden ? 1.85 : 0.1;
            mat.needsUpdate = true;
          } else if (mat.name === "Mocire_Lantern_Glow") {
            mat.color.set("#ffbe5c");
            mat.emissive.set("#ff9824");
            mat.emissiveIntensity = isGolden ? 2.4 : 0.15;
            mat.needsUpdate = true;
          } else if (mat.name === "Mocire_Mullion") {
            mat.envMapIntensity = 1.4;
            mat.needsUpdate = true;
          } else {
            mat.envMapIntensity = 0.78;
          }
        }
      }

      const match = /^B01__(L0[0-4])__/.exec(obj.name);
      if (match) {
        const objFloorIdx = FLOOR_ORDER[match[1]] ?? 0;
        if (viewMode === "plan3d") {
          const isRoof = obj.name.includes("__roof__");
          // Hide upper floors & roof; also hide the solid corridor tile on active floor so the floorplan texture shows cleanly
          const isActiveCorridor = objFloorIdx === activeIdx && obj.name.endsWith("__slab__002");
          obj.visible = objFloorIdx <= activeIdx && !isRoof && !isActiveCorridor;
        } else {
          obj.visible = true;
        }
      }
    });
  }, [scene, viewMode, activeFloorId, lightingMood]);

  return <primitive object={scene} />;
}

function CameraDirector({
  building,
  viewMode,
  activeFloorId,
  presetId,
  presetVersion,
  focusVersion,
  sidebarOpen,
  selectedUnit,
  controlsRef,
  onCompassAngle,
}: {
  building: BuildingCalibration;
  viewMode: "3d" | "plan3d";
  activeFloorId: string;
  presetId: CameraPresetId;
  presetVersion: number;
  focusVersion: number;
  sidebarOpen: boolean;
  selectedUnit: SelectorUnit | null;
  controlsRef: React.MutableRefObject<ControlsLike | null>;
  onCompassAngle: (deg: number) => void;
}) {
  const camera = useThree((s) => s.camera);
  const goalPos = useRef<THREE.Vector3 | null>(null);
  const goalTarget = useRef<THREE.Vector3 | null>(null);
  const lastCompass = useRef<number>(0);

  const presets = useMemo(() => getCameraPresets(building), [building]);

  useEffect(() => {
    const cx = building.width_x * 0.5;
    const cz = -building.depth_y * 0.5;

    // When an apartment is selected in Plan 3D, zoom tightly onto THAT exact apartment!
    if (selectedUnit && viewMode === "plan3d") {
      const rb = selectedUnit.geometry3d.raw_bbox_m;
      const bb = selectedUnit.geometry3d.building_bbox_m;
      const ux = (bb.x0 + bb.x1) * 0.5;
      const uy = bb.z0 + 0.4;
      const uz = -((rb.y0 + rb.y1) * 0.5);
      const span = Math.max(bb.x1 - bb.x0, rb.y1 - rb.y0, 8.0);
      // Shift target left when the left sidebar is open so the zoomed apartment centers cleanly in the right pane
      const height = Math.max(13.5, Math.min(22.0, span * 1.55));
      const sidebarShiftX = sidebarOpen ? -height * 0.24 : 0;
      const tiltZ = height * 0.42;
      goalTarget.current = new THREE.Vector3(ux + sidebarShiftX, uy, uz);
      goalPos.current = new THREE.Vector3(ux + sidebarShiftX, uy + height, uz + tiltZ);
      return;
    }

    if (viewMode === "plan3d") {
      const floorZ =
        activeFloorId === "L00" ? 0.5 :
        activeFloorId === "L01" ? 3.5 :
        activeFloorId === "L02" ? 6.5 :
        activeFloorId === "L03" ? 9.5 : 13.0;
      const shiftX = sidebarOpen ? -5.5 : 0;
      goalTarget.current = new THREE.Vector3(cx + shiftX, floorZ, cz);
      goalPos.current = new THREE.Vector3(cx + shiftX, floorZ + 42, cz + 18);
      return;
    }

    if (selectedUnit) {
      const bb = selectedUnit.geometry3d.building_bbox_m;
      const ux = (bb.x0 + bb.x1) * 0.5;
      const uy = (bb.z0 + bb.z1) * 0.5;
      const uz = -(bb.y0 + bb.y1) * 0.5;
      const isSouth = selectedUnit.geometry3d.primary_side === "south";
      goalTarget.current = new THREE.Vector3(ux, uy, uz);
      goalPos.current = new THREE.Vector3(
        ux + (ux > building.width_x * 0.5 ? 10 : -10),
        Math.max(uy + 6, 9),
        isSouth ? uz + 26 : uz - 26,
      );
      return;
    }

    const preset = presets.find((p) => p.id === presetId) ?? presets[0];
    goalPos.current = new THREE.Vector3(...preset.position);
    goalTarget.current = new THREE.Vector3(...preset.target);
  }, [building, viewMode, activeFloorId, presetId, presetVersion, focusVersion, sidebarOpen, selectedUnit, presets]);

  useFrame((_, delta) => {
    const ctrl = controlsRef.current;
    if (goalPos.current && goalTarget.current && ctrl) {
      const alpha = 1 - Math.exp(-delta * 5.2);
      camera.position.lerp(goalPos.current, alpha);
      ctrl.target.lerp(goalTarget.current, alpha);
      ctrl.update();
      if (
        camera.position.distanceTo(goalPos.current) < 0.15 &&
        ctrl.target.distanceTo(goalTarget.current) < 0.15
      ) {
        goalPos.current = null;
        goalTarget.current = null;
      }
    }

    if (ctrl) {
      const dx = camera.position.x - ctrl.target.x;
      const dz = camera.position.z - ctrl.target.z;
      const deg = Math.round((Math.atan2(dx, dz) * 180) / Math.PI);
      if (Math.abs(deg - lastCompass.current) >= 2) {
        lastCompass.current = deg;
        onCompassAngle(deg);
      }
    }
  });

  useEffect(() => {
    const cancel = () => {
      goalPos.current = null;
      goalTarget.current = null;
    };
    window.addEventListener("pointerdown", cancel, { passive: true });
    window.addEventListener("wheel", cancel, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", cancel);
      window.removeEventListener("wheel", cancel);
    };
  }, []);

  return null;
}

export function BuildingCanvas3D(props: Props) {
  const controlsRef = useRef<ControlsLike | null>(null);
  const [webglOk] = useState(() => {
    if (typeof document === "undefined") return true;
    try {
      const c = document.createElement("canvas");
      return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      return false;
    }
  });

  const selectedUnit = useMemo(
    () => props.units.find((u) => u.unit_id === props.selectedUnitId) ?? null,
    [props.units, props.selectedUnitId],
  );

  const activeFloor = useMemo(
    () => props.floors.find((f) => f.floor_id === props.activeFloorId) ?? props.floors[0],
    [props.floors, props.activeFloorId],
  );

  const floorplanPlane = useMemo(
    () => (activeFloor ? computeFloorplanPlane(activeFloor, props.planVariant, props.building) : null),
    [activeFloor, props.planVariant, props.building],
  );

  const initialPreset = useMemo(
    () => getCameraPresets(props.building)[0],
    [props.building],
  );

  const handleMiss = useCallback(() => {
    props.onHoverUnit(null);
  }, [props]);

  const isGolden = props.lightingMood === "golden";
  // Dramatic low Adriatic sunset angle (raking warm sunlight + cool twilight fill)
  const sunPos: [number, number, number] = isGolden ? [112, 16, 72] : [78, 72, 62];
  const fogColor = isGolden ? "#e9c4a0" : "#cfe0ee";

  if (!webglOk) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#181715] p-8 text-center text-stone-200">
        <div className="max-w-md space-y-2">
          <p className="text-lg font-medium">3D WebGL prikaz nije dostupan u ovom pregledniku.</p>
          <p className="text-sm text-stone-400">
            Prebacite se na karticu <strong>Tlocrt 2D</strong> ili <strong>Fotografije</strong> na gornjoj traci.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full select-none" data-testid="mocire-3d-canvas">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: initialPreset.position, fov: 35, near: 0.4, far: 820 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: isGolden ? 1.12 : 1.02,
        }}
        onPointerMissed={handleMiss}
      >
        <color attach="background" args={[fogColor]} />
        <fog attach="fog" args={[fogColor, 165, 385]} />

        {/* Cinematic Adriatic Golden-Hour / Daylight Sky Dome with Sunset Clouds & Solar Halo */}
        <CinematicSkyDome isGolden={isGolden} />

        {/* Cinematic Golden-Hour Warm Key + Cool Twilight Sky Bounce */}
        <hemisphereLight
          args={[isGolden ? "#ffd19e" : "#eef6ff", isGolden ? "#57483e" : "#6c6860", isGolden ? 0.78 : 0.85]}
        />
        <directionalLight
          position={sunPos}
          intensity={isGolden ? 2.85 : 2.15}
          color={isGolden ? "#ffb96b" : "#fff7ea"}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-82}
          shadow-camera-right={82}
          shadow-camera-top={82}
          shadow-camera-bottom={-82}
          shadow-bias={-0.00025}
          shadow-normalBias={0.04}
          shadow-radius={3.5}
        />
        <directionalLight
          position={[-72, 30, -58]}
          intensity={isGolden ? 0.72 : 0.6}
          color={isGolden ? "#7da4db" : "#d4e6f8"}
        />
        {/* Warm golden courtyard pools at entrance & parking approach */}
        {isGolden && (
          <>
            <directionalLight position={[18, 8, 60]} intensity={0.4} color="#ffb966" />
            <pointLight position={[31.8, 3.2, 4.5]} intensity={14} distance={22} decay={2} color="#ffaa4c" />
          </>
        )}
        <Environment
          preset={isGolden ? "sunset" : "city"}
          environmentIntensity={isGolden ? 0.85 : 0.55}
        />

        <MocireBuildingModel
          modelUrl={props.modelUrl}
          viewMode={props.viewMode}
          activeFloorId={props.activeFloorId}
          lightingMood={props.lightingMood}
        />

        {/* Downloaded CC0 pre-made 3D trees, shrubs, and modern parked cars */}
        <Suspense fallback={null}>
          <CC0SiteProps building={props.building} />
        </Suspense>

        {/* Real Sigma architectural floorplan mapped directly onto the active 3D floor slab */}
        {props.viewMode === "plan3d" && floorplanPlane && (
          <Suspense fallback={null}>
            <FloorplanSlabTexture
              key={floorplanPlane.url}
              url={floorplanPlane.url}
              width={floorplanPlane.width}
              depth={floorplanPlane.depth}
              position={floorplanPlane.position}
            />
          </Suspense>
        )}

        {props.viewMode === "3d" ? (
          <ExteriorRectOverlays
            building={props.building}
            units={props.units}
            matchingUnitIds={props.matchingUnitIds}
            selectedUnitId={props.selectedUnitId}
            hoveredUnitId={props.hoveredUnitId}
            showAllOverlays={props.showAllOverlays}
            onHoverUnit={props.onHoverUnit}
            onSelectUnit={props.onSelectUnit}
          />
        ) : (
          <CutawayFloorOverlays
            units={props.units}
            activeFloorId={props.activeFloorId}
            matchingUnitIds={props.matchingUnitIds}
            selectedUnitId={props.selectedUnitId}
            hoveredUnitId={props.hoveredUnitId}
            onHoverUnit={props.onHoverUnit}
            onSelectUnit={props.onSelectUnit}
          />
        )}

        <OrbitControls
          ref={controlsRef as never}
          makeDefault
          target={initialPreset.target}
          enableDamping
          dampingFactor={0.07}
          minDistance={15}
          maxDistance={135}
          maxPolarAngle={Math.PI * 0.482}
          minPolarAngle={0.08}
        />

        <CameraDirector
          building={props.building}
          viewMode={props.viewMode}
          activeFloorId={props.activeFloorId}
          presetId={props.presetId}
          presetVersion={props.presetVersion}
          focusVersion={props.focusVersion}
          sidebarOpen={props.sidebarOpen}
          selectedUnit={selectedUnit}
          controlsRef={controlsRef}
          onCompassAngle={props.onCompassAngle}
        />
      </Canvas>
    </div>
  );
}
