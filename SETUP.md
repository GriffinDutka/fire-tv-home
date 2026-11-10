# Setup

Puts this home screen, screensaver and cleanup on your own Fire TV. Takes about 15 minutes.
Every change can be undone with `./scripts/restore.sh`.

You'll be asked for:

1. **Your TV**: its IP address. The model and Fire OS version are detected automatically.
2. **Your name**: for the greetings ("Good evening, Sam"). Optional.
3. **Weather area**: a city or town; the coordinates and time zone are looked up for you.
4. **Local news**: optional. RSS links from local papers or stations.
5. **Calendar**: optional. Private iCal links from Google or iCloud Calendar.

## Before you start

- A Mac on the same Wi-Fi as the TV, with [Homebrew](https://brew.sh). (Linux works too if you
  set `ANDROID_SDK_ROOT` and `JAVA_HOME` for `launcher/build.sh`.)
- `brew install --cask android-platform-tools` (adb).
- To build the home screen app:
  ```sh
  brew install openjdk@17 android-commandlinetools
  sdkmanager "build-tools;34.0.0" "platforms;android-28"
  ```
- On the TV: Settings → My Fire TV → Developer Options → **ADB Debugging: ON**. No Developer
  Options? Settings → My Fire TV → About → press OK on the TV's name 7 times. The IP address is
  under Settings → My Fire TV → About → Network.
- Optional, for screensaver film stills: a free [TMDB](https://www.themoviedb.org/settings/api)
  API key.

## Option A: run the setup script

```sh
./scripts/setup.sh
```

It asks the questions above, saves your answers to `config/home.env`, then offers each install
step (backup, faster animations, turning off Amazon's tracking and ads, the home screen,
calendars and screensaver media). Run it again any time to change an answer; Enter keeps the
current one.

## Option B: by hand

Copy `config/home.example.env` to `config/home.env` and fill it in. For calendars, copy
`config/calendars.example.txt` to `config/calendars.txt`. Then run the install steps in the table
below.

## Option C: let Claude Code do it

Open this folder in [Claude Code](https://claude.com/claude-code) and say **"set up my TV"**.
It follows the steps below.

### Steps for Claude Code

Ask the owner these one at a time, in plain language, and wait for each answer:

1. **TV IP address.** Explain how to turn on ADB Debugging (above) and where to find the IP.
   Run `adb connect <ip>:5555`, tell them to accept the prompt on the TV (tick *Always allow*),
   then confirm with `adb -s <ip>:5555 get-state` (should print `device`). Detect the model with
   `getprop ro.product.manufacturer`, `ro.product.model` and `ro.build.version.name` (on Fire TV
   that's "Fire OS 7.7.1.7 (…)"; save just the number as `FIRE_OS`), and tell them what you found.
   If `pm path com.amazon.tv.launcher` prints nothing, it isn't a Fire TV: skip debloat and tell
   them the home guard won't apply.
2. **Their first name** for greetings, or none. Suggest `<Name> Home` as the app name.
3. **Weather area.** Look it up with
   `curl -s "https://geocoding-api.open-meteo.com/v1/search?name=<city>&count=5"`, show the
   matches and let them pick. Use °F in the US, °C elsewhere, unless they say otherwise.
4. **Local news**, yes or no. If yes, find RSS or Atom feeds for two or three local outlets,
   check each one loads (`curl -sI`), and confirm the list with them.
5. **Calendar**, yes or no. If yes, walk them through getting each calendar's private link
   (Google Calendar → Settings → the calendar → Integrate calendar → *Secret address in iCal
   format*; iCloud → share as Public Calendar; `webcal://` links work). Tell them anyone with the
   link can read that calendar, which is why it stays out of git.

Then write `config/home.env` in the shape of `config/home.example.env` (gitignored; quote values
that have spaces), and, for calendars, `config/calendars.txt` with one `Name|#color|link` per line
(see `config/calendars.example.txt`).

Confirm each install step with them before running it:

| Step | Command |
| --- | --- |
| Back up the TV (do this first) | `./scripts/backup.sh` |
| Faster animations | `./scripts/animations.sh 0.5` |
| Turn off tracking, ads, extras (Fire TV only; show the dry run first) | `./scripts/debloat.sh --dry-run tracking ads extras`, then without `--dry-run` |
| Build and install the home screen | `./scripts/install-launcher.sh` |
| Calendars (if any) | `./scripts/calendar.sh` |
| Screensaver media (optional, large) | `./scripts/stills.sh` (film stills need `TMDB_API_KEY`) |

## What the settings change

- **Name** appears in the greetings and the screensaver's terminal prompt. With no name, lines
  like "Good evening, Sam" become "Good evening", and lines that need a name are skipped.
- **App name** is what the TV's app list and Accessibility settings show.
- **Weather** sets the forecast's location, time zone and default units on the home screen and
  screensaver. Settings → Weather → Units switches °F/°C on the TV.
- **Local news** adds a headlines topic, last in the rotation, that Settings → News can turn off.
- **TV model and Fire OS** only label Settings → About.

Settings are baked in when the app is built, so after changing `config/home.env` run
`./scripts/install-launcher.sh` again. Your favorites and hidden apps are kept. Calendars are
read from the TV, so after editing `config/calendars.txt` just run `./scripts/calendar.sh`.

## Other TVs

Built and tested on a TCL 55S450F with Fire OS 7.7.1.7. Other Fire OS 7 and 8 TVs and sticks
should work, but Amazon's package names change between versions, so check the debloat dry run
before applying it. Newer Fire TVs running Vega OS can't install apps from outside Amazon's store,
so this won't work on them. On Google TV / Android TV, the home screen and screensaver install,
and you can choose the app as your home screen in the TV's settings.
