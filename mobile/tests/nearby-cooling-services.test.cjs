const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const babel = require("../node_modules/@babel/core");

function load(file, globals = {}) {
  const code = babel.transformSync(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    babelrc: false, configFile: false,
    plugins: [require("../node_modules/@babel/plugin-transform-modules-commonjs")],
  }).code;
  const module = { exports: {} };
  new Function("require", "module", "exports", "fetch", "navigator", code)(
    id => {
      if (id === "react-native") return { Platform: { OS: "web" } };
      if (id === "expo-location") return { reverseGeocodeAsync: () => assert.fail("Web must use the backend") };
      assert.equal(id, "../config/api");
      return { API_BASE_URL: "https://api.example.test" };
    }, module, module.exports, globals.fetch, globals.navigator
  );
  return module.exports;
}

test("autocomplete uses backend URL and encoded input, and makes no request for empty input", async () => {
  const calls = [];
  const suggestions = [{ placeId: "test-place", label: "Melbourne" }];
  const service = load("services/locationSearchService.js", {
    fetch: async url => { calls.push(url); return { ok: true, json: async () => ({ suggestions }) }; },
  });
  assert.deepEqual(await service.searchLocations(" Mel & CBD "), suggestions);
  assert.equal(calls[0], "https://api.example.test/api/places/autocomplete?input=Mel%20%26%20CBD");
  assert.deepEqual(await service.searchLocations("  "), []);
  assert.equal(calls.length, 1);
});

test("autocomplete surfaces unreachable backend and non-success response", async () => {
  for (const fetch of [async () => { throw new TypeError("Failed to fetch"); }, async () => ({ ok: false })]) {
    await assert.rejects(load("services/locationSearchService.js", { fetch }).searchLocations("Mel"));
  }
});

test("place selection and reverse geocoding use existing backend endpoints", async () => {
  const urls = [];
  const service = load("services/locationSearchService.js", {
    fetch: async url => { urls.push(url); return { ok: true, json: async () => url.includes("details")
      ? { latitude: "-37.8136", longitude: "144.9631" } : { suburb: "Melbourne" } }; },
  });
  assert.deepEqual(await service.getPlaceCoordinates("place/id"), { latitude: -37.8136, longitude: 144.9631 });
  assert.equal(await service.getSuburbFromCoordinates(-37.8136, 144.9631), "Melbourne");
  assert.equal(urls[0], "https://api.example.test/api/places/details?placeId=place%2Fid");
  assert.match(urls[1], /\/api\/places\/reverse-geocode\?lat=-37.8136&lng=144.9631$/);
});

test("Melbourne boundary result distinguishes inside, outside and verification failure", async () => {
  for (const inside of [true, false]) {
    let request;
    const service = load("services/serviceAreaService.js", {
      fetch: async url => { request = url; return { ok: true, json: async () => ({ insideCityOfMelbourne: inside, latitude: -37.8136, longitude: 144.9631 }) }; },
    });
    assert.equal((await service.checkCityOfMelbourneServiceArea(-37.8136, 144.9631)).insideCityOfMelbourne, inside);
    assert.equal(request, "https://api.example.test/api/service-area/check?lat=-37.8136&lng=144.9631");
  }
  const failed = load("services/serviceAreaService.js", { fetch: async () => ({ ok: false }) });
  await assert.rejects(failed.checkCityOfMelbourneServiceArea(-37.8136, 144.9631), /Unable to check/);
  const malformed = load("services/serviceAreaService.js", { fetch: async () => ({ ok: true, json: async () => ({}) }) });
  await assert.rejects(malformed.checkCityOfMelbourneServiceArea(-37.8136, 144.9631), /Invalid service-area/);
});

test("browser current location handles granted permission, denial and unavailable geolocation", async () => {
  const granted = load("services/locationService.web.js", {
    navigator: { geolocation: { getCurrentPosition: (success, failure, options) => {
      assert.equal(options.timeout, 15000);
      success({ coords: { latitude: -37.8136, longitude: 144.9631 } });
    } } },
  });
  assert.deepEqual(await granted.getCurrentUserLocation(), { latitude: -37.8136, longitude: 144.9631 });
  const denied = load("services/locationService.web.js", {
    navigator: { geolocation: { getCurrentPosition: (success, failure) => failure({ code: 1 }) } },
  });
  assert.equal((await denied.requestCurrentUserLocation()).granted, false);
  assert.equal(await denied.getCurrentUserLocation(), null);
  const unavailable = load("services/locationService.web.js", { navigator: {} });
  assert.equal((await unavailable.requestCurrentUserLocation()).canAskAgain, false);
});
