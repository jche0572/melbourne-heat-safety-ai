const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const mobile = path.resolve(__dirname, '../../mobile');

function moduleFrom(file, names, globals = {}) {
  const code = fs.readFileSync(path.join(mobile, file), 'utf8')
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/export /g, '');
  return vm.runInNewContext(`${code}\n;({${names.join(',')}})`, {
    Date, Intl, console: { error() {} }, setTimeout, clearTimeout, AbortController, ...globals,
  });
}
function setup(fetch) {
  const values = new Map();
  let failWrite = false;
  const dates = moduleFrom('utils/activityDateTime.js', ['toMelbourneIso']);
  const storage = moduleFrom('services/eventStorageService.js', ['saveEvent', 'getStoredEvents', 'updateEvent', 'deleteEvent'], {
    ...dates,
    localStorage: { getItem: k => values.get(k), setItem: (k, v) => {
      if (failWrite) throw Error('storage full');
      values.set(k, v);
    } },
  });
  const freshService = () => moduleFrom('services/activityRecommendationService.js', ['getSavedActivityRecommendation'], {
    ...storage, ...dates, API_BASE_URL: 'http://localhost:4000', fetch,
    getPersonalThermalProfile: () => ({ personalBias: 0, feedbackCount: 0 }),
  });
  const event = storage.saveEvent({ title: 'Walk', location: 'Melbourne', startDate: '2026-09-17', endDate: '2026-09-17', startTime: '14:00', endTime: '15:00' });
  return { storage, freshService, event, setFailWrite: value => { failWrite = value; } };
}
const result = {
  shortRecommendation: 'First result', practicalAdvice: ['Shade', 'Water', 'Breaks'],
  forecast: { hours: [{ forecastTime: '2026-09-17T04:00:00Z', temperatureC: 29, uvIndex: 7 }] },
  alternativeTimeRecommended: true,
  suggestedAlternativeTime: { startTime: '2026-09-17T15:00:00+10:00', endTime: '2026-09-17T16:00:00+10:00' },
  environmentSummary: { heatCategory: 'HIGH', uvCategory: 'HIGH' },
  recommendation: { recommendation: 'First result', summary: 'Original forecast', practicalActions: ['Shade', 'Water', 'Breaks'], limitations: ['Snapshot'] },
  rag: { status: 'available', retrievedCount: 1 }, evidence: [{ chunkId: 'first-evidence' }], recommendationStatus: 'gemini',
};
const response = data => ({ ok: true, json: async () => data });
const equal = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));

test('saved guidance is reused until the schedule changes', async () => {
  let calls = 0;
  const context = setup(async () => { calls++; return response(result); });
  const api = context.freshService();
  equal(await api.getSavedActivityRecommendation(context.event.id), result);
  equal(context.storage.getStoredEvents()[0].activityRecommendation, result);
  await api.getSavedActivityRecommendation(context.event.id);
  context.storage.updateEvent(context.event.id, { title: 'Edited', startTime: '13:00' });
  const restarted = context.freshService();
  equal(await restarted.getSavedActivityRecommendation(context.event.id), result);
  assert.equal(calls, 2);
  assert.equal(context.storage.getStoredEvents().length, 1);
  assert.equal(context.storage.getStoredEvents()[0].id, context.event.id);
});

