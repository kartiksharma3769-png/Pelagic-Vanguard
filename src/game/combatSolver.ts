import * as THREE from 'three';
import {
  AppendageSlot,
  MissionDefinition,
  PrimaryWeaponId,
  ReticleVisualState,
} from './types';

const _raycaster = new THREE.Raycaster();
const _ndcVec2 = new THREE.Vector2();
const _segVec = new THREE.Vector3();
const _ptVec = new THREE.Vector3();
const _closestVec = new THREE.Vector3();
const _projPoint = new THREE.Vector3();
const _muzzleWorld = new THREE.Vector3();
const _shotDir = new THREE.Vector3();
const _rightVec = new THREE.Vector3();
const _upVec = new THREE.Vector3();

export interface AimableColliderTarget {
  id: number;
  label: string;
  worldPos: THREE.Vector3;
  radius: number;
  active: boolean;
  isBoss?: boolean;
  isAppendage?: boolean;
  appendageSlot?: AppendageSlot;
  isWeakPoint?: boolean;
  hpRatio?: number;
}

export interface AuthoritativeAimResult {
  aimPointWorld: THREE.Vector3;
  rayOrigin: THREE.Vector3;
  rayDirection: THREE.Vector3;
  reticleState: ReticleVisualState;
  resolvedTargetId: number | null;
  resolvedTargetLabel: string | null;
  isWeakPointTargeted: boolean;
  validLockedTargetIds: number[];
}

export interface MuzzleShotVector {
  muzzleWorldPos: THREE.Vector3;
  direction: THREE.Vector3;
  velocity: THREE.Vector3;
  aimTargetPoint: THREE.Vector3;
}

/**
 * Computes the single authoritative 3D world-space aim point and reticle state.
 *
 * Priority Order (Confirmed):
 * 1. Valid locked target near the reticle cone (prioritizing exposed boss weak points / appendages, then locked enemies).
 * 2. Direct 3D raycast intersection from the active camera through NDC (aimX, aimY) against active enemy/appendage/boss colliders.
 * 3. Stable convergence point along the camera reticle ray at `defaultConvergenceDistance` (85m).
 */
