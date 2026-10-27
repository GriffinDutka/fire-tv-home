// Calendar: which events show and the Up Next widget, shared by Home and the screensaver (SPEC §12).
//   calendar.calendars()            [{key, name, color}] for Settings → Calendar
//   calendar.events(now, prefs)     upcoming events from switched-on calendars, sorted by start
//   calendar.render(el, now, prefs) fills a .cal element
(function () {
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Sample calendars and events, placed around today, until live data exists.
  var SAMPLE_CALS = [
    { key: 'personal', name: 'Personal', color: '#0A84FF' },
    { key: 'health', name: 'Health', color: '#30D158' },
    { key: 'errands', name: 'Errands', color: '#FF9F0A' },
    { key: 'sports', name: 'Sports', color: '#64D2FF' },
    { key: 'holidays', name: 'Holidays', color: '#BF5AF2' }
  ];
  function colorOf(key) { var c = calendars(); for (var i = 0; i < c.length; i++) if (c[i].key === key) return c[i].color; return '#8E8E93'; }

  function sample(now) {
    var y = now.getFullYear(), base = new Date(y, now.getMonth(), now.getDate());
    function on(days, h, m, mins, title, cal) {
      var s = new Date(base); s.setDate(base.getDate() + days); s.setHours(h, m, 0, 0);
      return { start: s, end: new Date(+s + mins * 6e4), title: title, cal: cal };
    }
    var sunday = (7 - base.getDay()) % 7 || 7;
    var list = [
      on(0, 19, 30, 90, 'Dinner with Sam', 'personal'),
      on(1, 9, 15, 45, 'Dentist', 'errands'),
      on(1, 18, 0, 60, 'Gym', 'health'),
      on(2, 20, 0, 120, 'Movie night', 'personal'),
      on(sunday, 12, 0, 180, 'Bears at Packers', 'sports')
    ];
    var hw = new Date(y, 9, 31);
    if (hw >= base) list.push({ start: hw, end: new Date(y, 10, 1), title: 'Halloween', cal: 'holidays', allDay: true });
    return list;
  }

  // LIVE DATA SEAM (phase 7): set window.liveData.calendars = [{key, name, color}] and
  // window.liveData.events = [{start, end, title, cal, color?, allDay?}] (start/end: ms, ISO string or Date;
  // cal: a calendars() key). Then document.dispatchEvent(new Event('livedata')) to redraw.
  function calendars() { var L = window.liveData; return (L && L.calendars) || SAMPLE_CALS; }
  function source(now) { var L = window.liveData; return (L && L.events) || sample(now); }

  function events(now, prefs) {
    var cals = (prefs && prefs.cals) || {};
    return source(now).map(function (e) {
      return { start: new Date(e.start), end: new Date(e.end), title: e.title, cal: e.cal, color: e.color || colorOf(e.cal), allDay: !!e.allDay };
    }).filter(function (e) { return e.end > now && cals[e.cal] !== false; })
      .sort(function (a, b) { return a.start - b.start; });
  }

  function dayLabel(d, now) {
    var a = new Date(now.getFullYear(), now.getMonth(), now.getDate()), b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var n = Math.round((b - a) / 864e5);
    return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : DAYS[d.getDay()];
  }

  function render(el, now, prefs) {
    var h24 = prefs && prefs.clock24;
    var list = events(now, prefs).slice(0, 3), last = '';
    el.innerHTML = '<div class="head"><span class="dow"></span><span class="num"></span></div>';
    el.querySelector('.dow').textContent = DAYS[now.getDay()];
    el.querySelector('.num').textContent = now.getDate();
    if (!list.length) { var n = document.createElement('div'); n.className = 'none'; n.textContent = 'No more events today'; el.appendChild(n); }
    list.forEach(function (e) {
      var g = dayLabel(e.start, now);
      if (g !== last) { var h = document.createElement('div'); h.className = 'group'; h.textContent = g; el.appendChild(h); last = g; }
      var r = document.createElement('div');
      r.className = 'ev';
      r.innerHTML = '<i></i><div><b></b><span></span></div>';
      r.firstChild.style.background = e.color;
      r.querySelector('b').textContent = e.title;
      r.querySelector('span').textContent = e.allDay ? 'All day' : fmt.time(e.start, h24) + ' – ' + fmt.time(e.end, h24);
      el.appendChild(r);
    });
  }

  window.calendar = { DAYS: DAYS, calendars: calendars, events: events, dayLabel: dayLabel, render: render };
})();
