# Pelagic Vanguard — 3D Abyssal Hydro-Fighter Combat Game

**Pelagic Vanguard** is a 60fps 3D deep-ocean hydro-fighter dogfighting and boss-dismantling action game built with **React 19**, **Three.js (WebGL2)**, **TypeScript**, and **Tailwind CSS v4**.

---

## Core Architecture & Features Implemented (PRD v1.0)

1. **Home Hub Command Deck (`mode === 'title'`)**:
   - Displays Pilot Callsign, Rank Level & XP, Fleet Power, Biolume Salvage Credits (`CR`), and Abyssal Core Materials (`CORE`).
   - Direct navigation to **Launch Sortie**, **Campaign Map (13 Sorties)**, **Hangar & Ships**, **MARKET (Standalone 5-Tab Exchange)**, **Rewards & Daily Objectives**, **Pilot Profile**, and **Settings**.
2. **Hangar & Loadout Customization (`src/components/HangarView.tsx`)**:
   - **4 Playable Fighter Craft Classes** with bespoke 3D sub-assemblies rendered in the live Three.js drydock bay:
     1. *Vanguard-IX* (Balanced Deep-Trench Interceptor)
     2. *Maelstrom-XII* (Heavy Torpedo Siege Gunship)
     3. *Bathys-Bastion IV* (Hadal-Armored Bulwark Tank)
     4. *Nautilus-Spectre VII* (Acoustic Recon & Crit Specialist)
   - **5 Loadout Slots**: Ship Class, Primary Weapon (3 armaments), Secondary Heavy Ordnance (3 torpedo systems), Subsystem Modules (enforcing per-ship slot capacity and Tier 1–3 upgrades), and Bioluminescent Hull Livery (4 trims).
3. **Separate 5-Tab Abyssal Market (`src/components/AbyssalMarket.tsx`)**:
   - Accessible from the prominent **MARKET (M)** button on the Home Hub.
   - Tabs: **1. Fighter Craft (4)**, **2. Primary & Secondary Weapons (6)**, **3. Subsystem Modules (8 • Tier 1–3)**, **4. Hull Liveries (4)**, and **5. Abyssal Resource Exchange** (300 CR → +1 Abyssal Core synthesis & +600 CR R&D Stipend).
4. **Campaign Operations, Flight School & Leviathan Boss Rematches (`src/components/HubModals.tsx`)**:
   - **Flight School (`flight_school_01`)**: Interactive 4-step training sortie teaching primary cannon fire, Tactical Sonar pulses, Hydro-Barrel Roll evasion, and multi-lock torpedo salvos.
   - **9 Campaign Sorties (`s1_m1`..`s3_m3`)** across Stage 1 (*Twilight Cnidarian Reef*), Stage 2 (*Obsidian Hydrothermal Trench*), and Stage 3 (*The Hadal Biolume Sanctum*).
   - **3 Boss Rematch Sorties (`rematch_boss_1`..`rematch_boss_3`)**: Direct boss encounters against *Aurelia Prime*, *Pyroclast Kraken*, and *Cetus-Omega*.
   - **3 Difficulty Modes**: *Story Recon (0.85×)*, *Vanguard Standard (1.0×)*, and *Hadal Elite (1.35×)*.
5. **Unobstructed Combat HUD & Boss Appendage Dismantling**:
   - Center viewport remains 100% clear during Leviathan boss fights; boss health and 4 clickable appendage status buttons (`DORSAL`, `PORT`, `STARBOARD`, `VENTRAL`) are tucked into the top-right telemetry card.
   - Custom GLSL procedural bioluminescent fluid-leak shaders pulse brighter as appendages take localized damage.
   - **Hull Stress Gauge** & perimeter overpressure warnings activate in deep-pressure danger zones.
6. **Mobile Virtual Flight Stick & Touch Action Cluster (`src/components/TouchControlsOverlay.tsx`)**:
   - Toggleable via **Settings → Enable On-Screen Touch Controls** with *Standard*, *Left-Handed*, and *Minimal* layout presets plus sensitivity Slider.

---

## Development & Production Build

```bash
# Install dependencies
npm install

# Run local development server (port 3000)
npm run dev

# Typecheck / lint codebase
npm run lint

# Build production bundle into /dist
npm run build
```

---

## Android Packaging & Google Play Release Guide (Capacitor)

The repository includes `/capacitor.config.json` configured for landscape Android deployment (`com.pelagicvanguard.game`).

```bash
# 1. Build web assets
npm run build

# 2. Add & sync Capacitor Android platform (when packaging locally)
npx cap add android
npx cap sync android

# 3. Open in Android Studio to sign and generate release AAB
npx cap open android
```

### Android Release Configuration Checklist
- **Orientation**: Lock `android:screenOrientation="sensorLandscape"` in `android/app/src/main/AndroidManifest.xml`.
- **Target SDK**: Ensure `compileSdkVersion = 35` and `targetSdkVersion = 35` in `variables.gradle`.
- **Signing**: Configure Play App Signing upload key and build via `./gradlew bundleRelease`.
