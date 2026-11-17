import * as THREE from 'three';
import {
  AppendageSlot,
  EnemyType,
  PrimaryWeaponId,
  SecondaryWeaponId,
  ShipClassId,
  ShipWeaponVfxConfig,
  StageId,
  UpgradeId,
} from './types';
import { SHIP_CATALOG } from './stages';
import {
  ShipChassisBuild,
  ShipMaterialPalette,
  ThrusterFlameAssembly,
  applyPropulsionConfigToThrusters,
  createRealisticThrusterAssembly,
} from './ships/shipTypes';
import {
  createBathysBastionIVChassis,
  createMaelstromXIIChassis,
  createNautilusSpectreVIIChassis,
  createVanguardIXChassis,
} from './ships/tier1to4';
import {
  createAbyssalTalonChassis,
  createLeviathanBreakerChassis,
  createRiftMantaChassis,
  createTempestCorsairChassis,
} from './ships/tier5to8';
import {
  createAbyssalSovereignChassis,
  createKrakenReaperChassis,
  createPelagicAscendantChassis,
  createTrenchWardenChassis,
} from './ships/tier9to12';

export interface BiolumeDamageUniforms {
  uTime: { value: number };
  uDamageRatio: { value: number };
  uCriticalPulse: { value: number };
  uFluidColor: { value: THREE.Color };
}

export interface BossAppendage3DNode {
  id: string;
  slot: AppendageSlot;
  name: string;
  tacticalEffect: string;
  group: THREE.Group;
  localOffset: THREE.Vector3;
  hitRadius: number;
  maxHp: number;
  baseColorHex: number;
  emissiveMat: THREE.MeshStandardMaterial;
  damageUniforms: BiolumeDamageUniforms;
  fluidLeakMesh: THREE.Mesh;
  fluidLeakUniforms: BiolumeDamageUniforms;
}

/**
 * Attaches a procedural GLSL bioluminescent fracture & fluid-vein shader via onBeforeCompile
 * to a Leviathan appendage or core MeshStandardMaterial.
 * As uDamageRatio increases, glowing bioluminescent fissures open and bleed downward,
 * pulsing brighter as health crosses critical thresholds.
 */
export function attachBiolumeDamageShader(
  material: THREE.MeshStandardMaterial,
  fluidColorHex: number,
): BiolumeDamageUniforms {
  const uniforms: BiolumeDamageUniforms = {
    uTime: { value: 0 },
    uDamageRatio: { value: 0 },
    uCriticalPulse: { value: 0 },
    uFluidColor: { value: new THREE.Color(fluidColorHex) },
  };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uDamageRatio = uniforms.uDamageRatio;
    shader.uniforms.uCriticalPulse = uniforms.uCriticalPulse;
    shader.uniforms.uFluidColor = uniforms.uFluidColor;

    shader.vertexShader =
      `
      uniform float uTime;
      uniform float uDamageRatio;
      uniform float uCriticalPulse;
      varying vec3 vBiolumeLocalPos;
      ` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vBiolumeLocalPos = position;
        float spasmWave = sin(uTime * 11.0 + position.y * 4.2 + position.x * 3.1);
        transformed += normal * spasmWave * uDamageRatio * (0.06 + uCriticalPulse * 0.14);
        `,
      );

    shader.fragmentShader =
      `
      uniform float uTime;
      uniform float uDamageRatio;
      uniform float uCriticalPulse;
      uniform vec3 uFluidColor;
      varying vec3 vBiolumeLocalPos;

      float biolumeVeinField(vec3 p) {
        vec3 q = p * 2.35 + vec3(0.0, uTime * 2.6, 0.0);
        float n1 = abs(sin(q.x * 2.4 + sin(q.y * 2.1 + q.z * 1.9)));
        float n2 = abs(cos(q.y * 3.2 - cos(q.z * 2.7 - uTime * 3.4)));
        float vein = 1.0 - smoothstep(0.02, 0.24 + uDamageRatio * 0.18, n1 * n2);
        return vein;
      }
      ` +
      shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `
        #include <emissivemap_fragment>
        if (uDamageRatio > 0.02) {
          float veinMask = biolumeVeinField(vBiolumeLocalPos);
          float dripStream = 0.55 + 0.45 * sin(vBiolumeLocalPos.y * 6.5 + uTime * 8.5);
          float critBoost = 1.4 + uCriticalPulse * 4.2;
          vec3 leakGlow = uFluidColor * veinMask * dripStream * uDamageRatio * critBoost;
          vec3 hotCore = vec3(0.88, 1.0, 0.98) * pow(veinMask, 3.0) * uDamageRatio * (0.8 + uCriticalPulse * 2.4);
          totalEmissiveRadiance += leakGlow + hotCore;
        }
        `,
      );
  };

  material.needsUpdate = true;
  return uniforms;
}

/**
 * Creates a 3D procedural bioluminescent fluid-leak plume Mesh using a custom ShaderMaterial.
 * Renders animated tendrils and glowing droplets leaking from damaged Leviathan appendages.
 */
export function createBiolumeFluidLeakStream(
  fluidColorHex: number,
  offset: THREE.Vector3,
): {
  mesh: THREE.Mesh;
  uniforms: BiolumeDamageUniforms;
} {
  const uniforms: BiolumeDamageUniforms = {
    uTime: { value: 0 },
    uDamageRatio: { value: 0 },
    uCriticalPulse: { value: 0 },
    uFluidColor: { value: new THREE.Color(fluidColorHex) },
  };

  const geo = new THREE.ConeGeometry(1.35, 4.8, 18, 14, true);
  // Orient cone so narrow apex is at the wound (0,0,0) and fluid streams downward (-Y)
  geo.translate(0, -2.4, 0);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: uniforms.uTime,
      uDamageRatio: uniforms.uDamageRatio,
      uCriticalPulse: uniforms.uCriticalPulse,
      uFluidColor: uniforms.uFluidColor,
    },
    vertexShader: `
      uniform float uTime;
      uniform float uDamageRatio;
      uniform float uCriticalPulse;
      varying vec2 vUv;
      varying vec3 vNormal;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec3 pos = position;

        // Taper stream length & sway with damage ratio and deep-sea currents
        float flowDist = 1.0 - uv.y;
        float swayX = sin(flowDist * 7.5 - uTime * 7.2) * 0.42 * flowDist * uDamageRatio;
        float swayZ = cos(flowDist * 6.2 - uTime * 5.8) * 0.36 * flowDist * uDamageRatio;
        pos.x += swayX;
        pos.z += swayZ;
        pos.y *= (0.35 + 0.85 * uDamageRatio);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uDamageRatio;
      uniform float uCriticalPulse;
      uniform vec3 uFluidColor;
      varying vec2 vUv;
      varying vec3 vNormal;

      void main() {
        if (uDamageRatio <= 0.03) discard;

        // Downward-streaming bioluminescent rivulets & droplets
        float streamSpeed = 2.4 + uCriticalPulse * 2.8;
        float ribbons = sin(vUv.x * 25.1327 + sin(vUv.y * 10.0 + uTime * 4.0) * 1.6);
        float ribbonMask = smoothstep(0.1, 0.88, ribbons);

        float droplets = fract(vUv.y * 4.5 + uTime * streamSpeed + sin(vUv.x * 12.566) * 0.35);
        float dropPulse = smoothstep(0.35, 0.92, droplets);

        // Fade smoothly toward bottom tip and top attachment
        float verticalFade = smoothstep(0.0, 0.78, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
        float alpha = ribbonMask * dropPulse * verticalFade * clamp(uDamageRatio * 1.25, 0.0, 0.92);

        float brightness = 1.35 + uCriticalPulse * 1.95;
        vec3 coreWhite = vec3(0.9, 1.0, 1.0) * pow(dropPulse * ribbonMask, 2.5) * (0.5 + uCriticalPulse * 0.9);
        vec3 finalColor = uFluidColor * brightness + coreWhite;

        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(offset);
  mesh.visible = false;
  mesh.renderOrder = 5;

  return { mesh, uniforms };
}

/**
 * Procedural 3D Multi-Part Models & PBR Material Library
 * Every hero craft, enemy, and Leviathan boss is constructed as a 5–12 part THREE.Group
 * across Primary Silhouette, Secondary Read, and Accent Detail scales.
 */

export interface MaterialBank {
  titaniumHull: THREE.MeshPhysicalMaterial;
  darkGraphiteTrim: THREE.MeshStandardMaterial;
  sapphireCanopy: THREE.MeshPhysicalMaterial;
  biolumeCyan: THREE.MeshStandardMaterial;
  biolumeEmerald: THREE.MeshStandardMaterial;
  biolumeAmber: THREE.MeshStandardMaterial;
  biolumeCrimson: THREE.MeshStandardMaterial;
  biolumeMagenta: THREE.MeshStandardMaterial;
  chitinCarapace: THREE.MeshPhysicalMaterial;
  obsidianArmor: THREE.MeshStandardMaterial;
  jellyBellGlass: THREE.MeshPhysicalMaterial;
  flashWhite: THREE.MeshBasicMaterial;
}

/**
 * Generates procedural high-resolution weathered titanium & gunmetal naval hull textures:
 * - bumpMap: Interlocking hull plates, recessed seam grooves, rivet lines, inspection hatches, flood vents
 * - roughnessMap: Brushed metal anisotropy, weathered salt/pressure variation, worn plate edges
 */
function createNavalHullMaps(): {
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 512;
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  // Base neutral height (128) and base medium-low roughness (95)
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = '#626262';
  rCtx.fillRect(0, 0, size, size);

  // Fine brushed metal grain & subtle pressure-weathered mottling
  for (let i = 0; i < 2400; i++) {
    const x = (i * 73) % size;
    const y = (i * 139) % size;
    const w = 14 + (i % 38);
    const h = 1 + (i % 2);
    const shade = 118 + ((i * 19) % 22);
    bCtx.fillStyle = `rgb(${shade},${shade},${shade})`;
    bCtx.fillRect(x, y, w, h);

    const rShade = 80 + ((i * 23) % 45);
    rCtx.fillStyle = `rgb(${rShade},${rShade},${rShade})`;
    rCtx.fillRect(x, y, w, h + 1);
  }

  // Interlocking naval armor plate grid & recessed panel seams
  const rows = 8;
  const cols = 4;
  const rowH = size / rows;
  const colW = size / cols;

  for (let r = 0; r < rows; r++) {
    const y = Math.round(r * rowH);
    const stagger = (r % 2) * (colW * 0.5);

    // Horizontal recessed seam
    bCtx.fillStyle = '#262626';
    bCtx.fillRect(0, y, size, 2);
    bCtx.fillStyle = '#9e9e9e';
    bCtx.fillRect(0, y + 2, size, 1);

    rCtx.fillStyle = '#b0b0b0';
    rCtx.fillRect(0, y, size, 3);

    for (let c = 0; c < cols; c++) {
      const x = Math.round((c * colW + stagger) % size);

      // Slight per-plate height & roughness variation
      const plateDelta = ((r * 7 + c * 13) % 16) - 8;
      const pVal = 128 + plateDelta;
      bCtx.fillStyle = `rgba(${pVal},${pVal},${pVal},0.25)`;
      bCtx.fillRect(x + 3, y + 3, colW - 6, rowH - 6);

      const rVal = 92 + ((r * 11 + c * 17) % 28);
      rCtx.fillStyle = `rgba(${rVal},${rVal},${rVal},0.35)`;
      rCtx.fillRect(x + 3, y + 3, colW - 6, rowH - 6);

      // Vertical recessed seam
      bCtx.fillStyle = '#262626';
      bCtx.fillRect(x, y, 2, rowH);
      bCtx.fillStyle = '#a0a0a0';
      bCtx.fillRect(x + 2, y, 1, rowH);

      // Parallel rows of raised titanium rivets along plate borders
      bCtx.fillStyle = '#e8e8e8';
      rCtx.fillStyle = '#404040';
      const rivetStep = 10;
      for (let rx = 6; rx < colW - 6; rx += rivetStep) {
        const px = (x + rx) % size;
        bCtx.fillRect(px, y + 5, 2, 2);
        bCtx.fillRect(px, y + rowH - 7, 2, 2);
        rCtx.fillRect(px, y + 5, 2, 2);
      }
      for (let ry = 8; ry < rowH - 8; ry += rivetStep) {
        const py = y + ry;
        bCtx.fillRect((x + 5) % size, py, 2, 2);
        bCtx.fillRect((x + colW - 7) % size, py, 2, 2);
      }

      // Ballast flood louvers / inspection hatches on select plates
      if ((r + c) % 3 === 0) {
        const hx = (x + 18) % (size - 32);
        const hy = y + 14;
        bCtx.strokeStyle = '#303030';
        bCtx.lineWidth = 1.5;
        bCtx.strokeRect(hx, hy, 28, rowH - 28);
        // Louver slots
        bCtx.fillStyle = '#181818';
        for (let lv = hy + 5; lv < hy + rowH - 32; lv += 5) {
          bCtx.fillRect(hx + 5, lv, 18, 2);
        }
      }
    }
  }

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 3);

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(3, 3);

  return { bumpMap, roughnessMap };
}

/**
 * Generates a realistic thermally oxidized Inconel/Titanium exhaust nozzle texture:
 * Transitions from dark gunmetal base -> bronze/straw gold -> tempered violet -> heat-blued steel tip.
 */
function createHeatStainedNozzleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#1e242b'); // Cool gunmetal mount
  grad.addColorStop(0.38, '#4a3d2c'); // Tempered bronze-straw
  grad.addColorStop(0.66, '#6e4838'); // Copper-amber heat band
  grad.addColorStop(0.84, '#3d3552'); // Violet thermal oxidation
  grad.addColorStop(1.0, '#1d2c3f'); // Sooty heat-blued nozzle lip
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Longitudinal nozzle petal seam lines & rivets
  for (let i = 0; i < 16; i++) {
    const x = i * 16;
    ctx.fillStyle = 'rgba(10, 14, 18, 0.65)';
    ctx.fillRect(x, 0, 2, 256);
    ctx.fillStyle = 'rgba(180, 195, 210, 0.25)';
    ctx.fillRect(x + 2, 0, 1, 256);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createMaterialBank(isSoftwareGl: boolean): MaterialBank {
  const { bumpMap, roughnessMap } = createNavalHullMaps();

  return {
    titaniumHull: new THREE.MeshPhysicalMaterial({
      color: 0x5c6977,
      metalness: 0.88,
      roughness: 0.34,
      bumpMap,
      bumpScale: 0.028,
      roughnessMap,
      clearcoat: 0.25,
      clearcoatRoughness: 0.35,
      anisotropy: isSoftwareGl ? 0 : 0.55,
    }),
    darkGraphiteTrim: new THREE.MeshStandardMaterial({
      color: 0x1c2229,
      metalness: 0.78,
      roughness: 0.48,
      bumpMap,
      bumpScale: 0.018,
    }),
    sapphireCanopy: new THREE.MeshPhysicalMaterial({
      color: 0x192836,
      metalness: 0.15,
      roughness: 0.08,
      transmission: isSoftwareGl ? 0 : 0.78,
      transparent: true,
      opacity: isSoftwareGl ? 0.68 : 0.92,
      ior: 1.52,
      thickness: 0.8,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      depthWrite: false,
    }),
    biolumeCyan: new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.2,
      roughness: 0.2,
      metalness: 0.1,
    }),
    biolumeEmerald: new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 2.0,
      roughness: 0.2,
      metalness: 0.1,
    }),
    biolumeAmber: new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.3,
      roughness: 0.25,
      metalness: 0.1,
    }),
    biolumeCrimson: new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xf43f5e,
      emissiveIntensity: 2.5,
      roughness: 0.2,
      metalness: 0.1,
    }),
    biolumeMagenta: new THREE.MeshStandardMaterial({
      color: 0xd946ef,
      emissive: 0xd946ef,
      emissiveIntensity: 2.1,
      roughness: 0.22,
      metalness: 0.15,
    }),
    chitinCarapace: new THREE.MeshPhysicalMaterial({
      color: 0x0f2942,
      metalness: 0.45,
      roughness: 0.28,
      clearcoat: 0.85,
      clearcoatRoughness: 0.15,
    }),
    obsidianArmor: new THREE.MeshStandardMaterial({
      color: 0x161926,
      metalness: 0.72,
      roughness: 0.56,
    }),
    jellyBellGlass: new THREE.MeshPhysicalMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 0.65,
      roughness: 0.12,
      metalness: 0.05,
      transmission: isSoftwareGl ? 0 : 0.75,
      transparent: true,
      opacity: isSoftwareGl ? 0.58 : 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    flashWhite: new THREE.MeshBasicMaterial({
      color: 0xffffff,
    }),
  };
}

