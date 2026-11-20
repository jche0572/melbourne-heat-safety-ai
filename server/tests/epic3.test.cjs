const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const forecast = require('../utils/activityForecast');

// Load pure frontend ES modules without adding a test/build dependency.
function frontend(file, names, globals = {}) {
  const code = fs.readFileSync(path.join(root, 'mobile', file), 'utf8')
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/export /g, '');
  return vm.runInNewContext(`${code}\n;({${names.join(',')}})`, {
    Intl, Date, setTimeout, clearTimeout, AbortController, console,
    getPersonalThermalProfile: () => ({ personalBias: 0, feedbackCount: 0 }),
    ...globals,
  });
}
const dates = frontend('utils/activityDateTime.js', ['toMelbourneIso', 'eventTimeFields']);
const event = { title: 'Walk', location: 'Melbourne', startDate: '2026-09-13', endDate: '2026-09-13', startTime: '14:00', endTime: '15:00' };
const rows = [13, 14, 15].map((hour, i) => ({
  forecast_time: `2026-09-13T${hour}:00:00+10:00`,
  apparent_temperature_c: [32, 30, 25][i], temperature_c: [26, 25, 23][i], uv_index: [7, 6, 2][i],
  relative_humidity: 50, wind_speed_10m_ms: 2, shortwave_radiation_wm2: 100,
}));
const predictThermal = async hour => {
  const warm = hour.apparent_temperature_c > 25 ? 0.8 : 0.1;
  return { probabilities: { Warm: warm, 'Not warm / OK': 1 - warm } };
};

test('teammate heat and UV categories cover exact boundaries and unavailable data', () => {
  for (const [value, category] of [[23.9, 'LOW'], [24, 'MODERATE'], [26.9, 'MODERATE'], [27, 'HIGH'], [29.9, 'HIGH'], [30, 'EXTREME'], [null, 'UNAVAILABLE']]) {
    const summary = forecast.summarizeForecastHours([{ temperature_c: value, apparent_temperature_c: 45 }]);
    assert.equal(summary.heatCategory, category);
  }
  for (const [value, category] of [[2.9, 'LOW'], [3, 'MODERATE'], [5.9, 'MODERATE'], [6, 'HIGH'], [7.9, 'HIGH'], [8, 'EXTREME'], [10, 'EXTREME'], [11, 'EXTREME'], [null, 'UNAVAILABLE']]) {
    assert.equal(forecast.summarizeForecastHours([{ uv_index: value }]).uvCategory, category);
  }
  assert.equal(forecast.summarizeForecastHours([]).heatCategory, 'UNAVAILABLE');
  const summary = forecast.summarizeForecastHours([{ temperature_c: 23 }, { temperature_c: 30 }]);
  assert.equal(summary.heatCategory, 'EXTREME');
});

test('Gemini input receives deterministic heat and UV categories', () => {
  const language = require('../services/activityRecommendationLlm');
  const environment = forecast.summarizeForecastHours([{ temperature_c: 27, apparent_temperature_c: 32, uv_index: 8 }]);
  const input = language.buildLlmInput({ activity: {}, environment, alternative: { recommended: false } });
  assert.equal(input.environment.heatCategory, 'HIGH');
  assert.equal(input.environment.uvCategory, 'EXTREME');
  assert.match(language.SYSTEM_INSTRUCTION, /Never change the supplied heat or UV category/);
});

test('Melbourne offsets, UTC conversion and DST gap validation', () => {
  assert.equal(dates.toMelbourneIso('2026-09-13', '14:00'), '2026-09-13T14:00:00+10:00');
  assert.equal(dates.toMelbourneIso('2026-12-13', '14:00'), '2026-12-13T14:00:00+11:00');
  assert.throws(() => dates.toMelbourneIso('2026-10-04', '02:30'));
  assert.equal(dates.eventTimeFields('2026-09-13T05:00:00Z', '2026-09-13T06:00:00Z').startTime, '15:00');
});

test('backend alternatives are true for improvement, false for equal or missing data', async () => {
  const original = { startTime: dates.toMelbourneIso(event.startDate, event.startTime), endTime: dates.toMelbourneIso(event.endDate, event.endTime) };
  const result = await forecast.findAlternativeTime(original, rows, predictThermal);
  assert.equal(result.alternativeTimeRecommended, true);
  assert.equal(result.suggestedAlternativeTime.startTime, '2026-09-13T15:00:00+10:00');
  assert.equal((await forecast.findAlternativeTime(original, rows.map(r => ({ ...r, apparent_temperature_c: 25, uv_index: 2 })), predictThermal)).alternativeTimeRecommended, false);
  assert.equal((await forecast.findAlternativeTime(original, [], predictThermal)).alternativeTimeRecommended, false);
  assert.equal(forecast.summarizeForecastHours(rows).uvCategory, 'HIGH');
});

