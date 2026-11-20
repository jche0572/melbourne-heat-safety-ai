const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const babel = require('../../mobile/node_modules/@babel/core');

// Exercise the actual screen callbacks with isolated hook, storage and network adapters.
// This does not replace a browser layout/accessibility check.
function screen(file, params, events, recommend = async () => recommendation) {
  let cursor = 0, focus, cleanup;
  let hooks = [];
  const calls = [], childHooks = new Map();
  const react = {
    createElement(type, props, ...children) {
      if (typeof type !== 'function') return { type, props: props || {}, children };
      const parent = { hooks, cursor, focus };
      hooks = childHooks.get(type) ?? [];
      childHooks.set(type, hooks);
      cursor = 0;
      try { return type({ ...props, children }); }
      finally { ({ hooks, cursor, focus } = parent); }
    },
    useState(initial) {
      const i = cursor++;
      if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial;
      return [hooks[i], value => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }];
    },
    useRef(initial) { const i = cursor++; return hooks[i] ??= { current: initial }; },
    useCallback: fn => fn,
    useMemo: fn => fn(),
    useEffect: () => {},
  };
  const storage = {
    getStoredEvents: () => events,
    saveEvent: data => { const saved = { ...data, id: 'new-event' }; events.push(saved); return saved; },
    updateEvent: (id, data) => {
      const found = events.find(e => e.id === id);
      if (found) Object.assign(found, data);
      return found;
    },
    deleteEvent: id => { const i = events.findIndex(e => e.id === id); if (i >= 0) events.splice(i, 1); },
  };
  const dates = fs.readFileSync(path.join(root, 'mobile/utils/activityDateTime.js'), 'utf8').replace(/export /g, '');
  const dateHelpers = vm.runInNewContext(dates + '\n;({toMelbourneIso,eventTimeFields})', { Date, Intl });
  const native = new Proxy({ StyleSheet: { create: x => x }, Platform: { OS: 'web' } }, { get: (obj, key) => obj[key] ?? key });
  const modules = {
    react, 'react-native': native, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '@react-navigation/native': { useFocusEffect: fn => { focus = fn; } },
    '../services/eventStorageService': storage,
    '../services/activityRecommendationService': { getSavedActivityRecommendation: async id => {
      const event = storage.getStoredEvents().find(item => item.id === id);
      if (event.activityRecommendation) return event.activityRecommendation;
      const result = await recommend(event);
      storage.updateEvent(id, { activityRecommendation: result });
      return result;
    } },
    '../utils/activityDateTime': dateHelpers,
    '../components/HourlyAtmosphereSection': { __esModule: true, default: 'HourlyAtmosphereSection' },
    '../services/locationSearchService': {},
    '../theme/useAppTheme': { useThemedStyles: base => ({ styles: base, theme: { dark: false, color: value => value } }) },
    'expo-speech': { stop() {}, VoiceQuality: { Enhanced: 'Enhanced' } },
    'expo-audio': { setAudioModeAsync: async () => {} },
    '@react-native-picker/picker': { Picker: 'Picker' },
  };
  function loadComponent(name) {
    const code = babel.transformSync(fs.readFileSync(path.join(root, 'mobile/components', name + '.js'), 'utf8'), {
      babelrc: false, configFile: false,
      plugins: [require('../../mobile/node_modules/@babel/plugin-transform-react-jsx'), require('../../mobile/node_modules/@babel/plugin-transform-modules-commonjs')],
    }).code;
    const exports = {};
    vm.runInNewContext(code, { exports, Date, Intl, console,
      require: name => { if (!(name in modules)) throw Error(name); return modules[name]; },
    });
    return { __esModule: true, default: exports.default };
  }
  modules['../components/ActivityRecommendationContent'] = loadComponent('ActivityRecommendationContent');
  modules['../components/RecommendedTimeConfirmation'] = loadComponent('RecommendedTimeConfirmation');
  const code = babel.transformSync(fs.readFileSync(path.join(root, 'mobile/screens', file), 'utf8'), {
    babelrc: false, configFile: false,
    plugins: [require('../../mobile/node_modules/@babel/plugin-transform-react-jsx'), require('../../mobile/node_modules/@babel/plugin-transform-modules-commonjs')],
  }).code;
  const exports = {};
  vm.runInNewContext(code, { exports, Date, Intl, console, window: { confirm: () => true },
    require: name => { if (!(name in modules)) throw Error(name); return modules[name]; },
  });
  const navigation = Object.fromEntries(['navigate', 'replace', 'goBack', 'popTo'].map(method => [method, (...args) => calls.push([method, ...args])]));
  navigation.setParams = updates => Object.assign(params, updates);
  const render = () => { cursor = 0; return exports.default({ route: { params }, navigation }); };
  const focusScreen = () => { cleanup?.(); render(); cleanup = focus(); };
  let refresh = 0;
  return { render, calls, focus: focusScreen, blur: () => cleanup?.(),
    openUpdatedRecommendation: () => { params.recommendationRefreshKey = `edit-${++refresh}`; focusScreen(); } };
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...tree.children.flatMap(nodes)];
}
function text(tree) {
  if (typeof tree === 'string') return tree;
  if (!tree || typeof tree !== 'object') return '';
  return (Array.isArray(tree) ? tree : tree.children).map(text).join(' ');
}
function button(tree, label) {
  const found = nodes(tree).find(n => n.props.onPress && (n.props.accessibilityLabel === label || text(n).trim() === label));
  assert.ok(found, `Button ${label} exists`);
  return found.props.onPress;
}
const recommendation = {
  shortRecommendation: 'Forecast reviewed', practicalAdvice: ['Check forecast', 'Bring water', 'Take breaks'],
  forecast: { hours: [{ forecastTime: '2026-09-13T04:00:00Z', temperatureC: 25, uvIndex: 4 }] },
  alternativeTimeRecommended: true,
  suggestedAlternativeTime: { startTime: '2026-09-13T15:00:00+10:00', endTime: '2026-09-13T16:00:00+10:00' },
};
const activity = { id: 'existing', title: 'Walk', location: 'Melbourne', startDate: '2026-09-13', endDate: '2026-09-13', startTime: '14:00', endTime: '15:00' };

