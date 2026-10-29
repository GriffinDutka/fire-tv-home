// Feeds live.js results into window.liveData (the seams in calendar.js, news.js, settings.js and
// index.html) and fires 'livedata' so the page redraws. Sample data stays until real data arrives.
//   livebridge.start(opts)   opts go to live.start ({wifi: false} on the screensaver)
(function () {
  var L = window.liveData = window.liveData || {};

  function update() {
    var cals = live.calendars();
    if (cals.length) {
      L.calendars = cals;
      L.events = live.events();
      L.calendarStatus = { connected: true, sub: cals.length === 1 ? '1 calendar' : cals.length + ' calendars' };
    }

    var heads = {}, any = false;
    live.topics().forEach(function (t) {
      if (t.items.length) { heads[t.src] = t.items.map(function (it) { return it.hl; }); any = true; }
    });
    if (any) L.headlines = heads;

    var w = live.wifi();
    if (w >= 0) L.wifi = w;
    var name = live.wifiName();
    if (name) L.network = { ssid: name };

    document.dispatchEvent(new Event('livedata'));
  }

  function start(opts) {
    live.onchange = update;
    live.start(opts);
    update();
  }

  window.livebridge = { start: start };
})();