export interface ShipLoadoutVisualConfig {
  shipId: ShipClassId;
  trimHex: number;
  primaryWeaponId?: PrimaryWeaponId;
  secondaryWeaponId?: SecondaryWeaponId;
  activeUpgrades?: UpgradeId[];
  upgradeTiers?: Record<UpgradeId, number>;
  pilotLevel?: number;
}

interface ShipHardpointLayout {
  primaryMounts: Array<{ pos: [number, number, number]; scale: number }>;
  secondaryMounts: Array<{ pos: [number, number, number]; scale: number }>;
}

const SHIP_HARDPOINT_LAYOUTS: Record<ShipClassId, ShipHardpointLayout> = {
  vanguard_interceptor: {
    primaryMounts: [
      { pos: [-0.82, -0.06, -1.15], scale: 0.92 },
      { pos: [0.82, -0.06, -1.15], scale: 0.92 },
    ],
    secondaryMounts: [
      { pos: [-1.18, -0.22, 0.15], scale: 0.92 },
      { pos: [1.18, -0.22, 0.15], scale: 0.92 },
    ],
  },
  leviathan_assault: {
    primaryMounts: [
      { pos: [-1.18, -0.04, -0.88], scale: 0.86 },
      { pos: [1.18, -0.04, -0.88], scale: 0.86 },
      { pos: [-2.28, -0.08, -0.18], scale: 0.82 },
      { pos: [2.28, -0.08, -0.18], scale: 0.82 },
    ],
    secondaryMounts: [
      { pos: [-1.62, -0.18, 0.2], scale: 0.96 },
      { pos: [1.62, -0.18, 0.2], scale: 0.96 },
    ],
  },
  echo_tactical: {
    primaryMounts: [
      { pos: [-0.96, -0.08, -1.08], scale: 0.82 },
      { pos: [0.96, -0.08, -1.08], scale: 0.82 },
    ],
    secondaryMounts: [
      { pos: [-0.72, -0.24, 0.05], scale: 0.85 },
      { pos: [0.72, -0.24, 0.05], scale: 0.85 },
    ],
  },
  aegis_guardian: {
    primaryMounts: [
      { pos: [-1.78, 0.14, -0.62], scale: 1.26 },
      { pos: [1.78, 0.14, -0.62], scale: 1.26 },
    ],
    secondaryMounts: [
      { pos: [-2.38, -0.12, 0.15], scale: 1.15 },
      { pos: [2.38, -0.12, 0.15], scale: 1.15 },
    ],
  },
  abyssal_talon: {
    primaryMounts: [
      { pos: [-1.82, -0.05, -0.52], scale: 0.98 },
      { pos: [1.82, -0.05, -0.52], scale: 0.98 },
    ],
    secondaryMounts: [
      { pos: [-0.74, -0.16, -0.72], scale: 0.92 },
      { pos: [0.74, -0.16, -0.72], scale: 0.92 },
    ],
  },
  tempest_corsair: {
    primaryMounts: [
      { pos: [-1.36, 0.02, -1.02], scale: 1.02 },
      { pos: [1.36, 0.02, -1.02], scale: 1.02 },
    ],
    secondaryMounts: [
      { pos: [-1.15, -0.25, 0.1], scale: 1.0 },
      { pos: [1.15, -0.25, 0.1], scale: 1.0 },
    ],
  },
  rift_manta: {
    primaryMounts: [
      { pos: [-2.98, 0.02, 0.08], scale: 0.95 },
      { pos: [2.98, 0.02, 0.08], scale: 0.95 },
    ],
    secondaryMounts: [
      { pos: [-1.76, -0.18, 0.18], scale: 0.95 },
      { pos: [1.76, -0.18, 0.18], scale: 0.95 },
    ],
  },
  leviathan_breaker: {
    primaryMounts: [
      { pos: [0, 0.3, -1.25], scale: 1.32 },
      { pos: [-1.58, 0.02, -0.72], scale: 1.02 },
      { pos: [1.58, 0.02, -0.72], scale: 1.02 },
    ],
    secondaryMounts: [
      { pos: [-1.95, -0.2, 0.05], scale: 1.16 },
      { pos: [1.95, -0.2, 0.05], scale: 1.16 },
    ],
  },
  trench_warden: {
    primaryMounts: [
      { pos: [-2.12, 0.2, -0.32], scale: 0.95 },
      { pos: [2.12, 0.2, -0.32], scale: 0.95 },
      { pos: [-1.08, 0.24, -0.78], scale: 0.88 },
      { pos: [1.08, 0.24, -0.78], scale: 0.88 },
    ],
    secondaryMounts: [
      { pos: [-1.55, -0.22, 0.2], scale: 1.05 },
      { pos: [1.55, -0.22, 0.2], scale: 1.05 },
    ],
  },
  kraken_reaper: {
    primaryMounts: [
      { pos: [-2.18, 0.38, -0.82], scale: 0.92 },
      { pos: [2.18, 0.38, -0.82], scale: 0.92 },
      { pos: [-2.28, -0.32, -0.68], scale: 0.92 },
      { pos: [2.28, -0.32, -0.68], scale: 0.92 },
    ],
    secondaryMounts: [
      { pos: [-1.35, -0.24, 0.15], scale: 1.06 },
      { pos: [1.35, -0.24, 0.15], scale: 1.06 },
    ],
  },
  abyssal_sovereign: {
    primaryMounts: [
      { pos: [-1.12, 0.32, -1.12], scale: 1.08 },
      { pos: [1.12, 0.32, -1.12], scale: 1.08 },
      { pos: [-2.15, 0.12, -0.24], scale: 0.98 },
      { pos: [2.15, 0.12, -0.24], scale: 0.98 },
    ],
    secondaryMounts: [
      { pos: [-1.58, -0.22, 0.22], scale: 1.18 },
      { pos: [1.58, -0.22, 0.22], scale: 1.18 },
    ],
  },
  pelagic_ascendant: {
    primaryMounts: [
      { pos: [-0.74, 0.16, -1.38], scale: 1.16 },
      { pos: [0.74, 0.16, -1.38], scale: 1.16 },
      { pos: [-2.35, 0.18, -0.28], scale: 0.92 },
      { pos: [2.35, 0.18, -0.28], scale: 0.92 },
    ],
    secondaryMounts: [
      { pos: [-1.52, -0.22, 0.16], scale: 1.15 },
      { pos: [1.52, -0.22, 0.16], scale: 1.15 },
    ],
  },
};

/**
 * Builds all 12 distinct, high-detail deep-ocean Pelagic Vanguard combat vessels,
 * per-ship 3D Primary Weapon mounts, Naval Torpedo/Missile racks,
 * 8 mechanical Instrument Modules, Bolted Reactive Armor tier evolution,
 * and per-ship variable-geometry GLSL ion-cavitation exhausts.
 */
