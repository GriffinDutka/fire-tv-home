# Griffin Home redesign: build guide

Step-by-step instructions to build the redesign on the Mac and install it on the TV. Read [`PLAN.md`](PLAN.md) for the why, [`SPEC.md`](SPEC.md) for exact values, and [`DECISIONS.md`](DECISIONS.md) for how each choice was made.

**Using Claude Code on the Mac:** open the repo and say, for example:
> Read `docs/redesign/PLAN.md`, `SPEC.md` and `BUILD.md`. Do phase 2, then stop so I can check it on the TV.

Each phase ends on a working app that you can install and check.

Items marked **⚠ verify** couldn't be confirmed from the planning environment. Check them on the TV or online first.

---

## Phase 0: Set up

1. Tools, from the repo [README](../../README.md#setup):
   - `brew install --cask android-platform-tools`
   - `openjdk@17`
   - `android-commandlinetools` with build-tools 34 and platform 28
   - ADB debugging on the TV
2. Get the code:
   ```sh
   git fetch origin
   git checkout -b redesign origin/main   # or base on claude/griffin-home-redesign-plan until PR #2 merges
   git fetch origin claude/home-favorites-screensaver   # PR #1: code to reuse
   ```
3. Back up the TV and check that the current app still builds:
   ```sh
   ./scripts/backup.sh
   ./scripts/install-launcher.sh
   ```

**Undo at any point:** `./scripts/restore.sh` returns the TV to stock. Reinstalling `main` gets the old Griffin Home back.

---

## Phase 1: Check the TV's WebView (do this first)

The glass look and the frosted clock need CSS `backdrop-filter`, and they need it to run smoothly.

1. **WebView version:**
   ```sh
   adb shell dumpsys webviewupdate | head -20
   ```
   Note the package and version. `backdrop-filter` needs Chromium 76+.
2. **Run the mockup inside Griffin Home** (temporary; don't commit):
   - Copy `docs/redesign/mockup.html` to `launcher/app/src/main/assets/redesign-test.html`.
   - In the copy, just before the final `})();` of the script, add:
     ```js
     window.tv = { key: key, resume: function () {} };
     ```
     MainActivity sends remote keys to `tv.key(...)`.
   - In the copy's `<style>`, add the following so the TV frame fills the screen and the mockup controls are hidden:
     ```css
     .wrap { max-width: none; } body { padding: 0 !important; }
     header.page, .card, .controls { display: none !important; }
     .tv { border-radius: 0; box-shadow: none; }
     ```
   - In `MainActivity.onCreate`, temporarily load `file:///android_asset/redesign-test.html` instead of `index.html`. Then run `./scripts/install-launcher.sh`.
3. **Measure:**
   - On the Mac, open Chrome at `chrome://inspect`. WebView debugging is already on in `MainActivity`. Inspect the page.
   - Turn on Rendering → *Frame Rendering Stats*. Record a Performance trace while moving focus across rows, waking from the screensaver and opening Settings.
4. **Pass:**
   - Blur is visible behind the panels and through the clock digits.
   - Moving focus stays at **30 fps or better**, with no stutter when waking.
5. **If it fails**, try these in order:
   1. Lower the blur range: `blur(40 → 2)` becomes `blur(16 → 2)`.
   2. Use fewer glass layers.
   3. **Fake glass:** pre-blur each picture on the Mac. Add to `scripts/stills.sh`:
      ```sh
      magick in.jpg -resize 25% -blur 0x6 out-blur.jpg
      ```
      Use the blurred copy as the Home background and as each panel's background, positioned so it lines up with the screen, with no `backdrop-filter`.
   4. Solid tinted panels and a solid clock: Settings → Clock style = Solid becomes the default.
6. Revert the temporary `loadUrl` change and delete `redesign-test.html`.

---

## Phase 2: Foundation (fonts, shared styles, settings storage)

### 2.1 Fonts

Bundle Montserrat and Roboto as variable fonts, which are free to ship. Using Fontsource from npm:

```sh
REPO="$PWD"; FONTS="$REPO/launcher/app/src/main/assets/fonts"
cd "$(mktemp -d)"
npm pack @fontsource-variable/montserrat @fontsource-variable/roboto
mkdir m r
tar xzf fontsource-variable-montserrat-*.tgz -C m
tar xzf fontsource-variable-roboto-*.tgz -C r
cp m/package/files/montserrat-latin-wght-normal.woff2 "$FONTS/Montserrat.woff2"
cp r/package/files/roboto-latin-wght-normal.woff2 "$FONTS/Roboto.woff2"
cp m/package/LICENSE "$FONTS/Montserrat-LICENSE.txt"
cp r/package/LICENSE "$FONTS/Roboto-LICENSE.txt"
cd "$REPO"
```

These are the variable fonts (every weight in one file), Latin subset. Checked against Fontsource 5.3.0: the file names above exist. The Latin subset covers °, curly quotes and en dashes.

```css
@font-face { font-family: 'Montserrat'; src: url(fonts/Montserrat.woff2) format('woff2'); font-weight: 100 900; }
@font-face { font-family: 'Roboto'; src: url(fonts/Roboto.woff2) format('woff2'); font-weight: 100 900; }
```

Once nothing uses them, remove the Instrument fonts and `JetBrainsMono.woff2` from `assets/fonts/`. Keep JetBrains Mono if the Gargantua scene stays; its terminal text uses it.


### 2.2 Shared files

Move what Home and the screensaver share into `launcher/app/src/main/assets/`. The mockup has all of this in one file; split it:

| File | Contents (from `mockup.html`) |
|---|---|
| `ui.css` | `@font-face` for both fonts, color tokens, `.glass`, `.txt`, dark-glass rule, `.cal` widget, `.fday`, switch, focus styles, reduced-motion rules ([SPEC §2–4](SPEC.md#2-colors)) |
| `glass.js` | `setGlass(v)` with the lerp formula ([SPEC §3](SPEC.md#3-glass)) |
| `prefs.js` | Read/write settings through the `Prefs` bridge (2.3), with defaults from [SPEC §20](SPEC.md#20-saved-state) |
| `greeting.js` | `hellos()`, `subs()`, `holiday()`, `pick()` from the mockup ([SPEC §11](SPEC.md#11-greeting)) |
| `calendar.js` | `events()` filter/sort, `dayLabel()`, `renderCal()` ([SPEC §12](SPEC.md#12-calendar)) |
| `weather.js` | Existing file, with PR #1's 3-day `days` array (2.4) |

Both `index.html` and `screensaver.html` include these.

### 2.3 Settings storage shared by Home and the screensaver

The screensaver (a DreamService) and Home (MainActivity) are separate WebViews. Store settings natively so both always agree. Add `Store.java`, a bridge backed by the same SharedPreferences file the existing `Prefs` class uses:

```java
/** window.Store in both pages: JSON strings by key, shared by Home and the screensaver. */
class Store {
    private final SharedPreferences sp;
    Store(Context c) { sp = c.getSharedPreferences("griffin_home", Context.MODE_PRIVATE); }
    @JavascriptInterface public String get(String key) { return sp.getString("ui." + key, null); }
    @JavascriptInterface public void set(String key, String json) { sp.edit().putString("ui." + key, json).apply(); }
}
```

Register it in both places:

```java
web.addJavascriptInterface(new Store(this), "Store");
```

This goes in `MainActivity` and in `SaverView` (from PR #1). In `prefs.js`, use `Store` when it exists and `localStorage` otherwise (browser testing).

**Keys:**

| Key | Holds |
|---|---|
| `glass` | Glass value |
| `homeBlur` | Home blur |
| `fonts` | Headline and text font |
| `prefs` | The [SPEC §20](SPEC.md#20-saved-state) object |
| `favorites` | Array of package names |
| `hidden` | Array of package names |
| `currentPicture` | The picture shown now |

### 2.4 Bring over working code from PR #1

```sh
B=origin/claude/home-favorites-screensaver
git checkout $B -- \
  launcher/app/src/main/java/com/griffin/home/Media.java \
  launcher/app/src/main/java/com/griffin/home/SaverView.java \
  launcher/app/src/main/java/com/griffin/home/ScreensaverActivity.java \
  launcher/app/src/main/java/com/griffin/home/Gargantua.java \
  launcher/app/src/main/java/com/griffin/home/MainActivity.java \
  launcher/app/src/main/AndroidManifest.xml \
  launcher/app/src/main/assets/weather.js
```

What this brings:

| From PR #1 | What it does |
|---|---|
| `MainActivity` | OK fires on release; hold ≥ 550ms sends `hold`; `Android.apps()` (every launchable app, A–Z); `Android.icon(pkg)` (banner or icon cached as PNG, `{src, banner}`); `Android.startScreensaver()`; `Stills`/`Aerials` bridges; existing `launch`, `tvSettings`, `amazonHome`, `getAnim`/`setAnim`, `guardOn`/`setGuardOn` |
| `SaverView` | Screensaver view (WebView + VideoView for aerials) shared by the DreamService and `ScreensaverActivity` |
| `ScreensaverActivity` | Start the screensaver on demand; any key returns Home |
| `Media` | Lists files pushed by `scripts/stills.sh` |
| `weather.js` | Adds `days: [{dow, hi, lo, code, text}]` (next 3 days) and caches under `weather.chicago.v2` |

Don't take PR #1's `index.html` or `screensaver.html`. Those get rebuilt in phases 3 and 5.

**Done when:** the app builds (`./launcher/build.sh`), installs, and looks the same as before, with the fonts loaded.

---

## Phase 3: Home

Rebuild `launcher/app/src/main/assets/index.html` from the mockup's TV stage, replacing sample data with bridges.

| Mockup | Real app |
|---|---|
| `APPS` / `ALL` fixed lists | `Android.apps()` + `Android.icon(pkg)`. Favorites default: the [SPEC §9.1](SPEC.md#91-rows) list, filtered to installed apps. Look up colors and wordmarks by package (table below). |
| `favs` in memory | `Store` key `favorites` (package names) |
| options "Open" closes the panel | `Android.launch(pkg)` |
| options "Hide" closes the panel | add to `hidden`, rebuild rows |
| System → TV settings / Amazon home do nothing | `Android.tvSettings()` / `Android.amazonHome()` |
| keyboard listener | `window.tv = { key: key, resume: resume }` (MainActivity calls these) |
| `wake()` / `sleep()` | Home is always "awake". Sleep = `Android.startScreensaver()`. |

**Package names** (from today's `index.html`):

| App | Package |
|---|---|
| Netflix | `com.netflix.ninja` |
| YouTube | `com.amazon.firetv.youtube` |
| Apple TV | `com.apple.atve.amazon.appletv` |
| Peacock | `com.peacock.peacockfiretv` |
| HBO Max | `com.hbo.hbonow` |
| Tubi | `com.tubitv.ott` |
| Pluto TV | `tv.pluto.android` |
| Fawesome | `com.future.moviesByFawesomeAndroidTV` |
| Crossy Road | `com.hipsterwhale.crossy` |

Find the rest (Claude, Prime Video, Plex, Spotify) on the TV:

```sh
adb shell pm list packages | grep -iE 'claude|anthropic|avod|plex|spotify'
```

**Tile art** ([PLAN open question 2](PLAN.md#open-questions)): decide before building. Default plan: if `icon()` returns `banner: true`, fill the tile with the banner. Otherwise put the icon centered at 116px on the app's color, or use the wordmark if there's no good icon.

**`tv.resume()`** runs every time Home comes back:
- re-read apps and settings
- pick a new greeting ([SPEC §11](SPEC.md#11-greeting))
- re-render the widgets
- play the "blur in" transition: start with the picture sharp (no `awake` class), then add `awake` on the next frame so it animates into the blur ([SPEC §5](SPEC.md#5-picture-and-screen-states))

**Home guard snapshot:** `MainActivity.snapshot()` draws the WebView into a bitmap for the home guard's cover. ⚠ verify that the snapshot shows the glass correctly. A WebView draw may skip `backdrop-filter`. If it looks wrong, the cover can briefly show plain panels. It only shows for under a second.

**Done when:** the [SPEC §18.2](SPEC.md#182-what-each-key-does) Home, options and move rows all work with the real remote, launching apps works, and Favorites/hidden persist across restarts.

---

## Phase 4: Greeting and weather

1. Port `hellos()`, `subs()` and `holiday()` exactly as written into `greeting.js`, with these fixes:
   - "{n} minutes" → "1 minute" when n is 1
   - Weather comes from `weather.get()`: `temp`, `text`, `days[0].text`; sunset from `sunset` ("17:52" → hours and minutes)
2. **°C:** when Settings → Weather → Units is °C, request Open-Meteo with `temperature_unit=celsius` and drop "F" anywhere it appears. "Below 32°F" and "below 40°F" become 0°C and 4°C.
3. **Forecast rows:** `days[i].dow`, `hi`, `lo`, `text`.
4. **Clock pill weather:** `"{temp}° {text} · Chicago"`.

**Done when:** the greeting changes on each return to Home, never repeats twice in a row, and line 2 matches the conditions in [SPEC §11.2](SPEC.md#112-line-2-right-now). Check by changing the TV's time zone or date if needed.

---

## Phase 5: Screensaver

1. Keep the old screensaver as a scene: `git mv assets/screensaver.html assets/gargantua.html`.
2. Write a new `screensaver.html` from the mockup's `.saver` part ([SPEC §6](SPEC.md#6-screensaver)):
   - picture layer (sharp)
   - date and frosted clock (`drawTime()` from the mockup)
   - weather, calendar and headline cards
3. **Pictures:**
   - `Stills.list()` (and `Aerials.list()` for videos, which play in `SaverView`'s VideoView as today)
   - source, rotation interval and shuffle from Settings → Pictures
   - crossfade
   - write the current picture to `Store` key `currentPicture` so Home shows the same one
4. **Gargantua scene:** when Settings → Screensaver → Gargantua is on, include the old `gargantua.html` in the rotation.
5. **Start after** ⚠ verify how Fire OS decides when to start the screensaver. Options:
   - Android's `Settings.System.SCREEN_OFF_TIMEOUT`, which needs `WRITE_SETTINGS`:
     ```sh
     adb shell appops set com.griffin.home WRITE_SETTINGS allow
     ```
   - Fire OS's own screensaver start-time setting
   - Fallback: Griffin Home's own idle timer while Home is showing, which calls `Android.startScreensaver()`
6. `install-launcher.sh` already points the system screensaver at `.Gargantua`, which now shows the new screensaver.

**Done when:** the screensaver comes on by itself and from System → Screensaver, any button lands on Home with the same picture blurring in, and the cards and clock follow Settings.

---

## Phase 6: Settings screen

Port `CATS`, the row builders, `renderSet()`, `activate()`, `setKey()` and `applyPrefs()` from the mockup. Every row is in [SPEC §17](SPEC.md#17-settings-every-row).

| Row | Real behavior |
|---|---|
| Home guard | `Android.guardOn()` / `Android.setGuardOn(on)` (existing) |
| Animation speed | `Android.getAnim()` / `Android.setAnim(0.5 / 1 / 0)` (existing) |
| TV settings, Amazon home | existing bridges |
| Network settings | new bridge: `startActivity(new Intent(Settings.ACTION_WIFI_SETTINGS))` ⚠ verify on Fire OS; fall back to `ACTION_SETTINGS` |
| Network → Wi-Fi name | ⚠ On Android 9 the network name needs location permission and location turned on; otherwise Android reports `<unknown ssid>`. Grant with `adb shell pm grant com.griffin.home android.permission.ACCESS_FINE_LOCATION`, or just show "Connected". |
| Hidden apps | count from `hidden`; OK clears it |
| Reset Favorites | default list, filtered to installed |
| About → Griffin Home | the app's version name |

**Done when:** every row in [SPEC §17](SPEC.md#17-settings-every-row) works with the remote and survives a restart, and changes show on both Home and the screensaver.

---

## Phase 7: Live data

The WebView pages load from `file://`, so they can't fetch most websites directly (CORS). Open-Meteo allows it, which is why weather already works; news feeds and calendar links generally don't. Do those fetches in Java.

### 7.1 Fetch bridge

```java
/** Android.fetch(id, url): fetched off the UI thread; the page hears data.done(id, text) or data.fail(id). */
@JavascriptInterface
public void fetch(final String id, final String url) {
    new Thread(() -> {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(10000); c.setReadTimeout(15000);
            c.setRequestProperty("User-Agent", "GriffinHome/1.0");
            try (InputStream in = c.getInputStream()) {
                String body = new String(readAll(in), "UTF-8");
                js("data.done(" + JSONObject.quote(id) + "," + JSONObject.quote(body) + ")");
            }
        } catch (Exception e) {
            js("data.fail(" + JSONObject.quote(id) + ")");
        }
    }).start();
}

static byte[] readAll(InputStream in) throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    byte[] buf = new byte[8192];
    for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
    return out.toByteArray();
}
```

The `Store`, `fetch` and `network` snippets in this guide compile against the Android 9 (API 28) framework.

Cache results in `Store` so the screensaver has something to show while offline.

### 7.2 Wi-Fi

Add to the manifest:

```xml
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

Both are normal permissions; nothing to grant over ADB.

```java
/** 0 offline, 1–3 Wi-Fi strength, 4 Ethernet. */
@JavascriptInterface
public int network() {
    ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
    NetworkInfo ni = cm.getActiveNetworkInfo();
    if (ni == null || !ni.isConnected()) return 0;
    if (ni.getType() == ConnectivityManager.TYPE_ETHERNET) return 4;
    WifiManager wm = (WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
    return WifiManager.calculateSignalLevel(wm.getConnectionInfo().getRssi(), 3) + 1;
}
```

Poll every 30s on Home. Level 4 shows a cable icon instead of the arcs.

### 7.3 Google Calendar (private iCal address)

1. In Google Calendar on the web: Settings → *your calendar* → **Secret address in iCal format**. Do this for each calendar you want.
2. Create `config/calendars.txt` (add `config/` to `.gitignore`), one calendar per line:
   ```
   Personal|#0A84FF|https://calendar.google.com/calendar/ical/…/basic.ics
   Sports|#64D2FF|https://calendar.google.com/calendar/ical/…/basic.ics
   ```
   iCal has no colors, so they're set here.
3. New `scripts/calendar.sh` pushes it to the TV, next to the stills:
   ```sh
   adb_tv push config/calendars.txt /sdcard/Android/data/com.griffin.home/files/config/calendars.txt
   ```
   Add a bridge that reads that file and returns it to the page.
4. Every 15 minutes: fetch each URL (7.1) and parse `VEVENT`s:

| Field | Handling |
|---|---|
| `SUMMARY` | title |
| `DTSTART`, `DTEND` / `DURATION` | `TZID=…`, UTC `…Z`, or `VALUE=DATE` (all-day) |
| `RRULE` | **must be expanded**, or repeating events never show. Handle `FREQ=DAILY/WEEKLY/MONTHLY/YEARLY` with `INTERVAL`, `COUNT`, `UNTIL`, `BYDAY`; expand only the next 14 days. |
| `EXDATE` | skip those occurrences |
| `RECURRENCE-ID` | replaces one occurrence |
| `STATUS:CANCELLED` | skip |
| Folded lines (continuation lines starting with a space) | unfold before parsing |

5. **If recurrences get messy:** switch to the Google Calendar API with sign-in on the TV (enter a code at google.com/device). Its event list with `singleEvents=true` expands repeats for you. This needs a Google Cloud project with an OAuth client for "TVs and limited input devices".

**Apple/iCloud calendars** work the same way: share the calendar publicly from the Calendar app and use its `webcal://` link with `https://` instead.

**Privacy:** anyone with the secret address can read that calendar. Keep it out of git; it lives only in `config/` on the Mac and on the TV. Reset the address in Google Calendar if it leaks.

### 7.4 News

Fetch with 7.1 every 30 minutes and parse RSS (`item/title, pubDate, link`) or Atom (`entry/title, updated`) with `XmlPullParser` in Java, or `DOMParser` in the page. Keep the 5 newest per topic and decode HTML entities. Rotate per [SPEC §14](SPEC.md#14-news).

Feed URLs ⚠ verify each one; publishers move feeds:

| Topic | Feeds |
|---|---|
| Tech | `https://www.theverge.com/rss/index.xml`, `https://feeds.arstechnica.com/arstechnica/index` |
| AI | `https://www.theverge.com/rss/ai-artificial-intelligence/index.xml`, `https://www.technologyreview.com/feed/` |
| Sci-fi shows | `https://gizmodo.com/feed`, `https://www.denofgeek.com/feed/` |
| Gaming | `https://www.polygon.com/rss/index.xml`, `https://feeds.ign.com/ign/all` |
| Chicago | `https://blockclubchicago.org/feed/`, `https://chicago.suntimes.com/rss/index.xml`, WBEZ (find its current feed) |

### 7.5 Steam

- **Top sellers and sales:** `https://store.steampowered.com/api/featuredcategories` (public, no key). Use `top_sellers` and `specials`. ⚠ verify the response shape.
- **Wishlist sales:** needs a public profile and Steam's current wishlist API (`IWishlistService`) ⚠ verify, plus a Steam Web API key kept in `config/`. Optional; top sellers alone work without it.
- **Lines look like:** "{Game} is {n}% off until {weekday}" and "Top seller: {Game}".

**Done when:** the calendar widget, greeting event lines and headlines show real data, and offline still shows the last cached data.

---

## Phase 8: Pictures (after the background redo)

- Put Griffin's pictures in `stills/images/` and push them with `./scripts/stills.sh`. It already syncs `.jpg` files and titles.
- If phase 1 needed fake glass, `stills.sh` also makes the pre-blurred copies.
- Check that text is readable on each picture, on both the screensaver and Home. Adjust per-picture darkening if needed, for example a `dim` value in `stills.json`.
- Decide on Gargantua and the aerials ([PLAN open question 3](PLAN.md#open-questions)).

---

## Phase 9: Final check

Go through [SPEC.md](SPEC.md) section by section on the TV:

- [ ] Glass: all four settings look right; text readable on Clear
- [ ] Fonts: Montserrat and Roboto everywhere, loaded offline
- [ ] Screensaver: date, frosted clock (and Solid), three cards, headline rotation, wake animation, same picture on Home
- [ ] Home: greeting (both lines, wraps, no repeats), tab pill, clock pill, Wi-Fi levels and Ethernet, forecast, calendar widget
- [ ] Rows: scrolling math, row fade, focus look, names under tiles
- [ ] Options for Favorites and All apps; move mode; Back behaviors
- [ ] System tiles: all four actions
- [ ] Settings: every row in [SPEC §17](SPEC.md#17-settings-every-row); persists across restart; affects the screensaver too
- [ ] Remote: hold (≥ 550ms) vs. tap, Back, ☰
- [ ] Offline: cached weather, calendar and news; Wi-Fi shows offline
- [ ] Home guard still covers Amazon's home and returns to the redesign
- [ ] Reduced motion: no drift or sweeps
- [ ] `./scripts/restore.sh` still fully undoes everything

---

## Reference: commands

| Task | Command |
|---|---|
| Build only | `./launcher/build.sh` |
| Build + install + guard + screensaver | `./scripts/install-launcher.sh` |
| Push pictures | `./scripts/stills.sh` |
| Push calendar config (new) | `./scripts/calendar.sh` |
| Debug the page | Chrome on the Mac → `chrome://inspect` |
| Logs | `adb logcat -s chromium:* AndroidRuntime:*` |
| WebView version | `adb shell dumpsys webviewupdate` |
| Undo everything | `./scripts/restore.sh` |

**New permissions over the whole build:**

| Permission | Granted how |
|---|---|
| `ACCESS_WIFI_STATE`, `ACCESS_NETWORK_STATE` | Manifest only |
| `ACCESS_FINE_LOCATION` | Only for the Wi-Fi name; `pm grant` |
| `WRITE_SETTINGS` | Only if "Start after" uses Android's timeout; `appops` |
| `WRITE_SECURE_SETTINGS` | Already granted |

## Reference: regenerate the screenshots

```sh
node docs/redesign/tools/screenshots.js docs/redesign/mockup.html docs/redesign/screens
```

Needs Node and Playwright with Chromium.
