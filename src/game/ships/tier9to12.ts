import * as THREE from 'three';
import {
  ShipChassisBuild,
  ShipMaterialPalette,
  ThrusterFlameAssembly,
  createAccentEmissiveMat,
  createEnergyHaloShaderMat,
  createRealisticThrusterAssembly,
} from './shipTypes';

/**
 * SHIP 09 — TRENCH WARDEN (Autonomous Support Carrier · Legendary)
 * Broad tactical carrier hull in matte deep blue & jade trim, lateral drone launch bays
 * with 2 visible hovering 3D drones, rotating holographic sonar ring, triple balanced propulsion.
 */
export function createTrenchWardenChassis(
  p: ShipMaterialPalette,
): ShipChassisBuild {
  const root = new THREE.Group();
  const thrusters: ThrusterFlameAssembly[] = [];
  const jadeEmit = createAccentEmissiveMat(0x34d399, 2.0);
  const cyanEmit = createAccentEmissiveMat(0x22d3ee, 1.75);

  // Broad asymmetrical-catamaran tactical carrier flight deck
  const deckShape = new THREE.Shape();
  deckShape.moveTo(-0.85, -2.95);
  deckShape.lineTo(0.85, -2.95);
  deckShape.lineTo(2.45, -1.35);
  deckShape.lineTo(2.75, 0.95);
  deckShape.lineTo(1.65, 1.85);
  deckShape.lineTo(-1.65, 1.85);
  deckShape.lineTo(-2.75, 0.95);
  deckShape.lineTo(-2.45, -1.35);
  deckShape.closePath();

  const deckGeo = new THREE.ExtrudeGeometry(deckShape, {
    steps: 1,
    depth: 0.42,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.1,
    bevelSegments: 2,
  });
  deckGeo.rotateX(Math.PI / 2);
  const carrierDeck = new THREE.Mesh(deckGeo, p.deepNavyMat);
  carrierDeck.position.set(0, 0.2, 0);
  carrierDeck.castShadow = true;
  root.add(carrierDeck);

  // Jade carrier landing runway stripes & armored bridge island
  [-0.55, 0.55].forEach((rx) => {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.04, 3.65),
      jadeEmit,
    );
    strip.position.set(rx, 0.31, -0.45);
    root.add(strip);
  });

  const commandIsland = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.56, 1.65),
    p.whiteTitaniumMat,
  );
  commandIsland.position.set(0, 0.54, -0.55);
  root.add(commandIsland);

  const bridgeCanopy = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.22, 0.52),
    p.mats.sapphireCanopy,
  );
  bridgeCanopy.position.set(0, 0.62, -1.25);
  root.add(bridgeCanopy);

  // Rotating Holographic Dorsal Sonar Ring
  const holoRing = createEnergyHaloShaderMat(0x34d399, 0.78);
  const holoMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.045, 8, 36),
    holoRing.material,
  );
  holoMesh.rotation.x = Math.PI / 2;
  holoMesh.position.set(0, 0.92, 0.55);
  root.add(holoMesh);

  const holoCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.24, 1),
    jadeEmit,
  );
  holoCore.position.set(0, 0.92, 0.55);
  root.add(holoCore);

  // Lateral Drone Launch Bays + 2 Docked/Hovering Miniature 3D Support Drones
  const dockedDrones: THREE.Group[] = [];
  [-1, 1].forEach((dir, idx) => {
    const bayWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.52, 2.25),
      p.mats.darkGraphiteTrim,
    );
    bayWall.position.set(dir * 2.55, 0.14, 0.05);
    root.add(bayWall);

    const bayPad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.48, 0.08, 12),
      idx === 0 ? jadeEmit : cyanEmit,
    );
    bayPad.position.set(dir * 1.95, 0.28, 0.15);
    root.add(bayPad);

    // Docked miniature drone (Port = Repair Jade, Starboard = Attack Cyan)
    const drone = new THREE.Group();
    drone.position.set(dir * 1.95, 0.62, 0.15);
    const dCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22, 1),
      idx === 0 ? jadeEmit : cyanEmit,
    );
    const dRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.035, 6, 16),
      p.machinedSteelMat,
    );
    dRing.rotation.x = Math.PI / 2;
    const dFinL = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.04, 0.16),
      p.deepNavyMat,
    );
    drone.add(dCore, dRing, dFinL);
    root.add(drone);
    dockedDrones.push(drone);
  });

  // Triple Balanced Jade-Cyan Propulsion
  [
    [-1.48, 0.02, 1.92, 0.96],
    [0, 0.04, 2.02, 1.15],
    [1.48, 0.02, 1.92, 0.96],
  ].forEach(([x, y, z, sc]) => {
    const fl = createRealisticThrusterAssembly(
      p.heatStainedNozzleMat,
      p.machinedSteelMat,
      sc,
      0x34d399,
      0x06b6d4,
      0x6ee7b7,
    );
    fl.root.position.set(x, y, z);
    root.add(fl.root);
    thrusters.push(fl);
  });

  return {
    id: 'trench_warden',
    root,
    wingSpanScale: 1.28,
    thrusters,
    animate: (elapsed, dt, smoothThrottle, abilityActive) => {
      holoRing.uTime.value = elapsed;
      holoRing.uBoost.value = abilityActive ? 1.5 : smoothThrottle - 1;
      holoMesh.rotation.z += dt * (abilityActive ? 3.5 : 1.2);
      holoCore.rotation.y += dt * 2.2;
      dockedDrones.forEach((d, idx) => {
        d.position.y = 0.62 + Math.sin(elapsed * 3.8 + idx * 2.0) * 0.08;
        d.rotation.y += dt * (abilityActive ? 5.0 : 1.6);
        d.visible = !abilityActive; // Docked drones launch out into combat during Guardian Swarm!
      });
      jadeEmit.emissiveIntensity =
        (abilityActive ? 3.4 : 1.8) + Math.sin(elapsed * 4.5) * 0.25;
    },
  };
}

