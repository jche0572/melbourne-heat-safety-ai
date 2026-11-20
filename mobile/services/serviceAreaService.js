/*
 * ============================================================
 * SolAdapt Service Area API Service
 * ============================================================
 *
 * This file allows the mobile application to ask the backend:
 *
 * "Is this latitude/longitude inside the City of Melbourne?"
 *
 * The mobile app itself does NOT process the municipal boundary.
 *
 * Instead:
 *
 * Mobile coordinates
 *        ↓
 * /api/service-area/check
 *        ↓
 * Node.js backend
 *        ↓
 * PostGIS municipal_boundary
 *        ↓
 * true / false
 *
 *
 * This service will later be used by:
 *
 * 1. HomeScreen
 *    - Check whether the user's current GPS location is
 *      inside the City of Melbourne.
 *
 * 2. NearbyCoolingScreen
 *    - Check the user's current GPS location.
 *
 * 3. Manual location search
 *    - Check whether the searched location is inside the
 *      City of Melbourne before changing the map.
 */


// Import the backend base URL used by the rest of the mobile app.
//
// For example:
//
// Development:
// http://192.168.x.x:4000
//
// Deployed:
// https://your-backend-address
import { API_BASE_URL } from "../config/api";


/*
 * ============================================================
 * Check a coordinate against the SolAdapt service area
 * ============================================================
 *
 * Parameters:
 *
 * latitude
 *   Latitude of the location.
 *
 * longitude
 *   Longitude of the location.
 *
 *
 * Example:
 *
 * checkCityOfMelbourneServiceArea(
 *   -37.8136,
 *   144.9631
 * )
 *
 *
 * Expected result:
 *
 * {
 *   serviceArea: "City of Melbourne",
 *   insideCityOfMelbourne: true,
 *   latitude: -37.8136,
 *   longitude: 144.9631
 * }
 */
export async function checkCityOfMelbourneServiceArea(
  latitude,
  longitude
) {
  /*
   * ----------------------------------------------------------
   * Step 1: Convert the supplied coordinates into numbers
   * ----------------------------------------------------------
   *
   * Coordinates may sometimes arrive as strings.
   *
   * For example:
   *
   * "-37.8136"
   *
   * Number() converts this into:
   *
   * -37.8136
   */
  const lat = Number(latitude);
  const lng = Number(longitude);


  /*
   * ----------------------------------------------------------
   * Step 2: Validate the coordinates before calling the API
   * ----------------------------------------------------------
   *
   * Valid latitude:
   * -90 to 90
   *
   * Valid longitude:
   * -180 to 180
   *
   * If the values are invalid, there is no reason to send an
   * unnecessary request to the backend.
   */
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new Error(
      "Valid latitude and longitude are required."
    );
  }


  /*
   * ----------------------------------------------------------
   * Step 3: Build the backend service-area URL
   * ----------------------------------------------------------
   *
   * Example final URL:
   *
   * http://127.0.0.1:4000/api/service-area/check
   * ?lat=-37.8136
   * &lng=144.9631
   *
   * encodeURIComponent() safely converts the values into
   * URL-compatible text.
   */
  const url =
    `${API_BASE_URL}/api/service-area/check` +
    `?lat=${encodeURIComponent(lat)}` +
    `&lng=${encodeURIComponent(lng)}`;


  /*
   * ----------------------------------------------------------
   * Step 4: Send the request to the SolAdapt backend
   * ----------------------------------------------------------
   */
  const response = await fetch(url);


  /*
   * ----------------------------------------------------------
   * Step 5: Handle unsuccessful backend responses
   * ----------------------------------------------------------
   *
   * For example:
   *
   * 400 = invalid coordinates
   * 500 = database/server problem
   *
   * We throw an error so the screen using this function can
   * decide how to handle the failure.
   *
   * Important:
   * A server failure should NOT automatically be treated as
   * "outside City of Melbourne".
   *
   * "Unable to check" and "outside the service area" are
   * different situations.
   */
  if (!response.ok) {
    throw new Error(
      "Unable to check the City of Melbourne service area."
    );
  }


  /*
   * ----------------------------------------------------------
   * Step 6: Read the JSON returned by the backend
   * ----------------------------------------------------------
   *
   * Backend response example:
   *
   * {
   *   "serviceArea": "City of Melbourne",
   *   "insideCityOfMelbourne": true,
   *   "latitude": -37.8136,
   *   "longitude": 144.9631
   * }
   */
  const data = await response.json();


  /*
   * ----------------------------------------------------------
   * Step 7: Validate the important backend result
   * ----------------------------------------------------------
   *
   * We expect insideCityOfMelbourne to be a real boolean.
   *
   * If it is missing or has an unexpected type, something is
   * wrong with the backend response, so we should not guess.
   */
  if (
    typeof data?.insideCityOfMelbourne !== "boolean"
  ) {
    throw new Error(
      "Invalid service-area response from the backend."
    );
  }


  /*
   * ----------------------------------------------------------
   * Step 8: Return a clean object to the screen
   * ----------------------------------------------------------
   *
   * The screens can now simply check:
   *
   * result.insideCityOfMelbourne
   *
   * without knowing anything about PostGIS or polygons.
   */
  return {
    serviceArea:
      data.serviceArea || "City of Melbourne",

    insideCityOfMelbourne:
      data.insideCityOfMelbourne,

    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
  };
}