const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const screenPath = path.resolve(
  __dirname,
  '../screens/HeatAwareActivityPlannerScreen.js',
);

test('planner presents five forecast checkpoints with weather and UV semantics', () => {
  const source = fs.readFileSync(screenPath, 'utf8');

  assert.match(source, /const FORECAST_HOURS = \[9, 12, 15, 18, 21\]/);
  assert.match(source, />\s*Heat \(°C\)\s*</);
  assert.match(source, />\s*UV Index\s*</);
  assert.match(source, /UV \$\{getUvValue\(hour\)\}, \$\{getUvCategory\(uv\)\}/);
});
