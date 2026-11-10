#!/usr/bin/env bash
# First-time setup for a new TV or a new owner. Asks for the TV, your name, where to get weather
# for, local news and calendars; saves the answers to config/home.env (and calendar links to
# config/calendars.txt), then offers each install step. Safe to re-run: your current answers
# are the defaults, so pressing Enter keeps them.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HAD_CONFIG=0
[[ -f "$ROOT/config/home.env" ]] && HAD_CONFIG=1
TV_DEFAULT="${TV:-}"
source "$ROOT/scripts/config.sh"
CAL_FILE="$ROOT/config/calendars.txt"

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
note() { printf '  %s\n' "$*"; }
# ask "Question" default → $REPLY (the default when Enter is pressed)
ask() {
  local q="$1" def="${2:-}"
  if [[ -n "$def" ]]; then read -r -p "  $q [$def]: " REPLY; else read -r -p "  $q: " REPLY; fi
  REPLY="${REPLY:-$def}"
}
# confirm "Question" y|n → exit status
confirm() {
  local def="$2" hint="y/N"
  [[ "$def" == y ]] && hint="Y/n"
  read -r -p "  $1 [$hint]: " REPLY
  REPLY="$(printf '%s' "${REPLY:-$def}" | tr '[:upper:]' '[:lower:]')"
  [[ "$REPLY" == y* ]]
}

bold "Home screen setup"
note "Press Enter to keep the value in [brackets]."
if ! command -v adb >/dev/null; then
  note "adb isn't installed. On a Mac: brew install --cask android-platform-tools"
  exit 1
fi

# --- 1. The TV -----------------------------------------------------------------------------
bold "1. Your TV"
note "On the TV: Settings → My Fire TV → Developer Options → ADB Debugging: ON. No Developer"
note "Options? Settings → My Fire TV → About → press OK on the TV's name 7 times, then look again."
note "Find its IP address under Settings → My Fire TV → About → Network."
[[ $HAD_CONFIG == 1 ]] && TV_DEFAULT="$TV"
CONNECTED=0
DETECTED=""
IS_FIRE=1
while :; do
  ask "TV IP address" "$TV_DEFAULT"
  TV="$REPLY"
  [[ -z "$TV" ]] && continue
  [[ "$TV" == *:* ]] || TV="$TV:5555"
  note "Connecting to $TV… (accept the 'Allow USB debugging?' prompt on the TV, tick Always allow)"
  adb connect "$TV" >/dev/null 2>&1 || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    [[ "$(adb -s "$TV" get-state 2>/dev/null || true)" == device ]] && { CONNECTED=1; break; }
    sleep 2
  done
  [[ $CONNECTED == 1 ]] && break
  note "Couldn't connect to $TV."
  confirm "Try again?" y || break
done

if [[ $CONNECTED == 1 ]]; then
  prop() { adb -s "$TV" shell getprop "$1" </dev/null 2>/dev/null | tr -d '\r'; }
  DETECTED="$(prop ro.product.manufacturer) $(prop ro.product.model)"
  os="$(prop ro.build.version.name)"
  [[ -z "$os" ]] && os="Android $(prop ro.build.version.release)"
  note "Found: $DETECTED · $os"
  # "Fire OS 7.7.1.7 (PS7717/…)" → "7.7.1.7"
  FIRE_OS=""
  if [[ "$os" == "Fire OS "* ]]; then FIRE_OS="${os#Fire OS }"; FIRE_OS="${FIRE_OS%% (*}"; fi
  if [[ -z "$(adb -s "$TV" shell pm path com.amazon.tv.launcher </dev/null 2>/dev/null | tr -d '\r')" ]]; then
    IS_FIRE=0
    note "This doesn't look like a Fire TV. The home guard and debloat list are built for Fire OS,"
    note "so those steps will be skipped. The launcher and screensaver still install."
  fi
fi
ask "TV model (just a label)" "${TV_MODEL:-$DETECTED}"
TV_MODEL="$REPLY"

# --- 2. Name ------------------------------------------------------------------------------
bold "2. Your name"
note "Used in the greetings (\"Good evening, Sam\"). Type - for no name."
ask "First name" "$NAME"
NAME="$REPLY"
[[ "$NAME" == "-" ]] && NAME=""
def_app="$APP_NAME"
if [[ $HAD_CONFIG == 0 ]]; then
  def_app="Home"
  [[ -n "$NAME" ]] && def_app="$NAME Home"
fi
ask "App name (shown in the TV's app list)" "$def_app"
APP_NAME="$REPLY"

# --- 3. Weather ---------------------------------------------------------------------------
bold "3. Weather"
note "Currently: ${WEATHER_PLACE:-not set}"
command -v python3 >/dev/null || { note "python3 is needed for the city search (it comes with macOS's developer tools)."; exit 1; }
while :; do
  if [[ -n "$WEATHER_LAT" ]]; then ask "City or town for weather (Enter to keep)" ""; [[ -z "$REPLY" ]] && break
  else ask "City or town for weather" ""; [[ -z "$REPLY" ]] && continue; fi
  query="$REPLY"
  # Open-Meteo's free geocoder: name → coordinates and time zone.
  results="$(curl -fsS --get --data-urlencode "name=$query" --data "count=5&language=en&format=json" \
    https://geocoding-api.open-meteo.com/v1/search 2>/dev/null | python3 -c '
