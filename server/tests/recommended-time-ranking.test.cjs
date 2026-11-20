const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findAlternativeTime } = require('../utils/activityForecast');

test('recommended time prioritizes lower thermal severity over UV and proximity', async () => {
  const hours = [
    { hour: 12, temperature: 30, uv: 8, warm: 0.9 },
    { hour: 13, temperature: 27, uv: 1, warm: 0.6 },
    { hour: 17, temperature: 23, uv: 3, warm: 0.2 },
  ].map(({ hour, temperature, uv, warm }) => ({
    forecast_time: `2026-10-09T${hour}:00:00+11:00`,
    temperature_c: temperature,
    apparent_temperature_c: temperature,
    uv_index: uv,
    relative_humidity: 50,
    wind_speed_10m_ms: 2,
    shortwave_radiation_wm2: 100,
    warm,
  }));

  const result = await findAlternativeTime(
    {
      startTime: '2026-10-09T12:00:00+11:00',
      endTime: '2026-10-09T13:00:00+11:00',
    },
    hours,
    async (hour) => ({
      probabilities: { 'Warm': hour.warm, 'Not warm / OK': 1 - hour.warm },
    })
  );

  assert.equal(result.alternativeTimeRecommended, true);
  assert.equal(result.suggestedAlternativeTime.startTime, '2026-10-09T17:00:00+11:00');
});
