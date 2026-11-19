import * as THREE from 'three';
import {
  ShipChassisBuild,
  ShipMaterialPalette,
  ThrusterFlameAssembly,
  createAccentEmissiveMat,
  createRealisticThrusterAssembly,
} from './shipTypes';

/**
 * SHIP 05 — ABYSSAL TALON (Predator Hunter · Rare)
 * Predatory shark-inspired bio-mechanical reverse-delta hull, split twin-prong fang nose,
 * swept dorsal shark fin, glowing lime-emerald core veins, dual angled vector thrusters.
 */
export function createAbyssalTalonChassis(
  p: ShipMaterialPalette,
): ShipChassisBuild {
  const root = new THREE.Group();
  const thrusters: ThrusterFlameAssembly[] = [];
  const limeEmit = createAccentEmissiveMat(0x84cc16, 2.0);
  const emeraldEmit = createAccentEmissiveMat(0x10b981, 1.7);

  // Sculpted predatory spine fuselage
  const bodyPoints = [
    new THREE.Vector2(0.01, -2.1),
    new THREE.Vector2(0.32, -1.7),
    new THREE.Vector2(0.56, -0.7),
    new THREE.Vector2(0.62, 0.35),
    new THREE.Vector2(0.45, 1.35),
    new THREE.Vector2(0.14, 1.95),
  ];
  const bodyGeo = new THREE.LatheGeometry(bodyPoints, 22);
  bodyGeo.rotateX(Math.PI / 2);
  bodyGeo.scale(1.12, 0.62, 1.0);
  const body = new THREE.Mesh(bodyGeo, p.teakTealMat);
  body.castShadow = true;
  root.add(body);

  // Split twin-prong predatory fang nose (signature silhouette!)
  [-1, 1].forEach((dir) => {
    const fangShape = new THREE.Shape();
    fangShape.moveTo(0.18, -1.45);
    fangShape.lineTo(0.65, -2.55);
    fangShape.lineTo(0.32, -3.58);
    fangShape.lineTo(0.14, -2.65);
    fangShape.closePath();

    const fangGeo = new THREE.ExtrudeGeometry(fangShape, {
      steps: 1,
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
    });
    fangGeo.rotateX(Math.PI / 2);
    const fang = new THREE.Mesh(fangGeo, p.gunmetalMat);
    if (dir < 0) fang.scale.set(-1, 1, 1);
    fang.position.set(0, 0.08, 0);
    root.add(fang);

    // Lime-emerald bio-vein along each forward prong
    const fangVein = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 1.55),
      limeEmit,
    );
    fangVein.position.set(dir * 0.38, 0.12, -2.55);
    fangVein.rotation.y = dir * 0.18;
    root.add(fangVein);

    // Reverse-delta forward-swept razor predator wings
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0.48, 0.45);
    wingShape.lineTo(2.95, -0.88);
    wingShape.lineTo(2.75, -0.05);
    wingShape.lineTo(1.35, 0.95);
    wingShape.lineTo(0.48, 1.25);
    wingShape.closePath();
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
      steps: 1,
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 1,
    });
    wingGeo.rotateX(Math.PI / 2);
    const wing = new THREE.Mesh(wingGeo, p.teakTealMat);
    if (dir < 0) wing.scale.set(-1, 1, 1);
    wing.position.set(0, 0.02, 0);
    root.add(wing);

    // Gill vent ribs along flanks
    for (let g = 0; g < 3; g++) {
      const gill = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.18, 0.12),
        emeraldEmit,
      );
      gill.position.set(dir * 0.64, 0.06, -0.45 + g * 0.28);
      gill.rotation.y = dir * 0.35;
      root.add(gill);
    }

    // Fang cannons nested inside the forward split mandibles
    const gun = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.06, 1.45, 10).rotateX(Math.PI / 2),
      p.machinedSteelMat,
    );
    gun.position.set(dir * 0.36, -0.08, -2.25);
    root.add(gun);
  });

  // Swept predatory dorsal shark fin + spine glowing vein
  const dorsalFinShape = new THREE.Shape();
  dorsalFinShape.moveTo(-0.4, 0);
  dorsalFinShape.lineTo(0.85, 0);
  dorsalFinShape.lineTo(1.25, 1.05);
  dorsalFinShape.lineTo(0.45, 0.92);
  dorsalFinShape.closePath();
  const dorsalGeo = new THREE.ExtrudeGeometry(dorsalFinShape, {
    steps: 1,
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
  });
  dorsalGeo.rotateY(Math.PI / 2);
  const dorsalFin = new THREE.Mesh(dorsalGeo, p.gunmetalMat);
  dorsalFin.position.set(-0.03, 0.24, 0.35);
  root.add(dorsalFin);

  const spineVein = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.06, 1.85),
    limeEmit,
  );
  spineVein.position.set(0, 0.34, 0.22);
  root.add(spineVein);

  // Sleek armored slit canopy
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)
      .scale(0.68, 0.52, 2.0),
    p.mats.sapphireCanopy,
  );
  canopy.position.set(0, 0.3, -0.92);
  canopy.renderOrder = 4;
  root.add(canopy);

  // Dual angled vector thrusters
  [-0.64, 0.64].forEach((sideX) => {
    const pod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.28, 1.35, 14).rotateX(Math.PI / 2),
      p.mats.darkGraphiteTrim,
    );
    pod.position.set(sideX, -0.02, 1.15);
    root.add(pod);

    const fl = createRealisticThrusterAssembly(
      p.heatStainedNozzleMat,
      p.machinedSteelMat,
      0.95,
      0x84cc16,
      0x10b981,
      0xbef264,
    );
    fl.root.position.set(sideX, -0.02, 1.88);
    fl.root.rotation.y = sideX < 0 ? 0.05 : -0.05;
    root.add(fl.root);
    thrusters.push(fl);
  });

  // High-RPM Emerald Centrifuge Reactor Core along central dorsal spine
  const talonReactorCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22, 1),
    limeEmit,
  );
  talonReactorCore.position.set(0, 0.34, -0.12);
  const talonReactorRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.03, 8, 20),
    emeraldEmit,
  );
  talonReactorRing.rotation.x = Math.PI / 2;
  talonReactorRing.position.set(0, 0.34, -0.12);
  root.add(talonReactorCore, talonReactorRing);

  return {
    id: 'abyssal_talon',
    root,
    wingSpanScale: 1.14,
    thrusters,
    animate: (elapsed, dt, smoothThrottle, abilityActive) => {
      talonReactorCore.rotation.y += dt * (abilityActive ? 6.5 : 2.6) * smoothThrottle;
      talonReactorRing.rotation.z -= dt * (abilityActive ? 5.2 : 2.1) * smoothThrottle;
      const pVal =
        (abilityActive ? 3.2 : 1.75) +
        Math.sin(elapsed * 6.5) * 0.35 +
        (smoothThrottle - 1) * 0.65;
      limeEmit.emissiveIntensity = pVal;
      emeraldEmit.emissiveIntensity = pVal * 0.85;
    },
  };
}

