import * as THREE from 'three';
import { createEnemyMesh, type MaterialBank } from './models';

interface HangarLife {
  update: (time: number, dt: number, visible: boolean) => void;
  dispose: () => void;
}

interface CrewRig {
  group: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  head: THREE.Group;
  phase: number;
  speed: number;
}

function makeFishGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0.52, 0);
  shape.quadraticCurveTo(0.12, 0.23, -0.28, 0.08);
  shape.lineTo(-0.48, 0.2);
  shape.lineTo(-0.4, 0);
  shape.lineTo(-0.48, -0.2);
  shape.lineTo(-0.28, -0.08);
  shape.quadraticCurveTo(0.12, -0.23, 0.52, 0);
  const geometry = new THREE.ShapeGeometry(shape, 8);
  geometry.computeVertexNormals();
  return geometry;
}

function makeFlukeGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(-0.65, 0.2, -1.1, 0.78);
  shape.quadraticCurveTo(-0.25, 0.67, 0, 0.32);
  shape.quadraticCurveTo(0.25, 0.67, 1.1, 0.78);
  shape.quadraticCurveTo(0.65, 0.2, 0, 0);
  return new THREE.ExtrudeGeometry(shape, { depth: 0.13, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.04, bevelThickness: 0.04 });
}

function createCrewRig(
  materials: { hull: THREE.MeshStandardMaterial; joint: THREE.MeshStandardMaterial; visor: THREE.MeshStandardMaterial; glow: THREE.MeshBasicMaterial },
  phase: number,
  speed: number,
): CrewRig {
  const group = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.22), materials.hull);
  torso.position.y = 0.82;
  torso.castShadow = true;
  group.add(torso);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.04), materials.glow);
  chest.position.set(0, 0.88, 0.125);
  group.add(chest);

  const head = new THREE.Group();
  head.position.set(0, 1.12, 0);
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.2, 0.22), materials.hull);
  head.add(helmet);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.065, 0.025), materials.visor);
  face.position.set(0, 0.015, 0.12);
  head.add(face);
  group.add(head);

  const makeLimb = (x: number, y: number, length: number, width: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const segment = new THREE.Mesh(new THREE.BoxGeometry(width, length, width), materials.hull);
    segment.position.y = -length * 0.5;
    pivot.add(segment);
    const joint = new THREE.Mesh(new THREE.SphereGeometry(width * 0.64, 8, 6), materials.joint);
    joint.position.y = -length;
    pivot.add(joint);
    const lower = new THREE.Mesh(new THREE.BoxGeometry(width * 0.78, length * 0.82, width * 0.78), materials.hull);
    lower.position.y = -length * 1.38;
    pivot.add(lower);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(width * 1.5, width * 0.5, width * 2), materials.joint);
    foot.position.set(0, -length * 1.8, width * 0.35);
    pivot.add(foot);
    group.add(pivot);
    return pivot;
  };

  const leftArm = makeLimb(-0.23, 0.98, 0.22, 0.085);
  const rightArm = makeLimb(0.23, 0.98, 0.22, 0.085);
  const leftLeg = makeLimb(-0.09, 0.61, 0.28, 0.095);
  const rightLeg = makeLimb(0.09, 0.61, 0.28, 0.095);
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.15), materials.joint);
  backpack.position.set(0, 0.84, -0.16);
  group.add(backpack);

  return { group, leftLeg, rightLeg, leftArm, rightArm, head, phase, speed };
}

