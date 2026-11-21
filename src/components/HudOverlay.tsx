import React, { useState } from 'react';
import {
  Camera,
  Compass,
  Crosshair,
  Flame,
  Gauge,
  Pause,
  Play,
  Plus,
  Settings,
  Shield,
  ShoppingBag,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  Wrench,
  Zap,
} from 'lucide-react';
import {
  AppendageSlot,
  CameraMode,
  ControlScheme,
  CosmeticId,
  DifficultyId,
  GameSettings,
  GameStateMode,
  HudSnapshot,
  MissionDefinition,
  PrimaryWeaponId,
  ScreenLockTarget,
  SecondaryWeaponId,
  ShipClassId,
  StageId,
  UpgradeId,
  WeaponId,
} from '../game/types';
import {
  MISSION_CATALOG,
  SHIP_CATALOG,
  STAGE_CONFIGS,
  WEAPON_CATALOG,
} from '../game/stages';
import {
  calculateFleetPower,
  getRecommendedNextMissionId,
  getUnclaimedRewardsCount,
  getXpForNextLevel,
} from '../game/saveManager';
import { AbyssalMarket } from './AbyssalMarket';
import { HangarView } from './HangarView';
import {
  MissionSelectModal,
  ObjectivesModal,
  PilotProfileModal,
  SettingsModal,
} from './HubModals';
import { TouchControlsOverlay } from './TouchControlsOverlay';

interface HudOverlayProps {
  hud: HudSnapshot;
  selectedStage: StageId;
  selectedMissionId: string;
  cameraMode: CameraMode;
  controlScheme: ControlScheme;
  isMuted: boolean;
  dockCollapsed: boolean;
  lockTargets: ScreenLockTarget[];
  reticlePos: { x: number; y: number };
  onSelectStage: (stageId: StageId) => void;
  onStartGame: (stageId: StageId, resetCampaign: boolean) => void;
  onStartMission: (missionId: string) => void;
  onOpenBriefing: (missionId: string) => void;
  onSetMode: (mode: GameStateMode) => void;
  onOpenMarket: () => void;
  onBuyOrToggleUpgrade: (upgradeId: UpgradeId) => void;
  onUpgradeModuleTier: (upgradeId: UpgradeId) => void;
  onRefundAllUpgrades: () => void;
  onClaimSupplyGrant: () => void;
  onExchangeCreditsForCore: () => void;
  onSelectShip: (shipId: ShipClassId) => void;
  onBuyShip: (shipId: ShipClassId) => void;
  onSelectWeapon: (weaponId: WeaponId) => void;
  onBuyWeapon: (weaponId: WeaponId) => void;
  onSelectCosmetic: (cosmeticId: CosmeticId) => void;
  onPreviewShip: (shipId: ShipClassId, cosmeticId?: CosmeticId) => void;
  onSetDifficulty: (diff: DifficultyId) => void;
  onClaimDaily: (dailyId: string) => void;
  onClaimAchievement: (achId: string) => void;
  onUpdateCallsign: (callsign: string) => void;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  onResetSaveData: () => void;
  onTouchMove: (x: number, y: number) => void;
  onTouchFireChange: (firing: boolean) => void;
  onResumeGame: () => void;
  onPauseGame: () => void;
  onReturnToTitle: () => void;
  onToggleCamera: () => void;
  onToggleControlScheme: () => void;
  onToggleMute: () => void;
  onToggleDock: () => void;
  onTriggerBarrelRoll: () => void;
  onTriggerTorpedoSalvo: () => void;
  onTriggerTacticalSonar: () => void;
  onTriggerShipAbility: () => void;
  onFocusAppendage: (slot: AppendageSlot) => void;
  onSummonBossNow: () => void;
}

type HubModalType =
  | 'none'
  | 'hangar'
  | 'market'
  | 'missions'
  | 'objectives'
  | 'profile'
  | 'settings';

