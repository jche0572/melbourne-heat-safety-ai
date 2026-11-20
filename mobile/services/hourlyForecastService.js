import { API_BASE_URL } from "../config/api";

const MELBOURNE_TIMEZONE = "Australia/Melbourne";

// Broad technical sanity limits.
// These are validation bounds, not health-risk thresholds.
const MIN_TEMPERATURE_C = -100;
const MAX_TEMPERATURE_C = 100;

const MIN_UV_INDEX = 0;
const MAX_UV_INDEX = 30;


// Add one day to a YYYY-MM-DD value when we need the final 12 AM row
function addDays(dateString, numberOfDays) {
  const [year, month, day] =
    dateString.split("-").map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day + numberOfDays)
  );

  const newYear = date.getUTCFullYear();
  const newMonth =
    String(date.getUTCMonth() + 1).padStart(2, "0");
  const newDay =
    String(date.getUTCDate()).padStart(2, "0");

  return `${newYear}-${newMonth}-${newDay}`;
}


// Convert forecast_time into its Melbourne date + hour
// Example:
// 2026-09-16T00:00:00.000Z
// becomes the corresponding Melbourne local hour.
function getMelbourneHourKey(forecastTime) {
  const date = new Date(forecastTime);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts =
    new Intl.DateTimeFormat("en-CA", {
      timeZone: MELBOURNE_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return (
    `${values.year}-${values.month}-${values.day}` +
    `T${values.hour}`
  );
}


// Validate one forecast record before allowing the planner to use it
function isValidForecast(forecast) {
  if (!forecast || typeof forecast !== "object") {
    return false;
  }

  if (
    !Number.isFinite(forecast.temperature_c) ||
    forecast.temperature_c < MIN_TEMPERATURE_C ||
    forecast.temperature_c > MAX_TEMPERATURE_C
  ) {
    return false;
  }

  if (
    !Number.isFinite(forecast.uv_index) ||
    forecast.uv_index < MIN_UV_INDEX ||
    forecast.uv_index > MAX_UV_INDEX
  ) {
    return false;
  }

  if (!getMelbourneHourKey(forecast.forecast_time)) {
    return false;
  }

  return true;
}


// Build exactly 25 planner positions by timestamp,
// rather than trusting array position.
function normaliseForecast(date, forecast) {
  if (!Array.isArray(forecast)) {
    return [];
  }

  const forecastByHour = new Map();

  for (const item of forecast) {
    if (!isValidForecast(item)) {
      continue;
    }

    const key =
      getMelbourneHourKey(item.forecast_time);

    forecastByHour.set(key, item);
  }

  return Array.from(
    { length: 25 },
    (_, hour) => {
      const expectedDate =
        hour === 24
          ? addDays(date, 1)
          : date;

      const expectedHour =
        hour === 24
          ? 0
          : hour;

      const key =
        `${expectedDate}T` +
        `${String(expectedHour).padStart(2, "0")}`;

      return forecastByHour.get(key) ?? null;
    }
  );
}


// Get hourly forecast data for one selected date
export async function getHourlyForecast(date) {
  const url =
    `${API_BASE_URL}/api/forecast/hourly` +
    `?date=${encodeURIComponent(date)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      "Failed to get hourly forecast"
    );
  }

  const data = await response.json();

  return {
    ...data,
    forecast: normaliseForecast(
      date,
      data.forecast
    ),
  };
}