/**
 * SHIP 06 — TEMPEST CORSAIR (Electromagnetic Assault Vessel · Epic)
 * Sleek silver-titanium & deep-navy hull framed by dual curved electromagnetic bow arc coils,
 * blue-violet plasma vents, rotating storm capacitor, twin high-output ion engines.
 */
export function createTempestCorsairChassis(
  p: ShipMaterialPalette,
): ShipChassisBuild {
  const root = new THREE.Group();
  const thrusters: ThrusterFlameAssembly[] = [];
  const arcBlueEmit = createAccentEmissiveMat(0x60a5fa, 2.2);
  const indigoEmit = createAccentEmissiveMat(0x818cf8, 1.9);

  // Silver-titanium sculpted main hull over deep-navy keel
  const hullGeo = new THREE.CapsuleGeometry(0.58, 2.65, 14, 22).rotateX(
    Math.PI / 2,
  );
  hullGeo.scale(1.18, 0.56, 1.0);
  const hull = new THREE.Mesh(hullGeo, p.whiteTitaniumMat);
  hull.castShadow = true;
  root.add(hull);

  const navyKeel = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.24, 2.95),
    p.deepNavyMat,
  );
  navyKeel.position.set(0, -0.22, 0);
  root.add(navyKeel);

  // Forward armored bow spike & rotating storm capacitor sphere
  const bowSpike = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 1.15, 8).rotateX(-Math.PI / 2),
    p.deepNavyMat,
  );
  bowSpike.position.set(0, 0, -2.55);
  root.add(bowSpike);

  const stormCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.28, 1),
    arcBlueEmit,
  );
  stormCore.position.set(0, 0.42, 0.35);
  const stormRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.04, 8, 20),
    indigoEmit,
  );
  stormRing.position.set(0, 0.42, 0.35);
  root.add(stormCore, stormRing);

  // Dual Signature Curved Electromagnetic Bow Arc Coils (Catamaran forward pincers!)
  [-1, 1].forEach((dir) => {
    const arcCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(dir * 0.92, 0.02, 0.45),
      new THREE.Vector3(dir * 1.48, 0.06, -0.95),
      new THREE.Vector3(dir * 1.18, 0.04, -2.35),
      new THREE.Vector3(dir * 0.52, 0.02, -3.12),
    ]);
    const arcPylon = new THREE.Mesh(
      new THREE.TubeGeometry(arcCurve, 18, 0.13, 10, false),
      p.deepNavyMat,
    );
    root.add(arcPylon);

    // 4 Glowing electromagnetic coil rings threaded along each bow arc
    [0.25, 0.48, 0.7, 0.9].forEach((t) => {
      const pt = arcCurve.getPoint(t);
      const tangent = arcCurve.getTangent(t);
      const coilRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.032, 8, 16),
        arcBlueEmit,
      );
      coilRing.position.copy(pt);
      coilRing.lookAt(pt.clone().add(tangent));
      root.add(coilRing);
    });

    // Swept midship hydrofoil wings with blue-violet plasma vents
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 0.09, 1.15),
      p.whiteTitaniumMat,
    );
    wing.position.set(dir * 1.75, 0.02, 0.42);
    wing.rotation.y = dir * 0.36;

    const plasmaVent = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.12, 0.95),
      indigoEmit,
    );
    plasmaVent.position.set(dir * 1.32, 0.14, 0.45);

    const stabilizer = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.72, 0.85),
      p.deepNavyMat,
    );
    stabilizer.position.set(dir * 2.38, 0.34, 0.65);
    stabilizer.rotation.z = dir * -0.25;

    root.add(wing, plasmaVent, stabilizer);
  });

  // Armored glass canopy
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)
      .scale(0.76, 0.6, 1.9),
    p.mats.sapphireCanopy,
  );
  canopy.position.set(0, 0.28, -0.82);
  canopy.renderOrder = 4;
  root.add(canopy);

  // Twin high-output electromagnetic ion engines
  [-0.68, 0.68].forEach((sideX) => {
    const fl = createRealisticThrusterAssembly(
      p.heatStainedNozzleMat,
      p.machinedSteelMat,
      1.02,
      0x60a5fa,
      0x818cf8,
      0x93c5fd,
    );
    fl.root.position.set(sideX, -0.02, 1.78);
    root.add(fl.root);
    thrusters.push(fl);
  });

  return {
    id: 'tempest_corsair',
    root,
    wingSpanScale: 1.18,
    thrusters,
    animate: (elapsed, dt, smoothThrottle, abilityActive) => {
      stormCore.rotation.y += dt * (abilityActive ? 8.5 : 2.8);
      stormRing.rotation.x += dt * (abilityActive ? 6.2 : 2.1);
      stormRing.rotation.z += dt * 1.6;
      const charge =
        (abilityActive ? 3.8 : 2.0) +
        Math.sin(elapsed * 10.0) * 0.4 +
        (smoothThrottle - 1) * 0.7;
      arcBlueEmit.emissiveIntensity = charge;
      indigoEmit.emissiveIntensity = charge * 0.9;
    },
  };
}

