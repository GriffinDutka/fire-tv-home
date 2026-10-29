#!/usr/bin/env bash
# Build + install Griffin Home, grant it settings access, and turn on the home guard.
# Undo: ./scripts/restore.sh (turns the guard off, uninstalls the app).
source "$(dirname "$0")/common.sh"
ensure_connected

PKG=com.griffin.home
GUARD="$PKG/$PKG.HomeGuard"

"$ROOT/launcher/build.sh"
adb_tv install -r "$ROOT/launcher/build/griffin-home.apk"

# Lets the in-app Settings screen change animation speed and toggle the guard.
adb_tv shell pm grant "$PKG" android.permission.WRITE_SECURE_SETTINGS
# Lets Settings → Screensaver → Start after change the screen timeout.
adb_tv shell appops set "$PKG" WRITE_SETTINGS allow
# Lets the home guard see the Home button in the system log before Amazon's home draws.
adb_tv shell pm grant "$PKG" android.permission.READ_LOGS

current="$(adb_tv shell settings get secure enabled_accessibility_services | tr -d '\r')"
if [[ "$current" == "null" || -z "$current" ]]; then
  services="$GUARD"
elif [[ ":$current:" == *":$GUARD:"* ]]; then
  services="$current"
else
  services="$current:$GUARD"
fi
adb_tv shell settings put secure enabled_accessibility_services "$services"
adb_tv shell settings put secure accessibility_enabled 1

# Gargantua screensaver in place of Amazon's.
adb_tv shell settings put secure screensaver_components "$PKG/.Gargantua"
adb_tv shell settings put secure screensaver_enabled 1

adb_tv shell am start -n "$PKG/.MainActivity" >/dev/null
echo "Griffin Home installed. Guard: $(adb_tv shell settings get secure enabled_accessibility_services)"