/**
 * SHIP 10 — KRAKEN REAPER (Multi-Vector Artillery Destroyer · Mythic)
 * Organic-mechanical obsidian & bronze central hull flanked by 4 articulated armored weapon arms,
 * glowing emerald plasma conduits, 4 radial vortex thrusters.
 */
export function createKrakenReaperChassis(
  p: ShipMaterialPalette,
): ShipChassisBuild {
  const root = new THREE.Group();
  const thrusters: ThrusterFlameAssembly[] = [];
  const emeraldEmit = createAccentEmissiveMat(0x10b981, 2.2);
  const bronzeEmit = createAccentEmissiveMat(0xd97706, 1.65);

  // Organic-mechanical central obsidian & bronze spine
  const spinePoints = [
    new THREE.Vector2(0.01, -3.15),
    new THREE.Vector2(0.45, -2.55),
    new THREE.Vector2(0.84, -1.25),
    new THREE.Vector2(0.92, 0.25),
    new THREE.Vector2(0.72, 1.45),
    new THREE.Vector2(0.24, 2.15),
  ];
  const spineGeo = new THREE.LatheGeometry(spinePoints, 20);
  spineGeo.rotateX(Math.PI / 2);
  spineGeo.scale(1.12, 0.68, 1.0);
  const spineMesh = new THREE.Mesh(spineGeo, p.obsidianArmorMat);
  spineMesh.castShadow = true;
  root.add(spineMesh);

  // Bronze armored dorsal carapace ribs
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(
      new THREE.TorusGeometry(0.78 - Math.abs(i - 2.5) * 0.09, 0.07, 8, 16, Math.PI),
      p.navalBronzeMat,
    );
    rib.position.set(0, 0.14, -1.6 + i * 0.62);
    root.add(rib);
  }

  // Central emerald gravitic core & canopy
  const gravCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.38, 1),
    emeraldEmit,
  );
  gravCore.position.set(0, 0.56, 0.18);
  root.add(gravCore);

  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)
      .scale(0.8, 0.58, 1.85),
    p.mats.sapphireCanopy,
  );
  canopy.position.set(0, 0.38, -1.15);
  canopy.renderOrder = 4;
  root.add(canopy);

  // 4 Articulated Curved Armored Mechanical Weapon Arms (2 Upper, 2 Lower)
  const armPivots: { group: THREE.Group; baseYaw: number; basePitch: number; side: number }[] = [];
  const armConfigs = [
    { side: -1, y: 0.28, z: -0.35, yaw: 0.25, pitch: 0.08, reach: 1.0 },
    { side: 1, y: 0.28, z: -0.35, yaw: -0.25, pitch: 0.08, reach: 1.0 },
    { side: -1, y: -0.22, z: 0.35, yaw: 0.45, pitch: -0.1, reach: 1.15 },
    { side: 1, y: -0.22, z: 0.35, yaw: -0.45, pitch: -0.1, reach: 1.15 },
  ];

  armConfigs.forEach((cfg) => {
    const pivot = new THREE.Group();
    pivot.position.set(cfg.side * 0.78, cfg.y, cfg.z);

    // Sweeping mechanical arm tube
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(cfg.side * 1.15 * cfg.reach, cfg.y * 0.5, -0.55),
      new THREE.Vector3(cfg.side * 1.65 * cfg.reach, 0.05, -1.85),
      new THREE.Vector3(cfg.side * 1.18 * cfg.reach, -0.05, -2.85),
    ]);
    const armMesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 16, 0.14, 10, false),
      p.obsidianArmorMat,
    );
    pivot.add(armMesh);

    // Bronze articulated joint knuckles + emerald plasma cannon claw at arm tip
    [0.35, 0.7].forEach((t) => {
      const pt = curve.getPoint(t);
      const joint = new THREE.Mesh(
        new THREE.SphereGeometry(0.19, 10, 10),
        p.navalBronzeMat,
      );
      joint.position.copy(pt);
      pivot.add(joint);
    });

    const tipPos = curve.getPoint(1.0);
    const clawEmitter = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.65, 8).rotateX(-Math.PI / 2),
      emeraldEmit,
    );
    clawEmitter.position.copy(tipPos);
    pivot.add(clawEmitter);

    root.add(pivot);
    armPivots.push({
      group: pivot,
      baseYaw: cfg.yaw,
      basePitch: cfg.pitch,
      side: cfg.side,
    });
  });

  // 4 Radial Emerald-Bronze Vortex Thrusters
  [
    [-0.78, 0.34, 1.75],
    [0.78, 0.34, 1.75],
    [-0.95, -0.28, 1.65],
    [0.95, -0.28, 1.65],
  ].forEach(([x, y, z]) => {
    const fl = createRealisticThrusterAssembly(
      p.heatStainedNozzleMat,
      p.machinedSteelMat,
      0.92,
      0x10b981,
      0xd97706,
      0x6ee7b7,
    );
    fl.root.position.set(x, y, z);
    root.add(fl.root);
    thrusters.push(fl);
  });

  return {
    id: 'kraken_reaper',
    root,
    wingSpanScale: 1.3,
    thrusters,
    animate: (elapsed, dt, smoothThrottle, abilityActive) => {
      gravCore.rotation.y += dt * (abilityActive ? 8.0 : 2.2);
      const flex = Math.sin(elapsed * 2.6) * 0.06;
      const converge = abilityActive ? -0.22 : 0;
      armPivots.forEach((ap, idx) => {
        ap.group.rotation.y =
          ap.baseYaw + ap.side * converge + Math.sin(elapsed * 2.4 + idx) * 0.05;
        ap.group.rotation.x = ap.basePitch + flex * (idx < 2 ? 1 : -1);
      });
      emeraldEmit.emissiveIntensity =
        (abilityActive ? 3.8 : 2.1) + (smoothThrottle - 1) * 0.7;
      bronzeEmit.emissiveIntensity = 1.6 + Math.sin(elapsed * 4) * 0.2;
    },
  };
}