export function createVanguardShip(mats: MaterialBank): {
  group: THREE.Group;
  thrusterLeft: THREE.Mesh;
  thrusterRight: THREE.Mesh;
  turbineRing: THREE.Mesh;
  shieldSphere: THREE.Mesh;
  setAppearance: (
    shipId: ShipClassId,
    trimHex: number,
    loadout?: Partial<ShipLoadoutVisualConfig>,
  ) => void;
  setAbilityVisualState: (active: boolean) => void;
  triggerWeaponFire: (isSecondary?: boolean) => void;
  getPrimaryMuzzleOffsets: () => THREE.Vector3[];
  getSecondaryMuzzleOffsets: () => THREE.Vector3[];
  updateShipEffects: (
    elapsed: number,
    dt: number,
    surgeBoost: number,
    turnSteer?: number,
    damageRatio?: number,
    isRolling?: boolean,
  ) => void;
} {
  const group = new THREE.Group();

  // Shared high-fidelity deep-ocean materials
  const heatStainTex = createHeatStainedNozzleTexture();
  const heatStainedNozzleMat = new THREE.MeshStandardMaterial({
    map: heatStainTex,
    bumpMap: mats.titaniumHull.bumpMap,
    bumpScale: 0.02,
    metalness: 0.88,
    roughness: 0.32,
  });

  const machinedSteelMat = new THREE.MeshStandardMaterial({
    color: 0x8c99a6,
    metalness: 0.92,
    roughness: 0.26,
    bumpMap: mats.titaniumHull.bumpMap,
    bumpScale: 0.012,
  });

  const navalBronzeMat = new THREE.MeshStandardMaterial({
    color: 0x8a6d3b,
    metalness: 0.86,
    roughness: 0.32,
  });

  const anechoicRubberMat = new THREE.MeshStandardMaterial({
    color: 0x161a1f,
    metalness: 0.25,
    roughness: 0.72,
    bumpMap: mats.titaniumHull.bumpMap,
    bumpScale: 0.022,
  });

  const shipTrimMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.95,
    roughness: 0.32,
    metalness: 0.65,
  });

  const cloneHull = (hex: number, metalness: number, roughness: number) => {
    const m = mats.titaniumHull.clone();
    m.color.setHex(hex);
    m.metalness = metalness;
    m.roughness = roughness;
    return m;
  };

  const palette: ShipMaterialPalette = {
    mats,
    heatStainedNozzleMat,
    machinedSteelMat,
    navalBronzeMat,
    anechoicRubberMat,
    shipTrimMat,
    whiteTitaniumMat: cloneHull(0xdce6f2, 0.84, 0.24),
    gunmetalMat: cloneHull(0x28303b, 0.88, 0.34),
    abyssalCeramicMat: cloneHull(0x131722, 0.68, 0.38),
    guardianTungstenMat: cloneHull(0x3a444d, 0.86, 0.35),
    goldGildedMat: cloneHull(0xd4a442, 0.92, 0.22),
    pearlWhiteMat: cloneHull(0xeaf2f8, 0.76, 0.18),
    deepNavyMat: cloneHull(0x1e334d, 0.85, 0.3),
    teakTealMat: cloneHull(0x183c40, 0.78, 0.32),
    obsidianArmorMat: cloneHull(0x14151c, 0.84, 0.28),
  };

  const muzzleFlashCoreMat = new THREE.MeshBasicMaterial({
    color: 0xecfeff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const muzzleFlashFireMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const thrusterAssemblies: ThrusterFlameAssembly[] = [];

  // ============================================================================
  // 1. ALL 12 UNIQUE PELAGIC VANGUARD COMBAT VESSEL CHASSIS
  // ============================================================================
  const shipBuilds: ShipChassisBuild[] = [
    createVanguardIXChassis(palette),
    createMaelstromXIIChassis(palette),
    createNautilusSpectreVIIChassis(palette),
    createBathysBastionIVChassis(palette),
    createAbyssalTalonChassis(palette),
    createTempestCorsairChassis(palette),
    createRiftMantaChassis(palette),
    createLeviathanBreakerChassis(palette),
    createTrenchWardenChassis(palette),
    createKrakenReaperChassis(palette),
    createAbyssalSovereignChassis(palette),
    createPelagicAscendantChassis(palette),
  ];

  shipBuilds.forEach((build, index) => {
    build.root.visible = index === 0;
    group.add(build.root);
    thrusterAssemblies.push(...build.thrusters);
  });

  // ============================================================================
  // 2. PER-SHIP MULTI-MOUNT PRIMARY WEAPON TURRET PODS (Up to 4 Hardpoints)
  // ============================================================================
  const primaryWeaponsRoot = new THREE.Group();
  group.add(primaryWeaponsRoot);

  interface PrimaryMountPod {
    root: THREE.Group;
    cavitationModel: THREE.Group;
    lanceModel: THREE.Group;
    scatterModel: THREE.Group;
    muzzleFlash: THREE.Group;
    rotaryCluster: THREE.Group;
  }

  const primaryMountPods: PrimaryMountPod[] = [];
  const muzzleFlashGroups: THREE.Group[] = [];

  for (let mIdx = 0; mIdx < 4; mIdx++) {
    const podRoot = new THREE.Group();

    // 2A. Cavitation Cannons (`cavitation_cannons`)
    const cavModel = new THREE.Group();
    const receiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.22, 0.68),
      mats.darkGraphiteTrim,
    );
    receiver.position.set(0, 0, 0.26);
    const ammoChute = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.12, 0.36),
      navalBronzeMat,
    );
    ammoChute.position.set(0, -0.05, 0.28);
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.068, 1.48, 12).rotateX(Math.PI / 2),
      machinedSteelMat,
    );
    barrel.position.set(0, 0, -0.38);
    const coolingJacket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.095, 0.82, 12).rotateX(Math.PI / 2),
      heatStainedNozzleMat,
    );
    coolingJacket.position.set(0, 0, -0.15);
    const muzzleBrake = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.068, 0.24, 12).rotateX(Math.PI / 2),
      shipTrimMat,
    );
    muzzleBrake.position.set(0, 0, -1.12);
    cavModel.add(receiver, ammoChute, barrel, coolingJacket, muzzleBrake);
    podRoot.add(cavModel);

    // 2B. Thermal Lance Array (`focused_bio_lance`)
    const lanceModel = new THREE.Group();
    const breechBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.28, 0.74),
      mats.darkGraphiteTrim,
    );
    breechBlock.position.set(0, 0, 0.32);
    const railUpper = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 0.065, 1.72),
      machinedSteelMat,
    );
    railUpper.position.set(0, 0.07, -0.34);
    const railLower = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 0.065, 1.72),
      machinedSteelMat,
    );
    railLower.position.set(0, -0.07, -0.34);
    const plasmaConduit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.042, 1.65, 10).rotateX(Math.PI / 2),
      mats.biolumeAmber,
    );
    plasmaConduit.position.set(0, 0, -0.32);
    for (let c = 0; c < 3; c++) {
      const clamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.22, 0.09),
        navalBronzeMat,
      );
      clamp.position.set(0, 0, 0.06 - c * 0.42);
      lanceModel.add(clamp);
    }
    lanceModel.add(breechBlock, railUpper, railLower, plasmaConduit);
    lanceModel.visible = false;
    podRoot.add(lanceModel);

    // 2C. Arc Shard Scatter (`burst_pulse_repeater`)
    const scatterModel = new THREE.Group();
    const ammoDrum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.21, 0.64, 14).rotateX(Math.PI / 2),
      mats.darkGraphiteTrim,
    );
    ammoDrum.position.set(0, 0, 0.16);
    const crystalRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.028, 8, 14),
      mats.biolumeEmerald,
    );
    crystalRing.position.set(0, 0, -0.12);
    scatterModel.add(ammoDrum, crystalRing);

    const rotaryCluster = new THREE.Group();
    rotaryCluster.position.set(0, 0, -0.46);
    for (let b = 0; b < 6; b++) {
      const ang = (b / 6) * Math.PI * 2;
      const miniBarrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.024, 1.28, 8).rotateX(Math.PI / 2),
        machinedSteelMat,
      );
      miniBarrel.position.set(Math.cos(ang) * 0.075, Math.sin(ang) * 0.075, 0);
      rotaryCluster.add(miniBarrel);
    }
    scatterModel.add(rotaryCluster);
    scatterModel.visible = false;
    podRoot.add(scatterModel);

    // 2D. Muzzle Cavitation Burst & Hydro-Shock Ring
    const mf = new THREE.Group();
    mf.position.set(0, 0, -1.25);
    const coreBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 10, 10),
      muzzleFlashCoreMat,
    );
    const flameCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 0.85, 10).rotateX(-Math.PI / 2),
      muzzleFlashFireMat,
    );
    flameCone.position.set(0, 0, -0.34);
    const shockRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.03, 8, 18),
      muzzleFlashCoreMat,
    );
    mf.add(coreBall, flameCone, shockRing);
    mf.visible = false;
    podRoot.add(mf);
    muzzleFlashGroups.push(mf);

    primaryWeaponsRoot.add(podRoot);
    primaryMountPods.push({
      root: podRoot,
      cavitationModel: cavModel,
      lanceModel,
      scatterModel,
      muzzleFlash: mf,
      rotaryCluster,
    });
  }

  // ============================================================================
  // 3. PER-SHIP SECONDARY TORPEDO & SWARM ORDNANCE PODS
  // ============================================================================
  const secondaryOrdnanceRoot = new THREE.Group();
  group.add(secondaryOrdnanceRoot);

  // 3A. Sonic Torpedoes (`sonic_torpedoes`)
  const secSonicPodsGroup = new THREE.Group();
  [-1.32, 1.32].forEach((sideX) => {
    const pylon = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.22, 0.65),
      machinedSteelMat,
    );
    pylon.position.set(sideX, -0.14, 0.15);
    secSonicPodsGroup.add(pylon);

    [
      [-0.11, 0.05],
      [0.11, 0.05],
      [0, -0.09],
    ].forEach(([ox, oy]) => {
      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.095, 1.28, 12).rotateX(Math.PI / 2),
        mats.darkGraphiteTrim,
      );
      tube.position.set(sideX + ox, -0.28 + oy, 0.12);

      const warhead = new THREE.Mesh(
        new THREE.SphereGeometry(0.088, 12, 10),
        shipTrimMat,
      );
      warhead.position.set(sideX + ox, -0.28 + oy, -0.52);

      secSonicPodsGroup.add(tube, warhead);
    });
  });
  secondaryOrdnanceRoot.add(secSonicPodsGroup);

  // 3B. EMP Depth Seekers (`heavy_breach_torpedo`)
  const secHeavyBreachGroup = new THREE.Group();
  [-1.35, 1.35].forEach((sideX) => {
    const pylon = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.24, 0.78),
      machinedSteelMat,
    );
    pylon.position.set(sideX, -0.15, 0.05);

    const torpBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 1.62, 16).rotateX(Math.PI / 2),
      anechoicRubberMat,
    );
    torpBody.position.set(sideX, -0.32, 0.05);

    const empCoilBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.028, 8, 16),
      mats.biolumeCyan,
    );
    empCoilBand.position.set(sideX, -0.32, -0.48);

    const noseDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 14, 12),
      machinedSteelMat,
    );
    noseDome.scale.set(1, 1, 1.35);
    noseDome.position.set(sideX, -0.32, -0.76);

    const tailShroud = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.16, 0.28, 14).rotateX(Math.PI / 2),
      machinedSteelMat,
    );
    tailShroud.position.set(sideX, -0.32, 0.85);

    secHeavyBreachGroup.add(
      pylon,
      torpBody,
      empCoilBand,
      noseDome,
      tailShroud,
    );
  });
  secHeavyBreachGroup.visible = false;
  secondaryOrdnanceRoot.add(secHeavyBreachGroup);

  // 3C. Hadal Swarm Pods (`hexa_swarm_rack`)
  const secHexaSwarmGroup = new THREE.Group();
  [-1.35, 1.35].forEach((sideX) => {
    const rackBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.36, 1.02),
      mats.darkGraphiteTrim,
    );
    rackBox.position.set(sideX, -0.28, 0.15);
    secHexaSwarmGroup.add(rackBox);

    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const cellTube = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.06, 0.12, 10).rotateX(Math.PI / 2),
          machinedSteelMat,
        );
        cellTube.position.set(
          sideX + (c - 1) * 0.15,
          -0.28 + (r - 0.5) * 0.14,
          -0.36,
        );
        const missileTip = new THREE.Mesh(
          new THREE.ConeGeometry(0.05, 0.18, 10).rotateX(-Math.PI / 2),
          mats.biolumeEmerald,
        );
        missileTip.position.set(
          sideX + (c - 1) * 0.15,
          -0.28 + (r - 0.5) * 0.14,
          -0.44,
        );
        secHexaSwarmGroup.add(cellTube, missileTip);
      }
    }
  });
  secHexaSwarmGroup.visible = false;
  secondaryOrdnanceRoot.add(secHexaSwarmGroup);

  // ============================================================================
  // 4. EIGHT REALISTIC MECHANICAL MODULE HARDPOINTS + BOLTED ARMOR EVOLUTION
  // ============================================================================
  const instrumentsRoot = new THREE.Group();
  group.add(instrumentsRoot);

  // 4.1 `cavitation_overcharge`: High-Pressure Hydraulic Accumulator Cylinders on Wing Roots
  const modOverchargeGroup = new THREE.Group();
  [-1.92, 1.92].forEach((sideX) => {
    for (let i = 0; i < 2; i++) {
      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(0.16, 0.028, 8, 16),
        navalBronzeMat,
      );
      collar.position.set(sideX, -0.05, -0.32 - i * 0.42);
      modOverchargeGroup.add(collar);
    }
  });
  modOverchargeGroup.visible = false;
  instrumentsRoot.add(modOverchargeGroup);

  // 4.2 `quad_torpedo_salvo`: Dorsal Armored VLS Multi-Tube Reload Pod
  const modQuadSalvoGroup = new THREE.Group();
  {
    const dorsalPod = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.26, 0.94),
      mats.darkGraphiteTrim,
    );
    dorsalPod.position.set(0, 0.52, 0.55);
    modQuadSalvoGroup.add(dorsalPod);
    [-0.21, -0.07, 0.07, 0.21].forEach((ox) => {
      const tubeCollar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.16, 10).rotateX(Math.PI / 2),
        machinedSteelMat,
      );
      tubeCollar.position.set(ox, 0.54, 0.05);
      const warheadTip = new THREE.Mesh(
        new THREE.ConeGeometry(0.048, 0.18, 10).rotateX(-Math.PI / 2),
        navalBronzeMat,
      );
      warheadTip.position.set(ox, 0.54, -0.05);
      modQuadSalvoGroup.add(tubeCollar, warheadTip);
    });
  }
  modQuadSalvoGroup.visible = false;
  instrumentsRoot.add(modQuadSalvoGroup);

  // 4.3 `piezo_hull_regen`: Sacrificial Anode & Hull Integrity Welded Reinforcement Strakes
  const modHullRegenGroup = new THREE.Group();
  [-0.54, 0.54].forEach((sideX) => {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.07, 1.75),
      machinedSteelMat,
    );
    strip.position.set(sideX, 0.26, 0.15);
    modHullRegenGroup.add(strip);
  });
  modHullRegenGroup.visible = false;
  instrumentsRoot.add(modHullRegenGroup);

  // 4.4 `hydro_thruster_coil`: Outboard Shrouded Auxiliary Pump-Jet Booster Pods
  const modThrusterCoilGroup = new THREE.Group();
  [-1.58, 1.58].forEach((sideX) => {
    const auxPod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.21, 1.15, 14).rotateX(Math.PI / 2),
      mats.darkGraphiteTrim,
    );
    auxPod.position.set(sideX, 0.06, 1.05);
    modThrusterCoilGroup.add(auxPod);

    const auxFlame = createRealisticThrusterAssembly(
      heatStainedNozzleMat,
      machinedSteelMat,
      0.56,
      0x38bdf8,
      0x06b6d4,
      0x7dd3fc,
    );
    auxFlame.root.position.set(sideX, 0.06, 1.68);
    modThrusterCoilGroup.add(auxFlame.root);
    thrusterAssemblies.push(auxFlame);
  });
  modThrusterCoilGroup.visible = false;
  instrumentsRoot.add(modThrusterCoilGroup);

  // 4.5 `voltaic_shield_capacitor`: Four Naval Degaussing & Acoustic Baffle Coils
  const modShieldCapGroup = new THREE.Group();
  [
    [-1.15, 0.32, -0.15],
    [1.15, 0.32, -0.15],
    [-1.15, -0.26, 0.45],
    [1.15, -0.26, 0.45],
  ].forEach(([x, y, z]) => {
    const emitter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.17, 0.16, 8),
      navalBronzeMat,
    );
    emitter.position.set(x, y, z);
    modShieldCapGroup.add(emitter);
  });
  modShieldCapGroup.visible = false;
  instrumentsRoot.add(modShieldCapGroup);

  // 4.6 `sonar_crit_visor`: Chin-Mounted Gimbaled FLIR / Hydro-Optic Targeting Turret Ball
  const modSonarVisorGroup = new THREE.Group();
  {
    const mountCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.18, 0.22, 12),
      mats.darkGraphiteTrim,
    );
    mountCollar.position.set(0, -0.22, -1.75);
    const flirBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 14, 14),
      machinedSteelMat,
    );
    flirBall.position.set(0, -0.32, -1.75);
    const opticLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 0.08, 12).rotateX(Math.PI / 2),
      mats.sapphireCanopy,
    );
    opticLens.position.set(0, -0.32, -1.89);
    modSonarVisorGroup.add(mountCollar, flirBall, opticLens);
  }
  modSonarVisorGroup.visible = false;
  instrumentsRoot.add(modSonarVisorGroup);

  // 4.7 `hadal_pressure_Bulkhead`: Heavy Bolted Sloped Reactive Armor (ERA) Cheek Plates
  const modBulkheadGroup = new THREE.Group();
  [-1.08, 1.08].forEach((sideX) => {
    const armorPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.22, 1.82),
      machinedSteelMat,
    );
    armorPlate.position.set(sideX, 0.14, -0.2);
    armorPlate.rotation.z = sideX < 0 ? 0.32 : -0.32;
    modBulkheadGroup.add(armorPlate);
  });
  modBulkheadGroup.visible = false;
  instrumentsRoot.add(modBulkheadGroup);

  // 4.8 `biolume_siphon_array`: Lateral Hydro-Ram Intake Scoops with Boundary-Layer Splitters
  const modSiphonGroup = new THREE.Group();
  [-2.35, 2.35].forEach((sideX) => {
    const scoop = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.22, 0.88),
      mats.darkGraphiteTrim,
    );
    scoop.position.set(sideX, 0.1, -0.15);
    modSiphonGroup.add(scoop);
  });
  modSiphonGroup.visible = false;
  instrumentsRoot.add(modSiphonGroup);

  // 4.9 Level & Upgrade Tier Evolution Armor (Mk.II & Mk.III Naval Prestige Hardware)
  const tierMk2EvolutionGroup = new THREE.Group();
  {
    [-2.95, 2.95].forEach((sideX) => {
      const strake = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.44, 1.25),
        machinedSteelMat,
      );
      strake.position.set(sideX, 0.16, 0.45);
      tierMk2EvolutionGroup.add(strake);
    });
    const dorsalFin = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.48, 1.35),
      mats.darkGraphiteTrim,
    );
    dorsalFin.position.set(0, 0.44, 0.88);
    tierMk2EvolutionGroup.add(dorsalFin);
  }
  tierMk2EvolutionGroup.visible = false;
  instrumentsRoot.add(tierMk2EvolutionGroup);

  const tierMk3EvolutionGroup = new THREE.Group();
  {
    const statorShroud = new THREE.Mesh(
      new THREE.CylinderGeometry(0.92, 0.98, 0.34, 20, 1, true).rotateX(
        Math.PI / 2,
      ),
      heatStainedNozzleMat,
    );
    statorShroud.position.set(0, 0.04, 1.52);
    tierMk3EvolutionGroup.add(statorShroud);

    [-1.48, 1.48].forEach((sideX) => {
      const eraShoulder = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.16, 1.12),
        navalBronzeMat,
      );
      eraShoulder.position.set(sideX, 0.2, -0.58);
      eraShoulder.rotation.y = sideX < 0 ? 0.2 : -0.2;
      tierMk3EvolutionGroup.add(eraShoulder);
    });
  }
  tierMk3EvolutionGroup.visible = false;
  instrumentsRoot.add(tierMk3EvolutionGroup);

  // Central Rotating Pump-Jet Stator Ring & Thruster Handles
  const turbineGeo = new THREE.TorusGeometry(0.52, 0.04, 10, 24);
  const turbineRing = new THREE.Mesh(turbineGeo, machinedSteelMat);
  turbineRing.position.set(0, 0.0, 1.48);
  group.add(turbineRing);

  const thrusterLeft = thrusterAssemblies[0].outerPlume;
  const thrusterRight = thrusterAssemblies[1].outerPlume;

  // Dynamic Stern Cavitation Reactor Light (casts bioluminescent water-plasma glow onto nozzles)
  const afterburnerLight = new THREE.PointLight(0x38bdf8, 2.2, 10.5, 1.6);
  afterburnerLight.position.set(0, 0.05, 2.45);
  group.add(afterburnerLight);

  // Piezo-Shield Bubble (Visible only during barrel roll or shield impact)
  const shieldGeo = new THREE.IcosahedronGeometry(2.75, 2);
  const shieldMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    wireframe: true,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const shieldSphere = new THREE.Mesh(shieldGeo, shieldMat);
  group.add(shieldSphere);

  // Mythic & Apex Prestige Reactor Halo (Visible for Tiers 8-12 in Hangar & Flight)
  const prestigeHaloGroup = new THREE.Group();
  prestigeHaloGroup.position.set(0, 0.18, 0.15);
  const haloOuterMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const haloInnerMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.52,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const prestigeOuterRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.38, 0.022, 10, 48).rotateX(Math.PI / 2),
    haloOuterMat,
  );
  const prestigeInnerRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.72, 0.018, 10, 36).rotateX(Math.PI / 2.3),
    haloInnerMat,
  );
  for (let n = 0; n < 4; n++) {
    const ang = (n / 4) * Math.PI * 2;
    const node = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.065, 0),
      haloOuterMat,
    );
    node.position.set(Math.cos(ang) * 2.38, 0, Math.sin(ang) * 2.38);
    prestigeOuterRing.add(node);
  }
  prestigeHaloGroup.add(prestigeOuterRing, prestigeInnerRing);
  prestigeHaloGroup.visible = false;
  group.add(prestigeHaloGroup);

  // Cached muzzle offset vectors (reused with zero per-frame allocations)
  let activePrimaryMuzzles: THREE.Vector3[] = [
    new THREE.Vector3(-0.82, -0.06, -2.2),
    new THREE.Vector3(0.82, -0.06, -2.2),
  ];
  let activeSecondaryMuzzles: THREE.Vector3[] = [
    new THREE.Vector3(-1.18, -0.22, -0.45),
    new THREE.Vector3(1.18, -0.22, -0.45),
  ];

  // Internal state for weapon recoil, muzzle flash timers & active ability visuals
  let weaponRecoilOffset = 0;
  let muzzleFlashTimer = 0;
  let smoothThrottle = 1.0;
  let activeAbilityVisual = false;
  let currentBuild: ShipChassisBuild = shipBuilds[0];
  let currentLoadoutState: ShipLoadoutVisualConfig = {
    shipId: 'vanguard_interceptor',
    trimHex: 0x06b6d4,
    primaryWeaponId: 'cavitation_cannons',
    secondaryWeaponId: 'sonic_torpedoes',
    activeUpgrades: [],
    upgradeTiers: {
      cavitation_overcharge: 0,
      quad_torpedo_salvo: 0,
      piezo_hull_regen: 0,
      hydro_thruster_coil: 0,
      voltaic_shield_capacitor: 0,
      sonar_crit_visor: 0,
      hadal_pressure_Bulkhead: 0,
      biolume_siphon_array: 0,
    },
    pilotLevel: 1,
  };

  function setAppearance(
    shipId: ShipClassId,
    trimHex: number,
    loadout?: Partial<ShipLoadoutVisualConfig>,
  ) {
    currentLoadoutState = {
      ...currentLoadoutState,
      ...loadout,
      shipId,
      trimHex,
    };

    // 1. Toggle active ship chassis among all 12 completely distinct designs
    let matchedBuild = shipBuilds[0];
    shipBuilds.forEach((b) => {
      const active = b.id === shipId;
      b.root.visible = active;
      if (active) matchedBuild = b;
    });
    currentBuild = matchedBuild;

    // 2. Apply per-ship propulsion shader colors & reactor light color
    const shipDef = SHIP_CATALOG.find((s) => s.id === shipId) || SHIP_CATALOG[0];
    applyPropulsionConfigToThrusters(
      matchedBuild.thrusters,
      shipDef.propulsionVfxConfig,
      trimHex,
    );
    afterburnerLight.color.setHex(shipDef.propulsionVfxConfig.primaryColorHex);

    // 3. Configure per-ship 3D Primary Weapon Hardpoint positions & toggle equipped weapon model
    const priId = currentLoadoutState.primaryWeaponId || 'cavitation_cannons';
    const layout =
      SHIP_HARDPOINT_LAYOUTS[shipId] ||
      SHIP_HARDPOINT_LAYOUTS.vanguard_interceptor;

    activePrimaryMuzzles = layout.primaryMounts.map(
      (m) => new THREE.Vector3(m.pos[0], m.pos[1], m.pos[2] - 1.1 * m.scale),
    );
    activeSecondaryMuzzles = layout.secondaryMounts.map(
      (m) => new THREE.Vector3(m.pos[0], m.pos[1], m.pos[2] - 0.65),
    );

    primaryMountPods.forEach((pod, idx) => {
      const mountSpec = layout.primaryMounts[idx];
      if (!mountSpec) {
        pod.root.visible = false;
        return;
      }
      pod.root.visible = true;
      pod.root.position.set(
        mountSpec.pos[0],
        mountSpec.pos[1],
        mountSpec.pos[2],
      );
      pod.root.scale.setScalar(mountSpec.scale);
      pod.cavitationModel.visible = priId === 'cavitation_cannons';
      pod.lanceModel.visible = priId === 'focused_bio_lance';
      pod.scatterModel.visible = priId === 'burst_pulse_repeater';
    });

    // 4. Toggle & scale visible 3D Secondary Ordnance Pods
    secondaryOrdnanceRoot.scale.set(matchedBuild.wingSpanScale, 1, 1);
    const secId = currentLoadoutState.secondaryWeaponId || 'sonic_torpedoes';
    secSonicPodsGroup.visible = secId === 'sonic_torpedoes';
    secHeavyBreachGroup.visible = secId === 'heavy_breach_torpedo';
    secHexaSwarmGroup.visible = secId === 'hexa_swarm_rack';

    // 5. Toggle all 8 visible 3D Instrument Modules & scale them by Upgrade Tier (I..III)
    const activeMods = currentLoadoutState.activeUpgrades || [];
    const tiers = currentLoadoutState.upgradeTiers;

    const getModScale = (id: UpgradeId) => {
      const t = tiers?.[id] || 1;
      return 0.88 + t * 0.14;
    };

    modOverchargeGroup.visible = activeMods.includes('cavitation_overcharge');
    modOverchargeGroup.scale.setScalar(getModScale('cavitation_overcharge'));

    modQuadSalvoGroup.visible = activeMods.includes('quad_torpedo_salvo');
    modQuadSalvoGroup.scale.setScalar(getModScale('quad_torpedo_salvo'));

    modHullRegenGroup.visible = activeMods.includes('piezo_hull_regen');
    modHullRegenGroup.scale.setScalar(getModScale('piezo_hull_regen'));

    modThrusterCoilGroup.visible = activeMods.includes('hydro_thruster_coil');
    modThrusterCoilGroup.scale.setScalar(getModScale('hydro_thruster_coil'));

    modShieldCapGroup.visible = activeMods.includes('voltaic_shield_capacitor');
    modShieldCapGroup.scale.setScalar(getModScale('voltaic_shield_capacitor'));

    modSonarVisorGroup.visible = activeMods.includes('sonar_crit_visor');
    modSonarVisorGroup.scale.setScalar(getModScale('sonar_crit_visor'));

    modBulkheadGroup.visible = activeMods.includes('hadal_pressure_Bulkhead');
    modBulkheadGroup.scale.setScalar(getModScale('hadal_pressure_Bulkhead'));

    modSiphonGroup.visible = activeMods.includes('biolume_siphon_array');
    modSiphonGroup.scale.setScalar(getModScale('biolume_siphon_array'));

    // 6. Compute Ship Level / Total Upgrade Tier Visual Evolution (Mk.I -> Mk.II -> Mk.III)
    const totalTierPoints = activeMods.reduce(
      (sum, id) => sum + (tiers?.[id] || 1),
      0,
    );
    const pilotLv = currentLoadoutState.pilotLevel || 1;
    tierMk2EvolutionGroup.visible = totalTierPoints >= 3 || pilotLv >= 3;
    tierMk3EvolutionGroup.visible = totalTierPoints >= 6 || pilotLv >= 6;

    // 7. Subtle tactical livery tinting on hull & avionics + Mythic/Apex Reactor Halo (Tiers 8-12)
    shipTrimMat.color.setHex(trimHex);
    shipTrimMat.emissive.setHex(trimHex);
    shieldMat.color.setHex(shipDef.propulsionVfxConfig.primaryColorHex);
    muzzleFlashFireMat.color.setHex(shipDef.weaponVfxConfig.boltColorHex);
    muzzleFlashCoreMat.color.setHex(shipDef.weaponVfxConfig.coreColorHex);

    const isPrestigeTier = (shipDef.tier || 1) >= 8;
    prestigeHaloGroup.visible = isPrestigeTier;
    if (isPrestigeTier) {
      haloInnerMat.color.setHex(shipDef.propulsionVfxConfig.primaryColorHex);
      haloOuterMat.color.setHex(
        shipDef.tier === 12
          ? 0xfbbf24
          : shipDef.propulsionVfxConfig.secondaryColorHex,
      );
      const tierHaloScale = 0.88 + ((shipDef.tier - 8) / 4) * 0.24;
      prestigeHaloGroup.scale.setScalar(tierHaloScale);
    }
  }

  function setAbilityVisualState(active: boolean) {
    activeAbilityVisual = active;
  }

  function triggerWeaponFire(isSecondary = false) {
    weaponRecoilOffset = isSecondary ? 0.34 : 0.22;
    muzzleFlashTimer = isSecondary ? 0.12 : 0.075;
    muzzleFlashCoreMat.opacity = 0.95;
    muzzleFlashFireMat.opacity = 0.88;
    primaryMountPods.forEach((pod) => {
      if (!pod.root.visible) return;
      pod.muzzleFlash.visible = true;
      pod.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
      const s = isSecondary ? 1.35 : 0.85 + Math.random() * 0.45;
      pod.muzzleFlash.scale.setScalar(s);
      pod.rotaryCluster.rotation.z += 0.85;
    });
  }

  function getPrimaryMuzzleOffsets(): THREE.Vector3[] {
    return activePrimaryMuzzles;
  }

  function getSecondaryMuzzleOffsets(): THREE.Vector3[] {
    return activeSecondaryMuzzles;
  }

  function updateShipEffects(
    elapsed: number,
    dt: number,
    surgeBoost: number,
    turnSteer = 0,
    damageRatio = 0,
    isRolling = false,
  ) {
    smoothThrottle = THREE.MathUtils.damp(
      smoothThrottle,
      surgeBoost,
      surgeBoost > smoothThrottle ? 14 : 5.5,
      dt,
    );
    const boostFactor = Math.max(0, (smoothThrottle - 1.0) / 1.4);
    const rollVal = isRolling ? 1.0 : 0.0;

    // 1. Animate active ship chassis (sonar arrays, drones, reactor halos, articulated arms, turrets)
    turbineRing.rotation.z += dt * (6.5 * smoothThrottle + rollVal * 12.0);
    currentBuild.animate(elapsed, dt, smoothThrottle, activeAbilityVisual);

    // 2. Dynamic Stern Cavitation Reactor Light & Hull Trim Illumination (with low-hull damage flicker)
    const dmgFlicker =
      damageRatio > 0.15
        ? 1.0 - damageRatio * (0.55 * Math.abs(Math.sin(elapsed * 43)))
        : 1.0;
    const highFreqFlicker =
      (0.92 + Math.sin(elapsed * 54) * 0.12 + Math.cos(elapsed * 71) * 0.08) *
      dmgFlicker;
    afterburnerLight.intensity =
      (1.8 +
        boostFactor * 6.4 +
        (activeAbilityVisual ? 1.6 : 0) +
        rollVal * 2.2) *
      highFreqFlicker;
    afterburnerLight.distance = 8.5 + boostFactor * 6.5;

    // Hull bioluminescent trim breathing & low-hull damage flicker
    shipTrimMat.emissiveIntensity =
      (0.88 +
        Math.sin(elapsed * 2.8) * 0.22 +
        boostFactor * 0.72 +
        (activeAbilityVisual ? 0.55 : 0)) *
      dmgFlicker;

    // Mythic & Apex Prestige Reactor Halo animation (Tiers 8-12)
    if (prestigeHaloGroup.visible) {
      prestigeOuterRing.rotation.z = elapsed * (0.65 + boostFactor * 0.9);
      prestigeInnerRing.rotation.z = -elapsed * (1.05 + boostFactor * 1.2);
      prestigeInnerRing.rotation.y = Math.sin(elapsed * 1.4) * 0.18;
      haloOuterMat.opacity =
        (0.32 + Math.sin(elapsed * 3.2) * 0.1 + boostFactor * 0.22) * dmgFlicker;
      haloInnerMat.opacity =
        (0.42 + Math.cos(elapsed * 4.1) * 0.12 + boostFactor * 0.25) * dmgFlicker;
    }

    // Mechanical weapon-pod micro-articulation & turn-tracking stabilization
    primaryMountPods.forEach((pod, idx) => {
      if (!pod.root.visible) return;
      pod.root.rotation.y = -turnSteer * 0.14;
      pod.root.rotation.x =
        Math.sin(elapsed * 2.1 + idx * 0.9) * 0.022 - boostFactor * 0.03;
    });
    secondaryOrdnanceRoot.rotation.z = -turnSteer * 0.07;

    // 3. Animate Variable-Geometry MHD Nozzle Petals, Ion-Cavitation Shaders, Vortex Spirals & Micro-Bubbles
    const lengthBoost = 1.0 + boostFactor * 1.18 + rollVal * 0.25;
    const radialBoost = 1.0 + boostFactor * 0.34 + rollVal * 0.18;
    const nozzleApertureScale =
      0.96 + boostFactor * 0.22 + Math.sin(elapsed * 18) * 0.015;
    const targetPetalAngle = 0.18 - boostFactor * 0.26;

    thrusterAssemblies.forEach((asm, idx) => {
      let pNode: THREE.Object3D | null = asm.root;
      let isVisible = true;
      while (pNode && pNode !== group) {
        if (!pNode.visible) {
          isVisible = false;
          break;
        }
        pNode = pNode.parent;
      }
      if (!isVisible) return;

      const phase = idx * 1.3;
      const localFlicker =
        highFreqFlicker + Math.sin(elapsed * 41 + phase) * 0.09;

      asm.coreShaderUniforms.uTime.value = elapsed;
      asm.coreShaderUniforms.uThrottle.value = smoothThrottle;
      asm.coreShaderUniforms.uTurnSteer.value = turnSteer;
      asm.coreShaderUniforms.uDamageRatio.value = damageRatio;
      asm.coreShaderUniforms.uRollState.value = rollVal;

      asm.plumeShaderUniforms.uTime.value = elapsed;
      asm.plumeShaderUniforms.uThrottle.value = smoothThrottle;
      asm.plumeShaderUniforms.uTurnSteer.value = turnSteer;
      asm.plumeShaderUniforms.uDamageRatio.value = damageRatio;
      asm.plumeShaderUniforms.uRollState.value = rollVal;

      // Vectoring nozzle tilt during turning maneuvers
      asm.nozzlePetalRing.rotation.y = -turnSteer * 0.22;
      asm.nozzlePetalRing.scale.set(
        nozzleApertureScale,
        nozzleApertureScale,
        1,
      );
      for (let p = 0; p < asm.petalMeshes.length; p++) {
        asm.petalMeshes[p].rotation.x = targetPetalAngle;
      }

      const fhMat = asm.flameHolderMesh.material as THREE.MeshStandardMaterial;
      fhMat.emissiveIntensity = (0.78 + boostFactor * 2.8) * localFlicker;

      asm.innerCore.scale.set(
        radialBoost,
        radialBoost,
        localFlicker * lengthBoost,
      );
      asm.midFlame.scale.set(
        radialBoost * (1.0 + Math.sin(elapsed * 33 + phase) * 0.06),
        radialBoost * (1.0 + Math.cos(elapsed * 37 + phase) * 0.06),
        localFlicker * lengthBoost * 1.08,
      );
      asm.outerPlume.scale.set(
        radialBoost * 1.06,
        radialBoost * 1.06,
        localFlicker * lengthBoost * 1.14,
      );

      // Counter-rotating water-vortex induction spiral
      asm.vortexSpiralMesh.rotation.z -=
        dt * (7.5 + boostFactor * 11.0 + rollVal * 16.0);
      const vortexScale = 1.0 + boostFactor * 0.35 + rollVal * 0.45;
      asm.vortexSpiralMesh.scale.set(vortexScale, vortexScale, 1.0);

      for (let c = 0; c < asm.crossPlanes.length; c++) {
        const cp = asm.crossPlanes[c];
        cp.scale.set(
          radialBoost,
          radialBoost,
          localFlicker * lengthBoost * 1.05,
        );
        cp.rotation.z =
          c * (Math.PI / 2) + Math.sin(elapsed * 19 + phase) * 0.08;
      }

      asm.shockRings.forEach((ring, rIdx) => {
        const pulse =
          (1.0 + boostFactor * 0.28 + rollVal * 0.22) *
          (1 + Math.sin(elapsed * 42 - rIdx * 1.4 + phase) * 0.15);
        ring.scale.set(pulse, pulse, 1.0 + boostFactor * 0.45);
        ring.position.z =
          (0.24 + rIdx * 0.34) * asm.baseScale * lengthBoost;
        ring.position.x = -turnSteer * (rIdx * 0.045) * asm.baseScale;
      });

      const emberSpeedMult = 1.0 + boostFactor * 1.85 + rollVal * 0.65;
      const maxStreamLength = (1.65 + boostFactor * 1.6) * asm.baseScale;
      for (let e = 0; e < asm.emberStreaks.length; e++) {
        const node = asm.emberStreaks[e];
        const cycle =
          (elapsed * node.speed * emberSpeedMult + node.seed) % 1.0;
        const zPos = 0.06 * asm.baseScale + cycle * maxStreamLength;
        const spreadFactor =
          0.35 + cycle * (1.1 + boostFactor * 0.9 + rollVal * 0.65);
        const swirlAngle =
          node.radialAngle +
          elapsed * (4.5 + boostFactor * 5.0 + rollVal * 9.0) +
          cycle * 2.4;
        const rDist = node.radialDist * spreadFactor;

        node.mesh.position.set(
          Math.cos(swirlAngle) * rDist - turnSteer * cycle * 0.18,
          Math.sin(swirlAngle) * rDist,
          zPos,
        );
        const fade = Math.sin(cycle * Math.PI) * dmgFlicker;
        const bubbleScale = fade * (0.85 + boostFactor * 0.45);
        node.mesh.scale.set(
          bubbleScale,
          bubbleScale,
          Math.max(0.3, bubbleScale * (1.1 + boostFactor * 0.6)),
        );
      }
    });

    // 4. Spring-recover primary weapon barrel recoil
    if (weaponRecoilOffset > 0.001) {
      weaponRecoilOffset = THREE.MathUtils.damp(
        weaponRecoilOffset,
        0,
        22,
        dt,
      );
      primaryWeaponsRoot.position.z = weaponRecoilOffset;
    } else {
      primaryWeaponsRoot.position.z = 0;
    }

    // 5. Animate & fade muzzle cavitation starbursts
    if (muzzleFlashTimer > 0) {
      muzzleFlashTimer = Math.max(0, muzzleFlashTimer - dt);
      const ratio = muzzleFlashTimer / 0.08;
      muzzleFlashCoreMat.opacity = Math.min(1, ratio * 1.2);
      muzzleFlashFireMat.opacity = Math.min(0.9, ratio);
      muzzleFlashGroups.forEach((mf) => {
        if (mf.visible) {
          mf.scale.multiplyScalar(1 + dt * 6);
        }
      });
      if (muzzleFlashTimer <= 0) {
        muzzleFlashGroups.forEach((mf) => {
          mf.visible = false;
        });
      }
    }
  }

  return {
    group,
    thrusterLeft,
    thrusterRight,
    turbineRing,
    shieldSphere,
    setAppearance,
    setAbilityVisualState,
    triggerWeaponFire,
    getPrimaryMuzzleOffsets,
    getSecondaryMuzzleOffsets,
    updateShipEffects,
  };
}

