// Settings shared by Home and the screensaver. They're separate WebViews, so values live in
// SharedPreferences through the Store bridge (Store.java); localStorage stands in for browser testing.
//   store.get(key, fallback) / store.set(key, value)   JSON values by key
//   settings.load() → the SPEC §20 prefs object, defaults filled in;  settings.save(p)
//   look.apply()  glass, Home blur and fonts from the store, onto this page
(function () {
  var S = window.Store || null;

  function get(k, d) {
    try {
      var v = S ? S.get(k) : localStorage.getItem('ui.' + k);
      return v == null ? d : JSON.parse(v);
    } catch (e) { return d; }
  }
  function set(k, v) {
    var j = JSON.stringify(v);
    try { if (S) S.set(k, j); else localStorage.setItem('ui.' + k, j); } catch (e) {}
  }

  // Home guard and animation speed aren't here: they're Android settings, read through the bridge.
  var DEFAULTS = {
    clock24: false, wifi: true, greetCal: true, greetCountdown: true, textSize: 'Default',
    picTopics: {}, picEvery: '15 minutes', picShuffle: true, picPick: null,
    saverAfter: '10 minutes', clockStyle: 'Glass', svWeather: true, svCal: true, svNews: true, gargantua: false,
    news: { 'Tech': true, 'AI': true, 'Sci-fi shows': true, 'Gaming': true, 'Steam': true, 'Chicago': true },
    newsEvery: '8 seconds',
    calHome: true,
    cals: { personal: true, health: true, errands: true, sports: true, holidays: true },
    units: '°F'
  };

  function load() {
    var p = get('prefs', {}) || {}, out = {};
    for (var k in DEFAULTS) {
      var d = DEFAULTS[k];
      if (d && typeof d === 'object') {
        out[k] = {};
        for (var j in d) out[k][j] = d[j];
        var saved = p[k] || {};
        for (var j2 in saved) out[k][j2] = saved[j2];   // keeps calendars added later by live data
      } else out[k] = k in p ? p[k] : d;
    }
    return out;
  }

  // Only fonts bundled in assets/fonts are offered (SPEC §4: the others can't ship on the TV).
  var HEADLINE = [
    { name: 'Montserrat', stack: "'Montserrat', sans-serif", dw: 700, dls: '-.01em' },
    { name: 'Roboto', stack: "'Roboto', sans-serif", dw: 700, dls: '-.01em' }
  ];
  var TEXT = [
    { name: 'Roboto', stack: "'Roboto', sans-serif" },
    { name: 'Montserrat', stack: "'Montserrat', sans-serif" }
  ];
  function find(list, n) { for (var i = 0; i < list.length; i++) if (list[i].name === n) return list[i]; return list[0]; }

  var root = document.documentElement;
  function apply() {
    if (window.glass) {
      glass.set(get('glass', 35));
      glass.setHomeBlur(get('homeBlur', 28));
    }
    var f = get('fonts', {}) || {}, h = find(HEADLINE, f.display), t = find(TEXT, f.text);
    root.style.setProperty('--display', h.stack);
    root.style.setProperty('--dw', h.dw);
    root.style.setProperty('--dls', h.dls);
    root.style.setProperty('--sans', t.stack);
  }

  // 12- or 24-hour time, per Settings → Home → Clock.
  function time(d, h24) {
    return d.toLocaleTimeString([], h24 ? { hour: '2-digit', minute: '2-digit', hour12: false } : { hour: 'numeric', minute: '2-digit' });
  }

  window.store = { get: get, set: set };
  window.settings = { DEFAULTS: DEFAULTS, load: load, save: function (p) { set('prefs', p); } };
  window.look = { HEADLINE: HEADLINE, TEXT: TEXT, apply: apply, font: function (which) { var f = get('fonts', {}) || {}; return which === 'text' ? find(TEXT, f.text).name : find(HEADLINE, f.display).name; } };
  window.fmt = { time: time };
})();
