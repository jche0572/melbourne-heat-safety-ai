import { createMiniMapRoute, createGoogleMapsUrl } from "./miniMapRoute";

// Called synchronously from a user gesture so browsers can permit the popup.
// Only retain a launch handle; never inspect the Google Maps document or route state.
export function createGoogleMapsLauncher(save, reportError, browser = window) {
  let mapsTab = null;
  let openedUrl = null;
  return params => {
    try {
      const snapshot = createMiniMapRoute(params);
      const url = createGoogleMapsUrl(snapshot);
      save({ ...snapshot, mode: "googleMaps", googleMapsUrl: url });
      reportError(null);
      if (mapsTab && !mapsTab.closed && openedUrl === url) {
        mapsTab.focus();
        return true;
      }
      const opened = browser.open(url, "soladapt-cooling-route");
      if (!opened) throw new Error("Google Maps was blocked. Allow popups for SolAdapt, then try the map button again.");
      mapsTab = opened;
      openedUrl = url;
      // Prevent the external page from accessing the SolAdapt opener.
      opened.opener = null;
      return true;
    } catch (error) {
      reportError(error.message || "Unable to open Google Maps. Try the map button again.");
      return false;
    }
  };
}
