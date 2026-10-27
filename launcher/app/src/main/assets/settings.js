// Settings screen, tvOS-style: categories on the left, rows on the right (SPEC §16–17).
// Every change saves right away (Store, or Android for the guard, animation speed and screensaver
// timing) and applies to Home at once; the screensaver reads the same values when it starts.
//   settingsScreen.open() / isOpen() / key(k)
(function () {
  var A = window.Android || null;
  function $(id) { return document.getElementById(id); }
  var stage = $('stage');
  var prefs = settings.load();

  function savePrefs() { settings.save(prefs); home.applyPrefs(); }
  function pref(k) { return function () { return prefs[k]; }; }
  function setPref(k) { return function (v) { prefs[k] = v; savePrefs(); }; }

  // Row builders. Each row: {type, label, sub, get, set | run, values, value, dot}
  function tog(label, sub, get, set) { return { type: 'toggle', label: label, sub: sub, get: get, set: set }; }
  function cho(label, sub, values, get, set) { return { type: 'choice', label: label, sub: sub, values: values, get: get, set: set }; }
  function act(label, sub, value, run) { return { type: 'action', label: label, sub: sub, value: value, run: run }; }
  function sec(t) { return { type: 'section', label: t }; }

  // ---- Values that live in Android, read fresh each time ----
  function anim() { var a = A ? A.getAnim() : 0.5; return a === 0 ? 'Off' : a === 1 ? '1.0x' : '0.5x'; }
  var SAVER = { '5 minutes': 5, '10 minutes': 10, '15 minutes': 15, '30 minutes': 30, 'Never': 0 };
  function saverAfter() {
    if (!A || !A.saverAfter) return prefs.saverAfter;
    var m = A.saverAfter();
    for (var k in SAVER) if (SAVER[k] === m) return k;
    return m + ' minutes';   // set some other way (Fire OS settings); the next change snaps to a listed value
  }
  function hidden() { return store.get('hidden', []) || []; }

  // LIVE DATA SEAM (phase 7): window.liveData.network = {ssid: 'Home-5G'} gives the Wi-Fi row its name;
  // window.liveData.calendarStatus = {connected: true, sub: '3 calendars'} fills the Google Calendar row.
  function network() { var L = window.liveData; return (L && L.network) || {}; }
  function calStatus() { var L = window.liveData; return (L && L.calendarStatus) || { connected: false, sub: 'Showing sample events for now' }; }

  var CATS = [
    { name: 'Home', color: '#0A84FF', lede: 'The home screen, greeting and apps.', tip: true, rows: function () { return [
      tog('Wi-Fi indicator', 'Signal strength next to the clock', pref('wifi'), setPref('wifi')),
      cho('Clock', null, ['12-hour', '24-hour'], function () { return prefs.clock24 ? '24-hour' : '12-hour'; }, function (v) { prefs.clock24 = v === '24-hour'; savePrefs(); }),
      sec('Greeting'),
      tog('Mention calendar events', '“Dinner with Sam in 40 minutes”', pref('greetCal'), setPref('greetCal')),
      tog('Holiday countdowns', '“Halloween in 4 days”', pref('greetCountdown'), setPref('greetCountdown')),
      sec('Apps'),
      act('Hidden apps', 'Bring hidden apps back to All apps', hidden().length ? String(hidden().length) : 'None', function () {
        var n = hidden().length;
        if (!n) return toast('No hidden apps right now');
        store.set('hidden', []); home.rebuild();
        toast(n + (n === 1 ? ' app' : ' apps') + ' back in All apps');
      }),
      act('Reset Favorites', 'Back to the original order', '', function () { home.resetFavorites(); toast('Favorites reset'); })
    ]; } },
    { name: 'Appearance', color: '#BF5AF2', lede: 'Glass, blur and type. Changes show right away.', rows: function () { return [
      cho('Glass', 'Frosted is easiest to read; Clear shows the most picture', ['Frosted', 'Balanced', 'Light', 'Clear'],
        function () { return glass.name(store.get('glass', 35)); }, function (v) { store.set('glass', glass.NAMES[v]); look.apply(); }),
      cho('Home blur', 'How much the picture blurs behind Home', ['Light', 'Medium', 'Heavy'],
        function () { return glass.blurName(store.get('homeBlur', 28)); }, function (v) { store.set('homeBlur', glass.BLURS[v]); look.apply(); }),
      cho('Headline font', 'Greeting, app names, clock', look.HEADLINE.map(function (f) { return f.name; }),
        function () { return look.font('display'); }, function (v) { setFont('display', v); }),
      cho('Text font', 'Menus, widgets, everything else', look.TEXT.map(function (f) { return f.name; }),
        function () { return look.font('text'); }, function (v) { setFont('text', v); }),
      cho('Text size', null, ['Default', 'Large'], pref('textSize'), setPref('textSize'))
    ]; } },
    { name: 'Pictures', color: '#FF9F0A', lede: 'What fills the screensaver and Home. Your background redo lands here.', rows: function () { return [
      cho('Show', null, ['Your pictures', 'Film stills', 'Apple aerials', 'All of them'], pref('picSource'), function (v) { prefs.picSource = v; savePrefs(); pictures.next(prefs); home.showPicture(); }),
      cho('Change picture', null, ['Every 5 minutes', '15 minutes', 'Every hour', 'Once a day'], pref('picEvery'), setPref('picEvery')),
      tog('Shuffle', 'Random order instead of in sequence', pref('picShuffle'), setPref('picShuffle')),
      act('Add pictures', 'From your Mac with scripts/stills.sh', 'Mac', function () { toast('Add pictures from your Mac: ./scripts/stills.sh'); })
    ]; } },
    { name: 'Screensaver', color: '#64D2FF', lede: 'Clock, weather, calendar and headlines over your picture.', rows: function () { return [
      act('Start now', null, '▶', function () { close(); home.sleep(); }),
      cho('Start after', 'Idle time before it comes on', ['5 minutes', '10 minutes', '15 minutes', '30 minutes', 'Never'], saverAfter, function (v) {
        prefs.saverAfter = v; savePrefs();
        if (A && A.setSaverAfter && !A.setSaverAfter(SAVER[v])) toast('Not allowed: re-run ./scripts/install-launcher.sh');
      }),
      cho('Clock style', null, ['Glass', 'Solid'], pref('clockStyle'), setPref('clockStyle')),
      sec('Show'),
      tog('Weather', null, pref('svWeather'), setPref('svWeather')),
      tog('Calendar', null, pref('svCal'), setPref('svCal')),
      tog('Headlines', 'Topics are in News', pref('svNews'), setPref('svNews')),
      tog('Gargantua', 'Add the black hole as a scene', pref('gargantua'), setPref('gargantua'))
    ]; } },
    { name: 'News', color: '#FF453A', lede: 'Headlines on the screensaver. One at a time, from free feeds.', rows: function () {
      return news.TOPICS.map(function (t) {
        var r = tog(t.name, t.sub, function () { return prefs.news[t.name] !== false; }, function (v) { prefs.news[t.name] = v; savePrefs(); });
        r.dot = t.color;
        return r;
      }).concat([cho('Change headline', null, ['8 seconds', '15 seconds', '30 seconds'], pref('newsEvery'), setPref('newsEvery'))]);
    } },
    { name: 'Calendar', color: '#FF375F', lede: 'From Google Calendar. Read-only: add events on your phone.', rows: function () {
      var s = calStatus();
      var rows = [
        act('Google Calendar', s.sub, s.connected ? 'Connected' : 'Not connected', function () { toast('Calendars are set from the Mac for now: config/calendars.txt'); }),
        tog('Show on Home', null, pref('calHome'), setPref('calHome')),
        sec('Calendars')
      ];
      calendar.calendars().forEach(function (c) {
        var r = tog(c.name, null, function () { return prefs.cals[c.key] !== false; }, function (v) { prefs.cals[c.key] = v; savePrefs(); });
        r.dot = c.color;
        rows.push(r);
      });
      return rows;
    } },
    { name: 'Weather', color: '#5AC8FA', lede: 'From Open-Meteo. No account needed.', rows: function () { return [
      act('Location', null, 'Chicago, IL', function () { toast('Location is set from the Mac for now'); }),
      cho('Units', null, ['°F', '°C'], pref('units'), function (v) { prefs.units = v; savePrefs(); home.refreshWeather(); })
    ]; } },
    { name: 'Network', color: '#30D158', lede: 'Your connection.', rows: function () {
      var l = home.wifiLevel(), n = network();
      return [
        act(l === 4 ? 'Ethernet' : 'Wi-Fi', null, l === 0 ? 'Not connected' : n.ssid || 'Connected', function () {}),
        act('Signal', null, ['Not connected', 'Weak', 'Good', 'Strong', 'Wired'][l] || '', function () {}),
        act('Network settings', 'Opens Fire OS network settings', '›', function () { if (A && A.networkSettings) A.networkSettings(); })
      ];
    } },
    { name: 'TV & system', color: '#8E8E93', lede: 'Fire OS, the home guard and cleanup. Everything here is reversible.', rows: function () { return [
      tog('Home guard', 'The Home button comes here instead of Amazon’s home', function () { return A ? A.guardOn() : true; }, function (v) {
        if (!(A && A.setGuardOn(v))) toast('Not allowed: re-run ./scripts/install-launcher.sh');
        else if (!v) toast('Off: open Griffin Home from Your Apps to turn it back on');
      }),
      cho('Animation speed', null, ['0.5x', '1.0x', 'Off'], anim, function (v) {
        if (!(A && A.setAnim({ '0.5x': 0.5, '1.0x': 1, 'Off': 0 }[v]))) toast('Not allowed: re-run ./scripts/install-launcher.sh');
      }),
      act('Ads & tracking', '17 Amazon apps disabled · 3 protected by Fire OS', 'Cleaned', function () { toast('Managed from the Mac: scripts/debloat.sh'); }),
      act('TV settings', 'Display, inputs, sound', '›', function () { if (A) A.tvSettings(); }),
      act('Amazon home', 'For 10 minutes: inputs, app library', '›', function () { if (A) A.amazonHome(); }),
      act('Restore everything', 'Re-enable apps, stock animations, Amazon home', 'Mac', function () { toast('Run ./scripts/restore.sh on your Mac'); })
    ]; } },
    { name: 'About', color: '#C7C7CC', lede: 'Griffin Home on your TCL 55S450F.', rows: function () { return [
      act('Griffin Home', null, A && A.version ? A.version() : 'Browser', function () {}),
      act('Fire OS', null, '7.7.1.7', function () {}),
      act('TV', null, 'TCL 55S450F', function () {})
    ]; } }
  ];

  function setFont(which, name) {
    var f = store.get('fonts', {}) || {};
    f[which] = name;
    store.set('fonts', f);
    look.apply();
    home.render();
  }

  var scr = document.createElement('div');
  scr.className = 'setscreen';
  scr.innerHTML = '<div class="set-title">Settings</div><div class="set-cats glass" id="setCats"></div>' +
    '<div class="set-detail glass"><h3 id="setH"></h3><div class="lede" id="setLede"></div><div class="set-view"><div class="set-rows" id="setRows"></div></div><div class="set-toast" id="setToast"></div></div>';
  stage.appendChild(scr);

  var SET = { cat: 0, row: 0, pane: 'cats', rows: [] };

  function open() { prefs = settings.load(); SET.cat = 0; SET.row = 0; SET.pane = 'cats'; stage.classList.add('insettings'); render(); }
  function close() { stage.classList.remove('insettings'); home.render(); }
  function isOpen() { return stage.classList.contains('insettings'); }

  var toastT;
  function toast(m) {
    var t = $('setToast');
    t.textContent = m; t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }

  function render() {
    var cats = $('setCats');
    cats.innerHTML = '';
    CATS.forEach(function (c, i) {
      var d = document.createElement('div');
      d.className = 'set-cat' + (i === SET.cat ? (SET.pane === 'cats' ? ' focus' : ' sel') : '');
      d.innerHTML = '<i></i><span></span>';
      d.firstChild.style.background = c.color;
      d.lastChild.textContent = c.name;
      cats.appendChild(d);
    });
    var cat = CATS[SET.cat];
    $('setH').textContent = cat.name;
    $('setLede').textContent = cat.lede;
    var all = cat.rows(), box = $('setRows');
    SET.rows = all.filter(function (r) { return r.type !== 'section'; });
    SET.row = Math.max(0, Math.min(SET.row, SET.rows.length - 1));
    box.innerHTML = '';
    if (cat.tip) {
      var tip = document.createElement('div');
      tip.className = 'set-tip';
      tip.innerHTML = '<b>Tip</b>Hold OK on any app for options: open, move, remove from Favorites, or hide it.';
      box.appendChild(tip);
    }
    var focusEl = null, n = 0;
    all.forEach(function (r) {
      if (r.type === 'section') { var h = document.createElement('div'); h.className = 'set-sec'; h.textContent = r.label; box.appendChild(h); return; }
      var i = n++, d = document.createElement('div');
      d.className = 'srow2' + (SET.pane === 'rows' && i === SET.row ? ' focus' : '');
      d.innerHTML = '<div><div class="l"></div><div class="s"></div></div><div class="v"></div>';
      var l = d.querySelector('.l');
      if (r.dot) { var dot = document.createElement('i'); dot.style.background = r.dot; l.appendChild(dot); }
      l.appendChild(document.createTextNode(r.label));
      if (r.sub) d.querySelector('.s').textContent = r.sub; else d.querySelector('.s').remove();
      var v = d.querySelector('.v');
      if (r.type === 'toggle') v.innerHTML = '<span class="switch' + (r.get() ? ' on' : '') + '"></span>';
      else if (r.type === 'choice') { v.innerHTML = '<span class="chev">‹</span><span></span><span class="chev">›</span>'; v.children[1].textContent = r.get(); }
      else v.textContent = r.value || '';
      box.appendChild(d);
      if (SET.pane === 'rows' && i === SET.row) focusEl = d;
    });
    // Keep the focused row in view: if it's below the visible area, it sits 8px above the bottom.
    var y = 0, viewH = box.parentNode.clientHeight;
    if (focusEl && focusEl.offsetTop + focusEl.offsetHeight > viewH) y = focusEl.offsetTop + focusEl.offsetHeight - viewH + 8;
    box.style.transform = 'translateY(' + (-y) + 'px)';
  }

  // Toggle flips, a choice steps (wrapping), an action runs.
  function activate(dir) {
    var r = SET.rows[SET.row];
    if (!r) return;
    if (r.type === 'toggle') r.set(!r.get());
    else if (r.type === 'choice') { var i = r.values.indexOf(r.get()); r.set(r.values[(i + dir + r.values.length) % r.values.length]); }
    else if (r.run) r.run();
    if (isOpen()) render();
  }

  function key(k) {
    if (SET.pane === 'cats') {
      if (k === 'up') { SET.cat = Math.max(0, SET.cat - 1); SET.row = 0; }
      else if (k === 'down') { SET.cat = Math.min(CATS.length - 1, SET.cat + 1); SET.row = 0; }
      else if (k === 'right' || k === 'ok') { SET.pane = 'rows'; SET.row = 0; }
      else if (k === 'back') return close();
    } else {
      var r = SET.rows[SET.row];
      if (k === 'up') SET.row = Math.max(0, SET.row - 1);
      else if (k === 'down') SET.row = Math.min(SET.rows.length - 1, SET.row + 1);
      else if (k === 'ok') return activate(1);
      else if ((k === 'left' || k === 'right') && r && r.type === 'choice') return activate(k === 'right' ? 1 : -1);
      else if (k === 'left' || k === 'back') SET.pane = 'cats';
    }
    render();
  }

  // Live data can add calendars or change the network while Settings is up.
  document.addEventListener('livedata', function () { if (isOpen()) render(); });

  window.settingsScreen = { open: open, close: close, isOpen: isOpen, key: key };
})();
