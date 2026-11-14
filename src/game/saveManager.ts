import {
  AchievementDefinition,
  GameSettings,
  PlayerSaveData,
  StageId,
  UpgradeId,
} from './types';
import { MISSION_CATALOG, SHIP_CATALOG } from './stages';

const SAVE_KEY = 'pelagic_vanguard_save_v1';
const BACKUP_KEY = 'pelagic_vanguard_save_v1_backup';

const BLOCKED_WORDS = [
  'admin',
  'root',
  'system',
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'cunt',
  'dick',
];

export function getTodayDateKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

export function detectDefaultTouchControls(): boolean {
  return true;
}

export function createDefaultSettings(muted: boolean = false): GameSettings {
  return {
    masterVolume: 85,
    musicVolume: 70,
    sfxVolume: 90,
    uiVolume: 80,
    muted,
    graphicsQuality: 'high',
    fpsCap: 60,
    cameraShakeIntensity: 80,
    aimAssist: true,
    autoFire: true,
    hapticsEnabled: true,
    reducedMotion: false,
    touchControlsEnabled: detectDefaultTouchControls(),
    touchLayout: 'standard',
    joystickSensitivity: 100,
    joystickDeadzone: 10,
  };
}

export function createDefaultSaveData(): PlayerSaveData {
  let legacyHighScore = 0;
  let legacyCredits = 1250;
  let legacyOwned: UpgradeId[] = [];
  let legacyEquipped: UpgradeId[] = [];
  let legacyMuted = false;

  try {
    const sh = Number(localStorage.getItem('pelagic_vanguard_highscore') || '0');
    if (!Number.isNaN(sh) && sh > 0) legacyHighScore = sh;

    const sc = localStorage.getItem('pelagic_vanguard_credits');
    if (sc !== null) {
      const pc = Number(sc);
      if (!Number.isNaN(pc) && pc >= 0) legacyCredits = pc;
    }

    const so = localStorage.getItem('pelagic_vanguard_owned_upgrades');
    if (so) {
      const po = JSON.parse(so);
      if (Array.isArray(po)) legacyOwned = po;
    }

    const se = localStorage.getItem('pelagic_vanguard_equipped_upgrades');
    if (se) {
      const pe = JSON.parse(se);
      if (Array.isArray(pe)) legacyEquipped = pe;
    }

    if (localStorage.getItem('pelagic_vanguard_muted') === 'true') {
      legacyMuted = true;
    }
  } catch {
    // Ignore storage read errors
  }

  const upgradeTiers: Record<UpgradeId, number> = {
    cavitation_overcharge: legacyOwned.includes('cavitation_overcharge') ? 1 : 0,
    quad_torpedo_salvo: legacyOwned.includes('quad_torpedo_salvo') ? 1 : 0,
    piezo_hull_regen: legacyOwned.includes('piezo_hull_regen') ? 1 : 0,
    hydro_thruster_coil: legacyOwned.includes('hydro_thruster_coil') ? 1 : 0,
    voltaic_shield_capacitor: legacyOwned.includes('voltaic_shield_capacitor') ? 1 : 0,
    sonar_crit_visor: legacyOwned.includes('sonar_crit_visor') ? 1 : 0,
    hadal_pressure_Bulkhead: legacyOwned.includes('hadal_pressure_Bulkhead') ? 1 : 0,
    biolume_siphon_array: legacyOwned.includes('biolume_siphon_array') ? 1 : 0,
  };

  return {
    schemaVersion: 1,
    callsign: 'VANGUARD-01',
    pilotLevel: 1,
    pilotXp: 0,
    highScore: legacyHighScore,
    salvageCredits: legacyCredits,
    abyssalMaterials: 3,
    selectedShip: 'vanguard_interceptor',
    ownedShips: ['vanguard_interceptor'],
    equippedPrimaryWeapon: 'cavitation_cannons',
    equippedSecondaryWeapon: 'sonic_torpedoes',
    ownedWeapons: ['cavitation_cannons', 'sonic_torpedoes'],
    ownedUpgrades: legacyOwned,
    upgradeTiers,
    activeUpgrades: legacyEquipped.slice(0, 4),
    equippedCosmetic: 'standard_cyan',
    ownedCosmetics: ['standard_cyan'],
    selectedDifficulty: 'normal',
    missionRecords: {},
    claimedAchievements: [],
    dailyDateKey: getTodayDateKey(),
    dailyProgress: {},
    claimedDailyIds: [],
    stats: {
      totalSortiesLaunched: 0,
      totalVictories: 0,
      totalDefeats: 0,
      totalEnemiesDefeated: 0,
      totalElitesDefeated: 0,
      totalBossesDefeated: 0,
      totalAppendagesSevered: 0,
      totalSonarPulsesUsed: 0,
      totalTorpedoesFired: 0,
      totalPlayTimeSeconds: 0,
    },
    settings: createDefaultSettings(legacyMuted),
  };
}

