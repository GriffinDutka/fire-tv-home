// News: headline topics and the one-at-a-time rotation on the screensaver (SPEC §14).
//   news.TOPICS                  [{name, color, sub}] in rotation order (also Settings → News)
//   news.headlines()             {topic name: [headline, …]}
//   news.at(step, prefs)         {topic, color, title, n, total} for rotation step, or null if all topics are off
(function () {
  var TOPICS = [
    { name: 'Tech', color: '#0A84FF', sub: 'The Verge, Ars Technica' },
    { name: 'AI', color: '#BF5AF2', sub: 'The Verge AI, MIT Technology Review' },
    { name: 'Sci-fi shows', color: '#64D2FF', sub: 'Gizmodo, Den of Geek' },
    { name: 'Gaming', color: '#30D158', sub: 'Polygon, IGN' },
    { name: 'Steam', color: '#C7D5E0', sub: 'Wishlist sales, top sellers' },
    { name: 'Chicago', color: '#FF453A', sub: 'Block Club, Sun-Times, WBEZ' }
  ];

  // Example headlines until live feeds exist.
  var SAMPLE = {
    'Tech': ['Example headline: A new streaming stick promises faster menus and Wi-Fi 7'],
    'AI': ['Example headline: New open model runs fully on a laptop'],
    'Sci-fi shows': ['Example headline: A space drama gets a second season and a new trailer'],
    'Gaming': ['Example headline: A surprise indie hit tops this week’s charts'],
    'Steam': ['Example: A city-builder you wishlisted is 60% off until Thursday'],
    'Chicago': ['Example headline: Lakefront Trail reopens after weekend repairs']
  };

  // LIVE DATA SEAM (phase 7): set window.liveData.headlines = {'Tech': ['…', …], 'Steam': [...], …}
  // (newest first, up to 5 per topic; topic names as in TOPICS). A topic missing there keeps its sample.
  function headlines() {
    var L = window.liveData, out = {};
    for (var k in SAMPLE) out[k] = (L && L.headlines && L.headlines[k] && L.headlines[k].length) ? L.headlines[k] : SAMPLE[k];
    return out;
  }

  // Cycles through enabled topics in order; each pass through the topics shows the next headline of each.
  function at(step, prefs) {
    var on = (prefs && prefs.news) || {}, all = headlines();
    var list = TOPICS.filter(function (t) { return on[t.name] !== false && all[t.name] && all[t.name].length; });
    if (!list.length) return null;
    var i = step % list.length, t = list[i], items = all[t.name];
    return { topic: t.name, color: t.color, title: items[Math.floor(step / list.length) % items.length], n: i + 1, total: list.length };
  }

  window.news = { TOPICS: TOPICS, headlines: headlines, at: at };
})();
