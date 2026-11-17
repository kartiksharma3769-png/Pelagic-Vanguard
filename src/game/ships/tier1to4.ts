import * as THREE from 'three';
import {
  ShipChassisBuild,
  ShipMaterialPalette,
  ThrusterFlameAssembly,
  createAccentEmissiveMat,
  createCockpitInterior,
  createRealisticThrusterAssembly,
} from './shipTypes';

/**
 * SHIP 01 — VANGUARD-IX (Recon Fighter · Standard)
 * Compact spear-shaped white titanium hull, dark graphite underbody, two swept stabilizer fins,
 * central panoramic cockpit, cyan hull strips, twin compact ion-cavitation engines.
 */
export function createVanguardIXChassis(
  p: ShipMaterialPalette,
): ShipChassisBuild {
  const root = new THREE.Group();
  const thrusters: ThrusterFlameAssembly[] = [];
  const cyanEmit = createAccentEmissiveMat(0x22d3ee, 1.8);

  // Spear-shaped white titanium main hull
  const lathePoints = [
    new THREE.Vector2(0.01, -3.05),
    new THREE.Vector2(0.12, -2.7),
    new THREE.Vector2(0.28, -2.05),
    new THREE.Vector2(0.54, -1.0),
    new THREE.Vector2(0.64, -0.1),
    new THREE.Vector2(0.62, 0.9),
    new THREE.Vector2(0.46, 1.55),
    new THREE.Vector2(0.18, 1.98),
    new THREE.Vector2(0.02, 2.1),
  ];
  const fuselageGeo = new THREE.LatheGeometry(lathePoints, 28);
  fuselageGeo.rotateX(Math.PI / 2);
  fuselageGeo.scale(1.06, 0.58, 1.0);
  const fuselage = new THREE.Mesh(fuselageGeo, p.whiteTitaniumMat);
  fuselage.castShadow = true;
  fuselage.receiveShadow = true;
  root.add(fuselage);

  // Dark graphite mechanical underbody keel
  const underbody = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.22, 2.85),
    p.mats.darkGraphiteTrim,
  );
  underbody.position.set(0, -0.22, 0.05);
  root.add(underbody);

  // Sharp forward cavitator nose & acoustic pitot sting
  const noseTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.52, 16).rotateX(-Math.PI / 2),
    p.machinedSteelMat,
  );
  noseTip.position.set(0, 0, -3.18);
  const pitot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.025, 0.45, 8).rotateX(Math.PI / 2),
    p.machinedSteelMat,
  );
  pitot.position.set(0, -0.02, -3.45);
  root.add(noseTip, pitot);

  // Raised dorsal spine with panel seams & cyan illuminated hull strips
  const dorsalSpine = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.2, 2.25),
    p.whiteTitaniumMat,
  );
  dorsalSpine.position.set(0, 0.3, 0.48);
  root.add(dorsalSpine);

  [-0.24, 0.24].forEach((sx) => {
    const cyanStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.04, 2.25),
      cyanEmit,
    );
    cyanStrip.position.set(sx, 0.28, 0.12);
    root.add(cyanStrip);
  });

  // Two short swept-back hydrodynamic stabilizer fins + underside sonic torpedo rails
  const finShape = new THREE.Shape();
  finShape.moveTo(0.48, -0.5);
  finShape.lineTo(1.25, -0.1);
  finShape.lineTo(2.48, 0.58);
  finShape.lineTo(2.38, 1.05);
  finShape.lineTo(1.25, 0.86);
  finShape.lineTo(0.5, 1.15);
  finShape.closePath();

  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    steps: 1,
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  finGeo.rotateX(Math.PI / 2);

  const rFin = new THREE.Mesh(finGeo, p.whiteTitaniumMat);
  rFin.position.set(0, 0.03, 0);
  const lFin = new THREE.Mesh(finGeo, p.whiteTitaniumMat);
  lFin.scale.set(-1, 1, 1);
  lFin.position.set(0, 0.03, 0);
  root.add(rFin, lFin);

  // Leading edge cyan trim & twin forward cavitation cannon housings
  [-1, 1].forEach((dir) => {
    const edgeLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 1.15),
      cyanEmit,
    );
    edgeLight.position.set(dir * 1.48, 0.03, 0.25);
    edgeLight.rotation.y = dir * -0.58;

    const tailVane = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.78, 0.72),
      p.mats.darkGraphiteTrim,
    );
    tailVane.position.set(dir * 0.68, 0.42, 1.25);
    tailVane.rotation.z = dir * -0.3;

    const fwdBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.062, 1.12, 10).rotateX(Math.PI / 2),
      p.machinedSteelMat,
    );
    fwdBarrel.position.set(dir * 0.56, -0.06, -1.65);

    const underTorpTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.05, 10).rotateX(Math.PI / 2),
      p.mats.darkGraphiteTrim,
    );
    underTorpTube.position.set(dir * 0.36, -0.32, -0.35);

    root.add(edgeLight, tailVane, fwdBarrel, underTorpTube);
  });

  // Central reinforced panoramic cockpit
  const interior = createCockpitInterior(
    p.mats.darkGraphiteTrim,
    p.anechoicRubberMat,
    cyanEmit,
  );
  interior.position.set(0, 0.24, -0.82);
  root.add(interior);

  const canopyGeo = new THREE.SphereGeometry(
    0.44,
    20,
    14,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.52,
  );
  canopyGeo.scale(0.76, 0.64, 2.0);
  const canopy = new THREE.Mesh(canopyGeo, p.mats.sapphireCanopy);
  canopy.position.set(0, 0.24, -0.8);
  canopy.renderOrder = 4;
  root.add(canopy);

  [-1.12, -0.68, -0.25].forEach((zPos, idx) => {
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(idx === 1 ? 0.33 : 0.29, 0.022, 8, 18, Math.PI),
      p.mats.darkGraphiteTrim,
    );
    arch.position.set(0, 0.23, zPos);
    root.add(arch);
  });

  // Two compact rear ion-cavitation propulsion engines
  [-0.46, 0.46].forEach((sideX) => {
    const nacelle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.27, 1.45, 16).rotateX(Math.PI / 2),
      p.mats.darkGraphiteTrim,
    );
    nacelle.position.set(sideX, -0.02, 0.98);
    root.add(nacelle);

    const fl = createRealisticThrusterAssembly(
      p.heatStainedNozzleMat,
      p.machinedSteelMat,
      0.86,
      0x38bdf8,
      0x0ea5e9,
      0x7dd3fc,
    );
    fl.root.position.set(sideX, -0.02, 1.78);
    root.add(fl.root);
    thrusters.push(fl);
  });

  return {
    id: 'vanguard_interceptor',
    root,
    wingSpanScale: 1.0,
    thrusters,
    animate: (elapsed, _dt, smoothThrottle, abilityActive) => {
      cyanEmit.emissiveIntensity =
        (abilityActive ? 3.2 : 1.7) +
        Math.sin(elapsed * 4.5) * 0.25 +
        (smoothThrottle - 1) * 0.6;
    },
  };
}

