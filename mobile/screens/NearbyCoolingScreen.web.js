import { DARK_MAP_STYLE } from "../theme/mapStyle";
import { useThemedStyles } from "../theme/useAppTheme";
import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import {
  GoogleMap,
  MarkerF,
  PolylineF,
  useJsApiLoader,
} from "@react-google-maps/api";

import polyline from "@mapbox/polyline";

import {
  getNearbyFountains,
  getNearbyShade,
  getWalkingRoute,
} from "../services/nearbyCoolingService";

import {
  getCurrentUserLocation,
  requestCurrentUserLocation,
} from "../services/locationService";

import LocationSearchBar from "../components/LocationSearchBar";
import { getCoolingDisplay } from "../utils/coolingDisplay";

/*
 * Checks whether a GPS or searched location is inside
 * the official City of Melbourne service area.
 */
import {
  checkCityOfMelbourneServiceArea,
} from "../services/serviceAreaService";


/* -------------------------------------------------------
   DEFAULT MAP LOCATION

   Used only when browser location permission
   is unavailable.

   This location does NOT trigger nearby
   shade or water searches.
------------------------------------------------------- */

const MELBOURNE_DEFAULT_LOCATION = {
  latitude: -37.8136,
  longitude: 144.9631,
  label: "Melbourne CBD",
};

const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f4f8f4" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#586b65" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#a9dff5" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#cdebc9" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#dce6e0" }] },
];


/* -------------------------------------------------------
   GOOGLE MAP
------------------------------------------------------- */

function WebGoogleMap({
  userLocation,
  searchOrigin,
  isManualSearch,
  mapDisplayLocation,

  fountains,
  shadeAreas,

  selectedCoolingType,

  selectedFountain,
  selectedShade,

  mapTarget,
  routeCoordinates,

  onSelectFountain,
  onSelectShade,
}) {
  const { styles, theme } = useThemedStyles(baseStyles);
  const {
    isLoaded,
    loadError,
  } = useJsApiLoader({
    id: "shadeadapt-google-map",
    googleMapsApiKey:
      GOOGLE_MAPS_API_KEY || "",
  });

  const [
    map,
    setMap,
  ] = useState(null);


  /* -------------------------------------------------------
     MOVE / FIT MAP
  ------------------------------------------------------- */

  useEffect(() => {
    if (!map) {
      return;
    }

    /*
     * If a route exists, fit the whole
     * route inside the visible map.
     */
    if (
      Array.isArray(routeCoordinates) &&
      routeCoordinates.length > 1
    ) {
      const bounds =
        new window.google.maps.LatLngBounds();

      routeCoordinates.forEach(
        (point) => {
          bounds.extend({
            lat: point.latitude,
            lng: point.longitude,
          });
        }
      );

      map.fitBounds(bounds, 40);

      return;
    }

    /*
     * Otherwise move to current target.
     */
    if (mapTarget) {
      map.panTo({
        lat: mapTarget.latitude,
        lng: mapTarget.longitude,
      });

      map.setZoom(17);
    }
  }, [
    map,
    mapTarget,
    routeCoordinates,
  ]);


  /* -------------------------------------------------------
     MARKER ICON HELPER
  ------------------------------------------------------- */

  const createMarkerIcon = (type, selected = false) => {
    if (
      typeof window === "undefined" ||
      !window.google
    ) {
      return undefined;
    }

    const color = type === "shade" ? "#087751" : type === "water" ? "#147BD1" : "#52615C";
    const halo = selected
      ? `<circle cx="28" cy="28" r="26" fill="${color}" fill-opacity=".2"/>`
      : "";
    const icon = type === "shade"
      ? '<circle cx="22" cy="24" r="6" fill="white"/><circle cx="28" cy="20" r="7" fill="white"/><circle cx="34" cy="24" r="6" fill="white"/><path d="M27 25h3v12h-3z" fill="white"/>'
      : type === "water"
        ? '<path d="M28 16c-5 7-9 12-9 17a9 9 0 0 0 18 0c0-5-4-10-9-17z" fill="white"/>'
        : '<path d="M28 14a10 10 0 0 0-10 10c0 8 10 18 10 18s10-10 10-18a10 10 0 0 0-10-10zm0 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" fill="white"/>';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">${halo}<circle cx="28" cy="28" r="${selected ? 21 : 18}" fill="${color}" stroke="white" stroke-width="3"/>${icon}</svg>`;

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new window.google.maps.Size(56, 56),
      anchor: new window.google.maps.Point(28, 28),
    };
  };

  const createCurrentLocationIcon = () => {
    if (typeof window === "undefined" || !window.google) return undefined;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><circle cx="18" cy="18" r="15" fill="#2F6FED" fill-opacity=".2"/><circle cx="18" cy="18" r="8" fill="#2F6FED" stroke="white" stroke-width="3"/></svg>';
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new window.google.maps.Size(36, 36),
      anchor: new window.google.maps.Point(18, 18),
    };
  };


  /* -------------------------------------------------------
     GOOGLE MAP LOADING
  ------------------------------------------------------- */

  if (loadError) {
    return (
      <View
        style={
          styles.mapMessageContainer
        }
      >
        <Ionicons
          name="alert-circle-outline"
          size={32}
          color={theme.color("#B3261E")}
        />

        <Text
          style={styles.mapErrorText}
        >
          Unable to load Google Maps.
        </Text>
      </View>
    );
  }

  if (!isLoaded) {
    return (
      <View
        style={
          styles.mapMessageContainer
        }
      >
        <Text
          style={styles.mapLabel}
        >
          Loading map...
        </Text>
      </View>
    );
  }


  /* -------------------------------------------------------
     GOOGLE MAP
  ------------------------------------------------------- */

  return (
    <GoogleMap
      mapContainerStyle={{
        width: "100%",
        height: "100%",
      }}

      center={{
        lat:
          mapDisplayLocation.latitude,

        lng:
          mapDisplayLocation.longitude,
      }}

      zoom={16}

      onLoad={(loadedMap) => {
        // Use the dedicated setter: renderingType cannot be updated through setOptions.
        loadedMap.setRenderingType(window.google.maps.RenderingType.VECTOR);
        setMap(loadedMap);
      }}

      onUnmount={() =>
        setMap(null)
      }

      options={{
        tilt: 0,
        heading: 0,
        tiltInteractionEnabled: false,
        headingInteractionEnabled: false,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        cameraControl: false,
        clickableIcons: false,
        styles: theme.dark ? DARK_MAP_STYLE : MAP_STYLE,
      }}
    >

      {/* -----------------------------------------
          ACTUAL USER LOCATION
      ----------------------------------------- */}

      {userLocation && (
        <MarkerF
          position={{
            lat:
              userLocation.latitude,

            lng:
              userLocation.longitude,
          }}

          title="Your current location"

          icon={createCurrentLocationIcon()}

          zIndex={1000}
        />
      )}


      {/* -----------------------------------------
          MANUALLY SEARCHED LOCATION
      ----------------------------------------- */}

      {isManualSearch &&
        searchOrigin && (
          <MarkerF
            position={{
              lat:
                searchOrigin.latitude,

              lng:
                searchOrigin.longitude,
            }}

            title={
              searchOrigin.label ||
              "Search location"
            }

            icon={createMarkerIcon("search")}
            zIndex={900}
          />
        )}


      {/* -----------------------------------------
          WATER MARKERS
      ----------------------------------------- */}

      {selectedCoolingType ===
        "water" &&
        fountains.map(
          (fountain) => {
            const latitude =
              Number(
                fountain.latitude
              );

            const longitude =
              Number(
                fountain.longitude
              );

            if (
              !Number.isFinite(
                latitude
              ) ||
              !Number.isFinite(
                longitude
              )
            ) {
              return null;
            }

            const isSelected =
              selectedFountain
                ?.asset_id ===
              fountain.asset_id;

            return (
              <MarkerF
                key={
                  fountain.asset_id
                }

                position={{
                  lat: latitude,
                  lng: longitude,
                }}

                title={
                  fountain.facility_type
                }

                icon={createMarkerIcon("water", isSelected)}

                onClick={() =>
                  onSelectFountain(
                    fountain
                  )
                }
              />
            );
          }
        )}


      {/* -----------------------------------------
          SHADE MARKERS
      ----------------------------------------- */}

      {selectedCoolingType ===
        "shade" &&
        shadeAreas.map(
          (shade) => {
            const latitude =
              Number(
                shade.latitude
              );

            const longitude =
              Number(
                shade.longitude
              );

            if (
              !Number.isFinite(
                latitude
              ) ||
              !Number.isFinite(
                longitude
              )
            ) {
              return null;
            }

            const isSelected =
              selectedShade
                ?.canopy_id ===
              shade.canopy_id;

            return (
              <MarkerF
                key={
                  `shade-${shade.canopy_id}`
                }

                position={{
                  lat: latitude,
                  lng: longitude,
                }}

                title="Tree shade area"

                icon={createMarkerIcon("shade", isSelected)}

                onClick={() =>
                  onSelectShade(
                    shade
                  )
                }
              />
            );
          }
        )}

      {/* -----------------------------------------
          WALKING ROUTE
      ----------------------------------------- */}

      {routeCoordinates.length >
        0 && (
        <PolylineF
          path={routeCoordinates.map(
            (point) => ({
              lat: point.latitude,
              lng: point.longitude,
            })
          )}

          options={{
            strokeColor:
              "#39775F",

            strokeOpacity: 1,

            strokeWeight: 5,
          }}
        />
      )}
    </GoogleMap>
  );
}


