import * as THREE from 'three';
import {
  AppendageSlot,
  EnemyType,
  PrimaryWeaponId,
  SecondaryWeaponId,
  ShipClassId,
  StageId,
  UpgradeId,
} from './types';

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

interface EmberStreakNode {
  mesh: THREE.Mesh;
  seed: number;
  radialAngle: number;
  radialDist: number;
  speed: number;
}

interface ThrusterFlameAssembly {
  root: THREE.Group;
  nozzlePetalRing: THREE.Group;
  petalMeshes: THREE.Mesh[];
  flameHolderMesh: THREE.Mesh;
  exhaustDiscMesh: THREE.Mesh;
  innerCore: THREE.Mesh;
  midFlame: THREE.Mesh;
  outerPlume: THREE.Mesh;
  crossPlanes: THREE.Mesh[];
  shockRings: THREE.Mesh[];
  emberStreaks: EmberStreakNode[];
  coreShaderUniforms: {
    uTime: { value: number };
    uThrottle: { value: number };
    uPhase: { value: number };
  };
  plumeShaderUniforms: {
    uTime: { value: number };
    uThrottle: { value: number };
    uPhase: { value: number };
  };
  baseScale: number;
}

/**
 * Creates a custom GLSL Volumetric Orange-Blue Jet Afterburner ShaderMaterial.
 * Renders ionized cobalt-blue nozzle throat, blinding white-gold Mach shock diamonds,
 * and roaring turbulent orange-amber afterburner flame tongues with soft Fresnel edges.
 */
function createJetAfterburnerShaderMaterial(
  isInnerCore: boolean,
  phaseOffset: number,
): {
  material: THREE.ShaderMaterial;
  uniforms: {
    uTime: { value: number };
    uThrottle: { value: number };
    uPhase: { value: number };
  };
} {
  const uniforms = {
    uTime: { value: 0 },
    uThrottle: { value: 1.0 },
    uPhase: { value: phaseOffset },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float uTime;
      uniform float uThrottle;
      uniform float uPhase;
      varying vec2 vUv;
      varying vec3 vViewNormal;
      varying vec3 vViewDir;

      void main() {
        vUv = uv;
        // CylinderGeometry UV.y goes from 1.0 (nozzle base after translation) to 0.0 (plume tip)
        float flow = clamp(1.0 - uv.y, 0.0, 1.0);
        vec3 pos = position;

        // Supersonic Mach shock-cell radial expansion/contraction waves along the jet
        float speed = 22.0 + uThrottle * 14.0;
        float machWave = sin(flow * 18.8495 - uTime * 8.0 + uPhase) * 0.08 * (1.0 - flow * 0.65);

        // High-frequency turbulent whip & flutter toward the flame tail
        float turbX = sin(flow * 14.0 - uTime * speed + uPhase * 2.1) * 0.14 * pow(flow, 1.45) * uThrottle;
        float turbY = cos(flow * 16.5 - uTime * (speed * 1.12) + uPhase * 3.7) * 0.14 * pow(flow, 1.45) * uThrottle;

        pos.xy *= (1.0 + machWave);
        pos.x += turbX * 0.22;
        pos.y += turbY * 0.22;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        vViewNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uThrottle;
      uniform float uPhase;
      varying vec2 vUv;
      varying vec3 vViewNormal;
      varying vec3 vViewDir;

      // Multi-octave procedural jet combustion turbulence
      float jetNoise(vec2 p) {
        float n1 = sin(p.x * 6.28318 + sin(p.y * 5.0));
        float n2 = cos(p.y * 8.5 - cos(p.x * 12.566 + p.y * 3.2));
        float n3 = sin(p.x * 18.8495 - p.y * 14.2);
        return (n1 * 0.45 + n2 * 0.35 + n3 * 0.2) * 0.5 + 0.5;
      }

      void main() {
        float flow = clamp(1.0 - vUv.y, 0.0, 1.0);
        float streamSpeed = 18.0 + uThrottle * 12.0;

        vec2 noiseUv1 = vec2(vUv.x * 3.0, flow * 4.5 - uTime * streamSpeed * 0.18 + uPhase);
        vec2 noiseUv2 = vec2(vUv.x * 6.0 - 0.4, flow * 9.0 - uTime * streamSpeed * 0.31 - uPhase);
        float turb = jetNoise(noiseUv1) * 0.62 + jetNoise(noiseUv2) * 0.38;

        // Dynamic ragged flame tip cutoff (zero hard geometric cone edges)
        float tipCutoff = 0.72 + turb * 0.28;
        float tailMask = 1.0 - smoothstep(tipCutoff - 0.32, tipCutoff, flow);
        float nozzleEntryMask = smoothstep(0.0, 0.06, flow);

        // Supersonic standing Mach shock diamonds inside the exhaust stream
        float diamondWave = max(0.0, sin(flow * 18.84955 - 0.35));
        float machDiamond = pow(diamondWave, ${isInnerCore ? '3.2' : '5.0'}) * exp(-flow * 1.65) * (0.65 + 0.45 * uThrottle);

        // View-angle Fresnel softening so the cylinder edges feather smoothly
        float ndotv = abs(dot(normalize(vViewNormal), normalize(vViewDir)));
        float edgeSoft = pow(clamp(ndotv, 0.0, 1.0), ${isInnerCore ? '0.65' : '1.15'});

        // Realistic hydrocarbon/plasma jet afterburner color gradient:
        // 1. Ionized cobalt-blue at nozzle lip
        // 2. Blinding white-yellow core & Mach shock diamonds
        // 3. Incandescent golden-amber mid-plume
        // 4. Turbulent fiery orange-red outer sheath & tail tongues
        vec3 colBlueBase = vec3(0.22, 0.58, 1.0);
        vec3 colWhiteCore = vec3(1.0, 0.99, 0.92);
        vec3 colGoldMid = vec3(1.0, 0.78, 0.22);
        vec3 colOrangeFire = vec3(1.0, 0.38, 0.03);
        vec3 colCrimsonTip = vec3(0.88, 0.16, 0.01);

        vec3 flameCol = mix(colBlueBase, colGoldMid, smoothstep(0.04, 0.28, flow));
        flameCol = mix(flameCol, colOrangeFire, smoothstep(0.22, 0.62, flow));
        flameCol = mix(flameCol, colCrimsonTip, smoothstep(0.58, 0.95, flow));

        // Boost white-hot core and Mach shock diamonds
        float coreIntensity = (${isInnerCore ? '0.82' : '0.35'}) * (1.0 - flow * 0.55) + machDiamond * 1.15;
        flameCol = mix(flameCol, colWhiteCore, clamp(coreIntensity, 0.0, 1.0));

        // High-speed bright orange-gold ember streaks embedded in the turbulent boundary
        float emberStriations = smoothstep(0.74, 0.95, turb) * smoothstep(0.12, 0.85, flow);
        flameCol += vec3(1.0, 0.55, 0.1) * emberStriations * (0.5 + 0.4 * uThrottle);

        float brightness = (${isInnerCore ? '1.45' : '1.15'}) + (uThrottle - 1.0) * 0.55;
        float alpha = nozzleEntryMask * tailMask * (0.35 + 0.65 * turb) * (0.28 + 0.72 * edgeSoft);
        alpha *= clamp(${isInnerCore ? '0.95' : '0.82'} * (0.78 + 0.22 * uThrottle), 0.0, 0.98);

        if (alpha <= 0.01) discard;
        gl_FragColor = vec4(flameCol * brightness, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  return { material, uniforms };
}

/**
 * Builds a realistic mechanical Variable-Geometry Exhaust Nozzle ("Turkey-Feather" Petals + Hydraulic Actuators)
 * paired with a custom GLSL Volumetric Orange-Blue Jet Afterburner, Mach Shock Diamonds,
 * Cross-Plane Volumetric Core, and Streaming Turbulent Embers.
 */
function createRealisticThrusterAssembly(
  _coreMat: THREE.Material,
  _fireMidMat: THREE.Material,
  _outerTrimMat: THREE.Material,
  nozzleMetalMat: THREE.Material,
  actuatorSteelMat: THREE.Material,
  scale = 1.0,
): ThrusterFlameAssembly {
  const root = new THREE.Group();
  const phaseOffset = Math.random() * 6.28;

  // 1. Armored nozzle mount collar & cooling shroud ring
  const shroudCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.28 * scale,
      0.3 * scale,
      0.26 * scale,
      18,
    ).rotateX(Math.PI / 2),
    actuatorSteelMat,
  );
  shroudCollar.position.set(0, 0, -0.26 * scale);
  root.add(shroudCollar);

  // 2. Articulated 12-petal heat-stained variable-geometry exhaust nozzle
  const nozzlePetalRing = new THREE.Group();
  nozzlePetalRing.position.set(0, 0, -0.08 * scale);
  root.add(nozzlePetalRing);

  const petalMeshes: THREE.Mesh[] = [];
  const petalCount = 12;
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2;
    const petalPivot = new THREE.Group();
    petalPivot.rotation.z = angle;

    // Tapered overlapping turkey-feather nozzle petal
    const petalGeo = new THREE.BoxGeometry(
      0.11 * scale,
      0.026 * scale,
      0.34 * scale,
    );
    const petal = new THREE.Mesh(petalGeo, nozzleMetalMat);
    petal.position.set(0, 0.235 * scale, 0.04 * scale);
    petal.rotation.x = 0.16; // Converged at idle; pivots open during Ignite!
    petalPivot.add(petal);
    petalMeshes.push(petal);

    // External hydraulic actuator rod on every petal
    const rodGeo = new THREE.CylinderGeometry(
      0.014 * scale,
      0.018 * scale,
      0.28 * scale,
      6,
    ).rotateX(Math.PI / 2);
    const rod = new THREE.Mesh(rodGeo, actuatorSteelMat);
    rod.position.set(0, 0.275 * scale, -0.05 * scale);
    rod.rotation.x = 0.12;
    petalPivot.add(rod);

    nozzlePetalRing.add(petalPivot);
  }

  // 3. Internal turbine flame-holder ring & radial stator struts (glows hot cherry-orange on Ignite)
  const flameHolderMat = new THREE.MeshStandardMaterial({
    color: 0x3b2314,
    emissive: 0xff5500,
    emissiveIntensity: 0.75,
    metalness: 0.8,
    roughness: 0.35,
  });
  const flameHolderMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.15 * scale, 0.022 * scale, 8, 18),
    flameHolderMat,
  );
  flameHolderMesh.position.set(0, 0, -0.04 * scale);
  root.add(flameHolderMesh);

  // Radial turbine stator vanes inside throat
  for (let s = 0; s < 3; s++) {
    const vane = new THREE.Mesh(
      new THREE.BoxGeometry(0.32 * scale, 0.018 * scale, 0.04 * scale),
      flameHolderMat,
    );
    vane.rotation.z = (s / 3) * Math.PI;
    vane.position.set(0, 0, -0.05 * scale);
    root.add(vane);
  }

  // Nozzle exhaust interior combustion glow disc
  const exhaustDiscMat = new THREE.MeshBasicMaterial({
    color: 0xfff3c4,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const exhaustDiscMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.195 * scale, 18),
    exhaustDiscMat,
  );
  exhaustDiscMesh.position.set(0, 0, 0.01 * scale);
  root.add(exhaustDiscMesh);

  // 4. Custom GLSL Volumetric Jet Afterburner Plumes (Inner Mach Core + Mid Turbulent Fire + Outer Sheath)
  const coreShader = createJetAfterburnerShaderMaterial(true, phaseOffset);
  const plumeShader = createJetAfterburnerShaderMaterial(
    false,
    phaseOffset + 1.57,
  );

  // Layer 1: Supersonic White-Blue-Gold Inner Core Cylinder/Cone (open-ended for zero hard caps)
  const innerGeo = new THREE.CylinderGeometry(
    0.04 * scale,
    0.155 * scale,
    1.55 * scale,
    20,
    20,
    true,
  );
  innerGeo.rotateX(Math.PI / 2);
  innerGeo.translate(0, 0, 0.78 * scale);
  const innerCore = new THREE.Mesh(innerGeo, coreShader.material);
  innerCore.renderOrder = 6;
  root.add(innerCore);

  // Layer 2: Turbulent Orange-Amber Main Afterburner Plume
  const midGeo = new THREE.CylinderGeometry(
    0.065 * scale,
    0.22 * scale,
    2.05 * scale,
    24,
    24,
    true,
  );
  midGeo.rotateX(Math.PI / 2);
  midGeo.translate(0, 0, 1.02 * scale);
  const midFlame = new THREE.Mesh(midGeo, plumeShader.material);
  midFlame.renderOrder = 5;
  root.add(midFlame);

  // Layer 3: Outer Ionized Blue-Orange Turbulent Corona Sheath
  const outerGeo = new THREE.CylinderGeometry(
    0.09 * scale,
    0.26 * scale,
    2.35 * scale,
    24,
    20,
    true,
  );
  outerGeo.rotateX(Math.PI / 2);
  outerGeo.translate(0, 0, 1.16 * scale);
  const outerPlume = new THREE.Mesh(outerGeo, plumeShader.material);
  outerPlume.renderOrder = 4;
  root.add(outerPlume);

  // Layer 4: Two Intersecting Longitudinal Cross-Planes inside the plume for dense 360° volumetric core
  const crossPlanes: THREE.Mesh[] = [];
  [0, Math.PI / 2].forEach((rotAngle) => {
    const planeGeo = new THREE.PlaneGeometry(
      0.36 * scale,
      1.95 * scale,
      4,
      18,
    );
    planeGeo.rotateX(Math.PI / 2);
    planeGeo.rotateZ(rotAngle);
    planeGeo.translate(0, 0, 0.96 * scale);
    const cPlane = new THREE.Mesh(planeGeo, coreShader.material);
    cPlane.renderOrder = 6;
    root.add(cPlane);
    crossPlanes.push(cPlane);
  });

  // 5. Standing Supersonic Mach Shock-Diamond Discs along the exhaust jet
  const shockRingMat = new THREE.MeshBasicMaterial({
    color: 0xfffbeb,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shockRings: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const r = (0.14 - i * 0.026) * scale;
    const diamondGeo = new THREE.CylinderGeometry(
      r * 0.35,
      r,
      0.16 * scale,
      14,
      1,
      true,
    );
    diamondGeo.rotateX(Math.PI / 2);
    const ring = new THREE.Mesh(diamondGeo, shockRingMat);
    ring.position.set(0, 0, (0.24 + i * 0.34) * scale);
    ring.renderOrder = 7;
    root.add(ring);
    shockRings.push(ring);
  }

  // 6. High-Velocity Turbulent Ember & Spark Streaks streaming out of the nozzle
  const emberMat = new THREE.MeshBasicMaterial({
    color: 0xffaa22,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const emberGeo = new THREE.CapsuleGeometry(
    0.012 * scale,
    0.16 * scale,
    3,
    6,
  );
  emberGeo.rotateX(Math.PI / 2);

  const emberStreaks: EmberStreakNode[] = [];
  for (let e = 0; e < 10; e++) {
    const emberMesh = new THREE.Mesh(emberGeo, emberMat);
    emberMesh.renderOrder = 8;
    root.add(emberMesh);
    emberStreaks.push({
      mesh: emberMesh,
      seed: e * 0.137 + (phaseOffset % 1),
      radialAngle: (e / 10) * Math.PI * 2 + e * 0.7,
      radialDist: (0.04 + (e % 4) * 0.045) * scale,
      speed: 2.2 + (e % 3) * 0.65,
    });
  }

  return {
    root,
    nozzlePetalRing,
    petalMeshes,
    flameHolderMesh,
    exhaustDiscMesh,
    innerCore,
    midFlame,
    outerPlume,
    crossPlanes,
    shockRings,
    emberStreaks,
    coreShaderUniforms: coreShader.uniforms,
    plumeShaderUniforms: plumeShader.uniforms,
    baseScale: scale,
  };
}

/**
 * Helper to build a realistic naval hydro-fighter cockpit interior:
 * Includes dark cockpit tub, armored ejection seat with headrest, side consoles,
 * pilot control yoke, and dual MFD instrument glare-shield.
 */
function createCockpitInterior(
  darkMetalMat: THREE.Material,
  seatMat: THREE.Material,
  avionicsMat: THREE.Material,
): THREE.Group {
  const interior = new THREE.Group();

  // Cockpit floor tub & rear armored bulkhead
  const tub = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.14, 1.25),
    darkMetalMat,
  );
  tub.position.set(0, -0.08, 0);
  const bulkhead = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.42, 0.08),
    darkMetalMat,
  );
  bulkhead.position.set(0, 0.12, 0.56);
  bulkhead.rotation.x = -0.18;
  interior.add(tub, bulkhead);

  // Ejection seat cushion, backrest, and twin head-pad rails
  const seatBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.08, 0.34),
    seatMat,
  );
  seatBase.position.set(0, -0.01, 0.22);
  const seatBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.38, 0.07),
    seatMat,
  );
  seatBack.position.set(0, 0.16, 0.4);
  seatBack.rotation.x = -0.18;
  const headrest = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.12, 0.09),
    darkMetalMat,
  );
  headrest.position.set(0, 0.36, 0.44);
  interior.add(seatBase, seatBack, headrest);

  // Forward instrument glare-shield + twin recessed MFD screens + angled HUD combiner glass
  const dash = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.22, 0.38),
    darkMetalMat,
  );
  dash.position.set(0, 0.08, -0.42);
  const mfdLeft = new THREE.Mesh(
    new THREE.PlaneGeometry(0.14, 0.11),
    avionicsMat,
  );
  mfdLeft.position.set(-0.11, 0.12, -0.225);
  const mfdRight = new THREE.Mesh(
    new THREE.PlaneGeometry(0.14, 0.11),
    avionicsMat,
  );
  mfdRight.position.set(0.11, 0.12, -0.225);
  interior.add(dash, mfdLeft, mfdRight);

  // Center control stick / hydro-yoke
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.02, 0.22, 8),
    darkMetalMat,
  );
  stick.position.set(0, 0.04, -0.08);
  stick.rotation.x = 0.15;
  interior.add(stick);

  return interior;
}

