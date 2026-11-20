import { Linking, Platform } from "react-native";
import { createMiniMapRoute, createGoogleMapsUrl } from "./miniMapRoute";

// Prefer Google's explicit iOS app scheme: HTTPS universal-link handoffs can
// open a browser instead inside Expo Go. Attempting openURL avoids canOpenURL's
// app-query allowlist requirement in the shared Expo Go host.
export async function openGoogleMapsUrl(url, linking = Linking, platform = Platform.OS) {
  if (platform === "ios") {
    try {
      await linking.openURL(url.replace(/^https:\/\//, "comgooglemapsurl://"));
      return;
    } catch (_) {
      // Google Maps is unavailable; retain the complete route in the web fallback.
    }
  }
  await linking.openURL(url);
}

export function createGoogleMapsLauncher(save, reportError, linking = Linking) {
  let launching = false;
  return async params => {
    if (launching) return false;
    launching = true;
    try {
      const snapshot = createMiniMapRoute(params);
      const url = createGoogleMapsUrl(snapshot);
      save({ ...snapshot, mode: "googleMaps", googleMapsUrl: url });
      reportError(null);
      await openGoogleMapsUrl(url, linking);
      return true;
    } catch (error) {
      reportError("Unable to open Google Maps. Tap the map button to retry, or dismiss the saved route.");
      return false;
    } finally {
      launching = false;
    }
  };
}
