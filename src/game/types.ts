export type GameStateMode =
  | 'title'
  | 'campaign_map'
  | 'briefing'
  | 'hangar'
  | 'market'
  | 'rewards'
  | 'profile'
  | 'settings'
  | 'playing'
  | 'stage_clear'
  | 'paused'
  | 'victory'
  | 'game_over';

export type CameraMode = 'chase' | 'cockpit';

export type ControlScheme = 'hybrid_mouse' | 'keyboard_only';

export type StageId = 1 | 2 | 3;

export type DifficultyId = 'story' | 'normal' | 'elite';

export type MedalRank = 'S' | 'A' | 'B' | 'C';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export type TouchLayoutPreset = 'standard' | 'left_handed' | 'minimal';

export type EnemyType =
  | 'skimmer'
  | 'jelly'
  | 'cruiser'
  | 'manta'
  | 'hazard_mine';

export type ShipClassId =
  | 'vanguard_interceptor'
  | 'barracuda_skimmer'
  | 'leviathan_assault'
  | 'aegis_guardian'
  | 'echo_tactical'
  | 'seawolf_hunter'
  | 'kraken_siege'
  | 'poseidon_carrier'
  | 'charybdis_jugger'
  | 'valkyrie_supersonic'
  | 'titan_dreadnought'
  | 'sovereign_leviathan';

export interface ShipDefinition {
  id: ShipClassId;
  tier?: number;
  name: string;
  classLabel: 'Interceptor' | 'Assault' | 'Guardian' | 'Tactical';
  subtitle: string;
  description: string;
  tradeOffText: string;
  costCredits: number;
  costMaterials: number;
  unlockRequirementText: string;
  requiredStageCleared: number; // 0 = starter
  baseHull: number;
  baseShield: number;
  baseSpeed: number; // 18..32
  cannonDamageMult: number;
  fireRateMult: number;
  baseTorpedoLocks: number;
  sonarDurationBonus: number;
  pressureResistancePct: number;
  moduleCapacity: number;
  accentColor: string;
  primaryHullHex: number;
}

export type WeaponSlotType = 'primary' | 'secondary';

export type PrimaryWeaponId =
  | 'cavitation_cannons'
  | 'focused_bio_lance'
  | 'burst_pulse_repeater';

export type SecondaryWeaponId =
  | 'sonic_torpedoes'
  | 'heavy_breach_torpedo'
  | 'hexa_swarm_rack';

export type WeaponId = PrimaryWeaponId | SecondaryWeaponId;

export interface WeaponDefinition {
  id: WeaponId;
  slot: WeaponSlotType;
  name: string;
  shortTag: string;
  description: string;
  statSummary: string;
  costCredits: number;
  costMaterials: number;
  damage: number;
  cooldownSeconds: number;
  projectileSpeed: number;
  lockBonus: number;
  accentColor: string;
}

export type UpgradeId =
  | 'cavitation_overcharge'
  | 'quad_torpedo_salvo'
  | 'piezo_hull_regen'
  | 'hydro_thruster_coil'
  | 'voltaic_shield_capacitor'
  | 'sonar_crit_visor'
  | 'hadal_pressure_Bulkhead'
  | 'biolume_siphon_array';

export type UpgradeCategory = 'weapons' | 'defense' | 'mobility' | 'optics';

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  shortTag: string;
  category: UpgradeCategory;
  cost: number;
  materialCost: number;
  maxTier: number;
  description: string;
  statSummary: string;
  accentColor: string;
}

export type CosmeticId =
  | 'standard_cyan'
  | 'abyssal_crimson'
  | 'hadal_emerald'
  | 'imperial_aurum';

export interface CosmeticDefinition {
  id: CosmeticId;
  name: string;
  shortTag: string;
  description: string;
  costCredits: number;
  trimColorHex: number;
  trailColorHex: number;
  accentHex: string;
}

export interface WaveSpawnEvent {
  progressTrigger: number; // 0.0 to 0.82 before boss at 0.85
  enemyType: EnemyType;
  count: number;
  formation: 'v_wedge' | 'spiral_ring' | 'flank_pair' | 'mine_barrier';
  spread: number;
  isElite?: boolean;
}

