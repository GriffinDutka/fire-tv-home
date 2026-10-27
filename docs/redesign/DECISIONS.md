# Griffin Home redesign: decision log

How the redesign was worked out, in order: what Griffin asked for, what was decided, and why. Use it to understand the reasoning behind [`SPEC.md`](SPEC.md), or to revisit a decision.

Sessions: the redesign was planned in one Claude Code session on 2026-10-26 and 27. Earlier sessions built the MVP (debloat, Griffin Home, home guard, Gargantua screensaver, film stills, Apple aerials).

---

## 0. Starting point

**Ask:** "Expand on the home dashboard, screensaver, shortcuts to favorites," with Apple's design site as the reference.

**What happened:** Claude went straight to building. That became draft **PR #1** (`claude/home-favorites-screensaver`, commit `4508f6e`):
- a Favorites row and the full app list with real banners
- hold-OK options
- a film-still backdrop
- a 3-day forecast
- a screensaver you can start from Home, with on/off toggles per mode

**Decision:** Griffin said "we are just planning." All later work is planning: mockups plus a handoff doc for building on the Mac. PR #1 stays open as a source of working code to reuse, not as the plan.

**Later:** Griffin merged PR #1 into `main` on 2026-10-27. The redesign now builds on top of it rather than porting from a branch.

**Why it matters:** PR #1 already solves several hard parts on the TV (installed apps and their icons, hold detection, starting the screensaver on demand). [`BUILD.md`](BUILD.md) builds on them instead of rewriting them.

## 1. Claude on the TV with voice

**Ask:** "A web browser lowkey so I could access Claude Code and make edits directly via voice input."

