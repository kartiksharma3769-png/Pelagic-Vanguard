import * as THREE from 'three';
import { AppendageSlot, EnemyType, StageId } from './types';

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

/**
 * Builds the player's 10-part Vanguard-IX Deep-Trench Hydro-Fighter
 */
export function createVanguardShip(mats: MaterialBank): {
  group: THREE.Group;
  thrusterLeft: THREE.Mesh;
  thrusterRight: THREE.Mesh;
  turbineRing: THREE.Mesh;
  shieldSphere: THREE.Mesh;
  setAppearance: (
    shipId:
      | 'vanguard_interceptor'
      | 'leviathan_assault'
      | 'aegis_guardian'
      | 'echo_tactical',
    trimHex: number,
  ) => void;
} {
  const group = new THREE.Group();

  // 1. Primary Silhouette: Streamlined Lathe Pressure Fuselage
  const lathePoints = [
    new THREE.Vector2(0.01, -2.5),
    new THREE.Vector2(0.32, -1.8),
    new THREE.Vector2(0.68, -0.6),
    new THREE.Vector2(0.74, 0.5),
    new THREE.Vector2(0.55, 1.5),
    new THREE.Vector2(0.28, 2.1),
    new THREE.Vector2(0.02, 2.3),
  ];
  const fuselageGeo = new THREE.LatheGeometry(lathePoints, 20);
  fuselageGeo.rotateX(Math.PI / 2);
  fuselageGeo.scale(1.15, 0.72, 1.0);
  const fuselage = new THREE.Mesh(fuselageGeo, mats.titaniumHull);
  fuselage.castShadow = true;
  fuselage.receiveShadow = true;
  group.add(fuselage);

  // 2. Secondary Read: Swept Forward-Edge Hydro-Wings (ExtrudeGeometry with bevels)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0.45, -0.4);
  wingShape.lineTo(2.85, 0.55);
  wingShape.lineTo(2.95, 1.15);
  wingShape.lineTo(0.55, 1.35);
  wingShape.closePath();

  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    steps: 1,
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  wingGeo.rotateX(Math.PI / 2);

  const rightWing = new THREE.Mesh(wingGeo, mats.titaniumHull);
  rightWing.position.set(0, 0.04, 0);
  rightWing.castShadow = true;
  group.add(rightWing);

  const leftWing = new THREE.Mesh(wingGeo, mats.titaniumHull);
  leftWing.scale.set(-1, 1, 1);
  leftWing.position.set(0, 0.04, 0);
  leftWing.castShadow = true;
  group.add(leftWing);

  // 3. Secondary Read: Articulated Forward Dive Canards + Twin Tail Stabilizers
  const finGeo = new THREE.BoxGeometry(0.95, 0.07, 0.55);
  const rightCanard = new THREE.Mesh(finGeo, mats.darkGraphiteTrim);
  rightCanard.position.set(0.75, 0.02, -1.2);
  rightCanard.rotation.y = -0.35;
  group.add(rightCanard);

  const leftCanard = new THREE.Mesh(finGeo, mats.darkGraphiteTrim);
  leftCanard.position.set(-0.75, 0.02, -1.2);
  leftCanard.rotation.y = 0.35;
  group.add(leftCanard);

  const tailFinGeo = new THREE.BoxGeometry(0.08, 0.85, 0.9);
  const rightTailFin = new THREE.Mesh(tailFinGeo, mats.darkGraphiteTrim);
  rightTailFin.position.set(0.68, 0.45, 1.35);
  rightTailFin.rotation.z = -0.32;
  group.add(rightTailFin);

  const leftTailFin = new THREE.Mesh(tailFinGeo, mats.darkGraphiteTrim);
  leftTailFin.position.set(-0.68, 0.45, 1.35);
  leftTailFin.rotation.z = 0.32;
  group.add(leftTailFin);

  // 4. Secondary Read: Sapphire Cockpit Canopy + Interior Instrument Console
  const cockpitConsole = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.22, 0.95),
    mats.darkGraphiteTrim,
  );
  cockpitConsole.position.set(0, 0.32, -0.45);
  group.add(cockpitConsole);

  const cockpitHudGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.12, 0.18),
    mats.biolumeCyan,
  );
  cockpitHudGlow.position.set(0, 0.46, -0.78);
  group.add(cockpitHudGlow);

  const canopyGeo = new THREE.SphereGeometry(
    0.52,
    20,
    14,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.55,
  );
  canopyGeo.scale(0.88, 0.72, 1.85);
  const canopy = new THREE.Mesh(canopyGeo, mats.sapphireCanopy);
  canopy.position.set(0, 0.3, -0.35);
  canopy.renderOrder = 4;
  group.add(canopy);

  // 5. Secondary Read: Twin Hydro-Jet Engine Nacelles
  const nacelleGeo = new THREE.CylinderGeometry(0.28, 0.34, 1.85, 16);
  nacelleGeo.rotateX(Math.PI / 2);

  const leftNacelle = new THREE.Mesh(nacelleGeo, mats.darkGraphiteTrim);
  leftNacelle.position.set(-0.98, -0.06, 0.85);
  group.add(leftNacelle);

  const rightNacelle = new THREE.Mesh(nacelleGeo, mats.darkGraphiteTrim);
  rightNacelle.position.set(0.98, -0.06, 0.85);
  group.add(rightNacelle);

  // 6. Accent Detail: Rotating Cavitation Turbine Ring
  const turbineGeo = new THREE.TorusGeometry(0.55, 0.06, 10, 24);
  const turbineRing = new THREE.Mesh(turbineGeo, mats.biolumeCyan);
  turbineRing.position.set(0, 0.0, 1.45);
  group.add(turbineRing);

  // 7. Accent Detail: Twin Wingtip Cavitation Pulse Cannon Barrels
  const barrelGeo = new THREE.CylinderGeometry(0.065, 0.09, 1.35, 10);
  barrelGeo.rotateX(Math.PI / 2);

  const leftBarrel = new THREE.Mesh(barrelGeo, mats.darkGraphiteTrim);
  leftBarrel.position.set(-1.95, -0.04, 0.15);
  group.add(leftBarrel);

  const rightBarrel = new THREE.Mesh(barrelGeo, mats.darkGraphiteTrim);
  rightBarrel.position.set(1.95, -0.04, 0.15);
  group.add(rightBarrel);

  const muzzleGeo = new THREE.SphereGeometry(0.09, 10, 10);
  const leftMuzzle = new THREE.Mesh(muzzleGeo, mats.biolumeCyan);
  leftMuzzle.position.set(-1.95, -0.04, -0.52);
  group.add(leftMuzzle);

  const rightMuzzle = new THREE.Mesh(muzzleGeo, mats.biolumeCyan);
  rightMuzzle.position.set(1.95, -0.04, -0.52);
  group.add(rightMuzzle);

  // 8. Accent Detail: Glowing Hydro-Jet Thruster Plumes
  const plumeGeo = new THREE.ConeGeometry(0.24, 1.15, 12);
  plumeGeo.rotateX(Math.PI / 2);
  plumeGeo.translate(0, 0, 0.55);

  const shipTrimMat = mats.biolumeCyan.clone();
  turbineRing.material = shipTrimMat;
  leftMuzzle.material = shipTrimMat;
  rightMuzzle.material = shipTrimMat;
  cockpitHudGlow.material = shipTrimMat;

  const thrusterLeft = new THREE.Mesh(plumeGeo, shipTrimMat);
  thrusterLeft.position.set(-0.98, -0.06, 1.75);
  group.add(thrusterLeft);

  const thrusterRight = new THREE.Mesh(plumeGeo, shipTrimMat);
  thrusterRight.position.set(0.98, -0.06, 1.75);
  group.add(thrusterRight);

  // 9. Class-Specific 3D Silhouette Sub-Assemblies
  // 9A. Maelstrom-XII (Assault): Twin Heavy Forward Siege Pods & Dorsal Cannon Spine
  const assaultPodsGroup = new THREE.Group();
  const siegePodGeo = new THREE.BoxGeometry(0.46, 0.34, 2.2);
  const leftSiegePod = new THREE.Mesh(siegePodGeo, mats.darkGraphiteTrim);
  leftSiegePod.position.set(-1.35, 0.18, -0.35);
  const rightSiegePod = new THREE.Mesh(siegePodGeo, mats.darkGraphiteTrim);
  rightSiegePod.position.set(1.35, 0.18, -0.35);
  const assaultCoreGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.18, 1.6),
    shipTrimMat,
  );
  assaultCoreGlow.position.set(0, 0.42, 0.45);
  assaultPodsGroup.add(leftSiegePod, rightSiegePod, assaultCoreGlow);
  assaultPodsGroup.visible = false;
  group.add(assaultPodsGroup);

  // 9B. Bathys-Bastion IV (Guardian): Heavy Sloped Hadal Bulwark Shields & Ventral Keel
  const guardianArmorGroup = new THREE.Group();
  const bulwarkGeo = new THREE.BoxGeometry(0.85, 0.48, 2.35);
  const leftBulwark = new THREE.Mesh(bulwarkGeo, mats.titaniumHull);
  leftBulwark.position.set(-1.6, -0.1, 0.15);
  leftBulwark.rotation.z = 0.25;
  const rightBulwark = new THREE.Mesh(bulwarkGeo, mats.titaniumHull);
  rightBulwark.position.set(1.6, -0.1, 0.15);
  rightBulwark.rotation.z = -0.25;
  const guardianTrimRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.05, 8, 24),
    shipTrimMat,
  );
  guardianTrimRing.rotation.x = Math.PI / 2;
  guardianTrimRing.position.set(0, 0.1, 0.2);
  guardianArmorGroup.add(leftBulwark, rightBulwark, guardianTrimRing);
  guardianArmorGroup.visible = false;
  group.add(guardianArmorGroup);

  // 9C. Nautilus-Spectre VII (Tactical): Dorsal Acoustic Sonar Radome Dish & Forward Sensor Whiskers
  const tacticalRadomeGroup = new THREE.Group();
  const radomeDish = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.62, 0.14, 20),
    mats.darkGraphiteTrim,
  );
  radomeDish.position.set(0, 0.68, 0.55);
  const radomeHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.82, 0.045, 8, 24),
    shipTrimMat,
  );
  radomeHalo.rotation.x = Math.PI / 2;
  radomeHalo.position.set(0, 0.68, 0.55);
  tacticalRadomeGroup.add(radomeDish, radomeHalo);
  tacticalRadomeGroup.visible = false;
  group.add(tacticalRadomeGroup);

  // 10. Piezo-Shield Bubble (Visible during barrel roll or shield impact)
  const shieldGeo = new THREE.IcosahedronGeometry(2.6, 2);
  const shieldMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    wireframe: true,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const shieldSphere = new THREE.Mesh(shieldGeo, shieldMat);
  group.add(shieldSphere);

  function setAppearance(
    shipId:
      | 'vanguard_interceptor'
      | 'leviathan_assault'
      | 'aegis_guardian'
      | 'echo_tactical',
    trimHex: number,
  ) {
    assaultPodsGroup.visible = shipId === 'leviathan_assault';
    guardianArmorGroup.visible = shipId === 'aegis_guardian';
    tacticalRadomeGroup.visible = shipId === 'echo_tactical';

    if (shipId === 'leviathan_assault') {
      rightWing.scale.set(1.12, 1.2, 1.08);
      leftWing.scale.set(-1.12, 1.2, 1.08);
    } else if (shipId === 'aegis_guardian') {
      rightWing.scale.set(0.92, 1.35, 1.15);
      leftWing.scale.set(-0.92, 1.35, 1.15);
    } else if (shipId === 'echo_tactical') {
      rightWing.scale.set(1.22, 0.85, 0.92);
      leftWing.scale.set(-1.22, 0.85, 0.92);
    } else {
      rightWing.scale.set(1, 1, 1);
      leftWing.scale.set(-1, 1, 1);
    }

    shipTrimMat.color.setHex(trimHex);
    shipTrimMat.emissive.setHex(trimHex);
    shieldMat.color.setHex(trimHex);
  }

  return {
    group,
    thrusterLeft,
    thrusterRight,
    turbineRing,
    shieldSphere,
    setAppearance,
  };
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