/* =======================================================
   MAIN SCREEN
======================================================= */

export default function NearbyCoolingScreen({
  navigation,
}) {
  const { styles, theme } = useThemedStyles(baseStyles);

  /* -------------------------------------------------------
     LOCATION
  ------------------------------------------------------- */

  const [
    userLocation,
    setUserLocation,
  ] = useState(null);

  /*
   * The actual origin used to search
   * nearby shade/water.
   */
  const [
    searchOrigin,
    setSearchOrigin,
  ] = useState(null);

  /*
   * Location used only to display map.
   */
  const [
    mapDisplayLocation,
    setMapDisplayLocation,
  ] = useState(null);

  const [
    isManualSearch,
    setIsManualSearch,
  ] = useState(false);

  const [
    locationError,
    setLocationError,
  ] = useState(null);

  /*
  * Tracks whether the user's CURRENT GPS location is outside
  * the City of Melbourne.
  *
  * This is different from location permission:
  *
  * false:
  * - permission denied, OR
  * - current GPS is inside City of Melbourne
  *
  * true:
  * - permission granted
  * - GPS successfully obtained
  * - PostGIS confirmed it is outside City of Melbourne
  */
  const [
    isCurrentLocationOutsideServiceArea,
    setIsCurrentLocationOutsideServiceArea,
  ] = useState(false);

  /*
  * Tracks whether the user's most recent MANUAL search
  * selected a location outside the City of Melbourne.
  *
  * This is separate from:
  * isCurrentLocationOutsideServiceArea
  *
  * because the user's GPS location and searched location
  * are two different things.
  */
  const [
    isManualSearchOutsideServiceArea,
    setIsManualSearchOutsideServiceArea,
  ] = useState(false);

  const [
    mapTarget,
    setMapTarget,
  ] = useState(null);


  /* -------------------------------------------------------
     COOLING TYPE
  ------------------------------------------------------- */

  const [
    selectedCoolingType,
    setSelectedCoolingType,
  ] = useState("shade");


  /* -------------------------------------------------------
     WATER
  ------------------------------------------------------- */

  const [
    fountains,
    setFountains,
  ] = useState([]);

  const [
    fountainLoading,
    setFountainLoading,
  ] = useState(false);

  const [
    fountainError,
    setFountainError,
  ] = useState(null);

  const [
    selectedFountain,
    setSelectedFountain,
  ] = useState(null);


  /* -------------------------------------------------------
     SHADE
  ------------------------------------------------------- */

  const [
    shadeAreas,
    setShadeAreas,
  ] = useState([]);

  const [
    shadeLoading,
    setShadeLoading,
  ] = useState(false);

  const [
    shadeError,
    setShadeError,
  ] = useState(null);

  const [
    selectedShade,
    setSelectedShade,
  ] = useState(null);


  /* -------------------------------------------------------
     ROUTE
  ------------------------------------------------------- */

  const [
    routeCoordinates,
    setRouteCoordinates,
  ] = useState([]);

  const [
    routeInfo,
    setRouteInfo,
  ] = useState(null);

  const [
    routeLoading,
    setRouteLoading,
  ] = useState(false);

  const [
    routeError,
    setRouteError,
  ] = useState(null);

  const [
    showAllResults,
    setShowAllResults,
  ] = useState(false);


  /* -------------------------------------------------------
    INITIAL LOCATION REQUEST
  ------------------------------------------------------- */

  useEffect(() => {
    let isMounted = true;

    async function loadLocation() {
      try {
        /*
        * Ask the browser for the user's current GPS location.
        */
        const location =
          await getCurrentUserLocation();

        /*
        * Stop if the screen was closed while waiting.
        */
        if (!isMounted) {
          return;
        }

        /*
        * ----------------------------------------------------
        * CASE 1: LOCATION PERMISSION DENIED
        * ----------------------------------------------------
        *
        * Keep your existing behaviour:
        * - show Melbourne CBD on the map
        * - do not fetch shade/water
        * - allow manual search
        */
        if (!location) {
          setIsCurrentLocationOutsideServiceArea(
            false
          );

          setUserLocation(null);
          setSearchOrigin(null);
          setIsManualSearch(false);

          setLocationError(
            "Location permission denied"
          );

          setMapDisplayLocation(
            MELBOURNE_DEFAULT_LOCATION
          );

          setMapTarget(
            MELBOURNE_DEFAULT_LOCATION
          );

          return;
        }

        /*
        * ----------------------------------------------------
        * CASE 2: LOCATION PERMISSION GRANTED
        * ----------------------------------------------------
        *
        * Check the GPS location against the official
        * City of Melbourne municipal boundary.
        */
        const serviceAreaResult =
          await checkCityOfMelbourneServiceArea(
            location.latitude,
            location.longitude
          );

        /*
        * ----------------------------------------------------
        * CASE 2A: OUTSIDE CITY OF MELBOURNE
        * ----------------------------------------------------
        */
        if (
          !serviceAreaResult.insideCityOfMelbourne
        ) {
          setIsCurrentLocationOutsideServiceArea(
            true
          );

          /*
          * Do not show or use the outside GPS location.
          */
          setUserLocation(null);

          /*
          * null prevents shade/water API requests.
          */
          setSearchOrigin(null);
          setIsManualSearch(false);

          /*
          * Remove old results if there are any.
          */
          setFountains([]);
          setShadeAreas([]);

          /*
          * Show Melbourne CBD only as the map fallback.
          */
          setMapDisplayLocation(
            MELBOURNE_DEFAULT_LOCATION
          );

          setMapTarget(
            MELBOURNE_DEFAULT_LOCATION
          );

          setLocationError(
            "You're currently outside the City of Melbourne. Search for a location within the City of Melbourne, or use this feature when you're in the service area."
          );

          return;
        }

        /*
        * ----------------------------------------------------
        * CASE 2B: INSIDE CITY OF MELBOURNE
        * ----------------------------------------------------
        */
        setIsCurrentLocationOutsideServiceArea(
          false
        );

        setUserLocation(location);

        const currentLocation = {
          ...location,
          label: "Current Location",
        };

        setSearchOrigin(
          currentLocation
        );

        setMapDisplayLocation(
          currentLocation
        );

        setMapTarget(
          currentLocation
        );

        setIsManualSearch(false);
        setLocationError(null);

      } catch (error) {
        console.error(
          "Could not get or validate initial browser location:",
          error
        );

        if (!isMounted) {
          return;
        }

        /*
        * If the service-area check fails, do not assume
        * the user is outside City of Melbourne.
        */
        setIsCurrentLocationOutsideServiceArea(
          false
        );

        setUserLocation(null);
        setSearchOrigin(null);
        setIsManualSearch(false);

        setLocationError(
          "Unable to verify your current location. You can still search for a location within the City of Melbourne."
        );

        setMapDisplayLocation(
          MELBOURNE_DEFAULT_LOCATION
        );

        setMapTarget(
          MELBOURNE_DEFAULT_LOCATION
        );
      }
    }

    loadLocation();

    return () => {
      isMounted = false;
    };
  }, []);


  /* -------------------------------------------------------
     LOAD WATER
  ------------------------------------------------------- */

  useEffect(() => {
    if (!searchOrigin) {
      return undefined;
    }

    let isMounted = true;

    async function loadFountains() {
      try {
        setFountainLoading(true);

        setFountainError(null);

        const data =
          await getNearbyFountains(
            searchOrigin.latitude,
            searchOrigin.longitude
          );

        if (isMounted) {
          setFountains(
            Array.isArray(
              data?.fountains
            )
              ? data.fountains
              : []
          );
        }
      } catch (error) {
        console.error(
          "Could not load fountains:",
          error
        );

        if (isMounted) {
          setFountainError(
            "Could not load nearby drinking fountains"
          );
        }
      } finally {
        if (isMounted) {
          setFountainLoading(false);
        }
      }
    }

    loadFountains();

    return () => {
      isMounted = false;
    };
  }, [searchOrigin]);


  /* -------------------------------------------------------
     LOAD SHADE
  ------------------------------------------------------- */

  useEffect(() => {
    if (!searchOrigin) {
      return undefined;
    }

    let isMounted = true;

    async function loadShade() {
      try {
        setShadeLoading(true);

        setShadeError(null);

        const data =
          await getNearbyShade(
            searchOrigin.latitude,
            searchOrigin.longitude
          );

        if (isMounted) {
          setShadeAreas(
            Array.isArray(
              data?.shadeAreas
            )
              ? data.shadeAreas
              : []
          );
        }
      } catch (error) {
        console.error(
          "Could not load shade:",
          error
        );

        if (isMounted) {
          setShadeError(
            "Could not load nearby shade areas"
          );
        }
      } finally {
        if (isMounted) {
          setShadeLoading(false);
        }
      }
    }

    loadShade();

    return () => {
      isMounted = false;
    };
  }, [searchOrigin]);


  /* -------------------------------------------------------
     CLEAR ROUTE
  ------------------------------------------------------- */

  const clearRoute = () => {
    setSelectedFountain(null);

    setSelectedShade(null);

    setRouteCoordinates([]);

    setRouteInfo(null);

    setRouteError(null);

    setRouteLoading(false);
  };


  /* -------------------------------------------------------
    MANUAL SEARCH
  ------------------------------------------------------- */

  /*
  * This function runs after the user selects a location
  * from the search bar.
  *
  * IMPORTANT:
  *
  * We check the City of Melbourne boundary BEFORE changing
  * any map or nearby-cooling state.
  *
  * This means an invalid outside-area search cannot move
  * the map or replace the user's existing results.
  */
  const handleManualLocationSelected =
    async (location) => {
      try {
        /*
        * --------------------------------------------------
        * STEP 1: Validate the selected coordinates
        * --------------------------------------------------
        *
        * The Google Places search should already return
        * numbers, but we validate them again before sending
        * them to our backend service-area endpoint.
        */
        const latitude =
          Number(location?.latitude);

        const longitude =
          Number(location?.longitude);

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          Alert.alert(
            "Unable to use this location",
            "The selected location does not contain valid coordinates.",
            [
              {
                text: "Cancel",
                style: "cancel",
              },
            ]
          );

          return;
        }


        /*
        * --------------------------------------------------
        * STEP 2: Check City of Melbourne boundary
        * --------------------------------------------------
        *
        * This calls:
        *
        * GET /api/service-area/check
        *
        * The backend then uses PostGIS ST_Covers() against
        * the official municipal boundary.
        */

        const serviceAreaResult =
          await checkCityOfMelbourneServiceArea(
            latitude,
            longitude
          );


        /*
        * --------------------------------------------------
        * STEP 3: OUTSIDE CITY OF MELBOURNE
        * --------------------------------------------------
        *
        * Do NOT change:
        *
        * - searchOrigin
        * - mapDisplayLocation
        * - mapTarget
        * - fountains
        * - shadeAreas
        * - route
        *
        * Therefore the map remains exactly where it was
        * before the invalid search.
        */
        if (
          !serviceAreaResult.insideCityOfMelbourne
        ) {
          /*
          * The manually searched location is outside
          * the City of Melbourne service area.
          */
          setIsManualSearchOutsideServiceArea(
            true
          );

          /*
          * --------------------------------------------------
          * CLEAR THE PREVIOUS VALID SEARCH
          * --------------------------------------------------
          *
          * Example:
          *
          * User searched Federation Square first.
          * The map currently contains Federation Square
          * shade/water results.
          *
          * They then search Box Hill.
          *
          * We should NOT keep showing the old Federation
          * Square results because the search box now refers
          * to Box Hill.
          */


          /*
          * Remove the previous search origin.
          *
          * This also prevents the shade/water useEffects
          * from making another request.
          */
          setSearchOrigin(null);


          /*
          * Remove the previous manually searched marker.
          */
          setIsManualSearch(false);


          /*
          * Remove previous cooling markers and result cards.
          */
          setFountains([]);
          setShadeAreas([]);


          /*
          * Remove any selected fountain/shade and walking route
          * that belonged to the previous valid search.
          */
          clearRoute();


          /*
          * Clear old API errors.
          */
          setFountainError(null);
          setShadeError(null);


          /*
          * IMPORTANT:
          *
          * We deliberately do NOT call:
          *
          * setMapDisplayLocation(...)
          * setMapTarget(...)
          *
          * Therefore the map itself stays at its previous
          * geographic position instead of moving to Box Hill.
          */


          /*
          * Show the outside-service-area popup.
          */
          window.alert(
            "This location is outside the City of Melbourne. Please search for a location within the City of Melbourne."
          );


          /*
          * Stop here.
          *
          * Box Hill must never become the search origin.
          */
          return;
        }


        /*
        * --------------------------------------------------
        * STEP 4: INSIDE CITY OF MELBOURNE
        * --------------------------------------------------
        *
        * The location is supported, so continue with the
        * existing Nearby Cooling behaviour.
        */

        /*
        * The searched location passed the City of Melbourne
        * boundary check.
        *
        * Clear any previous "manual search outside" state.
        */
        setIsManualSearchOutsideServiceArea(
          false
        );

        /*
        * Use a clean location object with numeric coordinates.
        */
        const validLocation = {
          ...location,

          latitude,
          longitude,
        };


        /*
        * This location becomes the origin used to retrieve
        * nearby shade and drinking fountains.
        */
        setSearchOrigin(
          validLocation
        );


        /*
        * Move the displayed map to the searched location.
        */
        setMapDisplayLocation(
          validLocation
        );


        /*
        * Move/focus the Google map on this location.
        */
        setMapTarget(
          validLocation
        );


        /*
        * Tell the map that this came from manual search,
        * allowing the searched-location marker to appear.
        */
        setIsManualSearch(true);


        /*
        * Clear old location/API error messages.
        */
        setLocationError(null);

        setFountainError(null);

        setShadeError(null);


        /*
        * Remove any route or selected cooling option from
        * the previous search origin.
        *
        * A previous route should not remain visible after
        * changing the search location.
        */
        clearRoute();

      } catch (error) {
        console.error(
          "Could not validate searched location:",
          error
        );


        /*
        * A backend/network failure is different from the
        * searched location being outside City of Melbourne.
        *
        * In either case we do NOT change the map because we
        * cannot safely verify that the location is supported.
        */
        Alert.alert(
          "Unable to verify location",
          "SolAdapt could not verify whether this location is within the City of Melbourne. Please try again.",
          [
            {
              text: "Cancel",
              style: "cancel",
            },
          ]
        );
      }
    };


  /* -------------------------------------------------------
    CURRENT LOCATION BUTTON
  ------------------------------------------------------- */

  /*
  * This function runs when the user presses the
  * current-location icon inside the search bar.
  *
  * The flow is:
  *
  * Request GPS
  *      ↓
  * Permission granted?
  *      ↓
  * Check City of Melbourne boundary
  *      ↓
  * Inside  → use current location normally
  * Outside → show Melbourne CBD fallback + warning
  */
  const handleCurrentLocationPress =
    async () => {
      try {
        /*
        * Clear any previous location message before
        * requesting the current location again.
        */
        setLocationError(null);

        /*
        * The user is trying CURRENT LOCATION now,
        * so a previous rejected manual-search message
        * is no longer the active situation.
        */
        setIsManualSearchOutsideServiceArea(
          false
        );

        /*
        * Ask the browser/device for location permission
        * and retrieve the GPS coordinates.
        */
        const result =
          await requestCurrentUserLocation();


        /*
        * --------------------------------------------------
        * CASE 1: LOCATION PERMISSION NOT AVAILABLE
        * --------------------------------------------------
        *
        * The user either denied permission or the browser
        * could not provide a location.
        */
        if (
          !result.granted ||
          !result.location
        ) {
          /*
          * We do not know whether the user is geographically
          * outside City of Melbourne, so this is NOT an
          * outside-service-area state.
          */
          setIsCurrentLocationOutsideServiceArea(
            false
          );

          /*
          * Do not use any old GPS location.
          */
          setUserLocation(null);

          /*
          * Stop nearby shade/water requests.
          */
          setSearchOrigin(null);

          setIsManualSearch(false);

          /*
          * Clear any previous nearby results.
          */
          setFountains([]);
          setShadeAreas([]);

          /*
          * Clear selected cooling location and route.
          */
          clearRoute();

          /*
          * Show Melbourne CBD only as the neutral
          * map fallback.
          */
          setMapDisplayLocation(
            MELBOURNE_DEFAULT_LOCATION
          );

          setMapTarget(
            MELBOURNE_DEFAULT_LOCATION
          );

          /*
          * Show the normal permission message.
          */
          setLocationError(
            "Location access is unavailable. Allow location access in your browser settings, or search for a location manually."
          );

          return;
        }


        /*
        * --------------------------------------------------
        * CASE 2: GPS LOCATION WAS SUCCESSFULLY OBTAINED
        * --------------------------------------------------
        */
        const location =
          result.location;


        /*
        * Before using this location, check it against
        * the official City of Melbourne municipal boundary.
        */
        const serviceAreaResult =
          await checkCityOfMelbourneServiceArea(
            location.latitude,
            location.longitude
          );


        /*
        * --------------------------------------------------
        * CASE 2A: CURRENT LOCATION IS OUTSIDE
        * CITY OF MELBOURNE
        * --------------------------------------------------
        */
        if (
          !serviceAreaResult.insideCityOfMelbourne
        ) {
          /*
          * Remember that the current GPS location is
          * outside the supported service area.
          */
          setIsCurrentLocationOutsideServiceArea(
            true
          );

          /*
          * Do not display the unsupported GPS marker.
          */
          setUserLocation(null);

          /*
          * IMPORTANT:
          *
          * searchOrigin must remain null.
          *
          * Your shade/water useEffects only run when
          * searchOrigin exists, so this prevents the app
          * from searching around the outside location.
          */
          setSearchOrigin(null);

          setIsManualSearch(false);

          /*
          * Remove any results from a previous search.
          */
          setFountains([]);
          setShadeAreas([]);

          /*
          * Remove any previous route/selected location.
          */
          clearRoute();

          /*
          * Return the map to Melbourne CBD.
          *
          * Melbourne CBD is only being used as the
          * display location. It does NOT automatically
          * become the nearby-cooling search origin.
          */
          setMapDisplayLocation(
            MELBOURNE_DEFAULT_LOCATION
          );

          setMapTarget(
            MELBOURNE_DEFAULT_LOCATION
          );

          /*
          * The no-location section will use
          * isCurrentLocationOutsideServiceArea to show
          * the longer service-area explanation.
          */
          setLocationError(
            "You're currently outside the City of Melbourne."
          );

          /*
          * The user explicitly pressed Current Location,
          * but their actual GPS position is outside the
          * City of Melbourne.
          *
          * Show the warning every time they deliberately
          * try Current Location while outside the service area.
          */
          window.alert(
            "Your current location is outside the City of Melbourne. SolAdapt's location-based features are available within the City of Melbourne. Please search for a location within the service area."
          );

          return;
        }


        /*
        * --------------------------------------------------
        * CASE 2B: CURRENT LOCATION IS INSIDE
        * CITY OF MELBOURNE
        * --------------------------------------------------
        *
        * Continue with your normal nearby-cooling behaviour.
        */
        setIsCurrentLocationOutsideServiceArea(
          false
        );

        /*
        * Store the real GPS location so it can be shown
        * on the map.
        */
        setUserLocation(
          location
        );

        /*
        * Create the location object used by the nearby
        * shade/water APIs.
        */
        const currentLocation = {
          ...location,
          label: "Current Location",
        };


        /*
        * Use the current location as the origin for
        * shade and water searches.
        */
        setSearchOrigin(
          currentLocation
        );


        /*
        * Centre the map on the valid current location.
        */
        setMapDisplayLocation(
          currentLocation
        );

        setMapTarget(
          currentLocation
        );


        /*
        * This is a GPS location rather than a manually
        * searched location.
        */
        setIsManualSearch(false);


        /*
        * Clear old errors/results/route state.
        */
        setLocationError(null);

        setFountainError(null);
        setShadeError(null);

        clearRoute();

      } catch (error) {
        console.error(
          "Could not get or validate current browser location:",
          error
        );


        /*
        * A backend/network error does NOT prove that the
        * user is outside City of Melbourne.
        */
        setIsCurrentLocationOutsideServiceArea(
          false
        );

        /*
        * Do not use an unverified current location.
        */
        setUserLocation(null);
        setSearchOrigin(null);
        setIsManualSearch(false);

        setFountains([]);
        setShadeAreas([]);

        clearRoute();


        /*
        * Use Melbourne CBD as the safe display fallback.
        */
        setMapDisplayLocation(
          MELBOURNE_DEFAULT_LOCATION
        );

        setMapTarget(
          MELBOURNE_DEFAULT_LOCATION
        );


        /*
        * Let the user continue using manual search.
        */
        setLocationError(
          "Unable to verify your current location. Please search for a location within the City of Melbourne."
        );
      }
    };


  /* -------------------------------------------------------
     SHADE / WATER SWITCH
  ------------------------------------------------------- */

  const handleCoolingTypeChange = (
    type
  ) => {
    setSelectedCoolingType(type);

    setShowAllResults(false);

    clearRoute();

    if (searchOrigin) {
      setMapTarget(searchOrigin);
    }
  };


  /* -------------------------------------------------------
     WATER ROUTE
  ------------------------------------------------------- */

  const handleFountainPress =
    async (fountain) => {
      if (!searchOrigin) {
        return;
      }

      const destination = {
        latitude: Number(
          fountain.latitude
        ),

        longitude: Number(
          fountain.longitude
        ),
      };

      if (
        !Number.isFinite(
          destination.latitude
        ) ||
        !Number.isFinite(
          destination.longitude
        )
      ) {
        return;
      }

      try {
        setSelectedFountain(
          fountain
        );

        setSelectedShade(null);

        setRouteCoordinates([]);

        setRouteInfo(null);

        setRouteLoading(true);

        setRouteError(null);

        setMapTarget(destination);

        const route =
          await getWalkingRoute(
            searchOrigin.latitude,
            searchOrigin.longitude,

            destination.latitude,
            destination.longitude
          );

        const decodedPoints =
          polyline.decode(
            route.encodedPolyline
          );

        const coordinates =
          decodedPoints.map(
            ([
              latitude,
              longitude,
            ]) => ({
              latitude,
              longitude,
            })
          );

        setRouteCoordinates(
          coordinates
        );

        setRouteInfo({
          distanceMeters:
            route.distanceMeters,

          durationMinutes:
            route.durationMinutes,
        });
      } catch (error) {
        console.error(
          "Could not calculate walking route:",
          error
        );

        setRouteError(
          "Could not calculate walking route"
        );
      } finally {
        setRouteLoading(false);
      }
    };


  /* -------------------------------------------------------
     SHADE ROUTE
  ------------------------------------------------------- */

  const handleShadePress =
    async (shade) => {
      if (!searchOrigin) {
        return;
      }

      const destination = {
        latitude: Number(
          shade.latitude
        ),

        longitude: Number(
          shade.longitude
        ),
      };

      if (
        !Number.isFinite(
          destination.latitude
        ) ||
        !Number.isFinite(
          destination.longitude
        )
      ) {
        return;
      }

      try {
        setSelectedShade(
          shade
        );

        setSelectedFountain(null);

        setRouteCoordinates([]);

        setRouteInfo(null);

        setRouteLoading(true);

        setRouteError(null);

        setMapTarget(destination);

        const route =
          await getWalkingRoute(
            searchOrigin.latitude,
            searchOrigin.longitude,

            destination.latitude,
            destination.longitude
          );

        const decodedPoints =
          polyline.decode(
            route.encodedPolyline
          );

        const coordinates =
          decodedPoints.map(
            ([
              latitude,
              longitude,
            ]) => ({
              latitude,
              longitude,
            })
          );

        setRouteCoordinates(
          coordinates
        );

        setRouteInfo({
          distanceMeters:
            route.distanceMeters,

          durationMinutes:
            route.durationMinutes,
        });

      } catch (error) {
        console.error(
          "Could not calculate walking route:",
          error
        );

        setRouteError(
          "Could not calculate walking route"
        );
      } finally {
        setRouteLoading(false);
      }
    };

 /* -------------------------------------------------------
     CONTINUE TO COOLING NAVIGATION
  ------------------------------------------------------- */

  // Open the Cooling Navigation screen
  // using whichever cooling option is currently selected.
  const handleContinueToCoolingRoute = () => {

    if (!searchOrigin) {
      return;
    }

    const coolingOption =
      selectedShade
        ? {
            type: "shade",
            id: selectedShade.canopy_id,
            name: "Tree shade area",
            facility_type: selectedShade.facility_type,
            location_description: selectedShade.location_description,
            latitude: Number(
              selectedShade.latitude
            ),
            longitude: Number(
              selectedShade.longitude
            ),
            distanceMeters:
              selectedShade.distance_m,
          }
        : selectedFountain
          ? {
              type: "water",
              id: selectedFountain.asset_id,
              name:
                selectedFountain.location_description ||
                "Drinking fountain",
              facility_type: selectedFountain.facility_type,
              location_description: selectedFountain.location_description,
              latitude: Number(
                selectedFountain.latitude
              ),
              longitude: Number(
                selectedFountain.longitude
              ),
              distanceMeters:
                selectedFountain.distance_m,
            }
          : null;

    if (!coolingOption) {
      return;
    }

    navigation.navigate(
      "CoolingNavigation",
      {
        origin: searchOrigin,
        coolingOption,
        routeInfo,
        routeCoordinates,
      }
    );
  };

  const selectedOption = selectedShade || selectedFountain;
  const selectedDisplay = selectedOption
    ? getCoolingDisplay(selectedOption, selectedShade ? "shade" : "water")
    : null;

  /* -------------------------------------------------------
     PAGE
  ------------------------------------------------------- */

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <View
        style={styles.mobileContainer}
      >

        {/* ROOT HEADER */}
        <View style={styles.header}>
          <Text
            style={styles.headerTitle}
          >
            Nearby cooling options
          </Text>
        </View>

        <LinearGradient
          pointerEvents="none"
          colors={(["#F3F7F5", "rgba(243,247,245,0.9)", "rgba(243,247,245,0)"]).map(c => theme.color(c, 'backgroundColor'))}
          locations={[0, 0.58, 1]}
          style={styles.topGradient}
        />
        <LinearGradient
          pointerEvents="none"
          colors={(["rgba(243,247,245,0)", "rgba(243,247,245,0.78)", "#F3F7F5"]).map(c => theme.color(c, 'backgroundColor'))}
          locations={[0, 0.55, 1]}
          style={styles.bottomGradient}
        />


        {/* SEARCH */}

        <View
          style={
            styles.searchContainer
          }
        >
          <LocationSearchBar
            onLocationSelected={
              handleManualLocationSelected
            }

            onCurrentLocationPress={
              handleCurrentLocationPress
            }
          />
        </View>


        {/* MAP */}

        <View
          style={styles.mapContainer}
        >
          {!mapDisplayLocation ? (
            <View
              style={
                styles.mapMessageContainer
              }
            >
              <Text
                style={styles.mapLabel}
              >
                Getting your location...
              </Text>
            </View>
          ) : (
            <WebGoogleMap
              userLocation={
                userLocation
              }

              searchOrigin={
                searchOrigin
              }

              isManualSearch={
                isManualSearch
              }

              mapDisplayLocation={
                mapDisplayLocation
              }

              fountains={
                fountains
              }

              shadeAreas={
                shadeAreas
              }

              selectedCoolingType={
                selectedCoolingType
              }

              selectedFountain={
                selectedFountain
              }

              selectedShade={
                selectedShade
              }

              mapTarget={
                mapTarget
              }

              routeCoordinates={
                routeCoordinates
              }

              onSelectFountain={
                handleFountainPress
              }

              onSelectShade={
                handleShadePress
              }
            />
          )}
        </View>


        {/* COOLING TYPE BUTTONS */}

        <View
          style={
            styles.coolingTypeContainer
          }
        >
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Show nearby shade"
            style={[
              styles.coolingTypeButton,

              selectedCoolingType ===
                "shade" &&
                styles.coolingTypeButtonSelected,
            ]}

            onPress={() =>
              handleCoolingTypeChange(
                "shade"
              )
            }

            activeOpacity={0.8}
          >
            <Ionicons
              name="leaf-outline"
              size={22}

              color={theme.color(selectedCoolingType ===
                "shade"
                  ? "#087751"
                  : "#39775F")}
            />

            <Text
              style={[
                styles.coolingTypeText,

                selectedCoolingType ===
                  "shade" &&
                  styles.coolingTypeTextSelected,
              ]}
            >
              Shade
            </Text>
          </TouchableOpacity>


          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Show nearby drinking water"
            style={[
              /*
              * Keep the same shape and dimensions
              * as the Nearby Shade button.
              */
              styles.coolingTypeButton,

              /*
              * Water uses blue instead of green.
              */
              styles.waterCoolingTypeButton,

              /*
              * When selected, fill the whole
              * water button with blue.
              */
              selectedCoolingType ===
                "water" &&
                styles.waterCoolingTypeButtonSelected,
            ]}

            onPress={() =>
              handleCoolingTypeChange(
                "water"
              )
            }

            activeOpacity={0.8}
          >
            <Ionicons
              name="water-outline"
              size={22}

              color={theme.color(selectedCoolingType ===
                "water"
                  ? "#147BD1"
                  : "#6689F5")}
            />

            <Text
              style={[
                styles.coolingTypeText,

                /*
                * Blue text when water is not selected.
                */
                styles.waterCoolingTypeText,

                selectedCoolingType ===
                  "water" &&
                  styles.waterCoolingTypeTextSelected,
              ]}
            >
              Water
            </Text>
          </TouchableOpacity>
        </View>


        {/* ROUTE */}

        {(selectedShade || selectedFountain) && (
          <View style={styles.selectedPlaceCard}>
            <View style={styles.selectedPlaceHandle} />
            <View style={styles.selectedPlaceHeader}>
              <View style={[styles.selectedPlaceIcon, selectedFountain && styles.selectedWaterIcon]}>
                <Ionicons name={selectedFountain ? "water" : "leaf"} size={23} color={theme.color("#FFFFFF")} />
              </View>
              <View style={styles.resultContent}>
                <Text style={styles.resultTitle} numberOfLines={2}>
                  {selectedDisplay.name}
                </Text>
                {!!selectedDisplay.location && (
                  <Text style={styles.resultDescription} numberOfLines={1}>
                    {selectedDisplay.location}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close place details"
                style={styles.closeDetailsButton}
                onPress={clearRoute}
              >
                <Ionicons name="close" size={22} color={theme.color("#52615C")} />
              </TouchableOpacity>
            </View>
            <View style={styles.selectedMetaRow}>
              <Ionicons name="walk-outline" size={19} color={theme.color("#31524A")} />
              <Text style={styles.selectedRouteLabel}>Walking route</Text>
              <Text numberOfLines={2} style={[styles.selectedRouteStatus, routeError && styles.selectedRouteError]}>
                {routeInfo && !routeLoading
                  ? `${routeInfo.durationMinutes} min · ${routeInfo.distanceMeters} m`
                  : routeError || "Calculating..."}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Get directions"
              accessibilityState={{ disabled: !routeInfo || routeLoading }}
              disabled={!routeInfo || routeLoading}
              style={[
                styles.selectedDirectionsButton,
                (!routeInfo || routeLoading) && styles.selectedDirectionsButtonDisabled,
              ]}
              onPress={handleContinueToCoolingRoute}
            >
              <Ionicons name="navigate" size={19} color={theme.color("#FFFFFF")} />
              <Text style={styles.selectedDirectionsText}>Get directions</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* NO SEARCH OR GPS */}

        {(selectedShade || selectedFountain) ? null : !searchOrigin ? (
          <View
            style={
              styles.noLocationContainer
            }
          >
            <Ionicons
              name="location-outline"
              size={34}
              color={theme.color("#39775F")}
            />

            <Text
              style={
                styles.noLocationTitle
              }
            >
              Find nearby cooling options
            </Text>

            <Text
            style={
              styles.noLocationText
            }
          >
            {/*
            * Priority 1:
            * The user just manually searched for an
            * unsupported location.
            */}
            {isManualSearchOutsideServiceArea
              ? "The location you searched is outside the City of Melbourne. Please search for a location within the City of Melbourne."

              /*
              * Priority 2:
              * No rejected manual search, but the user's
              * actual GPS location is outside the service area.
              */
              : isCurrentLocationOutsideServiceArea
                ? "You're currently outside the City of Melbourne. Please use the search bar to search for a location within the City of Melbourne, or use this feature when you're in the service area."

                /*
                * Normal no-location / permission-denied message.
                */
                : "Please enter a location above or use your current location to find nearby shade and water."}
          </Text>

            {locationError &&
              !isCurrentLocationOutsideServiceArea && (
                <Text
                  style={
                    styles.locationErrorText
                  }
                >
                  {locationError}
                </Text>
              )}
          </View>
        ) : (

          /* RESULTS ONLY */

          <ScrollView
            style={
              styles.resultsScroll
            }

            contentContainerStyle={
              styles.resultsScrollContent
            }

            showsVerticalScrollIndicator={
              true
            }
          >
            <View
              style={
                styles.resultsContainer
              }
            >

              {/* SHADE RESULTS */}

              {selectedCoolingType ===
                "shade" && (
                <View
                  style={
                    styles.resultSection
                  }
                >
                  <View
                    style={
                      styles.sectionHeader
                    }
                  >
                    <View
                      style={
                        styles.shadeIcon
                      }
                    >
                      <Ionicons
                        name="leaf"
                        size={27}
                        color={theme.color("#ffffff")}
                      />
                    </View>

                    <Text
                      style={
                        styles.sectionTitle
                      }
                    >
                      Nearby shade
                    </Text>
                    {shadeAreas.length > 2 && (
                      <TouchableOpacity
                        accessibilityRole="button"
                        style={styles.seeAllButton}
                        onPress={() => setShowAllResults((value) => !value)}
                      >
                        <Text style={styles.seeAllText}>
                          {showAllResults ? "Show less" : "See all"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>


                  {shadeLoading ? (
                    <Text
                      style={
                        styles.resultTitle
                      }
                    >
                      Finding nearby
                      shade...
                    </Text>
                  ) : shadeError ? (
                    <Text
                      style={
                        styles.errorText
                      }
                    >
                      {shadeError}
                    </Text>
                  ) : shadeAreas.length >
                    0 ? (
                    (showAllResults ? shadeAreas : shadeAreas.slice(0, 2)).map(
                      (shade) => (
                        <TouchableOpacity
                          key={
                            shade.canopy_id
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`Tree shade area, ${shade.distance_m} metres away`}

                          style={[
                            /*
                            * Normal result-card appearance.
                            */
                            styles.resultCard,

                            /*
                            * If this is the shade location the user selected,
                            * add the green selected-card styling.
                            */
                            selectedShade?.canopy_id ===
                              shade.canopy_id &&
                              styles.resultCardSelectedShade,
                          ]}

                          activeOpacity={
                            0.8
                          }

                          onPress={() =>
                            handleShadePress(
                              shade
                            )
                          }
                        >
                          <View style={styles.resultRowIcon}>
                            <Ionicons name="leaf" size={20} color={theme.color("#087751")} />
                          </View>
                          <View
                            style={
                              styles.resultContent
                            }
                          >
                            <Text
                              style={
                                styles.resultTitle
                              }
                              numberOfLines={1}
                            >
                              Tree shade area
                            </Text>

                            <Text
                              style={
                                styles.detailText
                              }
                              numberOfLines={1}
                            >
                              {
                                shade.distance_m
                              }{" "}
                              m away
                            </Text>
                          </View>

                          <Ionicons
                            name="chevron-forward-outline"
                            size={22}
                            color={theme.color("#555555")}
                          />
                        </TouchableOpacity>
                      )
                    )
                  ) : (
                    <Text
                      style={
                        styles.resultTitle
                      }
                    >
                      No nearby shade found
                    </Text>
                  )}
                </View>
              )}


              {/* WATER RESULTS */}

              {selectedCoolingType ===
                "water" && (
                <View
                  style={
                    styles.resultSection
                  }
                >
                  <View
                    style={
                      styles.sectionHeader
                    }
                  >
                    <View
                      style={
                        styles.waterIcon
                      }
                    >
                      <Ionicons
                        name="water"
                        size={28}
                        color={theme.color("#ffffff")}
                      />
                    </View>

                    <Text
                      style={
                        styles.sectionTitle
                      }
                    >
                      Nearby water
                    </Text>
                    {fountains.length > 2 && (
                      <TouchableOpacity
                        accessibilityRole="button"
                        style={styles.seeAllButton}
                        onPress={() => setShowAllResults((value) => !value)}
                      >
                        <Text style={styles.seeAllText}>
                          {showAllResults ? "Show less" : "See all"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>


                  {fountainLoading ? (
                    <Text
                      style={
                        styles.resultTitle
                      }
                    >
                      Finding nearby
                      water...
                    </Text>
                  ) : fountainError ? (
                    <Text
                      style={
                        styles.errorText
                      }
                    >
                      {fountainError}
                    </Text>
                  ) : fountains.length >
                    0 ? (
                    (showAllResults ? fountains : fountains.slice(0, 2)).map(
                      (fountain) => (
                        <TouchableOpacity
                          key={
                            fountain.asset_id
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`${getCoolingDisplay(fountain, "water").name}, ${fountain.distance_m} metres away`}

                          style={[
                            /*
                            * Normal result-card appearance.
                            */
                            styles.resultCard,

                            /*
                            * Highlight only the drinking fountain
                            * selected by the user.
                            */
                            selectedFountain?.asset_id ===
                              fountain.asset_id &&
                              styles.resultCardSelectedWater,
                          ]}

                          activeOpacity={
                            0.8
                          }

                          onPress={() =>
                            handleFountainPress(
                              fountain
                            )
                          }
                        >
                          <View style={[styles.resultRowIcon, styles.waterResultRowIcon]}>
                            <Ionicons name="water" size={20} color={theme.color("#147BD1")} />
                          </View>
                          <View
                            style={
                              styles.resultContent
                            }
                          >
                            <Text
                              style={
                                styles.resultTitle
                              }
                              numberOfLines={1}
                            >
                              {
                                getCoolingDisplay(fountain, "water").name
                              }
                            </Text>

                            <Text
                              style={
                                styles.detailText
                              }
                              numberOfLines={1}
                            >
                              {
                                fountain.distance_m
                              }{" "}
                              m away
                            </Text>
                          </View>

                          <Ionicons
                            name="chevron-forward-outline"
                            size={22}
                            color={theme.color("#555555")}
                          />
                        </TouchableOpacity>
                      )
                    )
                  ) : (
                    <Text
                      style={
                        styles.resultTitle
                      }
                    >
                      No drinking fountains found
                    </Text>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}


/* =======================================================
   STYLES
======================================================= */

const baseStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#EAF0ED",
    alignItems: "center",
  },


  /* WEB LOOKS LIKE MOBILE */

  mobileContainer: {
    flex: 1,
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#F3F7F5",
    position: "relative",
    overflow: "hidden",

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },


  /* HEADER */

  header: {
    position: "absolute",
    top: 14,
    left: 20,
    right: 20,
    zIndex: 1002,
  },

  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#173C31",
  },

  headerSubtitle: {
    marginTop: 3,
    fontSize: 14,
    lineHeight: 19,
    color: "#5A6862",
  },


  /* SEARCH */

  searchContainer: {
    position: "absolute",
    top: 56,
    left: 18,
    right: 18,
    zIndex: 1000,
  },


  /* MAP */

  mapContainer: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
    backgroundColor: "#E8E8E8",
    zIndex: 1,
  },

  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 210,
    zIndex: 8,
  },

  bottomGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 250,
    zIndex: 8,
  },

  mapMessageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  mapLabel: {
    fontSize: 15,
    color: "#555555",
    textAlign: "center",
  },

  mapErrorText: {
    marginTop: 8,
    fontSize: 15,
    color: "#B3261E",
    textAlign: "center",
  },


  /* COOLING SELECTOR */

  coolingTypeContainer: {
    position: "absolute",
    top: 126,
    left: 18,
    right: 18,
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.94)",
    zIndex: 1001,
  },

  coolingTypeButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    cursor: "pointer",
  },

  coolingTypeButtonSelected: {
    backgroundColor: "#D9F4E5",
  },

  /*
  * Water selector uses its own blue theme.
  *
  * Shade continues to use the existing green styles.
  */
  waterCoolingTypeButton: {
    borderColor: "transparent",
  },

  waterCoolingTypeButtonSelected: {
    backgroundColor: "#DCEEFF",
  },

  coolingTypeText: {
    marginLeft: 7,
    fontSize: 15,
    fontWeight: "600",
    color: "#39775F",
  },

  /*
  * Text colour for the water button when
  * it is not currently selected.
  */
  waterCoolingTypeText: {
    color: "#6689F5",
  },

  coolingTypeTextSelected: {
    color: "#173C31",
  },

  waterCoolingTypeTextSelected: {
    color: "#1666AC",
  },


  /* ROUTE */

  routeInfo: {
    display: "none",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  routeInfoText: {
    marginLeft: 7,
    fontSize: 16,
    fontWeight: "600",
    color: "#39775F",
  },

  routeMessage: {
    display: "none",
    textAlign: "center",
    marginBottom: 15,
    color: "#555555",
  },

  routeErrorText: {
    display: "none",
    textAlign: "center",
    marginBottom: 15,
    color: "#B3261E",
  },

  continueRouteButton: {
    display: "none",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#39775F",
    borderRadius: 16,
    minHeight: 50,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 18,
  },

  continueRouteButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginRight: 8,
  },

  /* NO LOCATION */

  noLocationContainer: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 102,
    zIndex: 1100,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.97)",
    shadowColor: "#173C31",
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },

  noLocationTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222222",
    marginTop: 10,
    marginBottom: 6,
  },

  noLocationText: {
    fontSize: 15,
    color: "#666666",
    textAlign: "center",
    lineHeight: 21,
  },

  locationErrorText: {
    marginTop: 10,
    fontSize: 13,
    color: "#777777",
    textAlign: "center",
  },


  /* RESULTS */

  resultsScroll: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 102,
    maxHeight: "44%",
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.97)",
    zIndex: 1100,
    shadowColor: "#173C31",
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },

  resultsScrollContent: {
    paddingBottom: 8,
  },

  resultsContainer: {
    backgroundColor: "transparent",
    paddingHorizontal: 14,
    paddingTop: 0,
  },

  resultSection: {
    paddingTop: 8,
    paddingBottom: 0,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    justifyContent: "space-between",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A382E",
    marginLeft: 10,
    flex: 1,
  },

  seeAllButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  seeAllText: {
    color: "#31524A",
    fontSize: 14,
    fontWeight: "700",
    padding: 8,
  },

  selectedPlaceCard: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 102,
    zIndex: 1100,
    padding: 16,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.97)",
    shadowColor: "#173C31",
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },

  selectedPlaceHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    marginTop: -8,
    marginBottom: 12,
    borderRadius: 2,
    backgroundColor: "#C4CFCA",
  },

  selectedPlaceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  selectedPlaceIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#087751",
    alignItems: "center",
    justifyContent: "center",
  },

  selectedWaterIcon: {
    backgroundColor: "#147BD1",
  },

  selectedMetaRow: {
    minHeight: 48,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#EAF7F3",
  },

  selectedRouteLabel: {
    flex: 1,
    color: "#31524A",
    fontSize: 14,
    fontWeight: "600",
  },

  closeDetailsButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  selectedRouteStatus: {
    fontSize: 14,
    color: "#31524A",
    fontWeight: "700",
    textAlign: "right",
  },

  selectedRouteError: {
    fontSize: 14,
    color: "#B3261E",
  },

  selectedDirectionsButton: {
    minHeight: 48,
    marginTop: 10,
    borderRadius: 24,
    backgroundColor: "#087751",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  selectedDirectionsButtonDisabled: {
    opacity: 0.45,
  },

  selectedDirectionsText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  shadeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#087751",
    alignItems: "center",
    justifyContent: "center",
  },

  waterIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#147BD1",
    alignItems: "center",
    justifyContent: "center",
  },


  /* RESULT CARDS */

  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 62,
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E8ECEA",
    cursor: "pointer",
  },

  resultRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#DCF3E5",
    alignItems: "center",
    justifyContent: "center",
  },

  waterResultRowIcon: {
    backgroundColor: "#E0F1FF",
  },

  resultContent: {
    flex: 1,
  },

  resultTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#252525",
  },

  detailText: {
    fontSize: 14,
    color: "#61716B",
    marginTop: 2,
  },

  resultDescription: {
    fontSize: 14,
    color: "#555555",
    marginTop: 4,
  },

  errorText: {
    fontSize: 15,
    color: "#A33A3A",
  },

  /*
  * ============================================================
  * SELECTED RESULT CARDS
  * ============================================================
  *
  * Shade and water use different highlight colours so the
  * selected item remains consistent with the feature colours:
  *
  * Shade → green
  * Water → blue
  */


  /*
  * Selected tree-shade result.
  *
  * The stronger green border and very light green background
  * make the selected card visible without making it difficult
  * to read.
  */
  resultCardSelectedShade: {
    borderWidth: 2,
    borderColor: "#39775F",
    backgroundColor: "#F0F7F4",
  },


  /*
  * Selected drinking-water result.
  *
  * Water uses the same blue used elsewhere in the
  * Nearby Water interface.
  */
  resultCardSelectedWater: {
    borderWidth: 2,
    borderColor: "#6689F5",
    backgroundColor: "#F2F5FF",
  },
});