// window.news: headline feeds per topic (SPEC §14), parsed from RSS or Atom.
//   news.TOPICS             [{name, color, feeds: [url]}] in rotation order (Steam comes from steam.js)
//   news.parse(xml)         → [{title, link, at}] for one feed (at = ms since epoch, 0 if undated)
//   news.newest(items, n)   → the n newest, duplicates dropped
//   news.headline(topic, item) → {src, color, hl, link, at}: the mockup's headline card shape
// Feeds checked 2026-10-26. Polygon and IGN are their post-redirect addresses; Sci-fi shows uses
// Gizmodo's io9 and Den of Geek's TV feeds rather than the whole sites.
(function () {
  var TOPICS = [
    { name: 'Tech', color: '#0A84FF', feeds: ['https://www.theverge.com/rss/index.xml', 'https://feeds.arstechnica.com/arstechnica/index'] },
    { name: 'AI', color: '#BF5AF2', feeds: ['https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', 'https://www.technologyreview.com/feed/'] },
    { name: 'Sci-fi shows', color: '#64D2FF', feeds: ['https://gizmodo.com/io9/feed', 'https://www.denofgeek.com/tv/feed/'] },
    { name: 'Gaming', color: '#30D158', feeds: ['https://www.polygon.com/feed/', 'https://www.ign.com/rss/articles/feed'] },
    { name: 'Steam', color: '#C7D5E0', feeds: [] },
    { name: 'Chicago', color: '#FF453A', feeds: ['https://blockclubchicago.org/feed/', 'https://chicago.suntimes.com/rss/index.xml', 'https://www.wbez.org/rss/index.xml'] }
  ];

  var hasDom = typeof DOMParser !== 'undefined';

  // Named entities that show up in headlines; the browser path decodes every one.
  var NAMED = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–',
    lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', bull: '•', middot: '·',
    eacute: 'é', egrave: 'è', aacute: 'á', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
    ouml: 'ö', auml: 'ä', ccedil: 'ç', copy: '©', reg: '®', trade: '™', deg: '°', times: '×', euro: '€', pound: '£'
  };

  function entities(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, function (all, e) {
      if (e.charAt(0) === '#') {
        var n = e.charAt(1).toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        try { return String.fromCodePoint(n); } catch (x) { return all; }
      }
      return NAMED.hasOwnProperty(e) ? NAMED[e] : NAMED.hasOwnProperty(e.toLowerCase()) ? NAMED[e.toLowerCase()] : all;
    });
  }

  // Headline text as plain words: entities decoded (twice, for feeds that double-encode), tags dropped.
  function decode(s) {
    s = String(s || '');
    for (var i = 0; i < 2 && /[&<]/.test(s); i++) {
      if (hasDom) s = new DOMParser().parseFromString('<!doctype html><body>' + s, 'text/html').body.textContent;
      else s = entities(s.replace(/<[^>]*>/g, ''));
    }
    return s.replace(/\s+/g, ' ').trim();
  }

  function when(s) {
    var t = Date.parse(String(s || '').trim());
    return isNaN(t) ? 0 : t;
  }

  // ---- Browser: DOMParser ----

  function child(node, name) {
    for (var c = node.firstElementChild; c; c = c.nextElementSibling) if (c.localName === name) return c;
    return null;
  }

  function atomLink(node) {
    var fallback = '';
    for (var c = node.firstElementChild; c; c = c.nextElementSibling) {
      if (c.localName !== 'link') continue;
      var rel = c.getAttribute('rel');
      if (!rel || rel === 'alternate') return c.getAttribute('href') || '';
      fallback = fallback || c.getAttribute('href') || '';
    }
    return fallback;
  }

  function parseDom(xml) {
    var doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) return null;
    var items = doc.getElementsByTagName('item'), atom = !items.length;
    if (atom) items = doc.getElementsByTagNameNS('*', 'entry');
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i], t = child(it, 'title');
      var d = child(it, 'pubDate') || child(it, 'date') || child(it, 'published') || child(it, 'updated');
      var l = atom ? null : child(it, 'link');
      out.push({ title: t ? t.textContent : '', link: atom ? atomLink(it) : l ? l.textContent.trim() : '', at: d ? when(d.textContent) : 0 });
    }
    return out;
  }

  // ---- Node tests and broken XML: a small regex reader ----

  function cdata(s) { return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, function (a, x) { return x.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }); }

  function tag(block, re) {
    var m = re.exec(block);
    return m ? entities(cdata(m[1])) : '';
  }

  function parseText(xml) {
    var out = [], re = /<(item|entry)\b[\s\S]*?<\/\1>/g, m;
    while ((m = re.exec(xml))) {
      var b = m[0], atom = m[1] === 'entry', link = '';
      if (atom) {
        var alt = /<link\b(?![^>]*\brel="(?!alternate)[^"]*")[^>]*\bhref="([^"]*)"/.exec(b) || /<link\b[^>]*\bhref="([^"]*)"/.exec(b);
        link = alt ? entities(alt[1]) : '';
      } else {
        link = tag(b, /<link>([\s\S]*?)<\/link>/).trim();
      }
      out.push({
        title: tag(b, /<title\b[^>]*>([\s\S]*?)<\/title>/),
        link: link,
        at: when(tag(b, /<pubDate>([\s\S]*?)<\/pubDate>/) || tag(b, /<dc:date>([\s\S]*?)<\/dc:date>/) ||
          tag(b, /<published>([\s\S]*?)<\/published>/) || tag(b, /<updated>([\s\S]*?)<\/updated>/))
      });
    }
    return out;
  }

  function parse(xml) {
    var items = (hasDom && parseDom(String(xml))) || parseText(String(xml));
    return items.map(function (it) { return { title: decode(it.title), link: it.link, at: it.at }; })
      .filter(function (it) { return it.title; });
  }

  function newest(items, n) {
    var seen = {};
    return items.slice().sort(function (a, b) { return b.at - a.at; }).filter(function (it) {
      var k = it.title.toLowerCase();
      if (seen[k]) return false;
      seen[k] = 1;
      return true;
    }).slice(0, n || 5);
  }

  function headline(topic, item) {
    return { src: topic.name, color: topic.color, hl: item.title, link: item.link, at: item.at };
  }

  var api = { TOPICS: TOPICS, parse: parse, newest: newest, headline: headline, decode: decode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.news = api;
})();