export const HudOverlay: React.FC<HudOverlayProps> = ({
  hud,
  selectedStage,
  selectedMissionId,
  cameraMode,
  isMuted,
  lockTargets,
  reticlePos,
  onSelectStage,
  onStartMission,
  onSetMode,
  onBuyOrToggleUpgrade,
  onUpgradeModuleTier,
  onRefundAllUpgrades,
  onClaimSupplyGrant,
  onExchangeCreditsForCore,
  onSelectShip,
  onBuyShip,
  onSelectWeapon,
  onBuyWeapon,
  onSelectCosmetic,
  onPreviewShip,
  onSetDifficulty,
  onClaimDaily,
  onClaimAchievement,
  onUpdateCallsign,
  onUpdateSettings,
  onResetSaveData,
  onTouchMove,
  onTouchFireChange,
  onResumeGame,
  onPauseGame,
  onReturnToTitle,
  onToggleCamera,
  onToggleMute,
  onTriggerBarrelRoll,
  onTriggerTorpedoSalvo,
  onTriggerTacticalSonar,
  onTriggerShipAbility,
  onFocusAppendage,
}) => {
  const [activeModal, setActiveModal] = useState<HubModalType>('none');
  const [localMissionId, setLocalMissionId] = useState<string>(selectedMissionId);
  const [launchingMission, setLaunchingMission] = useState<MissionDefinition | null>(
    null,
  );

  const hullPct = Math.max(
    0,
    Math.min(100, (hud.hull / Math.max(1, hud.maxHull)) * 100),
  );
  const shieldPct = Math.max(
    0,
    Math.min(100, (hud.shield / Math.max(1, hud.maxShield)) * 100),
  );
  const boostPct = Math.max(
    0,
    Math.min(100, (hud.boost / Math.max(1, hud.maxBoost)) * 100),
  );
  const bossPct = hud.bossActive
    ? Math.max(0, Math.min(100, (hud.bossHp / Math.max(1, hud.bossMaxHp)) * 100))
    : 0;

  const save = hud.saveData;
  const unclaimedCount = getUnclaimedRewardsCount(save);
  const recommendedMissionId = getRecommendedNextMissionId(save);
  const activeMission =
    MISSION_CATALOG.find((m) => m.id === localMissionId) ||
    MISSION_CATALOG.find((m) => m.id === hud.missionId) ||
    MISSION_CATALOG.find((m) => m.id === recommendedMissionId) ||
    MISSION_CATALOG[1];
  const activeShip =
    SHIP_CATALOG.find((s) => s.id === save.selectedShip) || SHIP_CATALOG[0];
  const equippedPrimary =
    WEAPON_CATALOG.find((w) => w.id === save.equippedPrimaryWeapon) ||
    WEAPON_CATALOG[0];
  const equippedSecondary =
    WEAPON_CATALOG.find((w) => w.id === save.equippedSecondaryWeapon) ||
    WEAPON_CATALOG[3];
  const fleetPower = calculateFleetPower(save);
  const nextLevelXp = getXpForNextLevel(save.pilotLevel);
  const xpPct = Math.min(
    100,
    Math.round((save.pilotXp / Math.max(1, nextLevelXp)) * 100),
  );

  const effectiveModal: HubModalType =
    activeModal !== 'none'
      ? activeModal
      : hud.mode === 'market'
        ? 'market'
        : hud.mode === 'hangar'
          ? 'hangar'
          : hud.mode === 'campaign_map' || hud.mode === 'briefing'
            ? 'missions'
            : hud.mode === 'rewards'
              ? 'objectives'
              : hud.mode === 'profile'
                ? 'profile'
                : hud.mode === 'settings'
                  ? 'settings'
                  : 'none';

  const openHubSection = (modal: HubModalType) => {
    setActiveModal(modal);
    if (hud.mode !== 'playing' && hud.mode !== 'paused') {
      const modeMap: Record<HubModalType, GameStateMode> = {
        none: 'title',
        hangar: 'hangar',
        market: 'market',
        missions: 'campaign_map',
        objectives: 'rewards',
        profile: 'profile',
        settings: 'settings',
      };
      onSetMode(modeMap[modal]);
    }
  };

  const closeModal = () => {
    setActiveModal('none');
    onPreviewShip(save.selectedShip, save.equippedCosmetic);
    if (
      hud.mode === 'market' ||
      hud.mode === 'hangar' ||
      hud.mode === 'campaign_map' ||
      hud.mode === 'briefing' ||
      hud.mode === 'rewards' ||
      hud.mode === 'profile' ||
      hud.mode === 'settings'
    ) {
      onSetMode('title');
    }
  };

  const handleLaunchWithTransition = (missionId: string) => {
    const targetMission =
      MISSION_CATALOG.find((m) => m.id === missionId) || activeMission;
    closeModal();
    if (save.settings.reducedMotion) {
      onStartMission(missionId);
      return;
    }
    window.dispatchEvent(
      new CustomEvent('pelagic-hangar-camera', {
        detail: { action: 'testThrusters' },
      }),
    );
    setLaunchingMission(targetMission);
    window.setTimeout(() => {
      setLaunchingMission(null);
      onStartMission(missionId);
    }, 340);
  };

  const handleToggleAutoFire = () => {
    onUpdateSettings({ autoFire: !save.settings.autoFire });
  };

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-20 flex flex-col justify-between select-none overflow-hidden ${
        save.settings.reducedMotion ? 'reduced-motion' : ''
      }`}
    >
      {/* Mission Launch Undocking Flash */}
      {launchingMission && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm animate-panel-fade px-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-950/90 ring-1 ring-cyan-400/50 px-6 py-5 text-center shadow-[0_0_60px_rgba(34,211,238,0.35)]">
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-cyan-300">
              Hydro-Thrusters Ignited
            </div>
            <div className="mt-1 font-display text-2xl font-bold text-white">
              {launchingMission.title}
            </div>
            <div className="mt-1 text-xs text-slate-300">
              {STAGE_CONFIGS[launchingMission.stageId].title} · {activeShip.name}
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Abyssal Depth & Overpressure Edge Vignette */}
      <div
        className="pointer-events-none fixed inset-0 transition-opacity duration-500"
        style={{
          background:
            hud.mode === 'playing' && hud.inDeepPressureZone
              ? `radial-gradient(circle at center, transparent 48%, rgba(244, 63, 94, ${
                  0.14 + (hud.hullStress / 100) * 0.24
                }) 86%, rgba(2, 6, 23, 0.9) 100%)`
              : hud.mode === 'playing'
                ? `radial-gradient(circle at center, transparent 58%, ${hud.ambientColorHex}10 85%, rgba(2, 6, 23, 0.65) 100%)`
                : `radial-gradient(circle at 50% 42%, transparent 42%, rgba(2, 6, 23, 0.78) 100%)`,
        }}
      />

      {/* =====================================================================
       * 1. MOBILE GAME IN-FLIGHT VISOR COMBAT HUD (mode === 'playing')
       * ==================================================================== */}
      {hud.mode === 'playing' && (
        <>
          {/* Projected 3D Screen Lock Brackets */}
          {lockTargets.map((target) => {
            if (!target.visible) return null;
            return (
              <div
                key={target.id}
                style={{
                  left: `${target.x}px`,
                  top: `${target.y}px`,
                }}
                className="pointer-events-none fixed -translate-x-1/2 -translate-y-1/2"
              >
                <div
                  className={`relative h-9 w-9 transition-transform duration-75 ${
                    target.locked
                      ? 'scale-110'
                      : target.isWeakPointScanned || target.isHazardScanned
                        ? 'scale-105'
                        : ''
                  }`}
                >
                  <span
                    className={`absolute top-0 left-0 h-2.5 w-2.5 border-t-2 border-l-2 ${
                      target.locked
                        ? 'border-amber-400'
                        : target.isWeakPointScanned || target.isHazardScanned
                          ? 'border-emerald-400'
                          : target.isTelegraphing
                            ? 'border-rose-400'
                            : 'border-cyan-400/60'
                    }`}
                  />
                  <span
                    className={`absolute top-0 right-0 h-2.5 w-2.5 border-t-2 border-r-2 ${
                      target.locked
                        ? 'border-amber-400'
                        : target.isWeakPointScanned || target.isHazardScanned
                          ? 'border-emerald-400'
                          : target.isTelegraphing
                            ? 'border-rose-400'
                            : 'border-cyan-400/60'
                    }`}
                  />
                  <span
                    className={`absolute bottom-0 left-0 h-2.5 w-2.5 border-b-2 border-l-2 ${
                      target.locked
                        ? 'border-amber-400'
                        : target.isWeakPointScanned || target.isHazardScanned
                          ? 'border-emerald-400'
                          : target.isTelegraphing
                            ? 'border-rose-400'
                            : 'border-cyan-400/60'
                    }`}
                  />
                  <span
                    className={`absolute bottom-0 right-0 h-2.5 w-2.5 border-b-2 border-r-2 ${
                      target.locked
                        ? 'border-amber-400'
                        : target.isWeakPointScanned || target.isHazardScanned
                          ? 'border-emerald-400'
                          : target.isTelegraphing
                            ? 'border-rose-400'
                            : 'border-cyan-400/60'
                    }`}
                  />
                  <div className="-top-4 left-1/2 -translate-x-1/2 absolute whitespace-nowrap text-[10px] font-medium tracking-wide text-cyan-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] tabular-nums">
                    {target.label} · {Math.round(target.hpRatio * 100)}%
                  </div>
                </div>
              </div>
            );
          })}

          {/* Precision Aiming Reticle & Hit Confirmation Ticks */}
          <div
            className="pointer-events-none fixed z-30 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${reticlePos.x}px`,
              top: `${reticlePos.y}px`,
            }}
          >
            <div className="relative flex items-center justify-center">
              {/* Outer Dynamic Reticle Ring */}
              <div
                className={`h-11 w-11 rounded-full border transition-all duration-75 ${
                  hud.reticleState === 'locked_weakpoint'
                    ? 'border-fuchsia-400/95 scale-90 shadow-[0_0_12px_rgba(232,121,249,0.55)]'
                    : hud.reticleState === 'locked_enemy'
                      ? 'border-rose-400/95 scale-95 shadow-[0_0_10px_rgba(251,113,133,0.5)]'
                      : hud.reticleState === 'target_aligned'
                        ? 'border-amber-300/95 scale-95 shadow-[0_0_10px_rgba(252,211,77,0.45)]'
                        : hud.reticleState === 'target_lost'
                          ? 'border-dashed border-amber-500/80 scale-110 opacity-75'
                          : hud.sonarActive
                            ? 'border-emerald-400/90 scale-105'
                            : 'border-cyan-400/75'
                }`}
              />

              {/* Crosshair Cardinal Ticks */}
              <div
                className={`absolute -top-2 h-2 w-0.5 ${
                  hud.reticleState === 'locked_weakpoint'
                    ? 'bg-fuchsia-300'
                    : hud.reticleState === 'locked_enemy'
                      ? 'bg-rose-400'
                      : hud.reticleState === 'target_aligned'
                        ? 'bg-amber-300'
                        : 'bg-cyan-300/80'
                }`}
              />
              <div
                className={`absolute -bottom-2 h-2 w-0.5 ${
                  hud.reticleState === 'locked_weakpoint'
                    ? 'bg-fuchsia-300'
                    : hud.reticleState === 'locked_enemy'
                      ? 'bg-rose-400'
                      : hud.reticleState === 'target_aligned'
                        ? 'bg-amber-300'
                        : 'bg-cyan-300/80'
                }`}
              />
              <div
                className={`absolute -left-2 h-0.5 w-2 ${
                  hud.reticleState === 'locked_weakpoint'
                    ? 'bg-fuchsia-300'
                    : hud.reticleState === 'locked_enemy'
                      ? 'bg-rose-400'
                      : hud.reticleState === 'target_aligned'
                        ? 'bg-amber-300'
                        : 'bg-cyan-300/80'
                }`}
              />
              <div
                className={`absolute -right-2 h-0.5 w-2 ${
                  hud.reticleState === 'locked_weakpoint'
                    ? 'bg-fuchsia-300'
                    : hud.reticleState === 'locked_enemy'
                      ? 'bg-rose-400'
                      : hud.reticleState === 'target_aligned'
                        ? 'bg-amber-300'
                        : 'bg-cyan-300/80'
                }`}
              />

              {/* Non-occluding Diagonal Hit Confirmation Ticks */}
              {hud.hitConfirmType !== 'none' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className={`h-8 w-8 rotate-45 border-2 transition-transform duration-75 ${
                      hud.hitConfirmType === 'kill'
                        ? 'border-rose-500 scale-125 shadow-[0_0_12px_rgba(244,63,94,0.8)]'
                        : hud.hitConfirmType === 'appendage_sever'
                          ? 'border-fuchsia-400 scale-125 shadow-[0_0_12px_rgba(232,121,249,0.85)]'
                          : hud.hitConfirmType === 'crit'
                            ? 'border-amber-300 scale-110 shadow-[0_0_10px_rgba(252,211,77,0.75)]'
                            : hud.hitConfirmType === 'armor'
                              ? 'border-slate-300/90 scale-95'
                              : 'border-cyan-200 scale-100'
                    }`}
                  />
                </div>
              )}

              {/* Authoritative Center Convergence Dot */}
              <div
                className={`absolute h-1.5 w-1.5 rounded-full ${
                  hud.reticleState === 'locked_weakpoint'
                    ? 'bg-fuchsia-300'
                    : hud.reticleState === 'locked_enemy'
                      ? 'bg-rose-400'
                      : hud.reticleState === 'target_aligned'
                        ? 'bg-amber-300'
                        : 'bg-cyan-300'
                }`}
              />

              {/* Target Lock / Hit Status Micro Readout */}
              {(hud.activeAimTargetLabel ||
                hud.reticleState === 'target_lost' ||
                hud.hitConfirmType === 'armor' ||
                hud.hitConfirmType === 'crit' ||
                hud.hitConfirmType === 'kill' ||
                hud.hitConfirmType === 'appendage_sever') && (
                <div className="absolute top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-slate-950/75 text-cyan-100 drop-shadow">
                  {hud.hitConfirmType === 'appendage_sever'
                    ? 'APPENDAGE SEVERED'
                    : hud.hitConfirmType === 'kill'
                      ? 'TARGET ELIMINATED'
                      : hud.hitConfirmType === 'crit'
                        ? 'WEAKPOINT CRIT'
                        : hud.hitConfirmType === 'armor'
                          ? 'ARMOR DEFLECT'
                          : hud.reticleState === 'target_lost'
                            ? 'LOCK LOST'
                            : hud.activeAimTargetLabel}
                </div>
              )}
            </div>
          </div>

          {/* Mobile Top Visor Header */}
          <header className="relative z-10 flex flex-col gap-2 bg-gradient-to-b from-slate-950/90 via-slate-950/45 to-transparent px-3 sm:px-5 pt-2.5 pb-4 pt-safe px-safe">
            <div className="flex items-start justify-between gap-2 sm:gap-4">
              {/* Left: Mission, Phase, Wave, Hostiles & Objective */}
              <div className="space-y-0.5 min-w-0 max-w-[58%] sm:max-w-lg">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] sm:text-xs text-cyan-300 font-medium">
                  <span className="font-display text-xs sm:text-sm font-semibold text-white tracking-tight truncate">
                    {hud.missionTitle}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums text-cyan-200 font-semibold shrink-0">
                    Phase {hud.missionPhase}/{hud.missionTotalPhases}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums text-slate-200 shrink-0">
                    Wave {hud.currentWaveIndex}/{hud.totalWavesCount}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums text-rose-300 font-semibold shrink-0">
                    Hostiles: {hud.remainingMissionEnemies}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums text-slate-300 shrink-0">
                    {Math.floor(hud.stageElapsedSeconds / 60)}:
                    {String(hud.stageElapsedSeconds % 60).padStart(2, '0')}
                  </span>
                  {save.settings.aimDebugEnabled && (
                    <button
                      onClick={() =>
                        onUpdateSettings({
                          aimDebugEnabled: !save.settings.aimDebugEnabled,
                        })
                      }
                      className="pointer-events-auto ml-1 rounded bg-emerald-500/25 px-1.5 py-0.2 text-[9px] font-bold uppercase text-emerald-300 ring-1 ring-emerald-400/50 cursor-pointer"
                    >
                      3D AIM DEBUG ON
                    </button>
                  )}
                </div>
                <div className="text-[11px] sm:text-xs text-slate-200 font-medium drop-shadow truncate">
                  <span className="text-cyan-300/90 font-semibold mr-1.5">
                    [{hud.missionPhaseLabel}]
                  </span>
                  {hud.flightSchoolStepText || hud.primaryObjectiveText}
                  {hud.objectiveProgressTarget > 1 && (
                    <span className="ml-1 text-cyan-300 font-semibold tabular-nums">
                      ({hud.objectiveProgressCurrent}/{hud.objectiveProgressTarget})
                    </span>
                  )}
                </div>
                {hud.objectiveType === 'protect_beacon' && (
                  <div className="text-[11px] text-amber-300 tabular-nums">
                    Beacon: {hud.beaconIntegrityPct}%
                  </div>
                )}
              </div>

              {/* Right: Score, Multiplier & Mobile Controls */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                <div className="text-right tabular-nums mr-0.5">
                  <div className="font-display text-sm sm:text-lg font-bold text-white leading-none">
                    {hud.score.toLocaleString()}
                  </div>
                  <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] sm:text-[11px] text-slate-300">
                    <span className="text-emerald-400 font-semibold">
                      {hud.multiplier.toFixed(1)}x
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-300">
                      {hud.salvageCredits.toLocaleString()} CR
                    </span>
                  </div>
                </div>

                {!save.settings.touchControlsEnabled && (
                  <button
                    onClick={onTriggerShipAbility}
                    aria-label={`Activate ${hud.activeAbilityName}`}
                    className={`pointer-events-auto min-h-[40px] flex items-center gap-1.5 rounded-full px-3 text-xs font-bold transition cursor-pointer tabular-nums ${
                      hud.activeAbilityActive
                        ? 'bg-fuchsia-500/35 text-white ring-1 ring-fuchsia-300'
                        : hud.activeAbilityCooldown > 0
                          ? 'bg-slate-900/80 text-slate-400 ring-1 ring-white/10'
                          : 'bg-fuchsia-500/20 text-fuchsia-200 ring-1 ring-fuchsia-400/55 hover:bg-fuchsia-500/30'
                    }`}
                  >
                    <Flame className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden md:inline max-w-[130px] truncate">
                      [R] {hud.activeAbilityName}
                    </span>
                    {(hud.activeAbilityActive ||
                      hud.activeAbilityCooldown > 0) && (
                      <span>
                        {hud.activeAbilityActive
                          ? `${hud.activeAbilityRemainingSeconds.toFixed(1)}s`
                          : `${hud.activeAbilityCooldownSeconds}s`}
                      </span>
                    )}
                  </button>
                )}

                <button
                  onClick={handleToggleAutoFire}
                  aria-label="Toggle Auto-Fire"
                  className={`pointer-events-auto min-h-[40px] min-w-[40px] flex items-center justify-center gap-1 rounded-full px-2.5 text-[11px] font-bold transition active:scale-95 cursor-pointer ${
                    save.settings.autoFire
                      ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/55'
                      : 'bg-slate-900/80 text-slate-300 ring-1 ring-white/15'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">
                    {save.settings.autoFire ? 'Auto' : 'Manual'}
                  </span>
                </button>

                <button
                  onClick={onToggleCamera}
                  aria-label="Toggle Camera View"
                  className="pointer-events-auto min-h-[40px] min-w-[40px] flex items-center justify-center gap-1 rounded-full bg-slate-900/80 ring-1 ring-white/15 px-2.5 text-[11px] font-semibold text-slate-200 transition active:scale-95 cursor-pointer"
                >
                  <Camera className="h-3.5 w-3.5 text-cyan-300 shrink-0" />
                  <span className="hidden md:inline">
                    {cameraMode === 'chase' ? 'Chase' : 'Cockpit'}
                  </span>
                </button>

                <button
                  onClick={onPauseGame}
                  aria-label="Pause Mission"
                  className="pointer-events-auto min-h-[40px] min-w-[40px] flex items-center justify-center gap-1 rounded-full bg-slate-900/88 hover:bg-slate-800/90 ring-1 ring-white/20 px-3 text-xs font-semibold text-white transition active:scale-95 cursor-pointer"
                >
                  <Pause className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">Pause</span>
                </button>
              </div>
            </div>

            {/* Compact Telemetry Strip (Hull, Shield, Boost/Stress, Ordnance) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
              <div className="rounded-xl bg-slate-950/70 px-2.5 py-1.5 ring-1 ring-white/10">
                <div className="flex items-center justify-between text-[10px] font-medium">
                  <span className="text-emerald-300 flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Hull
                  </span>
                  <span className="tabular-nums text-white font-semibold">
                    {hud.hull}/{hud.maxHull}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
                  <div
                    className={`h-full transition-all duration-150 ${
                      hullPct > 50
                        ? 'bg-emerald-400'
                        : hullPct > 25
                          ? 'bg-amber-400'
                          : 'bg-rose-500'
                    }`}
                    style={{ width: `${hullPct}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-slate-950/70 px-2.5 py-1.5 ring-1 ring-white/10">
                <div className="flex items-center justify-between text-[10px] font-medium">
                  <span className="text-cyan-300 flex items-center gap-1">
                    <Crosshair className="h-3 w-3" /> Shield
                  </span>
                  <span className="tabular-nums text-cyan-200 font-semibold">
                    {hud.shield}/{hud.maxShield}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-150"
                    style={{ width: `${shieldPct}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-slate-950/70 px-2.5 py-1.5 ring-1 ring-white/10">
                <div className="flex items-center justify-between text-[10px] font-medium">
                  <span className="text-sky-300 flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Boost
                  </span>
                  <span className="tabular-nums text-sky-200 font-semibold flex items-center gap-1">
                    <span>{Math.round(boostPct)}%</span>
                    <span className="text-amber-300 flex items-center gap-0.5">
                      <Gauge className="h-2.5 w-2.5" />
                      {hud.hullStress}%
                    </span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
                  <div
                    className="h-full bg-sky-400 transition-all duration-150"
                    style={{ width: `${boostPct}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-slate-950/70 px-2.5 py-1.5 ring-1 ring-white/10 flex flex-col justify-center">
                <div className="flex items-center justify-between text-[10px] tabular-nums">
                  <span className="text-slate-300 truncate">
                    Locks:{' '}
                    <strong className="text-amber-300">
                      {hud.lockedCount}/{hud.maxLocks}
                    </strong>
                  </span>
                  <span className="text-slate-300 truncate">
                    Sonar:{' '}
                    <strong className="text-emerald-300">
                      {hud.sonarActive
                        ? `${hud.sonarRemainingSeconds.toFixed(1)}s`
                        : hud.sonarCooldown > 0
                          ? `${Math.ceil(hud.sonarCooldown * 7.5)}s`
                          : 'Ready'}
                    </strong>
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5 tabular-nums">
                  {equippedPrimary.name} · {equippedSecondary.name}
                  {hud.activeDronesCount > 0 && (
                    <span className="text-emerald-300 font-semibold">
                      {' '}
                      · {hud.activeDronesCount} Drones
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Leviathan Boss Visor Bar + Tappable Weak-Point Buttons */}
            {hud.bossActive && (
              <div className="w-full max-w-xl mx-auto pt-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-xs sm:text-base font-bold tracking-tight text-white truncate">
                    {hud.bossName}
                  </h2>
                  <div className="text-[11px] font-medium text-rose-200 tabular-nums shrink-0">
                    Phase {hud.bossPhase}/3 · {hud.bossHp.toLocaleString()} HP
                  </div>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-900/90">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-rose-400 transition-all duration-150"
                    style={{ width: `${bossPct}%` }}
                  />
                </div>
                <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                  {hud.bossAppendages.map((part) => {
                    const pct = Math.max(
                      0,
                      Math.min(
                        100,
                        Math.round((part.hp / Math.max(1, part.maxHp)) * 100),
                      ),
                    );
                    return (
                      <button
                        key={part.id}
                        onClick={() =>
                          !part.destroyed && onFocusAppendage(part.slot)
                        }
                        disabled={part.destroyed}
                        className={`pointer-events-auto min-h-[44px] flex flex-col justify-between rounded-xl px-2 py-1.5 text-left transition cursor-pointer ${
                          part.destroyed
                            ? 'bg-slate-950/40 opacity-40'
                            : part.isSonarWeakPoint
                              ? 'bg-emerald-950/65 ring-1 ring-emerald-400/70'
                              : 'bg-slate-950/70 ring-1 ring-white/10 active:scale-95'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-medium gap-1">
                          <span className="capitalize text-slate-200 truncate">
                            {part.slot}
                          </span>
                          <span
                            className={`tabular-nums shrink-0 ${
                              part.destroyed
                                ? 'text-rose-400'
                                : part.isSonarWeakPoint
                                  ? 'text-emerald-300 font-semibold'
                                  : 'text-cyan-300'
                            }`}
                          >
                            {part.destroyed ? 'Cut' : `${pct}%`}
                          </span>
                        </div>
                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={`h-full transition-all ${
                              part.destroyed
                                ? 'bg-rose-500'
                                : part.isSonarWeakPoint
                                  ? 'bg-emerald-400'
                                  : 'bg-cyan-400'
                            }`}
                            style={{ width: `${part.destroyed ? 0 : pct}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
                {hud.bossTelegraphText && (
                  <div className="mt-1 text-center text-[11px] font-semibold text-amber-300 drop-shadow">
                    {hud.bossTelegraphText}
                  </div>
                )}
              </div>
            )}
          </header>

          {/* Center Peripheral Warnings */}
          <div className="pointer-events-none my-auto flex flex-col items-center justify-end pb-10 gap-1.5 px-4">
            {hud.pressureZoneLabel && (
              <div className="rounded-full bg-rose-950/85 ring-1 ring-rose-400/50 px-4 py-1 text-xs font-medium text-rose-200 shadow-lg">
                {hud.pressureZoneLabel}
              </div>
            )}
            {hud.hazardWarningText && !hud.bossTelegraphText && (
              <div className="rounded-full bg-amber-950/85 ring-1 ring-amber-400/50 px-4 py-1 text-xs font-medium text-amber-200 shadow-lg">
                {hud.hazardWarningText}
              </div>
            )}
          </div>
        </>
      )}

      {/* Dual-Thumb Mobile Touch Controls */}
      <TouchControlsOverlay
        hud={hud}
        settings={save.settings}
        cameraMode={cameraMode}
        onTouchMove={onTouchMove}
        onTouchFire={onTouchFireChange}
        onToggleAutoFire={handleToggleAutoFire}
        onToggleCamera={onToggleCamera}
        onTriggerBarrelRoll={onTriggerBarrelRoll}
        onTriggerTorpedoSalvo={onTriggerTorpedoSalvo}
        onTriggerTacticalSonar={onTriggerTacticalSonar}
        onTriggerShipAbility={onTriggerShipAbility}
      />

      {/* =====================================================================
       * 2. MOBILE-NATIVE HOME BERTH LOBBY (mode === 'title')
       * ==================================================================== */}
      {hud.mode === 'title' && effectiveModal === 'none' && (
        <>
          {/* Slim Mobile Game Top Status Bar */}
          <header className="pointer-events-auto relative z-30 flex items-center justify-between gap-2 bg-gradient-to-b from-slate-950/90 via-slate-950/55 to-transparent px-3 sm:px-5 py-2 pt-safe px-safe">
            {/* Left: Pilot Badge -> Opens Profile */}
            <button
              onClick={() => openHubSection('profile')}
              className="group min-h-[44px] flex items-center gap-2 rounded-2xl bg-slate-950/75 ring-1 ring-white/15 px-2.5 py-1.5 text-left transition active:scale-95 cursor-pointer"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 ring-1 ring-cyan-400/45 font-display text-xs font-bold text-cyan-300 shrink-0">
                {save.pilotLevel}
              </div>
              <div className="min-w-0 pr-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-xs font-bold text-white truncate max-w-[96px] sm:max-w-[140px]">
                    {save.callsign}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-300 tabular-nums hidden sm:inline">
                    · {fleetPower} PWR
                  </span>
                </div>
                <div className="mt-1 h-1 w-16 sm:w-20 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-cyan-400"
                    style={{ width: `${xpPct}%` }}
                  />
                </div>
              </div>
            </button>

            {/* Right: Currency Counters + Mute + Settings */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => openHubSection('market')}
                className="min-h-[44px] flex items-center gap-1.5 rounded-2xl bg-slate-950/75 ring-1 ring-white/15 px-2.5 py-1.5 tabular-nums transition active:scale-95 cursor-pointer"
              >
                <span className="font-mono text-xs font-bold text-amber-300">
                  {hud.salvageCredits.toLocaleString()}
                </span>
                <span className="text-[10px] text-amber-200/80">CR</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-400/20 text-amber-300">
                  <Plus className="h-3 w-3" />
                </span>
              </button>

              <div className="hidden xs:flex min-h-[44px] items-center gap-1 rounded-2xl bg-slate-950/75 ring-1 ring-white/15 px-2.5 py-1.5 tabular-nums">
                <span className="font-mono text-xs font-bold text-fuchsia-300">
                  {hud.abyssalMaterials}
                </span>
                <span className="text-[10px] text-fuchsia-200/80">AL</span>
              </div>

              <button
                onClick={onToggleMute}
                aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl bg-slate-950/75 ring-1 ring-white/15 transition active:scale-95 cursor-pointer"
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4 text-rose-400" />
                ) : (
                  <Volume2 className="h-4 w-4 text-cyan-300" />
                )}
              </button>

              <button
                onClick={() => openHubSection('settings')}
                aria-label="Settings"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl bg-slate-950/75 ring-1 ring-white/15 text-slate-200 transition active:scale-95 cursor-pointer"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Center Open 3D Berth Stage */}
          <div className="relative z-10 flex-1 flex flex-col justify-between px-3 sm:px-6 pt-1 pb-2 pointer-events-none">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="font-display text-xl sm:text-3xl font-bold tracking-tight text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)]">
                  Pelagic Vanguard
                </h1>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs text-slate-300">
                  <span
                    className="font-semibold"
                    style={{ color: activeShip.accentColor }}
                  >
                    {activeShip.name}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{activeShip.roleTitle}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-300 font-medium">
                    {activeShip.rarity}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-emerald-300 tabular-nums">
                    {fleetPower} PWR
                  </span>
                </div>
              </div>
              <div className="rounded-xl bg-slate-950/55 ring-1 ring-white/10 px-2.5 py-1 text-[10px] text-cyan-200/80">
                Drag to Orbit · Pinch Zoom
              </div>
            </div>

            {/* Bottom Lobby Mission Quick Card */}
            <div className="pointer-events-auto w-full max-w-2xl mx-auto rounded-3xl bg-slate-950/88 ring-1 ring-white/15 p-3 sm:p-4 backdrop-blur-xl shadow-[0_18px_50px_rgba(0,0,0,0.75)] space-y-2.5">
              {/* Sector Chips + Quick Ship Stats */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {([1, 2, 3] as StageId[]).map((stId) => {
                    const selected = selectedStage === stId;
                    return (
                      <button
                        key={stId}
                        onClick={() => {
                          onSelectStage(stId);
                          const m = MISSION_CATALOG.find(
                            (item) =>
                              item.category === 'campaign' &&
                              item.stageId === stId,
                          );
                          if (m) setLocalMissionId(m.id);
                        }}
                        className={`min-h-[38px] rounded-xl px-3 py-1 text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                          selected
                            ? 'bg-cyan-400 text-slate-950'
                            : 'bg-white/5 text-slate-300'
                        }`}
                      >
                        Sector {stId}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2.5 font-mono text-[11px] text-slate-300 tabular-nums shrink-0">
                  <span>
                    <strong className="text-emerald-300">
                      {activeShip.baseHull}
                    </strong>{' '}
                    HP
                  </span>
                  <span>
                    <strong className="text-cyan-300">
                      {activeShip.baseShield}
                    </strong>{' '}
                    SP
                  </span>
                  <span>
                    <strong className="text-amber-300">
                      {activeShip.baseTorpedoLocks}
                    </strong>{' '}
                    Locks
                  </span>
                </div>
              </div>

              {/* Active Mission Row + Big Play Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <button
                  onClick={() => openHubSection('missions')}
                  className="min-w-0 text-left flex-1 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] px-3 py-2 transition cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-cyan-300">
                    <span>{STAGE_CONFIGS[activeMission.stageId].title}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-300 truncate">
                      {activeMission.hasBossFinale
                        ? `Boss: ${STAGE_CONFIGS[activeMission.stageId].bossName}`
                        : 'Tap to switch mission'}
                    </span>
                  </div>
                  <div className="font-display text-base sm:text-lg font-bold text-white truncate">
                    {activeMission.title}
                  </div>
                  <div className="text-[11px] text-slate-300 truncate">
                    {activeMission.primaryObjectiveText}
                  </div>
                </button>

                <button
                  onClick={() => handleLaunchWithTransition(activeMission.id)}
                  className="min-h-[52px] sm:min-w-[180px] rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 px-6 py-3 font-display text-base font-bold tracking-wide text-slate-950 shadow-[0_0_28px_rgba(6,182,212,0.45)] active:scale-95 transition cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Play className="h-5 w-5 fill-current" />
                  <span>LAUNCH</span>
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Game Bottom Navigation Dock */}
          <nav className="pointer-events-auto relative z-30 grid grid-cols-5 gap-1 border-t border-white/10 bg-slate-950/95 backdrop-blur-xl px-2 pt-1.5 pb-2 pb-safe px-safe">
            {(
              [
                { id: 'hangar', label: 'Hangar', icon: Wrench },
                { id: 'market', label: 'Market', icon: ShoppingBag },
                { id: 'missions', label: 'Missions', icon: Compass },
                {
                  id: 'objectives',
                  label: 'Rewards',
                  icon: Trophy,
                  badge: unclaimedCount.total,
                },
                { id: 'settings', label: 'Settings', icon: Settings },
              ] as {
                id: HubModalType;
                label: string;
                icon: React.ComponentType<{ className?: string }>;
                badge?: number;
              }[]
            ).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => openHubSection(item.id)}
                  className="relative flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-slate-300 hover:bg-white/5 hover:text-white active:scale-95 transition cursor-pointer"
                >
                  <Icon className="h-5 w-5 text-cyan-300" />
                  <span className="text-[11px] font-semibold leading-none">
                    {item.label}
                  </span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute top-1 right-2.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-400 px-1 font-mono text-[10px] font-black text-slate-950">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </>
      )}

      {/* =====================================================================
       * 3. PAUSE & MISSION DEBRIEF MOBILE SHEETS
       * ==================================================================== */}
      {hud.mode === 'paused' && effectiveModal === 'none' && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-950/95 ring-1 ring-white/15 p-5 sm:p-6 text-center shadow-2xl">
            <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
              Mission Paused
            </div>
            <h2 className="mt-1 font-display text-xl font-bold text-white">
              {hud.missionTitle}
            </h2>
            <p className="mt-1 text-xs text-slate-300">
              {hud.primaryObjectiveText}
            </p>

            <div className="mt-5 flex flex-col gap-2.5">
              <button
                onClick={onResumeGame}
                className="min-h-[48px] w-full rounded-2xl bg-cyan-400 hover:bg-cyan-300 px-5 py-3 font-display text-sm font-bold text-slate-950 active:scale-95 transition cursor-pointer"
              >
                Resume Mission
              </button>
              <button
                onClick={() => openHubSection('settings')}
                className="min-h-[48px] w-full rounded-2xl bg-white/5 hover:bg-white/10 ring-1 ring-white/10 px-5 py-2.5 text-xs font-semibold text-slate-200 active:scale-95 transition cursor-pointer"
              >
                Controls & Settings
              </button>
              <button
                onClick={() => onStartMission(hud.missionId)}
                className="min-h-[48px] w-full rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 ring-1 ring-amber-400/35 px-5 py-2.5 text-xs font-semibold text-amber-200 active:scale-95 transition cursor-pointer"
              >
                Restart Mission
              </button>
              <button
                onClick={onReturnToTitle}
                className="min-h-[48px] w-full rounded-2xl bg-white/5 hover:bg-white/10 px-5 py-2.5 text-xs font-medium text-slate-400 hover:text-white active:scale-95 transition cursor-pointer"
              >
                Return to Command Berth
              </button>
            </div>
          </div>
        </div>
      )}

      {(hud.mode === 'stage_clear' ||
        hud.mode === 'victory' ||
        hud.mode === 'game_over') &&
        effectiveModal === 'none' && (
          <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-slate-950/95 ring-1 ring-white/15 p-5 sm:p-6 text-center shadow-[0_0_80px_rgba(0,0,0,0.85)]">
              <div
                className={`text-xs font-semibold uppercase tracking-wider ${
                  hud.mode === 'game_over' ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {hud.mode === 'game_over'
                  ? 'Hull Compromised'
                  : 'Mission Accomplished'}
              </div>
              <h2 className="mt-1 font-display text-2xl font-bold text-white">
                {hud.lastMissionResult?.missionTitle || hud.missionTitle}
              </h2>

              {hud.lastMissionResult && (
                <div className="mt-4 space-y-3 text-left">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div>
                      <div className="text-xs text-slate-400">Final Score</div>
                      <div className="mt-0.5 font-display text-xl font-bold text-white tabular-nums">
                        {hud.lastMissionResult.score.toLocaleString()} pts
                      </div>
                      <div className="mt-0.5 text-xs text-slate-300 tabular-nums">
                        Accuracy {hud.lastMissionResult.accuracyPct}% · Hull{' '}
                        {hud.lastMissionResult.hullRemainingPct}%
                      </div>
                    </div>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/15 ring-2 ring-amber-400 font-display text-2xl font-black text-amber-300">
                      {hud.lastMissionResult.medalRank}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
                    <div className="rounded-2xl bg-white/[0.04] p-2.5">
                      <div className="text-[11px] text-slate-400">Credits</div>
                      <div className="mt-0.5 font-display text-base font-bold text-amber-300">
                        +{hud.lastMissionResult.creditsEarned}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/[0.04] p-2.5">
                      <div className="text-[11px] text-slate-400">Alloy</div>
                      <div className="mt-0.5 font-display text-base font-bold text-fuchsia-300">
                        +{hud.lastMissionResult.materialsEarned}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/[0.04] p-2.5">
                      <div className="text-[11px] text-slate-400">Pilot XP</div>
                      <div className="mt-0.5 font-display text-base font-bold text-cyan-300">
                        +{hud.lastMissionResult.xpEarned}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                    <span className="text-slate-300 truncate pr-2">
                      Bonus: {hud.lastMissionResult.optionalObjectiveText}
                    </span>
                    <span
                      className={`shrink-0 ${
                        hud.lastMissionResult.optionalCompleted
                          ? 'text-emerald-400 font-semibold'
                          : 'text-slate-500'
                      }`}
                    >
                      {hud.lastMissionResult.optionalCompleted
                        ? '+150 CR'
                        : 'Incomplete'}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2">
                {hud.mode !== 'game_over' && (
                  <button
                    onClick={() => {
                      const nextId = getRecommendedNextMissionId(save);
                      onStartMission(nextId);
                    }}
                    className="min-h-[48px] w-full rounded-2xl bg-emerald-400 hover:bg-emerald-300 px-5 py-3 font-display text-sm font-bold text-slate-950 active:scale-95 transition cursor-pointer"
                  >
                    Launch Next Mission
                  </button>
                )}
                <button
                  onClick={() => onStartMission(hud.missionId)}
                  className="min-h-[48px] w-full rounded-2xl bg-cyan-400 hover:bg-cyan-300 px-5 py-3 font-display text-sm font-bold text-slate-950 active:scale-95 transition cursor-pointer"
                >
                  Replay Mission
                </button>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => openHubSection('hangar')}
                    className="min-h-[44px] rounded-2xl bg-white/10 hover:bg-white/15 px-3 text-xs font-semibold text-white active:scale-95 transition cursor-pointer"
                  >
                    Hangar
                  </button>
                  <button
                    onClick={() => openHubSection('market')}
                    className="min-h-[44px] rounded-2xl bg-white/10 hover:bg-white/15 px-3 text-xs font-semibold text-amber-200 active:scale-95 transition cursor-pointer"
                  >
                    Market
                  </button>
                  <button
                    onClick={onReturnToTitle}
                    className="min-h-[44px] rounded-2xl bg-white/5 hover:bg-white/10 px-3 text-xs font-semibold text-slate-300 active:scale-95 transition cursor-pointer"
                  >
                    Berth
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* =====================================================================
       * 4. MOBILE GAME SCREEN MODALS (Hangar, Market, Missions, Rewards, etc.)
       * ==================================================================== */}
      {hud.mode !== 'playing' && effectiveModal === 'hangar' && (
        <div className="pointer-events-none relative z-20 flex-1 overflow-hidden">
          <HangarView
            save={save}
            onSelectShip={onSelectShip}
            onUnlockShip={onBuyShip}
            onSelectPrimaryWeapon={(id: PrimaryWeaponId) => onSelectWeapon(id)}
            onSelectSecondaryWeapon={(id: SecondaryWeaponId) =>
              onSelectWeapon(id)
            }
            onToggleUpgrade={onBuyOrToggleUpgrade}
            onUpgradeTier={onUpgradeModuleTier}
            onSelectCosmetic={onSelectCosmetic}
            onUnlockCosmetic={onSelectCosmetic}
            onPreviewShip={onPreviewShip}
            onOpenMarket={() => openHubSection('market')}
            onClose={closeModal}
          />
        </div>
      )}

      {hud.mode !== 'playing' && effectiveModal === 'market' && (
        <div className="pointer-events-none relative z-20 flex-1 overflow-hidden">
          <AbyssalMarket
            save={save}
            onBuyUpgrade={onBuyOrToggleUpgrade}
            onToggleEquipUpgrade={onBuyOrToggleUpgrade}
            onUpgradeTier={onUpgradeModuleTier}
            onBuyWeapon={onBuyWeapon}
            onSelectPrimaryWeapon={(id: PrimaryWeaponId) => onSelectWeapon(id)}
            onSelectSecondaryWeapon={(id: SecondaryWeaponId) =>
              onSelectWeapon(id)
            }
            onUnlockShip={onBuyShip}
            onSelectShip={onSelectShip}
            onUnlockCosmetic={onSelectCosmetic}
            onSelectCosmetic={onSelectCosmetic}
            onPreviewShip={onPreviewShip}
            onRefundAllUpgrades={onRefundAllUpgrades}
            onClaimSupplyGrant={onClaimSupplyGrant}
            onExchangeCreditsForCore={onExchangeCreditsForCore}
            onClose={closeModal}
          />
        </div>
      )}

      {hud.mode !== 'playing' && effectiveModal === 'missions' && (
        <div className="pointer-events-none relative z-20 flex-1 overflow-hidden">
          <MissionSelectModal
            save={save}
            selectedStage={selectedStage}
            selectedMissionId={localMissionId}
            onSelectStage={onSelectStage}
            onSelectMission={(mId: string) => setLocalMissionId(mId)}
            onSelectDifficulty={onSetDifficulty}
            onLaunchMission={(mission: MissionDefinition) => {
              handleLaunchWithTransition(mission.id);
            }}
            onClose={closeModal}
          />
        </div>
      )}

      {hud.mode !== 'playing' && effectiveModal === 'objectives' && (
        <div className="pointer-events-none relative z-20 flex-1 overflow-hidden">
          <ObjectivesModal
            save={save}
            onClaimDaily={onClaimDaily}
            onClaimAchievement={onClaimAchievement}
            onOpenProfile={() => openHubSection('profile')}
            onClose={closeModal}
          />
        </div>
      )}

      {hud.mode !== 'playing' && effectiveModal === 'profile' && (
        <div className="pointer-events-none relative z-20 flex-1 overflow-hidden">
          <PilotProfileModal
            save={save}
            onUpdateCallsign={onUpdateCallsign}
            onOpenObjectives={() => openHubSection('objectives')}
            onClose={closeModal}
          />
        </div>
      )}

      {hud.mode !== 'playing' && effectiveModal === 'settings' && (
        <div className="pointer-events-none relative z-20 flex-1 overflow-hidden">
          <SettingsModal
            settings={save.settings}
            onUpdateSettings={onUpdateSettings}
            onResetSave={() => {
              onResetSaveData();
              closeModal();
            }}
            onClose={closeModal}
          />
        </div>
      )}
    </div>
  );
};
