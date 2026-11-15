import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Database,
  Eye,
  Flame,
  Layers,
  Lock,
  Palette,
  RefreshCw,
  RotateCcw,
  Shield,
  ShoppingBag,
  Sparkles,
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
  UpgradeId,
  WeaponId,
} from '../game/types';

interface AbyssalMarketProps {
  save: PlayerSaveData;
  onBuyUpgrade: (id: UpgradeId) => void;
  onToggleEquipUpgrade: (id: UpgradeId) => void;
  onUpgradeTier: (id: UpgradeId) => void;
  onBuyWeapon: (id: WeaponId) => void;
  onSelectPrimaryWeapon: (id: PrimaryWeaponId) => void;
  onSelectSecondaryWeapon: (id: SecondaryWeaponId) => void;
  onUnlockShip: (id: ShipClassId) => void;
  onSelectShip: (id: ShipClassId) => void;
  onUnlockCosmetic: (id: CosmeticId) => void;
  onSelectCosmetic: (id: CosmeticId) => void;
  onPreviewShip: (shipId: ShipClassId, cosmeticId?: CosmeticId) => void;
  onRefundAllUpgrades: () => void;
  onClaimSupplyGrant: () => void;
  onExchangeCreditsForCore: () => void;
  onClose: () => void;
}

type MarketCategory =
  | 'ships'
  | 'weapons'
  | 'modules'
  | 'cosmetics'
  | 'resources';

