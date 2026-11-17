/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AbyssalCanvas,
  SimulationController,
} from './components/AbyssalCanvas';
import { HudOverlay } from './components/HudOverlay';
import {
  AppendageSlot,
  CameraMode,
  ControlScheme,
  CosmeticId,
  DifficultyId,
  GameSettings,
  GameStateMode,
  HudSnapshot,
  ScreenLockTarget,
  ShipClassId,
  StageId,
  UpgradeId,
  WeaponId,
} from './game/types';
import { MISSION_CATALOG, SHIP_CATALOG, STAGE_CONFIGS } from './game/stages';
import {
  detectDefaultTouchControls,
  getUnlockedStagesFromSave,
  loadPlayerSave,
} from './game/saveManager';
import { soundEngine } from './game/audio';

const initialSave = loadPlayerSave().data;
if (typeof window !== 'undefined' && detectDefaultTouchControls()) {
  initialSave.settings.touchControlsEnabled = true;
}

const INITIAL_HUD: HudSnapshot = {
  mode: 'title',
  stageId: 1,
  stageTitle: STAGE_CONFIGS[1].title,
  stageSubtitle: STAGE_CONFIGS[1].zoneSubtitle,
  missionId: MISSION_CATALOG[1].id,
  missionTitle: MISSION_CATALOG[1].title,
  missionCategory: MISSION_CATALOG[1].category,
  objectiveType: MISSION_CATALOG[1].objectiveType,
  primaryObjectiveText: MISSION_CATALOG[1].primaryObjectiveText,
  optionalObjectiveText: MISSION_CATALOG[1].optionalObjectiveText,
  objectiveProgressCurrent: 0,
  objectiveProgressTarget: MISSION_CATALOG[1].targetKillsRequired,
  optionalObjectiveCompleted: false,
  flightSchoolStepText: null,
  beaconIntegrityPct: 100,
  difficulty: initialSave.selectedDifficulty,
  depthMeters: STAGE_CONFIGS[1].depthStart,
  stageProgress: 0,
  depthStratumName: STAGE_CONFIGS[1].stratumLabels[0],
  ambientLightPct: 100,
  ambientColorHex: '#38bdf8',
  keyLightIntensity: 2.45,
  hull: 100,
  maxHull: 100,
  hullStress: 0,
  pressureDamageTaken: 0,
  inDeepPressureZone: false,
  pressureZoneLabel: null,
  shield: 100,
  maxShield: 100,
  boost: 100,
  maxBoost: 100,
  score: 0,
  highScore: initialSave.highScore,
  combo: 0,
  multiplier: 1,
  lockedCount: 0,
  maxLocks: 4,
  torpedoCooldown: 0,
  sonarActive: false,
  sonarRemainingSeconds: 0,
  sonarCooldown: 0,
  sonarWeakPointSlot: null,
  sonarHazardsCount: 0,
  barrelRolling: false,
  shipRarity: SHIP_CATALOG[0].rarity,
  shipRoleTitle: SHIP_CATALOG[0].roleTitle,
  activeAbilityName: SHIP_CATALOG[0].activeAbility.name,
  activeAbilityActive: false,
  activeAbilityRemainingSeconds: 0,
  activeAbilityCooldown: 0,
  activeAbilityCooldownSeconds: 0,
  activeDronesCount: 0,
  bossActive: false,
  bossName: STAGE_CONFIGS[1].bossName,
  bossSubtitle: STAGE_CONFIGS[1].bossSubtitle,
  bossHp: STAGE_CONFIGS[1].bossMaxHp,
  bossMaxHp: STAGE_CONFIGS[1].bossMaxHp,
  bossPhase: 1,
  bossTelegraphText: null,
  bossAppendages: [],
  lastSeveredPartName: null,
  hazardWarningText: null,
  enemiesDefeated: 0,
  shotsFired: 0,
  shotsHit: 0,
  stageElapsedSeconds: 0,
  salvageCredits: initialSave.salvageCredits,
  abyssalMaterials: initialSave.abyssalMaterials,
  ownedUpgrades: initialSave.ownedUpgrades,
  activeUpgrades: initialSave.activeUpgrades,
  unlockedStages: getUnlockedStagesFromSave(initialSave),
  saveData: initialSave,
  lastMissionResult: null,
};