/**
 * SHIP 11 — ABYSSAL SOVEREIGN (Strategic Dreadnought · Mythic)
 * Elongated imperial spearhead battleship in black obsidian & matte gilded gold,
 * stacked dorsal command tiers, crimson energy ribs, 6-engine dreadnought thruster cluster.
 */
export function createAbyssalSovereignChassis(
  p: ShipMaterialPalette,
): ShipChassisBuild {
  const root = new THREE.Group();
  const thrusters: ThrusterFlameAssembly[] = [];
  const crimsonEmit = createAccentEmissiveMat(0xef4444, 2.25);
  const goldEmit = createAccentEmissiveMat(0xfbbf24, 1.85);
  const radarNodes: THREE.Group[] = [];

  // Elongated Imperial Spearhead Main Hull
  const spearShape = new THREE.Shape();
  spearShape.moveTo(0, -3.75);
  spearShape.lineTo(0.85, -2.15);
  spearShape.lineTo(2.45, 0.35);
  spearShape.lineTo(2.25, 1.85);
  spearShape.lineTo(0.95, 2.05);
  spearShape.lineTo(-0.95, 2.05);
  spearShape.lineTo(-2.25, 1.85);
  spearShape.lineTo(-2.45, 0.35);
  spearShape.lineTo(-0.85, -2.15);
  spearShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(spearShape, {
    steps: 1,
    depth: 0.48,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.12,
    bevelSegments: 2,
  });
  hullGeo.rotateX(Math.PI / 2);
  const mainHull = new THREE.Mesh(hullGeo, p.obsidianArmorMat);
  mainHull.position.set(0, 0.22, 0);
  mainHull.castShadow = true;
  root.add(mainHull);

  // Gilded Imperial Prow Trim & Stacked Dorsal Command Tiers
  const prowBlade = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 1.65, 4).rotateY(Math.PI / 4).rotateX(-Math.PI / 2),
    p.goldGildedMat,
  );
  prowBlade.scale.set(1.2, 0.45, 1.0);
  prowBlade.position.set(0, 0.04, -3.82);
  root.add(prowBlade);

  // Tier 1 & Tier 2 Stacked Command Citadels
  const tier1 = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.46, 2.65),
    p.obsidianArmorMat,
  );
  tier1.position.set(0, 0.48, 0.25);

  const tier2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.42, 1.48),
    p.goldGildedMat,
  );
  tier2.position.set(0, 0.88, 0.55);

  const bridgeSlit = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.14, 0.14),
    crimsonEmit,
  );
  bridgeSlit.position.set(0, 0.94, -0.2);
  root.add(tier1, tier2, bridgeSlit);

  // Dual Rotating Command Sensor Masts
  [-0.32, 0.32].forEach((mx) => {
    const mast = new THREE.Group();
    mast.position.set(mx, 1.18, 0.72);
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.08, 0.1),
      p.goldGildedMat,
    );
    mast.add(bar);
    root.add(mast);
    radarNodes.push(mast);
  });

  // Crimson Energy Rib Grilles & Broadside 6-Cell Gold Missile Decks
  [-1, 1].forEach((dir) => {
    for (let r = 0; r < 5; r++) {
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.12, 0.1),
        crimsonEmit,
      );
      rib.position.set(dir * (0.98 + r * 0.22), 0.28, -1.2 + r * 0.58);
      rib.rotation.y = dir * 0.24;
      root.add(rib);
    }

    // Gold broadside missile deck rail
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.24, 1.85),
      p.goldGildedMat,
    );
    rail.position.set(dir * 1.82, 0.24, 0.85);
    root.add(rail);
  });

  // 6-Engine Dreadnought Thruster Cluster across the Imperial Stern
  [
    [-1.78, -0.02, 1.92, 0.82],
    [-1.08, 0.04, 2.04, 0.96],
    [-0.38, 0.08, 2.15, 1.1],
    [0.38, 0.08, 2.15, 1.1],
    [1.08, 0.04, 2.04, 0.96],
    [1.78, -0.02, 1.92, 0.82],
  ].forEach(([x, y, z, sc]) => {
    const fl = createRealisticThrusterAssembly(
      p.heatStainedNozzleMat,
      p.machinedSteelMat,
      sc,
      0xef4444,
      0xfbbf24,
      0xfde047,
    );
    fl.root.position.set(x, y, z);
    root.add(fl.root);
    thrusters.push(fl);
  });

  return {
    id: 'abyssal_sovereign',
    root,
    wingSpanScale: 1.32,
    thrusters,
    animate: (elapsed, dt, smoothThrottle, abilityActive) => {
      radarNodes[0].rotation.y += dt * 2.2 * smoothThrottle;
      radarNodes[1].rotation.y -= dt * 2.8 * smoothThrottle;
      const pulse =
        (abilityActive ? 3.8 : 2.1) +
        Math.sin(elapsed * 7.5) * 0.3 +
        (smoothThrottle - 1) * 0.7;
      crimsonEmit.emissiveIntensity = pulse;
      goldEmit.emissiveIntensity = 1.6 + Math.cos(elapsed * 5) * 0.25;
    },
  };
}

