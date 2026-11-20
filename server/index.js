// Import Express.
// Express is used to create the Node.js backend server
// and define API endpoints such as GET and POST routes.
const express = require("express");

// Import CORS.
// CORS allows the frontend/mobile app to send requests
// to this backend from a different origin.
const cors = require("cors");

// Import Axios.
// Axios is used to send HTTP requests to other APIs,
// such as the Python Flask thermal-model API and Google APIs.
const axios = require("axios");

// Import the PostgreSQL database connection pool
// from the local db.js file.
const pool = require("./db");

const THERMAL_MODEL_API_URL =
  process.env.THERMAL_MODEL_API_URL ||
  "http://127.0.0.1:5001";


// Create an asynchronous function that gets a thermal prediction
// for one forecast row from the Python thermal-model API.
async function getThermalPrediction(forecastRow) {

  // List the four weather values required by the thermal model.
  const requiredFields = [
    "temperature_c",
    "relative_humidity",
    "wind_speed_10m_ms",
    "shortwave_radiation_wm2",
  ];

  // Look through the required fields and find the first one
  // that is missing from the forecast row.
  const missingField = requiredFields.find(
    (field) =>
      forecastRow[field] === null ||
      forecastRow[field] === undefined
  );

  // If any required value is missing, stop and throw an error.
  if (missingField) {
    throw new Error(
      `Missing thermal model input: ${missingField}`
    );
  }

  // Send the four weather values to the Python Flask API
  // using an HTTP POST request.
  const response = await axios.post(
    `${THERMAL_MODEL_API_URL}/predict`,
    {
      // Convert temperature to a JavaScript Number.
      temperature_c:
        Number(forecastRow.temperature_c),

      // Convert relative humidity to a Number.
      relative_humidity:
        Number(forecastRow.relative_humidity),

      // Convert wind speed to a Number.
      wind_speed_10m_ms:
        Number(forecastRow.wind_speed_10m_ms),

      // Convert shortwave radiation to a Number.
      shortwave_radiation_wm2:
        Number(forecastRow.shortwave_radiation_wm2),
    },
    {
      // Stop waiting if the Python API takes longer than 5 seconds.
      timeout: 5000,
    }
  );

  // Return only the prediction part of the Python API response.
  return response.data.prediction;
}

const {
  findAlternativeTime,
  getActivityLocalDayBounds,
  summarizeForecastHours,
  getThermalWindowSummary,
} = require("./utils/activityForecast");
const {
  buildHybridRecommendation,
} = require("./services/hybridRecommendation");

const {
  createGoogleApiKeyPool,
  runWithGoogleApiKeys,
} = require("./utils/googleApiKeyPool");

/*
 * City of Melbourne service-area validation
 *
 * This helper checks whether a latitude/longitude coordinate
 * is inside the official City of Melbourne municipal boundary
 * stored in our PostGIS database.
 *
 * It will be used for:
 *
 * - the user's current GPS location
 * - manually searched locations
 * - nearby cooling feature restrictions
 */
const {
  isInsideCityOfMelbourne,
} = require("./utils/serviceArea");

const app = express();
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 4000);

const googlePlacesKeyPool =
  createGoogleApiKeyPool(
    "GOOGLE_PLACES_API_KEYS",
    "GOOGLE_PLACES_API_KEY"
  );

const googleRoutesKeyPool =
  createGoogleApiKeyPool(
    "GOOGLE_ROUTES_API_KEYS",
    "GOOGLE_ROUTES_API_KEY"
  );

console.log(
  `Google Places keys loaded: ${googlePlacesKeyPool.getKeyCount()}`
);

console.log(
  `Google Routes keys loaded: ${googleRoutesKeyPool.getKeyCount()}`
);

app.use(cors());
app.use(express.json());

// Simple test
app.get("/", (req, res) => {
  res.json({
    message: "SolAdapt backend is running",
  });
});