/**
 * Creates a pooled 3D player primary projectile containing 3 distinct weapon-specific 3D geometries:
 * 1. `cavitation_cannons`: Supercavitating bolt with dual collapsing hydro-bubble rings & vapor cone
 * 2. `focused_bio_lance` (Thermal Lance Array): Elongated coherent hyper-thermal energy spear with helical ribbon
 * 3. `burst_pulse_repeater` (Arc Shard Scatter): Tri-cluster of 3 angled crystalline electro-shards
 */
export function createPlayerPrimaryBoltMesh(mats: MaterialBank): THREE.Group {
  const boltGroup = new THREE.Group();

  const innerCoreMat = new THREE.MeshBasicMaterial({
    color: 0xecfeff,
    transparent: true,
    opacity: 0.98,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const tracerSheathMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.86,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const cavitationWakeMat = new THREE.MeshBasicMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.58,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // 1. Cavitation Cannons 3D sub-group
  const cavitationSubGroup = new THREE.Group();
  const coreGeo = new THREE.CapsuleGeometry(0.075, 1.3, 4, 8);
  coreGeo.rotateX(Math.PI / 2);
  const coreMesh = new THREE.Mesh(coreGeo, innerCoreMat);
  cavitationSubGroup.add(coreMesh);

  const sheathGeo = new THREE.ConeGeometry(0.18, 1.85, 10, 1, true);
  sheathGeo.rotateX(-Math.PI / 2);
  const sheathMesh = new THREE.Mesh(sheathGeo, tracerSheathMat);
  cavitationSubGroup.add(sheathMesh);

  const wakeGeo = new THREE.ConeGeometry(0.16, 1.25, 8);
  wakeGeo.rotateX(Math.PI / 2);
  wakeGeo.translate(0, 0, 0.75);
  const wakeMesh = new THREE.Mesh(wakeGeo, cavitationWakeMat);
  cavitationSubGroup.add(wakeMesh);

  const ringFront = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.02, 6, 14),
    mats.flashWhite,
  );
  ringFront.position.set(0, 0, -0.38);
  const ringRear = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.016, 6, 12),
    cavitationWakeMat,
  );
  ringRear.position.set(0, 0, 0.35);
  cavitationSubGroup.add(ringFront, ringRear);
  boltGroup.add(cavitationSubGroup);

  // 2. Thermal Lance Array (`focused_bio_lance`) 3D sub-group
  const lanceSubGroup = new THREE.Group();
  const lanceCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 2.95, 10).rotateX(Math.PI / 2),
    innerCoreMat,
  );
  const lanceSheath = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.08, 3.1, 12, 1, true).rotateX(
      Math.PI / 2,
    ),
    tracerSheathMat,
  );
  const lanceCollar1 = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.024, 6, 14),
    cavitationWakeMat,
  );
  lanceCollar1.position.set(0, 0, -0.85);
  const lanceCollar2 = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.02, 6, 14),
    cavitationWakeMat,
  );
  lanceCollar2.position.set(0, 0, 0.45);
  lanceSubGroup.add(lanceCore, lanceSheath, lanceCollar1, lanceCollar2);
  lanceSubGroup.visible = false;
  boltGroup.add(lanceSubGroup);

  // 3. Arc Shard Scatter (`burst_pulse_repeater`) 3D sub-group
  const shardSubGroup = new THREE.Group();
  const shardGeo = new THREE.OctahedronGeometry(0.15, 0);
  shardGeo.scale(0.75, 0.75, 2.4);
  [
    [0, 0.08, -0.2],
    [-0.14, -0.07, 0.12],
    [0.14, -0.07, 0.12],
  ].forEach(([sx, sy, sz]) => {
    const shard = new THREE.Mesh(shardGeo, innerCoreMat);
    shard.position.set(sx, sy, sz);
    const halo = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.19, 0),
      tracerSheathMat,
    );
    halo.scale.set(0.85, 0.85, 2.1);
    halo.position.set(sx, sy, sz);
    shardSubGroup.add(shard, halo);
  });
  const arcRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.018, 5, 8),
    cavitationWakeMat,
  );
  shardSubGroup.add(arcRing);
  shardSubGroup.visible = false;
  boltGroup.add(shardSubGroup);

  boltGroup.userData = {
    innerCoreMat,
    tracerSheathMat,
    cavitationWakeMat,
    cavitationSubGroup,
    lanceSubGroup,
    shardSubGroup,
  };

  return boltGroup;
}

