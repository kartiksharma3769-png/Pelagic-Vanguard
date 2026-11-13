import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Crosshair,
  Database,
  Layers,
  Lock,
  Palette,
  RefreshCw,
  Shield,
  ShoppingBag,
  Sparkles,
  Zap,
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
  const [category, setCategory] = useState<MarketCategory>('weapons');
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

  const triggerConfirmation = (msg: string) => {
    setConfirmationBanner(msg);
    window.setTimeout(() => {
      setConfirmationBanner((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const activeShip =
    SHIP_CATALOG.find((s) => s.id === save.selectedShip) || SHIP_CATALOG[0];
  const maxModuleSlots = activeShip.moduleCapacity;

  const focusShip =
    SHIP_CATALOG.find((s) => s.id === selectedShipId) || SHIP_CATALOG[0];
  const focusWeapon =
    WEAPON_CATALOG.find((w) => w.id === selectedWeaponId) || WEAPON_CATALOG[0];
  const focusModule =
    UPGRADE_CATALOG.find((u) => u.id === selectedModuleId) ||
    UPGRADE_CATALOG[0];
  const focusCosmetic =
    COSMETIC_CATALOG.find((c) => c.id === selectedCosmeticId) ||
    COSMETIC_CATALOG[0];

  return (
    <div className="relative h-full w-full flex flex-col lg:flex-row justify-between overflow-hidden pointer-events-none select-none">
      {/* =====================================================================
          LEFT 52% — LIVE 3D SHOWROOM STAGE & COMPATIBILITY TELEMETRY
         ===================================================================== */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] h-full flex-col justify-between p-8 pointer-events-none">
        <div className="max-w-md bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-transparent pl-4 pr-6 py-4 rounded-r-2xl border-l-4 border-amber-400">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Deep-Trench Military Supply Exchange
          </div>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
            Abyssal Salvage Market
          </h1>
          <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
            Inspect experimental submersible hulls, high-velocity cavitation ordnance, and Tier I–III pressure modules. Selecting any ship or livery updates the live 3D berth immediately.
          </p>
        </div>

        {/* Bottom-left Active Flagship & Compatibility Readout */}
        <div className="max-w-md bg-gradient-to-r from-slate-950/90 via-slate-950/65 to-transparent pl-4 pr-6 py-4 rounded-r-2xl border-l-4 border-cyan-400">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cyan-300">
              Active Flagship Compatibility
            </span>
            <span className="font-mono text-xs font-bold text-emerald-300">
              100% Compatible
            </span>
          </div>
          <div className="mt-1 text-base font-bold text-white">
            {activeShip.name} ({activeShip.classLabel})
          </div>
          <div className="mt-1.5 flex items-center gap-4 font-mono text-xs text-slate-300">
            <span>
              Modules: {save.activeUpgrades.length}/{maxModuleSlots} Slots
            </span>
            <span>·</span>
            <span className="text-amber-300">
              {save.salvageCredits.toLocaleString()} CR
            </span>
            <span>·</span>
            <span className="text-fuchsia-300">
              {save.abyssalMaterials.toLocaleString()} Alloy
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          RIGHT 48% — MILITARY SUPPLY SHOWROOM & MASTER-DETAIL EXCHANGE
         ===================================================================== */}
      <div className="pointer-events-auto w-full lg:w-[48%] xl:w-[45%] h-full bg-gradient-to-l from-slate-950/96 via-slate-950/92 to-slate-950/75 border-l border-white/10 flex flex-col justify-between p-5 sm:p-6 overflow-y-auto">
        <div>
          {/* Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-300">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-amber-400">
                  Quartermaster Showroom
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  Fleet Supply & Tech Exchange
                </h2>
              </div>
            </div>

            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Berth
            </button>
          </div>

          {/* Purchase / Action Confirmation Banner */}
          {confirmationBanner && (
            <div className="mt-3 rounded-xl border border-emerald-400/50 bg-emerald-950/40 px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-emerald-200">
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400" />
                {confirmationBanner}
              </span>
              <span className="font-mono text-[11px] text-emerald-300">
                SAVED
              </span>
            </div>
          )}

          {/* 5 Required Category Tabs: Ships, Weapons, Modules, Cosmetics, Resources */}
          <div className="grid grid-cols-5 gap-1 my-4 rounded-xl bg-slate-900/90 p-1 border border-white/10">
            {(
              [
                { id: 'ships', label: 'Ships', icon: Shield },
                { id: 'weapons', label: 'Weapons', icon: Crosshair },
                { id: 'modules', label: 'Modules', icon: Layers },
                { id: 'cosmetics', label: 'Cosmetics', icon: Palette },
                { id: 'resources', label: 'Resources', icon: Database },
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
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* =================================================================
              CATEGORY 1: SHIPS SHOWROOM
             ================================================================= */}
          {category === 'ships' && (
            <div className="space-y-4">
              {/* Hero Ship Blueprint Showcase */}
              {(() => {
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
                  <div className="rounded-2xl border border-amber-400/35 bg-gradient-to-br from-slate-900/95 via-slate-950 to-slate-950 p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs font-bold uppercase px-2 py-0.5 rounded"
                            style={{
                              color: focusShip.accentColor,
                              backgroundColor: `${focusShip.accentColor}20`,
                            }}
                          >
                            {focusShip.classLabel} Hull
                          </span>
                          <span className="text-xs text-slate-400">
                            {focusShip.subtitle}
                          </span>
                        </div>
                        <h3 className="mt-1 text-2xl font-black text-white">
                          {focusShip.name}
                        </h3>
                        <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                          {focusShip.description}
                        </p>
                      </div>

                      {/* Vector Hull Silhouette Emblem */}
                      <div className="h-24 w-32 shrink-0 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-center p-2">
                        <svg viewBox="0 0 120 80" className="w-full h-full">
                          <circle
                            cx="60"
                            cy="40"
                            r="32"
                            fill="none"
                            stroke={focusShip.accentColor}
                            strokeWidth="1.2"
                            strokeDasharray="4 3"
                            opacity="0.5"
                          />
                          <polygon
                            points="60,10 95,58 72,52 60,68 48,52 25,58"
                            fill={`${focusShip.accentColor}33`}
                            stroke={focusShip.accentColor}
                            strokeWidth="2"
                          />
                          <circle
                            cx="60"
                            cy="38"
                            r="5"
                            fill={focusShip.accentColor}
                          />
                        </svg>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-2 pt-3 border-t border-white/10 font-mono text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400">Hull</div>
                        <div className="text-emerald-300 font-bold">
                          {focusShip.baseHull} HP
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Shield</div>
                        <div className="text-cyan-300 font-bold">
                          {focusShip.baseShield} SP
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Locks</div>
                        <div className="text-amber-300 font-bold">
                          {focusShip.baseTorpedoLocks} Targets
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">
                          Capacity
                        </div>
                        <div className="text-fuchsia-300 font-bold">
                          {focusShip.moduleCapacity} Slots
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      {owned ? (
                        <button
                          onClick={() => {
                            onSelectShip(focusShip.id);
                            triggerConfirmation(
                              `${focusShip.name} deployed as active flagship.`,
                            );
                          }}
                          className={`w-full rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                            active
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                              : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                          }`}
                        >
                          {active
                            ? '✓ CURRENTLY DEPLOYED FLAGSHIP'
                            : `DEPLOY ${focusShip.name.toUpperCase()}`}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            onUnlockShip(focusShip.id);
                            triggerConfirmation(
                              `Requisitioned ${focusShip.name} hull blueprint!`,
                            );
                          }}
                          disabled={!canAfford}
                          className={`w-full rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                            canAfford
                              ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.35)] cursor-pointer'
                              : 'bg-rose-950/40 text-rose-300 border border-rose-500/30 cursor-not-allowed'
                          }`}
                        >
                          {canAfford
                            ? `REQUISITION HULL (${focusShip.costCredits} CR + ${focusShip.costMaterials} ALLOY)`
                            : `INSUFFICIENT FUNDS — NEED ${
                                missingCr > 0 ? `+${missingCr} CR ` : ''
                              }${missingMat > 0 ? `+${missingMat} ALLOY` : ''}`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Ship Selector Strip */}
              <div className="space-y-2">
                {SHIP_CATALOG.map((ship) => {
                  const owned = save.ownedShips.includes(ship.id);
                  const active = save.selectedShip === ship.id;
                  const isFocused = focusShip.id === ship.id;
                  return (
                    <div
                      key={ship.id}
                      onClick={() => {
                        setSelectedShipId(ship.id);
                        onPreviewShip(ship.id, save.equippedCosmetic);
                      }}
                      className={`rounded-xl px-4 py-3 flex items-center justify-between gap-3 cursor-pointer transition border-l-4 ${
                        isFocused
                          ? 'border-l-amber-400 bg-amber-500/15 text-white'
                          : 'border-l-transparent bg-slate-900/50 text-slate-300 hover:bg-slate-900/80'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            {ship.name}
                          </span>
                          <span
                            className="text-[11px] font-semibold"
                            style={{ color: ship.accentColor }}
                          >
                            {ship.classLabel}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          {ship.tradeOffText}
                        </div>
                      </div>
                      <div className="font-mono text-xs font-bold shrink-0">
                        {active ? (
                          <span className="text-emerald-300">EQUIPPED</span>
                        ) : owned ? (
                          <span className="text-cyan-300">OWNED</span>
                        ) : (
                          <span className="text-amber-300">
                            {ship.costCredits} CR + {ship.costMaterials}M
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =================================================================
              CATEGORY 2: WEAPONS SHOWROOM
             ================================================================= */}
          {category === 'weapons' && (
            <div className="space-y-4">
              {(() => {
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
                  <div className="rounded-2xl border border-amber-400/35 bg-gradient-to-br from-slate-900/95 via-slate-950 to-slate-950 p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase text-cyan-400">
                            {focusWeapon.slot === 'primary'
                              ? 'Primary Acoustic Array'
                              : 'Heavy Torpedo Bay'}
                          </span>
                          <span className="text-xs text-slate-400">
                            · Compatible: All 4 Hulls
                          </span>
                        </div>
                        <h3 className="mt-1 text-2xl font-black text-white">
                          {focusWeapon.name}
                        </h3>
                        <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                          {focusWeapon.description}
                        </p>
                      </div>

                      {/* Large Custom Vector Ordnance Schematic */}
                      <div className="h-24 w-32 shrink-0 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-center p-2">
                        <svg viewBox="0 0 140 80" className="w-full h-full">
                          <rect
                            x="14"
                            y="32"
                            width="82"
                            height="16"
                            rx="4"
                            fill={`${focusWeapon.accentColor}28`}
                            stroke={focusWeapon.accentColor}
                            strokeWidth="2"
                          />
                          <polygon
                            points="96,26 128,40 96,54"
                            fill={focusWeapon.accentColor}
                          />
                          <line
                            x1="26"
                            y1="22"
                            x2="84"
                            y2="22"
                            stroke={focusWeapon.accentColor}
                            strokeWidth="1.5"
                            strokeDasharray="6 4"
                          />
                          <line
                            x1="26"
                            y1="58"
                            x2="84"
                            y2="58"
                            stroke={focusWeapon.accentColor}
                            strokeWidth="1.5"
                            strokeDasharray="6 4"
                          />
                        </svg>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 pt-3 border-t border-white/10 font-mono text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400">
                          Output Profile
                        </div>
                        <div className="text-emerald-300 font-bold">
                          {focusWeapon.statSummary}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">
                          Damage / Salvo
                        </div>
                        <div className="text-white font-bold">
                          {focusWeapon.damage} DMG
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">
                          Muzzle Velocity
                        </div>
                        <div className="text-cyan-300 font-bold">
                          {focusWeapon.projectileSpeed} m/s
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      {!owned ? (
                        <button
                          onClick={() => {
                            onBuyWeapon(focusWeapon.id);
                            triggerConfirmation(
                              `Purchased & equipped ${focusWeapon.name}!`,
                            );
                          }}
                          disabled={!canAfford}
                          className={`w-full rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                            canAfford
                              ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.35)] cursor-pointer'
                              : 'bg-rose-950/40 text-rose-300 border border-rose-500/30 cursor-not-allowed'
                          }`}
                        >
                          {canAfford
                            ? `PURCHASE ORDNANCE (${focusWeapon.costCredits} CR${
                                focusWeapon.costMaterials > 0
                                  ? ` + ${focusWeapon.costMaterials} ALLOY`
                                  : ''
                              })`
                            : `INSUFFICIENT FUNDS — NEED ${
                                missingCr > 0 ? `+${missingCr} CR ` : ''
                              }${missingMat > 0 ? `+${missingMat} ALLOY` : ''}`}
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
                              `Equipped ${focusWeapon.name} to active bay.`,
                            );
                          }}
                          className={`w-full rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                            equipped
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                              : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                          }`}
                        >
                          {equipped
                            ? '✓ EQUIPPED IN ACTIVE BAY'
                            : `EQUIP ${focusWeapon.name.toUpperCase()}`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Weapon Rack List */}
              <div className="space-y-2">
                {WEAPON_CATALOG.map((weapon) => {
                  const owned = save.ownedWeapons.includes(weapon.id);
                  const equipped =
                    save.equippedPrimaryWeapon === weapon.id ||
                    save.equippedSecondaryWeapon === weapon.id;
                  const isFocused = focusWeapon.id === weapon.id;

                  return (
                    <div
                      key={weapon.id}
                      onClick={() => setSelectedWeaponId(weapon.id)}
                      className={`rounded-xl px-4 py-3 flex items-center justify-between gap-3 cursor-pointer transition border-l-4 ${
                        isFocused
                          ? 'border-l-amber-400 bg-amber-500/15 text-white'
                          : 'border-l-transparent bg-slate-900/50 text-slate-300 hover:bg-slate-900/80'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            {weapon.name}
                          </span>
                          <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
                            {weapon.slot === 'primary' ? 'Primary' : 'Torpedo'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          {weapon.statSummary}
                        </div>
                      </div>

                      <div className="font-mono text-xs font-bold shrink-0">
                        {equipped ? (
                          <span className="text-emerald-300">EQUIPPED</span>
                        ) : owned ? (
                          <span className="text-cyan-300">OWNED</span>
                        ) : (
                          <span className="text-amber-300">
                            {weapon.costCredits} CR
                            {weapon.costMaterials > 0
                              ? ` + ${weapon.costMaterials}M`
                              : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =================================================================
              CATEGORY 3: MODULES SHOWROOM (WITH TIER I-III PROGRESSION)
             ================================================================= */}
          {category === 'modules' && (
            <div className="space-y-4">
              {(() => {
                const isOwned = save.ownedUpgrades.includes(focusModule.id);
                const isEquipped = save.activeUpgrades.includes(focusModule.id);
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
                  <div className="rounded-2xl border border-amber-400/35 bg-gradient-to-br from-slate-900/95 via-slate-950 to-slate-950 p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs font-bold uppercase"
                            style={{ color: focusModule.accentColor }}
                          >
                            {focusModule.category} System
                          </span>
                          <span className="text-xs text-slate-400">
                            · Uses 1 Module Slot ({save.activeUpgrades.length}/
                            {maxModuleSlots} Active)
                          </span>
                        </div>
                        <h3 className="mt-1 text-2xl font-black text-white">
                          {focusModule.name}
                        </h3>
                        <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                          {focusModule.description}
                        </p>
                      </div>

                      {/* Vector Module Core Artwork */}
                      <div className="h-24 w-28 shrink-0 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-center p-2">
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                          <polygon
                            points="50,8 90,30 90,70 50,92 10,70 10,30"
                            fill={`${focusModule.accentColor}25`}
                            stroke={focusModule.accentColor}
                            strokeWidth="2.2"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="18"
                            fill="none"
                            stroke={focusModule.accentColor}
                            strokeWidth="1.8"
                            strokeDasharray="5 3"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="7"
                            fill={focusModule.accentColor}
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Tier I -> II -> III Progression Visualization */}
                    <div className="mt-4 pt-3 border-t border-white/10">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-semibold text-slate-300">
                          Tier Progression Matrix
                        </span>
                        <span className="font-mono text-cyan-300 font-bold">
                          {focusModule.statSummary}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { t: 1, title: 'Tier I Standard', bonus: '100% Output' },
                          { t: 2, title: 'Tier II Overclock', bonus: '125% Output' },
                          { t: 3, title: 'Tier III Abyssal', bonus: '150% Output' },
                        ].map((step) => {
                          const unlockedTier = isOwned && tier >= step.t;
                          return (
                            <div
                              key={step.t}
                              className={`rounded-xl p-2.5 border text-left ${
                                unlockedTier
                                  ? 'border-cyan-400/60 bg-cyan-500/15 text-white'
                                  : 'border-white/5 bg-slate-900/60 text-slate-500'
                              }`}
                            >
                              <div className="font-mono text-[10px] uppercase font-bold text-cyan-300">
                                {step.title}
                              </div>
                              <div className="mt-0.5 text-xs font-bold">
                                {step.bonus}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Purchase / Equip / Upgrade Actions */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {!isOwned ? (
                        <button
                          onClick={() => {
                            onBuyUpgrade(focusModule.id);
                            triggerConfirmation(
                              `Purchased ${focusModule.name} (Tier I)!`,
                            );
                          }}
                          disabled={!canAffordBuy}
                          className={`w-full rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                            canAffordBuy
                              ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.35)] cursor-pointer'
                              : 'bg-rose-950/40 text-rose-300 border border-rose-500/30 cursor-not-allowed'
                          }`}
                        >
                          {canAffordBuy
                            ? `PURCHASE MODULE (${focusModule.cost} CR)`
                            : `INSUFFICIENT CREDITS — NEED +${missingBuyCr} CR`}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              onToggleEquipUpgrade(focusModule.id);
                              triggerConfirmation(
                                isEquipped
                                  ? `Unequipped ${focusModule.name}.`
                                  : `Equipped ${focusModule.name} to active hull.`,
                              );
                            }}
                            className={`flex-1 rounded-xl py-2.5 px-3 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                              isEquipped
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                                : save.activeUpgrades.length >= maxModuleSlots
                                ? 'bg-slate-900 text-slate-500 cursor-not-allowed'
                                : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                            }`}
                          >
                            {isEquipped
                              ? 'UNEQUIP MODULE'
                              : save.activeUpgrades.length >= maxModuleSlots
                              ? `SLOTS FULL (${maxModuleSlots}/${maxModuleSlots})`
                              : 'EQUIP MODULE'}
                          </button>

                          {tier < 3 ? (
                            <button
                              onClick={() => {
                                onUpgradeTier(focusModule.id);
                                triggerConfirmation(
                                  `Upgraded ${focusModule.name} to Tier ${
                                    tier + 1
                                  }!`,
                                );
                              }}
                              disabled={!canTune}
                              className={`flex-1 rounded-xl py-2.5 px-3 text-xs font-bold uppercase tracking-wider transition ${
                                canTune
                                  ? 'bg-fuchsia-400 text-slate-950 hover:bg-fuchsia-300 cursor-pointer'
                                  : 'bg-rose-950/35 text-rose-300 border border-rose-500/30 cursor-not-allowed'
                              }`}
                            >
                              {canTune
                                ? `UPGRADE TIER ${tier + 1} (${tuneCostCr} CR + ${tuneCostMat}M)`
                                : `NEED ${
                                    missingTuneCr > 0
                                      ? `+${missingTuneCr} CR `
                                      : ''
                                  }${
                                    missingTuneMat > 0
                                      ? `+${missingTuneMat} ALLOY`
                                      : ''
                                  }`}
                            </button>
                          ) : (
                            <span className="rounded-xl bg-amber-500/15 border border-amber-400/40 px-4 py-2.5 font-mono text-xs font-bold text-amber-300">
                              MAX TIER III
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Module List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {UPGRADE_CATALOG.map((upg) => {
                  const owned = save.ownedUpgrades.includes(upg.id);
                  const equipped = save.activeUpgrades.includes(upg.id);
                  const tier = save.upgradeTiers[upg.id] || 1;
                  const isFocused = focusModule.id === upg.id;

                  return (
                    <div
                      key={upg.id}
                      onClick={() => setSelectedModuleId(upg.id)}
                      className={`rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 cursor-pointer transition border-l-4 ${
                        isFocused
                          ? 'border-l-amber-400 bg-amber-500/15 text-white'
                          : 'border-l-transparent bg-slate-900/50 text-slate-300 hover:bg-slate-900/80'
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
                      <div className="shrink-0 font-mono text-[11px] font-bold">
                        {equipped ? (
                          <span className="text-emerald-300">T{tier} · ON</span>
                        ) : owned ? (
                          <span className="text-cyan-300">T{tier}</span>
                        ) : (
                          <span className="text-amber-300">{upg.cost} CR</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =================================================================
              CATEGORY 4: COSMETICS SHOWROOM
             ================================================================= */}
          {category === 'cosmetics' && (
            <div className="space-y-4">
              {(() => {
                const owned = save.ownedCosmetics.includes(focusCosmetic.id);
                const active = save.equippedCosmetic === focusCosmetic.id;
                const missingCr = Math.max(
                  0,
                  focusCosmetic.costCredits - save.salvageCredits,
                );
                const canAfford = missingCr === 0;

                return (
                  <div className="rounded-2xl border border-amber-400/35 bg-gradient-to-br from-slate-900/95 via-slate-950 to-slate-950 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold uppercase text-fuchsia-400">
                          Bioluminescent Livery · Compatible: All 4 Hulls
                        </span>
                        <h3 className="mt-1 text-2xl font-black text-white">
                          {focusCosmetic.name}
                        </h3>
                        <p className="mt-1 text-xs text-slate-300">
                          {focusCosmetic.description}
                        </p>
                      </div>
                      <div
                        className="h-16 w-16 rounded-2xl border-2 border-white/30 shrink-0 shadow-lg"
                        style={{ backgroundColor: focusCosmetic.accentHex }}
                      />
                    </div>

                    <div className="mt-4">
                      {owned ? (
                        <button
                          onClick={() => {
                            onSelectCosmetic(focusCosmetic.id);
                            triggerConfirmation(
                              `Applied ${focusCosmetic.name} livery to active hull.`,
                            );
                          }}
                          className={`w-full rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                            active
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                              : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                          }`}
                        >
                          {active
                            ? '✓ EQUIPPED LIVERY'
                            : `APPLY ${focusCosmetic.name.toUpperCase()}`}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            onUnlockCosmetic(focusCosmetic.id);
                            triggerConfirmation(
                              `Unlocked & applied ${focusCosmetic.name}!`,
                            );
                          }}
                          disabled={!canAfford}
                          className={`w-full rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                            canAfford
                              ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer'
                              : 'bg-rose-950/40 text-rose-300 border border-rose-500/30 cursor-not-allowed'
                          }`}
                        >
                          {canAfford
                            ? `PURCHASE LIVERY (${focusCosmetic.costCredits} CR)`
                            : `INSUFFICIENT CREDITS — NEED +${missingCr} CR`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {COSMETIC_CATALOG.map((cos) => {
                  const owned = save.ownedCosmetics.includes(cos.id);
                  const active = save.equippedCosmetic === cos.id;
                  const isFocused = focusCosmetic.id === cos.id;
                  return (
                    <div
                      key={cos.id}
                      onClick={() => {
                        setSelectedCosmeticId(cos.id);
                        onPreviewShip(save.selectedShip, cos.id);
                      }}
                      className={`rounded-xl p-3.5 flex items-center justify-between gap-3 cursor-pointer transition border-l-4 ${
                        isFocused
                          ? 'border-l-amber-400 bg-amber-500/15 text-white'
                          : 'border-l-transparent bg-slate-900/50 text-slate-300 hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-5 w-5 rounded-full border border-white/30 shrink-0"
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
                      <div className="font-mono text-xs font-bold">
                        {active ? (
                          <span className="text-emerald-300">EQUIPPED</span>
                        ) : owned ? (
                          <span className="text-cyan-300">OWNED</span>
                        ) : (
                          <span className="text-amber-300">
                            {cos.costCredits} CR
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =================================================================
              CATEGORY 5: RESOURCES & REQUISITION SYNTHESIS
             ================================================================= */}
          {category === 'resources' && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-fuchsia-400/35 bg-gradient-to-br from-slate-900/95 via-slate-950 to-slate-950 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase text-fuchsia-400">
                    Deep-Trench Refinery
                  </span>
                  <h3 className="mt-0.5 text-lg font-bold text-white">
                    Abyssal Alloy Synthesis (+1 Alloy)
                  </h3>
                  <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                    Refine 300 Salvage Credits into 1 high-density Abyssal Alloy ingot for Tier II–III module tuning and experimental ship hulls.
                  </p>
                </div>
                <button
                  onClick={() => {
                    onExchangeCreditsForCore();
                    triggerConfirmation(
                      'Synthesized +1 Abyssal Alloy from 300 Salvage Credits.',
                    );
                  }}
                  disabled={save.salvageCredits < 300}
                  className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                    save.salvageCredits >= 300
                      ? 'bg-fuchsia-400 text-slate-950 hover:bg-fuchsia-300 cursor-pointer'
                      : 'bg-rose-950/35 text-rose-300 border border-rose-500/30 cursor-not-allowed'
                  }`}
                >
                  {save.salvageCredits >= 300
                    ? 'SYNTHESIZE (300 CR)'
                    : `NEED +${300 - save.salvageCredits} CR`}
                </button>
              </div>

              <div className="rounded-2xl border border-cyan-400/35 bg-slate-900/75 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase text-cyan-400">
                    Engineering Reclaim
                  </span>
                  <h3 className="mt-0.5 text-lg font-bold text-white">
                    Full Module Respec & Salvage Refund
                  </h3>
                  <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                    Strip all purchased submersible modules and recover 100% of invested Salvage Credits immediately.
                  </p>
                </div>
                <button
                  onClick={() => {
                    onRefundAllUpgrades();
                    triggerConfirmation(
                      'All modules stripped and 100% Salvage Credits refunded.',
                    );
                  }}
                  disabled={save.ownedUpgrades.length === 0}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                    save.ownedUpgrades.length > 0
                      ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  REFUND MODULES
                </button>
              </div>

              <div className="rounded-2xl border border-amber-400/35 bg-slate-900/75 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase text-amber-400">
                    Command Logistics Grant
                  </span>
                  <h3 className="mt-0.5 text-lg font-bold text-white">
                    Emergency Vanguard Supply Stipend
                  </h3>
                  <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                    Receive an immediate fleet command grant (+250 Salvage Credits & +1 Abyssal Alloy) when reserves are below 3,000 CR.
                  </p>
                </div>
                <button
                  onClick={() => {
                    onClaimSupplyGrant();
                    triggerConfirmation(
                      'Received +250 Salvage Credits & +1 Abyssal Alloy command stipend!',
                    );
                  }}
                  disabled={save.salvageCredits >= 3000}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                    save.salvageCredits < 3000
                      ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  CLAIM STIPEND
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3.5 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <span>All transactions persist immediately to fleet save</span>
          <button
            onClick={onClose}
            className="rounded-xl bg-white/10 px-5 py-2 text-xs font-semibold text-white hover:bg-white/15 transition cursor-pointer"
          >
            Return to Berth
          </button>
        </div>
      </div>
    </div>
  );
};
