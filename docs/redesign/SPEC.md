# Griffin Home redesign: full spec

Every detail of the redesign as built in [`mockup.html`](mockup.html): layout, values, strings, logic and behavior. [`PLAN.md`](PLAN.md) has the decisions, build order and roadmap; this file is the reference to build from.

When this file and the mockup disagree, the mockup's code is the source of truth. Section [21](#21-mockup-only-and-not-yet-wired) lists what the mockup only fakes.

## Contents

1. [Canvas and conventions](#1-canvas-and-conventions)
2. [Colors](#2-colors)
3. [Glass](#3-glass)
4. [Type](#4-type)
5. [Picture and screen states](#5-picture-and-screen-states)
6. [Screensaver](#6-screensaver)
7. [Home: top bar](#7-home-top-bar)
8. [Home: hero and widgets](#8-home-hero-and-widgets)
9. [Home: rows and tiles](#9-home-rows-and-tiles)
10. [Options panel and move mode](#10-options-panel-and-move-mode)
11. [Greeting](#11-greeting)
12. [Calendar](#12-calendar)
13. [Weather](#13-weather)
14. [News](#14-news)
15. [Wi-Fi](#15-wi-fi)
16. [Settings screen](#16-settings-screen)
17. [Settings: every row](#17-settings-every-row)
18. [Remote input](#18-remote-input)
19. [Timers and animation](#19-timers-and-animation)
20. [Saved state](#20-saved-state)
21. [Mockup-only and not yet wired](#21-mockup-only-and-not-yet-wired)

---

## 1. Canvas and conventions

- **Canvas:** 1600×900, scaled uniformly to the screen (`scale = screen width / 1600`), origin top-left. On a 1080p TV that's ×1.2. All px values in this spec are canvas px.
- **Safe area:** 72px left/right margins for content. Top bar starts 52px from the top.
- **Easing:** `cubic-bezier(.2, .8, .2, 1)` for movement (called *ease-out* below); plain `ease` for fades.
- **Number style:** times, dates and temperatures use tabular numerals where they're bold (clock pill time, calendar date, forecast temperatures, calendar times).
- **Text in Griffin's voice:** the name "Griffin" is hard-coded in greeting lines.
- **Degree sign:** "54°" (no space, no unit), except the screensaver weather card's high/low: "H:58° L:44°".
- **Dashes:** time ranges use an en dash with spaces: "7:30 PM – 9:00 PM".

## 2. Colors

### Base

| Token | Value | Use |
|---|---|---|
| Text | `#FFFFFF` | All text on the TV canvas |
| Text, secondary | white 82% | Greeting line 2 |
| Text, muted | white 60–78% | Labels, subtitles, small caps |
| Focus fill | white 92% (`rgba(255,255,255,.92)`) | Focused pills, rows, options |
| Focus text | `#111111` | Text on focus fill |
| Red accent | `#FF453A` | Calendar weekday, Chicago topic, News category |
| Switch on | `#30D158` | Settings toggles |

### App tiles

| App | Tile background | Mark color | Mark | Accent dot |
|---|---|---|---|---|
| Netflix | `#000000` | `#E50914` | N logo | `#E50914` |
| YouTube | `#FFFFFF` | `#FF0000` | play logo | `#FF0000` |
| Apple TV | `#000000` | `#FFFFFF` | tv logo | `#C7C7CC` |
| Peacock | `#000000` | `#FFFFFF` | wordmark "peacock" | `#F5B700` |
| HBO Max | gradient 140° `#0A1A6B` → `#000000` 70% | `#FFFFFF` | max logo | `#3D5AFE` |
| Tubi | `#7408FF` | `#FFFFFF` | tubi logo | `#7408FF` |
| Claude | `#D97757` | `#FFFFFF` | Claude logo | `#D97757` |
| Pluto TV | `#000000` | `#FFF200` | wordmark "pluto tv" | `#FFF200` |
| Prime Video | `#00A8E1` | `#FFFFFF` | wordmark "prime video" | `#00A8E1` |
| Plex | `#1F1F1F` | `#EBAF00` | plex logo | `#EBAF00` |
| Spotify | `#000000` | `#1ED760` | Spotify logo | `#1ED760` |
| Crossy Road | `#5CC46E` | `#FFFFFF` | wordmark "Crossy Road" | `#7BD389` |
| Fawesome | `#16233A` | `#2EC4B6` | wordmark "fawesome" | `#2EC4B6` |

Logos in the mockup are Simple Icons (CC0) paths on a 24×24 viewBox. Simple Icons' HBO Max mark still reads "max" (the 2023–25 branding). On the TV, use each installed app's own banner or icon (see [PLAN open question 2](PLAN.md#open-questions)).

### Calendars

| Calendar | Color |
|---|---|
| Personal | `#0A84FF` |
| Health | `#30D158` |
| Errands | `#FF9F0A` |
| Sports | `#64D2FF` |
| Holidays | `#BF5AF2` |

### News topics

| Topic | Color |
|---|---|
| Tech | `#0A84FF` |
| AI | `#BF5AF2` |
| Sci-fi shows | `#64D2FF` |
| Gaming | `#30D158` |
| Steam | `#C7D5E0` |
| Chicago | `#FF453A` |

### Settings categories

| Category | Icon color |
|---|---|
| Home | `#0A84FF` |
| Appearance | `#BF5AF2` |
| Pictures | `#FF9F0A` |
| Screensaver | `#64D2FF` |
| News | `#FF453A` |
| Calendar | `#FF375F` |
| Weather | `#5AC8FA` |
| Network | `#30D158` |
| TV & system | `#8E8E93` |
| About | `#C7C7CC` |

## 3. Glass

### The Glass value

One number `v` from 0 (Frosted) to 100 (Clear) drives five variables with linear interpolation, `t = v / 100`:

| Variable | At 0 | At 100 | Formula |
|---|---|---|---|
| `blur` | 40px | 2px | `round(40 + (2 − 40)·t)` |
| `tint` | 0.24 | 0.03 | `0.24 + (0.03 − 0.24)·t` |
| `rim` | 0.36 | 0.20 | `0.36 + (0.20 − 0.36)·t` |
| `shine` | 0.26 | 0.14 | `0.26 + (0.14 − 0.26)·t` |
| `lift` (text shadow) | 0 | 0.55 | `0 + 0.55·t` |

Named settings: **Frosted 0 · Balanced 35 (default) · Light 70 · Clear 100**. When a stored value isn't exactly one of these, Settings shows the nearest name.

### Glass recipe (every `.glass` element)

- Background: white at `tint`
- `backdrop-filter: blur(blur) saturate(1.6)`
- Border: 1px white at `rim`
- Shadows:
  - inset `0 1px 0` white at `shine × 2` (top highlight)
  - inset `0 −1px 0` white at `shine × 0.4` (bottom edge)
  - outer `0 18px 40px` black 28%
- Sheen overlay: `linear-gradient(170deg, white at shine 0%, transparent 38%)`, following the element's corner radius
- Text on glass gets `text-shadow: 0 1px 12px black at lift`

### Dark glass

Same recipe, but the background is `rgba(16,16,20, tint + extra)`:

| Element | Extra |
|---|---|
| Home calendar widget | +0.34 |
| Screensaver weather card | +0.30 |
| Screensaver headlines card | +0.30 |
| Screensaver calendar card | +0.34 |

### Glass on app tiles

App tiles use the glass border, shadows and sheen but **no backdrop blur**. Their background is the app's own color, and the border is white at `rim × 0.9`.

### Fallback

If the WebView doesn't support `backdrop-filter`, glass shows as its tint over the picture with no blur, and the screensaver clock uses solid digits ([6.3](#63-frosted-clock)).

## 4. Type

- **Headline font:** Montserrat, weight 700, letter-spacing −0.01em (default). Variable `--display`.
- **Text font:** Roboto (default). Variable `--sans`.
- Changing the headline font changes `--display`, its weight and its letter-spacing together (see the font table below), and redraws the screensaver clock.

| Element | Font | Size | Weight | Other |
|---|---|---|---|---|
| Greeting line 1 | headline | 38 | headline weight | line-height 1.12, balanced wrapping, never truncated |
| Greeting line 2 | text | 21 (24 large) | 400 | line-height 1.3, white 82% |
| Tab pill labels | text | 19 | 500 | white 85%; active: focus fill + `#111` |
| Clock pill | text | 19 (22 large) | 400 | white 90%; weather part white 70% |
| Clock pill time | text | 22 | 600 | white |
| Hero app name | headline | 120 | headline weight | line-height 1 |
| Hero label ("App", "System", "Moving") | text | 16 | 400 | uppercase, letter-spacing 0.14em, white 78% |
| Hero caption | text | 18 | 400 | white 80% |
| Row label | text | 15 | 400 | uppercase, letter-spacing 0.14em, white 75% |
| Tile name (under focused tile) | text | 18 (21 large) | 400 | centered |
| System tile name | text | 20 | 500 | bottom-left in tile |
| Wordmark tiles | text | 50 (38 if > 8 chars) | 700 | letter-spacing −0.02em |
| Forecast day | text | 14 | 400 | uppercase, letter-spacing 0.12em, white 75% |
| Forecast high | text | 26 | 500 | tabular |
| Forecast low | text | 18 | 400 | white 65%, 6px left gap |
| Forecast conditions | text | 15 | 400 | white 75%, right-aligned |
| Calendar weekday | text | 15 | 700 | uppercase, letter-spacing 0.06em, `#FF453A` |
| Calendar date | text | 40 | 500 | line-height 0.9, tabular |
| Calendar group ("Today") | text | 13 | 700 | uppercase, letter-spacing 0.06em, white 60% |
| Calendar event title | text | 18 (20 large) | 500 | one line, ellipsis |
| Calendar event time | text | 15 | 400 | white 70%, tabular |
| "No more events today" | text | 16 | 400 | white 70% |
| Options panel eyebrow | text | 15 | 400 | uppercase, letter-spacing 0.14em, white 75% |
| Options panel title | headline | 64 | headline weight | |
| Options | text | 22 | 500 | |
| Options "Back to close" | text | 16 | 400 | white 65% |
| Screensaver date | text | 32 | 500 | text-shadow `0 2px 18px` black 45% |
| Screensaver clock | headline | 230 | 700 | letter-spacing −0.035em |
| Weather card city | text | 15 | 700 | letter-spacing 0.04em, white 75% |
| Weather card temperature | text | 64 | 400 | |
| Weather card conditions | text | 17 | 400 | |
| Weather card high/low | text | 15 | 400 | white 70% |
| Weather card day name | text | 13 | 700 | uppercase, letter-spacing 0.06em, white 65% |
| Weather card day value | text | 15 | 400 | |
| Headline topic | text | 14 | 700 | uppercase, letter-spacing 0.06em, white 70% |
| Headline | text | 26 | 500 | line-height 1.3 |
| "Headlines · 1 of 6" | text | 15 | 400 | white 65% |
| Settings title | headline | 60 | headline weight | |
| Settings category | text | 21 | 500 | |
| Settings detail title | headline | 42 | headline weight | |
| Settings lede | text | 17 | 400 | white 70% |
| Settings section label | text | 13 | 700 | uppercase, letter-spacing 0.1em, white 55% |
| Settings row label | text | 21 (24 large) | 500 | |
| Settings row subtitle | text | 15 (17 large) | 400 | white 62%; focused: black 55% |
| Settings row value | text | 19 | 500 | white 85%; focused: `#111` |
| Settings tip label | text | 13 | 400 | uppercase, letter-spacing 0.1em, white 60% |
| Settings tip text | text | 18 | 400 | line-height 1.4, white 88% |
| Settings toast | text | 17 | 400 | |

"(large)" is the size when Settings → Appearance → Text size is Large.

### Headline font options (Settings → Appearance → Headline font)

| Name | Font | Weight | Letter-spacing | Note shown |
|---|---|---|---|---|
| Host Grotesk | Host Grotesk | 600 | −0.025em | Closest to Apple's system feel: neutral, rounded, very readable from the couch. |
| Schibsted Grotesk | Schibsted Grotesk | 700 | −0.03em | Sturdier and a little editorial. Bold headlines with some character. |
| Hanken Grotesk | Hanken Grotesk | 600 | −0.02em | Light and geometric. Calm, airy, a bit Scandinavian. |
| Funnel | Funnel Display | 600 | −0.02em | Distinctive cuts in the display weight, plain text for everything else. |
| Red Hat | Red Hat Display | 700 | −0.02em | Friendly and wide. Very legible at TV distance. |
| SF Pro | system Apple font | 600 | −0.02em | Apple's system font… can't ship on the Fire TV. |
| **Montserrat** (default) | Montserrat | 700 | −0.01em | Wide, round and cinematic. Big impact for headlines; too wide for long text. |
| DIN-style (Barlow Condensed) | Barlow Condensed | 600 | 0 | Free stand-in for DIN (DIN Pro is a paid license): narrow, structured, broadcast feel. |
| Instrument (current) | Instrument Serif | 400 | 0 | What Griffin Home uses today, for comparison. |

### Text font options (Settings → Appearance → Text font)

| Name | Ships on TV? | Note shown |
|---|---|---|
| **Roboto** (default) | Yes | Android's own font and the Android TV guideline default. Free to ship. |
| Inter | Yes | Drawn for screens: tall lowercase, very clear at small sizes. Free to ship. |
| Helvetica Neue | No (paid) | Shown from your device's own copy… can't ship on the TV without buying one. |
| Open Sans | Yes | Open and friendly, a classic for long reading. Free to ship. |
| SF Pro | No | Shown from your Apple device; a stand-in elsewhere. Can't ship on the Fire TV (Apple-only license). |
| Fira Sans | Yes | Humanist with wide, open letter shapes that stay distinct on older 1080p TVs. Free to ship. |
| DIN-style (Barlow) | Yes | Free DIN look-alike: structured and slightly narrow, good for clocks, weather and dense info. Free to ship. |
| Verdana | No | Wide and roomy… Microsoft's license doesn't allow bundling it in an app. |

**For the TV build:** bundle only Montserrat and Roboto as `.woff2`, and offer only fonts that can ship. The other options exist in the mockup for comparison.

## 5. Picture and screen states

There is one full-screen **picture layer** under everything. The stage is in one of three states:

| State | Picture | What's on top |
|---|---|---|
| **Asleep** (screensaver) | Sharp, no filter | Screensaver content |
| **Awake** (Home) | `blur(homeBlur) brightness(0.72) saturate(1.25)`, scaled 1.08× | Home |
| **Awake + Settings** | `blur(homeBlur + 14px) brightness(0.58) saturate(1.2)` | Settings screen |

- **Home blur:** 0–48px; default 28. Settings choices: Light 12 · Medium 28 · Heavy 44. Shown as Light below 18, Medium below 34, Heavy otherwise.
- **Picture transitions:** filter and scale change over 900ms ease-out.
- **Drift:** the picture layer is 6% oversized on every side and slowly drifts: from `scale(1.02) translate(−1%, 0)` to `scale(1.08) translate(1.5%, −1%)`, 40s each way, ease-in-out, alternating forever. Off with reduced motion.
- **Shade** (Home only, hidden while asleep):
  - Normal: a bottom gradient (black at 55% opacity at the bottom edge, fading to clear 55% of the way up) plus a left gradient (black at 35% opacity at the left edge, fading to clear halfway across)
  - When focus is below the Favorites row: solid black 45%
  - Fades over 400ms
- **Placeholder scene** (until real pictures exist): a dusk sky gradient top→bottom `#0d1b33` 0%, `#2b3d63` 38%, `#c47a5a` 66%, `#f0b27a` 74%, `#2a2230` 75%, with two hill silhouettes:
  - back hill: `#1d1a2a`, 42% high
  - front hill: `#0f0d17`, 30% high
  - Each hill is a polygon clip-path; see `.scene .r1` and `.scene .r2` in the mockup.
- **Real pictures:** cover-fit, centered. Source, rotation interval and shuffle come from Settings → Pictures ([17](#pictures)).

## 6. Screensaver

### 6.1 Layout

| Element | Position | Size |
|---|---|---|
| Date | centered, top 92 | 32px text |
| Clock | centered, top 126 | 230px headline font, block 270 high |
| Cards row | left 72, right 72, bottom 60 | 18px gaps, cards stretch to equal height |
| Weather card | first | 330 wide, padding 20/24, radius 28, dark glass +0.30 |
| Calendar card | second | 380 wide (same widget as Home), dark glass +0.34 |
| Headlines card | third | fills the rest, padding 20/26, radius 28, dark glass +0.30 |

The screensaver has **no Wi-Fi icon, greeting or tab pill**.

### 6.2 Date and clock text

- **Date:** full weekday, full month, day, in the device locale. Example: "Tuesday, October 27".
- **Clock:** the time without AM/PM. 12-hour: "6:50"; 24-hour: "18:50". Follows Settings → Home → Clock.

### 6.3 Frosted clock

Drawn from three layers stacked in the same place, centered horizontally:

1. **Shadow:** black 16%, blurred 22px, offset 6px down.
2. **Frost:**
   - `backdrop-filter: blur(blur × 0.8 + 6px) saturate(1.8) brightness(1.18)`
   - background: linear-gradient 175°, white at `tint + 0.55` (0%) → `tint + 0.26` (55%) → `tint + 0.34` (100%)
3. **Highlight:** white 85%.

Each layer is masked to the digits' shape:

- **Fill mask:** draw the time in white on a canvas using the current headline font at 230px weight 700 with the clock's letter-spacing.
  - Canvas width = measured text width + 40; height = ceil(230 × 1.16).
  - Text at x = 20, baseline y = 230 × 0.94.
  - Used by the shadow and frost layers.
- **Highlight mask:** draw the same text, then erase (`destination-out`) the text again at x = 21, y = baseline + 3. That leaves a thin bright edge on the top and left of each glyph.
  - Tracing the glyph outline was tried and dropped: overlapping contours inside the font show up as seams.

Rules:

- Redraw only when the text or the font changes, and wait for the font to load first.
- **Solid style** (Settings → Screensaver → Clock style = Solid), or no `backdrop-filter` support: plain digits, white 90%, centered.
- The clock element's accessible label is the time.

### 6.4 Weather card

```
CHICAGO
54°
Partly Cloudy
H:58° L:44°
───────────────────────────
TUE            WED            THU
61° · Rain     55° · Cloudy   49° · Clear
```

- City in caps.
- Condition in title case. The 3-day row uses short condition words: Rain, Cloudy, Clear, Snow, Storms, Fog.
- A 1px white 15% divider above the days, with 10px above and below it.

### 6.5 Calendar card

The same widget as Home ([12.3](#123-calendar-widget)), rendered for the same time.

### 6.6 Headlines card

```
● TECH
Example headline: A new streaming stick promises faster menus and Wi-Fi 7
Headlines · 1 of 6
```

- An 8px dot in the topic color, then the topic name.
- The headline is 26px. The footer reads "Headlines · {n} of {total enabled}".
- Rotation: see [14](#14-news).

### 6.7 Waking and sleeping

- **Wake:** any remote button, or a click/tap on the screen in the mockup.
  - The screensaver content fades to 0 over 400ms and moves up 30px over 600ms ease-out.
  - The picture blurs ([5](#5-picture-and-screen-states)).
  - Home fades in over 450ms and scales from 1.03 to 1 over 600ms.
  - Focus is wherever it was before.
- **Sleep:**
  - **Triggers:** System → Screensaver → OK; Settings → Screensaver → Start now; the idle timer (Settings → Screensaver → Start after, on the TV).
  - **Closes:** the options panel and move mode.
  - **Animation:** the reverse of wake.
- While asleep, the screensaver content refreshes every 15s.

## 7. Home: top bar

A row at top 52, left/right 72, aligned to the top, 28px gaps:

1. **Greeting block:** grows to fill; two lines with a 10px gap ([11](#11-greeting)).
2. **Tab pill** (glass): 6px padding, 4px gaps, fully rounded. Items: **Home · Apps · Claude · Settings**, each with 12/26 padding. Home is shown active. Whether the tabs do anything is [open question 1](PLAN.md#open-questions); in the mockup they're display-only.
3. **Clock pill** (glass): 14/24 padding, 18px gaps, fully rounded, never wraps.
   - weather: "54° partly cloudy · Chicago" (white 70%)
   - date: full weekday, short month, day, for example "Tuesday, Oct 27"
   - time: 12- or 24-hour per settings; refreshes every 15s
   - Wi-Fi icon ([15](#15-wi-fi))

The tab pill and clock pill never shrink. The greeting takes the space that's left and wraps to two lines.

## 8. Home: hero and widgets

The hero is anchored to the **bottom**, 412px up from the bottom of the canvas, spanning left 72 to right 72. Left side: label, name, caption. Right side: widgets.

### 8.1 Left side

- **Label** (dot + text): shown only when it adds information.

| Focus | Label | Dot color |
|---|---|---|
| Favorites row | hidden | |
| All apps row | "APP" | the app's accent color |
| System row | "SYSTEM" | `#8C8A85` |
| Move mode | "MOVING" | the app's accent color |

- **Name:** the focused item's name, 120px.
- **Caption** (18px, white 80%, 16px above):

| Focus | Caption |
|---|---|
| App, not moving | empty |
| System tile | that tile's caption ([9.2](#92-system-tiles)) |
| Move mode | "◀ ▶ to move · OK when it's in place" |

When focus is on any row below Favorites, the hero fades out over 300ms.

### 8.2 Widgets

A row aligned to the bottom, 16px gap, both widgets the same height:

1. **Forecast:** three stacked glass rows, 270 wide, 10px gaps, together as tall as the calendar.
   - Each row: radius 20, padding 0/20, three columns (52px · 112px · rest).
   - Columns: day (TUE) · high and low ("61°" + "47°") · conditions (right-aligned, for example "light rain").
   - The next three days, not today.
2. **Calendar widget** ([12.3](#123-calendar-widget)). Hidden when Settings → Calendar → Show on Home is off.

## 9. Home: rows and tiles

### 9.1 Rows

| # | Label | Contents | Label in hero |
|---|---|---|---|
| 0 | FAVORITES | Favorites, in saved order | (none) |
| 1 | ALL APPS | Every app not in Favorites, A–Z on the TV (mockup: fixed order), minus hidden apps | APP |
| 2 | SYSTEM | Screensaver · Settings · TV settings · Amazon home | SYSTEM |

- **Default Favorites order** (first run): Netflix, YouTube, Apple TV, Peacock, HBO Max, Tubi, Claude. On the TV, keep only installed ones; same for All apps.
- **Rows container:** starts at top 520. Each row is 284 tall: label (15px, 18px below), then tiles, then room for the name under the focused tile. Left padding 72.
- **Vertical scroll:** row 0 → offset 0; row *r* > 0 → offset `r × 284 − 150`. Slides over 360ms ease-out.
- **Row fade:** rows more than one above the focused row fade to 0 (300ms). For example, on System, Favorites is hidden and All apps shows.
- **Horizontal scroll** (per row, remembered per row):
  - Visible width W = 1600 − 2×72 = 1456; *x* is the tile's left edge inside the row.
  - If `x − offset < 0` → `offset = x`.
  - If `x + tile width − offset > W` → `offset = x + tile width − W`.
  - Slides over 300ms ease-out. Tiles past the edges stay visible (they peek).
- **Focus memory:** each row remembers its own column. Moving up/down keeps the target row's last column (clamped to its length).

### 9.2 System tiles

| Tile | Caption | OK does |
|---|---|---|
| Screensaver | Gargantua, aerials and film stills, right now | Sleep (start screensaver) |
| Settings | Glass, wallpaper, home guard, hidden apps | Open Settings |
| TV settings | Fire OS settings: network, display, inputs | Open Fire OS settings |
| Amazon home | Amazon's home for 10 minutes: inputs, app library | Pause the home guard 10 minutes and open Amazon's home |

The Screensaver and Settings captions are out of date. For the build, use:
- **Screensaver:** "Clock, weather, calendar and headlines, right now"
- **Settings:** "Glass, pictures, screensaver, news, calendar"

System tiles are glass with the name bottom-left (20px/500) and no logo.

### 9.3 Tiles

- **Size:** 288×164, radius 30, gap 36, no shrinking.
- **App tile:**
  - background = app tile color ([2](#2-colors))
  - centered mark: logo 116×116 in the mark color, or a wordmark (50px bold; 38px if longer than 8 characters) in the mark color
- **Name under the tile:** centered 44–46px below the tile, 18px, shown only when focused (fades in over 200ms).
- **Focus:**
  - translateY −8px and scale 1.12
  - shadow: inset `0 1px 0` white 70% plus outer `0 28px 50px` black 45%
  - border white 70%
  - Transform and shadow animate over 260ms ease-out.
- **Focus light sweep:** on gaining focus, a diagonal highlight (115°, white 28% band at 48%) slides from −60% to +60% and fades out over 1.1s, once.
- **Unfocused tiles:** normal size; glass border and shadow.
- No tilt, parallax or hover effects (tried and dropped).

## 10. Options panel and move mode

### 10.1 Opening

Hold OK (or press ☰ on the TV) on an **app** tile. On a System tile, hold does nothing; OK runs the tile.

### 10.2 Panel

- A full-screen dim (black 25%) with the panel on the right.
- Panel: 540 wide, 28px margin, radius 40, padding 36/44, glass. Content is vertically centered.
- Entrance: fades over 220ms and slides from +40px over 280ms ease-out.
- Content, top to bottom:
  - eyebrow: the row's label ("FAVORITE" or "APP")
  - title: the app name, 64px headline font
  - options (12px gaps)
  - "Back to close"
- Options are pills (15/24 padding, 22px/500, white 8% background). The focused option has the focus fill, `#111` text and scale 1.03.
- Focus starts on the first option.

### 10.3 Options

| Row | Options | Effect |
|---|---|---|
| Favorites | **Open** | Close the panel and launch the app |
| | **Move** | Close the panel and enter move mode on this tile |
| | **Remove from Favorites** | Remove it, save, close, rebuild rows. The app reappears in All apps. Focus stays on the Favorites row, clamped to its new length. |
| All apps | **Open** | Close the panel and launch the app |
| | **Add to Favorites** | Append to the end of Favorites, save, close, rebuild, and move focus to Favorites on the new last tile |
| | **Hide** | Add to hidden apps, save, close, rebuild. The app leaves All apps; Settings → Home → Hidden apps brings it back. |

### 10.4 Move mode

- The focused tile wobbles: rotate −1.5° ↔ +1.5° while lifted and scaled, 240ms each way, ease-in-out, forever.
- Hero label "MOVING"; caption "◀ ▶ to move · OK when it's in place".
- **◀ / ▶** swaps the tile with its neighbor and focus follows it. Nothing happens at either end.
- **OK, Back or hold** ends move mode and saves the order.
- Up/down do nothing while moving.
- Sleeping also ends move mode, and the order is saved.

## 11. Greeting

Two lines, picked fresh each time Home is shown (on the TV: each time Griffin Home resumes). Neither line ever repeats the line it replaces. Pick at random up to 12 times until it differs.

**Time of day:** night before 5:00 · morning 5:00–11:59 · afternoon 12:00–16:59 · evening 17:00–21:59 · night from 22:00.

### 11.1 Line 1 (hello)

The pool is the time-of-day list, plus the everyday list, plus any extras that apply.

**Morning:** Good morning, Griffin · Morning, Griffin · Rise and shine, Griffin · Coffee and a show, Griffin? · Easy start today, Griffin? · Slow morning, Griffin? · Early start, Griffin? · Morning light, Griffin

**Afternoon:** Good afternoon, Griffin · Afternoon, Griffin · Back at it, Griffin · Taking a break, Griffin? · Midday reset, Griffin? · How's the day going, Griffin? · Afternoon off, Griffin? · Long day, Griffin?

**Evening:** Good evening, Griffin · Evening, Griffin · What are we watching, Griffin? · How was your day, Griffin? · Time to unwind, Griffin · Settle in, Griffin · Lights down, Griffin · Dinner and a show, Griffin? · Movie night, Griffin? · Feet up, Griffin

**Night:** Up late, Griffin? · Hey there, night owl · One more episode, Griffin? · Can't sleep, Griffin? · Burning the midnight oil, Griffin? · Late show, Griffin? · Still up, Griffin? · Quiet hours, Griffin · Midnight movie, Griffin?

**Everyday (always in the pool):** Welcome back, Griffin · Hey, Griffin · Good to see you, Griffin · Griffin returns · Happy {Weekday}, Griffin · Make yourself at home, Griffin · Pick something good, Griffin · There you are, Griffin · All yours, Griffin · What's it going to be, Griffin?

**Extras:**

| When | Added |
|---|---|
| Monday | Monday again, Griffin · New week, Griffin |
| Friday | Made it to Friday, Griffin · and either Friday night, Griffin (from 17:00) or Almost the weekend, Griffin (before 17:00) |
| Saturday or Sunday | Weekend mode, Griffin · Lazy {Weekday}, Griffin? · No alarms today, Griffin? |
| Sunday | Sunday reset, Griffin |
| October | Spooky season, Griffin |
| December | Cozy season, Griffin |
| Current conditions mention rain, drizzle, showers or thunder | Rainy one, Griffin |
| Current conditions mention snow | Snow day, Griffin? |
| Temperature below 32°F | Stay warm, Griffin |

Curly apostrophes are used throughout (How's, Can't, What's).

### 11.2 Line 2 (right now)

Build a list of everything that applies, then pick one at random. Some entries are added twice so they show up twice as often.

| Condition | Line | Weight |
|---|---|---|
| Always | {temp}° and {conditions} in Chicago | 1 |
| Tomorrow's conditions mention rain, snow, drizzle, showers or thunder | {Tomorrow's conditions, capitalized} tomorrow. Good couch weather. | 1 |
| Temperature below 40°F | Bundle up out there | 1 |
| 5:00–11:59 | Coffee first, then shows | 1 |
| 5:00–11:59 | Sunrise was a while ago. No rush. | 1 |
| 12:00–16:59 | Perfect time for a matinee | 1 |
| 12:00–16:59, before sunset | Sunset at {sunset} tonight | 1 |
| 17:00–21:59, before sunset | Sunset at {sunset}. Golden hour. | 1 |
| 17:00–21:59, after sunset | Dark since {sunset}. Prime time. | 1 |
| 17:00–21:59 | Prime time | 1 |
| 22:00–4:59 | It's {time}. One more, then bed? | 1 |
| 22:00–4:59 | The whole city's asleep | 1 |
| Monday–Thursday | {5 − weekday} days to the weekend ("1 day" on Thursday) | 1 |
| Friday before 17:00 | The weekend's almost here | 1 |
| Friday from 17:00 | Friday night. Nowhere to be tomorrow. | 1 |
| Saturday | Nothing on the calendar but this | 1 |
| Sunday | One more episode before Monday | 1 |
| October | Scary movie season | 1 |
| December | Peak holiday movie season | 1 |
| June–August | Summer nights in Chicago | 1 |
| Next timed event starts in 1–60 minutes | {title} in {n} minutes | 2 |
| Next timed event is today, 61–360 minutes away | {title} at {time} | 2 |
| Next timed event is tomorrow before noon, and it's 21:00–4:59 | {title} at {time} tomorrow. Maybe just one episode. | 1 |
| A holiday is 0–21 days away | Holiday line ([11.3](#113-holidays)) | 2 |

- {sunset} is today's sunset in 12-hour form without AM/PM, for example "5:52".
- {time} follows the 12/24-hour setting.
- Weekdays count Monday = 1.
- **Event lines:** only the first upcoming non-all-day event after now counts, from calendars that are switched on, and only if Settings → Home → Mention calendar events is on. "Minutes" is always plural in the mockup; use "1 minute" in the build.
- **Holiday lines:** only if Settings → Home → Holiday countdowns is on.
- Empty entries are dropped before picking.

### 11.3 Holidays

Checked in this order. The **first** one 0–21 days away wins:

1. Halloween: Oct 31
2. Christmas: Dec 25
3. New Year's Eve: Dec 31
4. Valentine's Day: Feb 14
5. the Fourth of July: Jul 4
6. Thanksgiving: the 4th Thursday of November, computed as `1 + ((4 − weekday(Nov 1) + 7) mod 7) + 21`

Days are whole calendar days from today (midnight to midnight).

| Days away | Line |
|---|---|
| 0 | Happy {name}! ("Happy Fourth of July!") |
| 1 | {Name} is tomorrow |
| 2–21 | {Name} in {n} days |

"the" is dropped only in the day-of line; elsewhere the first letter is capitalized ("The Fourth of July in 5 days").

### 11.4 Large text

Line 2 becomes 24px. Line 1 doesn't change.

## 12. Calendar

### 12.1 Data

- **Event:** start, end, title, calendar (one of Personal, Health, Errands, Sports, Holidays, or Griffin's real calendars), color, and an all-day flag.
- **Source:** Google Calendar, read-only ([PLAN](PLAN.md#how-each-piece-gets-built)). Refreshes every 15 minutes.
- **Mockup sample events** (placed relative to today):

| Event | When | Calendar |
|---|---|---|
| Dinner with Sam | Today 7:30 PM, 90 min | Personal |
| Dentist | Tomorrow 9:15 AM, 45 min | Errands |
| Gym | Tomorrow 6:00 PM, 60 min | Health |
| Movie night | In 2 days 8:00 PM, 120 min | Personal |
| Bears at Packers | Next Sunday (never today) 12:00 PM, 180 min | Sports |
| Halloween | Oct 31, all day (only if not past) | Holidays |

### 12.2 Which events show

1. Drop events that have already ended.
2. Drop events from calendars that are switched off.
3. Sort by start time.
4. Take the first 3.

### 12.3 Calendar widget

- 380 wide, padding 18/22/16, radius 28, dark glass, 9px gaps.
- **Header:** weekday in red caps + today's date number, baseline-aligned, 12px apart.
- **Events:** grouped by day under a label: "TODAY", "TOMORROW", or the weekday name for later days. A new label appears only when the day changes.
- **Event row:** two columns (5px · rest, 12px gap). The left column is a rounded bar in the calendar color as tall as the row. The right column has the title (one line, ellipsis), then the time range ("7:30 PM – 9:00 PM", 12/24-hour per setting) or "All day".
- **No events:** "No more events today".

## 13. Weather

- **Source:** Open-Meteo for Chicago (41.88, −87.63), no key. Refreshes every 10 minutes and is cached 15 minutes (existing `weather.js`).
- **Fields used:** current temperature, current conditions text, today's high/low, today's sunset, and the next 3 days' high/low/conditions.
- **Units:** °F. A °C setting exists but isn't wired in the mockup.
- **Condition words** (WMO code → text, from `weather.js`): clear · mostly clear · partly cloudy · overcast · fog · freezing fog · light drizzle · drizzle · heavy drizzle · freezing drizzle · light rain · rain · heavy rain · freezing rain · light snow · snow · heavy snow · snow grains · showers · heavy showers · snow showers · thunderstorms · thunderstorms, hail.
- **Mockup sample:** 54°, partly cloudy, H 58° L 44°, sunset 5:52 PM; Tue 61°/47° light rain; Wed 55°/40° overcast; Thu 49°/36° clear.

## 14. News

| Topic | Sources (confirm feeds in build) |
|---|---|
| Tech | The Verge, Ars Technica |
| AI | The Verge AI, MIT Technology Review |
| Sci-fi shows | Gizmodo, Den of Geek |
| Gaming | Polygon, IGN |
| Steam | Wishlist sales, top sellers (Steam store data; wishlist needs a public profile) |
| Chicago | Block Club Chicago, Sun-Times, WBEZ |

- **Rotation:** one headline at a time, cycling through enabled topics in the table's order.
  - Every 8s by default (Settings → News → Change headline: 8 / 15 / 30 seconds).
  - The headline fades out over 500ms, the next one is set, then it fades back in.
  - The footer shows its position among enabled topics.
- **All topics off:** the topic reads "HEADLINES", the headline reads "All topics are off. Turn some on in Settings → News." and the footer is empty.
- **Mockup headlines** (examples only):

| Topic | Headline |
|---|---|
| Tech | Example headline: A new streaming stick promises faster menus and Wi-Fi 7 |
| AI | Example headline: New open model runs fully on a laptop |
| Sci-fi shows | Example headline: A space drama gets a second season and a new trailer |
| Gaming | Example headline: A surprise indie hit tops this week's charts |
| Steam | Example: A city-builder you wishlisted is 60% off until Thursday |
| Chicago | Example headline: Lakefront Trail reopens after weekend repairs |

## 15. Wi-Fi

- Icon: 26×26, in the clock pill after the time (4px tighter gap). Three arcs plus a dot, white, stroke 2.4, round caps. Paths on a 24×24 viewBox:
  - outer arc: `M2.6 9.2a13.4 13.4 0 0 1 18.8 0`
  - middle arc: `M5.7 12.4a9 9 0 0 1 12.6 0`
  - inner arc: `M8.8 15.6a4.6 4.6 0 0 1 6.4 0`
  - dot: circle at (12, 19), r 1.7
  - slash (offline only): `M4 4l16 16`, stroke 2.2

| Level | Shown | Label |
|---|---|---|
| 3 | All arcs bright | Wi-Fi: strong signal |
| 2 | Outer arc dim (28%) | Wi-Fi: good signal |
| 1 | Outer and middle dim | Wi-Fi: weak signal |
| 0 | Everything dim + slash | Wi-Fi: not connected |

- **TV build:** not connected → 0, otherwise `WifiManager.calculateSignalLevel(rssi, 3) + 1`. Needs the `ACCESS_WIFI_STATE` permission. On Ethernet, show a cable icon instead.
- Hidden when Settings → Home → Wi-Fi indicator is off. Home only, never on the screensaver.

## 16. Settings screen

### 16.1 Layout

- **Title** "Settings": left 72, top 54, 60px headline font.
- **Category panel:** left 72, top 150, bottom 56, width 392, padding 14, radius 36, glass, 4px gaps.
  - Each category: a 30×30 rounded square (radius 9, inset top highlight) in its color, then the name (21px/500). Padding 12/18, fully rounded.
- **Detail panel:** left 492, right 72, top 54, bottom 56, padding 34/40, radius 40, glass.
  - Category title (42px headline font), then the lede (17px, white 70%, 6px above and 18px below).
  - Rows area: from 128px down to 30px from the bottom, clipped.
- **Entrance:** fades in and scales from 1.02 over 320ms ease-out. Home is hidden while Settings is open.

### 16.2 Rows

- **Row:** minimum 62 tall, padding 10/22, radius 22, white 7% background, 8px gaps. Label (+ optional colored 12px dot) and optional subtitle on the left, value on the right.
- **Section label:** small caps text between rows, 10px above, not focusable.
- **Tip card** (Home only, above the first row): "TIP" / "Hold OK on any app for options: open, move, remove from Favorites, or hide it." 14/20 padding, radius 20, white 10%.
- **Values:**
  - **Toggle:** a 54×32 switch with a 26px white knob. Off: white 25% track (black 20% on a focused row). On: `#30D158`, knob slides 22px. Animates over 200ms.
  - **Choice:** ‹ value ›. The chevrons show (55%) only on the focused row.
  - **Action:** a value text ("Mac", "›", "▶", "Connected", …) or nothing.
- **Focused row:** focus fill, `#111` text, scale 1.01.
- **Category states:** the focused category (left pane active) gets the focus fill. The current category while the right pane is active gets white 14%.
- **Scrolling:** if the focused row's bottom is below the visible area, slide the rows up so it sits 8px above the bottom. Otherwise the offset is 0. 260ms ease-out.
- **Toast:** actions handled elsewhere show a message at the bottom of the detail panel. Black 45%, radius 18, 17px. Fades and rises in over 250ms and stays 2.6s.

### 16.3 Behavior

- Opening Settings always starts on the first category (Home) with the left pane active.
- Each change saves immediately and applies right away ([17](#17-settings-every-row)).
- Changing category resets the row focus to the first row.

## 17. Settings: every row

Types: **T** toggle, **C** choice (values in order, OK and ▶ go forward, ◀ goes back, wrapping around), **A** action.

### Home
Lede: "The home screen, greeting and apps." Tip card shown.

| Row | Type | Subtitle | Values / value | Default | Effect |
|---|---|---|---|---|---|
| Wi-Fi indicator | T | Signal strength next to the clock | | On | Show/hide the Wi-Fi icon |
| Clock | C | | 12-hour, 24-hour | 12-hour | Clock pill, screensaver clock, calendar times, greeting times |
| *Greeting* | section | | | | |
| Mention calendar events | T | "Dinner with Sam in 40 minutes" | | On | Event lines in greeting line 2 |
| Holiday countdowns | T | "Halloween in 4 days" | | On | Holiday lines in greeting line 2 |
| *Apps* | section | | | | |
| Hidden apps | A | Bring hidden apps back to All apps | count, or "None" | | Unhide all; toast "{n} apps back in All apps" or "No hidden apps right now" |
| Reset Favorites | A | Back to the original order | | | Favorites = default list; toast "Favorites reset" |

### Appearance
Lede: "Glass, blur and type. Changes show right away."

| Row | Type | Subtitle | Values | Default | Effect |
|---|---|---|---|---|---|
| Glass | C | Frosted is easiest to read; Clear shows the most picture | Frosted, Balanced, Light, Clear | Balanced | [3](#3-glass) |
| Home blur | C | How much the picture blurs behind Home | Light, Medium, Heavy | Medium | [5](#5-picture-and-screen-states) |
| Headline font | C | Greeting, app names, clock | [font table](#headline-font-options-settings--appearance--headline-font) | Montserrat | Changes `--display`, weight, spacing; redraws the clock |
| Text font | C | Menus, widgets, everything else | [font table](#text-font-options-settings--appearance--text-font) | Roboto | Changes `--sans` |
| Text size | C | | Default, Large | Default | Large sizes in [4](#4-type) |

### Pictures
Lede: "What fills the screensaver and Home. Your background redo lands here."

| Row | Type | Subtitle | Values | Default |
|---|---|---|---|---|
| Show | C | | Your pictures, Film stills, Apple aerials, All of them | Your pictures |
| Change picture | C | | Every 5 minutes, 15 minutes, Every hour, Once a day | 15 minutes |
| Shuffle | T | Random order instead of in sequence | | On |
| Add pictures | A, "Mac" | From your Mac with scripts/stills.sh | | toast "Add pictures from your Mac: ./scripts/stills.sh" |

On the TV, the picture changes on that interval with a slow crossfade (a few seconds), on both the screensaver and Home.

### Screensaver
Lede: "Clock, weather, calendar and headlines over your picture."

| Row | Type | Subtitle | Values | Default | Effect |
|---|---|---|---|---|---|
| Start now | A, "▶" | | | | Close Settings and sleep |
| Start after | C | Idle time before it comes on | 5 minutes, 10 minutes, 15 minutes, 30 minutes, Never | 10 minutes | Idle timer (TV) |
| Clock style | C | | Glass, Solid | Glass | [6.3](#63-frosted-clock) |
| *Show* | section | | | | |
| Weather | T | | | On | Weather card |
| Calendar | T | | | On | Calendar card |
| Headlines | T | Topics are in News | | On | Headlines card |
| Gargantua | T | Add the black hole as a scene | | Off | Include the existing Gargantua screen in the picture rotation (TV) |

Hidden cards leave the remaining cards in order; the headlines card still fills whatever space is left.

### News
Lede: "Headlines on the screensaver. One at a time, from free feeds."

Six toggles with colored dots, all on by default:

| Row | Subtitle |
|---|---|
| Tech | The Verge, Ars Technica |
| AI | The Verge AI, MIT Technology Review |
| Sci-fi shows | Gizmodo, Den of Geek |
| Gaming | Polygon, IGN |
| Steam | Wishlist sales, top sellers |
| Chicago | Block Club, Sun-Times, WBEZ |

Then:

| Row | Type | Values | Default |
|---|---|---|---|
| Change headline | C | 8 seconds, 15 seconds, 30 seconds | 8 seconds |

### Calendar
Lede: "From Google Calendar. Read-only: add events on your phone."

| Row | Type | Subtitle | Value | Default | Effect |
|---|---|---|---|---|---|
| Google Calendar | A | (account) · signs in with a code on your phone; mockup: "Example account · signs in with a code on your phone" | Connected / Not connected | | Sign-in flow (TV); mockup toast "In the real build: a code to enter at google.com/device" |
| Show on Home | T | | | On | Home calendar widget |
| *Calendars* | section | | | | |
| Personal, Health, Errands, Sports, Holidays | T with dot | | | On | Filters the widget, the screensaver card and greeting event lines |

On the TV, list Griffin's actual calendars with their Google colors.

### Weather
Lede: "From Open-Meteo. No account needed."

| Row | Type | Value | Default | Effect |
|---|---|---|---|---|
| Location | A | Chicago, IL | | toast "Location is set from the Mac for now" |
| Units | C | °F, °C | °F | All temperatures |

### Network
Lede: "Your connection."

| Row | Type | Subtitle | Value | Effect |
|---|---|---|---|---|
| Wi-Fi | A | mockup: "Example network name" | the network name; mockup "Home-5G" | none |
| Signal | A | | Not connected / Weak / Good / Strong | none |
| Network settings | A | Opens Fire OS network settings | › | Open Fire OS network settings (mockup toast "Opens Fire OS network settings") |

### TV & system
Lede: "Fire OS, the home guard and cleanup. Everything here is reversible."

| Row | Type | Subtitle | Values / value | Default | Effect |
|---|---|---|---|---|---|
| Home guard | T | The Home button comes here instead of Amazon's home | | On | Existing `setGuardOn` bridge |
| Animation speed | C | | 0.5x, 1.0x, Off | 0.5x | Existing `setAnim` bridge |
| Ads & tracking | A | 17 Amazon apps disabled · 3 protected by Fire OS | Cleaned | | toast "Managed from the Mac: scripts/debloat.sh" |
| TV settings | A | Display, inputs, sound | › | | Open Fire OS settings (mockup toast "Opens Fire OS settings") |
| Amazon home | A | For 10 minutes: inputs, app library | › | | Existing `amazonHome` bridge (mockup toast "Opens Amazon's home for 10 minutes") |
| Restore everything | A | Re-enable apps, stock animations, Amazon home | Mac | | toast "Run ./scripts/restore.sh on your Mac" |

### About
Lede: "Griffin Home on your TCL 55S450F."

| Row | Value |
|---|---|
| Griffin Home | app version (mockup: "Mockup") |
| Fire OS | 7.7.1.7 |
| TV | TCL 55S450F |

## 18. Remote input

### 18.1 Keys

| Remote | Mockup keyboard | Name |
|---|---|---|
| D-pad | Arrow keys | up, down, left, right |
| Select, tap | Enter | ok |
| Select, held ≥ 550ms | H | hold |
| Back | Esc | back |
| ☰ Menu | (none) | menu (same as hold on app tiles) |

**Hold detection (TV, from PR #1):**
- OK fires on **release**, not press, so a long press can be hold.
- While OK is down with key repeats, once 550ms have passed since the press, send hold once.
- On release, send ok only if hold wasn't sent.
- A release without a matching press (for example, the press went to the home guard's cover) is ignored.

### 18.2 What each key does

| Screen | up / down | left / right | ok | hold / menu | back |
|---|---|---|---|---|---|
| Screensaver | Wake | Wake | Wake | Wake | Wake |
| Home | Change row (clamped) | Change column (clamped) | App: launch. Screensaver: sleep. Settings: open Settings. TV settings / Amazon home: run. | App: open options. System: nothing. | Jump to Favorites, first tile |
| Options panel | Move focus (clamped) | nothing | Run option | nothing | Close panel |
| Move mode | nothing | Swap with neighbor | Done | Done | Done |
| Settings, categories | Change category (clamped), row reset to 0 | right: enter rows | Enter rows | nothing | Close Settings → Home |
| Settings, rows | Move row (clamped) | Choice row: change value (◀ back, ▶ forward). Other rows: left returns to categories, right does nothing. | Toggle / next value / run action | nothing | Return to categories |

In the mockup, clicking a tile focuses it, clicking an option runs it, clicking a category selects it, and clicking a row runs it.

## 19. Timers and animation

| What | Value |
|---|---|
| Clock pill refresh | every 15s |
| Screensaver refresh (date, clock, cards) | every 15s while asleep |
| Headline rotation | every 8s (setting), 500ms fade |
| Weather refresh | every 10 min, cache 15 min |
| Calendar refresh (TV) | every 15 min |
| Picture drift | 40s each way |
| Picture blur/zoom change | 900ms ease-out |
| Screensaver content out | 400ms fade, 600ms ease-out move |
| Home in | 450ms fade, 600ms ease-out scale |
| Hero fade (scrolling down) | 300ms |
| Shade change | 400ms |
| Rows vertical | 360ms ease-out |
| Row horizontal | 300ms ease-out |
| Row fade | 300ms |
| Tile focus | 260ms ease-out |
| Focus light sweep | 1.1s, once |
| Tile name fade | 200ms |
| Move-mode wobble | 240ms each way |
| Options panel | 220ms fade, 280ms slide |
| Option focus | 150ms color, 200ms scale |
| Settings entrance | 320ms |
| Settings row focus | 150ms color, 180ms scale |
| Settings rows scroll | 260ms |
| Switch | 200ms |
| Toast | 250ms in/out, shown 2.6s |
| Wi-Fi level change | 200ms |

**Reduced motion:** no drift, no light sweep, no tile transitions, and instant picture/screen transitions.

## 20. Saved state

| Key (mockup localStorage) | Holds | Default |
|---|---|---|
| `glass` | Glass value 0–100 | 35 |
| `font2` | Headline font index | Montserrat |
| `uiFont2` | Text font index | Roboto |
| `prefs1` | All other settings (below) | below |

`prefs1`:

```json
{
  "clock24": false, "wifi": true, "greetCal": true, "greetCountdown": true, "textSize": "Default",
  "picSource": "Your pictures", "picEvery": "15 minutes", "picShuffle": true,
  "saverAfter": "10 minutes", "clockStyle": "Glass", "svWeather": true, "svCal": true, "svNews": true, "gargantua": false,
  "news": { "Tech": true, "AI": true, "Sci-fi shows": true, "Gaming": true, "Steam": true, "Chicago": true },
  "newsEvery": "8 seconds",
  "calHome": true,
  "cals": { "personal": true, "health": true, "errands": true, "sports": true, "holidays": true },
  "units": "°F", "homeGuard": true, "anim": "0.5x"
}
```

**TV build:**
- Also save Favorites order, hidden apps and Home blur, which the mockup doesn't persist.
- Both the Home WebView and the screensaver must read the same values. Same-process localStorage works; `SharedPreferences` via the bridge is safer.
- Home guard and animation speed live in Android settings, as today. Read them rather than storing copies.

## 21. Mockup-only and not yet wired

**Mockup scaffolding (don't build):**
- The controls below the TV: remote pad, Type picker, Glass slider, Pictures upload, Home blur slider, greeting time preview, "Shuffle greeting", "Show screensaver".
- Clicking the Wi-Fi icon to cycle levels.
- The page title and intro text.

**Sample data to replace with real data:**
- weather (all numbers and words, including the clock pill's "54° partly cloudy · Chicago")
- calendar events
- headlines
- Wi-Fi network name and signal
- Google account
- the app list (fixed in the mockup; installed apps on the TV)
- the "Griffin Home" version

**Settings that are saved but don't do anything in the mockup:**
- Pictures: Show, Change picture, Shuffle
- Screensaver: Start after, Gargantua
- News: Change headline (rotation stays at 8s)
- Weather: Units (temperatures stay °F)
- TV & system: Home guard, Animation speed

**Mockup shortcuts the build should do properly:**
- **Open** in the options panel only closes the panel; it should launch the app.
- **Hide** only closes the panel; it should hide the app and update Settings → Hidden apps (which always says "None" in the mockup).
- **TV settings** and **Amazon home** tiles do nothing on OK; they should call the existing bridges.
- **"{n} minutes":** use "1 minute" when n is 1.
- **Screensaver weather card** uses fixed text; build it from live data.
- **Tab pill** is decorative ([open question 1](PLAN.md#open-questions)).
- **Unused code:** `openSettings()`, the earlier Settings panel sketch, is still in the mockup and isn't called.
