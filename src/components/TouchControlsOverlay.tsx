import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Crosshair, Flame, Radar, RotateCw, Zap } from 'lucide-react';
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

export interface JoystickVectorResult {
  knobX: number;
  knobY: number;
  normX: number;
  normY: number;
  clampedDist: number;
}

export function computeJoystickVector(
  dx: number,
  dy: number,
  maxRadius: number,
  deadzonePct: number,
  sensitivityPct: number,
): JoystickVectorResult {
  const safeMaxRadius = Math.max(1, maxRadius);
  const dist = Math.hypot(dx, dy);
  const clampedDist = Math.min(safeMaxRadius, dist);
  const angle = Math.atan2(dy, dx);

  const knobX = Math.cos(angle) * clampedDist;
  const knobY = Math.sin(angle) * clampedDist;

  const deadzoneNorm = Math.max(0.05, Math.min(0.35, deadzonePct / 100));
  const normMag = clampedDist / safeMaxRadius;
  if (normMag <= deadzoneNorm) {
    return { knobX, knobY, normX: 0, normY: 0, clampedDist };
  }

  const rescaled =
    (normMag - deadzoneNorm) / Math.max(0.01, 1 - deadzoneNorm);
  // Smooth cubic blend eliminates micro-jitter near deadzone while giving full authority at rim
  const curvedMag = 0.72 * rescaled + 0.28 * rescaled * rescaled * rescaled;
  const sens = Math.max(0.5, Math.min(1.5, sensitivityPct / 100));
  const finalMag = Math.min(1, curvedMag * sens);

  const normX = Math.max(-1, Math.min(1, Math.cos(angle) * finalMag));
  const normY = Math.max(-1, Math.min(1, -Math.sin(angle) * finalMag));
  return { knobX, knobY, normX, normY, clampedDist };
}

interface CircularActionButtonProps {
  id: string;
  ariaLabel: string;
  anchorLeftPct: number;
  anchorTopPct: number;
  diameterPx: number;
  hitPaddingPx?: number;
  ringProgressPct: number; // 0..100
  ringColorHex: string;
  glowRgba: string;
  isActive?: boolean;
  isCooldown?: boolean;
  isUnavailable?: boolean;
  isMinimal?: boolean;
  badgeText?: string;
  statusText?: string;
  shortLabel: string;
  icon: React.ReactNode;
  onPress: () => void;
}

