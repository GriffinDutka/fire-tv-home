// Chicago weather from Open-Meteo (free, no key). Shared by the home screen and the screensaver.
// weather.get(cb) calls cb(data) right away with anything cached, then again when fresh data lands.
(function () {
  var URL = 'https://api.open-meteo.com/v1/forecast?latitude=41.88&longitude=-87.63' +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day' +
    '&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset' +
    '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FChicago&forecast_days=1';
  var KEY = 'weather.chicago';
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
      sunset: d.sunset[0].slice(11)
    };
  }

  function cached() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  }

  function get(cb) {
    var c = cached();
    if (c) cb(c);
    if (c && Date.now() - c.at < FRESH_MS) return;
    var x = new XMLHttpRequest();
    x.open('GET', URL);
    x.timeout = 10000;
    x.onload = function () {
      if (x.status !== 200) return;
      try {
        var w = parse(JSON.parse(x.responseText));
        try { localStorage.setItem(KEY, JSON.stringify(w)); } catch (e) {}
        cb(w);
      } catch (e) {}
    };
    x.send();
  }

  window.weather = { get: get };
})();
