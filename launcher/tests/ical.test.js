// node --test launcher/tests
// The TV runs in Chicago; so do these tests. The window opens Mon Oct 26 2026, 8 AM, and its 14
// days cross the Nov 1 fall-back, so expected times are written with their own UTC offsets.
process.env.TZ = 'America/Chicago';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ical = require('../app/src/main/assets/ical.js');

const FROM = new Date('2026-10-26T08:00:00-05:00');
const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
const events = (name, opts) => ical.events(fixture(name), Object.assign({ from: FROM, name: 'Personal', color: '#0A84FF' }, opts));
const iso = (s) => new Date(s).getTime();
const starts = (list, title) => list.filter((e) => !title || e.title === title).map((e) => e.start.getTime());

test('event shape matches the mockup calendar', () => {
  const [e] = events('utc.ics');
  assert.ok(e.start instanceof Date && e.end instanceof Date);
  assert.equal(e.title, 'Dinner with Sam');
  assert.equal(e.cal, 'personal');
  assert.equal(e.calName, 'Personal');
  assert.equal(e.color, '#0A84FF');
  assert.equal(e.allDay, false);
  assert.equal(e.location, 'Au Cheval, Randolph St');
});

test('all-day events run local midnight to midnight; yearly repeats; past ones drop', () => {
  const list = events('allday.ics');
  assert.deepEqual(list.map((e) => e.title), ['Trash day', 'Halloween', "Mom's birthday"]);
  const [trash, hw, bday] = list;
  assert.equal(hw.allDay, true);
  assert.equal(+hw.start, iso('2026-10-31T00:00:00-05:00'));
  assert.equal(+hw.end, iso('2026-11-01T00:00:00-05:00'));
  assert.equal(+trash.end, iso('2026-10-29T00:00:00-05:00'), 'no DTEND means one day');
  assert.equal(+bday.start, iso('2026-11-03T00:00:00-06:00'));
});

test('TZID across the DST change keeps the wall-clock time', () => {
  const list = events('tzid-dst.ics');
  assert.deepEqual(starts(list, 'Standup'), [iso('2026-10-29T09:00:00-05:00'), iso('2026-11-05T09:00:00-06:00')]);
  const s = list.find((e) => e.title === 'Standup');
  assert.equal(s.end - s.start, 30 * 60e3);
  assert.deepEqual(starts(list, 'Call with NYC'), [iso('2026-11-02T10:00:00-05:00')], 'quoted TZID, another zone');
  assert.equal(list.find((e) => e.title === 'Call with NYC').start.getHours(), 9, '10 AM New York is 9 AM Chicago');
  assert.deepEqual(starts(list, 'Outlook meeting'), [iso('2026-11-03T13:00:00-06:00')], 'Windows zone name');
});

test('UTC times, DURATION, floating times, and alarms ignored', () => {
  const list = events('utc.ics');
  assert.deepEqual(list.map((e) => e.title), ['Dinner with Sam', 'Dentist', 'Movie night']);
  assert.equal(+list[0].start, iso('2026-10-27T23:00:00Z'));
  assert.equal(list[0].start.getHours(), 18);
  assert.equal(list[1].end - list[1].start, 45 * 60e3);
  assert.equal(+list[2].start, iso('2026-10-29T20:00:00-05:00'));
});

test('weekly BYDAY and INTERVAL', () => {
  const list = events('weekly-byday.ics');
  assert.deepEqual(starts(list, 'Gym'), [
    '2026-10-26T18:00:00-05:00', '2026-10-28T18:00:00-05:00', '2026-10-30T18:00:00-05:00',
    '2026-11-02T18:00:00-06:00', '2026-11-04T18:00:00-06:00', '2026-11-06T18:00:00-06:00'
  ].map(iso));
  assert.deepEqual(starts(list, 'Lunch every other Tuesday'), [iso('2026-11-03T12:00:00-06:00')]);
});

test('monthly -1FR, 2MO, and a 31st that skips short months', () => {
  const list = events('monthly.ics', { days: 21 });
  assert.deepEqual(starts(list, 'Last Friday drinks'), [iso('2026-10-30T17:00:00-05:00')]);
  assert.deepEqual(starts(list, 'Book club'), [iso('2026-11-09T10:00:00-06:00')]);
  assert.deepEqual(starts(list, 'Pay rent'), [iso('2026-10-31T09:00:00-05:00')]);
  const dec = ical.events(fixture('monthly.ics'), { from: new Date('2026-12-01T00:00:00-06:00'), days: 31 });
  assert.deepEqual(starts(dec, 'Last Friday drinks'), [iso('2026-12-25T17:00:00-06:00')]);
  assert.deepEqual(starts(dec, 'Book club'), [iso('2026-12-14T10:00:00-06:00')]);
});

