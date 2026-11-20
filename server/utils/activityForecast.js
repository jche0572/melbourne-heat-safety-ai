// One hour in milliseconds.
// Used when calculating candidate activity times and time distance.
const HOUR_MS = 60 * 60 * 1000;

// One minute in milliseconds.
// Used when converting timezone offsets.
const MINUTE_MS = 60 * 1000;


// Convert a value into a valid finite number.
// Return null when the value is missing or invalid.
function toFiniteNumber(value) {

  // Reject null and undefined values.
  if (value === null || value === undefined) return null;

  // Reject empty strings.
  if (typeof value === "string" && value.trim() === "") return null;


  // Convert the value to a JavaScript Number.
  const number = Number(value);

  // Return the number only if it is finite.
  return Number.isFinite(number) ? number : null;
}


// Parse a timestamp that contains timezone information.
// Example:
// 2026-10-08T14:00:00+11:00
function parseTimezoneAwareTimestamp(value) {

  // The timestamp must be a string.
  if (typeof value !== "string") return null;


  // Check that the value contains:
  // - a YYYY-MM-DD date
  // - either Z or a timezone offset such as +11:00.
  const match = value.match(
    /^(\d{4}-\d{2}-\d{2})T.*(Z|[+-]\d{2}:?\d{2})$/i
  );


  // Return null if the required format is not matched.
  if (!match) return null;


  // Convert the timestamp into milliseconds.
  const timestamp = Date.parse(value);

  // Make sure JavaScript successfully parsed the timestamp.
  if (!Number.isFinite(timestamp)) return null;


  // Handle timestamps using UTC "Z".
  if (match[2].toUpperCase() === "Z") {

    return {

      // Timestamp in milliseconds.
      timestamp,

      // Original calendar date.
      date: match[1],

      // UTC has zero-minute offset.
      offsetMinutes: 0,

      // Text representation of the UTC offset.
      offsetText: "+00:00",

    };
  }


  // Determine whether the timezone offset is positive or negative.
  const sign = match[2][0] === "-" ? -1 : 1;

  // Remove the colon from the timezone offset.
  // Example: +11:00 -> 1100.
  const digits = match[2].slice(1).replace(":", "");

  // Extract timezone hours.
  const hours = Number(digits.slice(0, 2));

  // Extract timezone minutes.
  const minutes = Number(digits.slice(2, 4));


  // Validate the timezone values.
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours > 23 ||
    minutes > 59
  ) {

    return null;
  }


  // Return the parsed timestamp information.
  return {

    timestamp,

    date: match[1],

    // Convert the timezone offset into total minutes.
    offsetMinutes: sign * (hours * 60 + minutes),

    // Rebuild a standard timezone string such as +11:00.
    offsetText: `${sign < 0 ? "-" : "+"}${String(hours).padStart(
      2,
      "0"
    )}:${String(minutes).padStart(2, "0")}`,

  };
}


// Get the calendar date immediately after the supplied date.
function getNextCalendarDate(date) {

  // Split YYYY-MM-DD into numeric year, month and day.
  const [year, month, day] = date.split("-").map(Number);

  // Add one calendar day and return YYYY-MM-DD.
  return new Date(
    Date.UTC(year, month - 1, day + 1)
  )
    .toISOString()
    .slice(0, 10);
}


// Find the start and end timestamps of the activity's local day.
function getActivityLocalDayBounds(startTime) {

  // Parse the activity start time and timezone.
  const parsed = parseTimezoneAwareTimestamp(startTime);

  // Stop if the timestamp is invalid.
  if (!parsed) return null;


  // Get the next calendar date.
  const nextDate = getNextCalendarDate(parsed.date);

  // Create midnight at the beginning of the activity day.
  const dayStart = Date.parse(
    `${parsed.date}T00:00:00${parsed.offsetText}`
  );

  // Create midnight at the beginning of the following day.
  const dayEnd = Date.parse(
    `${nextDate}T00:00:00${parsed.offsetText}`
  );


  // Make sure both timestamps are valid.
  if (!Number.isFinite(dayStart) || !Number.isFinite(dayEnd)) {

    return null;
  }


  // Return the full local-day boundary.
  return {

    start: dayStart,

    end: dayEnd,

    offsetMinutes: parsed.offsetMinutes,

  };
}