import json, sys
US = dict(Alabama="AL", Alaska="AK", Arizona="AZ", Arkansas="AR", California="CA", Colorado="CO",
  Connecticut="CT", Delaware="DE", Florida="FL", Georgia="GA", Hawaii="HI", Idaho="ID", Illinois="IL",
  Indiana="IN", Iowa="IA", Kansas="KS", Kentucky="KY", Louisiana="LA", Maine="ME", Maryland="MD",
  Massachusetts="MA", Michigan="MI", Minnesota="MN", Mississippi="MS", Missouri="MO", Montana="MT",
  Nebraska="NE", Nevada="NV", New_Hampshire="NH", New_Jersey="NJ", New_Mexico="NM", New_York="NY",
  North_Carolina="NC", North_Dakota="ND", Ohio="OH", Oklahoma="OK", Oregon="OR", Pennsylvania="PA",
  Rhode_Island="RI", South_Carolina="SC", South_Dakota="SD", Tennessee="TN", Texas="TX", Utah="UT",
  Vermont="VT", Virginia="VA", Washington="WA", West_Virginia="WV", Wisconsin="WI", Wyoming="WY",
  District_of_Columbia="DC")
for r in json.load(sys.stdin).get("results", []):
    region = r.get("admin1", "")
    cc = r.get("country_code", "")
    short = US.get(region.replace(" ", "_"), region) if cc == "US" else (region or r.get("country", ""))
    place = r["name"] + (", " + short if short else "")
    full = ", ".join(x for x in (r["name"], region, r.get("country", "")) if x)
    units = "imperial" if cc in ("US", "LR", "MM") else "metric"
    print("\t".join([full, r["name"], place, str(round(r["latitude"], 2)),
                     str(round(r["longitude"], 2)), r.get("timezone", "UTC"), units]))
' 2>/dev/null || true)"
  if [[ -z "$results" ]]; then
    note "No matches for \"$query\" (or no internet). Try another spelling, or add the state/country."
    continue
  fi
  i=0
  while IFS=$'\t' read -r full _; do i=$((i + 1)); note "$i) $full"; done <<< "$results"
  ask "Which one? (number, or Enter to search again)" ""
  [[ "$REPLY" =~ ^[0-9]+$ ]] && (( REPLY >= 1 && REPLY <= i )) || continue
  IFS=$'\t' read -r _ WEATHER_CITY WEATHER_PLACE WEATHER_LAT WEATHER_LON WEATHER_TZ UNITS \
    <<< "$(sed -n "${REPLY}p" <<< "$results")"
  note "Weather: $WEATHER_PLACE ($WEATHER_LAT, $WEATHER_LON, $WEATHER_TZ)"
  break
done
if [[ "$UNITS" == metric ]]; then def_u=C; else def_u=F; fi
ask "Temperatures in F or C" "$def_u"
case "$REPLY" in [Cc]*) UNITS=metric ;; *) UNITS=imperial ;; esac