/**
 * SHIP 12 — PELAGIC ASCENDANT (Ultimate Legendary Flagship · Ultimate)
 * Pearl-white, gilded-gold & brilliant cyan cathedral apex flagship:
 * - 6 radial articulated wing fins
 * - Massive central suspended reactor core
 * - 2 counter-rotating GLSL circular energy halos
 * - 2 spinal heavy plasma lances + smart torpedo ports + 4 gimbaled tracking turrets
 * - 5-cluster Ascendant Propulsion
 */
export function createPelagicAscendantChassis(
  p: ShipMaterialPalette,
): ShipChassisBuild {
  const root = new THREE.Group();
  const thrusters: ThrusterFlameAssembly[] = [];
  const cyanEmit = createAccentEmissiveMat(0x22d3ee, 2.5);
  const goldEmit = createAccentEmissiveMat(0xfbbf24, 2.1);

  // Split Pearl-White & Gilded-Gold Cathedral Spear Fuselage (framing the suspended central reactor)
  [-1, 1].forEach((dir) => {
    const mainFlank = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.56, 3.95),
      p.pearlWhiteMat,
    );
    mainFlank.position.set(dir * 0.68, 0.04, -0.38);
    mainFlank.rotation.y = dir * 0.08;
    mainFlank.castShadow = true;
    root.add(mainFlank);

    // Gilded gold forward spear-crown blades
    const goldBlade = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.22, 2.55),
      p.goldGildedMat,
    );
    goldBlade.position.set(dir * 0.44, 0.24, -1.65);
    goldBlade.rotation.y = dir * 0.06;
    root.add(goldBlade);

    // 2 Spinal Heavy Plasma Lances extending from the forward prow
    const spinalLance = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 3.25, 12).rotateX(Math.PI / 2),
      p.machinedSteelMat,
    );
    spinalLance.position.set(dir * 0.44, -0.02, -2.05);

    const lanceGlowTip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.08, 1.35, 10).rotateX(Math.PI / 2),
      cyanEmit,
    );
    lanceGlowTip.position.set(dir * 0.44, -0.02, -3.15);
    root.add(spinalLance, lanceGlowTip);

    // Smart Torpedo Nexus Ports under forward flanks
    for (let t = 0; t < 2; t++) {
      const portRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.11, 0.025, 8, 14),
        goldEmit,
      );
      portRing.position.set(dir * (0.95 + t * 0.28), -0.18, -1.35 + t * 0.22);
      root.add(portRing);
    }
  });

  // Forward Pearl-Gold Canopy Bridge linking both flanks ahead of the reactor bay
  const bridgeArch = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.42, 1.45),
    p.pearlWhiteMat,
  );
  bridgeArch.position.set(0, 0.24, -1.42);
  const crystalBridge = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)
      .scale(0.85, 0.52, 1.9),
    p.mats.sapphireCanopy,
  );
  crystalBridge.position.set(0, 0.42, -1.45);
  crystalBridge.renderOrder = 4;
  root.add(bridgeArch, crystalBridge);

  // Massive Central Suspended Reactor Sphere inside a Gilded Containment Cradle
  const reactorCradleRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.68, 0.055, 10, 28),
    p.goldGildedMat,
  );
  reactorCradleRing.rotation.x = Math.PI / 2;
  reactorCradleRing.position.set(0, 0.16, 0.45);

  const reactorCore = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.44, 1),
    cyanEmit,
  );
  reactorCore.position.set(0, 0.16, 0.45);

  const reactorCage = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.56, 0),
    goldEmit,
  );
  (reactorCage.material as THREE.MeshStandardMaterial).wireframe = true;
  reactorCage.position.set(0, 0.16, 0.45);
  root.add(reactorCradleRing, reactorCore, reactorCage);

  // 2 Counter-Rotating GLSL Circular Energy Halos framing the Reactor & Stern
  const haloCyan = createEnergyHaloShaderMat(0x22d3ee, 0.85);
  const haloGold = createEnergyHaloShaderMat(0xfbbf24, 0.76);

  const outerHaloMesh = new THREE.Mesh(
    new THREE.TorusGeometry(1.52, 0.055, 8, 48),
    haloCyan.material,
  );
  outerHaloMesh.position.set(0, 0.16, 0.85);

  const innerHaloMesh = new THREE.Mesh(
    new THREE.TorusGeometry(1.16, 0.042, 8, 40),
    haloGold.material,
  );
  innerHaloMesh.position.set(0, 0.16, 1.05);
  root.add(outerHaloMesh, innerHaloMesh);

  // 6 Radial Articulated Cathedral Wing Fins (3 Port, 3 Starboard: Upper, Mid, Lower)
  const wingAngles = [0.42, 0.0, -0.38]; // Radians above/below horizontal
  const wingFins: { mesh: THREE.Group; baseRoll: number; side: number; tierIdx: number }[] = [];
  const trackingTurrets: THREE.Group[] = [];

  [-1, 1].forEach((dir) => {
    wingAngles.forEach((rollAngle, wIdx) => {
      const wingPivot = new THREE.Group();
      wingPivot.position.set(dir * 0.88, 0.06 + (1 - wIdx) * 0.12, 0.15 + wIdx * 0.15);
      wingPivot.rotation.z = dir * rollAngle;

      const spanLen = wIdx === 1 ? 2.85 : 2.15;
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(spanLen, 0.08, 0.88 - wIdx * 0.12),
        wIdx === 1 ? p.pearlWhiteMat : p.goldGildedMat,
      );
      blade.position.set(dir * (spanLen * 0.5), 0, 0);
      blade.rotation.y = dir * (0.28 + wIdx * 0.08);

      const cyanEdge = new THREE.Mesh(
        new THREE.BoxGeometry(spanLen * 0.92, 0.04, 0.06),
        cyanEmit,
      );
      cyanEdge.position.set(dir * (spanLen * 0.52), 0.04, -0.38);
      cyanEdge.rotation.y = dir * (0.28 + wIdx * 0.08);

      wingPivot.add(blade, cyanEdge);
      root.add(wingPivot);
      wingFins.push({ mesh: wingPivot, baseRoll: dir * rollAngle, side: dir, tierIdx: wIdx });

      // Mount 4 Gimbaled Autonomous Tracking Turrets on the Upper & Mid Wings
      if (wIdx < 2) {
        const turret = new THREE.Group();
        turret.position.set(dir * (1.75 + wIdx * 0.55), 0.09, -0.15);
        const tBase = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.18, 0.14, 10),
          p.goldGildedMat,
        );
        const tBarrel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.045, 0.65, 8).rotateX(Math.PI / 2),
          cyanEmit,
        );
        tBarrel.position.set(0, 0.04, -0.28);
        turret.add(tBase, tBarrel);
        wingPivot.add(turret);
        trackingTurrets.push(turret);
      }
    });
  });

  // 5-Cluster Ascendant Propulsion (Central Apex Core + 4 Wing-Root Nozzles)
  [
    [-1.42, 0.18, 1.88, 0.86],
    [-0.78, -0.12, 1.98, 0.94],
    [0, 0.12, 2.08, 1.32],
    [0.78, -0.12, 1.98, 0.94],
    [1.42, 0.18, 1.88, 0.86],
  ].forEach(([x, y, z, sc]) => {
    const fl = createRealisticThrusterAssembly(
      p.heatStainedNozzleMat,
      p.machinedSteelMat,
      sc,
      0x22d3ee,
      0xfbbf24,
      0xfef9c3,
    );
    fl.root.position.set(x, y, z);
    root.add(fl.root);
    thrusters.push(fl);
  });

  return {
    id: 'pelagic_ascendant',
    root,
    wingSpanScale: 1.4,
    thrusters,
    animate: (elapsed, dt, smoothThrottle, abilityActive) => {
      const spinMult = abilityActive ? 3.5 : 1.0 + (smoothThrottle - 1) * 0.8;
      haloCyan.uTime.value = elapsed;
      haloCyan.uBoost.value = abilityActive ? 1.8 : smoothThrottle - 1;
      haloGold.uTime.value = elapsed;
      haloGold.uBoost.value = abilityActive ? 1.8 : smoothThrottle - 1;

      outerHaloMesh.rotation.z += dt * 1.45 * spinMult;
      innerHaloMesh.rotation.z -= dt * 2.15 * spinMult;
      reactorCore.rotation.y += dt * 2.6 * spinMult;
      reactorCore.rotation.x += dt * 1.3;
      reactorCage.rotation.y -= dt * 1.8 * spinMult;

      // Subtle cathedral wing articulation on surge/ability
      const splay = (smoothThrottle - 1) * 0.08 + (abilityActive ? 0.12 : 0);
      wingFins.forEach((wf) => {
        wf.mesh.rotation.z =
          wf.baseRoll + wf.side * (wf.tierIdx === 0 ? splay : wf.tierIdx === 2 ? -splay : 0);
      });

      // Gimbaled turret tracking sweep
      trackingTurrets.forEach((turret, idx) => {
        turret.rotation.y = Math.sin(elapsed * 2.2 + idx * 1.4) * 0.35;
      });

      cyanEmit.emissiveIntensity =
        (abilityActive ? 4.2 : 2.4) + Math.sin(elapsed * 6.0) * 0.3;
      goldEmit.emissiveIntensity = 1.95 + Math.cos(elapsed * 4.5) * 0.25;
    },
  };
}