export default function App() {
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [selectedStage, setSelectedStage] = useState<StageId>(1);
  const [selectedMissionId, setSelectedMissionId] =
    useState<string>('s1_m1_reef_patrol');
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [controlScheme, setControlScheme] =
    useState<ControlScheme>('hybrid_mouse');
  const [isMuted, setIsMuted] = useState<boolean>(() => soundEngine.isMuted());
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [lockTargets, setLockTargets] = useState<ScreenLockTarget[]>([]);
  const [reticlePos, setReticlePos] = useState<{ x: number; y: number }>({
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 640,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 360,
  });

  const simControllerRef = useRef<SimulationController | null>(null);
  const userToggledTouchRef = useRef<boolean>(false);

  const handleRegisterController = useCallback(
    (controller: SimulationController) => {
      simControllerRef.current = controller;
      if (detectDefaultTouchControls()) {
        controller.updateSettings({ touchControlsEnabled: true });
      }
    },
    [],
  );

  useEffect(() => {
    const checkViewportTouch = () => {
      if (userToggledTouchRef.current) return;
      if (detectDefaultTouchControls()) {
        simControllerRef.current?.updateSettings({
          touchControlsEnabled: true,
        });
      }
    };
    window.addEventListener('resize', checkViewportTouch);
    return () => window.removeEventListener('resize', checkViewportTouch);
  }, []);

  const handleHudUpdate = useCallback((snapshot: HudSnapshot) => {
    setHud(snapshot);
  }, []);

  const handleLockTargetsUpdate = useCallback(
    (targets: ScreenLockTarget[], nextReticle: { x: number; y: number }) => {
      setLockTargets(targets);
      setReticlePos(nextReticle);
    },
    [],
  );

  const handleSelectStage = useCallback((stageId: StageId) => {
    setSelectedStage(stageId);
    const defaultMission = MISSION_CATALOG.find(
      (m) => m.stageId === stageId && m.category === 'campaign',
    );
    if (defaultMission) setSelectedMissionId(defaultMission.id);
    soundEngine.playSonarPing(640 + stageId * 80);
  }, []);

  const handleStartGame = useCallback(
    (stageId: StageId, resetCampaign: boolean) => {
      setSelectedStage(stageId);
      soundEngine.playSonarPing(880);
      simControllerRef.current?.startStage(stageId, resetCampaign);
    },
    [],
  );

  const handleStartMission = useCallback((missionId: string) => {
    setSelectedMissionId(missionId);
    const m = MISSION_CATALOG.find((item) => item.id === missionId);
    if (m) setSelectedStage(m.stageId);
    soundEngine.playSonarPing(880);
    simControllerRef.current?.startMission(missionId);
  }, []);

  const handleOpenBriefing = useCallback((missionId: string) => {
    setSelectedMissionId(missionId);
    const m = MISSION_CATALOG.find((item) => item.id === missionId);
    if (m) setSelectedStage(m.stageId);
    soundEngine.playSonarPing(760);
    simControllerRef.current?.setMode('briefing');
  }, []);

  const handleSetMode = useCallback((nextMode: GameStateMode) => {
    soundEngine.playSonarPing(720);
    simControllerRef.current?.setMode(nextMode);
  }, []);

  const handleOpenMarket = useCallback(() => {
    soundEngine.playSonarPing(780);
    simControllerRef.current?.setMode('market');
  }, []);

  const handleBuyOrToggleUpgrade = useCallback((upgradeId: UpgradeId) => {
    simControllerRef.current?.buyOrToggleUpgrade(upgradeId);
  }, []);

  const handleUpgradeModuleTier = useCallback((upgradeId: UpgradeId) => {
    simControllerRef.current?.upgradeModuleTier(upgradeId);
  }, []);

  const handleRefundAllUpgrades = useCallback(() => {
    simControllerRef.current?.refundAllUpgrades();
  }, []);

  const handleClaimSupplyGrant = useCallback(() => {
    simControllerRef.current?.claimSupplyGrant();
  }, []);

  const handleExchangeCreditsForCore = useCallback(() => {
    simControllerRef.current?.exchangeCreditsForCore();
  }, []);

  const handleSelectShip = useCallback((shipId: ShipClassId) => {
    simControllerRef.current?.selectShip(shipId);
  }, []);

  const handleBuyShip = useCallback((shipId: ShipClassId) => {
    simControllerRef.current?.buyShip(shipId);
  }, []);

  const handleSelectWeapon = useCallback((weaponId: WeaponId) => {
    simControllerRef.current?.selectWeapon(weaponId);
  }, []);

  const handleBuyWeapon = useCallback((weaponId: WeaponId) => {
    simControllerRef.current?.buyWeapon(weaponId);
  }, []);

  const handleSelectCosmetic = useCallback((cosmeticId: CosmeticId) => {
    simControllerRef.current?.selectCosmetic(cosmeticId);
  }, []);

  const handlePreviewShip = useCallback(
    (shipId: ShipClassId, cosmeticId?: CosmeticId) => {
      simControllerRef.current?.previewShip(shipId, cosmeticId);
    },
    [],
  );

  const handleSetDifficulty = useCallback((diff: DifficultyId) => {
    simControllerRef.current?.setDifficulty(diff);
  }, []);

  const handleClaimDaily = useCallback((dailyId: string) => {
    simControllerRef.current?.claimDailyObjective(dailyId);
  }, []);

  const handleClaimAchievement = useCallback((achId: string) => {
    simControllerRef.current?.claimAchievement(achId);
  }, []);

  const handleUpdateCallsign = useCallback((callsign: string) => {
    simControllerRef.current?.updateCallsign(callsign);
  }, []);

  const handleUpdateSettings = useCallback((partial: Partial<GameSettings>) => {
    if (typeof partial.touchControlsEnabled === 'boolean') {
      userToggledTouchRef.current = true;
    }
    simControllerRef.current?.updateSettings(partial);
  }, []);

  const handleResetSaveData = useCallback(() => {
    simControllerRef.current?.resetSaveData();
  }, []);

  const handleTouchMove = useCallback((x: number, y: number) => {
    simControllerRef.current?.setTouchInput(x, y);
  }, []);

  const handleTouchFireChange = useCallback((firing: boolean) => {
    simControllerRef.current?.setTouchFiring(firing);
  }, []);

  const handleResumeGame = useCallback(() => {
    soundEngine.playSonarPing(740);
    simControllerRef.current?.setMode('playing');
  }, []);

  const handlePauseGame = useCallback(() => {
    simControllerRef.current?.setMode('paused');
  }, []);

  const handleReturnToTitle = useCallback(() => {
    soundEngine.playSonarPing(660);
    simControllerRef.current?.setMode('title');
  }, []);

  const handleToggleCamera = useCallback(() => {
    setCameraMode((prev) => (prev === 'chase' ? 'cockpit' : 'chase'));
    soundEngine.playSonarPing(700);
  }, []);

  const handleToggleControlScheme = useCallback(() => {
    setControlScheme((prev) =>
      prev === 'hybrid_mouse' ? 'keyboard_only' : 'hybrid_mouse',
    );
    soundEngine.playSonarPing(620);
  }, []);

  const handleToggleMute = useCallback(() => {
    const nextMuted = soundEngine.toggleMute();
    setIsMuted(nextMuted);
    simControllerRef.current?.updateSettings({ muted: nextMuted });
  }, []);

  const handleToggleDock = useCallback(() => {
    setDockCollapsed((prev) => !prev);
  }, []);

  const handleTriggerBarrelRoll = useCallback(() => {
    simControllerRef.current?.triggerBarrelRoll();
  }, []);

  const handleTriggerTorpedoSalvo = useCallback(() => {
    simControllerRef.current?.triggerTorpedoSalvo();
  }, []);

  const handleTriggerTacticalSonar = useCallback(() => {
    simControllerRef.current?.triggerTacticalSonar();
  }, []);

  const handleTriggerShipAbility = useCallback(() => {
    simControllerRef.current?.triggerShipAbility();
  }, []);

  const handleFocusAppendage = useCallback((slot: AppendageSlot) => {
    simControllerRef.current?.focusBossAppendage(slot);
  }, []);

  const handleSummonBossNow = useCallback(() => {
    simControllerRef.current?.summonBossNow();
  }, []);

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-[#030812] select-none">
      {/* Isolated 60fps Three.js WebGL Container */}
      <AbyssalCanvas
        mode={hud.mode}
        cameraMode={cameraMode}
        controlScheme={controlScheme}
        selectedStage={selectedStage}
        onHudUpdate={handleHudUpdate}
        onLockTargetsUpdate={handleLockTargetsUpdate}
        onToggleCamera={handleToggleCamera}
        onToggleDock={handleToggleDock}
        onRegisterController={handleRegisterController}
      />

      {/* Low-Occlusion World-Matched DOM HUD & Game Shell Modals */}
      <HudOverlay
        hud={hud}
        selectedStage={selectedStage}
        selectedMissionId={selectedMissionId}
        cameraMode={cameraMode}
        controlScheme={controlScheme}
        isMuted={isMuted}
        dockCollapsed={dockCollapsed}
        lockTargets={lockTargets}
        reticlePos={reticlePos}
        onSelectStage={handleSelectStage}
        onStartGame={handleStartGame}
        onStartMission={handleStartMission}
        onOpenBriefing={handleOpenBriefing}
        onSetMode={handleSetMode}
        onOpenMarket={handleOpenMarket}
        onBuyOrToggleUpgrade={handleBuyOrToggleUpgrade}
        onUpgradeModuleTier={handleUpgradeModuleTier}
        onRefundAllUpgrades={handleRefundAllUpgrades}
        onClaimSupplyGrant={handleClaimSupplyGrant}
        onExchangeCreditsForCore={handleExchangeCreditsForCore}
        onSelectShip={handleSelectShip}
        onBuyShip={handleBuyShip}
        onSelectWeapon={handleSelectWeapon}
        onBuyWeapon={handleBuyWeapon}
        onSelectCosmetic={handleSelectCosmetic}
        onPreviewShip={handlePreviewShip}
        onSetDifficulty={handleSetDifficulty}
        onClaimDaily={handleClaimDaily}
        onClaimAchievement={handleClaimAchievement}
        onUpdateCallsign={handleUpdateCallsign}
        onUpdateSettings={handleUpdateSettings}
        onResetSaveData={handleResetSaveData}
        onTouchMove={handleTouchMove}
        onTouchFireChange={handleTouchFireChange}
        onResumeGame={handleResumeGame}
        onPauseGame={handlePauseGame}
        onReturnToTitle={handleReturnToTitle}
        onToggleCamera={handleToggleCamera}
        onToggleControlScheme={handleToggleControlScheme}
        onToggleMute={handleToggleMute}
        onToggleDock={handleToggleDock}
        onTriggerBarrelRoll={handleTriggerBarrelRoll}
        onTriggerTorpedoSalvo={handleTriggerTorpedoSalvo}
        onTriggerTacticalSonar={handleTriggerTacticalSonar}
        onTriggerShipAbility={handleTriggerShipAbility}
        onFocusAppendage={handleFocusAppendage}
        onSummonBossNow={handleSummonBossNow}
      />
    </main>
  );
}
