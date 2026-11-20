export async function requestCurrentUserLocation() {
  if (
    typeof navigator === "undefined" ||
    !navigator.geolocation
  ) {
    return {
      granted: false,
      canAskAgain: false,
      location: null,
    };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          granted: true,
          canAskAgain: true,
          location: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        });
      },

      (error) => {
        if (error?.code === 1) {
          resolve({
            granted: false,

            // Browser permission behaviour is handled
            // by the browser rather than Android/iOS.
            canAskAgain: true,

            location: null,
          });

          return;
        }

        resolve({
          granted: false,
          canAskAgain: true,
          location: null,
        });
      },

      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  });
}

export async function getCurrentUserLocation() {
  const result =
    await requestCurrentUserLocation();

  return result.location;
}