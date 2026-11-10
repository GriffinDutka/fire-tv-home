# fire-tv

Tools and a custom home screen for Fire TV, driven from a Mac over ADB. See README.md.

- **Setting up a TV** ("set up my TV", "install this", a new owner): follow the
  "Steps for Claude Code" in SETUP.md. Ask before each install step.
- Owner settings live in `config/home.env` (gitignored), read by `scripts/config.sh`.
  `launcher/build.sh` turns them into `assets/config.js` (`window.HOME_CONFIG`) inside the app.
  Nothing personal goes in the code: names, places, feeds and the TV model come from the config.
- Never commit `config/` (except the `*.example.*` files) or `baseline/`: they hold calendar
  links and device identifiers.
- Tests: `node --test launcher/tests/`.