export type MissionModeCategory =
  | 'campaign'
  | 'flight_school'
  | 'boss_rematch';

export type MissionObjectiveType =
  | 'eliminate_waves'
  | 'protect_beacon'
  | 'hunt_elites'
  | 'hazard_extraction'
  | 'boss_finale'
  | 'flight_school';

export interface MissionDefinition {
  id: string;
  stageId: StageId;
  missionNumber: number; // 1..9 for campaign, 0 for flight school, 10..12 for boss rematch
  category: MissionModeCategory;
  objectiveType: MissionObjectiveType;
  title: string;
  subtitle: string;
  briefing: string;
  primaryObjectiveText: string;
  optionalObjectiveText: string;
  recommendedPower: number;
  durationSeconds: number;
  hasBossFinale: boolean;
  targetKillsRequired: number;
  firstClearCredits: number;
  repeatClearCredits: number;
  firstClearMaterials: number;
  xpReward: number;
  prerequisiteMissionId: string | null;
  medalScoreThresholds: {
    S: number;
    A: number;
    B: number;
  };
  waves: WaveSpawnEvent[];
}

export interface StageConfig {
  id: StageId;
  title: string;
  zoneSubtitle: string;
  depthStart: number;
  depthEnd: number;
  durationSeconds: number;
  fogColor: number;
  deepFogColor: number;
  fogDensity: number;
  deepFogDensity: number;
  ambientSkyColor: number;
  deepAmbientSkyColor: number;
  ambientGroundColor: number;
  deepAmbientGroundColor: number;
  keyLightColor: number;
  deepKeyLightColor: number;
  rimLightColor: number;
  deepRimLightColor: number;
  stratumLabels: [string, string, string];
  accentHex: string;
  bossName: string;
  bossSubtitle: string;
  bossMaxHp: number;
  waves: WaveSpawnEvent[];
}

export type AppendageSlot = 'dorsal' | 'port' | 'starboard' | 'ventral';

export interface BossAppendageState {
  id: string;
  slot: AppendageSlot;
  name: string;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  recentHit: boolean;
  isSonarWeakPoint: boolean;
  leakIntensity: number; // 0..1 procedural bioluminescent fluid leak intensity
  isCritical: boolean; // true when appendage health reaches critical threshold
  tacticalEffect: string;
}

export interface ScreenLockTarget {
  id: number;
  x: number;
  y: number;
  visible: boolean;
  locked: boolean;
  hpRatio: number;
  isBoss: boolean;
  isAppendage?: boolean;
  isElite?: boolean;
  isHazardScanned?: boolean;
  isWeakPointScanned?: boolean;
  isTelegraphing: boolean;
  label: string;
}

export interface MissionClearRecord {
  missionId: string;
  cleared: boolean;
  bestScore: number;
  bestRank: MedalRank;
  optionalCompleted: boolean;
  timesCleared: number;
}

export interface AchievementDefinition {
  id: string;
  category:
    | 'Campaign'
    | 'Combat'
    | 'Precision'
    | 'Boss Hunter'
    | 'Pilot Skill'
    | 'Collection';
  title: string;
  description: string;
  targetValue: number;
  rewardCredits: number;
  rewardMaterials: number;
  rewardXp: number;
}

export interface DailyObjectiveDefinition {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  rewardCredits: number;
  rewardMaterials: number;
}

export interface GameSettings {
  masterVolume: number; // 0..100
  musicVolume: number; // 0..100
  sfxVolume: number; // 0..100
  uiVolume: number; // 0..100
  muted: boolean;
  graphicsQuality: GraphicsQuality;
  fpsCap: 30 | 60;
  cameraShakeIntensity: number; // 0..100
  aimAssist: boolean;
  autoFire: boolean;
  hapticsEnabled: boolean;
  reducedMotion: boolean;
  touchControlsEnabled: boolean;
  touchLayout: TouchLayoutPreset;
  joystickSensitivity: number; // 50..150
  joystickDeadzone: number; // 5..25
}

