// window.ical: Google Calendar's private iCal (.ics) feed → events for the next 14 days.
//   ical.config(text)       calendars.txt ("Name|#color|url" per line) → [{name, key, color, url}]
//   ical.events(ics, opts)  → [{start, end, title, cal, calName, color, allDay, uid, location}], sorted
//                             opts: {from: Date (now), days: 14, name, key, color}
// The event shape matches the mockup's calendar: start/end are Dates, cal is the key Settings
// switches on and off (prefs.cals[cal]), all-day events run local midnight → next midnight.
// Repeats (RRULE) are expanded in the event's own time zone, so a 9 AM weekly meeting stays at
// 9 AM across a DST change. Named zones (TZID=America/Chicago) convert with Intl.
(function () {
  var DAY = 864e5;
  var WEEKDAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  // Outlook-made calendars use Windows zone names.
  var WINDOWS_ZONES = {
    'Central Standard Time': 'America/Chicago', 'Eastern Standard Time': 'America/New_York',
    'Mountain Standard Time': 'America/Denver', 'US Mountain Standard Time': 'America/Phoenix',
    'Pacific Standard Time': 'America/Los_Angeles', 'Alaskan Standard Time': 'America/Anchorage',
    'Hawaiian Standard Time': 'Pacific/Honolulu', 'GMT Standard Time': 'Europe/London',
    'W. Europe Standard Time': 'Europe/Berlin', 'Romance Standard Time': 'Europe/Paris',
    'Coordinated Universal Time': 'UTC'
  };
  var MAX_PERIODS = 20000;

  // ---- Calendars config ----

  function config(text) {
    var out = [];
    String(text || '').split(/\r?\n/).forEach(function (l) {
      l = l.trim();
      if (!l || l.charAt(0) === '#' || l.indexOf('|') < 0) return;
      var a = l.indexOf('|'), b = l.indexOf('|', a + 1);
      if (b < 0) return;
      var name = l.slice(0, a).trim(), url = l.slice(b + 1).trim();
      if (!name || !url) return;
      out.push({ name: name, key: name.toLowerCase(), color: l.slice(a + 1, b).trim() || '#0A84FF', url: url });
    });
    return out;
  }

  // ---- Reading the file ----

  // Continuation lines start with a space or tab; join them back first.
  function unfold(text) {
    return String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '');
  }

  // "DTSTART;TZID=America/Chicago:20261026T090000" → {name, params, value}
  function contentLine(s) {
    var i = 0, quoted = false;
    for (; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch === '"') quoted = !quoted;
      else if (ch === ':' && !quoted) break;
    }
    var head = s.slice(0, i).split(';'), params = {};
    for (var k = 1; k < head.length; k++) {
      var eq = head[k].indexOf('=');
      if (eq > 0) params[head[k].slice(0, eq).toUpperCase()] = head[k].slice(eq + 1).replace(/^"|"$/g, '');
    }
    return { name: head[0].toUpperCase(), params: params, value: s.slice(i + 1) };
  }

  // Every top-level VEVENT as {NAME: [line, …]}. Alarms inside events are skipped.
  function vevents(text) {
    var out = [], ev = null, skip = 0;
    unfold(text).split('\n').forEach(function (raw) {
      if (!raw) return;
      var l = contentLine(raw), v = l.value.toUpperCase();
      if (l.name === 'BEGIN') {
        if (v === 'VEVENT' && !ev) ev = {};
        else if (ev) skip++;
        return;
      }
      if (l.name === 'END') {
        if (ev && skip) skip--;
        else if (ev && v === 'VEVENT') { out.push(ev); ev = null; }
        return;
      }
      if (ev && !skip) (ev[l.name] = ev[l.name] || []).push(l);
    });
    return out;
  }

  function first(ev, name) { return ev[name] ? ev[name][0] : null; }

  function text(s) {
    return String(s || '').replace(/\\([nN])/g, '\n').replace(/\\([,;\\])/g, '$1').trim();
  }

  // ---- Time zones ----

  var formats = {};
  function format(tz) {
    return formats[tz] || (formats[tz] = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric'
    }));
  }

  function zone(tzid) {
    if (!tzid) return 'local';
    tzid = WINDOWS_ZONES[tzid] || tzid;
    if (/^(UTC|GMT|Z|Etc\/UTC)$/i.test(tzid)) return 'UTC';
    // Some apps prefix the name, e.g. "/mozilla.org/20050126_1/America/Chicago".
    var m = /([A-Za-z_]+\/[A-Za-z_+\-0-9]+(?:\/[A-Za-z_\-]+)?)$/.exec(tzid);
    if (m) tzid = m[1];
    try { format(tzid); return tzid; } catch (e) { return 'local'; }
  }

  // Times are handled as "wall" values: the clock reading in some zone, written as if it were UTC.
  function wallOf(ms, tz) {
    if (tz === 'UTC') return ms;
    if (tz === 'local') {
      var d = new Date(ms);
      return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
    }
    var p = {};
    format(tz).formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return Date.UTC(+p.year, p.month - 1, +p.day, p.hour % 24, +p.minute, +p.second);
  }

  function msOf(wall, tz) {
    if (tz === 'UTC') return wall;
    var w = new Date(wall);
    if (tz === 'local') {
      return new Date(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate(),
        w.getUTCHours(), w.getUTCMinutes(), w.getUTCSeconds()).getTime();
    }
    // Guess the offset, then correct it once in case the guess landed across a DST change.
    var o1 = wallOf(wall, tz) - wall, t = wall - o1, o2 = wallOf(t, tz) - t;
    return o1 === o2 ? t : wall - o2;
  }

  // ---- Values ----

  // A DTSTART-style property → {wall, tz, date} or null.
  function when(prop, tzOverride) {
    if (!prop) return null;
    var m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/.exec(prop.value.trim());
    if (!m) return null;
    var date = !m[4] || (prop.params.VALUE || '').toUpperCase() === 'DATE';
    var wall = Date.UTC(+m[1], m[2] - 1, +m[3], date ? 0 : +m[4], date ? 0 : +m[5], date ? 0 : +(m[6] || 0));
    var tz = date ? 'local' : m[7] ? 'UTC' : zone(prop.params.TZID || tzOverride);
    return { wall: wall, tz: tz, date: date };
  }

  // Comma lists (EXDATE, RDATE) → [{wall, tz, date}]
  function whenList(props) {
    var out = [];
    (props || []).forEach(function (p) {
      p.value.split(',').forEach(function (v) {
        if (v.indexOf('/') >= 0) v = v.split('/')[0];  // RDATE periods: just the start
        var w = when({ params: p.params, value: v });
        if (w) out.push(w);
      });
    });
    return out;
  }

  // "PT1H30M", "P1D", "-PT15M" → ms
  function duration(s) {
    var m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(s).trim());
    if (!m) return 0;
    var ms = (((+m[2] || 0) * 7 + (+m[3] || 0)) * 24 * 3600 + (+m[4] || 0) * 3600 + (+m[5] || 0) * 60 + (+m[6] || 0)) * 1000;
    return m[1] === '-' ? -ms : ms;
  }

  function rule(value) {
    var r = { interval: 1, wkst: 1 };
    value.split(';').forEach(function (part) {
      var kv = part.split('='), k = kv[0].toUpperCase(), v = (kv[1] || '').toUpperCase();
      if (k === 'FREQ') r.freq = v;
      else if (k === 'INTERVAL') r.interval = Math.max(1, parseInt(v, 10) || 1);
      else if (k === 'COUNT') r.count = parseInt(v, 10);
      else if (k === 'UNTIL') r.until = v;
      else if (k === 'WKST' && v in WEEKDAYS) r.wkst = WEEKDAYS[v];
      else if (k === 'BYDAY') {
        r.byday = v.split(',').map(function (d) {
          var m = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(d.trim());
          return m && { n: m[1] ? parseInt(m[1], 10) : 0, wd: WEEKDAYS[m[2]] };
        }).filter(Boolean);
      } else if (k === 'BYMONTHDAY' || k === 'BYMONTH' || k === 'BYSETPOS') {
        r[k.toLowerCase()] = v.split(',').map(function (n) { return parseInt(n, 10); }).filter(function (n) { return n; });
      }
    });
    return r;
  }

  // ---- Repeats ----

  function dayNum(y, m, d) { return Date.UTC(y, m, d) / DAY; }
  function ymd(dn) { var d = new Date(dn * DAY); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() }; }
  function weekday(dn) { return ((dn % 7) + 11) % 7; }  // day 0 (1970-01-01) was a Thursday
  function monthDays(y, m) { return new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); }

  // Days in month m (or the whole year when m is null) matching one BYDAY entry, e.g. 2MO or -1FR.
  function weekdaysIn(y, m, bd) {
    var from = m == null ? dayNum(y, 0, 1) : dayNum(y, m, 1);
    var to = m == null ? dayNum(y + 1, 0, 1) : dayNum(y, m + 1, 1);
    var all = [];
    for (var dn = from + ((bd.wd - weekday(from) + 7) % 7); dn < to; dn += 7) all.push(dn);
    if (!bd.n) return all;
    var pick = bd.n > 0 ? all[bd.n - 1] : all[all.length + bd.n];
    return pick == null ? [] : [pick];
  }

  // Candidate days for one month of a MONTHLY/YEARLY rule.
  function monthCandidates(y, m, r, d0) {
    var len = monthDays(y, m), days = [];
    if (r.bymonthday) {
      r.bymonthday.forEach(function (n) {
        var d = n > 0 ? n : len + n + 1;
        if (d >= 1 && d <= len) days.push(dayNum(y, m, d));
      });
      if (r.byday) days = days.filter(function (dn) { return r.byday.some(function (b) { return b.wd === weekday(dn); }); });
    } else if (r.byday) {
      r.byday.forEach(function (b) { days = days.concat(weekdaysIn(y, m, b)); });
    } else if (d0 <= len) {
      days.push(dayNum(y, m, d0));
    }
    return days;
  }

  // Days for period k of the rule, sorted, before BYSETPOS.
  function period(r, k, start) {
    var dn0 = Math.floor(start / DAY), s = ymd(dn0), days;
    if (r.freq === 'DAILY') {
      days = [dn0 + k * r.interval];
    } else if (r.freq === 'WEEKLY') {
      var ws = dn0 - ((weekday(dn0) - r.wkst + 7) % 7) + 7 * k * r.interval;
      days = (r.byday || [{ wd: weekday(dn0) }]).map(function (b) { return ws + ((b.wd - r.wkst + 7) % 7); });
    } else if (r.freq === 'MONTHLY') {
      var mm = s.m + k * r.interval;
      days = monthCandidates(s.y + Math.floor(mm / 12), ((mm % 12) + 12) % 12, r, s.d);
    } else {  // YEARLY
      var y = s.y + k * r.interval;
      days = [];
      if (!r.bymonth && r.byday && !r.bymonthday) {
        r.byday.forEach(function (b) { days = days.concat(weekdaysIn(y, null, b)); });
      } else {
        (r.bymonth || [s.m + 1]).forEach(function (mo) { days = days.concat(monthCandidates(y, mo - 1, r, s.d)); });
      }
    }
    // BYxxx entries that narrow DAILY/WEEKLY.
    if (r.bymonth && r.freq !== 'YEARLY') days = days.filter(function (dn) { return r.bymonth.indexOf(ymd(dn).m + 1) >= 0; });
    if (r.freq === 'DAILY' && r.byday) days = days.filter(function (dn) { return r.byday.some(function (b) { return b.wd === weekday(dn); }); });
    if ((r.freq === 'DAILY' || r.freq === 'WEEKLY') && r.bymonthday) {
      days = days.filter(function (dn) { var x = ymd(dn); return r.bymonthday.some(function (n) { return n > 0 ? n === x.d : monthDays(x.y, x.m) + n + 1 === x.d; }); });
    }
    days.sort(function (a, b) { return a - b; });
    days = days.filter(function (dn, i) { return dn !== days[i - 1]; });
    if (r.bysetpos) {
      days = r.bysetpos.map(function (p) { return p > 0 ? days[p - 1] : days[days.length + p]; })
        .filter(function (x) { return x != null; }).sort(function (a, b) { return a - b; });
    }
    return days;
  }

  // Periods we can safely skip when there's no COUNT to keep track of.
  function skipTo(r, start, fromWall) {
    var a = ymd(Math.floor(start / DAY)), b = ymd(Math.floor(fromWall / DAY)), n;
    if (r.freq === 'DAILY') n = (fromWall - start) / DAY;
    else if (r.freq === 'WEEKLY') n = (fromWall - start) / (7 * DAY);
    else if (r.freq === 'MONTHLY') n = (b.y - a.y) * 12 + (b.m - a.m);
    else n = b.y - a.y;
    return Math.max(0, Math.floor(n / r.interval) - 1);
  }

  // Wall start times of every occurrence up to toWall. DTSTART is always the first one.
  function occurrences(start, r, fromWall, toWall, untilWall) {
    var out = [start], tod = start - Math.floor(start / DAY) * DAY, count = 1;
    if (!/^(DAILY|WEEKLY|MONTHLY|YEARLY)$/.test(r.freq || '')) return out;
    var k = r.count ? 0 : skipTo(r, start, fromWall);
    for (var guard = 0; guard < MAX_PERIODS; guard++, k++) {
      var days = period(r, k, start);
      for (var i = 0; i < days.length; i++) {
        var w = days[i] * DAY + tod;
        if (w <= start) continue;
        if (w > toWall || (untilWall != null && w > untilWall)) return out;
        if (r.count && count >= r.count) return out;
        count++;
        out.push(w);
      }
      // Stop once a whole period lies past the window (an empty month just moves on).
      if (r.freq === 'YEARLY' ? ymd(Math.floor(start / DAY)).y + k * r.interval > ymd(Math.floor(toWall / DAY)).y
        : days.length && days[0] * DAY > toWall) return out;
    }
    return out;
  }

  // ---- Events ----

  function events(ics, opts) {
    opts = opts || {};
    var from = opts.from ? +opts.from : Date.now();
    var to = from + (opts.days || 14) * DAY;
    var all = vevents(ics), out = [], overrides = {};

    all.forEach(function (ev) {
      var rid = first(ev, 'RECURRENCE-ID'), uid = first(ev, 'UID');
      if (rid && uid) (overrides[uid.value] = overrides[uid.value] || []).push(ev);
    });

    function emit(ev, startMs, endMs, allDay) {
      if (!(endMs > from || (endMs === startMs && startMs >= from)) || startMs >= to) return;
      var uid = first(ev, 'UID'), loc = first(ev, 'LOCATION');
      out.push({
        start: new Date(startMs), end: new Date(endMs),
        title: text((first(ev, 'SUMMARY') || {}).value) || '(No title)',
        cal: opts.key || (opts.name || '').toLowerCase(), calName: opts.name || '', color: opts.color || '#0A84FF',
        allDay: allDay, uid: uid ? uid.value : '', location: loc ? text(loc.value) : ''
      });
    }

    function cancelled(ev) { var s = first(ev, 'STATUS'); return s && s.value.trim().toUpperCase() === 'CANCELLED'; }

    all.forEach(function (ev) {
      var start = when(first(ev, 'DTSTART'));
      if (!start) return;
      var endProp = first(ev, 'DTEND'), durProp = first(ev, 'DURATION'), end = when(endProp);
      // Same zone: keep the length in wall time (an hour-long meeting is an hour on the clock).
      var span = end && end.tz === start.tz ? end.wall - start.wall
        : end ? msOf(end.wall, end.tz) - msOf(start.wall, start.tz)
        : durProp ? duration(durProp.value) : start.date ? DAY : 0;
      var wallSpan = !end || end.tz === start.tz;
      function endOf(wall, startMs) { return wallSpan ? msOf(wall + span, start.tz) : startMs + span; }

      if (first(ev, 'RECURRENCE-ID')) {  // one changed occurrence of a repeating event
        if (!cancelled(ev)) { var s1 = msOf(start.wall, start.tz); emit(ev, s1, endOf(start.wall, s1), start.date); }
        return;
      }
      if (cancelled(ev)) return;

      var rr = first(ev, 'RRULE'), uid = first(ev, 'UID');
      if (!rr) { var s0 = msOf(start.wall, start.tz); emit(ev, s0, endOf(start.wall, s0), start.date); return; }

      // Skip EXDATEs and occurrences replaced by a RECURRENCE-ID event (compared as instants,
      // or by day for all-day events).
      var skipMs = {}, skipDay = {};
      function skip(w) {
        if (w.date) skipDay[Math.floor(w.wall / DAY)] = 1;
        else skipMs[msOf(w.wall, w.tz)] = 1;
      }
      whenList(ev.EXDATE).forEach(skip);
      if (uid && overrides[uid.value]) overrides[uid.value].forEach(function (o) {
        var w = when(first(o, 'RECURRENCE-ID'), first(ev, 'DTSTART').params.TZID);
        if (w) skip(w);
      });

      var r = rule(rr.value), untilWall = null;
      if (r.until) {
        var u = when({ params: {}, value: r.until });
        if (u) untilWall = u.date ? u.wall + DAY - 1000 : u.tz === 'UTC' ? wallOf(u.wall, start.tz) : u.wall;
      }
      var fromWall = wallOf(from, start.tz) - Math.max(span, 0) - DAY, toWall = wallOf(to, start.tz) + DAY;
      var walls = occurrences(start.wall, r, fromWall, toWall, untilWall);
      whenList(ev.RDATE).forEach(function (w) {
        walls.push(w.tz === start.tz ? w.wall : wallOf(msOf(w.wall, w.tz), start.tz));
      });

      walls.forEach(function (w) {
        if (w + Math.max(span, 0) < fromWall || w > toWall) return;
        var sMs = msOf(w, start.tz);
        if (start.date ? skipDay[Math.floor(w / DAY)] : skipMs[sMs] || skipDay[Math.floor(w / DAY)]) return;
        emit(ev, sMs, endOf(w, sMs), start.date);
      });
    });

    return out.sort(function (a, b) { return a.start - b.start || a.end - b.end; });
  }

  var api = { config: config, events: events, unfold: unfold, zone: zone, msOf: msOf, wallOf: wallOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.ical = api;
})();
