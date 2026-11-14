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

export function createMaterialBank(isSoftwareGl: boolean): MaterialBank {
  return {
    titaniumHull: new THREE.MeshPhysicalMaterial({
      color: 0xd8e4f2,
      metalness: 0.88,
      roughness: 0.22,
      clearcoat: 0.6,
      clearcoatRoughness: 0.18,
      anisotropy: isSoftwareGl ? 0 : 0.7,
    }),
    darkGraphiteTrim: new THREE.MeshStandardMaterial({
      color: 0x1a283b,
      metalness: 0.62,
      roughness: 0.52,
    }),
    sapphireCanopy: new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      metalness: 0.05,
      roughness: 0.08,
      transmission: isSoftwareGl ? 0 : 0.88,
      transparent: true,
      opacity: isSoftwareGl ? 0.48 : 1.0,
      ior: 1.65,
      thickness: 1.2,
      clearcoat: 1.0,
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

interface ThrusterFlameAssembly {
  root: THREE.Group;
  innerCore: THREE.Mesh;
  midFlame: THREE.Mesh;
  outerPlume: THREE.Mesh;
  shockRings: THREE.Mesh[];
  baseScale: number;
}

/**
 * Builds a realistic 3-layer plasma/fire afterburner plume assembly:
 * 1. White-hot inner plasma core cone
 * 2. Turbulent thermal orange-red mid fire sheath
 * 3. Outer biolume/plasma corona cone + 3 animated Mach shock-diamond rings
 */
function createRealisticThrusterAssembly(
  coreMat: THREE.Material,
  fireMidMat: THREE.Material,
  outerTrimMat: THREE.Material,
  scale = 1.0,
): ThrusterFlameAssembly {
  const root = new THREE.Group();

  // Nozzle exhaust interior glow disc
  const exhaustDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.22 * scale, 16),
    coreMat,
  );
  exhaustDisc.position.set(0, 0, 0.02);
  root.add(exhaustDisc);

  // Layer 1: Blinding white-yellow inner core flame
  const innerGeo = new THREE.ConeGeometry(0.14 * scale, 0.95 * scale, 14);
  innerGeo.rotateX(Math.PI / 2);
  innerGeo.translate(0, 0, 0.46 * scale);
  const innerCore = new THREE.Mesh(innerGeo, coreMat);
  innerCore.renderOrder = 6;
  root.add(innerCore);

  // Layer 2: Superheated thermal orange/crimson mid flame sheath
  const midGeo = new THREE.ConeGeometry(0.24 * scale, 1.45 * scale, 16, 4, true);
  midGeo.rotateX(Math.PI / 2);
  midGeo.translate(0, 0, 0.7 * scale);
  const midFlame = new THREE.Mesh(midGeo, fireMidMat);
  midFlame.renderOrder = 5;
  root.add(midFlame);

  // Layer 3: Outer plasma/trim corona sheath
  const outerGeo = new THREE.ConeGeometry(0.32 * scale, 1.95 * scale, 16, 4, true);
  outerGeo.rotateX(Math.PI / 2);
  outerGeo.translate(0, 0, 0.95 * scale);
  const outerPlume = new THREE.Mesh(outerGeo, outerTrimMat);
  outerPlume.renderOrder = 4;
  root.add(outerPlume);

  // Mach shock-diamond rings along the fire jet
  const shockRings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const r = (0.19 - i * 0.04) * scale;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.022 * scale, 8, 18),
      coreMat,
    );
    ring.position.set(0, 0, (0.32 + i * 0.36) * scale);
    ring.renderOrder = 7;
    root.add(ring);
    shockRings.push(ring);
  }

  return {
    root,
    innerCore,
    midFlame,
    outerPlume,
    shockRings,
    baseScale: scale,
  };
}

