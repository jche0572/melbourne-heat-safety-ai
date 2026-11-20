import { DARK_MAP_STYLE } from "../theme/mapStyle";
import { useThemedStyles } from "../theme/useAppTheme";
import { LinearGradient } from "expo-linear-gradient";

import React, {
  useEffect,
  useState,
} from "react";

import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  GoogleMap,
  MarkerF,
  PolylineF,
  useJsApiLoader,
} from "@react-google-maps/api";

import polyline from "@mapbox/polyline";

import LocationSearchBar from "../components/LocationSearchBar";

import {
  getWalkingRoute,
} from "../services/nearbyCoolingService";

import {
  formatCoolingLocation,
  getCoolingDisplay,
} from "../utils/coolingDisplay";

/*
 * Floating Mini Map support.
 *
 * These come from the google-maps-floating-overlay branch.
 */
import {
  minimizeCoolingRoute,
} from "../utils/miniMapRoute";

import {
  useMiniMap,
} from "../components/MiniMapProvider";


const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;


/* =========================================================
   LIGHT MAP STYLE
========================================================= */

const MAP_STYLE = [
  {
    elementType: "geometry",
    stylers: [
      {
        color: "#eef4ed",
      },
    ],
  },

  {
    featureType: "water",
    elementType: "geometry",
    stylers: [
      {
        color: "#b8e2f5",
      },
    ],
  },

  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [
      {
        color: "#cfeccb",
      },
    ],
  },

  {
    featureType: "road",
    elementType: "geometry",
    stylers: [
      {
        color: "#ffffff",
      },
    ],
  },
];


/* =========================================================
   CUSTOM COOLING MARKER
========================================================= */

const getCoolingMarkerIcon =
  (isWater) => {
    const color =
      isWater
        ? "#1976D2"
        : "#087751";

    const symbol =
      isWater
        ? '<path d="M21 10c-4 6-8 10-8 15a8 8 0 0 0 16 0c0-5-4-9-8-15Z" fill="white"/>'
        : '<path d="M19 25h4v9h-4z" fill="white"/><circle cx="21" cy="17" r="8" fill="white"/><circle cx="14" cy="22" r="6" fill="white"/><circle cx="28" cy="22" r="6" fill="white"/>';

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42">
        <circle cx="21" cy="21" r="19" fill="${color}" stroke="white" stroke-width="3"/>
        ${symbol}
      </svg>`;

    return {
      url:
        `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,

      scaledSize:
        new window.google.maps.Size(
          42,
          42
        ),

      anchor:
        new window.google.maps.Point(
          21,
          21
        ),
    };
  };


/* =========================================================
   COOLING NAVIGATION SCREEN
========================================================= */