// Convert the forecast_time of one forecast row into milliseconds.
function getForecastTimestamp(forecastHour) {

  // Read the forecast timestamp.
  const value = forecastHour?.forecast_time;

  // If it is already a Date object, get its timestamp.
  // Otherwise parse the value as a date.
  const timestamp = value instanceof Date
    ? value.getTime()
    : Date.parse(value);


  // Return the timestamp if valid.
  return Number.isFinite(timestamp) ? timestamp : null;
}


// Round a timestamp down to its forecast hour,
// while respecting the local timezone offset.
function floorToForecastHour(timestamp, offsetMinutes) {

  // Temporarily convert the timestamp into local time.
  const localTimestamp =
    timestamp + offsetMinutes * MINUTE_MS;


  // Round down to the start of the hour,
  // then convert back to the original timezone representation.
  return (
    Math.floor(localTimestamp / HOUR_MS) * HOUR_MS -
    offsetMinutes * MINUTE_MS
  );
}


// Get every hourly forecast row required to cover
// an activity between start and end.
function getCompleteForecastHours(
  start,
  end,
  forecastHours,
  offsetMinutes
) {

  // Map each forecast timestamp to its forecast row
  // for fast lookup later.
  const byTimestamp = new Map();


  // Loop through all available forecast rows.
  for (const forecastHour of forecastHours) {

    // Convert this forecast row's time into a timestamp.
    const timestamp = getForecastTimestamp(forecastHour);

    // Store valid forecast rows and avoid duplicates.
    if (timestamp !== null && !byTimestamp.has(timestamp)) {

      byTimestamp.set(timestamp, forecastHour);
    }
  }


  // Store every forecast hour needed by the activity.
  const requiredHours = [];

  // Find the forecast hour containing the activity start time.
  const firstHour = floorToForecastHour(start, offsetMinutes);


  // Move through the activity one forecast hour at a time.
  for (
    let timestamp = firstHour;
    timestamp < end;
    timestamp += HOUR_MS
  ) {

    // Find the forecast record for this hour.
    const forecastHour = byTimestamp.get(timestamp);

    // If an hour is missing, the activity does not have
    // complete forecast coverage.
    if (!forecastHour) return null;

    // Store this forecast hour.
    requiredHours.push(forecastHour);
  }


  // Return all forecast hours covering the activity.
  return requiredHours;
}


// Check whether forecast hours contain the values
// needed for temperature / UV comparison.
function hasValidComparisonData(forecastHours) {

  return (

    // There must be at least one forecast hour.
    forecastHours.length > 0 &&

    // Every forecast hour must contain valid comparison data.
    forecastHours.every((forecastHour) => {

      // Read apparent temperature as a valid number.
      const apparentTemperature = toFiniteNumber(
        forecastHour.apparent_temperature_c
      );

      // Read UV as a valid number.
      const uvIndex = toFiniteNumber(
        forecastHour.uv_index
      );


      // Both values must exist and UV cannot be negative.
      return (
        apparentTemperature !== null &&
        uvIndex !== null &&
        uvIndex >= 0
      );

    })

  );
}


// Convert a timestamp back into a timezone-aware string
// that can be returned to the frontend.
function formatTimestamp(timestamp, offsetMinutes) {

  // Apply the timezone offset and format the local date/time.
  const localTimestamp = new Date(
    timestamp + offsetMinutes * MINUTE_MS
  )
    .toISOString()
    .slice(0, 19);

  // Determine whether the timezone is positive or negative.
  const sign = offsetMinutes < 0 ? "-" : "+";

  // Get the absolute offset.
  const absoluteMinutes = Math.abs(offsetMinutes);

  // Convert the offset into hours.
  const hours = Math.floor(absoluteMinutes / 60);

  // Get the remaining minutes.
  const minutes = absoluteMinutes % 60;


  // Return a timezone-aware timestamp.
  return `${localTimestamp}${sign}${String(hours).padStart(
    2,
    "0"
  )}:${String(minutes).padStart(2, "0")}`;
}


// Find the highest valid value of a field
// across a group of forecast hours.
function peakValue(forecastHours, field, minimum = -Infinity) {

  // No peak value has been found yet.
  let peak = null;


  // Check every forecast hour.
  for (const hour of forecastHours) {

    // Read the requested field as a number.
    const value = toFiniteNumber(hour?.[field]);


    // Ignore invalid values or values below the allowed minimum.
    if (value === null || value < minimum) continue;

    // Replace the current peak when a larger value is found.
    if (peak === null || value > peak) peak = value;
  }


  // Return the highest valid value.
  return peak;
}


