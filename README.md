# fire-tv

Making a TCL Fire TV (55S450F, Fire OS 7.7.1.7) faster, quieter, and eventually running a custom home screen — all over Wi-Fi with ADB, no root, every change reversible.

## Setup

1. TV: Settings → My Fire TV → Developer Options → **ADB Debugging: ON**
2. Mac: `brew install --cask android-platform-tools`
3. Same Wi-Fi as the TV. Default address is `10.0.0.116:5555`; override with `TV=<ip>:5555`.
4. First connect shows an "Allow USB debugging?" prompt on the TV — tick *Always allow* and OK.

## Scripts

| Script | What it does |
| --- | --- |
| `scripts/backup.sh` | Snapshot packages + settings into `baseline/` (gitignored) |
| `scripts/animations.sh [scale]` | UI animation speed. `0.5` snappy, `1.0` stock |
| `scripts/debloat.sh [--dry-run] <tiers>` | Disable packages from `debloat/packages.txt` |
| `scripts/install-launcher.sh` | Build + install Griffin Home and turn on the home guard |
| `scripts/restore.sh` | Undo everything: re-enable packages, stock animations, remove Griffin Home |

Tiers: `tracking`, `ads`, `extras`, and the opt-in `updates`, `screensaver`.

```sh
./scripts/backup.sh
./scripts/debloat.sh --dry-run tracking ads extras
./scripts/debloat.sh tracking ads extras
```

## Undo

`./scripts/restore.sh` puts it back to stock. Nothing is uninstalled, so a factory reset also fully restores it.

## Roadmap

- [x] ADB over Wi-Fi + baseline snapshot
- [x] Faster animations
- [x] Debloat (tracking / ads / extras) — 17 disabled; 3 protected by Fire OS
- [x] Custom launcher (Griffin Home) — `./scripts/install-launcher.sh`

## Griffin Home (launcher/)

A full-screen WebView app (`launcher/app/src/main/assets/index.html`) wrapped in a tiny Android shell, built without Gradle by `launcher/build.sh` (needs `openjdk@17` + `android-commandlinetools` with build-tools 34 and platform 28).

Fire OS handles the real remote's Home before any app sees it, and Android then delays other apps' activity starts by ~5s. So `HomeGuard` (an accessibility service, enabled over ADB) watches for Amazon's home and instantly covers it with a snapshot of Griffin Home, ignoring remote presses until the real screen takes over. The "Amazon home" tile pauses the guard for 10 minutes (for inputs / Amazon's app library). Settings → Home guard turns it off entirely.

The home screen shows Chicago weather from [Open-Meteo](https://open-meteo.com) (no API key).

**Screensaver:** `Gargantua` is a DreamService that renders Interstellar's black hole (WebGL ray-bent accretion disk, `assets/screensaver.html`) with a terminal readout of the date and Chicago weather. `install-launcher.sh` sets it as the screensaver; `restore.sh` puts Amazon's back.
