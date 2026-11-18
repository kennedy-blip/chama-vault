# ChamaVault — Group Savings & Contribution Ledger OS

Offline-first collaborative group savings ledger, merry-go-round (ROSCA) rotation manager, and project fundraiser tracker built with **React + Vite + Tailwind CSS + Framer Motion + Dexie.js (IndexedDB)** and dual-packaged for **Vercel Web** + **Capacitor Android APK** (`@capacitor/android`).

## Core Modules

1. **Vault Overview (`src/components/VaultOverview.tsx`)** — Live group capital summary, active cycle collection progress, 6-month inflow velocity chart, deposit channel split, and immutable-style audit log.
2. **Contribution & Ledger Tracker (`src/components/ContributionLedger.tsx`)** — Member registration & profile editor, periodic deposit logger (Mobile Transfer / M-Pesa, Cash, Bank EFT, Standing Order), automated savings & pending balance calculations, spring-physics expanding accordions, receipt history, and CSV statement exports.
3. **Merry-Go-Round & Payout Queue (`src/components/MerryGoRound.tsx`)** — Turn-based rotation queue, previous beneficiary spotlight, upcoming beneficiary queue with automated countdown badges, queue reordering, deferral controls, and one-tap payout disbursement.
4. **Project & Event Fundraisers (`src/components/ProjectMilestones.tsx`)** — Collective goal tracker with automated milestone unlocks, visual progress bars, contributor share leaderboards, and individual contribution receipts.
5. **Settings & APK Center (`src/components/SettingsCenter.tsx`, `src/components/DownloadAPKModal.tsx`, `src/components/RoleSwitcher.tsx`, `src/components/ThemeToggle.tsx`)** — One-tap Android APK download modal, native mobile APK frame preview, Treasurer vs. Member privilege switcher, 3-mode glassmorphic theme engine (*Golden Vault*, *Emerald Trust*, *Midnight Royal*), group currency/cycle rules, and local Dexie IndexedDB storage & backup controls.

## Local Development

```bash
npm install
npm run dev
```

## Production Web Build (Vercel)

```bash
npm run build
npm run preview
```

`vercel.json` is pre-configured for SPA routing, immutable asset caching, Service Worker updates, and APK binary download headers (`/downloads/chama-vault.apk`).

## Android APK Packaging (Capacitor)

`capacitor.config.json` and the native `/android` project are pre-configured (`com.chamavault.ledger`, Min SDK 22, Target SDK 34):

```bash
# Sync latest production build into /android
npm run cap:sync

# Compile Android APK & write public/downloads/chama-vault.apk + SHA-256 manifest
# (Requires JDK 21 + Android SDK, or run automatically via .github/workflows/build-apk.yml)
npm run apk:build
```
