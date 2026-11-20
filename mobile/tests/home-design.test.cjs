const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const homeSource = fs.readFileSync(
  path.resolve(__dirname, "../screens/HomeScreen.js"),
  "utf8"
);
const metricSource = fs.readFileSync(
  path.resolve(__dirname, "../components/EnvironmentalMetricCard.js"),
  "utf8"
);

test("Home uses one live weather background behind its live cards", () => {
  assert.equal(
    (homeSource.match(/<WeatherAtmosphere/g) || []).length,
    1
  );
  assert.doesNotMatch(homeSource, /G’day!|themed\.wordmark/);
  assert.match(homeSource, /accessibilityLabel="SolAdapt"/);
  assert.match(homeSource, /require\("\.\.\/assets\/soladapt-brand-lockup\.png"\)/);
  assert.match(homeSource, /Current conditions/);
  assert.match(homeSource, /Current location/);
  assert.match(homeSource, /<AlertCard\s+content=\{alertContent\}/);
  assert.match(homeSource, /status=\{\s*heatStatus\s*\}/);
  assert.match(homeSource, /status=\{uvStatus\}/);
});

test("metric cards expose hidden context to assistive technology", () => {
  assert.match(homeSource, /const ConditionsSurface = sharedRainGlass \? View : GlassSurface/);
  assert.match(metricSource, /accessibilityLabel=.*\$\{description\}/);
  assert.doesNotMatch(metricSource, /styles\.description/);
});

test("Heat and UV share centered icon, label, value and status axes", () => {
  const vm = require("node:vm");
  const styles = vm.runInNewContext(`${metricSource.slice(metricSource.lastIndexOf("const styles ="))}\nstyles`, { StyleSheet: { create: value => value } });
  assert.equal(styles.card.flexDirection, "column");
  assert.equal(styles.iconSlot.height, 40);
  assert.equal(styles.details.alignItems, "center");
  assert.equal(styles.value.textAlign, "center");
  assert.equal(styles.statusChip.alignSelf, "center");
  assert.match(metricSource, /checkmark-circle/);
});

test("Home feature cards navigate to the existing tab routes", () => {
  for (const route of ["HeatAwareActivityPlanner", "NearbyCooling", "HeatSmartLearning"]) {
    assert.ok(homeSource.includes(`route: "${route}"`));
  }
  assert.match(homeSource, /onPress=\{\(\) => navigation.navigate\(feature.route\)\}/);
});

test("weather coordinates are reactive and preview never replaces live readings", () => {
  assert.match(homeSource, /useWeatherAtmosphere\(currentLocation, true\)/);
  assert.match(homeSource, /setCurrentLocation\(location\)/);
  assert.match(homeSource, /currentLocationRef.current = currentLocation/);
  assert.match(homeSource, /const scene = weatherPreview \? weatherPreview : liveScene/);
  assert.match(homeSource, /setWeatherNight\(liveScene === "night"\)/);
  assert.match(homeSource, /setPreviewDark\(weatherPreview \? weatherPreview === "night" : null\)/);
  // Preview is available in production; heat and UV still come from live weather data.
  const readings = homeSource.slice(homeSource.indexOf('  const temperature ='), homeSource.indexOf('  const temperatureAvailable ='));
  assert.match(readings, /environment\?\.temperature/);
  assert.match(readings, /environment\?\.uvIndex/);
  assert.doesNotMatch(readings, /weatherPreview/);
  assert.doesNotMatch(homeSource, /if \(!focused\).*setWeatherPreview\(null\)/);
  assert.match(homeSource, /Weather preview/);
  assert.doesNotMatch(homeSource, /Weather data: Open-Meteo/);
  assert.doesNotMatch(homeSource, /Data sources|Weather source · Open-Meteo/);
});

test("Home cards let the same native material as navigation show through", () => {
  const vm = require('node:vm');
  const styles = vm.runInNewContext(`${homeSource.slice(homeSource.lastIndexOf('const styles ='))}\nstyles`, { StyleSheet: { create: value => value }, Platform: { OS: 'ios' } });
  assert.equal(styles.conditionsCard.backgroundColor, undefined);
  assert.equal(styles.featureCard.backgroundColor, undefined);
});

test("native GL mounts visibly and readiness waits for a valid draw", () => {
  const weather = fs.readFileSync(path.resolve(__dirname, '../components/WeatherAtmosphere.js'), 'utf8');
  assert.match(weather, /<GLView style=\{StyleSheet.absoluteFill\}/);
  assert.match(weather, /collapsable=\{false\}/);
  assert.match(weather, /!size.current.width \|\| !size.current.height/);
  assert.match(weather, /onError\?\.\(error.message\)/);
});
