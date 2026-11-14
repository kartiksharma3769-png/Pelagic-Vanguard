import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Crosshair,
  Eye,
  Flame,
  Layers,
  Lock,
  Palette,
  RotateCcw,
  Shield,
  ShoppingBag,
  Sliders,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  COSMETIC_CATALOG,
  SHIP_CATALOG,
  UPGRADE_CATALOG,
  WEAPON_CATALOG,
} from '../game/stages';
import {
  CosmeticId,
  PlayerSaveData,
  PrimaryWeaponId,
  SecondaryWeaponId,
  ShipClassId,
  UpgradeDefinition,
  UpgradeId,
  WeaponDefinition,
} from '../game/types';
import { calculateFleetPower } from '../game/saveManager';

interface HangarViewProps {
  save: PlayerSaveData;
  onSelectShip: (id: ShipClassId) => void;
  onUnlockShip: (id: ShipClassId) => void;
  onSelectPrimaryWeapon: (id: PrimaryWeaponId) => void;
  onSelectSecondaryWeapon: (id: SecondaryWeaponId) => void;
  onToggleUpgrade: (id: UpgradeId) => void;
  onUpgradeTier: (id: UpgradeId) => void;
  onSelectCosmetic: (id: CosmeticId) => void;
  onUnlockCosmetic: (id: CosmeticId) => void;
  onPreviewShip: (shipId: ShipClassId, cosmeticId?: CosmeticId) => void;
  onOpenMarket: () => void;
  onClose: () => void;
}

type HangarCategory = 'weapons' | 'modules' | 'defence' | 'cosmetics';

interface ComputedLoadoutStats {
  hull: number;
  shield: number;
  speed: number;
  firepower: number;
  locks: number;
  pressureRes: number;
}

function computeStatsForLoadout(
  shipId: ShipClassId,
  primaryId: PrimaryWeaponId,
  secondaryId: SecondaryWeaponId,
  activeUpgrades: UpgradeId[],
  upgradeTiers: Record<UpgradeId, number>,
): ComputedLoadoutStats {
  const ship = SHIP_CATALOG.find((s) => s.id === shipId) || SHIP_CATALOG[0];
  const primary =
    WEAPON_CATALOG.find((w) => w.id === primaryId) || WEAPON_CATALOG[0];
  const secondary =
    WEAPON_CATALOG.find((w) => w.id === secondaryId) || WEAPON_CATALOG[3];

  const getTierMult = (id: UpgradeId) => {
    const t = upgradeTiers[id] || 1;
    return 1 + (t - 1) * 0.25;
  };

  let hull = ship.baseHull;
  let shield = ship.baseShield;
  let speed = ship.baseSpeed;
  let locks = ship.baseTorpedoLocks + (secondary.lockBonus || 0);
  let pressureRes = ship.pressureResistancePct;

  const baseDps =
    (primary.damage / Math.max(0.08, primary.cooldownSeconds)) *
    ship.cannonDamageMult *
    ship.fireRateMult;
  let firepower = Math.round(baseDps * 0.55 + secondary.damage * 0.22);

  if (activeUpgrades.includes('cavitation_overcharge')) {
    firepower = Math.round(
      firepower * (1 + 0.22 * getTierMult('cavitation_overcharge')),
    );
  }
  if (activeUpgrades.includes('quad_torpedo_salvo')) {
    const t = upgradeTiers.quad_torpedo_salvo || 1;
    locks += t >= 3 ? 3 : 2;
    firepower += 18 * t;
  }
  if (activeUpgrades.includes('piezo_hull_regen')) {
    hull += Math.round(25 * getTierMult('piezo_hull_regen'));
  }
  if (activeUpgrades.includes('voltaic_shield_capacitor')) {
    shield += Math.round(35 * getTierMult('voltaic_shield_capacitor'));
  }
  if (activeUpgrades.includes('hydro_thruster_coil')) {
    speed = +(speed * (1 + 0.16 * getTierMult('hydro_thruster_coil'))).toFixed(1);
  }
  if (activeUpgrades.includes('hadal_pressure_Bulkhead')) {
    pressureRes = Math.min(
      85,
      Math.round(pressureRes + 30 * getTierMult('hadal_pressure_Bulkhead')),
    );
    hull += Math.round(18 * getTierMult('hadal_pressure_Bulkhead'));
  }
  if (activeUpgrades.includes('sonar_crit_visor')) {
    firepower += Math.round(16 * getTierMult('sonar_crit_visor'));
  }

  return { hull, shield, speed, firepower, locks, pressureRes };
}

