function coordinate(value) {
  if (typeof value !== "number" && !(typeof value === "string" && value.trim())) return NaN;
  return Number(value);
}

function copyPoint(point) {
  const latitude = coordinate(point?.latitude);
  const longitude = coordinate(point?.longitude);
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
      !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    throw new Error("A valid cooling route is required to minimize the map.");
  }
  return { ...point, latitude, longitude };
}

// Copy the already-calculated route, including the optional second leg. No fetching.
export function createMiniMapRoute(params) {
  if (!Array.isArray(params?.routeCoordinates) || params.routeCoordinates.length < 2) {
    throw new Error("Calculate a walking route before minimizing the map.");
  }
  if (params.finalRouteCoordinates != null && !Array.isArray(params.finalRouteCoordinates)) {
    throw new Error("The final walking route is invalid.");
  }
  return {
    origin: params.origin ? copyPoint(params.origin) : null,
    coolingOption: copyPoint(params.coolingOption),
    routeInfo: params.routeInfo ? { ...params.routeInfo } : null,
    routeCoordinates: params.routeCoordinates.map(copyPoint),
    finalDestination: params.finalDestination ? copyPoint(params.finalDestination) : null,
    finalRouteCoordinates: (params.finalRouteCoordinates ?? []).map(copyPoint),
  };
}

export function minimizeCoolingRoute(navigation, params, onMinimize) {
  const snapshot = createMiniMapRoute(params);
  onMinimize(snapshot);
  if (navigation.canGoBack()) navigation.goBack();
  else navigation.replace("NearbyCooling");
  return snapshot;
}

export function restoreCoolingRoute(navigation, params, popToAction) {
  const snapshot = createMiniMapRoute(params);
  const state = navigation.getRootState();
  if (state.routes.some(route => route.name === "CoolingNavigation")) {
    navigation.dispatch(popToAction("CoolingNavigation", snapshot));
  } else {
    navigation.navigate("CoolingNavigation", snapshot);
  }
}

export function shouldShowMiniMap(snapshot, currentScreen) {
  return snapshot != null && currentScreen != null &&
    (snapshot.mode === "googleMaps" || currentScreen !== "CoolingNavigation");
}

// Keep the existing Google Maps walking URL semantics, including the cooling waypoint.
export function createGoogleMapsUrl(snapshot) {
  if (!snapshot.origin) throw new Error("A starting location is required to open Google Maps.");
  const point = value => `${value.latitude},${value.longitude}`;
  let url = "https://www.google.com/maps/dir/?api=1" +
    `&origin=${point(snapshot.origin)}&travelmode=walking`;
  if (snapshot.finalDestination) {
    url += `&destination=${point(snapshot.finalDestination)}&waypoints=${point(snapshot.coolingOption)}`;
  } else url += `&destination=${point(snapshot.coolingOption)}`;
  return url;
}