/**
 * SHIP 07 — RIFT MANTA (Phase Interceptor · Epic)
 * Ultra-wide curved manta-ray wing silhouette in pearlescent dark teal & violet,
 * twin suspended wingtip thruster pods, crystal canopy, flowing ribbon stabilizers.
 */
export function createRiftMantaChassis(
  p: ShipMaterialPalette,
): ShipChassisBuild {
  const root = new THREE.Group();
  const thrusters: ThrusterFlameAssembly[] = [];
  const tealEmit = createAccentEmissiveMat(0x2dd4bf, 2.0);
  const violetEmit = createAccentEmissiveMat(0xc084fc, 1.85);
  const phaseWings: THREE.Mesh[] = [];

  // Sweeping organic-tech manta ray fuselage & wing profile
  const mantaSpan = new THREE.Shape();
  mantaSpan.moveTo(0, -2.55);
  mantaSpan.bezierCurveTo(0.85, -2.15, 2.05, -1.25, 3.85, 0.35);
  mantaSpan.bezierCurveTo(3.45, 0.92, 2.15, 0.85, 1.15, 1.35);
  mantaSpan.lineTo(0.45, 1.95);
  mantaSpan.lineTo(0, 1.45);
  mantaSpan.lineTo(-0.45, 1.95);
  mantaSpan.lineTo(-1.15, 1.35);
  mantaSpan.bezierCurveTo(-2.15, 0.85, -3.45, 0.92, -3.85, 0.35);
  mantaSpan.bezierCurveTo(-2.05, -1.25, -0.85, -2.15, 0, -2.55);
  mantaSpan.closePath();

  const mantaGeo = new THREE.ExtrudeGeometry(mantaSpan, {
    steps: 1,
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.09,
    bevelSegments: 3,
  });
  mantaGeo.rotateX(Math.PI / 2);
  const mantaBody = new THREE.Mesh(mantaGeo, p.teakTealMat);
  mantaBody.position.set(0, 0.06, 0);
  mantaBody.castShadow = true;
  root.add(mantaBody);

  // Dorsal violet-phase spine crest + flush crystal canopy
  const dorsalSpine = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.36, 1.95, 10, 16).rotateX(Math.PI / 2),
    p.abyssalCeramicMat,
  );
  dorsalSpine.scale.set(1.0, 0.55, 1.0);
  dorsalSpine.position.set(0, 0.16, -0.15);
  root.add(dorsalSpine);

  const crystalCanopy = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.42, 1).scale(0.82, 0.45, 2.2),
    p.mats.sapphireCanopy,
  );
  crystalCanopy.position.set(0, 0.28, -0.88);
  crystalCanopy.renderOrder = 4;
  root.add(crystalCanopy);

  // Twin Suspended Outboard Wingtip Thruster Pods + Flowing Ribbon Stabilizers
  [-1, 1].forEach((dir) => {
    // Wingtip pylon mount
    const pylon = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.32, 1.25),
      p.machinedSteelMat,
    );
    pylon.position.set(dir * 3.15, -0.04, 0.45);
    root.add(pylon);

    // Suspended wingtip nacelle pod
    const pod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.25, 1.55, 16).rotateX(Math.PI / 2),
      p.abyssalCeramicMat,
    );
    pod.position.set(dir * 3.15, -0.18, 0.48);
    root.add(pod);

    // Glowing teal-violet phase strips curving across the wide manta wings
    const ribbon = new THREE.Mesh(
      new THREE.BoxGeometry(1.95, 0.035, 0.07),
      tealEmit,
    );
    ribbon.position.set(dir * 1.85, 0.14, -0.18);
    ribbon.rotation.y = dir * 0.42;
    root.add(ribbon);
    phaseWings.push(ribbon);

    // Trailing flexible whip-like tail ribbon fins
    const whipCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(dir * 1.05, 0.02, 1.32),
      new THREE.Vector3(dir * 1.28, 0.06, 2.05),
      new THREE.Vector3(dir * 1.12, 0.0, 2.85),
    ]);
    const whip = new THREE.Mesh(
      new THREE.TubeGeometry(whipCurve, 12, 0.038, 6, false),
      violetEmit,
    );
    root.add(whip);

    // Wingtip thruster assembly
    const tipFl = createRealisticThrusterAssembly(
      p.heatStainedNozzleMat,
      p.machinedSteelMat,
      0.86,
      0x2dd4bf,
      0xc084fc,
      0x5eead4,
    );
    tipFl.root.position.set(dir * 3.15, -0.18, 1.32);
    root.add(tipFl.root);
    thrusters.push(tipFl);
  });

  // Central micro booster thruster for extra phase burst
  const centerFl = createRealisticThrusterAssembly(
    p.heatStainedNozzleMat,
    p.machinedSteelMat,
    0.8,
    0xc084fc,
    0x2dd4bf,
    0xf5d0fe,
  );
  centerFl.root.position.set(0, 0.02, 1.72);
  root.add(centerFl.root);
  thrusters.push(centerFl);

  // Dorsal Singularity Phase Reactor Lens at central manta disc
  const mantaReactorCore = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.24, 1),
    violetEmit,
  );
  mantaReactorCore.position.set(0, 0.3, 0.22);
  const mantaReactorRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.032, 8, 24),
    tealEmit,
  );
  mantaReactorRing.rotation.x = Math.PI / 2;
  mantaReactorRing.position.set(0, 0.3, 0.22);
  root.add(mantaReactorCore, mantaReactorRing);

  return {
    id: 'rift_manta',
    root,
    wingSpanScale: 1.34,
    thrusters,
    animate: (elapsed, dt, smoothThrottle, abilityActive) => {
      mantaReactorCore.rotation.y += dt * (abilityActive ? 6.2 : 2.4);
      mantaReactorRing.rotation.z -= dt * (abilityActive ? 5.4 : 2.0);
      const shimmer =
        (abilityActive ? 3.5 : 1.7) +
        Math.sin(elapsed * 7.0) * 0.35 +
        (smoothThrottle - 1) * 0.6;
      tealEmit.emissiveIntensity = shimmer;
      violetEmit.emissiveIntensity = shimmer * 0.95;
      phaseWings.forEach((pw, idx) => {
        pw.position.y = 0.14 + Math.sin(elapsed * 5 + idx * 1.5) * 0.02;
      });
    },
  };
}