function normalizeAndMigrateSave(raw: Partial<PlayerSaveData>): PlayerSaveData {
  const base = createDefaultSaveData();
  const today = getTodayDateKey();
  const isSameDay = raw.dailyDateKey === today;

  const merged: PlayerSaveData = {
    ...base,
    ...raw,
    schemaVersion: 1,
    upgradeTiers: {
      ...base.upgradeTiers,
      ...(raw.upgradeTiers || {}),
    },
    missionRecords: raw.missionRecords || {},
    claimedAchievements: Array.isArray(raw.claimedAchievements)
      ? raw.claimedAchievements
      : [],
    dailyDateKey: today,
    dailyProgress: isSameDay && raw.dailyProgress ? raw.dailyProgress : {},
    claimedDailyIds:
      isSameDay && Array.isArray(raw.claimedDailyIds) ? raw.claimedDailyIds : [],
    stats: {
      ...base.stats,
      ...(raw.stats || {}),
    },
    settings: {
      ...base.settings,
      ...(raw.settings || {}),
    },
  };

  if (!merged.ownedShips.includes('vanguard_interceptor')) {
    merged.ownedShips.unshift('vanguard_interceptor');
  }
  if (!merged.ownedShips.includes(merged.selectedShip)) {
    merged.selectedShip = 'vanguard_interceptor';
  }
  return merged;
}

export function loadPlayerSave(): {
  data: PlayerSaveData;
  recoveredFromBackup: boolean;
} {
  let hadCorruptedPrimary = false;
  try {
    const primaryStr = localStorage.getItem(SAVE_KEY);
    if (primaryStr) {
      const parsed = JSON.parse(primaryStr);
      if (parsed && typeof parsed === 'object') {
        return {
          data: normalizeAndMigrateSave(parsed),
          recoveredFromBackup: false,
        };
      }
      hadCorruptedPrimary = true;
    }
  } catch {
    hadCorruptedPrimary = true;
    // Preserve raw corrupted payload before attempting backup recovery so data is never silently lost
    try {
      const rawCorrupt = localStorage.getItem(SAVE_KEY);
      if (rawCorrupt) {
        localStorage.setItem('pelagic_vanguard_corrupted_snapshot', rawCorrupt);
      }
    } catch {
      // Ignore storage error
    }
    try {
      const backupStr = localStorage.getItem(BACKUP_KEY);
      if (backupStr) {
        const parsedBackup = JSON.parse(backupStr);
        if (parsedBackup && typeof parsedBackup === 'object') {
          const recovered = normalizeAndMigrateSave(parsedBackup);
          savePlayerData(recovered);
          return { data: recovered, recoveredFromBackup: true };
        }
      }
    } catch {
      // Fall through to legacy/default recovery
    }
  }

  const fresh = createDefaultSaveData();
  savePlayerData(fresh);
  return { data: fresh, recoveredFromBackup: hadCorruptedPrimary };
}