export const AbyssalMarket: React.FC<AbyssalMarketProps> = ({
  save,
  onBuyUpgrade,
  onToggleEquipUpgrade,
  onUpgradeTier,
  onBuyWeapon,
  onSelectPrimaryWeapon,
  onSelectSecondaryWeapon,
  onUnlockShip,
  onSelectShip,
  onUnlockCosmetic,
  onSelectCosmetic,
  onPreviewShip,
  onRefundAllUpgrades,
  onClaimSupplyGrant,
  onExchangeCreditsForCore,
  onClose,
}) => {
  const [category, setCategory] = useState<MarketCategory>('ships');
  const [isInspecting3D, setIsInspecting3D] = useState<boolean>(false);
  const [selectedShipId, setSelectedShipId] = useState<ShipClassId>(
    save.selectedShip,
  );
  const [selectedWeaponId, setSelectedWeaponId] = useState<WeaponId>(
    WEAPON_CATALOG[1].id,
  );
  const [selectedModuleId, setSelectedModuleId] = useState<UpgradeId>(
    UPGRADE_CATALOG[0].id,
  );
  const [selectedCosmeticId, setSelectedCosmeticId] = useState<CosmeticId>(
    COSMETIC_CATALOG[1].id,
  );
  const [confirmationBanner, setConfirmationBanner] = useState<string | null>(
    null,
  );

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

  const triggerConfirmation = (msg: string) => {
    setConfirmationBanner(msg);
    window.setTimeout(() => {
      setConfirmationBanner((prev) => (prev === msg ? null : prev));
    }, 2600);
  };

  const activeShip =
    SHIP_CATALOG.find((s) => s.id === save.selectedShip) || SHIP_CATALOG[0];
  const maxModuleSlots = activeShip.moduleCapacity;

  const focusShipIndex = Math.max(
    0,
    SHIP_CATALOG.findIndex((s) => s.id === selectedShipId),
  );
  const focusShip = SHIP_CATALOG[focusShipIndex] || SHIP_CATALOG[0];
  const focusShipTier = focusShip.tier || focusShipIndex + 1;
  const focusWeapon =
    WEAPON_CATALOG.find((w) => w.id === selectedWeaponId) || WEAPON_CATALOG[0];
  const focusModule =
    UPGRADE_CATALOG.find((u) => u.id === selectedModuleId) ||
    UPGRADE_CATALOG[0];
  const focusCosmetic =
    COSMETIC_CATALOG.find((c) => c.id === selectedCosmeticId) ||
    COSMETIC_CATALOG[0];

  const stepSelectedShip = (delta: number) => {
    const nextIdx =
      (focusShipIndex + delta + SHIP_CATALOG.length) % SHIP_CATALOG.length;
    const nextShip = SHIP_CATALOG[nextIdx];
    setSelectedShipId(nextShip.id);
    onPreviewShip(nextShip.id, selectedCosmeticId);
  };

  /* =======================================================================
   * FULLSCREEN 3D SHOWROOM INSPECTION VIEWPORT
   * ===================================================================== */
  if (isInspecting3D) {
    return (
      <div className="relative h-full w-full flex flex-col justify-between p-3 sm:p-5 pt-safe pb-safe px-safe pointer-events-none select-none overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="pointer-events-auto rounded-2xl bg-slate-950/80 backdrop-blur-md ring-1 ring-white/15 px-3.5 py-2.5 shadow-xl max-w-xs sm:max-w-sm">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-400">
              <span className="font-mono font-bold">
                TIER {focusShipTier}/{SHIP_CATALOG.length}
              </span>
              <span aria-hidden="true">·</span>
              <span>3D Showroom</span>
            </div>
            <h1 className="font-display text-lg sm:text-xl font-bold text-white truncate">
              {focusShip.name} · {focusCosmetic.name}
            </h1>
            <p className="mt-0.5 text-[11px] text-slate-300 truncate">
              {focusShip.subtitle}
            </p>
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
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-2xl bg-amber-400 px-3.5 py-2 font-display text-xs font-bold text-slate-950 shadow-lg active:scale-95 transition cursor-pointer whitespace-nowrap"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>Shop</span>
            </button>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-2">
          <div className="flex-1 rounded-2xl bg-slate-950/88 backdrop-blur-md ring-1 ring-white/15 p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => stepSelectedShip(-1)}
                aria-label="Previous Ship"
                className="min-h-[42px] px-3 rounded-xl bg-slate-900/90 border border-white/15 text-slate-200 hover:bg-white/10 active:scale-95 transition cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Prev</span>
              </button>

              <div className="min-w-0 text-center flex-1">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-white truncate">
                  <span className="font-mono text-amber-300">
                    T{focusShipTier}
                  </span>
                  <span className="truncate">{focusShip.name}</span>
                  {save.selectedShip === focusShip.id ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : !save.ownedShips.includes(focusShip.id) ? (
                    <Lock className="h-3 w-3 text-amber-400 shrink-0" />
                  ) : null}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {focusShip.baseHull} HP · {focusShip.baseShield} SP ·{' '}
                  {focusShip.baseSpeed} m/s · {focusShip.baseTorpedoLocks} Locks ·{' '}
                  {focusShip.moduleCapacity} Slots
                </div>
              </div>

              <button
                onClick={() => stepSelectedShip(1)}
                aria-label="Next Ship"
                className="min-h-[42px] px-3 rounded-xl bg-slate-900/90 border border-white/15 text-slate-200 hover:bg-white/10 active:scale-95 transition cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Interactive 12-Tier Progression Bar */}
            <div className="grid grid-cols-12 gap-1 pt-0.5">
              {SHIP_CATALOG.map((ship, idx) => {
                const isCurr = ship.id === selectedShipId;
                const isOwn = save.ownedShips.includes(ship.id);
                const isEq = save.selectedShip === ship.id;
                return (
                  <button
                    key={ship.id}
                    onClick={() => {
                      setSelectedShipId(ship.id);
                      onPreviewShip(ship.id, selectedCosmeticId);
                    }}
                    title={`Tier ${idx + 1}: ${ship.name}`}
                    className={`h-5 rounded-md font-mono text-[9px] font-bold transition cursor-pointer flex items-center justify-center border ${
                      isCurr
                        ? 'bg-amber-400 text-slate-950 border-white shadow-[0_0_10px_rgba(251,191,36,0.6)] scale-105'
                        : isEq
                          ? 'bg-emerald-500/35 text-emerald-200 border-emerald-400/60'
                          : isOwn
                            ? 'bg-slate-800 text-cyan-200 border-cyan-500/30'
                            : 'bg-slate-900/80 text-slate-500 border-white/10'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-950/88 backdrop-blur-md ring-1 ring-white/15 p-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {COSMETIC_CATALOG.map((cos) => (
              <button
                key={cos.id}
                onClick={() => {
                  setSelectedCosmeticId(cos.id);
                  onPreviewShip(selectedShipId, cos.id);
                }}
                className={`min-h-[44px] min-w-[44px] rounded-xl border p-1.5 flex items-center justify-center transition cursor-pointer shrink-0 ${
                  selectedCosmeticId === cos.id
                    ? 'border-amber-400 bg-amber-500/20 scale-105'
                    : 'border-white/10 bg-slate-900/60'
                }`}
              >
                <span
                  className="h-6 w-6 rounded-full border border-white/40"
                  style={{ backgroundColor: cos.accentHex }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================================
   * MOBILE SHOP: UPPER LIVE 3D PREVIEW + SLIDE-UP SHOP SHEET
   * ===================================================================== */
  return (
    <div className="pointer-events-none relative h-full w-full flex flex-col justify-between select-none overflow-hidden">
      {/* Top Translucent Header */}
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
            <div className="text-[11px] font-medium text-amber-400">
              Abyssal Market · Slots {save.activeUpgrades.length}/
              {maxModuleSlots}
            </div>
            <h2 className="font-display text-sm sm:text-lg font-bold text-white truncate">
              Fleet Requisition
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex min-h-[44px] items-center gap-2 rounded-2xl bg-slate-950/80 ring-1 ring-white/15 px-2.5 sm:px-3 font-mono text-xs tabular-nums">
            <span className="text-amber-300 font-bold">
              {save.salvageCredits.toLocaleString()} CR
            </span>
            <span className="text-fuchsia-300 font-bold">
              {save.abyssalMaterials} AL
            </span>
          </div>

          <button
            onClick={() => setIsInspecting3D(true)}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-2xl bg-cyan-500/20 ring-1 ring-cyan-400/50 px-3 text-xs font-bold text-cyan-200 active:scale-95 transition cursor-pointer whitespace-nowrap"
          >
            <Eye className="h-4 w-4" />
            <span className="hidden xs:inline">3D View</span>
          </button>
        </div>
      </div>

      {/* Responsive Container: Transparent 3D stage above / left of Shop Sheet */}
      <div className="flex-1 flex flex-col lg:flex-row lg:items-end lg:justify-end overflow-hidden pointer-events-none">
        <div className="flex-1 min-h-[18dvh] pointer-events-none flex items-end justify-center pb-2">
          {confirmationBanner ? (
            <div className="rounded-2xl border border-emerald-400/60 bg-emerald-950/90 px-4 py-2 flex items-center gap-2 text-xs font-semibold text-emerald-200 shadow-xl">
              <Check className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{confirmationBanner}</span>
            </div>
          ) : (
            <span className="rounded-xl bg-slate-950/50 px-2.5 py-1 text-[10px] text-slate-300/80 ring-1 ring-white/10">
              Drag Ship to Rotate · Pinch Zoom
            </span>
          )}
        </div>

        {/* Slide-up Mobile Shop Sheet */}
        <div className="pointer-events-auto animate-panel-up w-full lg:w-[560px] lg:h-[calc(100%-12px)] lg:mr-4 lg:mb-3 max-h-[72dvh] lg:max-h-none flex flex-col rounded-t-3xl lg:rounded-3xl bg-slate-950/92 backdrop-blur-xl border-t lg:border border-white/15 shadow-[0_-18px_50px_rgba(0,0,0,0.85)] overflow-hidden">
          {/* Drag Handle + 5 Scrollable Category Tabs */}
          <div className="px-3 pt-2.5 pb-2 border-b border-white/10 space-y-2 shrink-0">
            <div className="mx-auto h-1 w-10 rounded-full bg-white/20 lg:hidden" />

            <div className="flex gap-1.5 overflow-x-auto no-scrollbar rounded-2xl bg-slate-900/90 p-1 ring-1 ring-white/10">
              {(
                [
                  { id: 'ships', label: 'Ships (12)', icon: Shield },
                  { id: 'weapons', label: 'Weapons', icon: Crosshair },
                  { id: 'modules', label: 'Modules', icon: Layers },
                  { id: 'cosmetics', label: 'Paint', icon: Palette },
                  { id: 'resources', label: 'Refinery', icon: Database },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = category === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setCategory(tab.id)}
                    className={`min-h-[42px] flex-1 min-w-[78px] flex items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'text-slate-300'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable Catalog Grid */}
          <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2">
            {category === 'ships' && (
              <div className="space-y-2.5">
                {/* Prev/Next + 12-Tier Progression Bar at Top of Ships Tab */}
                <div className="rounded-2xl bg-slate-900/85 border border-white/10 p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => stepSelectedShip(-1)}
                      aria-label="Previous Ship"
                      className="min-h-[40px] px-2.5 rounded-xl bg-slate-950/90 border border-white/15 text-slate-200 hover:bg-white/10 active:scale-95 transition cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span>Prev</span>
                    </button>

                    <div className="min-w-0 text-center flex-1">
                      <div className="text-xs font-bold text-white truncate">
                        <span className="font-mono text-amber-300 mr-1.5">
                          TIER {focusShipTier}/{SHIP_CATALOG.length}
                        </span>
                        {focusShip.name}
                      </div>
                      <div
                        className="text-[10px] font-medium truncate"
                        style={{ color: focusShip.accentColor }}
                      >
                        {focusShip.subtitle}
                      </div>
                    </div>

                    <button
                      onClick={() => stepSelectedShip(1)}
                      aria-label="Next Ship"
                      className="min-h-[40px] px-2.5 rounded-xl bg-slate-950/90 border border-white/15 text-slate-200 hover:bg-white/10 active:scale-95 transition cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0"
                    >
                      <span>Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-12 gap-1">
                    {SHIP_CATALOG.map((ship, idx) => {
                      const isCurr = ship.id === selectedShipId;
                      const isOwn = save.ownedShips.includes(ship.id);
                      const isEq = save.selectedShip === ship.id;
                      return (
                        <button
                          key={ship.id}
                          onClick={() => {
                            setSelectedShipId(ship.id);
                            onPreviewShip(ship.id, save.equippedCosmetic);
                          }}
                          title={`Tier ${idx + 1}: ${ship.name}`}
                          className={`h-5 rounded-md font-mono text-[9px] font-bold transition cursor-pointer flex items-center justify-center border ${
                            isCurr
                              ? 'bg-amber-400 text-slate-950 border-white shadow-[0_0_8px_rgba(251,191,36,0.55)]'
                              : isEq
                                ? 'bg-emerald-500/35 text-emerald-200 border-emerald-400/60'
                                : isOwn
                                  ? 'bg-slate-800 text-cyan-200 border-cyan-500/30'
                                  : 'bg-slate-950 text-slate-500 border-white/10'
                          }`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SHIP_CATALOG.map((ship, idx) => {
                    const owned = save.ownedShips.includes(ship.id);
                    const active = save.selectedShip === ship.id;
                    const isFocused = focusShip.id === ship.id;
                    const tierNum = ship.tier || idx + 1;
                    return (
                      <button
                        key={ship.id}
                        onClick={() => {
                          setSelectedShipId(ship.id);
                          onPreviewShip(ship.id, save.equippedCosmetic);
                        }}
                        className={`min-h-[60px] rounded-2xl p-3 text-left flex items-center justify-between gap-2 transition cursor-pointer border ${
                          isFocused
                            ? 'border-amber-400 bg-amber-500/15 text-white'
                            : 'border-white/10 bg-slate-900/65 text-slate-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white truncate">
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-white/10 shrink-0">
                              T{tierNum}
                            </span>
                            <span className="truncate">{ship.name}</span>
                          </div>
                          <div
                            className="text-[11px] font-medium truncate mt-0.5"
                            style={{ color: ship.accentColor }}
                          >
                            {ship.classLabel} · {ship.baseHull} HP /{' '}
                            {ship.baseShield} SP · {ship.baseTorpedoLocks} Locks
                          </div>
                        </div>
                        <div className="shrink-0 font-mono text-[11px] font-bold tabular-nums">
                          {active ? (
                            <span className="text-emerald-300">ON</span>
                          ) : owned ? (
                            <span className="text-cyan-300">OWNED</span>
                          ) : (
                            <span className="text-amber-300">
                              {ship.costCredits} CR
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {category === 'weapons' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {WEAPON_CATALOG.map((weapon) => {
                  const owned = save.ownedWeapons.includes(weapon.id);
                  const equipped =
                    save.equippedPrimaryWeapon === weapon.id ||
                    save.equippedSecondaryWeapon === weapon.id;
                  const isFocused = focusWeapon.id === weapon.id;

                  return (
                    <button
                      key={weapon.id}
                      onClick={() => setSelectedWeaponId(weapon.id)}
                      className={`min-h-[60px] rounded-2xl p-3 text-left flex items-center justify-between gap-2 transition cursor-pointer border ${
                        isFocused
                          ? 'border-amber-400 bg-amber-500/15 text-white'
                          : 'border-white/10 bg-slate-900/65 text-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-white truncate">
                          {weapon.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {weapon.slot === 'primary' ? 'Primary' : 'Torpedo'} ·{' '}
                          {weapon.statSummary}
                        </div>
                      </div>
                      <div className="shrink-0 font-mono text-[11px] font-bold tabular-nums">
                        {equipped ? (
                          <span className="text-emerald-300">ON</span>
                        ) : owned ? (
                          <span className="text-cyan-300">OWNED</span>
                        ) : (
                          <span className="text-amber-300">
                            {weapon.costCredits} CR
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {category === 'modules' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {UPGRADE_CATALOG.map((upg) => {
                  const owned = save.ownedUpgrades.includes(upg.id);
                  const equipped = save.activeUpgrades.includes(upg.id);
                  const tier = save.upgradeTiers[upg.id] || 1;
                  const isFocused = focusModule.id === upg.id;

                  return (
                    <button
                      key={upg.id}
                      onClick={() => setSelectedModuleId(upg.id)}
                      className={`min-h-[60px] rounded-2xl p-3 text-left flex items-center justify-between gap-2 transition cursor-pointer border ${
                        isFocused
                          ? 'border-amber-400 bg-amber-500/15 text-white'
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
                        {equipped ? (
                          <span className="text-emerald-300">T{tier} ON</span>
                        ) : owned ? (
                          <span className="text-cyan-300">T{tier}</span>
                        ) : (
                          <span className="text-amber-300">{upg.cost} CR</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {category === 'cosmetics' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {COSMETIC_CATALOG.map((cos) => {
                  const owned = save.ownedCosmetics.includes(cos.id);
                  const active = save.equippedCosmetic === cos.id;
                  const isFocused = focusCosmetic.id === cos.id;
                  return (
                    <button
                      key={cos.id}
                      onClick={() => {
                        setSelectedCosmeticId(cos.id);
                        onPreviewShip(save.selectedShip, cos.id);
                      }}
                      className={`min-h-[60px] rounded-2xl p-3 text-left flex items-center justify-between gap-2.5 cursor-pointer transition border ${
                        isFocused
                          ? 'border-amber-400 bg-amber-500/15 text-white'
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
                        {active ? (
                          <span className="text-emerald-300">ON</span>
                        ) : owned ? (
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
            )}

            {category === 'resources' && (
              <div className="grid grid-cols-1 gap-2.5 pb-4">
                <div className="rounded-2xl border border-fuchsia-400/35 bg-slate-900/85 p-3.5 space-y-2.5">
                  <div>
                    <div className="text-[11px] font-medium text-fuchsia-400">
                      Deep-Trench Refinery
                    </div>
                    <h3 className="font-display text-sm font-bold text-white">
                      Abyssal Alloy Synthesis (+1 Alloy)
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-300">
                      Refine 300 Salvage Credits into 1 Abyssal Alloy for Tier II–III tuning and experimental hulls.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onExchangeCreditsForCore();
                      triggerConfirmation(
                        'Synthesized +1 Abyssal Alloy (300 CR).',
                      );
                    }}
                    disabled={save.salvageCredits < 300}
                    className={`min-h-[48px] w-full rounded-2xl px-4 text-xs font-bold transition ${
                      save.salvageCredits >= 300
                        ? 'bg-fuchsia-400 text-slate-950 cursor-pointer'
                        : 'bg-rose-950/35 text-rose-300 border border-rose-500/30 cursor-not-allowed'
                    }`}
                  >
                    {save.salvageCredits >= 300
                      ? 'Synthesize +1 Alloy (300 CR)'
                      : `Need +${300 - save.salvageCredits} CR`}
                  </button>
                </div>

                <div className="rounded-2xl border border-cyan-400/35 bg-slate-900/85 p-3.5 space-y-2.5">
                  <div>
                    <div className="text-[11px] font-medium text-cyan-400">
                      Engineering Reclaim
                    </div>
                    <h3 className="font-display text-sm font-bold text-white">
                      Full Module Respec & Refund
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-300">
                      Strip all purchased modules and recover 100% invested Credits immediately.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onRefundAllUpgrades();
                      triggerConfirmation('Refunded 100% of module credits.');
                    }}
                    disabled={save.ownedUpgrades.length === 0}
                    className={`min-h-[48px] w-full inline-flex items-center justify-center gap-1.5 rounded-2xl px-4 text-xs font-bold transition ${
                      save.ownedUpgrades.length > 0
                        ? 'bg-cyan-400 text-slate-950 cursor-pointer'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Refund Modules</span>
                  </button>
                </div>

                <div className="rounded-2xl border border-amber-400/35 bg-slate-900/85 p-3.5 space-y-2.5">
                  <div>
                    <div className="text-[11px] font-medium text-amber-400">
                      Command Logistics Grant
                    </div>
                    <h3 className="font-display text-sm font-bold text-white">
                      Emergency Supply Stipend
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-300">
                      Claim +250 Salvage Credits & +1 Abyssal Alloy when reserves are below 3,000 CR.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClaimSupplyGrant();
                      triggerConfirmation(
                        'Claimed +250 CR & +1 Alloy command grant!',
                      );
                    }}
                    disabled={save.salvageCredits >= 3000}
                    className={`min-h-[48px] w-full inline-flex items-center justify-center gap-1.5 rounded-2xl px-4 text-xs font-bold transition ${
                      save.salvageCredits < 3000
                        ? 'bg-amber-400 text-slate-950 cursor-pointer'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Claim Stipend</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sticky Bottom Detail & Purchase Bar */}
          {category !== 'resources' && (
            <div className="shrink-0 border-t border-white/10 bg-slate-950/95 px-3 pt-2.5 pb-3 pb-safe space-y-2">
              {category === 'ships' &&
                (() => {
                  const owned = save.ownedShips.includes(focusShip.id);
                  const active = save.selectedShip === focusShip.id;
                  const missingCr = Math.max(
                    0,
                    focusShip.costCredits - save.salvageCredits,
                  );
                  const missingMat = Math.max(
                    0,
                    focusShip.costMaterials - save.abyssalMaterials,
                  );
                  const canAfford = missingCr === 0 && missingMat === 0;

                  return (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-amber-300 truncate">
                            {focusShip.name} · {focusShip.baseHull} HP ·{' '}
                            {focusShip.baseShield} SP ·{' '}
                            {focusShip.baseTorpedoLocks} Locks ·{' '}
                            {focusShip.moduleCapacity} Slots
                          </div>
                          <div className="text-[11px] text-slate-300 truncate">
                            {focusShip.description}
                          </div>
                        </div>
                      </div>
                      {owned ? (
                        <button
                          onClick={() => {
                            onSelectShip(focusShip.id);
                            triggerConfirmation(
                              `${focusShip.name} deployed as active flagship.`,
                            );
                          }}
                          className={`min-h-[48px] w-full rounded-2xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                            active
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                              : 'bg-cyan-400 text-slate-950'
                          }`}
                        >
                          {active
                            ? 'Currently Deployed Flagship'
                            : `Deploy ${focusShip.name}`}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            onUnlockShip(focusShip.id);
                            triggerConfirmation(
                              `Requisitioned ${focusShip.name}!`,
                            );
                          }}
                          disabled={!canAfford}
                          className={`min-h-[48px] w-full rounded-2xl text-xs sm:text-sm font-bold transition ${
                            canAfford
                              ? 'bg-amber-400 text-slate-950 cursor-pointer'
                              : 'bg-rose-950/40 text-rose-300 border border-rose-500/30 cursor-not-allowed'
                          }`}
                        >
                          {canAfford
                            ? `Purchase Hull (${focusShip.costCredits} CR + ${focusShip.costMaterials} Alloy)`
                            : `Need ${missingCr > 0 ? `+${missingCr} CR ` : ''}${
                                missingMat > 0 ? `+${missingMat} Alloy` : ''
                              }`}
                        </button>
                      )}
                    </>
                  );
                })()}

              {category === 'weapons' &&
                (() => {
                  const owned = save.ownedWeapons.includes(focusWeapon.id);
                  const equipped =
                    save.equippedPrimaryWeapon === focusWeapon.id ||
                    save.equippedSecondaryWeapon === focusWeapon.id;
                  const missingCr = Math.max(
                    0,
                    focusWeapon.costCredits - save.salvageCredits,
                  );
                  const missingMat = Math.max(
                    0,
                    focusWeapon.costMaterials - save.abyssalMaterials,
                  );
                  const canAfford = missingCr === 0 && missingMat === 0;

                  return (
                    <>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-cyan-400 truncate">
                          {focusWeapon.name} · {focusWeapon.damage} DMG ·{' '}
                          {focusWeapon.projectileSpeed} m/s
                        </div>
                        <div className="text-[11px] text-slate-300 truncate">
                          {focusWeapon.description}
                        </div>
                      </div>
                      {!owned ? (
                        <button
                          onClick={() => {
                            onBuyWeapon(focusWeapon.id);
                            triggerConfirmation(
                              `Purchased & equipped ${focusWeapon.name}!`,
                            );
                          }}
                          disabled={!canAfford}
                          className={`min-h-[48px] w-full rounded-2xl text-xs sm:text-sm font-bold transition ${
                            canAfford
                              ? 'bg-amber-400 text-slate-950 cursor-pointer'
                              : 'bg-rose-950/40 text-rose-300 border border-rose-500/30 cursor-not-allowed'
                          }`}
                        >
                          {canAfford
                            ? `Purchase (${focusWeapon.costCredits} CR${
                                focusWeapon.costMaterials > 0
                                  ? ` + ${focusWeapon.costMaterials} Alloy`
                                  : ''
                              })`
                            : `Need ${missingCr > 0 ? `+${missingCr} CR ` : ''}${
                                missingMat > 0 ? `+${missingMat} Alloy` : ''
                              }`}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (focusWeapon.slot === 'primary') {
                              onSelectPrimaryWeapon(
                                focusWeapon.id as PrimaryWeaponId,
                              );
                            } else {
                              onSelectSecondaryWeapon(
                                focusWeapon.id as SecondaryWeaponId,
                              );
                            }
                            triggerConfirmation(
                              `Equipped ${focusWeapon.name}.`,
                            );
                          }}
                          className={`min-h-[48px] w-full rounded-2xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                            equipped
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                              : 'bg-cyan-400 text-slate-950'
                          }`}
                        >
                          {equipped
                            ? 'Equipped in Active Bay'
                            : `Equip ${focusWeapon.name}`}
                        </button>
                      )}
                    </>
                  );
                })()}

              {category === 'modules' &&
                (() => {
                  const isOwned = save.ownedUpgrades.includes(focusModule.id);
                  const isEquipped = save.activeUpgrades.includes(
                    focusModule.id,
                  );
                  const tier = save.upgradeTiers[focusModule.id] || 1;
                  const missingBuyCr = Math.max(
                    0,
                    focusModule.cost - save.salvageCredits,
                  );
                  const canAffordBuy = missingBuyCr === 0;

                  const tuneCostCr = Math.round(focusModule.cost * 0.65 * tier);
                  const tuneCostMat = tier;
                  const missingTuneCr = Math.max(
                    0,
                    tuneCostCr - save.salvageCredits,
                  );
                  const missingTuneMat = Math.max(
                    0,
                    tuneCostMat - save.abyssalMaterials,
                  );
                  const canTune =
                    isOwned &&
                    tier < 3 &&
                    missingTuneCr === 0 &&
                    missingTuneMat === 0;

                  return (
                    <>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-cyan-400 truncate">
                          {focusModule.name} · Tier {isOwned ? tier : 1}/3 ·{' '}
                          {focusModule.statSummary}
                        </div>
                        <div className="text-[11px] text-slate-300 truncate">
                          {focusModule.description}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!isOwned ? (
                          <button
                            onClick={() => {
                              onBuyUpgrade(focusModule.id);
                              triggerConfirmation(
                                `Purchased ${focusModule.name} (Tier I)!`,
                              );
                            }}
                            disabled={!canAffordBuy}
                            className={`min-h-[48px] w-full rounded-2xl text-xs sm:text-sm font-bold transition ${
                              canAffordBuy
                                ? 'bg-amber-400 text-slate-950 cursor-pointer'
                                : 'bg-rose-950/40 text-rose-300 border border-rose-500/30 cursor-not-allowed'
                            }`}
                          >
                            {canAffordBuy
                              ? `Purchase Module (${focusModule.cost} CR)`
                              : `Need +${missingBuyCr} CR`}
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                onToggleEquipUpgrade(focusModule.id);
                                triggerConfirmation(
                                  isEquipped
                                    ? `Unequipped ${focusModule.name}.`
                                    : `Equipped ${focusModule.name}.`,
                                );
                              }}
                              className={`min-h-[48px] flex-1 rounded-2xl px-3 text-xs font-bold transition cursor-pointer ${
                                isEquipped
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                                  : save.activeUpgrades.length >= maxModuleSlots
                                    ? 'bg-slate-900 text-slate-500 cursor-not-allowed'
                                    : 'bg-cyan-400 text-slate-950'
                              }`}
                            >
                              {isEquipped
                                ? 'Unequip'
                                : save.activeUpgrades.length >= maxModuleSlots
                                  ? `Full (${maxModuleSlots})`
                                  : 'Equip'}
                            </button>

                            {tier < 3 ? (
                              <button
                                onClick={() => {
                                  onUpgradeTier(focusModule.id);
                                  triggerConfirmation(
                                    `Upgraded ${focusModule.name} to T${
                                      tier + 1
                                    }!`,
                                  );
                                }}
                                disabled={!canTune}
                                className={`min-h-[48px] flex-1 rounded-2xl px-3 text-xs font-bold transition ${
                                  canTune
                                    ? 'bg-fuchsia-400 text-slate-950 cursor-pointer'
                                    : 'bg-rose-950/35 text-rose-300 border border-rose-500/30 cursor-not-allowed'
                                }`}
                              >
                                {canTune
                                  ? `Upgrade T${tier + 1} (${tuneCostCr} CR + ${tuneCostMat}M)`
                                  : `Need ${
                                      missingTuneCr > 0
                                        ? `+${missingTuneCr} CR `
                                        : ''
                                    }${
                                      missingTuneMat > 0
                                        ? `+${missingTuneMat}M`
                                        : ''
                                    }`}
                              </button>
                            ) : (
                              <span className="min-h-[48px] flex items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-400/40 px-4 font-mono text-xs font-bold text-amber-300">
                                Max T3
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  );
                })()}

              {category === 'cosmetics' &&
                (() => {
                  const owned = save.ownedCosmetics.includes(focusCosmetic.id);
                  const active = save.equippedCosmetic === focusCosmetic.id;
                  const missingCr = Math.max(
                    0,
                    focusCosmetic.costCredits - save.salvageCredits,
                  );
                  const canAfford = missingCr === 0;

                  return (
                    <>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-fuchsia-400 truncate">
                          {focusCosmetic.name} · {focusCosmetic.shortTag}
                        </div>
                        <div className="text-[11px] text-slate-300 truncate">
                          {focusCosmetic.description}
                        </div>
                      </div>
                      {owned ? (
                        <button
                          onClick={() => {
                            onSelectCosmetic(focusCosmetic.id);
                            triggerConfirmation(
                              `Applied ${focusCosmetic.name} livery.`,
                            );
                          }}
                          className={`min-h-[48px] w-full rounded-2xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                            active
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                              : 'bg-cyan-400 text-slate-950'
                          }`}
                        >
                          {active
                            ? 'Equipped Livery'
                            : `Apply ${focusCosmetic.name}`}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            onUnlockCosmetic(focusCosmetic.id);
                            triggerConfirmation(
                              `Unlocked ${focusCosmetic.name}!`,
                            );
                          }}
                          disabled={!canAfford}
                          className={`min-h-[48px] w-full rounded-2xl text-xs sm:text-sm font-bold transition ${
                            canAfford
                              ? 'bg-amber-400 text-slate-950 cursor-pointer'
                              : 'bg-rose-950/40 text-rose-300 border border-rose-500/30 cursor-not-allowed'
                          }`}
                        >
                          {canAfford
                            ? `Purchase Livery (${focusCosmetic.costCredits} CR)`
                            : `Need +${missingCr} CR`}
                        </button>
                      )}
                    </>
                  );
                })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