# --- 4. Local news ------------------------------------------------------------------------
bold "4. Local news (optional)"
note "Headlines from your area, shown with Tech, AI, Gaming and the rest. Paste RSS or Atom"
note "feed links from local papers or stations (search \"<paper name> RSS\")."
[[ -n "$LOCAL_NEWS_FEEDS" ]] && note "Currently: $LOCAL_NEWS_NAME · $(wc -w <<< "$LOCAL_NEWS_FEEDS" | tr -d ' ') feed(s)"
if confirm "Show local news?" "$([[ -n "$LOCAL_NEWS_FEEDS" ]] && echo y || echo n)"; then
  ask "Topic name" "${LOCAL_NEWS_NAME:-$WEATHER_CITY}"
  LOCAL_NEWS_NAME="$REPLY"
  if [[ -z "$LOCAL_NEWS_FEEDS" ]] || confirm "Replace the saved feed links?" n; then
    feeds=()
    while :; do
      ask "Feed link (Enter when done)" ""
      [[ -z "$REPLY" ]] && break
      [[ "$REPLY" == http*://* ]] || { note "That should start with https://. Skipped."; continue; }
      feeds+=("$REPLY")
    done
    LOCAL_NEWS_FEEDS="${feeds[*]:-}"
    ask "Sources, as shown in Settings (e.g. \"Tribune, WBEZ\")" "$LOCAL_NEWS_SUB"
    LOCAL_NEWS_SUB="$REPLY"
  fi
  [[ -z "$LOCAL_NEWS_FEEDS" ]] && note "No feeds added; local news stays off."
else
  LOCAL_NEWS_FEEDS=""
fi

# --- 5. Calendar --------------------------------------------------------------------------
bold "5. Calendar (optional)"
note "Shows your upcoming events on the home screen and screensaver."
note "It reads a calendar's private iCal link; nothing is sent anywhere but your TV."
if [[ -f "$CAL_FILE" ]]; then
  note "Saved calendars: $(cut -d'|' -f1 "$CAL_FILE" | paste -sd, - | sed 's/,/, /g')"
fi
if confirm "Show a calendar?" "$([[ -s "$CAL_FILE" ]] && echo y || echo n)"; then
  if [[ ! -s "$CAL_FILE" ]] || confirm "Replace the saved calendar links?" n; then
    note "Google Calendar (on a computer): Settings → pick a calendar under 'Settings for my"
    note "calendars' → Integrate calendar → 'Secret address in iCal format'. Copy that link."
    note "Apple/iCloud: Calendar app → right-click the calendar → Share → Public Calendar → copy."
    note "Anyone with the link can read that calendar, so it stays in config/ (not in git)."
    colors=("#0A84FF" "#30D158" "#FF9F0A" "#BF5AF2" "#64D2FF" "#FF375F")
    lines=()
    while :; do
      ask "Calendar name (Enter when done)" ""
      [[ -z "$REPLY" ]] && break
      cal_name="${REPLY//|/-}"
      ask "Its iCal link" ""
      url="${REPLY/#webcal:/https:}"
      if [[ "$url" != https://* ]]; then note "That should start with https:// or webcal://. Skipped."; continue; fi
      lines+=("$cal_name|${colors[$(( ${#lines[@]} % ${#colors[@]} ))]}|$url")
    done
    if (( ${#lines[@]} )); then
      mkdir -p "$ROOT/config"
      printf '%s\n' "${lines[@]}" > "$CAL_FILE"
      note "Saved ${#lines[@]} calendar(s) to config/calendars.txt"
    elif [[ ! -s "$CAL_FILE" ]]; then
      note "No calendars added; calendar stays off."
    fi
  fi
  CALENDAR_ON=1
else
  CALENDAR_ON=0
fi

# --- Save ---------------------------------------------------------------------------------
mkdir -p "$ROOT/config"
{
  echo "# Written by scripts/setup.sh. Re-run it to change these, or edit by hand."
  for v in TV TV_MODEL FIRE_OS NAME APP_NAME WEATHER_CITY WEATHER_PLACE WEATHER_LAT WEATHER_LON \
           WEATHER_TZ UNITS LOCAL_NEWS_NAME LOCAL_NEWS_SUB LOCAL_NEWS_FEEDS; do
    printf '%s=%q\n' "$v" "${!v}"
  done
} > "$ROOT/config/home.env"
bold "Saved config/home.env"
note "TV: $TV ($TV_MODEL)   Name: ${NAME:-none}   App: $APP_NAME"
note "Weather: $WEATHER_PLACE, °$([[ $UNITS == metric ]] && echo C || echo F)   Local news: ${LOCAL_NEWS_FEEDS:+$LOCAL_NEWS_NAME}${LOCAL_NEWS_FEEDS:-off}   Calendar: $([[ $CALENDAR_ON == 1 && -s $CAL_FILE ]] && echo on || echo off)"

# --- Install ------------------------------------------------------------------------------
if [[ $CONNECTED == 0 ]]; then
  note "The TV isn't connected, so nothing was installed. Re-run this when it is."
  exit 0
fi
export TV
bold "Install"
note "Each step can be undone with ./scripts/restore.sh."
if confirm "Back up the TV's current packages and settings first? (recommended)" y; then
  "$ROOT/scripts/backup.sh"
fi
if confirm "Speed up animations (0.5x)?" y; then
  "$ROOT/scripts/animations.sh" 0.5
fi
if [[ $IS_FIRE == 1 ]] && confirm "Turn off Amazon tracking, ads and extras?" y; then
  note "This disables (never uninstalls) the packages in debloat/packages.txt. Preview:"
  "$ROOT/scripts/debloat.sh" --dry-run tracking ads extras
  if confirm "Go ahead?" y; then "$ROOT/scripts/debloat.sh" tracking ads extras; fi
fi
if confirm "Build and install $APP_NAME (home screen + screensaver)?" y; then
  if "$ROOT/scripts/install-launcher.sh"; then
    [[ $IS_FIRE == 1 ]] || note "Not a Fire TV: pick $APP_NAME as the home app in the TV's settings."
  else
    note "Build failed. It needs openjdk@17 and android-commandlinetools with build-tools 34 and"
    note "platform 28 (see README). Fix that, then run ./scripts/install-launcher.sh."
  fi
fi
if [[ $CALENDAR_ON == 1 && -s "$CAL_FILE" ]]; then
  confirm "Copy your calendars to the TV?" y && "$ROOT/scripts/calendar.sh"
elif [[ $CALENDAR_ON == 0 ]]; then
  "$ROOT/scripts/calendar.sh" --clear >/dev/null 2>&1 || true
fi
if confirm "Download screensaver media (film stills, ~350 MB per 4K aerial)?" n; then
  if [[ -z "${TMDB_API_KEY:-}" ]]; then
    ask "TMDB API key for film stills (free at themoviedb.org; Enter to skip stills)" ""
    [[ -n "$REPLY" ]] && export TMDB_API_KEY="$REPLY"
  fi
  "$ROOT/scripts/stills.sh"
fi
bold "Done. Press Home on the remote."
