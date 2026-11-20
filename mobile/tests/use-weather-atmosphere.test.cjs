const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('../node_modules/@babel/core');

function load(file, imports, globals = {}) {
  const exports = {};
  const code = babel.transformSync(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    babelrc: false, configFile: false,
    plugins: [require('../node_modules/@babel/plugin-transform-modules-commonjs')],
  }).code;
  vm.runInNewContext(code, { exports, Date, ...globals, require: name => imports[name] });
  return exports;
}

function mount() {
  const states = [], requests = [], timers = new Map(), listeners = new Set();
  let clock = 1791620000000, cursor = 0, dependencies, cleanup, pending, dirty;
  let props = [{ latitude: -37.8, longitude: 144.9 }, true], output;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = value; dirty = true; }];
    },
    useEffect(effect, deps) {
      if (!dependencies || deps.some((value, i) => value !== dependencies[i])) {
        pending = effect;
        dependencies = deps;
      }
    },
  };
  const AppState = {
    currentState: 'active',
    addEventListener(_, handler) { listeners.add(handler); return { remove: () => listeners.delete(handler) }; },
  };
  const utils = load('utils/weatherScene.js', {});
  const hook = load('utils/useWeatherAtmosphere.js', {
    react, 'react-native': { AppState }, './weatherScene': utils,
    '../services/weatherAtmosphereService': {
      getWeatherAtmosphere: (latitude, longitude) => new Promise(resolve => requests.push({ latitude, longitude, resolve })),
    },
  }, {
    Date: { now: () => clock },
    setInterval: (callback, ms) => { const id = {}; timers.set(id, { callback, ms }); return id; },
    clearInterval: id => timers.delete(id),
  }).default;
  function render(next = props) {
    props = next;
    do {
      dirty = false; cursor = 0;
      output = hook(...props);
      if (pending) { cleanup?.(); const effect = pending; pending = null; cleanup = effect(); }
    } while (dirty);
    return output;
  }
  render();
  return {
    render, requests, timers, listeners,
    get now() { return clock; },
    get output() { return output; },
    sample(patch = {}) { return { observedAt: clock, isDay: true, weatherCode: 0, ...patch }; },
    async settle(index, value) { requests[index].resolve(value); await new Promise(setImmediate); render(); },
    tick(ms) { clock += ms; for (const item of timers.values()) if (item.ms <= ms) item.callback(); render(); },
    appState(state) { AppState.currentState = state; for (const listener of listeners) listener(state); render(); },
    unmount() { cleanup?.(); },
  };
}

test('minute clock crosses sunset and expires stale observation without response', async () => {
  const app = mount();
  await app.settle(0, app.sample({ sunrise: app.now - 3600000, sunset: app.now + 30000 }));
  assert.equal(app.output.scene, 'sun');
  app.tick(60000);
  assert.equal(app.output.scene, 'night');
  app.tick(46 * 60000);
  assert.equal(app.output.scene, 'neutral');
  app.unmount();
});

test('location changes and out-of-order requests cannot display the old location', async () => {
  const app = mount();
  app.render([{ latitude: -37.9, longitude: 145 }, true]);
  assert.equal(app.requests[1].longitude, 145);
  await app.settle(1, app.sample({ weatherCode: 61 }));
  await app.settle(0, app.sample({ weatherCode: 0 }));
  assert.equal(app.output.scene, 'rain');
  app.appState('active');
  app.appState('active');
  await app.settle(3, app.sample({ weatherCode: 3 }));
  await app.settle(2, app.sample({ weatherCode: 0 }));
  assert.equal(app.output.scene, 'cloud');
  app.unmount();
});

test('blur disposes timers/listener and ignores pending result; focus refetches', async () => {
  const app = mount();
  assert.equal(app.timers.size, 2);
  app.render([{ latitude: -37.8, longitude: 144.9 }, false]);
  assert.equal(app.timers.size, 0);
  assert.equal(app.listeners.size, 0);
  await app.settle(0, app.sample());
  assert.equal(app.output.scene, 'neutral');
  app.render([{ latitude: -37.8, longitude: 144.9 }, true]);
  assert.equal(app.requests.length, 2);
  await app.settle(1, app.sample({ weatherCode: 3 }));
  assert.equal(app.output.scene, 'cloud');
  app.unmount();
});

test('background skips polling and foreground refreshes immediately', async () => {
  const app = mount();
  await app.settle(0, app.sample());
  app.appState('background');
  app.tick(10 * 60000);
  assert.equal(app.requests.length, 1);
  app.appState('active');
  assert.equal(app.requests.length, 2);
  await app.settle(1, app.sample({ isDay: false }));
  assert.equal(app.output.scene, 'night');
  app.unmount();
  assert.equal(app.timers.size, 0);
  assert.equal(app.listeners.size, 0);
});