const CircularActionButton: React.FC<CircularActionButtonProps> = ({
  id,
  ariaLabel,
  anchorLeftPct,
  anchorTopPct,
  diameterPx,
  hitPaddingPx = 14,
  ringProgressPct,
  ringColorHex,
  glowRgba,
  isActive = false,
  isCooldown = false,
  isUnavailable = false,
  isMinimal = false,
  badgeText,
  statusText,
  shortLabel,
  icon,
  onPress,
}) => {
  const [pressed, setPressed] = useState(false);
  const pointerIdRef = useRef<number | null>(null);

  const effectiveDiameter = isMinimal ? Math.round(diameterPx * 0.86) : diameterPx;
  const hitSize = Math.max(54, effectiveDiameter + hitPaddingPx * 2);
  const svgRadius = (effectiveDiameter - 5) / 2;
  const circumference = 2 * Math.PI * svgRadius;
  const clampedPct = Math.max(0, Math.min(100, ringProgressPct));
  const dashOffset = circumference * (1 - clampedPct / 100);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    pointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events without pointer capture support
    }
    setPressed(true);
    onPress();
  };

  const handlePointerRelease = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== null && pointerIdRef.current !== e.pointerId) {
      return;
    }
    e.stopPropagation();
    pointerIdRef.current = null;
    setPressed(false);
  };

  return (
    <button
      id={id}
      type="button"
      aria-label={ariaLabel}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerRelease}
      onPointerCancel={handlePointerRelease}
      onLostPointerCapture={() => {
        pointerIdRef.current = null;
        setPressed(false);
      }}
      style={{
        left: `clamp(calc(env(safe-area-inset-left, 0px) + ${Math.round(hitSize / 2 + 6)}px), ${anchorLeftPct}vw, calc(100vw - env(safe-area-inset-right, 0px) - ${Math.round(hitSize / 2 + 6)}px))`,
        top: `clamp(112px, ${anchorTopPct}vh, calc(100vh - env(safe-area-inset-bottom, 0px) - ${Math.round(hitSize / 2 + 6)}px))`,
        width: `${hitSize}px`,
        height: `${hitSize}px`,
      }}
      className="pointer-events-auto fixed -translate-x-1/2 -translate-y-1/2 touch-none select-none flex items-center justify-center rounded-full focus:outline-none cursor-pointer"
    >
      {/* Visual Circular Sci-Fi HUD Control */}
      <div
        style={{
          width: `${effectiveDiameter}px`,
          height: `${effectiveDiameter}px`,
          boxShadow:
            pressed || isActive
              ? `0 0 24px ${glowRgba}, inset 0 0 14px ${glowRgba}`
              : isCooldown || isUnavailable
                ? '0 4px 14px rgba(0,0,0,0.45)'
                : `0 0 14px ${glowRgba}`,
        }}
        className={`relative flex flex-col items-center justify-center rounded-full backdrop-blur-md transition-all duration-100 ${
          pressed
            ? 'scale-90 bg-slate-900/90 opacity-100'
            : isActive
              ? 'scale-105 bg-slate-900/85 opacity-100'
              : isCooldown || isUnavailable
                ? isMinimal
                  ? 'bg-slate-950/45 opacity-45'
                  : 'bg-slate-950/60 opacity-60'
                : isMinimal
                  ? 'bg-slate-950/50 opacity-65'
                  : 'bg-slate-950/68 opacity-85'
        }`}
      >
        {/* SVG Perimeter Cooldown / Readiness Ring */}
        <svg
          width={effectiveDiameter}
          height={effectiveDiameter}
          viewBox={`0 0 ${effectiveDiameter} ${effectiveDiameter}`}
          className="pointer-events-none absolute inset-0 -rotate-90"
        >
          <circle
            cx={effectiveDiameter / 2}
            cy={effectiveDiameter / 2}
            r={svgRadius}
            fill="none"
            stroke="rgba(148, 163, 184, 0.22)"
            strokeWidth={isActive ? 3 : 2.2}
          />
          <circle
            cx={effectiveDiameter / 2}
            cy={effectiveDiameter / 2}
            r={svgRadius}
            fill="none"
            stroke={
              isCooldown || isUnavailable
                ? 'rgba(148, 163, 184, 0.52)'
                : ringColorHex
            }
            strokeWidth={isActive || pressed ? 3.2 : 2.5}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>

        {/* Subtle Inner Reticle Ring */}
        <div
          className="pointer-events-none absolute inset-[5px] rounded-full border"
          style={{
            borderColor:
              isActive || pressed
                ? ringColorHex
                : 'rgba(255, 255, 255, 0.08)',
          }}
        />

        {/* Top-Right Lock/Count Micro-Badge (e.g. Torpedo Locks) */}
        {badgeText && (
          <span
            style={{
              borderColor: ringColorHex,
            }}
            className="pointer-events-none absolute -top-1 -right-1 flex h-4 min-w-[22px] items-center justify-center rounded-full border bg-slate-950/95 px-1 font-mono text-[9px] font-bold text-amber-200 tabular-nums shadow"
          >
            {badgeText}
          </span>
        )}

        {/* Primary Recognizable Icon */}
        <div
          className={`relative z-10 flex items-center justify-center ${
            isCooldown || isUnavailable ? 'text-slate-400' : 'text-white'
          }`}
          style={{
            color:
              isCooldown || isUnavailable
                ? undefined
                : isActive || pressed
                  ? '#ffffff'
                  : ringColorHex,
          }}
        >
          {icon}
        </div>

        {/* Compact Status Timer or Micro-Caption */}
        {statusText ? (
          <span className="relative z-10 mt-0.5 font-mono text-[9px] font-bold leading-none text-white tabular-nums">
            {statusText}
          </span>
        ) : (
          !isMinimal && (
            <span className="relative z-10 mt-0.5 font-display text-[8px] font-bold uppercase tracking-wider leading-none text-slate-200/90">
              {shortLabel}
            </span>
          )
        )}
      </div>
    </button>
  );
};