/**
 * SHIP 02 — MAELSTROM-XII (High-Speed Interceptor · Advanced)
 * Aggressive V-shaped dark gunmetal & crimson hull, extended angular side fins,
 * dual elongated engine nacelles with visible crimson energy coils, quad forward pulse cannons.
 */
export function createMaelstromXIIChassis(
  p: ShipMaterialPalette,
): ShipChassisBuild {
  const root = new THREE.Group();
  const thrusters: ThrusterFlameAssembly[] = [];
  const crimsonEmit = createAccentEmissiveMat(0xf43f5e, 2.1);
  const crimsonArmorMat = p.gunmetalMat.clone();
  crimsonArmorMat.color.setHex(0x6b1426);
  const energyCoils: THREE.Mesh[] = [];

  // Aggressive V-shaped swept main fuselage
  const vHullShape = new THREE.Shape();
  vHullShape.moveTo(0, -3.25);
  vHullShape.lineTo(0.75, -1.55);
  vHullShape.lineTo(1.55, 0.85);
  vHullShape.lineTo(1.05, 1.55);
  vHullShape.lineTo(0, 1.05);
  vHullShape.lineTo(-1.05, 1.55);
  vHullShape.lineTo(-1.55, 0.85);
  vHullShape.lineTo(-0.75, -1.55);
  vHullShape.closePath();

  const vHullGeo = new THREE.ExtrudeGeometry(vHullShape, {
    steps: 1,
    depth: 0.36,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  vHullGeo.rotateX(Math.PI / 2);
  const vHull = new THREE.Mesh(vHullGeo, p.gunmetalMat);
  vHull.position.set(0, 0.16, 0);
  vHull.castShadow = true;
  root.add(vHull);

  // Crimson beveled dorsal armor chevrons
  const chevronShape = new THREE.Shape();
  chevronShape.moveTo(0, -2.55);
  chevronShape.lineTo(0.55, -1.1);
  chevronShape.lineTo(0.92, 0.4);
  chevronShape.lineTo(0, 0.05);
  chevronShape.lineTo(-0.92, 0.4);
  chevronShape.lineTo(-0.55, -1.1);
  chevronShape.closePath();
  const chevGeo = new THREE.ExtrudeGeometry(chevronShape, {
    steps: 1,
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 1,
  });
  chevGeo.rotateX(Math.PI / 2);
  const chevMesh = new THREE.Mesh(chevGeo, crimsonArmorMat);
  chevMesh.position.set(0, 0.32, 0.05);
  root.add(chevMesh);

  // Extended angular side hydro-fins + crimson illuminated razor stripes
  const sideFinShape = new THREE.Shape();
  sideFinShape.moveTo(1.05, -0.8);
  sideFinShape.lineTo(2.95, -1.45);
  sideFinShape.lineTo(3.35, -0.35);
  sideFinShape.lineTo(2.45, 0.95);
  sideFinShape.lineTo(1.25, 0.72);
  sideFinShape.closePath();

  const sideFinGeo = new THREE.ExtrudeGeometry(sideFinShape, {
    steps: 1,
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
  });
  sideFinGeo.rotateX(Math.PI / 2);

  const rFin = new THREE.Mesh(sideFinGeo, p.gunmetalMat);
  rFin.position.set(0, 0.04, 0);
  const lFin = new THREE.Mesh(sideFinGeo, p.gunmetalMat);
  lFin.scale.set(-1, 1, 1);
  lFin.position.set(0, 0.04, 0);
  root.add(rFin, lFin);

  // Aggressive canopy with crimson armored spine bar
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)
      .scale(0.68, 0.56, 2.2),
    p.mats.sapphireCanopy,
  );
  canopy.position.set(0, 0.34, -0.98);
  canopy.renderOrder = 4;
  root.add(canopy);

  const canopySpine = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.05, 1.55),
    crimsonArmorMat,
  );
  canopySpine.position.set(0, 0.58, -0.98);
  root.add(canopySpine);

  // Dual elongated outboard engine nacelles with visible glowing energy coils + quad pulse cannons
  [-1, 1].forEach((dir) => {
    const nacelle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.34, 2.85, 16).rotateX(Math.PI / 2),
      p.mats.darkGraphiteTrim,
    );
    nacelle.position.set(dir * 1.24, 0.02, 0.45);
    root.add(nacelle);

    // 4 visible glowing rear energy coil rings per nacelle
    for (let c = 0; c < 4; c++) {
      const coil = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.032, 8, 16),
        crimsonEmit,
      );
      coil.position.set(dir * 1.24, 0.02, 0.65 + c * 0.3);
      root.add(coil);
      energyCoils.push(coil);
    }

    // Dual torpedo side rails
    const torpRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.14, 1.45),
      crimsonArmorMat,
    );
    torpRail.position.set(dir * 2.1, -0.06, -0.2);
    root.add(torpRail);

    // Quad rapid-fire forward pulse cannons (2 per side)
    [0.52, 0.92].forEach((offsetX, cIdx) => {
      const gun = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.065, 1.35, 10).rotateX(Math.PI / 2),
        p.machinedSteelMat,
      );
      gun.position.set(dir * offsetX, -0.04 - cIdx * 0.04, -1.85 - cIdx * 0.25);
      const glowTip = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.04, 0.28),
        crimsonEmit,
      );
      glowTip.position.set(dir * offsetX, 0.02 - cIdx * 0.04, -2.35 - cIdx * 0.25);
      root.add(gun, glowTip);
    });

    // Sharp crimson edge stripe along outer fin
    const finStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.045, 1.6),
      crimsonEmit,
    );
    finStripe.position.set(dir * 2.45, 0.05, -0.45);
    finStripe.rotation.y = dir * 0.62;
    root.add(finStripe);

    // Angled canted stabilizer rudder
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.85, 0.9),
      crimsonArmorMat,
    );
    fin.position.set(dir * 1.32, 0.52, 1.25);
    fin.rotation.z = dir * -0.42;
    root.add(fin);

    // Heavy crimson-amber thruster
    const fl = createRealisticThrusterAssembly(
      p.heatStainedNozzleMat,
      p.machinedSteelMat,
      1.04,
      0xf43f5e,
      0xf59e0b,
      0xfb7185,
    );
    fl.root.position.set(dir * 1.24, 0.02, 1.98);
    root.add(fl.root);
    thrusters.push(fl);
  });

  return {
    id: 'leviathan_assault',
    root,
    wingSpanScale: 1.15,
    thrusters,
    animate: (elapsed, _dt, smoothThrottle, abilityActive) => {
      const pulse = 1.8 + Math.sin(elapsed * 8.5) * 0.45 + (smoothThrottle - 1) * 1.1;
      crimsonEmit.emissiveIntensity = abilityActive ? pulse * 1.7 : pulse;
      energyCoils.forEach((coil, idx) => {
        const s = 1 + Math.sin(elapsed * 12 - idx * 0.9) * 0.045 * smoothThrottle;
        coil.scale.set(s, s, 1);
      });
    },
  };
}

