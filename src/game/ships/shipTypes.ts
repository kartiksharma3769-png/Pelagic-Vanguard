import * as THREE from 'three';
import { MaterialBank } from '../models';
import { ShipClassId, ShipPropulsionVfxConfig } from '../types';

export interface ShipMaterialPalette {
  mats: MaterialBank;
  heatStainedNozzleMat: THREE.MeshStandardMaterial;
  machinedSteelMat: THREE.MeshStandardMaterial;
  navalBronzeMat: THREE.MeshStandardMaterial;
  anechoicRubberMat: THREE.MeshStandardMaterial;
  shipTrimMat: THREE.MeshStandardMaterial;
  whiteTitaniumMat: THREE.MeshPhysicalMaterial;
  gunmetalMat: THREE.MeshPhysicalMaterial;
  abyssalCeramicMat: THREE.MeshPhysicalMaterial;
  guardianTungstenMat: THREE.MeshPhysicalMaterial;
  goldGildedMat: THREE.MeshPhysicalMaterial;
  pearlWhiteMat: THREE.MeshPhysicalMaterial;
  deepNavyMat: THREE.MeshPhysicalMaterial;
  teakTealMat: THREE.MeshPhysicalMaterial;
  obsidianArmorMat: THREE.MeshPhysicalMaterial;
}

export interface EmberStreakNode {
  mesh: THREE.Mesh;
  seed: number;
  radialAngle: number;
  radialDist: number;
  speed: number;
}

export interface ThrusterShaderUniforms {
  [uniform: string]: THREE.IUniform<unknown>;
  uTime: { value: number };
  uThrottle: { value: number };
  uPhase: { value: number };
  uTurnSteer: { value: number };
  uDamageRatio: { value: number };
  uRollState: { value: number };
  uStyleMode: { value: number };
  uColorPrimary: { value: THREE.Color };
  uColorSecondary: { value: THREE.Color };
}

export interface ThrusterFlameAssembly {
  root: THREE.Group;
  nozzlePetalRing: THREE.Group;
  petalMeshes: THREE.Mesh[];
  flameHolderMesh: THREE.Mesh;
  exhaustDiscMesh: THREE.Mesh;
  innerCore: THREE.Mesh;
  midFlame: THREE.Mesh;
  outerPlume: THREE.Mesh;
  vortexSpiralMesh: THREE.Mesh;
  crossPlanes: THREE.Mesh[];
  shockRings: THREE.Mesh[];
  emberStreaks: EmberStreakNode[];
  emberMat: THREE.MeshBasicMaterial;
  shockRingMat: THREE.MeshBasicMaterial;
  exhaustDiscMat: THREE.MeshBasicMaterial;
  vortexSpiralMat: THREE.MeshBasicMaterial;
  coreShaderUniforms: ThrusterShaderUniforms;
  plumeShaderUniforms: ThrusterShaderUniforms;
  baseScale: number;
}

export interface ShipChassisBuild {
  id: ShipClassId;
  root: THREE.Group;
  wingSpanScale: number;
  thrusters: ThrusterFlameAssembly[];
  animate: (
    elapsed: number,
    dt: number,
    smoothThrottle: number,
    abilityActive: boolean,
  ) => void;
}

function getStyleModeIndex(style: ShipPropulsionVfxConfig['style']): number {
  switch (style) {
    case 'ion_cavitation':
      return 0;
    case 'crimson_coil':
      return 1;
    case 'stealth_wisp':
      return 2;
    case 'heavy_hydro':
    case 'thermal_lance':
      return 3;
    case 'predator_jet':
      return 4;
    case 'arc_ion':
      return 5;
    case 'phase_ribbon':
      return 6;
    case 'warden_jade':
    case 'kraken_vortex':
      return 7;
    case 'dreadnought_flare':
    case 'ascendant_halo':
      return 8;
    default:
      return 0;
  }
}

/**
 * Creates a custom GLSL Deep-Sea Ion-Cavitation & Helical Water-Vortex ShaderMaterial.
 * Replaces conventional orange aircraft flames with underwater cavitation shock rings,
 * bioluminescent plasma-water streams, electric arc striations, turning vector bend,
 * barrel-roll helical twist, and low-hull damage sputtering.
 */