test('POST serializes saved event and rejects HTTP or malformed responses', async () => {
  let request;
  const response = { shortRecommendation: 'Reviewed', practicalAdvice: ['Check forecast', 'Take breaks'], forecast: { hours: [] }, environmentSummary: { heatCategory: 'HIGH', uvCategory: 'EXTREME' }, alternativeTimeRecommended: false };
  response.recommendation = { recommendation: response.shortRecommendation, practicalActions: response.practicalAdvice };
  const service = frontend('services/activityRecommendationService.js', ['getActivityRecommendation'], {
    API_BASE_URL: 'http://example.test', ...dates,
    fetch: async (url, options) => { request = { url, ...options }; return { ok: true, json: async () => response }; },
  });
  const received = await service.getActivityRecommendation(event);
  assert.equal(received.environmentSummary.heatCategory, 'HIGH');
  assert.equal(received.environmentSummary.uvCategory, 'EXTREME');
  assert.equal(request.url, 'http://example.test/api/ai/activity-recommendation');
  assert.equal(JSON.parse(request.body).startTime, '2026-09-13T14:00:00+10:00');
  assert.equal(JSON.parse(request.body).activityTitle, 'Walk');
  assert.equal(JSON.parse(request.body).description, undefined);
  for (const fetch of [async () => ({ ok: false }), async () => ({ ok: true, json: async () => ({}) }), async () => { throw Error('offline'); }]) {
    const failed = frontend('services/activityRecommendationService.js', ['getActivityRecommendation'], { API_BASE_URL: '', ...dates, fetch });
    await assert.rejects(failed.getActivityRecommendation(event));
  }
});

test('Confirm updates the same stored event; Ignore keeps time; failed retries add nothing', async () => {
  const values = new Map();
  const storage = frontend('services/eventStorageService.js', ['saveEvent', 'getStoredEvents', 'updateEvent'], {
    ...dates,
    localStorage: { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) },
  });
  const saved = storage.saveEvent(event);
  storage.updateEvent(saved.id, { recommendationDecision: 'ignored' });
  assert.equal(storage.getStoredEvents()[0].startTime, '14:00');
  const fields = dates.eventTimeFields('2026-09-13T15:00:00+10:00', '2026-09-13T16:00:00+10:00');
  storage.updateEvent(saved.id, { ...fields, recommendationDecision: 'confirmed' });
  const service = frontend('services/activityRecommendationService.js', ['getActivityRecommendation'], { API_BASE_URL: '', ...dates, fetch: async () => { throw Error('offline'); } });
  await assert.rejects(service.getActivityRecommendation(saved));
  await assert.rejects(service.getActivityRecommendation(saved));
  assert.equal(storage.getStoredEvents().length, 1);
  assert.equal(storage.getStoredEvents()[0].id, saved.id);
  assert.equal(storage.getStoredEvents()[0].startTime, '15:00');
  assert.equal(storage.getStoredEvents()[0].endTime, '16:00');
});

test('Gemini failures and malformed output use deterministic fallback', async () => {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'server/services/activityRecommendationLlm.js'), 'utf8'), {
    module, process: { env: {} }, require: () => ({ GoogleGenAI: class {}, ThinkingLevel: { LOW: 'LOW' } }),
  });
  const input = { environment: { sunProtectionRecommended: true }, alternative: { recommended: false } };
  for (const generateContent of [async () => { throw Error('offline'); }, async () => ({ text: 'invalid json' })]) {
    const result = await module.exports.generateRecommendationLanguage(input, { client: { models: { generateContent } }, model: 'test', includeSource: true });
    assert.equal(result._source, 'fallback');
    assert.equal(result.alternativeTimeExplanation, null);
    assert.equal(result.shortRecommendation, 'Sun protection is recommended for this activity.');
  }
});

test('HTTP handler returns contract, validation errors, no-data and database failures', async () => {
  const source = fs.readFileSync(path.join(root, 'server/index.js'), 'utf8');
  const route = source.slice(source.indexOf('// Activity recommendation endpoint'), source.indexOf('// Find nearby drinking fountains'));
  let handler;
  let query = async () => ({ rows: rows.map(r => ({ ...r, source: 'fixture', latitude: -37.8, longitude: 144.9 })) });
  vm.runInNewContext(route, {
    app: { post: (_path, fn) => { handler = fn; } },
    pool: { query: (...args) => query(...args) },
    ...forecast, Date, console: { error: () => {} }, getThermalPrediction: predictThermal,
    buildHybridRecommendation: async (_pool, structuredFacts) => ({
      ragStatus: 'unavailable', evidence: [], recommendationStatus: 'evidence_unavailable',
      language: {
        summary: 'Forecast reviewed',
        recommendation: 'Sun protection is recommended for this activity.',
        why: ['The forecast includes heat and UV considerations.'],
        practicalActions: ['Use sun protection.', 'Reduce time in direct sunlight where possible.'],
        alternativeTimeExplanation: structuredFacts.alternative.recommended ? 'The supplied alternative has more suitable forecast heat and UV conditions.' : null,
        limitations: 'This is environmental decision support, not medical advice.',
      },
    }),
  });
  const body = { activityTitle: event.title, location: event.location, startTime: dates.toMelbourneIso(event.startDate, event.startTime), endTime: dates.toMelbourneIso(event.endDate, event.endTime) };
  async function call(body) {
    let status = 200;
    let json;
    const res = { status(value) { status = value; return res; }, json(value) { json = value; } };
    await handler({ body }, res);
    return { status, json };
  }
  const result = await call(body);
  assert.equal(result.status, 200);
  assert.equal(result.json.alternativeTimeRecommended, true);
  assert.equal(result.json.forecast.hours.length, 3);
  assert.equal(result.json.environmentSummary.heatCategory, 'MODERATE');
  assert.equal(result.json.environmentSummary.uvCategory, 'HIGH');
  assert.equal(result.json.shortRecommendation, 'Sun protection is recommended for this activity.');
  assert.equal(result.json.rag.status, 'unavailable');
  assert.equal(result.json.recommendation.evidence.length, 0);
  assert.equal((await call({ ...body, startTime: '14:00' })).status, 400);
  assert.equal((await call({ ...body, latitude: 1 })).status, 400);
  query = async () => ({ rows: [] });
  assert.equal((await call(body)).status, 404);
  query = async () => { throw Error('database unavailable'); };
  assert.equal((await call(body)).status, 500);
});