/*
 * Check whether a location is inside the SolAdapt service area
 *
 * Endpoint:
 *
 * GET /api/service-area/check
 *
 * Query parameters:
 *
 * lat = latitude
 * lng = longitude
 *
 *
 * Example:
 *
 * /api/service-area/check?lat=-37.8136&lng=144.9631
 *
 *
 * Expected response for a location inside City of Melbourne:
 *
 * {
 *   "serviceArea": "City of Melbourne",
 *   "insideCityOfMelbourne": true,
 *   "latitude": -37.8136,
 *   "longitude": 144.9631
 * }
 *
 *
 * Expected response for a location outside City of Melbourne:
 *
 * {
 *   "serviceArea": "City of Melbourne",
 *   "insideCityOfMelbourne": false,
 *   "latitude": -37.8183,
 *   "longitude": 145.1218
 * }
 */
app.get("/api/service-area/check", async (req, res) => {
    try {
      /*
       * Read coordinates from the query string
       *
       * Query-string values arrive as strings.
       *
       * For example:
       * req.query.lat = "-37.8136"
       * Number() converts that into:
       * -37.8136
       */
      const latParam = req.query.lat;
      const lngParam = req.query.lng;

      const lat = Number(latParam);
      const lng = Number(lngParam);


      /*
       * Validate latitude and longitude
       *
       * We check:
       *
       * 1. Both query parameters exist.
       * 2. They are not empty strings.
       * 3. They can be converted into real numbers.
       * 4. Latitude is between -90 and 90.
       * 5. Longitude is between -180 and 180.
       *
       * Invalid coordinates return HTTP 400 because the request
       * itself is incorrect.
       */
      if (
        typeof latParam !== "string" ||
        typeof lngParam !== "string" ||
        latParam.trim() === "" ||
        lngParam.trim() === "" ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        return res.status(400).json({
          error:
            "Valid lat and lng query parameters are required.",
        });
      }


      /*
       * Check the PostGIS municipal boundary
       *
       * isInsideCityOfMelbourne() is defined in:
       * server/utils/serviceArea.js
       *
       * That function runs ST_Covers() against the official
       * City of Melbourne municipal boundary stored in RDS.
       */
      const insideCityOfMelbourne =
        await isInsideCityOfMelbourne(
          pool,
          lat,
          lng
        );


      /*
       * Return the result to the mobile application
       *
       * The frontend does not need to understand PostGIS.
       *
       * It only needs to check:
       * insideCityOfMelbourne === true
       * or:
       * insideCityOfMelbourne === false
       */
      return res.json({
        serviceArea: "City of Melbourne",

        insideCityOfMelbourne,

        latitude: lat,
        longitude: lng,
      });
    } catch (error) {
      /*
       * Unexpected backend/database error
       *
       * Do not expose database details to the mobile user.
       * Full technical details are written only to server logs.
       */
      console.error(
        "Service-area check failed:",
        error
      );

      return res.status(500).json({
        error:
          "Unable to check the SolAdapt service area.",
      });
    }
  }
);