**Findings:**
- Silk is still installed (the debloat list doesn't touch it), so a tile that opens claude.ai/code is easy.
- Voice is the hard part. The remote's mic is Alexa's, and apps can't record from it. Fire OS has no Google speech recognition.
- Code edits still need a rebuild from the Mac.

**Options:**

| Option | Verdict |
|---|---|
| A. Phone as the mic and keyboard | Recommended first |
| B. Alexa dictation into a text box | Unknown; test first |
| C. Griffin Home's own mic plus a speech-to-text API | Later |

**Decision:** parked on the roadmap. Griffin confirmed the plan is a handoff doc for building on the Mac, not editing from the TV.

## 2. Look: Liquid Glass with a dial

**Ask:** "Something clean in terms of Apple's OS, including a glass dial with more or less up until near transparent, with the matching background."

**Decision:** Apple's Liquid Glass look (iOS/tvOS 26):
- translucent panels with blur, a bright rim and a top highlight
- one **Glass** control from Frosted to Clear that moves blur, tint, rim and text shadow together ([SPEC §3](SPEC.md#3-glass))

**Why one control:** Apple offers Clear vs. Tinted. A single continuous dial is easy to use from a remote. Text shadow grows as the glass clears so text stays readable.

**Risk noted:** the TV's WebView may not support `backdrop-filter`, or may run it slowly. That's the first test in the build, with a solid fallback.

## 3. Work style: one part at a time, with visuals

**Ask:** "Focus on each part and get a visual."

**Decision:** each part became a live mockup (a private claude.ai artifact) that was changed step by step. The final version is [`mockup.html`](mockup.html).

## 4. Wallpapers

**Ask:** use the wallpapers chosen in earlier chats.

**Findings:**
- GitHub had only the lists: `stills/films.txt` (Tron: Legacy, American Psycho, Interstellar, Blade Runner 2049, Drive, Dune, Fight Club, The Dark Knight) and `stills/aerials.txt` (New York Night, North America Aurora, Korea and Japan Night, Africa Night, Hong Kong, Dubai, Iceland, Greenland).
- The images themselves are deliberately gitignored.

**Decision (first):** stand-in color gradients named after those picks.
**Later decision (§13):** remove them. Griffin will redo backgrounds with his own pictures.

## 5. Keep the greeting

**Ask:** "I like how it says welcome back Griffin and other things too, don't want to lose that."

**Decision:** every existing greeting line stays. The pool was expanded later (§10).

## 6. Watch history and recommendations

**Ask:** does the TV know what I watch, or what I watched recently?

**Findings:**
- **Apps used:** yes, through Android's usage stats (one ADB permission).
- **Titles:** partly, from apps that report what's playing, saved going forward.
- **Not possible:** watch history inside each app, and Amazon's Recents row.

**Ask:** curated recommendations, "spitballs for later."

**Decision:** both parked on the roadmap. Focus on UI and Home.

## 7. App icons

**Ask:** "I want the actual new icons for the apps."

**Findings:** the App Store and Google Play image servers were blocked from the planning environment. Simple Icons (CC0 brand marks) was reachable.

**Decision:**
- **Mockup:** real logos on each app's own colors. Wordmarks for apps without a mark (Peacock, Pluto TV, Prime Video, Crossy Road, Fawesome).
- **On the TV:** use each installed app's own icon or banner. It's always current and needs no bundled logos.

**Open:** banner (wide artwork) vs. logo on color ([PLAN open question 2](PLAN.md#open-questions)).

## 8. Bigger tiles; animation tried and dropped

**Ask:** "A bit larger, and can we animate them when I hover?"

**Tried:** tiles about 20% bigger, plus a tvOS-style parallax tilt (tilt toward the pointer, logo floating above, moving glare, idle sway on the TV).

**Ask:** "Remove that but increase size of icons, the actual N or Apple TV."

**Decision:**
- No tilt, sway, glare or float.
- Logo marks up about 35% (116px).
- Long wordmarks step down to 38px so they fit.
- Focus is lift and scale only ([SPEC §9.3](SPEC.md#93-tiles)).

## 9. Fonts

**Ask:** change the font. Instrument Serif was "the most AI slop choice you could have made."

**Steps:**
1. A picker with Host Grotesk, Schibsted Grotesk, Hanken Grotesk, Funnel and Red Hat.
2. Griffin asked to see Roboto, Inter, Helvetica Neue, Open Sans and Verdana for everyday UI, navigation and subtitles. The picker split into **headlines** and **everyday text** rows, with a subtitle preview.
3. Griffin added SF Pro, Fira Sans, Montserrat and DIN.

**Constraint applied:** SF Pro, Helvetica Neue, Verdana and DIN Pro can't legally ship in the app. Barlow stands in for DIN.

**Decision (Griffin's pick):** **Montserrat** for headlines, **Roboto** for everything else. Roboto is Android's own font, and both are free to bundle.

**Note:** subtitles inside Netflix and other apps are styled by those apps or Fire OS, not by Griffin Home.

## 10. Greeting: two lines, more variety

**Ask:** don't truncate the welcome message; maybe two lines; more variety.

**Decision:**
- Line 1 is a hello that wraps to two lines and is never truncated. The pool grew to about 45 lines, with day, weekend, season and weather extras.
- Line 2 is a second, smaller line with something true about right now: weather, sunset, weekend countdown, late night, the next calendar event, holiday countdowns.
- Holiday and event lines are weighted double because they're the most fun to see ([SPEC §11](SPEC.md#11-greeting)).

## 11. Calendar

**Ask:** "Odds I could add Google Calendar events? Make it more like the Apple calendar."

**Decision:**
- An Apple "Up Next"-style widget: red weekday, big date, the next 3 events grouped by day with calendar-color bars.
- The greeting mentions the next event when it's soon.
- **Source:** start with Google Calendar's private iCal address. Later option: sign in on the TV with a code entered on the phone. Read-only either way.

**Why iCal first:** no Google developer project and no sign-in screen on the TV.
**Trade-off:** the link must be kept secret, and recurring events need expanding ([BUILD phase 7](BUILD.md#phase-7-live-data)).

## 12. Widget layout

**Ask:** "Move calendar to the right and stack the 3-day forecast."

**Decision:** the forecast became three slim stacked rows the same height as the calendar, with the calendar on the far right.

**Fix found along the way:** the top section was re-anchored to the bottom so taller widgets never overlap the Favorites row.

## 13. Screensaver redo

**Ask:** remove the background showing. Redo the screensaver with time, calendar, weather, maybe news. "I want the screensaver to be clear and blur when opened to Home Screen."

**Decision:**
- One picture used twice: sharp on the screensaver, then blurred, dimmed and slightly zoomed behind Home. This is the iPhone lock screen/home screen pairing.
- The screensaver has a big clock with the date, then glass cards for weather, calendar and one headline at a time.
- Stand-in wallpapers removed; a plain placeholder scene shows until Griffin's pictures arrive.

**Claude's recommendations, accepted by default:**
- calm news, one headline at a time, with a switch to turn it off
- slow picture rotation with crossfades
- Gargantua kept only as an optional scene
- small drift to protect the screen, even though the TV is LCD

## 14. News topics

**Ask:** "Tech news, AI, sci-fi shows, gaming, Steam, Chicago news." Backgrounds will be redone later.

**Decision:**
- Those six topics, each with a color, a free feed source and a switch.
- Steam uses store data (wishlist sales, top sellers).
- Background decisions, including the fate of Gargantua and the aerials, wait for the redo.

## 15. Frosted clock

**Ask:** "Can we frost the time on the screensaver? Match the rest."

**Decision:** the digits are glass: the picture shows through them blurred and brightened, with a soft shadow and a top-edge highlight. It follows the Glass setting.

**Problem found and fixed:** tracing the glyph outline left spikes where the font's shapes overlap. The highlight is instead "the glyphs minus themselves shifted 3px down" ([SPEC §6.3](SPEC.md#63-frosted-clock)).

## 16. Small Home cleanups

- **"Remove Favorite above app name, it's known":** the label shows only for All apps, System and move mode.
- **"Place hold-for-options in Settings so you know to do it":** removed from Home and added as a Tip card at the top of Settings → Home.
- **"Can we put a wifi signal?":** an icon in the clock pill with 3 levels plus offline. Griffin agreed with keeping it on Home only.

## 17. Settings

**Ask:** "Do Settings next."

**Decision:** a full tvOS-style screen with categories on the left and settings on the right, all remote-driven, in 10 categories: Home, Appearance, Pictures, Screensaver, News, Calendar, Weather, Network, TV & system, About. Changes apply right away.

**Fixes found along the way:**
- Rows that scroll up under the greeting now fade out.
- Hover-to-focus was removed from the mockup: rows sliding under a resting pointer stole focus.
- Hidden labels are now hidden with a CSS rule, so they stay hidden when the file is opened outside the artifact viewer.

## 18. Handoff

**Ask:** open a PR. Then: does it have everything? Then: "add every single little aspect including the logic." Then: "thought processes and full build from here to reproduce?"

**Result:** PR #2 with:

| File | What it holds |
|---|---|
| [`PLAN.md`](PLAN.md) | Decisions, build order, open questions, roadmap |
| [`SPEC.md`](SPEC.md) | Every value, string and rule, checked against the mockup's code |
| [`DECISIONS.md`](DECISIONS.md) | This file |
| [`BUILD.md`](BUILD.md) | Step-by-step build on the Mac |
| [`mockup.html`](mockup.html) | The interactive mockup |
| [`screens/`](screens/) | Screenshots |
| [`tools/screenshots.js`](tools/screenshots.js) | Regenerates the screenshots |
