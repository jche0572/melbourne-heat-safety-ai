/*
 * ============================================================
 * SolAdapt Service Area Utility
 * ============================================================
 *
 * This file contains reusable backend logic for checking whether
 * a latitude/longitude coordinate is inside the official
 * City of Melbourne municipal boundary.
 *
 * The municipal boundary is stored in PostgreSQL/PostGIS in:
 *
 *     municipal_boundary
 *
 * The mobile app will use this check for:
 *
 * 1. The user's current GPS location.
 * 2. Locations selected through manual search.
 * 3. Nearby Cooling service-area restrictions.
 *
 * Keeping this logic on the backend means the mobile application
 * does not need to contain or process the full boundary polygon.
 */


/*
 * Check whether a coordinate is inside the City of Melbourne.
 *
 * Parameters:
 *
 * pool
 *   The PostgreSQL connection pool from server/db.js.
 *
 * latitude
 *   Latitude of the location being checked.
 *   Example:
 *   -37.8136
 *
 * longitude
 *   Longitude of the location being checked.
 *   Example:
 *   144.9631
 *
 *
 * Returns:
 *
 * true
 *   The coordinate is inside or directly on the
 *   City of Melbourne municipal boundary.
 *
 * false
 *   The coordinate is outside the
 *   City of Melbourne municipal boundary.
 */
async function isInsideCityOfMelbourne(
  pool,
  latitude,
  longitude
) {
  /*
   * ----------------------------------------------------------
   * Step 1: Convert the supplied values to numbers
   * ----------------------------------------------------------
   *
   * Query-string values normally arrive as strings.
   *
   * For example:
   *
   * " -37.8136 " → -37.8136
   *
   * Converting them here makes this utility safer if it is
   * called from different backend endpoints later.
   */
  const lat = Number(latitude);
  const lng = Number(longitude);


  /*
   * ----------------------------------------------------------
   * Step 2: Validate the coordinates
   * ----------------------------------------------------------
   *
   * Latitude must be between -90 and 90.
   *
   * Longitude must be between -180 and 180.
   *
   * We reject invalid coordinates before sending anything
   * to PostgreSQL.
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
   * Step 3: Ask PostGIS whether the point is inside the
   * City of Melbourne boundary
   * ----------------------------------------------------------
   *
   * ST_MakePoint(longitude, latitude)
   *
   * IMPORTANT:
   * PostGIS uses longitude first and latitude second.
   *
   * Example Melbourne CBD:
   *
   * ST_MakePoint(
   *     144.9631,
   *     -37.8136
   * )
   *
   *
   * ST_SetSRID(..., 4326)
   *
   * tells PostGIS that the coordinate uses WGS84 / EPSG:4326,
   * which is the same coordinate system used by GPS and our
   * municipal boundary table.
   *
   *
   * ST_Covers(boundary, point)
   *
   * returns true when the point:
   *
   * - is inside the polygon, OR
   * - sits exactly on its boundary.
   *
   * We use ST_Covers instead of ST_Contains because a person
   * standing exactly on the municipal boundary should still
   * be treated as being inside the SolAdapt service area.
   *
   *
   * EXISTS(...)
   *
   * gives us one simple true/false result even if the boundary
   * table contains more than one polygon row in the future.
   */
  const query = `
    SELECT EXISTS (
      SELECT 1
      FROM municipal_boundary
      WHERE ST_Covers(
        geometry,
        ST_SetSRID(
          ST_MakePoint($1, $2),
          4326
        )
      )
    ) AS inside_city_of_melbourne;
  `;


  /*
   * ----------------------------------------------------------
   * Step 4: Execute the PostGIS query
   * ----------------------------------------------------------
   *
   * $1 = longitude
   * $2 = latitude
   *
   * Parameterised queries are used instead of inserting values
   * directly into the SQL string.
   *
   * This is safer and avoids SQL-injection problems.
   */
  const result = await pool.query(
    query,
    [
      lng,
      lat,
    ]
  );


  /*
   * ----------------------------------------------------------
   * Step 5: Read the boolean result
   * ----------------------------------------------------------
   *
   * PostgreSQL should return:
   *
   * {
   *   inside_city_of_melbourne: true
   * }
   *
   * or:
   *
   * {
   *   inside_city_of_melbourne: false
   * }
   */
  const insideCityOfMelbourne =
    result.rows[0]?.inside_city_of_melbourne;


  /*
   * Make sure this function always returns a real JavaScript
   * boolean rather than undefined or another unexpected value.
   */
  return insideCityOfMelbourne === true;
}


/*
 * ============================================================
 * Export
 * ============================================================
 *
 * Export the function so server/index.js can use it.
 *
 * Later index.js will import it using:
 *
 * const {
 *   isInsideCityOfMelbourne,
 * } = require("./utils/serviceArea");
 */
module.exports = {
  isInsideCityOfMelbourne,
};