export interface LifetimeStats {
  totalSortiesLaunched: number;
  totalVictories: number;
  totalDefeats: number;
  totalEnemiesDefeated: number;
  totalElitesDefeated: number;
  totalBossesDefeated: number;
  totalAppendagesSevered: number;
  totalSonarPulsesUsed: number;
  totalTorpedoesFired: number;
  totalPlayTimeSeconds: number;
}

export interface PlayerSaveData {
  schemaVersion: number;
  callsign: string;
  pilotLevel: number;
  pilotXp: number;
  highScore: number;
  salvageCredits: number;
  abyssalMaterials: number;
  selectedShip: ShipClassId;
  ownedShips: ShipClassId[];
  equippedPrimaryWeapon: PrimaryWeaponId;
  equippedSecondaryWeapon: SecondaryWeaponId;
  ownedWeapons: WeaponId[];
  ownedUpgrades: UpgradeId[];
  upgradeTiers: Record<UpgradeId, number>;
  activeUpgrades: UpgradeId[];
  equippedCosmetic: CosmeticId;
  ownedCosmetics: CosmeticId[];
  selectedDifficulty: DifficultyId;
  missionRecords: Record<string, MissionClearRecord>;
  claimedAchievements: string[];
  dailyDateKey: string;
  dailyProgress: Record<string, number>;
  claimedDailyIds: string[];
  stats: LifetimeStats;
  settings: GameSettings;
}

export interface LastMissionResult {
  missionId: string;
  missionTitle: string;
  stageId: StageId;
  victory: boolean;
  isFirstClear: boolean;
  score: number;
  medalRank: MedalRank;
  primaryCompleted: boolean;
  optionalCompleted: boolean;
  optionalObjectiveText: string;
  creditsEarned: number;
  materialsEarned: number;
  xpEarned: number;
  enemiesDefeated: number;
  accuracyPct: number;
  hullRemainingPct: number;
  elapsedSeconds: number;
}

export interface HudSnapshot {
  mode: GameStateMode;
  stageId: StageId;
  missionId: string;
  missionTitle: string;
  missionCategory: MissionModeCategory;
  objectiveType: MissionObjectiveType;
  primaryObjectiveText: string;
  optionalObjectiveText: string;
  objectiveProgressCurrent: number;
  objectiveProgressTarget: number;
  optionalObjectiveCompleted: boolean;
  flightSchoolStepText: string | null;
  beaconIntegrityPct: number | null;
  difficulty: DifficultyId;
  stageTitle: string;
  stageSubtitle: string;
  depthMeters: number;
  stageProgress: number; // 0..1
  depthStratumName: string;
  ambientLightPct: number;
  ambientColorHex: string;
  keyLightIntensity: number;
  hull: number;
  maxHull: number;
  hullStress: number; // 0..100 structural stress from high-pressure zones
  pressureDamageTaken: number; // cumulative hull damage taken from abyssal pressure
  inDeepPressureZone: boolean;
  pressureZoneLabel: string | null;
  shield: number;
  maxShield: number;
  boost: number;
  maxBoost: number;
  score: number;
  highScore: number;
  combo: number;
  multiplier: number;
  lockedCount: number;
  maxLocks: number;
  torpedoCooldown: number; // 0..1 (0 = ready)
  sonarActive: boolean;
  sonarRemainingSeconds: number;
  sonarCooldown: number; // 0..1 (0 = ready)
  sonarWeakPointSlot: AppendageSlot | 'core' | null;
  sonarHazardsCount: number;
  barrelRolling: boolean;
  bossActive: boolean;
  bossName: string;
  bossSubtitle: string;
  bossHp: number;
  bossMaxHp: number;
  bossPhase: 1 | 2 | 3;
  bossTelegraphText: string | null;
  bossAppendages: BossAppendageState[];
  lastSeveredPartName: string | null;
  hazardWarningText: string | null;
  enemiesDefeated: number;
  shotsFired: number;
  shotsHit: number;
  stageElapsedSeconds: number;
  salvageCredits: number;
  abyssalMaterials: number;
  ownedUpgrades: UpgradeId[];
  activeUpgrades: UpgradeId[];
  unlockedStages: StageId[];
  saveData: PlayerSaveData;
  lastMissionResult: LastMissionResult | null;
}