/**
 * Builds all 4 distinct, photorealistic Naval Combat Submarine & Hydro-Fighter Chassis,
 * 3 Realistic Mechanical Primary Weapon Rigs, 3 Naval Torpedo/Missile Racks,
 * 8 Mechanical Instrument Modules, Bolted Reactive Armor Tier Evolution,
 * and Heat-Stained Variable-Geometry Exhausts.
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
  triggerWeaponFire: (isSecondary?: boolean) => void;
  updateShipEffects: (
    elapsed: number,
    dt: number,
    surgeBoost: number,
  ) => void;
} {
  const group = new THREE.Group();

  // Realistic military naval materials (Zero cartoon / zero neon plastic)
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

  // Subtle tactical navigation / avionics accent material (controlled intensity, never cartoon neon)
  const shipTrimMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.85,
    roughness: 0.35,
    metalness: 0.65,
  });

  // 1. Vanguard-IX Interceptor Hull: Weathered Cold-Rolled Naval Slate-Titanium
  const vanguardHullMat = mats.titaniumHull.clone();
  vanguardHullMat.color.setHex(0x647280);
  vanguardHullMat.metalness = 0.88;
  vanguardHullMat.roughness = 0.33;

  // 2. Maelstrom-XII Assault Submarine Hull: Heavy Dark Gunmetal Pressure Steel
  const assaultHullMat = mats.titaniumHull.clone();
  assaultHullMat.color.setHex(0x2c343d);
  assaultHullMat.metalness = 0.85;
  assaultHullMat.roughness = 0.38;

  // 3. Bathys-Bastion IV Guardian Hull: Deep-Trench Tungsten-Olive Armored Plate
  const guardianHullMat = mats.titaniumHull.clone();
  guardianHullMat.color.setHex(0x464d43);
  guardianHullMat.metalness = 0.84;
  guardianHullMat.roughness = 0.36;

  // 4. Nautilus-Spectre VII Tactical Hull: Faceted Stealth Charcoal-Titanium & Anechoic Plate
  const tacticalHullMat = mats.titaniumHull.clone();
  tacticalHullMat.color.setHex(0x21272f);
  tacticalHullMat.metalness = 0.78;
  tacticalHullMat.roughness = 0.4;

  // Realistic Fire & Afterburner Materials (Additive Blending)
  const fireWhiteCoreMat = new THREE.MeshBasicMaterial({
    color: 0xfffbeb,
    transparent: true,
    opacity: 0.96,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const fireThermalMidMat = new THREE.MeshBasicMaterial({
    color: 0xff6b00,
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const fireOuterPlasmaMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.48,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const muzzleFlashCoreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const muzzleFlashFireMat = new THREE.MeshBasicMaterial({
    color: 0xff7b00,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const thrusterAssemblies: ThrusterFlameAssembly[] = [];

  // ============================================================================
  // 1. FOUR UNIQUE, REALISTIC NAVAL COMBAT SUBMARINES & HYDRO-FIGHTERS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // CHASSIS A: VANGUARD-IX INTERCEPTOR
  // (High-Speed Supercavitating Naval Strike Hydro-Fighter — F-14 / Su-33 / Shkval Hybrid)
  // ----------------------------------------------------------------------------
  const interceptorChassis = new THREE.Group();
  {
    // Sculpted multi-station hydro-fighter pressure fuselage
    const lathePoints = [
      new THREE.Vector2(0.01, -2.95),
      new THREE.Vector2(0.11, -2.65),
      new THREE.Vector2(0.26, -2.05),
      new THREE.Vector2(0.54, -1.05),
      new THREE.Vector2(0.66, -0.15),
      new THREE.Vector2(0.64, 0.85),
      new THREE.Vector2(0.48, 1.55),
      new THREE.Vector2(0.22, 1.95),
      new THREE.Vector2(0.02, 2.1),
    ];
    const fuselageGeo = new THREE.LatheGeometry(lathePoints, 28);
    fuselageGeo.rotateX(Math.PI / 2);
    fuselageGeo.scale(1.08, 0.64, 1.0);
    const fuselage = new THREE.Mesh(fuselageGeo, vanguardHullMat);
    fuselage.castShadow = true;
    fuselage.receiveShadow = true;
    interceptorChassis.add(fuselage);

    // Machined steel supercavitating nose disk & pitot/sonar sting probe
    const cavitatorTip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.14, 0.22, 16).rotateX(Math.PI / 2),
      machinedSteelMat,
    );
    cavitatorTip.position.set(0, 0, -2.98);
    const pitotProbe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.024, 0.55, 8).rotateX(Math.PI / 2),
      machinedSteelMat,
    );
    pitotProbe.position.set(0, -0.02, -3.28);
    interceptorChassis.add(cavitatorTip, pitotProbe);

    // Raised dorsal avionics & ballast spine fairing with panel ribs
    const dorsalSpine = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.22, 2.35),
      vanguardHullMat,
    );
    dorsalSpine.position.set(0, 0.34, 0.45);
    interceptorChassis.add(dorsalSpine);

    for (let i = 0; i < 6; i++) {
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.05, 0.08),
        mats.darkGraphiteTrim,
      );
      rib.position.set(0, 0.44, -0.35 + i * 0.32);
      interceptorChassis.add(rib);
    }

    // Twin lateral variable-ramp hydro-intakes with internal turbine fan faces
    [-0.68, 0.68].forEach((sideX) => {
      const intakeBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.34, 1.85),
        vanguardHullMat,
      );
      intakeBox.position.set(sideX, -0.06, -0.05);
      intakeBox.rotation.z = sideX < 0 ? 0.12 : -0.12;

      const intakeSplitter = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.32, 0.48),
        machinedSteelMat,
      );
      intakeSplitter.position.set(sideX * 0.88, -0.06, -1.02);

      const intakeLip = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.36, 0.12),
        mats.darkGraphiteTrim,
      );
      intakeLip.position.set(sideX, -0.06, -0.96);

      const compressorFan = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.06, 12).rotateX(Math.PI / 2),
        machinedSteelMat,
      );
      compressorFan.position.set(sideX, -0.06, -0.88);

      interceptorChassis.add(
        intakeBox,
        intakeSplitter,
        intakeLip,
        compressorFan,
      );
    });

    // Variable-sweep naval strike hydro-wings with leading-edge slats & trailing flaps
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0.58, -0.65);
    wingShape.lineTo(1.45, -0.25);
    wingShape.lineTo(3.12, 0.55);
    wingShape.lineTo(3.05, 1.12);
    wingShape.lineTo(1.55, 0.92);
    wingShape.lineTo(0.58, 1.25);
    wingShape.closePath();

    const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
      steps: 1,
      depth: 0.09,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.025,
      bevelSegments: 2,
    });
    wingGeo.rotateX(Math.PI / 2);

    const rWing = new THREE.Mesh(wingGeo, vanguardHullMat);
    rWing.position.set(0, 0.04, 0);
    const lWing = new THREE.Mesh(wingGeo, vanguardHullMat);
    lWing.scale.set(-1, 1, 1);
    lWing.position.set(0, 0.04, 0);
    interceptorChassis.add(rWing, lWing);

    // Hinged ailerons, flap actuator fairings, and wingtip cavitation launch rails
    [-1, 1].forEach((dir) => {
      const aileron = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 0.04, 0.24),
        mats.darkGraphiteTrim,
      );
      aileron.position.set(dir * 2.15, 0.0, 1.02);
      aileron.rotation.y = dir * -0.11;

      const wingtipRail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 1.25, 10).rotateX(Math.PI / 2),
        machinedSteelMat,
      );
      wingtipRail.position.set(dir * 3.1, 0.0, 0.72);

      // Fairing blisters for hydraulic flap actuators
      for (let f = 0; f < 2; f++) {
        const blister = new THREE.Mesh(
          new THREE.ConeGeometry(0.045, 0.42, 8).rotateX(Math.PI / 2),
          machinedSteelMat,
        );
        blister.position.set(dir * (1.35 + f * 0.65), -0.06, 0.75 + f * 0.12);
        interceptorChassis.add(blister);
      }

      interceptorChassis.add(aileron, wingtipRail);
    });

    // Forward retractable bow dive planes (canards) with machined pivot spindles
    [-1, 1].forEach((dir) => {
      const canard = new THREE.Mesh(
        new THREE.BoxGeometry(0.88, 0.045, 0.36),
        mats.darkGraphiteTrim,
      );
      canard.position.set(dir * 0.68, 0.0, -1.52);
      canard.rotation.y = dir * -0.22;
      interceptorChassis.add(canard);
    });

    // Twin canted vertical stabilizers with rudder seams & mass-balance tips
    [-1, 1].forEach((dir) => {
      const tailFin = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.96, 0.88),
        vanguardHullMat,
      );
      tailFin.position.set(dir * 0.78, 0.5, 1.28);
      tailFin.rotation.z = dir * -0.28;

      const rudder = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.84, 0.24),
        mats.darkGraphiteTrim,
      );
      rudder.position.set(dir * 0.86, 0.48, 1.78);
      rudder.rotation.z = dir * -0.28;

      const topPod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8).rotateX(Math.PI / 2),
        machinedSteelMat,
      );
      topPod.position.set(dir * 0.91, 0.94, 1.32);

      interceptorChassis.add(tailFin, rudder, topPod);
    });

    // Detailed Cockpit Interior + Framed Smoked Armored Quartz Canopy
    const cockpitInterior = createCockpitInterior(
      mats.darkGraphiteTrim,
      anechoicRubberMat,
      shipTrimMat,
    );
    cockpitInterior.position.set(0, 0.26, -0.78);
    interceptorChassis.add(cockpitInterior);

    const canopyGeo = new THREE.SphereGeometry(
      0.46,
      20,
      14,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.52,
    );
    canopyGeo.scale(0.78, 0.68, 2.05);
    const canopy = new THREE.Mesh(canopyGeo, mats.sapphireCanopy);
    canopy.position.set(0, 0.26, -0.75);
    canopy.renderOrder = 4;
    interceptorChassis.add(canopy);

    // Heavy bolted steel canopy frame arches & center spine bar
    [-1.12, -0.68, -0.22].forEach((zPos, idx) => {
      const archRadius = idx === 1 ? 0.35 : 0.31;
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(archRadius, 0.024, 8, 18, Math.PI),
        mats.darkGraphiteTrim,
      );
      arch.position.set(0, 0.25, zPos);
      interceptorChassis.add(arch);
    });
    const canopySpine = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.035, 1.45),
      mats.darkGraphiteTrim,
    );
    canopySpine.position.set(0, 0.56, -0.72);
    interceptorChassis.add(canopySpine);

    // Twin Armored Engine Nacelles + Variable-Geometry Heat-Stained Nozzles
    [-0.56, 0.56].forEach((sideX) => {
      const nacelle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.29, 0.32, 1.95, 18).rotateX(Math.PI / 2),
         mats.darkGraphiteTrim,
      );
      nacelle.position.set(sideX, -0.02, 0.82);
      interceptorChassis.add(nacelle);

      const fl = createRealisticThrusterAssembly(
        fireWhiteCoreMat,
        fireThermalMidMat,
        fireOuterPlasmaMat,
        heatStainedNozzleMat,
        machinedSteelMat,
        0.95,
      );
      fl.root.position.set(sideX, -0.02, 1.92);
      interceptorChassis.add(fl.root);
      thrusterAssemblies.push(fl);
    });
  }
  group.add(interceptorChassis);

  // ----------------------------------------------------------------------------
  // CHASSIS B: MAELSTROM-XII ASSAULT SUBMARINE
  // (Heavy Typhoon / Seawolf-Class Naval Ballistic & Attack Submarine)
  // ----------------------------------------------------------------------------
  const assaultChassis = new THREE.Group();
  {
    // Main cylindrical/ovoid double-pressure submarine hull (smooth lathed bow-to-stern)
    const subPoints = [
      new THREE.Vector2(0.01, -3.05),
      new THREE.Vector2(0.38, -2.85),
      new THREE.Vector2(0.68, -2.35),
      new THREE.Vector2(0.82, -1.45),
      new THREE.Vector2(0.84, 0.45),
      new THREE.Vector2(0.72, 1.45),
      new THREE.Vector2(0.42, 2.05),
      new THREE.Vector2(0.05, 2.25),
    ];
    const mainPressureHullGeo = new THREE.LatheGeometry(subPoints, 28);
    mainPressureHullGeo.rotateX(Math.PI / 2);
    mainPressureHullGeo.scale(1.18, 0.78, 1.0);
    const mainPressureHull = new THREE.Mesh(mainPressureHullGeo, assaultHullMat);
    mainPressureHull.castShadow = true;
    mainPressureHull.receiveShadow = true;
    assaultChassis.add(mainPressureHull);

    // Spherical rubberized acoustic sonar dome on the bow + 6 recessed torpedo tube shutters
    const bowSonarCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.64, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.55),
      anechoicRubberMat,
    );
    bowSonarCap.rotation.x = -Math.PI / 2;
    bowSonarCap.scale.set(1.12, 1.0, 0.72);
    bowSonarCap.position.set(0, 0, -2.42);
    assaultChassis.add(bowSonarCap);

    // 6 mechanical bow torpedo tube muzzle doors (3 port, 3 starboard)
    [-1, 1].forEach((side) => {
      for (let t = 0; t < 3; t++) {
        const tubeDoor = new THREE.Mesh(
          new THREE.CylinderGeometry(0.09, 0.09, 0.35, 12).rotateX(Math.PI / 2),
          machinedSteelMat,
        );
        tubeDoor.position.set(
          side * (0.28 + t * 0.18),
          0.08 - t * 0.08,
          -2.55 + t * 0.14,
        );
        assaultChassis.add(tubeDoor);
      }
    });

    // Port & Starboard Typhoon-style Armored Lateral Ballast / Torpedo Saddle Blisters
    [-1.08, 1.08].forEach((sideX) => {
      const blisterGeo = new THREE.CapsuleGeometry(0.42, 2.65, 10, 18);
      blisterGeo.rotateX(Math.PI / 2);
      blisterGeo.scale(0.88, 0.72, 1.0);
      const blister = new THREE.Mesh(blisterGeo, assaultHullMat);
      blister.position.set(sideX, -0.08, -0.15);
      assaultChassis.add(blister);

      // Ballast tank flood vent grilles & sacrificial zinc anodes along the flanks
      for (let v = 0; v < 5; v++) {
        const floodGrille = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.14, 0.34),
          anechoicRubberMat,
        );
        floodGrille.position.set(
          sideX * 1.32,
          -0.12,
          -1.15 + v * 0.55,
        );
        assaultChassis.add(floodGrille);
      }
    });

    // Raised Dorsal Tortoise-Back VLS Missile Deck + 8 Mechanical VLS Missile Hatches
    const vlsDeck = new THREE.Mesh(
      new THREE.BoxGeometry(1.12, 0.32, 2.75),
      assaultHullMat,
    );
    vlsDeck.position.set(0, 0.56, 0.05);
    assaultChassis.add(vlsDeck);

    // 2 rows of 4 VLS vertical launch hatches with mechanical hinges (front 2 slightly open!)
    [-0.3, 0.3].forEach((rowX) => {
      for (let h = 0; h < 4; h++) {
        const hz = -0.35 + h * 0.52;
        const hatchRing = new THREE.Mesh(
          new THREE.CylinderGeometry(0.19, 0.21, 0.08, 14),
          mats.darkGraphiteTrim,
        );
        hatchRing.position.set(rowX, 0.72, hz);
        assaultChassis.add(hatchRing);

        if (h === 0) {
          // Open VLS hatch door + visible heavy ballistic torpedo warhead inside silo
          const openLid = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.18, 0.04, 14),
            machinedSteelMat,
          );
          openLid.position.set(rowX + (rowX < 0 ? -0.18 : 0.18), 0.86, hz);
          openLid.rotation.z = rowX < 0 ? 0.95 : -0.95;

          const siloWarhead = new THREE.Mesh(
            new THREE.ConeGeometry(0.13, 0.28, 12),
            navalBronzeMat,
          );
          siloWarhead.position.set(rowX, 0.78, hz);
          assaultChassis.add(openLid, siloWarhead);
        } else {
          const closedLid = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.18, 0.05, 14),
            machinedSteelMat,
          );
          closedLid.position.set(rowX, 0.75, hz);
          assaultChassis.add(closedLid);
        }
      }
    });

    // Submarine Conning Tower (Sail / Fin) with armored bridge windows, fairwater planes, and periscope masts
    const sailGroup = new THREE.Group();
    sailGroup.position.set(0, 0.82, -1.18);

    const sailTower = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.68, 1.15),
      assaultHullMat,
    );
    const sailNose = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.23, 0.68, 16),
      assaultHullMat,
    );
    sailNose.position.set(0, 0, -0.575);
    sailGroup.add(sailTower, sailNose);

    // Armored Submarine Bridge Viewport Slit
    const bridgeVisor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.245, 0.245, 0.16, 16, 1, false, -Math.PI * 0.4, Math.PI * 0.8),
      mats.sapphireCanopy,
    );
    bridgeVisor.rotation.y = Math.PI;
    bridgeVisor.position.set(0, 0.16, -0.58);
    sailGroup.add(bridgeVisor);

    // Fairwater diving planes mounted on the Conning Tower
    const fairwaterPlanes = new THREE.Mesh(
      new THREE.BoxGeometry(1.58, 0.055, 0.36),
      mats.darkGraphiteTrim,
    );
    fairwaterPlanes.position.set(0, 0.08, -0.25);
    sailGroup.add(fairwaterPlanes);

    // Telescoping Attack Periscope, Radar Mast, and Optronic Sensor Head
    const periscopeMast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.04, 0.58, 10),
      machinedSteelMat,
    );
    periscopeMast.position.set(-0.08, 0.56, -0.28);
    const periscopeHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.09, 0.14),
      mats.darkGraphiteTrim,
    );
    periscopeHead.position.set(-0.08, 0.85, -0.3);

    const radarMast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.035, 0.46, 10),
      machinedSteelMat,
    );
    radarMast.position.set(0.09, 0.5, 0.08);
    const esmBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 10, 10),
      navalBronzeMat,
    );
    esmBulb.position.set(0.09, 0.74, 0.08);

    sailGroup.add(periscopeMast, periscopeHead, radarMast, esmBulb);
    assaultChassis.add(sailGroup);

    // Heavy Retractable Bow Hydroplanes & Swept Lateral Stabilizer Wings
    const bowPlanes = new THREE.Mesh(
      new THREE.BoxGeometry(2.65, 0.07, 0.52),
      mats.darkGraphiteTrim,
    );
    bowPlanes.position.set(0, 0.02, -1.78);
    assaultChassis.add(bowPlanes);

    const mainHydroWing = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 0.14, 1.05),
      assaultHullMat,
    );
    mainHydroWing.position.set(0, -0.06, 0.35);
    assaultChassis.add(mainHydroWing);

    // Cruciform Stern Control Surfaces (Upper/Lower Vertical Rudders + Stern Planes)
    const upperRudder = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1.25, 0.85),
      mats.darkGraphiteTrim,
    );
    upperRudder.position.set(0, 0.52, 1.65);
    const sternPlanes = new THREE.Mesh(
      new THREE.BoxGeometry(2.45, 0.09, 0.72),
      mats.darkGraphiteTrim,
    );
    sternPlanes.position.set(0, 0.0, 1.65);
    assaultChassis.add(upperRudder, sternPlanes);

    // QUAD Shrouded Naval Pump-Jet / Variable-Geometry Exhaust Nozzles
    const quadCoords = [
      [-1.15, -0.06, 1.75],
      [-0.52, -0.02, 1.98],
      [0.52, -0.02, 1.98],
      [1.15, -0.06, 1.75],
    ];
    quadCoords.forEach(([x, y, z], idx) => {
      // Pump-jet annular shroud duct around outer propulsors
      const ductShroud = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.35, 0.52, 18, 1, true).rotateX(
          Math.PI / 2,
        ),
        assaultHullMat,
      );
      ductShroud.position.set(x, y, z - 0.15);
      assaultChassis.add(ductShroud);

      const fl = createRealisticThrusterAssembly(
        fireWhiteCoreMat,
        fireThermalMidMat,
        fireOuterPlasmaMat,
        heatStainedNozzleMat,
        machinedSteelMat,
        idx === 1 || idx === 2 ? 0.86 : 0.76,
      );
      fl.root.position.set(x, y, z);
      assaultChassis.add(fl.root);
      thrusterAssemblies.push(fl);
    });
  }
  assaultChassis.visible = false;
  group.add(assaultChassis);

  // ----------------------------------------------------------------------------
  // CHASSIS C: BATHYS-BASTION IV GUARDIAN
  // (Deep-Trench Twin-Hull Armored DSRV Bathyscaphe & Heavy Escort Submersible)
  // ----------------------------------------------------------------------------
  const guardianChassis = new THREE.Group();
  {
    // Central Reinforced Spherical/Cylindrical Titanium Pressure Hull
    const centralHull = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.76, 1.85, 16, 24).rotateX(Math.PI / 2),
      guardianHullMat,
    );
    centralHull.scale.set(1.12, 0.82, 1.0);
    centralHull.position.set(0, 0.08, -0.05);
    guardianChassis.add(centralHull);

    // Forward Deep-Submergence Spherical Titanium Crew Cabin with Bolted Viewport Cupola
    const cabinSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 22, 18),
      machinedSteelMat,
    );
    cabinSphere.position.set(0, 0.14, -1.25);
    guardianChassis.add(cabinSphere);

    // Smoked Quartz Bathyscaphe Viewport + Heavy Bolted Steel Bezel Ring
    const mainViewport = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.48,
        18,
        14,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.45,
      ),
      mats.sapphireCanopy,
    );
    mainViewport.rotation.x = -Math.PI * 0.35;
    mainViewport.position.set(0, 0.24, -1.52);
    mainViewport.renderOrder = 4;

    const viewportBezel = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.055, 10, 20),
      mats.darkGraphiteTrim,
    );
    viewportBezel.rotation.x = Math.PI * 0.15;
    viewportBezel.position.set(0, 0.26, -1.78);
    guardianChassis.add(mainViewport, viewportBezel);

    // Protective Steel Roll-Cage Guard Bars over the Crew Sphere
    for (let b = -1; b <= 1; b++) {
      const cageArch = new THREE.Mesh(
        new THREE.TorusGeometry(0.74, 0.032, 8, 20, Math.PI),
        machinedSteelMat,
      );
      cageArch.position.set(0, 0.14, -1.15 + b * 0.32);
      guardianChassis.add(cageArch);
    }

    // Twin Heavy Catamaran Armored Side Pontoons (Spaced Ballast & Shield Bulwarks)
    [-1.78, 1.78].forEach((sideX) => {
      const pontoon = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.48, 2.55, 12, 20).rotateX(Math.PI / 2),
        guardianHullMat,
      );
      pontoon.scale.set(0.95, 0.85, 1.0);
      pontoon.position.set(sideX, -0.04, 0.05);
      guardianChassis.add(pontoon);

      // Sloped Explosive Reactive Armor (ERA) / Spaced Titanium Plates bolted to outer pontoons
      for (let p = 0; p < 5; p++) {
        const eraBlock = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 0.42, 0.52),
          mats.darkGraphiteTrim,
        );
        eraBlock.position.set(
          sideX + (sideX < 0 ? -0.44 : 0.44),
          -0.02,
          -1.08 + p * 0.56,
        );
        eraBlock.rotation.z = sideX < 0 ? 0.18 : -0.18;
        guardianChassis.add(eraBlock);
      }

      // Forward Articulated Hydro-Bulwark Ramming Shields + Hydraulic Pistons
      const bowBumper = new THREE.Mesh(
        new THREE.BoxGeometry(0.78, 0.48, 0.22),
        machinedSteelMat,
      );
      bowBumper.position.set(sideX, -0.04, -1.78);
      bowBumper.rotation.y = sideX < 0 ? 0.25 : -0.25;
      guardianChassis.add(bowBumper);

      // Structural Steel Cross-Bridge Trusses connecting Central Hull to Pontoons
      [-0.75, 0.75].forEach((zBridge) => {
        const strut = new THREE.Mesh(
          new THREE.BoxGeometry(1.35, 0.28, 0.44),
          mats.darkGraphiteTrim,
        );
        strut.position.set(sideX * 0.55, 0.02, zBridge);

        const airFlask = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.11, 0.95, 12).rotateZ(Math.PI / 2),
          navalBronzeMat,
        );
        airFlask.position.set(sideX * 0.55, 0.22, zBridge);
        guardianChassis.add(strut, airFlask);
      });
    });

    // Dorsal Mechanical Active-Defense Countermeasure Turret & Towed-Winch Superstructure
    // (Replaces the old floating sci-fi torus halo with real naval hardware)
    const dorsalDeck = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.28, 1.65),
       mats.darkGraphiteTrim,
    );
    dorsalDeck.position.set(0, 0.64, 0.25);
    guardianChassis.add(dorsalDeck);

    // Twin 6-Cell Acoustic Countermeasure / Decoy Mortar Pods on Dorsal Deck
    [-0.44, 0.44].forEach((mx) => {
      const mortarBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.26, 0.42),
        machinedSteelMat,
      );
      mortarBox.position.set(mx, 0.84, 0.05);
      mortarBox.rotation.x = -0.35;
      guardianChassis.add(mortarBox);
    });

    // Dorsal Armored Acoustic Dome & Recovery Crane Davit Arch
    const sonarDome = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.42, 0.24, 18),
      anechoicRubberMat,
    );
    sonarDome.position.set(0, 0.86, 0.62);
    const gantryFrame = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.045, 8, 16, Math.PI),
      machinedSteelMat,
    );
    gantryFrame.position.set(0, 0.65, 0.95);
    gantryFrame.rotation.x = -0.25;
    guardianChassis.add(sonarDome, gantryFrame);

    // Triple Heavy Shrouded Vectoring Thrusters (Center Main + Port/Starboard Pontoons)
    const triCoords = [
      [-1.78, -0.04, 1.82],
      [0, 0.04, 1.98],
      [1.78, -0.04, 1.82],
    ];
    triCoords.forEach(([x, y, z], idx) => {
      const s = idx === 1 ? 1.15 : 0.92;
      const fl = createRealisticThrusterAssembly(
        fireWhiteCoreMat,
        fireThermalMidMat,
        fireOuterPlasmaMat,
        heatStainedNozzleMat,
        machinedSteelMat,
        s,
      );
      fl.root.position.set(x, y, z);
      guardianChassis.add(fl.root);
      thrusterAssemblies.push(fl);
    });
  }
  guardianChassis.visible = false;
  group.add(guardianChassis);

  // ----------------------------------------------------------------------------
  // CHASSIS D: NAUTILUS-SPECTRE VII TACTICAL
  // (Faceted Stealth Naval Recon Sub-Fighter — Lockheed Sea Shadow / X-Craft Prototype)
  // ----------------------------------------------------------------------------
  const tacticalChassis = new THREE.Group();
  let tacticalAwacsDish = new THREE.Group();
  {
    // Faceted Chined Stealth Fuselage (Radar/Sonar-deflecting flat angular planes)
    const stealthShape = new THREE.Shape();
    stealthShape.moveTo(0, -3.05);
    stealthShape.lineTo(0.68, -1.85);
    stealthShape.lineTo(3.15, 0.35);
    stealthShape.lineTo(2.75, 1.42);
    stealthShape.lineTo(1.38, 1.08);
    stealthShape.lineTo(0.65, 1.75);
    stealthShape.lineTo(0, 1.42);
    stealthShape.lineTo(-0.65, 1.75);
    stealthShape.lineTo(-1.38, 1.08);
    stealthShape.lineTo(-2.75, 1.42);
    stealthShape.lineTo(-3.15, 0.35);
    stealthShape.lineTo(-0.68, -1.85);
    stealthShape.closePath();

    const stealthGeo = new THREE.ExtrudeGeometry(stealthShape, {
      steps: 1,
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.09,
      bevelSize: 0.12,
      bevelSegments: 1, // Crisp faceted stealth chines
    });
    stealthGeo.rotateX(Math.PI / 2);
    const stealthBody = new THREE.Mesh(stealthGeo, tacticalHullMat);
    stealthBody.position.set(0, 0.1, 0);
    stealthBody.castShadow = true;
    stealthBody.receiveShadow = true;
    tacticalChassis.add(stealthBody);

    // Upper Faceted Spine Ridge with Anechoic Acoustic Tile Panels
    const upperRidgeGeo = new THREE.CylinderGeometry(0.28, 0.72, 3.65, 4);
    upperRidgeGeo.rotateY(Math.PI / 4);
    upperRidgeGeo.rotateX(Math.PI / 2);
    upperRidgeGeo.scale(1.15, 0.42, 1.0);
    const upperRidge = new THREE.Mesh(upperRidgeGeo, anechoicRubberMat);
    upperRidge.position.set(0, 0.24, -0.15);
    tacticalChassis.add(upperRidge);

    // Forward Dual Machined Steel Pitot-Acoustic Probes & Serrated Chines
    [-0.38, 0.38].forEach((px) => {
      const probe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.04, 0.85, 6).rotateX(Math.PI / 2),
        machinedSteelMat,
      );
      probe.position.set(px, -0.02, -2.55);
      tacticalChassis.add(probe);
    });

    // Cockpit Interior + Flush Faceted Armored Stealth Canopy with Sawtooth Frame
    const stealthInterior = createCockpitInterior(
      mats.darkGraphiteTrim,
      anechoicRubberMat,
      shipTrimMat,
    );
    stealthInterior.position.set(0, 0.22, -0.95);
    stealthInterior.scale.setScalar(0.86);
    tacticalChassis.add(stealthInterior);

    const stealthCanopyGeo = new THREE.CylinderGeometry(0.22, 0.48, 1.48, 4);
    stealthCanopyGeo.rotateY(Math.PI / 4);
    stealthCanopyGeo.rotateX(-Math.PI / 2);
    stealthCanopyGeo.scale(1.05, 0.42, 1.0);
    const stealthCanopy = new THREE.Mesh(stealthCanopyGeo, mats.sapphireCanopy);
    stealthCanopy.position.set(0, 0.32, -0.92);
    stealthCanopy.renderOrder = 4;
    tacticalChassis.add(stealthCanopy);

    // Bolted Sawtooth Canopy Frame Struts
    [-1, 1].forEach((side) => {
      const frameStrut = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.04, 1.45),
        machinedSteelMat,
      );
      frameStrut.position.set(side * 0.22, 0.38, -0.92);
      frameStrut.rotation.y = side * -0.14;
      tacticalChassis.add(frameStrut);
    });

    // Twin Inward-Canted Faceted Stealth Tail Fins (F-117 / YF-23 style V-tail)
    [-1, 1].forEach((side) => {
      const vFin = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.78, 0.92),
        tacticalHullMat,
      );
      vFin.position.set(side * 0.82, 0.42, 1.15);
      vFin.rotation.z = side * 0.42;
      tacticalChassis.add(vFin);

      // Wingtip Passive Hydrophone Tow-Pods
      const wingPod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 1.15, 8).rotateX(Math.PI / 2),
        machinedSteelMat,
      );
      wingPod.position.set(side * 2.95, 0.02, 0.85);
      tacticalChassis.add(wingPod);
    });

    // Rotating Dorsal Naval Phased-Array Sonar & ESM Radar Bar Assembly
    // (Realistic mechanical rotating naval radar/sonar array instead of sci-fi floating orb)
    tacticalAwacsDish = new THREE.Group();
    tacticalAwacsDish.position.set(0, 0.62, 0.38);

    const mastPylon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.22, 0.32, 8),
      machinedSteelMat,
    );
    mastPylon.position.set(0, -0.14, 0);

    const phasedArrayBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.68, 0.16, 0.34),
      tacticalHullMat,
    );
    const arrayFace = new THREE.Mesh(
      new THREE.BoxGeometry(1.58, 0.1, 0.36),
      anechoicRubberMat,
    );
    const centerHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.28, 0.22, 12),
      mats.darkGraphiteTrim,
    );
    const whipAntenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.022, 0.48, 6),
      machinedSteelMat,
    );
    whipAntenna.position.set(0.62, 0.28, 0);

    tacticalAwacsDish.add(
      mastPylon,
      phasedArrayBar,
      arrayFace,
      centerHub,
      whipAntenna,
    );
    tacticalChassis.add(tacticalAwacsDish);

    // Twin Shrouded Stealth Variable Exhaust Nozzles
    const stealthCoords = [
      [-0.65, -0.02, 1.68],
      [0.65, -0.02, 1.68],
    ];
    stealthCoords.forEach(([x, y, z]) => {
      // Serrated stealth heat-shield overhang above each nozzle
      const stealthHood = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.08, 0.48),
        anechoicRubberMat,
      );
      stealthHood.position.set(x, y + 0.26, z - 0.08);
      tacticalChassis.add(stealthHood);

      const fl = createRealisticThrusterAssembly(
        fireWhiteCoreMat,
        fireThermalMidMat,
        fireOuterPlasmaMat,
        heatStainedNozzleMat,
        machinedSteelMat,
        0.88,
      );
      fl.root.position.set(x, y, z);
      tacticalChassis.add(fl.root);
      thrusterAssemblies.push(fl);
    });
  }
  tacticalChassis.visible = false;
  group.add(tacticalChassis);

  // ----------------------------------------------------------------------------
  // CHASSIS E: BARRACUDA-X SKIMMER (`barracuda_skimmer` — Tier II)
  // (Forward-Swept Hydrofoil Interceptor with Twin Dorsal Hydro-Turbines)
  // ----------------------------------------------------------------------------
  const barracudaHullMat = mats.titaniumHull.clone();
  barracudaHullMat.color.setHex(0x4b6278);
  barracudaHullMat.metalness = 0.89;
  barracudaHullMat.roughness = 0.31;

  const barracudaChassis = new THREE.Group();
  {
    // Sleek needle-nose hydro-skimmer pressure hull
    const barracudaPoints = [
      new THREE.Vector2(0.01, -3.22),
      new THREE.Vector2(0.09, -2.85),
      new THREE.Vector2(0.24, -2.15),
      new THREE.Vector2(0.48, -1.15),
      new THREE.Vector2(0.58, -0.05),
      new THREE.Vector2(0.56, 0.95),
      new THREE.Vector2(0.42, 1.65),
      new THREE.Vector2(0.18, 2.02),
      new THREE.Vector2(0.02, 2.15),
    ];
    const bodyGeo = new THREE.LatheGeometry(barracudaPoints, 28);
    bodyGeo.rotateX(Math.PI / 2);
    bodyGeo.scale(1.12, 0.62, 1.0);
    const body = new THREE.Mesh(bodyGeo, barracudaHullMat);
    body.castShadow = true;
    body.receiveShadow = true;
    barracudaChassis.add(body);

    // Supercavitating bronze-tipped needle nose cone & chin acoustic radome blister
    const noseCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.55, 16).rotateX(-Math.PI / 2),
      navalBronzeMat,
    );
    noseCone.position.set(0, 0, -3.22);
    const chinSonar = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 16, 12),
      anechoicRubberMat,
    );
    chinSonar.scale.set(0.85, 0.52, 1.95);
    chinSonar.position.set(0, -0.22, -1.95);
    barracudaChassis.add(noseCone, chinSonar);

    // Forward-swept Su-47 / X-29 style titanium hydrofoils with anti-cavitation fences
    const fWingShape = new THREE.Shape();
    fWingShape.moveTo(0.52, -0.25);
    fWingShape.lineTo(1.45, 0.35);
    fWingShape.lineTo(3.25, -0.65);
    fWingShape.lineTo(3.32, -0.15);
    fWingShape.lineTo(1.75, 1.05);
    fWingShape.lineTo(0.52, 1.25);
    fWingShape.closePath();

    const fWingGeo = new THREE.ExtrudeGeometry(fWingShape, {
      steps: 1,
      depth: 0.085,
      bevelEnabled: true,
      bevelThickness: 0.022,
      bevelSize: 0.022,
      bevelSegments: 2,
    });
    fWingGeo.rotateX(Math.PI / 2);

    const rFoil = new THREE.Mesh(fWingGeo, barracudaHullMat);
    rFoil.position.set(0, 0.03, 0);
    const lFoil = new THREE.Mesh(fWingGeo, barracudaHullMat);
    lFoil.scale.set(-1, 1, 1);
    lFoil.position.set(0, 0.03, 0);
    barracudaChassis.add(rFoil, lFoil);

    // Wing fences, forward canards & wingtip torpedo launch rails
    [-1, 1].forEach((dir) => {
      const wingFence = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.24, 0.95),
        machinedSteelMat,
      );
      wingFence.position.set(dir * 1.85, 0.09, 0.35);

      const tipPod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 1.45, 10).rotateX(Math.PI / 2),
        mats.darkGraphiteTrim,
      );
      tipPod.position.set(dir * 3.26, 0.0, -0.35);

      const canard = new THREE.Mesh(
        new THREE.BoxGeometry(1.05, 0.045, 0.32),
        mats.darkGraphiteTrim,
      );
      canard.position.set(dir * 0.62, 0.02, -1.68);
      canard.rotation.y = dir * 0.24;

      barracudaChassis.add(wingFence, tipPod, canard);
    });

    // Twin Dorsal Hydro-Turbine Intake Scoops with exposed steel stator blades
    [-0.44, 0.44].forEach((sx) => {
      const duct = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.25, 1.65, 16).rotateX(Math.PI / 2),
        barracudaHullMat,
      );
      duct.position.set(sx, 0.28, 0.38);
      const fanRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.21, 0.032, 8, 16),
        machinedSteelMat,
      );
      fanRing.position.set(sx, 0.28, -0.45);
      barracudaChassis.add(duct, fanRing);
    });

    // Cockpit Interior + Bubble Armored Quartz Canopy
    const interior = createCockpitInterior(
      mats.darkGraphiteTrim,
      anechoicRubberMat,
      shipTrimMat,
    );
    interior.position.set(0, 0.24, -0.95);
    barracudaChassis.add(interior);

    const canopyGeo = new THREE.SphereGeometry(
      0.44,
      20,
      14,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.52,
    );
    canopyGeo.scale(0.76, 0.66, 2.15);
    const canopy = new THREE.Mesh(canopyGeo, mats.sapphireCanopy);
    canopy.position.set(0, 0.25, -0.92);
    canopy.renderOrder = 4;
    barracudaChassis.add(canopy);

    // Outward-canted twin vertical stabilizers + ventral hydro-skids
    [-1, 1].forEach((dir) => {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.065, 0.98, 0.85),
        barracudaHullMat,
      );
      fin.position.set(dir * 0.68, 0.54, 1.32);
      fin.rotation.z = dir * -0.34;
      barracudaChassis.add(fin);
    });

    // 2 Oversized Heat-Stained Variable-Geometry Nozzles
    [-0.48, 0.48].forEach((sx) => {
      const fl = createRealisticThrusterAssembly(
        fireWhiteCoreMat,
        fireThermalMidMat,
        fireOuterPlasmaMat,
        heatStainedNozzleMat,
        machinedSteelMat,
        1.04,
      );
      fl.root.position.set(sx, 0.04, 1.98);
      barracudaChassis.add(fl.root);
      thrusterAssemblies.push(fl);
    });
  }
  barracudaChassis.visible = false;
  group.add(barracudaChassis);

  // ----------------------------------------------------------------------------
  // CHASSIS F: SEAWOLF-XVI HUNTER-KILLER (`seawolf_hunter` — Tier VI)
  // (Tear-Drop Nuclear Attack Submarine with Conformal Flank Sonar & 3 Pump-Jets)
  // ----------------------------------------------------------------------------
  const seawolfHullMat = mats.titaniumHull.clone();
  seawolfHullMat.color.setHex(0x2d3b45);
  seawolfHullMat.metalness = 0.86;
  seawolfHullMat.roughness = 0.35;

  const seawolfChassis = new THREE.Group();
  {
    const subPoints = [
      new THREE.Vector2(0.01, -3.18),
      new THREE.Vector2(0.44, -2.92),
      new THREE.Vector2(0.76, -2.25),
      new THREE.Vector2(0.88, -1.15),
      new THREE.Vector2(0.86, 0.55),
      new THREE.Vector2(0.68, 1.52),
      new THREE.Vector2(0.36, 2.08),
      new THREE.Vector2(0.05, 2.25),
    ];
    const hullGeo = new THREE.LatheGeometry(subPoints, 30);
    hullGeo.rotateX(Math.PI / 2);
    hullGeo.scale(1.12, 0.84, 1.0);
    const hull = new THREE.Mesh(hullGeo, seawolfHullMat);
    hull.castShadow = true;
    hull.receiveShadow = true;
    seawolfChassis.add(hull);

    // Anechoic rubber bow sonar dome + bronze acoustic transducer strip
    const bowDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.66, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.55),
      anechoicRubberMat,
    );
    bowDome.rotation.x = -Math.PI / 2;
    bowDome.scale.set(1.08, 0.94, 0.78);
    bowDome.position.set(0, 0, -2.52);
    seawolfChassis.add(bowDome);

    // Wide Conformal Flank Sonar Arrays + 8 Angled Mid-Body Torpedo Tubes (4 per side)
    [-1, 1].forEach((dir) => {
      const flankArray = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.36, 2.85),
        anechoicRubberMat,
      );
      flankArray.position.set(dir * 0.94, -0.06, -0.25);
      const bronzeTrim = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.06, 2.65),
        navalBronzeMat,
      );
      bronzeTrim.position.set(dir * 0.95, -0.06, -0.25);
      seawolfChassis.add(flankArray, bronzeTrim);

      for (let t = 0; t < 4; t++) {
        const tube = new THREE.Mesh(
          new THREE.CylinderGeometry(0.085, 0.085, 0.45, 12).rotateX(Math.PI / 2),
          machinedSteelMat,
        );
        tube.position.set(dir * 0.88, 0.14 - (t % 2) * 0.14, -1.65 + t * 0.36);
        tube.rotation.y = dir * -0.18;
        seawolfChassis.add(tube);
      }
    });

    // Streamlined Seawolf Conning Tower (Sail) with Fillet Base & Periscope Array
    const sailFillet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.52, 1.55, 16).rotateX(Math.PI / 2),
      seawolfHullMat,
    );
    sailFillet.scale.set(0.85, 0.55, 1.0);
    sailFillet.position.set(0, 0.66, -0.95);

    const sailFin = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.72, 1.25),
      seawolfHullMat,
    );
    sailFin.position.set(0, 0.95, -0.95);

    const bridgeGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.16, 0.38),
      mats.sapphireCanopy,
    );
    bridgeGlass.position.set(0, 1.12, -1.42);
    seawolfChassis.add(sailFillet, sailFin, bridgeGlass);

    // 3 Telescoping Masts (Optronic Periscope, ESM Mast, SATCOM Antenna)
    [-0.28, 0.0, 0.28].forEach((mz, idx) => {
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.036, 0.55 - idx * 0.08, 10),
        machinedSteelMat,
      );
      mast.position.set(0, 1.48, -1.1 + mz);
      const sensor = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 10, 10),
        idx === 0 ? navalBronzeMat : mats.darkGraphiteTrim,
      );
      sensor.position.set(0, 1.75 - idx * 0.08, -1.1 + mz);
      seawolfChassis.add(mast, sensor);
    });

    // Retractable Bow Diving Planes + Swept Lateral Hydro-Wings with Wingtip Winglets
    const bowPlanes = new THREE.Mesh(
      new THREE.BoxGeometry(2.55, 0.065, 0.46),
      mats.darkGraphiteTrim,
    );
    bowPlanes.position.set(0, 0.06, -1.95);
    const mainPlanes = new THREE.Mesh(
      new THREE.BoxGeometry(5.85, 0.12, 1.12),
      seawolfHullMat,
    );
    mainPlanes.position.set(0, -0.08, 0.28);
    seawolfChassis.add(bowPlanes, mainPlanes);

    // Tall Vertical Tail Fin with Teardrop Towed-Array Sonar Pod at the Fin Tip
    const tailRudder = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 1.35, 0.88),
      mats.darkGraphiteTrim,
    );
    tailRudder.position.set(0, 0.58, 1.62);
    const towedPod = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.11, 0.95, 8, 14).rotateX(Math.PI / 2),
      machinedSteelMat,
    );
    towedPod.position.set(0, 1.24, 1.65);
    seawolfChassis.add(tailRudder, towedPod);

    // 3 Shrouded Pump-Jet Variable-Geometry Nozzles (1 Center Main + 2 Wing-Root)
    [
      [-1.08, -0.06, 1.82, 0.84],
      [0, 0.0, 2.08, 1.12],
      [1.08, -0.06, 1.82, 0.84],
    ].forEach(([x, y, z, sc]) => {
      const shroud = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34 * sc, 0.38 * sc, 0.48, 18, 1, true).rotateX(
          Math.PI / 2,
        ),
        seawolfHullMat,
      );
      shroud.position.set(x, y, z - 0.16);
      seawolfChassis.add(shroud);

      const fl = createRealisticThrusterAssembly(
        fireWhiteCoreMat,
        fireThermalMidMat,
        fireOuterPlasmaMat,
        heatStainedNozzleMat,
        machinedSteelMat,
        sc,
      );
      fl.root.position.set(x, y, z);
      seawolfChassis.add(fl.root);
      thrusterAssemblies.push(fl);
    });
  }
  seawolfChassis.visible = false;
  group.add(seawolfChassis);

  // ----------------------------------------------------------------------------
  // CHASSIS G: KRAKEN-PRIME VIII SIEGE GUNSHIP (`kraken_siege` — Tier VII)
  // (Trimaran 3-Hull Naval Siege Submersible with Dorsal Twin-Barrel Deck Gun Turret)
  // ----------------------------------------------------------------------------
  const krakenHullMat = mats.titaniumHull.clone();
  krakenHullMat.color.setHex(0x3b332e);
  krakenHullMat.metalness = 0.87;
  krakenHullMat.roughness = 0.36;

  const krakenChassis = new THREE.Group();
  let krakenTurret = new THREE.Group();
  {
    // Central Heavy Command Hull
    const centerHull = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.68, 2.65, 16, 24).rotateX(Math.PI / 2),
      krakenHullMat,
    );
    centerHull.scale.set(1.08, 0.78, 1.0);
    centerHull.position.set(0, 0.04, -0.15);
    krakenChassis.add(centerHull);

    // Forward Armored Command Cockpit & Bow Siege Ramming Prow
    const prowBlade = new THREE.Mesh(
      new THREE.ConeGeometry(0.48, 1.15, 6).rotateX(-Math.PI / 2),
      machinedSteelMat,
    );
    prowBlade.scale.set(1.15, 0.65, 1.0);
    prowBlade.position.set(0, -0.06, -2.35);

    const bridgeCanopy = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.28, 0.92),
      mats.sapphireCanopy,
    );
    bridgeCanopy.position.set(0, 0.42, -1.18);
    bridgeCanopy.renderOrder = 4;
    krakenChassis.add(prowBlade, bridgeCanopy);

    // Twin Outrigger Torpedo & Siege Hulls connected via Angled Box-Girder Hydrofoils
    [-2.05, 2.05].forEach((sideX) => {
      const outrigger = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.38, 2.35, 12, 18).rotateX(Math.PI / 2),
        krakenHullMat,
      );
      outrigger.position.set(sideX, -0.06, 0.15);

      const noseCap = new THREE.Mesh(
        new THREE.ConeGeometry(0.36, 0.75, 14).rotateX(-Math.PI / 2),
        navalBronzeMat,
      );
      noseCap.position.set(sideX, -0.06, -1.38);

      const crossStrutFront = new THREE.Mesh(
        new THREE.BoxGeometry(1.65, 0.18, 0.52),
        mats.darkGraphiteTrim,
      );
      crossStrutFront.position.set(sideX * 0.54, 0.0, -0.55);
      crossStrutFront.rotation.y = sideX < 0 ? 0.22 : -0.22;

      const crossStrutRear = new THREE.Mesh(
        new THREE.BoxGeometry(1.65, 0.18, 0.58),
        mats.darkGraphiteTrim,
      );
      crossStrutRear.position.set(sideX * 0.54, 0.0, 0.85);
      crossStrutRear.rotation.y = sideX < 0 ? -0.15 : 0.15;

      // Vertical stabilizer fin on each outrigger
      const outFin = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.78, 0.74),
        krakenHullMat,
      );
      outFin.position.set(sideX, 0.46, 1.05);

      krakenChassis.add(
        outrigger,
        noseCap,
        crossStrutFront,
        crossStrutRear,
        outFin,
      );
    });

    // Rotating Dorsal Twin-Barrel Naval Deck Gun Turret (`krakenTurret`)
    krakenTurret = new THREE.Group();
    krakenTurret.position.set(0, 0.62, 0.18);

    const turretBarbette = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.54, 0.22, 16),
      mats.darkGraphiteTrim,
    );
    turretBarbette.position.set(0, -0.08, 0);

    const turretHouse = new THREE.Mesh(
      new THREE.BoxGeometry(0.74, 0.32, 0.88),
      krakenHullMat,
    );
    turretHouse.position.set(0, 0.12, 0.05);

    [-0.18, 0.18].forEach((bx) => {
      const gunBarrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.075, 1.45, 12).rotateX(Math.PI / 2),
        machinedSteelMat,
      );
      gunBarrel.position.set(bx, 0.14, -0.85);
      const recoilSleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.095, 0.48, 12).rotateX(Math.PI / 2),
        navalBronzeMat,
      );
      recoilSleeve.position.set(bx, 0.14, -0.45);
      krakenTurret.add(gunBarrel, recoilSleeve);
    });
    krakenChassis.add(krakenTurret);

    // 4 Variable-Geometry Afterburners (2 Central + 2 Outrigger)
    [
      [-2.05, -0.06, 1.68, 0.82],
      [-0.44, 0.02, 1.92, 0.96],
      [0.44, 0.02, 1.92, 0.96],
      [2.05, -0.06, 1.68, 0.82],
    ].forEach(([x, y, z, sc]) => {
      const fl = createRealisticThrusterAssembly(
        fireWhiteCoreMat,
        fireThermalMidMat,
        fireOuterPlasmaMat,
        heatStainedNozzleMat,
        machinedSteelMat,
        sc,
      );
      fl.root.position.set(x, y, z);
      krakenChassis.add(fl.root);
      thrusterAssemblies.push(fl);
    });
  }
  krakenChassis.visible = false;
  group.add(krakenChassis);

  // ----------------------------------------------------------------------------
  // CHASSIS H: POSEIDON-VANGUARD XI CARRIER (`poseidon_carrier` — Tier VIII)
  // (Wide-Beam Submersible Tactical Strike Carrier with Twin Island Towers & 12-Cell VLS)
  // ----------------------------------------------------------------------------
  const poseidonHullMat = mats.titaniumHull.clone();
  poseidonHullMat.color.setHex(0x34423e);
  poseidonHullMat.metalness = 0.85;
  poseidonHullMat.roughness = 0.36;

  const poseidonChassis = new THREE.Group();
  let poseidonRadar = new THREE.Group();
  {
    // Lower Heavy Pressure Hull + Wide Armored Flight/Launch Deck Superstructure
    const lowerHull = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.78, 2.75, 16, 22).rotateX(Math.PI / 2),
      poseidonHullMat,
    );
    lowerHull.scale.set(1.42, 0.68, 1.0);
    lowerHull.position.set(0, -0.08, -0.05);

    const carrierDeck = new THREE.Mesh(
      new THREE.BoxGeometry(2.68, 0.26, 3.85),
      poseidonHullMat,
    );
    carrierDeck.position.set(0, 0.28, -0.12);
    poseidonChassis.add(lowerHull, carrierDeck);

    // Recessed Twin Electromagnetic Catapult Tracks & Bow Ski-Jump Ramp
    [-0.48, 0.48].forEach((tx) => {
      const track = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.04, 3.45),
        mats.darkGraphiteTrim,
      );
      track.position.set(tx, 0.42, -0.15);
      poseidonChassis.add(track);
    });

    // 12-Cell Dorsal VLS Missile Battery along Centerline Deck
    for (let r = 0; r < 6; r++) {
      [-0.22, 0.22].forEach((vx) => {
        const hatch = new THREE.Mesh(
          new THREE.CylinderGeometry(0.13, 0.14, 0.06, 12),
          machinedSteelMat,
        );
        hatch.position.set(vx, 0.43, -1.25 + r * 0.46);
        poseidonChassis.add(hatch);
      });
    }

    // Starboard Primary Navigation Bridge Island + Port Sensor/Radar Island
    [-1.08, 1.08].forEach((ix, idx) => {
      const island = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.64, 1.28),
        poseidonHullMat,
      );
      island.position.set(ix, 0.68, -0.15 + idx * 0.25);

      const bridgeWindows = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.16, 0.55),
        mats.sapphireCanopy,
      );
      bridgeWindows.position.set(ix, 0.82, -0.45 + idx * 0.25);
      poseidonChassis.add(island, bridgeWindows);
    });

    // Rotating Carrier Air/Sea Search Radar Array atop Starboard Island
    poseidonRadar = new THREE.Group();
    poseidonRadar.position.set(1.08, 1.15, 0.1);
    const radarDish = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.18, 0.18),
      machinedSteelMat,
    );
    const radarPedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.14, 0.24, 10),
      navalBronzeMat,
    );
    radarPedestal.position.set(0, -0.12, 0);
    poseidonRadar.add(radarDish, radarPedestal);
    poseidonChassis.add(poseidonRadar);

    // Lateral Sponsored Drone/Torpedo Launch Bays + Swept Deck Sponsons
    [-1.68, 1.68].forEach((sx) => {
      const sponson = new THREE.Mesh(
        new THREE.BoxGeometry(0.88, 0.32, 2.45),
        mats.darkGraphiteTrim,
      );
      sponson.position.set(sx, 0.04, 0.15);
      poseidonChassis.add(sponson);
    });

    // 4 Heavy Shrouded Carrier Vectoring Nozzles across the Wide Transom Stern
    [-1.26, -0.44, 0.44, 1.26].forEach((x, idx) => {
      const fl = createRealisticThrusterAssembly(
        fireWhiteCoreMat,
        fireThermalMidMat,
        fireOuterPlasmaMat,
        heatStainedNozzleMat,
        machinedSteelMat,
        idx === 1 || idx === 2 ? 0.96 : 0.86,
      );
      fl.root.position.set(x, 0.02, 1.96);
      poseidonChassis.add(fl.root);
      thrusterAssemblies.push(fl);
    });
  }
  poseidonChassis.visible = false;
  group.add(poseidonChassis);

  // ----------------------------------------------------------------------------
  // CHASSIS I: CHARYBDIS-XIII JUGGERNAUT (`charybdis_jugger` — Tier IX)
  // (Cruciform 4-Keel Hadal Siege Juggernaut with 5 Heat-Stained Nozzles)
  // ----------------------------------------------------------------------------
  const charybdisHullMat = mats.titaniumHull.clone();
  charybdisHullMat.color.setHex(0x3d292e);
  charybdisHullMat.metalness = 0.88;
  charybdisHullMat.roughness = 0.34;

  const charybdisChassis = new THREE.Group();
  {
    // Central Heavy Reactor Pressure Cylinder
    const reactorHull = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.74, 3.65, 22).rotateX(Math.PI / 2),
      charybdisHullMat,
    );
    reactorHull.position.set(0, 0.04, -0.1);
    charybdisChassis.add(reactorHull);

    // Armored Spherical Command Dome with Heavy Steel Blast Visor Louvers
    const bowCupola = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 22, 18),
      machinedSteelMat,
    );
    bowCupola.position.set(0, 0.06, -1.92);
    const visorGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.56, 0.22, 18, 1, false, -Math.PI * 0.4, Math.PI * 0.8),
      mats.sapphireCanopy,
    );
    visorGlass.rotation.y = Math.PI;
    visorGlass.position.set(0, 0.16, -2.12);
    charybdisChassis.add(bowCupola, visorGlass);

    // 4 Cruciform Armored Pressure Keels (Upper-Port, Upper-Starboard, Lower-Port, Lower-Starboard)
    [
      [-1.42, 0.42],
      [1.42, 0.42],
      [-1.58, -0.36],
      [1.58, -0.36],
    ].forEach(([kx, ky]) => {
      const keelPod = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.36, 2.55, 12, 18).rotateX(Math.PI / 2),
        charybdisHullMat,
      );
      keelPod.position.set(kx, ky, 0.08);

      // Hydraulic Bow Ramming Shield on each Keel
      const ramShield = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.44, 0.26),
        navalBronzeMat,
      );
      ramShield.position.set(kx, ky, -1.52);
      ramShield.rotation.y = kx < 0 ? 0.24 : -0.24;

      // Connecting Armored Bulkhead Struts & High-Pressure Ballast Flasks
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 0.22, 1.45),
        mats.darkGraphiteTrim,
      );
      strut.position.set(kx * 0.52, ky * 0.55, 0.05);

      const flask = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 1.45, 10).rotateX(Math.PI / 2),
        navalBronzeMat,
      );
      flask.position.set(kx * 0.78, ky + (ky > 0 ? 0.26 : -0.26), 0.05);

      charybdisChassis.add(keelPod, ramShield, strut, flask);
    });

    // Dorsal Heavy Crane Arch & Dual 8-Cell Countermeasure Mortars
    const dorsalArch = new THREE.Mesh(
      new THREE.TorusGeometry(0.88, 0.075, 10, 22, Math.PI),
      machinedSteelMat,
    );
    dorsalArch.position.set(0, 0.45, 0.35);
    charybdisChassis.add(dorsalArch);

    // 5 Heat-Stained Variable-Geometry Thruster Nozzles (1 Massive Center + 4 Cruciform Keels)
    [
      [0, 0.04, 2.05, 1.18],
      [-1.42, 0.42, 1.72, 0.78],
      [1.42, 0.42, 1.72, 0.78],
      [-1.58, -0.36, 1.72, 0.78],
      [1.58, -0.36, 1.72, 0.78],
    ].forEach(([x, y, z, sc]) => {
      const fl = createRealisticThrusterAssembly(
        fireWhiteCoreMat,
        fireThermalMidMat,
        fireOuterPlasmaMat,
        heatStainedNozzleMat,
        machinedSteelMat,
        sc,
      );
      fl.root.position.set(x, y, z);
      charybdisChassis.add(fl.root);
      thrusterAssemblies.push(fl);
    });
  }
  charybdisChassis.visible = false;
  group.add(charybdisChassis);

  // ----------------------------------------------------------------------------
  // CHASSIS J: VALKYRIE-ABYSSAL XIV SUPERSONIC (`valkyrie_supersonic` — Tier X)
  // (Twin-Fuselage Supercavitating Interceptor with Central Command Pod & Railgun Spine)
  // ----------------------------------------------------------------------------
  const valkyrieHullMat = mats.titaniumHull.clone();
  valkyrieHullMat.color.setHex(0x475569);
  valkyrieHullMat.metalness = 0.91;
  valkyrieHullMat.roughness = 0.28;

  const valkyrieChassis = new THREE.Group();
  {
    // Twin Parallel Supercavitating Pressure Fuselages (Port & Starboard Booms)
    const boomPoints = [
      new THREE.Vector2(0.01, -3.15),
      new THREE.Vector2(0.12, -2.75),
      new THREE.Vector2(0.32, -1.85),
      new THREE.Vector2(0.42, -0.55),
      new THREE.Vector2(0.42, 1.15),
      new THREE.Vector2(0.32, 1.85),
      new THREE.Vector2(0.05, 2.02),
    ];
    const boomGeo = new THREE.LatheGeometry(boomPoints, 24);
    boomGeo.rotateX(Math.PI / 2);
    boomGeo.scale(0.95, 0.75, 1.0);

    [-0.96, 0.96].forEach((bx) => {
      const boom = new THREE.Mesh(boomGeo, valkyrieHullMat);
      boom.position.set(bx, 0.0, 0);
      boom.castShadow = true;
      boom.receiveShadow = true;

      // Supercavitating nose cone & pitot sting on each twin fuselage
      const cavitator = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.13, 0.24, 14).rotateX(Math.PI / 2),
        navalBronzeMat,
      );
      cavitator.position.set(bx, 0, -3.18);
      const sting = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.022, 0.55, 8).rotateX(Math.PI / 2),
        machinedSteelMat,
      );
      sting.position.set(bx, 0, -3.48);

      // Twin inward-canted vertical tail fins on each boom
      const vFin = new THREE.Mesh(
        new THREE.BoxGeometry(0.065, 0.95, 0.92),
        valkyrieHullMat,
      );
      vFin.position.set(bx, 0.52, 1.28);
      vFin.rotation.z = bx < 0 ? -0.25 : 0.25;

      valkyrieChassis.add(boom, cavitator, sting, vFin);
    });

    // Central Armored Command Nacelle + Dorsal Electromagnetic Railgun Spine
    const centerPod = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.46, 1.95, 14, 20).rotateX(Math.PI / 2),
      valkyrieHullMat,
    );
    centerPod.scale.set(1.15, 0.72, 1.0);
    centerPod.position.set(0, 0.12, -0.35);
    valkyrieChassis.add(centerPod);

    const interior = createCockpitInterior(
      mats.darkGraphiteTrim,
      anechoicRubberMat,
      shipTrimMat,
    );
    interior.position.set(0, 0.28, -0.82);
    valkyrieChassis.add(interior);

    const canopyGeo = new THREE.SphereGeometry(
      0.44,
      20,
      14,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.52,
    );
    canopyGeo.scale(0.82, 0.65, 2.0);
    const canopy = new THREE.Mesh(canopyGeo, mats.sapphireCanopy);
    canopy.position.set(0, 0.28, -0.78);
    canopy.renderOrder = 4;
    valkyrieChassis.add(canopy);

    // Dorsal Spinal Railgun Barrel & Bronze Induction Clamps
    const spinalRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.16, 2.65),
      machinedSteelMat,
    );
    spinalRail.position.set(0, 0.48, 0.35);
    valkyrieChassis.add(spinalRail);
    for (let c = 0; c < 5; c++) {
      const clamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.22, 0.1),
        navalBronzeMat,
      );
      clamp.position.set(0, 0.48, -0.65 + c * 0.48);
      valkyrieChassis.add(clamp);
    }

    // Wide Gull Hydro-Wing Bridging Both Fuselages & Extending Outboard
    const crossWing = new THREE.Mesh(
      new THREE.BoxGeometry(6.65, 0.11, 1.18),
      valkyrieHullMat,
    );
    crossWing.position.set(0, 0.04, 0.22);
    valkyrieChassis.add(crossWing);

    // 4 Supersonic Variable-Geometry Nozzles (2 per Twin Fuselage)
    [-1.18, -0.74, 0.74, 1.18].forEach((x) => {
      const fl = createRealisticThrusterAssembly(
        fireWhiteCoreMat,
        fireThermalMidMat,
        fireOuterPlasmaMat,
        heatStainedNozzleMat,
        machinedSteelMat,
        0.85,
      );
      fl.root.position.set(x, 0.0, 1.95);
      valkyrieChassis.add(fl.root);
      thrusterAssemblies.push(fl);
    });
  }
  valkyrieChassis.visible = false;
  group.add(valkyrieChassis);

  // ----------------------------------------------------------------------------
  // CHASSIS K: TITAN-TRENCH XV DREADNOUGHT (`titan_dreadnought` — Tier XI)
  // (Heavy Naval Battleship Sub-Cruiser with Triple Gun Turrets, 16-Cell VLS & 5 Nozzles)
  // ----------------------------------------------------------------------------
  const titanHullMat = mats.titaniumHull.clone();
  titanHullMat.color.setHex(0x36312a);
  titanHullMat.metalness = 0.88;
  titanHullMat.roughness = 0.34;

  const titanChassis = new THREE.Group();
  let titanRadar = new THREE.Group();
  {
    // Massive Multi-Tiered Battleship Pressure Hull
    const dreadPoints = [
      new THREE.Vector2(0.01, -3.35),
      new THREE.Vector2(0.36, -3.05),
      new THREE.Vector2(0.74, -2.35),
      new THREE.Vector2(0.95, -1.25),
      new THREE.Vector2(0.98, 0.65),
      new THREE.Vector2(0.82, 1.68),
      new THREE.Vector2(0.45, 2.15),
      new THREE.Vector2(0.05, 2.28),
    ];
    const dreadGeo = new THREE.LatheGeometry(dreadPoints, 30);
    dreadGeo.rotateX(Math.PI / 2);
    dreadGeo.scale(1.26, 0.78, 1.0);
    const dreadHull = new THREE.Mesh(dreadGeo, titanHullMat);
    dreadHull.castShadow = true;
    dreadHull.receiveShadow = true;
    titanChassis.add(dreadHull);

    // Spaced Explosive Reactive Armor (ERA) Torpedo Belts along Both Sides
    [-1.28, 1.28].forEach((sx) => {
      const belt = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.44, 3.25),
        mats.darkGraphiteTrim,
      );
      belt.position.set(sx, -0.06, -0.1);
      titanChassis.add(belt);

      for (let b = 0; b < 6; b++) {
        const eraPlate = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.36, 0.46),
          navalBronzeMat,
        );
        eraPlate.position.set(
          sx + (sx < 0 ? -0.22 : 0.22),
          -0.06,
          -1.35 + b * 0.52,
        );
        titanChassis.add(eraPlate);
      }
    });

    // Raised Armored Superstructure Deck + Citadel Conning Tower
    const deckSuper = new THREE.Mesh(
      new THREE.BoxGeometry(1.42, 0.34, 3.35),
      titanHullMat,
    );
    deckSuper.position.set(0, 0.56, -0.15);

    const citadelBridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.68, 1.05),
      titanHullMat,
    );
    citadelBridge.position.set(0, 0.96, -0.15);

    const citadelVisor = new THREE.Mesh(
      new THREE.BoxGeometry(0.88, 0.18, 0.45),
      mats.sapphireCanopy,
    );
    citadelVisor.position.set(0, 1.12, -0.52);
    titanChassis.add(deckSuper, citadelBridge, citadelVisor);

    // Rotating Fire-Control Radar Mast atop Citadel
    titanRadar = new THREE.Group();
    titanRadar.position.set(0, 1.44, -0.15);
    const fcBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.16, 0.22),
      machinedSteelMat,
    );
    const fcHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 0.26, 12),
      navalBronzeMat,
    );
    titanRadar.add(fcBar, fcHub);
    titanChassis.add(titanRadar);

    // Triple Twin-Barrel Naval Battleship Gun Turrets (2 Forward Superfiring + 1 Aft)
    [
      [0, 0.74, -1.95, 0],
      [0, 0.88, -1.18, 0],
      [0, 0.78, 1.02, Math.PI],
    ].forEach(([tx, ty, tz, rotY]) => {
      const tGroup = new THREE.Group();
      tGroup.position.set(tx, ty, tz);
      tGroup.rotation.y = rotY;

      const house = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.26, 0.68),
        machinedSteelMat,
      );
      [-0.15, 0.15].forEach((bx) => {
        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.06, 0.98, 10).rotateX(Math.PI / 2),
          heatStainedNozzleMat,
        );
        barrel.position.set(bx, 0.04, -0.62);
        tGroup.add(barrel);
      });
      tGroup.add(house);
      titanChassis.add(tGroup);
    });

    // Heavy Swept Battleship Hydro-Wings
    const dreadWings = new THREE.Mesh(
      new THREE.BoxGeometry(6.35, 0.16, 1.28),
      titanHullMat,
    );
    dreadWings.position.set(0, -0.12, 0.35);
    titanChassis.add(dreadWings);

    // 5 Shrouded Dreadnought Variable-Geometry Nozzles
    [
      [-1.52, -0.08, 1.85, 0.82],
      [-0.78, -0.02, 2.02, 0.92],
      [0, 0.02, 2.15, 1.12],
      [0.78, -0.02, 2.02, 0.92],
      [1.52, -0.08, 1.85, 0.82],
    ].forEach(([x, y, z, sc]) => {
      const fl = createRealisticThrusterAssembly(
        fireWhiteCoreMat,
        fireThermalMidMat,
        fireOuterPlasmaMat,
        heatStainedNozzleMat,
        machinedSteelMat,
        sc,
      );
      fl.root.position.set(x, y, z);
      titanChassis.add(fl.root);
      thrusterAssemblies.push(fl);
    });
  }
  titanChassis.visible = false;
  group.add(titanChassis);

  // ----------------------------------------------------------------------------
  // CHASSIS L: SOVEREIGN-OMEGA XVI LEVIATHAN (`sovereign_leviathan` — Tier XII)
  // (Apex Hadal Flagship Super-Dreadnought with Tri-Wing Hull, Dual Radars & 6 Nozzles)
  // ----------------------------------------------------------------------------
  const sovereignHullMat = mats.titaniumHull.clone();
  sovereignHullMat.color.setHex(0x2b2620);
  sovereignHullMat.metalness = 0.92;
  sovereignHullMat.roughness = 0.28;

  const sovereignChassis = new THREE.Group();
  let sovereignRadar1 = new THREE.Group();
  let sovereignRadar2 = new THREE.Group();
  {
    // Central Sovereign Pressure Spine + Twin Forward Supercavitating Armored Prows
    const mainHull = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.84, 3.05, 18, 28).rotateX(Math.PI / 2),
      sovereignHullMat,
    );
    mainHull.scale.set(1.28, 0.74, 1.0);
    mainHull.position.set(0, 0.04, -0.1);
    sovereignChassis.add(mainHull);

    // Twin Forward Armored Prow Spears + Central Heavy Siege Hydro-Cannon Muzzle
    [-0.58, 0.58].forEach((px) => {
      const prowSpear = new THREE.Mesh(
        new THREE.ConeGeometry(0.34, 1.65, 8).rotateX(-Math.PI / 2),
        navalBronzeMat,
      );
      prowSpear.scale.set(0.95, 0.65, 1.0);
      prowSpear.position.set(px, -0.02, -2.75);
      sovereignChassis.add(prowSpear);
    });

    const spinalCannon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 1.45, 16).rotateX(Math.PI / 2),
      heatStainedNozzleMat,
    );
    spinalCannon.position.set(0, -0.04, -2.65);
    sovereignChassis.add(spinalCannon);

    // Swept Tri-Wing Configuration (Main Delta Hydro-Wing + Upper Forward-Swept Strakes + Ventral Foil)
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0.85, -1.25);
    wingShape.lineTo(2.15, -0.45);
    wingShape.lineTo(3.68, 0.65);
    wingShape.lineTo(3.45, 1.45);
    wingShape.lineTo(1.75, 1.15);
    wingShape.lineTo(0.85, 1.55);
    wingShape.closePath();

    const mainWingGeo = new THREE.ExtrudeGeometry(wingShape, {
      steps: 1,
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.035,
      bevelSegments: 2,
    });
    mainWingGeo.rotateX(Math.PI / 2);

    const rMainWing = new THREE.Mesh(mainWingGeo, sovereignHullMat);
    rMainWing.position.set(0, 0.02, 0);
    const lMainWing = new THREE.Mesh(mainWingGeo, sovereignHullMat);
    lMainWing.scale.set(-1, 1, 1);
    lMainWing.position.set(0, 0.02, 0);
    sovereignChassis.add(rMainWing, lMainWing);

    // Upper Anhedral Strike Foils & Gilded Naval Bronze Reactive Armor Chevrons
    [-1, 1].forEach((dir) => {
      const upperFoil = new THREE.Mesh(
        new THREE.BoxGeometry(2.45, 0.08, 0.68),
        navalBronzeMat,
      );
      upperFoil.position.set(dir * 1.85, 0.36, 0.35);
      upperFoil.rotation.z = dir * 0.18;
      upperFoil.rotation.y = dir * -0.22;

      const wingtipPod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 1.85, 12).rotateX(Math.PI / 2),
        machinedSteelMat,
      );
      wingtipPod.position.set(dir * 3.58, 0.02, 0.85);

      const twinTail = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 1.18, 1.05),
        sovereignHullMat,
      );
      twinTail.position.set(dir * 1.15, 0.64, 1.38);
      twinTail.rotation.z = dir * -0.26;

      sovereignChassis.add(upperFoil, wingtipPod, twinTail);
    });

    // Armored Command Bridge Citadel + Framed Quartz Command Canopy + Twin Dorsal Rail-Turrets
    const commandCitadel = new THREE.Mesh(
      new THREE.BoxGeometry(1.12, 0.48, 2.25),
      sovereignHullMat,
    );
    commandCitadel.position.set(0, 0.56, -0.35);

    const commandCanopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.52, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
      mats.sapphireCanopy,
    );
    commandCanopy.scale.set(0.95, 0.62, 1.95);
    commandCanopy.position.set(0, 0.68, -0.95);
    commandCanopy.renderOrder = 4;
    sovereignChassis.add(commandCitadel, commandCanopy);

    // Open VLS Silo Bank with Exposed Bronze-Gold Ballistic Warheads
    for (let s = 0; s < 4; s++) {
      [-0.36, 0.36].forEach((sx) => {
        const siloCollar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.16, 0.1, 12),
          machinedSteelMat,
        );
        siloCollar.position.set(sx, 0.82, -0.15 + s * 0.38);
        const warhead = new THREE.Mesh(
          new THREE.ConeGeometry(0.11, 0.24, 12),
          navalBronzeMat,
        );
        warhead.position.set(sx, 0.88, -0.15 + s * 0.38);
        sovereignChassis.add(siloCollar, warhead);
      });
    }

    // Dual Counter-Rotating Phased-Array Radar & Sonar Domes atop the Command Citadel
    sovereignRadar1 = new THREE.Group();
    sovereignRadar1.position.set(0, 1.08, 0.15);
    const radome1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.58, 0.12, 20),
      navalBronzeMat,
    );
    const radomeCross1 = new THREE.Mesh(
      new THREE.BoxGeometry(1.36, 0.08, 0.22),
      machinedSteelMat,
    );
    sovereignRadar1.add(radome1, radomeCross1);

    sovereignRadar2 = new THREE.Group();
    sovereignRadar2.position.set(0, 1.26, 0.15);
    const radomeCross2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.96, 0.1, 0.18),
      mats.darkGraphiteTrim,
    );
    sovereignRadar2.add(radomeCross2);
    sovereignChassis.add(sovereignRadar1, sovereignRadar2);

    // 6-Nozzle Variable-Geometry Afterburner Bank across the Sovereign Stern
    [
      [-1.82, -0.04, 1.78, 0.78],
      [-1.12, 0.0, 1.94, 0.9],
      [-0.38, 0.04, 2.08, 1.05],
      [0.38, 0.04, 2.08, 1.05],
      [1.12, 0.0, 1.94, 0.9],
      [1.82, -0.04, 1.78, 0.78],
    ].forEach(([x, y, z, sc]) => {
      const fl = createRealisticThrusterAssembly(
        fireWhiteCoreMat,
        fireThermalMidMat,
        fireOuterPlasmaMat,
        heatStainedNozzleMat,
        machinedSteelMat,
        sc,
      );
      fl.root.position.set(x, y, z);
      sovereignChassis.add(fl.root);
      thrusterAssemblies.push(fl);
    });
  }
  sovereignChassis.visible = false;
  group.add(sovereignChassis);

  // ============================================================================
  // 2. REALISTIC MECHANICAL PRIMARY WEAPON TURRET RIGS (With Barrel Recoil)
  // ============================================================================
  const primaryWeaponsRoot = new THREE.Group();
  group.add(primaryWeaponsRoot);

  // 2A. Cavitation Cannons (`cavitation_cannons`) - Twin 30mm Naval Autocannons with Perforated Cooling Jackets
  const priCavitationGroup = new THREE.Group();
  [-1.92, 1.92].forEach((sideX) => {
    // Hardpoint pylon & armored gunreceiver housing
    const receiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.26, 0.78),
      mats.darkGraphiteTrim,
    );
    receiver.position.set(sideX, -0.06, 0.32);

    // Brass ammunition feed chute & hydraulic recoil damper cylinder
    const ammoChute = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.14, 0.42),
      navalBronzeMat,
    );
    ammoChute.position.set(sideX * 0.92, -0.08, 0.35);

    const recoilSpring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.65, 10).rotateX(Math.PI / 2),
      machinedSteelMat,
    );
    recoilSpring.position.set(sideX, 0.05, -0.15);

    // Heavy rifled barrel + perforated thermal cooling shroud + slotted muzzle brake
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.075, 1.72, 12).rotateX(Math.PI / 2),
      machinedSteelMat,
    );
    barrel.position.set(sideX, -0.06, -0.42);

    const coolingJacket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.105, 0.92, 12).rotateX(Math.PI / 2),
      heatStainedNozzleMat,
    );
    coolingJacket.position.set(sideX, -0.06, -0.18);

    const muzzleBrake = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.075, 0.26, 12).rotateX(Math.PI / 2),
      heatStainedNozzleMat,
    );
    muzzleBrake.position.set(sideX, -0.06, -1.28);

    priCavitationGroup.add(
      receiver,
      ammoChute,
      recoilSpring,
      barrel,
      coolingJacket,
      muzzleBrake,
    );
  });
  primaryWeaponsRoot.add(priCavitationGroup);

  // 2B. Focused Bio-Lance (`focused_bio_lance`) - Twin Heavy Naval Electromagnetic Rail-Cannons
  const priBioLanceGroup = new THREE.Group();
  [-1.92, 1.92].forEach((sideX) => {
    const breechBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.32, 0.82),
      mats.darkGraphiteTrim,
    );
    breechBlock.position.set(sideX, -0.05, 0.38);

    const railUpper = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.075, 1.98),
      machinedSteelMat,
    );
    railUpper.position.set(sideX, 0.03, -0.38);

    const railLower = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.075, 1.98),
      machinedSteelMat,
    );
    railLower.position.set(sideX, -0.13, -0.38);

    const copperCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 1.85, 10).rotateX(Math.PI / 2),
      navalBronzeMat,
    );
    copperCore.position.set(sideX, -0.05, -0.35);

    // Machined steel & bronze induction clamp collars along the barrel
    for (let c = 0; c < 4; c++) {
      const clamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.24, 0.1),
        heatStainedNozzleMat,
      );
      clamp.position.set(sideX, -0.05, 0.12 - c * 0.42);
      priBioLanceGroup.add(clamp);
    }

    priBioLanceGroup.add(breechBlock, railUpper, railLower, copperCore);
  });
  priBioLanceGroup.visible = false;
  primaryWeaponsRoot.add(priBioLanceGroup);

  // 2C. Burst-Pulse Quad Repeater (`burst_pulse_repeater`) - Twin 6-Barrel Phalanx CIWS Rotary Gatling Pods
  const priBurstRepeaterGroup = new THREE.Group();
  [-1.92, 1.92].forEach((sideX) => {
    const ammoDrum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.72, 16).rotateX(Math.PI / 2),
      mats.darkGraphiteTrim,
    );
    ammoDrum.position.set(sideX, -0.05, 0.18);

    const feedBelt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 0.14, 16).rotateX(Math.PI / 2),
      navalBronzeMat,
    );
    feedBelt.position.set(sideX, -0.05, 0.18);
    priBurstRepeaterGroup.add(ammoDrum, feedBelt);

    // 6 rotary stainless steel Gatling barrels arranged in a circle
    for (let b = 0; b < 6; b++) {
      const ang = (b / 6) * Math.PI * 2;
      const ox = Math.cos(ang) * 0.085;
      const oy = Math.sin(ang) * 0.085;
      const miniBarrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, 1.52, 8).rotateX(Math.PI / 2),
        machinedSteelMat,
      );
      miniBarrel.position.set(sideX + ox, -0.05 + oy, -0.52);
      priBurstRepeaterGroup.add(miniBarrel);
    }

    // Dual heat-stained barrel spacer clamps
    [-0.35, -1.08].forEach((cz) => {
      const clampRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.09, 14).rotateX(Math.PI / 2),
        heatStainedNozzleMat,
      );
      clampRing.position.set(sideX, -0.05, cz);
      priBurstRepeaterGroup.add(clampRing);
    });
  });
  priBurstRepeaterGroup.visible = false;
  primaryWeaponsRoot.add(priBurstRepeaterGroup);

  // 2D. Realistic 3D Muzzle Flash Starbursts + Cavitation Shockwave Rings
  const muzzleFlashGroups: THREE.Group[] = [];
  [-1.92, 1.92].forEach((sideX) => {
    const mf = new THREE.Group();
    mf.position.set(sideX, -0.05, -1.42);

    const coreBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 10),
      muzzleFlashCoreMat,
    );
    const flameCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.95, 10).rotateX(-Math.PI / 2),
      muzzleFlashFireMat,
    );
    flameCone.position.set(0, 0, -0.38);

    const starPlaneGeo = new THREE.PlaneGeometry(0.85, 0.85);
    const star1 = new THREE.Mesh(starPlaneGeo, muzzleFlashFireMat);
    const star2 = new THREE.Mesh(starPlaneGeo, muzzleFlashCoreMat);
    star2.rotation.z = Math.PI / 4;

    const shockRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.035, 8, 20),
      muzzleFlashCoreMat,
    );

    mf.add(coreBall, flameCone, star1, star2, shockRing);
    mf.visible = false;
    primaryWeaponsRoot.add(mf);
    muzzleFlashGroups.push(mf);
  });

  // ============================================================================
  // 3. REALISTIC NAVAL TORPEDO & MISSILE ORDNANCE PODS (Under-Wing / Sponsons)
  // ============================================================================
  const secondaryOrdnanceRoot = new THREE.Group();
  group.add(secondaryOrdnanceRoot);

  // 3A. Sonic Homing Torpedoes (`sonic_torpedoes`) - Triple Mk-54 Naval Torpedo Launch Tubes
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
        navalBronzeMat,
      );
      warhead.position.set(sideX + ox, -0.28 + oy, -0.52);

      secSonicPodsGroup.add(tube, warhead);
    });
  });
  secondaryOrdnanceRoot.add(secSonicPodsGroup);

  // 3B. Heavy Breach Torpedo (`heavy_breach_torpedo`) - Mk-48 ADCAP Heavyweight Wire-Guided Torpedoes
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

    // Brass tactical warhead band & blunt acoustic homing nose
    const warheadBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.173, 0.173, 0.22, 16).rotateX(Math.PI / 2),
      navalBronzeMat,
    );
    warheadBand.position.set(sideX, -0.32, -0.58);

    const noseDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 14, 12),
      machinedSteelMat,
    );
    noseDome.scale.set(1, 1, 1.35);
    noseDome.position.set(sideX, -0.32, -0.76);

    // Shrouded pump-jet tail ring & cruciform fins
    const tailShroud = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.16, 0.28, 14).rotateX(Math.PI / 2),
      machinedSteelMat,
    );
    tailShroud.position.set(sideX, -0.32, 0.85);

    secHeavyBreachGroup.add(
      pylon,
      torpBody,
      warheadBand,
      noseDome,
      tailShroud,
    );
  });
  secHeavyBreachGroup.visible = false;
  secondaryOrdnanceRoot.add(secHeavyBreachGroup);

  // 3C. Hexa-Swarm Rack (`hexa_swarm_rack`) - 6-Cell Armored Naval Box Missile Launchers
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
          navalBronzeMat,
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
      fireWhiteCoreMat,
      fireThermalMidMat,
      fireOuterPlasmaMat,
      heatStainedNozzleMat,
      machinedSteelMat,
      0.56,
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
    // Wingtip Titanium Hydrodynamic Strakes + Dorsal Twin Whip Antennae
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
    // Mk.III Heavy Stern Pump-Jet Stator Shroud Ring & Forward Bolted Tungsten Armor Chevrons
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

  // Dynamic Stern Afterburner Light (casts real flickering orange-amber firelight onto nozzles & rear hull)
  const afterburnerLight = new THREE.PointLight(0xff7711, 2.2, 10.5, 1.6);
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

  // Internal state for weapon recoil & muzzle flash timers
  let weaponRecoilOffset = 0;
  let muzzleFlashTimer = 0;
  let smoothThrottle = 1.0;
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

    // 1. Toggle all 12 completely distinct realistic naval ship chassis
    interceptorChassis.visible = shipId === 'vanguard_interceptor';
    barracudaChassis.visible = shipId === 'barracuda_skimmer';
    assaultChassis.visible = shipId === 'leviathan_assault';
    guardianChassis.visible = shipId === 'aegis_guardian';
    tacticalChassis.visible = shipId === 'echo_tactical';
    seawolfChassis.visible = shipId === 'seawolf_hunter';
    krakenChassis.visible = shipId === 'kraken_siege';
    poseidonChassis.visible = shipId === 'poseidon_carrier';
    charybdisChassis.visible = shipId === 'charybdis_jugger';
    valkyrieChassis.visible = shipId === 'valkyrie_supersonic';
    titanChassis.visible = shipId === 'titan_dreadnought';
    sovereignChassis.visible = shipId === 'sovereign_leviathan';

    // Adjust weapon hardpoint width slightly per chassis beam/wingspan
    const wingSpanScale =
      shipId === 'sovereign_leviathan'
        ? 1.32
        : shipId === 'titan_dreadnought' || shipId === 'valkyrie_supersonic'
          ? 1.24
          : shipId === 'kraken_siege' || shipId === 'poseidon_carrier'
            ? 1.22
            : shipId === 'aegis_guardian' || shipId === 'charybdis_jugger'
              ? 1.18
              : shipId === 'leviathan_assault' || shipId === 'seawolf_hunter'
                ? 1.12
                : shipId === 'echo_tactical' || shipId === 'barracuda_skimmer'
                  ? 1.06
                  : 1.0;
    primaryWeaponsRoot.scale.set(wingSpanScale, 1, 1);
    secondaryOrdnanceRoot.scale.set(wingSpanScale, 1, 1);

    // 2. Toggle visible 3D Primary Weapon model
    const priId = currentLoadoutState.primaryWeaponId || 'cavitation_cannons';
    priCavitationGroup.visible = priId === 'cavitation_cannons';
    priBioLanceGroup.visible = priId === 'focused_bio_lance';
    priBurstRepeaterGroup.visible = priId === 'burst_pulse_repeater';

    // 3. Toggle visible 3D Secondary Ordnance Pods
    const secId = currentLoadoutState.secondaryWeaponId || 'sonic_torpedoes';
    secSonicPodsGroup.visible = secId === 'sonic_torpedoes';
    secHeavyBreachGroup.visible = secId === 'heavy_breach_torpedo';
    secHexaSwarmGroup.visible = secId === 'hexa_swarm_rack';

    // 4. Toggle all 8 visible 3D Instrument Modules & scale them by Upgrade Tier (I..III)
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

    // 5. Compute Ship Level / Total Upgrade Tier Visual Evolution (Mk.I -> Mk.II -> Mk.III)
    const totalTierPoints = activeMods.reduce(
      (sum, id) => sum + (tiers?.[id] || 1),
      0,
    );
    const pilotLv = currentLoadoutState.pilotLevel || 1;
    tierMk2EvolutionGroup.visible = totalTierPoints >= 3 || pilotLv >= 3;
    tierMk3EvolutionGroup.visible = totalTierPoints >= 6 || pilotLv >= 6;

    // 6. Subtle tactical livery tinting on hull & avionics
    shipTrimMat.color.setHex(trimHex);
    shipTrimMat.emissive.setHex(trimHex);
    fireOuterPlasmaMat.color.setHex(trimHex);
    shieldMat.color.setHex(trimHex);
  }

  function triggerWeaponFire(isSecondary = false) {
    weaponRecoilOffset = isSecondary ? 0.34 : 0.22;
    muzzleFlashTimer = isSecondary ? 0.12 : 0.075;
    muzzleFlashCoreMat.opacity = 0.95;
    muzzleFlashFireMat.opacity = 0.88;
    muzzleFlashGroups.forEach((mf) => {
      mf.visible = true;
      mf.rotation.z = Math.random() * Math.PI * 2;
      const s = isSecondary ? 1.35 : 0.85 + Math.random() * 0.45;
      mf.scale.setScalar(s);
    });
  }

  function updateShipEffects(elapsed: number, dt: number, surgeBoost: number) {
    // Smoothly damp throttle state for realistic mechanical spool-up and spool-down
    smoothThrottle = THREE.MathUtils.damp(
      smoothThrottle,
      surgeBoost,
      surgeBoost > smoothThrottle ? 14 : 5.5,
      dt,
    );
    const boostFactor = Math.max(0, (smoothThrottle - 1.0) / 1.4); // 0.0 at idle -> 1.0+ at full Ignite

    // 1. Animate pump-jet rotor ring & rotating radar/sonar/turret assemblies on active hulls
    turbineRing.rotation.z += dt * 6.5 * smoothThrottle;
    if (tacticalChassis.visible) {
      tacticalAwacsDish.rotation.y += dt * 1.8 * smoothThrottle;
    }
    if (krakenChassis.visible) {
      krakenTurret.rotation.y = Math.sin(elapsed * 1.2) * 0.28;
    }
    if (poseidonChassis.visible) {
      poseidonRadar.rotation.y += dt * 2.1 * smoothThrottle;
    }
    if (titanChassis.visible) {
      titanRadar.rotation.y += dt * 1.9 * smoothThrottle;
    }
    if (sovereignChassis.visible) {
      sovereignRadar1.rotation.y += dt * 1.6 * smoothThrottle;
      sovereignRadar2.rotation.y -= dt * 2.4 * smoothThrottle;
    }

    // 2. Dynamic Stern Afterburner Firelight
    const highFreqFlicker =
      0.92 + Math.sin(elapsed * 54) * 0.12 + Math.cos(elapsed * 71) * 0.08;
    afterburnerLight.intensity =
      (1.8 + boostFactor * 6.4) * highFreqFlicker;
    afterburnerLight.distance = 8.5 + boostFactor * 6.5;

    // 3. Animate Variable-Geometry Nozzle Petals, Volumetric GLSL Flames, Mach Diamonds & Turbulent Embers
    const lengthBoost = 1.0 + boostFactor * 1.15;
    const radialBoost = 1.0 + boostFactor * 0.34;
    const nozzleApertureScale =
      0.96 + boostFactor * 0.22 + Math.sin(elapsed * 18) * 0.015;
    // Nozzle petals physically pivot open from converged (0.18 rad) to wide-open (-0.08 rad) during Ignite!
    const targetPetalAngle = 0.18 - boostFactor * 0.26;

    thrusterAssemblies.forEach((asm, idx) => {
      if (asm.root.parent && !asm.root.parent.visible) return;
      const phase = idx * 1.3;
      const localFlicker =
        highFreqFlicker + Math.sin(elapsed * 41 + phase) * 0.09;

      // Update GLSL shader uniforms
      asm.coreShaderUniforms.uTime.value = elapsed;
      asm.coreShaderUniforms.uThrottle.value = smoothThrottle;
      asm.plumeShaderUniforms.uTime.value = elapsed;
      asm.plumeShaderUniforms.uThrottle.value = smoothThrottle;

      // Articulate variable-geometry nozzle petals & internal glowing flame-holder
      asm.nozzlePetalRing.scale.set(
        nozzleApertureScale,
        nozzleApertureScale,
        1,
      );
      for (let p = 0; p < asm.petalMeshes.length; p++) {
        asm.petalMeshes[p].rotation.x = targetPetalAngle;
      }

      const fhMat = asm.flameHolderMesh.material as THREE.MeshStandardMaterial;
      fhMat.emissiveIntensity = (0.75 + boostFactor * 2.8) * localFlicker;

      // Scale volumetric GLSL flame meshes
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

      // Animate standing supersonic Mach shock diamonds
      asm.shockRings.forEach((ring, rIdx) => {
        const pulse =
          (1.0 + boostFactor * 0.25) *
          (1 + Math.sin(elapsed * 42 - rIdx * 1.4 + phase) * 0.15);
        ring.scale.set(pulse, pulse, 1.0 + boostFactor * 0.45);
        ring.position.z =
          (0.24 + rIdx * 0.34) * asm.baseScale * lengthBoost;
      });

      // Stream turbulent incandescent embers & sparks out the exhaust vector
      const emberSpeedMult = 1.0 + boostFactor * 1.85;
      const maxStreamLength = (1.65 + boostFactor * 1.6) * asm.baseScale;
      for (let e = 0; e < asm.emberStreaks.length; e++) {
        const node = asm.emberStreaks[e];
        const cycle =
          (elapsed * node.speed * emberSpeedMult + node.seed) % 1.0;
        const zPos = 0.06 * asm.baseScale + cycle * maxStreamLength;
        const spreadFactor = 0.35 + cycle * (1.1 + boostFactor * 0.9);
        const swirlAngle =
          node.radialAngle + elapsed * (4.5 + boostFactor * 5.0) + cycle * 2.4;
        const rDist = node.radialDist * spreadFactor;

        node.mesh.position.set(
          Math.cos(swirlAngle) * rDist,
          Math.sin(swirlAngle) * rDist,
          zPos,
        );
        const fade = Math.sin(cycle * Math.PI);
        const streakStretch = (0.7 + boostFactor * 1.6) * fade;
        node.mesh.scale.set(
          fade * (0.85 + boostFactor * 0.4),
          fade * (0.85 + boostFactor * 0.4),
          Math.max(0.2, streakStretch),
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

    // 5. Animate & fade fiery muzzle flash starbursts
    if (muzzleFlashTimer > 0) {
      muzzleFlashTimer = Math.max(0, muzzleFlashTimer - dt);
      const ratio = muzzleFlashTimer / 0.08;
      muzzleFlashCoreMat.opacity = Math.min(1, ratio * 1.2);
      muzzleFlashFireMat.opacity = Math.min(0.9, ratio);
      muzzleFlashGroups.forEach((mf) => {
        mf.scale.multiplyScalar(1 + dt * 6);
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
    triggerWeaponFire,
    updateShipEffects,
  };
}

/**
 * Creates a realistic supercavitating armor-piercing tracer round with thermal wake & cavitation ring
 */