/**
 * Updates pooled projectile / torpedo 3D sub-geometry, colors, and scale dynamically
 * to match both the active vessel's weapon VFX identity and the equipped weapon type.
 */
export function applyPlayerWeaponVfxToMesh(
  mesh: THREE.Group,
  vfx: ShipWeaponVfxConfig,
  isTorpedo: boolean,
  primaryWeaponId: PrimaryWeaponId = 'cavitation_cannons',
  secondaryWeaponId: SecondaryWeaponId = 'sonic_torpedoes',
) {
  if (isTorpedo) {
    const {
      fireMat,
      coreMat,
      sonicSubGroup,
      empSubGroup,
      swarmSubGroup,
    } = mesh.userData as {
      fireMat?: THREE.MeshBasicMaterial;
      coreMat?: THREE.MeshBasicMaterial;
      sonicSubGroup?: THREE.Group;
      empSubGroup?: THREE.Group;
      swarmSubGroup?: THREE.Group;
    };
    if (fireMat) fireMat.color.setHex(vfx.torpedoColorHex);
    if (coreMat) coreMat.color.setHex(vfx.coreColorHex);
    if (sonicSubGroup)
      sonicSubGroup.visible = secondaryWeaponId === 'sonic_torpedoes';
    if (empSubGroup)
      empSubGroup.visible = secondaryWeaponId === 'heavy_breach_torpedo';
    if (swarmSubGroup)
      swarmSubGroup.visible = secondaryWeaponId === 'hexa_swarm_rack';
    mesh.scale.setScalar(Math.max(0.9, vfx.boltScale * 0.95));
  } else {
    const {
      innerCoreMat,
      tracerSheathMat,
      cavitationWakeMat,
      cavitationSubGroup,
      lanceSubGroup,
      shardSubGroup,
    } = mesh.userData as {
      innerCoreMat?: THREE.MeshBasicMaterial;
      tracerSheathMat?: THREE.MeshBasicMaterial;
      cavitationWakeMat?: THREE.MeshBasicMaterial;
      cavitationSubGroup?: THREE.Group;
      lanceSubGroup?: THREE.Group;
      shardSubGroup?: THREE.Group;
    };
    if (innerCoreMat) innerCoreMat.color.setHex(vfx.coreColorHex);
    if (tracerSheathMat) tracerSheathMat.color.setHex(vfx.boltColorHex);
    if (cavitationWakeMat) cavitationWakeMat.color.setHex(vfx.boltColorHex);
    if (cavitationSubGroup)
      cavitationSubGroup.visible = primaryWeaponId === 'cavitation_cannons';
    if (lanceSubGroup)
      lanceSubGroup.visible = primaryWeaponId === 'focused_bio_lance';
    if (shardSubGroup)
      shardSubGroup.visible = primaryWeaponId === 'burst_pulse_repeater';
    mesh.scale.setScalar(vfx.boltScale);
  }
}

