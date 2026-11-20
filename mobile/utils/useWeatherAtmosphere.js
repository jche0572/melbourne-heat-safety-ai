import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { getWeatherAtmosphere } from "../services/weatherAtmosphereService";
import { getWeatherScene } from "./weatherScene";

export default function useWeatherAtmosphere(location, active) {
  const latitude = location?.latitude;
  const longitude = location?.longitude;
  const [observation, setObservation] = useState(null);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!active) return undefined;
    let disposed = false;
    let request = 0;
    async function refresh() {
      if (AppState.currentState && AppState.currentState !== "active") return;
      const id = ++request;
      const data = await getWeatherAtmosphere(latitude, longitude);
      if (!disposed && id === request) {
        setObservation(data);
        setNow(Date.now());
      }
    }
    setObservation(null);
    refresh();
    const refreshTimer = setInterval(refresh, 10 * 60 * 1000);
    const clockTimer = setInterval(() => setNow(Date.now()), 60 * 1000);
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active") { setNow(Date.now()); refresh(); }
    });
    return () => {
      disposed = true;
      clearInterval(refreshTimer);
      clearInterval(clockTimer);
      subscription.remove();
    };
  }, [latitude, longitude, active]);

  return { scene: getWeatherScene(observation, now), observation };
}
