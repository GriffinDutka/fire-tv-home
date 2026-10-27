// RSS/Atom parsing and the Steam lines. Node has no DOMParser, so this runs news.js's regex
// reader (also its fallback for broken XML); the TV's WebView takes the DOMParser path.
process.env.TZ = 'America/Chicago';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const news = require('../app/src/main/assets/news.js');
const steam = require('../app/src/main/assets/steam.js');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

test('RSS: titles decoded, links, dates; media:title and blank items ignored', () => {
  const items = news.parse(fixture('rss.xml'));
  assert.equal(items.length, 7);
  assert.deepEqual(items[0], { title: 'Microsoft offers to buy out a quarter of its workforce', link: 'https://example.com/a1', at: Date.parse('2026-10-26T22:36:06Z') });
  assert.equal(items[1].title, '‘Star Trek’ icon has died');
  assert.equal(items[2].title, "A forgettable start for the Bulls' Matas Buzelis");
  assert.equal(items[3].title, 'Double-encoded: Tom’s & Jerry’s');
  assert.equal(items[3].at, Date.parse('2026-10-26T12:00:00Z'), 'dc:date');
  assert.equal(items[4].title, 'Ads are coming to your TV — again');
});

test('newest 5, duplicates dropped', () => {
  const top = news.newest(news.parse(fixture('rss.xml')), 5);
  assert.deepEqual(top.map((i) => i.link), ['https://example.com/a3', 'https://example.com/a1', 'https://example.com/a2', 'https://example.com/a4', 'https://example.com/a5']);
});

test('Atom: alternate link, published date, HTML titles', () => {
  const items = news.parse(fixture('atom.xml'));
  assert.deepEqual(items.map((i) => i.title), [
    'OpenAI announces three big science discoveries',
    'Bulls overwhelmed by Boston & the defense remains an issue',
    "Amtrak's railyard gets review"
  ]);
  assert.deepEqual(items.map((i) => i.link), ['https://example.com/e1', 'https://example.com/e2', 'https://example.com/e3']);
  assert.equal(items[0].at, Date.parse('2026-10-26T19:34:58-04:00'));
});

test('headline card shape', () => {
  const t = news.TOPICS.find((x) => x.name === 'Chicago');
  assert.deepEqual(news.headline(t, { title: 'Lakefront Trail reopens', link: 'https://x', at: 5 }),
    { src: 'Chicago', color: '#FF453A', hl: 'Lakefront Trail reopens', link: 'https://x', at: 5 });
  assert.deepEqual(news.TOPICS.map((x) => x.name), ['Tech', 'AI', 'Sci-fi shows', 'Gaming', 'Steam', 'Chicago']);
});

test('decode: numeric, hex, named, unknown entities', () => {
  assert.equal(news.decode('A &#x2014; B &hellip; &bogus; &#128512;'), 'A — B … &bogus; 😀');
});

const NOW = new Date('2026-10-26T12:00:00-05:00');

test('Steam: sales and top sellers alternate, 5 lines', () => {
  const hl = steam.headlines(fixture('steam.json'), NOW);
  assert.deepEqual(hl.map((h) => h.hl), [
    'Moon Sweepers is 15% off until Friday',
    'Top seller: Call of Duty: Modern Warfare 4',
    'Scam With Your Friends is 10% off until Thursday',
    'Top seller: Counter-Strike 2',
    'City Builder Deluxe is 60% off until Nov 9'
  ]);
  assert.deepEqual(hl[0], { src: 'Steam', color: '#C7D5E0', hl: hl[0].hl, link: 'https://store.steampowered.com/app/5335510', at: +NOW });
});

test('Steam: today only, no end date, ended sales skipped', () => {
  const j = JSON.parse(fixture('steam.json'));
  const tonight = j.specials.items.find((i) => i.name === 'Ends Tonight');
  assert.equal(steam.saleLine(tonight, NOW), 'Ends Tonight is 25% off, today only');
  assert.equal(steam.saleLine({ name: 'Forever Game', discount_percent: 30 }, NOW), 'Forever Game is 30% off');
  assert.ok(!steam.headlines(j, NOW).some((h) => /Already Ended|No Discount/.test(h.hl)));
  assert.deepEqual(steam.headlines({ specials: { items: [] }, top_sellers: { items: [] } }, NOW), []);
});
