// window.live: calendar, headlines and Wi-Fi for Home and the screensaver, kept fresh and cached.
// Needs data.js, ical.js, feeds.js and steam.js loaded first.
//
//   live.start(opts)      Call once. Shows cached data at once, then refreshes: calendar every
//                         15 min, news and Steam every 30 min, Wi-Fi every 30s.
//                         opts: {wifi: false} to skip Wi-Fi polling (the screensaver),
//                               {calendars: 'Name|#color|url\n…'} to test in a desktop browser.
//   live.onchange = fn    fn(kind) after new data: 'calendar', 'news' or 'wifi'.
//   live.refresh(kind)    Refresh now: 'calendar', 'news', or both when left out. → Promise
//
//   live.events(now)      Upcoming events (not yet ended), sorted by start, next 14 days:
//                         [{start: Date, end: Date, title, cal, calName, color, allDay, uid, location}]
//                         `cal` is the calendar's key for prefs.cals (its name in lower case).
//                         The mockup's events() is: live.events(now).filter(e => prefs.cals[e.cal] !== false)
//   live.calendars()      [{name, key, color}] from calendars.txt, for Settings → Calendar.
//
//   live.topics()         [{src, color, items: [{src, color, hl, link, at}]}], SPEC §14 order,
//                         up to 5 newest per topic. Topics with nothing fetched yet have no items.
//   live.headlines()      The same items in one flat list.
//   live.headline(step, enabled)
//                         The headline card for rotation step 0, 1, 2…: cycles the enabled topics
//                         in order, then each topic's next item. enabled is prefs.news.
//                         → {src, color, hl, link, at, pos, total} ("Headlines · {pos} of {total}"),
//                           null when every topic is off, or {src: 'Headlines', hl: '', total: 0}
//                           while nothing has loaded.
//
//   live.wifi()           0 offline, 1–3 Wi-Fi strength, 4 Ethernet, -1 unknown.
//   live.wifiName()       Network name, or '' when Android hides it.
//   live.status()         {calendarAt, newsAt}: when each was last fetched (ms), 0 if never.
//
// Cache (window.Store / localStorage, via data.save): 'live.calendar' and 'live.news'.
// Home and the screensaver share it, so whichever page refreshed last feeds the other.
(function () {
  var MIN = 60 * 1000;
  var CAL_EVERY = 15 * MIN, NEWS_EVERY = 30 * MIN, WIFI_EVERY = 30 * 1000, TICK = MIN;
  var CAL_KEY = 'live.calendar', NEWS_KEY = 'live.news';

  var opts = {}, started = false, busy = {};
  var cals = [];                         // [{name, key, color}]
  var cal = { at: 0, byKey: {} };        // byKey[key] = [event with start/end as ms]
  var feed = { at: 0, topics: {} };      // topics[name] = [headline]
  var upcoming = [];                     // every cached event, as Dates, sorted
  var level = -1, ssid = '';

  function emit(kind) {
    if (typeof live.onchange === 'function') {
      try { live.onchange(kind); } catch (e) { setTimeout(function () { throw e; }); }
    }
  }

  // ---- Calendar ----

  function configText() {
    if (opts.calendars != null) return opts.calendars;
    try { return window.Data && Data.calendars ? Data.calendars() : null; } catch (e) { return null; }
  }

  function rebuild() {
    var colors = {};
    cals.forEach(function (c) { colors[c.key] = c; });
    upcoming = [];
    Object.keys(cal.byKey).forEach(function (k) {
      cal.byKey[k].forEach(function (e) {
        var c = colors[k], o = {};
        for (var f in e) o[f] = e[f];
        o.start = new Date(e.start);
        o.end = new Date(e.end);
        if (c) { o.color = c.color; o.calName = c.name; }  // colors can change in calendars.txt
        upcoming.push(o);
      });
    });
    upcoming.sort(function (a, b) { return a.start - b.start || a.end - b.end; });
  }

  function refreshCalendar() {
    var text = configText();
    if (text == null || busy.cal) return Promise.resolve();
    busy.cal = true;
    cals = ical.config(text);
    var now = Date.now(), byKey = {};
    return Promise.all(cals.map(function (c) {
      return data.get(c.url).then(function (ics) {
        if (!/BEGIN:VCALENDAR/i.test(ics)) throw new Error('not a calendar');
        byKey[c.key] = ical.events(ics, { from: now, days: 14, name: c.name, key: c.key, color: c.color })
          .map(function (e) { var o = {}; for (var f in e) o[f] = e[f]; o.start = +e.start; o.end = +e.end; return o; });
      }).catch(function () {
        if (cal.byKey[c.key]) byKey[c.key] = cal.byKey[c.key];  // offline: keep the last copy
      });
    })).then(function () {
      cal = { at: now, byKey: byKey, cals: cals.map(function (c) { return { name: c.name, key: c.key, color: c.color }; }) };
      data.save(CAL_KEY, cal);
      rebuild();
      busy.cal = false;
      emit('calendar');
    });
  }

  // ---- News ----

  function topicItems(t, now) {
    if (t.name === 'Steam') return data.get(steam.URL).then(function (json) { return steam.headlines(json, now); });
    return Promise.all(t.feeds.map(function (url) {
      return data.get(url).then(function (xml) { return feeds.parse(xml); }).catch(function () { return null; });
    })).then(function (lists) {
      var ok = lists.filter(function (l) { return l && l.length; });
      if (!ok.length) throw new Error('no feeds');
      return feeds.newest([].concat.apply([], ok), 5).map(function (it) { return feeds.headline(t, it); });
    });
  }

  function refreshNews() {
    if (busy.news) return Promise.resolve();
    busy.news = true;
    var now = Date.now(), topics = {};
    return Promise.all(feeds.TOPICS.map(function (t) {
      return topicItems(t, now).then(function (items) {
        if (items.length) topics[t.name] = items;
        else if (feed.topics[t.name]) topics[t.name] = feed.topics[t.name];
      }, function () {
        if (feed.topics[t.name]) topics[t.name] = feed.topics[t.name];
      });
    })).then(function () {
      feed = { at: now, topics: topics };
      data.save(NEWS_KEY, feed);
      busy.news = false;
      emit('news');
    });
  }

  function topics() {
    return feeds.TOPICS.map(function (t) {
      return { src: t.name, color: t.color, items: (feed.topics[t.name] || []).slice() };
    });
  }

  function headline(step, enabled) {
    var on = feeds.TOPICS.filter(function (t) { return !enabled || enabled[t.name] !== false; });
    if (!on.length) return null;
    var list = on.filter(function (t) { return feed.topics[t.name] && feed.topics[t.name].length; });
    if (!list.length) return { src: 'Headlines', color: '#FFFFFF', hl: '', link: '', at: 0, pos: 0, total: 0 };
    step = Math.max(0, step | 0);
    var t = list[step % list.length], items = feed.topics[t.name], h = items[Math.floor(step / list.length) % items.length];
    return { src: h.src, color: h.color, hl: h.hl, link: h.link, at: h.at, pos: step % list.length + 1, total: list.length };
  }

  // ---- Wi-Fi ----

  function pollWifi() {
    var l = -1, n = '';
    try {
      if (window.Data && Data.network) { l = Data.network(); n = l > 0 && l < 4 && Data.wifiName ? Data.wifiName() : ''; }
      else l = navigator.onLine ? 3 : 0;
    } catch (e) {}
    if (l !== level || n !== ssid) { level = l; ssid = n; emit('wifi'); }
  }

  // ---- Running ----

  // Pick up what the other page (Home or the screensaver) fetched since we last looked.
  function loadCache() {
    var c = data.load(CAL_KEY), f = data.load(NEWS_KEY), changed = [];
    if (c && c.at > cal.at && c.byKey) {
      cal = c;
      if (c.cals && !cals.length) cals = c.cals;
      rebuild();
      changed.push('calendar');
    }
    if (f && f.at > feed.at && f.topics) { feed = f; changed.push('news'); }
    return changed;
  }

  function tick() {
    loadCache().forEach(emit);
    var now = Date.now();
    if (now - cal.at >= CAL_EVERY) refreshCalendar();
    if (now - feed.at >= NEWS_EVERY) refreshNews();
  }

  function start(o) {
    if (started) return;
    started = true;
    opts = o || {};
    if (opts.onchange) live.onchange = opts.onchange;
    var text = configText();
    if (text != null) cals = ical.config(text).map(function (c) { return { name: c.name, key: c.key, color: c.color }; });
    loadCache().forEach(emit);
    tick();
    setInterval(tick, TICK);
    if (opts.wifi !== false) { pollWifi(); setInterval(pollWifi, WIFI_EVERY); }
  }

  function refresh(kind) {
    return Promise.all([
      kind && kind !== 'calendar' ? null : refreshCalendar(),
      kind && kind !== 'news' ? null : refreshNews()
    ]);
  }

  var live = window.live = {
    start: start,
    refresh: refresh,
    onchange: null,
    events: function (now) {
      var t = now ? +now : Date.now();
      return upcoming.filter(function (e) { return e.end > t || (+e.end === +e.start && e.start >= t); });
    },
    calendars: function () { return cals.map(function (c) { return { name: c.name, key: c.key, color: c.color }; }); },
    topics: topics,
    headlines: function () { return [].concat.apply([], topics().map(function (t) { return t.items; })); },
    headline: headline,
    wifi: function () { return level; },
    wifiName: function () { return ssid; },
    status: function () { return { calendarAt: cal.at, newsAt: feed.at }; }
  };
})();