test('concurrent opens share work; an edit during generation is preserved', async () => {
  let finish, calls = 0;
  const context = setup(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const api = context.freshService();
  const first = api.getSavedActivityRecommendation(context.event.id);
  const second = api.getSavedActivityRecommendation(context.event.id);
  assert.equal(calls, 1);
  context.storage.updateEvent(context.event.id, { title: 'Edited while waiting' });
  finish(response(result));
  await Promise.all([first, second]);
  assert.equal(context.storage.getStoredEvents()[0].title, 'Edited while waiting');
  equal(await context.freshService().getSavedActivityRecommendation(context.event.id), result);
  assert.equal(calls, 1);
});

test('HTTP/network/malformed failures are never saved and allow retry', async () => {
  for (const failed of [async () => ({ ok: false }), async () => { throw Error('offline'); }, async () => response({ error: 'invalid' })]) {
    let calls = 0;
    const context = setup(async () => { calls++; return calls === 1 ? failed() : response(result); });
    const api = context.freshService();
    await assert.rejects(api.getSavedActivityRecommendation(context.event.id));
    assert.equal(context.storage.getStoredEvents()[0].activityRecommendation, undefined);
    equal(await api.getSavedActivityRecommendation(context.event.id), result);
    assert.equal(calls, 2);
  }
});

test('storage failure is surfaced; a deleted event is never resurrected', async () => {
  const context = setup(async () => response(result));
  context.setFailWrite(true);
  await assert.rejects(context.freshService().getSavedActivityRecommendation(context.event.id));
  assert.equal(context.storage.getStoredEvents()[0].activityRecommendation, undefined);
  let finish;
  const deleted = setup(() => new Promise(resolve => { finish = resolve; }));
  const pending = deleted.freshService().getSavedActivityRecommendation(deleted.event.id);
  deleted.storage.deleteEvent(deleted.event.id);
  finish(response(result));
  await assert.rejects(pending);
  assert.equal(deleted.storage.getStoredEvents().length, 0);
});

test('an already-persisted winner is not overwritten by a late response', async () => {
  let finish;
  const context = setup(() => new Promise(resolve => { finish = resolve; }));
  const pending = context.freshService().getSavedActivityRecommendation(context.event.id);
  context.storage.updateEvent(context.event.id, { activityRecommendation: result });
  finish(response({ ...result, shortRecommendation: 'Later response', recommendation: { ...result.recommendation, recommendation: 'Later response' } }));
  equal(await pending, result);
  equal(context.storage.getStoredEvents()[0].activityRecommendation, result);
});

test('a late old-time response is retried for the accepted recommended time', async () => {
  let finishOld;
  const requestedTimes = [];
  const freshResult = { ...result, shortRecommendation: 'Fresh forecast', recommendation: { ...result.recommendation, recommendation: 'Fresh forecast' }, forecast: { hours: [{ temperatureC: 21 }] } };
  const context = setup(async (_url, options) => {
    requestedTimes.push(JSON.parse(options.body).startTime);
    return requestedTimes.length === 1
      ? new Promise(resolve => { finishOld = resolve; })
      : response(freshResult);
  });

  const pending = context.freshService().getSavedActivityRecommendation(context.event.id);
  context.storage.updateEvent(context.event.id, {
    startTime: '13:00',
    acceptedRecommendedTime: true,
  });
  finishOld(response(result));

  const saved = await pending;
  assert.equal(requestedTimes.length, 2);
  assert.notEqual(requestedTimes[0], requestedTimes[1]);
  assert.equal(saved.forecast.hours[0].temperatureC, 21);
  assert.equal(saved.alternativeTimeRecommended, false);
  equal(context.storage.getStoredEvents()[0].activityRecommendation, saved);
});

test('accepted recommended time refreshes guidance without offering another time', async () => {
  const context = setup(async () => response(result));
  context.storage.updateEvent(context.event.id, {
    acceptedRecommendedTime: true,
    activityRecommendation: null,
  });

  const updated = await context.freshService().getSavedActivityRecommendation(context.event.id);
  assert.equal(updated.alternativeTimeRecommended, false);
  assert.equal(updated.suggestedAlternativeTime, null);
  assert.match(updated.shortRecommendation, /updated forecast/);
  assert.deepEqual(JSON.parse(JSON.stringify(updated.forecast)), result.forecast);
  assert.deepEqual(JSON.parse(JSON.stringify(updated.practicalAdvice)), result.practicalAdvice);
  equal(context.storage.getStoredEvents()[0].activityRecommendation, updated);

  context.storage.updateEvent(context.event.id, {
    startTime: '13:00',
    activityRecommendation: null,
  });
  const afterManualEdit = await context.freshService().getSavedActivityRecommendation(context.event.id);
  assert.equal(afterManualEdit.alternativeTimeRecommended, true);
});
