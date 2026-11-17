import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Crosshair,
  Flame,
  Radar,
  RotateCw,
  Sparkles,
  Zap,
} from 'lucide-react';
import { CameraMode, GameSettings, HudSnapshot } from '../game/types';

interface TouchControlsOverlayProps {
  hud: HudSnapshot;
  settings: GameSettings;
  cameraMode: CameraMode;
  onTouchMove: (x: number, y: number) => void;
  onTouchFire: (firing: boolean) => void;
  onToggleAutoFire: () => void;
  onToggleCamera: () => void;
  onTriggerBarrelRoll: () => void;
  onTriggerTorpedoSalvo: () => void;
  onTriggerTacticalSonar: () => void;
  onTriggerShipAbility: () => void;
}

export const TouchControlsOverlay: React.FC<TouchControlsOverlayProps> = ({
  hud,
  settings,
  cameraMode,
  onTouchMove,
  onTouchFire,
  onToggleAutoFire,
  onToggleCamera,
  onTriggerBarrelRoll,
  onTriggerTorpedoSalvo,
  onTriggerTacticalSonar,
  onTriggerShipAbility,
}) => {
  const stickBaseRef = useRef<HTMLDivElement | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [isFiring, setIsFiring] = useState(false);
  const activePointerIdRef = useRef<number | null>(null);

  const pulseHaptic = (ms = 12) => {
    if (
      settings.hapticsEnabled &&
      !settings.reducedMotion &&
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    ) {
      try {
        navigator.vibrate(ms);
      } catch {
        // Ignore on unsupported devices
      }
    }
  };

  useEffect(() => {
    const resetTouchState = () => {
      activePointerIdRef.current = null;
      setKnobOffset({ x: 0, y: 0 });
      setIsFiring(false);
      onTouchMove(0, 0);
      onTouchFire(false);
    };
    if (!settings.touchControlsEnabled || hud.mode !== 'playing') {
      resetTouchState();
    }
    window.addEventListener('blur', resetTouchState);
    document.addEventListener('visibilitychange', resetTouchState);
    return () => {
      window.removeEventListener('blur', resetTouchState);
      document.removeEventListener('visibilitychange', resetTouchState);
    };
  }, [settings.touchControlsEnabled, hud.mode, onTouchMove, onTouchFire]);

  if (!settings.touchControlsEnabled || hud.mode !== 'playing') {
    return null;
  }

  const isLeftHanded = settings.touchLayout === 'left_handed';
  const isMinimal = settings.touchLayout === 'minimal';
  const maxRadius = 46;

  const updateStickFromEvent = (clientX: number, clientY: number) => {
    const el = stickBaseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(maxRadius, dist);
    const angle = Math.atan2(dy, dx);

    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;
    setKnobOffset({ x: kx, y: ky });

    const normMag = clampedDist / maxRadius;
    const deadzoneNorm = settings.joystickDeadzone / 100;
    if (normMag <= deadzoneNorm) {
      onTouchMove(0, 0);
      return;
    }

    const rescaled =
      (normMag - deadzoneNorm) / Math.max(0.01, 1 - deadzoneNorm);
    const sens = settings.joystickSensitivity / 100;
    const outX = Math.max(-1, Math.min(1, Math.cos(angle) * rescaled * sens));
    const outY = Math.max(-1, Math.min(1, -Math.sin(angle) * rescaled * sens));
    onTouchMove(outX, outY);
  };

  const handleStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointerIdRef.current = e.pointerId;
    pulseHaptic(8);
    updateStickFromEvent(e.clientX, e.clientY);
  };

  const handleStickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    updateStickFromEvent(e.clientX, e.clientY);
  };

  const handleStickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    activePointerIdRef.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onTouchMove(0, 0);
  };

  const sonarReadyPct =
    hud.sonarCooldown > 0
      ? Math.max(0, Math.min(100, (1 - hud.sonarCooldown) * 100))
      : 100;
  const torpReadyPct =
    hud.torpedoCooldown > 0
      ? Math.max(0, Math.min(100, (1 - hud.torpedoCooldown) * 100))
      : 100;
  const abilityReadyPct =
    hud.activeAbilityCooldown > 0
      ? Math.max(0, Math.min(100, (1 - hud.activeAbilityCooldown) * 100))
      : 100;

  const joystickCluster = (
    <div className="pointer-events-auto flex flex-col items-start gap-2">
      {/* Quick Mobile View Switcher above thumbstick */}
      {!isMinimal && (
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            pulseHaptic(10);
            onToggleCamera();
          }}
          className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-white/15 bg-slate-950/70 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-slate-200 active:scale-95 transition cursor-pointer"
        >
          <Camera className="h-3.5 w-3.5 text-cyan-300" />
          <span>{cameraMode === 'chase' ? 'Chase' : 'Cockpit'}</span>
        </button>
      )}

      <div
        ref={stickBaseRef}
        onPointerDown={handleStickPointerDown}
        onPointerMove={handleStickPointerMove}
        onPointerUp={handleStickPointerUp}
        onPointerCancel={handleStickPointerUp}
        className="relative flex h-28 w-28 sm:h-32 sm:w-32 touch-none items-center justify-center rounded-full border border-cyan-400/40 bg-slate-950/65 backdrop-blur-sm shadow-[0_0_28px_rgba(6,182,212,0.18)]"
      >
        <div className="h-14 w-14 rounded-full border border-dashed border-cyan-400/25" />
        <div className="pointer-events-none absolute inset-2 rounded-full border border-white/5" />
        <div
          className="pointer-events-none absolute h-12 w-12 rounded-full border-2 border-cyan-300 bg-gradient-to-b from-cyan-400/55 to-sky-500/35 shadow-[0_0_16px_rgba(34,211,238,0.45)] flex items-center justify-center"
          style={{
            transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
          }}
        >
          <div className="h-2.5 w-2.5 rounded-full bg-white" />
        </div>
      </div>

      {!isMinimal && (
        <span className="pl-2 font-mono-tabular text-[10px] font-medium text-cyan-200/70">
          Steer · Drag Screen to Aim
        </span>
      )}
    </div>
  );

  const actionCluster = (
    <div className="pointer-events-auto flex items-end gap-2 sm:gap-3">
      {/* Secondary Ability 2x2 Grid: Sonar, Evade, Torpedo Salvo, Active Ship Ability */}
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            pulseHaptic(14);
            onTriggerTacticalSonar();
          }}
          className={`relative overflow-hidden flex min-h-[44px] min-w-[78px] sm:min-w-[96px] cursor-pointer touch-none items-center justify-center gap-1 rounded-2xl border px-2 font-mono-tabular text-[11px] font-semibold shadow-lg transition-transform active:scale-95 ${
            hud.sonarActive
              ? 'border-emerald-300 bg-emerald-500/30 text-emerald-100'
              : hud.sonarCooldown > 0
                ? 'border-white/10 bg-slate-950/80 text-slate-400'
                : 'border-emerald-400/50 bg-slate-950/80 text-emerald-300'
          }`}
        >
          {hud.sonarCooldown > 0 && !hud.sonarActive && (
            <span
              className="pointer-events-none absolute inset-y-0 left-0 bg-emerald-400/15"
              style={{ width: `${sonarReadyPct}%` }}
            />
          )}
          <Radar className="relative h-3.5 w-3.5 shrink-0" />
          <span className="relative">
            {hud.sonarActive
              ? `${hud.sonarRemainingSeconds.toFixed(1)}s`
              : hud.sonarCooldown > 0
                ? `${Math.ceil(hud.sonarCooldown * 7.5)}s`
                : 'Sonar'}
          </span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            pulseHaptic(16);
            onTriggerBarrelRoll();
          }}
          className={`flex min-h-[44px] min-w-[78px] sm:min-w-[96px] cursor-pointer touch-none items-center justify-center gap-1 rounded-2xl border px-2 font-mono-tabular text-[11px] font-semibold shadow-lg transition-transform active:scale-95 ${
            hud.barrelRolling
              ? 'border-white bg-cyan-400/30 text-white'
              : 'border-cyan-400/50 bg-slate-950/80 text-cyan-200'
          }`}
        >
          <RotateCw className="h-3.5 w-3.5 shrink-0" />
          <span>Evade</span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            pulseHaptic(18);
            onTriggerTorpedoSalvo();
          }}
          className={`relative overflow-hidden flex min-h-[44px] min-w-[78px] sm:min-w-[96px] cursor-pointer touch-none items-center justify-center gap-1 rounded-2xl border px-2 font-mono-tabular text-[11px] font-semibold shadow-lg transition-transform active:scale-95 ${
            hud.torpedoCooldown > 0
              ? 'border-white/10 bg-slate-950/80 text-slate-400'
              : hud.lockedCount > 0
                ? 'border-amber-300 bg-amber-500/25 text-amber-200 shadow-[0_0_16px_rgba(245,158,11,0.3)]'
                : 'border-amber-400/55 bg-slate-950/80 text-amber-300'
          }`}
        >
          {hud.torpedoCooldown > 0 && (
            <span
              className="pointer-events-none absolute inset-y-0 left-0 bg-amber-400/15"
              style={{ width: `${torpReadyPct}%` }}
            />
          )}
          <Zap className="relative h-3.5 w-3.5 shrink-0" />
          <span className="relative">
            {hud.torpedoCooldown > 0
              ? `${Math.ceil(hud.torpedoCooldown * 3.8)}s`
              : `Torp ${hud.lockedCount}/${hud.maxLocks}`}
          </span>
        </button>

        <button
          type="button"
          aria-label={`Activate ${hud.activeAbilityName}`}
          onPointerDown={(e) => {
            e.stopPropagation();
            pulseHaptic(20);
            onTriggerShipAbility();
          }}
          className={`relative overflow-hidden flex min-h-[44px] min-w-[78px] sm:min-w-[96px] max-w-[116px] cursor-pointer touch-none items-center justify-center gap-1 rounded-2xl border px-2 font-mono-tabular text-[11px] font-semibold shadow-lg transition-transform active:scale-95 ${
            hud.activeAbilityActive
              ? 'border-fuchsia-300 bg-fuchsia-500/35 text-white shadow-[0_0_18px_rgba(217,70,239,0.45)]'
              : hud.activeAbilityCooldown > 0
                ? 'border-white/10 bg-slate-950/80 text-slate-400'
                : 'border-fuchsia-400/60 bg-slate-950/85 text-fuchsia-200 shadow-[0_0_14px_rgba(217,70,239,0.25)]'
          }`}
        >
          {hud.activeAbilityCooldown > 0 && !hud.activeAbilityActive && (
            <span
              className="pointer-events-none absolute inset-y-0 left-0 bg-fuchsia-400/20"
              style={{ width: `${abilityReadyPct}%` }}
            />
          )}
          <Flame className="relative h-3.5 w-3.5 shrink-0" />
          <span className="relative truncate">
            {hud.activeAbilityActive
              ? `${hud.activeAbilityRemainingSeconds.toFixed(1)}s`
              : hud.activeAbilityCooldown > 0
                ? `${hud.activeAbilityCooldownSeconds}s`
                : 'Ability'}
          </span>
        </button>
      </div>

      {/* Primary Fire Trigger + Quick Auto-Fire Switch */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            pulseHaptic(10);
            onToggleAutoFire();
          }}
          className={`flex min-h-[38px] items-center gap-1 rounded-xl border px-3 py-1 text-[11px] font-bold transition active:scale-95 cursor-pointer whitespace-nowrap ${
            settings.autoFire
              ? 'border-emerald-400/70 bg-emerald-500/25 text-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.25)]'
              : 'border-white/15 bg-slate-950/80 text-slate-300'
          }`}
        >
          <Sparkles className="h-3 w-3" />
          <span>{settings.autoFire ? 'Auto: ON' : 'Auto: OFF'}</span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            pulseHaptic(12);
            setIsFiring(true);
            onTouchFire(true);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            setIsFiring(false);
            onTouchFire(false);
          }}
          onPointerCancel={(e) => {
            e.stopPropagation();
            setIsFiring(false);
            onTouchFire(false);
          }}
          className={`flex h-22 w-22 sm:h-26 sm:w-26 cursor-pointer touch-none flex-col items-center justify-center rounded-full border-2 font-display text-sm font-bold shadow-2xl transition-transform ${
            isFiring
              ? 'scale-95 border-white bg-cyan-400 text-slate-950 shadow-[0_0_32px_rgba(34,211,238,0.7)]'
              : settings.autoFire
                ? 'border-emerald-300/80 bg-slate-950/80 text-white shadow-[0_0_24px_rgba(16,185,129,0.3)]'
                : 'border-cyan-400/75 bg-slate-950/80 text-white shadow-[0_0_24px_rgba(6,182,212,0.25)]'
          }`}
        >
          <Crosshair
            className={`h-5 w-5 mb-0.5 ${
              isFiring
                ? 'text-slate-950'
                : settings.autoFire
                  ? 'text-emerald-300'
                  : 'text-cyan-300'
            }`}
          />
          <span>FIRE</span>
          {!isMinimal && (
            <span
              className={`font-mono-tabular text-[10px] font-medium ${
                isFiring
                  ? 'text-slate-900'
                  : settings.autoFire
                    ? 'text-emerald-300/90'
                    : 'text-cyan-200/80'
              }`}
            >
              {settings.autoFire ? 'Hold Boost' : 'Hold'}
            </span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-2 sm:bottom-4 z-30 flex items-end justify-between px-3 sm:px-6 pb-safe px-safe">
      {isLeftHanded ? (
        <>
          {actionCluster}
          {joystickCluster}
        </>
      ) : (
        <>
          {joystickCluster}
          {actionCluster}
        </>
      )}
    </div>
  );
};
