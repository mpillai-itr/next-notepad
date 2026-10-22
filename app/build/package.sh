#!/bin/bash
# Assembles NextGenNote.app from the local Electron runtime + the bundled app sources.
set -euo pipefail
cd "$(dirname "$0")/.."
node build.mjs
OUT="${1:-$PWD/../dist-app}"; APP="$OUT/NextGenNote.app"
rm -rf "$APP"; mkdir -p "$OUT"
cp -R node_modules/electron/dist/Electron.app "$APP"
RES="$APP/Contents/Resources"; rm -f "$RES/default_app.asar"
mkdir -p "$RES/app/node_modules"
cp main.js preload.js index.html style.css menu.json plugins.json package.json "$RES/app/"
cp -R data dist "$RES/app/"
rm -f "$RES/app/dist/"*.map
# runtime dependencies only (Monaco/esbuild are already bundled into dist/)
for m in iconv-lite safer-buffer jschardet; do cp -R "node_modules/$m" "$RES/app/node_modules/$m"; done
cp build/icon.icns "$RES/NextGenNote.icns"
PL="$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleName NextGenNote" "$PL"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName NextGenNote" "$PL" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string NextGenNote" "$PL"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.personal.nextgennote" "$PL"
/usr/libexec/PlistBuddy -c "Set :CFBundleIconFile NextGenNote.icns" "$PL"
/usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes array" "$PL" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes:0 dict" "$PL" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes:0:CFBundleTypeName string Text" "$PL" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes:0:CFBundleTypeRole string Editor" "$PL" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes:0:LSItemContentTypes array" "$PL" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes:0:LSItemContentTypes:0 string public.text" "$PL" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes:0:LSItemContentTypes:1 string public.data" "$PL" 2>/dev/null || true
mv "$APP/Contents/MacOS/Electron" "$APP/Contents/MacOS/NextGenNote"
/usr/libexec/PlistBuddy -c "Set :CFBundleExecutable NextGenNote" "$PL"
codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || true
echo "Built $APP"