/**
 * Creates a pooled 3D Secondary Warhead mesh containing 3 distinct ordnance silhouettes:
 * 1. `sonic_torpedoes` (Sonic Torpedoes): Acoustic warhead with sonar rings & shrouded pump-jet tail
 * 2. `heavy_breach_torpedo` (EMP Depth Seekers): Heavy electromagnetic seeker wrapped in glowing induction coils
 * 3. `hexa_swarm_rack` (Hadal Swarm Pods): Twin agile micro-missile swarm darts with swept hydro-fins
 */
export function createPlayerTorpedoMesh(mats: MaterialBank): THREE.Group {
  const torpGroup = new THREE.Group();

  const fireMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xecfeff,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  // 1. Sonic Torpedoes (`sonic_torpedoes`)
  const sonicSubGroup = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.15, 1.42, 14).rotateX(Math.PI / 2),
    mats.darkGraphiteTrim,
  );
  const warheadBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.148, 0.148, 0.22, 14).rotateX(Math.PI / 2),
    fireMat,
  );
  warheadBand.position.set(0, 0, -0.52);
  const noseCone = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 12, 10),
    mats.titaniumHull,
  );
  noseCone.scale.set(1, 1, 1.45);
  noseCone.position.set(0, 0, -0.72);
  const sonarPulseRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.018, 6, 16),
    coreMat,
  );
  sonarPulseRing.position.set(0, 0, -0.82);
  const fins = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.05, 0.34),
    mats.titaniumHull,
  );
  fins.position.set(0, 0, 0.48);
  const finsV = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.56, 0.34),
    mats.titaniumHull,
  );
  finsV.position.set(0, 0, 0.48);
  const tailShroud = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.15, 0.24, 12, 1, true).rotateX(
      Math.PI / 2,
    ),
    mats.titaniumHull,
  );
  tailShroud.position.set(0, 0, 0.58);
  sonicSubGroup.add(
    body,
    warheadBand,
    noseCone,
    sonarPulseRing,
    fins,
    finsV,
    tailShroud,
  );
  torpGroup.add(sonicSubGroup);

  // 2. EMP Depth Seekers (`heavy_breach_torpedo`)
  const empSubGroup = new THREE.Group();
  const empBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.18, 1.56, 16).rotateX(Math.PI / 2),
    mats.obsidianArmor,
  );
  const empSphereCore = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.22, 1),
    coreMat,
  );
  empSphereCore.position.set(0, 0, -0.68);
  [-0.55, -0.15, 0.25].forEach((cz) => {
    const coil = new THREE.Mesh(
      new THREE.TorusGeometry(0.23, 0.026, 8, 16),
      fireMat,
    );
    coil.position.set(0, 0, cz);
    empSubGroup.add(coil);
  });
  empSubGroup.add(empBody, empSphereCore);
  empSubGroup.visible = false;
  torpGroup.add(empSubGroup);

  // 3. Hadal Swarm Pods (`hexa_swarm_rack`)
  const swarmSubGroup = new THREE.Group();
  [-0.14, 0.14].forEach((ox) => {
    const dartBody = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 1.15, 8).rotateX(-Math.PI / 2),
      mats.titaniumHull,
    );
    dartBody.position.set(ox, 0, -0.1);
    const dartCore = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.045, 0.65, 4, 8).rotateX(Math.PI / 2),
      coreMat,
    );
    dartCore.position.set(ox, 0, -0.2);
    swarmSubGroup.add(dartBody, dartCore);
  });
  swarmSubGroup.visible = false;
  torpGroup.add(swarmSubGroup);

  // Shared underwater cavitation plasma plume at tail
  const fireCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.19, 1.15, 10).rotateX(Math.PI / 2),
    fireMat,
  );
  fireCone.position.set(0, 0, 1.18);
  const innerCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.095, 0.68, 8).rotateX(Math.PI / 2),
    coreMat,
  );
  innerCone.position.set(0, 0, 0.96);
  torpGroup.add(fireCone, innerCone);

  torpGroup.userData = {
    fireMat,
    coreMat,
    sonicSubGroup,
    empSubGroup,
    swarmSubGroup,
  };
  return torpGroup;
}