export function createHangarLife(
  scene: THREE.Scene,
  mats: MaterialBank,
  shipModel: THREE.Group,
): HangarLife {
  const ownedGeometries: THREE.BufferGeometry[] = [];
  const ownedMaterials: THREE.Material[] = [];
  const registerGeometry = <T extends THREE.BufferGeometry>(geometry: T): T => {
    ownedGeometries.push(geometry);
    return geometry;
  };
  const registerMaterial = <T extends THREE.Material>(material: T): T => {
    ownedMaterials.push(material);
    return material;
  };

  const root = new THREE.Group();
  root.name = 'animated-hangar-life';
  scene.add(root);

  const architecture = new THREE.Group();
  architecture.name = 'submerged-glass-hangar';
  root.add(architecture);

  const domeCenter = new THREE.Vector3(0, -4, -10);
  const domeRadius = 27;
  const domeGlass = registerMaterial(new THREE.MeshPhysicalMaterial({
    color: 0x1a8ac0,
    emissive: 0x062744,
    emissiveIntensity: 0.65,
    roughness: 0.18,
    metalness: 0.12,
    transparent: true,
    opacity: 0.045,
    side: THREE.BackSide,
    depthWrite: false,
  }));
  const dome = new THREE.Mesh(
    registerGeometry(new THREE.SphereGeometry(domeRadius, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2)),
    domeGlass,
  );
  dome.position.copy(domeCenter);
  architecture.add(dome);

  const ribMaterial = registerMaterial(new THREE.MeshStandardMaterial({
    color: 0x183b59,
    emissive: 0x073a62,
    emissiveIntensity: 0.8,
    metalness: 0.78,
    roughness: 0.28,
  }));
  const ribGlowMaterial = registerMaterial(new THREE.MeshBasicMaterial({
    color: 0x24baf4,
    transparent: true,
    opacity: 0.58,
  }));
  const domeRibs: THREE.Mesh[] = [];
  const domeAccents: THREE.Mesh[] = [];
  for (let ribIndex = 0; ribIndex < 10; ribIndex++) {
    const azimuth = (ribIndex / 10) * Math.PI * 2;
    const ribPoints = Array.from({ length: 25 }, (_, pointIndex) => {
      const theta = (pointIndex / 24) * Math.PI * 0.5;
      const radial = domeRadius * Math.sin(theta);
      return new THREE.Vector3(
        domeCenter.x + Math.sin(azimuth) * radial,
        domeCenter.y + domeRadius * Math.cos(theta),
        domeCenter.z + Math.cos(azimuth) * radial,
      );
    });
    const ribCurve = new THREE.CatmullRomCurve3(ribPoints);
    const rib = new THREE.Mesh(
      registerGeometry(new THREE.TubeGeometry(ribCurve, 40, ribIndex % 2 === 0 ? 0.2 : 0.12, 6, false)),
      ribMaterial,
    );
    rib.name = `dome-support-${ribIndex + 1}`;
    architecture.add(rib);
    domeRibs.push(rib);

    if (ribIndex % 2 === 0) {
      const accent = new THREE.Mesh(
        registerGeometry(new THREE.TubeGeometry(ribCurve, 40, 0.028, 5, false)),
        ribGlowMaterial,
      );
      accent.name = `dome-light-strip-${ribIndex + 1}`;
      architecture.add(accent);
      domeAccents.push(accent);
    }
  }

  const domeRings: THREE.Mesh[] = [];
  [0.38, 0.68, 0.91].forEach((latitude, index) => {
    const ring = new THREE.Mesh(
      registerGeometry(new THREE.TorusGeometry(domeRadius * latitude, index === 2 ? 0.2 : 0.11, 7, 128)),
      ribMaterial,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(domeCenter.x, domeCenter.y + Math.sqrt(1 - latitude * latitude) * domeRadius, domeCenter.z);
    ring.userData.baseY = ring.position.y;
    ring.name = `dome-crossbeam-${index + 1}`;
    architecture.add(ring);
    domeRings.push(ring);
  });

  const dockedShips = [-1, 1].map((side, index) => {
    const ship = shipModel.clone(true);
    ship.name = `docked-vanguard-escort-${index + 1}`;
    ship.scale.setScalar(0.38);
    ship.position.set(side * 7.3, -1.15, -1.8 - index * 1.1);
    root.add(ship);
    return { ship, side, phase: index * Math.PI };
  });

  const fishGeo = registerGeometry(makeFishGeometry());
  const fishMat = registerMaterial(new THREE.MeshStandardMaterial({ color: 0x9cecff, emissive: 0x1686b0, emissiveIntensity: 0.65, metalness: 0.28, roughness: 0.38, side: THREE.DoubleSide }));
  const schools = [0, 1, 2].map((school) => {
    const count = school === 1 ? 14 : 18;
    const mesh = new THREE.InstancedMesh(fishGeo, fishMat, count);
    mesh.name = `fish-school-${school + 1}`;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    root.add(mesh);
    return { mesh, count, phase: school * 2.4, speed: 0.22 + school * 0.035, spread: 0.8 + school * 0.25, z: -7 - school * 4 };
  });

  const bubblesGeo = registerGeometry(new THREE.SphereGeometry(0.045, 7, 5));
  const bubblesMat = registerMaterial(new THREE.MeshBasicMaterial({ color: 0x88eaff, transparent: true, opacity: 0.55 }));
  const bubbleCount = 54;
  const bubbles = new THREE.InstancedMesh(bubblesGeo, bubblesMat, bubbleCount);
  bubbles.name = 'rising-bubble-streams';
  bubbles.frustumCulled = false;
  bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(bubbles);
  const bubbleData = Array.from({ length: bubbleCount }, (_, index) => ({
    x: Math.sin(index * 17.3) * 8,
    y: -3 + (index % 9) * 0.8,
    z: -5 - (index % 7) * 2.1,
    speed: 0.35 + (index % 5) * 0.12,
    scale: 0.35 + (index % 4) * 0.18,
    phase: index * 0.73,
  }));

  const whaleGroup = new THREE.Group();
  whaleGroup.name = 'travelling-humpback';
  const whaleSkin = registerMaterial(new THREE.MeshStandardMaterial({ color: 0x355b79, roughness: 0.62, metalness: 0.12, emissive: 0x071c2c, emissiveIntensity: 0.34, transparent: true, depthWrite: false }));
  const whaleBelly = registerMaterial(new THREE.MeshStandardMaterial({ color: 0x9bb4bf, roughness: 0.78, metalness: 0.05, transparent: true, depthWrite: false }));
  const whaleBody = new THREE.Mesh(registerGeometry(new THREE.SphereGeometry(1, 24, 16)), whaleSkin);
  whaleBody.scale.set(2.4, 0.72, 0.78);
  whaleGroup.add(whaleBody);
  const rostrum = new THREE.Mesh(registerGeometry(new THREE.SphereGeometry(0.52, 16, 12)), whaleSkin);
  rostrum.position.set(1.95, -0.02, 0);
  rostrum.scale.set(1.05, 0.72, 0.9);
  whaleGroup.add(rostrum);
  const belly = new THREE.Mesh(registerGeometry(new THREE.SphereGeometry(0.86, 20, 12)), whaleBelly);
  belly.position.set(0.35, -0.38, 0);
  belly.scale.set(1.8, 0.42, 0.72);
  whaleGroup.add(belly);
  const eyeMat = registerMaterial(new THREE.MeshBasicMaterial({ color: 0x071724, transparent: true, depthWrite: false }));
  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(registerGeometry(new THREE.SphereGeometry(0.065, 8, 6)), eyeMat);
    eye.position.set(1.72, 0.12, side * 0.55);
    whaleGroup.add(eye);
  });
  const tailPivot = new THREE.Group();
  tailPivot.position.x = -2.2;
  whaleGroup.add(tailPivot);
  const flukeMat = registerMaterial(new THREE.MeshStandardMaterial({ color: 0x294b67, roughness: 0.66, side: THREE.DoubleSide }));
  const flukes = new THREE.Mesh(registerGeometry(makeFlukeGeometry()), flukeMat);
  flukes.rotation.y = Math.PI;
  flukes.position.set(-0.32, 0.02, -0.06);
  tailPivot.add(flukes);
  const pectoralGeo = registerGeometry(new THREE.ConeGeometry(0.34, 2.5, 6));
  const pectoralFins: { mesh: THREE.Mesh; side: number }[] = [];
  [-1, 1].forEach((side) => {
    const fin = new THREE.Mesh(pectoralGeo, whaleSkin);
    fin.position.set(0.12, -0.38, side * 0.85);
    fin.rotation.z = Math.PI * 0.48;
    fin.rotation.x = side * 0.42;
    whaleGroup.add(fin);
    pectoralFins.push({ mesh: fin, side });
  });
  whaleGroup.scale.setScalar(1.42);
  root.add(whaleGroup);

  const mantae = [0, 1].map((index) => {
    const manta = createEnemyMesh('manta', mats);
    manta.telegraphRing.visible = false;
    manta.group.scale.setScalar(index === 0 ? 0.42 : 0.31);
    manta.group.name = `swimming-manta-${index + 1}`;
    root.add(manta.group);
    return { group: manta.group, phase: index * Math.PI, speed: 0.32 + index * 0.08, depth: -11 - index * 3, flap: new THREE.Group() };
  });
  const mantaFinMat = registerMaterial(new THREE.MeshStandardMaterial({ color: 0x247f79, emissive: 0x0b554b, emissiveIntensity: 0.35, side: THREE.DoubleSide, metalness: 0.3, roughness: 0.43 }));
  const mantaFinGeo = registerGeometry(new THREE.ShapeGeometry((() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.65, 0.38, 1.45, 0.04);
    shape.quadraticCurveTo(0.85, -0.2, 0, 0);
    return shape;
  })()));
  mantae.forEach((manta, index) => {
    const pair: THREE.Mesh[] = [];
    [-1, 1].forEach((side) => {
      const fin = new THREE.Mesh(mantaFinGeo, mantaFinMat);
      fin.position.set(0, 0.04, side * 0.18);
      fin.scale.x = side;
      manta.group.add(fin);
      pair.push(fin);
    });
    (manta as typeof manta & { fins: THREE.Mesh[]; index: number }).fins = pair;
    (manta as typeof manta & { index: number }).index = index;
  });

  const jellyfish = [0, 1, 2].map((index) => {
    const jelly = createEnemyMesh('jelly', mats);
    jelly.telegraphRing.visible = false;
    jelly.group.scale.setScalar(0.34 + index * 0.06);
    jelly.group.name = `drifting-jellyfish-${index + 1}`;
    root.add(jelly.group);
    return { group: jelly.group, core: jelly.coreMesh, phase: index * 2.1, homeX: -7.1 + index * 7.1, homeY: 2.5 + (index % 2) * 1.8, z: -10 - index * 3 };
  });

  const crewMaterials = {
    hull: registerMaterial(new THREE.MeshStandardMaterial({ color: 0x607887, metalness: 0.82, roughness: 0.3 })),
    joint: registerMaterial(new THREE.MeshStandardMaterial({ color: 0x172b38, metalness: 0.72, roughness: 0.38 })),
    visor: registerMaterial(new THREE.MeshStandardMaterial({ color: 0x9aeeff, emissive: 0x1ca9d0, emissiveIntensity: 1.3, metalness: 0.25, roughness: 0.18 })),
    glow: registerMaterial(new THREE.MeshBasicMaterial({ color: 0x36e5ff })),
  };
  const crew = [0, 1, 2, 3].map((index) => {
    const rig = createCrewRig(crewMaterials, index * 1.7, 0.42 + (index % 2) * 0.07);
    rig.group.name = `maintenance-crew-${index + 1}`;
    rig.group.scale.setScalar(0.72);
    rig.group.position.y = -1.65;
    rig.group.position.z = 2.5 + (index % 2) * 0.65;
    root.add(rig.group);
    return rig;
  });

  const holoGroup = new THREE.Group();
  holoGroup.name = 'animated-holographic-planet';
  holoGroup.position.set(5.2, 2.8, -7.5);
  const holoMat = registerMaterial(new THREE.MeshStandardMaterial({ color: 0x15bde0, emissive: 0x0a668f, emissiveIntensity: 1.4, transparent: true, opacity: 0.62, metalness: 0.2, roughness: 0.3 }));
  const planet = new THREE.Mesh(registerGeometry(new THREE.SphereGeometry(0.85, 24, 18)), holoMat);
  const wire = new THREE.Mesh(registerGeometry(new THREE.SphereGeometry(0.88, 16, 12)), registerMaterial(new THREE.MeshBasicMaterial({ color: 0x51dfff, wireframe: true, transparent: true, opacity: 0.34 })));
  holoGroup.add(planet, wire);
  const orbitA = new THREE.Mesh(registerGeometry(new THREE.TorusGeometry(1.38, 0.025, 6, 72)), registerMaterial(new THREE.MeshBasicMaterial({ color: 0x32d8ff, transparent: true, opacity: 0.82 })));
  orbitA.rotation.x = 0.72;
  const orbitB = new THREE.Mesh(registerGeometry(new THREE.TorusGeometry(1.12, 0.018, 6, 64)), registerMaterial(new THREE.MeshBasicMaterial({ color: 0x6af1e1, transparent: true, opacity: 0.65 })));
  orbitB.rotation.set(1.08, 0.7, 0.24);
  holoGroup.add(orbitA, orbitB);
  const scanRing = new THREE.Mesh(registerGeometry(new THREE.TorusGeometry(0.92, 0.012, 4, 48)), registerMaterial(new THREE.MeshBasicMaterial({ color: 0xb4fbff, transparent: true, opacity: 0.65 })));
  scanRing.rotation.x = Math.PI / 2;
  holoGroup.add(scanRing);
  root.add(holoGroup);

  const statusLightGeo = registerGeometry(new THREE.SphereGeometry(0.07, 7, 5));
  const statusLights: THREE.Mesh[] = [];
  for (let index = 0; index < 20; index++) {
    const angle = (index / 20) * Math.PI * 2;
    const statusLightMat = registerMaterial(new THREE.MeshBasicMaterial({ color: 0x29dafa }));
    const lamp = new THREE.Mesh(statusLightGeo, statusLightMat);
    lamp.position.set(Math.cos(angle) * 3.48, -1.62, Math.sin(angle) * 3.48);
    root.add(lamp);
    statusLights.push(lamp);
  }

  const machinery: THREE.Group[] = [];
  const machineMat = registerMaterial(new THREE.MeshStandardMaterial({ color: 0x405668, metalness: 0.86, roughness: 0.28 }));
  const machineGlow = registerMaterial(new THREE.MeshBasicMaterial({ color: 0x21d6ee }));
  [-1, 1].forEach((side) => {
    const machine = new THREE.Group();
    machine.position.set(side * 3.45, -1.35, -0.2);
    const base = new THREE.Mesh(registerGeometry(new THREE.CylinderGeometry(0.2, 0.3, 0.25, 10)), machineMat);
    machine.add(base);
    const armPivot = new THREE.Group();
    armPivot.position.y = 0.12;
    machine.add(armPivot);
    const arm = new THREE.Mesh(registerGeometry(new THREE.BoxGeometry(0.09, 1.05, 0.09)), machineMat);
    arm.position.y = 0.48;
    armPivot.add(arm);
    const tool = new THREE.Mesh(registerGeometry(new THREE.BoxGeometry(0.26, 0.12, 0.18)), machineGlow);
    tool.position.y = 1.0;
    armPivot.add(tool);
    root.add(machine);
    machinery.push(armPivot);
  });

  const dummy = new THREE.Object3D();
  const tempQuat = new THREE.Quaternion();
  const tempScale = new THREE.Vector3();
  const fishHeadingAxis = new THREE.Vector3(0, 0, 1);

  const update = (time: number, _dt: number, visible: boolean) => {
    root.visible = visible;
    if (!visible) return;

    const domePulse = (Math.sin(time * 0.42) + 1) * 0.5;
    domeGlass.opacity = 0.035 + domePulse * 0.025;
    ribMaterial.emissiveIntensity = 0.52 + domePulse * 0.48;
    ribGlowMaterial.opacity = 0.3 + domePulse * 0.35;
    domeRings.forEach((ring, index) => {
      ring.rotation.y = Math.PI / 2 + Math.sin(time * 0.12 + index) * 0.035;
      ring.position.y = ring.userData.baseY + Math.sin(time * 0.35 + index * 1.8) * 0.018;
    });
    domeRibs.forEach((rib, index) => {
      rib.scale.setScalar(1 + Math.sin(time * 0.32 + index * 0.55) * 0.0015);
    });
    domeAccents.forEach((accent, index) => {
      accent.scale.setScalar(1 + Math.sin(time * 0.8 + index) * 0.012);
    });

    dockedShips.forEach(({ ship, side, phase }) => {
      ship.rotation.y = Math.PI + side * 0.12 + Math.sin(time * 0.24 + phase) * 0.08;
      ship.position.y = -1.15 + Math.sin(time * 1.05 + phase) * 0.045;
    });

    const whaleProgress = (time % 22) / 22;
    const whaleFade = THREE.MathUtils.smoothstep(whaleProgress, 0.015, 0.12) * (1 - THREE.MathUtils.smoothstep(whaleProgress, 0.88, 0.985));
    whaleGroup.visible = whaleFade > 0.015;
    whaleGroup.position.set(-34 + whaleProgress * 68, 4.2 + Math.sin(time * 0.6) * 0.18, -20);
    whaleGroup.rotation.set(0, 0, Math.sin(time * 0.8) * 0.025);
    whaleSkin.opacity = 0.92 * whaleFade;
    whaleBelly.opacity = 0.92 * whaleFade;
    eyeMat.opacity = whaleFade;
    tailPivot.rotation.y = Math.sin(time * 3.3) * 0.38;
    tailPivot.rotation.z = Math.sin(time * 1.65) * 0.09;
    whaleBody.scale.y = 0.72 * (1 + Math.sin(time * 2.6) * 0.025);
    whaleBody.scale.z = 0.78 * (1 + Math.cos(time * 2.6) * 0.025);
    whaleBody.rotation.z = Math.sin(time * 0.8) * 0.018;
    pectoralFins.forEach(({ mesh, side }) => {
      mesh.rotation.x = side * (0.42 + Math.sin(time * 1.8 + side) * 0.08);
    });

    mantae.forEach((manta, index) => {
      const phase = time * manta.speed + manta.phase;
      manta.group.position.set(Math.sin(phase) * (index ? 8 : 6), 4.6 + Math.sin(phase * 1.4) * 0.8, manta.depth);
      manta.group.rotation.y = Math.cos(phase) >= 0 ? 0 : Math.PI;
      manta.group.rotation.z = Math.sin(phase * 1.1) * 0.08;
      const withFins = manta as typeof manta & { fins: THREE.Mesh[]; index: number };
      withFins.fins.forEach((fin, finIndex) => {
        fin.rotation.z = Math.sin(time * 2.1 + manta.phase + finIndex * Math.PI) * 0.34;
      });
    });

    schools.forEach((school, schoolIndex) => {
      const phase = time * school.speed + school.phase;
      const centerX = Math.sin(phase) * (schoolIndex === 0 ? 6.8 : 9.2);
      const centerY = 1.6 + Math.sin(phase * 0.8 + schoolIndex) * 1.5;
      for (let index = 0; index < school.count; index++) {
        const localPhase = time * (1.2 + (index % 5) * 0.09) + index * 2.399 + school.phase;
        const row = (index % 5) - 2;
        const fishX = centerX + Math.cos(localPhase * 0.45) * school.spread + row * 0.27;
        const fishY = centerY + Math.sin(localPhase) * school.spread * 0.42 + row * 0.13;
        const fishZ = school.z + Math.sin(localPhase * 0.61) * 0.48;
        const direction = Math.cos(phase) >= 0 ? 0 : Math.PI;
        const heading = direction + Math.sin(localPhase * 0.42) * 0.14;
        dummy.position.set(fishX, fishY, fishZ);
        tempQuat.setFromAxisAngle(fishHeadingAxis, heading);
        tempScale.setScalar(0.18 + (index % 4) * 0.025);
        dummy.quaternion.copy(tempQuat);
        dummy.scale.copy(tempScale);
        dummy.updateMatrix();
        school.mesh.setMatrixAt(index, dummy.matrix);
      }
      school.mesh.instanceMatrix.needsUpdate = true;
    });

    jellyfish.forEach((jelly, index) => {
      const drift = time * (0.18 + index * 0.025) + jelly.phase;
      jelly.group.position.set(jelly.homeX + Math.sin(drift) * 0.55, jelly.homeY + Math.sin(time * 0.8 + jelly.phase) * 0.85, jelly.z);
      jelly.group.rotation.z = Math.sin(drift * 1.4) * 0.08;
      const pulse = 1 + Math.sin(time * 2.3 + jelly.phase) * 0.07;
      jelly.group.children[1]?.scale.set(pulse, 1 / pulse, pulse);
      jelly.core.material instanceof THREE.MeshStandardMaterial && (jelly.core.material.emissiveIntensity = 0.8 + (Math.sin(time * 2.3 + jelly.phase) + 1) * 0.5);
      jelly.group.children.slice(4).forEach((tentacle, tentacleIndex) => {
        tentacle.rotation.z = Math.sin(time * 1.8 + jelly.phase + tentacleIndex * 0.8) * 0.13;
        tentacle.rotation.x = Math.cos(time * 1.5 + tentacleIndex) * 0.09;
      });
    });

    crew.forEach((rig) => {
      const route = time * rig.speed + rig.phase;
      const x = Math.sin(route) * 4.45;
      const moving = Math.abs(Math.cos(route)) > 0.18;
      rig.group.position.x = x;
      rig.group.position.z = 2.25 + Math.cos(route * 0.5) * 0.28;
      rig.group.rotation.y = Math.cos(route) >= 0 ? Math.PI / 2 : -Math.PI / 2;
      const gait = moving ? Math.sin(route * 5.5) * 0.48 : 0;
      rig.leftLeg.rotation.z = gait;
      rig.rightLeg.rotation.z = -gait;
      rig.leftArm.rotation.z = moving ? -gait * 0.65 : 0.18 + Math.sin(time * 1.7 + rig.phase) * 0.08;
      rig.rightArm.rotation.z = moving ? gait * 0.65 : -0.4 + Math.sin(time * 1.4 + rig.phase) * 0.12;
      rig.head.rotation.y = Math.sin(time * 0.65 + rig.phase) * 0.2;
      rig.head.rotation.x = moving ? 0 : Math.sin(time * 1.9 + rig.phase) * 0.08;
    });

    holoGroup.rotation.y = time * 0.24;
    orbitA.rotation.z = time * 0.32;
    orbitB.rotation.y = -time * 0.21;
    scanRing.rotation.y = time * 0.65;
    holoMat.emissiveIntensity = 1.15 + Math.sin(time * 1.3) * 0.2;

    statusLights.forEach((lamp, index) => {
      const pulse = (Math.sin(time * 2.2 - index * 0.8) + 1) * 0.5;
      lamp.scale.setScalar(0.7 + pulse * 0.6);
      (lamp.material as THREE.MeshBasicMaterial).color.setHex(pulse > 0.6 ? 0x3de6ff : 0x08769d);
    });
    machinery.forEach((arm, index) => {
      arm.rotation.z = Math.sin(time * 0.44 + index * Math.PI) * 0.42;
      arm.rotation.x = Math.cos(time * 0.35 + index * Math.PI) * 0.1;
    });

    bubbleData.forEach((bubble, index) => {
      const y = ((bubble.y + time * bubble.speed + 3) % 12) - 3;
      dummy.position.set(bubble.x + Math.sin(time * 0.6 + bubble.phase) * 0.14, y, bubble.z);
      dummy.rotation.set(0, 0, 0);
      const scale = bubble.scale * (0.8 + Math.sin(time + bubble.phase) * 0.16);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      bubbles.setMatrixAt(index, dummy.matrix);
    });
    bubbles.instanceMatrix.needsUpdate = true;
  };

  const dispose = () => {
    scene.remove(root);
    const sharedMaterials = new Set<THREE.Material>(Object.values(mats));
    const disposedMaterials = new Set<THREE.Material>();
    const disposedGeometries = new Set<THREE.BufferGeometry>();
    const disposeMaterial = (material: THREE.Material) => {
      if (!sharedMaterials.has(material) && !disposedMaterials.has(material)) {
        material.dispose();
        disposedMaterials.add(material);
      }
    };
    const disposeGeometry = (geometry: THREE.BufferGeometry) => {
      if (!disposedGeometries.has(geometry)) {
        geometry.dispose();
        disposedGeometries.add(geometry);
      }
    };
    root.traverse((object) => {
      if (object instanceof THREE.InstancedMesh) object.dispose();
      if (object instanceof THREE.Mesh) {
        disposeGeometry(object.geometry);
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(disposeMaterial);
      }
    });
    ownedGeometries.forEach(disposeGeometry);
    ownedMaterials.forEach(disposeMaterial);
  };

  return { update, dispose };
}
