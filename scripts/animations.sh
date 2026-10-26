#!/usr/bin/env bash
# Set UI animation speed. Usage: ./scripts/animations.sh [scale]
#   0.5 = snappier (default), 1.0 = stock, 0 = off
source "$(dirname "$0")/common.sh"
ensure_connected

scale="${1:-0.5}"
for key in window_animation_scale transition_animation_scale animator_duration_scale; do
  adb_tv shell settings put global "$key" "$scale"
  echo "$key = $(adb_tv shell settings get global "$key")"
done