/**
 * Creates a composite 5–8 part procedural 3D enemy group
 */
export function createEnemyMesh(
  type: EnemyType,
  mats: MaterialBank,
): {
  group: THREE.Group;
  coreMesh: THREE.Mesh;
  telegraphRing: THREE.Mesh;
} {
  const group = new THREE.Group();

  // Telegraph ring attached to every enemy (scales & pulses during attack windup)
  const teleRingGeo = new THREE.RingGeometry(1.4, 1.85, 24);
  const teleRingMat = new THREE.MeshBasicMaterial({
    color: 0xf43f5e,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const telegraphRing = new THREE.Mesh(teleRingGeo, teleRingMat);
  group.add(telegraphRing);

  let coreMesh: THREE.Mesh;

  if (type === 'skimmer') {
    // 6-part Chitin Skimmer: Armored carapace + glowing nucleus + 2 swept mandibles + 2 hydro-fins
    const bodyGeo = new THREE.ConeGeometry(1.1, 3.2, 8);
    bodyGeo.rotateX(-Math.PI / 2);
    bodyGeo.scale(1.3, 0.65, 1.0);
    const body = new THREE.Mesh(bodyGeo, mats.chitinCarapace);
    group.add(body);

    coreMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 14, 14),
      mats.biolumeCyan.clone(),
    );
    coreMesh.position.set(0, 0.25, -0.2);
    group.add(coreMesh);

    const mandibleGeo = new THREE.BoxGeometry(0.22, 0.16, 1.6);
    const leftMandible = new THREE.Mesh(mandibleGeo, mats.obsidianArmor);
    leftMandible.position.set(-0.85, -0.1, 0.9);
    leftMandible.rotation.y = 0.28;
    group.add(leftMandible);

    const rightMandible = new THREE.Mesh(mandibleGeo, mats.obsidianArmor);
    rightMandible.position.set(0.85, -0.1, 0.9);
    rightMandible.rotation.y = -0.28;
    group.add(rightMandible);

    const wingGeo = new THREE.BoxGeometry(2.8, 0.1, 0.9);
    const wings = new THREE.Mesh(wingGeo, mats.chitinCarapace);
    wings.position.set(0, 0, -0.3);
    group.add(wings);
  } else if (type === 'jelly') {
    // 7-part Voltaic Jelly-Drifter: Lathe bell dome + glowing core + collar ring + 4 Tube tentacles
    const bellPoints = [
      new THREE.Vector2(0.01, 1.3),
      new THREE.Vector2(0.85, 1.15),
      new THREE.Vector2(1.45, 0.45),
      new THREE.Vector2(1.65, -0.2),
      new THREE.Vector2(1.25, -0.45),
    ];
    const bellGeo = new THREE.LatheGeometry(bellPoints, 18);
    const bell = new THREE.Mesh(bellGeo, mats.jellyBellGlass);
    bell.renderOrder = 2;
    group.add(bell);

    coreMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.68, 1),
      mats.biolumeMagenta.clone(),
    );
    coreMesh.position.set(0, 0.3, 0);
    group.add(coreMesh);

    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(1.2, 0.12, 10, 20),
      mats.biolumeCyan,
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = -0.35;
    group.add(collar);

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(angle) * 0.7, -0.3, Math.sin(angle) * 0.7),
        new THREE.Vector3(Math.cos(angle) * 0.95, -1.4, Math.sin(angle) * 0.95),
        new THREE.Vector3(Math.cos(angle) * 0.5, -2.5, Math.sin(angle) * 0.5),
      ]);
      const tentacleGeo = new THREE.TubeGeometry(curve, 10, 0.09, 6, false);
      const tentacle = new THREE.Mesh(tentacleGeo, mats.biolumeMagenta);
      group.add(tentacle);
    }
  } else if (type === 'cruiser') {
    // 8-part Nautilus Broadside Cruiser: Heavy spiral shell + armored prow + 2 plasma turrets + glowing vents
    const shell = new THREE.Mesh(
      new THREE.TorusGeometry(1.55, 0.75, 12, 20, Math.PI * 1.65),
      mats.obsidianArmor,
    );
    shell.rotation.y = Math.PI / 2;
    group.add(shell);

    coreMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 16, 16),
      mats.biolumeAmber.clone(),
    );
    coreMesh.position.set(0, 0, 0.55);
    group.add(coreMesh);

    const prow = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 2.6, 6),
      mats.chitinCarapace,
    );
    prow.rotation.x = Math.PI / 2;
    prow.position.set(0, -0.2, 1.3);
    group.add(prow);

    const outriggerGeo = new THREE.CylinderGeometry(0.32, 0.42, 2.6, 10);
    outriggerGeo.rotateX(Math.PI / 2);
    const leftPod = new THREE.Mesh(outriggerGeo, mats.obsidianArmor);
    leftPod.position.set(-1.85, 0, 0);
    group.add(leftPod);

    const rightPod = new THREE.Mesh(outriggerGeo, mats.obsidianArmor);
    rightPod.position.set(1.85, 0, 0);
    group.add(rightPod);
  } else if (type === 'manta') {
    // 7-part Phantom Manta Interceptor: Wide diamond hydro-body + emerald core + twin wing lances + whip tail
    const diamondGeo = new THREE.OctahedronGeometry(1.6, 0);
    diamondGeo.scale(2.1, 0.32, 1.25);
    const body = new THREE.Mesh(diamondGeo, mats.chitinCarapace);
    group.add(body);

    coreMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 14, 14),
      mats.biolumeEmerald.clone(),
    );
    coreMesh.position.set(0, 0.24, 0.25);
    group.add(coreMesh);

    const lanceGeo = new THREE.ConeGeometry(0.18, 2.2, 8);
    lanceGeo.rotateX(Math.PI / 2);
    const leftLance = new THREE.Mesh(lanceGeo, mats.biolumeEmerald);
    leftLance.position.set(-2.6, 0, 0.6);
    group.add(leftLance);

    const rightLance = new THREE.Mesh(lanceGeo, mats.biolumeEmerald);
    rightLance.position.set(2.6, 0, 0.6);
    group.add(rightLance);

    const tail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.16, 2.8, 8),
      mats.obsidianArmor,
    );
    tail.rotation.x = Math.PI / 2;
    tail.position.set(0, 0, -2.1);
    group.add(tail);
  } else {
    // 'hazard_mine' — Abyssal Crystalline Pressure Mine (core + outer ring + 6 spikes)
    const hull = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.35, 0),
      mats.obsidianArmor,
    );
    group.add(hull);

    coreMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 12, 12),
      mats.biolumeCrimson.clone(),
    );
    group.add(coreMesh);

    const spikeGeo = new THREE.ConeGeometry(0.24, 1.9, 6);
    const dirs = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];
    dirs.forEach(([dx, dy, dz]) => {
      const spike = new THREE.Mesh(spikeGeo, mats.darkGraphiteTrim);
      spike.position.set(dx * 1.4, dy * 1.4, dz * 1.4);
      spike.lookAt(dx * 3, dy * 3, dz * 3);
      spike.rotateX(Math.PI / 2);
      group.add(spike);
    });
  }

  return { group, coreMesh, telegraphRing };
}

/**
 * Builds the 3 handcrafted multi-part Stage Leviathan Bosses with 4 localized destructible appendages each
 */