export const HangarView: React.FC<HangarViewProps> = ({
  save,
  onSelectShip,
  onUnlockShip,
  onSelectPrimaryWeapon,
  onSelectSecondaryWeapon,
  onToggleUpgrade,
  onUpgradeTier,
  onSelectCosmetic,
  onUnlockCosmetic,
  onPreviewShip,
  onOpenMarket,
  onClose,
}) => {
  const [category, setCategory] = useState<HangarCategory>('weapons');
  const [isInspecting3D, setIsInspecting3D] = useState<boolean>(false);
  const [previewShipId, setPreviewShipId] = useState<ShipClassId>(
    save.selectedShip,
  );
  const [previewCosmeticId, setPreviewCosmeticId] = useState<CosmeticId>(
    save.equippedCosmetic,
  );
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>(
    save.equippedPrimaryWeapon,
  );
  const [selectedModuleId, setSelectedModuleId] = useState<UpgradeId>(
    'cavitation_overcharge',
  );
  const [selectedDefenceId, setSelectedDefenceId] =
    useState<UpgradeId>('piezo_hull_regen');

  useEffect(() => {
    onPreviewShip(previewShipId, previewCosmeticId);
  }, [previewShipId, previewCosmeticId, onPreviewShip]);

  useEffect(() => {
    setPreviewShipId(save.selectedShip);
  }, [save.selectedShip]);

  useEffect(() => {
    setPreviewCosmeticId(save.equippedCosmetic);
  }, [save.equippedCosmetic]);

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

  const currentShipDef =
    SHIP_CATALOG.find((s) => s.id === previewShipId) || SHIP_CATALOG[0];
  const maxModuleSlots = currentShipDef.moduleCapacity;
  const fleetPower = calculateFleetPower(save);

  const tacticalModules = useMemo(
    () =>
      UPGRADE_CATALOG.filter(
        (u) => u.category === 'weapons' || u.category === 'optics',
      ),
    [],
  );
  const defenceModules = useMemo(
    () =>
      UPGRADE_CATALOG.filter(
        (u) => u.category === 'defense' || u.category === 'mobility',
      ),
    [],
  );

  const currentStats = useMemo(
    () =>
      computeStatsForLoadout(
        save.selectedShip,
        save.equippedPrimaryWeapon,
        save.equippedSecondaryWeapon,
        save.activeUpgrades,
        save.upgradeTiers,
      ),
    [save],
  );

  const candidateStats = useMemo(() => {
    let nextPrimary = save.equippedPrimaryWeapon;
    let nextSecondary = save.equippedSecondaryWeapon;
    let nextUpgrades = [...save.activeUpgrades];

    if (category === 'weapons') {
      const w = WEAPON_CATALOG.find((item) => item.id === selectedWeaponId);
      if (w?.slot === 'primary') nextPrimary = w.id as PrimaryWeaponId;
      if (w?.slot === 'secondary') nextSecondary = w.id as SecondaryWeaponId;
    } else if (category === 'modules') {
      if (!nextUpgrades.includes(selectedModuleId)) {
        nextUpgrades = [...nextUpgrades, selectedModuleId];
      }
    } else if (category === 'defence') {
      if (!nextUpgrades.includes(selectedDefenceId)) {
        nextUpgrades = [...nextUpgrades, selectedDefenceId];
      }
    }

    return computeStatsForLoadout(
      previewShipId,
      nextPrimary,
      nextSecondary,
      nextUpgrades,
      save.upgradeTiers,
    );
  }, [
    previewShipId,
    category,
    selectedWeaponId,
    selectedModuleId,
    selectedDefenceId,
    save,
  ]);

  const statRows = [
    {
      label: 'Hull',
      unit: '',
      curr: currentStats.hull,
      next: candidateStats.hull,
      max: 220,
      color: 'bg-emerald-400',
    },
    {
      label: 'Shield',
      unit: '',
      curr: currentStats.shield,
      next: candidateStats.shield,
      max: 220,
      color: 'bg-cyan-400',
    },
    {
      label: 'Power',
      unit: '',
      curr: currentStats.firepower,
      next: candidateStats.firepower,
      max: 220,
      color: 'bg-amber-400',
    },
    {
      label: 'Speed',
      unit: '',
      curr: currentStats.speed,
      next: candidateStats.speed,
      max: 32,
      color: 'bg-sky-400',
    },
    {
      label: 'Locks',
      unit: '',
      curr: currentStats.locks,
      next: candidateStats.locks,
      max: 8,
      color: 'bg-fuchsia-400',
    },
    {
      label: 'Depth',
      unit: '%',
      curr: currentStats.pressureRes,
      next: candidateStats.pressureRes,
      max: 90,
      color: 'bg-teal-400',
    },
  ];

  const activeWeaponDetail: WeaponDefinition =
    WEAPON_CATALOG.find((w) => w.id === selectedWeaponId) || WEAPON_CATALOG[0];
  const activeModuleDetail: UpgradeDefinition =
    UPGRADE_CATALOG.find(
      (u) =>
        u.id ===
        (category === 'defence' ? selectedDefenceId : selectedModuleId),
    ) || UPGRADE_CATALOG[0];
  const activeCosmeticDetail =
    COSMETIC_CATALOG.find((c) => c.id === previewCosmeticId) ||
    COSMETIC_CATALOG[0];

  const shipOwned = save.ownedShips.includes(currentShipDef.id);
  const shipEquipped = save.selectedShip === currentShipDef.id;
  const canAffordShip =
    save.salvageCredits >= currentShipDef.costCredits &&
    save.abyssalMaterials >= currentShipDef.costMaterials;

  /* =======================================================================
   * FULLSCREEN 3D SHIP INSPECTION VIEWPORT
   * ===================================================================== */
  if (isInspecting3D) {
    return (
      <div className="relative h-full w-full flex flex-col justify-between p-3 sm:p-5 pt-safe pb-safe px-safe pointer-events-none select-none overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="pointer-events-auto rounded-2xl bg-slate-950/80 backdrop-blur-md ring-1 ring-white/15 px-3.5 py-2.5 shadow-xl max-w-xs sm:max-w-sm">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <span
                className="font-semibold"
                style={{ color: currentShipDef.accentColor }}
              >
                {currentShipDef.classLabel}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-cyan-300 font-bold tabular-nums">
                {fleetPower} PWR
              </span>
            </div>
            <h1 className="font-display text-lg sm:text-xl font-bold text-white truncate">
              {currentShipDef.name}
            </h1>
            <div className="mt-2 flex items-center gap-2">
              {shipOwned ? (
                <button
                  onClick={() => onSelectShip(currentShipDef.id)}
                  className={`min-h-[40px] rounded-xl px-3.5 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    shipEquipped
                      ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/50'
                      : 'bg-cyan-400 text-slate-950'
                  }`}
                >
                  {shipEquipped ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Active
                    </>
                  ) : (
                    'Deploy Hull'
                  )}
                </button>
              ) : (
                <button
                  onClick={() => onUnlockShip(currentShipDef.id)}
                  disabled={!canAffordShip}
                  className={`min-h-[40px] rounded-xl px-3.5 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                    canAffordShip
                      ? 'bg-amber-400 text-slate-950 cursor-pointer'
                      : 'bg-slate-900 text-slate-400 ring-1 ring-white/10 cursor-not-allowed'
                  }`}
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Unlock {currentShipDef.costCredits} CR</span>
                </button>
              )}
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-2xl bg-slate-950/80 backdrop-blur-md ring-1 ring-white/15 p-1">
              <button
                onClick={() => sendCameraCommand('zoomIn')}
                aria-label="Zoom In"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-200 hover:bg-white/10 active:scale-95 transition cursor-pointer"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                onClick={() => sendCameraCommand('zoomOut')}
                aria-label="Zoom Out"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-200 hover:bg-white/10 active:scale-95 transition cursor-pointer"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                onClick={() => sendCameraCommand('resetView')}
                aria-label="Reset View"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-200 hover:bg-white/10 active:scale-95 transition cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={() => sendCameraCommand('testThrusters')}
                aria-label="Ignite Thrusters"
                className="flex min-h-[44px] min-w-[44px] sm:px-3 items-center justify-center gap-1.5 rounded-xl bg-cyan-500/20 text-cyan-200 active:scale-95 transition cursor-pointer"
              >
                <Flame className="h-4 w-4 text-cyan-300" />
                <span className="hidden sm:inline text-xs font-semibold">
                  Ignite
                </span>
              </button>
            </div>

            <button
              onClick={() => setIsInspecting3D(false)}
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-2xl bg-cyan-400 px-3.5 py-2 font-display text-xs font-bold text-slate-950 shadow-lg active:scale-95 transition cursor-pointer whitespace-nowrap"
            >
              <Layers className="h-4 w-4" />
              <span>Loadout</span>
            </button>
          </div>
        </div>

        <div className="my-auto pointer-events-none flex justify-center">
          <div className="rounded-xl bg-slate-950/60 px-3 py-1 text-[11px] text-slate-300 ring-1 ring-white/10">
            Swipe 360° · Pinch to Zoom
          </div>
        </div>

        <div className="pointer-events-auto flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-2">
          <div className="flex-1 overflow-x-auto no-scrollbar rounded-2xl bg-slate-950/88 backdrop-blur-md ring-1 ring-white/15 p-2 flex gap-2">
            {SHIP_CATALOG.map((ship) => {
              const isPreview = previewShipId === ship.id;
              const isEquipped = save.selectedShip === ship.id;
              const isOwned = save.ownedShips.includes(ship.id);
              return (
                <button
                  key={ship.id}
                  onClick={() => setPreviewShipId(ship.id)}
                  className={`min-h-[48px] min-w-[132px] flex-1 rounded-xl px-3 py-2 text-left transition cursor-pointer border shrink-0 ${
                    isPreview
                      ? 'bg-cyan-500/20 border-cyan-400 text-white'
                      : 'bg-slate-900/70 border-white/10 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-xs font-bold">
                    <span className="truncate">
                      {ship.name.replace('Vanguard ', '')}
                    </span>
                    {isEquipped ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    ) : !isOwned ? (
                      <Lock className="h-3 w-3 text-amber-400 shrink-0" />
                    ) : null}
                  </div>
                  <div
                    className="text-[10px] font-medium truncate"
                    style={{ color: ship.accentColor }}
                  >
                    {ship.classLabel}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl bg-slate-950/88 backdrop-blur-md ring-1 ring-white/15 p-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {COSMETIC_CATALOG.map((cos) => {
              const active = previewCosmeticId === cos.id;
              return (
                <button
                  key={cos.id}
                  onClick={() => setPreviewCosmeticId(cos.id)}
                  className={`min-h-[44px] min-w-[44px] rounded-xl border p-1.5 flex items-center justify-center transition cursor-pointer shrink-0 ${
                    active
                      ? 'border-cyan-400 bg-cyan-500/20 scale-105'
                      : 'border-white/10 bg-slate-900/60'
                  }`}
                >
                  <span
                    className="h-6 w-6 rounded-full border border-white/40"
                    style={{ backgroundColor: cos.accentHex }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================================
   * MOBILE HANGAR: UPPER LIVE 3D STAGE + BOTTOM/SIDE SLIDE-UP SHEET
   * ===================================================================== */
  return (
    <div className="pointer-events-none relative h-full w-full flex flex-col justify-between select-none overflow-hidden">
      {/* Top Floating Bar over Live 3D Ship */}
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
            <div className="flex items-center gap-1.5 text-[11px] text-cyan-400 font-medium">
              <span>Hangar</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-emerald-300 tabular-nums">
                {fleetPower} PWR
              </span>
            </div>
            <h2 className="font-display text-sm sm:text-lg font-bold text-white truncate">
              {currentShipDef.name}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="hidden sm:flex min-h-[44px] items-center gap-2 rounded-2xl bg-slate-950/80 ring-1 ring-white/15 px-3 font-mono text-xs tabular-nums">
            <span className="text-amber-300 font-bold">
              {save.salvageCredits.toLocaleString()} CR
            </span>
            <span className="text-fuchsia-300 font-bold">
              {save.abyssalMaterials} AL
            </span>
          </div>

          <button
            onClick={() => sendCameraCommand('testThrusters')}
            aria-label="Ignite Thrusters"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl bg-cyan-500/20 ring-1 ring-cyan-400/45 text-cyan-200 active:scale-95 transition cursor-pointer"
          >
            <Flame className="h-4 w-4" />
          </button>

          <button
            onClick={() => setIsInspecting3D(true)}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-2xl bg-cyan-500/20 ring-1 ring-cyan-400/50 px-3 text-xs font-bold text-cyan-200 active:scale-95 transition cursor-pointer whitespace-nowrap"
          >
            <Eye className="h-4 w-4" />
            <span>3D View</span>
          </button>

          <button
            onClick={onOpenMarket}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-2xl bg-amber-500/20 ring-1 ring-amber-400/45 px-3 text-xs font-bold text-amber-200 active:scale-95 transition cursor-pointer whitespace-nowrap"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden xs:inline">Shop</span>
          </button>
        </div>
      </div>

      {/* Responsive Container: Top space stays transparent on Portrait for 3D ship */}
      <div className="flex-1 flex flex-col lg:flex-row lg:items-end lg:justify-end overflow-hidden pointer-events-none">
        {/* Transparent 3D Showcase Touch Window (clicks/swipes go directly to 3D Canvas) */}
        <div className="flex-1 min-h-[22dvh] pointer-events-none flex items-end justify-center pb-2">
          <span className="rounded-xl bg-slate-950/50 px-2.5 py-1 text-[10px] text-slate-300/80 ring-1 ring-white/10">
            Drag Ship to Rotate · Pinch Zoom
          </span>
        </div>

        {/* Slide-Up Mobile Sheet (Bottom on Portrait/Compact, Right Drawer on Wide Landscape) */}
        <div className="pointer-events-auto animate-panel-up w-full lg:w-[540px] lg:h-[calc(100%-12px)] lg:mr-4 lg:mb-3 max-h-[68dvh] lg:max-h-none flex flex-col rounded-t-3xl lg:rounded-3xl bg-slate-950/92 backdrop-blur-xl border-t lg:border border-white/15 shadow-[0_-18px_50px_rgba(0,0,0,0.85)] overflow-hidden">
          {/* Drag Handle + Ship Switcher Strip */}
          <div className="px-3 pt-2.5 pb-2 border-b border-white/10 space-y-2 shrink-0">
            <div className="mx-auto h-1 w-10 rounded-full bg-white/20 lg:hidden" />

            <div className="flex items-center gap-2">
              <div className="flex-1 flex gap-1.5 overflow-x-auto no-scrollbar snap-x">
                {SHIP_CATALOG.map((ship) => {
                  const isPreview = previewShipId === ship.id;
                  const isEquipped = save.selectedShip === ship.id;
                  const isOwned = save.ownedShips.includes(ship.id);
                  return (
                    <button
                      key={ship.id}
                      onClick={() => setPreviewShipId(ship.id)}
                      className={`snap-start min-h-[44px] min-w-[116px] rounded-xl px-2.5 py-1.5 text-left transition cursor-pointer border shrink-0 flex items-center justify-between gap-2 ${
                        isPreview
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : 'bg-slate-900/75 border-white/10 text-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">
                          {ship.name.replace('Vanguard ', '')}
                        </div>
                        <div
                          className="text-[10px] font-medium truncate"
                          style={{ color: ship.accentColor }}
                        >
                          {ship.classLabel}
                        </div>
                      </div>
                      {isEquipped ? (
                        <Check className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                      ) : !isOwned ? (
                        <Lock className="h-3 w-3 text-amber-300 shrink-0" />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {shipOwned ? (
                <button
                  onClick={() => onSelectShip(currentShipDef.id)}
                  className={`min-h-[44px] shrink-0 rounded-xl px-3.5 text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    shipEquipped
                      ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40'
                      : 'bg-cyan-400 text-slate-950'
                  }`}
                >
                  {shipEquipped ? 'Deployed' : 'Deploy'}
                </button>
              ) : (
                <button
                  onClick={() => onUnlockShip(currentShipDef.id)}
                  disabled={!canAffordShip}
                  className={`min-h-[44px] shrink-0 rounded-xl px-3 text-xs font-bold transition whitespace-nowrap ${
                    canAffordShip
                      ? 'bg-amber-400 text-slate-950 cursor-pointer'
                      : 'bg-slate-900 text-slate-500 ring-1 ring-white/10 cursor-not-allowed'
                  }`}
                >
                  {currentShipDef.costCredits} CR
                </button>
              )}
            </div>

            {/* Compact 6-Stat Mini Bar */}
            <div className="grid grid-cols-6 gap-1.5 pt-0.5">
              {statRows.map((row) => {
                const delta = +(row.next - row.curr).toFixed(1);
                return (
                  <div key={row.label} className="min-w-0">
                    <div className="flex items-baseline justify-between text-[10px]">
                      <span className="text-slate-400 truncate">
                        {row.label}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] font-bold text-white tabular-nums truncate">
                      {row.next}
                      {row.unit}
                      {delta !== 0 && (
                        <span
                          className={`ml-0.5 text-[9px] ${
                            delta > 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {delta > 0 ? `+${delta}` : delta}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 h-1 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full ${row.color} transition-all duration-200`}
                        style={{
                          width: `${Math.min(100, (row.next / row.max) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 4 Category Tabs */}
            <div className="grid grid-cols-4 gap-1 rounded-2xl bg-slate-900/90 p-1 ring-1 ring-white/10">
              {(
                [
                  { id: 'weapons', label: 'Weapons', icon: Crosshair },
                  { id: 'modules', label: 'Modules', icon: Sliders },
                  { id: 'defence', label: 'Defence', icon: Shield },
                  { id: 'cosmetics', label: 'Paint', icon: Palette },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = category === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setCategory(tab.id)}
                    className={`min-h-[40px] flex items-center justify-center gap-1 rounded-xl px-1.5 text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-cyan-400 text-slate-950 font-bold'
                        : 'text-slate-300'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable Item Grid */}
          <div className="flex-1 overflow-y-auto px-3 py-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 content-start">
            {category === 'weapons' &&
              WEAPON_CATALOG.map((w) => {
                const isSelected = selectedWeaponId === w.id;
                const isEquipped =
                  save.equippedPrimaryWeapon === w.id ||
                  save.equippedSecondaryWeapon === w.id;
                const isOwned = save.ownedWeapons.includes(w.id);

                return (
                  <button
                    key={w.id}
                    onClick={() => setSelectedWeaponId(w.id)}
                    className={`min-h-[56px] rounded-2xl p-3 text-left flex items-center justify-between gap-2 transition cursor-pointer border ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-500/15 text-white'
                        : 'border-white/10 bg-slate-900/65 text-slate-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {w.name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {w.slot === 'primary' ? 'Primary' : 'Torpedo'} ·{' '}
                        {w.statSummary}
                      </div>
                    </div>
                    <div className="shrink-0 font-mono text-[11px] font-bold tabular-nums">
                      {isEquipped ? (
                        <span className="text-emerald-300">ON</span>
                      ) : isOwned ? (
                        <span className="text-cyan-300">OWNED</span>
                      ) : (
                        <span className="text-amber-300">{w.costCredits} CR</span>
                      )}
                    </div>
                  </button>
                );
              })}

            {category === 'modules' &&
              tacticalModules.map((upg) => {
                const isSelected = selectedModuleId === upg.id;
                const isEquipped = save.activeUpgrades.includes(upg.id);
                const isOwned = save.ownedUpgrades.includes(upg.id);
                const tier = save.upgradeTiers[upg.id] || 1;

                return (
                  <button
                    key={upg.id}
                    onClick={() => setSelectedModuleId(upg.id)}
                    className={`min-h-[56px] rounded-2xl p-3 text-left flex items-center justify-between gap-2 transition cursor-pointer border ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-500/15 text-white'
                        : 'border-white/10 bg-slate-900/65 text-slate-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {upg.name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {upg.statSummary}
                      </div>
                    </div>
                    <div className="shrink-0 font-mono text-[11px] font-bold tabular-nums">
                      {isEquipped ? (
                        <span className="text-emerald-300">T{tier} ON</span>
                      ) : isOwned ? (
                        <span className="text-cyan-300">T{tier}</span>
                      ) : (
                        <span className="text-amber-300">{upg.cost} CR</span>
                      )}
                    </div>
                  </button>
                );
              })}

            {category === 'defence' &&
              defenceModules.map((upg) => {
                const isSelected = selectedDefenceId === upg.id;
                const isEquipped = save.activeUpgrades.includes(upg.id);
                const isOwned = save.ownedUpgrades.includes(upg.id);
                const tier = save.upgradeTiers[upg.id] || 1;

                return (
                  <button
                    key={upg.id}
                    onClick={() => setSelectedDefenceId(upg.id)}
                    className={`min-h-[56px] rounded-2xl p-3 text-left flex items-center justify-between gap-2 transition cursor-pointer border ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-500/15 text-white'
                        : 'border-white/10 bg-slate-900/65 text-slate-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {upg.name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {upg.statSummary}
                      </div>
                    </div>
                    <div className="shrink-0 font-mono text-[11px] font-bold tabular-nums">
                      {isEquipped ? (
                        <span className="text-emerald-300">T{tier} ON</span>
                      ) : isOwned ? (
                        <span className="text-cyan-300">T{tier}</span>
                      ) : (
                        <span className="text-amber-300">{upg.cost} CR</span>
                      )}
                    </div>
                  </button>
                );
              })}

            {category === 'cosmetics' &&
              COSMETIC_CATALOG.map((cos) => {
                const isSelected = previewCosmeticId === cos.id;
                const isEquipped = save.equippedCosmetic === cos.id;
                const isOwned = save.ownedCosmetics.includes(cos.id);

                return (
                  <button
                    key={cos.id}
                    onClick={() => setPreviewCosmeticId(cos.id)}
                    className={`min-h-[56px] rounded-2xl p-3 text-left flex items-center justify-between gap-2 transition cursor-pointer border ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-500/15 text-white'
                        : 'border-white/10 bg-slate-900/65 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-5 w-5 rounded-full border border-white/30 shrink-0"
                        style={{ backgroundColor: cos.accentHex }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">
                          {cos.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {cos.shortTag}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 font-mono text-[11px] font-bold tabular-nums">
                      {isEquipped ? (
                        <span className="text-emerald-300">ON</span>
                      ) : isOwned ? (
                        <span className="text-cyan-300">OWNED</span>
                      ) : (
                        <span className="text-amber-300">
                          {cos.costCredits} CR
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
          </div>

          {/* Sticky Bottom Inspector + Action CTA Bar */}
          <div className="shrink-0 border-t border-white/10 bg-slate-950/95 px-3 pt-2.5 pb-3 pb-safe space-y-2">
            {category === 'weapons' && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-cyan-400 truncate">
                      {activeWeaponDetail.name} · {activeWeaponDetail.damage} DMG
                      · {activeWeaponDetail.cooldownSeconds}s CD
                    </div>
                    <div className="text-[11px] text-slate-300 truncate">
                      {activeWeaponDetail.description}
                    </div>
                  </div>
                </div>
                {save.ownedWeapons.includes(activeWeaponDetail.id) ? (
                  <button
                    onClick={() =>
                      activeWeaponDetail.slot === 'primary'
                        ? onSelectPrimaryWeapon(
                            activeWeaponDetail.id as PrimaryWeaponId,
                          )
                        : onSelectSecondaryWeapon(
                            activeWeaponDetail.id as SecondaryWeaponId,
                          )
                    }
                    className={`min-h-[48px] w-full rounded-2xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                      save.equippedPrimaryWeapon === activeWeaponDetail.id ||
                      save.equippedSecondaryWeapon === activeWeaponDetail.id
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                        : 'bg-cyan-400 text-slate-950 active:scale-[0.99]'
                    }`}
                  >
                    {save.equippedPrimaryWeapon === activeWeaponDetail.id ||
                    save.equippedSecondaryWeapon === activeWeaponDetail.id
                      ? 'Equipped in Active Bay'
                      : `Equip ${activeWeaponDetail.name}`}
                  </button>
                ) : (
                  <button
                    onClick={onOpenMarket}
                    className="min-h-[48px] w-full rounded-2xl bg-amber-400 text-xs sm:text-sm font-bold text-slate-950 active:scale-[0.99] transition cursor-pointer"
                  >
                    Unlock in Market ({activeWeaponDetail.costCredits} CR)
                  </button>
                )}
              </>
            )}

            {(category === 'modules' || category === 'defence') &&
              (() => {
                const owned = save.ownedUpgrades.includes(activeModuleDetail.id);
                const equipped = save.activeUpgrades.includes(
                  activeModuleDetail.id,
                );
                const tier = save.upgradeTiers[activeModuleDetail.id] || 1;
                const upgradeCostCr = Math.round(
                  activeModuleDetail.cost * 0.65 * tier,
                );
                const upgradeCostMat = tier;
                const canTune =
                  owned &&
                  tier < 3 &&
                  save.salvageCredits >= upgradeCostCr &&
                  save.abyssalMaterials >= upgradeCostMat;

                return (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-cyan-400 truncate">
                          {activeModuleDetail.name} · Tier {owned ? tier : 1}/3 ·
                          Slots {save.activeUpgrades.length}/{maxModuleSlots}
                        </div>
                        <div className="text-[11px] text-slate-300 truncate">
                          {activeModuleDetail.description}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {owned ? (
                        <>
                          <button
                            onClick={() =>
                              onToggleUpgrade(activeModuleDetail.id)
                            }
                            className={`min-h-[48px] flex-1 rounded-2xl px-3 text-xs font-bold transition cursor-pointer ${
                              equipped
                                ? 'bg-slate-800 text-slate-200 border border-white/15'
                                : save.activeUpgrades.length >= maxModuleSlots
                                  ? 'bg-slate-900 text-slate-500 cursor-not-allowed'
                                  : 'bg-cyan-400 text-slate-950'
                            }`}
                          >
                            {equipped
                              ? 'Unequip'
                              : save.activeUpgrades.length >= maxModuleSlots
                                ? `Full (${maxModuleSlots})`
                                : 'Equip Module'}
                          </button>

                          {tier < 3 && (
                            <button
                              onClick={() =>
                                onUpgradeTier(activeModuleDetail.id)
                              }
                              disabled={!canTune}
                              className={`min-h-[48px] flex-1 rounded-2xl px-3 text-xs font-bold transition ${
                                canTune
                                  ? 'bg-fuchsia-400 text-slate-950 cursor-pointer'
                                  : 'bg-slate-900 text-slate-500 border border-white/10 cursor-not-allowed'
                              }`}
                            >
                              T{tier + 1} ({upgradeCostCr} CR + {upgradeCostMat}M)
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={onOpenMarket}
                          className="min-h-[48px] w-full rounded-2xl bg-amber-400 text-xs sm:text-sm font-bold text-slate-950 cursor-pointer"
                        >
                          Unlock in Market ({activeModuleDetail.cost} CR)
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}

            {category === 'cosmetics' && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-fuchsia-400 truncate">
                      {activeCosmeticDetail.name} · {activeCosmeticDetail.shortTag}
                    </div>
                    <div className="text-[11px] text-slate-300 truncate">
                      {activeCosmeticDetail.description}
                    </div>
                  </div>
                </div>
                {save.ownedCosmetics.includes(activeCosmeticDetail.id) ? (
                  <button
                    onClick={() => onSelectCosmetic(activeCosmeticDetail.id)}
                    className={`min-h-[48px] w-full rounded-2xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                      save.equippedCosmetic === activeCosmeticDetail.id
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                        : 'bg-cyan-400 text-slate-950'
                    }`}
                  >
                    {save.equippedCosmetic === activeCosmeticDetail.id
                      ? 'Active Hull Livery'
                      : `Apply ${activeCosmeticDetail.name}`}
                  </button>
                ) : (
                  <button
                    onClick={() => onUnlockCosmetic(activeCosmeticDetail.id)}
                    disabled={
                      save.salvageCredits < activeCosmeticDetail.costCredits
                    }
                    className={`min-h-[48px] w-full rounded-2xl text-xs sm:text-sm font-bold transition ${
                      save.salvageCredits >= activeCosmeticDetail.costCredits
                        ? 'bg-amber-400 text-slate-950 cursor-pointer'
                        : 'bg-slate-900 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    Unlock Livery ({activeCosmeticDetail.costCredits} CR)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