// Activity recommendation endpoint with deterministic forecast data.
// Create the POST endpoint for AI activity recommendations.
app.post("/api/ai/activity-recommendation", async (req, res) => {

  // Get the request body, or use an empty object if missing.
  const body = req.body ?? {};

  // List the required request fields.
  const requiredFields = [
    "activityTitle",
    "location",
    "startTime",
    "endTime",
  ];

  // Find the first required field that is missing or empty.
  const missingField = requiredFields.find(
    (field) =>
      typeof body[field] !== "string" ||
      !body[field].trim()
  );

  // Return 400 if a required field is missing.
  if (missingField) {
    return res.status(400).json({
      error: `${missingField} is required`,
    });
  }

  const personalThermalBias =
    Number.isFinite(
      body.personalThermalBias
    )
      ? body.personalThermalBias
      : 0;

  const personalFeedbackCount =
    Number.isFinite(
      body.personalFeedbackCount
    )
      ? body.personalFeedbackCount
      : 0;

  if (
    personalFeedbackCount < 0
  ) {
    return res.status(400).json({
      error:
        "personalFeedbackCount must be zero or greater",
    });
  }

  if (
    personalThermalBias < -2 ||
    personalThermalBias > 2
  ) {
    return res.status(400).json({
      error:
        "personalThermalBias must be between -2 and 2",
    });
  }

  // Check whether latitude was provided.
  const hasLatitude = body.latitude !== undefined && body.latitude !== null;

  // Check whether longitude was provided.
  const hasLongitude = body.longitude !== undefined && body.longitude !== null;

  // If coordinates are provided, validate both their
  // numeric type and valid geographic range.
  if (hasLatitude &&
    (
      !Number.isFinite(body.latitude) ||
      !Number.isFinite(body.longitude) ||
      body.latitude < -90 ||
      body.latitude > 90 ||
      body.longitude < -180 ||
      body.longitude > 180
    )) {
    return res.status(400).json({
      error:
        "latitude and longitude must be valid geographic coordinates",
    });
  }

  // If coordinates are provided, check that both are valid numbers.
  if (
    hasLatitude &&
    (!Number.isFinite(body.latitude) ||
      !Number.isFinite(body.longitude))
  ) {
    return res.status(400).json({
      error: "latitude and longitude must be valid numbers",
    });
  }

  // Convert start and end time strings into timestamps.
  const startTimestamp = Date.parse(body.startTime);
  const endTimestamp = Date.parse(body.endTime);

  // Regex used to check that a timezone is included.
  const timezoneSuffix = /(?:Z|[+-]\d{2}:?\d{2})$/i;

  // Validate the timestamps and timezone information.
  if (
    !Number.isFinite(startTimestamp) ||
    !Number.isFinite(endTimestamp) ||
    !timezoneSuffix.test(body.startTime) ||
    !timezoneSuffix.test(body.endTime)
  ) {
    return res.status(400).json({
      error:
        "startTime and endTime must be valid timezone-aware timestamps",
    });
  }

  // Make sure the end time is later than the start time.
  if (endTimestamp <= startTimestamp) {
    return res.status(400).json({
      error: "endTime must be later than startTime",
    });
  }

  // Get the start and end of the activity's local day.
  const activityDayBounds = getActivityLocalDayBounds(
    body.startTime
  );

  // SQL query for forecast records overlapping the activity time.
  const forecastQuery = `
    SELECT
      forecast_time,
      latitude,
      longitude,
      temperature_c,
      relative_humidity,
      wind_speed_10m_ms,
      shortwave_radiation_wm2,
      apparent_temperature_c,
      uv_index,
      source
    FROM hourly_forecast

    -- Find forecast hours that overlap with the user's activity time.
    -- $1 = activity end time.
    -- $2 = activity start time.
    WHERE forecast_time < $1::timestamptz

      -- Each forecast row represents a 1-hour period.
      -- Check that the end of that forecast hour is later than
      -- the activity start time.
      AND forecast_time + INTERVAL '1 hour' > $2::timestamptz

    -- Return the matching forecast hours from earliest to latest.
    ORDER BY forecast_time ASC;
  `;

  // SQL query for all forecast records on the same day.
  const dayForecastQuery = `
    SELECT
      forecast_time,
      latitude,
      longitude,
      temperature_c,
      relative_humidity,
      wind_speed_10m_ms,
      shortwave_radiation_wm2,
      apparent_temperature_c,
      uv_index,
      source
    FROM hourly_forecast

    -- Only include forecast rows at or after the start of the day.
    -- $1 = start of the activity's local day.
    WHERE forecast_time >= $1::timestamptz

      -- Only include rows before the start of the next day.
      -- $2 = end of the activity's local day.
      AND forecast_time < $2::timestamptz

    -- Sort the forecast rows from earliest to latest.
    ORDER BY forecast_time ASC;
  `;

  // Database and AI operations may fail, so use try/catch.
  try {
    // Query forecast rows that overlap the activity time.
    const result = await pool.query(forecastQuery, [
      new Date(endTimestamp),
      new Date(startTimestamp),
    ]);

    // Return 404 if no forecast data exists for the activity time.
    if (result.rows.length === 0) {
      return res.status(404).json({
        error:
          "No hourly forecast records found for the requested activity interval",
      });
    }

    // Get all forecast rows for the activity day if day bounds exist.
    const dayResult = activityDayBounds
      ? await pool.query(dayForecastQuery, [
          new Date(activityDayBounds.start),
          new Date(activityDayBounds.end),
        ])
      : { rows: [] };

    // Use the first forecast row for shared forecast information.
    const firstRow = result.rows[0];

    const thermalPrediction =
      await getThermalPrediction(firstRow);

    const originalActivityThermal =
      await getThermalWindowSummary(
        result.rows,
        getThermalPrediction
      );

    // Calculate peak temperature, UV and risk categories.
    const environmentSummary = summarizeForecastHours(result.rows);

    // Search for a better time on the same day.
    const alternativeTime = await findAlternativeTime(
      {
        startTime: body.startTime,
        endTime: body.endTime,
      },
      dayResult.rows,
      getThermalPrediction,
      personalThermalBias,
      personalFeedbackCount
    );

    const alternative = {
      recommended:
        alternativeTime.alternativeTimeRecommended,
      startTime:
        alternativeTime.suggestedAlternativeTime?.startTime ??
        null,
      endTime:
        alternativeTime.suggestedAlternativeTime?.endTime ??
        null,
      peakApparentTemperatureC:
        alternativeTime.comparison?.suggested
          ?.peakApparentTemperatureC ?? null,
      peakUvIndex:
        alternativeTime.comparison?.suggested?.peakUvIndex ??
        null,
    };
    const structuredFacts = {
      activity: {
        title: body.activityTitle,
        location: body.location,
        description:
          typeof body.description === "string"
            ? body.description
            : null,
        startTime: body.startTime,
        endTime: body.endTime,
      },
      environment: environmentSummary,
      alternative,
    };
    const hybrid = await buildHybridRecommendation(
      pool,
      structuredFacts
    );
    const recommendationLanguage = hybrid.language;

    // Return the final recommendation response to the frontend.
    return res.json({

      // Return the forecast information.
      forecast: {

        // Forecast data source.
        source: firstRow.source,

        // Forecast location coordinates.
        location: {
          latitude: Number(firstRow.latitude),
          longitude: Number(firstRow.longitude),
        },

        // Convert each database forecast row into frontend-friendly data.
        hours: result.rows.map((row) => ({

          // Convert forecast time into ISO format.
          forecastTime: new Date(
            row.forecast_time
          ).toISOString(),

          // Convert temperature to a number unless it is null.
          temperatureC:
            row.temperature_c === null
              ? null
              : Number(row.temperature_c),

          relativeHumidity:
            row.relative_humidity === null
              ? null
              : Number(row.relative_humidity),

          windSpeed10mMs:
            row.wind_speed_10m_ms === null
              ? null
              : Number(row.wind_speed_10m_ms),

          shortwaveRadiationWm2:
            row.shortwave_radiation_wm2 === null
              ? null
              : Number(row.shortwave_radiation_wm2),

          apparentTemperatureC:
            row.apparent_temperature_c === null
              ? null
              : Number(row.apparent_temperature_c),

          uvIndex:
            row.uv_index === null
              ? null
              : Number(row.uv_index),
        })),
      },

      // Return calculated heat and UV information.
      environmentSummary,

      thermalPrediction,

      originalActivityThermal,

      // Return the short AI recommendation.
      shortRecommendation:
        recommendationLanguage.recommendation,

      // Return practical advice.
      practicalAdvice:
        recommendationLanguage.practicalActions,

      recommendation: {
        summary: recommendationLanguage.summary,
        recommendation: recommendationLanguage.recommendation,
        practicalActions:
          recommendationLanguage.practicalActions,
        alternativeTime:
          alternativeTime.suggestedAlternativeTime,
        evidence: hybrid.evidence,
        limitations: recommendationLanguage.limitations,
      },
      evidence: hybrid.evidence,
      rag: {
        status: hybrid.ragStatus,
        retrievedCount: hybrid.evidence.length,
      },
      recommendationStatus: hybrid.recommendationStatus,

      // Add all other alternative-time fields to the response.
      ...alternativeTime,
    });

  // Handle database or AI errors.
  } catch (error) {

    // Print the technical error for debugging.
    console.error(
      "Hourly forecast query failed:",
      error
    );

    // Return a server error response.
    return res.status(500).json({
      error: "Failed to retrieve hourly forecast data",
    });
  }
});

