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
| `scripts/restore.sh` | Undo everything: re-enable packages, stock animations, stock home |

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
- [ ] Debloat (tracking / ads / extras)
- [ ] Custom launcher