/**
 * Builds all 4 distinct 3D Spacecraft/Sub-Fighter Chassis, 3 Primary Weapon Turret Rigs,
 * 3 Secondary Torpedo/Ordnance Racks, 8 Visible Instrument Modules, Level/Tier Armor Evolution,
 * and Realistic Multi-Layered Fire & Muzzle Flash VFX.
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

  // Dedicated dynamic materials for realistic fire, plasma, and class hulls
  const shipTrimMat = mats.biolumeCyan.clone();
  shipTrimMat.emissiveIntensity = 2.6;

  const vanguardHullMat = mats.titaniumHull.clone();
  vanguardHullMat.color.setHex(0xdbeafe); // Sleek aero-silver cyan-white

  const assaultHullMat = mats.titaniumHull.clone();
  assaultHullMat.color.setHex(0x3b1d2e); // Gunship crimson-obsidian metallic
  assaultHullMat.metalness = 0.85;
  assaultHullMat.roughness = 0.26;

  const guardianHullMat = mats.titaniumHull.clone();
  guardianHullMat.color.setHex(0x47361d); // Heavy dreadnought bronze-titanium
  guardianHullMat.metalness = 0.92;
  guardianHullMat.roughness = 0.24;

  const tacticalHullMat = mats.titaniumHull.clone();
  tacticalHullMat.color.setHex(0x0f292a); // Spec-ops stealth carbon-emerald
  tacticalHullMat.metalness = 0.78;
  tacticalHullMat.roughness = 0.18;

  const goldUpgradeMat = new THREE.MeshPhysicalMaterial({
    color: 0xfbbf24,
    emissive: 0xd97706,
    emissiveIntensity: 0.45,
    metalness: 0.95,
    roughness: 0.16,
    clearcoat: 0.8,
  });

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
    color: 0x06b6d4,
    transparent: true,
    opacity: 0.55,
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
  // 1. FOUR COMPLETELY DISTINCT 3D SPACESHIP / HYDRO-FIGHTER CHASSIS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // CHASSIS A: VANGUARD-IX INTERCEPTOR (Needle-Nose Forward-Swept Strike Fighter)
  // ----------------------------------------------------------------------------
  const interceptorChassis = new THREE.Group();
  {
    const lathePoints = [
      new THREE.Vector2(0.01, -2.75),
      new THREE.Vector2(0.24, -2.05),
      new THREE.Vector2(0.58, -0.85),
      new THREE.Vector2(0.68, 0.35),
      new THREE.Vector2(0.52, 1.45),
      new THREE.Vector2(0.26, 2.05),
      new THREE.Vector2(0.02, 2.25),
    ];
    const fuselageGeo = new THREE.LatheGeometry(lathePoints, 24);
    fuselageGeo.rotateX(Math.PI / 2);
    fuselageGeo.scale(1.12, 0.68, 1.0);
    const fuselage = new THREE.Mesh(fuselageGeo, vanguardHullMat);
    fuselage.castShadow = true;
    fuselage.receiveShadow = true;
    interceptorChassis.add(fuselage);

    // Forward-swept gull strike wings
    const fWingShape = new THREE.Shape();
    fWingShape.moveTo(0.45, -0.35);
    fWingShape.lineTo(1.55, 0.35);
    fWingShape.lineTo(2.95, -0.45);
    fWingShape.lineTo(3.08, 0.18);
    fWingShape.lineTo(1.75, 1.25);
    fWingShape.lineTo(0.5, 1.35);
    fWingShape.closePath();

    const fWingGeo = new THREE.ExtrudeGeometry(fWingShape, {
      steps: 1,
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.035,
      bevelSegments: 2,
    });
    fWingGeo.rotateX(Math.PI / 2);

    const rWing = new THREE.Mesh(fWingGeo, vanguardHullMat);
    rWing.position.set(0, 0.05, 0);
    interceptorChassis.add(rWing);

    const lWing = new THREE.Mesh(fWingGeo, vanguardHullMat);
    lWing.scale.set(-1, 1, 1);
    lWing.position.set(0, 0.05, 0);
    interceptorChassis.add(lWing);

    // Forward canard blades + twin canted V-tails
    const canardGeo = new THREE.BoxGeometry(1.05, 0.06, 0.48);
    const rCanard = new THREE.Mesh(canardGeo, mats.darkGraphiteTrim);
    rCanard.position.set(0.72, 0.02, -1.35);
    rCanard.rotation.y = 0.28;
    const lCanard = new THREE.Mesh(canardGeo, mats.darkGraphiteTrim);
    lCanard.position.set(-0.72, 0.02, -1.35);
    lCanard.rotation.y = -0.28;
    interceptorChassis.add(rCanard, lCanard);

    const vTailGeo = new THREE.BoxGeometry(0.08, 0.92, 0.95);
    const rTail = new THREE.Mesh(vTailGeo, mats.darkGraphiteTrim);
    rTail.position.set(0.68, 0.48, 1.35);
    rTail.rotation.z = -0.35;
    const lTail = new THREE.Mesh(vTailGeo, mats.darkGraphiteTrim);
    lTail.position.set(-0.68, 0.48, 1.35);
    lTail.rotation.z = 0.35;
    interceptorChassis.add(rTail, lTail);

    // Teardrop fighter cockpit canopy + glowing HUD projector
    const canopyGeo = new THREE.SphereGeometry(
      0.5,
      20,
      14,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.55,
    );
    canopyGeo.scale(0.84, 0.72, 1.95);
    const canopy = new THREE.Mesh(canopyGeo, mats.sapphireCanopy);
    canopy.position.set(0, 0.28, -0.42);
    canopy.renderOrder = 4;
    interceptorChassis.add(canopy);

    const hudBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.1, 0.2),
      shipTrimMat,
    );
    hudBar.position.set(0, 0.42, -0.82);
    interceptorChassis.add(hudBar);

    // Twin sleek vector engine nacelles
    const nacGeo = new THREE.CylinderGeometry(0.26, 0.33, 1.9, 16);
    nacGeo.rotateX(Math.PI / 2);
    const lNac = new THREE.Mesh(nacGeo, mats.darkGraphiteTrim);
    lNac.position.set(-0.92, -0.05, 0.85);
    const rNac = new THREE.Mesh(nacGeo, mats.darkGraphiteTrim);
    rNac.position.set(0.92, -0.05, 0.85);
    interceptorChassis.add(lNac, rNac);

    // Twin realistic multi-layer afterburners
    const flL = createRealisticThrusterAssembly(
      fireWhiteCoreMat,
      fireThermalMidMat,
      fireOuterPlasmaMat,
      0.95,
    );
    flL.root.position.set(-0.92, -0.05, 1.8);
    const flR = createRealisticThrusterAssembly(
      fireWhiteCoreMat,
      fireThermalMidMat,
      fireOuterPlasmaMat,
      0.95,
    );
    flR.root.position.set(0.92, -0.05, 1.8);
    interceptorChassis.add(flL.root, flR.root);
    thrusterAssemblies.push(flL, flR);
  }
  group.add(interceptorChassis);

  // ----------------------------------------------------------------------------
  // CHASSIS B: MAELSTROM-XII ASSAULT GUNSHIP (Twin-Boom Catamaran Siege Fighter)
  // ----------------------------------------------------------------------------
  const assaultChassis = new THREE.Group();
  {
    // Central heavy reactor core spine
    const coreSpine = new THREE.Mesh(
      new THREE.BoxGeometry(0.88, 0.58, 3.6),
      assaultHullMat,
    );
    coreSpine.position.set(0, 0.08, -0.1);
    assaultChassis.add(coreSpine);

    // Glowing spinal plasma trench
    const spinalTrench = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.18, 2.85),
      shipTrimMat,
    );
    spinalTrench.position.set(0, 0.36, -0.25);
    assaultChassis.add(spinalTrench);

    // Twin forward heavy catamaran siege booms (left & right mandibles)
    const boomGeo = new THREE.BoxGeometry(0.62, 0.48, 4.1);
    const lBoom = new THREE.Mesh(boomGeo, assaultHullMat);
    lBoom.position.set(-0.95, -0.02, -0.35);
    const rBoom = new THREE.Mesh(boomGeo, assaultHullMat);
    rBoom.position.set(0.95, -0.02, -0.35);
    assaultChassis.add(lBoom, rBoom);

    // Sloped chisel nose cones on each boom
    const noseConeGeo = new THREE.ConeGeometry(0.42, 1.15, 6);
    noseConeGeo.rotateX(-Math.PI / 2);
    const lNose = new THREE.Mesh(noseConeGeo, mats.darkGraphiteTrim);
    lNose.position.set(-0.95, -0.02, -2.92);
    const rNose = new THREE.Mesh(noseConeGeo, mats.darkGraphiteTrim);
    rNose.position.set(0.95, -0.02, -2.92);
    assaultChassis.add(lNose, rNose);

    // Heavy anhedral gull-wings with armor ribs
    const aWingShape = new THREE.Shape();
    aWingShape.moveTo(1.1, -0.95);
    aWingShape.lineTo(3.25, 0.15);
    aWingShape.lineTo(3.15, 1.25);
    aWingShape.lineTo(1.1, 1.45);
    aWingShape.closePath();
    const aWingGeo = new THREE.ExtrudeGeometry(aWingShape, {
      steps: 1,
      depth: 0.18,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 2,
    });
    aWingGeo.rotateX(Math.PI / 2);

    const rAWing = new THREE.Mesh(aWingGeo, assaultHullMat);
    rAWing.position.set(0, 0.12, 0);
    rAWing.rotation.z = -0.08;
    const lAWing = new THREE.Mesh(aWingGeo, assaultHullMat);
    lAWing.scale.set(-1, 1, 1);
    lAWing.position.set(0, 0.12, 0);
    lAWing.rotation.z = 0.08;
    assaultChassis.add(rAWing, lAWing);

    // Stepped armored gunship tandem canopy
    const gunshipCanopy = new THREE.Mesh(
      new THREE.BoxGeometry(0.74, 0.42, 1.65),
      mats.sapphireCanopy,
    );
    gunshipCanopy.position.set(0, 0.48, -0.55);
    gunshipCanopy.renderOrder = 4;
    assaultChassis.add(gunshipCanopy);

    // Canopy armor roll-cage frame
    const cageBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 0.08, 1.7),
      mats.darkGraphiteTrim,
    );
    cageBar.position.set(0, 0.68, -0.55);
    assaultChassis.add(cageBar);

    // Twin tall vertical stabilizer fins on booms
    const stabGeo = new THREE.BoxGeometry(0.12, 1.15, 1.25);
    const lStab = new THREE.Mesh(stabGeo, mats.darkGraphiteTrim);
    lStab.position.set(-0.95, 0.65, 1.15);
    const rStab = new THREE.Mesh(stabGeo, mats.darkGraphiteTrim);
    rStab.position.set(0.95, 0.65, 1.15);
    assaultChassis.add(lStab, rStab);

    // QUAD Heavy Afterburner Thrusters (2 inner, 2 outer)
    const quadCoords = [
      [-1.18, 0.08, 1.75],
      [-0.68, -0.12, 1.82],
      [0.68, -0.12, 1.82],
      [1.18, 0.08, 1.75],
    ];
    quadCoords.forEach(([x, y, z]) => {
      const nozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.3, 0.7, 14).rotateX(Math.PI / 2),
        mats.darkGraphiteTrim,
      );
      nozzle.position.set(x, y, z - 0.25);
      assaultChassis.add(nozzle);

      const fl = createRealisticThrusterAssembly(
        fireWhiteCoreMat,
        fireThermalMidMat,
        fireOuterPlasmaMat,
        0.82,
      );
      fl.root.position.set(x, y, z);
      assaultChassis.add(fl.root);
      thrusterAssemblies.push(fl);
    });
  }
  assaultChassis.visible = false;
  group.add(assaultChassis);

  // ----------------------------------------------------------------------------
  // CHASSIS C: BATHYS-BASTION IV GUARDIAN (Armored Diamond Dreadnought Fortress)
  // ----------------------------------------------------------------------------
  const guardianChassis = new THREE.Group();
  {
    // Wide armored diamond citadel hull
    const hullShape = new THREE.Shape();
    hullShape.moveTo(0, -2.55);
    hullShape.lineTo(1.75, -0.85);
    hullShape.lineTo(2.15, 0.95);
    hullShape.lineTo(1.25, 2.05);
    hullShape.lineTo(-1.25, 2.05);
    hullShape.lineTo(-2.15, 0.95);
    hullShape.lineTo(-1.75, -0.85);
    hullShape.closePath();

    const dreadGeo = new THREE.ExtrudeGeometry(hullShape, {
      steps: 1,
      depth: 0.52,
      bevelEnabled: true,
      bevelThickness: 0.16,
      bevelSize: 0.16,
      bevelSegments: 3,
    });
    dreadGeo.rotateX(Math.PI / 2);
    const dreadHull = new THREE.Mesh(dreadGeo, guardianHullMat);
    dreadHull.position.set(0, 0.22, 0);
    guardianChassis.add(dreadHull);

    // Massive lateral sloped bulwark shield outriggers
    const bulwarkGeo = new THREE.BoxGeometry(0.95, 0.62, 2.85);
    const lBulwark = new THREE.Mesh(bulwarkGeo, mats.darkGraphiteTrim);
    lBulwark.position.set(-2.35, -0.04, 0.15);
    lBulwark.rotation.z = 0.22;
    const rBulwark = new THREE.Mesh(bulwarkGeo, mats.darkGraphiteTrim);
    rBulwark.position.set(2.35, -0.04, 0.15);
    rBulwark.rotation.z = -0.22;
    guardianChassis.add(lBulwark, rBulwark);

    // Glowing lateral energy barrier strips on bulwarks
    const stripGeo = new THREE.BoxGeometry(0.14, 0.28, 2.45);
    const lStrip = new THREE.Mesh(stripGeo, shipTrimMat);
    lStrip.position.set(-2.82, -0.02, 0.15);
    const rStrip = new THREE.Mesh(stripGeo, shipTrimMat);
    rStrip.position.set(2.82, -0.02, 0.15);
    guardianChassis.add(lStrip, rStrip);

    // Armored central command citadel dome + overhead shield halo
    const domeGeo = new THREE.SphereGeometry(
      0.72,
      20,
      14,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.5,
    );
    domeGeo.scale(1.1, 0.65, 1.35);
    const citadelDome = new THREE.Mesh(domeGeo, mats.sapphireCanopy);
    citadelDome.position.set(0, 0.36, -0.15);
    citadelDome.renderOrder = 4;
    guardianChassis.add(citadelDome);

    const guardianHalo = new THREE.Mesh(
      new THREE.TorusGeometry(1.32, 0.06, 10, 28),
      shipTrimMat,
    );
    guardianHalo.rotation.x = Math.PI / 2;
    guardianHalo.position.set(0, 0.42, 0.05);
    guardianChassis.add(guardianHalo);

    // Triple Heavy Wide-Aperture Thrusters (Center main + Twin flank thrusters)
    const triCoords = [
      [-1.15, -0.04, 2.1],
      [0, 0.02, 2.22],
      [1.15, -0.04, 2.1],
    ];
    triCoords.forEach(([x, y, z], idx) => {
      const s = idx === 1 ? 1.18 : 0.92;
      const fl = createRealisticThrusterAssembly(
        fireWhiteCoreMat,
        fireThermalMidMat,
        fireOuterPlasmaMat,
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
  // CHASSIS D: NAUTILUS-SPECTRE VII TACTICAL (Faceted Stealth Manta & AWACS Dish)
  // ----------------------------------------------------------------------------
  const tacticalChassis = new THREE.Group();
  let tacticalAwacsDish = new THREE.Group();
  {
    // Faceted stealth flying-wing manta body
    const stealthShape = new THREE.Shape();
    stealthShape.moveTo(0, -2.85);
    stealthShape.lineTo(0.85, -1.65);
    stealthShape.lineTo(3.35, 0.45);
    stealthShape.lineTo(2.65, 1.55);
    stealthShape.lineTo(1.25, 1.15);
    stealthShape.lineTo(0, 1.95);
    stealthShape.lineTo(-1.25, 1.15);
    stealthShape.lineTo(-2.65, 1.55);
    stealthShape.lineTo(-3.35, 0.45);
    stealthShape.lineTo(-0.85, -1.65);
    stealthShape.closePath();

    const stealthGeo = new THREE.ExtrudeGeometry(stealthShape, {
      steps: 1,
      depth: 0.24,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.08,
      bevelSegments: 2,
    });
    stealthGeo.rotateX(Math.PI / 2);
    const stealthBody = new THREE.Mesh(stealthGeo, tacticalHullMat);
    stealthBody.position.set(0, 0.1, 0);
    tacticalChassis.add(stealthBody);

    // Forward twin stealth sensor mandibles / prongs
    const prongGeo = new THREE.ConeGeometry(0.14, 1.45, 5);
    prongGeo.rotateX(-Math.PI / 2);
    const lProng = new THREE.Mesh(prongGeo, shipTrimMat);
    lProng.position.set(-0.62, 0.0, -2.45);
    const rProng = new THREE.Mesh(prongGeo, shipTrimMat);
    rProng.position.set(0.62, 0.0, -2.45);
    tacticalChassis.add(lProng, rProng);

    // Flush angular stealth cockpit visor
    const stealthCanopy = new THREE.Mesh(
      new THREE.ConeGeometry(0.58, 1.65, 4).rotateX(-Math.PI / 2),
      mats.sapphireCanopy,
    );
    stealthCanopy.scale.set(1.1, 0.48, 1.0);
    stealthCanopy.position.set(0, 0.26, -0.85);
    stealthCanopy.renderOrder = 4;
    tacticalChassis.add(stealthCanopy);

    // Rotating Dorsal AWACS / Acoustic Sonar Radome Assembly
    tacticalAwacsDish = new THREE.Group();
    tacticalAwacsDish.position.set(0, 0.68, 0.45);
    const pylon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.22, 0.42, 8),
      mats.darkGraphiteTrim,
    );
    pylon.position.set(0, -0.2, 0);
    const dish = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.75, 0.14, 24),
      mats.darkGraphiteTrim,
    );
    const dishRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.98, 0.045, 8, 28).rotateX(Math.PI / 2),
      shipTrimMat,
    );
    const dishCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 14, 14),
      shipTrimMat,
    );
    dishCore.position.set(0, 0.1, 0);
    tacticalAwacsDish.add(pylon, dish, dishRing, dishCore);
    tacticalChassis.add(tacticalAwacsDish);

    // Twin shrouded stealth vector thrusters
    const stealthCoords = [
      [-0.78, -0.02, 1.65],
      [0.78, -0.02, 1.65],
    ];
    stealthCoords.forEach(([x, y, z]) => {
      const fl = createRealisticThrusterAssembly(
        fireWhiteCoreMat,
        fireThermalMidMat,
        fireOuterPlasmaMat,
        0.9,
      );
      fl.root.position.set(x, y, z);
      tacticalChassis.add(fl.root);
      thrusterAssemblies.push(fl);
    });
  }
  tacticalChassis.visible = false;
  group.add(tacticalChassis);

  // ============================================================================
  // 2. VISIBLE 3D PRIMARY WEAPON TURRET RIGS (With Barrel Recoil & Muzzle Flash)
  // ============================================================================
  const primaryWeaponsRoot = new THREE.Group();
  group.add(primaryWeaponsRoot);

  // 2A. Cavitation Cannons (`cavitation_cannons`) - Twin Long-Barrel Rotary Autocannons
  const priCavitationGroup = new THREE.Group();
  [-1.92, 1.92].forEach((sideX) => {
    const mount = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.22, 0.65),
      mats.darkGraphiteTrim,
    );
    mount.position.set(sideX, -0.05, 0.35);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.1, 1.65, 12).rotateX(Math.PI / 2),
      mats.titaniumHull,
    );
    barrel.position.set(sideX, -0.05, -0.35);

    const shroud = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.115, 0.85, 10).rotateX(Math.PI / 2),
      mats.darkGraphiteTrim,
    );
    shroud.position.set(sideX, -0.05, -0.15);

    const muzzleTip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.08, 0.24, 12).rotateX(Math.PI / 2),
      shipTrimMat,
    );
    muzzleTip.position.set(sideX, -0.05, -1.2);

    priCavitationGroup.add(mount, barrel, shroud, muzzleTip);
  });
  primaryWeaponsRoot.add(priCavitationGroup);

  // 2B. Focused Bio-Lance (`focused_bio_lance`) - Twin Heavy Particle-Beam Rails + Coils
  const priBioLanceGroup = new THREE.Group();
  [-1.92, 1.92].forEach((sideX) => {
    const railUpper = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.08, 1.95),
      mats.titaniumHull,
    );
    railUpper.position.set(sideX, 0.04, -0.35);

    const railLower = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.08, 1.95),
      mats.titaniumHull,
    );
    railLower.position.set(sideX, -0.14, -0.35);

    const plasmaCoreRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1.85, 10).rotateX(Math.PI / 2),
      mats.biolumeEmerald,
    );
    plasmaCoreRod.position.set(sideX, -0.05, -0.35);

    for (let c = 0; c < 3; c++) {
      const coil = new THREE.Mesh(
        new THREE.TorusGeometry(0.14, 0.025, 8, 16),
        goldUpgradeMat,
      );
      coil.position.set(sideX, -0.05, -0.05 - c * 0.45);
      priBioLanceGroup.add(coil);
    }

    const prismCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.15, 0),
      mats.biolumeEmerald,
    );
    prismCrystal.position.set(sideX, -0.05, -1.35);

    priBioLanceGroup.add(railUpper, railLower, plasmaCoreRod, prismCrystal);
  });
  priBioLanceGroup.visible = false;
  primaryWeaponsRoot.add(priBioLanceGroup);

  // 2C. Burst-Pulse Quad Repeater (`burst_pulse_repeater`) - Rotary Gatling Cluster
  const priBurstRepeaterGroup = new THREE.Group();
  [-1.92, 1.92].forEach((sideX) => {
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.65, 14).rotateX(Math.PI / 2),
      mats.darkGraphiteTrim,
    );
    drum.position.set(sideX, -0.05, 0.15);

    const drumGlow = new THREE.Mesh(
      new THREE.TorusGeometry(0.23, 0.03, 8, 18),
      mats.biolumeAmber,
    );
    drumGlow.position.set(sideX, -0.05, 0.15);
    priBurstRepeaterGroup.add(drum, drumGlow);

    const subOffsets = [
      [-0.08, 0.08],
      [0.08, 0.08],
      [-0.08, -0.08],
      [0.08, -0.08],
    ];
    subOffsets.forEach(([ox, oy]) => {
      const miniBarrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.038, 0.038, 1.45, 8).rotateX(Math.PI / 2),
        mats.titaniumHull,
      );
      miniBarrel.position.set(sideX + ox, -0.05 + oy, -0.5);
      priBurstRepeaterGroup.add(miniBarrel);
    });

    const clampRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.12, 12).rotateX(Math.PI / 2),
      mats.biolumeAmber,
    );
    clampRing.position.set(sideX, -0.05, -1.12);
    priBurstRepeaterGroup.add(clampRing);
  });
  priBurstRepeaterGroup.visible = false;
  primaryWeaponsRoot.add(priBurstRepeaterGroup);

  // 2D. Realistic 3D Muzzle Flash Starbursts + Shockwave Rings at Left & Right Barrels
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
  // 3. VISIBLE 3D SECONDARY ORDNANCE PODS (Mounted Under-Wing / Sponsons)
  // ============================================================================
  const secondaryOrdnanceRoot = new THREE.Group();
  group.add(secondaryOrdnanceRoot);

  // 3A. Sonic Homing Torpedoes (`sonic_torpedoes`) - Twin 3-Tube Missile Pods
  const secSonicPodsGroup = new THREE.Group();
  [-1.32, 1.32].forEach((sideX) => {
    const podBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 1.15, 12).rotateX(Math.PI / 2),
      mats.darkGraphiteTrim,
    );
    podBody.position.set(sideX, -0.28, 0.15);
    secSonicPodsGroup.add(podBody);

    // 3 visible glowing torpedo nosecones inside each pod
    [
      [-0.08, 0.06],
      [0.08, 0.06],
      [0, -0.08],
    ].forEach(([ox, oy]) => {
      const warhead = new THREE.Mesh(
        new THREE.ConeGeometry(0.065, 0.24, 10).rotateX(-Math.PI / 2),
        mats.biolumeCyan,
      );
      warhead.position.set(sideX + ox, -0.28 + oy, -0.48);
      secSonicPodsGroup.add(warhead);
    });
  });
  secondaryOrdnanceRoot.add(secSonicPodsGroup);

  // 3B. Heavy Breach Torpedo (`heavy_breach_torpedo`) - Oversized Bunker-Buster Missiles
  const secHeavyBreachGroup = new THREE.Group();
  [-1.35, 1.35].forEach((sideX) => {
    const missileBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 1.55, 14).rotateX(Math.PI / 2),
      mats.titaniumHull,
    );
    missileBody.position.set(sideX, -0.32, 0.05);

    const warheadCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.19, 0.48, 14).rotateX(-Math.PI / 2),
      mats.biolumeAmber,
    );
    warheadCone.position.set(sideX, -0.32, -0.92);

    const tailFins = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.48, 0.25),
      mats.darkGraphiteTrim,
    );
    tailFins.position.set(sideX, -0.32, 0.65);

    secHeavyBreachGroup.add(missileBody, warheadCone, tailFins);
  });
  secHeavyBreachGroup.visible = false;
  secondaryOrdnanceRoot.add(secHeavyBreachGroup);

  // 3C. Hexa-Swarm Rack (`hexa_swarm_rack`) - 6-Cell Micro-Missile Swarm Launchers
  const secHexaSwarmGroup = new THREE.Group();
  [-1.35, 1.35].forEach((sideX) => {
    const rackBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.34, 0.95),
      mats.darkGraphiteTrim,
    );
    rackBox.position.set(sideX, -0.28, 0.15);
    secHexaSwarmGroup.add(rackBox);

    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const tip = new THREE.Mesh(
          new THREE.ConeGeometry(0.05, 0.2, 8).rotateX(-Math.PI / 2),
          mats.biolumeCrimson,
        );
        tip.position.set(
          sideX + (c - 1) * 0.14,
          -0.28 + (r - 0.5) * 0.14,
          -0.38,
        );
        secHexaSwarmGroup.add(tip);
      }
    }
  });
  secHexaSwarmGroup.visible = false;
  secondaryOrdnanceRoot.add(secHexaSwarmGroup);

  // ============================================================================
  // 4. EIGHT VISIBLE 3D INSTRUMENT & MODULE HARDPOINTS + LEVEL/TIER EVOLUTION
  // ============================================================================
  const instrumentsRoot = new THREE.Group();
  group.add(instrumentsRoot);

  // 4.1 `cavitation_overcharge`: Glowing Accelerator Coils on Wings
  const modOverchargeGroup = new THREE.Group();
  [-1.92, 1.92].forEach((sideX) => {
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.032, 8, 18),
        mats.biolumeCyan,
      );
      ring.position.set(sideX, -0.05, -0.35 - i * 0.42);
      modOverchargeGroup.add(ring);
    }
  });
  modOverchargeGroup.visible = false;
  instrumentsRoot.add(modOverchargeGroup);

  // 4.2 `quad_torpedo_salvo`: Dorsal Automated Missile Drum Pod
  const modQuadSalvoGroup = new THREE.Group();
  {
    const dorsalPod = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.28, 0.92),
      mats.darkGraphiteTrim,
    );
    dorsalPod.position.set(0, 0.52, 0.55);
    modQuadSalvoGroup.add(dorsalPod);
    [-0.2, -0.07, 0.07, 0.2].forEach((ox) => {
      const miniTip = new THREE.Mesh(
        new THREE.ConeGeometry(0.05, 0.22, 8).rotateX(-Math.PI / 2),
        mats.biolumeAmber,
      );
      miniTip.position.set(ox, 0.54, 0.02);
      modQuadSalvoGroup.add(miniTip);
    });
  }
  modQuadSalvoGroup.visible = false;
  instrumentsRoot.add(modQuadSalvoGroup);

  // 4.3 `piezo_hull_regen`: Glowing Emerald Nano-Repair Lattice Strips
  const modHullRegenGroup = new THREE.Group();
  [-0.52, 0.52].forEach((sideX) => {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.08, 1.75),
      mats.biolumeEmerald,
    );
    strip.position.set(sideX, 0.26, 0.15);
    modHullRegenGroup.add(strip);
  });
  modHullRegenGroup.visible = false;
  instrumentsRoot.add(modHullRegenGroup);

  // 4.4 `hydro_thruster_coil`: Outboard Auxiliary Booster Thrusters + Flame Cones
  const modThrusterCoilGroup = new THREE.Group();
  [-1.58, 1.58].forEach((sideX) => {
    const auxPod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 1.15, 12).rotateX(Math.PI / 2),
      mats.titaniumHull,
    );
    auxPod.position.set(sideX, 0.06, 1.05);
    modThrusterCoilGroup.add(auxPod);

    const auxFlame = createRealisticThrusterAssembly(
      fireWhiteCoreMat,
      fireThermalMidMat,
      fireOuterPlasmaMat,
      0.58,
    );
    auxFlame.root.position.set(sideX, 0.06, 1.62);
    modThrusterCoilGroup.add(auxFlame.root);
    thrusterAssemblies.push(auxFlame);
  });
  modThrusterCoilGroup.visible = false;
  instrumentsRoot.add(modThrusterCoilGroup);

  // 4.5 `voltaic_shield_capacitor`: Four Angled Hexagonal Piezo-Shield Emitter Pylons
  const modShieldCapGroup = new THREE.Group();
  [
    [-1.15, 0.34, -0.15],
    [1.15, 0.34, -0.15],
    [-1.15, -0.28, 0.45],
    [1.15, -0.28, 0.45],
  ].forEach(([x, y, z]) => {
    const emitter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.12, 0.18, 6),
      mats.biolumeMagenta,
    );
    emitter.position.set(x, y, z);
    modShieldCapGroup.add(emitter);
  });
  modShieldCapGroup.visible = false;
  instrumentsRoot.add(modShieldCapGroup);

  // 4.6 `sonar_crit_visor`: Forward Nose-Mounted Multi-Lens Acoustic Scanner Pod
  const modSonarVisorGroup = new THREE.Group();
  {
    const sensorPod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.2, 0.65, 12).rotateX(Math.PI / 2),
      mats.darkGraphiteTrim,
    );
    sensorPod.position.set(0, -0.24, -1.75);
    const lensEye = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 12, 12),
      mats.biolumeCyan,
    );
    lensEye.position.set(0, -0.24, -2.08);
    const scannerHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.025, 8, 20),
      mats.biolumeCyan,
    );
    scannerHalo.position.set(0, -0.24, -1.95);
    modSonarVisorGroup.add(sensorPod, lensEye, scannerHalo);
  }
  modSonarVisorGroup.visible = false;
  instrumentsRoot.add(modSonarVisorGroup);

  // 4.7 `hadal_pressure_Bulkhead`: Heavy Sloped Exoskeleton Armor Plates
  const modBulkheadGroup = new THREE.Group();
  [-1.08, 1.08].forEach((sideX) => {
    const armorPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.24, 1.85),
      goldUpgradeMat,
    );
    armorPlate.position.set(sideX, 0.14, -0.2);
    armorPlate.rotation.z = sideX < 0 ? 0.32 : -0.32;
    modBulkheadGroup.add(armorPlate);
  });
  modBulkheadGroup.visible = false;
  instrumentsRoot.add(modBulkheadGroup);

  // 4.8 `biolume_siphon_array`: Lateral Glowing Collector Scoops & Vanes
  const modSiphonGroup = new THREE.Group();
  [-2.35, 2.35].forEach((sideX) => {
    const scoop = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.85, 6).rotateX(Math.PI / 2),
      mats.biolumeEmerald,
    );
    scoop.position.set(sideX, 0.12, -0.15);
    modSiphonGroup.add(scoop);
  });
  modSiphonGroup.visible = false;
  instrumentsRoot.add(modSiphonGroup);

  // 4.9 Level & Upgrade Tier Evolution Armor (Mk.II & Mk.III Prestige Evolution)
  const tierMk2EvolutionGroup = new THREE.Group();
  {
    // Wingtip energized plasma strakes + dorsal spinal fin
    [-2.95, 2.95].forEach((sideX) => {
      const strake = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.46, 1.25),
        goldUpgradeMat,
      );
      strake.position.set(sideX, 0.16, 0.45);
      tierMk2EvolutionGroup.add(strake);
    });
    const dorsalCrest = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.55, 1.45),
      goldUpgradeMat,
    );
    dorsalCrest.position.set(0, 0.45, 0.85);
    tierMk2EvolutionGroup.add(dorsalCrest);
  }
  tierMk2EvolutionGroup.visible = false;
  instrumentsRoot.add(tierMk2EvolutionGroup);

  const tierMk3EvolutionGroup = new THREE.Group();
  {
    // Mk.III Overdrive Reactor Halo & Golden Chevron Shoulder Plates
    const reactorHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.88, 0.045, 10, 28),
      goldUpgradeMat,
    );
    reactorHalo.position.set(0, 0.08, 1.48);
    tierMk3EvolutionGroup.add(reactorHalo);

    [-1.48, 1.48].forEach((sideX) => {
      const chevron = new THREE.Mesh(
        new THREE.ConeGeometry(0.24, 1.15, 4).rotateX(-Math.PI / 2),
        goldUpgradeMat,
      );
      chevron.position.set(sideX, 0.22, -0.65);
      tierMk3EvolutionGroup.add(chevron);
    });
  }
  tierMk3EvolutionGroup.visible = false;
  instrumentsRoot.add(tierMk3EvolutionGroup);

  // Central Rotating Cavitation Turbine Ring & Legacy Thruster Handles
  const turbineGeo = new THREE.TorusGeometry(0.58, 0.055, 10, 24);
  const turbineRing = new THREE.Mesh(turbineGeo, shipTrimMat);
  turbineRing.position.set(0, 0.0, 1.48);
  group.add(turbineRing);

  const thrusterLeft = thrusterAssemblies[0].outerPlume;
  const thrusterRight = thrusterAssemblies[1].outerPlume;

  // Piezo-Shield Bubble (Visible during barrel roll or shield impact)
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

    // 1. Toggle the 4 completely distinct 3D ship chassis
    interceptorChassis.visible = shipId === 'vanguard_interceptor';
    assaultChassis.visible = shipId === 'leviathan_assault';
    guardianChassis.visible = shipId === 'aegis_guardian';
    tacticalChassis.visible = shipId === 'echo_tactical';

    // Adjust weapon hardpoint width slightly per chassis wingspan
    const wingSpanScale =
      shipId === 'aegis_guardian'
        ? 1.18
        : shipId === 'leviathan_assault'
          ? 1.12
          : shipId === 'echo_tactical'
            ? 1.08
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

    // 6. Update trim & plasma fire colors
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
    // 1. Animate turbine ring & Nautilus-Spectre AWACS radar dish
    turbineRing.rotation.z += dt * 6.5 * surgeBoost;
    if (tacticalChassis.visible) {
      tacticalAwacsDish.rotation.y += dt * 2.4 * surgeBoost;
    }

    // 2. Animate 3-Layer Realistic Plasma/Fire Afterburner Plumes
    const flickerFast = 0.92 + Math.sin(elapsed * 48) * 0.14 + Math.cos(elapsed * 63) * 0.08;
    const lengthBoost = surgeBoost > 1.1 ? 1.75 : 1.0;
    const radialBoost = surgeBoost > 1.1 ? 1.28 : 1.0;

    thrusterAssemblies.forEach((asm, idx) => {
      const phase = idx * 1.3;
      const localFlicker =
        flickerFast + Math.sin(elapsed * 37 + phase) * 0.1;
      asm.innerCore.scale.set(
        radialBoost,
        radialBoost,
        localFlicker * lengthBoost,
      );
      asm.midFlame.scale.set(
        radialBoost * (1.0 + Math.sin(elapsed * 29 + phase) * 0.08),
        radialBoost * (1.0 + Math.cos(elapsed * 31 + phase) * 0.08),
        localFlicker * lengthBoost * 1.08,
      );
      asm.outerPlume.scale.set(
        radialBoost * 1.05,
        radialBoost * 1.05,
        localFlicker * lengthBoost * 1.15,
      );

      asm.shockRings.forEach((ring, rIdx) => {
        const pulse =
          1 + Math.sin(elapsed * 36 - rIdx * 1.4 + phase) * 0.18;
        ring.scale.set(pulse, pulse, 1);
        ring.position.z =
          (0.32 + rIdx * 0.36) * asm.baseScale * lengthBoost;
      });
    });

    // 3. Spring-recover primary weapon barrel recoil
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

    // 4. Animate & fade fiery muzzle flash starbursts
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
 * Creates a realistic multi-layered 3D Primary Weapon Fire Bolt Group
 * (White-hot core + glowing plasma/fire sheath + Mach shockwave ring)
 */
