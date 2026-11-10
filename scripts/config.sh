# shellcheck shell=bash
# Owner settings from config/home.env (written by scripts/setup.sh; see config/home.example.env).
# Sourced, not run. TV=... on the command line wins over the file.

CONFIG_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$CONFIG_ROOT/config/home.env"

_tv_override="${TV:-}"
# shellcheck source=/dev/null
[[ -f "$CONFIG_FILE" ]] && source "$CONFIG_FILE"
[[ -n "$_tv_override" ]] && TV="$_tv_override"
unset _tv_override

TV="${TV:-}"
TV_MODEL="${TV_MODEL:-}"
FIRE_OS="${FIRE_OS:-}"
NAME="${NAME:-}"                       # blank = greetings without a name
APP_NAME="${APP_NAME:-Home}"
WEATHER_CITY="${WEATHER_CITY:-}"
WEATHER_PLACE="${WEATHER_PLACE:-$WEATHER_CITY}"
WEATHER_LAT="${WEATHER_LAT:-}"
WEATHER_LON="${WEATHER_LON:-}"
WEATHER_TZ="${WEATHER_TZ:-UTC}"
UNITS="${UNITS:-imperial}"             # imperial: °F, mph · metric: °C, km/h (Settings can switch)
LOCAL_NEWS_NAME="${LOCAL_NEWS_NAME:-$WEATHER_CITY}"
LOCAL_NEWS_SUB="${LOCAL_NEWS_SUB:-}"
LOCAL_NEWS_FEEDS="${LOCAL_NEWS_FEEDS:-}"   # space-separated RSS/Atom links; blank = no local topic

# Stops a script that needs a setting it doesn't have, pointing at setup.sh.
need_config() {
  local v missing=()
  for v in "$@"; do [[ -n "${!v}" ]] || missing+=("$v"); done
  (( ${#missing[@]} == 0 )) && return 0
  echo "Missing ${missing[*]} in config/home.env. Run ./scripts/setup.sh first" >&2
  echo "(or copy config/home.example.env to config/home.env and fill it in)." >&2
  exit 1
}
