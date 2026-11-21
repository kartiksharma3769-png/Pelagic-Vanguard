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
  EnemyAiState,
  EnemyType,
  GameSettings,
  GameStateMode,
  HitConfirmType,
  HudSnapshot,
  LastMissionResult,
  MedalRank,
  PlayerSaveData,
  ReticleVisualState,
  ScreenLockTarget,
  ShipActiveAbilityId,
  ShipClassId,
  ShipRarity,
  StageId,
  UpgradeId,
  WaveSpawnEvent,
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
  isShipMissionUnlocked,
  loadPlayerSave,
  resetPlayerSave,
  savePlayerData,
} from '../game/saveManager';
import {
  BiolumeDamageUniforms,
  BossAppendage3DNode,
  applyPlayerWeaponVfxToMesh,
  createBossMesh,
  createEnemyMesh,
  createMaterialBank,
  createPlayerPrimaryBoltMesh,
  createPlayerTorpedoMesh,
  createVanguardShip,
} from '../game/models';
import { soundEngine } from '../game/audio';
import { createHangarLife } from '../game/hangarLife';
import {
  AimableColliderTarget,
  checkSweptSphereHit,
  computeAuthoritativeAimState,
  computeMuzzleShotVectors,
  evaluateMissionStateAndCompletion,
} from '../game/combatSolver';

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
  isElite: boolean;
  aiState: EnemyAiState;
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
  flankSign: number;
  evadeTimer: number;
  radius: number;
  locked: boolean;
}

interface ProjectileEntity {
  active: boolean;
  isPlayer: boolean;
  isTorpedo: boolean;
  isGuidedEnemyTorpedo?: boolean;
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
  vel: THREE.Vector3;
  radius: number;
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
  triggerShipAbility: () => void;
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