// Find nearby drinking fountains
app.get("/api/fountains/nearby", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    // Check coordinates
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return res.status(400).json({
        error: "Valid lat and lng are required",
      });
    }

    const query = `
      SELECT
        asset_id,
        facility_type,
        location_description,
        latitude,
        longitude,

        ROUND(
          ST_Distance(
            location::geography,
            ST_SetSRID(
              ST_MakePoint($1, $2),
              4326
            )::geography
          )
        )::integer AS distance_m

      FROM drinking_fountains

      WHERE location IS NOT NULL

      ORDER BY
        location::geography <-> ST_SetSRID(
          ST_MakePoint($1, $2),
          4326
        )::geography

      LIMIT 5;
    `;

    // IMPORTANT:
    // PostgreSQL point order = longitude, latitude
    const result = await pool.query(query, [
      lng,
      lat,
    ]);

    res.json({
      userLocation: {
        latitude: lat,
        longitude: lng,
      },

      fountains: result.rows,
    });
  } catch (error) {
    console.error(
      "Nearby fountain query failed:",
      error
    );

    res.status(500).json({
      error: "Failed to retrieve nearby fountains",
    });
  }
});

// Find the latest observation from the nearest microclimate sensor
app.get("/api/microclimate/nearby", async (req, res) => {
  try {
    const latParam = req.query.lat;
    const lngParam = req.query.lng;
    const lat = Number(latParam);
    const lng = Number(lngParam);

    if (
      typeof latParam !== "string" ||
      typeof lngParam !== "string" ||
      latParam.trim() === "" ||
      lngParam.trim() === "" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return res.status(400).json({
        error: "Valid lat and lng are required",
      });
    }

    const query = `
      SELECT
        device_id,
        sensor_location,
        received_at,
        air_temperature,
        relative_humidity,
        latitude,
        longitude,

        ROUND(
          ST_Distance(
            location::geography,
            ST_SetSRID(
              ST_MakePoint($1, $2),
              4326
            )::geography
          )
        )::integer AS distance_m

      FROM microclimate_observations

      WHERE location IS NOT NULL

      ORDER BY
        location::geography <-> ST_SetSRID(
          ST_MakePoint($1, $2),
          4326
        )::geography,
        received_at DESC

      LIMIT 1;
    `;

    // PostgreSQL point order:
    // longitude first, latitude second
    const result = await pool.query(query, [
      lng,
      lat,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "No microclimate observations found",
      });
    }

    res.json({
      userLocation: {
        latitude: lat,
        longitude: lng,
      },

      observation: result.rows[0],
    });
  } catch (error) {
    console.error(
      "Nearby microclimate query failed:",
      error
    );

    res.status(500).json({
      error: "Failed to retrieve nearby microclimate observation",
    });
  }
});

