// Pictures: the one picture under Home and the screensaver (SPEC §5). The screensaver shows it sharp,
// Home shows the same one blurred; both read and advance it through Store key currentPicture.
//   pictures.list(prefs)     what Settings → Pictures → Show allows: [{kind: 'still'|'aerial', name, src, title}]
//   pictures.current(prefs)  the picture to show now, moving on when Settings → Change picture says so
//   pictures.next(prefs)     move on now
//   pictures.src(pic)        an image URL; aerials give a still frame (null while it's being made)
//   pictures.all()           every picture on the TV, for the picker in Settings → Pictures → Picture
//   pictures.thumb(pic)      a small image URL for the picker (null while it's being made)
// A picture chosen in the picker (prefs.picPick, {kind, name}) stays on until Rotate is chosen.
// Until Griffin's own pictures exist, a source with nothing in it falls back to everything on the TV,
// and with nothing at all the placeholder scene shows.
(function () {
  var EVERY = { 'Every 5 minutes': 5, '15 minutes': 15, 'Every hour': 60, 'Once a day': 1440 };

  function load(bridge, kind) {
    try {
      return JSON.parse(bridge ? bridge.list() : '[]').map(function (m) {
        return { kind: kind, name: m.name, src: m.src, title: m.title, listed: m.listed };
      });
    } catch (e) { return []; }
  }

  function all() { return load(window.Stills, 'still').concat(load(window.Aerials, 'aerial')); }

  // The chosen picture, if it's still on the TV.
  function picked(prefs) {
    if (!prefs.picPick) return null;
    var l = all();
    for (var j = 0; j < l.length; j++) if (same(l[j], prefs.picPick)) { l[j].at = Date.now(); return l[j]; }
    return null;
  }

  function list(prefs) {
    var stills = load(window.Stills, 'still'), aerials = load(window.Aerials, 'aerial');
    var mine = stills.filter(function (s) { return !s.listed; }), films = stills.filter(function (s) { return s.listed; });
    var all = stills.concat(aerials);
    var pick = { 'Your pictures': mine, 'Film stills': films, 'Apple aerials': aerials }[prefs.picSource] || all;
    return pick.length ? pick : all;
  }

  function same(a, b) { return a && b && a.kind === b.kind && a.name === b.name; }

  function next(prefs) {
    var l = list(prefs), cur = store.get('currentPicture', null), pic = picked(prefs);
    if (!pic && l.length) {
      var i = -1;
      for (var j = 0; j < l.length; j++) if (same(l[j], cur)) i = j;
      if (prefs.picShuffle && l.length > 1) {
        var k = i;
        while (k === i) k = Math.floor(Math.random() * l.length);
        i = k;
      } else i = (i + 1) % l.length;
      pic = l[i];
      pic.at = Date.now();
    }
    store.set('currentPicture', pic);
    return pic;
  }

  function current(prefs) {
    var pic = picked(prefs);
    if (pic) { store.set('currentPicture', pic); return pic; }
    var cur = store.get('currentPicture', null), l = list(prefs), ok = false;
    for (var j = 0; j < l.length; j++) if (same(l[j], cur)) ok = true;
    var every = (EVERY[prefs.picEvery] || 15) * 6e4;
    if (!ok || Date.now() - cur.at >= every) return next(prefs);
    return cur;
  }

  function src(pic) {
    if (!pic) return null;
    if (pic.kind === 'aerial') return window.Aerials && Aerials.poster ? Aerials.poster(pic.name) : null;
    return pic.src;
  }

  function thumb(pic) {
    var b = pic && (pic.kind === 'aerial' ? window.Aerials : window.Stills);
    return b && b.thumb ? b.thumb(pic.name) : pic && pic.kind === 'still' ? pic.src : null;
  }

  // Shows pic on a .scene with two .pic layers, crossfading from whatever was there (or not, if instant).
  function show(scene, pic, done, instant) {
    var layers = scene.querySelectorAll('.pic'), url = src(pic);
    if (!url) { if (done) done(false); return; }
    var front = scene._front || 0, cur = layers[front];
    if (cur.dataset.url === url && cur.classList.contains('on')) { if (done) done(true); return; }
    var img = new Image();
    img.onload = function () {
      var next = layers[front ^ 1];
      next.style.backgroundImage = 'url("' + url + '")';
      next.dataset.url = url;
      next.style.zIndex = 2; cur.style.zIndex = 1;
      next.style.transition = instant ? 'none' : '';
      next.classList.add('on');
      scene._front = front ^ 1;
      // The old one stays under the new one until the crossfade is done.
      setTimeout(function () { if (scene._front !== front) cur.classList.remove('on'); }, 3100);
      if (done) done(true);
    };
    img.onerror = function () { if (done) done(false); };
    img.src = url;
  }

  window.pictures = { EVERY: EVERY, all: all, thumb: thumb, same: same, list: list, current: current, next: next, src: src, show: show };
})();