export function createPlayerPrimaryBoltMesh(mats: MaterialBank): THREE.Group {
  const boltGroup = new THREE.Group();

  const innerCoreMat = new THREE.MeshBasicMaterial({
    color: 0xfffbeb,
    transparent: true,
    opacity: 0.98,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const tracerSheathMat = new THREE.MeshBasicMaterial({
    color: 0xff9500,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const cavitationWakeMat = new THREE.MeshBasicMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // White-hot tungsten penetrator core
  const coreGeo = new THREE.CapsuleGeometry(0.075, 1.3, 4, 8);
  coreGeo.rotateX(Math.PI / 2);
  const coreMesh = new THREE.Mesh(coreGeo, innerCoreMat);
  boltGroup.add(coreMesh);

  // Hot incendiary tracer flare sheath
  const sheathGeo = new THREE.ConeGeometry(0.18, 1.85, 10, 1, true);
  sheathGeo.rotateX(-Math.PI / 2);
  const sheathMesh = new THREE.Mesh(sheathGeo, tracerSheathMat);
  boltGroup.add(sheathMesh);

  // Supercavitating vapor cone wake
  const wakeGeo = new THREE.ConeGeometry(0.16, 1.25, 8);
  wakeGeo.rotateX(Math.PI / 2);
  wakeGeo.translate(0, 0, 0.75);
  const wakeMesh = new THREE.Mesh(wakeGeo, cavitationWakeMat);
  boltGroup.add(wakeMesh);

  // Leading bow-shock cavitation ring
  const ringMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.02, 6, 14),
    mats.flashWhite,
  );
  ringMesh.position.set(0, 0, -0.38);
  boltGroup.add(ringMesh);

  return boltGroup;
}

/**
 * Creates a realistic 3D Naval Heavyweight Homing Torpedo with Bronze Warhead Band, Shrouded Pump-Jet Tail, and Rocket Exhaust
 */
export function createPlayerTorpedoMesh(mats: MaterialBank): THREE.Group {
  const torpGroup = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.15, 1.42, 14).rotateX(Math.PI / 2),
    mats.darkGraphiteTrim,
  );
  torpGroup.add(body);

  const warheadBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.145, 0.22, 14).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.82,
      roughness: 0.3,
    }),
  );
  warheadBand.position.set(0, 0, -0.52);
  torpGroup.add(warheadBand);

  const noseCone = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 12, 10),
    mats.titaniumHull,
  );
  noseCone.scale.set(1, 1, 1.45);
  noseCone.position.set(0, 0, -0.72);
  torpGroup.add(noseCone);

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
  torpGroup.add(fins, finsV, tailShroud);

  // Live burning rocket / supercavitating gas-generator exhaust cone at torpedo tail
  const fireMat = new THREE.MeshBasicMaterial({
    color: 0xff6b00,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xfffbeb,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

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
