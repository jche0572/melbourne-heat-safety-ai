const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('../node_modules/@babel/core');

function load(file, imports = {}, globals = {}) {
  const code = babel.transformSync(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    babelrc: false, configFile: false,
    plugins: [require('../node_modules/@babel/plugin-transform-modules-commonjs')],
  }).code;
  const exports = {};
  vm.runInNewContext(code, {
    exports, Date, AbortController, setTimeout, clearTimeout, ...globals,
    require(name) { assert.ok(name in imports); return imports[name]; },
  });
  return exports;
}
const utils = load('utils/weatherScene.js');
const now = Date.now();
const observation = { observedAt: now, isDay: true, weatherCode: 0 };

test('WMO scenes and night precedence; unknown/stale never invent sunshine', () => {
  for (const code of [0, 1]) assert.equal(utils.getWeatherScene({ ...observation, weatherCode: code }, now), 'sun');
  for (const code of [2, 3, 45, 48, 71, 73, 75, 77, 85, 86]) assert.equal(utils.getWeatherScene({ ...observation, weatherCode: code }, now), 'cloud');
  for (const code of [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 97, 99]) assert.equal(utils.getWeatherScene({ ...observation, weatherCode: code }, now), 'rain');
  assert.equal(utils.getWeatherScene({ ...observation, isDay: false, weatherCode: 65 }, now), 'night');
  for (const patch of [{ weatherCode: 999 }, { weatherCode: null }, { isDay: null }, { observedAt: null }, { observedAt: now - 46 * 60000 }, { observedAt: now + 6 * 60000 }]) {
    assert.equal(utils.getWeatherScene({ ...observation, ...patch }, now), 'neutral');
  }
});

test('sunrise/sunset boundaries change without another weather request', () => {
  const day = { ...observation, sunrise: now - 1000, sunset: now + 1000 };
  assert.equal(utils.getWeatherScene(day, now), 'sun');
  assert.equal(utils.getWeatherScene(day, now + 1000), 'night');
  assert.equal(utils.getWeatherScene({ ...day, isDay: false }, now - 1001), 'night');
  assert.equal(utils.getWeatherScene({ ...day, isDay: false }, now - 1000), 'sun');
});

test('service uses current coordinates and Unix-time response, preserves temperature/UV boundary', async () => {
  let url;
  const service = load('services/weatherAtmosphereService.js', { '../utils/weatherScene': utils }, {
    fetch: async (value, options) => {
      url = value;
      assert.ok(options.signal instanceof AbortSignal);
      return { ok: true, json: async () => ({ current: { time: now / 1000, weather_code: 61, is_day: 1 } }) };
    },
  });
  const result = await service.getWeatherAtmosphere(-37.8, 144.9);
  assert.match(url, /latitude=-37.8&longitude=144.9/);
  assert.match(url, /timeformat=unixtime/);
  assert.equal(result.scene, 'rain');
  assert.equal(result.isLocationBased, true);
  assert.equal(result.temperature, undefined);
  assert.equal(result.uvIndex, undefined);
  await service.getWeatherAtmosphere(null, null);
  assert.match(url, /latitude=-37.8136&longitude=144.9631/);
});

test('network, malformed and timeout responses return neutral and clear timers', async () => {
  for (const fetch of [async () => { throw Error('offline'); }, async () => ({ ok: false }), async () => ({ ok: true, json: async () => ({ current: { weather_code: 0, is_day: 1 } }) })]) {
    let cleared = false;
    const service = load('services/weatherAtmosphereService.js', { '../utils/weatherScene': utils }, {
      fetch, setTimeout: () => 1, clearTimeout: () => { cleared = true; },
    });
    const result = await service.getWeatherAtmosphere();
    assert.equal(result.scene, 'neutral');
    assert.equal(result.locationLabel, 'Melbourne CBD');
    assert.equal(cleared, true);
  }
  let abort;
  const service = load('services/weatherAtmosphereService.js', { '../utils/weatherScene': utils }, {
    setTimeout: callback => { abort = callback; return 1; }, clearTimeout() {},
    fetch: async (_, { signal }) => { abort(); assert.equal(signal.aborted, true); throw Error('aborted'); },
  });
  assert.equal((await service.getWeatherAtmosphere()).scene, 'neutral');
});