export default function CoolingNavigationScreen({
  navigation,
  route,
}) {
  const {
    styles,
    theme,
  } = useThemedStyles(baseStyles);
  const insets = useSafeAreaInsets();


  /* ---------------------------------------------------------
     FLOATING MINI MAP

     MiniMapProvider supplies:
     - minimize(): stores the route as a floating overlay
     - openGoogleMaps(): opens Google Maps while preserving
       the route state for restoration
  --------------------------------------------------------- */

  const {
    minimize: onMinimize,
    openGoogleMaps,
  } = useMiniMap();


  /* ---------------------------------------------------------
     ROUTE PARAMETERS
  --------------------------------------------------------- */

  const {
    origin,
    coolingOption,
    routeInfo,
    routeCoordinates = [],
  } = route?.params ?? {};


  /* ---------------------------------------------------------
     GOOGLE MAP
  --------------------------------------------------------- */

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


  /* ---------------------------------------------------------
     FINAL DESTINATION

     Initialise from route.params so the destination can be
     restored after the floating Mini Map is reopened.
  --------------------------------------------------------- */

  const [
    finalDestination,
    setFinalDestination,
  ] = useState(
    route?.params
      ?.finalDestination ??
      null
  );

  const [
    finalRouteCoordinates,
    setFinalRouteCoordinates,
  ] = useState(
    route?.params
      ?.finalRouteCoordinates ??
      []
  );

  const [
    finalRouteLoading,
    setFinalRouteLoading,
  ] = useState(false);

  const [
    destinationError,
    setDestinationError,
  ] = useState(null);

  const [
    showDestinationSearch,
    setShowDestinationSearch,
  ] = useState(false);


  /* ---------------------------------------------------------
     RESTORE SAVED ROUTE STATE

     When the Mini Map restores this screen, App.js may pass
     the saved final destination and second route leg back
     through route.params.

     Synchronising these values prevents the restored route
     from losing its final destination.
  --------------------------------------------------------- */

  useEffect(() => {
    setFinalDestination(
      route?.params
        ?.finalDestination ??
        null
    );

    setFinalRouteCoordinates(
      route?.params
        ?.finalRouteCoordinates ??
        []
    );
  }, [
    route?.params
      ?.finalDestination,

    route?.params
      ?.finalRouteCoordinates,
  ]);


  const coolingDisplay =
    getCoolingDisplay(
      coolingOption,
      coolingOption?.type
    );

  const isWater =
    coolingOption?.type ===
    "water";

  const finalDestinationLabel =
    formatCoolingLocation(
      finalDestination?.label
    );


  /* ---------------------------------------------------------
     MINIMISE ROUTE

     Saves everything required to rebuild this screen later:
     - start location
     - cooling stop
     - first route
     - final destination
     - second route
  --------------------------------------------------------- */

  const handleMinimize = () => {
    try {
      minimizeCoolingRoute(
        navigation,

        {
          origin,
          coolingOption,
          routeInfo,
          routeCoordinates,
          finalDestination,
          finalRouteCoordinates,
        },

        onMinimize
      );
    }
    catch (error) {
      Alert.alert(
        "Unable to minimize map",
        error.message
      );
    }
  };


  /* ---------------------------------------------------------
     FIT MAP AROUND COMPLETE ROUTE
  --------------------------------------------------------- */

  useEffect(() => {
    if (
      !map ||
      routeCoordinates.length < 2
    ) {
      return;
    }

    const bounds =
      new window.google.maps
        .LatLngBounds();

    [
      ...routeCoordinates,
      ...finalRouteCoordinates,
    ].forEach(
      (point) => {
        bounds.extend({
          lat:
            point.latitude,

          lng:
            point.longitude,
        });
      }
    );

    map.fitBounds(
      bounds,
      70
    );
  }, [
    map,
    routeCoordinates,
    finalRouteCoordinates,
  ]);


  /* ---------------------------------------------------------
     ADD FINAL DESTINATION
  --------------------------------------------------------- */

  const handleDestinationSelected =
    async (location) => {
      if (!coolingOption) {
        return;
      }

      setFinalDestination(
        location
      );

      setFinalRouteCoordinates(
        []
      );

      setDestinationError(
        null
      );

      setFinalRouteLoading(
        true
      );

      try {
        const nextRoute =
          await getWalkingRoute(
            Number(
              coolingOption.latitude
            ),

            Number(
              coolingOption.longitude
            ),

            Number(
              location.latitude
            ),

            Number(
              location.longitude
            )
          );

        const decoded =
          polyline.decode(
            nextRoute
              .encodedPolyline
          );

        setFinalRouteCoordinates(
          decoded.map(
            ([
              latitude,
              longitude,
            ]) => ({
              latitude,
              longitude,
            })
          )
        );
      }
      catch (error) {
        console.error(
          "Could not calculate route to final destination:",
          error
        );

        setDestinationError(
          "Could not calculate the route to this destination."
        );
      }
      finally {
        setFinalRouteLoading(
          false
        );
      }
    };


  /* ---------------------------------------------------------
     CURRENT LOCATION AS FINAL DESTINATION
  --------------------------------------------------------- */

  const handleCurrentLocationAsDestination =
    () => {
      if (
        typeof navigator ===
          "undefined" ||
        !navigator.geolocation
      ) {
        setDestinationError(
          "Current location is not supported by this browser."
        );

        return;
      }

      navigator.geolocation
        .getCurrentPosition(
          (position) => {
            handleDestinationSelected({
              latitude:
                position.coords
                  .latitude,

              longitude:
                position.coords
                  .longitude,

              label:
                "Current Location",
            });
          },

          () => {
            setDestinationError(
              "Location permission is required to use your current location."
            );
          }
        );
    };


  /* ---------------------------------------------------------
     OPEN GOOGLE MAPS

     Do NOT directly construct/open the Google Maps URL here.

     The floating-overlay branch now handles Google Maps
     through MiniMapProvider so App.js can preserve the
     current route while Google Maps is opened.
  --------------------------------------------------------- */

  const handleOpenGoogleMaps =
    () => {
      openGoogleMaps?.({
        origin,
        coolingOption,
        routeInfo,
        routeCoordinates,
        finalDestination,
        finalRouteCoordinates,
      });
    };


  const center =
    origin ||
    coolingOption || {
      latitude:
        -37.8136,

      longitude:
        144.9631,
    };


  /* =========================================================
     UI
  ========================================================= */

  return (
    <View
      style={
        styles.page
      }
    >
      <View
        style={
          styles.mobileContainer
        }
      >

        {/* ================= MAP ================= */}

        <View
          testID="walking-route-map"
          style={styles.mapContainer}
        >
          {loadError ? (
            <View
              style={
                styles.mapMessage
              }
            >
              <Text
                style={
                  styles.errorText
                }
              >
                Unable to load Google Maps.
              </Text>
            </View>
          ) : isLoaded ? (
            <GoogleMap
              onLoad={(
                loadedMap
              ) => {
                /*
                 * Use vector rendering when supported.
                 * This keeps the newer map behaviour from
                 * the UI branch.
                 */
                if (
                  window.google
                    ?.maps
                    ?.RenderingType
                    ?.VECTOR &&
                  loadedMap
                    .setRenderingType
                ) {
                  loadedMap
                    .setRenderingType(
                      window.google.maps
                        .RenderingType
                        .VECTOR
                    );
                }

                setMap(
                  loadedMap
                );
              }}

              onUnmount={() =>
                setMap(null)
              }

              mapContainerStyle={{
                width: "100%",
                height: "100%",
              }}

              center={{
                lat:
                  Number(
                    center.latitude
                  ),

                lng:
                  Number(
                    center.longitude
                  ),
              }}

              zoom={14}

              options={{
                tilt: 0,
                heading: 0,

                tiltInteractionEnabled:
                  false,

                headingInteractionEnabled:
                  false,

                disableDefaultUI:
                  true,

                styles:
                  theme.dark
                    ? DARK_MAP_STYLE
                    : MAP_STYLE,
              }}
            >

              {/* START LOCATION */}

              {origin && (
                <MarkerF
                  position={{
                    lat:
                      Number(
                        origin.latitude
                      ),

                    lng:
                      Number(
                        origin.longitude
                      ),
                  }}

                  title={
                    origin.label ||
                    "Starting location"
                  }

                  icon={{
                    path:
                      window.google.maps
                        .SymbolPath
                        .CIRCLE,

                    scale: 7,

                    fillColor:
                      "#287BE0",

                    fillOpacity: 1,

                    strokeColor:
                      "#FFFFFF",

                    strokeWeight: 3,
                  }}
                />
              )}


              {/* COOLING STOP */}

              {coolingOption && (
                <MarkerF
                  position={{
                    lat:
                      Number(
                        coolingOption
                          .latitude
                      ),

                    lng:
                      Number(
                        coolingOption
                          .longitude
                      ),
                  }}

                  title={
                    `${coolingDisplay.name}, ${coolingDisplay.location}`
                  }

                  icon={
                    getCoolingMarkerIcon(
                      isWater
                    )
                  }

                  zIndex={3}
                />
              )}


              {/* FINAL DESTINATION */}

              {finalDestination && (
                <MarkerF
                  position={{
                    lat:
                      Number(
                        finalDestination
                          .latitude
                      ),

                    lng:
                      Number(
                        finalDestination
                          .longitude
                      ),
                  }}

                  title={
                    finalDestination
                      .label ||
                    "Final destination"
                  }
                />
              )}


              {/* FIRST ROUTE LEG */}

              {routeCoordinates.length >
                0 && (
                <PolylineF
                  path={
                    routeCoordinates.map(
                      (
                        point
                      ) => ({
                        lat:
                          point.latitude,

                        lng:
                          point.longitude,
                      })
                    )
                  }

                  options={{
                    strokeColor:
                      "#087751",

                    strokeOpacity:
                      1,

                    strokeWeight:
                      5,
                  }}
                />
              )}


              {/* SECOND ROUTE LEG */}

              {finalRouteCoordinates
                .length > 0 && (
                <PolylineF
                  path={
                    finalRouteCoordinates
                      .map(
                        (
                          point
                        ) => ({
                          lat:
                            point.latitude,

                          lng:
                            point.longitude,
                        })
                      )
                  }

                  options={{
                    strokeColor:
                      "#087751",

                    strokeOpacity:
                      1,

                    strokeWeight:
                      5,
                  }}
                />
              )}
            </GoogleMap>
          ) : (
            <View
              style={
                styles.mapMessage
              }
            >
              <Text
                style={
                  styles.muted
                }
              >
                Loading map...
              </Text>
            </View>
          )}
        </View>

        <LinearGradient
          pointerEvents="none"
          colors={
            theme.dark
              ? [
                  "rgba(20, 42, 35, 0.98)",
                  "rgba(20, 42, 35, 0.82)",
                  "rgba(20, 42, 35, 0)",
                ]
              : [
                  "rgba(243, 247, 245, 0.98)",
                  "rgba(243, 247, 245, 0.86)",
                  "rgba(243, 247, 245, 0)",
                ]
          }
          locations={[0, 0.55, 1]}
          style={styles.topGradient}
        />


        {/* ================= TOP BAR ================= */}

        {/* WALKING ROUTE HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-back"
              size={28}
              color={
                theme.dark
                  ? "#DDE7E2"
                  : "#173C31"
              }
            />
          </TouchableOpacity>

          <Text
            style={[
              styles.headerTitle,
              {
                color: theme.dark
                  ? "#E8EFEC"
                  : "#173C31",
              },
            ]}
          >
            Walking route
          </Text>
        </View>

        {/* ============ MINIMIZE BUTTON ============ */}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Minimize cooling route map"
          disabled={finalRouteLoading || !onMinimize}
          onPress={handleMinimize}
          style={[
            styles.minimizeButton,
            {
              backgroundColor: theme.dark
                ? "#2C4039"
                : "#FFFFFF",

              borderColor: theme.dark
                ? "#49665C"
                : "#D4E2DC",
            },

            finalRouteLoading && {
              opacity: 0.5,
            },
          ]}
        >
          <Ionicons
            name="contract-outline"
            size={18}
            color={
              theme.dark
                ? "#8ED6B8"
                : "#087751"
            }
          />

          <Text
            style={[
              styles.minimizeText,
              {
                color: theme.dark
                  ? "#8ED6B8"
                  : "#087751",
              },
            ]}
          >
            {finalRouteLoading
              ? "Calculating…"
              : "Minimize"}
          </Text>
        </Pressable>

        {/* ================= ROUTE SHEET ================= */}

        <View
          style={
            styles.routeSheet
          }
        >
          <View
            style={
              styles.handle
            }
          />

          <View
            style={
              styles.stopRow
            }
          >
            <View
              style={[
                styles.stopIcon,
                styles.startIcon,
              ]}
            >
              <View
                style={
                  styles.startDot
                }
              />
            </View>

            <View
              style={
                styles.flex
              }
            >
              <Text
                style={
                  styles.stopLabel
                }
              >
                Current location
              </Text>

              <Text
                style={
                  styles.stopValue
                }
                numberOfLines={1}
              >
                {origin?.label ||
                  "Starting location"}
              </Text>
            </View>
          </View>


          <View
            style={
              styles.connector
            }
          />


          {/* COOLING STOP */}

          <View
            style={
              styles.stopRow
            }
          >
            <View
              style={[
                styles.stopIcon,

                isWater
                  ? styles.waterStopIcon
                  : styles.shadeStopIcon,
              ]}
            >
              <Ionicons
                name={
                  isWater
                    ? "water"
                    : "leaf"
                }

                size={18}

                color={
                  theme.color(
                    isWater
                      ? "#1976D2"
                      : "#087751"
                  )
                }
              />
            </View>

            <View
              style={
                styles.flex
              }
            >
              <Text
                style={
                  styles.stopLabel
                }
              >
                {
                  coolingDisplay.name
                }
              </Text>

              <Text
                style={
                  styles.stopValue
                }
                numberOfLines={1}
              >
                {
                  coolingDisplay.location ||
                  (
                    isWater
                      ? "Drinking water"
                      : "Shaded area"
                  )
                }
              </Text>
            </View>
          </View>


          {/* ROUTE SUMMARY */}

          {routeInfo && (
            <View
              style={
                styles.summaryRow
              }
            >
              <Ionicons
                name="walk"
                size={24}

                color={
                  theme.color(
                    "#087751"
                  )
                }
              />

              <View
                style={
                  styles.flex
                }
              >
                <Text
                  style={
                    styles.summaryText
                  }
                >
                  {
                    routeInfo
                      .durationMinutes
                  }{" "}
                  min (
                  {
                    routeInfo
                      .distanceMeters
                  }{" "}
                  m)
                </Text>

                <Text
                  style={
                    styles.stopValue
                  }
                >
                  Walking route to cooling stop
                </Text>
              </View>
            </View>
          )}


          {/* FINAL DESTINATION */}

          <Pressable
            style={
              styles.destinationToggle
            }

            onPress={() =>
              setShowDestinationSearch(
                (value) =>
                  !value
              )
            }
          >
            <Text
              style={
                styles.destinationToggleText
              }
            >
              {finalDestination
                ? finalDestinationLabel ||
                  "Final destination selected"
                : "Add final destination"}
            </Text>

            <Ionicons
              name={
                showDestinationSearch
                  ? "chevron-up"
                  : "chevron-down"
              }

              size={20}

              color={
                theme.color(
                  "#31524A"
                )
              }
            />
          </Pressable>


          {showDestinationSearch && (
            <View
              style={
                styles.destinationSearch
              }
            >
              <LocationSearchBar
                onLocationSelected={
                  handleDestinationSelected
                }

                onCurrentLocationPress={
                  handleCurrentLocationAsDestination
                }

                onClear={() => {
                  setFinalDestination(
                    null
                  );

                  setFinalRouteCoordinates(
                    []
                  );

                  setDestinationError(
                    null
                  );
                }}
              />

              {destinationError && (
                <Text
                  style={
                    styles.errorText
                  }
                >
                  {
                    destinationError
                  }
                </Text>
              )}
            </View>
          )}


          {/* GOOGLE MAPS */}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open route in Google Maps"

            disabled={
              finalRouteLoading ||
              !openGoogleMaps
            }

            style={[
              styles.googleMapsButton,

              (
                finalRouteLoading ||
                !openGoogleMaps
              ) &&
                styles.disabledButton,
            ]}

            onPress={
              handleOpenGoogleMaps
            }
          >
            <Ionicons
              name="open-outline"
              size={21}

              color={
                theme.color(
                  "#FFFFFF"
                )
              }
            />

            <Text
              style={
                styles.googleMapsButtonText
              }
            >
              {finalRouteLoading
                ? "Calculating route…"
                : "Open in Google Maps"}
            </Text>
          </Pressable>

        </View>
      </View>
    </View>
  );
}