export function createPlayerPrimaryBoltMesh(mats: MaterialBank): THREE.Group {
  const boltGroup = new THREE.Group();

  const innerCoreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.98,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const outerFireMat = new THREE.MeshBasicMaterial({
    color: 0x06b6d4,
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const wakeFlameMat = new THREE.MeshBasicMaterial({
    color: 0xff7b00,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // White-hot energy spear core
  const coreGeo = new THREE.CapsuleGeometry(0.09, 1.25, 4, 8);
  coreGeo.rotateX(Math.PI / 2);
  const coreMesh = new THREE.Mesh(coreGeo, innerCoreMat);
  boltGroup.add(coreMesh);

  // Outer glowing plasma sheath
  const sheathGeo = new THREE.ConeGeometry(0.22, 1.85, 10, 1, true);
  sheathGeo.rotateX(-Math.PI / 2);
  const sheathMesh = new THREE.Mesh(sheathGeo, outerFireMat);
  boltGroup.add(sheathMesh);

  // Trailing thermal fire wake
  const wakeGeo = new THREE.ConeGeometry(0.16, 1.15, 8);
  wakeGeo.rotateX(Math.PI / 2);
  wakeGeo.translate(0, 0, 0.75);
  const wakeMesh = new THREE.Mesh(wakeGeo, wakeFlameMat);
  boltGroup.add(wakeMesh);

  // Leading shock ring
  const ringMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.025, 6, 14),
    mats.flashWhite,
  );
  ringMesh.position.set(0, 0, -0.35);
  boltGroup.add(ringMesh);

  return boltGroup;
}

/**
 * Creates a realistic 3D Homing Torpedo Missile with Warhead, Stabilizer Fins, and Live Fire Plume
 */
export function createPlayerTorpedoMesh(mats: MaterialBank): THREE.Group {
  const torpGroup = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.16, 1.35, 10).rotateX(Math.PI / 2),
    mats.titaniumHull,
  );
  torpGroup.add(body);

  const warhead = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.45, 10).rotateX(-Math.PI / 2),
    mats.biolumeAmber,
  );
  warhead.position.set(0, 0, -0.88);
  torpGroup.add(warhead);

  const fins = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.06, 0.35),
    mats.darkGraphiteTrim,
  );
  fins.position.set(0, 0, 0.45);
  const finsV = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.55, 0.35),
    mats.darkGraphiteTrim,
  );
  finsV.position.set(0, 0, 0.45);
  torpGroup.add(fins, finsV);

  // Live burning rocket exhaust cone at torpedo tail
  const fireMat = new THREE.MeshBasicMaterial({
    color: 0xff5500,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const fireCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 1.1, 10).rotateX(Math.PI / 2),
    fireMat,
  );
  fireCone.position.set(0, 0, 1.15);
  const innerCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.65, 8).rotateX(Math.PI / 2),
    coreMat,
  );
  innerCone.position.set(0, 0, 0.95);
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