export function computeAuthoritativeAimState(
  camera: THREE.Camera,
  ndcAimX: number,
  ndcAimY: number,
  targets: AimableColliderTarget[],
  lockedTargetIds: number[],
  hadPreviousLock: boolean = false,
  defaultConvergenceDistance: number = 85,
): AuthoritativeAimResult {
  camera.updateMatrixWorld();

  // 1. Prune dead, inactive, or severed targets from lockedTargetIds
  const activeTargetMap = new Map<number, AimableColliderTarget>();
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (t.active) {
      activeTargetMap.set(t.id, t);
    }
  }
  const validLockedTargetIds = lockedTargetIds.filter((id) =>
    activeTargetMap.has(id),
  );

  // 2. Build world-space ray from camera through real reticle NDC
  _ndcVec2.set(
    THREE.MathUtils.clamp(ndcAimX, -1, 1),
    THREE.MathUtils.clamp(ndcAimY, -1, 1),
  );
  _raycaster.setFromCamera(_ndcVec2, camera);

  const rayOrigin = _raycaster.ray.origin.clone();
  const rayDirection = _raycaster.ray.direction.clone().normalize();
  const aimPointWorld = new THREE.Vector3();

  // Helper: evaluate perpendicular distance from camera reticle ray to a target in front of camera
  const getRayProximity = (target: AimableColliderTarget) => {
    _ptVec.subVectors(target.worldPos, rayOrigin);
    const forwardDist = _ptVec.dot(rayDirection);
    if (forwardDist <= 1.0) {
      return { valid: false, forwardDist: 0, perpDist: Infinity };
    }
    _projPoint.copy(rayOrigin).addScaledVector(rayDirection, forwardDist);
    const perpDist = _projPoint.distanceTo(target.worldPos);
    return { valid: true, forwardDist, perpDist };
  };

  // 3. PRIORITY 1: Valid locked target near reticle cone
  let bestLockedTarget: AimableColliderTarget | null = null;
  let bestLockedScore = Infinity;

  for (let i = 0; i < validLockedTargetIds.length; i++) {
    const lockedId = validLockedTargetIds[i];
    const tgt = activeTargetMap.get(lockedId);
    if (!tgt) continue;
    const prox = getRayProximity(tgt);
    if (!prox.valid) continue;

    // Tactical lock cone around reticle ray (generous enough for dogfighting turns while respecting reticle direction)
    const coneRadius = Math.max(tgt.radius * 3.1, 4.2 + prox.forwardDist * 0.095);
    if (prox.perpDist <= coneRadius) {
      // Prioritize appendages/weak points first, then closest to reticle ray
      const priorityWeight = tgt.isWeakPoint
        ? 0.45
        : tgt.isAppendage
          ? 0.65
          : 1.0;
      const score = prox.perpDist * priorityWeight;
      if (score < bestLockedScore) {
        bestLockedScore = score;
        bestLockedTarget = tgt;
      }
    }
  }

  if (bestLockedTarget) {
    aimPointWorld.copy(bestLockedTarget.worldPos);
    const isWeak = Boolean(
      bestLockedTarget.isWeakPoint || bestLockedTarget.isAppendage,
    );
    return {
      aimPointWorld,
      rayOrigin,
      rayDirection,
      reticleState: isWeak ? 'locked_weakpoint' : 'locked_enemy',
      resolvedTargetId: bestLockedTarget.id,
      resolvedTargetLabel: bestLockedTarget.label,
      isWeakPointTargeted: isWeak,
      validLockedTargetIds,
    };
  }

  // 4. PRIORITY 2: Direct raycast hit against active colliders along the reticle ray
  // Check localized boss appendages and enemies before the larger central boss core
  let bestRayHitTarget: AimableColliderTarget | null = null;
  let bestRayHitDist = Infinity;

  // Pass A: Appendages & standard enemies
  for (let i = 0; i < targets.length; i++) {
    const tgt = targets[i];
    if (!tgt.active || tgt.isBoss) continue;
    const prox = getRayProximity(tgt);
    if (!prox.valid) continue;
    const effectiveHitRadius = tgt.radius * 1.12;
    if (
      prox.perpDist <= effectiveHitRadius &&
      prox.forwardDist < bestRayHitDist
    ) {
      bestRayHitDist = prox.forwardDist;
      bestRayHitTarget = tgt;
    }
  }

  // Pass B: Boss Core if no appendage or enemy intercepted the ray first
  if (!bestRayHitTarget) {
    for (let i = 0; i < targets.length; i++) {
      const tgt = targets[i];
      if (!tgt.active || !tgt.isBoss) continue;
      const prox = getRayProximity(tgt);
      if (!prox.valid) continue;
      if (
        prox.perpDist <= tgt.radius * 1.08 &&
        prox.forwardDist < bestRayHitDist
      ) {
        bestRayHitDist = prox.forwardDist;
        bestRayHitTarget = tgt;
      }
    }
  }

  if (bestRayHitTarget) {
    aimPointWorld.copy(bestRayHitTarget.worldPos);
    const isWeak = Boolean(
      bestRayHitTarget.isWeakPoint || bestRayHitTarget.isAppendage,
    );
    return {
      aimPointWorld,
      rayOrigin,
      rayDirection,
      reticleState: isWeak ? 'locked_weakpoint' : 'target_aligned',
      resolvedTargetId: bestRayHitTarget.id,
      resolvedTargetLabel: bestRayHitTarget.label,
      isWeakPointTargeted: isWeak,
      validLockedTargetIds,
    };
  }

  // 5. PRIORITY 3: Stable world-space point along the camera reticle ray
  _raycaster.ray.at(defaultConvergenceDistance, aimPointWorld);
  const lostState =
    hadPreviousLock && validLockedTargetIds.length === 0;

  return {
    aimPointWorld,
    rayOrigin,
    rayDirection,
    reticleState: lostState ? 'target_lost' : 'free',
    resolvedTargetId: null,
    resolvedTargetLabel: null,
    isWeakPointTargeted: false,
    validLockedTargetIds,
  };
}

