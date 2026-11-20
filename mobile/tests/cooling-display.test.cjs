const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs
  .readFileSync(path.resolve(__dirname, "../utils/coolingDisplay.js"), "utf8")
  .replace(/export /g, "");
const { formatCoolingLocation, getCoolingDisplay } = vm.runInNewContext(
  `${source}\n;({ formatCoolingLocation, getCoolingDisplay })`
);

test("long database descriptions become short display-only locations", () => {
  assert.equal(
    formatCoolingLocation(
      "La Trobe Street between Elizabeth Street and Queen Street, approximately 3m SE of MIT, 288 La Trobe Street, MELBOURNE VIC 3000"
    ),
    "La Trobe St, near Elizabeth St"
  );
  assert.equal(
    formatCoolingLocation(
      "Intersection of Victoria Street and Errol Street, approximately 14m South of TAB, NORTH MELBOURNE VIC 3051"
    ),
    "Victoria St & Errol St"
  );
  assert.equal(formatCoolingLocation("Alexandra Park"), "Alexandra Park");
});

test("facility type is the title and raw routing data is not changed", () => {
  const fountain = {
    facility_type: "Bottle Refill Tap",
    location_description:
      "Bourke Street between Swanston Street and Elizabeth Street, approximately 7m NW of Mecca, MELBOURNE VIC 3000",
    latitude: -37.8138656,
    longitude: 144.9647509,
  };
  const before = JSON.stringify(fountain);

  assert.deepEqual(
    { ...getCoolingDisplay(fountain, "water") },
    { name: "Bottle Refill Tap", location: "Bourke St, near Swanston St" }
  );
  assert.equal(JSON.stringify(fountain), before);
  assert.deepEqual(
    { ...getCoolingDisplay({}, "shade") },
    { name: "Tree shade area", location: "" }
  );
});
