import React from 'react';
import { AppendageSlot, BossAppendageState, StageId } from '../game/types';

interface BossAppendageSchematicProps {
  stageId: StageId;
  bossName: string;
  bossSubtitle: string;
  bossHp: number;
  bossMaxHp: number;
  bossPhase: 1 | 2 | 3;
  appendages: BossAppendageState[];
  lastSeveredPartName: string | null;
  sonarActive?: boolean;
  sonarWeakPointSlot?: AppendageSlot | 'core' | null;
  onFocusAppendage?: (slot: AppendageSlot) => void;
}

export const BossAppendageSchematic: React.FC<BossAppendageSchematicProps> = ({
  bossName,
  bossHp,
  bossMaxHp,
  bossPhase,
  appendages,
  sonarActive = false,
  sonarWeakPointSlot = null,
  onFocusAppendage,
}) => {
  const coreHpRatio = Math.max(
    0,
    Math.min(100, (bossHp / Math.max(1, bossMaxHp)) * 100),
  );
  const isCoreSonarWeakPoint = sonarActive && sonarWeakPointSlot === 'core';

  return (
    <div
      className="
        pointer-events-auto flex w-full max-w-[420px] flex-col gap-1.5
        rounded-lg border border-sky-400/25 bg-[#061224]/88 px-3.5 py-2 shadow-lg
      "
    >
      {/* Slim Single-Line Boss Header & Core Health Bar */}
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 truncate">
          <span className="font-display font-bold text-white truncate">
            {bossName}
          </span>
          <span className="font-mono-tabular text-[11px] font-semibold text-rose-400">
            Phase {bossPhase}/3
          </span>
        </div>

        <span className="font-mono-tabular text-xs font-bold text-rose-300 shrink-0">
          {bossHp} HP
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-sm bg-slate-950">
        <div
          className={`h-full transition-all duration-150 ${
            isCoreSonarWeakPoint ? 'bg-cyan-400' : 'bg-rose-500'
          }`}
          style={{ width: `${coreHpRatio}%` }}
        />
      </div>

      {/* Ultra-Compact 4-Appendage Inline Strip (No Middle Screen Occlusion) */}
      {appendages.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5 pt-0.5">
          {appendages.map((part) => {
            const pct = Math.max(
              0,
              Math.min(100, Math.round((part.hp / Math.max(1, part.maxHp)) * 100)),
            );
            return (
              <button
                key={part.id}
                type="button"
                onClick={() => onFocusAppendage?.(part.slot)}
                title={`${part.name} (${part.tacticalEffect})`}
                className={`
                  flex cursor-pointer flex-col gap-0.5 rounded border px-1.5
                  py-1 text-left transition-colors
                  ${
                    part.destroyed
                      ? 'border-rose-500/30 bg-rose-950/30 opacity-60'
                      : part.isSonarWeakPoint
                        ? 'border-cyan-300 bg-cyan-950/60'
                        : part.isCritical
                          ? 'border-amber-400/70 bg-amber-950/40'
                          : 'border-sky-400/20 bg-slate-950/70 hover:border-cyan-400/50'
                  }
                `}
              >
                <div className="flex items-center justify-between gap-1 font-mono-tabular text-[10px]">
                  <span className="uppercase text-slate-300 truncate">
                    {part.slot.slice(0, 4)}
                  </span>
                  <span
                    className={`font-semibold ${
                      part.destroyed
                        ? 'text-rose-400'
                        : part.isSonarWeakPoint
                          ? 'text-cyan-300'
                          : part.isCritical
                            ? 'text-amber-300'
                            : 'text-emerald-400'
                    }`}
                  >
                    {part.destroyed ? 'OUT' : `${pct}%`}
                  </span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-sm bg-slate-950">
                  <div
                    className="h-full transition-all duration-100"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: part.destroyed
                        ? '#F43F5E'
                        : part.isSonarWeakPoint
                          ? '#22D3EE'
                          : part.isCritical
                            ? '#F59E0B'
                            : '#10B981',
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
