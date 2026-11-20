const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

for (const screen of ['NearbyCoolingScreen', 'CoolingNavigationScreen']) {
  test(`${screen} requests vector rendering while retaining the flat map and theme`, () => {
    const source = fs.readFileSync(path.join(__dirname, '../screens', `${screen}.web.js`), 'utf8');
    assert.match(source, /loadedMap\s*\.setRenderingType\(\s*window\.google\.maps\s*\.RenderingType\s*\.VECTOR\s*\)/);
    assert.doesNotMatch(source, /renderingType:/);
    assert.match(source, /tilt: 0/);
    assert.match(source, /heading: 0/);
    assert.match(source, /tiltInteractionEnabled:\s*false/);
    assert.match(source, /headingInteractionEnabled:\s*false/);
    assert.match(source, /styles:\s*theme\.dark\s*\?\s*DARK_MAP_STYLE\s*:\s*MAP_STYLE/);
  });
}
