# Epic 3 integration testing

## Start the application

Use Node 20 or later. In a terminal opened at the repository root:

```powershell
cd server
npm ci
node index.js
```

Keep the existing server DB configuration. For live Gemini language, set
`GEMINI_API_KEY` and `GEMINI_MODEL` in the server environment only. Without those
values the endpoint returns deterministic fallback language. Do not put these
values in Expo environment variables.

In another terminal:

```powershell
cd mobile
npm run web
```

The existing `EXPO_PUBLIC_API_BASE_URL` must point to the backend reachable from
the browser. The server still binds to `0.0.0.0:4000` as it did on main.

## Live normal recommendation

1. Open Home → Heat-Aware Activity Planner → Add Event.
2. The event form opens for the selected day. Choose the start and end times.
3. Enter a title and location, and set end later than start. Choose a date/time
   covered by the existing hourly forecasts. Save once.
4. Event Details opens with a loading message, then backend advice and hourly
   forecast values. If Gemini is unavailable, fallback advice still appears.
5. In browser DevTools → Network, inspect the POST to
   `/api/ai/activity-recommendation`. Verify `activityTitle`, `location`, and full
   timestamp strings with Melbourne's date-appropriate `+10:00` or `+11:00` offset.
   Coordinates are included only when available as a pair of numbers.
6. Return to the planner and open the saved activity again. The activity remains
   present and its forecast is requested again. No second activity is created.

The backend may naturally return either alternative outcome. A false outcome
must show advice without Confirm/Ignore. A true outcome must show the supplied
alternative interval and both actions.

## Repeatable frontend scenarios without changing RDS

The following **test-only browser console fixture** intercepts only this API in
the current browser tab. It is not production code and does not test RDS/Gemini.
Reload the page to remove it. Paste it before saving a fresh test activity. Use
an activity ending before 22:00 so its fixture alternative stays on the same day.

```javascript
window.epic3Mode = 'alternative'; // 'normal', 'alternative', or 'failure'
window.epic3RealFetch = window.epic3RealFetch || window.fetch.bind(window);
window.fetch = async (url, options) => {
  if (!String(url).includes('/api/ai/activity-recommendation')) {
    return window.epic3RealFetch(url, options);
  }
  if (window.epic3Mode === 'failure') {
    return new Response(JSON.stringify({ error: 'Test outage' }), {
      status: 503, headers: { 'Content-Type': 'application/json' }
    });
  }
  const body = JSON.parse(options.body);
  const alternative = window.epic3Mode === 'alternative';
  const start = new Date(body.startTime);
  const end = new Date(body.endTime);
  const duration = end - start;
  const result = {
    forecast: {
      source: 'TEST FIXTURE', location: { latitude: -37.8, longitude: 144.9 },
      hours: [{ forecastTime: start.toISOString(), temperatureC: 29,
        apparentTemperatureC: 31, uvIndex: 6 }]
    },
    environmentSummary: { peakTemperatureC: 29, peakApparentTemperatureC: 31,
      peakUvIndex: 6, uvCategory: 'HIGH', sunProtectionRecommended: true },
    shortRecommendation: 'TEST FIXTURE: Sun protection is recommended.',
    practicalAdvice: ['TEST FIXTURE: Use sun protection.', 'Take breaks.'],
    alternativeTimeRecommended: alternative,
    suggestedAlternativeTime: alternative ? {
      startTime: end.toISOString(),
      endTime: new Date(end.getTime() + duration).toISOString()
    } : null,
    alternativeTimeExplanation: alternative ? 'TEST FIXTURE alternative.' : null,
    alternativeTimeReason: alternative ? 'TEST FIXTURE only.' : null,
    comparison: alternative ? {
      original: { peakApparentTemperatureC: 31, peakUvIndex: 6 },
      suggested: { peakApparentTemperatureC: 27, peakUvIndex: 3 }
    } : null
  };
  return new Response(JSON.stringify(result), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
};
```

### Normal / false

Set `window.epic3Mode = 'normal'`, then save a new activity. Verify advice and
hourly values appear, with no alternative controls.

### Alternative true and Confirm

Set `window.epic3Mode = 'alternative'`, then save a new activity. Note the original
interval and displayed suggestion. Click Confirm. Verify the activity's start
and end both change to the suggestion, a confirmation message appears, and the
forecast refreshes. Return to the planner: the same activity is at its new time.
Reload and verify that time persists.

### Ignore

Use a fresh activity with `epic3Mode = 'alternative'`. Click Ignore. Verify the
original start and end remain unchanged and the choice persists after reopening.

### API failure and retry

Set `window.epic3Mode = 'failure'`, then save a new activity. Verify Event Details
shows unavailable advice, an empty hourly state, and Retry recommendation.
Click Retry several times. The activity must remain saved exactly once.
Set `window.epic3Mode = 'normal'` and click Retry again: advice should appear.

Inspect DevTools → Application → Local Storage → `shadeadapt_events` to compare
the event ID, count, start/end dates and times before and after each action.
Do not clear existing user activities. For a real network failure, use DevTools
request blocking on `*/api/ai/activity-recommendation*`, then unblock and retry.

## Automated verification

From the repository root:

```powershell
node --check server/index.js
node --check server/utils/activityForecast.js
node --check server/services/activityRecommendationLlm.js
node --test server/tests/*.test.cjs
cd mobile
npx expo export --platform web --output-dir "$env:TEMP\shadeadapt-epic3-web"
```

The tests cover timezone serialization/DST gaps, true/false alternatives, request
and response handling, existing storage updates, failed retries, Gemini fallback,
and the route's success/400/404/500 outcomes using injected forecast fixtures.
They do not constitute live RDS/Gemini or browser interaction verification.

## Inherited constraints

The selectively imported backend does not filter forecast rows by submitted
coordinates. It can recommend an earlier time that has passed, uses a fixed offset
for same-day calculation, and does not suggest alternatives for cross-date
activities. These behaviours remain unchanged from the teammate's branch.
Existing event persistence uses browser localStorage. Native storage support remains outside this integration. Event Details supports
persistent editing and deletion, and refreshes its recommendation after edits.
