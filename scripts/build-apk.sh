#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> [1/4] Building ChamaVault production web bundle..."
npm run build

echo "==> [2/4] Syncing web assets into Capacitor Android project..."
if [ ! -d "android" ]; then
  npx cap add android
fi
npx cap sync android

echo "==> [3/4] Compiling Android APK via Gradle..."
cd android
chmod +x ./gradlew
./gradlew assembleDebug --no-daemon
cd "$ROOT_DIR"

APK_SOURCE="android/app/build/outputs/apk/debug/app-debug.apk"
APK_DEST="public/downloads/chama-vault.apk"
mkdir -p public/downloads
cp "$APK_SOURCE" "$APK_DEST"

if command -v sha256sum >/dev/null 2>&1; then
  SHA256="$(sha256sum "$APK_DEST" | awk '{print $1}')"
else
  SHA256="$(shasum -a 256 "$APK_DEST" | awk '{print $1}')"
fi

SIZE_BYTES="$(wc -c < "$APK_DEST" | tr -d ' ')"
SIZE_MB="$(awk "BEGIN {printf \"%.2f MB\", ${SIZE_BYTES}/1048576}")"
BUILT_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

echo "==> [4/4] Updating public/downloads/apk-manifest.json..."
cat > public/downloads/apk-manifest.json <<EOF
{
  "appName": "ChamaVault",
  "appId": "com.chamavault.ledger",
  "version": "1.0.0",
  "versionCode": 1,
  "minSdkVersion": 22,
  "targetSdkVersion": 34,
  "androidLabel": "Android 5.1+ (Lollipop — Android 15)",
  "capacitorVersion": "6.2.0",
  "downloadPath": "/downloads/chama-vault.apk",
  "fileName": "ChamaVault-v1.0.0.apk",
  "githubReleaseUrl": "https://github.com/kennedy-blip/chama-vault/releases/latest/download/chama-vault.apk",
  "githubActionsUrl": "https://github.com/kennedy-blip/chama-vault/actions/workflows/build-apk.yml",
  "estimatedSize": "${SIZE_MB}",
  "binaryBundled": true,
  "sha256": "${SHA256}",
  "builtAt": "${BUILT_AT}",
  "offlineEngine": "Dexie.js v4 (IndexedDB) + Capacitor WebView + Service Worker",
  "permissions": [
    "Offline IndexedDB Vault Storage (Zero cloud lock-in)",
    "File Export & Share (CSV & JSON backup reports)"
  ]
}
EOF

if [ -d "dist" ]; then
  mkdir -p dist/downloads
  cp "$APK_DEST" dist/downloads/chama-vault.apk
  cp public/downloads/apk-manifest.json dist/downloads/apk-manifest.json
fi

echo "Done! Compiled APK written to ${APK_DEST} (${SIZE_MB})"
echo "SHA-256: ${SHA256}"