export function savePlayerData(data: PlayerSaveData): void {
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(SAVE_KEY, serialized);
    localStorage.setItem(BACKUP_KEY, serialized);
    // Keep legacy keys in sync
    localStorage.setItem('pelagic_vanguard_highscore', String(Math.round(data.highScore)));
    localStorage.setItem(
      'pelagic_vanguard_credits',
      String(Math.round(data.salvageCredits)),
    );
    localStorage.setItem(
      'pelagic_vanguard_owned_upgrades',
      JSON.stringify(data.ownedUpgrades),
    );
    localStorage.setItem(
      'pelagic_vanguard_equipped_upgrades',
      JSON.stringify(data.activeUpgrades),
    );
    localStorage.setItem('pelagic_vanguard_muted', String(data.settings.muted));
  } catch {
    // Ignore quota/storage errors in restricted contexts
  }
}

export function resetPlayerSave(): PlayerSaveData {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(BACKUP_KEY);
    localStorage.removeItem('pelagic_vanguard_highscore');
    localStorage.removeItem('pelagic_vanguard_credits');
    localStorage.removeItem('pelagic_vanguard_owned_upgrades');
    localStorage.removeItem('pelagic_vanguard_equipped_upgrades');
  } catch {
    // Ignore errors
  }
  const fresh = createDefaultSaveData();
  savePlayerData(fresh);
  return fresh;
}

export function validateCallsign(input: string): {
  valid: boolean;
  sanitized: string;
  error: string | null;
} {
  const trimmed = input.trim().toUpperCase().replace(/[^A-Z0-9\-_ ]/g, '');
  if (trimmed.length < 3) {
    return {
      valid: false,
      sanitized: trimmed,
      error: 'Callsign must be between 3 and 16 alphanumeric characters.',
    };
  }
  if (trimmed.length > 16) {
    return {
      valid: false,
      sanitized: trimmed.slice(0, 16),
      error: 'Callsign cannot exceed 16 characters.',
    };
  }
  const lower = trimmed.toLowerCase();
  if (BLOCKED_WORDS.some((w) => lower.includes(w))) {
    return {
      valid: false,
      sanitized: trimmed,
      error: 'Callsign contains restricted words. Please choose another.',
    };
  }
  return { valid: true, sanitized: trimmed, error: null };
}

export function getXpForNextLevel(level: number): number {
  return 250 + (level - 1) * 180;
}

export function applyPilotXp(
  save: PlayerSaveData,
  addedXp: number,
): { leveledUp: boolean; newLevel: number } {
  save.pilotXp += addedXp;
  let leveledUp = false;
  while (save.pilotXp >= getXpForNextLevel(save.pilotLevel)) {
    save.pilotXp -= getXpForNextLevel(save.pilotLevel);
    save.pilotLevel += 1;
    // Grant level-up bonus
    save.salvageCredits += 150;
    save.abyssalMaterials += 1;
    leveledUp = true;
  }
  return { leveledUp, newLevel: save.pilotLevel };
}

export function isMissionUnlocked(
  missionId: string,
  save: PlayerSaveData,
): boolean {
  const mission = MISSION_CATALOG.find((m) => m.id === missionId);
  if (!mission) return false;
  if (!mission.prerequisiteMissionId) return true;
  const prereqRecord = save.missionRecords[mission.prerequisiteMissionId];
  return Boolean(prereqRecord && prereqRecord.cleared);
}

export function getHighestClearedStage(save: PlayerSaveData): number {
  let highest = 0;
  if (save.missionRecords['s1_m3_aurelia_finale']?.cleared) highest = 1;
  if (save.missionRecords['s2_m3_vulcanus_finale']?.cleared) highest = 2;
  if (save.missionRecords['s3_m3_empress_finale']?.cleared) highest = 3;
  return highest;
}

export function getRecommendedNextMissionId(save: PlayerSaveData): string {
  const campaignMissions = MISSION_CATALOG.filter((m) => m.category === 'campaign');
  for (const m of campaignMissions) {
    if (!save.missionRecords[m.id]?.cleared) {
      return m.id;
    }
  }
  return 's3_m3_empress_finale';
}

