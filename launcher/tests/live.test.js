// live.js end to end with a fake TV: window.Data answers fetches from the fixtures,
// window.Store is a Map, and the clock is pinned to Mon Oct 26 2026, 8 AM Chicago.
process.env.TZ = 'America/Chicago';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ASSETS = path.join(__dirname, '../app/src/main/assets');
const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
const NOW = Date.parse('2026-10-26T08:00:00-05:00');

// Timers must not keep the test process alive.
const realSetInterval = setInterval;
globalThis.setInterval = (f, ms) => { const t = realSetInterval(f, ms); t.unref(); return t; };
Date.now = () => NOW;

function tv(online) {
  const store = new Map(), fetched = [];
  const responses = {
    'https://cal.test/personal.ics': fixture('weekly-byday.ics'),
    'https://cal.test/sports.ics': fixture('override.ics'),
    [require(path.join(ASSETS, 'steam.js')).URL]: fixture('steam.json')
  };
  globalThis.window = globalThis;
  window.Store = { get: (k) => store.get(k) || null, set: (k, v) => store.set(k, v) };
  window.Data = {
    calendars: () => 'Personal|#0A84FF|https://cal.test/personal.ics\nSports|#64D2FF|https://cal.test/sports.ics\n',
    network: () => (online ? 2 : 0),
    wifiName: () => 'Home-5G',
    fetch: (id, url) => {
      fetched.push(url);
      setTimeout(() => {
        let body = responses[url];
        if (!body && /feed|rss|xml/.test(url)) body = url.includes('verge') ? fixture('atom.xml') : fixture('rss.xml');
        if (online && body) window.data.done(id, body); else window.data.fail(id);
      }, 1);
    }
  };
  return { store, fetched };
}

function load() {
  for (const f of ['data.js', 'ical.js', 'feeds.js', 'steam.js', 'live.js']) {
    const p = path.join(ASSETS, f);
    delete require.cache[require.resolve(p)];
    const mod = require(p);
    if (f !== 'data.js' && f !== 'live.js') window[f.replace('.js', '')] = mod;
  }
  return window.live;
}

function started(live, opts) {
  return new Promise((resolve) => {
    const seen = new Set();
    live.onchange = (kind) => { seen.add(kind); if (seen.has('calendar') && seen.has('news')) resolve(seen); };
    live.start(opts);
  });
}

test('fetches, parses and caches calendar, news and Wi-Fi', async () => {
  const fake = tv(true);
  const live = load();
  const seen = await started(live);
  assert.ok(seen.has('wifi'));
  assert.equal(live.wifi(), 2);
  assert.equal(live.wifiName(), 'Home-5G');

  const ev = live.events();
  assert.equal(ev[0].title, 'Gym');
  assert.ok(ev[0].start instanceof Date);
  assert.deepEqual([...new Set(ev.map((e) => e.cal))].sort(), ['personal', 'sports']);
  assert.equal(ev.find((e) => e.cal === 'sports').color, '#64D2FF');
  assert.ok(ev.some((e) => e.title === 'Trivia (moved)'));
  assert.deepEqual(live.calendars().map((c) => c.key), ['personal', 'sports']);

  const topics = live.topics();
  assert.deepEqual(topics.map((t) => t.src), ['Tech', 'AI', 'Sci-fi shows', 'Gaming', 'Steam', 'Chicago']);
  topics.forEach((t) => assert.ok(t.items.length > 0 && t.items.length <= 5, t.src));
  assert.equal(topics[4].items[0].hl, 'Moon Sweepers is 15% off until Friday');
  assert.equal(live.headlines().length, topics.reduce((n, t) => n + t.items.length, 0));

  // Rotation: topics in order, then each topic's next headline.
  const enabled = { Tech: true, AI: false, 'Sci-fi shows': false, Gaming: false, Steam: true, Chicago: false };
  const h0 = live.headline(0, enabled), h1 = live.headline(1, enabled), h2 = live.headline(2, enabled);
  assert.deepEqual([h0.src, h0.pos, h0.total], ['Tech', 1, 2]);
  assert.deepEqual([h1.src, h1.pos], ['Steam', 2]);
  assert.equal(h2.src, 'Tech');
  assert.notEqual(h2.hl, h0.hl);
  assert.equal(live.headline(0, { Tech: false, AI: false, 'Sci-fi shows': false, Gaming: false, Steam: false, Chicago: false }), null);

  assert.ok(fake.store.get('live.calendar') && fake.store.get('live.news'));
  assert.ok(fake.fetched.some((u) => u.includes('arstechnica')));
});

test('offline: a fresh page shows the cached data and keeps it through failed refreshes', async () => {
  const first = tv(true);
  await started(load());
  const cache = new Map(first.store);

  const fake = tv(false);
  cache.forEach((v, k) => fake.store.set(k, v));
  const live = load();
  const kinds = [];
  live.onchange = (k) => kinds.push(k);
  live.start({ wifi: false });
  assert.ok(kinds.includes('calendar') && kinds.includes('news'), 'cached data shows at once');
  assert.ok(live.events().length > 0);

  Date.now = () => NOW + 60 * 60 * 1000;  // an hour later, both are due again
  await live.refresh();
  Date.now = () => NOW;
  assert.ok(fake.fetched.length > 0, 'it tried');
  assert.ok(live.events().some((e) => e.title === 'Gym'), 'calendar kept');
  assert.ok(live.topics().every((t) => t.items.length > 0), 'headlines kept');
  assert.equal(live.wifi(), -1, 'no polling with wifi: false');
});

test('nothing loaded yet: placeholder headline', () => {
  tv(false);
  const live = load();
  const h = live.headline(0, {});
  assert.deepEqual([h.src, h.hl, h.total], ['Headlines', '', 0]);
  assert.deepEqual(live.events(), []);
});
