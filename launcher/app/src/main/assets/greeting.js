// Greeting: two lines, picked fresh each time Home is shown (SPEC §11).
// Line 1 is a hello; line 2 is something true about right now.
//   greeting.hellos(now, wx)        line 1 pool
//   greeting.subs(now, wx, prefs)   line 2 pool (weather, sunset, weekend, next event, holidays)
//   greeting.pick(list, current)    a random entry that differs from the current one
// wx is weather.get()'s data, or null before the first fetch.
(function () {
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // °C turns the 32°F / 40°F thresholds into 0°C / 4°C.
  function cold(wx, prefs, f, c) { return wx && wx.temp < (prefs && prefs.units === '°C' ? c : f); }

  var C = window.HOME_CONFIG || {};

  // Lines say the owner's name where they show {n}. With no name set, ", {n}" is dropped
  // and lines that start with the name are skipped.
  function named(lines) {
    var n = C.name;
    return lines.filter(function (s) { return n || s.indexOf('{n}') !== 0; })
      .map(function (s) { return n ? s.replace('{n}', n) : s.replace(', {n}', ''); });
  }

  function hellos(now, wx, prefs) {
    var hr = now.getHours(), dow = now.getDay(), day = DAYS[dow], mon = now.getMonth();
    var part = hr < 5 ? 'night' : hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : hr < 22 ? 'evening' : 'night';
    var list = {
      morning: ['Good morning, {n}', 'Morning, {n}', 'Rise and shine, {n}', 'Coffee and a show, {n}?', 'Easy start today, {n}?', 'Slow morning, {n}?', 'Early start, {n}?', 'Morning light, {n}'],
      afternoon: ['Good afternoon, {n}', 'Afternoon, {n}', 'Back at it, {n}', 'Taking a break, {n}?', 'Midday reset, {n}?', 'How’s the day going, {n}?', 'Afternoon off, {n}?', 'Long day, {n}?'],
      evening: ['Good evening, {n}', 'Evening, {n}', 'What are we watching, {n}?', 'How was your day, {n}?', 'Time to unwind, {n}', 'Settle in, {n}', 'Lights down, {n}', 'Dinner and a show, {n}?', 'Movie night, {n}?', 'Feet up, {n}'],
      night: ['Up late, {n}?', 'Hey there, night owl', 'One more episode, {n}?', 'Can’t sleep, {n}?', 'Burning the midnight oil, {n}?', 'Late show, {n}?', 'Still up, {n}?', 'Quiet hours, {n}', 'Midnight movie, {n}?']
    }[part].concat(['Welcome back, {n}', 'Hey, {n}', 'Good to see you, {n}', '{n} returns', 'Happy ' + day + ', {n}',
      'Make yourself at home, {n}', 'Pick something good, {n}', 'There you are, {n}', 'All yours, {n}', 'What’s it going to be, {n}?']);
    if (dow === 1) list.push('Monday again, {n}', 'New week, {n}');
    if (dow === 5) list.push('Made it to Friday, {n}', hr >= 17 ? 'Friday night, {n}' : 'Almost the weekend, {n}');
    if (dow === 6 || dow === 0) list.push('Weekend mode, {n}', 'Lazy ' + day + ', {n}?', 'No alarms today, {n}?');
    if (dow === 0) list.push('Sunday reset, {n}');
    if (mon === 9) list.push('Spooky season, {n}');
    if (mon === 11) list.push('Cozy season, {n}');
    if (wx && /rain|drizzle|showers|thunder/.test(wx.text)) list.push('Rainy one, {n}');
    if (wx && /snow/.test(wx.text)) list.push('Snow day, {n}?');
    if (cold(wx, prefs, 32, 0)) list.push('Stay warm, {n}');
    return named(list);
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // The first holiday 0–21 days away, in this order.
  function holiday(now) {
    var y = now.getFullYear(), list = [['Halloween', 9, 31], ['Christmas', 11, 25], ['New Year’s Eve', 11, 31], ['Valentine’s Day', 1, 14], ['the Fourth of July', 6, 4]];
    var nov1 = new Date(y, 10, 1).getDay();
    list.push(['Thanksgiving', 10, 1 + ((4 - nov1 + 7) % 7) + 21]);
    var today = new Date(y, now.getMonth(), now.getDate());
    for (var i = 0; i < list.length; i++) {
      var d = Math.round((new Date(y, list[i][1], list[i][2]) - today) / 864e5);
      if (d === 0) return 'Happy ' + list[i][0].replace(/^the /, '') + '!';
      if (d === 1) return cap(list[i][0]) + ' is tomorrow';
      if (d > 1 && d <= 21) return cap(list[i][0]) + ' in ' + d + ' days';
    }
  }

  function subs(now, wx, prefs) {
    prefs = prefs || {};
    var hr = now.getHours(), min = now.getMinutes(), dow = now.getDay(), mon = now.getMonth();
    var h24 = prefs.clock24, time = fmt.time(now, h24), out = [];
    if (wx) {
      out.push(wx.temp + '° and ' + wx.text + (C.city ? ' in ' + C.city : ' out there'));
      var tmr = wx.days && wx.days[0] ? wx.days[0].text : '';
      if (/rain|snow|drizzle|showers|thunder/.test(tmr)) out.push(cap(tmr) + ' tomorrow. Good couch weather.');
      if (cold(wx, prefs, 40, 4)) out.push('Bundle up out there');
    }
    // Sunset "17:52" → 5:52 (12-hour, no AM/PM)
    var set = wx && wx.sunset ? wx.sunset.split(':').map(Number) : null;
    var setText = set ? (set[0] % 12 || 12) + ':' + (set[1] < 10 ? '0' : '') + set[1] : '';
    var afterSunset = set && hr * 60 + min >= set[0] * 60 + set[1];
    if (hr >= 5 && hr < 12) out.push('Coffee first, then shows', 'Sunrise was a while ago. No rush.');
    if (hr >= 12 && hr < 17) out.push('Perfect time for a matinee', !set || afterSunset ? '' : 'Sunset at ' + setText + ' tonight');
    if (hr >= 17 && hr < 22) out.push(!set ? '' : afterSunset ? 'Dark since ' + setText + '. Prime time.' : 'Sunset at ' + setText + '. Golden hour.', 'Prime time');
    if (hr >= 22 || hr < 5) out.push('It’s ' + time + '. One more, then bed?', 'The whole city’s asleep');
    if (dow >= 1 && dow <= 4) out.push((5 - dow) + (5 - dow === 1 ? ' day' : ' days') + ' to the weekend');
    if (dow === 5) out.push(hr >= 17 ? 'Friday night. Nowhere to be tomorrow.' : 'The weekend’s almost here');
    if (dow === 6) out.push('Nothing on the calendar but this');
    if (dow === 0) out.push('One more episode before Monday');
    if (mon === 9) out.push('Scary movie season');
    if (mon === 11) out.push('Peak holiday movie season');
    if (mon >= 5 && mon <= 7) out.push(C.city ? 'Summer nights in ' + C.city : 'Summer nights');
    // Calendar: the next timed event, if it's soon. Counted twice.
    if (prefs.greetCal !== false && window.calendar) {
      var next = calendar.events(now, prefs).filter(function (e) { return !e.allDay && e.start > now; })[0];
      if (next) {
        var mins = Math.round((next.start - now) / 6e4), lbl = calendar.dayLabel(next.start, now), at = fmt.time(next.start, h24);
        if (mins > 0 && mins <= 60) { var s = next.title + ' in ' + mins + (mins === 1 ? ' minute' : ' minutes'); out.push(s, s); }
        else if (mins > 60 && lbl === 'Today' && mins <= 360) out.push(next.title + ' at ' + at, next.title + ' at ' + at);
        else if (lbl === 'Tomorrow' && next.start.getHours() < 12 && (hr >= 21 || hr < 5)) out.push(next.title + ' at ' + at + ' tomorrow. Maybe just one episode.');
      }
    }
    var h = prefs.greetCountdown !== false ? holiday(now) : null;
    if (h) out.push(h, h);   // counted twice: a countdown is the most fun thing to see
    return out.filter(Boolean);
  }

  // Up to 12 tries for a line that differs from the one it replaces.
  function pick(list, cur) {
    var next = cur;
    for (var i = 0; i < 12 && next === cur; i++) next = list[Math.floor(Math.random() * list.length)];
    return next;
  }

  window.greeting = { hellos: hellos, subs: subs, holiday: holiday, pick: pick };
})();