/* =========================================================
   STYLES
========================================================= */

const baseStyles =
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor:
        "#EAF0ED",
      alignItems:
        "center",
    },

    mobileContainer: {
      flex: 1,
      width: "100%",
      maxWidth: 430,

      backgroundColor:
        "#E8F0EC",

      shadowColor:
        "#000000",

      shadowOpacity:
        0.12,

      shadowRadius: 10,
    },

    mapContainer: {
      ...StyleSheet.absoluteFill,
      overflow: "hidden",
    },

    mapMessage: {
      flex: 1,

      alignItems:
        "center",

      justifyContent:
        "center",
    },


    /* Floating Mini Map button */

    minimizeButton: {
      position: "absolute",

      top: 92,
      right: 16,

      zIndex: 30,

      flexDirection: "row",
      alignItems: "center",
      gap: 6,

      paddingHorizontal: 14,
      paddingVertical: 10,

      borderRadius: 22,

      borderWidth: 1,

      boxShadow: "0 3px 10px rgba(0,0,0,0.18)",

      cursor: "pointer",
    },

    minimizeText: {
      color:
        "#087751",

      fontSize: 13,

      fontWeight:
        "700",
    },

    backButton: {
      flexShrink: 0,

      width: 44,
      height: 44,

      borderRadius: 22,

      alignItems: "center",
      justifyContent: "center",

      backgroundColor: "rgba(255,255,255,0.16)",

      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.18)",

      cursor: "pointer",
    },

    routeSheet: {
      position:
        "absolute",

      left: 14,
      right: 14,
      bottom: 18,

      padding: 16,

      borderRadius: 28,

      backgroundColor:
        "rgba(255,255,255,0.97)",

      shadowColor:
        "#173C31",

      shadowOpacity:
        0.18,

      shadowRadius: 20,

      shadowOffset: {
        width: 0,
        height: 8,
      },

      zIndex: 10,
    },

    handle: {
      alignSelf:
        "center",

      width: 36,
      height: 4,

      borderRadius: 2,

      backgroundColor:
        "#B4C0BB",

      marginBottom: 10,
    },

    stopRow: {
      minHeight: 52,

      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 12,
    },

    stopIcon: {
      width: 38,
      height: 38,

      borderRadius: 19,

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    startIcon: {
      backgroundColor:
        "#E9F4FD",
    },

    startDot: {
      width: 14,
      height: 14,

      borderRadius: 7,

      backgroundColor:
        "#287BE0",

      borderWidth: 3,

      borderColor:
        "#FFFFFF",
    },

    shadeStopIcon: {
      backgroundColor:
        "#DDF4E7",
    },

    waterStopIcon: {
      backgroundColor:
        "#E3F2FD",
    },

    connector: {
      width: 2,
      height: 14,

      marginLeft: 18,

      backgroundColor:
        "#A8B7B1",
    },

    flex: {
      flex: 1,
      minWidth: 0,
    },

    stopLabel: {
      fontSize: 16,

      fontWeight:
        "800",

      color:
        "#0A3028",
    },

    stopValue: {
      marginTop: 2,

      fontSize: 13,

      color:
        "#60706A",
    },

    summaryRow: {
      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 12,

      paddingVertical:
        12,

      marginTop: 7,

      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderTopColor:
        "#D7E0DC",
    },

    summaryText: {
      fontSize: 16,

      fontWeight:
        "800",

      color:
        "#0A3028",
    },

    destinationToggle: {
      minHeight: 44,

      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderTopColor:
        "#D7E0DC",

      cursor:
        "pointer",
    },

    destinationToggleText: {
      flex: 1,

      fontSize: 14,

      fontWeight:
        "700",

      color:
        "#31524A",
    },

    destinationSearch: {
      marginBottom: 8,
      zIndex: 10,
    },

    muted: {
      color:
        "#60706A",
    },

    errorText: {
      marginTop: 6,

      color:
        "#B3261E",

      fontSize: 13,
    },

    googleMapsButton: {
      minHeight: 52,

      marginTop: 8,

      borderRadius: 26,

      backgroundColor:
        "#087751",

      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap: 8,

      cursor:
        "pointer",
    },

    disabledButton: {
      opacity: 0.5,
    },

    googleMapsButtonText: {
      color:
        "#FFFFFF",

      fontSize: 16,

      fontWeight:
        "800",
    },

    header: {
      position: "absolute",
      top: 14,
      left: 18,
      right: 18,

      minHeight: 50,

      flexDirection: "row",
      alignItems: "center",
      gap: 8,

      zIndex: 20,
    },


    headerTitle: {
      flex: 1,

      fontSize: 28,
      lineHeight: 34,
      fontWeight: "700",
    },

    topGradient: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 150,

      zIndex: 10,
    },

  });