/**
 * SHIP 08 — LEVIATHAN BREAKER (Siege Battleship · Legendary)
 * Massive angular titanium siege wedge with central recessed dorsal railgun trench,
 * hydraulic stabilizer arms, twin armored bridge pods, amber floodlamps, triple heavy thrusters.
 */
export function createLeviathanBreakerChassis(
  p: ShipMaterialPalette,
): ShipChassisBuild {
  const root = new THREE.Group();
  const thrusters: ThrusterFlameAssembly[] = [];
  const siegeOrangeEmit = createAccentEmissiveMat(0xf97316, 2.2);
  const floodAmberEmit = createAccentEmissiveMat(0xfbbf24, 2.4);

  // Left & Right Heavy Siege Wedge Prow Halves (leaving a dramatic central recessed Railgun Trench!)
  [-1, 1].forEach((dir) => {
    const wedgeHalf = new THREE.Mesh(
      new THREE.BoxGeometry(1.12, 0.72, 4.35),
      p.gunmetalMat,
    );
    wedgeHalf.position.set(dir * 0.98, 0.02, -0.35);
    wedgeHalf.rotation.y = dir * 0.14;
    wedgeHalf.castShadow = true;
    root.add(wedgeHalf);

    // Armored prow chisel plate & amber floodlamp
    const chisel = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.56, 0.65),
      p.mats.darkGraphiteTrim,
    );
    chisel.position.set(dir * 0.68, -0.02, -2.65);
    chisel.rotation.y = dir * 0.32;

    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.16, 0.1),
      floodAmberEmit,
    );
    lamp.position.set(dir * 0.72, 0.14, -2.92);

    // Twin offset armored bridge pods on upper deck
    const bridgePod = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.42, 1.35),
      p.guardianTungstenMat,
    );
    bridgePod.position.set(dir * 1.02, 0.52, -0.45);
    const bridgeSlit = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.12, 0.12),
      p.mats.sapphireCanopy,
    );
    bridgeSlit.position.set(dir * 1.02, 0.56, -1.12);

    // Heavy lateral hydraulic stabilizer arms & breacher salvo pods
    const armStrut = new THREE.Mesh(
      new THREE.BoxGeometry(1.42, 0.26, 0.68),
      p.navalBronzeMat,
    );
    armStrut.position.set(dir * 2.05, -0.06, 0.45);

    const outriggerPod = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.52, 2.35),
      p.gunmetalMat,
    );
    outriggerPod.position.set(dir * 2.65, -0.02, 0.42);

    const sideStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.1, 1.95),
      siegeOrangeEmit,
    );
    sideStrip.position.set(dir * 2.96, 0.06, 0.42);

    root.add(chisel, lamp, bridgePod, bridgeSlit, armStrut, outriggerPod, sideStrip);
  });

  // Central Recessed Spinal Siege Railgun Trench + Twin Massive Electromagnetic Siege Barrels
  const trenchFloor = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.36, 3.85),
    p.mats.darkGraphiteTrim,
  );
  trenchFloor.position.set(0, -0.14, -0.15);
  root.add(trenchFloor);

  [-0.2, 0.2].forEach((rx) => {
    const railBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.13, 3.45, 12).rotateX(Math.PI / 2),
      p.machinedSteelMat,
    );
    railBarrel.position.set(rx, 0.18, -1.35);

    const coilGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.08, 2.6),
      siegeOrangeEmit,
    );
    coilGlow.position.set(rx, 0.24, -1.25);

    root.add(railBarrel, coilGlow);
  });

  // Heavy rear reactor bulkhead
  const aftBlock = new THREE.Mesh(
    new THREE.BoxGeometry(2.65, 0.78, 1.15),
    p.mats.darkGraphiteTrim,
  );
  aftBlock.position.set(0, 0.06, 1.38);
  root.add(aftBlock);

  // Triple Massive Molten Orange-Red Thermal Lance Thrusters
  [
    [-1.42, 0.0, 2.02, 0.98],
    [0, 0.08, 2.12, 1.24],
    [1.42, 0.0, 2.02, 0.98],
  ].forEach(([x, y, z, sc]) => {
    const fl = createRealisticThrusterAssembly(
      p.heatStainedNozzleMat,
      p.machinedSteelMat,
      sc,
      0xf97316,
      0xef4444,
      0xfdba74,
    );
    fl.root.position.set(x, y, z);
    root.add(fl.root);
    thrusters.push(fl);
  });

  // Exposed Molten-Orange Siege Capacitor Reactor Core nested ahead of aft bulkhead
  const siegeReactorCradle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.48, 0.22, 12),
    p.navalBronzeMat,
  );
  siegeReactorCradle.position.set(0, 0.42, 0.72);
  const siegeReactorCore = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.28, 1),
    siegeOrangeEmit,
  );
  siegeReactorCore.position.set(0, 0.56, 0.72);
  const siegeReactorRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.038, 8, 22),
    floodAmberEmit,
  );
  siegeReactorRing.rotation.x = Math.PI / 2;
  siegeReactorRing.position.set(0, 0.56, 0.72);
  root.add(siegeReactorCradle, siegeReactorCore, siegeReactorRing);

  return {
    id: 'leviathan_breaker',
    root,
    wingSpanScale: 1.26,
    thrusters,
    animate: (elapsed, dt, smoothThrottle, abilityActive) => {
      siegeReactorCore.rotation.y += dt * (abilityActive ? 5.8 : 2.2) * smoothThrottle;
      siegeReactorRing.rotation.z -= dt * (abilityActive ? 4.6 : 1.8) * smoothThrottle;
      const pulse =
        (abilityActive ? 3.8 : 2.1) +
        Math.sin(elapsed * 6.0) * 0.35 +
        (smoothThrottle - 1) * 0.7;
      siegeOrangeEmit.emissiveIntensity = pulse;
      floodAmberEmit.emissiveIntensity = 2.0 + Math.sin(elapsed * 3.2) * 0.2;
    },
  };
}