// Get the latest valid Melbourne UV observation
app.get("/api/uv/latest", async (req, res) => {
  try {
    const query = `
      SELECT
        station_name,
        uv_index::double precision AS uv_index,
        observed_at_utc,
        status
      FROM uv_observations
      WHERE station_name = $1
        AND LOWER(status) = 'ok'
        AND uv_index IS NOT NULL
      ORDER BY observed_at_utc DESC
      LIMIT 1;
    `;

    const result = await pool.query(query, [
      "Melbourne",
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "No valid UV observations found",
      });
    }

    res.json({
      observation: result.rows[0],
    });
  } catch (error) {
    console.error(
      "Latest UV query failed:",
      error
    );

    res.status(500).json({
      error: "Failed to retrieve latest UV observation",
    });
  }
});

// Get hourly heat and UV forecast for one selected day
app.get("/api/forecast/hourly", async (req, res) => {
  try {
    const date = req.query.date;

    // Make sure the frontend sends a date
    if (
      typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
      return res.status(400).json({
        error: "A valid date in YYYY-MM-DD format is required",
      });
    }

    const query = `
      -- Select the hourly forecast values needed by the planner
      SELECT
        forecast_time,

        temperature_c::double precision
          AS temperature_c,

        relative_humidity::double precision
          AS relative_humidity,

        wind_speed_10m_ms::double precision
          AS wind_speed_10m_ms,

        shortwave_radiation_wm2::double precision
          AS shortwave_radiation_wm2,

        apparent_temperature_c::double precision
          AS apparent_temperature_c,

        uv_index::double precision
          AS uv_index,

        source

      FROM hourly_forecast

      -- Start from 12:00 AM of the selected day in Melbourne time
      WHERE forecast_time >=
        ($1::date::timestamp AT TIME ZONE 'Australia/Melbourne')

      -- Include 12:00 AM of the following day
      -- so the planner can show the final midnight forecast value
      AND forecast_time <=
        (($1::date + INTERVAL '1 day')
          AT TIME ZONE 'Australia/Melbourne')

      -- Keep the forecast records in chronological order
      ORDER BY forecast_time ASC;
    `;

    const result = await pool.query(query, [
      date,
    ]);

    res.json({
      date: date,
      forecast: result.rows,
    });

  } catch (error) {
    console.error(
      "Hourly forecast query failed:",
      error
    );

    res.status(500).json({
      error: "Failed to retrieve hourly forecast",
    });
  }
});

