import { getWeatherScene } from "../utils/weatherScene";

export async function getWeatherAtmosphere(latitude, longitude) {
  const isLocationBased = Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
    Number.isFinite(longitude) && Math.abs(longitude) <= 180;
  const result = {
    scene: "neutral",
    observedAt: null,
    weatherCode: null,
    isDay: null,
    sunrise: null,
    sunset: null,
    isLocationBased,
    locationLabel: isLocationBased ? "Current location" : "Melbourne CBD",
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    // Unix timestamps avoid interpreting the location's local time in the device timezone.
    const response = await fetch(
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${isLocationBased ? latitude : -37.8136}` +
      `&longitude=${isLocationBased ? longitude : 144.9631}` +
      "&current=weather_code,is_day&daily=sunrise,sunset&timezone=auto&timeformat=unixtime&forecast_days=1",
      { signal: controller.signal }
    );
    if (!response.ok) return result;
    const data = await response.json();
    const current = data?.current;
    result.observedAt = Number.isFinite(current?.time) ? current.time * 1000 : null;
    result.weatherCode = Number.isInteger(current?.weather_code) ? current.weather_code : null;
    result.isDay = current?.is_day === 1 ? true : current?.is_day === 0 ? false : null;
    const sunrise = data?.daily?.sunrise?.[0];
    const sunset = data?.daily?.sunset?.[0];
    result.sunrise = Number.isFinite(sunrise) ? sunrise * 1000 : null;
    result.sunset = Number.isFinite(sunset) ? sunset * 1000 : null;
    result.scene = getWeatherScene(result);
    return result;
  } catch {
    return result;
  } finally {
    clearTimeout(timeout);
  }
}
