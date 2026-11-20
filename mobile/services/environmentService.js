import { API_BASE_URL } from "../config/api";

const MELBOURNE_CBD_LOCATION = {
  latitude: -37.8136,
  longitude: 144.9631,
};

export function getEnvironmentalFallback() {
  return {
    temperature: null,
    uvIndex: null,
    locationName: "Melbourne CBD",
    sourceLabel: "Temperature information unavailable",
  };
}

async function getNearbyTemperature(latitude, longitude) {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  const url =
    `${API_BASE_URL}/api/microclimate/nearby` +
    `?lat=${encodeURIComponent(latitude)}` +
    `&lng=${encodeURIComponent(longitude)}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const observation = data?.observation;
    const temperature = Number(
      observation?.air_temperature
    );

    if (!Number.isFinite(temperature)) {
      return null;
    }

    return {
      temperature,
      locationName:
        typeof observation.sensor_location === "string" &&
        observation.sensor_location.trim()
          ? observation.sensor_location
          : "Nearest microclimate sensor",
      sourceLabel: "Live nearby temperature",
    };
  } catch {
    return null;
  }
}

async function getLatestUvIndex() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/uv/latest`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const uvIndex = data?.observation?.uv_index;

    if (
      typeof uvIndex !== "number" ||
      !Number.isFinite(uvIndex) ||
      uvIndex < 0
    ) {
      return null;
    }

    return uvIndex;
  } catch {
    return null;
  }
}

export async function getEnvironmentalData(
  latitude,
  longitude
) {
  const fallback =
    getEnvironmentalFallback();

  const hasUserLocation =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  const temperatureLatitude =
    hasUserLocation
      ? latitude
      : MELBOURNE_CBD_LOCATION.latitude;

  const temperatureLongitude =
    hasUserLocation
      ? longitude
      : MELBOURNE_CBD_LOCATION.longitude;

  const [
    temperatureData,
    uvIndex,
  ] = await Promise.all([
    getNearbyTemperature(
      temperatureLatitude,
      temperatureLongitude
    ),

    getLatestUvIndex(),
  ]);

  return {
    ...fallback,
    ...(temperatureData ?? {}),
    uvIndex,

    temperatureIsLocationBased:
      hasUserLocation,
  };
}
