// Glass: one value from 0 (Frosted) to 100 (Clear) moves blur, tint, rim, sheen and text shadow
// together (SPEC §3). glass.set(v) applies it to the page; glass.name(v) is the nearest named setting.
(function () {
  var NAMES = { 'Frosted': 0, 'Balanced': 35, 'Light': 70, 'Clear': 100 };
  var root = document.documentElement;
  function lerp(a, b, t) { return a + (b - a) * t; }

  function set(v) {
    var t = Math.max(0, Math.min(100, +v)) / 100;
    root.style.setProperty('--blur', Math.round(lerp(40, 2, t)) + 'px');
    root.style.setProperty('--tint', lerp(.24, .03, t).toFixed(3));
    root.style.setProperty('--rim', lerp(.36, .2, t).toFixed(3));
    root.style.setProperty('--shine', lerp(.26, .14, t).toFixed(3));
    root.style.setProperty('--lift', lerp(0, .55, t).toFixed(3));
  }

  function name(v) {
    var best = 'Balanced', d = 999;
    for (var n in NAMES) if (Math.abs(NAMES[n] - v) < d) { d = Math.abs(NAMES[n] - v); best = n; }
    return best;
  }

  // Home blur: 0–48px behind Home. Light 12 · Medium 28 · Heavy 44.
  var BLURS = { Light: 12, Medium: 28, Heavy: 44 };
  function setHomeBlur(px) { root.style.setProperty('--homeBlur', px + 'px'); }
  function blurName(px) { return px < 18 ? 'Light' : px < 34 ? 'Medium' : 'Heavy'; }

  // Without backdrop-filter, glass is just its tint and the clock uses solid digits.
  var supported = !!(window.CSS && (CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)')));

  window.glass = { NAMES: NAMES, BLURS: BLURS, set: set, name: name, setHomeBlur: setHomeBlur, blurName: blurName, supported: supported };
})();