test('details loads guidance once; edit popup closes, reuses saved result, and retains edit/delete', async () => {
  const events = [{ ...activity }];
  let calls = 0;
  const view = screen('EventDetailsScreen.js', { eventId: activity.id }, events, async () => { calls++; return recommendation; });
  view.focus(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
  assert.equal(nodes(view.render()).filter(n => n.type === 'Modal' && n.props.visible).length, 0);
  assert.match(text(view.render()), /Forecast reviewed/);
  view.openUpdatedRecommendation(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
  assert.equal(nodes(view.render()).find(n => n.type === 'Modal').props.visible, true);
  assert.match(text(view.render()), /Check forecast/);
  assert.match(text(view.render()), /Bring water/);
  assert.match(text(view.render()), /Take breaks/);
  assert.doesNotMatch(text(view.render()), /Confirm|Ignore/);
  assert.equal(events[0].startTime, '14:00');
  button(view.render(), 'I understand')();
  assert.equal(nodes(view.render()).filter(n => n.type === 'Modal' && n.props.visible).length, 0);
  view.openUpdatedRecommendation(); await new Promise(resolve => setImmediate(resolve));
  view.blur(); view.focus();
  view.openUpdatedRecommendation(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
  button(view.render(), 'I understand')();
  button(view.render(), 'Edit event')();
  assert.equal(view.calls.at(-1)[2].eventId, activity.id);
  button(view.render(), 'Delete event')();
  assert.equal(events.length, 0);
});

test('reopened details keeps complete saved guidance after an event edit', async () => {
  const events = [{ ...activity, title: 'Edited walk', activityRecommendation: recommendation }];
  let calls = 0;
  const view = screen('EventDetailsScreen.js', { eventId: activity.id }, events, async () => { calls++; throw Error('Should not request'); });
  view.focus();
  view.openUpdatedRecommendation(); await new Promise(resolve => setImmediate(resolve));
  assert.match(text(view.render()), /Edited walk/);
  assert.match(text(view.render()), /Forecast reviewed/);
  assert.equal(calls, 0);
  assert.equal(events[0].activityRecommendation.suggestedAlternativeTime.startTime, recommendation.suggestedAlternativeTime.startTime);
});

test('popup retries failures and closing during a request does not discard its saved result', async () => {
  const events = [{ ...activity }];
  let calls = 0, finish;
  const view = screen('EventDetailsScreen.js', { eventId: activity.id, recommendationRefreshKey: 'initial-edit' }, events, () => {
    calls++;
    if (calls === 1) return Promise.reject(Error('offline'));
    return new Promise(resolve => { finish = resolve; });
  });
  view.focus();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(text(view.render()), /Recommendation unavailable/);
  assert.equal(events[0].activityRecommendation, undefined);
  button(view.render(), 'Retry recommendation')();
  button(view.render(), 'I understand')();
  assert.equal(calls, 2);
  view.blur();
  finish(recommendation); await new Promise(resolve => setImmediate(resolve));
  assert.equal(events[0].activityRecommendation, recommendation);
  view.focus();
  view.openUpdatedRecommendation(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 2);
  assert.match(text(view.render()), /Forecast reviewed/);
});

test('details renders practical advice without guidance sources', async () => {
  const delivered = {
    ...recommendation,
    recommendationStatus: 'fallback',
    recommendation: {
      recommendation: 'Consider moving the activity to 3:00 PM.',
      summary: 'At 2:00 PM, the forecast is 31°C and UV 8.',
      why: ['The heat category supports the supplied alternative.', 'The UV category supports using sun protection.'],
      practicalActions: ['Use sun protection.', 'Choose potential shade where available.', 'Bring water and take breaks as needed.'],
    },
    evidence: [
      { chunkId: 'RAG-1-C1', sourceId: 'RAG-1', title: 'First paper' },
      { chunkId: 'RAG-1-C2', sourceId: 'RAG-1', title: 'First paper' },
      { chunkId: 'RAG-2-C1', sourceId: 'RAG-2', title: 'Second paper' },
    ],
  };
  const view = screen('EventDetailsScreen.js', { eventId: activity.id }, [{ ...activity }], async () => delivered);
  view.focus(); await new Promise(resolve => setImmediate(resolve));
  view.openUpdatedRecommendation(); await new Promise(resolve => setImmediate(resolve));
  const initial = text(view.render());
  assert.match(initial, /Consider moving the activity to 3:00 PM/);
  assert.match(initial, /Using forecast-based guidance for this recommendation/);
  assert.match(initial, /What to do/);
  for (const action of delivered.recommendation.practicalActions) assert.ok(initial.includes(action));
  assert.doesNotMatch(initial, /Guidance sources|Why this advice\? Sources|First paper|Second paper/);
});

test('form creates once and returns to planner; editing updates the same event and refreshes details', () => {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const params = { ...activity, startDate: date, endDate: date };
  const events = [];
  const create = screen('EventPlannerScreen.js', params, events);
  const save = button(create.render(), 'Save Event');
  save(); save();
  assert.equal(events.length, 1);
  assert.equal(create.calls[0][0], 'popTo');
  assert.equal(create.calls[0][1], 'PlannerTimeline');
  assert.equal(create.calls[0][2].recommendationEventId, events[0].id);
  assert.ok(create.calls[0][2].recommendationPopupKey);
  events[0].activityRecommendation = recommendation;
  const edit = screen('EventPlannerScreen.js', { ...params, title: 'Updated walk', eventId: events[0].id }, events);
  button(edit.render(), 'Save Event')();
  assert.equal(events.length, 1);
  assert.equal(events[0].title, 'Updated walk');
  assert.equal(events[0].activityRecommendation, null);
  assert.equal(edit.calls[0][0], 'popTo');
  assert.equal(edit.calls[0][1], 'EventDetails');
  assert.equal(edit.calls[0][2].eventId, events[0].id);
  assert.ok(edit.calls[0][2].recommendationRefreshKey);
});