export function calculateFleetPower(save: PlayerSaveData): number {
  const ship =
    SHIP_CATALOG.find((s) => s.id === save.selectedShip) || SHIP_CATALOG[0];
  let power = ship.baseHull * 0.5 + ship.baseShield * 0.5;
  save.activeUpgrades.forEach((uId) => {
    const tier = Math.max(1, save.upgradeTiers[uId] || 1);
    power += 35 * tier;
  });
  if (save.equippedPrimaryWeapon !== 'cavitation_cannons') power += 40;
  if (save.equippedSecondaryWeapon !== 'sonic_torpedoes') power += 45;
  return Math.round(power);
}

export function getAchievementProgress(
  ach: AchievementDefinition,
  save: PlayerSaveData,
): number {
  switch (ach.id) {
    case 'ach_first_sortie':
      return save.stats.totalVictories;
    case 'ach_campaign_conqueror':
      return MISSION_CATALOG.filter(
        (m) => m.category === 'campaign' && save.missionRecords[m.id]?.cleared,
      ).length;
    case 'ach_hostile_hunter_50':
      return save.stats.totalEnemiesDefeated;
    case 'ach_appendage_breaker_6':
      return save.stats.totalAppendagesSevered;
    case 'ach_boss_slayer_3':
      return save.stats.totalBossesDefeated;
    case 'ach_sonar_tactician_10':
      return save.stats.totalSonarPulsesUsed;
    case 'ach_s_rank_master':
      return Object.values(save.missionRecords).filter((r) => r.bestRank === 'S')
        .length;
    case 'ach_fleet_collector':
      return save.ownedShips.length;
    default:
      return 0;
  }
}

export function getUnclaimedRewardsCount(save: PlayerSaveData): {
  achievementsCount: number;
  dailyCount: number;
  total: number;
} {
  let achievementsCount = 0;
  const achIds = [
    'ach_first_sortie',
    'ach_campaign_conqueror',
    'ach_hostile_hunter_50',
    'ach_appendage_breaker_6',
    'ach_boss_slayer_3',
    'ach_sonar_tactician_10',
    'ach_s_rank_master',
    'ach_fleet_collector',
  ];
  achIds.forEach((id) => {
    if (save.claimedAchievements.includes(id)) return;
    const targetMap: Record<string, number> = {
      ach_first_sortie: 1,
      ach_campaign_conqueror: 9,
      ach_hostile_hunter_50: 50,
      ach_appendage_breaker_6: 6,
      ach_boss_slayer_3: 3,
      ach_sonar_tactician_10: 10,
      ach_s_rank_master: 3,
      ach_fleet_collector: 3,
    };
    const prog = getAchievementProgress(
      {
        id,
        category: 'Campaign',
        title: '',
        description: '',
        targetValue: targetMap[id] || 1,
        rewardCredits: 0,
        rewardMaterials: 0,
        rewardXp: 0,
      },
      save,
    );
    if (prog >= (targetMap[id] || 1)) achievementsCount++;
  });

  let dailyCount = 0;
  const dailyTargets: Record<string, number> = {
    daily_sorties_2: 2,
    daily_sonar_3: 3,
    daily_appendage_1: 1,
  };
  Object.entries(dailyTargets).forEach(([dId, target]) => {
    if (save.claimedDailyIds.includes(dId)) return;
    if ((save.dailyProgress[dId] || 0) >= target) dailyCount++;
  });

  return {
    achievementsCount,
    dailyCount,
    total: achievementsCount + dailyCount,
  };
}

export function getUnlockedStagesFromSave(save: PlayerSaveData): StageId[] {
  const stages: StageId[] = [1];
  if (save.missionRecords['s1_m3_aurelia_finale']?.cleared) stages.push(2);
  if (save.missionRecords['s2_m3_vulcanus_finale']?.cleared) stages.push(3);
  return stages;
}