// Convert peak UV into a category.
function getUvCategory(peakUvIndex) {

  if (peakUvIndex === null) return "UNAVAILABLE";

  if (peakUvIndex < 3) return "LOW";

  if (peakUvIndex < 6) return "MODERATE";

  if (peakUvIndex < 8) return "HIGH";

  return "EXTREME";
}


// Convert peak temperature into a heat category.
function getHeatCategory(peakTemperatureC) {

  if (peakTemperatureC === null) return "UNAVAILABLE";

  if (peakTemperatureC < 24) return "LOW";

  if (peakTemperatureC < 27) return "MODERATE";

  if (peakTemperatureC < 30) return "HIGH";

  return "EXTREME";
}


// Summarise the main weather conditions
// across one activity period.
function summarizeForecastHours(forecastHours) {

  // Ensure forecastHours is an array.
  const hours = Array.isArray(forecastHours) ? forecastHours : [];

  // Find the highest UV level.
  const peakUvIndex = peakValue(hours, "uv_index", 0);


  // Find the highest raw temperature.
  const peakTemperatureC = peakValue(hours, "temperature_c");


  // Find the highest apparent temperature.
  const peakApparentTemperatureC = peakValue(hours, "apparent_temperature_c");


  // Return the weather summary.
  return {

    peakTemperatureC,

    peakApparentTemperatureC,

    peakUvIndex,

    // Convert peak temperature into a category.
    heatCategory: getHeatCategory(peakTemperatureC),

    // Convert peak UV into a category.
    uvCategory: getUvCategory(peakUvIndex),

    // Recommend sun protection when UV is 3 or above.
    sunProtectionRecommended:
      peakUvIndex !== null && peakUvIndex >= 3,

  };
}


// Run the thermal model for every forecast hour
// covering an activity.
//
// For multiple hours, this function keeps the
// worst thermal-severity result.
async function getThermalWindowSummary(
  forecastHours,
  thermalPredictor
) {

  // Make sure forecast data and the prediction
  // function are available.
  if (
    !Array.isArray(forecastHours) ||
    forecastHours.length === 0 ||
    typeof thermalPredictor !== "function"
  ) {

    return null;
  }


  // Store the thermal prediction for every hour.
  const predictions = [];


  // Run the model on each forecast hour.
  for (const forecastHour of forecastHours) {

    // Read temperature.
    const temperatureC = toFiniteNumber(
      forecastHour.temperature_c
    );


    // Read relative humidity.
    const relativeHumidity = toFiniteNumber(
      forecastHour.relative_humidity
    );


    // Read wind speed.
    const windSpeed10mMs = toFiniteNumber(
      forecastHour.wind_speed_10m_ms
    );


    // Read shortwave radiation.
    const shortwaveRadiationWm2 = toFiniteNumber(
      forecastHour.shortwave_radiation_wm2
    );


    // All four model inputs must exist.
    if (
      temperatureC === null ||
      relativeHumidity === null ||
      windSpeed10mMs === null ||
      shortwaveRadiationWm2 === null
    ) {

      return null;
    }


    // Call the thermal predictor.
    //
    // In your system this eventually calls the
    // Python Flask thermal-model API.
    const prediction = await thermalPredictor(
      forecastHour
    );


    // Get the three class probabilities.
    const probabilities =
      prediction?.probabilities ?? {};


    // Probability of class 0: Not warm / OK.
    const notWarmProbability =
      Number(
        probabilities["Not warm / OK"] ?? 0
      );


    // Probability of class 1: Warm.
    const warmProbability =
      Number(
        probabilities["Warm"] ?? 0
      );


    // Probability of class 2: Too hot.
    const tooHotProbability =
      Number(
        probabilities["Too hot"] ?? 0
      );


    /*
     * Expected thermal severity score:
     *
     * Not warm / OK = 0
     * Warm          = 1
     * Too hot       = 2
     *
     * Example:
     *
     * 80% Not warm
     * 15% Warm
     * 5% Too hot
     *
     * score =
     * (0 * 0.80) +
     * (1 * 0.15) +
     * (2 * 0.05)
     * = 0.25
     *
     * Lower score = more thermally comfortable.
     */
    const severityScore =
      warmProbability +
      2 * tooHotProbability;


    // Store this hour's thermal result.
    predictions.push({

      // Forecast time associated with the prediction.
      forecastTime:
        forecastHour.forecast_time,


      // Model's predicted numeric class.
      predictedClass:
        prediction.predicted_class,


      // Model's readable class label.
      predictedLabel:
        prediction.predicted_label,


      // Store the individual class probabilities.
      probabilities: {

        notWarmOrOk:
          notWarmProbability,


        warm:
          warmProbability,


        tooHot:
          tooHotProbability,

      },


      // Store the calculated thermal severity.
      severityScore,

    });
  }


  /*
   * For an activity covering multiple forecast hours,
   * use the worst hour as the window score.
   *
   * This prevents a very hot hour from being hidden
   * by averaging it with cooler hours.
   */
  const worstPrediction =

    // Compare all hourly predictions.
    predictions.reduce(

      (worst, current) => {

        // Replace the current worst result when
        // a higher thermal severity is found.
        if (
          worst === null ||
          current.severityScore >
            worst.severityScore
        ) {

          return current;
        }


        return worst;

      },

      null

    );


  // Return the worst thermal result
  // and all individual hourly predictions.
  return {

    worstSeverityScore:
      worstPrediction?.severityScore ?? null,


    worstPredictedLabel:
      worstPrediction?.predictedLabel ?? null,


    worstPredictedClass:
      worstPrediction?.predictedClass ?? null,


    hourlyPredictions:
      predictions,

  };
}


