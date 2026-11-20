const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (name) =>
  fs.readFileSync(path.resolve(__dirname, `../screens/${name}`), "utf8");

test("cooling roots limit the initial list and expose in-page details", () => {
  for (const file of ["NearbyCoolingScreen.js", "NearbyCoolingScreen.web.js"]) {
    const source = read(file);
    assert.match(source, /Nearby cooling options/);
    assert.match(source, /showAllResults/);
    assert.match(source, /slice\(0, 2\)/);
    assert.match(source, /See all/);
    assert.match(source, /Get directions/);
    assert.match(source, /Close place details/);
    assert.match(source, /navigation\.navigate\([\s\S]*["']CoolingNavigation["']/);
  }
});

test("selected place uses a separate route summary instead of a divided text row", () => {
  for (const file of ["NearbyCoolingScreen.js", "NearbyCoolingScreen.web.js"]) {
    const source = read(file);
    assert.match(source, /Walking route<\/Text>/);
    assert.match(source, /routeInfo\.durationMinutes/);
    assert.match(source, /routeInfo\.distanceMeters/);
    assert.match(source, /#EAF7F3/);
  }
});

test("cooling roots use full-bleed gradients and distinct custom markers", () => {
  for (const file of ["NearbyCoolingScreen.js", "NearbyCoolingScreen.web.js"]) {
    const source = read(file);
    assert.match(source, /expo-linear-gradient/);
    assert.match(source, /topGradient/);
    assert.match(source, /bottomGradient/);
    assert.match(source, /#087751/);
    assert.match(source, /#147BD1/);
    assert.doesNotMatch(source, /InfoWindowF/);
  }
});

test("cooling route screens retain real route data and optional destination", () => {
  for (const file of [
    "CoolingNavigationScreen.js",
    "CoolingNavigationScreen.web.js",
  ]) {
    const source = read(file);
    assert.match(source, /Walking route/);
    assert.match(source, /routeCoordinates/);
    assert.match(source, /routeInfo\s*\.durationMinutes/);
    assert.match(source, /routeInfo\s*\.distanceMeters/);
    assert.match(source, /Add final destination/);
    assert.match(source, /Open in Google Maps/);
    assert.match(source, /getCoolingDisplay/);
    assert.match(source, /formatCoolingLocation/);
    assert.match(source, /isWater\s*\?\s*"#1976D2"\s*:\s*"#087751"/);
  }
});