export const TouchControlsOverlay: React.FC<TouchControlsOverlayProps> = ({
  hud,
  settings,
  onTouchMove,
  onTouchFire,
  onTriggerBarrelRoll,
  onTriggerTorpedoSalvo,
  onTriggerTacticalSonar,
  onTriggerShipAbility,
}) => {
  const stickBaseRef = useRef<HTMLDivElement | null>(null);
  const stickPointerIdRef = useRef<number | null>(null);
  const firePointerIdRef = useRef<number | null>(null);

  const [isSteering, setIsSteering] = useState(false);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [normSteer, setNormSteer] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [isFiring, setIsFiring] = useState(false);

  const pulseHaptic = useCallback(
    (ms = 12) => {
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
    },
    [settings.hapticsEnabled, settings.reducedMotion],
  );

  const resetAllTouchInputs = useCallback(() => {
    stickPointerIdRef.current = null;
    firePointerIdRef.current = null;
    setIsSteering(false);
    setKnobOffset({ x: 0, y: 0 });
    setNormSteer({ x: 0, y: 0 });
    setIsFiring(false);
    onTouchMove(0, 0);
    onTouchFire(false);
  }, [onTouchMove, onTouchFire]);

  useEffect(() => {
    if (!settings.touchControlsEnabled || hud.mode !== 'playing') {
      resetAllTouchInputs();
    }
    const handleVisibility = () => {
      if (document.hidden) {
        resetAllTouchInputs();
      }
    };
    window.addEventListener('blur', resetAllTouchInputs);
    window.addEventListener('pagehide', resetAllTouchInputs);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('blur', resetAllTouchInputs);
      window.removeEventListener('pagehide', resetAllTouchInputs);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [settings.touchControlsEnabled, hud.mode, resetAllTouchInputs]);

  if (!settings.touchControlsEnabled || hud.mode !== 'playing') {
    return null;
  }

  const isLeftHanded = settings.touchLayout === 'left_handed';
  const isMinimal = settings.touchLayout === 'minimal';

  // Mirror horizontal anchor helper for Left-Handed preset
  const mirrorX = (pct: number) => (isLeftHanded ? 100 - pct : pct);

  // Virtual Analog Flight Stick Dimensions
  const stickVisualSize = isMinimal ? 98 : 118;
  const stickHitSize = isMinimal ? 138 : 158;
  const knobSize = isMinimal ? 40 : 48;
  const maxRadius = isMinimal ? 36 : 44;
  const deadzoneNorm = Math.max(0.05, Math.min(0.35, settings.joystickDeadzone / 100));

  const updateStickFromClientXY = (clientX: number, clientY: number) => {
    const el = stickBaseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const vec = computeJoystickVector(
      clientX - centerX,
      clientY - centerY,
      maxRadius,
      settings.joystickDeadzone,
      settings.joystickSensitivity,
    );
    setKnobOffset({ x: vec.knobX, y: vec.knobY });
    setNormSteer({ x: vec.normX, y: vec.normY });
    onTouchMove(vec.normX, vec.normY);
  };

  const handleStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    stickPointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events without pointer capture support
    }
    setIsSteering(true);
    pulseHaptic(8);
    updateStickFromClientXY(e.clientX, e.clientY);
  };

  const handleStickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    updateStickFromClientXY(e.clientX, e.clientY);
  };

  const handleStickPointerRelease = (e: React.PointerEvent<HTMLDivElement>) => {
    if (
      stickPointerIdRef.current !== null &&
      stickPointerIdRef.current !== e.pointerId
    ) {
      return;
    }
    e.stopPropagation();
    stickPointerIdRef.current = null;
    setIsSteering(false);
    setKnobOffset({ x: 0, y: 0 });
    setNormSteer({ x: 0, y: 0 });
    onTouchMove(0, 0);
  };

  // Primary Fire Hold-to-Fire Handlers (Isolated pointerId)
  const fireVisualSize = isMinimal ? 70 : 82;
  const fireHitSize = isMinimal ? 86 : 98;
  const fireAnchorX = mirrorX(88);
  const fireAnchorY = 78;

  const handleFirePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    firePointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events without pointer capture support
    }
    pulseHaptic(12);
    setIsFiring(true);
    onTouchFire(true);
  };

  const handleFirePointerRelease = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (
      firePointerIdRef.current !== null &&
      firePointerIdRef.current !== e.pointerId
    ) {
      return;
    }
    e.stopPropagation();
    firePointerIdRef.current = null;
    setIsFiring(false);
    onTouchFire(false);
  };

  // Cooldown / Readiness Percentages (0..100)
  const torpReadyPct =
    hud.torpedoCooldown > 0
      ? Math.max(0, Math.min(100, (1 - hud.torpedoCooldown) * 100))
      : 100;
  const sonarRingPct = hud.sonarActive
    ? Math.max(0, Math.min(100, (hud.sonarRemainingSeconds / 5) * 100))
    : hud.sonarCooldown > 0
      ? Math.max(0, Math.min(100, (1 - hud.sonarCooldown) * 100))
      : 100;
  const boostPct = Math.max(
    0,
    Math.min(100, (hud.boost / Math.max(1, hud.maxBoost)) * 100),
  );
  const evadeAvailable = hud.boost >= 28 && !hud.barrelRolling;
  const abilityRingPct = hud.activeAbilityActive
    ? 100
    : hud.activeAbilityCooldown > 0
      ? Math.max(0, Math.min(100, (1 - hud.activeAbilityCooldown) * 100))
      : 100;

  const stickAnchorX = mirrorX(13);
  const stickAnchorY = 78;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-30 select-none overflow-hidden"
      aria-label="In-Flight Mobile Combat Touch Controls"
    >
      {/* =====================================================================
       * 1. LEFT THUMB — 360° VIRTUAL ANALOG FLIGHT JOYSTICK
       *    Default Anchor: ~13% W, 78% H (Clamped inside device safe areas)
       * ==================================================================== */}
      <div
        ref={stickBaseRef}
        id="mobile-virtual-joystick"
        role="slider"
        aria-label="Virtual Analog Flight Joystick"
        aria-valuenow={Math.round(normSteer.x * 100)}
        onPointerDown={handleStickPointerDown}
        onPointerMove={handleStickPointerMove}
        onPointerUp={handleStickPointerRelease}
        onPointerCancel={handleStickPointerRelease}
        onLostPointerCapture={() => {
          stickPointerIdRef.current = null;
          setIsSteering(false);
          setKnobOffset({ x: 0, y: 0 });
          setNormSteer({ x: 0, y: 0 });
          onTouchMove(0, 0);
        }}
        style={{
          left: `clamp(calc(env(safe-area-inset-left, 0px) + ${Math.round(stickHitSize / 2 + 8)}px), ${stickAnchorX}vw, calc(100vw - env(safe-area-inset-right, 0px) - ${Math.round(stickHitSize / 2 + 8)}px))`,
          top: `clamp(140px, ${stickAnchorY}vh, calc(100vh - env(safe-area-inset-bottom, 0px) - ${Math.round(stickHitSize / 2 + 8)}px))`,
          width: `${stickHitSize}px`,
          height: `${stickHitSize}px`,
        }}
        className="pointer-events-auto fixed -translate-x-1/2 -translate-y-1/2 touch-none flex items-center justify-center rounded-full cursor-pointer"
      >
        {/* Translucent Circular Outer Base */}
        <div
          style={{
            width: `${stickVisualSize}px`,
            height: `${stickVisualSize}px`,
            boxShadow: isSteering
              ? '0 0 32px rgba(34, 211, 238, 0.35), inset 0 0 18px rgba(6, 182, 212, 0.22)'
              : '0 0 18px rgba(6, 182, 212, 0.14)',
          }}
          className={`relative flex items-center justify-center rounded-full border backdrop-blur-md transition-opacity duration-150 ${
            isSteering
              ? 'border-cyan-300/80 bg-slate-950/75 opacity-100'
              : isMinimal
                ? 'border-cyan-400/30 bg-slate-950/40 opacity-45'
                : 'border-cyan-400/45 bg-slate-950/55 opacity-70'
          }`}
        >
          {/* SVG Precision Degree Ring & Directional Chevrons */}
          <svg
            width={stickVisualSize}
            height={stickVisualSize}
            viewBox="0 0 120 120"
            className="pointer-events-none absolute inset-0"
          >
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="rgba(34, 211, 238, 0.22)"
              strokeWidth="1.2"
              strokeDasharray="4 6"
            />
            {/* Dead-zone visualizer ring */}
            <circle
              cx="60"
              cy="60"
              r={Math.max(8, Math.round(deadzoneNorm * 46))}
              fill="none"
              stroke="rgba(148, 163, 184, 0.25)"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            {/* North Chevron */}
            <path
              d="M55 14 L60 8 L65 14"
              fill="none"
              stroke={
                normSteer.y > 0.2
                  ? '#22d3ee'
                  : 'rgba(148, 163, 184, 0.35)'
              }
              strokeWidth={normSteer.y > 0.2 ? '2.4' : '1.5'}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* South Chevron */}
            <path
              d="M55 106 L60 112 L65 106"
              fill="none"
              stroke={
                normSteer.y < -0.2
                  ? '#22d3ee'
                  : 'rgba(148, 163, 184, 0.35)'
              }
              strokeWidth={normSteer.y < -0.2 ? '2.4' : '1.5'}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* West Chevron */}
            <path
              d="M14 55 L8 60 L14 65"
              fill="none"
              stroke={
                normSteer.x < -0.2
                  ? '#22d3ee'
                  : 'rgba(148, 163, 184, 0.35)'
              }
              strokeWidth={normSteer.x < -0.2 ? '2.4' : '1.5'}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* East Chevron */}
            <path
              d="M106 55 L112 60 L106 65"
              fill="none"
              stroke={
                normSteer.x > 0.2
                  ? '#22d3ee'
                  : 'rgba(148, 163, 184, 0.35)'
              }
              strokeWidth={normSteer.x > 0.2 ? '2.4' : '1.5'}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Active Deflection Vector Line */}
          {isSteering && (Math.abs(knobOffset.x) > 2 || Math.abs(knobOffset.y) > 2) && (
            <svg
              width={stickVisualSize}
              height={stickVisualSize}
              viewBox={`0 0 ${stickVisualSize} ${stickVisualSize}`}
              className="pointer-events-none absolute inset-0"
            >
              <line
                x1={stickVisualSize / 2}
                y1={stickVisualSize / 2}
                x2={stickVisualSize / 2 + knobOffset.x}
                y2={stickVisualSize / 2 + knobOffset.y}
                stroke="rgba(34, 211, 238, 0.55)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}

          {/* Inner Bioluminescent Thumb Knob (Instant tracking while dragging, smooth spring-back on release) */}
          <div
            style={{
              width: `${knobSize}px`,
              height: `${knobSize}px`,
              transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0) scale(${
                isSteering ? 1.06 : 1
              })`,
            }}
            className={`pointer-events-none absolute flex items-center justify-center rounded-full border-2 ${
              isSteering
                ? 'duration-0 border-cyan-200 bg-gradient-to-b from-cyan-300/75 to-sky-500/55 shadow-[0_0_22px_rgba(34,211,238,0.75)]'
                : 'transition-transform duration-150 ease-out border-cyan-300/80 bg-gradient-to-b from-cyan-400/50 to-sky-600/35 shadow-[0_0_14px_rgba(34,211,238,0.4)]'
            }`}
          >
            <div className="h-3 w-3 rounded-full bg-white shadow-[0_0_8px_#ffffff]" />
          </div>
        </div>
      </div>

      {/* =====================================================================
       * 2. RIGHT THUMB — DOMINANT PRIMARY FIRE BUTTON
       *    Default Anchor: ~88% W, 78% H (76–88dp visible diameter)
       * ==================================================================== */}
      <button
        id="mobile-primary-fire-btn"
        type="button"
        aria-label="Primary Fire Hold Trigger"
        onPointerDown={handleFirePointerDown}
        onPointerUp={handleFirePointerRelease}
        onPointerCancel={handleFirePointerRelease}
        onLostPointerCapture={() => {
          firePointerIdRef.current = null;
          setIsFiring(false);
          onTouchFire(false);
        }}
        style={{
          left: `clamp(calc(env(safe-area-inset-left, 0px) + ${Math.round(fireHitSize / 2 + 8)}px), ${fireAnchorX}vw, calc(100vw - env(safe-area-inset-right, 0px) - ${Math.round(fireHitSize / 2 + 8)}px))`,
          top: `clamp(140px, ${fireAnchorY}vh, calc(100vh - env(safe-area-inset-bottom, 0px) - ${Math.round(fireHitSize / 2 + 8)}px))`,
          width: `${fireHitSize}px`,
          height: `${fireHitSize}px`,
        }}
        className="pointer-events-auto fixed -translate-x-1/2 -translate-y-1/2 touch-none select-none flex items-center justify-center rounded-full focus:outline-none cursor-pointer"
      >
        <div
          style={{
            width: `${fireVisualSize}px`,
            height: `${fireVisualSize}px`,
            boxShadow: isFiring
              ? '0 0 34px rgba(34, 211, 238, 0.8), inset 0 0 18px rgba(255, 255, 255, 0.45)'
              : settings.autoFire
                ? '0 0 22px rgba(16, 185, 129, 0.32)'
                : '0 0 22px rgba(6, 182, 212, 0.28)',
          }}
          className={`relative flex flex-col items-center justify-center rounded-full backdrop-blur-md transition-all duration-75 ${
            isFiring
              ? 'scale-92 bg-cyan-400 text-slate-950 opacity-100'
              : isMinimal
                ? 'bg-slate-950/55 text-white opacity-68'
                : 'bg-slate-950/75 text-white opacity-90'
          }`}
        >
          {/* SVG Outer Segmented Weapon Ring */}
          <svg
            width={fireVisualSize}
            height={fireVisualSize}
            viewBox="0 0 84 84"
            className={`pointer-events-none absolute inset-0 ${
              isFiring || settings.autoFire ? 'animate-spin' : ''
            }`}
            style={{ animationDuration: isFiring ? '2.4s' : '8s' }}
          >
            <circle
              cx="42"
              cy="42"
              r="39"
              fill="none"
              stroke={
                isFiring
                  ? '#ffffff'
                  : settings.autoFire
                    ? '#34d399'
                    : '#22d3ee'
              }
              strokeWidth="2.8"
              strokeDasharray="18 8"
              strokeLinecap="round"
            />
            <circle
              cx="42"
              cy="42"
              r="33"
              fill="none"
              stroke="rgba(255, 255, 255, 0.16)"
              strokeWidth="1.2"
            />
          </svg>

          <Crosshair
            className={`h-6 w-6 ${
              isFiring
                ? 'text-slate-950'
                : settings.autoFire
                  ? 'text-emerald-300'
                  : 'text-cyan-300'
            }`}
          />
          <span
            className={`mt-0.5 font-display text-[10px] font-extrabold tracking-wider leading-none ${
              isFiring ? 'text-slate-950' : 'text-white'
            }`}
          >
            FIRE
          </span>
        </div>
      </button>

      {/* =====================================================================
       * 3. SECONDARY TORPEDO SALVO BUTTON
       *    Default Anchor: ~76% W, 64% H (58–66dp visible diameter)
       * ==================================================================== */}
      <CircularActionButton
        id="mobile-torpedo-btn"
        ariaLabel="Launch Secondary Torpedo Salvo"
        anchorLeftPct={mirrorX(76)}
        anchorTopPct={64}
        diameterPx={62}
        ringProgressPct={torpReadyPct}
        ringColorHex="#f59e0b"
        glowRgba="rgba(245, 158, 11, 0.35)"
        isActive={hud.lockedCount > 0 && hud.torpedoCooldown <= 0}
        isCooldown={hud.torpedoCooldown > 0}
        isMinimal={isMinimal}
        badgeText={`${hud.lockedCount}/${hud.maxLocks}`}
        statusText={
          hud.torpedoCooldown > 0
            ? `${Math.ceil(hud.torpedoCooldown * 3.8)}s`
            : undefined
        }
        shortLabel="Torp"
        icon={<Zap className="h-5 w-5" />}
        onPress={() => {
          pulseHaptic(18);
          onTriggerTorpedoSalvo();
        }}
      />

      {/* =====================================================================
       * 4. TACTICAL SONAR PULSE BUTTON
       *    Default Anchor: ~90% W, 56% H (54–62dp visible diameter)
       * ==================================================================== */}
      <CircularActionButton
        id="mobile-sonar-btn"
        ariaLabel="Activate Tactical Sonar"
        anchorLeftPct={mirrorX(90)}
        anchorTopPct={56}
        diameterPx={58}
        ringProgressPct={sonarRingPct}
        ringColorHex="#10b981"
        glowRgba="rgba(16, 185, 129, 0.35)"
        isActive={hud.sonarActive}
        isCooldown={hud.sonarCooldown > 0 && !hud.sonarActive}
        isMinimal={isMinimal}
        statusText={
          hud.sonarActive
            ? `${hud.sonarRemainingSeconds.toFixed(1)}s`
            : hud.sonarCooldown > 0
              ? `${Math.ceil(hud.sonarCooldown * 7.5)}s`
              : undefined
        }
        shortLabel="Sonar"
        icon={<Radar className="h-4.5 w-4.5" />}
        onPress={() => {
          pulseHaptic(14);
          onTriggerTacticalSonar();
        }}
      />

      {/* =====================================================================
       * 5. HYDRO-BARREL ROLL EVASIVE MANOEUVRE BUTTON
       *    Default Anchor: ~76% W, 89% H (58–66dp visible diameter)
       * ==================================================================== */}
      <CircularActionButton
        id="mobile-barrel-roll-btn"
        ariaLabel="Execute Hydro-Barrel Roll"
        anchorLeftPct={mirrorX(76)}
        anchorTopPct={89}
        diameterPx={62}
        ringProgressPct={boostPct}
        ringColorHex="#38bdf8"
        glowRgba="rgba(56, 189, 248, 0.35)"
        isActive={hud.barrelRolling}
        isUnavailable={!evadeAvailable && !hud.barrelRolling}
        isMinimal={isMinimal}
        statusText={
          hud.barrelRolling
            ? 'ROLL'
            : !evadeAvailable
              ? `${Math.round(boostPct)}%`
              : undefined
        }
        shortLabel="Evade"
        icon={<RotateCw className="h-5 w-5" />}
        onPress={() => {
          pulseHaptic(16);
          onTriggerBarrelRoll();
        }}
      />

      {/* =====================================================================
       * 6. SHIP SIGNATURE ACTIVE ABILITY BUTTON (Inner Right-Thumb Arc)
       *    Default Anchor: ~66% W, 77% H (58dp visible diameter)
       * ==================================================================== */}
      <CircularActionButton
        id="mobile-ship-ability-btn"
        ariaLabel={`Activate ${hud.activeAbilityName}`}
        anchorLeftPct={mirrorX(66)}
        anchorTopPct={77}
        diameterPx={58}
        ringProgressPct={abilityRingPct}
        ringColorHex="#e879f9"
        glowRgba="rgba(232, 121, 249, 0.38)"
        isActive={hud.activeAbilityActive}
        isCooldown={hud.activeAbilityCooldown > 0 && !hud.activeAbilityActive}
        isMinimal={isMinimal}
        statusText={
          hud.activeAbilityActive
            ? `${hud.activeAbilityRemainingSeconds.toFixed(1)}s`
            : hud.activeAbilityCooldown > 0
              ? `${hud.activeAbilityCooldownSeconds}s`
              : undefined
        }
        shortLabel="Power"
        icon={<Flame className="h-4.5 w-4.5" />}
        onPress={() => {
          pulseHaptic(20);
          onTriggerShipAbility();
        }}
      />
    </div>
  );
};