// Get walking route from user location to a cooling option
app.get("/api/route", async (req, res) => {
  try {
    const originLat = Number(req.query.originLat);
    const originLng = Number(req.query.originLng);
    const destLat = Number(req.query.destLat);
    const destLng = Number(req.query.destLng);

    if (
      !Number.isFinite(originLat) ||
      !Number.isFinite(originLng) ||
      !Number.isFinite(destLat) ||
      !Number.isFinite(destLng)
    ) {
      return res.status(400).json({
        error: "Valid origin and destination coordinates are required",
      });
    }

    const response =
      await runWithGoogleApiKeys(
        googleRoutesKeyPool,

        async (apiKey) => {
          return axios.post(
            "https://routes.googleapis.com/directions/v2:computeRoutes",

            {
              origin: {
                location: {
                  latLng: {
                    latitude: originLat,
                    longitude: originLng,
                  },
                },
              },

              destination: {
                location: {
                  latLng: {
                    latitude: destLat,
                    longitude: destLng,
                  },
                },
              },

              travelMode: "WALK",
              computeAlternativeRoutes: false,
              languageCode: "en-AU",
              units: "METRIC",
            },

            {
              headers: {
                "Content-Type": "application/json",

                "X-Goog-Api-Key":
                  apiKey,

                "X-Goog-FieldMask":
                  "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
              },
            }
          );
        }
      );

    if (
      !response.data.routes ||
      response.data.routes.length === 0
    ) {
      return res.status(404).json({
        error: "No walking route found",
      });
    }

    const route = response.data.routes[0];

    const durationSeconds =
      parseFloat(route.duration);

    res.json({
      distanceMeters: route.distanceMeters,

      durationSeconds,

      durationMinutes:
        Math.ceil(durationSeconds / 60),

      encodedPolyline:
        route.polyline.encodedPolyline,
    });
  } catch (error) {
    console.error(
      "Google route request failed:",
      error.response?.data || error.message
    );

    res.status(500).json({
      error: "Failed to calculate walking route",
      details:
        error.response?.data?.error?.message ||
        error.message,
    });
  }
});