export function createBossMesh(
  stageId: StageId,
  mats: MaterialBank,
): {
  group: THREE.Group;
  coreMesh: THREE.Mesh;
  coreDamageUniforms: BiolumeDamageUniforms;
  outerRing: THREE.Group;
  tentacles: THREE.Mesh[];
  telegraphHalo: THREE.Mesh;
  appendages: BossAppendage3DNode[];
} {
  const group = new THREE.Group();
  const outerRing = new THREE.Group();
  group.add(outerRing);
  const tentacles: THREE.Mesh[] = [];
  const rawAppendages: Omit<
    BossAppendage3DNode,
    'damageUniforms' | 'fluidLeakMesh' | 'fluidLeakUniforms'
  >[] = [];

  const haloGeo = new THREE.RingGeometry(6.5, 7.6, 36);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xf43f5e,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const telegraphHalo = new THREE.Mesh(haloGeo, haloMat);
  telegraphHalo.position.z = 2.0;
  group.add(telegraphHalo);

  let coreMesh: THREE.Mesh;
  let coreFluidHex = 0x22d3ee;

  if (stageId === 1) {
    // Stage 1 Boss: Aurelia Prime, The Crowned Siphonophore Sovereign
    coreFluidHex = 0x22d3ee;
    coreMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.5, 2),
      mats.biolumeCyan.clone(),
    );
    coreMesh.position.set(0, 0.5, 0.8);
    group.add(coreMesh);

    // 1. Dorsal Appendage: Dorsal Crown Bell
    const dorsalGroup = new THREE.Group();
    const dorsalMat = mats.biolumeCyan.clone();
    const crownPoints = [
      new THREE.Vector2(0.1, 5.2),
      new THREE.Vector2(3.6, 4.2),
      new THREE.Vector2(6.2, 1.5),
      new THREE.Vector2(6.8, -0.6),
    ];
    const crownGeo = new THREE.LatheGeometry(crownPoints, 24);
    const crown = new THREE.Mesh(crownGeo, mats.jellyBellGlass);
    crown.renderOrder = 3;
    dorsalGroup.add(crown);
    const crownCrest = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.75, 1),
      dorsalMat,
    );
    crownCrest.position.set(0, 4.2, 0.5);
    dorsalGroup.add(crownCrest);
    group.add(dorsalGroup);

    rawAppendages.push({
      id: 's1_dorsal_crown',
      slot: 'dorsal',
      name: 'Dorsal Crown Dome',
      tacticalEffect: 'Core Shielding -25%',
      group: dorsalGroup,
      localOffset: new THREE.Vector3(0, 4.2, 0.5),
      hitRadius: 4.2,
      maxHp: 210,
      baseColorHex: 0x06b6d4,
      emissiveMat: dorsalMat,
    });

    // 2. Port Appendage: Port Nematocyst Whips
    const portGroup = new THREE.Group();
    const portMat = mats.biolumeMagenta.clone();
    for (let i = 0; i < 3; i++) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-3.4 - i * 0.9, 0.4, (i - 1) * 1.2),
        new THREE.Vector3(-6.2 - i * 1.1, -3.2, (i - 1) * 1.6),
        new THREE.Vector3(-4.8 - i * 0.7, -7.4, (i - 1) * 1.1),
      ]);
      const tMesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 14, 0.38, 8, false),
        portMat,
      );
      portGroup.add(tMesh);
      tentacles.push(tMesh);
    }
    const portNode = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.45, 0),
      portMat,
    );
    portNode.position.set(-5.6, -1.2, 0.6);
    portGroup.add(portNode);
    group.add(portGroup);

    rawAppendages.push({
      id: 's1_port_whips',
      slot: 'port',
      name: 'Port Nematocyst Whips',
      tacticalEffect: 'Left Bio-Barrage Disabled',
      group: portGroup,
      localOffset: new THREE.Vector3(-5.6, -1.8, 0.6),
      hitRadius: 4.0,
      maxHp: 190,
      baseColorHex: 0xd946ef,
      emissiveMat: portMat,
    });

    // 3. Starboard Appendage: Starboard Nematocyst Whips
    const starboardGroup = new THREE.Group();
    const starboardMat = mats.biolumeMagenta.clone();
    for (let i = 0; i < 3; i++) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(3.4 + i * 0.9, 0.4, (i - 1) * 1.2),
        new THREE.Vector3(6.2 + i * 1.1, -3.2, (i - 1) * 1.6),
        new THREE.Vector3(4.8 + i * 0.7, -7.4, (i - 1) * 1.1),
      ]);
      const tMesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 14, 0.38, 8, false),
        starboardMat,
      );
      starboardGroup.add(tMesh);
      tentacles.push(tMesh);
    }
    const starboardNode = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.45, 0),
      starboardMat,
    );
    starboardNode.position.set(5.6, -1.2, 0.6);
    starboardGroup.add(starboardNode);
    group.add(starboardGroup);

    rawAppendages.push({
      id: 's1_starboard_whips',
      slot: 'starboard',
      name: 'Starboard Nematocyst Whips',
      tacticalEffect: 'Right Bio-Barrage Disabled',
      group: starboardGroup,
      localOffset: new THREE.Vector3(5.6, -1.8, 0.6),
      hitRadius: 4.0,
      maxHp: 190,
      baseColorHex: 0xd946ef,
      emissiveMat: starboardMat,
    });

    // 4. Ventral Appendage: Ventral Siphon Nodes
    const ventralGroup = new THREE.Group();
    const ventralMat = mats.biolumeEmerald.clone();
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const node = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.3, 0),
        ventralMat,
      );
      node.position.set(
        Math.cos(angle) * 3.2,
        -4.6,
        Math.sin(angle) * 2.2,
      );
      ventralGroup.add(node);
    }
    outerRing.add(ventralGroup);

    rawAppendages.push({
      id: 's1_ventral_siphon',
      slot: 'ventral',
      name: 'Ventral Siphon Array',
      tacticalEffect: 'Drift Mobility -30%',
      group: ventralGroup,
      localOffset: new THREE.Vector3(0, -4.6, 0.4),
      hitRadius: 4.0,
      maxHp: 180,
      baseColorHex: 0x10b981,
      emissiveMat: ventralMat,
    });
  } else if (stageId === 2) {
    // Stage 2 Boss: Vulcanus Maw, Armored Magma Trench Leviathan
    coreFluidHex = 0xf59e0b;
    const skull = new THREE.Mesh(
      new THREE.DodecahedronGeometry(4.4, 1),
      mats.obsidianArmor,
    );
    skull.scale.set(1.25, 0.9, 1.15);
    group.add(skull);

    coreMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 20, 20),
      mats.biolumeAmber.clone(),
    );
    coreMesh.position.set(0, 0, 2.2);
    group.add(coreMesh);

    // 1. Dorsal Appendage: Dorsal Crusher Mandibles
    const dorsalGroup = new THREE.Group();
    const dorsalMat = mats.biolumeAmber.clone();
    for (let i = -1; i <= 1; i += 2) {
      const jaw = new THREE.Mesh(
        new THREE.ConeGeometry(1.45, 5.8, 6),
        dorsalMat,
      );
      jaw.position.set(i * 2.8, 4.2, 2.6);
      jaw.lookAt(0, 1.5, 7.5);
      dorsalGroup.add(jaw);
    }
    outerRing.add(dorsalGroup);

    rawAppendages.push({
      id: 's2_dorsal_mandibles',
      slot: 'dorsal',
      name: 'Dorsal Crusher Mandibles',
      tacticalEffect: 'Maw Bite Range Reduced',
      group: dorsalGroup,
      localOffset: new THREE.Vector3(0, 4.4, 2.2),
      hitRadius: 4.2,
      maxHp: 310,
      baseColorHex: 0xf59e0b,
      emissiveMat: dorsalMat,
    });

    // 2. Port Appendage: Port Magma Vent Carapace
    const portGroup = new THREE.Group();
    const portMat = mats.biolumeCrimson.clone();
    const portArmor = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 2.2, 5.5, 8),
      portMat,
    );
    portArmor.rotation.z = Math.PI / 3;
    portArmor.position.set(-5.8, 0.2, 0.5);
    portGroup.add(portArmor);
    group.add(portGroup);

    rawAppendages.push({
      id: 's2_port_vent',
      slot: 'port',
      name: 'Port Thermal Vent Plate',
      tacticalEffect: 'Left Magma Salvo Disabled',
      group: portGroup,
      localOffset: new THREE.Vector3(-5.8, 0.2, 0.5),
      hitRadius: 4.2,
      maxHp: 290,
      baseColorHex: 0xf43f5e,
      emissiveMat: portMat,
    });

    // 3. Starboard Appendage: Starboard Magma Vent Carapace
    const starboardGroup = new THREE.Group();
    const starboardMat = mats.biolumeCrimson.clone();
    const starboardArmor = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 2.2, 5.5, 8),
      starboardMat,
    );
    starboardArmor.rotation.z = -Math.PI / 3;
    starboardArmor.position.set(5.8, 0.2, 0.5);
    starboardGroup.add(starboardArmor);
    group.add(starboardGroup);

    rawAppendages.push({
      id: 's2_starboard_vent',
      slot: 'starboard',
      name: 'Starboard Thermal Vent Plate',
      tacticalEffect: 'Right Magma Salvo Disabled',
      group: starboardGroup,
      localOffset: new THREE.Vector3(5.8, 0.2, 0.5),
      hitRadius: 4.2,
      maxHp: 290,
      baseColorHex: 0xf43f5e,
      emissiveMat: starboardMat,
    });

    // 4. Ventral Appendage: Caudal Magma Tail Spine
    const ventralGroup = new THREE.Group();
    const ventralMat = mats.biolumeAmber.clone();
    for (let s = 1; s <= 3; s++) {
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(3.4 - s * 0.6, 3.8 - s * 0.6, 3.2, 10),
        ventralMat,
      );
      seg.rotation.x = Math.PI / 2;
      seg.position.set(0, -3.6 - s * 0.8, -s * 2.8);
      ventralGroup.add(seg);
      tentacles.push(seg);
    }
    group.add(ventralGroup);

    rawAppendages.push({
      id: 's2_ventral_tail',
      slot: 'ventral',
      name: 'Caudal Magma Tail Spine',
      tacticalEffect: 'Trench Propulsion -35%',
      group: ventralGroup,
      localOffset: new THREE.Vector3(0, -4.6, -2.5),
      hitRadius: 4.4,
      maxHp: 280,
      baseColorHex: 0xf59e0b,
      emissiveMat: ventralMat,
    });
  } else {
    // Stage 3 Boss: Xeno-Thalassa, The Hadal Biolume Empress
    coreFluidHex = 0x10b981;
    coreMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(2.8, 2),
      mats.biolumeEmerald.clone(),
    );
    group.add(coreMesh);

    const glassShell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.7, 1),
      mats.sapphireCanopy,
    );
    glassShell.renderOrder = 3;
    group.add(glassShell);

    // 1. Dorsal Appendage: Dorsal Sanctum Crown Torus
    const dorsalGroup = new THREE.Group();
    const dorsalMat = mats.biolumeCyan.clone();
    const sanctumRing = new THREE.Mesh(
      new THREE.TorusKnotGeometry(3.6, 0.52, 64, 12, 2, 3),
      dorsalMat,
    );
    sanctumRing.position.set(0, 4.5, 0);
    dorsalGroup.add(sanctumRing);
    outerRing.add(dorsalGroup);

    rawAppendages.push({
      id: 's3_dorsal_halo',
      slot: 'dorsal',
      name: 'Dorsal Sanctum Halo',
      tacticalEffect: 'Nova Recharge Slowed',
      group: dorsalGroup,
      localOffset: new THREE.Vector3(0, 4.6, 0),
      hitRadius: 4.4,
      maxHp: 420,
      baseColorHex: 0x06b6d4,
      emissiveMat: dorsalMat,
    });

    // 2. Port Appendage: Port Seraph Prism Wings
    const portGroup = new THREE.Group();
    const portMat = mats.biolumeEmerald.clone();
    for (let i = 0; i < 3; i++) {
      const wing = new THREE.Mesh(
        new THREE.ConeGeometry(0.95, 7.8, 5),
        portMat,
      );
      wing.position.set(-5.8 - i * 1.1, (i - 1) * 2.2, -0.4);
      wing.rotation.z = Math.PI / 2 + (i - 1) * 0.25;
      portGroup.add(wing);
      tentacles.push(wing);
    }
    group.add(portGroup);

    rawAppendages.push({
      id: 's3_port_wings',
      slot: 'port',
      name: 'Port Seraph Prism Wings',
      tacticalEffect: 'Port Prism Lances Severed',
      group: portGroup,
      localOffset: new THREE.Vector3(-6.2, 0, -0.4),
      hitRadius: 4.5,
      maxHp: 390,
      baseColorHex: 0x10b981,
      emissiveMat: portMat,
    });

    // 3. Starboard Appendage: Starboard Seraph Prism Wings
    const starboardGroup = new THREE.Group();
    const starboardMat = mats.biolumeEmerald.clone();
    for (let i = 0; i < 3; i++) {
      const wing = new THREE.Mesh(
        new THREE.ConeGeometry(0.95, 7.8, 5),
        starboardMat,
      );
      wing.position.set(5.8 + i * 1.1, (i - 1) * 2.2, -0.4);
      wing.rotation.z = -Math.PI / 2 - (i - 1) * 0.25;
      starboardGroup.add(wing);
      tentacles.push(wing);
    }
    group.add(starboardGroup);

    rawAppendages.push({
      id: 's3_starboard_wings',
      slot: 'starboard',
      name: 'Starboard Seraph Prism Wings',
      tacticalEffect: 'Starboard Prism Lances Severed',
      group: starboardGroup,
      localOffset: new THREE.Vector3(6.2, 0, -0.4),
      hitRadius: 4.5,
      maxHp: 390,
      baseColorHex: 0x10b981,
      emissiveMat: starboardMat,
    });

    // 4. Ventral Appendage: Ventral Hadal Lance Array
    const ventralGroup = new THREE.Group();
    const ventralMat = mats.biolumeMagenta.clone();
    for (let i = -1; i <= 1; i++) {
      const lance = new THREE.Mesh(
        new THREE.ConeGeometry(0.85, 6.4, 6),
        ventralMat,
      );
      lance.position.set(i * 2.1, -5.2, 0.4);
      lance.rotation.x = Math.PI;
      ventralGroup.add(lance);
    }
    group.add(ventralGroup);

    rawAppendages.push({
      id: 's3_ventral_lances',
      slot: 'ventral',
      name: 'Ventral Hadal Lance Array',
      tacticalEffect: 'Core Crit Multiplier +35%',
      group: ventralGroup,
      localOffset: new THREE.Vector3(0, -5.2, 0.4),
      hitRadius: 4.2,
      maxHp: 380,
      baseColorHex: 0xd946ef,
      emissiveMat: ventralMat,
    });
  }

  const coreDamageUniforms = attachBiolumeDamageShader(
    coreMesh.material as THREE.MeshStandardMaterial,
    coreFluidHex,
  );

  const appendages: BossAppendage3DNode[] = rawAppendages.map((raw) => {
    const damageUniforms = attachBiolumeDamageShader(
      raw.emissiveMat,
      raw.baseColorHex,
    );
    const leak = createBiolumeFluidLeakStream(
      raw.baseColorHex,
      raw.localOffset,
    );
    group.add(leak.mesh);
    return {
      ...raw,
      damageUniforms,
      fluidLeakMesh: leak.mesh,
      fluidLeakUniforms: leak.uniforms,
    };
  });

  return {
    group,
    coreMesh,
    coreDamageUniforms,
    outerRing,
    tentacles,
    telegraphHalo,
    appendages,
  };
}
