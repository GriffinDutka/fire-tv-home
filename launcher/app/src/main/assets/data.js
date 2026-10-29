// window.data: fetch text from any site, and a small cache that survives offline.
// On the TV, Java does the fetch (window.Data, see Data.java) because file:// pages hit CORS;
// it answers through data.done(id, text) / data.fail(id). In a desktop browser it uses fetch().
//   data.get(url)        → Promise<string>
//   data.load(key)       → the value last saved under key, or null
//   data.save(key, value) (any JSON value; kept in window.Store when present, else localStorage)
(function () {
  var TIMEOUT_MS = 45000;
  var waiting = {}, next = 1;

  function get(url) {
    if (!(window.Data && Data.fetch)) {
      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      });
    }
    return new Promise(function (resolve, reject) {
      var id = 'f' + next++;
      var timer = setTimeout(function () { fail(id); }, TIMEOUT_MS);
      waiting[id] = { resolve: resolve, reject: reject, timer: timer };
      try { Data.fetch(id, url); } catch (e) { fail(id); }
    });
  }

  function done(id, text) {
    var w = waiting[id];
    if (!w) return;
    delete waiting[id];
    clearTimeout(w.timer);
    w.resolve(text);
  }

  function fail(id) {
    var w = waiting[id];
    if (!w) return;
    delete waiting[id];
    clearTimeout(w.timer);
    w.reject(new Error('fetch failed'));
  }

  function load(key) {
    try {
      var s = window.Store ? Store.get(key) : localStorage.getItem(key);
      return s ? JSON.parse(s) : null;
    } catch (e) { return null; }
  }

  function save(key, value) {
    try {
      var s = JSON.stringify(value);
      if (window.Store) Store.set(key, s); else localStorage.setItem(key, s);
    } catch (e) {}
  }

  window.data = { get: get, done: done, fail: fail, load: load, save: save };
})();