/**
 * Computes exact world-space muzzle origins and normalized convergence velocity vectors
 * toward `aimPointWorld`.
 *
 * - Precision weapons (`cavitation_cannons`, `focused_bio_lance`) have ZERO random divergence.
 * - Scatter weapon (`burst_pulse_repeater`) uses a bounded deterministic fan only when requested.
 */
export function computeMuzzleShotVectors(
  shipGroup: THREE.Object3D,
  localMuzzles: THREE.Vector3[],
  aimPointWorld: THREE.Vector3,
  projectileSpeed: number,
  weaponId: PrimaryWeaponId = 'cavitation_cannons',
  shotSequence: number = 0,
): MuzzleShotVector[] {
  shipGroup.updateMatrixWorld();
  const results: MuzzleShotVector[] = [];

  for (let i = 0; i < localMuzzles.length; i++) {
    const localOffset = localMuzzles[i];
    _muzzleWorld.copy(localOffset).applyMatrix4(shipGroup.matrixWorld);

    const targetPoint = aimPointWorld.clone();

    // Only Arc Shard Scatter (burst_pulse_repeater) uses a tiny deterministic lateral triad offset
    // when firing secondary flanking barrels; precision weapons have 0.0 spread.
    if (weaponId === 'burst_pulse_repeater' && localMuzzles.length > 1) {
      const patternIdx = (shotSequence + i) % 3;
      const spreadSign = patternIdx === 0 ? 0 : patternIdx === 1 ? -1 : 1;
      if (spreadSign !== 0) {
        _shotDir.subVectors(targetPoint, _muzzleWorld);
        const dist = Math.max(10, _shotDir.length());
        _shotDir.normalize();
        _rightVec.set(1, 0, 0).applyQuaternion(shipGroup.quaternion).normalize();
        _upVec.set(0, 1, 0).applyQuaternion(shipGroup.quaternion).normalize();
        // Bounded deterministic 1.15-degree spread scaled by distance
        const lateralOffset = dist * 0.018 * spreadSign;
        targetPoint.addScaledVector(_rightVec, lateralOffset);
      }
    }

    _shotDir.subVectors(targetPoint, _muzzleWorld);
    if (_shotDir.lengthSq() < 1e-6) {
      _shotDir.set(0, 0, -1).applyQuaternion(shipGroup.quaternion);
    }
    _shotDir.normalize();

    const velocity = _shotDir.clone().multiplyScalar(projectileSpeed);
    results.push({
      muzzleWorldPos: _muzzleWorld.clone(),
      direction: _shotDir.clone(),
      velocity,
      aimTargetPoint: targetPoint,
    });
  }

  return results;
}

export interface SweptHitResult {
  hit: boolean;
  hitPoint: THREE.Vector3;
  t: number;
  distanceSq: number;
}

/**
 * Analytical swept segment-to-sphere intersection test between `prevPos` and `nextPos`.
 * Prevents fast projectiles from tunneling through enemies or boss weak points.
 */
export function checkSweptSphereHit(
  prevPos: THREE.Vector3,
  nextPos: THREE.Vector3,
  projectileRadius: number,
  sphereCenter: THREE.Vector3,
  sphereRadius: number,
): SweptHitResult {
  _segVec.subVectors(nextPos, prevPos);
  const segLenSq = _segVec.lengthSq();
  let t = 0;

  if (segLenSq > 1e-8) {
    _ptVec.subVectors(sphereCenter, prevPos);
    t = THREE.MathUtils.clamp(_ptVec.dot(_segVec) / segLenSq, 0, 1);
  }

  _closestVec.copy(prevPos).addScaledVector(_segVec, t);
  const distSq = _closestVec.distanceToSquared(sphereCenter);
  const combinedRadius = Math.max(0.05, sphereRadius + projectileRadius);
  const hit = distSq <= combinedRadius * combinedRadius;

  return {
    hit,
    hitPoint: _closestVec.clone(),
    t,
    distanceSq: distSq,
  };
}

