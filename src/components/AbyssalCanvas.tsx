import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AppendageSlot,
  BossAppendageState,
  CameraMode,
  ControlScheme,
  CosmeticId,
  DifficultyId,
  EnemyType,
  GameSettings,
  GameStateMode,
  HudSnapshot,
  LastMissionResult,
  MedalRank,
  PlayerSaveData,
  ScreenLockTarget,
  ShipClassId,
  StageId,
  UpgradeId,
  WeaponId,
} from '../game/types';
import {
  ACHIEVEMENT_CATALOG,
  COSMETIC_CATALOG,
  DAILY_OBJECTIVES_CATALOG,
  DIFFICULTY_CONFIGS,
  MISSION_CATALOG,
  SHIP_CATALOG,
  STAGE_CONFIGS,
  UPGRADE_CATALOG,
  WEAPON_CATALOG,
} from '../game/stages';
import {
  applyPilotXp,
  getAchievementProgress,
  getUnlockedStagesFromSave,
  loadPlayerSave,
  resetPlayerSave,
  savePlayerData,
} from '../game/saveManager';
import {
  BiolumeDamageUniforms,
  BossAppendage3DNode,
  createBossMesh,
  createEnemyMesh,
  createMaterialBank,
  createPlayerPrimaryBoltMesh,
  createPlayerTorpedoMesh,
  createVanguardShip,
} from '../game/models';
import { soundEngine } from '../game/audio';

// Reusable module-scope math objects (Zero GC in render loop)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();
const _colorA = new THREE.Color();
const _colorB = new THREE.Color();

interface EnemyEntity {
  id: number;
  active: boolean;
  type: EnemyType;
  group: THREE.Group;
  coreMesh: THREE.Mesh;
  telegraphRing: THREE.Mesh;
  hp: number;
  maxHp: number;
  baseColorHex: number;
  hitFlashTimer: number;
  fireTimer: number;
  telegraphTimer: number;
  isFiringWindup: boolean;
  spawnTime: number;
  patternPhase: number;
  baseX: number;
  baseY: number;
  velZ: number;
  radius: number;
  locked: boolean;
}

interface ProjectileEntity {
  active: boolean;
  isPlayer: boolean;
  isTorpedo: boolean;
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  targetEnemyId: number | null;
  damage: number;
  life: number;
}

interface ParticleInstance {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  scale: number;
  life: number;
  maxLife: number;
  colorHex: number;
}

interface PickupEntity {
  active: boolean;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  kind: 'hull' | 'energy';
  phase: number;
}

export interface SimulationController {
  startStage: (stageId: StageId, resetCampaign?: boolean) => void;
  startMission: (missionId: string) => void;
  setMode: (mode: GameStateMode) => void;
  buyOrToggleUpgrade: (upgradeId: UpgradeId) => void;
  upgradeModuleTier: (upgradeId: UpgradeId) => void;
  refundAllUpgrades: () => void;
  claimSupplyGrant: () => void;
  exchangeCreditsForCore: () => void;
  selectShip: (shipId: ShipClassId) => void;
  buyShip: (shipId: ShipClassId) => void;
  selectWeapon: (weaponId: WeaponId) => void;
  buyWeapon: (weaponId: WeaponId) => void;
  selectCosmetic: (cosmeticId: CosmeticId) => void;
  previewShip: (shipId: ShipClassId, cosmeticId?: CosmeticId) => void;
  setDifficulty: (diff: DifficultyId) => void;
  claimDailyObjective: (dailyId: string) => void;
  claimAchievement: (achId: string) => void;
  updateCallsign: (callsign: string) => void;
  updateSettings: (partial: Partial<GameSettings>) => void;
  resetSaveData: () => void;
  setTouchInput: (x: number, y: number) => void;
  setTouchFiring: (firing: boolean) => void;
  triggerBarrelRoll: () => void;
  triggerTorpedoSalvo: () => void;
  triggerTacticalSonar: () => void;
  focusBossAppendage: (slot: AppendageSlot) => void;
  summonBossNow: () => void;
}

interface AbyssalCanvasProps {
  mode: GameStateMode;
  cameraMode: CameraMode;
  controlScheme: ControlScheme;
  selectedStage: StageId;
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onLockTargetsUpdate: (
    targets: ScreenLockTarget[],
    reticlePos: { x: number; y: number },
  ) => void;
  onToggleCamera: () => void;
  onToggleDock: () => void;
  onRegisterController: (controller: SimulationController) => void;
}

