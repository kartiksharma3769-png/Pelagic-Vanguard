import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Crosshair,
  Flame,
  Lock,
  Palette,
  RotateCcw,
  Shield,
  ShoppingBag,
  Sliders,
  Sparkles,
  Zap,
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

  const sendCameraCommand = (
    action: 'zoomIn' | 'zoomOut' | 'resetView' | 'testThrusters',
  ) => {
    window.dispatchEvent(
      new CustomEvent('pelagic-hangar-camera', { detail: { action } }),
    );
  };

  const currentShipDef =
    SHIP_CATALOG.find((s) => s.id === previewShipId) || SHIP_CATALOG[0];
  const equippedShipDef =
    SHIP_CATALOG.find((s) => s.id === save.selectedShip) || SHIP_CATALOG[0];
  const maxModuleSlots = currentShipDef.moduleCapacity;
  const fleetPower = calculateFleetPower(save);

  // Split upgrades into offensive/tactical Modules vs structural/shield Defence
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

  // Baseline stats (currently equipped configuration)
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

  // Candidate stats based on currently inspected ship + inspected equipment item
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
      label: 'Hull Armor',
      unit: 'HP',
      curr: currentStats.hull,
      next: candidateStats.hull,
      max: 220,
      color: 'bg-emerald-400',
    },
    {
      label: 'Piezo Shield',
      unit: 'SP',
      curr: currentStats.shield,
      next: candidateStats.shield,
      max: 220,
      color: 'bg-cyan-400',
    },
    {
      label: 'Combat Output',
      unit: 'PWR',
      curr: currentStats.firepower,
      next: candidateStats.firepower,
      max: 220,
      color: 'bg-amber-400',
    },
    {
      label: 'Hydro Speed',
      unit: 'KT',
      curr: currentStats.speed,
      next: candidateStats.speed,
      max: 32,
      color: 'bg-sky-400',
    },
    {
      label: 'Torpedo Locks',
      unit: '',
      curr: currentStats.locks,
      next: candidateStats.locks,
      max: 8,
      color: 'bg-fuchsia-400',
    },
    {
      label: 'Depth Rating',
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

  return (
    <div className="relative h-full w-full flex flex-col lg:flex-row justify-between overflow-hidden pointer-events-none select-none">
      {/* =====================================================================
          LEFT 62% — INTERACTIVE 3D FIGHTER SHOWROOM (55-65% Screen Area)
         ===================================================================== */}
      <div className="lg:w-[62%] xl:w-[64%] h-full flex flex-col justify-between p-5 sm:p-8 pointer-events-none">
        {/* Top Row: Ship Class, Name, Combat Role & Primary Hull Action */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="pointer-events-auto max-w-xl bg-gradient-to-r from-slate-950/88 via-slate-950/60 to-transparent pl-4 pr-8 py-3.5 rounded-r-2xl border-l-4 border-cyan-400">
            <div className="flex items-center gap-2.5">
              <span
                className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                style={{
                  color: currentShipDef.accentColor,
                  backgroundColor: `${currentShipDef.accentColor}20`,
                }}
              >
                {currentShipDef.classLabel} Class
              </span>
              <span className="text-xs text-slate-300 font-medium">
                {currentShipDef.subtitle}
              </span>
              <span className="font-mono text-xs text-cyan-300 font-bold">
                · {fleetPower} PWR
              </span>
            </div>

            <h1 className="mt-1 text-2xl sm:text-4xl font-black tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.85)]">
              {currentShipDef.name}
            </h1>

            <p className="mt-1 text-xs sm:text-sm text-slate-300/90 max-w-lg leading-relaxed">
              {currentShipDef.description}
            </p>

            {/* Direct Hull Equip / Unlock Bar when inspecting another ship */}
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              {shipOwned ? (
                <button
                  onClick={() => onSelectShip(currentShipDef.id)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    shipEquipped
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                      : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-[0_0_24px_rgba(6,182,212,0.4)]'
                  }`}
                >
                  {shipEquipped ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Active Flagship
                    </>
                  ) : (
                    'EQUIP FIGHTER HULL'
                  )}
                </button>
              ) : (
                <button
                  onClick={() => onUnlockShip(currentShipDef.id)}
                  disabled={!canAffordShip}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
                    canAffordShip
                      ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-[0_0_24px_rgba(245,158,11,0.4)] cursor-pointer'
                      : 'bg-slate-900/90 text-slate-400 border border-white/10 cursor-not-allowed'
                  }`}
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>
                    UNLOCK HULL ({currentShipDef.costCredits} CR
                    {currentShipDef.costMaterials > 0
                      ? ` + ${currentShipDef.costMaterials} Alloy`
                      : ''}
                    )
                  </span>
                </button>
              )}

              <span className="text-xs font-mono text-cyan-300/90 bg-slate-950/75 px-3 py-1.5 rounded-lg border border-white/10">
                {currentShipDef.tradeOffText}
              </span>
            </div>
          </div>

          {/* Interactive 3D Showroom Camera & Engine Controls */}
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-xl bg-slate-950/80 border border-white/10 p-1.5 shadow-lg">
            <button
              onClick={() => sendCameraCommand('zoomIn')}
              title="Zoom In (or Scroll Wheel)"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={() => sendCameraCommand('zoomOut')}
              title="Zoom Out (or Scroll Wheel)"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              onClick={() => sendCameraCommand('resetView')}
              title="Reset 3D Camera Angle"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <div className="h-4 w-px bg-white/10 mx-0.5" />
            <button
              onClick={() => sendCameraCommand('testThrusters')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 px-2.5 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/30 transition cursor-pointer"
            >
              <Flame className="h-3.5 w-3.5 text-cyan-300" />
              <span>Engine Flare</span>
            </button>
          </div>
        </div>

        {/* Center 3D Viewport stays 100% open so the live ship dominates the screen */}
        <div className="my-auto pointer-events-none flex items-center justify-start">
          <div className="text-[11px] text-slate-400/80 bg-slate-950/55 px-3 py-1 rounded-full border border-white/5">
            Drag to orbit 360° · Scroll wheel to zoom
          </div>
        </div>

        {/* Bottom Showroom Bar: 4-Ship Fleet Switcher + Compact Visual Stat Comparison */}
        <div className="pointer-events-auto grid grid-cols-1 xl:grid-cols-12 gap-4 items-end">
          {/* 4-Ship Interactive Dock */}
          <div className="xl:col-span-7 bg-gradient-to-t from-slate-950/92 via-slate-950/80 to-slate-950/50 p-3 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold text-slate-300">
                Vanguard Submarine Fleet (Select to Switch 3D Hull)
              </span>
              <span className="font-mono text-[11px] text-cyan-300">
                {save.ownedShips.length} / {SHIP_CATALOG.length} Hulls Unlocked
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SHIP_CATALOG.map((ship) => {
                const isPreview = previewShipId === ship.id;
                const isEquipped = save.selectedShip === ship.id;
                const isOwned = save.ownedShips.includes(ship.id);
                return (
                  <button
                    key={ship.id}
                    onClick={() => setPreviewShipId(ship.id)}
                    className={`group relative rounded-xl p-2.5 text-left transition cursor-pointer border ${
                      isPreview
                        ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)]'
                        : 'bg-slate-900/65 border-white/10 hover:border-white/25 hover:bg-slate-900/90'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[10px] font-bold uppercase"
                        style={{ color: ship.accentColor }}
                      >
                        {ship.classLabel}
                      </span>
                      {isEquipped ? (
                        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                      ) : !isOwned ? (
                        <Lock className="h-3 w-3 text-amber-400/80" />
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs font-bold text-white truncate">
                      {ship.name.replace('Vanguard ', '')}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                      {isEquipped
                        ? 'Equipped'
                        : isOwned
                        ? 'Ready'
                        : `${ship.costCredits} CR`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Compact Visual Stat Comparison (Current vs Preview/Selected Item) */}
          <div className="xl:col-span-5 bg-gradient-to-t from-slate-950/92 via-slate-950/80 to-slate-950/50 p-3.5 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300">
                Current vs. Previewed Telemetry
              </span>
              <span className="font-mono text-[11px] text-emerald-300">
                Slots: {save.activeUpgrades.length}/{maxModuleSlots}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {statRows.map((row) => {
                const delta = +(row.next - row.curr).toFixed(1);
                return (
                  <div key={row.label} className="text-xs">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] text-slate-400">
                        {row.label}
                      </span>
                      <div className="font-mono text-[11px] flex items-center gap-1">
                        <span className="font-bold text-white">
                          {row.next}
                          {row.unit}
                        </span>
                        {delta !== 0 && (
                          <span
                            className={
                              delta > 0
                                ? 'text-emerald-400 font-bold'
                                : 'text-rose-400 font-bold'
                            }
                          >
                            ({delta > 0 ? `+${delta}` : delta})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="relative h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full ${row.color} transition-all duration-300`}
                        style={{
                          width: `${Math.min(100, (row.next / row.max) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          RIGHT 38% — MASTER-DETAIL EQUIPMENT & LOADOUT INSPECTOR
         ===================================================================== */}
      <div className="pointer-events-auto w-full lg:w-[38%] xl:w-[36%] h-full bg-gradient-to-l from-slate-950/96 via-slate-950/92 to-slate-950/75 border-l border-white/10 flex flex-col justify-between p-5 sm:p-6 overflow-y-auto">
        <div>
          {/* Top Bar */}
          <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-white/10">
            <div>
              <div className="text-xs font-medium text-cyan-400">
                Submersible Loadout Bay
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                Equipment & Tuning
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenMarket}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-400/35 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 transition cursor-pointer"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                Market
              </button>
              <button
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Berth
              </button>
            </div>
          </div>

          {/* 4 Separate Equipment Navigation Tabs: Weapons, Modules, Defence, Cosmetics */}
          <div className="grid grid-cols-4 gap-1 my-4 rounded-xl bg-slate-900/90 p-1 border border-white/10">
            {(
              [
                { id: 'weapons', label: 'Weapons', icon: Crosshair },
                { id: 'modules', label: 'Modules', icon: Sliders },
                { id: 'defence', label: 'Defence', icon: Shield },
                { id: 'cosmetics', label: 'Cosmetics', icon: Palette },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = category === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCategory(tab.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition cursor-pointer ${
                    active
                      ? 'bg-cyan-400 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* SELECTED ITEM DETAIL PANEL (High-Impact Visual Inspector) */}
          <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/95 via-slate-950 to-slate-950 p-4 mb-4 shadow-inner">
            {category === 'weapons' && (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-semibold uppercase text-cyan-400">
                      {activeWeaponDetail.slot === 'primary'
                        ? 'Primary Acoustic Cannon'
                        : 'Heavy Torpedo Bay'}{' '}
                      · {activeWeaponDetail.shortTag}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-0.5">
                      {activeWeaponDetail.name}
                    </h3>
                  </div>
                  <span className="rounded-lg bg-cyan-500/15 border border-cyan-400/30 px-2.5 py-1 font-mono text-xs font-bold text-cyan-300">
                    {activeWeaponDetail.statSummary}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  {activeWeaponDetail.description}
                </p>

                {/* Weapon Stat Breakdown */}
                <div className="mt-3 grid grid-cols-3 gap-2 pt-3 border-t border-white/10 font-mono text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400">Damage</div>
                    <div className="text-white font-bold">
                      {activeWeaponDetail.damage} DMG
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Cycle Rate</div>
                    <div className="text-cyan-300 font-bold">
                      {activeWeaponDetail.cooldownSeconds}s
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Velocity</div>
                    <div className="text-emerald-300 font-bold">
                      {activeWeaponDetail.projectileSpeed} m/s
                    </div>
                  </div>
                </div>

                {/* Prominent EQUIP / UNLOCK CTA */}
                <div className="mt-4">
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
                      className={`w-full rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                        save.equippedPrimaryWeapon === activeWeaponDetail.id ||
                        save.equippedSecondaryWeapon === activeWeaponDetail.id
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                          : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-[0_0_24px_rgba(6,182,212,0.35)]'
                      }`}
                    >
                      {save.equippedPrimaryWeapon === activeWeaponDetail.id ||
                      save.equippedSecondaryWeapon === activeWeaponDetail.id
                        ? '✓ EQUIPPED IN ACTIVE BAY'
                        : `EQUIP ${activeWeaponDetail.name.toUpperCase()}`}
                    </button>
                  ) : (
                    <button
                      onClick={onOpenMarket}
                      className="w-full rounded-xl bg-amber-400 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-950 hover:bg-amber-300 transition cursor-pointer"
                    >
                      UNLOCK IN MARKET ({activeWeaponDetail.costCredits} CR)
                    </button>
                  )}
                </div>
              </div>
            )}

            {(category === 'modules' || category === 'defence') && (
              <div>
                {(() => {
                  const owned = save.ownedUpgrades.includes(
                    activeModuleDetail.id,
                  );
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
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[11px] font-semibold uppercase text-cyan-400">
                            {category === 'defence'
                              ? 'Defensive & Hull System'
                              : 'Tactical Sub-Module'}{' '}
                            · Tier {owned ? tier : 1}/3
                          </span>
                          <h3 className="text-lg font-bold text-white mt-0.5">
                            {activeModuleDetail.name}
                          </h3>
                        </div>
                        <span className="rounded-lg bg-emerald-500/15 border border-emerald-400/30 px-2.5 py-1 font-mono text-xs font-bold text-emerald-300">
                          {activeModuleDetail.statSummary}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                        {activeModuleDetail.description}
                      </p>

                      {/* Visual Tier Track */}
                      <div className="mt-3 grid grid-cols-3 gap-1.5 pt-3 border-t border-white/10">
                        {[1, 2, 3].map((t) => (
                          <div
                            key={t}
                            className={`rounded-lg px-2.5 py-1.5 text-center font-mono text-[11px] border ${
                              owned && tier >= t
                                ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200 font-bold'
                                : 'border-white/5 bg-slate-900/60 text-slate-500'
                            }`}
                          >
                            Tier {t} {t === 1 ? 'Base' : t === 2 ? '+25%' : '+50%'}
                          </div>
                        ))}
                      </div>

                      {/* Prominent EQUIP / UPGRADE / UNLOCK Actions */}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {owned ? (
                          <>
                            <button
                              onClick={() =>
                                onToggleUpgrade(activeModuleDetail.id)
                              }
                              className={`flex-1 rounded-xl py-2.5 px-3 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                                equipped
                                  ? 'bg-slate-800 text-slate-200 border border-white/15 hover:bg-slate-700'
                                  : save.activeUpgrades.length >= maxModuleSlots
                                  ? 'bg-slate-900 text-slate-500 cursor-not-allowed'
                                  : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.35)]'
                              }`}
                            >
                              {equipped
                                ? 'UNEQUIP MODULE'
                                : save.activeUpgrades.length >= maxModuleSlots
                                ? `SLOTS FULL (${maxModuleSlots}/${maxModuleSlots})`
                                : 'EQUIP MODULE'}
                            </button>

                            {tier < 3 && (
                              <button
                                onClick={() =>
                                  onUpgradeTier(activeModuleDetail.id)
                                }
                                disabled={!canTune}
                                className={`rounded-xl px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                                  canTune
                                    ? 'bg-fuchsia-400 text-slate-950 hover:bg-fuchsia-300 cursor-pointer'
                                    : 'bg-slate-900 text-slate-500 border border-white/10 cursor-not-allowed'
                                }`}
                              >
                                UPGRADE T{tier + 1} ({upgradeCostCr} CR +{' '}
                                {upgradeCostMat}M)
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={onOpenMarket}
                            className="w-full rounded-xl bg-amber-400 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-950 hover:bg-amber-300 transition cursor-pointer"
                          >
                            UNLOCK IN MARKET ({activeModuleDetail.cost} CR)
                          </button>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {category === 'cosmetics' && (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-semibold uppercase text-fuchsia-400">
                      Bioluminescent Hull Trim · {activeCosmeticDetail.shortTag}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-0.5">
                      {activeCosmeticDetail.name}
                    </h3>
                  </div>
                  <div
                    className="h-10 w-10 rounded-full border-2 border-white/30 shadow-lg shrink-0"
                    style={{ backgroundColor: activeCosmeticDetail.accentHex }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  {activeCosmeticDetail.description}
                </p>
                <div className="mt-4">
                  {save.ownedCosmetics.includes(activeCosmeticDetail.id) ? (
                    <button
                      onClick={() => onSelectCosmetic(activeCosmeticDetail.id)}
                      className={`w-full rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                        save.equippedCosmetic === activeCosmeticDetail.id
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                          : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                      }`}
                    >
                      {save.equippedCosmetic === activeCosmeticDetail.id
                        ? '✓ ACTIVE HULL LIVERY'
                        : 'EQUIP LIVERY'}
                    </button>
                  ) : (
                    <button
                      onClick={() => onUnlockCosmetic(activeCosmeticDetail.id)}
                      disabled={
                        save.salvageCredits < activeCosmeticDetail.costCredits
                      }
                      className={`w-full rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                        save.salvageCredits >= activeCosmeticDetail.costCredits
                          ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      UNLOCK LIVERY ({activeCosmeticDetail.costCredits} CR)
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SLEEK EQUIPMENT SELECTION LIST (No Card Wall Clutter) */}
          <div className="space-y-1.5">
            {category === 'weapons' &&
              WEAPON_CATALOG.map((w) => {
                const isSelected = selectedWeaponId === w.id;
                const isEquipped =
                  save.equippedPrimaryWeapon === w.id ||
                  save.equippedSecondaryWeapon === w.id;
                const isOwned = save.ownedWeapons.includes(w.id);

                return (
                  <div
                    key={w.id}
                    onClick={() => setSelectedWeaponId(w.id)}
                    className={`rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 transition cursor-pointer border-l-4 ${
                      isSelected
                        ? 'border-l-cyan-400 bg-cyan-500/15 text-white'
                        : 'border-l-transparent bg-slate-900/45 text-slate-300 hover:bg-slate-900/75'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: w.accentColor }}
                      />
                      <div className="truncate">
                        <div className="text-xs font-bold text-white truncate">
                          {w.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {w.slot === 'primary'
                            ? 'Primary Cannon'
                            : 'Heavy Torpedo'}{' '}
                          · {w.statSummary}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isEquipped ? (
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          EQUIPPED
                        </span>
                      ) : isOwned ? (
                        <span className="text-[11px] font-mono text-cyan-300">
                          OWNED
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-amber-300">
                          {w.costCredits} CR
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

            {category === 'modules' &&
              tacticalModules.map((upg) => {
                const isSelected = selectedModuleId === upg.id;
                const isEquipped = save.activeUpgrades.includes(upg.id);
                const isOwned = save.ownedUpgrades.includes(upg.id);
                const tier = save.upgradeTiers[upg.id] || 1;

                return (
                  <div
                    key={upg.id}
                    onClick={() => setSelectedModuleId(upg.id)}
                    className={`rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 transition cursor-pointer border-l-4 ${
                      isSelected
                        ? 'border-l-cyan-400 bg-cyan-500/15 text-white'
                        : 'border-l-transparent bg-slate-900/45 text-slate-300 hover:bg-slate-900/75'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {upg.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {upg.statSummary}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isOwned && (
                        <span className="font-mono text-[10px] text-cyan-300">
                          T{tier}
                        </span>
                      )}
                      {isEquipped ? (
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          EQUIPPED
                        </span>
                      ) : isOwned ? (
                        <span className="text-[11px] font-mono text-slate-300">
                          READY
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-amber-300">
                          {upg.cost} CR
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

            {category === 'defence' &&
              defenceModules.map((upg) => {
                const isSelected = selectedDefenceId === upg.id;
                const isEquipped = save.activeUpgrades.includes(upg.id);
                const isOwned = save.ownedUpgrades.includes(upg.id);
                const tier = save.upgradeTiers[upg.id] || 1;

                return (
                  <div
                    key={upg.id}
                    onClick={() => setSelectedDefenceId(upg.id)}
                    className={`rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 transition cursor-pointer border-l-4 ${
                      isSelected
                        ? 'border-l-cyan-400 bg-cyan-500/15 text-white'
                        : 'border-l-transparent bg-slate-900/45 text-slate-300 hover:bg-slate-900/75'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {upg.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {upg.statSummary}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isOwned && (
                        <span className="font-mono text-[10px] text-cyan-300">
                          T{tier}
                        </span>
                      )}
                      {isEquipped ? (
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          EQUIPPED
                        </span>
                      ) : isOwned ? (
                        <span className="text-[11px] font-mono text-slate-300">
                          READY
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-amber-300">
                          {upg.cost} CR
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

            {category === 'cosmetics' &&
              COSMETIC_CATALOG.map((cos) => {
                const isSelected = previewCosmeticId === cos.id;
                const isEquipped = save.equippedCosmetic === cos.id;
                const isOwned = save.ownedCosmetics.includes(cos.id);

                return (
                  <div
                    key={cos.id}
                    onClick={() => setPreviewCosmeticId(cos.id)}
                    className={`rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 transition cursor-pointer border-l-4 ${
                      isSelected
                        ? 'border-l-cyan-400 bg-cyan-500/15 text-white'
                        : 'border-l-transparent bg-slate-900/45 text-slate-300 hover:bg-slate-900/75'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="h-4 w-4 rounded-full border border-white/30"
                        style={{ backgroundColor: cos.accentHex }}
                      />
                      <div>
                        <div className="text-xs font-bold text-white">
                          {cos.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {cos.shortTag}
                        </div>
                      </div>
                    </div>

                    <div>
                      {isEquipped ? (
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          EQUIPPED
                        </span>
                      ) : isOwned ? (
                        <span className="text-[11px] font-mono text-cyan-300">
                          OWNED
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-amber-300">
                          {cos.costCredits} CR
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Footer Confirm Loadout CTA */}
        <div className="mt-5 pt-3.5 border-t border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span>Loadout auto-saves to active ship</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-cyan-400 px-5 py-2 text-xs font-bold uppercase tracking-wider text-slate-950 hover:bg-cyan-300 transition shadow-[0_0_20px_rgba(6,182,212,0.35)] cursor-pointer"
          >
            Confirm Loadout
          </button>
        </div>
      </div>
    </div>
  );
};
