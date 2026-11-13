import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Check,
  Compass,
  Crosshair,
  Flame,
  Gamepad2,
  Lock,
  Play,
  RotateCcw,
  Shield,
  Sliders,
  Sparkles,
  Target,
  Trophy,
  User,
  Volume2,
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
 * SECTOR ENVIRONMENTAL ARTWORK BANNER (3 Visually Distinct Abyssal Environments)
 * ========================================================================== */
const SectorEnvironmentBanner: React.FC<{
  stageId: StageId;
  hasBoss: boolean;
  bossName: string;
}> = ({ stageId, hasBoss, bossName }) => {
  if (stageId === 1) {
    return (
      <div className="relative h-32 w-full rounded-xl overflow-hidden border border-cyan-400/35 bg-gradient-to-r from-cyan-950 via-slate-950 to-emerald-950">
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
          <path
            d="M70,140 Q85,90 75,55 M95,140 Q110,95 105,65 M430,140 Q445,88 435,48"
            stroke="#22d3ee"
            strokeWidth="2.5"
            fill="none"
            opacity="0.45"
          />
        </svg>
        <div className="relative z-10 h-full p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="rounded bg-cyan-500/20 border border-cyan-400/40 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-cyan-200">
              Sector 01 · Bioluminescent Reef Shelf (2,200m – 2,650m)
            </span>
            {hasBoss && (
              <span className="rounded bg-rose-500/25 border border-rose-400/50 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-rose-200">
                Apex Target: {bossName}
              </span>
            )}
          </div>
          <div className="text-xs text-cyan-100/90 font-medium">
            High ambient bioluminescence · Dense siphonophore colonies & acoustic kelp pillars
          </div>
        </div>
      </div>
    );
  }

  if (stageId === 2) {
    return (
      <div className="relative h-32 w-full rounded-xl overflow-hidden border border-amber-500/40 bg-gradient-to-r from-amber-950 via-rose-950 to-slate-950">
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
          <circle cx="515" cy="50" r="28" fill="#f43f5e" opacity="0.25" />
        </svg>
        <div className="relative z-10 h-full p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="rounded bg-amber-500/20 border border-amber-400/40 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-amber-200">
              Sector 02 · Hydrothermal Volcanic Trench (4,100m – 4,850m)
            </span>
            {hasBoss && (
              <span className="rounded bg-rose-500/25 border border-rose-400/50 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-rose-200">
                Apex Target: {bossName}
              </span>
            )}
          </div>
          <div className="text-xs text-amber-100/90 font-medium">
            Superheated black-smoker vents · Basalt spires & thermal pressure surges
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-32 w-full rounded-xl overflow-hidden border border-fuchsia-500/40 bg-gradient-to-r from-fuchsia-950 via-indigo-950 to-slate-950">
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
        <circle
          cx="290"
          cy="65"
          r="42"
          fill="none"
          stroke="#e879f9"
          strokeWidth="1.5"
          strokeDasharray="6 4"
          opacity="0.45"
        />
      </svg>
      <div className="relative z-10 h-full p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="rounded bg-fuchsia-500/20 border border-fuchsia-400/40 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-fuchsia-200">
            Sector 03 · Hadal Xeno-Abyssal Vault (7,400m – 8,200m)
          </span>
          {hasBoss && (
            <span className="rounded bg-rose-500/25 border border-rose-400/50 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-rose-200">
              Apex Target: {bossName}
            </span>
          )}
        </div>
        <div className="text-xs text-fuchsia-100/90 font-medium">
          Crushing hadal pressure · Crystalline xeno-structures & apex bio-electric anomalies
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 1. CAMPAIGN & MISSION SELECTION — OCEAN SECTOR TACTICAL MAP
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
  const fleetPower = calculateFleetPower(save);

  // Determine the player's next recommended un-cleared campaign mission
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

  return (
    <div className="relative h-full w-full flex flex-col lg:flex-row justify-between overflow-hidden pointer-events-none select-none">
      {/* Left Side: Live 3D Submarine Launch Tube View + Sector Telemetry */}
      <div className="hidden lg:flex lg:w-[36%] xl:w-[40%] h-full flex-col justify-between p-8 pointer-events-none">
        <div className="max-w-sm bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-transparent pl-4 pr-6 py-4 rounded-r-2xl border-l-4 border-cyan-400">
          <div className="text-xs font-bold uppercase tracking-wider text-cyan-400">
            Bathymetric Theatre Command
          </div>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
            Ocean Sector Map
          </h1>
          <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
            Navigate the three abyssal depth strata. Select a connected mission node on the tactical map to inspect its environmental profile and launch your craft.
          </p>
        </div>

        {/* Next Available Mission Callout */}
        <div className="pointer-events-auto max-w-sm bg-gradient-to-r from-slate-950/92 via-slate-950/75 to-transparent pl-4 pr-6 py-4 rounded-r-2xl border-l-4 border-emerald-400">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-emerald-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Next Priority Sortie</span>
          </div>
          {(() => {
            const nextM =
              MISSION_CATALOG.find((m) => m.id === nextRecommendedMissionId) ||
              MISSION_CATALOG[0];
            return (
              <div className="mt-1">
                <div className="text-base font-bold text-white">
                  {nextM.title} (Stage {nextM.stageId}-{nextM.missionNumber})
                </div>
                <button
                  onClick={() => {
                    setTab('campaign');
                    onSelectStage(nextM.stageId);
                    onSelectMission(nextM.id);
                  }}
                  className="mt-2 rounded-lg bg-emerald-500/20 border border-emerald-400/50 px-3 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30 transition cursor-pointer"
                >
                  Focus Next Available Node
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Right Side: Interactive Bathymetric Map & Mission Briefing Dossier */}
      <div className="pointer-events-auto w-full lg:w-[64%] xl:w-[60%] h-full bg-gradient-to-l from-slate-950/96 via-slate-950/92 to-slate-950/78 border-l border-white/10 flex flex-col justify-between p-5 sm:p-6 overflow-y-auto">
        <div>
          {/* Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-400/35 text-cyan-300">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-cyan-400">
                  Sector Progression & Sorties
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  Abyssal Campaign & Special Operations
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-slate-900/90 border border-white/10 px-3 py-1.5 font-mono text-xs">
                <span className="text-slate-400">Fleet Power: </span>
                <span className="font-bold text-cyan-300">{fleetPower} PWR</span>
              </div>
              <button
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Berth
              </button>
            </div>
          </div>

          {/* Mode Switch & Threat Level Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 my-4">
            <div className="flex rounded-xl bg-slate-900/90 p-1 border border-white/10">
              <button
                onClick={() => setTab('campaign')}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                  tab === 'campaign'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Ocean Sectors (9 Sorties)
              </button>
              <button
                onClick={() => {
                  setTab('special');
                  onSelectMission('flight_school_01');
                }}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                  tab === 'special'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Flight School & Boss Rematches (4)
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 mr-1">Difficulty:</span>
              {(['story', 'normal', 'elite'] as DifficultyId[]).map((diff) => {
                const cfg = DIFFICULTY_CONFIGS[diff];
                const active = save.selectedDifficulty === diff;
                return (
                  <button
                    key={diff}
                    onClick={() => onSelectDifficulty(diff)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                      active
                        ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 font-bold'
                        : 'bg-white/5 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cfg.name} ({Math.round(cfg.rewardMult * 100)}%)
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3 VISUALLY DISTINCT ABYSSAL OCEAN SECTOR TABS */}
          {tab === 'campaign' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
              {(
                [
                  {
                    id: 1 as StageId,
                    zone: 'Sector 01 · 2,400m',
                    theme: 'border-cyan-400/60 from-cyan-950/50 to-slate-950',
                    accent: 'text-cyan-300',
                  },
                  {
                    id: 2 as StageId,
                    zone: 'Sector 02 · 4,500m',
                    theme: 'border-amber-400/60 from-amber-950/50 to-slate-950',
                    accent: 'text-amber-300',
                  },
                  {
                    id: 3 as StageId,
                    zone: 'Sector 03 · 7,800m',
                    theme:
                      'border-fuchsia-400/60 from-fuchsia-950/50 to-slate-950',
                    accent: 'text-fuchsia-300',
                  },
                ] as const
              ).map((sec) => {
                const st = STAGE_CONFIGS[sec.id];
                const selected = selectedStage === sec.id;
                const stageMissions = MISSION_CATALOG.filter(
                  (m) => m.category === 'campaign' && m.stageId === sec.id,
                );
                const clearedCount = stageMissions.filter(
                  (m) => save.missionRecords[m.id]?.cleared,
                ).length;

                return (
                  <button
                    key={sec.id}
                    onClick={() => {
                      onSelectStage(sec.id);
                      const firstInStage = stageMissions[0];
                      if (firstInStage) onSelectMission(firstInStage.id);
                    }}
                    className={`rounded-xl p-3.5 text-left transition cursor-pointer border bg-gradient-to-br ${
                      selected
                        ? `${sec.theme} shadow-[0_0_25px_rgba(6,182,212,0.2)]`
                        : 'border-white/10 from-slate-900/60 to-slate-950 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-mono text-[10px] font-bold uppercase ${sec.accent}`}
                      >
                        {sec.zone}
                      </span>
                      <span className="font-mono text-[10px] text-slate-300">
                        {clearedCount}/3 Cleared
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-bold text-white truncate">
                      {st.title}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400 truncate">
                      Boss: {st.bossName}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* INTERACTIVE TACTICAL NODE PROGRESSION MAP */}
          <div className="relative rounded-2xl border border-white/10 bg-slate-900/70 p-4 mb-4 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-300">
                {tab === 'campaign'
                  ? `Sector 0${selectedStage} Bathymetric Sortie Chain`
                  : 'Special Simulation & Leviathan Rematch Nodes'}
              </span>
              <span className="font-mono text-[11px] text-cyan-300">
                Click any node to inspect briefing
              </span>
            </div>

            {/* Connected Horizontal Node Track */}
            <div className="relative grid grid-cols-1 sm:grid-cols-3 md:grid-cols-3 gap-3">
              {visibleMissions.map((mission, idx) => {
                const unlocked = isMissionUnlocked(mission.id, save);
                const record = save.missionRecords[mission.id];
                const completed = Boolean(record?.cleared);
                const rank = record?.bestRank;
                const active = activeMission.id === mission.id;
                const isNextAvailable =
                  mission.id === nextRecommendedMissionId && !completed;

                return (
                  <div
                    key={mission.id}
                    onClick={() => onSelectMission(mission.id)}
                    className={`relative rounded-xl p-3.5 transition cursor-pointer border flex flex-col justify-between ${
                      active
                        ? 'border-cyan-400 bg-cyan-500/20 shadow-[0_0_24px_rgba(6,182,212,0.25)]'
                        : isNextAvailable
                        ? 'border-emerald-400/70 bg-emerald-950/25'
                        : unlocked
                        ? 'border-white/15 bg-slate-950/75 hover:border-white/30'
                        : 'border-white/5 bg-slate-950/40 opacity-55'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-bold uppercase text-cyan-300">
                          {mission.category === 'campaign'
                            ? `Node 0${idx + 1} · Sortie ${mission.stageId}-${
                                mission.missionNumber
                              }`
                            : mission.category === 'flight_school'
                            ? 'Training Node'
                            : `Rematch 0${mission.stageId}`}
                        </span>
                        {rank ? (
                          <span className="rounded bg-amber-400/20 border border-amber-400/50 px-1.5 py-0.5 font-mono text-xs font-black text-amber-300">
                            {rank}
                          </span>
                        ) : !unlocked ? (
                          <Lock className="h-3.5 w-3.5 text-slate-500" />
                        ) : null}
                      </div>

                      <h4 className="mt-1.5 text-sm font-bold text-white">
                        {mission.title}
                      </h4>
                      <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-1">
                        {mission.subtitle}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
                      {mission.hasBossFinale ? (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-rose-300">
                          <Target className="h-3 w-3" /> Boss Finale
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] text-slate-400">
                          Rec. {mission.recommendedPower} PWR
                        </span>
                      )}

                      {isNextAvailable ? (
                        <span className="rounded bg-emerald-400 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-slate-950">
                          NEXT UP
                        </span>
                      ) : completed ? (
                        <span className="font-mono text-[10px] font-bold text-emerald-400">
                          ✓ CLEARED
                        </span>
                      ) : unlocked ? (
                        <span className="font-mono text-[10px] text-cyan-300">
                          UNLOCKED
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] text-slate-500">
                          LOCKED
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ENVIRONMENTAL BRIEFING & OBJECTIVES DOSSIER */}
          <div className="space-y-3">
            <SectorEnvironmentBanner
              stageId={activeMission.stageId}
              hasBoss={activeMission.hasBossFinale}
              bossName={stageCfg.bossName}
            />

            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-cyan-400">
                    {activeMission.subtitle}
                  </div>
                  <h3 className="text-xl font-black text-white">
                    {activeMission.title}
                  </h3>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs">
                  <span
                    className={`rounded-lg px-2.5 py-1 font-bold border ${
                      fleetPower >= activeMission.recommendedPower
                        ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                        : 'border-amber-400/40 bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    Recommended: {activeMission.recommendedPower} PWR
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {activeMission.briefing}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10 text-xs">
                <div className="rounded-xl bg-slate-950/60 p-3 border border-cyan-500/20">
                  <div className="text-[11px] font-bold uppercase text-cyan-400">
                    Primary Objective
                  </div>
                  <div className="mt-1 font-semibold text-white">
                    {activeMission.primaryObjectiveText}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-950/60 p-3 border border-amber-500/20">
                  <div className="text-[11px] font-bold uppercase text-amber-300">
                    Optional Bonus Directive
                  </div>
                  <div className="mt-1 text-slate-200">
                    {activeMission.optionalObjectiveText}
                  </div>
                </div>
              </div>

              {/* Reward Preview */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 font-mono text-xs">
                <span className="text-amber-300 font-bold">
                  First Clear: +{activeMission.firstClearCredits} CR · +
                  {activeMission.firstClearMaterials} Alloy · +
                  {activeMission.xpReward} XP
                </span>
                <span className="text-cyan-300">
                  Replay Cap: +{activeMission.repeatClearCredits} CR
                </span>
                {activeRecord && (
                  <span className="text-emerald-300">
                    Best Medal: {activeRecord.bestRank} (
                    {activeRecord.bestScore.toLocaleString()} PTS)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Launch Sortie Action */}
        <div className="mt-4 pt-3.5 border-t border-white/10">
          <button
            onClick={() => isActiveUnlocked && onLaunchMission(activeMission)}
            disabled={!isActiveUnlocked}
            className={`w-full rounded-xl py-3.5 text-sm font-black uppercase tracking-wider transition flex items-center justify-center gap-2 ${
              isActiveUnlocked
                ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-[0_0_30px_rgba(6,182,212,0.45)] cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isActiveUnlocked ? (
              <>
                <Play className="h-4 w-4 fill-current" />
                LAUNCH MISSION · {activeMission.title}
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                COMPLETE PREVIOUS NODE TO UNLOCK
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. DIRECTIVES & ACHIEVEMENTS — COHESIVE PROGRESSION INTERFACE
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
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const nextLevelXp = getXpForNextLevel(save.pilotLevel);

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

    // Sort claimable achievements first, then in-progress, then claimed
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
    <div className="relative h-full w-full flex flex-col lg:flex-row justify-between overflow-hidden pointer-events-none select-none">
      {/* Left Side: Pilot Rank & Daily Directives Spotlight */}
      <div className="hidden lg:flex lg:w-[40%] xl:w-[44%] h-full flex-col justify-between p-8 pointer-events-none">
        <div className="max-w-md bg-gradient-to-r from-slate-950/90 via-slate-950/65 to-transparent pl-4 pr-6 py-4 rounded-r-2xl border-l-4 border-amber-400">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Vanguard Service Progression
          </div>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
            Directives & Commendations
          </h1>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
            <span>
              Commander <strong>{save.callsign}</strong> · Level{' '}
              {save.pilotLevel}
            </span>
            <span className="font-mono text-cyan-300">
              {save.pilotXp} / {nextLevelXp} XP
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-cyan-400"
              style={{
                width: `${Math.min(100, (save.pilotXp / nextLevelXp) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Milestone Summary Ribbon */}
        <div className="max-w-md bg-gradient-to-r from-slate-950/90 via-slate-950/65 to-transparent pl-4 pr-6 py-4 rounded-r-2xl border-l-4 border-cyan-400">
          <div className="text-xs font-semibold text-cyan-300">
            Milestone Completion
          </div>
          <div className="mt-1 text-2xl font-black text-white">
            {save.claimedAchievements.length} / {ACHIEVEMENT_CATALOG.length}{' '}
            <span className="text-sm font-normal text-slate-400">
              Commendations Claimed
            </span>
          </div>
        </div>
      </div>

      {/* Right Side: Cohesive Directives & Category-Filtered Achievements */}
      <div className="pointer-events-auto w-full lg:w-[60%] xl:w-[56%] h-full bg-gradient-to-l from-slate-950/96 via-slate-950/92 to-slate-950/78 border-l border-white/10 flex flex-col justify-between p-5 sm:p-6 overflow-y-auto">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-400/35 text-amber-300">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-amber-400">
                  Vanguard Progression Hub
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  Directives & Career Milestones
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onOpenProfile && (
                <button
                  onClick={onOpenProfile}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 border border-cyan-400/35 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25 transition cursor-pointer"
                >
                  <User className="h-3.5 w-3.5" />
                  Pilot & Fleet Dossier
                </button>
              )}
              <button
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Berth
              </button>
            </div>
          </div>

          {/* 1. DAILY TRENCH DIRECTIVES */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Active Daily Directives ({save.dailyDateKey})
              </span>
              <span className="text-xs text-slate-400">
                Resets at 00:00 Local
              </span>
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
                        ? 'border-amber-400 bg-amber-500/15 shadow-[0_0_25px_rgba(245,158,11,0.2)]'
                        : claimed
                        ? 'border-emerald-500/30 bg-emerald-950/15 opacity-75'
                        : 'border-white/10 bg-slate-900/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">
                          {daily.title}
                        </span>
                        <span className="font-mono text-amber-300 font-bold">
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

                    <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-amber-300">
                        +{daily.rewardCredits} CR
                        {daily.rewardMaterials > 0
                          ? ` +${daily.rewardMaterials}M`
                          : ''}
                      </span>
                      {claimed ? (
                        <span className="text-xs font-bold text-emerald-400">
                          ✓ Claimed
                        </span>
                      ) : (
                        <button
                          onClick={() => ready && onClaimDaily(daily.id)}
                          disabled={!ready}
                          className={`rounded-lg px-3 py-1 text-xs font-bold uppercase ${
                            ready
                              ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {ready ? 'Claim Bounty' : `${pct}%`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. CAREER ACHIEVEMENTS WITH CATEGORY FILTERING */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                Service Commendations & Milestones
              </span>
              <div className="flex flex-wrap gap-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-cyan-400 text-slate-950 font-bold'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
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
                    className={`rounded-xl p-3.5 flex items-center justify-between gap-4 border-l-4 transition ${
                      ready
                        ? 'border-l-cyan-400 bg-cyan-500/15 border border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                        : claimed
                        ? 'border-l-emerald-400 bg-emerald-950/15 border border-emerald-500/25'
                        : 'border-l-transparent bg-slate-900/55 border border-white/5'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-cyan-300">
                          {ach.category}
                        </span>
                        <h4 className="text-sm font-bold text-white truncate">
                          {ach.title}
                        </h4>
                        <span className="ml-auto font-mono text-xs text-slate-300">
                          {Math.min(progress, ach.targetValue)} /{' '}
                          {ach.targetValue}
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

                    <div className="shrink-0 text-right">
                      <div className="font-mono text-[11px] font-bold text-amber-300 mb-1.5">
                        +{ach.rewardCredits} CR · +{ach.rewardMaterials}M · +
                        {ach.rewardXp} XP
                      </div>
                      {claimed ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
                          <Check className="h-3.5 w-3.5" /> Claimed
                        </span>
                      ) : (
                        <button
                          onClick={() => ready && onClaimAchievement(ach.id)}
                          disabled={!ready}
                          className={`rounded-lg px-4 py-1.5 text-xs font-bold uppercase ${
                            ready
                              ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-[0_0_16px_rgba(6,182,212,0.4)] cursor-pointer'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {ready ? 'Claim Reward' : 'In Progress'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. PILOT PROFILE, CAREER TELEMETRY & FLEET COLLECTION
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
    <div className="relative h-full w-full flex justify-end overflow-hidden pointer-events-none select-none">
      <div className="pointer-events-auto w-full lg:w-[600px] xl:w-[660px] h-full bg-gradient-to-l from-slate-950/96 via-slate-950/92 to-slate-950/75 border-l border-white/10 flex flex-col justify-between p-5 sm:p-7 overflow-y-auto">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-400/35 text-cyan-300">
                <User className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-cyan-400">
                  Vanguard Progression Hub
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Commander {save.callsign}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onOpenObjectives && (
                <button
                  onClick={onOpenObjectives}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-400/35 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 transition cursor-pointer"
                >
                  <Trophy className="h-3.5 w-3.5" />
                  Directives & Milestones
                </button>
              )}
              <button
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Berth
              </button>
            </div>
          </div>

          {/* Pilot Rank Banner & Callsign Registry */}
          <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/90 via-slate-950 to-slate-950 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                  Commission Rank · Fleet Power {fleetPower} PWR
                </span>
                <div className="mt-0.5 text-2xl font-black text-white">
                  Level {save.pilotLevel} Abyssal Commander
                </div>
              </div>
              <div className="font-mono text-right">
                <div className="text-xs text-slate-400">Experience</div>
                <div className="text-sm font-bold text-cyan-300">
                  {save.pilotXp} / {nextLevelXp} XP
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
              className="pt-3 border-t border-white/10 flex flex-wrap items-center gap-2"
            >
              <span className="text-xs text-slate-300 mr-2">
                Update Callsign:
              </span>
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                maxLength={16}
                className="flex-1 min-w-[160px] rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-cyan-400 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-300 cursor-pointer"
              >
                Save Callsign
              </button>
              {errorMsg && (
                <span className="w-full text-xs text-rose-400">{errorMsg}</span>
              )}
              {savedToast && (
                <span className="w-full text-xs text-emerald-400">
                  ✓ Callsign updated in fleet registry.
                </span>
              )}
            </form>
          </div>

          {/* Fleet Collection Showcase */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Submersible Fleet Collection ({save.ownedShips.length}/
                {SHIP_CATALOG.length})
              </span>
              <span className="font-mono text-xs text-cyan-300">
                {save.ownedWeapons.length}/{6} Weapons ·{' '}
                {save.ownedUpgrades.length}/{8} Modules
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {SHIP_CATALOG.map((ship) => {
                const owned = save.ownedShips.includes(ship.id);
                const active = save.selectedShip === ship.id;
                return (
                  <div
                    key={ship.id}
                    className={`rounded-xl p-3 border ${
                      active
                        ? 'border-emerald-400/60 bg-emerald-950/20'
                        : owned
                        ? 'border-cyan-500/35 bg-slate-900/75'
                        : 'border-white/5 bg-slate-950/45 opacity-55'
                    }`}
                  >
                    <div
                      className="text-[10px] font-bold uppercase"
                      style={{ color: ship.accentColor }}
                    >
                      {ship.classLabel}
                    </div>
                    <div className="mt-0.5 text-xs font-bold text-white truncate">
                      {ship.name.replace('Vanguard ', '')}
                    </div>
                    <div className="mt-2 font-mono text-[10px]">
                      {active ? (
                        <span className="text-emerald-300 font-bold">
                          ● Flagship
                        </span>
                      ) : owned ? (
                        <span className="text-cyan-300">Unlocked</span>
                      ) : (
                        <span className="text-slate-500">Locked</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Clean Career Combat Telemetry Ribbons */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5">
              Career Combat Record
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 divide-y divide-white/10 font-mono text-xs">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-slate-400">Sorties Flown / Victories</span>
                <span className="text-white font-bold">
                  {save.stats.totalSortiesLaunched} Flown ·{' '}
                  <span className="text-emerald-300">
                    {save.stats.totalVictories} Cleared
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-slate-400">
                  Abyssal Hostiles & Elites Destroyed
                </span>
                <span className="text-cyan-300 font-bold">
                  {save.stats.totalEnemiesDefeated} Hostiles (
                  {save.stats.totalElitesDefeated} Elites)
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-slate-400">
                  Leviathan Bosses Slain / Appendages Severed
                </span>
                <span className="text-rose-300 font-bold">
                  {save.stats.totalBossesDefeated} Bosses ·{' '}
                  <span className="text-amber-300">
                    {save.stats.totalAppendagesSevered} Appendages
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-slate-400">
                  Tactical Sonar Pulses & Torpedoes Launched
                </span>
                <span className="text-sky-300 font-bold">
                  {save.stats.totalSonarPulsesUsed} Pulses ·{' '}
                  {save.stats.totalTorpedoesFired} Torpedoes
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-slate-400">All-Time High Score</span>
                <span className="text-amber-300 font-bold">
                  {save.highScore.toLocaleString()} PTS
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. SETTINGS — 6-CATEGORY AVIONICS & SYSTEM CONFIGURATION
 *    Categories: Audio | Graphics | Controls | Gameplay | Accessibility | Data & Privacy
 * ========================================================================== */
interface SettingsModalProps {
  settings: GameSettings;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  onResetSave: () => void;
  onClose: () => void;
}

type SettingsCategory =
  | 'audio'
  | 'graphics'
  | 'controls'
  | 'gameplay'
  | 'accessibility'
  | 'data';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onResetSave,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsCategory>('audio');
  const [confirmReset, setConfirmReset] = useState(false);

  const tabs: { id: SettingsCategory; label: string }[] = [
    { id: 'audio', label: 'Audio' },
    { id: 'graphics', label: 'Graphics' },
    { id: 'controls', label: 'Controls' },
    { id: 'gameplay', label: 'Gameplay' },
    { id: 'accessibility', label: 'Accessibility' },
    { id: 'data', label: 'Data & Privacy' },
  ];

  return (
    <div className="relative h-full w-full flex justify-end overflow-hidden pointer-events-none select-none">
      <div className="animate-panel-right pointer-events-auto w-full lg:w-[640px] xl:w-[700px] h-full bg-gradient-to-l from-slate-950/96 via-slate-950/92 to-slate-950/75 border-l border-white/10 flex flex-col justify-between p-5 sm:p-7 overflow-y-auto">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-400/35 text-cyan-300">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-cyan-400">
                  Submersible Avionics & Preferences
                </div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
                  System Settings
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white active:scale-95 transition cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Berth
            </button>
          </div>

          {/* 6 Category Navigation Bar */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 my-5 rounded-xl bg-slate-900/90 p-1.5 border border-white/10">
            {tabs.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`rounded-lg py-2 px-2 text-xs font-semibold transition cursor-pointer truncate ${
                    active
                      ? 'bg-cyan-400 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* 1. AUDIO CATEGORY */}
          {activeTab === 'audio' && (
            <div className="animate-panel-fade space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-900/65 p-5 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Volume2 className="h-4 w-4 text-cyan-400" />
                    <span>Master Acoustic Synthesizer</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Toggle real-time Web Audio procedural hydrophone drones, sonar pings, and weapon audio.
                  </p>
                </div>
                <button
                  onClick={() => onUpdateSettings({ muted: !settings.muted })}
                  className={`min-h-[40px] rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                    settings.muted
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {settings.muted ? 'Audio Muted' : 'Audio Active'}
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900/65 p-5 space-y-5">
                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-200 mb-1.5">
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
                  <div className="flex justify-between text-xs font-medium text-slate-200 mb-1.5">
                    <span>Abyssal Ambient Drone</span>
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
                  <div className="flex justify-between text-xs font-medium text-slate-200 mb-1.5">
                    <span>Ordnance, Torpedoes & Tactical Sonar SFX</span>
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
                  <div className="flex justify-between text-xs font-medium text-slate-200 mb-1.5">
                    <span>Interface & Telemetry Feedback</span>
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

          {/* 2. GRAPHICS CATEGORY */}
          {activeTab === 'graphics' && (
            <div className="animate-panel-fade space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-900/65 p-5 space-y-4">
                <div>
                  <div className="text-sm font-bold text-white">
                    3D Render Quality Preset
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Adjusts WebGL pixel ratio, shadow maps, volumetric floodlights, and marine snow density.
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2.5">
                    {(
                      [
                        {
                          id: 'low',
                          title: 'Low',
                          desc: 'Battery Saver · 1.0x DPR',
                        },
                        {
                          id: 'medium',
                          title: 'Medium',
                          desc: 'Balanced · 1.5x DPR',
                        },
                        {
                          id: 'high',
                          title: 'High',
                          desc: 'Maximum PBR · 2.0x DPR',
                        },
                      ] as const
                    ).map((q) => (
                      <button
                        key={q.id}
                        onClick={() =>
                          onUpdateSettings({ graphicsQuality: q.id })
                        }
                        className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                          settings.graphicsQuality === q.id
                            ? 'border-cyan-400 bg-cyan-500/20 text-white'
                            : 'border-white/10 bg-slate-950/60 text-slate-400 hover:text-slate-200'
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

                <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-white">
                      Target Frame Pacing
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Select 60 FPS for high-refresh combat or 30 FPS for thermal stability on mobile devices.
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {([30, 60] as const).map((fps) => (
                      <button
                        key={fps}
                        onClick={() => onUpdateSettings({ fpsCap: fps })}
                        className={`min-h-[38px] rounded-xl border px-4 py-1.5 font-mono-tabular text-xs font-bold cursor-pointer ${
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

          {/* 3. CONTROLS CATEGORY */}
          {activeTab === 'controls' && (
            <div className="animate-panel-fade space-y-4">
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/15 p-5 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Gamepad2 className="h-4 w-4 text-cyan-400" />
                    <span>On-Screen Virtual Joystick & Touch Triggers</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300">
                    Enable dual-thumb touch flight stick and weapon triggers during active sorties.
                  </p>
                </div>
                <button
                  onClick={() =>
                    onUpdateSettings({
                      touchControlsEnabled: !settings.touchControlsEnabled,
                    })
                  }
                  className={`min-h-[42px] shrink-0 rounded-xl px-5 py-2 text-xs font-bold transition cursor-pointer ${
                    settings.touchControlsEnabled
                      ? 'bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)]'
                      : 'bg-slate-800 text-slate-300 border border-white/10'
                  }`}
                >
                  {settings.touchControlsEnabled ? 'Enabled (ON)' : 'Disabled (OFF)'}
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900/65 p-5 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-2">
                    Touch Ergonomic Layout Preset
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        {
                          id: 'standard',
                          label: 'Standard',
                          sub: 'Left Stick · Right Triggers',
                        },
                        {
                          id: 'left_handed',
                          label: 'Left-Handed',
                          sub: 'Left Triggers · Right Stick',
                        },
                        {
                          id: 'minimal',
                          label: 'Minimal',
                          sub: 'Compact Diegetic Rings',
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
                        className={`rounded-xl border p-3 text-left transition cursor-pointer ${
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
                  <div className="flex justify-between text-xs font-medium text-slate-200 mb-1.5">
                    <span>Virtual Joystick Sensitivity</span>
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
                  <div className="flex justify-between text-xs font-medium text-slate-200 mb-1.5">
                    <span>Center Deadzone Radius</span>
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

          {/* 4. GAMEPLAY CATEGORY */}
          {activeTab === 'gameplay' && (
            <div className="animate-panel-fade space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-900/65 p-5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-white">
                    Acoustic Target Magnetism (Aim Assist)
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Subtly converges primary cavitation bolts toward locked targets and exposed Leviathan appendages.
                  </p>
                </div>
                <button
                  onClick={() =>
                    onUpdateSettings({ aimAssist: !settings.aimAssist })
                  }
                  className={`min-h-[40px] shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                    settings.aimAssist
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                      : 'bg-slate-800 text-slate-400 border border-white/10'
                  }`}
                >
                  {settings.aimAssist ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900/65 p-5">
                <div className="flex justify-between text-xs font-medium text-slate-200 mb-1.5">
                  <span>Hydro-Impact & Explosion Camera Shake</span>
                  <span className="font-mono-tabular text-cyan-300 font-bold">
                    {settings.cameraShakeIntensity}%
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Controls cockpit recoil intensity during torpedo detonations, hull collisions, and deep-pressure tremors.
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

          {/* 5. ACCESSIBILITY CATEGORY */}
          {activeTab === 'accessibility' && (
            <div className="animate-panel-fade space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-900/65 p-5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-white">
                    Reduced Motion Mode
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Eliminates camera shake, rapid UI transitions, and excessive hull bobbing across both 3D combat and Hangar menus.
                  </p>
                </div>
                <button
                  onClick={() =>
                    onUpdateSettings({
                      reducedMotion: !settings.reducedMotion,
                    })
                  }
                  className={`min-h-[40px] shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                    settings.reducedMotion
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-800 text-slate-300 border border-white/10'
                  }`}
                >
                  {settings.reducedMotion ? 'Reduced Motion ON' : 'Standard Motion'}
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900/65 p-5 space-y-2">
                <div className="text-sm font-bold text-white">
                  Visual Telemetry & Color Semantics
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Pelagic Vanguard uses distinct semantic color channels and shape markers for accessibility:
                </p>
                <div className="grid grid-cols-2 gap-2.5 pt-2 text-xs">
                  <div className="rounded-xl bg-slate-950/70 p-3 border border-cyan-500/30">
                    <span className="font-bold text-cyan-300">
                      Biolume Cyan / Emerald
                    </span>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Shields, Hull Integrity & Sonar Weak Points
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-950/70 p-3 border border-amber-500/30">
                    <span className="font-bold text-amber-300">
                      Thermal Orange / Crimson
                    </span>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Hull Stress, Torpedo Locks & Critical Boss Warnings
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 6. DATA & PRIVACY CATEGORY */}
          {activeTab === 'data' && (
            <div className="animate-panel-fade space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-900/65 p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">
                    Local Fleet Storage & Privacy
                  </span>
                  <span className="rounded bg-emerald-500/20 px-2.5 py-0.5 font-mono-tabular text-[11px] font-bold text-emerald-300">
                    SCHEMA v3 ACTIVE
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  All pilot progression, unlocked submarines, weapon loadouts, and mission medals are stored locally on your device (`pelagic_vanguard_save_v3`) and function 100% offline. No personal telemetry is transmitted externally.
                </p>
              </div>

              <div className="rounded-2xl border border-rose-500/35 bg-rose-950/15 p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-rose-300">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Reset Pilot Career Data</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300">
                    Permanently clears unlocked ships, mission records, and salvage credits back to starter state.
                  </p>
                </div>

                {!confirmReset ? (
                  <button
                    onClick={() => setConfirmReset(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-2.5 text-xs font-bold text-rose-200 hover:bg-rose-500/25 transition cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset Save Data
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onResetSave();
                        setConfirmReset(false);
                        onClose();
                      }}
                      className="rounded-xl bg-rose-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-400 cursor-pointer"
                    >
                      Confirm Career Wipe
                    </button>
                    <button
                      onClick={() => setConfirmReset(false)}
                      className="rounded-xl bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <span>Settings apply in real time and persist automatically</span>
          <button
            onClick={onClose}
            className="rounded-xl bg-cyan-400 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 transition cursor-pointer"
          >
            Save & Return
          </button>
        </div>
      </div>
    </div>
  );
};