export const AbyssalCanvas: React.FC<AbyssalCanvasProps> = ({
  mode,
  cameraMode,
  controlScheme,
  selectedStage,
  onHudUpdate,
  onLockTargetsUpdate,
  onToggleCamera,
  onToggleDock,
  onRegisterController,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  // Latest props in refs so the 60fps loop never restarts on React state updates
  const modeRef = useRef<GameStateMode>(mode);
  const cameraModeRef = useRef<CameraMode>(cameraMode);
  const controlSchemeRef = useRef<ControlScheme>(controlScheme);
  const selectedStageRef = useRef<StageId>(selectedStage);
  const onHudUpdateRef = useRef(onHudUpdate);
  const onLockTargetsUpdateRef = useRef(onLockTargetsUpdate);
  const onToggleCameraRef = useRef(onToggleCamera);
  const onToggleDockRef = useRef(onToggleDock);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  useEffect(() => {
    controlSchemeRef.current = controlScheme;
  }, [controlScheme]);

  useEffect(() => {
    selectedStageRef.current = selectedStage;
  }, [selectedStage]);

  useEffect(() => {
    onHudUpdateRef.current = onHudUpdate;
    onLockTargetsUpdateRef.current = onLockTargetsUpdate;
    onToggleCameraRef.current = onToggleCamera;
    onToggleDockRef.current = onToggleDock;
  });

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software WebGL Guard (SwiftShader, llvmpipe, softpipe, Basic Render)
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030b1c);
    scene.fog = new THREE.FogExp2(0x030b1c, 0.0085);

    // 2. Studio Environment Map Reflection (RoomEnvironment + PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(62, width / height, 0.2, 260);
    camera.position.set(0, 3.2, 13.5);

    // 3. Balanced 3-Point Abyssal Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x0ea5e9, 0x041022, 1.35);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0x38bdf8, 2.2);
    keyLight.position.set(18, 34, 22);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 110;
    const d = 28;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x10b981, 1.15);
    rimLight.position.set(-20, -14, -25);
    scene.add(rimLight);

    const shipPointLight = new THREE.PointLight(0x06b6d4, 3.2, 36, 1.5);
    scene.add(shipPointLight);

    // 4. Material Bank & Player Vanguard-IX Craft
    const mats = createMaterialBank(isSoftwareGl);
    const vanguard = createVanguardShip(mats);
    scene.add(vanguard.group);

    // 4b. 3D Underwater Command Berth (Docking Rings, Contact Shadow, Volumetric Light Shafts & Gantry Arches)
    const hangarBerthGroup = new THREE.Group();
    scene.add(hangarBerthGroup);

    const dockPlatformGroup = new THREE.Group();
    dockPlatformGroup.position.set(0, -1.65, 0);
    hangarBerthGroup.add(dockPlatformGroup);

    const dockShadowMat = new THREE.MeshBasicMaterial({
      color: 0x01040a,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const dockShadowPlane = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 48),
      dockShadowMat,
    );
    dockShadowPlane.rotation.x = -Math.PI / 2;
    dockShadowPlane.position.y = -0.02;
    dockPlatformGroup.add(dockShadowPlane);

    const dockRingInnerMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const dockRingInner = new THREE.Mesh(
      new THREE.RingGeometry(2.55, 2.72, 64),
      dockRingInnerMat,
    );
    dockRingInner.rotation.x = -Math.PI / 2;
    dockPlatformGroup.add(dockRingInner);

    const dockRingOuterMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const dockRingOuter = new THREE.Mesh(
      new THREE.RingGeometry(3.65, 3.74, 48),
      dockRingOuterMat,
    );
    dockRingOuter.rotation.x = -Math.PI / 2;
    dockPlatformGroup.add(dockRingOuter);

    const volumetricConeGeo = new THREE.ConeGeometry(3.8, 14, 24, 1, true);
    const volumetricConeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.055,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const volumetricCones: THREE.Mesh[] = [];
    [-3.2, 0, 3.2].forEach((cx, idx) => {
      const cone = new THREE.Mesh(volumetricConeGeo, volumetricConeMat);
      cone.position.set(cx, 5.2, idx === 1 ? -0.5 : -2.2);
      cone.rotation.z = cx * -0.04;
      hangarBerthGroup.add(cone);
      volumetricCones.push(cone);
    });

    const gantryArchGeo = new THREE.TorusGeometry(11.5, 0.28, 8, 36, Math.PI);
    const gantryArchMat = new THREE.MeshStandardMaterial({
      color: 0x0a192f,
      roughness: 0.5,
      metalness: 0.75,
    });
    [-7.5, -16.5].forEach((gz) => {
      const arch = new THREE.Mesh(gantryArchGeo, gantryArchMat);
      arch.position.set(0, -3.5, gz);
      hangarBerthGroup.add(arch);
    });

    // 5. InstancedMesh Trench Environment: Canyon Pillars & Bioluminescent Coral Spires
    const PILLAR_COUNT = 72;
    const pillarGeo = new THREE.CylinderGeometry(1.1, 2.4, 28, 7);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x0f2138,
      roughness: 0.72,
      metalness: 0.28,
    });
    const pillarInstanced = new THREE.InstancedMesh(
      pillarGeo,
      pillarMat,
      PILLAR_COUNT,
    );
    pillarInstanced.frustumCulled = false;

    const pillarData: {
      x: number;
      y: number;
      z: number;
      rotX: number;
      rotZ: number;
      scaleX: number;
      scaleY: number;
    }[] = [];

    for (let i = 0; i < PILLAR_COUNT; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const px = side * (22 + (i % 5) * 4.5);
      const py = -14 + ((i * 7) % 28);
      const pz = -i * 3.2;
      const sx = 0.85 + (i % 4) * 0.12;
      const sy = 0.85 + (i % 3) * 0.15;
      const rx = ((i % 5) - 2) * 0.12;
      const rz = -side * (0.18 + (i % 3) * 0.08);
      pillarData.push({
        x: px,
        y: py,
        z: pz,
        rotX: rx,
        rotZ: rz,
        scaleX: sx,
        scaleY: sy,
      });

      _vec3A.set(px, py, pz);
      _euler.set(rx, 0, rz);
      _quat.setFromEuler(_euler);
      _scale.set(sx, sy, sx);
      _mat4.compose(_vec3A, _quat, _scale);
      pillarInstanced.setMatrixAt(i, _mat4);

      _color.setHSL(0.56 + (i % 5) * 0.02, 0.55, 0.14 + (i % 3) * 0.04);
      pillarInstanced.setColorAt(i, _color);
    }
    pillarInstanced.instanceMatrix.needsUpdate = true;
    if (pillarInstanced.instanceColor) {
      pillarInstanced.instanceColor.needsUpdate = true;
    }
    scene.add(pillarInstanced);

    // 6. InstancedMesh Bioluminescent Plankton & Marine Snow
    const PLANKTON_COUNT = 320;
    const planktonGeo = new THREE.OctahedronGeometry(0.16, 0);
    const planktonMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
    });
    const planktonInstanced = new THREE.InstancedMesh(
      planktonGeo,
      planktonMat,
      PLANKTON_COUNT,
    );
    planktonInstanced.frustumCulled = false;

    const planktonCoords: { x: number; y: number; z: number; speed: number }[] =
      [];
    for (let i = 0; i < PLANKTON_COUNT; i++) {
      const x = (Math.random() - 0.5) * 68;
      const y = (Math.random() - 0.5) * 44;
      const z = -Math.random() * 180 + 20;
      const speed = 14 + Math.random() * 22;
      planktonCoords.push({ x, y, z, speed });

      _vec3A.set(x, y, z);
      _quat.identity();
      const s = 0.6 + Math.random() * 1.1;
      _scale.set(s, s, s);
      _mat4.compose(_vec3A, _quat, _scale);
      planktonInstanced.setMatrixAt(i, _mat4);

      const hue = i % 3 === 0 ? 0.52 : i % 3 === 1 ? 0.44 : 0.82;
      _color.setHSL(hue, 0.95, 0.65);
      planktonInstanced.setColorAt(i, _color);
    }
    planktonInstanced.instanceMatrix.needsUpdate = true;
    if (planktonInstanced.instanceColor) {
      planktonInstanced.instanceColor.needsUpdate = true;
    }
    scene.add(planktonInstanced);

    // 7. InstancedMesh Pooled Explosion & Cavitation Particle Bursts
    const PARTICLE_POOL_SIZE = 160;
    const burstGeo = new THREE.IcosahedronGeometry(0.28, 0);
    const burstMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });
    const burstInstanced = new THREE.InstancedMesh(
      burstGeo,
      burstMat,
      PARTICLE_POOL_SIZE,
    );
    burstInstanced.frustumCulled = false;

    const particles: ParticleInstance[] = [];
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      particles.push({
        active: false,
        pos: new THREE.Vector3(0, -999, 0),
        vel: new THREE.Vector3(),
        scale: 0,
        life: 0,
        maxLife: 0.5,
        colorHex: 0x06b6d4,
      });
      _vec3A.set(0, -999, 0);
      _quat.identity();
      _scale.set(0, 0, 0);
      _mat4.compose(_vec3A, _quat, _scale);
      burstInstanced.setMatrixAt(i, _mat4);
      _color.setHex(0x06b6d4);
      burstInstanced.setColorAt(i, _color);
    }
    burstInstanced.instanceMatrix.needsUpdate = true;
    scene.add(burstInstanced);

    function spawnParticleBurst(
      origin: THREE.Vector3,
      colorHex: number,
      count: number = 18,
      speedScale: number = 18,
    ) {
      let spawned = 0;
      for (let i = 0; i < PARTICLE_POOL_SIZE && spawned < count; i++) {
        const p = particles[i];
        if (!p.active) {
          p.active = true;
          p.pos.copy(origin);
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          const spd = (0.4 + Math.random() * 0.8) * speedScale;
          p.vel.set(
            Math.sin(phi) * Math.cos(theta) * spd,
            Math.sin(phi) * Math.sin(theta) * spd,
            Math.cos(phi) * spd,
          );
          p.life = 0;
          p.maxLife = 0.32 + Math.random() * 0.35;
          p.scale = 0.8 + Math.random() * 1.4;
          p.colorHex = colorHex;
          _color.setHex(colorHex);
          burstInstanced.setColorAt(i, _color);
          spawned++;
        }
      }
      if (burstInstanced.instanceColor) {
        burstInstanced.instanceColor.needsUpdate = true;
      }
    }

    // Spawns high-velocity incandescent orange/amber/gold jet embers streaming out of the stern nozzles
    const emberPalette = [0xff6b00, 0xffaa00, 0xfffbeb, 0xff4500];
    function spawnExhaustEmberJet(count: number = 6, speedScale: number = 26) {
      vanguard.group.updateMatrixWorld();
      let spawned = 0;
      for (let i = 0; i < PARTICLE_POOL_SIZE && spawned < count; i++) {
        const p = particles[i];
        if (!p.active) {
          p.active = true;
          // Alternate between port and starboard stern nozzles in ship-local space
          const sideX = (spawned % 2 === 0 ? -0.58 : 0.58) + (Math.random() - 0.5) * 0.35;
          const localNozzleY = (Math.random() - 0.5) * 0.22;
          _vec3A.set(sideX, localNozzleY, 2.05).applyMatrix4(vanguard.group.matrixWorld);
          p.pos.copy(_vec3A);

          // Exhaust direction is +Z in ship local space with turbulent cone spread
          _vec3B
            .set(
              (Math.random() - 0.5) * 0.34,
              (Math.random() - 0.5) * 0.34,
              1.0,
            )
            .normalize()
            .transformDirection(vanguard.group.matrixWorld);

          const spd = (0.65 + Math.random() * 0.75) * speedScale;
          p.vel.copy(_vec3B).multiplyScalar(spd);
          p.life = 0;
          p.maxLife = 0.24 + Math.random() * 0.28;
          p.scale = 0.55 + Math.random() * 0.95;
          const hex = emberPalette[spawned % emberPalette.length];
          p.colorHex = hex;
          _color.setHex(hex);
          burstInstanced.setColorAt(i, _color);
          spawned++;
        }
      }
      if (burstInstanced.instanceColor) {
        burstInstanced.instanceColor.needsUpdate = true;
      }
    }

    // 8. Pooled Projectiles (Composite 3D Fire Bolts, Finned Homing Torpedoes, Enemy Bio-Plasma)
    const PROJECTILE_POOL_SIZE = 90;
    const enemyPlasmaGeo = new THREE.OctahedronGeometry(0.42, 1);

    const projectiles: ProjectileEntity[] = [];
    for (let i = 0; i < PROJECTILE_POOL_SIZE; i++) {
      const isTorpSlot = i >= 50 && i < 66;
      const isEnemySlot = i >= 66;
      const mesh: THREE.Object3D = isTorpSlot
        ? createPlayerTorpedoMesh(mats)
        : isEnemySlot
          ? new THREE.Mesh(enemyPlasmaGeo, mats.biolumeCrimson)
          : createPlayerPrimaryBoltMesh(mats);
      mesh.visible = false;
      scene.add(mesh);
      projectiles.push({
        active: false,
        isPlayer: !isEnemySlot,
        isTorpedo: isTorpSlot,
        mesh,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        targetEnemyId: null,
        damage: 25,
        life: 0,
      });
    }

    // 9. Pooled Pickups (Hull Repair & Luciferin Shield Cells)
    const PICKUP_POOL_SIZE = 10;
    const pickupGeo = new THREE.OctahedronGeometry(0.75, 0);
    const pickups: PickupEntity[] = [];
    for (let i = 0; i < PICKUP_POOL_SIZE; i++) {
      const mesh = new THREE.Mesh(pickupGeo, mats.biolumeEmerald);
      mesh.visible = false;
      scene.add(mesh);
      pickups.push({
        active: false,
        mesh,
        pos: new THREE.Vector3(),
        kind: 'hull',
        phase: i,
      });
    }

    function spawnPickup(origin: THREE.Vector3) {
      for (let i = 0; i < PICKUP_POOL_SIZE; i++) {
        const pk = pickups[i];
        if (!pk.active) {
          pk.active = true;
          pk.pos.copy(origin);
          pk.kind = Math.random() > 0.45 ? 'hull' : 'energy';
          pk.mesh.material =
            pk.kind === 'hull' ? mats.biolumeEmerald : mats.biolumeCyan;
          pk.mesh.position.copy(origin);
          pk.mesh.visible = true;
          break;
        }
      }
    }

    // 9b. 3D Tactical Sonar Acoustic Wavefront & Boss Weak-Point Beacon Meshes
    const sonarWaveMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      wireframe: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const sonarWaveMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 2),
      sonarWaveMat,
    );
    sonarWaveMesh.visible = false;
    scene.add(sonarWaveMesh);

    const sonarBeaconMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const sonarBeaconRing = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 3.35, 24),
      sonarBeaconMat,
    );
    sonarBeaconRing.visible = false;
    scene.add(sonarBeaconRing);

    // 10. Enemy Entities & Stage Leviathan Boss
    let nextEntityId = 1;
    const enemies: EnemyEntity[] = [];

    interface BossAppendageRuntime extends BossAppendage3DNode {
      numericId: number;
      hp: number;
      destroyed: boolean;
      hitFlashTimer: number;
      worldPos: THREE.Vector3;
    }

    let bossObj: {
      active: boolean;
      id: number;
      stageId: StageId;
      group: THREE.Group;
      coreMesh: THREE.Mesh;
      coreDamageUniforms: BiolumeDamageUniforms;
      outerRing: THREE.Group;
      tentacles: THREE.Mesh[];
      telegraphHalo: THREE.Mesh;
      appendages: BossAppendageRuntime[];
      lastSeveredPartName: string | null;
      hp: number;
      maxHp: number;
      phase: 1 | 2 | 3;
      hitFlashTimer: number;
      fluidDripTimer: number;
      attackTimer: number;
      telegraphTimer: number;
      telegraphLabel: string | null;
      attackPatternIndex: number;
      locked: boolean;
    } | null = null;

    function disposeGroupGeometries(group: THREE.Group) {
      group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry) {
            mesh.geometry.dispose();
          }
        }
      });
    }

    function clearEnemiesAndProjectiles() {
      enemies.forEach((e) => {
        scene.remove(e.group);
        disposeGroupGeometries(e.group);
      });
      enemies.length = 0;

      if (bossObj) {
        scene.remove(bossObj.group);
        disposeGroupGeometries(bossObj.group);
        bossObj = null;
      }

      sonarWaveMesh.visible = false;
      sonarBeaconRing.visible = false;

      projectiles.forEach((p) => {
        p.active = false;
        p.mesh.visible = false;
      });

      pickups.forEach((pk) => {
        pk.active = false;
        pk.mesh.visible = false;
      });
    }

    // 11. Mutable Simulation State & Persistent Save Data
    let playerSave: PlayerSaveData = loadPlayerSave().data;
    let lastMissionResult: LastMissionResult | null = null;
    let touchMoveX = 0;
    let touchMoveY = 0;
    let touchFiring = false;

    function persistSave() {
      savePlayerData(playerSave);
    }

    function triggerHaptic(pattern: number | number[]) {
      if (
        !playerSave.settings.hapticsEnabled ||
        playerSave.settings.reducedMotion
      ) {
        return;
      }
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate(pattern);
        } catch {
          // Ignore vibration permission errors
        }
      }
    }

    function applyAudioAndGraphicsSettings() {
      const s = playerSave.settings;
      soundEngine.setVolumes(
        s.masterVolume,
        s.musicVolume,
        s.sfxVolume,
        s.uiVolume,
        s.muted,
      );
      if (!isSoftwareGl) {
        const pr =
          s.graphicsQuality === 'low'
            ? 1
            : s.graphicsQuality === 'medium'
              ? Math.min(window.devicePixelRatio, 1.5)
              : Math.min(window.devicePixelRatio, 2);
        renderer.setPixelRatio(pr);
      }
    }
    applyAudioAndGraphicsSettings();

    const sim = {
      stageId: 1 as StageId,
      missionId: 's1_m1_reef_patrol',
      stageElapsed: 0,
      stageProgress: 0,
      waveCursor: 0,
      playerX: 0,
      playerY: 0,
      playerVelX: 0,
      playerVelY: 0,
      aimX: 0, // normalized -1..1
      aimY: 0, // normalized -1..1
      rollAngle: 0,
      pitchAngle: 0,
      yawAngle: 0,
      hull: 100,
      maxHull: 100,
      hullStress: 0,
      maxHullStressReached: 0,
      pressureDamageTaken: 0,
      inDeepPressureZone: false,
      pressureZoneLabel: null as string | null,
      pressureGroanTimer: 0,
      shield: 100,
      maxShield: 100,
      shieldRegenDelay: 0,
      boost: 100,
      maxBoost: 100,
      score: 0,
      combo: 0,
      comboTimer: 0,
      multiplier: 1,
      maxMultiplierReached: 1,
      barrelRollTimer: 0,
      barrelRollDir: 1,
      rollBufferTimer: 0,
      fireCooldown: 0,
      torpedoCooldown: 0,
      sonarActiveTimer: 0,
      sonarWaveTimer: 0,
      sonarCooldown: 0,
      sonarWeakPointSlot: null as AppendageSlot | 'core' | null,
      sonarHazardsCount: 0,
      lockedTargetIds: [] as number[],
      maxLocks: 4,
      hitstopTimer: 0,
      cameraShake: 0,
      enemiesDefeated: 0,
      elitesDefeated: 0,
      appendagesSeveredThisSortie: 0,
      sonarPulsesUsedThisSortie: 0,
      rollsExecutedThisSortie: 0,
      beaconIntegrityPct: 100,
      shotsFired: 0,
      shotsHit: 0,
      hazardWarningText: null as string | null,
      upgrades: [] as UpgradeId[],
      shipSpeedMult: 1,
      shipPrimaryDmgMult: 1,
      shipPrimaryFireRateMult: 1,
      shipPrimarySpeed: 108,
      shipSecondaryDmgMult: 1,
      shipSecondaryCooldown: 3.8,
      shipSecondarySpeed: 82,
      shipSonarDurationBonus: 0,
      shipPressureResistBonus: 0,
      ambientLightPct: 100,
      ambientColorHex: '#38bdf8',
      keyLightIntensity: 2.4,
      depthStratumName: STAGE_CONFIGS[1].stratumLabels[0],
    };

    function updateDepthAtmosphere(
      stageId: StageId,
      progress: number,
      verticalDiveNormalized: number,
      dt: number,
    ) {
      const cfg = STAGE_CONFIGS[stageId];
      // Combine forward trench descent (0..1) with local vertical dive (-1..1)
      const depthFactor = THREE.MathUtils.clamp(
        progress + verticalDiveNormalized * 0.09,
        0,
        1,
      );

      // 1. Interpolate Abyssal Background & Exponential Fog Color + Density
      _colorA.setHex(cfg.fogColor);
      _colorB.setHex(cfg.deepFogColor);
      _colorA.lerp(_colorB, depthFactor);

      if (scene.background instanceof THREE.Color) {
        scene.background.lerp(_colorA, Math.min(1, dt * 8));
      } else {
        scene.background = _colorA.clone();
      }

      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(scene.background);
        const targetDensity = THREE.MathUtils.lerp(
          cfg.fogDensity,
          cfg.deepFogDensity,
          depthFactor,
        );
        scene.fog.density = THREE.MathUtils.damp(
          scene.fog.density,
          targetDensity,
          6,
          dt,
        );
      }

      // 2. Shift Hemisphere Ambient Sky & Trench Floor Colors + Attenuation
      _colorA.setHex(cfg.ambientSkyColor);
      _colorB.setHex(cfg.deepAmbientSkyColor);
      hemiLight.color.lerpColors(_colorA, _colorB, depthFactor);
      sim.ambientColorHex = `#${hemiLight.color.getHexString()}`;

      _colorA.setHex(cfg.ambientGroundColor);
      _colorB.setHex(cfg.deepAmbientGroundColor);
      hemiLight.groundColor.lerpColors(_colorA, _colorB, depthFactor);

      // Downwelling ambient light dims with depth (1.58 -> 0.68)
      const targetHemiIntensity = THREE.MathUtils.lerp(
        1.58,
        0.68,
        depthFactor,
      );
      hemiLight.intensity = THREE.MathUtils.damp(
        hemiLight.intensity,
        targetHemiIntensity,
        6,
        dt,
      );

      // 3. Shift Directional Key Light Color & Dim Intensity with Depth (2.45 -> 1.12)
      _colorA.setHex(cfg.keyLightColor);
      _colorB.setHex(cfg.deepKeyLightColor);
      keyLight.color.lerpColors(_colorA, _colorB, depthFactor);

      const targetKeyIntensity = THREE.MathUtils.lerp(
        2.45,
        1.12,
        depthFactor,
      );
      keyLight.intensity = THREE.MathUtils.damp(
        keyLight.intensity,
        targetKeyIntensity,
        6,
        dt,
      );
      sim.keyLightIntensity = Number(keyLight.intensity.toFixed(2));

      // 4. Boost Bioluminescent Rim Light & Ship Floodlight as Abyss Darkens
      _colorA.setHex(cfg.rimLightColor);
      _colorB.setHex(cfg.deepRimLightColor);
      rimLight.color.lerpColors(_colorA, _colorB, depthFactor);
      rimLight.intensity = THREE.MathUtils.lerp(1.05, 2.2, depthFactor);

      shipPointLight.color.lerpColors(
        _colorA.setHex(0x06b6d4),
        _colorB.setHex(cfg.deepKeyLightColor),
        depthFactor * 0.55,
      );
      shipPointLight.intensity = THREE.MathUtils.lerp(2.8, 5.4, depthFactor);
      shipPointLight.distance = THREE.MathUtils.lerp(34, 48, depthFactor);

      // 5. Subtly shift canyon spire mineral tint with depth
      _colorA.setHex(0x0f2138);
      _colorB.setHex(cfg.deepAmbientGroundColor);
      pillarMat.color.lerpColors(_colorA, _colorB, depthFactor * 0.65);

      // 6. Compute HUD telemetry readouts
      sim.ambientLightPct = Math.round(
        THREE.MathUtils.lerp(100, 18, depthFactor),
      );
      const stratumIdx =
        depthFactor < 0.34 ? 0 : depthFactor < 0.72 ? 1 : 2;
      sim.depthStratumName = cfg.stratumLabels[stratumIdx];
    }

    function applyStageAtmosphere(stageId: StageId) {
      updateDepthAtmosphere(stageId, 0, 0, 1);
    }

    function spawnWave(
      enemyType: EnemyType,
      count: number,
      formation: 'v_wedge' | 'spiral_ring' | 'flank_pair' | 'mine_barrier',
      spread: number,
    ) {
      for (let i = 0; i < count; i++) {
        const built = createEnemyMesh(enemyType, mats);
        let sx = 0;
        let sy = 0;
        const sz = -105 - i * 9;

        if (formation === 'v_wedge') {
          const offset = i - (count - 1) / 2;
          sx = offset * (spread * 0.35);
          sy = Math.abs(offset) * 2.5 - 2;
        } else if (formation === 'spiral_ring') {
          const angle = (i / count) * Math.PI * 2;
          sx = Math.cos(angle) * (spread * 0.55);
          sy = Math.sin(angle) * (spread * 0.42);
        } else if (formation === 'flank_pair') {
          sx = (i % 2 === 0 ? -1 : 1) * (spread * 0.55);
          sy = ((i % 3) - 1) * 4.5;
        } else {
          sx = ((i / Math.max(1, count - 1)) - 0.5) * spread * 1.2;
          sy = (Math.random() - 0.5) * 16;
        }

        built.group.position.set(sx, sy, sz);
        scene.add(built.group);

        const hpMap: Record<EnemyType, number> = {
          skimmer: 48,
          jelly: 65,
          cruiser: 155,
          manta: 82,
          hazard_mine: 40,
        };
        const baseHexMap: Record<EnemyType, number> = {
          skimmer: 0x06b6d4,
          jelly: 0xd946ef,
          cruiser: 0xf59e0b,
          manta: 0x10b981,
          hazard_mine: 0xf43f5e,
        };

        const diffHpMult =
          DIFFICULTY_CONFIGS[playerSave.selectedDifficulty].enemyHpMult;
        const scaledEnemyHp = Math.round(
          hpMap[enemyType] * (1 + (sim.stageId - 1) * 0.2) * diffHpMult,
        );

        enemies.push({
          id: nextEntityId++,
          active: true,
          type: enemyType,
          group: built.group,
          coreMesh: built.coreMesh,
          telegraphRing: built.telegraphRing,
          hp: scaledEnemyHp,
          maxHp: scaledEnemyHp,
          baseColorHex: baseHexMap[enemyType],
          hitFlashTimer: 0,
          fireTimer: 1.8 + (i % 3) * 0.75,
          telegraphTimer: 0,
          isFiringWindup: false,
          spawnTime: sim.stageElapsed,
          patternPhase: i * 1.1,
          baseX: sx,
          baseY: sy,
          velZ: enemyType === 'cruiser' ? 14 : enemyType === 'hazard_mine' ? 22 : 19,
          radius: enemyType === 'cruiser' ? 2.8 : 2.1,
          locked: false,
        });
      }
    }

    function spawnStageBoss(stageId: StageId) {
      const cfg = STAGE_CONFIGS[stageId];
      const diffHpMult =
        DIFFICULTY_CONFIGS[playerSave.selectedDifficulty].enemyHpMult;
      const built = createBossMesh(stageId, mats);
      built.group.position.set(0, 2, -120);
      scene.add(built.group);

      const runtimeAppendages: BossAppendageRuntime[] = built.appendages.map(
        (node) => {
          const scaledAppHp = Math.round(node.maxHp * diffHpMult);
          return {
            ...node,
            maxHp: scaledAppHp,
            numericId: nextEntityId++,
            hp: scaledAppHp,
            destroyed: false,
            hitFlashTimer: 0,
            worldPos: new THREE.Vector3()
              .copy(built.group.position)
              .add(node.localOffset),
          };
        },
      );

      const scaledBossMaxHp = Math.round(cfg.bossMaxHp * diffHpMult);
      bossObj = {
        active: true,
        id: nextEntityId++,
        stageId,
        group: built.group,
        coreMesh: built.coreMesh,
        coreDamageUniforms: built.coreDamageUniforms,
        outerRing: built.outerRing,
        tentacles: built.tentacles,
        telegraphHalo: built.telegraphHalo,
        appendages: runtimeAppendages,
        lastSeveredPartName: null,
        hp: scaledBossMaxHp,
        maxHp: scaledBossMaxHp,
        phase: 1,
        hitFlashTimer: 0,
        fluidDripTimer: 0,
        attackTimer: 2.8,
        telegraphTimer: 0,
        telegraphLabel:
          'LEVIATHAN DETECTED — TARGET APPENDAGES TO WEAKEN CORE',
        attackPatternIndex: 0,
        locked: false,
      };
      soundEngine.playBossTelegraph();
      syncHudSnapshot();
    }

    function getActiveMission() {
      return (
        MISSION_CATALOG.find((m) => m.id === sim.missionId) ||
        MISSION_CATALOG.find((m) => m.stageId === sim.stageId) ||
        MISSION_CATALOG[1]
      );
    }

    function evaluateOptionalObjective(): boolean {
      const m = getActiveMission();
      const hullRatio = sim.hull / Math.max(1, sim.maxHull);
      switch (m.id) {
        case 'flight_school_01':
          return sim.rollsExecutedThisSortie >= 1 && hullRatio >= 0.99;
        case 's1_m1_reef_patrol':
          return hullRatio >= 0.7;
        case 's1_m2_beacon_defense':
          return sim.sonarPulsesUsedThisSortie >= 2 && sim.beaconIntegrityPct >= 75;
        case 's1_m3_aurelia_finale':
          return sim.appendagesSeveredThisSortie >= 2;
        case 's2_m1_smoker_gauntlet':
          return sim.maxHullStressReached < 80;
        case 's2_m2_cruiser_hunt':
          return sim.maxMultiplierReached >= 4;
        case 's2_m3_vulcanus_finale':
          return sim.appendagesSeveredThisSortie >= 2 && hullRatio >= 0.5;
        case 's3_m1_hadal_descent':
          return sim.sonarPulsesUsedThisSortie >= 3 && hullRatio >= 0.6;
        case 's3_m2_sanctum_convoy':
          return sim.pressureDamageTaken <= 0.5 && sim.beaconIntegrityPct >= 75;
        case 's3_m3_empress_finale':
          return sim.appendagesSeveredThisSortie >= 3;
        case 'rematch_boss_1':
        case 'rematch_boss_2':
        case 'rematch_boss_3':
          return sim.appendagesSeveredThisSortie >= 4;
        default:
          return hullRatio >= 0.7;
      }
    }

    function finalizeSortie(victory: boolean) {
      const m = getActiveMission();
      const diffCfg = DIFFICULTY_CONFIGS[playerSave.selectedDifficulty];
      const existingRec = playerSave.missionRecords[m.id];
      const isFirstClear = victory && !existingRec?.cleared;
      const optDone = victory && evaluateOptionalObjective();
      const hullPct = Math.round((sim.hull / Math.max(1, sim.maxHull)) * 100);

      let medalRank: MedalRank = 'C';
      if (victory) {
        if (sim.score >= m.medalScoreThresholds.S || (hullPct >= 75 && optDone)) {
          medalRank = 'S';
        } else if (sim.score >= m.medalScoreThresholds.A || hullPct >= 50 || optDone) {
          medalRank = 'A';
        } else if (sim.score >= m.medalScoreThresholds.B || hullPct >= 25) {
          medalRank = 'B';
        }
      }

      const baseCredits = victory
        ? isFirstClear
          ? m.firstClearCredits
          : m.repeatClearCredits
        : sim.enemiesDefeated >= 3
          ? Math.round(m.repeatClearCredits * 0.25)
          : 0;
      const optBonus = optDone ? 150 : 0;
      const creditsEarned = Math.round(
        (baseCredits + optBonus) * diffCfg.rewardMult,
      );
      const materialsEarned = victory
        ? isFirstClear
          ? m.firstClearMaterials
          : optDone
            ? 1
            : 0
        : 0;
      const xpEarned = victory
        ? m.xpReward
        : sim.enemiesDefeated >= 3
          ? Math.round(m.xpReward * 0.25)
          : 0;

      playerSave.salvageCredits += creditsEarned;
      playerSave.abyssalMaterials += materialsEarned;
      applyPilotXp(playerSave, xpEarned);
      playerSave.stats.totalPlayTimeSeconds += Math.round(sim.stageElapsed);

      if (victory) {
        playerSave.stats.totalVictories += 1;
        playerSave.dailyProgress.daily_sorties_2 =
          (playerSave.dailyProgress.daily_sorties_2 || 0) + 1;
        const rankOrder: Record<MedalRank, number> = { S: 4, A: 3, B: 2, C: 1 };
        const prevBestRank = existingRec?.bestRank || 'C';
        const bestRank =
          !existingRec || rankOrder[medalRank] > rankOrder[prevBestRank]
            ? medalRank
            : prevBestRank;
        playerSave.missionRecords[m.id] = {
          missionId: m.id,
          cleared: true,
          bestScore: Math.max(Math.round(sim.score), existingRec?.bestScore || 0),
          bestRank,
          optionalCompleted: Boolean(existingRec?.optionalCompleted || optDone),
          timesCleared: (existingRec?.timesCleared || 0) + 1,
        };
      } else {
        playerSave.stats.totalDefeats += 1;
      }

      persistSave();

      lastMissionResult = {
        missionId: m.id,
        missionTitle: m.title,
        stageId: m.stageId,
        victory,
        isFirstClear,
        score: Math.round(sim.score),
        medalRank,
        primaryCompleted: victory,
        optionalCompleted: optDone,
        optionalObjectiveText: m.optionalObjectiveText,
        creditsEarned,
        materialsEarned,
        xpEarned,
        enemiesDefeated: sim.enemiesDefeated,
        accuracyPct:
          sim.shotsFired > 0
            ? Math.round((sim.shotsHit / sim.shotsFired) * 100)
            : 100,
        hullRemainingPct: hullPct,
        elapsedSeconds: Math.round(sim.stageElapsed),
      };
    }

    function startMission(missionId: string) {
      const m =
        MISSION_CATALOG.find((item) => item.id === missionId) ||
        MISSION_CATALOG[1];
      sim.missionId = m.id;
      startStage(m.stageId, true);
      if (m.objectiveType === 'boss_finale') {
        if (m.category === 'boss_rematch') {
          sim.stageProgress = 0.9;
          spawnStageBoss(m.stageId);
        }
      }
    }

    function startStage(stageId: StageId, resetCampaign: boolean = false) {
      clearEnemiesAndProjectiles();
      sim.stageId = stageId;
      const matchingMission = MISSION_CATALOG.find((m) => m.id === sim.missionId);
      if (!matchingMission || matchingMission.stageId !== stageId) {
        const defaultForStage = MISSION_CATALOG.find(
          (m) => m.stageId === stageId && m.category === 'campaign',
        );
        if (defaultForStage) sim.missionId = defaultForStage.id;
      }
      sim.stageElapsed = 0;
      sim.stageProgress = 0;
      sim.waveCursor = 0;
      sim.playerX = 0;
      sim.playerY = 0;
      sim.playerVelX = 0;
      sim.playerVelY = 0;
      sim.barrelRollTimer = 0;
      sim.torpedoCooldown = 0;
      sim.sonarActiveTimer = 0;
      sim.sonarWaveTimer = 0;
      sim.sonarCooldown = 0;
      sim.sonarWeakPointSlot = null;
      sim.sonarHazardsCount = 0;
      sim.lockedTargetIds = [];
      sim.hazardWarningText = null;
      sim.hullStress = 0;
      sim.maxHullStressReached = 0;
      sim.inDeepPressureZone = false;
      sim.pressureZoneLabel = null;
      sim.pressureGroanTimer = 0;
      sim.elitesDefeated = 0;
      sim.appendagesSeveredThisSortie = 0;
      sim.sonarPulsesUsedThisSortie = 0;
      sim.rollsExecutedThisSortie = 0;
      sim.beaconIntegrityPct = 100;
      lastMissionResult = null;

      playerSave.stats.totalSortiesLaunched += 1;
      persistSave();

      if (resetCampaign) {
        sim.score = 0;
        sim.combo = 0;
        sim.multiplier = 1;
        sim.maxMultiplierReached = 1;
        sim.enemiesDefeated = 0;
        sim.shotsFired = 0;
        sim.shotsHit = 0;
        sim.pressureDamageTaken = 0;
      }

      recomputeLoadoutStats();
      sim.hull = sim.maxHull;
      sim.shield = sim.maxShield;
      sim.boost = sim.maxBoost;

      applyStageAtmosphere(stageId);
      syncHudSnapshot('playing');
    }

    function getModuleTierMult(id: UpgradeId): number {
      if (!playerSave.activeUpgrades.includes(id)) return 0;
      const tier = playerSave.upgradeTiers[id] || 1;
      return 1 + (tier - 1) * 0.35;
    }

    function recomputeLoadoutStats() {
      const ship =
        SHIP_CATALOG.find((s) => s.id === playerSave.selectedShip) ||
        SHIP_CATALOG[0];
      const priWpn =
        WEAPON_CATALOG.find((w) => w.id === playerSave.equippedPrimaryWeapon) ||
        WEAPON_CATALOG[0];
      const secWpn =
        WEAPON_CATALOG.find(
          (w) => w.id === playerSave.equippedSecondaryWeapon,
        ) || WEAPON_CATALOG[3];
      const cosmetic =
        COSMETIC_CATALOG.find((c) => c.id === playerSave.equippedCosmetic) ||
        COSMETIC_CATALOG[0];

      // Enforce ship module capacity
      if (playerSave.activeUpgrades.length > ship.moduleCapacity) {
        playerSave.activeUpgrades = playerSave.activeUpgrades.slice(
          0,
          ship.moduleCapacity,
        );
      }

      sim.upgrades = [...playerSave.activeUpgrades];
      sim.maxHull = Math.round(
        ship.baseHull +
          35 * getModuleTierMult('piezo_hull_regen') +
          25 * getModuleTierMult('hadal_pressure_Bulkhead'),
      );
      sim.maxShield = Math.round(
        ship.baseShield + 40 * getModuleTierMult('voltaic_shield_capacitor'),
      );
      sim.maxLocks =
        ship.baseTorpedoLocks +
        secWpn.lockBonus +
        (sim.upgrades.includes('quad_torpedo_salvo')
          ? Math.round(2 * getModuleTierMult('quad_torpedo_salvo'))
          : 0);

      sim.shipSpeedMult = ship.baseSpeed / 22;
      sim.shipPrimaryDmgMult = ship.cannonDamageMult * (priWpn.damage / 24);
      sim.shipPrimaryFireRateMult =
        ship.fireRateMult * (0.12 / Math.max(0.05, priWpn.cooldownSeconds));
      sim.shipPrimarySpeed = priWpn.projectileSpeed;
      sim.shipSecondaryDmgMult = secWpn.damage / 88;
      sim.shipSecondaryCooldown = secWpn.cooldownSeconds;
      sim.shipSecondarySpeed = secWpn.projectileSpeed;
      sim.shipSonarDurationBonus = ship.sonarDurationBonus;
      sim.shipPressureResistBonus = ship.pressureResistancePct / 100;

      sim.hull = Math.min(sim.maxHull, sim.hull);
      sim.shield = Math.min(sim.maxShield, sim.shield);

      vanguard.setAppearance(ship.id, cosmetic.trimColorHex, {
        primaryWeaponId: playerSave.equippedPrimaryWeapon,
        secondaryWeaponId: playerSave.equippedSecondaryWeapon,
        activeUpgrades: playerSave.activeUpgrades,
        upgradeTiers: playerSave.upgradeTiers,
        pilotLevel: playerSave.pilotLevel,
      });
    }

    function buyOrToggleUpgrade(upgradeId: UpgradeId) {
      const def = UPGRADE_CATALOG.find((u) => u.id === upgradeId);
      if (!def) return;
      const ship =
        SHIP_CATALOG.find((s) => s.id === playerSave.selectedShip) ||
        SHIP_CATALOG[0];

      if (playerSave.ownedUpgrades.includes(upgradeId)) {
        if (playerSave.activeUpgrades.includes(upgradeId)) {
          playerSave.activeUpgrades = playerSave.activeUpgrades.filter(
            (id) => id !== upgradeId,
          );
          soundEngine.playSonarPing(540);
        } else {
          if (playerSave.activeUpgrades.length >= ship.moduleCapacity) {
            playerSave.activeUpgrades.shift();
          }
          playerSave.activeUpgrades = [
            ...playerSave.activeUpgrades,
            upgradeId,
          ];
          soundEngine.playPickupChime();
        }
      } else {
        if (playerSave.salvageCredits < def.cost) {
          soundEngine.playSonarPing(320);
          return;
        }
        playerSave.salvageCredits -= def.cost;
        playerSave.ownedUpgrades = [...playerSave.ownedUpgrades, upgradeId];
        playerSave.upgradeTiers[upgradeId] = 1;
        if (playerSave.activeUpgrades.length < ship.moduleCapacity) {
          playerSave.activeUpgrades = [
            ...playerSave.activeUpgrades,
            upgradeId,
          ];
        }
        soundEngine.playPickupChime();
        spawnParticleBurst(vanguard.group.position, 0xf59e0b, 16, 14);
      }

      recomputeLoadoutStats();
      persistSave();
      syncHudSnapshot();
    }

    function upgradeModuleTier(upgradeId: UpgradeId) {
      const def = UPGRADE_CATALOG.find((u) => u.id === upgradeId);
      if (!def) return;
      const currentTier = playerSave.upgradeTiers[upgradeId] || 0;
      if (currentTier >= def.maxTier) return;

      if (currentTier === 0) {
        buyOrToggleUpgrade(upgradeId);
        return;
      }

      const cost = Math.round(def.cost * 0.65 * currentTier);
      const coreCost = Math.max(1, currentTier);
      if (
        playerSave.salvageCredits < cost ||
        playerSave.abyssalMaterials < coreCost
      ) {
        soundEngine.playSonarPing(320);
        return;
      }

      playerSave.salvageCredits -= cost;
      playerSave.abyssalMaterials -= coreCost;
      playerSave.upgradeTiers[upgradeId] = currentTier + 1;
      recomputeLoadoutStats();
      soundEngine.playPickupChime();
      spawnParticleBurst(vanguard.group.position, 0xd946ef, 18, 15);
      persistSave();
      syncHudSnapshot();
    }

    function refundAllUpgrades() {
      if (playerSave.ownedUpgrades.length === 0) return;
      let refunded = 0;
      playerSave.ownedUpgrades.forEach((id) => {
        const def = UPGRADE_CATALOG.find((u) => u.id === id);
        const tier = playerSave.upgradeTiers[id] || 1;
        if (def) {
          refunded += def.cost;
          if (tier >= 2) refunded += Math.round(def.cost * 0.65);
          if (tier >= 3) refunded += Math.round(def.cost * 1.3);
        }
        playerSave.upgradeTiers[id] = 0;
      });
      playerSave.salvageCredits += refunded;
      playerSave.ownedUpgrades = [];
      playerSave.activeUpgrades = [];
      recomputeLoadoutStats();
      persistSave();
      soundEngine.playSonarPing(680);
      syncHudSnapshot();
    }

    function claimSupplyGrant() {
      playerSave.salvageCredits += 600;
      persistSave();
      soundEngine.playPickupChime();
      spawnParticleBurst(vanguard.group.position, 0x10b981, 14, 12);
      syncHudSnapshot();
    }

    function exchangeCreditsForCore() {
      if (playerSave.salvageCredits < 300) {
        soundEngine.playSonarPing(320);
        return;
      }
      playerSave.salvageCredits -= 300;
      playerSave.abyssalMaterials += 1;
      persistSave();
      soundEngine.playPickupChime();
      spawnParticleBurst(vanguard.group.position, 0xd946ef, 14, 12);
      syncHudSnapshot();
    }

    function selectShip(shipId: ShipClassId) {
      if (!playerSave.ownedShips.includes(shipId)) return;
      playerSave.selectedShip = shipId;
      recomputeLoadoutStats();
      persistSave();
      soundEngine.playPickupChime();
      syncHudSnapshot();
    }

    function buyShip(shipId: ShipClassId) {
      const def = SHIP_CATALOG.find((s) => s.id === shipId);
      if (!def || playerSave.ownedShips.includes(shipId)) return;
      if (
        playerSave.salvageCredits < def.costCredits ||
        playerSave.abyssalMaterials < def.costMaterials
      ) {
        soundEngine.playSonarPing(320);
        return;
      }
      playerSave.salvageCredits -= def.costCredits;
      playerSave.abyssalMaterials -= def.costMaterials;
      playerSave.ownedShips.push(shipId);
      playerSave.selectedShip = shipId;
      recomputeLoadoutStats();
      persistSave();
      soundEngine.playPickupChime();
      spawnParticleBurst(vanguard.group.position, 0x06b6d4, 22, 16);
      syncHudSnapshot();
    }

    function selectWeapon(weaponId: WeaponId) {
      const def = WEAPON_CATALOG.find((w) => w.id === weaponId);
      if (!def || !playerSave.ownedWeapons.includes(weaponId)) return;
      if (def.slot === 'primary') {
        playerSave.equippedPrimaryWeapon = weaponId as typeof playerSave.equippedPrimaryWeapon;
      } else {
        playerSave.equippedSecondaryWeapon = weaponId as typeof playerSave.equippedSecondaryWeapon;
      }
      recomputeLoadoutStats();
      persistSave();
      soundEngine.playPickupChime();
      syncHudSnapshot();
    }

    function buyWeapon(weaponId: WeaponId) {
      const def = WEAPON_CATALOG.find((w) => w.id === weaponId);
      if (!def || playerSave.ownedWeapons.includes(weaponId)) return;
      if (
        playerSave.salvageCredits < def.costCredits ||
        playerSave.abyssalMaterials < def.costMaterials
      ) {
        soundEngine.playSonarPing(320);
        return;
      }
      playerSave.salvageCredits -= def.costCredits;
      playerSave.abyssalMaterials -= def.costMaterials;
      playerSave.ownedWeapons.push(weaponId);
      selectWeapon(weaponId);
    }

    function selectCosmetic(cosmeticId: CosmeticId) {
      const def = COSMETIC_CATALOG.find((c) => c.id === cosmeticId);
      if (!def) return;
      if (!playerSave.ownedCosmetics.includes(cosmeticId)) {
        if (playerSave.salvageCredits < def.costCredits) {
          soundEngine.playSonarPing(320);
          return;
        }
        playerSave.salvageCredits -= def.costCredits;
        playerSave.ownedCosmetics.push(cosmeticId);
      }
      playerSave.equippedCosmetic = cosmeticId;
      recomputeLoadoutStats();
      persistSave();
      soundEngine.playPickupChime();
      syncHudSnapshot();
    }

    function setDifficulty(diff: DifficultyId) {
      playerSave.selectedDifficulty = diff;
      persistSave();
      soundEngine.playSonarPing(740);
      syncHudSnapshot();
    }

    function claimDailyObjective(dailyId: string) {
      const def = DAILY_OBJECTIVES_CATALOG.find((d) => d.id === dailyId);
      if (!def || playerSave.claimedDailyIds.includes(dailyId)) return;
      const prog = playerSave.dailyProgress[dailyId] || 0;
      if (prog < def.targetValue) return;
      playerSave.claimedDailyIds.push(dailyId);
      playerSave.salvageCredits += def.rewardCredits;
      playerSave.abyssalMaterials += def.rewardMaterials;
      applyPilotXp(playerSave, 120);
      persistSave();
      soundEngine.playPickupChime();
      syncHudSnapshot();
    }

    function claimAchievement(achId: string) {
      const def = ACHIEVEMENT_CATALOG.find((a) => a.id === achId);
      if (!def || playerSave.claimedAchievements.includes(achId)) return;
      const prog = getAchievementProgress(def, playerSave);
      if (prog < def.targetValue) return;
      playerSave.claimedAchievements.push(achId);
      playerSave.salvageCredits += def.rewardCredits;
      playerSave.abyssalMaterials += def.rewardMaterials;
      applyPilotXp(playerSave, def.rewardXp);
      persistSave();
      soundEngine.playPickupChime();
      syncHudSnapshot();
    }

    function updateCallsign(newCallsign: string) {
      playerSave.callsign = newCallsign;
      persistSave();
      syncHudSnapshot();
    }

    function updateSettings(partial: Partial<GameSettings>) {
      playerSave.settings = { ...playerSave.settings, ...partial };
      applyAudioAndGraphicsSettings();
      persistSave();
      syncHudSnapshot();
    }

    function resetSaveData() {
      playerSave = resetPlayerSave();
      lastMissionResult = null;
      applyAudioAndGraphicsSettings();
      recomputeLoadoutStats();
      syncHudSnapshot('title');
    }

    function pickBestBossSonarWeakPoint(): AppendageSlot | 'core' | null {
      if (!bossObj || !bossObj.active) return null;
      const intact = bossObj.appendages.filter((a) => !a.destroyed);
      if (intact.length === 0) return 'core';
      intact.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      return intact[0].slot;
    }

    function executeTacticalSonar() {
      if (sim.sonarCooldown > 0 || sim.sonarActiveTimer > 0) return;

      const hasVisor = sim.upgrades.includes('sonar_crit_visor');
      const visorBonus = getModuleTierMult('sonar_crit_visor');
      sim.sonarActiveTimer =
        4.5 + sim.shipSonarDurationBonus + (hasVisor ? visorBonus * 1.0 : 0);
      sim.sonarWaveTimer = 0.85;
      sim.sonarCooldown = hasVisor ? Math.max(3.5, 7.5 - visorBonus * 2.0) : 7.5;
      sim.sonarPulsesUsedThisSortie += 1;
      playerSave.stats.totalSonarPulsesUsed += 1;
      playerSave.dailyProgress.daily_sonar_3 =
        (playerSave.dailyProgress.daily_sonar_3 || 0) + 1;

      sonarWaveMesh.position.copy(vanguard.group.position);
      sonarWaveMesh.scale.setScalar(1.5);
      sonarWaveMat.opacity = 0.78;
      sonarWaveMesh.visible = true;

      soundEngine.playTacticalSonarPulse();
      triggerHaptic(24);
      spawnParticleBurst(vanguard.group.position, 0x22d3ee, 20, 18);

      // Acoustically dampen nearby incoming bio-plasma projectiles by 45%
      projectiles.forEach((p) => {
        if (
          p.active &&
          !p.isPlayer &&
          p.pos.distanceTo(vanguard.group.position) < 68
        ) {
          p.vel.multiplyScalar(0.55);
          spawnParticleBurst(p.pos, 0x22d3ee, 4, 8);
        }
      });

      // Expose & auto-lock Leviathan weak point if boss is active
      if (bossObj && bossObj.active) {
        const weakSlot = pickBestBossSonarWeakPoint();
        sim.sonarWeakPointSlot = weakSlot;
        if (weakSlot && weakSlot !== 'core') {
          const weakApp = bossObj.appendages.find((a) => a.slot === weakSlot);
          if (weakApp && !sim.lockedTargetIds.includes(weakApp.numericId)) {
            if (sim.lockedTargetIds.length >= sim.maxLocks) {
              sim.lockedTargetIds.shift();
            }
            sim.lockedTargetIds.push(weakApp.numericId);
          }
        } else if (weakSlot === 'core') {
          if (!sim.lockedTargetIds.includes(bossObj.id)) {
            if (sim.lockedTargetIds.length >= sim.maxLocks) {
              sim.lockedTargetIds.shift();
            }
            sim.lockedTargetIds.push(bossObj.id);
          }
        }
      } else {
        sim.sonarWeakPointSlot = null;
      }

      // Auto-lock nearby abyssal mines & telegraphing enemies
      enemies.forEach((e) => {
        if (
          e.active &&
          (e.type === 'hazard_mine' || e.isFiringWindup) &&
          !sim.lockedTargetIds.includes(e.id) &&
          sim.lockedTargetIds.length < sim.maxLocks
        ) {
          sim.lockedTargetIds.push(e.id);
          e.locked = true;
        }
      });

      syncHudSnapshot();
    }

    function executeBarrelRoll() {
      const rollCost = sim.upgrades.includes('hydro_thruster_coil') ? 20 : 26;
      if (sim.barrelRollTimer <= 0 && sim.boost >= rollCost) {
        sim.boost -= rollCost;
        sim.barrelRollTimer = sim.upgrades.includes('hydro_thruster_coil')
          ? 0.56
          : 0.45;
        sim.rollsExecutedThisSortie += 1;
        sim.barrelRollDir =
          heldKeys.has('KeyA') || heldKeys.has('ArrowLeft') || touchMoveX < -0.2
            ? 1
            : heldKeys.has('KeyD') ||
                heldKeys.has('ArrowRight') ||
                touchMoveX > 0.2
              ? -1
              : 1;
        soundEngine.playBarrelRoll();
        triggerHaptic(18);
        spawnParticleBurst(vanguard.group.position, 0x38bdf8, 16, 14);

        // If Voltaic Shield Capacitor upgrade is active, EMP clear nearby enemy plasma bolts
        if (sim.upgrades.includes('voltaic_shield_capacitor')) {
          projectiles.forEach((p) => {
            if (
              p.active &&
              !p.isPlayer &&
              p.pos.distanceTo(vanguard.group.position) < 24
            ) {
              p.active = false;
              p.mesh.visible = false;
              spawnParticleBurst(p.pos, 0xa855f7, 6, 10);
            }
          });
        }
      }
    }

    function firePrimaryCannons() {
      const overcharged = sim.upgrades.includes('cavitation_overcharge');
      const overchargeMult = 1 + 0.35 * getModuleTierMult('cavitation_overcharge');
      const boltSpeed = sim.shipPrimarySpeed * (overcharged ? 1.15 : 1);
      const boltDamage = Math.round(
        24 * sim.shipPrimaryDmgMult * (overcharged ? overchargeMult : 1),
      );

      // Aim point in world space (-65 units ahead along reticle vector)
      _vec3C.set(sim.aimX * 26, sim.aimY * 16, -65);

      const offsets = [-1.85, 1.85];
      let firedAny = false;
      offsets.forEach((ox) => {
        for (let i = 0; i < 50; i++) {
          const p = projectiles[i];
          if (!p.active) {
            p.active = true;
            p.isPlayer = true;
            p.isTorpedo = false;
            p.pos.set(
              vanguard.group.position.x + ox,
              vanguard.group.position.y - 0.1,
              vanguard.group.position.z - 1.2,
            );
            _vec3B.subVectors(_vec3C, p.pos).normalize();
            p.vel.copy(_vec3B).multiplyScalar(boltSpeed);
            p.damage = boltDamage;
            p.life = 1.6;
            p.targetEnemyId = null;
            p.mesh.position.copy(p.pos);
            p.mesh.lookAt(_vec3C);
            p.mesh.visible = true;
            firedAny = true;
            break;
          }
        }
      });

      if (firedAny) {
        sim.shotsFired += 2;
        vanguard.triggerWeaponFire(false);
        soundEngine.playLaserShot(overcharged);
      }
    }

    function launchTorpedoSalvo() {
      if (sim.torpedoCooldown > 0) return;

      // If no targets are pre-locked, automatically lock up to maxLocks active targets (prioritizing intact boss appendages!)
      if (sim.lockedTargetIds.length === 0) {
        if (bossObj && bossObj.active) {
          for (const app of bossObj.appendages) {
            if (!app.destroyed && sim.lockedTargetIds.length < sim.maxLocks) {
              sim.lockedTargetIds.push(app.numericId);
            }
          }
          if (sim.lockedTargetIds.length < sim.maxLocks) {
            sim.lockedTargetIds.push(bossObj.id);
            bossObj.locked = true;
          }
        }
        for (const e of enemies) {
          if (e.active && sim.lockedTargetIds.length < sim.maxLocks) {
            sim.lockedTargetIds.push(e.id);
            e.locked = true;
          }
        }
      }

      if (sim.lockedTargetIds.length === 0) return;

      let launched = 0;
      const baseTorpDmg = sim.upgrades.includes('quad_torpedo_salvo') ? 105 : 88;
      const torpDamage = Math.round(baseTorpDmg * sim.shipSecondaryDmgMult);

      sim.lockedTargetIds.forEach((targetId, idx) => {
        for (let i = 50; i < 66; i++) {
          const p = projectiles[i];
          if (!p.active) {
            p.active = true;
            p.isPlayer = true;
            p.isTorpedo = true;
            const side = idx % 2 === 0 ? -1.2 : 1.2;
            p.pos.set(
              vanguard.group.position.x + side,
              vanguard.group.position.y - 0.35,
              vanguard.group.position.z - 0.8,
            );
            p.vel.set(side * 6, 4 + (idx % 3) * 2, -sim.shipSecondarySpeed * 0.72);
            p.targetEnemyId = targetId;
            p.damage = torpDamage;
            p.life = 3.2;
            p.mesh.position.copy(p.pos);
            p.mesh.visible = true;
            launched++;
            break;
          }
        }
      });

      if (launched > 0) {
        sim.shotsFired += launched;
        playerSave.stats.totalTorpedoesFired += launched;
        vanguard.triggerWeaponFire(true);
        spawnParticleBurst(vanguard.group.position, 0xff7b00, 14, 16);
        const salvoReloadFactor = sim.upgrades.includes('quad_torpedo_salvo')
          ? Math.max(0.55, 1 - 0.22 * getModuleTierMult('quad_torpedo_salvo'))
          : 1;
        sim.torpedoCooldown = sim.shipSecondaryCooldown * salvoReloadFactor;
        soundEngine.playTorpedoLaunch(launched);
        triggerHaptic([16, 20, 26]);
        sim.lockedTargetIds = [];
        enemies.forEach((e) => {
          e.locked = false;
        });
        if (bossObj) bossObj.locked = false;
      }
    }

    function fireEnemyPlasma(
      origin: THREE.Vector3,
      aimAtPlayer: boolean = true,
      customVel?: THREE.Vector3,
    ) {
      for (let i = 66; i < PROJECTILE_POOL_SIZE; i++) {
        const p = projectiles[i];
        if (!p.active) {
          p.active = true;
          p.isPlayer = false;
          p.isTorpedo = false;
          p.pos.copy(origin);
          if (customVel) {
            p.vel.copy(customVel);
          } else if (aimAtPlayer) {
            _vec3B
              .subVectors(vanguard.group.position, origin)
              .normalize()
              .multiplyScalar(42);
            p.vel.copy(_vec3B);
          } else {
            p.vel.set(0, 0, 44);
          }
          p.damage = 16;
          p.life = 3.6;
          p.mesh.position.copy(p.pos);
          p.mesh.visible = true;
          break;
        }
      }
    }

    function damagePlayer(rawAmount: number) {
      if (sim.barrelRollTimer > 0) {
        // Deflected by hydro-barrel roll i-frames!
        soundEngine.playSonarPing(960);
        return;
      }

      const diffMult =
        DIFFICULTY_CONFIGS[playerSave.selectedDifficulty].enemyDamageMult;
      const amount = Math.max(1, Math.round(rawAmount * diffMult));

      sim.shieldRegenDelay = 3.2;
      sim.cameraShake = Math.min(
        1.0,
        sim.cameraShake + 0.55 * (playerSave.settings.cameraShakeIntensity / 100),
      );
      sim.hitstopTimer = 0.045;
      soundEngine.playImpact(true);
      triggerHaptic([32, 18, 32]);
      spawnParticleBurst(vanguard.group.position, 0xf43f5e, 18, 16);

      // Flash shield wireframe
      (vanguard.shieldSphere.material as THREE.MeshBasicMaterial).opacity =
        0.75;

      if (sim.shield >= amount) {
        sim.shield -= amount;
      } else {
        const leftover = amount - sim.shield;
        sim.shield = 0;
        sim.hull = Math.max(0, sim.hull - leftover);
      }

      sim.combo = 0;
      sim.multiplier = 1;

      if (sim.hull <= 0) {
        finalizeSortie(false);
        syncHudSnapshot('game_over');
      }
    }

    function syncHudSnapshot(overrideMode?: GameStateMode) {
      const cfg = STAGE_CONFIGS[sim.stageId];
      const activeMission = getActiveMission();
      const currentDepth = Math.round(
        THREE.MathUtils.lerp(cfg.depthStart, cfg.depthEnd, sim.stageProgress),
      );
      if (sim.score > playerSave.highScore) {
        playerSave.highScore = Math.round(sim.score);
      }

      let objCurrent = sim.enemiesDefeated;
      if (activeMission.objectiveType === 'hunt_elites') {
        objCurrent = sim.elitesDefeated;
      } else if (activeMission.objectiveType === 'boss_finale') {
        objCurrent = bossObj ? 0 : sim.stageProgress >= 0.99 ? 1 : 0;
      }

      let flightSchoolStep: string | null = null;
      if (activeMission.objectiveType === 'flight_school') {
        if (sim.shotsFired < 4) {
          flightSchoolStep =
            'DRILL 1/4: Hold FIRE (or Auto-Fire) to test Bio-Plasma Cannons';
        } else if (sim.sonarPulsesUsedThisSortie < 1) {
          flightSchoolStep =
            'DRILL 2/4: Tap SONAR to scan hazards & reveal weak points';
        } else if (sim.rollsExecutedThisSortie < 1) {
          flightSchoolStep =
            'DRILL 3/4: Tap EVADE to perform a Hydro-Barrel Roll';
        } else {
          flightSchoolStep = `DRILL 4/4: Lock & Destroy Training Targets (${sim.enemiesDefeated}/${activeMission.targetKillsRequired})`;
        }
      }

      const sonarActive = sim.sonarActiveTimer > 0;
      const unlockedStages = getUnlockedStagesFromSave(playerSave);

      onHudUpdateRef.current({
        mode: overrideMode ?? modeRef.current,
        stageId: sim.stageId,
        stageTitle: cfg.title,
        stageSubtitle: cfg.zoneSubtitle,
        missionId: activeMission.id,
        missionTitle: activeMission.title,
        missionCategory: activeMission.category,
        objectiveType: activeMission.objectiveType,
        primaryObjectiveText: activeMission.primaryObjectiveText,
        optionalObjectiveText: activeMission.optionalObjectiveText,
        objectiveProgressCurrent: Math.min(
          activeMission.targetKillsRequired,
          objCurrent,
        ),
        objectiveProgressTarget: activeMission.targetKillsRequired,
        optionalObjectiveCompleted: evaluateOptionalObjective(),
        flightSchoolStepText: flightSchoolStep,
        beaconIntegrityPct: Math.round(sim.beaconIntegrityPct),
        difficulty: playerSave.selectedDifficulty,
        depthMeters: currentDepth,
        stageProgress: sim.stageProgress,
        depthStratumName: sim.depthStratumName,
        ambientLightPct: sim.ambientLightPct,
        ambientColorHex: sim.ambientColorHex,
        keyLightIntensity: sim.keyLightIntensity,
        hull: Math.ceil(sim.hull),
        maxHull: sim.maxHull,
        hullStress: Math.round(sim.hullStress),
        pressureDamageTaken: Math.round(sim.pressureDamageTaken),
        inDeepPressureZone: sim.inDeepPressureZone,
        pressureZoneLabel: sim.pressureZoneLabel,
        shield: Math.ceil(sim.shield),
        maxShield: sim.maxShield,
        boost: Math.round(sim.boost),
        maxBoost: sim.maxBoost,
        score: Math.round(sim.score),
        highScore: Math.round(playerSave.highScore),
        combo: sim.combo,
        multiplier: sim.multiplier,
        lockedCount: sim.lockedTargetIds.length,
        maxLocks: sim.maxLocks,
        torpedoCooldown: Math.max(
          0,
          Math.min(
            1,
            sim.torpedoCooldown / Math.max(0.5, sim.shipSecondaryCooldown),
          ),
        ),
        sonarActive,
        sonarRemainingSeconds: Math.max(0, sim.sonarActiveTimer),
        sonarCooldown: Math.max(0, Math.min(1, sim.sonarCooldown / 7.5)),
        sonarWeakPointSlot: sonarActive ? sim.sonarWeakPointSlot : null,
        sonarHazardsCount: sonarActive ? sim.sonarHazardsCount : 0,
        barrelRolling: sim.barrelRollTimer > 0,
        bossActive: Boolean(bossObj && bossObj.active),
        bossName: cfg.bossName,
        bossSubtitle: cfg.bossSubtitle,
        bossHp: bossObj ? Math.max(0, Math.ceil(bossObj.hp)) : 0,
        bossMaxHp: bossObj ? bossObj.maxHp : cfg.bossMaxHp,
        bossPhase: bossObj ? bossObj.phase : 1,
        bossTelegraphText: bossObj ? bossObj.telegraphLabel : null,
        bossAppendages: bossObj
          ? bossObj.appendages.map((a): BossAppendageState => {
              const hpRatio = a.hp / Math.max(1, a.maxHp);
              const damageRatio = a.destroyed
                ? 1
                : Math.max(0, 1 - hpRatio);
              return {
                id: a.id,
                slot: a.slot,
                name: a.name,
                hp: Math.max(0, Math.ceil(a.hp)),
                maxHp: a.maxHp,
                destroyed: a.destroyed,
                recentHit: a.hitFlashTimer > 0,
                isSonarWeakPoint:
                  sonarActive &&
                  !a.destroyed &&
                  sim.sonarWeakPointSlot === a.slot,
                leakIntensity: Number(damageRatio.toFixed(2)),
                isCritical: !a.destroyed && hpRatio <= 0.45,
                tacticalEffect: a.tacticalEffect,
              };
            })
          : [],
        lastSeveredPartName: bossObj ? bossObj.lastSeveredPartName : null,
        hazardWarningText: sim.hazardWarningText,
        enemiesDefeated: sim.enemiesDefeated,
        shotsFired: sim.shotsFired,
        shotsHit: sim.shotsHit,
        stageElapsedSeconds: Math.round(sim.stageElapsed),
        salvageCredits: Math.round(playerSave.salvageCredits),
        abyssalMaterials: playerSave.abyssalMaterials,
        ownedUpgrades: [...playerSave.ownedUpgrades],
        activeUpgrades: [...playerSave.activeUpgrades],
        unlockedStages,
        saveData: {
          ...playerSave,
          ownedShips: [...playerSave.ownedShips],
          ownedWeapons: [...playerSave.ownedWeapons],
          ownedUpgrades: [...playerSave.ownedUpgrades],
          activeUpgrades: [...playerSave.activeUpgrades],
          ownedCosmetics: [...playerSave.ownedCosmetics],
          claimedAchievements: [...playerSave.claimedAchievements],
          claimedDailyIds: [...playerSave.claimedDailyIds],
        },
        lastMissionResult,
      });
    }

    function focusBossAppendage(slot: AppendageSlot) {
      if (!bossObj || !bossObj.active) return;
      const app = bossObj.appendages.find((a) => a.slot === slot);
      if (!app || app.destroyed) return;
      if (!sim.lockedTargetIds.includes(app.numericId)) {
        if (sim.lockedTargetIds.length >= sim.maxLocks) {
          sim.lockedTargetIds.shift();
        }
        sim.lockedTargetIds.push(app.numericId);
        soundEngine.playSonarPing(860);
      }
      if (sim.torpedoCooldown <= 0) {
        launchTorpedoSalvo();
      } else {
        syncHudSnapshot();
      }
    }

    function summonBossNow() {
      if (modeRef.current !== 'playing') return;
      if (bossObj && bossObj.active) return;
      const activeMission = getActiveMission();
      enemies.forEach((e) => {
        scene.remove(e.group);
        disposeGroupGeometries(e.group);
      });
      enemies.length = 0;
      sim.waveCursor = activeMission.waves.length;
      sim.stageElapsed = activeMission.durationSeconds;
      sim.stageProgress = 0.9;
      spawnStageBoss(sim.stageId);
    }

    let lastPreviewedShipId: ShipClassId = playerSave.selectedShip;
    let lastPreviewedCosmeticId: CosmeticId = playerSave.equippedCosmetic;
    let shipSwitchAnimTimer = 0;
    let thrusterSurgeTimer = 0;

    function previewShip(shipId: ShipClassId, cosmeticId?: CosmeticId) {
      const targetCosmeticId = cosmeticId || playerSave.equippedCosmetic;
      const cosmetic =
        COSMETIC_CATALOG.find((c) => c.id === targetCosmeticId) ||
        COSMETIC_CATALOG[0];
      const changed =
        shipId !== lastPreviewedShipId ||
        targetCosmeticId !== lastPreviewedCosmeticId;

      vanguard.setAppearance(shipId, cosmetic.trimColorHex, {
        primaryWeaponId: playerSave.equippedPrimaryWeapon,
        secondaryWeaponId: playerSave.equippedSecondaryWeapon,
        activeUpgrades: playerSave.activeUpgrades,
        upgradeTiers: playerSave.upgradeTiers,
        pilotLevel: playerSave.pilotLevel,
      });
      dockRingInnerMat.color.setHex(cosmetic.trimColorHex);
      shipPointLight.color.setHex(cosmetic.trimColorHex);

      if (changed) {
        lastPreviewedShipId = shipId;
        lastPreviewedCosmeticId = targetCosmeticId;
        shipSwitchAnimTimer = 0.65;
        thrusterSurgeTimer = 0.85;
        vanguard.group.scale.setScalar(0.86);
        const shieldMat = vanguard.shieldSphere
          .material as THREE.MeshBasicMaterial;
        shieldMat.opacity = 0.52;
        spawnParticleBurst(
          vanguard.group.position,
          cosmetic.trimColorHex,
          22,
          14,
        );
        soundEngine.playSonarPing(820);
      }
    }

    // Register imperative controller with parent App
    recomputeLoadoutStats();
    onRegisterController({
      startStage,
      startMission,
      setMode: (nextMode: GameStateMode) => {
        if (nextMode === 'title') {
          recomputeLoadoutStats();
        }
        syncHudSnapshot(nextMode);
      },
      buyOrToggleUpgrade,
      upgradeModuleTier,
      refundAllUpgrades,
      claimSupplyGrant,
      exchangeCreditsForCore,
      selectShip,
      buyShip,
      selectWeapon,
      buyWeapon,
      selectCosmetic,
      previewShip,
      setDifficulty,
      claimDailyObjective,
      claimAchievement,
      updateCallsign,
      updateSettings,
      resetSaveData,
      setTouchInput: (x: number, y: number) => {
        touchMoveX = x;
        touchMoveY = y;
      },
      setTouchFiring: (firing: boolean) => {
        touchFiring = firing;
      },
      triggerBarrelRoll: executeBarrelRoll,
      triggerTorpedoSalvo: launchTorpedoSalvo,
      triggerTacticalSonar: executeTacticalSonar,
      focusBossAppendage,
      summonBossNow,
    });

    // 12. Mobile-First Touch & Pointer Input Handling (Orbit, Pinch-Zoom, Touch-Drag Aim & Tap-Lock)
    const heldKeys = new Set<string>();
    let pointerFiring = false;
    let isDraggingHangarShip = false;
    let isTouchAimDragging = false;
    let touchAimPointerId: number | null = null;
    let touchAimDownTime = 0;
    let touchAimDownX = 0;
    let touchAimDownY = 0;
    let dragLastClientX = 0;
    let dragLastClientY = 0;
    let hangarUserYaw = -0.35;
    let hangarUserPitch = 0.08;
    let hangarZoom = 1.0;
    let hangarCenteredInspect = false;
    const camLookTarget = new THREE.Vector3(0, 0, 0);
    const activeCanvasPointers = new Map<number, { x: number; y: number }>();
    let lastPinchDist: number | null = null;

    const getPinchDistance = (): number | null => {
      if (activeCanvasPointers.size < 2) return null;
      const pts = Array.from(activeCanvasPointers.values());
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };

    const handleHangarCameraEvent = (ev: Event) => {
      const custom = ev as CustomEvent<{
        action:
          | 'zoomIn'
          | 'zoomOut'
          | 'resetView'
          | 'testThrusters'
          | 'centerInspect'
          | 'splitInspect';
      }>;
      const action = custom.detail?.action;
      if (action === 'zoomIn') {
        hangarZoom = THREE.MathUtils.clamp(hangarZoom - 0.14, 0.65, 1.48);
      } else if (action === 'zoomOut') {
        hangarZoom = THREE.MathUtils.clamp(hangarZoom + 0.14, 0.65, 1.48);
      } else if (action === 'resetView') {
        hangarZoom = 1.0;
        hangarUserYaw = -0.38;
        hangarUserPitch = 0.08;
      } else if (action === 'testThrusters') {
        thrusterSurgeTimer = 2.75;
        spawnExhaustEmberJet(28, 32);
        soundEngine.playThrusterIgnite();
        triggerHaptic([25, 30, 45, 25, 35]);
      } else if (action === 'centerInspect') {
        hangarCenteredInspect = true;
      } else if (action === 'splitInspect') {
        hangarCenteredInspect = false;
      }
    };
    window.addEventListener('pelagic-hangar-camera', handleHangarCameraEvent);

    const handleWheel = (e: WheelEvent) => {
      if (
        modeRef.current === 'hangar' ||
        modeRef.current === 'market' ||
        modeRef.current === 'title' ||
        modeRef.current === 'campaign_map' ||
        modeRef.current === 'briefing'
      ) {
        hangarZoom = THREE.MathUtils.clamp(
          hangarZoom + e.deltaY * 0.0012,
          0.65,
          1.48,
        );
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      heldKeys.add(e.code);

      if (e.code === 'Escape') {
        e.preventDefault();
        if (modeRef.current === 'playing') {
          syncHudSnapshot('paused');
        } else if (modeRef.current === 'paused') {
          syncHudSnapshot('playing');
        } else if (modeRef.current !== 'title') {
          soundEngine.playSonarPing(660);
          recomputeLoadoutStats();
          syncHudSnapshot('title');
        }
        return;
      }

      if (modeRef.current !== 'playing') return;

      if (e.code === 'Space') {
        e.preventDefault();
        sim.rollBufferTimer = 0.14;
      } else if (e.code === 'KeyK' || e.code === 'KeyE') {
        e.preventDefault();
        launchTorpedoSalvo();
      } else if (e.code === 'KeyQ' || e.code === 'KeyF') {
        e.preventDefault();
        executeTacticalSonar();
      } else if (e.code === 'KeyC') {
        onToggleCameraRef.current();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      heldKeys.delete(e.code);
    };

    const handleWindowBlur = () => {
      heldKeys.clear();
      activeCanvasPointers.clear();
      lastPinchDist = null;
      pointerFiring = false;
      isDraggingHangarShip = false;
      isTouchAimDragging = false;
      touchAimPointerId = null;
      touchFiring = false;
      touchMoveX = 0;
      touchMoveY = 0;
      if (modeRef.current === 'playing') {
        syncHudSnapshot('paused');
      }
    };

    const tryTapLockNearestTarget = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const tapX = clientX - rect.left;
      const tapY = clientY - rect.top;

      let bestId: number | null = null;
      let bestDist = 90;

      const checkTarget = (id: number, worldPos: THREE.Vector3) => {
        _vec3A.copy(worldPos).project(camera);
        if (_vec3A.z > 1) return;
        const sx = (_vec3A.x * 0.5 + 0.5) * rect.width;
        const sy = (-(_vec3A.y * 0.5) + 0.5) * rect.height;
        const d = Math.hypot(sx - tapX, sy - tapY);
        if (d < bestDist) {
          bestDist = d;
          bestId = id;
        }
      };

      enemies.forEach((e) => {
        if (e.active) checkTarget(e.id, e.group.position);
      });
      if (bossObj && bossObj.active) {
        bossObj.appendages.forEach((app) => {
          if (!app.destroyed) checkTarget(app.numericId, app.worldPos);
        });
        checkTarget(bossObj.id, bossObj.group.position);
      }

      if (bestId !== null) {
        if (!sim.lockedTargetIds.includes(bestId)) {
          if (sim.lockedTargetIds.length >= sim.maxLocks) {
            sim.lockedTargetIds.shift();
          }
          sim.lockedTargetIds.push(bestId);
          soundEngine.playSonarPing(820);
          triggerHaptic(12);
        }
        // Snap reticle smoothly toward tapped position
        sim.aimX = THREE.MathUtils.clamp((tapX / rect.width) * 2 - 1, -0.92, 0.92);
        sim.aimY = THREE.MathUtils.clamp(-((tapY / rect.height) * 2 - 1), -0.85, 0.85);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (activeCanvasPointers.has(e.pointerId)) {
        activeCanvasPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      if (modeRef.current !== 'playing') {
        if (activeCanvasPointers.size >= 2) {
          const dist = getPinchDistance();
          if (dist !== null && lastPinchDist !== null) {
            const delta = lastPinchDist - dist;
            hangarZoom = THREE.MathUtils.clamp(
              hangarZoom + delta * 0.0035,
              0.65,
              1.48,
            );
          }
          lastPinchDist = dist;
          return;
        }
        if (isDraggingHangarShip) {
          const dx = e.clientX - dragLastClientX;
          const dy = e.clientY - dragLastClientY;
          dragLastClientX = e.clientX;
          dragLastClientY = e.clientY;
          hangarUserYaw += dx * 0.009;
          hangarUserPitch = THREE.MathUtils.clamp(
            hangarUserPitch + dy * 0.0055,
            -0.32,
            0.42,
          );
        }
        return;
      }

      // In-flight mobile touch-drag aiming on the open 3D screen
      if (isTouchAimDragging && touchAimPointerId === e.pointerId) {
        const rect = renderer.domElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const dx = e.clientX - dragLastClientX;
        const dy = e.clientY - dragLastClientY;
        dragLastClientX = e.clientX;
        dragLastClientY = e.clientY;
        const sens = (playerSave.settings.joystickSensitivity / 100) * 1.65;
        sim.aimX = THREE.MathUtils.clamp(
          sim.aimX + (dx / rect.width) * 2 * sens,
          -0.95,
          0.95,
        );
        sim.aimY = THREE.MathUtils.clamp(
          sim.aimY - (dy / rect.height) * 2 * sens,
          -0.88,
          0.88,
        );
      } else if (e.pointerType === 'mouse' && !playerSave.settings.touchControlsEnabled) {
        const rect = renderer.domElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
        sim.aimX = THREE.MathUtils.clamp(nx, -0.95, 0.95);
        sim.aimY = THREE.MathUtils.clamp(ny, -0.88, 0.88);
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      activeCanvasPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (modeRef.current !== 'playing') {
        if (activeCanvasPointers.size >= 2) {
          lastPinchDist = getPinchDistance();
          isDraggingHangarShip = false;
          return;
        }
        isDraggingHangarShip = true;
        dragLastClientX = e.clientX;
        dragLastClientY = e.clientY;
        return;
      }

      // In-flight touch/pointer on canvas: drag to aim, quick tap to lock enemy
      isTouchAimDragging = true;
      touchAimPointerId = e.pointerId;
      touchAimDownTime = performance.now();
      touchAimDownX = e.clientX;
      touchAimDownY = e.clientY;
      dragLastClientX = e.clientX;
      dragLastClientY = e.clientY;

      if (!playerSave.settings.touchControlsEnabled && e.button === 0) {
        pointerFiring = true;
      } else if (e.button === 2) {
        e.preventDefault();
        launchTorpedoSalvo();
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      activeCanvasPointers.delete(e.pointerId);
      if (activeCanvasPointers.size < 2) {
        lastPinchDist = null;
      }

      if (modeRef.current === 'playing' && touchAimPointerId === e.pointerId) {
        const dtMs = performance.now() - touchAimDownTime;
        const moveDist = Math.hypot(
          e.clientX - touchAimDownX,
          e.clientY - touchAimDownY,
        );
        if (dtMs < 260 && moveDist < 18) {
          tryTapLockNearestTarget(e.clientX, e.clientY);
        }
        isTouchAimDragging = false;
        touchAimPointerId = null;
      }

      if (e.button === 0 || activeCanvasPointers.size === 0) {
        pointerFiring = false;
        isDraggingHangarShip = false;
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (modeRef.current === 'playing') {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    const domCanvas = renderer.domElement;
    domCanvas.addEventListener('pointermove', handlePointerMove);
    domCanvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    domCanvas.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('wheel', handleWheel, { passive: true });

    const handleResize = () => {
      const nw = container.clientWidth || window.innerWidth;
      const nh = container.clientHeight || window.innerHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', handleResize);

    // Pre-warm shaders on hardware GPU
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 13. Main 60fps Simulation Loop with Software WebGL Fence Sync Pacing
    const clock = new THREE.Clock();
    let frameId = 0;
    let hudSyncAccumulator = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync
        ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
        : null;
      if (gl.flush) gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    let lastFrameRenderTime = 0;
    function tick() {
      const nowMs = performance.now();
      if (playerSave.settings.fpsCap === 30 && nowMs - lastFrameRenderTime < 31) {
        frameId = requestAnimationFrame(tick);
        return;
      }
      lastFrameRenderTime = nowMs;

      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.getElapsedTime();
      const currentMode = modeRef.current;

      // Hitstop pause for impactful heavy hits
      if (sim.hitstopTimer > 0) {
        sim.hitstopTimer -= dt;
        renderer.render(scene, camera);
        if (isSoftwareGl) afterDraw(tick);
        else frameId = requestAnimationFrame(tick);
        return;
      }

      if (shipSwitchAnimTimer > 0) {
        shipSwitchAnimTimer = Math.max(0, shipSwitchAnimTimer - dt);
      }
      if (thrusterSurgeTimer > 0) {
        thrusterSurgeTimer = Math.max(0, thrusterSurgeTimer - dt);
        // Continuously eject turbulent incandescent embers out of the stern nozzles during Ignite
        if (thrusterSurgeTimer > 0.35 && Math.random() < 0.85) {
          spawnExhaustEmberJet(3, 28);
        }
      }

      // Compute 3-stage realistic afterburner ignition envelope:
      // Stage 1 (0.0-0.3s): Spool-up flash | Stage 2 (0.3-2.15s): Full afterburner roar | Stage 3 (2.15-2.75s): Taper down
      let igniteBoost = 1.0;
      if (thrusterSurgeTimer > 0) {
        const elapsedIgnite = 2.75 - thrusterSurgeTimer;
        if (elapsedIgnite < 0.3) {
          igniteBoost = 1.0 + (elapsedIgnite / 0.3) * 1.65;
        } else if (thrusterSurgeTimer > 0.6) {
          igniteBoost = 2.6 + Math.sin(elapsed * 42) * 0.12;
        } else {
          igniteBoost = 1.0 + (thrusterSurgeTimer / 0.6) * 1.6;
        }
      }
      const surgeBoost =
        sim.barrelRollTimer > 0 ? 2.4 : igniteBoost;
      vanguard.updateShipEffects(elapsed, dt, surgeBoost);

      const shieldMat = vanguard.shieldSphere
        .material as THREE.MeshBasicMaterial;
      if (sim.barrelRollTimer > 0) {
        shieldMat.opacity = 0.45;
      } else if (shieldMat.opacity > 0) {
        shieldMat.opacity = Math.max(0, shieldMat.opacity - dt * 2.2);
      }

      // Scroll Instanced Trench Pillars & Bioluminescent Plankton
      const worldForwardSpeed =
        currentMode === 'playing'
          ? sim.barrelRollTimer > 0
            ? 56
            : 38
          : 18;

      for (let i = 0; i < PILLAR_COUNT; i++) {
        const pd = pillarData[i];
        pd.z += worldForwardSpeed * dt;
        if (pd.z > 24) {
          pd.z -= PILLAR_COUNT * 3.2;
        }
        _vec3A.set(pd.x, pd.y, pd.z);
        _euler.set(pd.rotX, 0, pd.rotZ);
        _quat.setFromEuler(_euler);
        _scale.set(pd.scaleX, pd.scaleY, pd.scaleX);
        _mat4.compose(_vec3A, _quat, _scale);
        pillarInstanced.setMatrixAt(i, _mat4);
      }
      pillarInstanced.instanceMatrix.needsUpdate = true;

      for (let i = 0; i < PLANKTON_COUNT; i++) {
        const pk = planktonCoords[i];
        pk.z += (worldForwardSpeed + pk.speed) * dt;
        if (pk.z > 22) {
          pk.z = -175;
          pk.x = (Math.random() - 0.5) * 68;
          pk.y = (Math.random() - 0.5) * 44;
        }
        _vec3A.set(pk.x, pk.y, pk.z);
        _quat.identity();
        const s = 0.65 + (i % 4) * 0.25;
        _scale.set(s, s, s);
        _mat4.compose(_vec3A, _quat, _scale);
        planktonInstanced.setMatrixAt(i, _mat4);
      }
      planktonInstanced.instanceMatrix.needsUpdate = true;

      // Update Pooled Particle Bursts
      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const p = particles[i];
        if (p.active) {
          p.life += dt;
          if (p.life >= p.maxLife) {
            p.active = false;
            _vec3A.set(0, -999, 0);
            _scale.set(0, 0, 0);
          } else {
            p.pos.addScaledVector(p.vel, dt);
            const t = 1 - p.life / p.maxLife;
            _vec3A.copy(p.pos);
            _scale.setScalar(p.scale * t);
          }
          _quat.identity();
          _mat4.compose(_vec3A, _quat, _scale);
          burstInstanced.setMatrixAt(i, _mat4);
        }
      }
      burstInstanced.instanceMatrix.needsUpdate = true;

      if (
        currentMode === 'title' ||
        currentMode === 'market' ||
        currentMode === 'hangar' ||
        currentMode === 'campaign_map' ||
        currentMode === 'briefing' ||
        currentMode === 'rewards' ||
        currentMode === 'profile' ||
        currentMode === 'settings'
      ) {
        // Seamless 3D Abyssal Command Berth & Camera Choreography around the live hero craft
        hangarBerthGroup.visible = true;
        vanguard.group.visible = true;

        const titleDepthWave = (Math.sin(elapsed * 0.35) + 1) * 0.5;
        updateDepthAtmosphere(selectedStageRef.current, titleDepthWave, 0, dt);

        // Animate underwater berth rings & volumetric floodlights
        dockRingInner.rotation.z = elapsed * (thrusterSurgeTimer > 0 ? 1.1 : 0.3);
        dockRingOuter.rotation.z = -elapsed * 0.18;
        volumetricCones.forEach((cone, idx) => {
          cone.rotation.x = Math.sin(elapsed * 0.5 + idx) * 0.05;
        });

        const idleBob = Math.sin(elapsed * 1.65) * 0.11;
        const idlePitch = Math.sin(elapsed * 1.1) * 0.04;
        const idleRoll = Math.cos(elapsed * 0.95) * 0.05;

        let targetShipX = 0;
        let targetShipY = -0.05 + idleBob;
        let targetShipScale = 1.28;
        let targetShipYaw =
          -0.38 + Math.sin(elapsed * 0.45) * 0.14 + hangarUserYaw + sim.aimX * 0.16;

        let targetCamX = 0.25 + sim.aimX * 0.32;
        let targetCamY = 1.05 + hangarUserPitch * 1.6 + sim.aimY * 0.18;
        let targetCamZ = 5.45 * hangarZoom;

        let targetLookX = 0;
        let targetLookY = -0.05;
        let targetLookZ = 0;

        const isCenteredMobileOrInspect =
          hangarCenteredInspect || window.innerWidth < 1024;
        const isPortraitViewport = window.innerHeight > window.innerWidth;
        const portraitSheetOffsetY =
          !hangarCenteredInspect && isPortraitViewport ? -0.72 : -0.05;

        if (currentMode === 'title') {
          targetShipX = 0;
          targetShipScale = isPortraitViewport ? 1.15 : 1.28;
          targetCamX = 0.25 + sim.aimX * 0.32;
          targetCamY =
            (isPortraitViewport ? 1.28 : 1.05) +
            hangarUserPitch * 1.6 +
            sim.aimY * 0.18;
          targetCamZ = (isPortraitViewport ? 5.95 : 5.45) * hangarZoom;
          targetLookY = isPortraitViewport ? -0.22 : -0.05;
        } else if (currentMode === 'hangar') {
          targetShipX = isCenteredMobileOrInspect ? 0 : -0.95;
          targetShipScale = isCenteredMobileOrInspect
            ? isPortraitViewport
              ? 1.28
              : 1.48
            : 1.62;
          if (!isDraggingHangarShip) {
            hangarUserYaw += dt * 0.32;
          }
          targetShipYaw = hangarUserYaw;
          targetCamX = isCenteredMobileOrInspect ? 0 : -0.15;
          targetCamY = 0.92 + hangarUserPitch * 2.1;
          targetCamZ =
            (isCenteredMobileOrInspect
              ? isPortraitViewport
                ? 4.95
                : 4.4
              : 4.15) * hangarZoom;
          targetLookX = isCenteredMobileOrInspect ? 0 : -0.78;
          targetLookY = portraitSheetOffsetY;
          targetLookZ = 0;
        } else if (currentMode === 'market') {
          targetShipX = isCenteredMobileOrInspect ? 0 : -1.15;
          targetShipScale = isCenteredMobileOrInspect
            ? isPortraitViewport
              ? 1.24
              : 1.45
            : 1.48;
          if (!isDraggingHangarShip) {
            hangarUserYaw += dt * 0.28;
          }
          targetShipYaw = hangarUserYaw;
          targetCamX = isCenteredMobileOrInspect ? 0 : -0.2;
          targetCamY = 1.15 + hangarUserPitch * 1.8;
          targetCamZ = (isPortraitViewport && !hangarCenteredInspect ? 5.1 : 4.45) * hangarZoom;
          targetLookX = isCenteredMobileOrInspect ? 0 : -0.82;
          targetLookY = portraitSheetOffsetY;
          targetLookZ = 0;
        } else if (currentMode === 'campaign_map' || currentMode === 'briefing') {
          targetShipX = isCenteredMobileOrInspect ? 0 : -2.05;
          targetShipScale = isCenteredMobileOrInspect ? 1.22 : 1.15;
          targetShipYaw = -0.18 + hangarUserYaw * 0.6;
          targetCamX = isCenteredMobileOrInspect ? 0 : -0.55;
          targetCamY = 1.25 + hangarUserPitch * 1.5;
          targetCamZ = (isCenteredMobileOrInspect ? 4.8 : 6.15) * hangarZoom;
          targetLookX = isCenteredMobileOrInspect ? 0 : -0.45;
          targetLookY = portraitSheetOffsetY;
          targetLookZ = isCenteredMobileOrInspect ? 0 : -2.5;
        } else if (
          currentMode === 'rewards' ||
          currentMode === 'profile' ||
          currentMode === 'settings'
        ) {
          targetShipX = isCenteredMobileOrInspect ? 0 : -1.65;
          targetShipScale = 1.22;
          targetShipYaw = -0.45 + Math.sin(elapsed * 0.4) * 0.12 + hangarUserYaw;
          targetCamX = isCenteredMobileOrInspect ? 0 : -0.35;
          targetCamY = 1.28;
          targetCamZ = 5.65;
          targetLookX = isCenteredMobileOrInspect ? 0 : -0.45;
          targetLookY = portraitSheetOffsetY;
          targetLookZ = 0;
        }

        // Apply realistic forward thrust lurch & high-frequency engine vibration during Ignite
        const igniteIntensity = Math.max(0, (surgeBoost - 1.0) / 1.6);
        const forwardLurchX = -Math.sin(targetShipYaw) * 0.34 * igniteIntensity;
        const forwardLurchZ = -Math.cos(targetShipYaw) * 0.34 * igniteIntensity;
        const engineVibX =
          Math.sin(elapsed * 78) * 0.016 * igniteIntensity;
        const engineVibY =
          Math.cos(elapsed * 92) * 0.016 * igniteIntensity;

        vanguard.group.position.x =
          THREE.MathUtils.damp(
            vanguard.group.position.x,
            targetShipX + forwardLurchX,
            7.5,
            dt,
          ) + engineVibX;
        vanguard.group.position.y =
          THREE.MathUtils.damp(
            vanguard.group.position.y,
            targetShipY,
            6.0,
            dt,
          ) + engineVibY;
        vanguard.group.position.z = THREE.MathUtils.damp(
          vanguard.group.position.z,
          forwardLurchZ,
          7.5,
          dt,
        );

        const nextScale = THREE.MathUtils.damp(
          vanguard.group.scale.x,
          targetShipScale,
          7.0,
          dt,
        );
        vanguard.group.scale.setScalar(nextScale);

        vanguard.group.rotation.x = THREE.MathUtils.damp(
          vanguard.group.rotation.x,
          idlePitch +
            hangarUserPitch * 0.45 -
            sim.aimY * 0.06 -
            igniteIntensity * 0.045,
          6.0,
          dt,
        );
        vanguard.group.rotation.y = THREE.MathUtils.damp(
          vanguard.group.rotation.y,
          targetShipYaw,
          7.2,
          dt,
        );
        vanguard.group.rotation.z = THREE.MathUtils.damp(
          vanguard.group.rotation.z,
          idleRoll,
          6.0,
          dt,
        );

        dockPlatformGroup.position.x = vanguard.group.position.x;
        dockPlatformGroup.position.z = vanguard.group.position.z;
        shipPointLight.intensity = 3.2 + igniteIntensity * 2.8;
        shipPointLight.position.set(
          vanguard.group.position.x + 1.2,
          vanguard.group.position.y + 1.8,
          vanguard.group.position.z + 3.2,
        );

        // High-frequency jet-blast camera shake during full afterburner ignition
        const camShakeX =
          Math.sin(elapsed * 67) * 0.042 * igniteIntensity;
        const camShakeY =
          Math.cos(elapsed * 83) * 0.038 * igniteIntensity;

        camera.position.x =
          THREE.MathUtils.damp(
            camera.position.x,
            targetCamX,
            4.8,
            dt,
          ) + camShakeX;
        camera.position.y =
          THREE.MathUtils.damp(
            camera.position.y,
            targetCamY,
            4.8,
            dt,
          ) + camShakeY;
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          targetCamZ,
          4.8,
          dt,
        );

        camLookTarget.x = THREE.MathUtils.damp(
          camLookTarget.x,
          targetLookX,
          5.5,
          dt,
        );
        camLookTarget.y = THREE.MathUtils.damp(
          camLookTarget.y,
          targetLookY,
          5.5,
          dt,
        );
        camLookTarget.z = THREE.MathUtils.damp(
          camLookTarget.z,
          targetLookZ,
          5.5,
          dt,
        );
        camera.lookAt(camLookTarget);
        camera.fov = THREE.MathUtils.damp(camera.fov, 52, 5, dt);
        camera.updateProjectionMatrix();
      } else if (currentMode === 'playing') {
        hangarBerthGroup.visible = false;
        vanguard.group.scale.setScalar(1);
        // --- ACTIVE 60FPS DOGFIGHTING SIMULATION ---
        const activeMission = getActiveMission();
        const missionDuration = Math.max(30, activeMission.durationSeconds);
        const missionWaves = activeMission.waves;
        const telegraphSpeedMult =
          DIFFICULTY_CONFIGS[playerSave.selectedDifficulty].telegraphSpeedMult;
        sim.stageElapsed += dt;

        if (!bossObj) {
          sim.stageProgress = Math.min(
            0.85,
            sim.stageElapsed / missionDuration,
          );
          while (
            sim.waveCursor < missionWaves.length &&
            sim.stageProgress >= missionWaves[sim.waveCursor].progressTrigger
          ) {
            const w = missionWaves[sim.waveCursor];
            spawnWave(w.enemyType, w.count, w.formation, w.spread);
            sim.waveCursor++;
          }

          // Check non-boss mission completion or spawn boss for finale/stage run
          if (!activeMission.hasBossFinale) {
            const targetReached =
              activeMission.objectiveType === 'hunt_elites'
                ? sim.elitesDefeated >= activeMission.targetKillsRequired
                : sim.enemiesDefeated >= activeMission.targetKillsRequired;
            if (
              targetReached ||
              (sim.stageProgress >= 0.85 && enemies.length === 0)
            ) {
              sim.stageProgress = 1;
              finalizeSortie(true);
              soundEngine.playStageClearFanfare();
              syncHudSnapshot('stage_clear');
            }
          } else if (sim.stageProgress >= 0.85 && enemies.length === 0) {
            sim.stageProgress = 0.9;
            spawnStageBoss(sim.stageId);
          }
        } else if (bossObj.active) {
          sim.stageProgress =
            0.88 + 0.12 * (1 - bossObj.hp / Math.max(1, bossObj.maxHp));
        }

        // Dynamically shift ambient abyss color, fog density, and lighting intensity with player depth
        const verticalDiveNormalized = THREE.MathUtils.clamp(
          -sim.playerY / 9.5,
          -1,
          1,
        );
        updateDepthAtmosphere(
          sim.stageId,
          sim.stageProgress,
          verticalDiveNormalized,
          dt,
        );

        // Input steering (Keyboard + Mouse + Touch Virtual Stick)
        let moveX = touchMoveX;
        let moveY = touchMoveY;
        if (heldKeys.has('KeyA') || heldKeys.has('ArrowLeft')) moveX -= 1;
        if (heldKeys.has('KeyD') || heldKeys.has('ArrowRight')) moveX += 1;
        if (heldKeys.has('KeyW') || heldKeys.has('ArrowUp')) moveY += 1;
        if (heldKeys.has('KeyS') || heldKeys.has('ArrowDown')) moveY -= 1;
        moveX = THREE.MathUtils.clamp(moveX, -1, 1);
        moveY = THREE.MathUtils.clamp(moveY, -1, 1);

        if (!isTouchAimDragging) {
          if (playerSave.settings.aimAssist) {
            // Mobile smart target tracking: gently guide reticle toward nearest active target in front
            let nearestWorldPos: THREE.Vector3 | null = null;
            let bestZ = -999;
            if (bossObj && bossObj.active) {
              const weakApp = sim.sonarWeakPointSlot && sim.sonarWeakPointSlot !== 'core'
                ? bossObj.appendages.find((a) => a.slot === sim.sonarWeakPointSlot && !a.destroyed)
                : bossObj.appendages.find((a) => !a.destroyed);
              nearestWorldPos = weakApp ? weakApp.worldPos : bossObj.group.position;
            } else {
              for (const e of enemies) {
                if (e.active && e.group.position.z < -8 && e.group.position.z > bestZ) {
                  bestZ = e.group.position.z;
                  nearestWorldPos = e.group.position;
                }
              }
            }
            if (nearestWorldPos) {
              _vec3A.copy(nearestWorldPos).project(camera);
              if (_vec3A.z <= 1) {
                const targetAimX = THREE.MathUtils.clamp(_vec3A.x, -0.82, 0.82);
                const targetAimY = THREE.MathUtils.clamp(_vec3A.y, -0.75, 0.75);
                sim.aimX = THREE.MathUtils.damp(sim.aimX, targetAimX, 3.8, dt);
                sim.aimY = THREE.MathUtils.damp(sim.aimY, targetAimY, 3.8, dt);
              }
            } else {
              sim.aimX = THREE.MathUtils.damp(
                sim.aimX,
                THREE.MathUtils.clamp(sim.playerX / 15 + moveX * 0.42, -0.85, 0.85),
                7,
                dt,
              );
              sim.aimY = THREE.MathUtils.damp(
                sim.aimY,
                THREE.MathUtils.clamp(sim.playerY / 9 + moveY * 0.42, -0.78, 0.78),
                7,
                dt,
              );
            }
          } else {
            sim.aimX = THREE.MathUtils.damp(
              sim.aimX,
              THREE.MathUtils.clamp(sim.playerX / 15 + moveX * 0.45, -0.9, 0.9),
              8,
              dt,
            );
            sim.aimY = THREE.MathUtils.damp(
              sim.aimY,
              THREE.MathUtils.clamp(sim.playerY / 9 + moveY * 0.45, -0.85, 0.85),
              8,
              dt,
            );
          }
        }

        const baseSpeed = sim.upgrades.includes('hydro_thruster_coil')
          ? 27
          : 22;
        const speedMult = baseSpeed * sim.shipSpeedMult;
        sim.playerVelX = THREE.MathUtils.damp(
          sim.playerVelX,
          moveX * speedMult,
          9,
          dt,
        );
        sim.playerVelY = THREE.MathUtils.damp(
          sim.playerVelY,
          moveY * speedMult,
          9,
          dt,
        );

        sim.playerX = THREE.MathUtils.clamp(
          sim.playerX + sim.playerVelX * dt,
          -16.5,
          16.5,
        );
        sim.playerY = THREE.MathUtils.clamp(
          sim.playerY + sim.playerVelY * dt,
          -9.5,
          9.5,
        );

        // Barrel Roll Input Buffer
        if (sim.rollBufferTimer > 0) {
          sim.rollBufferTimer -= dt;
          executeBarrelRoll();
          if (sim.barrelRollTimer > 0) sim.rollBufferTimer = 0;
        }

        if (sim.barrelRollTimer > 0) {
          sim.barrelRollTimer -= dt;
          sim.rollAngle += sim.barrelRollDir * dt * Math.PI * 4.6;
        } else {
          const targetRoll = -sim.playerVelX * 0.032;
          sim.rollAngle = THREE.MathUtils.damp(
            sim.rollAngle,
            targetRoll,
            10,
            dt,
          );
        }

        const targetPitch = sim.playerVelY * 0.024 + sim.aimY * 0.18;
        const targetYaw = -sim.playerVelX * 0.015 - sim.aimX * 0.22;
        sim.pitchAngle = THREE.MathUtils.damp(
          sim.pitchAngle,
          targetPitch,
          10,
          dt,
        );
        sim.yawAngle = THREE.MathUtils.damp(sim.yawAngle, targetYaw, 10, dt);

        vanguard.group.position.set(sim.playerX, sim.playerY, 0);
        vanguard.group.rotation.set(
          sim.pitchAngle,
          sim.yawAngle,
          sim.rollAngle,
        );
        shipPointLight.position.set(sim.playerX, sim.playerY, -4.5);

        // Regenerate Boost & Piezo-Shield
        const boostRegen = sim.upgrades.includes('hydro_thruster_coil')
          ? 24
          : 17;
        sim.boost = Math.min(sim.maxBoost, sim.boost + boostRegen * dt);

        if (sim.shieldRegenDelay > 0) {
          sim.shieldRegenDelay -= dt;
        } else {
          const shieldRegen = sim.upgrades.includes('voltaic_shield_capacitor')
            ? 12
            : 8;
          sim.shield = Math.min(sim.maxShield, sim.shield + shieldRegen * dt);
        }

        if (sim.torpedoCooldown > 0) {
          sim.torpedoCooldown = Math.max(0, sim.torpedoCooldown - dt);
        }

        if (sim.sonarCooldown > 0) {
          sim.sonarCooldown = Math.max(0, sim.sonarCooldown - dt);
        }

        // High-Pressure Abyssal Danger Zones & Structural Hull Stress Simulation
        const inTrenchCrushFloor = sim.playerY < -3.6;
        const inHadalPocket = sim.stageProgress > 0.58 && sim.playerY < 1.2;
        const inBossCrush = Boolean(
          bossObj && bossObj.active && bossObj.phase >= 2 && sim.playerY < -0.8,
        );
        sim.inDeepPressureZone =
          inTrenchCrushFloor || inHadalPocket || inBossCrush;

        if (sim.pressureGroanTimer > 0) {
          sim.pressureGroanTimer = Math.max(0, sim.pressureGroanTimer - dt);
        }

        if (sim.inDeepPressureZone) {
          if (sim.barrelRollTimer <= 0) {
            const piezoMult = sim.upgrades.includes('piezo_hull_regen')
              ? 0.65
              : 1.0;
            const bulkheadMult = sim.upgrades.includes(
              'hadal_pressure_Bulkhead',
            )
              ? 0.5
              : 1.0;
            const pressureResistance =
              piezoMult *
              bulkheadMult *
              Math.max(0.25, 1 - sim.shipPressureResistBonus) *
              DIFFICULTY_CONFIGS[playerSave.selectedDifficulty]
                .enemyDamageMult;
            const stressRate =
              (18 + sim.stageId * 3.5 + (inTrenchCrushFloor ? 6 : 0)) *
              pressureResistance;
            sim.hullStress = Math.min(100, sim.hullStress + stressRate * dt);
            if (sim.hullStress > sim.maxHullStressReached) {
              sim.maxHullStressReached = sim.hullStress;
            }
          }

          sim.pressureZoneLabel =
            sim.hullStress >= 65
              ? 'CRITICAL OVERPRESSURE — STEER UP TO ASCEND'
              : 'DEEP-PRESSURE ZONE — STEER UP TO RELIEVE STRESS';

          if (sim.hullStress >= 65 && sim.barrelRollTimer <= 0) {
            const overpressure = (sim.hullStress - 65) / 35;
            const pDmg = (3.4 + overpressure * 5.2) * dt;
            sim.hull = Math.max(0, sim.hull - pDmg);
            sim.pressureDamageTaken += pDmg;
            sim.cameraShake = Math.max(
              sim.cameraShake,
              (0.12 + overpressure * 0.14) *
                (playerSave.settings.cameraShakeIntensity / 100),
            );

            if (sim.pressureGroanTimer <= 0) {
              sim.pressureGroanTimer = 1.4;
              soundEngine.playPressureGroan();
              spawnParticleBurst(vanguard.group.position, 0xf59e0b, 6, 9);
            }

            if (sim.hull <= 0) {
              soundEngine.playImpact(true);
              finalizeSortie(false);
              syncHudSnapshot('game_over');
            }
          }
        } else {
          sim.pressureZoneLabel = null;
          sim.hullStress = Math.max(0, sim.hullStress - dt * 22);
        }

        // Update Tactical Sonar Acoustic Wavefront & Active Scan Window
        if (sim.sonarWaveTimer > 0) {
          sim.sonarWaveTimer = Math.max(0, sim.sonarWaveTimer - dt);
          const waveProgress = 1 - sim.sonarWaveTimer / 0.85;
          sonarWaveMesh.position.copy(vanguard.group.position);
          sonarWaveMesh.scale.setScalar(2 + waveProgress * 66);
          sonarWaveMesh.rotation.y += dt * 2.5;
          sonarWaveMat.opacity = (1 - waveProgress) * 0.65;
          if (sim.sonarWaveTimer <= 0) {
            sonarWaveMesh.visible = false;
          }
        }

        if (sim.sonarActiveTimer > 0) {
          sim.sonarActiveTimer = Math.max(0, sim.sonarActiveTimer - dt);
          if (sim.sonarActiveTimer <= 0) {
            sim.sonarWeakPointSlot = null;
            sim.sonarHazardsCount = 0;
            sonarBeaconRing.visible = false;
          }
        }

        if (sim.comboTimer > 0) {
          sim.comboTimer -= dt;
          if (sim.comboTimer <= 0) {
            sim.combo = 0;
            sim.multiplier = 1;
          }
        }

        // Primary Weapon Firing (Touch Hold-to-Fire, Auto-Fire when targets present, or manual trigger)
        const hasLiveCombatTargets =
          enemies.length > 0 || Boolean(bossObj && bossObj.active);
        const autoFireActive =
          playerSave.settings.autoFire &&
          (hasLiveCombatTargets ||
            (activeMission.objectiveType === 'flight_school' &&
              sim.shotsFired < 4));
        if (sim.fireCooldown > 0) sim.fireCooldown -= dt;
        if (
          (pointerFiring || touchFiring || autoFireActive || heldKeys.has('KeyJ')) &&
          sim.fireCooldown <= 0
        ) {
          firePrimaryCannons();
          sim.fireCooldown = 0.13 / Math.max(0.5, sim.shipPrimaryFireRateMult);
        }

        // Camera Choreography (Chase Cam vs Cockpit View + Decaying Trauma Shake)
        if (sim.cameraShake > 0) {
          sim.cameraShake = Math.max(0, sim.cameraShake - dt * 2.8);
        }
        const shakeOffsetX =
          (Math.random() - 0.5) * sim.cameraShake * 0.85;
        const shakeOffsetY =
          (Math.random() - 0.5) * sim.cameraShake * 0.85;

        if (cameraModeRef.current === 'cockpit') {
          vanguard.group.visible = false;
          camera.position.set(
            sim.playerX + shakeOffsetX * 0.4,
            sim.playerY + 0.55 + shakeOffsetY * 0.4,
            -1.1,
          );
          camera.lookAt(
            sim.playerX + sim.aimX * 16,
            sim.playerY + sim.aimY * 11,
            -45,
          );
          camera.fov = THREE.MathUtils.damp(
            camera.fov,
            sim.barrelRollTimer > 0 ? 74 : 68,
            8,
            dt,
          );
          camera.updateProjectionMatrix();
        } else {
          vanguard.group.visible = true;
          const desiredCamX = sim.playerX * 0.62 + shakeOffsetX;
          const desiredCamY = sim.playerY * 0.56 + 3.1 + shakeOffsetY;
          const desiredCamZ = sim.barrelRollTimer > 0 ? 11.8 : 13.4;

          camera.position.x = THREE.MathUtils.damp(
            camera.position.x,
            desiredCamX,
            8,
            dt,
          );
          camera.position.y = THREE.MathUtils.damp(
            camera.position.y,
            desiredCamY,
            8,
            dt,
          );
          camera.position.z = THREE.MathUtils.damp(
            camera.position.z,
            desiredCamZ,
            8,
            dt,
          );
          camera.lookAt(
            sim.playerX * 0.78 + sim.aimX * 4.5,
            sim.playerY * 0.75 + sim.aimY * 3.0 + 0.6,
            -30,
          );
          camera.fov = THREE.MathUtils.damp(
            camera.fov,
            sim.barrelRollTimer > 0 ? 69 : 62,
            8,
            dt,
          );
          camera.updateProjectionMatrix();
        }

        // Update Enemies & Windup Telegraphs
        let anyEnemyTelegraphing = false;
        let scannedHazardCounter = 0;
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i];
          if (!e.active) continue;

          if (
            sim.sonarActiveTimer > 0 &&
            (e.type === 'hazard_mine' || e.isFiringWindup)
          ) {
            scannedHazardCounter++;
          }

          const age = sim.stageElapsed - e.spawnTime;
          e.group.position.z += e.velZ * dt;

          if (e.type === 'skimmer') {
            e.group.position.x =
              e.baseX + Math.sin(age * 2.6 + e.patternPhase) * 4.5;
            e.group.position.y =
              e.baseY + Math.cos(age * 2.1 + e.patternPhase) * 2.8;
            e.group.rotation.z = Math.cos(age * 2.6 + e.patternPhase) * 0.35;
          } else if (e.type === 'jelly') {
            e.group.position.y =
              e.baseY + Math.sin(age * 3.2 + e.patternPhase) * 3.2;
            e.group.rotation.y += dt * 1.4;
          } else if (e.type === 'manta') {
            e.group.position.x =
              e.baseX + Math.cos(age * 3.4 + e.patternPhase) * 6.5;
            e.group.rotation.z = -Math.sin(age * 3.4 + e.patternPhase) * 0.48;
          } else if (e.type === 'hazard_mine') {
            e.group.rotation.x += dt * 1.2;
            e.group.rotation.y += dt * 1.6;
          }

          // Hit flash recovery
          if (e.hitFlashTimer > 0) {
            e.hitFlashTimer -= dt;
            if (e.hitFlashTimer <= 0) {
              (e.coreMesh.material as THREE.MeshStandardMaterial).color.setHex(
                e.baseColorHex,
              );
            }
          }

          // Enemy Windup Telegraph -> Strike FSM
          if (e.type !== 'hazard_mine' && e.group.position.z < -12) {
            e.fireTimer -= dt * telegraphSpeedMult;
            if (e.fireTimer <= 1.0 && !e.isFiringWindup) {
              e.isFiringWindup = true;
              e.telegraphTimer = 1.0;
            }
            if (e.isFiringWindup) {
              anyEnemyTelegraphing = true;
              e.telegraphTimer -= dt * telegraphSpeedMult;
              const ringMat = e.telegraphRing
                .material as THREE.MeshBasicMaterial;
              ringMat.opacity = 0.85;
              const s = 0.5 + Math.max(0, e.telegraphTimer) * 1.1;
              e.telegraphRing.scale.set(s, s, 1);
              e.telegraphRing.lookAt(camera.position);

              if (e.telegraphTimer <= 0) {
                e.isFiringWindup = false;
                ringMat.opacity = 0;
                e.fireTimer = e.type === 'cruiser' ? 2.4 : 3.4;
                fireEnemyPlasma(e.group.position, true);
              }
            }
          }

          // Check collision with player ship
          if (
            e.group.position.distanceTo(vanguard.group.position) <
            e.radius + 1.8
          ) {
            damagePlayer(e.type === 'hazard_mine' ? 28 : 22);
            spawnParticleBurst(e.group.position, e.baseColorHex, 20, 18);
            scene.remove(e.group);
            disposeGroupGeometries(e.group);
            sim.lockedTargetIds = sim.lockedTargetIds.filter(
              (id) => id !== e.id,
            );
            enemies.splice(i, 1);
            continue;
          }

          // Despawn if behind camera (and damage relay beacon on protect_beacon missions)
          if (e.group.position.z > 14) {
            if (
              activeMission.objectiveType === 'protect_beacon' &&
              e.type !== 'hazard_mine'
            ) {
              const beaconDmg = e.type === 'cruiser' ? 18 : 10;
              sim.beaconIntegrityPct = Math.max(
                0,
                sim.beaconIntegrityPct - beaconDmg,
              );
              if (sim.beaconIntegrityPct <= 0) {
                soundEngine.playImpact(true);
                finalizeSortie(false);
                syncHudSnapshot('game_over');
              }
            }
            scene.remove(e.group);
            disposeGroupGeometries(e.group);
            sim.lockedTargetIds = sim.lockedTargetIds.filter(
              (id) => id !== e.id,
            );
            enemies.splice(i, 1);
          }
        }

        sim.sonarHazardsCount = scannedHazardCounter;
        sim.hazardWarningText = anyEnemyTelegraphing
          ? 'INCOMING BIO-PLASMA — TAP EVADE TO DODGE'
          : null;

        // Update Stage Leviathan Boss & Localized Appendages
        if (bossObj && bossObj.active) {
          // Ensure Tactical Sonar weak point stays valid if boss spawned or part was severed
          if (sim.sonarActiveTimer > 0) {
            const currentWeakInvalid =
              !sim.sonarWeakPointSlot ||
              (sim.sonarWeakPointSlot !== 'core' &&
                bossObj.appendages.some(
                  (a) => a.slot === sim.sonarWeakPointSlot && a.destroyed,
                ));
            if (currentWeakInvalid) {
              sim.sonarWeakPointSlot = pickBestBossSonarWeakPoint();
            }
          }

          // Approach into arena z = -52
          bossObj.group.position.z = THREE.MathUtils.damp(
            bossObj.group.position.z,
            -52,
            2.2,
            dt,
          );
          const hpRatio = bossObj.hp / bossObj.maxHp;
          bossObj.phase = hpRatio > 0.66 ? 1 : hpRatio > 0.33 ? 2 : 3;

          // Ventral appendage destruction slows boss mobility by 35%
          const ventralSevered = bossObj.appendages.some(
            (a) => a.slot === 'ventral' && a.destroyed,
          );
          const dorsalSevered = bossObj.appendages.some(
            (a) => a.slot === 'dorsal' && a.destroyed,
          );
          const portSevered = bossObj.appendages.some(
            (a) => a.slot === 'port' && a.destroyed,
          );
          const starboardSevered = bossObj.appendages.some(
            (a) => a.slot === 'starboard' && a.destroyed,
          );

          const moveSpeed =
            (0.75 + bossObj.phase * 0.35) * (ventralSevered ? 0.65 : 1.0);
          bossObj.group.position.x =
            Math.sin(elapsed * moveSpeed) * (9 + bossObj.phase * 2.5);
          bossObj.group.position.y =
            1.5 + Math.cos(elapsed * moveSpeed * 1.3) * 4.8;

          bossObj.outerRing.rotation.z += dt * (0.9 + bossObj.phase * 0.45);
          bossObj.tentacles.forEach((t, idx) => {
            t.rotation.x = Math.sin(elapsed * 3.2 + idx) * 0.18;
          });

          // Update core procedural bioluminescent damage shader uniforms
          const coreHpRatio = bossObj.hp / Math.max(1, bossObj.maxHp);
          const coreDmgRatio = Math.max(0, 1 - coreHpRatio);
          const coreCritPulse =
            coreHpRatio <= 0.45
              ? 0.5 +
                0.5 * Math.sin(elapsed * (coreHpRatio <= 0.22 ? 18.0 : 11.5))
              : 0;
          bossObj.coreDamageUniforms.uTime.value = elapsed;
          bossObj.coreDamageUniforms.uDamageRatio.value = coreDmgRatio;
          bossObj.coreDamageUniforms.uCriticalPulse.value = coreCritPulse;

          bossObj.fluidDripTimer += dt;
          const emitFluidBurst = bossObj.fluidDripTimer >= 0.18;
          if (emitFluidBurst) {
            bossObj.fluidDripTimer = 0;
          }

          // Update localized appendage world positions, hit flashes, sonar highlights, and procedural bioluminescent fluid-leak shaders
          bossObj.appendages.forEach((app) => {
            app.worldPos
              .copy(bossObj!.group.position)
              .add(app.localOffset);

            const appHpRatio = app.hp / Math.max(1, app.maxHp);
            const appDmgRatio = app.destroyed
              ? 1.0
              : Math.max(0, 1.0 - appHpRatio);
            const isCrit = !app.destroyed && appHpRatio <= 0.45;
            const critPulse = isCrit
              ? 0.5 +
                0.5 * Math.sin(elapsed * (appHpRatio <= 0.22 ? 18.0 : 11.5))
              : 0.0;

            app.damageUniforms.uTime.value = elapsed;
            app.damageUniforms.uDamageRatio.value = appDmgRatio;
            app.damageUniforms.uCriticalPulse.value = critPulse;

            app.fluidLeakUniforms.uTime.value = elapsed;
            app.fluidLeakUniforms.uDamageRatio.value = app.destroyed
              ? 0.42
              : appDmgRatio;
            app.fluidLeakUniforms.uCriticalPulse.value = critPulse;
            app.fluidLeakMesh.visible = appDmgRatio > 0.04;

            if (emitFluidBurst && !app.destroyed && appDmgRatio > 0.22) {
              spawnParticleBurst(
                app.worldPos,
                app.baseColorHex,
                isCrit ? 4 : 2,
                7,
              );
            }

            if (!app.destroyed) {
              app.group.scale.lerp(_scale.set(1, 1, 1), dt * 10);
              const isSonarTarget =
                sim.sonarActiveTimer > 0 && sim.sonarWeakPointSlot === app.slot;

              if (app.hitFlashTimer > 0) {
                app.hitFlashTimer -= dt;
              } else if (isSonarTarget) {
                app.emissiveMat.color.setHex(0x22d3ee);
                app.emissiveMat.emissive.setHex(0x22d3ee);
                app.emissiveMat.emissiveIntensity =
                  2.6 + Math.sin(elapsed * 12) * 0.6 + critPulse * 0.85;
              } else {
                const targetHex = isCrit ? 0xf59e0b : app.baseColorHex;
                app.emissiveMat.color.setHex(targetHex);
                app.emissiveMat.emissive.setHex(targetHex);
                app.emissiveMat.emissiveIntensity = 1.85 + critPulse * 1.65;
              }
            }
          });

          // Position 3D Sonar Weak-Point Beacon Ring on active weak point
          if (sim.sonarActiveTimer > 0 && sim.sonarWeakPointSlot) {
            if (sim.sonarWeakPointSlot === 'core') {
              sonarBeaconRing.position.copy(bossObj.group.position);
              sonarBeaconRing.visible = true;
            } else {
              const targetApp = bossObj.appendages.find(
                (a) => a.slot === sim.sonarWeakPointSlot && !a.destroyed,
              );
              if (targetApp) {
                sonarBeaconRing.position.copy(targetApp.worldPos);
                sonarBeaconRing.visible = true;
              } else {
                sonarBeaconRing.visible = false;
              }
            }
            const pulseScale = 1 + Math.sin(elapsed * 10) * 0.14;
            sonarBeaconRing.scale.set(pulseScale, pulseScale, 1);
            sonarBeaconRing.rotation.z += dt * 3.2;
          } else {
            sonarBeaconRing.visible = false;
          }

          if (bossObj.hitFlashTimer > 0) {
            bossObj.hitFlashTimer -= dt;
            if (bossObj.hitFlashTimer <= 0) {
              const baseHex =
                bossObj.stageId === 1
                  ? 0x06b6d4
                  : bossObj.stageId === 2
                    ? 0xf59e0b
                    : 0x10b981;
              (
                bossObj.coreMesh.material as THREE.MeshStandardMaterial
              ).color.setHex(baseHex);
            }
          }

          // Boss Telegraph -> Multi-Bolt Barrage FSM
          bossObj.attackTimer -=
            dt * (dorsalSevered ? 0.72 : 1.0) * telegraphSpeedMult;
          if (bossObj.attackTimer <= 1.25 && bossObj.telegraphTimer <= 0) {
            bossObj.telegraphTimer = 1.25;
            bossObj.telegraphLabel =
              bossObj.phase === 3
                ? 'CRITICAL TELEGRAPH: HADAL NOVA BARRAGE!'
                : 'TELEGRAPH: LEVIATHAN BIO-PLASMA SALVO';
            soundEngine.playBossTelegraph();
          }

          const haloMat = bossObj.telegraphHalo
            .material as THREE.MeshBasicMaterial;
          if (bossObj.telegraphTimer > 0) {
            bossObj.telegraphTimer -= dt * telegraphSpeedMult;
            haloMat.opacity = 0.85;
            const hs = 0.6 + bossObj.telegraphTimer * 0.65;
            bossObj.telegraphHalo.scale.set(hs, hs, 1);

            if (bossObj.telegraphTimer <= 0) {
              haloMat.opacity = 0;
              bossObj.telegraphLabel = null;
              bossObj.attackTimer = Math.max(2.1, 3.8 - bossObj.phase * 0.55);

              // Fire patterned spread toward player (reduced when Port/Starboard appendages are severed!)
              const reduction =
                (portSevered ? 1 : 0) + (starboardSevered ? 1 : 0);
              const volleyCount = Math.max(
                2,
                3 + bossObj.phase * 2 - reduction * 2,
              );
              for (let v = 0; v < volleyCount; v++) {
                const spreadAngle =
                  ((v / Math.max(1, volleyCount - 1)) - 0.5) * 0.55;
                _vec3B
                  .subVectors(
                    vanguard.group.position,
                    bossObj.group.position,
                  )
                  .normalize();
                _vec3B.x += spreadAngle;
                _vec3B.y += ((v % 2) - 0.5) * 0.16;
                _vec3B.normalize().multiplyScalar(46 + bossObj.phase * 4);
                fireEnemyPlasma(bossObj.group.position, false, _vec3B);
              }
            }
          } else {
            haloMat.opacity = 0;
          }
        } else {
          sonarBeaconRing.visible = false;
        }

        // Update Projectiles & Check Collisions
        for (let i = 0; i < PROJECTILE_POOL_SIZE; i++) {
          const p = projectiles[i];
          if (!p.active) continue;

          p.life -= dt;
          if (p.life <= 0) {
            p.active = false;
            p.mesh.visible = false;
            continue;
          }

          // Homing torpedo guidance (supports Enemies, Boss Appendages, and Boss Core)
          if (p.isTorpedo && p.targetEnemyId !== null) {
            let targetPos: THREE.Vector3 | null = null;
            const foundEnemy = enemies.find(
              (e) => e.active && e.id === p.targetEnemyId,
            );
            if (foundEnemy) {
              targetPos = foundEnemy.group.position;
            } else if (bossObj && bossObj.active) {
              const foundApp = bossObj.appendages.find(
                (a) => !a.destroyed && a.numericId === p.targetEnemyId,
              );
              if (foundApp) {
                targetPos = foundApp.worldPos;
              } else if (bossObj.id === p.targetEnemyId) {
                targetPos = bossObj.group.position;
              }
            }
            if (targetPos) {
              _vec3B
                .subVectors(targetPos, p.pos)
                .normalize()
                .multiplyScalar(sim.shipSecondarySpeed);
              p.vel.lerp(_vec3B, dt * 7.5);
            }
          }

          p.pos.addScaledVector(p.vel, dt);
          p.mesh.position.copy(p.pos);

          if (p.isPlayer && p.isTorpedo) {
            _vec3A.copy(p.pos).add(p.vel);
            p.mesh.lookAt(_vec3A);
            if (Math.random() < 0.35) {
              spawnParticleBurst(p.pos, 0xff6b00, 1, 6);
            }
          }

          if (!p.isPlayer) {
            p.mesh.rotation.x += dt * 5;
            p.mesh.rotation.y += dt * 5;
            if (p.pos.distanceTo(vanguard.group.position) < 1.95) {
              p.active = false;
              p.mesh.visible = false;
              damagePlayer(p.damage);
            }
            continue;
          }

          // Player projectile vs Enemies
          let hitRegistered = false;
          for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (
              e.active &&
              p.pos.distanceTo(e.group.position) < e.radius + 1.15
            ) {
              p.active = false;
              p.mesh.visible = false;
              hitRegistered = true;
              sim.shotsHit++;

              const hazardSonarBonus =
                sim.sonarActiveTimer > 0 && e.type === 'hazard_mine'
                  ? 1.5
                  : 1.0;
              e.hp -= p.damage * hazardSonarBonus;
              e.hitFlashTimer = 0.08;
              (
                e.coreMesh.material as THREE.MeshStandardMaterial
              ).color.setHex(0xffffff);
              // Squash & stretch recoil
              e.group.scale.set(1.18, 0.84, 1.18);

              spawnParticleBurst(
                p.pos,
                p.isTorpedo ? 0xf59e0b : 0x06b6d4,
                p.isTorpedo ? 20 : 8,
                15,
              );
              soundEngine.playImpact(p.isTorpedo);

              if (e.hp <= 0) {
                e.active = false;
                scene.remove(e.group);
                disposeGroupGeometries(e.group);
                sim.lockedTargetIds = sim.lockedTargetIds.filter(
                  (id) => id !== e.id,
                );
                spawnParticleBurst(e.group.position, e.baseColorHex, 26, 22);
                if (Math.random() < 0.28) {
                  spawnPickup(e.group.position);
                }
                enemies.splice(j, 1);

                sim.enemiesDefeated++;
                if (e.type === 'cruiser' || e.type === 'manta') {
                  sim.elitesDefeated++;
                  playerSave.stats.totalElitesDefeated += 1;
                }
                playerSave.stats.totalEnemiesDefeated += 1;
                playerSave.dailyProgress._daily_hostiles =
                  (playerSave.dailyProgress._daily_hostiles || 0) + 1;
                if (playerSave.dailyProgress._daily_hostiles >= 15) {
                  playerSave.dailyProgress.daily_appendage_1 = Math.max(
                    1,
                    playerSave.dailyProgress.daily_appendage_1 || 0,
                  );
                }

                sim.combo++;
                sim.comboTimer = 4.5;
                sim.multiplier = Math.min(8, 1 + Math.floor(sim.combo / 3));
                if (sim.multiplier > sim.maxMultiplierReached) {
                  sim.maxMultiplierReached = sim.multiplier;
                }
                sim.score +=
                  (e.type === 'cruiser' ? 350 : 150) * sim.multiplier;

                const siphonMult = sim.upgrades.includes('biolume_siphon_array')
                  ? 1 + 0.35 * getModuleTierMult('biolume_siphon_array')
                  : 1.0;
                playerSave.salvageCredits += Math.round(
                  (e.type === 'cruiser' ? 45 : 22) * siphonMult,
                );
                if (sim.upgrades.includes('biolume_siphon_array')) {
                  sim.shield = Math.min(sim.maxShield, sim.shield + 4);
                }
                persistSave();

                if (p.isTorpedo) {
                  sim.hitstopTimer = 0.04;
                  sim.cameraShake = Math.min(
                    1,
                    sim.cameraShake +
                      0.3 * (playerSave.settings.cameraShakeIntensity / 100),
                  );
                }
              }
              break;
            }
          }

          // Recover enemy squash-and-stretch
          enemies.forEach((e) => {
            e.group.scale.lerp(_scale.set(1, 1, 1), dt * 12);
          });

          // Player projectile vs Boss Localized Appendages & Central Core
          if (!hitRegistered && bossObj && bossObj.active) {
            const visorMult = sim.upgrades.includes('sonar_crit_visor')
              ? 1 + 0.45 * getModuleTierMult('sonar_crit_visor')
              : 1.0;

            // 1. Check localized appendages first
            for (const app of bossObj.appendages) {
              if (
                !app.destroyed &&
                p.pos.distanceTo(app.worldPos) < app.hitRadius
              ) {
                p.active = false;
                p.mesh.visible = false;
                hitRegistered = true;
                sim.shotsHit++;

                const isSonarWeakPointHit =
                  sim.sonarActiveTimer > 0 &&
                  sim.sonarWeakPointSlot === app.slot;
                const sonarCritMult = isSonarWeakPointHit ? 1.6 : 1.0;
                const dmg = p.damage * visorMult * sonarCritMult;
                app.hp = Math.max(0, app.hp - dmg);
                bossObj.hp = Math.max(1, bossObj.hp - dmg * 0.55);
                app.hitFlashTimer = 0.11;
                app.emissiveMat.color.setHex(0xffffff);
                app.emissiveMat.emissive.setHex(0xffffff);
                app.group.scale.set(1.2, 0.84, 1.2);

                spawnParticleBurst(
                  p.pos,
                  isSonarWeakPointHit
                    ? 0x22d3ee
                    : p.isTorpedo
                      ? 0xf59e0b
                      : app.baseColorHex,
                  p.isTorpedo || isSonarWeakPointHit ? 22 : 10,
                  17,
                );

                if (app.hp <= 0) {
                  // APPENDAGE SEVERED!
                  app.destroyed = true;
                  app.hp = 0;
                  bossObj.lastSeveredPartName = app.name;
                  sim.appendagesSeveredThisSortie += 1;
                  playerSave.stats.totalAppendagesSevered += 1;
                  playerSave.dailyProgress.daily_appendage_1 =
                    (playerSave.dailyProgress.daily_appendage_1 || 0) + 1;

                  sim.lockedTargetIds = sim.lockedTargetIds.filter(
                    (id) => id !== app.numericId,
                  );

                  // Visually fracture & char the 3D appendage sub-assembly
                  app.group.scale.set(0.32, 0.32, 0.32);
                  app.emissiveMat.color.setHex(0x1f1924);
                  app.emissiveMat.emissive.setHex(0x4c1d3d);
                  app.emissiveMat.emissiveIntensity = 0.45;

                  spawnParticleBurst(app.worldPos, 0xf43f5e, 34, 24);
                  spawnParticleBurst(app.worldPos, app.baseColorHex, 28, 20);
                  soundEngine.playAppendageBreak();
                  triggerHaptic([35, 25, 45]);

                  if (sim.sonarWeakPointSlot === app.slot) {
                    sim.sonarWeakPointSlot = pickBestBossSonarWeakPoint();
                  }

                  sim.hitstopTimer = 0.065;
                  sim.cameraShake = Math.min(
                    1,
                    sim.cameraShake +
                      0.72 * (playerSave.settings.cameraShakeIntensity / 100),
                  );
                  sim.combo += 2;
                  sim.comboTimer = 5.0;
                  sim.multiplier = Math.min(8, 1 + Math.floor(sim.combo / 3));
                  if (sim.multiplier > sim.maxMultiplierReached) {
                    sim.maxMultiplierReached = sim.multiplier;
                  }
                  sim.score += 1200 * sim.multiplier;
                  playerSave.salvageCredits += 180;
                  persistSave();
                  syncHudSnapshot();
                } else {
                  soundEngine.playImpact(p.isTorpedo || isSonarWeakPointHit);
                }
                break;
              }
            }

            // 2. Check Central Leviathan Core
            if (
              !hitRegistered &&
              p.pos.distanceTo(bossObj.group.position) < 5.6
            ) {
              p.active = false;
              p.mesh.visible = false;
              hitRegistered = true;
              sim.shotsHit++;

              const severedCount = bossObj.appendages.filter(
                (a) => a.destroyed,
              ).length;
              const severedVulnerabilityMult = 1.0 + severedCount * 0.2;
              const coreSonarMult =
                sim.sonarActiveTimer > 0 && sim.sonarWeakPointSlot === 'core'
                  ? 1.6
                  : 1.0;
              bossObj.hp -=
                p.damage * visorMult * severedVulnerabilityMult * coreSonarMult;
              bossObj.hitFlashTimer = 0.08;
              (
                bossObj.coreMesh.material as THREE.MeshStandardMaterial
              ).color.setHex(0xffffff);

              spawnParticleBurst(
                p.pos,
                p.isTorpedo ? 0xf59e0b : 0x10b981,
                p.isTorpedo ? 24 : 10,
                18,
              );
              soundEngine.playImpact(p.isTorpedo);

              if (bossObj.hp <= 0) {
                bossObj.active = false;
                sonarBeaconRing.visible = false;
                spawnParticleBurst(
                  bossObj.group.position,
                  0x06b6d4,
                  45,
                  28,
                );
                spawnParticleBurst(
                  bossObj.group.position,
                  0xf59e0b,
                  45,
                  24,
                );
                scene.remove(bossObj.group);
                disposeGroupGeometries(bossObj.group);
                bossObj = null;

                sim.hitstopTimer = 0.075;
                sim.cameraShake =
                  0.9 * (playerSave.settings.cameraShakeIntensity / 100);
                sim.score += 2500 * sim.stageId * sim.multiplier;
                playerSave.stats.totalBossesDefeated += 1;
                finalizeSortie(true);
                soundEngine.playStageClearFanfare();

                if (sim.stageId < 3) {
                  syncHudSnapshot('stage_clear');
                } else {
                  syncHudSnapshot('victory');
                }
              }
            }
          }
        }

        // Update Pickups
        for (let i = 0; i < PICKUP_POOL_SIZE; i++) {
          const pk = pickups[i];
          if (!pk.active) continue;
          pk.pos.z += 22 * dt;
          // Gently magnetize toward player when close
          if (pk.pos.distanceTo(vanguard.group.position) < 12) {
            pk.pos.lerp(vanguard.group.position, dt * 6.5);
          }
          pk.mesh.position.copy(pk.pos);
          pk.mesh.rotation.y += dt * 3.5;

          if (pk.pos.distanceTo(vanguard.group.position) < 2.6) {
            pk.active = false;
            pk.mesh.visible = false;
            soundEngine.playPickupChime();
            if (pk.kind === 'hull') {
              sim.hull = Math.min(sim.maxHull, sim.hull + 22);
            } else {
              sim.shield = Math.min(sim.maxShield, sim.shield + 30);
              sim.boost = sim.maxBoost;
            }
            sim.score += 100 * sim.multiplier;
          } else if (pk.pos.z > 12) {
            pk.active = false;
            pk.mesh.visible = false;
          }
        }

        // Project 3D Enemy & Boss World Coordinates to 2D Screen Space & Auto-Lock Reticle Proximity
        const cw = renderer.domElement.clientWidth;
        const ch = renderer.domElement.clientHeight;
        const reticlePxX = ((sim.aimX + 1) * 0.5) * cw;
        const reticlePxY = ((-sim.aimY + 1) * 0.5) * ch;
        const lockRadiusPx = sim.upgrades.includes('sonar_crit_visor')
          ? 125
          : 92;

        const screenTargets: ScreenLockTarget[] = [];

        const projectEntity = (
          id: number,
          worldPos: THREE.Vector3,
          hpRatio: number,
          isBoss: boolean,
          isTelegraphing: boolean,
          label: string,
          isAppendage: boolean = false,
          isHazardScanned: boolean = false,
          isWeakPointScanned: boolean = false,
        ) => {
          _vec3A.copy(worldPos);
          _vec3A.project(camera);
          if (_vec3A.z > 1) return;
          const sx = (_vec3A.x * 0.5 + 0.5) * cw;
          const sy = (-(_vec3A.y * 0.5) + 0.5) * ch;

          const distToReticle = Math.hypot(sx - reticlePxX, sy - reticlePxY);
          const alreadyLocked = sim.lockedTargetIds.includes(id);

          if (
            !alreadyLocked &&
            distToReticle < lockRadiusPx &&
            sim.lockedTargetIds.length < sim.maxLocks &&
            sim.torpedoCooldown <= 0
          ) {
            sim.lockedTargetIds.push(id);
            soundEngine.playSonarPing(720 + sim.lockedTargetIds.length * 90);
          }

          screenTargets.push({
            id,
            x: sx,
            y: sy,
            visible: sx >= -40 && sx <= cw + 40 && sy >= -40 && sy <= ch + 40,
            locked: sim.lockedTargetIds.includes(id),
            hpRatio,
            isBoss,
            isAppendage,
            isTelegraphing,
            isHazardScanned,
            isWeakPointScanned,
            label,
          });
        };

        enemies.forEach((e) => {
          if (e.active) {
            const hazardScanned =
              sim.sonarActiveTimer > 0 &&
              (e.type === 'hazard_mine' || e.isFiringWindup);
            projectEntity(
              e.id,
              e.group.position,
              e.hp / e.maxHp,
              false,
              e.isFiringWindup,
              e.type === 'hazard_mine' ? 'MINE' : e.type.toUpperCase(),
              false,
              hazardScanned,
              false,
            );
          }
        });

        if (bossObj && bossObj.active) {
          bossObj.appendages.forEach((app) => {
            if (!app.destroyed) {
              const isWeakPoint =
                sim.sonarActiveTimer > 0 &&
                sim.sonarWeakPointSlot === app.slot;
              projectEntity(
                app.numericId,
                app.worldPos,
                app.hp / app.maxHp,
                false,
                false,
                app.slot.toUpperCase(),
                true,
                false,
                isWeakPoint,
              );
            }
          });

          const isCoreWeakPoint =
            sim.sonarActiveTimer > 0 && sim.sonarWeakPointSlot === 'core';
          projectEntity(
            bossObj.id,
            bossObj.group.position,
            bossObj.hp / bossObj.maxHp,
            true,
            bossObj.telegraphTimer > 0,
            STAGE_CONFIGS[sim.stageId].bossName.toUpperCase(),
            false,
            false,
            isCoreWeakPoint,
          );
        }

        onLockTargetsUpdateRef.current(screenTargets, {
          x: reticlePxX,
          y: reticlePxY,
        });

        hudSyncAccumulator += dt;
        if (hudSyncAccumulator >= 0.08) {
          hudSyncAccumulator = 0;
          syncHudSnapshot();
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      domCanvas.removeEventListener('pointermove', handlePointerMove);
      domCanvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      domCanvas.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener(
        'pelagic-hangar-camera',
        handleHangarCameraEvent,
      );
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={canvasMountRef}
      className="absolute inset-0 w-full h-full overflow-hidden"
      aria-label="Pelagic Vanguard 3D Abyssal Flight Viewport"
    />
  );
};
