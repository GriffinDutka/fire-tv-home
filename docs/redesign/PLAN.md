# Griffin Home redesign: plan and handoff

Planning only. Nothing here changes the TV yet. This is the brief for building the redesign on the Mac.

- **Mockup:** [`mockup.html`](mockup.html). Open it in a browser and drive it with the arrow keys, Enter (OK), H (hold OK) and Esc (Back). It opens on the screensaver; any key wakes it to Home.
- **Screens:** [`screens/`](screens/)

| Screensaver | Home | Options | Settings |
|---|---|---|---|
| ![](screens/1-screensaver.png) | ![](screens/2-home.png) | ![](screens/3-options.png) | ![](screens/4-settings.png) |

## Decisions

| Area | Decision |
|---|---|
| Look | Apple-style "Liquid Glass": translucent panels with blur, a bright rim and a top highlight. One **Glass** setting (Frosted · Balanced · Light · Clear) moves blur, tint and rim together; text gets a soft shadow as the glass clears. |
| Fonts | **Montserrat** for headlines (greeting, app name, clock, titles) and **Roboto** for everything else. Both are free to bundle. SF Pro, Helvetica Neue, Verdana and DIN Pro can't ship on the TV (licenses). |
| Pictures | The same picture is **sharp on the screensaver** and **blurred, dimmed and slightly zoomed behind Home**, like an iPhone lock screen/home screen pair. Pictures come from a background redo Griffin will supply later. |
| Screensaver | Date and a **frosted-glass clock** (the picture shows through the digits), then three glass cards: weather, calendar, one headline at a time. Any button blurs it into Home. |
| Home: top | Two-line greeting (Montserrat hello, Roboto line about right now), tab pill, clock pill with weather, date, time and **Wi-Fi**. |
| Home: right | 3-day forecast stacked as slim rows, Apple-style **calendar** widget to its right. |
| Home: rows | Favorites → All apps → System. Bigger tiles with the apps' real icons; the focused tile lifts and grows. No "Favorite" label above the app name, and no "hold OK" hint on Home (it lives in Settings). Rows that scroll up under the greeting fade out. |
| Options | Hold OK (or ☰) on an app: Open, Move (tile wobbles, ◀ ▶ to reorder), Remove from Favorites / Add to Favorites, Hide. |
| Settings | Full tvOS-style screen: categories left, settings right, all remote-driven. See [Settings](#settings). |
| Kept from today | Every existing greeting line, Chicago weather, the home guard, debloat/restore scripts. |

## Greeting

Line 1 is a hello picked from about 45 lines: the originals plus day, weekend, season and weather lines ("Made it to Friday, Griffin", "Spooky season, Griffin", "Rainy one, Griffin"). It wraps to two lines and is never truncated.

Line 2 is one true thing about right now, picked at random from what applies:

- Weather now, and "Light rain tomorrow. Good couch weather." when it applies
- Sunset ("Sunset at 5:52. Golden hour." / "Dark since 5:52. Prime time.")
- Weekend countdown, Friday night, Saturday, Sunday lines
- Late night ("It's 11:50 PM. One more, then bed?")
- Next calendar event: "Dinner with Sam at 7:30 PM", "… in 40 minutes", or "Dentist at 9:15 AM tomorrow. Maybe just one episode." late at night
- Holiday countdowns within 3 weeks (Halloween, Thanksgiving, Christmas, New Year's Eve, Valentine's Day, the Fourth). These are weighted double.

The full lists and logic are in `mockup.html` (`hellos()`, `subs()`, `holiday()`).

## Settings

| Category | Settings |
|---|---|
| Home | Tip card (hold OK for options) · Wi-Fi indicator · 12/24-hour clock · greeting mentions calendar events · holiday countdowns · hidden apps · reset Favorites |
| Appearance | Glass · Home blur · headline font · text font · text size |
| Pictures | Show (your pictures / film stills / Apple aerials / all) · change every · shuffle · add pictures (from the Mac) |
| Screensaver | Start now · start after · clock style (glass / solid) · show weather / calendar / headlines · Gargantua as an optional scene |
| News | Tech · AI · Sci-fi shows · Gaming · Steam · Chicago · how often headlines change |
| Calendar | Google Calendar connection · show on Home · each calendar on/off |
| Weather | Location · °F/°C |
| Network | Wi-Fi name · signal · Fire OS network settings |
| TV & system | Home guard · animation speed · ads & tracking · TV settings · Amazon home · restore everything |
| About | Griffin Home version · Fire OS · TV model |

Keys: up/down moves, right/OK enters a category, OK flips a switch or runs an action, ◀ ▶ changes a choice, Back goes up a level.

## How each piece gets built

All of this extends the existing app in `launcher/`: the WebView pages in `assets/` plus the small Java shell. The mockup's HTML/CSS/JS is written to carry over to `index.html` and `screensaver.html`.

| Piece | How |
|---|---|
| Glass | CSS `backdrop-filter`. **Test first:** the TV's WebView must support it and stay smooth. Fallback: solid tinted panels, solid clock. |
| Frosted clock | The time is drawn into canvas masks (fill and top-edge highlight) over a `backdrop-filter` layer. Same support check as above. |
| Screensaver → Home blur | Today Home (`MainActivity`) and the screensaver (`Gargantua` DreamService) are separate windows. Either blur the current picture behind Home in the WebView (simple), or show the screensaver inside `MainActivity` so the transition is one continuous animation (closer to the iPhone). Decide after the WebView test. |
| App icons | Each installed app's own banner or icon, read from Android's PackageManager and cached as PNGs. Draft PR #1 already has this (`MainActivity.icon()`), plus the full app list, Favorites storage, hold-OK detection and `ScreensaverActivity`. Reuse it. |
| Fonts | Bundle Montserrat and Roboto as `.woff2` in `assets/fonts/` (both are open licenses). |
| Weather | Existing Open-Meteo call in `weather.js`, extended to a 3-day forecast (also in PR #1). |
| Calendar | Start with Google Calendar's **secret iCal address**, kept in a gitignored config file on the Mac and pushed by the install script. The TV fetches it every 15 minutes. Later option: Google sign-in on the TV with a code entered on the phone. Read-only. |
| News | Free RSS feeds, one headline at a time. Candidates (confirm each feed): Tech: The Verge, Ars Technica · AI: The Verge AI, MIT Technology Review · Sci-fi shows: Gizmodo, Den of Geek · Gaming: Polygon, IGN · Chicago: Block Club Chicago, Sun-Times, WBEZ. |
| Steam | Steam store data: wishlist sales (needs Griffin's public Steam profile), top sellers, new releases. |
| Wi-Fi | `WifiManager` signal level, with the `ACCESS_WIFI_STATE` permission (no ADB grant needed). Show a cable icon on Ethernet. |
| Settings | Saved in the app; the screensaver reads the same values. Home guard and animation speed reuse today's bridges. |

## Build order

1. **WebView check on the TV:** WebView version, `backdrop-filter` support, and frame rate with 3–4 glass panels over a 4K picture.
2. **Fonts and glass:** bundle the fonts and restyle the existing Home with the glass panels and Glass setting.
3. **Home layout:** rows, real icons, options panel and Favorites (port from PR #1); greeting v2; forecast and calendar widgets; Wi-Fi.
4. **Screensaver v2:** picture, frosted clock, weather, calendar and headline cards; blur into Home.
5. **Settings screen.**
6. **Data:** Google Calendar (iCal address), news feeds, Steam.
7. **Pictures:** once the background redo is ready.

## Parked (roadmap)

- Background and scene redo (Griffin is supplying pictures). Decide then whether Gargantua and the Apple aerials stay as optional scenes.
- Curated recommendations.
- Recently watched and Up next (app usage plus what's playing, kept on the TV).
- Claude in a browser on the TV, with voice input (phone as the mic first, then the TV's own).

## Notes

- Example data in the mockup: the calendar events, headlines, Wi-Fi network name and Google account are made up. Weather is a sample, not live.
- App logos in the mockup come from [Simple Icons](https://simpleicons.org) (CC0). The TV build uses each app's own icon instead.
