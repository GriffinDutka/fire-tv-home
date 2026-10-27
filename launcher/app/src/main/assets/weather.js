// Chicago weather from Open-Meteo (free, no key). Shared by the home screen and the screensaver.
// weather.get(cb, units) calls cb(data) right away with anything cached, then again when fresh data lands.
// units is '°F' (default) or '°C' (Settings → Weather → Units); each is fetched and cached on its own.
(function () {
  var URL = 'https://api.open-meteo.com/v1/forecast?latitude=41.88&longitude=-87.63' +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day' +
    '&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset' +
    '&wind_speed_unit=mph&timezone=America%2FChicago&forecast_days=4';
  var KEY = 'weather.chicago.v2';
  var FRESH_MS = 15 * 60 * 1000;

  // WMO weather codes → short words.
  var CODES = {
    0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'freezing fog',
    51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 56: 'freezing drizzle', 57: 'freezing drizzle',
    61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain', 67: 'freezing rain',
    71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains',
    80: 'showers', 81: 'showers', 82: 'heavy showers', 85: 'snow showers', 86: 'snow showers',
    95: 'thunderstorms', 96: 'thunderstorms, hail', 99: 'thunderstorms, hail'
  };
  var DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function parse(j) {
    var c = j.current, d = j.daily;
    return {
      at: Date.now(),
      temp: Math.round(c.temperature_2m),
      feels: Math.round(c.apparent_temperature),
      humidity: Math.round(c.relative_humidity_2m),
      wind: Math.round(c.wind_speed_10m),
      windDir: DIRS[Math.round(c.wind_direction_10m / 45) % 8],
      code: c.weather_code,
      text: CODES[c.weather_code] || 'unknown',
      day: c.is_day === 1,
      hi: Math.round(d.temperature_2m_max[0]),
      lo: Math.round(d.temperature_2m_min[0]),
      sunrise: d.sunrise[0].slice(11),
      sunset: d.sunset[0].slice(11),
      // The next three days: [{dow, hi, lo, code, text}]
      days: d.time.slice(1).map(function (t, i) {
        var p = t.split('-');
        return {
          dow: DAYS[new Date(+p[0], p[1] - 1, +p[2]).getDay()],
          hi: Math.round(d.temperature_2m_max[i + 1]),
          lo: Math.round(d.temperature_2m_min[i + 1]),
          code: d.weather_code[i + 1],
          text: CODES[d.weather_code[i + 1]] || 'unknown'
        };
      })
    };
  }

  function cached(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }

  function get(cb, units) {
    var c2 = units === '°C', key = KEY + (c2 ? '.c' : '');
    var c = cached(key);
    if (c) cb(c);
    if (c && Date.now() - c.at < FRESH_MS) return;
    var x = new XMLHttpRequest();
    x.open('GET', URL + '&temperature_unit=' + (c2 ? 'celsius' : 'fahrenheit'));
    x.timeout = 10000;
    x.onload = function () {
      if (x.status !== 200) return;
      try {
        var w = parse(JSON.parse(x.responseText));
        w.units = c2 ? '°C' : '°F';
        try { localStorage.setItem(key, JSON.stringify(w)); } catch (e) {}
        cb(w);
      } catch (e) {}
    };
    x.send();
  }

  window.weather = { get: get };
})();
