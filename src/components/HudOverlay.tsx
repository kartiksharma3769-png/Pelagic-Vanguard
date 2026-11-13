import React, { useState } from 'react';
import {
  Compass,
  Crosshair,
  Eye,
  Flame,
  Gauge,
  Play,
  Shield,
  ShoppingBag,
  Sliders,
  Sparkles,
  Trophy,
  User,
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
  controlScheme,
  isMuted,
  dockCollapsed,
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
  onToggleControlScheme,
  onToggleMute,
  onToggleDock,
  onTriggerBarrelRoll,
  onTriggerTorpedoSalvo,
  onTriggerTacticalSonar,
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

  const isMenuOpen = hud.mode !== 'playing' || activeModal !== 'none';
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
  const xpPct = Math.min(100, Math.round((save.pilotXp / Math.max(1, nextLevelXp)) * 100));

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

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-20 flex flex-col justify-between select-none overflow-hidden ${
        isMenuOpen ? 'cursor-auto' : 'cursor-none'
      } ${save.settings.reducedMotion ? 'reduced-motion' : ''}`}
    >
      {/* Mission Launch Cinematic Undocking Banner */}
      {launchingMission && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-sm animate-panel-fade">
          <div className="rounded-2xl bg-slate-950/90 ring-1 ring-cyan-400/50 px-8 py-5 text-center shadow-[0_0_60px_rgba(34,211,238,0.35)]">
            <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-cyan-300">
              Hydro-Thrusters Ignited · Undocking
            </div>
            <div className="mt-1 font-display text-2xl font-bold text-white">
              {launchingMission.title}
            </div>
            <div className="mt-1 text-xs text-slate-300">
              {STAGE_CONFIGS[launchingMission.stageId].title} ·{' '}
              {activeShip.name}
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
                : `radial-gradient(circle at 42% 50%, transparent 45%, rgba(2, 6, 23, 0.78) 100%)`,
        }}
      />

      {/* =====================================================================
       * 1. IN-FLIGHT DIEGETIC VISOR COMBAT HUD (mode === 'playing')
       * ==================================================================== */}
      {hud.mode === 'playing' && (
        <>
          {/* Projected 3D Screen Lock Brackets (Enemies & Boss Appendages) */}
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
                  {/* Visor Corner Brackets instead of solid boxes */}
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

          {/* Precision Aiming Reticle */}
          <div
            className="pointer-events-none fixed z-30 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${reticlePos.x}px`,
              top: `${reticlePos.y}px`,
            }}
          >
            <div className="relative flex items-center justify-center">
              <div
                className={`h-10 w-10 rounded-full border transition-transform duration-75 ${
                  hud.sonarActive
                    ? 'border-emerald-400/90 scale-110'
                    : 'border-cyan-400/75'
                }`}
              />
              <div className="absolute h-1.5 w-1.5 rounded-full bg-cyan-300" />
            </div>
          </div>

          {/* Top Visor Telemetry Strip (Frameless with Soft Gradient Scrim) */}
          <header className="relative z-10 flex items-start justify-between gap-6 bg-gradient-to-b from-slate-950/85 via-slate-950/35 to-transparent px-5 pt-4 pb-6">
            {/* Left: Mission & Objective Status */}
            <div className="space-y-1 max-w-md">
              <div className="flex items-center gap-2 text-xs text-cyan-300 font-medium">
                <span className="font-display text-sm font-semibold text-white tracking-tight">
                  {hud.missionTitle}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums text-slate-300">
                  {hud.depthMeters.toLocaleString()}m Depth
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-slate-400">{hud.depthStratumName}</span>
              </div>
              <div className="text-xs text-slate-200 font-medium drop-shadow">
                {hud.flightSchoolStepText || hud.primaryObjectiveText}
                {hud.objectiveProgressTarget > 1 && (
                  <span className="ml-2 text-cyan-300 font-semibold tabular-nums">
                    ({hud.objectiveProgressCurrent}/{hud.objectiveProgressTarget})
                  </span>
                )}
              </div>
              {hud.objectiveType === 'protect_beacon' && (
                <div className="flex items-center gap-2 pt-0.5 text-xs text-amber-300 tabular-nums">
                  <span>Relay Beacon Integrity: {hud.beaconIntegrityPct}%</span>
                </div>
              )}
            </div>

            {/* Center: Frameless Leviathan Boss Visor Bar (Only when Boss is Active) */}
            {hud.bossActive && (
              <div className="flex-1 max-w-xl mx-auto px-4">
                <div className="flex items-baseline justify-between gap-4">
                  <div className="flex items-baseline gap-2">
                    <h2 className="font-display text-base sm:text-lg font-bold tracking-tight text-white">
                      {hud.bossName}
                    </h2>
                    <span className="text-xs text-rose-300/90 hidden sm:inline">
                      {hud.bossSubtitle}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-rose-200 tabular-nums">
                    Phase {hud.bossPhase}/3 · {hud.bossHp.toLocaleString()} HP
                  </div>
                </div>

                {/* Sleek Visor Boss Health Line */}
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-900/90">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-rose-400 transition-all duration-150"
                    style={{ width: `${bossPct}%` }}
                  />
                </div>

                {/* Interactive Appendage Target Locks (Compact Single Row) */}
                <div className="mt-2 grid grid-cols-4 gap-2">
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
                        className={`pointer-events-auto group flex flex-col justify-between rounded-lg px-2.5 py-1.5 text-left transition cursor-pointer ${
                          part.destroyed
                            ? 'bg-slate-950/40 opacity-40'
                            : part.isSonarWeakPoint
                              ? 'bg-emerald-950/60 ring-1 ring-emerald-400/70'
                              : 'bg-slate-950/65 hover:bg-slate-900/85 ring-1 ring-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-medium">
                          <span className="capitalize text-slate-200 truncate">
                            {part.slot}
                          </span>
                          <span
                            className={`tabular-nums ${
                              part.destroyed
                                ? 'text-rose-400'
                                : part.isSonarWeakPoint
                                  ? 'text-emerald-300 font-semibold'
                                  : 'text-cyan-300'
                            }`}
                          >
                            {part.destroyed ? 'Severed' : `${pct}%`}
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
                  <div className="mt-1.5 text-center text-xs font-semibold text-amber-300 drop-shadow">
                    {hud.bossTelegraphText}
                  </div>
                )}
              </div>
            )}

            {/* Right: Score, Multiplier & Quick Visor Actions */}
            <div className="flex items-center gap-4">
              <div className="text-right tabular-nums">
                <div className="font-display text-xl font-bold text-white leading-none">
                  {hud.score.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-cyan-400">pts</span>
                </div>
                <div className="mt-1 flex items-center justify-end gap-2 text-xs text-slate-300">
                  <span className="text-emerald-400 font-semibold">
                    {hud.multiplier.toFixed(1)}x Streak
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-300">
                    {hud.salvageCredits.toLocaleString()} Credits
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onToggleDock}
                  className="pointer-events-auto rounded-lg bg-slate-900/75 hover:bg-slate-800/90 ring-1 ring-white/15 px-3 py-1.5 text-xs font-medium text-slate-200 transition cursor-pointer whitespace-nowrap"
                >
                  {dockCollapsed ? 'Show HUD (H)' : 'Minimal HUD (H)'}
                </button>
                <button
                  onClick={onPauseGame}
                  className="pointer-events-auto rounded-lg bg-slate-900/75 hover:bg-slate-800/90 ring-1 ring-white/15 px-3.5 py-1.5 text-xs font-medium text-white transition cursor-pointer whitespace-nowrap"
                >
                  Pause (Esc)
                </button>
              </div>
            </div>
          </header>

          {/* Center Peripheral Warnings (Pressure / Incoming Telegraph) */}
          <div className="pointer-events-none my-auto flex flex-col items-center justify-end pb-12 gap-1.5">
            {hud.pressureZoneLabel && (
              <div className="rounded-full bg-rose-950/80 ring-1 ring-rose-400/50 px-4 py-1 text-xs font-medium text-rose-200 shadow-lg">
                {hud.pressureZoneLabel}
              </div>
            )}
            {hud.hazardWarningText && !hud.bossTelegraphText && (
              <div className="rounded-full bg-amber-950/80 ring-1 ring-amber-400/50 px-4 py-1 text-xs font-medium text-amber-200 shadow-lg">
                {hud.hazardWarningText}
              </div>
            )}
          </div>

          {/* Bottom Diegetic Visor Arcs & Sleek Action Strip */}
          <footer className="relative z-10 flex flex-col gap-3 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent px-5 pt-6 pb-4">
            <div className="flex flex-wrap items-end justify-between gap-6">
              {/* Bottom-Left Visor Arc: Hull Integrity & Piezo-Shield */}
              <div className="w-full sm:w-72 space-y-2.5">
                <div>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-slate-200 flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-emerald-400" />
                      Hull Integrity
                    </span>
                    <span
                      className={`tabular-nums font-semibold ${
                        hullPct < 30 ? 'text-rose-400' : 'text-emerald-300'
                      }`}
                    >
                      {hud.hull} / {hud.maxHull}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-900/90 ring-1 ring-white/10">
                    <div
                      className={`h-full transition-all duration-150 ${
                        hullPct > 50
                          ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                          : hullPct > 25
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                            : 'bg-gradient-to-r from-rose-600 to-red-400'
                      }`}
                      style={{ width: `${hullPct}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-slate-300 flex items-center gap-1.5">
                      <Crosshair className="h-3.5 w-3.5 text-cyan-400" />
                      Piezo-Shield
                    </span>
                    <span className="tabular-nums font-semibold text-cyan-300">
                      {hud.shield} / {hud.maxShield}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-900/90 ring-1 ring-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 via-cyan-400 to-teal-300 transition-all duration-150"
                      style={{ width: `${shieldPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Bottom-Center Collapsible Visor Control Bar */}
              {!dockCollapsed && (
                <div className="pointer-events-auto mx-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-slate-950/75 ring-1 ring-white/10 px-3 py-2">
                  <button
                    onClick={onTriggerTacticalSonar}
                    className="rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 ring-1 ring-emerald-400/40 px-3 py-1.5 text-xs font-medium text-emerald-200 transition cursor-pointer whitespace-nowrap"
                  >
                    Sonar Pulse (Q)
                  </button>
                  <button
                    onClick={onTriggerBarrelRoll}
                    className="rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 ring-1 ring-cyan-400/40 px-3 py-1.5 text-xs font-medium text-cyan-200 transition cursor-pointer whitespace-nowrap"
                  >
                    Barrel Roll (Space)
                  </button>
                  <button
                    onClick={onTriggerTorpedoSalvo}
                    className="rounded-xl bg-amber-500/15 hover:bg-amber-500/25 ring-1 ring-amber-400/40 px-3 py-1.5 text-xs font-medium text-amber-200 transition cursor-pointer whitespace-nowrap"
                  >
                    Launch Torpedoes (K)
                  </button>
                  <span className="h-4 w-px bg-white/10 mx-0.5 hidden sm:inline-block" />
                  <button
                    onClick={onToggleCamera}
                    className="rounded-xl bg-slate-900/80 hover:bg-slate-800 ring-1 ring-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition cursor-pointer whitespace-nowrap"
                  >
                    View: {cameraMode === 'chase' ? 'Chase' : 'Cockpit'} (C)
                  </button>
                  <button
                    onClick={onToggleControlScheme}
                    className="rounded-xl bg-slate-900/80 hover:bg-slate-800 ring-1 ring-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition cursor-pointer whitespace-nowrap"
                  >
                    {controlScheme === 'hybrid_mouse' ? 'Mouse + WASD' : 'Keyboard'}
                  </button>
                </div>
              )}

              {/* Bottom-Right Visor Arc: Weapon States, Hydro-Boost, Hull Stress & Ordnance Locks */}
              <div className="w-full sm:w-76 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-300 border-b border-white/10 pb-1.5">
                  <span className="truncate">
                    Cannon:{' '}
                    <strong className="text-cyan-200 font-semibold">
                      {equippedPrimary.name}
                    </strong>
                  </span>
                  <span className="truncate ml-2">
                    Ordnance:{' '}
                    <strong className="text-amber-200 font-semibold">
                      {equippedSecondary.name}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs tabular-nums">
                  <span className="text-slate-300">
                    Torpedo Locks:{' '}
                    <strong className="text-amber-300">
                      {hud.lockedCount}/{hud.maxLocks}
                    </strong>
                  </span>
                  <span className="text-slate-300">
                    Sonar:{' '}
                    <strong
                      className={
                        hud.sonarActive
                          ? 'text-emerald-300'
                          : hud.sonarCooldown > 0
                            ? 'text-amber-300'
                            : 'text-cyan-300'
                      }
                    >
                      {hud.sonarActive
                        ? `${hud.sonarRemainingSeconds.toFixed(1)}s`
                        : hud.sonarCooldown > 0
                          ? `${Math.ceil(hud.sonarCooldown * 7.5)}s`
                          : 'Ready'}
                    </strong>
                  </span>
                </div>

                <div>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-slate-300 flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-sky-400" />
                      Hydro-Boost
                    </span>
                    <span className="tabular-nums font-semibold text-sky-300">
                      {Math.round(boostPct)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-900/90 ring-1 ring-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-sky-300 transition-all duration-150"
                      style={{ width: `${boostPct}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline justify-between text-xs">
                    <span
                      className={`font-medium flex items-center gap-1.5 ${
                        hud.inDeepPressureZone ? 'text-rose-300' : 'text-slate-400'
                      }`}
                    >
                      <Gauge className="h-3.5 w-3.5 text-amber-400" />
                      Hull Stress
                    </span>
                    <span className="tabular-nums text-amber-300 font-medium">
                      {hud.hullStress}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-900/90 ring-1 ring-white/10">
                    <div
                      className={`h-full transition-all duration-150 ${
                        hud.hullStress > 75
                          ? 'bg-gradient-to-r from-rose-600 to-amber-400'
                          : 'bg-gradient-to-r from-amber-500 to-yellow-300'
                      }`}
                      style={{ width: `${hud.hullStress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </footer>
        </>
      )}

      {/* Touch Controls Overlay (Active during combat when enabled) */}
      <TouchControlsOverlay
        hud={hud}
        settings={save.settings}
        onTouchMove={onTouchMove}
        onTouchFire={onTouchFireChange}
        onTriggerBarrelRoll={onTriggerBarrelRoll}
        onTriggerTorpedoSalvo={onTriggerTorpedoSalvo}
        onTriggerTacticalSonar={onTriggerTacticalSonar}
      />

      {/* =====================================================================
       * 2. LIVING 3D COMMAND STATION HOME HUB & PERIMETER NAVIGATION
       * ==================================================================== */}
      {hud.mode !== 'playing' && (
        <>
          {/* Top Perimeter Navigation Bar (Visible across Hub & Secondary Overlays) */}
          <header className="pointer-events-auto relative z-30 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-b from-slate-950/90 via-slate-950/60 to-transparent px-6 py-4 border-b border-white/10">
            {/* Left: Pilot Profile & Level Compact Lockup */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => openHubSection('profile')}
                className="group flex items-center gap-3 text-left transition cursor-pointer"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 ring-1 ring-cyan-400/40 font-display text-sm font-bold text-cyan-300 group-hover:bg-cyan-500/25 transition">
                  Lv.{save.pilotLevel}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-bold text-white group-hover:text-cyan-300 transition">
                      {save.callsign}
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs font-medium text-emerald-300 tabular-nums">
                      {fleetPower} Power
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1 w-24 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full bg-cyan-400"
                        style={{ width: `${xpPct}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {save.pilotXp}/{nextLevelXp} XP
                    </span>
                  </div>
                </div>
              </button>
            </div>

            {/* Center: Recognizable Icon + Label Navigation */}
            <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
              {(
                [
                  { id: 'none', label: 'Berth', icon: Eye },
                  { id: 'missions', label: 'Missions', icon: Compass },
                  { id: 'hangar', label: 'Hangar', icon: Wrench },
                  { id: 'market', label: 'Market', icon: ShoppingBag },
                  {
                    id: 'objectives',
                    label: 'Rewards',
                    icon: Trophy,
                    badge: unclaimedCount.total,
                  },
                  { id: 'profile', label: 'Profile', icon: User },
                  { id: 'settings', label: 'Settings', icon: Sliders },
                ] as {
                  id: HubModalType;
                  label: string;
                  icon: React.ComponentType<{ className?: string }>;
                  badge?: number;
                }[]
              ).map((item) => {
                const Icon = item.icon;
                const isActive = effectiveModal === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() =>
                      item.id === 'none' ? closeModal() : openHubSection(item.id)
                    }
                    className={`relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium transition cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-cyan-500/20 text-white ring-1 ring-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${
                        isActive ? 'text-cyan-300' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                    {item.badge && item.badge > 0 ? (
                      <span className="ml-0.5 rounded-full bg-amber-400 px-1.5 py-0.2 text-[10px] font-bold text-slate-950 tabular-nums">
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>

            {/* Right: Clean Unboxed Currency Readouts & Audio Toggle */}
            <div className="flex items-center gap-5 tabular-nums">
              <div className="text-right">
                <div className="text-[11px] text-slate-400">Credits</div>
                <div className="font-display text-sm sm:text-base font-bold text-amber-300">
                  {save.salvageCredits.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-amber-400/80">CR</span>
                </div>
              </div>

              <div className="h-6 w-px bg-white/10" />

              <div className="text-right">
                <div className="text-[11px] text-slate-400">Abyssal Alloy</div>
                <div className="font-display text-sm sm:text-base font-bold text-fuchsia-300">
                  {save.abyssalMaterials.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-fuchsia-400/80">Alloy</span>
                </div>
              </div>

              <button
                onClick={onToggleMute}
                title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer"
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4 text-rose-400" />
                ) : (
                  <Volume2 className="h-4 w-4 text-cyan-300" />
                )}
              </button>
            </div>
          </header>

          {/* HOME HUB CENTER & BOTTOM ANCHORS (100% Unobstructed 3D Fighter in Center) */}
          {hud.mode === 'title' && effectiveModal === 'none' && (
            <div className="relative z-20 flex-1 flex flex-col justify-between p-6 sm:p-10 pointer-events-none">
              {/* Top-Left Subtle Title & Active Hull Callout */}
              <div className="max-w-md space-y-1.5">
                <div className="text-xs font-medium tracking-wider text-cyan-300/90">
                  Deep-Trench Strike Command
                </div>
                <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]">
                  Pelagic Vanguard
                </h1>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-300 pt-1">
                  <span className="font-semibold text-white">
                    {activeShip.name}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{activeShip.classLabel}</span>
                  <span aria-hidden="true">·</span>
                  <button
                    onClick={() => openHubSection('hangar')}
                    className="pointer-events-auto text-cyan-300 hover:text-cyan-200 underline underline-offset-4 cursor-pointer"
                  >
                    Customize Craft
                  </button>
                </div>
              </div>

              {/* Bottom Perimeter: Left Fighter Telemetry + Right Prominent Next Mission & PLAY Action */}
              <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6 pt-8">
                {/* Bottom-Left: Minimalist Active Fighter Specs (Unboxed) */}
                <div className="pointer-events-auto space-y-3 bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-transparent pr-8 py-3 rounded-2xl">
                  <div className="text-xs text-slate-400">
                    Drag anywhere in the berth to rotate your strike fighter
                  </div>
                  <div className="flex flex-wrap items-center gap-6 text-xs tabular-nums">
                    <div>
                      <span className="text-slate-400 block">Hull Armor</span>
                      <span className="font-display text-base font-bold text-white">
                        {activeShip.baseHull} HP
                      </span>
                    </div>
                    <div className="h-6 w-px bg-white/10" />
                    <div>
                      <span className="text-slate-400 block">Piezo-Shield</span>
                      <span className="font-display text-base font-bold text-cyan-300">
                        {activeShip.baseShield} SP
                      </span>
                    </div>
                    <div className="h-6 w-px bg-white/10" />
                    <div>
                      <span className="text-slate-400 block">Torpedo Locks</span>
                      <span className="font-display text-base font-bold text-amber-300">
                        {activeShip.baseTorpedoLocks} Targets
                      </span>
                    </div>
                    <div className="h-6 w-px bg-white/10" />
                    <div>
                      <span className="text-slate-400 block">Module Capacity</span>
                      <span className="font-display text-base font-bold text-emerald-300">
                        {save.activeUpgrades.length}/{activeShip.moduleCapacity} Slots
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom-Right: Next Mission Spotlight & Prominent LAUNCH MISSION Action */}
                <div className="pointer-events-auto w-full lg:w-[440px] rounded-2xl bg-gradient-to-tl from-slate-950/95 via-slate-950/85 to-slate-900/60 ring-1 ring-white/15 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.75)] space-y-4">
                  {/* Sector Selector Tabs */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
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
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                              selected
                                ? 'bg-cyan-500/25 text-white ring-1 ring-cyan-400/50'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                            }`}
                          >
                            Sector {stId}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => openHubSection('missions')}
                      className="text-xs font-medium text-cyan-300 hover:text-cyan-200 transition cursor-pointer"
                    >
                      All 13 Missions →
                    </button>
                  </div>

                  {/* Selected Mission Details */}
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>{STAGE_CONFIGS[activeMission.stageId].title}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-300 font-medium">
                        {activeMission.hasBossFinale
                          ? `Leviathan Alert: ${STAGE_CONFIGS[activeMission.stageId].bossName}`
                          : 'Trench Sortie'}
                      </span>
                    </div>
                    <h2 className="mt-0.5 font-display text-xl sm:text-2xl font-bold text-white">
                      {activeMission.title}
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm text-slate-300">
                      {activeMission.primaryObjectiveText}
                    </p>
                    <div className="mt-1.5 text-xs text-slate-400">
                      Bonus Objective: {activeMission.optionalObjectiveText}
                    </div>
                  </div>

                  {/* Primary LAUNCH MISSION Button */}
                  <button
                    onClick={() => handleLaunchWithTransition(activeMission.id)}
                    className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 py-3.5 px-6 font-display text-base font-bold tracking-wide text-slate-950 shadow-[0_0_35px_rgba(6,182,212,0.45)] transition cursor-pointer flex items-center justify-center gap-2.5"
                  >
                    <Play className="h-5 w-5 fill-current" />
                    <span>Launch Mission</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PAUSE OVERLAY */}
          {hud.mode === 'paused' && effectiveModal === 'none' && (
            <div className="pointer-events-auto my-auto mx-auto max-w-md w-full rounded-2xl bg-slate-950/90 ring-1 ring-white/15 p-7 text-center shadow-2xl">
              <div className="text-xs font-medium text-cyan-400">
                Mission Paused
              </div>
              <h2 className="mt-1 font-display text-2xl font-bold text-white">
                {hud.missionTitle}
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-300">
                {hud.primaryObjectiveText}
              </p>

              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  onClick={onResumeGame}
                  className="w-full rounded-xl bg-cyan-400 hover:bg-cyan-300 px-5 py-3 font-display text-sm font-bold text-slate-950 transition cursor-pointer"
                >
                  Resume Mission (Esc)
                </button>
                <button
                  onClick={() => openHubSection('settings')}
                  className="w-full rounded-xl bg-white/5 hover:bg-white/10 ring-1 ring-white/10 px-5 py-2.5 text-xs sm:text-sm font-medium text-slate-200 transition cursor-pointer"
                >
                  Controls & System Settings
                </button>
                <button
                  onClick={() => onStartMission(hud.missionId)}
                  className="w-full rounded-xl bg-amber-500/15 hover:bg-amber-500/25 ring-1 ring-amber-400/30 px-5 py-2.5 text-xs sm:text-sm font-medium text-amber-200 transition cursor-pointer"
                >
                  Restart Mission
                </button>
                <button
                  onClick={onReturnToTitle}
                  className="w-full rounded-xl bg-white/5 hover:bg-white/10 px-5 py-2.5 text-xs sm:text-sm font-medium text-slate-400 hover:text-white transition cursor-pointer"
                >
                  Return to Command Berth
                </button>
              </div>
            </div>
          )}

          {/* VICTORY / STAGE CLEAR / DEFEAT DEBRIEF OVERLAY */}
          {(hud.mode === 'stage_clear' ||
            hud.mode === 'victory' ||
            hud.mode === 'game_over') &&
            effectiveModal === 'none' && (
              <div className="pointer-events-auto my-auto mx-auto max-w-xl w-full rounded-2xl bg-slate-950/90 ring-1 ring-white/15 p-7 text-center shadow-[0_0_80px_rgba(0,0,0,0.85)]">
                <div
                  className={`text-xs font-semibold tracking-wider ${
                    hud.mode === 'game_over'
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {hud.mode === 'game_over'
                    ? 'Submersible Hull Compromised'
                    : 'Mission Accomplished'}
                </div>
                <h2 className="mt-1 font-display text-3xl font-bold text-white">
                  {hud.lastMissionResult?.missionTitle || hud.missionTitle}
                </h2>

                {hud.lastMissionResult && (
                  <div className="mt-5 space-y-4 text-left">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                      <div>
                        <div className="text-xs text-slate-400">Final Score</div>
                        <div className="mt-0.5 font-display text-2xl font-bold text-white tabular-nums">
                          {hud.lastMissionResult.score.toLocaleString()} pts
                        </div>
                        <div className="mt-1 text-xs text-slate-300 tabular-nums">
                          Accuracy {hud.lastMissionResult.accuracyPct}% · Hull{' '}
                          {hud.lastMissionResult.hullRemainingPct}%
                        </div>
                      </div>
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/15 ring-2 ring-amber-400 font-display text-2xl font-black text-amber-300">
                        {hud.lastMissionResult.medalRank}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-center tabular-nums">
                      <div>
                        <div className="text-xs text-slate-400">Credits</div>
                        <div className="mt-0.5 font-display text-lg font-bold text-amber-300">
                          +{hud.lastMissionResult.creditsEarned} CR
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Abyssal Alloy</div>
                        <div className="mt-0.5 font-display text-lg font-bold text-fuchsia-300">
                          +{hud.lastMissionResult.materialsEarned} Alloy
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Pilot XP</div>
                        <div className="mt-0.5 font-display text-lg font-bold text-cyan-300">
                          +{hud.lastMissionResult.xpEarned} XP
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/10 text-xs">
                      <span className="text-slate-300">
                        Bonus: {hud.lastMissionResult.optionalObjectiveText}
                      </span>
                      <span
                        className={
                          hud.lastMissionResult.optionalCompleted
                            ? 'text-emerald-400 font-semibold'
                            : 'text-slate-500'
                        }
                      >
                        {hud.lastMissionResult.optionalCompleted
                          ? 'Completed (+150 CR)'
                          : 'Incomplete'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                  {hud.mode !== 'game_over' && (
                    <button
                      onClick={() => {
                        const nextId = getRecommendedNextMissionId(save);
                        onStartMission(nextId);
                      }}
                      className="rounded-xl bg-emerald-400 hover:bg-emerald-300 px-5 py-3 font-display text-sm font-bold text-slate-950 transition cursor-pointer"
                    >
                      Launch Next Mission
                    </button>
                  )}
                  <button
                    onClick={() => onStartMission(hud.missionId)}
                    className="rounded-xl bg-cyan-400 hover:bg-cyan-300 px-5 py-3 font-display text-sm font-bold text-slate-950 transition cursor-pointer"
                  >
                    Replay Mission
                  </button>
                  <button
                    onClick={() => openHubSection('hangar')}
                    className="rounded-xl bg-white/10 hover:bg-white/15 px-4 py-3 text-xs sm:text-sm font-medium text-white transition cursor-pointer"
                  >
                    Hangar
                  </button>
                  <button
                    onClick={() => openHubSection('market')}
                    className="rounded-xl bg-white/10 hover:bg-white/15 px-4 py-3 text-xs sm:text-sm font-medium text-amber-200 transition cursor-pointer"
                  >
                    Market
                  </button>
                  <button
                    onClick={onReturnToTitle}
                    className="rounded-xl bg-white/5 hover:bg-white/10 px-4 py-3 text-xs sm:text-sm font-medium text-slate-300 transition cursor-pointer"
                  >
                    Return to Berth
                  </button>
                </div>
              </div>
            )}

          {/* =================================================================
           * 3. FRAMELESS FLOATING CONTEXTUAL OVERLAYS (Keeping 3D Ship Interactive)
           * ================================================================ */}
          {effectiveModal === 'hangar' && (
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

          {effectiveModal === 'market' && (
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

          {effectiveModal === 'missions' && (
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

          {effectiveModal === 'objectives' && (
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

          {effectiveModal === 'profile' && (
            <div className="pointer-events-none relative z-20 flex-1 overflow-hidden">
              <PilotProfileModal
                save={save}
                onUpdateCallsign={onUpdateCallsign}
                onOpenObjectives={() => openHubSection('objectives')}
                onClose={closeModal}
              />
            </div>
          )}

          {effectiveModal === 'settings' && (
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
        </>
      )}
    </div>
  );
};