/**
 * SHIP 03 — NAUTILUS-SPECTRE VII (Stealth Reconnaissance Vessel · Elite)
 * Low-profile manta/nautilus stealth hull, black abyssal ceramic, curved retractable stealth fins,
 * deep violet & turquoise illumination, rotating acoustic phased-array bar, silent propulsion.
 */
export function createNautilusSpectreVIIChassis(
  p: ShipMaterialPalette,
): ShipChassisBuild {
  const root = new THREE.Group();
  const thrusters: ThrusterFlameAssembly[] = [];
  const violetEmit = createAccentEmissiveMat(0x8b5cf6, 1.7);
  const tealEmit = createAccentEmissiveMat(0x2dd4bf, 1.5);

  // Low-profile wide manta/nautilus stealth hull
  const mantaShape = new THREE.Shape();
  mantaShape.moveTo(0, -3.15);
  mantaShape.lineTo(0.85, -1.95);
  mantaShape.lineTo(3.25, 0.25);
  mantaShape.lineTo(2.75, 1.38);
  mantaShape.lineTo(1.45, 0.96);
  mantaShape.lineTo(0.7, 1.68);
  mantaShape.lineTo(0, 1.32);
  mantaShape.lineTo(-0.7, 1.68);
  mantaShape.lineTo(-1.45, 0.96);
  mantaShape.lineTo(-2.75, 1.38);
  mantaShape.lineTo(-3.25, 0.25);
  mantaShape.lineTo(-0.85, -1.95);
  mantaShape.closePath();

  const bodyGeo = new THREE.ExtrudeGeometry(mantaShape, {
    steps: 1,
    depth: 0.2,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.12,
    bevelSegments: 2,
  });
  bodyGeo.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, p.abyssalCeramicMat);
  body.position.set(0, 0.08, 0);
  body.castShadow = true;
  root.add(body);

  // Curved nautilus-inspired dorsal carapace segments
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(
      new THREE.TorusGeometry(0.68 - i * 0.09, 0.06, 8, 18, Math.PI),
      p.abyssalCeramicMat,
    );
    seg.position.set(0, 0.16, -0.6 + i * 0.48);
    root.add(seg);
  }

  // Retractable curved stealth wingtip fins (animate inward during boost/Phantom Sonar)
  const stealthFins: THREE.Mesh[] = [];
  [-1, 1].forEach((dir) => {
    const wingBlade = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.045, 1.25),
      p.anechoicRubberMat,
    );
    wingBlade.position.set(dir * 2.85, 0.06, 0.72);
    wingBlade.rotation.y = dir * 0.32;
    wingBlade.rotation.z = dir * -0.18;
    root.add(wingBlade);
    stealthFins.push(wingBlade);

    // Deep violet & turquoise recessed light strips
    const vStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.035, 1.65),
      violetEmit,
    );
    vStrip.position.set(dir * 1.55, 0.14, 0.05);
    vStrip.rotation.y = dir * -0.68;

    const tStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.03, 0.85),
      tealEmit,
    );
    tStrip.position.set(dir * 0.55, 0.16, -1.65);
    tStrip.rotation.y = dir * -0.35;

    // Retractable silent sonic emitter vents (nearly flush)
    const emitterDoor = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.08, 0.65),
      p.machinedSteelMat,
    );
    emitterDoor.position.set(dir * 0.75, -0.1, -1.45);

    root.add(vStrip, tStrip, emitterDoor);
  });

  // Flush faceted stealth canopy
  const stealthCanopyGeo = new THREE.CylinderGeometry(0.2, 0.44, 1.45, 4);
  stealthCanopyGeo.rotateY(Math.PI / 4);
  stealthCanopyGeo.rotateX(-Math.PI / 2);
  stealthCanopyGeo.scale(1.1, 0.36, 1.0);
  const stealthCanopy = new THREE.Mesh(stealthCanopyGeo, p.mats.sapphireCanopy);
  stealthCanopy.position.set(0, 0.25, -0.92);
  stealthCanopy.renderOrder = 4;
  root.add(stealthCanopy);

  // Rotating dorsal sonar intelligence array
  const sonarBar = new THREE.Group();
  sonarBar.position.set(0, 0.44, 0.42);
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, 0.26, 8),
    p.machinedSteelMat,
  );
  mast.position.set(0, -0.12, 0);
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(1.58, 0.12, 0.28),
    p.abyssalCeramicMat,
  );
  const barEdge = new THREE.Mesh(
    new THREE.BoxGeometry(1.62, 0.04, 0.3),
    tealEmit,
  );
  sonarBar.add(mast, bar, barEdge);
  root.add(sonarBar);

  // Twin shrouded silent violet propulsion ports
  [-0.65, 0.65].forEach((sideX) => {
    const hood = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.07, 0.48),
      p.anechoicRubberMat,
    );
    hood.position.set(sideX, 0.22, 1.48);
    root.add(hood);

    const fl = createRealisticThrusterAssembly(
      p.heatStainedNozzleMat,
      p.machinedSteelMat,
      0.8,
      0x8b5cf6,
      0x2dd4bf,
      0xc084fc,
    );
    fl.root.position.set(sideX, -0.02, 1.62);
    root.add(fl.root);
    thrusters.push(fl);
  });

  return {
    id: 'echo_tactical',
    root,
    wingSpanScale: 1.08,
    thrusters,
    animate: (elapsed, dt, smoothThrottle, abilityActive) => {
      sonarBar.rotation.y += dt * (abilityActive ? 4.8 : 2.1) * smoothThrottle;
      const tuck = abilityActive || smoothThrottle > 1.35 ? 0.22 : 0.0;
      stealthFins[0].rotation.z = 0.18 + tuck;
      stealthFins[1].rotation.z = -0.18 - tuck;
      violetEmit.emissiveIntensity =
        (abilityActive ? 3.1 : 1.5) + Math.sin(elapsed * 5.0) * 0.25;
      tealEmit.emissiveIntensity =
        (abilityActive ? 2.8 : 1.35) + Math.cos(elapsed * 4.2) * 0.2;
    },
  };
}

