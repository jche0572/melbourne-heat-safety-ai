const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('../../mobile/node_modules/@babel/core');

const servicePath = path.resolve(__dirname, '../../mobile/services/eventStorageService.js');
const datePath = path.resolve(__dirname, '../../mobile/utils/activityDateTime.js');
const overlapMessage = /This time overlaps with an existing event/;

const dateExports = {};
vm.runInNewContext(babel.transformSync(fs.readFileSync(datePath, 'utf8'), {
  babelrc: false,
  configFile: false,
  plugins: [require('../../mobile/node_modules/@babel/plugin-transform-modules-commonjs')],
}).code, { exports: dateExports, Date, Intl });

function setup() {
  const values = new Map();
  let writes = 0;
  const localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { writes++; values.set(key, value); },
  };
  const code = babel.transformSync(fs.readFileSync(servicePath, 'utf8'), {
    babelrc: false,
    configFile: false,
    plugins: [require('../../mobile/node_modules/@babel/plugin-transform-modules-commonjs')],
  }).code;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    Date,
    console: { error() {}, warn() {} },
    localStorage,
    require: name => {
      if (name === './deviceStorage') return { default: localStorage, __esModule: true };
      if (name === '../utils/activityDateTime') {
        return dateExports;
      }
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return {
    ...exports,
    raw: () => values.get('shadeadapt_events'),
    seed: events => values.set('shadeadapt_events', JSON.stringify(events)),
    writes: () => writes,
  };
}

function event(startTime, endTime, title = `${startTime}-${endTime}`) {
  return {
    title,
    location: 'Melbourne',
    startDate: '2026-10-09',
    endDate: '2026-10-09',
    startTime,
    endTime,
  };
}

test('saveEvent rejects every overlap shape without writing storage', () => {
  for (const [start, end] of [
    ['11:30', '12:30'],
    ['13:30', '14:30'],
    ['12:30', '13:30'],
    ['11:00', '15:00'],
  ]) {
    const storage = setup();
    storage.saveEvent(event('12:00', '14:00', 'Existing'));
    const before = storage.raw();
    const writes = storage.writes();

    assert.throws(() => storage.saveEvent(event(start, end)), overlapMessage);
    assert.equal(storage.raw(), before);
    assert.equal(storage.writes(), writes);
  }
});

test('saveEvent allows events that only touch an existing boundary', () => {
  const storage = setup();
  storage.saveEvent(event('12:00', '14:00', 'Existing'));
  storage.saveEvent(event('10:00', '12:00', 'Before'));
  storage.saveEvent(event('14:00', '15:00', 'After'));

  assert.equal(storage.getStoredEvents().length, 3);
});

test('updateEvent allows an event to keep its own time', () => {
  const storage = setup();
  const saved = storage.saveEvent(event('12:00', '14:00'));

  const updated = storage.updateEvent(saved.id, {
    startTime: '12:00',
    endTime: '14:00',
  });

  assert.equal(updated.id, saved.id);
  assert.equal(updated.startTime, '12:00');
  assert.equal(storage.getStoredEvents().length, 1);
});

test('updateEvent preserves a legacy overlap when its schedule is unchanged', () => {
  const storage = setup();
  storage.seed([
    { id: 'first', ...event('12:00', '14:00', 'First') },
    { id: 'second', ...event('13:00', '15:00', 'Second') },
  ]);

  const updated = storage.updateEvent('first', {
    ...event('12:00', '14:00', 'Renamed'),
  });

  assert.equal(updated.title, 'Renamed');
  assert.equal(storage.getStoredEvents().length, 2);
});

test('updateEvent rejects another event overlap without writing storage', () => {
  const storage = setup();
  storage.saveEvent(event('12:00', '14:00', 'First'));
  const second = storage.saveEvent(event('15:00', '16:00', 'Second'));
  const before = storage.raw();
  const writes = storage.writes();

  assert.throws(
    () => storage.updateEvent(second.id, { startTime: '13:30' }),
    overlapMessage,
  );
  assert.equal(storage.raw(), before);
  assert.equal(storage.writes(), writes);
});

test('recommendation-only updates still persist', () => {
  const storage = setup();
  const saved = storage.saveEvent(event('12:00', '14:00'));
  const recommendation = { shortRecommendation: 'Use shade.' };

  const updated = storage.updateEvent(saved.id, {
    activityRecommendation: recommendation,
  });

  assert.deepEqual(updated.activityRecommendation, recommendation);
  assert.equal(storage.writes(), 2);
});

test('recommended time updates the same event and clears its old guidance', () => {
  const storage = setup();
  const saved = storage.saveEvent({
    ...event('12:00', '13:00', 'Walk'),
    activityRecommendation: { shortRecommendation: 'Old forecast' },
  });

  const updated = storage.changeEventToRecommendedTime(saved.id, {
    startTime: '2026-10-09T15:00:00+11:00',
    endTime: '2026-10-09T16:00:00+11:00',
  });

  assert.equal(updated.id, saved.id);
  assert.equal(updated.startTime, '15:00');
  assert.equal(updated.endTime, '16:00');
  assert.equal(updated.activityRecommendation, null);
  assert.equal(updated.acceptedRecommendedTime, true);
  assert.equal(storage.getStoredEvents().length, 1);
});

test('manual schedule edit allows future alternative-time suggestions again', () => {
  const storage = setup();
  const saved = storage.saveEvent({
    ...event('12:00', '13:00', 'Walk'),
    activityRecommendation: { shortRecommendation: 'Old forecast' },
  });
  storage.changeEventToRecommendedTime(saved.id, {
    startTime: '2026-10-09T15:00:00+11:00',
    endTime: '2026-10-09T16:00:00+11:00',
  });

  storage.updateEvent(saved.id, {
    activityRecommendation: { shortRecommendation: 'Accepted-time forecast' },
  });
  const edited = storage.updateEvent(saved.id, { startTime: '14:00' });
  assert.equal(edited.acceptedRecommendedTime, false);
  assert.equal(edited.activityRecommendation, null);
});

test('recommended time rejects overlap and cross-day slots without changing storage', () => {
  const storage = setup();
  const saved = storage.saveEvent(event('12:00', '13:00', 'Walk'));
  storage.saveEvent(event('15:00', '16:00', 'Other event'));
  const before = storage.raw();

  assert.throws(() => storage.changeEventToRecommendedTime(saved.id, {
    startTime: '2026-10-09T15:00:00+11:00',
    endTime: '2026-10-09T16:00:00+11:00',
  }), overlapMessage);
  assert.throws(() => storage.changeEventToRecommendedTime(saved.id, {
    startTime: '2026-10-09T23:00:00+11:00',
    endTime: '2026-10-10T00:00:00+11:00',
  }), /within one day/);
  assert.equal(storage.raw(), before);
});
