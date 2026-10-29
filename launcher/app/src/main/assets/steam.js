// window.steam: the Steam headline topic, from the store's public featured lists (no key).
//   steam.URL                     https://store.steampowered.com/api/featuredcategories
//   steam.headlines(json, now)    → up to 5 of {src: 'Steam', color, hl, link, at}
//   steam.saleLine(item, now)     "{Game} is {n}% off until {weekday}"
// Response (checked 2026-10-26): {specials: {items: [...]}, top_sellers: {items: [...]}, ...};
// each item has id, name, discounted, discount_percent and, when on sale, discount_expiration
// (Unix seconds).
(function () {
  var URL = 'https://store.steampowered.com/api/featuredcategories';
  var COLOR = '#C7D5E0';
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // "Call of Duty®: Modern Warfare® 4" → "Call of Duty: Modern Warfare 4"
  function name(s) { return String(s || '').replace(/[®™©]/g, '').replace(/\s+/g, ' ').trim(); }

  function saleLine(it, now) {
    var line = name(it.name) + ' is ' + it.discount_percent + '% off';
    if (!it.discount_expiration) return line;
    var end = new Date(it.discount_expiration * 1000), n = now ? new Date(+now) : new Date();
    var days = Math.round((new Date(end.getFullYear(), end.getMonth(), end.getDate()) -
      new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5);
    if (days <= 0) return line + ', today only';
    return line + ' until ' + (days < 7 ? DAYS[end.getDay()] : MONTHS[end.getMonth()] + ' ' + end.getDate());
  }

  function headline(hl, it, at) {
    return { src: 'Steam', color: COLOR, hl: hl, link: 'https://store.steampowered.com/app/' + it.id, at: at };
  }

  // Three sales and two top sellers, alternating; either list fills in if the other runs short.
  function headlines(json, now) {
    var j = typeof json === 'string' ? JSON.parse(json) : json;
    var at = now ? +now : Date.now(), seen = {};
    function fresh(it) {
      if (!it || !it.name || seen[it.id]) return false;
      seen[it.id] = 1;
      return true;
    }
    var sales = ((j.specials || {}).items || []).filter(function (it) {
      return it.discount_percent > 0 && (!it.discount_expiration || it.discount_expiration * 1000 > at) && fresh(it);
    }).map(function (it) { return headline(saleLine(it, at), it, at); });
    var top = ((j.top_sellers || {}).items || []).filter(fresh)
      .map(function (it) { return headline('Top seller: ' + name(it.name), it, at); });
    var out = [], s = sales.slice(0, 3), t = top.slice(0, 2);
    s = s.concat(sales.slice(3, 3 + 2 - t.length));
    t = t.concat(top.slice(2, 2 + 3 - s.length));
    while (s.length || t.length) {
      if (s.length) out.push(s.shift());
      if (t.length) out.push(t.shift());
    }
    return out.slice(0, 5);
  }

  var api = { URL: URL, headlines: headlines, saleLine: saleLine, name: name };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.steam = api;
})();