/**
 * SHIP 04 — BATHYS-BASTION IV (Heavy Guardian · Advanced)
 * Huge broad hexagonal hull, heavy reinforced frontal armor, thick layered shoulder armor,
 * large spherical shield-generator domes, protected cockpit, 4 independent thruster units, amber & cyan lighting.
 */
export function createBathysBastionIVChassis(
  p: ShipMaterialPalette,
): ShipChassisBuild {
  const root = new THREE.Group();
  const thrusters: ThrusterFlameAssembly[] = [];
  const amberEmit = createAccentEmissiveMat(0xf59e0b, 1.9);
  const cyanEmit = createAccentEmissiveMat(0x38bdf8, 1.6);
  const shieldCoreRings: THREE.Mesh[] = [];

  // Broad hexagonal fortress hull
  const hexShape = new THREE.Shape();
  hexShape.moveTo(-1.1, -2.65);
  hexShape.lineTo(1.1, -2.65);
  hexShape.lineTo(2.45, -1.05);
  hexShape.lineTo(2.55, 0.95);
  hexShape.lineTo(1.35, 1.95);
  hexShape.lineTo(-1.35, 1.95);
  hexShape.lineTo(-2.55, 0.95);
  hexShape.lineTo(-2.45, -1.05);
  hexShape.closePath();

  const hexGeo = new THREE.ExtrudeGeometry(hexShape, {
    steps: 1,
    depth: 0.62,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.14,
    bevelSegments: 2,
  });
  hexGeo.rotateX(Math.PI / 2);
  const hexHull = new THREE.Mesh(hexGeo, p.guardianTungstenMat);
  hexHull.position.set(0, 0.32, 0);
  hexHull.castShadow = true;
  root.add(hexHull);

  // Heavy reinforced frontal ramming bumper & layered armor prow
  const frontalArmor = new THREE.Mesh(
    new THREE.BoxGeometry(2.55, 0.72, 0.56),
    p.mats.darkGraphiteTrim,
  );
  frontalArmor.position.set(0, 0.02, -2.72);
  root.add(frontalArmor);

  [-0.95, 0.95].forEach((fx) => {
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.14, 0.1),
      amberEmit,
    );
    lamp.position.set(fx, 0.12, -3.0);
    root.add(lamp);
  });

  // Large protected armored bathyscaphe cockpit + steel roll-cage arches
  const cabinSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.68, 22, 16),
    p.machinedSteelMat,
  );
  cabinSphere.position.set(0, 0.36, -1.15);
  root.add(cabinSphere);

  const viewport = new THREE.Mesh(
    new THREE.SphereGeometry(0.48, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.45),
    p.mats.sapphireCanopy,
  );
  viewport.rotation.x = -Math.PI * 0.36;
  viewport.position.set(0, 0.46, -1.42);
  viewport.renderOrder = 4;
  root.add(viewport);

  for (let b = -1; b <= 1; b++) {
    const cageArch = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.04, 8, 18, Math.PI),
      p.mats.darkGraphiteTrim,
    );
    cageArch.position.set(0, 0.34, -1.12 + b * 0.28);
    root.add(cageArch);
  }

  // Twin thick layered angular shoulder armor & large shield-generator structures
  [-1.78, 1.78].forEach((sideX) => {
    const shoulder = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.68, 2.45),
      p.guardianTungstenMat,
    );
    shoulder.position.set(sideX, 0.22, -0.05);
    shoulder.rotation.z = sideX < 0 ? 0.18 : -0.18;
    root.add(shoulder);

    // Layered ERA armor blocks along shoulder flanks
    for (let pIdx = 0; pIdx < 4; pIdx++) {
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.44, 0.48),
        p.mats.darkGraphiteTrim,
      );
      plate.position.set(sideX + (sideX < 0 ? -0.62 : 0.62), 0.14, -0.85 + pIdx * 0.56);
      root.add(plate);
    }

    // Large Shield-Generator Structure (glowing cyan sphere inside armored bronze emitter cage)
    const genPod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.52, 0.36, 14),
      p.navalBronzeMat,
    );
    genPod.position.set(sideX * 0.85, 0.64, 0.25);

    const genCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 14, 14),
      cyanEmit,
    );
    genCore.position.set(sideX * 0.85, 0.82, 0.25);

    const genRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.44, 0.04, 8, 20),
      amberEmit,
    );
    genRing.rotation.x = Math.PI / 2;
    genRing.position.set(sideX * 0.85, 0.82, 0.25);
    shieldCoreRings.push(genRing);

    root.add(genPod, genCore, genRing);
  });

  // 4 independent heavy hydro propulsion units
  const quadCoords = [
    [-1.88, 0.04, 1.72, 0.92],
    [-0.78, 0.06, 2.02, 1.05],
    [0.78, 0.06, 2.02, 1.05],
    [1.88, 0.04, 1.72, 0.92],
  ];
  quadCoords.forEach(([x, y, z, sc]) => {
    const fl = createRealisticThrusterAssembly(
      p.heatStainedNozzleMat,
      p.machinedSteelMat,
      sc,
      0x0ea5e9,
      0xf59e0b,
      0xfbbf24,
    );
    fl.root.position.set(x, y, z);
    root.add(fl.root);
    thrusters.push(fl);
  });

  return {
    id: 'aegis_guardian',
    root,
    wingSpanScale: 1.22,
    thrusters,
    animate: (elapsed, dt, smoothThrottle, abilityActive) => {
      shieldCoreRings.forEach((ring, idx) => {
        ring.rotation.z += dt * (abilityActive ? 5.5 : 1.8) * (idx === 0 ? 1 : -1);
      });
      cyanEmit.emissiveIntensity =
        (abilityActive ? 3.5 : 1.65) + Math.sin(elapsed * 4.0) * 0.25;
      amberEmit.emissiveIntensity =
        (abilityActive ? 2.9 : 1.75) + (smoothThrottle - 1) * 0.5;
    },
  };
}