// Find nearby tree canopy / shade areas
app.get("/api/shade/nearby", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return res.status(400).json({
        error: "Valid lat and lng are required",
      });
    }

    const query = `
      WITH user_point AS (
        SELECT ST_SetSRID(
          ST_MakePoint($1, $2),
          4326
        ) AS geom
      ),

      candidates AS (
        SELECT
          tc.canopy_id,
          tc.geometry
        FROM tree_canopies tc,
             user_point u
        WHERE tc.geometry IS NOT NULL
        ORDER BY tc.geometry <-> u.geom
        LIMIT 20
      )

      SELECT
        c.canopy_id,

        ROUND(
          ST_Distance(
            c.geometry::geography,
            u.geom::geography
          )
        )::integer AS distance_m,

        ST_Y(
          ST_ClosestPoint(
            c.geometry,
            u.geom
          )
        ) AS latitude,

        ST_X(
          ST_ClosestPoint(
            c.geometry,
            u.geom
          )
        ) AS longitude

      FROM candidates c,
           user_point u

      ORDER BY distance_m
      LIMIT 5;
    `;

    // PostgreSQL coordinate order:
    // longitude first, latitude second
    const result = await pool.query(query, [
      lng,
      lat,
    ]);

    res.json({
      userLocation: {
        latitude: lat,
        longitude: lng,
      },

      shadeAreas: result.rows,
    });
  } catch (error) {
    console.error(
      "Nearby shade query failed:",
      error
    );

    res.status(500).json({
      error: "Failed to retrieve nearby shade areas",
    });
  }
});

// Search location suggestions using Google Places API (New)
app.get("/api/places/autocomplete", async (req, res) => {
  try {
    const input = req.query.input?.trim();

    if (!input) {
      return res.status(400).json({
        error: "Search input is required",
      });
    }

    const response = await axios.post(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        input,

        languageCode: "en",

        regionCode: "au",

        includedRegionCodes: ["au"],

        locationBias: {
          circle: {
            center: {
              latitude: -37.8136,
              longitude: 144.9631,
            },
            radius: 20000,
          },
        },
      },
      {
        headers: {
          "Content-Type": "application/json",

          "X-Goog-Api-Key":
            process.env.GOOGLE_PLACES_API_KEY,

          "X-Goog-FieldMask":
            "suggestions.placePrediction.placeId," +
            "suggestions.placePrediction.text.text," +
            "suggestions.placePrediction.structuredFormat.mainText.text," +
            "suggestions.placePrediction.structuredFormat.secondaryText.text",
        },
      }
    );

    const suggestions =
      response.data?.suggestions
        ?.map((item) => {
          const prediction = item.placePrediction;

          if (!prediction) {
            return null;
          }

          return {
            placeId: prediction.placeId,

            label:
              prediction.text?.text ?? "",

            mainText:
              prediction.structuredFormat
                ?.mainText?.text ?? "",

            secondaryText:
              prediction.structuredFormat
                ?.secondaryText?.text ?? "",
          };
        })
        .filter(Boolean) ?? [];

    res.json({
      suggestions,
    });
  } catch (error) {
    console.error(
      "Google Places autocomplete failed:",
      error.response?.data || error.message
    );

    res.status(500).json({
      error: "Failed to search locations",
      details:
        error.response?.data?.error?.message ||
        error.message,
    });
  }
});

// Get latitude and longitude for a selected Google Place
app.get("/api/places/details", async (req, res) => {
  try {
    const placeId = req.query.placeId?.trim();

    if (!placeId) {
      return res.status(400).json({
        error: "placeId is required",
      });
    }

    const response = await axios.get(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          "X-Goog-Api-Key":
            process.env.GOOGLE_PLACES_API_KEY,

          "X-Goog-FieldMask":
            "location",
        },
      }
    );

    const location = response.data?.location;

    if (
      !location ||
      !Number.isFinite(location.latitude) ||
      !Number.isFinite(location.longitude)
    ) {
      return res.status(404).json({
        error: "Location coordinates not found",
      });
    }

    res.json({
      latitude: location.latitude,
      longitude: location.longitude,
    });
  } catch (error) {
    console.error(
      "Google Place Details failed:",
      error.response?.data || error.message
    );

    res.status(500).json({
      error: "Failed to get place details",
      details:
        error.response?.data?.error?.message ||
        error.message,
    });
  }
});

