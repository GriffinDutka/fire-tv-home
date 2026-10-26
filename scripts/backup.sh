#!/usr/bin/env bash
# Snapshot packages + settings so any change can be compared/reverted.
# Output goes to baseline/<timestamp>/ (gitignored — contains device identifiers).
source "$(dirname "$0")/common.sh"
ensure_connected

out="$ROOT/baseline/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$out"

adb_tv shell pm list packages -f   > "$out/packages-all.txt"
adb_tv shell pm list packages -d   > "$out/packages-disabled.txt"
adb_tv shell pm list packages -3   > "$out/packages-thirdparty.txt"
for ns in global secure system; do
  adb_tv shell settings list "$ns" > "$out/settings-$ns.txt"
done
adb_tv shell cmd package resolve-activity --brief \
  -c android.intent.category.HOME -a android.intent.action.MAIN > "$out/home-launcher.txt"

echo "Saved snapshot to $out"
