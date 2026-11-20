const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('../node_modules/@babel/core');

function load(file, imports = {}, globals = {}) {
  const code = babel.transformSync(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    babelrc: false,
    configFile: false,
    plugins: [require('../node_modules/@babel/plugin-transform-modules-commonjs')],
  }).code;
  const exports = {};
  vm.runInNewContext(code, {
    exports, Date, Intl, console: { error() {}, warn() {} }, ...globals,
    require(name) {
      assert.ok(name in imports, `Unexpected import: ${name}`);
      return imports[name];
    },
  });
  return exports;
}

test('native event and feedback flows persist across module reloads without browser globals', () => {
  const values = new Map();
  const sqlite = {
    getItemSync: key => values.get(key) ?? null,
    setItemSync: (key, value) => values.set(key, value),
  };
  const storage = load('services/deviceStorage.native.js', { 'expo-sqlite/kv-store': sqlite });
  const dates = load('utils/activityDateTime.js');
  const imports = { './deviceStorage': storage, '../utils/activityDateTime': dates };
  const events = load('services/eventStorageService.js', imports);
  const event = events.saveEvent({
    title: 'Walk', location: 'Melbourne Central',
    startDate: '2020-10-09', endDate: '2020-10-09',
    startTime: '14:00', endTime: '15:00',
  });
  const reloaded = load('services/eventStorageService.js', imports);
  assert.equal(reloaded.getStoredEvents()[0].id, event.id);
  reloaded.updateEvent(event.id, { title: 'Evening walk' });
  assert.equal(events.getStoredEvents()[0].title, 'Evening walk');

  const feedbackImports = { ...imports, './eventStorageService': events };
  const feedback = load('services/feedbackStorageService.js', feedbackImports);
  assert.equal(feedback.getPendingFeedbackCount(), 1);
  feedback.saveFeedback(event.id, 'not_warm');
  const reloadedFeedback = load('services/feedbackStorageService.js', feedbackImports);
  assert.equal(reloadedFeedback.getStoredFeedback()[0].answer, 'not_warm');
  assert.equal(reloadedFeedback.getPendingFeedbackCount(), 0);

  events.changeEventToRecommendedTime(event.id, {
    startTime: '2020-10-09T17:00:00+11:00', endTime: '2020-10-09T18:00:00+11:00',
  });
  assert.equal(reloaded.getStoredEvents()[0].acceptedRecommendedTime, true);
  assert.equal(reloaded.getStoredEvents()[0].startTime, '17:00');
  reloaded.deleteEvent(event.id);
  assert.equal(events.getStoredEvents().length, 0);
});

test('web adapter keeps existing browser data and propagates write errors', () => {
  const values = new Map([['shadeadapt_events', '[{"id":"existing"}]']]);
  const storage = load('services/deviceStorage.js', {}, {
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: () => { throw new Error('storage full'); },
    },
  }).default;
  assert.equal(storage.getItem('shadeadapt_events'), '[{"id":"existing"}]');
  assert.throws(() => storage.setItem('shadeadapt_events', '[]'), /storage full/);
  assert.equal(storage.getItem('shadeadapt_events'), '[{"id":"existing"}]');
});

test('time conflicts reject writes without console errors; storage failures still log', () => {
  let stored = '[]';
  const errors = [];
  const dates = load('utils/activityDateTime.js');
  const storage = { getItem: () => stored, setItem: (_, value) => { stored = value; } };
  const events = load('services/eventStorageService.js', {
    './deviceStorage': { default: storage, __esModule: true }, '../utils/activityDateTime': dates,
  }, { console: { error: (...args) => errors.push(args) } });
  const draft = { title: 'Walk', location: 'Melbourne', startDate: '2026-10-10', endDate: '2026-10-10', startTime: '14:00', endTime: '15:00' };
  events.saveEvent(draft);
  const original = stored;
  assert.throws(() => events.saveEvent(draft), /overlaps/);
  assert.equal(stored, original);
  assert.equal(errors.length, 0);
  storage.setItem = () => { throw new Error('disk full'); };
  assert.throws(() => events.saveEvent({ ...draft, startTime: '15:00', endTime: '16:00' }), /disk full/);
  assert.equal(errors.length, 1);
});

test('native suburb lookup uses device geocoding and falls back to backend', async () => {
  let addresses = [{ district: 'Carlton', city: 'Melbourne' }];
  let requests = 0;
  const service = load('services/locationSearchService.js', {
    '../config/api': { API_BASE_URL: 'https://example.test' },
    'react-native': { Platform: { OS: 'ios' } },
    'expo-location': { reverseGeocodeAsync: async () => addresses },
  }, { fetch: async () => { requests++; return { ok: true, json: async () => ({ suburb: 'Melbourne' }) }; } });
  assert.equal(await service.getSuburbFromCoordinates(-37.8, 145), 'Carlton');
  assert.equal(requests, 0);
  addresses = [];
  assert.equal(await service.getSuburbFromCoordinates(-37.8, 145), 'Melbourne');
  assert.equal(requests, 1);
});
