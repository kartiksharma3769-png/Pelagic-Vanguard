import React, { useEffect, useRef, useState } from 'react';
import { Crosshair, Radar, RotateCw, Zap } from 'lucide-react';
import { GameSettings, HudSnapshot } from '../game/types';

interface TouchControlsOverlayProps {
  hud: HudSnapshot;
  settings: GameSettings;
  onTouchMove: (x: number, y: number) => void;
  onTouchFire: (firing: boolean) => void;
  onTriggerBarrelRoll: () => void;
  onTriggerTorpedoSalvo: () => void;
  onTriggerTacticalSonar: () => void;
}

export const TouchControlsOverlay: React.FC<TouchControlsOverlayProps> = ({
  hud,
  settings,
  onTouchMove,
  onTouchFire,
  onTriggerBarrelRoll,
  onTriggerTorpedoSalvo,
  onTriggerTacticalSonar,
}) => {
  const stickBaseRef = useRef<HTMLDivElement | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [isFiring, setIsFiring] = useState(false);
  const activePointerIdRef = useRef<number | null>(null);

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
  const maxRadius = 50;

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

  const joystickCluster = (
    <div className="pointer-events-auto flex flex-col items-center gap-1.5">
      <div
        ref={stickBaseRef}
        onPointerDown={handleStickPointerDown}
        onPointerMove={handleStickPointerMove}
        onPointerUp={handleStickPointerUp}
        onPointerCancel={handleStickPointerUp}
        className="relative flex h-28 w-28 sm:h-32 sm:w-32 touch-none items-center justify-center rounded-full border border-cyan-400/40 bg-slate-950/70 shadow-[0_0_30px_rgba(6,182,212,0.18)]"
      >
        {/* Inner Diegetic Compass Ring */}
        <div className="h-14 w-14 rounded-full border border-dashed border-cyan-400/25" />
        {/* Thumb Stick Knob */}
        <div
          className="pointer-events-none absolute h-12 w-12 rounded-full border-2 border-cyan-300 bg-gradient-to-b from-cyan-400/50 to-sky-500/30 shadow-[0_0_16px_rgba(34,211,238,0.45)] flex items-center justify-center"
          style={{
            transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
          }}
        >
          <div className="h-2 w-2 rounded-full bg-white" />
        </div>
      </div>
      {!isMinimal && (
        <span className="font-mono-tabular text-[10px] font-medium tracking-wider text-cyan-200/70">
          Pitch & Yaw
        </span>
      )}
    </div>
  );

  const actionCluster = (
    <div className="pointer-events-auto flex items-end gap-3.5">
      {/* Secondary Ability Arc Column: Sonar, Barrel Roll, Torpedo Salvo */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onTriggerTacticalSonar();
          }}
          className={`flex min-h-[44px] min-w-[108px] cursor-pointer touch-none items-center justify-center gap-1.5 rounded-full border px-3.5 font-mono-tabular text-xs font-semibold shadow-lg transition-transform active:scale-95 ${
            hud.sonarActive
              ? 'border-emerald-300 bg-emerald-500/30 text-emerald-100'
              : hud.sonarCooldown > 0
                ? 'border-white/10 bg-slate-950/80 text-slate-400'
                : 'border-emerald-400/50 bg-slate-950/80 text-emerald-300'
          }`}
        >
          <Radar className="h-3.5 w-3.5 shrink-0" />
          <span>
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
            onTriggerBarrelRoll();
          }}
          className="flex min-h-[44px] min-w-[108px] cursor-pointer touch-none items-center justify-center gap-1.5 rounded-full border border-cyan-400/50 bg-slate-950/80 px-3.5 font-mono-tabular text-xs font-semibold text-cyan-200 shadow-lg transition-transform active:scale-95"
        >
          <RotateCw className="h-3.5 w-3.5 shrink-0" />
          <span>Evade</span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onTriggerTorpedoSalvo();
          }}
          className={`flex min-h-[44px] min-w-[108px] cursor-pointer touch-none items-center justify-center gap-1.5 rounded-full border px-3.5 font-mono-tabular text-xs font-semibold shadow-lg transition-transform active:scale-95 ${
            hud.torpedoCooldown > 0
              ? 'border-white/10 bg-slate-950/80 text-slate-400'
              : 'border-amber-400/60 bg-slate-950/80 text-amber-300'
          }`}
        >
          <Zap className="h-3.5 w-3.5 shrink-0" />
          <span>
            {hud.torpedoCooldown > 0
              ? `${Math.ceil(hud.torpedoCooldown * 3.8)}s`
              : `Torp ${hud.lockedCount}/${hud.maxLocks}`}
          </span>
        </button>
      </div>

      {/* Primary Large Hold-to-Fire Trigger */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
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
        className={`flex h-24 w-24 sm:h-28 sm:w-28 cursor-pointer touch-none flex-col items-center justify-center rounded-full border-2 font-display text-sm font-bold shadow-2xl transition-transform ${
          isFiring
            ? 'scale-95 border-white bg-cyan-400 text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.65)]'
            : 'border-cyan-400/70 bg-slate-950/80 text-white shadow-[0_0_24px_rgba(6,182,212,0.25)]'
        }`}
      >
        <Crosshair className="h-5 w-5 mb-0.5 text-cyan-300" />
        <span>FIRE</span>
        {!isMinimal && (
          <span className="font-mono-tabular text-[10px] font-normal text-cyan-200/80">
            Hold
          </span>
        )}
      </button>
    </div>
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 sm:bottom-20 z-30 flex items-end justify-between px-4 sm:px-8 pb-2">
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