// Return this structure when no suitable
// alternative time can be recommended.
function emptyAlternativeTimeResult() {

  return {

    alternativeTimeRecommended: false,

    suggestedAlternativeTime: null,

    comparison: null,

  };
}


// Find and rank alternative activity times.
//
// Inputs:
// originalActivity = user's original start/end time
// dayForecastHours = forecast for the entire day
// thermalPredictor = function used to call the thermal model
// personalThermalBias = personalization value from user feedback
// personalFeedbackCount = number of feedback records
async function findAlternativeTime(
  originalActivity,
  dayForecastHours,
  thermalPredictor,
  personalThermalBias = 0,
  personalFeedbackCount = 0
) {

  // Make sure forecast data is available.
  if (!Array.isArray(dayForecastHours)) {

    return emptyAlternativeTimeResult();
  }


  // Make sure the thermal-model prediction function exists.
  if (typeof thermalPredictor !== "function") {

    return emptyAlternativeTimeResult();
  }


  // Parse the original activity start time.
  const originalStart = parseTimezoneAwareTimestamp(
    originalActivity?.startTime
  );

  // Parse the original activity end time.
  const originalEnd = parseTimezoneAwareTimestamp(
    originalActivity?.endTime
  );


  // Validate the activity time.
  //
  // The activity must:
  // - have a valid start
  // - have a valid end
  // - end after it starts
  // - remain within the same calendar day.
  if (
    !originalStart ||
    !originalEnd ||
    originalEnd.timestamp <= originalStart.timestamp ||
    originalStart.date !== originalEnd.date
  ) {

    return emptyAlternativeTimeResult();
  }


  // Find the boundaries of the activity's local day.
  const dayBounds = getActivityLocalDayBounds(
    originalActivity.startTime
  );

  // Stop if the day boundary cannot be determined.
  if (!dayBounds) return emptyAlternativeTimeResult();


  // Calculate the duration of the user's original activity.
  const duration =
    originalEnd.timestamp - originalStart.timestamp;

  // Get all forecast hours covering the original activity.
  const originalHours = getCompleteForecastHours(
    originalStart.timestamp,
    originalEnd.timestamp,
    dayForecastHours,
    dayBounds.offsetMinutes
  );


  // The original activity needs complete forecast data.
  if (
    !originalHours ||
    !hasValidComparisonData(originalHours)
  ) {

    return emptyAlternativeTimeResult();
  }


  // Calculate the weather summary for the original activity.
  const originalSummary = summarizeForecastHours(originalHours);


  // Run the original activity through the thermal model.
  const originalThermal =

    await getThermalWindowSummary(

      originalHours,

      thermalPredictor

    );


  // Stop if the thermal model did not produce
  // a valid severity score.
  if (
    !originalThermal ||
    originalThermal.worstSeverityScore === null
  ) {

    return emptyAlternativeTimeResult();
  }


  // Add the user's personal thermal bias to
  // the population thermal severity.
  //
  // Keep the final score between 0 and 2.
  const originalPersonalizedSeverityScore =

    Math.max(
      0,
      Math.min(
        2,
        originalThermal.worstSeverityScore +
          personalThermalBias
      )
    );


  // Store all alternative times that pass
  // the suitability requirements.
  const candidates = [];

  // Prevent the same candidate start time
  // from being processed more than once.
  const seenStarts = new Set();


  // Loop through every forecast hour in the day.
  //
  // Each hour becomes a possible alternative
  // starting time.
  for (const forecastHour of dayForecastHours) {

    // Read this possible start time.
    const candidateStart = getForecastTimestamp(forecastHour);

    // Skip invalid or previously checked start times.
    if (candidateStart === null || seenStarts.has(candidateStart)) {
      continue;
    }


    // Remember that this time has now been checked.
    seenStarts.add(candidateStart);

    // Keep exactly the same duration as the original activity.
    const candidateEnd = candidateStart + duration;


    // Reject candidate periods that:
    // - fall outside the current day
    // - overlap the original activity.
    if (
      candidateStart < dayBounds.start ||
      candidateEnd > dayBounds.end ||
      (candidateStart < originalEnd.timestamp &&
        candidateEnd > originalStart.timestamp)
    ) {

      continue;
    }


    // Get every forecast hour needed
    // for this candidate activity period.
    const candidateHours = getCompleteForecastHours(
      candidateStart,
      candidateEnd,
      dayForecastHours,
      dayBounds.offsetMinutes
    );


    // Skip candidates with incomplete comparison data.
    if (
      !candidateHours ||
      !hasValidComparisonData(candidateHours)
    ) {
      continue;
    }


    // Calculate the candidate's weather summary.
    const candidateSummary = summarizeForecastHours(
      candidateHours
    );

    // Run the candidate activity through
    // the Python thermal model.
    const candidateThermal =
      await getThermalWindowSummary(
        candidateHours,
        thermalPredictor
      );


    // Skip the candidate if thermal prediction failed.
    if (
      !candidateThermal ||
      candidateThermal.worstSeverityScore === null
    ) {

      continue;
    }

    // Add the user's thermal bias to this candidate's
    // population thermal severity.
    //
    // Keep the score between 0 and 2.
    const candidatePersonalizedSeverityScore =
      Math.max(
        0,
        Math.min(
          2,
          candidateThermal.worstSeverityScore +
            personalThermalBias
        )
      );

    // Hard requirement 1:
    // candidate temperature must be lower
    // than the original activity temperature.
    const candidateHasLowerTemperature =
      candidateSummary.peakTemperatureC !== null &&
      originalSummary.peakTemperatureC !== null &&
      candidateSummary.peakTemperatureC <
        originalSummary.peakTemperatureC;


    // Hard requirement 2:
    // candidate UV must be lower
    // than the original activity UV.
    const candidateHasLowerUv =
      candidateSummary.peakUvIndex !== null &&
      originalSummary.peakUvIndex !== null &&
      candidateSummary.peakUvIndex <
        originalSummary.peakUvIndex;


    // Hard requirement 3:
    // personalized thermal discomfort cannot be worse
    // than the original activity.
    const candidateHasNoWorseThermalDiscomfort =
      candidatePersonalizedSeverityScore <=
        originalPersonalizedSeverityScore;


    // Candidate must satisfy all three requirements.
    const candidateIsMoreSuitable =
      candidateHasLowerTemperature &&
      candidateHasLowerUv &&
      candidateHasNoWorseThermalDiscomfort;


    // Keep the candidate only when
    // all suitability requirements pass.
    if (candidateIsMoreSuitable) {

      candidates.push({
        candidateStart,
        candidateEnd,
        candidateSummary,
        candidateThermal,

        candidatePersonalizedSeverityScore,

        // Calculate how far the candidate is
        // from the original activity start time.
        distance: Math.abs(
          candidateStart -
            originalStart.timestamp
        ),

      });
    }
  }


  // No candidate passed the required conditions.
  if (candidates.length === 0) {
    return emptyAlternativeTimeResult();
  }


  // Only use personal bias in ranking when
  // the user has provided feedback.
  const effectivePersonalBias =
    personalFeedbackCount > 0
      ? personalThermalBias
      : 0;


  // Turn the personal bias into a ranking weight.
  //
  // Positive bias makes thermal improvement
  // more important.
  //
  // Keep the weight between 0.5 and 3.
  const thermalPreferenceWeight =
    Math.max(
      0.5,
      Math.min(
        3,
        1 + effectivePersonalBias
      )
    );


  // Rank all valid candidates.
  //
  // Array.sort() compares two candidates
  // at a time: left and right.
  //
  // Priority:
  // 1. lower personalized thermal severity
  // 2. lower UV
  // 3. lower temperature
  // 4. closer to the user's original time
  // 5. later time as the final tie-break
  candidates.sort((left, right) => {
    // Apply the user's thermal preference weight
    // to each candidate's personalized severity.
    // Lower score is better.
    const leftThermalScore =
      thermalPreferenceWeight *
      left.candidatePersonalizedSeverityScore;


    const rightThermalScore =
      thermalPreferenceWeight *
      right.candidatePersonalizedSeverityScore;


    // First priority:
    // choose the candidate with lower
    // personalized thermal severity.
    if (leftThermalScore !== rightThermalScore) {
      return leftThermalScore - rightThermalScore;
    }


    // Second priority:
    // choose the candidate with lower UV.
    if (
      left.candidateSummary.peakUvIndex !==
      right.candidateSummary.peakUvIndex
    ) {
      return (
        left.candidateSummary.peakUvIndex -
        right.candidateSummary.peakUvIndex
      );
    }


    // Third priority:
    // choose the candidate with lower temperature.
    if (
      left.candidateSummary.peakTemperatureC !==
      right.candidateSummary.peakTemperatureC
    ) {
      return (
        left.candidateSummary.peakTemperatureC -
        right.candidateSummary.peakTemperatureC
      );
    }


    // Fourth priority:
    // when environmental conditions are tied,
    // choose the candidate closest to the original time.
    if (left.distance !== right.distance) {
      return left.distance - right.distance;
    }


    /*
     * Final tie-break:
     * choose the later candidate.
    */
    return (
      right.candidateStart -
        left.candidateStart
    );
  });


  // After sorting, the first candidate
  // is the best-ranked alternative time.
  const selected = candidates[0];


  // Return the final recommendation information.
  return {
    // A valid alternative has been found.
    alternativeTimeRecommended: true,

    // Information about how personalization
    // affected the calculation.
    personalization: {

      // Number of user feedback records.
      feedbackCount:
        personalFeedbackCount,

      // Personal thermal bias calculated
      // from previous feedback.
      personalThermalBias:
        personalThermalBias,

      // Thermal importance used when ranking candidates.
      thermalPreferenceWeight:
        thermalPreferenceWeight,

      // Original severity from the population model.
      originalPopulationSeverityScore:
        originalThermal.worstSeverityScore,

      // Original severity after personal bias.
      originalPersonalizedSeverityScore:
        originalPersonalizedSeverityScore,

      // Suggested time's population severity.
      suggestedPopulationSeverityScore:
        selected.candidateThermal
          .worstSeverityScore,

      // Suggested time's severity after personal bias.
      suggestedPersonalizedSeverityScore:
        selected
          .candidatePersonalizedSeverityScore,
    },

    // Return the final recommended start and end time.
    suggestedAlternativeTime: {
      startTime: formatTimestamp(
        selected.candidateStart,
        dayBounds.offsetMinutes
      ),

      endTime: formatTimestamp(
        selected.candidateEnd,
        dayBounds.offsetMinutes
      ),
    },

    // Provide original-vs-suggested information
    // for comparison.
    comparison: {
      original: {
        // Original peak temperature.
        peakTemperatureC:
          originalSummary.peakTemperatureC,

        // Original peak apparent temperature.
        peakApparentTemperatureC:
          originalSummary.peakApparentTemperatureC,

        // Original peak UV.
        peakUvIndex: originalSummary.peakUvIndex,

        // Original population thermal severity.
        thermalSeverityScore:
          originalThermal.worstSeverityScore,

        // Original model thermal-sensation label.
        thermalSensation:
          originalThermal.worstPredictedLabel,
      },

      suggested: {
        // Suggested peak temperature.
        peakTemperatureC:
          selected.candidateSummary
            .peakTemperatureC,

        // Suggested peak apparent temperature.
        peakApparentTemperatureC:
          selected.candidateSummary
            .peakApparentTemperatureC,

        // Suggested peak UV.
        peakUvIndex:
          selected.candidateSummary.peakUvIndex,

        // Suggested population thermal severity.
        thermalSeverityScore:
          selected.candidateThermal
            .worstSeverityScore,

        // Suggested model thermal-sensation label.
        thermalSensation:
          selected.candidateThermal
            .worstPredictedLabel,
      },
    },
  };
}


// Export these functions so index.js and other backend
// files can import and use them.
module.exports = {

  findAlternativeTime,

  getActivityLocalDayBounds,

  summarizeForecastHours,

  getThermalWindowSummary,

};