    // 1. Detect software WebGL so the renderer can use a lower-cost path.
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

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      container.dataset.webglUnavailable = 'true';
      const notice = document.createElement('div');
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      notice.textContent = 'The 3D hangar needs WebGL. Enable hardware acceleration or open this game in a WebGL-capable browser.';
      notice.style.cssText = 'position:absolute;inset:18% 16% auto;z-index:1;padding:1rem 1.25rem;border:1px solid rgba(103,232,249,.3);border-radius:1rem;background:rgba(3,11,28,.82);color:#cffafe;text-align:center;font:500 14px/1.5 system-ui,sans-serif;backdrop-filter:blur(12px)';
      container.replaceChildren(notice);
      return;
    }
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

    const hangarLife = createHangarLife(scene, mats, vanguard.group);

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
      const q = playerSave?.settings?.graphicsQuality || 'high';
      const qMult = q === 'low' ? 0.45 : q === 'medium' ? 0.75 : 1.0;
      const targetCount = Math.max(2, Math.round(count * qMult));
      let spawned = 0;
      for (let i = 0; i < PARTICLE_POOL_SIZE && spawned < targetCount; i++) {
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

    // Spawns high-velocity deep-sea ion-cavitation & bioluminescent bubble streams out of the stern nozzles
    function spawnExhaustEmberJet(count: number = 6, speedScale: number = 26) {
      const q = playerSave?.settings?.graphicsQuality || 'high';
      const qMult = q === 'low' ? 0.45 : q === 'medium' ? 0.75 : 1.0;
      const targetCount = Math.max(1, Math.round(count * qMult));
      const shipDef =
        SHIP_CATALOG.find((s) => s.id === playerSave.selectedShip) ||
        SHIP_CATALOG[0];
      const cavitationPalette = [
        shipDef.propulsionVfxConfig.primaryColorHex,
        shipDef.propulsionVfxConfig.secondaryColorHex,
        shipDef.propulsionVfxConfig.emberColorHex,
        0xe0f2fe,
      ];
      vanguard.group.updateMatrixWorld();
      let spawned = 0;
      for (let i = 0; i < PARTICLE_POOL_SIZE && spawned < targetCount; i++) {
        const p = particles[i];
        if (!p.active) {
          p.active = true;
          const sideX =
            (spawned % 2 === 0 ? -0.58 : 0.58) + (Math.random() - 0.5) * 0.35;
          const localNozzleY = (Math.random() - 0.5) * 0.22;
          _vec3A
            .set(sideX, localNozzleY, 2.05)
            .applyMatrix4(vanguard.group.matrixWorld);
          p.pos.copy(_vec3A);

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
          const hex = cavitationPalette[spawned % cavitationPalette.length];
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
    const PROJECTILE_POOL_SIZE = 100;
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
        isGuidedEnemyTorpedo: false,
        mesh,
        pos: new THREE.Vector3(),
        prevPos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        radius: isTorpSlot ? 0.95 : isEnemySlot ? 0.45 : 0.75,
        targetEnemyId: null,
        damage: 25,
        life: 0,
      });
    }

    // 8b. Development-Only 3D Aiming & Hitbox Debug Visualizer Group (Disabled by default)
    const aimDebugGroup = new THREE.Group();
    aimDebugGroup.visible = false;
    scene.add(aimDebugGroup);

    const debugRayMat = new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.78,
      depthTest: false,
    });
    const debugRayGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(0, 0, -85),
    ]);
    const debugRayLine = new THREE.Line(debugRayGeo, debugRayMat);
    aimDebugGroup.add(debugRayLine);

    const debugAimSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 12, 10),
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        wireframe: true,
        depthTest: false,
      }),
    );
    aimDebugGroup.add(debugAimSphere);

    const debugMuzzleMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      depthTest: false,
    });
    const debugMuzzleLineMat = new THREE.LineBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.72,
      depthTest: false,
    });
    const debugMuzzleSpheres: THREE.Mesh[] = [];
    const debugMuzzleLines: THREE.Line[] = [];
    for (let m = 0; m < 4; m++) {
      const mSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 8),
        debugMuzzleMat,
      );
      mSphere.visible = false;
      aimDebugGroup.add(mSphere);
      debugMuzzleSpheres.push(mSphere);

      const mLineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]);
      const mLine = new THREE.Line(mLineGeo, debugMuzzleLineMat);
      mLine.visible = false;
      aimDebugGroup.add(mLine);
      debugMuzzleLines.push(mLine);
    }

    const debugVelLineMat = new THREE.LineBasicMaterial({
      color: 0xf472b6,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
    });
    const debugVelLines: THREE.Line[] = [];
    for (let v = 0; v < 16; v++) {
      const vGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]);
      const vLine = new THREE.Line(vGeo, debugVelLineMat);
      vLine.visible = false;
      aimDebugGroup.add(vLine);
      debugVelLines.push(vLine);
    }

    const debugHitboxMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const debugHitboxGeo = new THREE.SphereGeometry(1, 12, 10);
    const debugHitboxSpheres: THREE.Mesh[] = [];
    for (let h = 0; h < 18; h++) {
      const hMesh = new THREE.Mesh(debugHitboxGeo, debugHitboxMat);
      hMesh.visible = false;
      aimDebugGroup.add(hMesh);
      debugHitboxSpheres.push(hMesh);
    }

    function updateLineEndpoints(
      line: THREE.Line,
      start: THREE.Vector3,
      end: THREE.Vector3,
    ) {
      const posAttr = line.geometry.getAttribute(
        'position',
      ) as THREE.BufferAttribute;
      posAttr.setXYZ(0, start.x, start.y, start.z);
      posAttr.setXYZ(1, end.x, end.y, end.z);
      posAttr.needsUpdate = true;
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

    // 9c. 3D Active Ability Effects: Gravity Singularity Vortex, Arc Lightning Beams & Autonomous Drones
    const vortexGroup = new THREE.Group();
    const vortexRingMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const vortexOuterRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.4, 0.24, 10, 32),
      vortexRingMat,
    );
    const vortexInnerRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.4, 0.14, 8, 24),
      vortexRingMat,
    );
    vortexInnerRing.rotation.x = Math.PI / 3;
    const vortexCoreMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const vortexCore = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 16, 16),
      vortexCoreMat,
    );
    vortexGroup.add(vortexOuterRing, vortexInnerRing, vortexCore);
    vortexGroup.visible = false;
    scene.add(vortexGroup);

    const arcBeamMat = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const arcBeamGeo = new THREE.CylinderGeometry(0.11, 0.11, 1, 6);
    const arcBeams: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const bm = new THREE.Mesh(arcBeamGeo, arcBeamMat);
      bm.visible = false;
      scene.add(bm);
      arcBeams.push(bm);
    }

    const repairDroneGroup = new THREE.Group();
    const repairCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45, 1),
      mats.biolumeEmerald,
    );
    const repairRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.08, 8, 20),
      mats.biolumeEmerald,
    );
    repairRing.rotation.x = Math.PI / 2;
    repairDroneGroup.add(repairCore, repairRing);
    repairDroneGroup.visible = false;
    scene.add(repairDroneGroup);

    const attackDroneGroup = new THREE.Group();
    const attackBody = new THREE.Mesh(
      new THREE.ConeGeometry(0.38, 1.25, 6).rotateX(-Math.PI / 2),
      mats.titaniumHull,
    );
    const attackGlow = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.07, 8, 18),
      mats.biolumeCyan,
    );
    attackGlow.rotation.x = Math.PI / 2;
    attackDroneGroup.add(attackBody, attackGlow);
    attackDroneGroup.visible = false;
    scene.add(attackDroneGroup);

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

    const sharedMaterialSet = new Set<THREE.Material>(
      Object.values(mats) as THREE.Material[],
    );

    function disposeGroupGeometries(group: THREE.Group) {
      group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry) {
            mesh.geometry.dispose();
          }
          const mat = mesh.material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => {
              if (m && !sharedMaterialSet.has(m)) m.dispose();
            });
          } else if (mat && !sharedMaterialSet.has(mat)) {
            mat.dispose();
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
      vortexGroup.visible = false;
      repairDroneGroup.visible = false;
      attackDroneGroup.visible = false;
      aimDebugGroup.visible = false;
      arcBeams.forEach((b) => {
        b.visible = false;
      });

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

    const MAX_ACTIVE_ENEMIES = 10;

    const sim = {
      stageId: 1 as StageId,
      missionId: 's1_m1_reef_patrol',
      stageElapsed: 0,
      waveScheduleElapsed: 0,
      reinforcementWavesSpawned: 0,
      stageProgress: 0,
      waveCursor: 0,
      waveClearAdvanceTimer: 0,
      pendingSpawns: [] as {
        enemyType: EnemyType;
        sx: number;
        sy: number;
        sz: number;
        isElite: boolean;
        patternPhase: number;
      }[],
      sortieCompleted: false,
      bossSpawned: false,
      bossDefeated: false,
      bossIntroTimer: 0,
      bossVulnerableTimer: 0,
      missionPhase: 1 as 1 | 2 | 3 | 4 | 5 | 6,
      missionPhaseLabel: 'PHASE 1/6 · DEPLOYMENT',
      aimPointWorld: new THREE.Vector3(0, 0, -85),
      reticleState: 'free' as ReticleVisualState,
      activeAimTargetId: null as number | null,
      activeAimTargetLabel: null as string | null,
      targetLostTimer: 0,
      prevLockedCount: 0,
      hitConfirmType: 'none' as HitConfirmType,
      hitConfirmTimer: 0,
      hitConfirmLabel: null as string | null,
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
      shipAccelMult: 1,
      shipTurnRateMult: 1,
      shipPrimaryDmgMult: 1,
      shipPrimaryFireRateMult: 1,
      shipPrimarySpeed: 108,
      shipSecondaryDmgMult: 1,
      shipSecondaryCooldown: 3.8,
      shipSecondarySpeed: 82,
      shipSonarDurationBonus: 0,
      shipPressureResistBonus: 0,
      shipAbilityStrengthMult: 1,
      activeShipId: 'vanguard_interceptor' as ShipClassId,
      shipRarity: 'Standard' as ShipRarity,
      shipRoleTitle: 'Recon Fighter',
      activeAbilityId: 'resonance_scan' as ShipActiveAbilityId,
      activeAbilityName: 'Resonance Scan',
      activeAbilityDuration: 6,
      activeAbilityCooldownMax: 10,
      activeAbilityTimer: 0,
      activeAbilityCooldown: 0,
      shotSequenceCount: 0,
      wingTurretFireTimer: 0,
      droneFireTimer: 0,
      droneHealTimer: 0,
      vortexActiveTimer: 0,
      vortexPos: new THREE.Vector3(0, 0, -28),
      arcLightningTimer: 0,
      markedTargetId: null as number | null,
      ambientLightPct: 100,
      ambientColorHex: '#38bdf8',
      keyLightIntensity: 2.4,
      depthStratumName: STAGE_CONFIGS[1].stratumLabels[0],
    };

    function triggerHitConfirmation(type: HitConfirmType, label: string) {
      sim.hitConfirmType = type;
      sim.hitConfirmLabel = label;
      sim.hitConfirmTimer = type === 'kill' || type === 'appendage_sever' ? 0.55 : 0.32;
    }

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

    function instantiateEnemyEntity(spec: {
      enemyType: EnemyType;
      sx: number;
      sy: number;
      sz: number;
      isElite: boolean;
      patternPhase: number;
    }) {
      const { enemyType, sx, sy, sz, isElite, patternPhase } = spec;
      const built = createEnemyMesh(enemyType, mats);
      built.group.position.set(sx, sy, sz);
      if (isElite && enemyType !== 'cruiser') {
        built.group.scale.setScalar(1.16);
      }
      scene.add(built.group);

      const hpMap: Record<EnemyType, number> = {
        skimmer: 52,
        jelly: 72,
        cruiser: 175,
        manta: 92,
        hazard_mine: 42,
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
      const eliteMult = isElite && enemyType !== 'cruiser' && enemyType !== 'manta' ? 1.35 : 1.0;
      const scaledEnemyHp = Math.round(
        hpMap[enemyType] *
          (1 + (sim.stageId - 1) * 0.22) *
          diffHpMult *
          eliteMult,
      );

      enemies.push({
        id: nextEntityId++,
        active: true,
        type: enemyType,
        isElite,
        aiState: 'approach',
        group: built.group,
        coreMesh: built.coreMesh,
        telegraphRing: built.telegraphRing,
        hp: scaledEnemyHp,
        maxHp: scaledEnemyHp,
        baseColorHex: baseHexMap[enemyType],
        hitFlashTimer: 0,
        fireTimer: 1.6 + (nextEntityId % 3) * 0.65,
        telegraphTimer: 0,
        isFiringWindup: false,
        spawnTime: sim.stageElapsed,
        patternPhase,
        baseX: sx,
        baseY: sy,
        velZ:
          enemyType === 'cruiser'
            ? 13.5
            : enemyType === 'hazard_mine'
              ? 20
              : enemyType === 'manta'
                ? 17.5
                : 16.5,
        flankSign: nextEntityId % 2 === 0 ? 1 : -1,
        evadeTimer: 0,
        radius:
          enemyType === 'cruiser'
            ? 3.1
            : enemyType === 'manta'
              ? 2.45
              : enemyType === 'jelly'
                ? 2.35
                : 2.2,
        locked: false,
      });
    }

    function flushPendingSpawns() {
      while (
        sim.pendingSpawns.length > 0 &&
        enemies.length < MAX_ACTIVE_ENEMIES
      ) {
        const nextSpec = sim.pendingSpawns.shift();
        if (nextSpec) {
          instantiateEnemyEntity(nextSpec);
        }
      }
    }

    function queueFormationBatch(
      enemyType: EnemyType,
      count: number,
      formation: 'v_wedge' | 'spiral_ring' | 'flank_pair' | 'mine_barrier',
      spread: number,
      isEliteOverride: boolean,
      zStartOffset: number = 0,
    ) {
      for (let i = 0; i < count; i++) {
        let sx = 0;
        let sy = 0;
        const sz = -104 - zStartOffset - i * 8.5;

        if (formation === 'v_wedge') {
          const offset = i - (count - 1) / 2;
          sx = offset * (spread * 0.35);
          sy = Math.abs(offset) * 2.2 - 1.8;
        } else if (formation === 'spiral_ring') {
          const angle = (i / Math.max(1, count)) * Math.PI * 2;
          sx = Math.cos(angle) * (spread * 0.52);
          sy = Math.sin(angle) * (spread * 0.38);
        } else if (formation === 'flank_pair') {
          sx = (i % 2 === 0 ? -1 : 1) * (spread * 0.52);
          sy = ((i % 3) - 1) * 3.8;
        } else {
          sx = ((i / Math.max(1, count - 1)) - 0.5) * spread * 1.1;
          sy = (((i * 5) % 9) - 4) * 1.65;
        }

        sx = THREE.MathUtils.clamp(sx, -14.5, 14.5);
        sy = THREE.MathUtils.clamp(sy, -7.5, 7.5);

        sim.pendingSpawns.push({
          enemyType,
          sx,
          sy,
          sz,
          isElite:
            isEliteOverride ||
            enemyType === 'cruiser' ||
            enemyType === 'manta',
          patternPhase: i * 1.15,
        });
      }
    }

    function spawnWave(wave: WaveSpawnEvent) {
      const isElite = Boolean(wave.isElite || wave.isEliteWave);
      queueFormationBatch(
        wave.enemyType,
        wave.count,
        wave.formation,
        wave.spread,
        isElite,
        0,
      );
      if (wave.escortType && wave.escortCount && wave.escortCount > 0) {
        queueFormationBatch(
          wave.escortType,
          wave.escortCount,
          'flank_pair',
          Math.max(12, wave.spread * 0.85),
          isElite,
          14,
        );
      }
      flushPendingSpawns();
    }

    function spawnStageBoss(stageId: StageId) {
      if (sim.bossSpawned && bossObj && bossObj.active) return;
      sim.bossSpawned = true;
      sim.bossDefeated = false;
      sim.bossIntroTimer = 2.6;
      sim.bossVulnerableTimer = 0;

      const cfg = STAGE_CONFIGS[stageId];
      const diffHpMult =
        DIFFICULTY_CONFIGS[playerSave.selectedDifficulty].enemyHpMult;
      const built = createBossMesh(stageId, mats);
      built.group.position.set(0, 2, -118);
      scene.add(built.group);
      built.group.updateMatrixWorld(true);

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
              .copy(node.localOffset)
              .applyMatrix4(built.group.matrixWorld),
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
        telegraphLabel: `LEVIATHAN EMERGENCE: ${cfg.bossName.toUpperCase()} — SEVER APPENDAGES TO EXPOSE CORE`,
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
        case 's3_m1_hadal_breach':
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
      if (sim.sortieCompleted) return;
      sim.sortieCompleted = true;

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
          // Spawn initial escort vanguard wave, and spawn the Leviathan boss if no waves are defined
          if (m.waves.length === 0) {
            sim.stageProgress = 0.88;
            spawnStageBoss(m.stageId);
          }
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
      sim.waveScheduleElapsed = 0;
      sim.reinforcementWavesSpawned = 0;
      sim.stageProgress = 0;
      sim.waveCursor = 0;
      sim.waveClearAdvanceTimer = 0;
      sim.pendingSpawns = [];
      sim.sortieCompleted = false;
      sim.bossSpawned = false;
      sim.bossDefeated = false;
      sim.bossIntroTimer = 0;
      sim.bossVulnerableTimer = 0;
      sim.missionPhase = 1;
      sim.missionPhaseLabel = 'PHASE 1/6 · DEPLOYMENT';
      sim.aimPointWorld.set(0, 0, -85);
      sim.reticleState = 'free';
      sim.activeAimTargetId = null;
      sim.activeAimTargetLabel = null;
      sim.targetLostTimer = 0;
      sim.prevLockedCount = 0;
      sim.hitConfirmType = 'none';
      sim.hitConfirmTimer = 0;
      sim.hitConfirmLabel = null;
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
      sim.activeAbilityTimer = 0;
      sim.activeAbilityCooldown = 0;
      sim.shotSequenceCount = 0;
      sim.wingTurretFireTimer = 0;
      sim.droneFireTimer = 0;
      sim.droneHealTimer = 0;
      sim.vortexActiveTimer = 0;
      sim.arcLightningTimer = 0;
      sim.markedTargetId = null;
      vanguard.setAbilityVisualState(false);
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
      sim.shipAccelMult = ship.accelerationMult || 1.0;
      sim.shipTurnRateMult = ship.turnRateMult || 1.0;
      sim.shipPrimaryDmgMult = ship.cannonDamageMult * (priWpn.damage / 24);
      sim.shipPrimaryFireRateMult =
        ship.fireRateMult * (0.12 / Math.max(0.05, priWpn.cooldownSeconds));
      sim.shipPrimarySpeed = priWpn.projectileSpeed;
      sim.shipSecondaryDmgMult =
        (ship.secondaryDamageMult || 1.0) * (secWpn.damage / 88);
      sim.shipSecondaryCooldown =
        secWpn.cooldownSeconds * (ship.torpedoCooldownMult || 1.0);
      sim.shipSecondarySpeed = secWpn.projectileSpeed;
      sim.shipSonarDurationBonus = ship.sonarDurationBonus;
      sim.shipPressureResistBonus = ship.pressureResistancePct / 100;
      sim.shipAbilityStrengthMult = ship.abilityStrengthMult || 1.0;
      sim.activeShipId = ship.id;
      sim.shipRarity = ship.rarity;
      sim.shipRoleTitle = ship.roleTitle;
      sim.activeAbilityId = ship.activeAbility.id;
      sim.activeAbilityName = ship.activeAbility.name;
      sim.activeAbilityDuration = ship.activeAbility.durationSeconds;
      sim.activeAbilityCooldownMax = ship.activeAbility.cooldownSeconds;

      soundEngine.setShipAudioProfile(ship.audioProfile);
      for (let i = 0; i < 66; i++) {
        applyPlayerWeaponVfxToMesh(
          projectiles[i].mesh as THREE.Group,
          ship.weaponVfxConfig,
          i >= 50,
          playerSave.equippedPrimaryWeapon,
          playerSave.equippedSecondaryWeapon,
        );
      }

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
      if (!isShipMissionUnlocked(def, playerSave)) {
        soundEngine.playSonarPing(320);
        return;
      }
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

    function orientArcBeam(
      beam: THREE.Mesh,
      fromPos: THREE.Vector3,
      toPos: THREE.Vector3,
    ) {
      const dist = Math.max(0.2, fromPos.distanceTo(toPos));
      beam.position.copy(fromPos).lerp(toPos, 0.5);
      beam.scale.set(1, dist, 1);
      beam.quaternion.setFromUnitVectors(
        _vec3B.set(0, 1, 0),
        _vec3C.subVectors(toPos, fromPos).normalize(),
      );
      beam.visible = true;
    }

    function eliminateDefeatedEnemy(
      e: EnemyEntity,
      enemyIndex: number,
      isHeavyImpact: boolean = false,
    ) {
      if (!e.active) return;
      e.active = false;
      scene.remove(e.group);
      disposeGroupGeometries(e.group);
      const wasLocked = sim.lockedTargetIds.includes(e.id);
      sim.lockedTargetIds = sim.lockedTargetIds.filter((id) => id !== e.id);
      if (wasLocked && sim.lockedTargetIds.length === 0) {
        sim.targetLostTimer = 0.45;
      }
      triggerHitConfirmation('kill', `${e.type.toUpperCase()} DESTROYED`);
      spawnParticleBurst(e.group.position, e.baseColorHex, 26, 22);
      if (Math.random() < 0.28) {
        spawnPickup(e.group.position);
      }
      if (enemyIndex >= 0 && enemyIndex < enemies.length && enemies[enemyIndex] === e) {
        enemies.splice(enemyIndex, 1);
      } else {
        const idx = enemies.indexOf(e);
        if (idx !== -1) enemies.splice(idx, 1);
      }

      sim.enemiesDefeated++;
      if (e.isElite || e.type === 'cruiser' || e.type === 'manta') {
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
      sim.score += (e.type === 'cruiser' ? 350 : 150) * sim.multiplier;

      const siphonMult = sim.upgrades.includes('biolume_siphon_array')
        ? 1 + 0.35 * getModuleTierMult('biolume_siphon_array')
        : 1.0;
      const sovereignYield =
        sim.activeShipId === 'abyssal_sovereign' ? 1.2 : 1.0;
      playerSave.salvageCredits += Math.round(
        (e.type === 'cruiser' ? 45 : 22) * siphonMult * sovereignYield,
      );
      if (sim.upgrades.includes('biolume_siphon_array')) {
        sim.shield = Math.min(sim.maxShield, sim.shield + 4);
      }
      if (sim.activeShipId === 'abyssal_talon') {
        sim.shield = Math.min(sim.maxShield, sim.shield + 6);
      }
      persistSave();

      if (isHeavyImpact) {
        sim.hitstopTimer = 0.04;
        sim.cameraShake = Math.min(
          1,
          sim.cameraShake +
            0.3 * (playerSave.settings.cameraShakeIntensity / 100),
        );
      }
    }

    function severDefeatedAppendage(app: BossAppendageRuntime) {
      if (app.destroyed || !bossObj) return;
      app.destroyed = true;
      app.hp = 0;
      bossObj.lastSeveredPartName = app.name;
      sim.appendagesSeveredThisSortie += 1;
      sim.bossVulnerableTimer = Math.max(sim.bossVulnerableTimer, 3.0);
      playerSave.stats.totalAppendagesSevered += 1;
      playerSave.dailyProgress.daily_appendage_1 =
        (playerSave.dailyProgress.daily_appendage_1 || 0) + 1;

      sim.lockedTargetIds = sim.lockedTargetIds.filter(
        (id) => id !== app.numericId,
      );
      triggerHitConfirmation(
        'appendage_sever',
        `${app.name.toUpperCase()} SEVERED!`,
      );

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
    }

    function resolveDefeatedEntitiesAndAppendages(isHeavyImpact: boolean = false) {
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (e.active && e.hp <= 0) {
          eliminateDefeatedEnemy(e, i, isHeavyImpact);
        }
      }
      if (bossObj && bossObj.active) {
        for (const app of bossObj.appendages) {
          if (!app.destroyed && app.hp <= 0) {
            severDefeatedAppendage(app);
          }
        }
      }
    }

    function executeShipAbility() {
      if (modeRef.current !== 'playing') return;
      if (sim.activeAbilityCooldown > 0 || sim.activeAbilityTimer > 0) return;

      const ship =
        SHIP_CATALOG.find((s) => s.id === playerSave.selectedShip) ||
        SHIP_CATALOG[0];

      sim.activeAbilityTimer = ship.activeAbility.durationSeconds;
      sim.activeAbilityCooldown = ship.activeAbility.cooldownSeconds;
      vanguard.setAbilityVisualState(true);
      soundEngine.playShipAbility(ship.audioProfile.abilityFreq);
      triggerHaptic([18, 22, 32]);
      spawnParticleBurst(
        vanguard.group.position,
        ship.propulsionVfxConfig.primaryColorHex,
        24,
        18,
      );

      switch (ship.activeAbility.id) {
        case 'resonance_scan': {
          sim.sonarActiveTimer = Math.max(
            sim.sonarActiveTimer,
            ship.activeAbility.durationSeconds,
          );
          sim.sonarWaveTimer = 0.85;
          sonarWaveMesh.position.copy(vanguard.group.position);
          sonarWaveMesh.scale.setScalar(1.8);
          sonarWaveMat.opacity = 0.78;
          sonarWaveMesh.visible = true;
          if (bossObj && bossObj.active) {
            sim.sonarWeakPointSlot = pickBestBossSonarWeakPoint();
          }
          break;
        }
        case 'riptide_overdrive': {
          thrusterSurgeTimer = 1.45;
          spawnExhaustEmberJet(16, 28);
          break;
        }
        case 'phantom_sonar': {
          sim.sonarActiveTimer = Math.max(
            sim.sonarActiveTimer,
            ship.activeAbility.durationSeconds + sim.shipSonarDurationBonus,
          );
          sim.sonarWaveTimer = 0.85;
          sonarWaveMesh.position.copy(vanguard.group.position);
          sonarWaveMesh.scale.setScalar(1.8);
          sonarWaveMat.opacity = 0.72;
          sonarWaveMesh.visible = true;
          projectiles.forEach((p) => {
            if (p.active && !p.isPlayer) {
              p.vel.multiplyScalar(0.45);
            }
          });
          if (bossObj && bossObj.active) {
            sim.sonarWeakPointSlot = pickBestBossSonarWeakPoint();
          }
          break;
        }
        case 'aegis_pulse': {
          sim.hullStress = 0;
          sim.shield = Math.min(sim.maxShield, sim.shield + 22);
          (
            vanguard.shieldSphere.material as THREE.MeshBasicMaterial
          ).opacity = 0.85;
          break;
        }
        case 'predator_mark': {
          let weakestId: number | null = null;
          let lowestRatio = 2.0;
          enemies.forEach((e) => {
            if (e.active) {
              const r = e.hp / Math.max(1, e.maxHp);
              if (r < lowestRatio) {
                lowestRatio = r;
                weakestId = e.id;
              }
            }
          });
          if (bossObj && bossObj.active) {
            bossObj.appendages.forEach((app) => {
              if (!app.destroyed) {
                const r = app.hp / Math.max(1, app.maxHp);
                if (r <= lowestRatio) {
                  lowestRatio = r;
                  weakestId = app.numericId;
                }
              }
            });
            if (weakestId === null) weakestId = bossObj.id;
          }
          sim.markedTargetId = weakestId;
          if (weakestId !== null && !sim.lockedTargetIds.includes(weakestId)) {
            if (sim.lockedTargetIds.length >= sim.maxLocks) {
              sim.lockedTargetIds.shift();
            }
            sim.lockedTargetIds.push(weakestId);
          }
          break;
        }
        case 'arc_storm': {
          const arcTargets: { pos: THREE.Vector3; enemy?: EnemyEntity; app?: BossAppendageRuntime }[] = [];
          enemies.forEach((e) => {
            if (e.active && arcTargets.length < 5) {
              arcTargets.push({ pos: e.group.position, enemy: e });
            }
          });
          if (bossObj && bossObj.active && arcTargets.length < 5) {
            bossObj.appendages.forEach((app) => {
              if (!app.destroyed && arcTargets.length < 5) {
                arcTargets.push({ pos: app.worldPos, app });
              }
            });
          }
          const shockDmg = Math.round(58 * sim.shipPrimaryDmgMult);
          let prevPos = vanguard.group.position.clone();
          arcBeams.forEach((b) => {
            b.visible = false;
          });
          arcTargets.forEach((tgt, idx) => {
            if (idx < arcBeams.length) {
              orientArcBeam(arcBeams[idx], prevPos, tgt.pos);
              prevPos = tgt.pos.clone();
            }
            spawnParticleBurst(tgt.pos, 0x818cf8, 12, 16);
            if (tgt.enemy) {
              tgt.enemy.hp -= shockDmg;
              tgt.enemy.isFiringWindup = false;
              (tgt.enemy.telegraphRing.material as THREE.MeshBasicMaterial).opacity = 0;
              tgt.enemy.hitFlashTimer = 0.14;
            } else if (tgt.app && bossObj) {
              tgt.app.hp = Math.max(0, tgt.app.hp - shockDmg);
              bossObj.hp = Math.max(1, bossObj.hp - shockDmg * 0.55);
              tgt.app.hitFlashTimer = 0.14;
            }
          });
          resolveDefeatedEntitiesAndAppendages(true);
          sim.arcLightningTimer = 0.45;
          arcBeamMat.color.setHex(0x818cf8);
          arcBeamMat.opacity = 0.95;
          break;
        }
        case 'phase_slip': {
          sim.boost = sim.maxBoost;
          projectiles.forEach((p) => {
            if (
              p.active &&
              !p.isPlayer &&
              p.pos.distanceTo(vanguard.group.position) < 20
            ) {
              p.active = false;
              p.mesh.visible = false;
              spawnParticleBurst(p.pos, 0x2dd4bf, 5, 10);
            }
          });
          break;
        }
        case 'seismic_lock': {
          sim.cameraShake = Math.min(
            1,
            sim.cameraShake + 0.35 * (playerSave.settings.cameraShakeIntensity / 100),
          );
          if (bossObj && bossObj.active) {
            sim.sonarWeakPointSlot = pickBestBossSonarWeakPoint();
          }
          break;
        }
        case 'guardian_swarm': {
          sim.droneFireTimer = 0.2;
          sim.droneHealTimer = 0.5;
          repairDroneGroup.visible = true;
          attackDroneGroup.visible = true;
          break;
        }
        case 'gravitic_harpoon': {
          sim.vortexActiveTimer = ship.activeAbility.durationSeconds;
          sim.vortexPos.set(sim.playerX, sim.playerY, -28);
          vortexGroup.position.copy(sim.vortexPos);
          vortexRingMat.color.setHex(0x10b981);
          vortexCoreMat.color.setHex(0xd97706);
          vortexGroup.visible = true;
          break;
        }
        case 'sovereign_barrage': {
          const barrageTargets: number[] = [];
          if (bossObj && bossObj.active) {
            bossObj.appendages.forEach((app) => {
              if (!app.destroyed && barrageTargets.length < 3) {
                barrageTargets.push(app.numericId);
              }
            });
            if (barrageTargets.length < 3) barrageTargets.push(bossObj.id);
          }
          enemies.forEach((e) => {
            if (e.active && barrageTargets.length < 3) {
              barrageTargets.push(e.id);
            }
          });
          const freeDmg = Math.round(98 * sim.shipSecondaryDmgMult * 1.12);
          vanguard.group.updateMatrixWorld(true);
          let fired = 0;
          for (let k = 0; k < 6; k++) {
            for (let i = 50; i < 66; i++) {
              const p = projectiles[i];
              if (!p.active) {
                p.active = true;
                p.isPlayer = true;
                p.isTorpedo = true;
                p.isGuidedEnemyTorpedo = false;
                const spreadX = (k - 2.5) * 0.7;
                _vec3A
                  .set(spreadX, 0.2, -0.6)
                  .applyMatrix4(vanguard.group.matrixWorld);
                p.pos.copy(_vec3A);
                p.prevPos.copy(_vec3A);
                p.vel.set(
                  spreadX * 5,
                  5 + (k % 2) * 3,
                  -sim.shipSecondarySpeed * 0.85,
                );
                p.radius = 0.95;
                p.targetEnemyId =
                  barrageTargets.length > 0
                    ? barrageTargets[k % barrageTargets.length]
                    : null;
                p.damage = freeDmg;
                p.life = 3.2;
                p.mesh.position.copy(p.pos);
                p.mesh.visible = true;
                fired++;
                break;
              }
            }
          }
          if (fired > 0) {
            soundEngine.playTorpedoLaunch(fired);
          }
          break;
        }
        case 'pelagic_singularity': {
          sim.vortexActiveTimer = ship.activeAbility.durationSeconds;
          sim.vortexPos.set(sim.playerX, sim.playerY, -32);
          vortexGroup.position.copy(sim.vortexPos);
          vortexRingMat.color.setHex(0x22d3ee);
          vortexCoreMat.color.setHex(0xfbbf24);
          vortexGroup.visible = true;
          sim.shield = Math.min(
            sim.maxShield,
            sim.shield + Math.round(sim.maxShield * 0.18),
          );
          if (bossObj && bossObj.active) {
            sim.sonarWeakPointSlot = pickBestBossSonarWeakPoint();
          }
          projectiles.forEach((p) => {
            if (
              p.active &&
              !p.isPlayer &&
              p.pos.distanceTo(vanguard.group.position) < 28
            ) {
              p.active = false;
              p.mesh.visible = false;
              spawnParticleBurst(p.pos, 0x22d3ee, 5, 10);
            }
          });
          break;
        }
      }

      syncHudSnapshot();
    }

    function executeBarrelRoll() {
      const rollCost = sim.upgrades.includes('hydro_thruster_coil') ? 20 : 26;
      if (sim.barrelRollTimer <= 0 && sim.boost >= rollCost) {
        sim.boost -= rollCost;
        const baseRollDur = sim.upgrades.includes('hydro_thruster_coil')
          ? 0.56
          : 0.45;
        // Distinctive per-ship defensive maneuver bonuses (Phase 7)
        const shipEvadeBonus =
          sim.activeShipId === 'rift_manta'
            ? 1.22
            : sim.activeShipId === 'echo_tactical'
              ? 1.16
              : 1.0;
        sim.barrelRollTimer = baseRollDur * shipEvadeBonus;
        sim.rollsExecutedThisSortie += 1;
        sim.barrelRollDir =
          heldKeys.has('KeyA') || heldKeys.has('ArrowLeft') || touchMoveX < -0.2
            ? 1
            : heldKeys.has('KeyD') ||
                heldKeys.has('ArrowRight') ||
                touchMoveX > 0.2
              ? -1
              : 1;

        const shipDef =
          SHIP_CATALOG.find((s) => s.id === sim.activeShipId) || SHIP_CATALOG[0];
        soundEngine.playBarrelRoll();
        triggerHaptic(18);
        spawnParticleBurst(
          vanguard.group.position,
          shipDef.propulsionVfxConfig.primaryColorHex,
          18,
          15,
        );

        // Bathys-Bastion IV Fortress Shield-Barge roll restores +5 shield
        if (sim.activeShipId === 'aegis_guardian') {
          sim.shield = Math.min(sim.maxShield, sim.shield + 5);
        }

        // If Voltaic Shield Capacitor upgrade is active OR piloting Tempest Corsair, EMP clear nearby enemy plasma bolts
        const empRadius = sim.upgrades.includes('voltaic_shield_capacitor')
          ? 24
          : sim.activeShipId === 'tempest_corsair'
            ? 18
            : 0;
        if (empRadius > 0) {
          projectiles.forEach((p) => {
            if (
              p.active &&
              !p.isPlayer &&
              p.pos.distanceTo(vanguard.group.position) < empRadius
            ) {
              p.active = false;
              p.mesh.visible = false;
              spawnParticleBurst(
                p.pos,
                shipDef.propulsionVfxConfig.secondaryColorHex,
                6,
                10,
              );
            }
          });
        }
      }
    }

    function firePrimaryCannons() {
      sim.shotSequenceCount += 1;
      const overcharged = sim.upgrades.includes('cavitation_overcharge');
      const overchargeMult = 1 + 0.35 * getModuleTierMult('cavitation_overcharge');
      const sovereignPassive = sim.activeShipId === 'abyssal_sovereign' ? 1.12 : 1.0;
      const boltSpeed = sim.shipPrimarySpeed * (overcharged ? 1.15 : 1);
      const boltDamage = Math.round(
        24 *
          sim.shipPrimaryDmgMult *
          sovereignPassive *
          (overcharged ? overchargeMult : 1),
      );

      // Ensure player ship world matrix is up to date before computing muzzle world coordinates
      vanguard.group.updateMatrixWorld(true);

      const allMuzzles = vanguard.getPrimaryMuzzleOffsets();
      const useAllMounts =
        allMuzzles.length <= 2 ||
        (sim.activeShipId === 'leviathan_assault' && sim.shotSequenceCount % 2 === 0) ||
        (sim.activeShipId === 'kraken_reaper' && sim.shotSequenceCount % 3 === 0) ||
        (sim.activeShipId === 'abyssal_sovereign' && sim.shotSequenceCount % 2 === 0) ||
        (sim.activeShipId === 'pelagic_ascendant' && sim.shotSequenceCount % 2 === 0);

      const activeMuzzles = useAllMounts ? allMuzzles : allMuzzles.slice(0, 2);
      const perBoltDamage =
        activeMuzzles.length > 2 ? Math.round(boltDamage * 0.68) : boltDamage;

      const shotVectors = computeMuzzleShotVectors(
        vanguard.group,
        activeMuzzles,
        sim.aimPointWorld,
        boltSpeed,
        playerSave.equippedPrimaryWeapon,
        sim.shotSequenceCount,
      );

      let firedAny = false;
      let firedCount = 0;
      shotVectors.forEach((shot) => {
        for (let i = 0; i < 50; i++) {
          const p = projectiles[i];
          if (!p.active) {
            p.active = true;
            p.isPlayer = true;
            p.isTorpedo = false;
            p.isGuidedEnemyTorpedo = false;
            p.pos.copy(shot.muzzleWorldPos);
            p.prevPos.copy(shot.muzzleWorldPos);
            p.vel.copy(shot.velocity);
            p.radius =
              playerSave.equippedPrimaryWeapon === 'focused_bio_lance'
                ? 0.92
                : 0.78;
            p.damage = perBoltDamage;
            p.life = 1.85;
            p.targetEnemyId = null;
            p.mesh.position.copy(p.pos);
            _vec3A.copy(p.pos).add(shot.direction);
            p.mesh.lookAt(_vec3A);
            p.mesh.visible = true;
            firedAny = true;
            firedCount++;
            break;
          }
        }
      });

      // Tempest Corsair passive: every 4th primary volley arcs lightning to nearest active hostile
      if (
        sim.activeShipId === 'tempest_corsair' &&
        sim.shotSequenceCount % 4 === 0
      ) {
        const nearestEnemy = enemies
          .filter((e) => e.active)
          .sort(
            (a, b) =>
              a.group.position.distanceToSquared(sim.aimPointWorld) -
              b.group.position.distanceToSquared(sim.aimPointWorld),
          )[0];
        if (nearestEnemy) {
          nearestEnemy.hp -= Math.round(boltDamage * 0.9);
          nearestEnemy.hitFlashTimer = 0.12;
          orientArcBeam(
            arcBeams[0],
            vanguard.group.position,
            nearestEnemy.group.position,
          );
          arcBeamMat.color.setHex(0x6366f1);
          arcBeamMat.opacity = 0.88;
          sim.arcLightningTimer = 0.22;
          spawnParticleBurst(nearestEnemy.group.position, 0x818cf8, 8, 12);
          resolveDefeatedEntitiesAndAppendages(false);
        } else if (bossObj && bossObj.active) {
          const app = bossObj.appendages.find((a) => !a.destroyed);
          if (app) {
            app.hp = Math.max(0, app.hp - Math.round(boltDamage * 0.9));
            bossObj.hp = Math.max(1, bossObj.hp - Math.round(boltDamage * 0.5));
            app.hitFlashTimer = 0.12;
            orientArcBeam(arcBeams[0], vanguard.group.position, app.worldPos);
            arcBeamMat.color.setHex(0x6366f1);
            arcBeamMat.opacity = 0.88;
            sim.arcLightningTimer = 0.22;
            resolveDefeatedEntitiesAndAppendages(false);
          }
        }
      }

      if (firedAny) {
        sim.shotsFired += firedCount;
        vanguard.triggerWeaponFire(false);
        soundEngine.playLaserShot(overcharged);
      }
    }

    function resolveTorpedoTargetPosition(targetId: number): THREE.Vector3 {
      const enemy = enemies.find((e) => e.active && e.id === targetId);
      if (enemy) return enemy.group.position;
      if (bossObj && bossObj.active) {
        const app = bossObj.appendages.find(
          (a) => !a.destroyed && a.numericId === targetId,
        );
        if (app) return app.worldPos;
        if (bossObj.id === targetId) return bossObj.group.position;
      }
      return sim.aimPointWorld;
    }

    function launchTorpedoSalvo() {
      if (sim.torpedoCooldown > 0) return;

      // If no targets are pre-locked, automatically lock up to maxLocks active targets closest to aimPointWorld
      if (sim.lockedTargetIds.length === 0) {
        if (bossObj && bossObj.active) {
          const intactApps = bossObj.appendages
            .filter((app) => !app.destroyed)
            .sort(
              (a, b) =>
                a.worldPos.distanceToSquared(sim.aimPointWorld) -
                b.worldPos.distanceToSquared(sim.aimPointWorld),
            );
          for (const app of intactApps) {
            if (sim.lockedTargetIds.length < sim.maxLocks) {
              sim.lockedTargetIds.push(app.numericId);
            }
          }
          if (sim.lockedTargetIds.length < sim.maxLocks) {
            sim.lockedTargetIds.push(bossObj.id);
            bossObj.locked = true;
          }
        }
        const sortedEnemies = enemies
          .filter((e) => e.active)
          .sort(
            (a, b) =>
              a.group.position.distanceToSquared(sim.aimPointWorld) -
              b.group.position.distanceToSquared(sim.aimPointWorld),
          );
        for (const e of sortedEnemies) {
          if (sim.lockedTargetIds.length < sim.maxLocks) {
            sim.lockedTargetIds.push(e.id);
            e.locked = true;
          }
        }
      }

      if (sim.lockedTargetIds.length === 0) return;

      vanguard.group.updateMatrixWorld(true);
      let launched = 0;
      const baseTorpDmg = sim.upgrades.includes('quad_torpedo_salvo') ? 105 : 88;
      const sovereignPassive = sim.activeShipId === 'abyssal_sovereign' ? 1.12 : 1.0;
      const torpDamage = Math.round(
        baseTorpDmg * sim.shipSecondaryDmgMult * sovereignPassive,
      );
      const secMuzzles = vanguard.getSecondaryMuzzleOffsets();
      const shipDef =
        SHIP_CATALOG.find((s) => s.id === sim.activeShipId) || SHIP_CATALOG[0];

      sim.lockedTargetIds.forEach((targetId, idx) => {
        for (let i = 50; i < 66; i++) {
          const p = projectiles[i];
          if (!p.active) {
            p.active = true;
            p.isPlayer = true;
            p.isTorpedo = true;
            p.isGuidedEnemyTorpedo = false;
            const muzzle = secMuzzles[idx % secMuzzles.length];
            const sideSign = muzzle ? Math.sign(muzzle.x) || 1 : idx % 2 === 0 ? -1 : 1;
            _vec3A
              .set(
                muzzle ? muzzle.x : sideSign * 1.2,
                muzzle ? muzzle.y : -0.35,
                muzzle ? muzzle.z : -0.8,
              )
              .applyMatrix4(vanguard.group.matrixWorld);
            p.pos.copy(_vec3A);
            p.prevPos.copy(_vec3A);

            // Initial launch vector toward each torpedo's locked target world position
            const targetWorldPos = resolveTorpedoTargetPosition(targetId);
            _vec3B.subVectors(targetWorldPos, p.pos).normalize();
            _vec3B.x += sideSign * 0.05;
            _vec3B.y += (idx % 3) * 0.02;
            _vec3B.normalize().multiplyScalar(sim.shipSecondarySpeed * 0.88);
            p.vel.copy(_vec3B);
            p.radius = 0.95;
            p.targetEnemyId = targetId;
            p.damage = torpDamage;
            p.life = 3.4;
            p.mesh.position.copy(p.pos);
            _vec3C.copy(p.pos).add(p.vel);
            p.mesh.lookAt(_vec3C);
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
        spawnParticleBurst(
          vanguard.group.position,
          shipDef.weaponVfxConfig.torpedoColorHex,
          16,
          16,
        );
        const salvoReloadFactor = sim.upgrades.includes('quad_torpedo_salvo')
          ? Math.max(0.55, 1 - 0.22 * getModuleTierMult('quad_torpedo_salvo'))
          : 1;
        sim.torpedoCooldown = sim.shipSecondaryCooldown * salvoReloadFactor;
        soundEngine.playTorpedoLaunch(launched);
        triggerHaptic([16, 20, 26]);
      }
    }

    function fireEnemyPlasma(
      origin: THREE.Vector3,
      aimAtPlayer: boolean = true,
      customVel?: THREE.Vector3,
      options?: {
        damage?: number;
        radius?: number;
        scale?: number;
        isGuided?: boolean;
      },
    ) {
      for (let i = 66; i < PROJECTILE_POOL_SIZE; i++) {
        const p = projectiles[i];
        if (!p.active) {
          p.active = true;
          p.isPlayer = false;
          p.isTorpedo = false;
          p.isGuidedEnemyTorpedo = Boolean(options?.isGuided);
          p.pos.copy(origin);
          p.prevPos.copy(origin);
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
          p.radius = options?.radius ?? 0.48;
          p.damage = options?.damage ?? 16;
          p.life = 3.8;
          p.mesh.scale.setScalar(options?.scale ?? 1.0);
          p.mesh.position.copy(p.pos);
          p.mesh.visible = true;
          break;
        }
      }
    }

    function damagePlayer(rawAmount: number) {
      if (
        sim.barrelRollTimer > 0 ||
        (sim.activeAbilityId === 'phase_slip' && sim.activeAbilityTimer > 0)
      ) {
        // Deflected by hydro-barrel roll or Phase Slip invulnerability!
        soundEngine.playSonarPing(960);
        return;
      }

      const diffMult =
        DIFFICULTY_CONFIGS[playerSave.selectedDifficulty].enemyDamageMult;
      const bastionPassiveMult =
        sim.activeShipId === 'aegis_guardian' ? 0.88 : 1.0;
      const aegisActiveMult =
        sim.activeAbilityId === 'aegis_pulse' && sim.activeAbilityTimer > 0
          ? 0.5
          : 1.0;
      const amount = Math.max(
        1,
        Math.round(
          rawAmount * diffMult * bastionPassiveMult * aegisActiveMult,
        ),
      );

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
        // Flight State #8: High-pressure underwater cavitation implosion shockwave on ship destruction
        const shipDef =
          SHIP_CATALOG.find((s) => s.id === sim.activeShipId) || SHIP_CATALOG[0];
        spawnParticleBurst(
          vanguard.group.position,
          shipDef.propulsionVfxConfig.primaryColorHex,
          42,
          28,
        );
        spawnParticleBurst(vanguard.group.position, 0xe0f2fe, 28, 18);
        soundEngine.playImpact(true);
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
        objCurrent = sim.bossDefeated ? 1 : 0;
      }

      const aliveCount = enemies.filter((e) => e.active).length;
      const totalWaves = Math.max(1, activeMission.waves.length);
      const currentWaveIdx = Math.min(totalWaves, Math.max(1, sim.waveCursor));
      const remainingObjectiveKills = Math.max(
        0,
        activeMission.targetKillsRequired - objCurrent,
      );
      const remainingHostiles = Math.max(
        aliveCount + sim.pendingSpawns.length,
        remainingObjectiveKills,
      );

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
        shipRarity: sim.shipRarity,
        shipRoleTitle: sim.shipRoleTitle,
        activeAbilityName: sim.activeAbilityName,
        activeAbilityActive: sim.activeAbilityTimer > 0,
        activeAbilityRemainingSeconds: Math.max(0, sim.activeAbilityTimer),
        activeAbilityCooldown: Math.max(
          0,
          Math.min(
            1,
            sim.activeAbilityCooldown / Math.max(1, sim.activeAbilityCooldownMax),
          ),
        ),
        activeAbilityCooldownSeconds: Math.ceil(sim.activeAbilityCooldown),
        activeDronesCount:
          sim.activeAbilityId === 'guardian_swarm' && sim.activeAbilityTimer > 0
            ? 2
            : 0,
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
        aliveEnemiesCount: aliveCount,
        remainingMissionEnemies: remainingHostiles,
        currentWaveIndex: currentWaveIdx,
        totalWavesCount: totalWaves,
        missionPhase: sim.missionPhase,
        missionTotalPhases: 6,
        missionPhaseLabel: sim.missionPhaseLabel,
        reticleState: sim.reticleState,
        activeAimTargetLabel: sim.activeAimTargetLabel,
        hitConfirmType: sim.hitConfirmTimer > 0 ? sim.hitConfirmType : 'none',
        hitConfirmLabel: sim.hitConfirmTimer > 0 ? sim.hitConfirmLabel : null,
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
      sim.pendingSpawns = [];
      sim.waveCursor = activeMission.waves.length;
      sim.stageElapsed = activeMission.durationSeconds;
      sim.stageProgress = 0.88;
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
      const shipDef =
        SHIP_CATALOG.find((s) => s.id === shipId) || SHIP_CATALOG[0];
      const changed =
        shipId !== lastPreviewedShipId ||
        targetCosmeticId !== lastPreviewedCosmeticId;

      vanguard.setAppearance(shipId, cosmetic.trimColorHex, {
        primaryWeaponId: playerSave.equippedPrimaryWeapon,
        secondaryWeaponId: playerSave.equippedSecondaryWeapon,
        activeUpgrades: playerSave.activeUpgrades.slice(0, shipDef.moduleCapacity),
        upgradeTiers: playerSave.upgradeTiers,
        pilotLevel: playerSave.pilotLevel,
      });

      // Mythic & Apex Berth Presentation for Tiers 8 to 12: Golden-Cyan Dock Ring Aura & Volumetric Floodlights
      const isPrestigeTier = (shipDef.tier || 1) >= 8;
      if (isPrestigeTier) {
        dockRingInnerMat.color.setHex(
          shipDef.tier === 12
            ? 0x22d3ee
            : shipDef.propulsionVfxConfig.primaryColorHex,
        );
        dockRingInnerMat.opacity = 0.65;
        dockRingOuterMat.color.setHex(0xfbbf24);
        dockRingOuterMat.opacity = 0.48;
        volumetricConeMat.color.setHex(
          shipDef.tier === 12 ? 0xfbbf24 : 0x22d3ee,
        );
        volumetricConeMat.opacity = 0.095;
        shipPointLight.color.setHex(0xfef08a);
      } else {
        dockRingInnerMat.color.setHex(cosmetic.trimColorHex);
        dockRingInnerMat.opacity = 0.42;
        dockRingOuterMat.color.setHex(0x38bdf8);
        dockRingOuterMat.opacity = 0.2;
        volumetricConeMat.color.setHex(0x38bdf8);
        volumetricConeMat.opacity = 0.055;
        shipPointLight.color.setHex(cosmetic.trimColorHex);
      }

      if (changed) {
        lastPreviewedShipId = shipId;
        lastPreviewedCosmeticId = targetCosmeticId;
        shipSwitchAnimTimer = 0.65;
        thrusterSurgeTimer = 0.85;
        vanguard.group.scale.setScalar(0.86);
        const shieldMat = vanguard.shieldSphere
          .material as THREE.MeshBasicMaterial;
        shieldMat.opacity = isPrestigeTier ? 0.68 : 0.52;
        spawnParticleBurst(
          vanguard.group.position,
          isPrestigeTier ? 0xfbbf24 : cosmetic.trimColorHex,
          isPrestigeTier ? 28 : 22,
          14,
        );
        soundEngine.playSonarPing(isPrestigeTier ? 960 : 820);
      }
    }

    // Register imperative controller with parent App
    recomputeLoadoutStats();
    onRegisterController({
      startStage,
      startMission,
      setMode: (nextMode: GameStateMode) => {
        if (nextMode !== 'playing') {
          touchMoveX = 0;
          touchMoveY = 0;
          touchFiring = false;
          pointerFiring = false;
          isTouchAimDragging = false;
          touchAimPointerId = null;
        }
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
        if (Math.hypot(x, y) > 0.05) {
          isMouseAimActive = false;
        }
      },
      setTouchFiring: (firing: boolean) => {
        touchFiring = firing;
      },
      triggerBarrelRoll: executeBarrelRoll,
      triggerTorpedoSalvo: launchTorpedoSalvo,
      triggerTacticalSonar: executeTacticalSonar,
      triggerShipAbility: executeShipAbility,
      focusBossAppendage,
      summonBossNow,
    });

    // 12. Mobile-First Touch & Pointer Input Handling (Orbit, Pinch-Zoom, Touch-Drag Aim & Tap-Lock)
    const heldKeys = new Set<string>();
    let pointerFiring = false;
    let isMouseAimActive = false;
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

      if (e.code === 'F3') {
        e.preventDefault();
        updateSettings({
          aimDebugEnabled: !playerSave.settings.aimDebugEnabled,
        });
        return;
      }

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
      } else if (e.code === 'KeyR' || e.code === 'KeyG') {
        e.preventDefault();
        executeShipAbility();
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
        isMouseAimActive = false;
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
      } else if (e.pointerType === 'mouse') {
        const rect = renderer.domElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        isMouseAimActive = true;
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

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleWindowBlur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
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
    let sceneElapsed = 0;

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

      if (document.hidden) {
        clock.getDelta();
        frameId = requestAnimationFrame(tick);
        return;
      }

      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      sceneElapsed += dt;
      const elapsed = sceneElapsed;
      const currentMode = modeRef.current;
      const isLobbyMode = currentMode !== 'playing' && currentMode !== 'paused';
      hangarLife.update(elapsed, dt, isLobbyMode);

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
      const moveEffort =
        currentMode === 'playing'
          ? Math.min(1, Math.hypot(sim.playerVelX, sim.playerVelY) / 26)
          : 0;
      const surgeBoost =
        sim.barrelRollTimer > 0
          ? 2.45
          : sim.activeAbilityId === 'riptide_overdrive' &&
              sim.activeAbilityTimer > 0
            ? 2.3
            : thrusterSurgeTimer > 0
              ? igniteBoost
              : currentMode === 'playing'
                ? 0.92 + moveEffort * 0.52
                : 0.78;
      const steerNormalized =
        currentMode === 'playing'
          ? THREE.MathUtils.clamp(sim.playerVelX / 24, -1, 1)
          : 0;
      const lowHullDamageRatio =
        currentMode === 'playing'
          ? THREE.MathUtils.clamp(
              1 - sim.hull / Math.max(1, sim.maxHull * 0.55),
              0,
              1,
            )
          : 0;
      vanguard.setAbilityVisualState(
        currentMode === 'playing' && sim.activeAbilityTimer > 0,
      );
      vanguard.updateShipEffects(
        elapsed,
        dt,
        surgeBoost,
        steerNormalized,
        lowHullDamageRatio,
        sim.barrelRollTimer > 0,
      );

      // Phase 11 Damage Animation: Minor electrical discharge & cavitation bubble leakage when hull is low
      if (
        currentMode === 'playing' &&
        lowHullDamageRatio > 0.25 &&
        Math.random() < lowHullDamageRatio * 0.24
      ) {
        spawnParticleBurst(
          vanguard.group.position,
          Math.random() > 0.45 ? 0x38bdf8 : 0xfbbf24,
          3,
          10,
        );
      }

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
        aimDebugGroup.visible = false;

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
          -0.38 + Math.sin(elapsed * 0.16) * 0.14 + hangarUserYaw + sim.aimX * 0.16;

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
          targetShipScale = isPortraitViewport ? 0.82 : 0.88;
          targetCamX = 0.25 + sim.aimX * 0.32;
          targetCamY =
            (isPortraitViewport ? 1.28 : 1.05) +
            hangarUserPitch * 1.6 +
            sim.aimY * 0.18;
          targetCamZ = (isPortraitViewport ? 8.6 : 9.4) * hangarZoom;
          targetCamX += Math.sin(elapsed * 0.14) * 0.24;
          targetCamY += Math.sin(elapsed * 0.12) * 0.1;
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
        const missionDuration = Math.max(60, activeMission.durationSeconds);
        const missionWaves = activeMission.waves;
        const telegraphSpeedMult =
          DIFFICULTY_CONFIGS[playerSave.selectedDifficulty].telegraphSpeedMult;
        sim.stageElapsed += dt;
        sim.waveScheduleElapsed += dt;

        if (sim.hitConfirmTimer > 0) {
          sim.hitConfirmTimer = Math.max(0, sim.hitConfirmTimer - dt);
          if (sim.hitConfirmTimer <= 0) {
            sim.hitConfirmType = 'none';
            sim.hitConfirmLabel = null;
          }
        }
        if (sim.targetLostTimer > 0) {
          sim.targetLostTimer = Math.max(0, sim.targetLostTimer - dt);
        }

        // Flush any queued wave entities up to the mobile active-hostile cap
        flushPendingSpawns();

        // Advance 6-phase wave scheduler on virtual schedule timer OR wave clear (NEVER mutating real sim.stageElapsed!)
        if (!bossObj) {
          const scheduleRatio = sim.waveScheduleElapsed / missionDuration;
          while (
            sim.waveCursor < missionWaves.length &&
            scheduleRatio >= missionWaves[sim.waveCursor].progressTrigger
          ) {
            const w = missionWaves[sim.waveCursor];
            spawnWave(w);
            sim.waveCursor++;
            sim.waveClearAdvanceTimer = 0;
          }

          // Wave-clear reinforcement advance: if active wave is wiped out early, advance virtual schedule clock after a 2.0s breather
          const activeHostileCount = enemies.filter((e) => e.active).length;
          if (
            sim.waveCursor > 0 &&
            sim.waveCursor < missionWaves.length &&
            activeHostileCount === 0 &&
            sim.pendingSpawns.length === 0
          ) {
            sim.waveClearAdvanceTimer += dt;
            if (sim.waveClearAdvanceTimer >= 2.0) {
              sim.waveClearAdvanceTimer = 0;
              const nextWave = missionWaves[sim.waveCursor];
              sim.waveScheduleElapsed = Math.max(
                sim.waveScheduleElapsed,
                nextWave.progressTrigger * missionDuration,
              );
              spawnWave(nextWave);
              sim.waveCursor++;
            }
          } else if (sim.waveCursor < missionWaves.length) {
            sim.waveClearAdvanceTimer = 0;
          }
        }

        // Authoritative 6-phase mission state & completion evaluator
        const aliveCombatCount = enemies.filter(
          (e) => e.active && e.type !== 'hazard_mine',
        ).length;
        const aliveMineCount = enemies.filter(
          (e) => e.active && e.type === 'hazard_mine',
        ).length;
        const missionEval = evaluateMissionStateAndCompletion({
          mission: activeMission,
          hull: sim.hull,
          stageElapsed: sim.stageElapsed,
          waveCursor: sim.waveCursor,
          totalWaves: missionWaves.length,
          pendingSpawnsCount: sim.pendingSpawns.length,
          aliveCombatEnemiesCount: aliveCombatCount,
          aliveMinesCount: aliveMineCount,
          enemiesDefeated: sim.enemiesDefeated,
          elitesDefeated: sim.elitesDefeated,
          beaconIntegrityPct: sim.beaconIntegrityPct ?? 100,
          bossSpawned: sim.bossSpawned,
          bossActive: Boolean(bossObj && bossObj.active),
          bossDefeated: sim.bossDefeated,
          shotsFired: sim.shotsFired,
          sonarPulsesUsed: sim.sonarPulsesUsedThisSortie,
          rollsExecuted: sim.rollsExecutedThisSortie,
        });

        // Dynamic reinforcement wave spawner when all scheduled waves are exhausted but real-time duration or kill/elite targets are not yet met
        if (
          !bossObj &&
          missionEval.needsReinforcementWave &&
          aliveCombatCount === 0 &&
          sim.pendingSpawns.length === 0
        ) {
          sim.waveClearAdvanceTimer += dt;
          if (sim.waveClearAdvanceTimer >= 2.0) {
            sim.waveClearAdvanceTimer = 0;
            sim.reinforcementWavesSpawned += 1;
            const rIdx = sim.reinforcementWavesSpawned;
            const isEliteMission = activeMission.objectiveType === 'hunt_elites';
            const primaryType: EnemyType = isEliteMission
              ? rIdx % 2 === 0
                ? 'cruiser'
                : 'manta'
              : sim.stageId === 1
                ? rIdx % 3 === 0
                  ? 'manta'
                  : rIdx % 2 === 0
                    ? 'jelly'
                    : 'skimmer'
                : sim.stageId === 2
                  ? rIdx % 3 === 0
                    ? 'cruiser'
                    : rIdx % 2 === 0
                      ? 'manta'
                      : 'skimmer'
                  : rIdx % 2 === 0
                    ? 'cruiser'
                    : 'manta';
            const escortType: EnemyType =
              primaryType === 'cruiser'
                ? 'skimmer'
                : primaryType === 'manta'
                  ? 'jelly'
                  : 'manta';
            spawnWave({
              progressTrigger: 0.85,
              enemyType: primaryType,
              count: primaryType === 'cruiser' ? 2 : 4,
              formation:
                rIdx % 3 === 0
                  ? 'spiral_ring'
                  : rIdx % 2 === 0
                    ? 'flank_pair'
                    : 'v_wedge',
              spread: 18,
              isElite: isEliteMission || primaryType === 'cruiser' || rIdx % 2 === 0,
              escortType,
              escortCount: 2,
            });
          }
        }

        const waveRatio =
          missionWaves.length > 0
            ? sim.waveCursor / missionWaves.length
            : 0;
        const timeRatio = Math.min(0.85, sim.stageElapsed / missionDuration);
        sim.stageProgress = sim.bossDefeated
          ? 1.0
          : bossObj && bossObj.active
            ? 0.88 + (1 - bossObj.hp / Math.max(1, bossObj.maxHp)) * 0.11
            : Math.min(0.86, Math.max(waveRatio * 0.65, timeRatio));
        sim.missionPhase = missionEval.phaseNumber;
        sim.missionPhaseLabel = missionEval.phaseTitle;

        if (missionEval.shouldSpawnBossNow && !sim.bossSpawned && !bossObj) {
          spawnStageBoss(sim.stageId);
        } else if (missionEval.shouldCompleteVictory && !sim.sortieCompleted) {
          sim.stageProgress = 1;
          finalizeSortie(true);
          soundEngine.playStageClearFanfare();
          syncHudSnapshot(
            activeMission.hasBossFinale && sim.stageId === 3
              ? 'victory'
              : 'stage_clear',
          );
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

        // =====================================================================
        // STEP 1: UPDATE PLAYER SHIP STEERING, POSITION, ROTATION & WORLD MATRIX
        // =====================================================================
        let moveX = touchMoveX;
        let moveY = touchMoveY;
        if (heldKeys.has('KeyA') || heldKeys.has('ArrowLeft')) moveX -= 1;
        if (heldKeys.has('KeyD') || heldKeys.has('ArrowRight')) moveX += 1;
        if (heldKeys.has('KeyW') || heldKeys.has('ArrowUp')) moveY += 1;
        if (heldKeys.has('KeyS') || heldKeys.has('ArrowDown')) moveY -= 1;
        moveX = THREE.MathUtils.clamp(moveX, -1, 1);
        moveY = THREE.MathUtils.clamp(moveY, -1, 1);

        const baseSpeed = sim.upgrades.includes('hydro_thruster_coil')
          ? 27
          : 22;
        const overdriveSpeedMult =
          sim.activeAbilityId === 'riptide_overdrive' &&
          sim.activeAbilityTimer > 0
            ? 1.35
            : 1.0;
        const speedMult = baseSpeed * sim.shipSpeedMult * overdriveSpeedMult;
        const accelDamp = 9 * sim.shipAccelMult;
        sim.playerVelX = THREE.MathUtils.damp(
          sim.playerVelX,
          moveX * speedMult,
          accelDamp,
          dt,
        );
        sim.playerVelY = THREE.MathUtils.damp(
          sim.playerVelY,
          moveY * speedMult,
          accelDamp,
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
          const targetRoll = -sim.playerVelX * 0.032 * sim.shipTurnRateMult;
          sim.rollAngle = THREE.MathUtils.damp(
            sim.rollAngle,
            targetRoll,
            10 * sim.shipTurnRateMult,
            dt,
          );
        }

        // Update reticle steering & local target magnetism BEFORE camera lookAt (and never override active mouse cursor)
        if (!isTouchAimDragging && !isMouseAimActive) {
          const hasJoystickSteering =
            playerSave.settings.touchControlsEnabled ||
            Math.hypot(moveX, moveY) > 0.05;
          if (hasJoystickSteering) {
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

          if (playerSave.settings.aimAssist) {
            let bestTargetNdcX: number | null = null;
            let bestTargetNdcY: number | null = null;
            let bestNdcDist = 0.18; // Local magnetism cone only around current reticle

            const considerWorldTarget = (worldPos: THREE.Vector3) => {
              _vec3A.copy(worldPos).project(camera);
              if (_vec3A.z <= 1) {
                const dist = Math.hypot(_vec3A.x - sim.aimX, _vec3A.y - sim.aimY);
                if (dist < bestNdcDist) {
                  bestNdcDist = dist;
                  bestTargetNdcX = THREE.MathUtils.clamp(_vec3A.x, -0.92, 0.92);
                  bestTargetNdcY = THREE.MathUtils.clamp(_vec3A.y, -0.85, 0.85);
                }
              }
            };

            if (bossObj && bossObj.active) {
              for (const app of bossObj.appendages) {
                if (!app.destroyed) considerWorldTarget(app.worldPos);
              }
              considerWorldTarget(bossObj.group.position);
            }
            for (const e of enemies) {
              if (e.active && e.group.position.z < -8) {
                considerWorldTarget(e.group.position);
              }
            }

            if (bestTargetNdcX !== null && bestTargetNdcY !== null) {
              sim.aimX = THREE.MathUtils.damp(sim.aimX, bestTargetNdcX, 4.2, dt);
              sim.aimY = THREE.MathUtils.damp(sim.aimY, bestTargetNdcY, 4.2, dt);
            }
          }
        }

        const targetPitch =
          (sim.playerVelY * 0.024 + sim.aimY * 0.18) * sim.shipTurnRateMult;
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
        vanguard.group.updateMatrixWorld(true);
        shipPointLight.position.set(sim.playerX, sim.playerY, -4.5);

        // =====================================================================
        // STEP 2: UPDATE CAMERA TRANSFORM & PROJECTION MATRIX BEFORE AIMING
        // =====================================================================
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
          camera.updateMatrixWorld(true);
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
          camera.updateMatrixWorld(true);
        }

        // Regenerate Boost, Piezo-Shield & Cooldowns
        const boostRegen = sim.upgrades.includes('hydro_thruster_coil')
          ? 24
          : 17;
        sim.boost = Math.min(sim.maxBoost, sim.boost + boostRegen * dt);

        if (sim.shieldRegenDelay > 0) {
          sim.shieldRegenDelay -= dt;
        } else {
          const wardenBonus = sim.activeShipId === 'trench_warden' ? 4 : 0;
          const shieldRegen =
            (sim.upgrades.includes('voltaic_shield_capacitor') ? 12 : 8) +
            wardenBonus;
          sim.shield = Math.min(sim.maxShield, sim.shield + shieldRegen * dt);
        }

        if (sim.torpedoCooldown > 0) {
          sim.torpedoCooldown = Math.max(0, sim.torpedoCooldown - dt);
        }

        if (sim.sonarCooldown > 0) {
          sim.sonarCooldown = Math.max(0, sim.sonarCooldown - dt);
        }

        if (sim.activeAbilityTimer > 0) {
          sim.activeAbilityTimer = Math.max(0, sim.activeAbilityTimer - dt);
          if (sim.activeAbilityTimer <= 0) {
            sim.markedTargetId = null;
          }
        }
        if (sim.activeAbilityCooldown > 0) {
          sim.activeAbilityCooldown = Math.max(
            0,
            sim.activeAbilityCooldown - dt,
          );
        }

        // Update Arc Lightning Fade
        if (sim.arcLightningTimer > 0) {
          sim.arcLightningTimer = Math.max(0, sim.arcLightningTimer - dt);
          arcBeamMat.opacity = Math.min(1, sim.arcLightningTimer / 0.25);
          if (sim.arcLightningTimer <= 0) {
            arcBeams.forEach((b) => {
              b.visible = false;
            });
          }
        }

        // Update 3D Gravity Singularity Vortex (Kraken Reaper / Pelagic Ascendant)
        if (sim.vortexActiveTimer > 0) {
          sim.vortexActiveTimer = Math.max(0, sim.vortexActiveTimer - dt);
          vortexGroup.visible = true;
          vortexGroup.position.copy(sim.vortexPos);
          vortexOuterRing.rotation.z += dt * 4.5;
          vortexInnerRing.rotation.y += dt * 6.2;
          vortexCore.scale.setScalar(1 + Math.sin(elapsed * 14) * 0.18);
          enemies.forEach((e) => {
            if (e.active) {
              const d = e.group.position.distanceTo(sim.vortexPos);
              if (d < 28) {
                e.group.position.lerp(sim.vortexPos, dt * 1.9);
                e.hp -= 28 * dt;
              }
            }
          });
          resolveDefeatedEntitiesAndAppendages(false);
          projectiles.forEach((p) => {
            if (
              p.active &&
              !p.isPlayer &&
              p.pos.distanceTo(sim.vortexPos) < 26
            ) {
              p.vel.multiplyScalar(Math.max(0.75, 1 - dt * 1.5));
            }
          });
          if (sim.vortexActiveTimer <= 0) {
            vortexGroup.visible = false;
          }
        } else {
          vortexGroup.visible = false;
        }

        // =====================================================================
        // STEP 3: UPDATE ENEMY AI ROLES, TELEGRAPHS, ATTACK PATTERNS & REPOSITION
        // =====================================================================
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
          const distZ = e.group.position.z;

          // Update Enemy AI FSM State
          if (e.evadeTimer > 0) {
            e.evadeTimer = Math.max(0, e.evadeTimer - dt);
            e.aiState = 'evade';
          } else if (e.isFiringWindup) {
            e.aiState = e.telegraphTimer > 0.25 ? 'telegraph' : 'attack';
          } else if (distZ > -22) {
            e.aiState = 'reposition';
          } else if (distZ < -85) {
            e.aiState = 'patrol';
          } else if (e.type === 'manta' || e.type === 'skimmer') {
            e.aiState = distZ > -52 ? 'flank' : 'pursue';
          } else {
            e.aiState = 'approach';
          }

          // Role-distinct enemy movement & evasive weaving
          const zSpeedMult =
            e.aiState === 'evade'
              ? 0.7
              : e.type === 'cruiser' && distZ > -54 && distZ < -26
                ? 0.52 // Heavy cruisers hold firing distance longer
                : 1.0;
          e.group.position.z += e.velZ * zSpeedMult * dt;

          if (e.type === 'skimmer') {
            const pursueX = THREE.MathUtils.lerp(
              e.baseX,
              sim.playerX + e.flankSign * 4.2,
              0.35,
            );
            const evadeOffset =
              e.evadeTimer > 0 ? e.flankSign * 5.2 * Math.sin(age * 8) : 0;
            e.group.position.x = THREE.MathUtils.clamp(
              pursueX +
                Math.sin(age * 2.7 + e.patternPhase) * 4.4 +
                evadeOffset,
              -15.5,
              15.5,
            );
            e.group.position.y = THREE.MathUtils.clamp(
              e.baseY + Math.cos(age * 2.2 + e.patternPhase) * 2.7,
              -8.5,
              8.5,
            );
            e.group.rotation.z = Math.cos(age * 2.7 + e.patternPhase) * 0.38;
          } else if (e.type === 'jelly') {
            e.group.position.x = THREE.MathUtils.clamp(
              e.baseX + Math.sin(age * 1.6 + e.patternPhase) * 2.6,
              -15.0,
              15.0,
            );
            e.group.position.y = THREE.MathUtils.clamp(
              e.baseY + Math.sin(age * 3.1 + e.patternPhase) * 3.2,
              -8.5,
              8.5,
            );
            e.group.rotation.y += dt * 1.5;
          } else if (e.type === 'manta') {
            const sweepAmp = e.aiState === 'flank' ? 7.8 : 6.2;
            e.group.position.x = THREE.MathUtils.clamp(
              e.baseX + Math.cos(age * 3.2 + e.patternPhase) * sweepAmp,
              -15.8,
              15.8,
            );
            e.group.position.y = THREE.MathUtils.clamp(
              THREE.MathUtils.lerp(e.baseY, sim.playerY, 0.25) +
                Math.sin(age * 2.4 + e.patternPhase) * 2.2,
              -8.5,
              8.5,
            );
            e.group.rotation.z = -Math.sin(age * 3.2 + e.patternPhase) * 0.5;
          } else if (e.type === 'cruiser') {
            e.group.position.x = THREE.MathUtils.clamp(
              e.baseX + Math.sin(age * 1.1 + e.patternPhase) * 3.2,
              -13.5,
              13.5,
            );
            e.group.position.y = THREE.MathUtils.clamp(
              e.baseY + Math.cos(age * 0.9 + e.patternPhase) * 1.5,
              -7.2,
              7.2,
            );
          } else if (e.type === 'hazard_mine') {
            // Proximity drift when player approaches within 22m
            if (e.group.position.distanceTo(vanguard.group.position) < 22) {
              e.group.position.x = THREE.MathUtils.damp(
                e.group.position.x,
                sim.playerX,
                1.2,
                dt,
              );
              e.group.position.y = THREE.MathUtils.damp(
                e.group.position.y,
                sim.playerY,
                1.2,
                dt,
              );
            }
            e.group.rotation.x += dt * 1.2;
            e.group.rotation.y += dt * 1.6;
          }

          e.group.updateMatrixWorld();

          // Hit flash recovery
          if (e.hitFlashTimer > 0) {
            e.hitFlashTimer -= dt;
            if (e.hitFlashTimer <= 0) {
              (e.coreMesh.material as THREE.MeshStandardMaterial).color.setHex(
                e.baseColorHex,
              );
            }
          }

          // Enemy Windup Telegraph -> Role-Specific Strike FSM
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

                if (e.type === 'skimmer') {
                  // Fast twin-bolt burst
                  e.fireTimer = 3.1;
                  [-0.45, 0.45].forEach((offsetX) => {
                    _vec3A.copy(e.group.position);
                    _vec3A.x += offsetX;
                    _vec3B
                      .subVectors(vanguard.group.position, _vec3A)
                      .normalize()
                      .multiplyScalar(45);
                    fireEnemyPlasma(_vec3A, false, _vec3B, {
                      damage: 12,
                      radius: 0.42,
                      scale: 0.88,
                    });
                  });
                } else if (e.type === 'manta') {
                  // 3-way spread volley
                  e.fireTimer = 3.2;
                  [-0.18, 0, 0.18].forEach((spreadX) => {
                    _vec3B
                      .subVectors(vanguard.group.position, e.group.position)
                      .normalize();
                    _vec3B.x += spreadX;
                    _vec3B.normalize().multiplyScalar(43);
                    fireEnemyPlasma(e.group.position, false, _vec3B, {
                      damage: 14,
                      radius: 0.46,
                      scale: 0.96,
                    });
                  });
                } else if (e.type === 'jelly') {
                  // Charged bio-shockwave orb
                  e.fireTimer = 3.6;
                  _vec3B
                    .subVectors(vanguard.group.position, e.group.position)
                    .normalize()
                    .multiplyScalar(34);
                  fireEnemyPlasma(e.group.position, false, _vec3B, {
                    damage: 20,
                    radius: 0.72,
                    scale: 1.45,
                  });
                } else if (e.type === 'cruiser') {
                  // Heavy dual plasma cannons + guided bio-torpedo
                  e.fireTimer = 2.6;
                  [-1.2, 1.2].forEach((turretX) => {
                    _vec3A.copy(e.group.position);
                    _vec3A.x += turretX;
                    _vec3B
                      .subVectors(vanguard.group.position, _vec3A)
                      .normalize()
                      .multiplyScalar(44);
                    fireEnemyPlasma(_vec3A, false, _vec3B, {
                      damage: 16,
                      radius: 0.5,
                      scale: 1.1,
                    });
                  });
                  _vec3B
                    .subVectors(vanguard.group.position, e.group.position)
                    .normalize()
                    .multiplyScalar(32);
                  fireEnemyPlasma(e.group.position, false, _vec3B, {
                    damage: 22,
                    radius: 0.65,
                    scale: 1.35,
                    isGuided: true,
                  });
                }
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
            if (e.type === 'hazard_mine') {
              scene.remove(e.group);
              disposeGroupGeometries(e.group);
              sim.lockedTargetIds = sim.lockedTargetIds.filter(
                (id) => id !== e.id,
              );
              enemies.splice(i, 1);
            } else {
              // Combat craft bank away & reposition to the far trench after a ramming pass so required mission kills are never lost
              e.group.position.z = -108 - (i % 4) * 7;
              e.spawnTime = sim.stageElapsed;
              e.isFiringWindup = false;
              (e.telegraphRing.material as THREE.MeshBasicMaterial).opacity = 0;
            }
            continue;
          }

          // When passing behind camera (z > 14): hazard mines despawn; combat ships execute an abyssal turn-around & reposition!
          if (e.group.position.z > 14) {
            if (
              activeMission.objectiveType === 'protect_beacon' &&
              e.type !== 'hazard_mine'
            ) {
              const beaconDmg = e.type === 'cruiser' ? 14 : 8;
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

            if (e.type === 'hazard_mine') {
              scene.remove(e.group);
              disposeGroupGeometries(e.group);
              sim.lockedTargetIds = sim.lockedTargetIds.filter(
                (id) => id !== e.id,
              );
              enemies.splice(i, 1);
            } else {
              // Reposition combat craft to far engagement zone with preserved HP & ID
              e.aiState = 'reposition';
              e.group.position.z = -106 - (i % 5) * 6.5;
              e.baseX = THREE.MathUtils.clamp(
                (Math.random() - 0.5) * 22,
                -13.5,
                13.5,
              );
              e.baseY = THREE.MathUtils.clamp(
                (Math.random() - 0.5) * 11,
                -6.5,
                6.5,
              );
              e.group.position.x = e.baseX;
              e.group.position.y = e.baseY;
              e.isFiringWindup = false;
              (e.telegraphRing.material as THREE.MeshBasicMaterial).opacity = 0;
              e.fireTimer = 1.9 + (i % 3) * 0.6;
              e.group.updateMatrixWorld();
            }
          }
        }

        sim.sonarHazardsCount = scannedHazardCounter;
        sim.hazardWarningText = anyEnemyTelegraphing
          ? 'INCOMING BIO-PLASMA — TAP EVADE TO DODGE'
          : null;

        // =====================================================================
        // STEP 4: UPDATE LEVIATHAN BOSS & APPENDAGE WORLD POSITIONS
        // =====================================================================
        if (bossObj && bossObj.active) {
          if (sim.bossIntroTimer > 0) {
            sim.bossIntroTimer = Math.max(0, sim.bossIntroTimer - dt);
          }
          if (sim.bossVulnerableTimer > 0) {
            sim.bossVulnerableTimer = Math.max(0, sim.bossVulnerableTimer - dt);
          }

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
          const nextPhase: 1 | 2 | 3 =
            hpRatio > 0.66 ? 1 : hpRatio > 0.33 ? 2 : 3;
          if (nextPhase > bossObj.phase) {
            bossObj.phase = nextPhase;
            sim.bossVulnerableTimer = 3.2;
            bossObj.telegraphLabel = `PHASE ${nextPhase} ESCALATION — CORE THERMAL VENT EXPOSED!`;
            soundEngine.playBossTelegraph();
            spawnParticleBurst(bossObj.group.position, 0xfbbf24, 30, 22);
          }

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
            (0.75 + bossObj.phase * 0.35) *
            (ventralSevered ? 0.65 : 1.0) *
            (sim.bossVulnerableTimer > 0 ? 0.55 : 1.0);
          bossObj.group.position.x =
            Math.sin(elapsed * moveSpeed) * (9 + bossObj.phase * 2.5);
          bossObj.group.position.y =
            1.5 + Math.cos(elapsed * moveSpeed * 1.3) * 4.8;
          bossObj.group.updateMatrixWorld(true);

          bossObj.outerRing.rotation.z += dt * (0.9 + bossObj.phase * 0.45);
          bossObj.tentacles.forEach((t, idx) => {
            t.rotation.x = Math.sin(elapsed * 3.2 + idx) * 0.18;
          });

          const coreHpRatio = bossObj.hp / Math.max(1, bossObj.maxHp);
          const coreDmgRatio = Math.max(0, 1 - coreHpRatio);
          const coreCritPulse =
            coreHpRatio <= 0.45 || sim.bossVulnerableTimer > 0
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

          bossObj.appendages.forEach((app) => {
            app.worldPos
              .copy(app.localOffset)
              .applyMatrix4(bossObj!.group.matrixWorld);

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

          // Boss Telegraph -> Multi-Pattern Barrage + Core Vulnerability Window FSM
          bossObj.attackTimer -=
            dt * (dorsalSevered ? 0.72 : 1.0) * telegraphSpeedMult;
          if (bossObj.attackTimer <= 1.25 && bossObj.telegraphTimer <= 0) {
            bossObj.telegraphTimer = 1.25;
            bossObj.attackPatternIndex = (bossObj.attackPatternIndex + 1) % 3;
            bossObj.telegraphLabel =
              bossObj.phase === 3
                ? 'CRITICAL TELEGRAPH: HADAL NOVA SPIRAL BARRAGE!'
                : bossObj.attackPatternIndex === 1
                  ? 'TELEGRAPH: LEVIATHAN GUIDED BIO-TORPEDO SALVO'
                  : 'TELEGRAPH: LEVIATHAN BIO-PLASMA FAN';
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
              // Open a 2.4s core vulnerability window immediately after the boss discharges its heavy barrage
              sim.bossVulnerableTimer = 2.4;
              bossObj.telegraphLabel =
                'CORE VENT OVERHEATED — STRIKE WEAK POINTS NOW!';
              bossObj.attackTimer = Math.max(2.2, 3.8 - bossObj.phase * 0.5);

              const reduction =
                (portSevered ? 1 : 0) + (starboardSevered ? 1 : 0);
              const volleyCount = Math.max(
                2,
                3 + bossObj.phase * 2 - reduction * 2,
              );

              if (bossObj.attackPatternIndex === 1) {
                // Pattern B: Guided Leviathan Bio-Torpedo Salvo + flanking plasma
                for (let v = 0; v < Math.min(3, volleyCount); v++) {
                  const sideOffset = (v - 1) * 3.8;
                  _vec3A.copy(bossObj.group.position);
                  _vec3A.x += sideOffset;
                  _vec3B
                    .subVectors(vanguard.group.position, _vec3A)
                    .normalize()
                    .multiplyScalar(34 + bossObj.phase * 3);
                  fireEnemyPlasma(_vec3A, false, _vec3B, {
                    damage: 20,
                    radius: 0.68,
                    scale: 1.38,
                    isGuided: true,
                  });
                }
              } else {
                // Pattern A / C: Multi-bolt fan & spiral ring barrage
                for (let v = 0; v < volleyCount; v++) {
                  const spreadAngle =
                    ((v / Math.max(1, volleyCount - 1)) - 0.5) * 0.58;
                  _vec3B
                    .subVectors(
                      vanguard.group.position,
                      bossObj.group.position,
                    )
                    .normalize();
                  _vec3B.x += spreadAngle;
                  _vec3B.y +=
                    bossObj.phase === 3
                      ? Math.sin((v / volleyCount) * Math.PI * 2) * 0.22
                      : ((v % 2) - 0.5) * 0.16;
                  _vec3B.normalize().multiplyScalar(45 + bossObj.phase * 4);
                  fireEnemyPlasma(bossObj.group.position, false, _vec3B, {
                    damage: 16 + bossObj.phase * 2,
                    radius: 0.52,
                    scale: 1.15,
                  });
                }
              }
            }
          } else {
            haloMat.opacity = 0;
            if (sim.bossVulnerableTimer <= 0 && sim.bossIntroTimer <= 0) {
              bossObj.telegraphLabel = null;
            }
          }
        } else {
          sonarBeaconRing.visible = false;
        }

        // =====================================================================
        // STEP 5: AUTHORITATIVE 3D AIMING SOLVER (PRIORITY: LOCK -> RAY -> CONVERGENCE)
        // =====================================================================
        const aimColliders: AimableColliderTarget[] = [];
        for (const e of enemies) {
          if (e.active) {
            aimColliders.push({
              id: e.id,
              label:
                e.type === 'hazard_mine' ? 'ABYSSAL MINE' : e.type.toUpperCase(),
              worldPos: e.group.position,
              radius: e.radius,
              active: true,
              isWeakPoint:
                sim.sonarActiveTimer > 0 &&
                (e.type === 'hazard_mine' || e.isFiringWindup),
            });
          }
        }
        if (bossObj && bossObj.active) {
          for (const app of bossObj.appendages) {
            if (!app.destroyed) {
              aimColliders.push({
                id: app.numericId,
                label: app.name.toUpperCase(),
                worldPos: app.worldPos,
                radius: app.hitRadius,
                active: true,
                isAppendage: true,
                appendageSlot: app.slot,
                isWeakPoint:
                  sim.sonarActiveTimer > 0 &&
                  sim.sonarWeakPointSlot === app.slot,
              });
            }
          }
          aimColliders.push({
            id: bossObj.id,
            label: STAGE_CONFIGS[sim.stageId].bossName.toUpperCase(),
            worldPos: bossObj.group.position,
            radius: 5.6,
            active: true,
            isBoss: true,
            isWeakPoint:
              (sim.sonarActiveTimer > 0 && sim.sonarWeakPointSlot === 'core') ||
              sim.bossVulnerableTimer > 0,
          });
        }

        // Prune any stale lock IDs whose target is no longer active
        const validIdsSet = new Set(aimColliders.map((c) => c.id));
        const beforeLocks = sim.lockedTargetIds.length;
        sim.lockedTargetIds = sim.lockedTargetIds.filter((id) =>
          validIdsSet.has(id),
        );
        if (beforeLocks > 0 && sim.lockedTargetIds.length === 0) {
          sim.targetLostTimer = 0.55;
        }

        const aimResult = computeAuthoritativeAimState(
          camera,
          sim.aimX,
          sim.aimY,
          aimColliders,
          sim.lockedTargetIds,
          sim.targetLostTimer > 0,
          85,
        );
        sim.aimPointWorld.copy(aimResult.aimPointWorld);
        sim.activeAimTargetId = aimResult.resolvedTargetId;
        sim.activeAimTargetLabel = aimResult.resolvedTargetLabel;
        sim.reticleState =
          aimResult.reticleState === 'free' && sim.targetLostTimer > 0
            ? 'target_lost'
            : aimResult.reticleState;

        // =====================================================================
        // STEP 6: WEAPON FIRING & AUTONOMOUS DRONE / TURRET VOLLEYS
        // =====================================================================
        // Update Trench Warden 2 Live 3D Orbiting Drones (Repair & Attack)
        if (
          sim.activeAbilityId === 'guardian_swarm' &&
          sim.activeAbilityTimer > 0
        ) {
          repairDroneGroup.visible = true;
          attackDroneGroup.visible = true;
          repairDroneGroup.position.set(
            sim.playerX + Math.cos(elapsed * 2.8) * 3.1,
            sim.playerY + 1.15 + Math.sin(elapsed * 3.2) * 0.45,
            Math.sin(elapsed * 2.8) * 1.5,
          );
          repairDroneGroup.rotation.y += dt * 3.4;

          attackDroneGroup.position.set(
            sim.playerX + Math.cos(elapsed * 2.8 + Math.PI) * 3.1,
            sim.playerY + 1.15 + Math.cos(elapsed * 3.2) * 0.45,
            Math.sin(elapsed * 2.8 + Math.PI) * 1.5,
          );
          attackDroneGroup.rotation.z = Math.sin(elapsed * 4) * 0.2;

          sim.droneHealTimer -= dt;
          if (sim.droneHealTimer <= 0) {
            sim.droneHealTimer = 1.9;
            sim.hull = Math.min(sim.maxHull, sim.hull + 4);
            sim.shield = Math.min(sim.maxShield, sim.shield + 5);
            spawnParticleBurst(repairDroneGroup.position, 0x34d399, 6, 8);
          }

          sim.droneFireTimer -= dt;
          if (sim.droneFireTimer <= 0) {
            sim.droneFireTimer = 0.65;
            const tgtEnemy = enemies.find((e) => e.active);
            const tgtBossApp =
              !tgtEnemy && bossObj && bossObj.active
                ? bossObj.appendages.find((a) => !a.destroyed)
                : undefined;
            const tgtPos = tgtEnemy
              ? tgtEnemy.group.position
              : tgtBossApp
                ? tgtBossApp.worldPos
                : bossObj && bossObj.active
                  ? bossObj.group.position
                  : null;
            if (tgtPos) {
              for (let i = 0; i < 50; i++) {
                const p = projectiles[i];
                if (!p.active) {
                  p.active = true;
                  p.isPlayer = true;
                  p.isTorpedo = false;
                  p.isGuidedEnemyTorpedo = false;
                  p.pos.copy(attackDroneGroup.position);
                  p.prevPos.copy(attackDroneGroup.position);
                  _vec3B.subVectors(tgtPos, p.pos).normalize();
                  p.vel.copy(_vec3B).multiplyScalar(sim.shipPrimarySpeed * 1.05);
                  p.radius = 0.78;
                  p.damage = Math.round(18 * sim.shipPrimaryDmgMult);
                  p.life = 1.8;
                  p.targetEnemyId = null;
                  p.mesh.position.copy(p.pos);
                  p.mesh.lookAt(tgtPos);
                  p.mesh.visible = true;
                  break;
                }
              }
            }
          }
        } else {
          repairDroneGroup.visible = false;
          attackDroneGroup.visible = false;
        }

        // Pelagic Ascendant passive: 4 gimbaled wing turrets fire periodic tracking bolts automatically
        if (sim.activeShipId === 'pelagic_ascendant') {
          sim.wingTurretFireTimer -= dt;
          if (sim.wingTurretFireTimer <= 0) {
            sim.wingTurretFireTimer = 1.25;
            const targetPos =
              enemies.find((e) => e.active)?.group.position ||
              (bossObj && bossObj.active
                ? bossObj.appendages.find((a) => !a.destroyed)?.worldPos ||
                  bossObj.group.position
                : null);
            if (targetPos) {
              [-2.9, 2.9].forEach((tx) => {
                for (let i = 0; i < 50; i++) {
                  const p = projectiles[i];
                  if (!p.active) {
                    p.active = true;
                    p.isPlayer = true;
                    p.isTorpedo = false;
                    p.isGuidedEnemyTorpedo = false;
                    _vec3A
                      .set(tx, 0.35, -0.6)
                      .applyMatrix4(vanguard.group.matrixWorld);
                    p.pos.copy(_vec3A);
                    p.prevPos.copy(_vec3A);
                    _vec3B.subVectors(targetPos, p.pos).normalize();
                    p.vel.copy(_vec3B).multiplyScalar(sim.shipPrimarySpeed);
                    p.radius = 0.78;
                    p.damage = Math.round(16 * sim.shipPrimaryDmgMult);
                    p.life = 1.8;
                    p.targetEnemyId = null;
                    p.mesh.position.copy(p.pos);
                    p.mesh.lookAt(targetPos);
                    p.mesh.visible = true;
                    break;
                  }
                }
              });
            }
          }
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
        const overdriveCadence =
          sim.activeAbilityId === 'riptide_overdrive' &&
          sim.activeAbilityTimer > 0
            ? 1.4
            : 1.0;
        if (
          (pointerFiring || touchFiring || autoFireActive || heldKeys.has('KeyJ')) &&
          sim.fireCooldown <= 0
        ) {
          firePrimaryCannons();
          sim.fireCooldown =
            0.13 /
            Math.max(0.5, sim.shipPrimaryFireRateMult * overdriveCadence);
        }

        // =====================================================================
        // STEP 7: SWEPT PROJECTILE MOVEMENT & ANALYTICAL HITBOX COLLISION
        // =====================================================================
        for (let i = 0; i < PROJECTILE_POOL_SIZE; i++) {
          const p = projectiles[i];
          if (!p.active) continue;

          p.life -= dt;
          if (p.life <= 0) {
            p.active = false;
            p.mesh.visible = false;
            continue;
          }

          // Homing guidance for player torpedoes
          if (p.isPlayer && p.isTorpedo && p.targetEnemyId !== null) {
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
              p.vel.lerp(_vec3B, dt * 8.2);
            }
          } else if (!p.isPlayer && p.isGuidedEnemyTorpedo && p.pos.z < -4) {
            // Subtle tracking on enemy cruiser/boss guided bio-torpedoes (dodgeable with barrel roll or strafing)
            _vec3B
              .subVectors(vanguard.group.position, p.pos)
              .normalize()
              .multiplyScalar(p.vel.length());
            p.vel.lerp(_vec3B, dt * 1.95);
          }

          // Record previous position BEFORE advancing so swept segment [prevPos, pos] is exact
          p.prevPos.copy(p.pos);
          p.pos.addScaledVector(p.vel, dt);
          p.mesh.position.copy(p.pos);

          if (p.isPlayer) {
            _vec3A.copy(p.pos).add(p.vel);
            p.mesh.lookAt(_vec3A);
            if (p.isTorpedo && Math.random() < 0.35) {
              spawnParticleBurst(p.pos, 0xff6b00, 1, 6);
            }
          } else {
            p.mesh.rotation.x += dt * 5;
            p.mesh.rotation.y += dt * 5;
            const playerHit = checkSweptSphereHit(
              p.prevPos,
              p.pos,
              p.radius,
              vanguard.group.position,
              1.65,
            );
            if (playerHit.hit) {
              p.active = false;
              p.mesh.visible = false;
              damagePlayer(p.damage);
            }
            continue;
          }

          // 1. Player projectile vs Enemies (Swept Segment-Sphere Collision)
          let hitRegistered = false;
          for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (!e.active) continue;

            const sweptHit = checkSweptSphereHit(
              p.prevPos,
              p.pos,
              p.radius,
              e.group.position,
              e.radius + 0.55,
            );
            if (sweptHit.hit) {
              p.active = false;
              p.mesh.visible = false;
              hitRegistered = true;
              sim.shotsHit++;

              const hazardSonarBonus =
                sim.sonarActiveTimer > 0 && e.type === 'hazard_mine'
                  ? 1.5
                  : 1.0;
              const resonanceMult =
                sim.activeAbilityId === 'resonance_scan' &&
                sim.activeAbilityTimer > 0
                  ? 1.1
                  : 1.0;
              const predatorMult =
                sim.activeAbilityId === 'predator_mark' &&
                sim.activeAbilityTimer > 0 &&
                sim.markedTargetId === e.id
                  ? 1.55
                  : 1.0;
              const breakerCruiserMult =
                sim.activeShipId === 'leviathan_breaker' &&
                e.type === 'cruiser'
                  ? 1.25
                  : 1.0;
              const totalDmg =
                p.damage *
                hazardSonarBonus *
                resonanceMult *
                predatorMult *
                breakerCruiserMult;
              e.hp -= totalDmg;
              e.hitFlashTimer = 0.08;
              if (e.type === 'skimmer' || e.type === 'manta') {
                e.evadeTimer = 0.65;
              }
              (
                e.coreMesh.material as THREE.MeshStandardMaterial
              ).color.setHex(0xffffff);
              e.group.scale.set(1.18, 0.84, 1.18);

              spawnParticleBurst(
                sweptHit.hitPoint,
                p.isTorpedo ? 0xf59e0b : 0x06b6d4,
                p.isTorpedo ? 20 : 8,
                15,
              );
              soundEngine.playImpact(p.isTorpedo);

              if (e.hp <= 0) {
                eliminateDefeatedEnemy(e, j, p.isTorpedo);
              } else {
                triggerHitConfirmation(
                  predatorMult > 1 || hazardSonarBonus > 1 || p.isTorpedo
                    ? 'crit'
                    : e.type === 'cruiser'
                      ? 'armor'
                      : 'normal',
                  e.type.toUpperCase(),
                );
              }
              break;
            }
          }

          // 2. Player projectile vs Boss Localized Appendages (Checked BEFORE Core!) & Central Core
          if (!hitRegistered && bossObj && bossObj.active) {
            const visorMult = sim.upgrades.includes('sonar_crit_visor')
              ? 1 + 0.45 * getModuleTierMult('sonar_crit_visor')
              : 1.0;

            for (const app of bossObj.appendages) {
              if (app.destroyed) continue;
              const appHit = checkSweptSphereHit(
                p.prevPos,
                p.pos,
                p.radius,
                app.worldPos,
                app.hitRadius + 0.4,
              );
              if (appHit.hit) {
                p.active = false;
                p.mesh.visible = false;
                hitRegistered = true;
                sim.shotsHit++;

                const isSonarWeakPointHit =
                  sim.sonarActiveTimer > 0 &&
                  sim.sonarWeakPointSlot === app.slot;
                const sonarCritMult = isSonarWeakPointHit
                  ? sim.activeShipId === 'echo_tactical'
                    ? 1.6 * 1.18
                    : 1.6
                  : 1.0;
                const bossResonance =
                  sim.activeAbilityId === 'resonance_scan' &&
                  sim.activeAbilityTimer > 0
                    ? 1.1
                    : 1.0;
                const bossPredator =
                  sim.activeAbilityId === 'predator_mark' &&
                  sim.activeAbilityTimer > 0 &&
                  sim.markedTargetId === app.numericId
                    ? 1.55
                    : 1.0;
                const breakerBossMult =
                  (sim.activeShipId === 'leviathan_breaker' ? 1.25 : 1.0) *
                  (sim.activeAbilityId === 'seismic_lock' &&
                  sim.activeAbilityTimer > 0
                    ? 1.35
                    : 1.0);
                const dmg =
                  p.damage *
                  visorMult *
                  sonarCritMult *
                  bossResonance *
                  bossPredator *
                  breakerBossMult;
                app.hp = Math.max(0, app.hp - dmg);
                bossObj.hp = Math.max(1, bossObj.hp - dmg * 0.55);
                app.hitFlashTimer = 0.11;
                app.emissiveMat.color.setHex(0xffffff);
                app.emissiveMat.emissive.setHex(0xffffff);
                app.group.scale.set(1.2, 0.84, 1.2);

                spawnParticleBurst(
                  appHit.hitPoint,
                  isSonarWeakPointHit
                    ? 0x22d3ee
                    : p.isTorpedo
                      ? 0xf59e0b
                      : app.baseColorHex,
                  p.isTorpedo || isSonarWeakPointHit ? 22 : 10,
                  17,
                );

                if (app.hp <= 0) {
                  severDefeatedAppendage(app);
                } else {
                  triggerHitConfirmation('crit', app.slot.toUpperCase());
                  soundEngine.playImpact(p.isTorpedo || isSonarWeakPointHit);
                }
                break;
              }
            }

            // Check Central Leviathan Core
            if (!hitRegistered && bossObj && bossObj.active) {
              const coreHit = checkSweptSphereHit(
                p.prevPos,
                p.pos,
                p.radius,
                bossObj.group.position,
                5.6,
              );
              if (coreHit.hit) {
                p.active = false;
                p.mesh.visible = false;
                hitRegistered = true;
                sim.shotsHit++;

                const severedCount = bossObj.appendages.filter(
                  (a) => a.destroyed,
                ).length;
                // Armored carapace dampens direct core damage when all 4 appendages are intact and core is not in a thermal vulnerability window
                const carapaceArmorMult =
                  severedCount === 0 && sim.bossVulnerableTimer <= 0
                    ? 0.58
                    : 1.0 +
                      severedCount * 0.22 +
                      (sim.bossVulnerableTimer > 0 ? 0.35 : 0);
                const coreSonarMult =
                  sim.sonarActiveTimer > 0 && sim.sonarWeakPointSlot === 'core'
                    ? sim.activeShipId === 'echo_tactical'
                      ? 1.6 * 1.18
                      : 1.6
                    : 1.0;
                const coreSeismicMult =
                  sim.activeAbilityId === 'seismic_lock' &&
                  sim.activeAbilityTimer > 0
                    ? 1.35
                    : 1.0;
                const coreResonanceMult =
                  sim.activeAbilityId === 'resonance_scan' &&
                  sim.activeAbilityTimer > 0
                    ? 1.1
                    : 1.0;
                bossObj.hp -=
                  p.damage *
                  visorMult *
                  carapaceArmorMult *
                  coreSonarMult *
                  coreSeismicMult *
                  coreResonanceMult;
                bossObj.hitFlashTimer = 0.08;
                (
                  bossObj.coreMesh.material as THREE.MeshStandardMaterial
                ).color.setHex(0xffffff);

                spawnParticleBurst(
                  coreHit.hitPoint,
                  p.isTorpedo ? 0xf59e0b : 0x10b981,
                  p.isTorpedo ? 24 : 10,
                  18,
                );
                soundEngine.playImpact(p.isTorpedo);

                if (bossObj.hp <= 0) {
                  bossObj.active = false;
                  sim.bossDefeated = true;
                  sonarBeaconRing.visible = false;
                  triggerHitConfirmation(
                    'kill',
                    `${STAGE_CONFIGS[sim.stageId].bossName.toUpperCase()} VANQUISHED!`,
                  );
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
                } else {
                  triggerHitConfirmation(
                    severedCount === 0 && sim.bossVulnerableTimer <= 0
                      ? 'armor'
                      : 'crit',
                    severedCount === 0 && sim.bossVulnerableTimer <= 0
                      ? 'ARMORED CORE'
                      : 'EXPOSED CORE',
                  );
                }
              }
            }
          }
        }

        // Recover enemy squash-and-stretch once per frame
        enemies.forEach((e) => {
          if (e.active) {
            const targetScale =
              e.isElite && e.type !== 'cruiser' ? 1.16 : 1.0;
            e.group.scale.lerp(
              _scale.set(targetScale, targetScale, targetScale),
              dt * 12,
            );
          }
        });

        // Update Pickups
        for (let i = 0; i < PICKUP_POOL_SIZE; i++) {
          const pk = pickups[i];
          if (!pk.active) continue;
          pk.pos.z += 22 * dt;
          const magnetDist = sim.activeShipId === 'trench_warden' ? 15 : 12;
          if (pk.pos.distanceTo(vanguard.group.position) < magnetDist) {
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

        // =====================================================================
        // STEP 8: UPDATE 3D AIM DEBUG VISUALIZER & PROJECT 2D SCREEN LOCKS
        // =====================================================================
        if (playerSave.settings.aimDebugEnabled) {
          aimDebugGroup.visible = true;
          updateLineEndpoints(
            debugRayLine,
            aimResult.rayOrigin,
            sim.aimPointWorld,
          );
          debugAimSphere.position.copy(sim.aimPointWorld);

          const muzzles = vanguard.getPrimaryMuzzleOffsets();
          const debugShots = computeMuzzleShotVectors(
            vanguard.group,
            muzzles,
            sim.aimPointWorld,
            sim.shipPrimarySpeed,
            playerSave.equippedPrimaryWeapon,
            sim.shotSequenceCount,
          );
          for (let m = 0; m < 4; m++) {
            if (m < debugShots.length) {
              debugMuzzleSpheres[m].visible = true;
              debugMuzzleSpheres[m].position.copy(debugShots[m].muzzleWorldPos);
              debugMuzzleLines[m].visible = true;
              updateLineEndpoints(
                debugMuzzleLines[m],
                debugShots[m].muzzleWorldPos,
                debugShots[m].aimTargetPoint,
              );
            } else {
              debugMuzzleSpheres[m].visible = false;
              debugMuzzleLines[m].visible = false;
            }
          }

          let vIdx = 0;
          for (let i = 0; i < 66 && vIdx < debugVelLines.length; i++) {
            const p = projectiles[i];
            if (p.active && p.isPlayer) {
              debugVelLines[vIdx].visible = true;
              _vec3A.copy(p.pos).addScaledVector(p.vel, 0.14);
              updateLineEndpoints(debugVelLines[vIdx], p.pos, _vec3A);
              vIdx++;
            }
          }
          for (; vIdx < debugVelLines.length; vIdx++) {
            debugVelLines[vIdx].visible = false;
          }

          for (let h = 0; h < debugHitboxSpheres.length; h++) {
            if (h < aimColliders.length) {
              const col = aimColliders[h];
              debugHitboxSpheres[h].visible = true;
              debugHitboxSpheres[h].position.copy(col.worldPos);
              debugHitboxSpheres[h].scale.setScalar(col.radius);
            } else {
              debugHitboxSpheres[h].visible = false;
            }
          }
        } else {
          aimDebugGroup.visible = false;
        }

        // Project 3D Enemy & Boss World Coordinates to 2D Screen Space & Auto-Lock Reticle Proximity
        const cw = renderer.domElement.clientWidth;
        const ch = renderer.domElement.clientHeight;
        const reticlePxX = ((sim.aimX + 1) * 0.5) * cw;
        const reticlePxY = ((-sim.aimY + 1) * 0.5) * ch;
        const baseLockPx = sim.upgrades.includes('sonar_crit_visor')
          ? 125
          : 92;
        const lockRadiusPx =
          sim.activeShipId === 'vanguard_interceptor'
            ? baseLockPx * 1.08
            : baseLockPx;

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
            (sim.sonarActiveTimer > 0 && sim.sonarWeakPointSlot === 'core') ||
            sim.bossVulnerableTimer > 0;
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
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
      hangarLife.dispose();
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