// Create a GET endpoint for converting coordinates into a suburb name.
app.get("/api/places/reverse-geocode", async (req, res) => {
    // Read latitude from the URL query and convert it to a number.
    const latitude = Number(req.query.lat);
    // Read longitude from the URL query and convert it to a number.
    const longitude = Number(req.query.lng);

    // Check that both latitude and longitude are valid numbers.
    if (
      !Number.isFinite(latitude) || !Number.isFinite(longitude)
    ) {
      // Return HTTP 400 if the coordinates are invalid.
      return res.status(400).json({
        error: "Valid lat and lng are required",
      });
    }

    // Google API requests can fail, so use try/catch.
    try {
      // Call the Google Geocoding API using one of the available API keys.
      const response = await runWithGoogleApiKeys(
          // Pool of Google API keys available to use.
          googlePlacesKeyPool,
          // Receive one API key and use it for the request.
          async (apiKey) =>
            // Send a GET request to Google's Geocoding API.
            axios.get(
              "https://maps.googleapis.com/maps/api/geocode/json",
              {
                params: {
                  // Send latitude and longitude in Google's required format.
                  latlng: `${latitude},${longitude}`,
                  // Send the selected Google API key.
                  key: apiKey,
                },
              }
            )
        );

      // Read Google's status value from the response.
      const googleStatus = response.data?.status;

      // Read Google's error message if one exists.
      const googleError = response.data?.error_message;

      // Log Google's status for debugging.
      console.log(
        "Reverse geocode Google status:",
        googleStatus
      );

      // If Google returned an error message, log it.
      if (googleError) {
        console.log(
          "Reverse geocode Google error:",
          googleError
        );
      }

      /*
       * Google may return HTTP 200 while
       * still reporting an API error.
       */
      // Check Google's own status, not only the HTTP status.
      if (
        googleStatus &&
        googleStatus !== "OK" &&
        googleStatus !== "ZERO_RESULTS"
      ) {
        // Return 502 because the external Google service failed.
        return res.status(502).json({
          error:
            "Google reverse geocoding failed",
          // Return Google's status for debugging.
          googleStatus,
          // Return Google's error message if available.
          details:
            googleError ||
            "Unknown Google Geocoding error",
        });
      }

      // Get Google's list of reverse-geocoding results.
      // If results do not exist, use an empty array.
      const results = response.data?.results ?? [];

      // If Google found no matching address/location.
      if (results.length === 0) {
        // Return HTTP 404 because no location was found.
        return res.status(404).json({
          error:
            "No location name found for these coordinates",
        });
      }

      /*
       * Find suburb/locality from all
       * returned address components.
       */
      // Combine address components from every Google result
      // into one flat array.
      const components =
        results.flatMap(
          (result) => result.address_components ?? []
        );

      // Helper function for finding one address component by type.
      const findComponent = (type) =>
        // find() returns the first matching component.
        components.find(
          (component) =>
            // Make sure component.types is an array.
            Array.isArray(
              component.types
            ) &&
            // Check whether the requested type exists in the array.
            component.types.includes(type)
        // If a matching component exists, return its long name.
        )?.long_name;


      // Try different Google address types until a suburb name is found.
      const suburb =
        // First preference: locality.
        findComponent("locality") ||

        // Second preference: sublocality level 1.
        findComponent(
          "sublocality_level_1"
        ) ||
        // Third preference: general sublocality.
        findComponent(
          "sublocality"
        ) ||
        // Final fallback: neighborhood.
        findComponent(
          "neighborhood"
        );

      // If none of the address components contain a suburb.
      if (!suburb) {
        // Print all address components for debugging.
        console.log(
          "No suburb component found:",
          JSON.stringify(
            components,
            null,
            2
          )
        );

        // Return HTTP 404 because a suburb name could not be found.
        return res.status(404).json({
          error:
            "Suburb not found in reverse geocoding result",
        });
      }

      // Return the suburb name to the frontend.
      return res.json({
        suburb,
      });

    // Handle unexpected errors such as network/API failures.
    } catch (error) {
      // Log Google's response error if available,
      // otherwise log the normal error message.
      console.error(
        "Reverse geocoding failed:",
        error.response?.data ||
          error.message
      );

      // Return HTTP 500 for an unexpected server error.
      return res.status(500).json({
        error:
          "Failed to determine location name",
        // Include more error information for debugging.
        details:
          error.response?.data ||
          error.message,
      });
    }
  }
);

app.listen(PORT, HOST, () => {
  console.log(
    `SolAdapt server running on http://${HOST}:${PORT}`
  );
});
