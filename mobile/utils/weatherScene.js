const MAX_OBSERVATION_AGE = 45 * 60 * 1000;
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 97, 99]);
const CLOUD_CODES = new Set([2, 3, 45, 48, 71, 73, 75, 77, 85, 86]);

export function getWeatherScene(observation, now = Date.now()) {
  const age = now - observation?.observedAt;
  if (!Number.isFinite(observation?.observedAt) || !Number.isFinite(age) ||
      age < -5 * 60 * 1000 || age > MAX_OBSERVATION_AGE) {
    return "neutral";
  }

  let isDay = observation.isDay;
  if (Number.isFinite(observation.sunrise) && Number.isFinite(observation.sunset) &&
      observation.sunrise < observation.sunset) {
    isDay = now >= observation.sunrise && now < observation.sunset;
  }
  if (isDay === false) return "night";
  if (isDay !== true) return "neutral";
  if (observation.weatherCode === 0 || observation.weatherCode === 1) return "sun";
  if (RAIN_CODES.has(observation.weatherCode)) return "rain";
  // Snow has no dedicated design: use overcast, never depict snowfall as rain.
  if (CLOUD_CODES.has(observation.weatherCode)) return "cloud";
  return "neutral";
}
