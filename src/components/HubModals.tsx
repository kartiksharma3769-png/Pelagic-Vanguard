import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Compass,
  Eye,
  Flame,
  Gamepad2,
  Lock,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Target,
  Trophy,
  User,
  Vibrate,
  Volume2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  ACHIEVEMENT_CATALOG,
  DAILY_OBJECTIVES_CATALOG,
  DIFFICULTY_CONFIGS,
  MISSION_CATALOG,
  SHIP_CATALOG,
  STAGE_CONFIGS,
} from '../game/stages';
import {
  DifficultyId,
  GameSettings,
  MissionDefinition,
  PlayerSaveData,
  StageId,
  TouchLayoutPreset,
} from '../game/types';
import {
  calculateFleetPower,
  getAchievementProgress,
  getXpForNextLevel,
  isMissionUnlocked,
  validateCallsign,
} from '../game/saveManager';

/* ============================================================================
 * SECTOR ENVIRONMENTAL ARTWORK BANNER (Compact Mobile Height)
 * ========================================================================== */
const SectorEnvironmentBanner: React.FC<{
  stageId: StageId;
  hasBoss: boolean;
  bossName: string;
}> = ({ stageId, hasBoss, bossName }) => {
  if (stageId === 1) {
    return (
      <div className="relative h-24 w-full rounded-2xl overflow-hidden border border-cyan-400/35 bg-gradient-to-r from-cyan-950 via-slate-950 to-emerald-950">
        <svg
          viewBox="0 0 600 140"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full opacity-75"
        >
          <defs>
            <linearGradient id="reefGlow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <path
            d="M0,140 L0,85 Q90,55 180,90 T360,75 T540,95 L600,80 L600,140 Z"
            fill="url(#reefGlow)"
          />
          <circle cx="110" cy="48" r="26" fill="#22d3ee" opacity="0.18" />
          <circle cx="460" cy="52" r="38" fill="#34d399" opacity="0.15" />
        </svg>
        <div className="relative z-10 h-full p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] font-bold uppercase text-cyan-200 truncate">
              Sector 01 · Bioluminescent Reef (2,200m)
            </span>
            {hasBoss && (
              <span className="font-mono text-[10px] font-bold uppercase text-rose-300 shrink-0">
                Boss: {bossName}
              </span>
            )}
          </div>
          <div className="text-[11px] text-cyan-100/90 font-medium truncate">
            Bioluminescent colonies · Acoustic kelp pillars & coral trenches
          </div>
        </div>
      </div>
    );
  }

  if (stageId === 2) {
    return (
      <div className="relative h-24 w-full rounded-2xl overflow-hidden border border-amber-500/40 bg-gradient-to-r from-amber-950 via-rose-950 to-slate-950">
        <svg
          viewBox="0 0 600 140"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full opacity-80"
        >
          <defs>
            <linearGradient id="magmaGlow" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <polygon
            points="0,140 55,65 115,140 190,45 265,140 360,58 440,140 515,50 600,140"
            fill="url(#magmaGlow)"
          />
          <circle cx="190" cy="45" r="22" fill="#fb923c" opacity="0.3" />
        </svg>
        <div className="relative z-10 h-full p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] font-bold uppercase text-amber-200 truncate">
              Sector 02 · Volcanic Trench (4,100m)
            </span>
            {hasBoss && (
              <span className="font-mono text-[10px] font-bold uppercase text-rose-300 shrink-0">
                Boss: {bossName}
              </span>
            )}
          </div>
          <div className="text-[11px] text-amber-100/90 font-medium truncate">
            Hydrothermal vents · Basalt spires & thermal pressure surges
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-24 w-full rounded-2xl overflow-hidden border border-fuchsia-500/40 bg-gradient-to-r from-fuchsia-950 via-indigo-950 to-slate-950">
      <svg
        viewBox="0 0 600 140"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full opacity-80"
      >
        <defs>
          <linearGradient id="hadalGlow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#d946ef" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <polygon
          points="80,140 130,30 180,140 290,20 350,140 460,35 530,140"
          fill="url(#hadalGlow)"
        />
      </svg>
      <div className="relative z-10 h-full p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] font-bold uppercase text-fuchsia-200 truncate">
            Sector 03 · Hadal Vault (7,400m)
          </span>
          {hasBoss && (
            <span className="font-mono text-[10px] font-bold uppercase text-rose-300 shrink-0">
              Boss: {bossName}
            </span>
          )}
        </div>
        <div className="text-[11px] text-fuchsia-100/90 font-medium truncate">
          Crushing hadal pressure · Xeno-structures & bio-electric anomalies
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 1. MOBILE CAMPAIGN & MISSION SELECT SHEET
 * ========================================================================== */
interface MissionSelectModalProps {
  save: PlayerSaveData;
  selectedStage: StageId;
  selectedMissionId: string;
  onSelectStage: (stage: StageId) => void;
  onSelectMission: (missionId: string) => void;
  onSelectDifficulty: (diff: DifficultyId) => void;
  onLaunchMission: (mission: MissionDefinition) => void;
  onClose: () => void;
}

export const MissionSelectModal: React.FC<MissionSelectModalProps> = ({
  save,
  selectedStage,
  selectedMissionId,
  onSelectStage,
  onSelectMission,
  onSelectDifficulty,
  onLaunchMission,
  onClose,
}) => {
  const [tab, setTab] = useState<'campaign' | 'special'>('campaign');
  const [isInspecting3D, setIsInspecting3D] = useState<boolean>(false);
  const fleetPower = calculateFleetPower(save);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('pelagic-hangar-camera', {
        detail: { action: isInspecting3D ? 'centerInspect' : 'splitInspect' },
      }),
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent('pelagic-hangar-camera', {
          detail: { action: 'splitInspect' },
        }),
      );
    };
  }, [isInspecting3D]);

  const sendCameraCommand = (
    action: 'zoomIn' | 'zoomOut' | 'resetView' | 'testThrusters',
  ) => {
    window.dispatchEvent(
      new CustomEvent('pelagic-hangar-camera', { detail: { action } }),
    );
  };

  const nextRecommendedMissionId = useMemo(() => {
    const campaignMissions = MISSION_CATALOG.filter(
      (m) => m.category === 'campaign',
    );
    for (const m of campaignMissions) {
      if (
        isMissionUnlocked(m.id, save) &&
        !save.missionRecords[m.id]?.cleared
      ) {
        return m.id;
      }
    }
    return campaignMissions[campaignMissions.length - 1]?.id || 'stage_1_m1';
  }, [save]);

  const visibleMissions =
    tab === 'campaign'
      ? MISSION_CATALOG.filter(
          (m) => m.category === 'campaign' && m.stageId === selectedStage,
        )
      : MISSION_CATALOG.filter((m) => m.category !== 'campaign');

  const activeMission =
    MISSION_CATALOG.find((m) => m.id === selectedMissionId) ||
    visibleMissions[0] ||
    MISSION_CATALOG[0];

  const isActiveUnlocked = isMissionUnlocked(activeMission.id, save);
  const activeRecord = save.missionRecords[activeMission.id];
  const stageCfg = STAGE_CONFIGS[activeMission.stageId];

  if (isInspecting3D) {
    return (
      <div className="relative h-full w-full flex flex-col justify-between p-3 sm:p-5 pt-safe pb-safe px-safe pointer-events-none select-none overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="pointer-events-auto rounded-2xl bg-slate-950/80 backdrop-blur-md ring-1 ring-white/15 px-3.5 py-2.5 shadow-xl max-w-xs sm:max-w-sm">
            <div className="text-[11px] font-medium text-cyan-400">
              Launch Tube · {stageCfg.title}
            </div>
            <h1 className="font-display text-lg font-bold text-white truncate">
              {activeMission.title}
            </h1>
            <p className="mt-0.5 text-[11px] text-slate-300 truncate">
              {activeMission.primaryObjectiveText}
            </p>
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-2xl bg-slate-950/80 backdrop-blur-md ring-1 ring-white/15 p-1">
              <button
                onClick={() => sendCameraCommand('zoomIn')}
                aria-label="Zoom In"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-200 active:scale-95 transition cursor-pointer"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                onClick={() => sendCameraCommand('zoomOut')}
                aria-label="Zoom Out"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-200 active:scale-95 transition cursor-pointer"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                onClick={() => sendCameraCommand('resetView')}
                aria-label="Reset View"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-200 active:scale-95 transition cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={() => sendCameraCommand('testThrusters')}
                aria-label="Ignite Thrusters"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-200 active:scale-95 transition cursor-pointer"
              >
                <Flame className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => setIsInspecting3D(false)}
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-2xl bg-cyan-400 px-3.5 py-2 font-display text-xs font-bold text-slate-950 shadow-lg active:scale-95 transition cursor-pointer whitespace-nowrap"
            >
              <Compass className="h-4 w-4" />
              <span>Missions</span>
            </button>
          </div>
        </div>

        <div className="pointer-events-auto rounded-2xl bg-slate-950/90 backdrop-blur-md ring-1 ring-white/15 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="min-w-0">
            <div className="text-[11px] text-slate-300 truncate">
              Bonus: {activeMission.optionalObjectiveText}
            </div>
            <div className="font-mono text-xs text-amber-300 font-bold">
              +{activeMission.firstClearCredits} CR · +
              {activeMission.firstClearMaterials} AL · +{activeMission.xpReward}{' '}
              XP
            </div>
          </div>

          <button
            onClick={() => isActiveUnlocked && onLaunchMission(activeMission)}
            disabled={!isActiveUnlocked}
            className={`min-h-[48px] rounded-2xl px-5 py-2.5 font-display text-sm font-bold transition flex items-center justify-center gap-2 whitespace-nowrap ${
              isActiveUnlocked
                ? 'bg-cyan-400 text-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.45)] cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isActiveUnlocked ? (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>Launch Mission</span>
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                <span>Locked</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none relative h-full w-full flex flex-col justify-between select-none overflow-hidden">
      {/* Top Translucent Bar */}
      <div className="pointer-events-auto relative z-20 flex items-center justify-between gap-2 bg-gradient-to-b from-slate-950/90 via-slate-950/55 to-transparent px-3 sm:px-5 pt-2.5 pb-4 pt-safe px-safe">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onClose}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-2xl bg-slate-950/80 ring-1 ring-white/15 px-3 text-xs font-semibold text-slate-200 active:scale-95 transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Berth</span>
          </button>

          <div className="min-w-0">
            <div className="text-[11px] font-medium text-cyan-400">
              Ocean Sector Map · {fleetPower} PWR
            </div>
            <h2 className="font-display text-sm sm:text-lg font-bold text-white truncate">
              Missions & Operations
            </h2>
          </div>
        </div>

        <button
          onClick={() => setIsInspecting3D(true)}
          className="min-h-[44px] inline-flex items-center gap-1.5 rounded-2xl bg-cyan-500/20 ring-1 ring-cyan-400/50 px-3 text-xs font-bold text-cyan-200 active:scale-95 transition cursor-pointer whitespace-nowrap shrink-0"
        >
          <Eye className="h-4 w-4" />
          <span>3D View</span>
        </button>
      </div>

      {/* Responsive Container: Transparent upper showcase + Slide-up Sheet */}
      <div className="flex-1 flex flex-col lg:flex-row lg:items-end lg:justify-end overflow-hidden pointer-events-none">
        <div className="flex-1 min-h-[14dvh] pointer-events-none" />

        <div className="pointer-events-auto animate-panel-up w-full lg:w-[580px] lg:h-[calc(100%-12px)] lg:mr-4 lg:mb-3 max-h-[76dvh] lg:max-h-none flex flex-col rounded-t-3xl lg:rounded-3xl bg-slate-950/92 backdrop-blur-xl border-t lg:border border-white/15 shadow-[0_-18px_50px_rgba(0,0,0,0.85)] overflow-hidden">
          {/* Sector Tabs & Difficulty */}
          <div className="px-3 pt-2.5 pb-2 border-b border-white/10 space-y-2 shrink-0">
            <div className="mx-auto h-1 w-10 rounded-full bg-white/20 lg:hidden" />

            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 1 as StageId, label: 'Sector 01 Reef' },
                  { id: 2 as StageId, label: 'Sector 02 Trench' },
                  { id: 3 as StageId, label: 'Sector 03 Hadal' },
                ] as const
              ).map((sec) => {
                const active = tab === 'campaign' && selectedStage === sec.id;
                return (
                  <button
                    key={sec.id}
                    onClick={() => {
                      setTab('campaign');
                      onSelectStage(sec.id);
                      const firstInStage = MISSION_CATALOG.find(
                        (m) => m.category === 'campaign' && m.stageId === sec.id,
                      );
                      if (firstInStage) onSelectMission(firstInStage.id);
                    }}
                    className={`min-h-[42px] rounded-xl px-3 text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-cyan-400 text-slate-950'
                        : 'bg-slate-900/80 text-slate-300 ring-1 ring-white/10'
                    }`}
                  >
                    {sec.label}
                  </button>
                );
              })}

              <button
                onClick={() => {
                  setTab('special');
                  onSelectMission('flight_school_01');
                }}
                className={`min-h-[42px] rounded-xl px-3 text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  tab === 'special'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-900/80 text-slate-300 ring-1 ring-white/10'
                }`}
              >
                Training & Bosses (4)
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {(['story', 'normal', 'elite'] as DifficultyId[]).map((diff) => {
                const cfg = DIFFICULTY_CONFIGS[diff];
                const active = save.selectedDifficulty === diff;
                return (
                  <button
                    key={diff}
                    onClick={() => onSelectDifficulty(diff)}
                    className={`min-h-[38px] rounded-xl px-2 text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-cyan-500/25 text-cyan-200 ring-1 ring-cyan-400/50 font-bold'
                        : 'bg-slate-900/80 text-slate-400 ring-1 ring-white/10'
                    }`}
                  >
                    {cfg.name} ({Math.round(cfg.rewardMult * 100)}%)
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable Sector Art & Mission Nodes */}
          <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2.5">
            <SectorEnvironmentBanner
              stageId={activeMission.stageId}
              hasBoss={activeMission.hasBossFinale}
              bossName={stageCfg.bossName}
            />

            <div className="space-y-2">
              {visibleMissions.map((mission, idx) => {
                const unlocked = isMissionUnlocked(mission.id, save);
                const record = save.missionRecords[mission.id];
                const completed = Boolean(record?.cleared);
                const rank = record?.bestRank;
                const active = activeMission.id === mission.id;
                const isNextAvailable =
                  mission.id === nextRecommendedMissionId && !completed;

                return (
                  <button
                    key={mission.id}
                    onClick={() => onSelectMission(mission.id)}
                    className={`min-h-[64px] w-full rounded-2xl p-3 text-left transition cursor-pointer border flex flex-col justify-between ${
                      active
                        ? 'border-cyan-400 bg-cyan-500/20'
                        : isNextAvailable
                          ? 'border-emerald-400/70 bg-emerald-950/25'
                          : unlocked
                            ? 'border-white/15 bg-slate-900/75'
                            : 'border-white/5 bg-slate-950/50 opacity-55'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold text-cyan-300">
                        {mission.category === 'campaign'
                          ? `Node 0${idx + 1} · Sortie ${mission.stageId}-${mission.missionNumber}`
                          : mission.category === 'flight_school'
                            ? 'Training Node'
                            : `Boss Rematch 0${mission.stageId}`}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {mission.hasBossFinale && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-rose-300">
                            <Target className="h-3 w-3" /> Boss
                          </span>
                        )}
                        {isNextAvailable ? (
                          <span className="rounded bg-emerald-400 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-950">
                            NEXT
                          </span>
                        ) : rank ? (
                          <span className="rounded bg-amber-400/20 border border-amber-400/50 px-1.5 py-0.5 font-mono text-xs font-black text-amber-300">
                            {rank}
                          </span>
                        ) : !unlocked ? (
                          <Lock className="h-3.5 w-3.5 text-slate-500" />
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <h4 className="text-sm font-bold text-white truncate">
                        {mission.title}
                      </h4>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0 tabular-nums">
                        Rec. {mission.recommendedPower} PWR
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sticky Bottom Briefing & Launch CTA */}
          <div className="shrink-0 border-t border-white/10 bg-slate-950/95 px-3 pt-2.5 pb-3 pb-safe space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-display text-sm sm:text-base font-bold text-white truncate">
                {activeMission.title}
              </h3>
              <span className="font-mono text-[11px] text-amber-300 font-bold shrink-0 tabular-nums">
                +{activeMission.firstClearCredits} CR · +
                {activeMission.firstClearMaterials} AL · +
                {activeMission.xpReward} XP
              </span>
            </div>
            <div className="text-[11px] text-slate-300 truncate">
              <strong className="text-cyan-300">Primary:</strong>{' '}
              {activeMission.primaryObjectiveText} ·{' '}
              <strong className="text-amber-300">Bonus:</strong>{' '}
              {activeMission.optionalObjectiveText}
            </div>
            {activeRecord && (
              <div className="text-[10px] font-mono text-emerald-300">
                Best Clear: Rank {activeRecord.bestRank} (
                {activeRecord.bestScore.toLocaleString()} pts)
              </div>
            )}

            <button
              onClick={() => isActiveUnlocked && onLaunchMission(activeMission)}
              disabled={!isActiveUnlocked}
              className={`min-h-[48px] w-full rounded-2xl py-3 font-display text-sm font-bold tracking-wide transition flex items-center justify-center gap-2 ${
                isActiveUnlocked
                  ? 'bg-cyan-400 text-slate-950 shadow-[0_0_28px_rgba(6,182,212,0.45)] active:scale-[0.99] cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isActiveUnlocked ? (
                <>
                  <Play className="h-4 w-4 fill-current" />
                  <span>LAUNCH MISSION</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Complete Previous Node to Unlock</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. MOBILE DIRECTIVES & ACHIEVEMENTS REWARDS SCREEN
 * ========================================================================== */
interface ObjectivesModalProps {
  save: PlayerSaveData;
  onClaimDaily: (id: string) => void;
  onClaimAchievement: (id: string) => void;
  onOpenProfile?: () => void;
  onClose: () => void;
}

export const ObjectivesModal: React.FC<ObjectivesModalProps> = ({
  save,
  onClaimDaily,
  onClaimAchievement,
  onOpenProfile,
  onClose,
}) => {
  const [section, setSection] = useState<'daily' | 'milestones'>('daily');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = [
    'All',
    'Campaign',
    'Combat',
    'Precision',
    'Boss Hunter',
    'Pilot Skill',
    'Collection',
  ];

  const sortedAchievements = useMemo(() => {
    const filtered =
      selectedCategory === 'All'
        ? ACHIEVEMENT_CATALOG
        : ACHIEVEMENT_CATALOG.filter((a) => a.category === selectedCategory);

    return [...filtered].sort((a, b) => {
      const progA = getAchievementProgress(a, save);
      const progB = getAchievementProgress(b, save);
      const claimedA = save.claimedAchievements.includes(a.id);
      const claimedB = save.claimedAchievements.includes(b.id);
      const readyA = progA >= a.targetValue && !claimedA ? 1 : 0;
      const readyB = progB >= b.targetValue && !claimedB ? 1 : 0;
      if (readyA !== readyB) return readyB - readyA;
      if (claimedA !== claimedB) return claimedA ? 1 : -1;
      return 0;
    });
  }, [selectedCategory, save]);

  return (
    <div className="pointer-events-auto relative h-full w-full bg-slate-950/94 backdrop-blur-md flex flex-col select-none overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-5 pt-2.5 pb-3 border-b border-white/10 pt-safe px-safe shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onClose}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-2xl bg-white/5 ring-1 ring-white/10 px-3 text-xs font-semibold text-slate-200 active:scale-95 transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Berth</span>
          </button>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-amber-400">
              Rewards & Bounty Board
            </div>
            <h2 className="font-display text-sm sm:text-lg font-bold text-white truncate">
              Directives & Milestones
            </h2>
          </div>
        </div>

        {onOpenProfile && (
          <button
            onClick={onOpenProfile}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-2xl bg-cyan-500/15 ring-1 ring-cyan-400/35 px-3 text-xs font-semibold text-cyan-200 active:scale-95 transition cursor-pointer shrink-0"
          >
            <User className="h-4 w-4" />
            <span>Profile</span>
          </button>
        )}
      </div>

      {/* Mobile Segmented Switch */}
      <div className="px-3 sm:px-5 pt-3 pb-2 shrink-0 max-w-4xl w-full mx-auto space-y-2">
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-900/90 p-1 ring-1 ring-white/10">
          <button
            onClick={() => setSection('daily')}
            className={`min-h-[44px] rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              section === 'daily'
                ? 'bg-amber-400 text-slate-950'
                : 'text-slate-300'
            }`}
          >
            <Trophy className="h-4 w-4" />
            <span>Daily Directives</span>
          </button>
          <button
            onClick={() => setSection('milestones')}
            className={`min-h-[44px] rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              section === 'milestones'
                ? 'bg-cyan-400 text-slate-950'
                : 'text-slate-300'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Career Milestones</span>
          </button>
        </div>

        {section === 'milestones' && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`min-h-[38px] rounded-xl px-3 text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-cyan-400 text-slate-950 font-bold'
                    : 'bg-white/5 text-slate-300 ring-1 ring-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-5 pb-6 pb-safe max-w-4xl w-full mx-auto">
        {section === 'daily' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Active Cycle: {save.dailyDateKey}</span>
              <span>Resets 00:00 Local</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {DAILY_OBJECTIVES_CATALOG.map((daily) => {
                const progress = save.dailyProgress[daily.id] || 0;
                const claimed = save.claimedDailyIds.includes(daily.id);
                const ready = progress >= daily.targetValue && !claimed;
                const pct = Math.min(
                  100,
                  Math.round((progress / daily.targetValue) * 100),
                );

                return (
                  <div
                    key={daily.id}
                    className={`rounded-2xl p-4 flex flex-col justify-between border transition ${
                      ready
                        ? 'border-amber-400 bg-amber-500/15 shadow-[0_0_24px_rgba(245,158,11,0.2)]'
                        : claimed
                          ? 'border-emerald-500/30 bg-emerald-950/15 opacity-75'
                          : 'border-white/10 bg-slate-900/70'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">
                          {daily.title}
                        </span>
                        <span className="font-mono text-amber-300 font-bold tabular-nums">
                          {Math.min(progress, daily.targetValue)}/
                          {daily.targetValue}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                        {daily.description}
                      </p>
                      <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-amber-400 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-amber-300 tabular-nums">
                        +{daily.rewardCredits} CR
                        {daily.rewardMaterials > 0
                          ? ` +${daily.rewardMaterials}M`
                          : ''}
                      </span>
                      {claimed ? (
                        <span className="min-h-[44px] inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                          <Check className="h-4 w-4" /> Claimed
                        </span>
                      ) : (
                        <button
                          onClick={() => ready && onClaimDaily(daily.id)}
                          disabled={!ready}
                          className={`min-h-[44px] rounded-xl px-4 text-xs font-bold uppercase transition ${
                            ready
                              ? 'bg-amber-400 text-slate-950 cursor-pointer'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {ready ? 'Claim' : `${pct}%`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedAchievements.map((ach) => {
              const progress = getAchievementProgress(ach, save);
              const claimed = save.claimedAchievements.includes(ach.id);
              const ready = progress >= ach.targetValue && !claimed;
              const pct = Math.min(
                100,
                Math.round((progress / ach.targetValue) * 100),
              );

              return (
                <div
                  key={ach.id}
                  className={`rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border transition ${
                    ready
                      ? 'border-cyan-400/60 bg-cyan-500/15 shadow-[0_0_20px_rgba(6,182,212,0.18)]'
                      : claimed
                        ? 'border-emerald-500/25 bg-emerald-950/15 opacity-80'
                        : 'border-white/10 bg-slate-900/65'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-mono font-bold uppercase text-cyan-300 shrink-0">
                          {ach.category}
                        </span>
                        <span aria-hidden="true" className="text-slate-600">
                          ·
                        </span>
                        <h4 className="text-sm font-bold text-white truncate">
                          {ach.title}
                        </h4>
                      </div>
                      <span className="font-mono text-xs text-slate-300 tabular-nums shrink-0">
                        {Math.min(progress, ach.targetValue)}/{ach.targetValue}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {ach.description}
                    </p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          claimed
                            ? 'bg-emerald-400'
                            : ready
                              ? 'bg-cyan-400'
                              : 'bg-sky-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <div className="font-mono text-[11px] font-bold text-amber-300 tabular-nums">
                      +{ach.rewardCredits} CR · +{ach.rewardMaterials}M · +
                      {ach.rewardXp} XP
                    </div>
                    {claimed ? (
                      <span className="min-h-[44px] inline-flex items-center gap-1 rounded-xl bg-emerald-500/20 px-3 text-xs font-bold text-emerald-300">
                        <Check className="h-3.5 w-3.5" /> Claimed
                      </span>
                    ) : (
                      <button
                        onClick={() => ready && onClaimAchievement(ach.id)}
                        disabled={!ready}
                        className={`min-h-[44px] rounded-xl px-4 text-xs font-bold uppercase transition ${
                          ready
                            ? 'bg-cyan-400 text-slate-950 shadow-[0_0_16px_rgba(6,182,212,0.4)] cursor-pointer'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {ready ? 'Claim' : 'Locked'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. MOBILE PILOT PROFILE & FLEET DOSSIER
 * ========================================================================== */
interface PilotProfileModalProps {
  save: PlayerSaveData;
  onUpdateCallsign: (newCallsign: string) => void;
  onOpenObjectives?: () => void;
  onClose: () => void;
}

export const PilotProfileModal: React.FC<PilotProfileModalProps> = ({
  save,
  onUpdateCallsign,
  onOpenObjectives,
  onClose,
}) => {
  const [draftName, setDraftName] = useState(save.callsign);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  const nextLevelXp = getXpForNextLevel(save.pilotLevel);
  const fleetPower = calculateFleetPower(save);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    const res = validateCallsign(draftName);
    if (!res.valid) {
      setErrorMsg(res.error || 'Invalid callsign');
      return;
    }
    setErrorMsg(null);
    onUpdateCallsign(res.sanitized);
    setDraftName(res.sanitized);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  return (
    <div className="pointer-events-auto relative h-full w-full bg-slate-950/94 backdrop-blur-md flex flex-col select-none overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 sm:px-5 pt-2.5 pb-3 border-b border-white/10 pt-safe px-safe shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onClose}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-2xl bg-white/5 ring-1 ring-white/10 px-3 text-xs font-semibold text-slate-200 active:scale-95 transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Berth</span>
          </button>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-cyan-400">
              Commander Dossier
            </div>
            <h2 className="font-display text-sm sm:text-lg font-bold text-white truncate">
              {save.callsign}
            </h2>
          </div>
        </div>

        {onOpenObjectives && (
          <button
            onClick={onOpenObjectives}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-2xl bg-amber-500/15 ring-1 ring-amber-400/35 px-3 text-xs font-semibold text-amber-200 active:scale-95 transition cursor-pointer shrink-0"
          >
            <Trophy className="h-4 w-4" />
            <span>Rewards</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 pb-safe max-w-4xl w-full mx-auto space-y-4">
        {/* Pilot Rank Banner & Callsign Registry */}
        <div className="rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/90 via-slate-950 to-slate-950 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                Fleet Power {fleetPower} PWR
              </span>
              <div className="mt-0.5 font-display text-xl font-black text-white">
                Level {save.pilotLevel} Commander
              </div>
            </div>
            <div className="font-mono text-right tabular-nums">
              <div className="text-[11px] text-slate-400">XP</div>
              <div className="text-xs font-bold text-cyan-300">
                {save.pilotXp} / {nextLevelXp}
              </div>
            </div>
          </div>

          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-cyan-400"
              style={{
                width: `${Math.min(100, (save.pilotXp / nextLevelXp) * 100)}%`,
              }}
            />
          </div>

          <form
            onSubmit={handleSaveName}
            className="pt-2.5 border-t border-white/10 flex flex-wrap items-center gap-2"
          >
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              maxLength={16}
              placeholder="Callsign"
              className="min-h-[44px] flex-1 min-w-[140px] rounded-xl border border-white/15 bg-slate-900 px-3 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
            />
            <button
              type="submit"
              className="min-h-[44px] rounded-xl bg-cyan-400 px-4 text-xs font-bold text-slate-950 active:scale-95 cursor-pointer"
            >
              Save Callsign
            </button>
            {errorMsg && (
              <span className="w-full text-xs text-rose-400">{errorMsg}</span>
            )}
            {savedToast && (
              <span className="w-full text-xs text-emerald-400">
                Callsign updated in fleet registry.
              </span>
            )}
          </form>
        </div>

        {/* Fleet Collection Showcase */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Fleet Collection ({save.ownedShips.length}/{SHIP_CATALOG.length})
            </span>
            <span className="font-mono text-xs text-cyan-300 tabular-nums">
              {save.ownedWeapons.length}/6 Weapons · {save.ownedUpgrades.length}
              /8 Modules
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SHIP_CATALOG.map((ship, idx) => {
              const owned = save.ownedShips.includes(ship.id);
              const active = save.selectedShip === ship.id;
              return (
                <div
                  key={ship.id}
                  className={`rounded-2xl p-3 border ${
                    active
                      ? 'border-emerald-400/60 bg-emerald-950/20'
                      : owned
                        ? 'border-cyan-500/35 bg-slate-900/75'
                        : 'border-white/5 bg-slate-950/45 opacity-55'
                  }`}
                >
                  <div
                    className="text-[10px] font-bold uppercase truncate"
                    style={{ color: ship.accentColor }}
                  >
                    T{ship.tier || idx + 1} · {ship.rarity}
                  </div>
                  <div className="mt-0.5 text-xs font-bold text-white truncate">
                    {ship.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {ship.roleTitle}
                  </div>
                  <div className="mt-1.5 font-mono text-[10px]">
                    {active ? (
                      <span className="text-emerald-300 font-bold">
                        Flagship
                      </span>
                    ) : owned ? (
                      <span className="text-cyan-300">Owned</span>
                    ) : (
                      <span className="text-slate-500">Locked</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Career Combat Record */}
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 px-1">
            Career Combat Record
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/65 divide-y divide-white/10 font-mono text-xs tabular-nums">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-slate-400">Sorties / Victories</span>
              <span className="text-white font-bold">
                {save.stats.totalSortiesLaunched} ·{' '}
                <span className="text-emerald-300">
                  {save.stats.totalVictories} Cleared
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-slate-400">Hostiles / Elites</span>
              <span className="text-cyan-300 font-bold">
                {save.stats.totalEnemiesDefeated} ({save.stats.totalElitesDefeated}{' '}
                Elites)
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-slate-400">Bosses / Appendages</span>
              <span className="text-rose-300 font-bold">
                {save.stats.totalBossesDefeated} ·{' '}
                <span className="text-amber-300">
                  {save.stats.totalAppendagesSevered} Cut
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-slate-400">Sonar / Torpedoes</span>
              <span className="text-sky-300 font-bold">
                {save.stats.totalSonarPulsesUsed} ·{' '}
                {save.stats.totalTorpedoesFired}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-slate-400">High Score</span>
              <span className="text-amber-300 font-bold">
                {save.highScore.toLocaleString()} PTS
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. MOBILE GAME SYSTEM & TOUCH CONTROLS SETTINGS
 * ========================================================================== */
interface SettingsModalProps {
  settings: GameSettings;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  onResetSave: () => void;
  onClose: () => void;
}

type SettingsCategory =
  | 'controls'
  | 'gameplay'
  | 'graphics'
  | 'audio'
  | 'accessibility'
  | 'data';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onResetSave,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsCategory>('controls');
  const [confirmReset, setConfirmReset] = useState(false);

  const tabs: { id: SettingsCategory; label: string }[] = [
    { id: 'controls', label: 'Controls' },
    { id: 'gameplay', label: 'Gameplay' },
    { id: 'graphics', label: 'Graphics' },
    { id: 'audio', label: 'Audio' },
    { id: 'accessibility', label: 'Access' },
    { id: 'data', label: 'Data' },
  ];

  return (
    <div className="pointer-events-auto relative h-full w-full bg-slate-950/94 backdrop-blur-md flex flex-col select-none overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-5 pt-2.5 pb-3 border-b border-white/10 pt-safe px-safe shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onClose}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-2xl bg-white/5 ring-1 ring-white/10 px-3 text-xs font-semibold text-slate-200 active:scale-95 transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Berth</span>
          </button>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-cyan-400">
              Mobile Console Preferences
            </div>
            <h2 className="font-display text-sm sm:text-lg font-bold text-white truncate">
              Settings
            </h2>
          </div>
        </div>

        <button
          onClick={onClose}
          className="min-h-[44px] rounded-2xl bg-cyan-400 px-4 text-xs font-bold text-slate-950 active:scale-95 transition cursor-pointer shrink-0"
        >
          Done
        </button>
      </div>

      {/* Scrollable Category Tabs */}
      <div className="px-3 sm:px-5 pt-3 pb-2 shrink-0 max-w-3xl w-full mx-auto">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar rounded-2xl bg-slate-900/90 p-1 ring-1 ring-white/10">
          {tabs.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`min-h-[42px] flex-1 min-w-[74px] rounded-xl px-2.5 text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-cyan-400 text-slate-950 font-bold'
                    : 'text-slate-300'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-5 pb-6 pb-safe max-w-3xl w-full mx-auto space-y-3">
        {/* 1. CONTROLS CATEGORY */}
        {activeTab === 'controls' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/15 p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Combat Auto-Fire</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-300">
                  Automatically fires primary cannons when hostiles or boss weak points enter range.
                </p>
              </div>
              <button
                onClick={() =>
                  onUpdateSettings({ autoFire: !settings.autoFire })
                }
                className={`min-h-[44px] shrink-0 rounded-xl px-4 text-xs font-bold transition cursor-pointer ${
                  settings.autoFire
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-slate-800 text-slate-300 border border-white/10'
                }`}
              >
                {settings.autoFire ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/65 p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Vibrate className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span>Haptic Vibration Feedback</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-300">
                  Tactile vibration pulses on torpedo launches, sonar pings, and hull hits.
                </p>
              </div>
              <button
                onClick={() =>
                  onUpdateSettings({ hapticsEnabled: !settings.hapticsEnabled })
                }
                className={`min-h-[44px] shrink-0 rounded-xl px-4 text-xs font-bold transition cursor-pointer ${
                  settings.hapticsEnabled
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-slate-800 text-slate-300 border border-white/10'
                }`}
              >
                {settings.hapticsEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/65 p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Gamepad2 className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span>Virtual Thumbstick & Touch Buttons</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-300">
                  Displays dual-thumb flight stick and mobile combat triggers during sorties.
                </p>
              </div>
              <button
                onClick={() =>
                  onUpdateSettings({
                    touchControlsEnabled: !settings.touchControlsEnabled,
                  })
                }
                className={`min-h-[44px] shrink-0 rounded-xl px-4 text-xs font-bold transition cursor-pointer ${
                  settings.touchControlsEnabled
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-slate-800 text-slate-300 border border-white/10'
                }`}
              >
                {settings.touchControlsEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/65 p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-2">
                  Touch Layout Preset
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      {
                        id: 'standard',
                        label: 'Standard',
                        sub: 'Left Stick',
                      },
                      {
                        id: 'left_handed',
                        label: 'Left-Hand',
                        sub: 'Right Stick',
                      },
                      {
                        id: 'minimal',
                        label: 'Minimal',
                        sub: 'Compact Rings',
                      },
                    ] as {
                      id: TouchLayoutPreset;
                      label: string;
                      sub: string;
                    }[]
                  ).map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() =>
                        onUpdateSettings({ touchLayout: preset.id })
                      }
                      className={`min-h-[52px] rounded-xl border p-2.5 text-left transition cursor-pointer ${
                        settings.touchLayout === preset.id
                          ? 'border-cyan-400 bg-cyan-500/20 text-white'
                          : 'border-white/10 bg-slate-950/60 text-slate-400'
                      }`}
                    >
                      <div className="text-xs font-bold">{preset.label}</div>
                      <div className="mt-0.5 text-[10px] opacity-80">
                        {preset.sub}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-200 mb-1">
                  <span>Virtual Stick Sensitivity</span>
                  <span className="font-mono-tabular text-cyan-300 font-bold">
                    {settings.joystickSensitivity}%
                  </span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={150}
                  step={10}
                  value={settings.joystickSensitivity}
                  onChange={(e) =>
                    onUpdateSettings({
                      joystickSensitivity: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-200 mb-1">
                  <span>Center Deadzone</span>
                  <span className="font-mono-tabular text-cyan-300 font-bold">
                    {settings.joystickDeadzone}%
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={25}
                  step={5}
                  value={settings.joystickDeadzone}
                  onChange={(e) =>
                    onUpdateSettings({
                      joystickDeadzone: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* 2. GAMEPLAY CATEGORY */}
        {activeTab === 'gameplay' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/65 p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-white">
                  Acoustic Target Magnetism (Aim Assist)
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  Smoothly guides reticle & cavitation bolts toward nearby hostiles and exposed appendages.
                </p>
              </div>
              <button
                onClick={() =>
                  onUpdateSettings({ aimAssist: !settings.aimAssist })
                }
                className={`min-h-[44px] shrink-0 rounded-xl px-4 text-xs font-bold transition cursor-pointer ${
                  settings.aimAssist
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                    : 'bg-slate-800 text-slate-400 border border-white/10'
                }`}
              >
                {settings.aimAssist ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/65 p-4">
              <div className="flex justify-between text-xs font-medium text-slate-200 mb-1">
                <span>Camera Impact Shake</span>
                <span className="font-mono-tabular text-cyan-300 font-bold">
                  {settings.cameraShakeIntensity}%
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-2">
                Intensity of hull tremors on torpedo hits and deep-pressure surges.
              </p>
              <input
                type="range"
                min={0}
                max={100}
                step={10}
                value={settings.cameraShakeIntensity}
                onChange={(e) =>
                  onUpdateSettings({
                    cameraShakeIntensity: parseInt(e.target.value, 10),
                  })
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* 3. GRAPHICS CATEGORY */}
        {activeTab === 'graphics' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/65 p-4 space-y-4">
              <div>
                <div className="text-sm font-bold text-white">
                  3D Render Quality
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  Balances visual fidelity with mobile battery & thermal performance.
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(
                    [
                      {
                        id: 'low',
                        title: 'Low',
                        desc: 'Battery Saver',
                      },
                      {
                        id: 'medium',
                        title: 'Medium',
                        desc: 'Balanced',
                      },
                      {
                        id: 'high',
                        title: 'High',
                        desc: 'Max Detail',
                      },
                    ] as const
                  ).map((q) => (
                    <button
                      key={q.id}
                      onClick={() =>
                        onUpdateSettings({ graphicsQuality: q.id })
                      }
                      className={`min-h-[56px] rounded-xl border p-3 text-left transition cursor-pointer ${
                        settings.graphicsQuality === q.id
                          ? 'border-cyan-400 bg-cyan-500/20 text-white'
                          : 'border-white/10 bg-slate-950/60 text-slate-400'
                      }`}
                    >
                      <div className="text-xs font-bold">{q.title}</div>
                      <div className="mt-0.5 text-[11px] opacity-80">
                        {q.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-white">
                    Frame Rate Target
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    30 FPS saves battery; 60 FPS gives ultra-smooth combat.
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {([30, 60] as const).map((fps) => (
                    <button
                      key={fps}
                      onClick={() => onUpdateSettings({ fpsCap: fps })}
                      className={`min-h-[44px] rounded-xl border px-3.5 font-mono-tabular text-xs font-bold cursor-pointer ${
                        settings.fpsCap === fps
                          ? 'border-cyan-400 bg-cyan-400 text-slate-950'
                          : 'border-white/10 bg-slate-950/70 text-slate-300'
                      }`}
                    >
                      {fps} FPS
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. AUDIO CATEGORY */}
        {activeTab === 'audio' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/65 p-4 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Volume2 className="h-4 w-4 text-cyan-400" />
                  <span>Master Audio</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  Hydrophone ambience, sonar pings, and weapon audio.
                </p>
              </div>
              <button
                onClick={() => onUpdateSettings({ muted: !settings.muted })}
                className={`min-h-[44px] rounded-xl px-4 text-xs font-bold transition cursor-pointer shrink-0 ${
                  settings.muted
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {settings.muted ? 'Muted' : 'Active'}
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/65 p-4 space-y-4">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-200 mb-1">
                  <span>Master Gain</span>
                  <span className="font-mono-tabular text-cyan-300 font-bold">
                    {settings.masterVolume}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={settings.masterVolume}
                  onChange={(e) =>
                    onUpdateSettings({
                      masterVolume: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-200 mb-1">
                  <span>Ambience</span>
                  <span className="font-mono-tabular text-cyan-300 font-bold">
                    {settings.musicVolume}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={settings.musicVolume}
                  onChange={(e) =>
                    onUpdateSettings({
                      musicVolume: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-200 mb-1">
                  <span>Weapons & Sonar SFX</span>
                  <span className="font-mono-tabular text-cyan-300 font-bold">
                    {settings.sfxVolume}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={settings.sfxVolume}
                  onChange={(e) =>
                    onUpdateSettings({
                      sfxVolume: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-200 mb-1">
                  <span>UI Touch Feedback</span>
                  <span className="font-mono-tabular text-cyan-300 font-bold">
                    {settings.uiVolume}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={settings.uiVolume}
                  onChange={(e) =>
                    onUpdateSettings({
                      uiVolume: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* 5. ACCESSIBILITY CATEGORY */}
        {activeTab === 'accessibility' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/65 p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-white">
                  Reduced Motion Mode
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  Disables camera shake, haptics, and rapid UI transitions.
                </p>
              </div>
              <button
                onClick={() =>
                  onUpdateSettings({
                    reducedMotion: !settings.reducedMotion,
                  })
                }
                className={`min-h-[44px] shrink-0 rounded-xl px-4 text-xs font-bold transition cursor-pointer ${
                  settings.reducedMotion
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-800 text-slate-300 border border-white/10'
                }`}
              >
                {settings.reducedMotion ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        )}

        {/* 6. DATA & PRIVACY CATEGORY */}
        {activeTab === 'data' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/65 p-4 space-y-1.5">
              <div className="text-sm font-bold text-white">
                Offline Device Storage
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                All fleet progression, unlocked submarines, weapons, and medals are saved locally on your device for 100% offline mobile play.
              </p>
            </div>

            <div className="rounded-2xl border border-rose-500/35 bg-rose-950/15 p-4 space-y-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-rose-300">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Reset Career Progress</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-300">
                  Clears unlocked ships, mission ranks, and credits back to starter state.
                </p>
              </div>

              {!confirmReset ? (
                <button
                  onClick={() => setConfirmReset(true)}
                  className="min-h-[44px] w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 text-xs font-bold text-rose-200 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset Save Data
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      onResetSave();
                      setConfirmReset(false);
                      onClose();
                    }}
                    className="min-h-[44px] rounded-xl bg-rose-500 px-4 text-xs font-bold text-white cursor-pointer"
                  >
                    Confirm Wipe
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="min-h-[44px] rounded-xl bg-slate-800 px-4 text-xs font-semibold text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