export interface MissionCompletionEvaluationInput {
  mission: MissionDefinition;
  hull: number;
  stageElapsed: number;
  waveCursor: number;
  totalWaves: number;
  pendingSpawnsCount: number;
  aliveCombatEnemiesCount: number;
  aliveMinesCount: number;
  enemiesDefeated: number;
  elitesDefeated: number;
  beaconIntegrityPct: number;
  bossSpawned: boolean;
  bossActive: boolean;
  bossDefeated: boolean;
  shotsFired: number;
  sonarPulsesUsed: number;
  rollsExecuted: number;
}

export interface MissionCompletionEvaluationResult {
  shouldCompleteVictory: boolean;
  shouldCompleteDefeat: boolean;
  shouldSpawnBossNow: boolean;
  needsReinforcementWave: boolean;
  phaseNumber: 1 | 2 | 3 | 4 | 5 | 6;
  phaseTitle: string;
}

/**
 * Determines the current 6-Phase Mission Operation state and enforces strict
 * victory/defeat rules so missions NEVER end prematurely after ~60-90 seconds.
 * When scheduled waves are cleared prior to the mission's target duration window
 * or required kill count, `needsReinforcementWave` signals the wave scheduler
 * to deploy dynamic reinforcement squadrons.
 */
export function evaluateMissionStateAndCompletion(
  input: MissionCompletionEvaluationInput,
): MissionCompletionEvaluationResult {
  const {
    mission,
    hull,
    stageElapsed,
    waveCursor,
    totalWaves,
    pendingSpawnsCount,
    aliveCombatEnemiesCount,
    aliveMinesCount,
    enemiesDefeated,
    elitesDefeated,
    beaconIntegrityPct,
    bossSpawned,
    bossActive,
    bossDefeated,
    shotsFired,
    sonarPulsesUsed,
    rollsExecuted,
  } = input;

  // 1. Check immediate defeat conditions
  if (hull <= 0) {
    return {
      shouldCompleteVictory: false,
      shouldCompleteDefeat: true,
      shouldSpawnBossNow: false,
      needsReinforcementWave: false,
      phaseNumber: 1,
      phaseTitle: 'HULL COMPROMISED',
    };
  }

  if (
    mission.objectiveType === 'protect_beacon' &&
    beaconIntegrityPct <= 0
  ) {
    return {
      shouldCompleteVictory: false,
      shouldCompleteDefeat: true,
      shouldSpawnBossNow: false,
      needsReinforcementWave: false,
      phaseNumber: 4,
      phaseTitle: 'RELAY BEACON DESTROYED',
    };
  }

  const allWavesSpawned = waveCursor >= totalWaves;
  const noPendingSpawns = pendingSpawnsCount <= 0;
  const noCombatHostilesAlive = aliveCombatEnemiesCount <= 0;
  const allActiveCleared =
    allWavesSpawned && noPendingSpawns && noCombatHostilesAlive;

  // Minimum real-time engagement thresholds (prevents fast-kill 75-second completions)
  const standardMinDuration = mission.durationSeconds * 0.85;
  const bossVanguardMinDuration =
    mission.category === 'boss_rematch'
      ? mission.durationSeconds * 0.25
      : mission.durationSeconds * 0.55;

  const killsDone = enemiesDefeated >= mission.targetKillsRequired;
  const elitesDone = elitesDefeated >= mission.targetKillsRequired;
  const standardDurationMet = stageElapsed >= standardMinDuration;
  const bossVanguardDurationMet = stageElapsed >= bossVanguardMinDuration;

  // 2. Check if Boss Finale should spawn now (requires all waves, required vanguard kills, and vanguard duration)
  const shouldSpawnBossNow = Boolean(
    mission.hasBossFinale &&
      !bossSpawned &&
      allActiveCleared &&
      killsDone &&
      bossVanguardDurationMet,
  );

  // 3. Determine if a Dynamic Reinforcement Wave is required to sustain combat until duration & kill targets are met
  let needsReinforcementWave = false;
  if (allActiveCleared && !bossSpawned && !bossActive) {
    switch (mission.objectiveType) {
      case 'flight_school':
        needsReinforcementWave = !killsDone;
        break;
      case 'eliminate_waves':
      case 'hazard_extraction':
      case 'protect_beacon':
        needsReinforcementWave = !killsDone || !standardDurationMet;
        break;
      case 'hunt_elites':
        needsReinforcementWave = !elitesDone || !standardDurationMet;
        break;
      case 'boss_finale':
        needsReinforcementWave = !killsDone || !bossVanguardDurationMet;
        break;
    }
  }

  // 4. Determine current 6-Phase Mission Structure label
  let phaseNumber: 1 | 2 | 3 | 4 | 5 | 6 = 1;
  let phaseTitle = 'PHASE 1: DEPLOYMENT';

  if (bossActive || (mission.hasBossFinale && bossSpawned && !bossDefeated)) {
    phaseNumber = 5;
    phaseTitle = 'PHASE 5: LEVIATHAN FINAL ENCOUNTER';
  } else if (
    allActiveCleared &&
    !needsReinforcementWave &&
    (!mission.hasBossFinale || (bossSpawned && bossDefeated))
  ) {
    phaseNumber = 6;
    phaseTitle = 'PHASE 6: EXTRACTION & RESOLUTION';
  } else if (totalWaves > 0) {
    const timeRatio =
      stageElapsed /
      Math.max(
        60,
        mission.hasBossFinale ? bossVanguardMinDuration : standardMinDuration,
      );
    const waveRatio = waveCursor / Math.max(1, totalWaves);
    const effectiveRatio = Math.min(1, (timeRatio * 0.55 + waveRatio * 0.45));
    if (stageElapsed < 18 && waveCursor <= 1) {
      phaseNumber = 1;
      phaseTitle = 'PHASE 1: DEPLOYMENT & CONTACT';
    } else if (effectiveRatio <= 0.38) {
      phaseNumber = 2;
      phaseTitle = 'PHASE 2: INITIAL ENGAGEMENT';
    } else if (effectiveRatio <= 0.72) {
      phaseNumber = 3;
      phaseTitle = 'PHASE 3: TACTICAL ESCALATION';
    } else {
      phaseNumber = 4;
      phaseTitle = 'PHASE 4: MAJOR ENCOUNTER';
    }
  }

  // 5. Evaluate Strict Mission Victory Conditions
  let shouldCompleteVictory = false;

  switch (mission.objectiveType) {
    case 'flight_school': {
      const drillsDone =
        shotsFired >= 4 && sonarPulsesUsed >= 1 && rollsExecuted >= 1;
      shouldCompleteVictory =
        drillsDone &&
        killsDone &&
        allActiveCleared &&
        aliveMinesCount === 0;
      break;
    }

    case 'eliminate_waves':
    case 'hazard_extraction': {
      shouldCompleteVictory =
        killsDone && standardDurationMet && allActiveCleared;
      break;
    }

    case 'hunt_elites': {
      shouldCompleteVictory =
        elitesDone && standardDurationMet && allActiveCleared;
      break;
    }

    case 'protect_beacon': {
      const beaconAlive = beaconIntegrityPct > 0;
      shouldCompleteVictory =
        beaconAlive &&
        standardDurationMet &&
        killsDone &&
        allActiveCleared;
      break;
    }

    case 'boss_finale': {
      shouldCompleteVictory =
        allActiveCleared &&
        killsDone &&
        bossSpawned &&
        bossDefeated;
      break;
    }
  }

  return {
    shouldCompleteVictory,
    shouldCompleteDefeat: false,
    shouldSpawnBossNow,
    needsReinforcementWave,
    phaseNumber,
    phaseTitle,
  };
}
