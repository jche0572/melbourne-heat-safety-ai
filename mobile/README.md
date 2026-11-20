# SolAdapt Mobile

The current Epic 2 mobile foundation uses isolated development/demo environmental data. It does not retrieve live readings and must not be treated as a production alert service.

## Manually verify Epic 2 states

In `services/environmentService.js`, set `ACTIVE_DEMO_SCENARIO` to one of:

- `DEMO_SCENARIOS.NORMAL`
- `DEMO_SCENARIOS.HEAT_HIGH`
- `DEMO_SCENARIOS.UV_HIGH`
- `DEMO_SCENARIOS.HEAT_AND_UV_HIGH`
- `DEMO_SCENARIOS.BOTH_UNAVAILABLE`
- `DEMO_SCENARIOS.TEMPERATURE_ONLY`
- `DEMO_SCENARIOS.UV_ONLY`

Save the file while Expo is running to reload the selected state.

Both the alert card and the main **Find shade nearby** button run the same small placeholder action. A future shade feature can replace that one shared handler.

## Thresholds

Thresholds are centralized in `utils/alertState.js`.

- Heat: `35°C` is a **development/demo threshold only**. It is not an authoritative health threshold. The team must validate the data definition, threshold, and source before production use.
- UV: UV Index `3` is the configurable alert point. UV display categories use the standard bands Low (0–2), Moderate (3–5), High (6–7), Very High (8–10), and Extreme (11+).

## Future integration

`services/environmentService.js` is the replacement boundary for a future backend API client. Production work must provide current observations, timestamps and freshness rules, error handling, and source attribution. The mobile app must not connect directly to PostgreSQL.
