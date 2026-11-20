import * as Location from "expo-location";

export async function requestCurrentUserLocation() {
  const permission =
    await Location.requestForegroundPermissionsAsync();

  if (permission.status !== "granted") {
    return {
      granted: false,
      canAskAgain: permission.canAskAgain,
      location: null,
    };
  }

  const location =
    await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

  return {
    granted: true,
    canAskAgain: permission.canAskAgain,
    location: {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    },
  };
}

// Keep this function so existing code continues working.
export async function getCurrentUserLocation() {
  const result =
    await requestCurrentUserLocation();

  return result.location;
}