test('COUNT counts from DTSTART; UNTIL as UTC time and as a date', () => {
  const list = events('count-until.ics');
  assert.deepEqual(starts(list, 'Five mornings'), [iso('2026-10-27T07:00:00-05:00'), iso('2026-10-28T07:00:00-05:00')]);
  assert.deepEqual(starts(list, 'Until Wednesday'), ['2026-10-26', '2026-10-27', '2026-10-28'].map((d) => iso(d + 'T20:00:00-05:00')));
  assert.deepEqual(starts(list, 'Weekly all-day until Nov 2'), [iso('2026-10-26T00:00:00-05:00'), iso('2026-11-02T00:00:00-06:00')]);
});

test('EXDATE with TZID lists and in UTC', () => {
  const list = events('exdate.ics');
  assert.deepEqual(starts(list, 'Lunch walk'), ['2026-10-26', '2026-10-28', '2026-10-30', '2026-10-31'].map((d) => iso(d + 'T12:00:00-05:00')));
  assert.deepEqual(starts(list, 'UTC daily'), ['2026-10-26', '2026-10-28', '2026-10-29'].map((d) => iso(d + 'T23:00:00Z')));
});

test('RECURRENCE-ID replaces one occurrence', () => {
  const list = events('override.ics');
  assert.deepEqual(list.map((e) => [e.title, +e.start]), [
    ['Trivia', iso('2026-10-27T19:00:00-05:00')],
    ['Trivia (moved)', iso('2026-11-04T20:00:00-06:00')]
  ]);
});

test('STATUS:CANCELLED drops events, series and single occurrences', () => {
  const list = events('cancelled.ics');
  assert.deepEqual(list.map((e) => [e.title, +e.start]), [
    ['Yoga', iso('2026-11-02T07:00:00-06:00')],
    ['Yoga', iso('2026-11-05T07:00:00-06:00')]
  ]);
});

test('folded lines and escapes, LF or CRLF', () => {
  const want = 'Dinner with Sam, Alex and Jordan at the place on Milwaukee Ave that we keep meaning to try';
  assert.equal(events('folded.ics')[0].title, want);
  const crlf = fixture('folded.ics').replace(/\n/g, '\r\n');
  assert.equal(ical.events(crlf, { from: FROM })[0].title, want);
  assert.match(ical.unfold('DESCRIPTION:a\r\n\tb\r\n c'), /^DESCRIPTION:abc/);
});

test('long-running repeats expand quickly', () => {
  const ics = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nDTSTART;TZID=America/Chicago:19900101T080000\nDTEND;TZID=America/Chicago:19900101T083000\n' +
    'RRULE:FREQ=DAILY;COUNT=20000\nSUMMARY:Since 1990\nEND:VEVENT\nBEGIN:VEVENT\nUID:y\nDTSTART;VALUE=DATE:20000229\nRRULE:FREQ=YEARLY\nSUMMARY:Leap day\nEND:VEVENT\nEND:VCALENDAR\n';
  const t = Date.now();
  const list = ical.events(ics, { from: FROM });
  assert.ok(Date.now() - t < 500, 'took ' + (Date.now() - t) + 'ms');
  assert.equal(list.filter((e) => e.title === 'Since 1990').length, 14, 'Oct 26 (in progress at 8:00) – Nov 8');
  const leap = ical.events(ics, { from: new Date('2028-02-20T00:00:00-06:00') }).filter((e) => e.title === 'Leap day');
  assert.deepEqual(leap.map((e) => +e.start), [iso('2028-02-29T00:00:00-06:00')]);
});

test('calendars.txt config', () => {
  assert.deepEqual(ical.config(fixture('calendars.txt')), [
    { name: 'Personal', key: 'personal', color: '#0A84FF', url: 'https://calendar.google.com/calendar/ical/example/private-xxx/basic.ics' },
    { name: 'Sports', key: 'sports', color: '#64D2FF', url: 'webcal://example.com/sports.ics?a=1|b' }
  ]);
});

test('zone names', () => {
  assert.equal(ical.zone('/mozilla.org/20050126_1/America/Chicago'), 'America/Chicago');
  assert.equal(ical.zone('Eastern Standard Time'), 'America/New_York');
  assert.equal(ical.zone('Etc/UTC'), 'UTC');
  assert.equal(ical.zone('Not/AZone'), 'local');
  assert.equal(ical.msOf(Date.UTC(2026, 10, 1, 1, 30), 'America/Chicago'), iso('2026-11-01T01:30:00-05:00'));
  assert.equal(ical.msOf(Date.UTC(2026, 10, 1, 3, 0), 'America/Chicago'), iso('2026-11-01T03:00:00-06:00'));
});