export function createJetAfterburnerShaderMaterial(
  isInnerCore: boolean,
  phaseOffset: number,
  primaryHex = 0x38bdf8,
  secondaryHex = 0x06b6d4,
): {
  material: THREE.ShaderMaterial;
  uniforms: ThrusterShaderUniforms;
} {
  const uniforms: ThrusterShaderUniforms = {
    uTime: { value: 0 },
    uThrottle: { value: 1.0 },
    uPhase: { value: phaseOffset },
    uTurnSteer: { value: 0.0 },
    uDamageRatio: { value: 0.0 },
    uRollState: { value: 0.0 },
    uStyleMode: { value: 0.0 },
    uColorPrimary: { value: new THREE.Color(primaryHex) },
    uColorSecondary: { value: new THREE.Color(secondaryHex) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float uTime;
      uniform float uThrottle;
      uniform float uPhase;
      uniform float uTurnSteer;
      uniform float uDamageRatio;
      uniform float uRollState;
      uniform float uStyleMode;
      varying vec2 vUv;
      varying vec3 vViewNormal;
      varying vec3 vViewDir;

      void main() {
        vUv = uv;
        float flow = clamp(1.0 - uv.y, 0.0, 1.0);
        vec3 pos = position;

        float speed = 19.0 + uThrottle * 15.0;
        // Standing hydro-cavitation pressure nodes
        float pressureWave = sin(flow * 20.0 - uTime * 9.5 + uPhase) * 0.085 * (1.0 - flow * 0.55);
        // Helical water-vortex swirl (amplified on barrel roll or vortex ship styles)
        float vortexStrength = (0.11 + uRollState * 0.28 + (uStyleMode == 7.0 ? 0.12 : 0.0)) * pow(flow, 1.25);
        float swirlAngle = flow * (9.0 + uRollState * 12.0) - uTime * (speed * 0.85) + uPhase;
        float swirlX = cos(swirlAngle) * vortexStrength;
        float swirlY = sin(swirlAngle) * vortexStrength;

        // Directional wake bend when turning
        float steerBend = -uTurnSteer * pow(flow, 1.65) * 0.34;

        // Sputtering cavitation jitter when damaged
        float dmgJitter = uDamageRatio * sin(uTime * 43.0 + flow * 28.0 + uPhase) * 0.06 * flow;

        // Narrower profile for Vanguard/Talon, ribbon flatten for Rift Manta
        if (uStyleMode == 0.0 || uStyleMode == 4.0) {
          pos.xy *= 0.84;
        } else if (uStyleMode == 6.0) {
          pos.x *= 1.38;
          pos.y *= 0.55;
        }

        pos.xy *= (1.0 + pressureWave + dmgJitter);
        pos.x += swirlX * 0.25 + steerBend;
        pos.y += swirlY * 0.25;

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
      uniform float uTurnSteer;
      uniform float uDamageRatio;
      uniform float uRollState;
      uniform float uStyleMode;
      uniform vec3 uColorPrimary;
      uniform vec3 uColorSecondary;
      varying vec2 vUv;
      varying vec3 vViewNormal;
      varying vec3 vViewDir;

      float hydroNoise(vec2 p) {
        float n1 = sin(p.x * 6.28318 + sin(p.y * 5.4));
        float n2 = cos(p.y * 9.2 - cos(p.x * 12.566 + p.y * 3.8));
        float n3 = sin(p.x * 18.8495 - p.y * 15.6);
        return (n1 * 0.45 + n2 * 0.35 + n3 * 0.2) * 0.5 + 0.5;
      }

      void main() {
        float flow = clamp(1.0 - vUv.y, 0.0, 1.0);
        float streamSpeed = 16.0 + uThrottle * 14.0;

        vec2 noiseUv1 = vec2(vUv.x * 3.2 + uRollState * flow * 1.8, flow * 4.8 - uTime * streamSpeed * 0.18 + uPhase);
        vec2 noiseUv2 = vec2(vUv.x * 6.4 - 0.35, flow * 9.6 - uTime * streamSpeed * 0.32 - uPhase);
        float turb = hydroNoise(noiseUv1) * 0.6 + hydroNoise(noiseUv2) * 0.4;

        float tipCutoff = 0.74 + turb * 0.26;
        float tailMask = 1.0 - smoothstep(tipCutoff - 0.34, tipCutoff, flow);
        float nozzleEntryMask = smoothstep(0.0, 0.06, flow);

        // Standing underwater cavitation shock rings
        float ringFreq = (uStyleMode == 3.0 || uStyleMode == 8.0) ? 24.0 : 18.84955;
        float diamondWave = max(0.0, sin(flow * ringFreq - uTime * 6.0 + uPhase * 0.5));
        float cavitationNode = pow(diamondWave, ${isInnerCore ? '3.0' : '4.6'}) * exp(-flow * 1.45) * (0.68 + 0.48 * uThrottle);

        // Electric arc filaments (strongest on Tempest Corsair uStyleMode == 5.0 or during barrel roll)
        float arcPattern = abs(sin(vUv.x * 25.1327 + sin(flow * 22.0 - uTime * 28.0) * 2.4));
        float electricArc = smoothstep(0.92, 0.995, arcPattern) * (uStyleMode == 5.0 ? 1.35 : (0.35 + uRollState * 0.75));

        float ndotv = abs(dot(normalize(vViewNormal), normalize(vViewDir)));
        float edgeSoft = pow(clamp(ndotv, 0.0, 1.0), ${isInnerCore ? '0.62' : '1.12'});

        // Pure deep-sea bioluminescent & ionized water-plasma colors (NO orange aircraft fire)
        vec3 colBioCore = mix(vec3(0.92, 0.99, 1.0), uColorPrimary, 0.18);
        vec3 colDeepWake = uColorSecondary * 0.72 + uColorPrimary * 0.22;

        vec3 streamCol = mix(uColorPrimary, uColorSecondary, smoothstep(0.1, 0.56, flow));
        streamCol = mix(streamCol, colDeepWake, smoothstep(0.6, 0.96, flow));

        float coreIntensity = (${isInnerCore ? '0.84' : '0.36'}) * (1.0 - flow * 0.52) + cavitationNode * 1.18;
        streamCol = mix(streamCol, colBioCore, clamp(coreIntensity, 0.0, 1.0));

        // Bioluminescent bubble-stream striations & electric arcs
        float bioStriations = smoothstep(0.72, 0.95, turb) * smoothstep(0.08, 0.88, flow);
        streamCol += mix(uColorPrimary, uColorSecondary, 0.45) * bioStriations * (0.55 + 0.45 * uThrottle);
        streamCol += vec3(0.82, 0.96, 1.0) * electricArc * (1.0 - flow * 0.5);

        // Damage sputter flicker when hull is low
        float damageSputter = 1.0 - uDamageRatio * (0.42 * step(0.68, fract(sin(uTime * 37.0 + uPhase) * 43758.5453)));

        // Nautilus-Spectre VII stealth mode uses low-visibility whisper wake
        float stealthScale = (uStyleMode == 2.0) ? (0.38 + 0.25 * max(0.0, uThrottle - 0.8)) : 1.0;

        float brightness = ((${isInnerCore ? '1.48' : '1.18'}) + (uThrottle - 1.0) * 0.58) * damageSputter;
        float alpha = nozzleEntryMask * tailMask * (0.36 + 0.64 * turb) * (0.3 + 0.7 * edgeSoft) * stealthScale * damageSputter;
        alpha *= clamp(${isInnerCore ? '0.94' : '0.8'} * (0.76 + 0.24 * uThrottle), 0.0, 0.96);

        if (alpha <= 0.01) discard;
        gl_FragColor = vec4(streamCol * brightness, alpha);
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
 * Builds a deep-ocean Magnetohydrodynamic (MHD) Variable-Geometry Cavitation Nozzle
 * paired with a GLSL Ion-Cavitation Plume, Rotating Helical Vortex Ring, Pressure-Wave Nodes,
 * and Bioluminescent Cavitation Micro-Bubbles.
 */
export function createRealisticThrusterAssembly(
  nozzleMetalMat: THREE.Material,
  actuatorSteelMat: THREE.Material,
  scale = 1.0,
  primaryHex = 0x38bdf8,
  secondaryHex = 0x06b6d4,
  emberHex = 0x7dd3fc,
): ThrusterFlameAssembly {
  const root = new THREE.Group();
  const phaseOffset = Math.random() * 6.28;

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

  const nozzlePetalRing = new THREE.Group();
  nozzlePetalRing.position.set(0, 0, -0.08 * scale);
  root.add(nozzlePetalRing);

  const petalMeshes: THREE.Mesh[] = [];
  const petalCount = 12;
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2;
    const petalPivot = new THREE.Group();
    petalPivot.rotation.z = angle;

    const petalGeo = new THREE.BoxGeometry(
      0.11 * scale,
      0.026 * scale,
      0.34 * scale,
    );
    const petal = new THREE.Mesh(petalGeo, nozzleMetalMat);
    petal.position.set(0, 0.235 * scale, 0.04 * scale);
    petal.rotation.x = 0.16;
    petalPivot.add(petal);
    petalMeshes.push(petal);

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

  const flameHolderMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: primaryHex,
    emissiveIntensity: 0.85,
    metalness: 0.82,
    roughness: 0.3,
  });
  const flameHolderMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.15 * scale, 0.022 * scale, 8, 18),
    flameHolderMat,
  );
  flameHolderMesh.position.set(0, 0, -0.04 * scale);
  root.add(flameHolderMesh);

  for (let s = 0; s < 3; s++) {
    const vane = new THREE.Mesh(
      new THREE.BoxGeometry(0.32 * scale, 0.018 * scale, 0.04 * scale),
      flameHolderMat,
    );
    vane.rotation.z = (s / 3) * Math.PI;
    vane.position.set(0, 0, -0.05 * scale);
    root.add(vane);
  }

  const exhaustDiscMat = new THREE.MeshBasicMaterial({
    color: primaryHex,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const exhaustDiscMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.195 * scale, 18),
    exhaustDiscMat,
  );
  exhaustDiscMesh.position.set(0, 0, 0.01 * scale);
  root.add(exhaustDiscMesh);

  const coreShader = createJetAfterburnerShaderMaterial(
    true,
    phaseOffset,
    primaryHex,
    secondaryHex,
  );
  const plumeShader = createJetAfterburnerShaderMaterial(
    false,
    phaseOffset + 1.57,
    primaryHex,
    secondaryHex,
  );

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

  // Rotating water-vortex induction torus around the cavitation throat
  const vortexSpiralMat = new THREE.MeshBasicMaterial({
    color: emberHex,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    wireframe: true,
  });
  const vortexGeo = new THREE.TorusGeometry(0.22 * scale, 0.025 * scale, 6, 16);
  const vortexSpiralMesh = new THREE.Mesh(vortexGeo, vortexSpiralMat);
  vortexSpiralMesh.position.set(0, 0, 0.28 * scale);
  vortexSpiralMesh.renderOrder = 7;
  root.add(vortexSpiralMesh);

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

  const shockRingMat = new THREE.MeshBasicMaterial({
    color: emberHex,
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shockRings: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const r = (0.15 - i * 0.026) * scale;
    const ringGeo = new THREE.TorusGeometry(r, 0.014 * scale, 6, 16);
    const ring = new THREE.Mesh(ringGeo, shockRingMat);
    ring.position.set(0, 0, (0.24 + i * 0.34) * scale);
    ring.renderOrder = 7;
    root.add(ring);
    shockRings.push(ring);
  }

  // Pooled Cavitation Micro-Bubble & Bioluminescent Ion Particles
  const emberMat = new THREE.MeshBasicMaterial({
    color: emberHex,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const bubbleSphereGeo = new THREE.IcosahedronGeometry(0.022 * scale, 1);

  const emberStreaks: EmberStreakNode[] = [];
  for (let e = 0; e < 10; e++) {
    const emberMesh = new THREE.Mesh(bubbleSphereGeo, emberMat);
    emberMesh.renderOrder = 8;
    root.add(emberMesh);
    emberStreaks.push({
      mesh: emberMesh,
      seed: e * 0.137 + (phaseOffset % 1),
      radialAngle: (e / 10) * Math.PI * 2 + e * 0.7,
      radialDist: (0.04 + (e % 4) * 0.048) * scale,
      speed: 2.1 + (e % 3) * 0.65,
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
    vortexSpiralMesh,
    crossPlanes,
    shockRings,
    emberStreaks,
    emberMat,
    shockRingMat,
    exhaustDiscMat,
    vortexSpiralMat,
    coreShaderUniforms: coreShader.uniforms,
    plumeShaderUniforms: plumeShader.uniforms,
    baseScale: scale,
  };
}

export function applyPropulsionConfigToThrusters(
  thrusters: ThrusterFlameAssembly[],
  cfg: ShipPropulsionVfxConfig,
  trimHex?: number,
) {
  const primary = cfg.primaryColorHex;
  const secondary = cfg.secondaryColorHex;
  const ember = cfg.emberColorHex;
  const useTrim = trimHex !== undefined && cfg.style === 'ion_cavitation';
  const finalPrimary = useTrim ? trimHex : primary;
  const styleMode = getStyleModeIndex(cfg.style);

  thrusters.forEach((asm) => {
    asm.coreShaderUniforms.uColorPrimary.value.setHex(finalPrimary);
    asm.coreShaderUniforms.uColorSecondary.value.setHex(secondary);
    asm.coreShaderUniforms.uStyleMode.value = styleMode;
    asm.plumeShaderUniforms.uColorPrimary.value.setHex(finalPrimary);
    asm.plumeShaderUniforms.uColorSecondary.value.setHex(secondary);
    asm.plumeShaderUniforms.uStyleMode.value = styleMode;
    asm.emberMat.color.setHex(ember);
    asm.emberMat.opacity = Math.min(1, 0.38 + cfg.bubbleDensity * 0.36);
    asm.shockRingMat.color.setHex(ember);
    asm.vortexSpiralMat.color.setHex(secondary);
    asm.exhaustDiscMat.color.setHex(finalPrimary);
    const fhMat = asm.flameHolderMesh.material as THREE.MeshStandardMaterial;
    fhMat.emissive.setHex(finalPrimary);
  });
}

/**
 * Helper to build a realistic naval hydro-fighter cockpit interior
 */
export function createCockpitInterior(
  darkMetalMat: THREE.Material,
  seatMat: THREE.Material,
  avionicsMat: THREE.Material,
): THREE.Group {
  const interior = new THREE.Group();

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
 * Helper to create an emissive accent material tailored to each vessel's signature bioluminescence
 */
export function createAccentEmissiveMat(
  colorHex: number,
  intensity = 1.65,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: intensity,
    roughness: 0.22,
    metalness: 0.3,
  });
}

/**
 * Custom GLSL shader material for counter-rotating circular energy halos (used on Pelagic Ascendant & Trench Warden)
 */
export function createEnergyHaloShaderMat(
  colorHex: number,
  opacity = 0.72,
): {
  material: THREE.ShaderMaterial;
  uTime: { value: number };
  uBoost: { value: number };
} {
  const uTime = { value: 0 };
  const uBoost = { value: 0 };
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime,
      uBoost,
      uColor: { value: new THREE.Color(colorHex) },
      uOpacity: { value: opacity },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uBoost;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float pulse = 0.65 + 0.35 * sin(vUv.x * 24.0 - uTime * 5.2);
        float chev = smoothstep(0.35, 0.92, sin(vUv.x * 48.0 + uTime * 8.0) * 0.5 + 0.5);
        float alpha = uOpacity * (0.45 + 0.55 * chev) * (1.0 + uBoost * 0.45);
        vec3 col = mix(uColor, vec3(1.0, 0.98, 0.9), chev * 0.45) * (1.2 + uBoost * 0.6) * pulse;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.95));
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  return { material, uTime, uBoost };
}
