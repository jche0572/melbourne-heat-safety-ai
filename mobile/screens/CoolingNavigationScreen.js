import { DARK_MAP_STYLE } from "../theme/mapStyle";
import { useThemedStyles } from "../theme/useAppTheme";

import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, {
  Marker,
  Polyline,
} from "react-native-maps";
import polyline from "@mapbox/polyline";

import LocationSearchBar from "../components/LocationSearchBar";
import { useMiniMap } from "../components/MiniMapProvider";
import { createGoogleMapsUrl, createMiniMapRoute } from "../utils/miniMapRoute";
import { openGoogleMapsUrl } from "../utils/googleMapsNavigation";

import {
  requestCurrentUserLocation,
} from "../services/locationService";

import {
  getWalkingRoute,
} from "../services/nearbyCoolingService";

import {
  formatCoolingLocation,
  getCoolingDisplay,
} from "../utils/coolingDisplay";


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
   COOLING NAVIGATION
========================================================= */

export default function CoolingNavigationScreen({
  navigation,
  route,
}) {
  const {
    styles,
    theme,
  } = useThemedStyles(baseStyles);

  const insets =
    useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(66);

  /*
   * Floating Mini Map / Google Maps integration.
   *
   * The provider in App.js supplies openGoogleMaps().
   * This allows the floating-overlay branch to keep track
   * of the external Google Maps navigation session.
   */
  const {
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
     MAP STATE
  --------------------------------------------------------- */

  const mapRef =
    useRef(null);

  const [
    mapReady,
    setMapReady,
  ] = useState(false);


  /* ---------------------------------------------------------
     OPTIONAL FINAL DESTINATION
  --------------------------------------------------------- */

  const [
    finalDestination,
    setFinalDestination,
  ] = useState(() => route?.params?.finalDestination ?? null);

  const [
    finalRouteCoordinates,
    setFinalRouteCoordinates,
  ] = useState(() => route?.params?.finalRouteCoordinates ?? []);

  const [
    destinationError,
    setDestinationError,
  ] = useState(null);

  const [
    showDestinationSearch,
    setShowDestinationSearch,
  ] = useState(false);


  /* ---------------------------------------------------------
     COOLING OPTION DISPLAY
  --------------------------------------------------------- */

  const coolingDisplay =
    getCoolingDisplay(
      coolingOption,
      coolingOption?.type
    );

  const isWater =
    coolingOption?.type === "water";

  const finalDestinationLabel =
    formatCoolingLocation(
      finalDestination?.label
    );


  /* ---------------------------------------------------------
     FIT MAP TO THE COMPLETE ROUTE
  --------------------------------------------------------- */

  useEffect(() => {
    const coordinates = [
      ...routeCoordinates,
      ...finalRouteCoordinates,
    ];

    if (
      mapReady &&
      coordinates.length > 1
    ) {
      mapRef.current
        ?.fitToCoordinates(
          coordinates,
          {
            edgePadding: {
              top: 110,
              right: 42,
              bottom: 310,
              left: 42,
            },

            animated: true,
          }
        );
    }
  }, [
    mapReady,
    routeCoordinates,
    finalRouteCoordinates,
  ]);


  /* ---------------------------------------------------------
     FINAL DESTINATION ROUTING
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

        setFinalRouteCoordinates(
          polyline
            .decode(
              nextRoute.encodedPolyline
            )
            .map(
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
    };


  /* ---------------------------------------------------------
     USE CURRENT LOCATION AS FINAL DESTINATION
  --------------------------------------------------------- */

  const handleCurrentLocationAsDestination =
    async () => {
      const result =
        await requestCurrentUserLocation();

      if (
        !result.granted ||
        !result.location
      ) {
        setDestinationError(
          "Location permission is required to use your current location."
        );

        return;
      }

      handleDestinationSelected({
        ...result.location,
        label:
          "Current Location",
      });
    };


  /* ---------------------------------------------------------
     OPEN GOOGLE MAPS

     Prefer the MiniMapProvider launcher introduced by the
     floating-overlay branch.

     It receives the current route state, including any final
     destination selected on this screen.

     The same native launch helper is used as a fallback if
     the Mini Map launcher is unavailable.
  --------------------------------------------------------- */

  const handleOpenGoogleMaps =
    async () => {
      if (
        !origin ||
        !coolingOption
      ) {
        return;
      }

      /*
       * Combine the original navigation parameters with the
       * latest local state from this screen.
       *
       * This matters because finalDestination is selected
       * after this screen has already opened and therefore
       * is not necessarily present in route.params.
       */
      const googleMapsParams = {
        ...(route?.params ?? {}),

        origin,
        coolingOption,
        routeInfo,
        routeCoordinates,

        finalDestination,
        finalRouteCoordinates,
      };

      /*
       * Floating-overlay / MiniMap path.
       */
      if (openGoogleMaps) {
        await openGoogleMaps(
          googleMapsParams
        );

        return;
      }

      /*
       * Native fallback.
       */
      await openGoogleMapsUrl(createGoogleMapsUrl(createMiniMapRoute(googleMapsParams)));
    };


  /* ---------------------------------------------------------
     INITIAL MAP LOCATION
  --------------------------------------------------------- */

  const initialCoordinate =
    origin ||
    coolingOption || {
      latitude:
        -37.8136,

      longitude:
        144.9631,
    };


  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <View
      style={
        styles.safeArea
      }
    >
      {/* =====================================================
          MAP
      ====================================================== */}

      <MapView
        testID="walking-route-map"
        ref={
          mapRef
        }
        onMapReady={() =>
          setMapReady(true)
        }
        style={[StyleSheet.absoluteFillObject, { top: insets.top + headerHeight + 18 }]}
        userInterfaceStyle={
          theme.dark
            ? "dark"
            : "light"
        }
        customMapStyle={
          theme.dark
            ? DARK_MAP_STYLE
            : MAP_STYLE
        }
        initialRegion={{
          latitude:
            Number(
              initialCoordinate.latitude
            ),

          longitude:
            Number(
              initialCoordinate.longitude
            ),

          latitudeDelta:
            0.02,

          longitudeDelta:
            0.02,
        }}
      >
        {/* CURRENT / START LOCATION */}

        {origin && (
          <Marker
            coordinate={{
              latitude:
                Number(
                  origin.latitude
                ),

              longitude:
                Number(
                  origin.longitude
                ),
            }}
            title={
              origin.label ||
              "Starting location"
            }
          >
            <View
              style={
                styles.currentLocationMarker
              }
            >
              <View
                style={
                  styles.currentLocationDot
                }
              />
            </View>
          </Marker>
        )}


        {/* COOLING DESTINATION */}

        {coolingOption && (
          <Marker
            coordinate={{
              latitude:
                Number(
                  coolingOption.latitude
                ),

              longitude:
                Number(
                  coolingOption.longitude
                ),
            }}
            title={
              coolingDisplay.name
            }
            description={
              coolingDisplay.location
            }
            accessibilityLabel={
              `${coolingDisplay.name}, ${coolingDisplay.location}`
            }
          >
            <View
              style={[
                styles.coolingMarker,

                isWater
                  ? styles.waterMarker
                  : styles.shadeMarker,
              ]}
            >
              <Ionicons
                name={
                  isWater
                    ? "water"
                    : "leaf"
                }
                size={22}
                color={
                  theme.color(
                    "#FFFFFF"
                  )
                }
              />
            </View>
          </Marker>
        )}


        {/* FINAL DESTINATION */}

        {finalDestination && (
          <Marker
            coordinate={{
              latitude:
                Number(
                  finalDestination.latitude
                ),

              longitude:
                Number(
                  finalDestination.longitude
                ),
            }}
            title={
              finalDestination.label ||
              "Final destination"
            }
          />
        )}


        {/* ROUTE TO COOLING STOP */}

        {routeCoordinates.length >
          0 && (
          <Polyline
            coordinates={
              routeCoordinates
            }
            strokeColor="#087751"
            strokeWidth={5}
          />
        )}


        {/* ROUTE FROM COOLING STOP TO FINAL DESTINATION */}

        {finalRouteCoordinates.length >
          0 && (
          <Polyline
            coordinates={
              finalRouteCoordinates
            }
            strokeColor="#087751"
            strokeWidth={5}
          />
        )}
      </MapView>


      {/* =====================================================
          TOP BAR
      ====================================================== */}

      <View
        testID="walking-route-header"
        onLayout={({ nativeEvent }) => setHeaderHeight(nativeEvent.layout.height)}
        style={[
          styles.topBar,
          {
            top:
              insets.top +
              10,
          },
        ]}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={
            styles.backButton
          }
          onPress={() =>
            navigation.goBack()
          }
        >
          <Ionicons
            name="chevron-back"
            size={28}
            color={
              theme.color(
                "#0A382E"
              )
            }
          />
        </TouchableOpacity>

        <Text
          accessibilityRole="header"
          style={
            styles.title
          }
        >
          Walking route
        </Text>
      </View>


      {/* =====================================================
          ROUTE INFORMATION SHEET
      ====================================================== */}

      <View
        style={[
          styles.routeSheet,
          {
            bottom:
              insets.bottom +
              18,
          },
        ]}
      >
        <View
          style={
            styles.handle
          }
        />


        {/* START LOCATION */}

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
                  routeInfo.durationMinutes
                }{" "}
                min (
                {
                  routeInfo.distanceMeters
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


        {/* FINAL DESTINATION TOGGLE */}

        <TouchableOpacity
          accessibilityRole="button"
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
        </TouchableOpacity>


        {/* FINAL DESTINATION SEARCH */}

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

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open route in Google Maps"
          disabled={
            !origin ||
            !coolingOption
          }
          style={[
            styles.googleMapsButton,

            (
              !origin ||
              !coolingOption
            ) &&
              styles.googleMapsButtonDisabled,
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
            Open in Google Maps
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


/* =========================================================
   STYLES
========================================================= */

const baseStyles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        "#E8F0EC",
    },

    topBar: {
      position:
        "absolute",

      top: 10,
      left: 16,
      right: 16,

      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 14,
      padding: 8,
      minHeight: 66,
      borderRadius: 16,
      backgroundColor: "#FFFFFF",
      zIndex: 20,
    },

    backButton: {
      flexShrink: 0,
      width: 50,
      height: 50,
      borderRadius: 25,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "rgba(255,255,255,0.95)",

      shadowColor:
        "#173C31",

      shadowOpacity:
        0.14,

      shadowRadius:
        12,

      elevation: 6,
    },

    title: {
      flex: 1,
      minWidth: 0,
      lineHeight: 34,

      fontSize: 28,
      fontWeight: "800",

      color:
        "#0A3028",

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

      shadowRadius:
        20,

      shadowOffset: {
        width: 0,
        height: 8,
      },

      elevation: 10,
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

    currentLocationMarker: {
      width: 26,
      height: 26,

      borderRadius: 13,

      backgroundColor:
        "rgba(40,123,224,0.2)",

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    currentLocationDot: {
      width: 14,
      height: 14,

      borderRadius: 7,

      backgroundColor:
        "#287BE0",

      borderWidth: 3,

      borderColor:
        "#FFFFFF",
    },

    coolingMarker: {
      width: 42,
      height: 42,

      borderRadius: 21,

      alignItems:
        "center",

      justifyContent:
        "center",

      borderWidth: 3,

      borderColor:
        "#FFFFFF",

      elevation: 5,
    },

    shadeMarker: {
      backgroundColor:
        "#087751",
    },

    waterMarker: {
      backgroundColor:
        "#1976D2",
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
      fontWeight: "800",

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
      fontWeight: "800",

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
    },

    destinationToggleText: {
      flex: 1,

      fontSize: 14,
      fontWeight: "700",

      color:
        "#31524A",
    },

    destinationSearch: {
      marginBottom: 8,
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
    },

    googleMapsButtonDisabled: {
      opacity: 0.45,
    },

    googleMapsButtonText: {
      color:
        "#FFFFFF",

      fontSize: 16,
      fontWeight: "800",
    },
  });
