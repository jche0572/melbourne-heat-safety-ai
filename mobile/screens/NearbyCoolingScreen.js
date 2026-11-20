import { DARK_MAP_STYLE } from "../theme/mapStyle";
import { useThemedStyles } from "../theme/useAppTheme";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import MapView, { Marker, Polyline } from "react-native-maps";
import polyline from "@mapbox/polyline";

import LocationSearchBar from "../components/LocationSearchBar";
import {
  getNearbyFountains,
  getNearbyShade,
  getWalkingRoute,
} from "../services/nearbyCoolingService";
import {
  getCurrentUserLocation,
  requestCurrentUserLocation,
} from "../services/locationService";
import { getCoolingDisplay } from "../utils/coolingDisplay";

const MELBOURNE_DEFAULT_LOCATION = {
  latitude: -37.8136,
  longitude: 144.9631,
  label: "Melbourne CBD",
};

const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f4f8f4" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#586b65" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#a9dff5" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#cdebc9" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#dce6e0" }] },
];

export default function NearbyCoolingScreen({ navigation }) {
  const { styles, theme } = useThemedStyles(baseStyles);
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const [userLocation, setUserLocation] = useState(null);
  const [searchOrigin, setSearchOrigin] = useState(null);
  const [mapDisplayLocation, setMapDisplayLocation] = useState(null);
  const [isManualSearch, setIsManualSearch] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [selectedCoolingType, setSelectedCoolingType] = useState("shade");
  const [fountains, setFountains] = useState([]);
  const [fountainLoading, setFountainLoading] = useState(false);
  const [fountainError, setFountainError] = useState(null);
  const [shadeAreas, setShadeAreas] = useState([]);
  const [shadeLoading, setShadeLoading] = useState(false);
  const [shadeError, setShadeError] = useState(null);
  const [selectedFountain, setSelectedFountain] = useState(null);
  const [selectedShade, setSelectedShade] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const [showAllResults, setShowAllResults] = useState(false);

  useEffect(() => {
    async function loadLocation() {
      const location = await getCurrentUserLocation();
      if (!location) {
        setLocationError("Location permission denied");
        setMapDisplayLocation(MELBOURNE_DEFAULT_LOCATION);
        return;
      }
      const currentLocation = { ...location, label: "Current Location" };
      setUserLocation(location);
      setSearchOrigin(currentLocation);
      setMapDisplayLocation(currentLocation);
    }
    loadLocation();
  }, []);

  useEffect(() => {
    if (!searchOrigin) return;
    setFountainLoading(true);
    setFountainError(null);
    getNearbyFountains(searchOrigin.latitude, searchOrigin.longitude)
      .then((data) => setFountains(data.fountains))
      .catch((error) => {
        console.error(error);
        setFountainError("Could not load nearby drinking fountains");
      })
      .finally(() => setFountainLoading(false));
  }, [searchOrigin]);

  useEffect(() => {
    if (!searchOrigin) return;
    setShadeLoading(true);
    setShadeError(null);
    getNearbyShade(searchOrigin.latitude, searchOrigin.longitude)
      .then((data) => setShadeAreas(data.shadeAreas))
      .catch((error) => {
        console.error(error);
        setShadeError("Could not load nearby shade areas");
      })
      .finally(() => setShadeLoading(false));
  }, [searchOrigin]);

  const clearSelection = () => {
    setSelectedFountain(null);
    setSelectedShade(null);
    setRouteCoordinates([]);
    setRouteInfo(null);
    setRouteError(null);
  };

  const focusMap = (location) => {
    mapRef.current?.animateToRegion(
      { ...location, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      500
    );
  };

  const handleManualLocationSelected = (location) => {
    setSearchOrigin(location);
    setMapDisplayLocation(location);
    setIsManualSearch(true);
    setLocationError(null);
    setShowAllResults(false);
    clearSelection();
    focusMap(location);
  };

  const handleCurrentLocationPress = async () => {
    try {
      const result = await requestCurrentUserLocation();
      if (!result.granted) {
        if (result.canAskAgain) {
          setLocationError("Location permission is required to use your current location.");
          return;
        }
        Alert.alert(
          "Location permission required",
          "Location access is disabled. Open your device settings to allow SolAdapt to use your current location.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
      const currentLocation = { ...result.location, label: "Current Location" };
      setUserLocation(result.location);
      setSearchOrigin(currentLocation);
      setMapDisplayLocation(currentLocation);
      setIsManualSearch(false);
      setLocationError(null);
      setShowAllResults(false);
      clearSelection();
      focusMap(result.location);
    } catch (error) {
      console.error("Could not get current location:", error);
      setLocationError("Unable to get your current location.");
    }
  };

  const loadRoute = async (option, type) => {
    if (!searchOrigin) return;
    const latitude = Number(option.latitude);
    const longitude = Number(option.longitude);
    if (type === "shade") {
      setSelectedShade(option);
      setSelectedFountain(null);
    } else {
      setSelectedFountain(option);
      setSelectedShade(null);
    }
    setRouteCoordinates([]);
    setRouteInfo(null);
    setRouteLoading(true);
    setRouteError(null);
    try {
      const route = await getWalkingRoute(
        searchOrigin.latitude,
        searchOrigin.longitude,
        latitude,
        longitude
      );
      const coordinates = polyline
        .decode(route.encodedPolyline)
        .map(([pointLatitude, pointLongitude]) => ({
          latitude: pointLatitude,
          longitude: pointLongitude,
        }));
      setRouteCoordinates(coordinates);
      setRouteInfo({
        distanceMeters: route.distanceMeters,
        durationMinutes: route.durationMinutes,
      });
      if (coordinates.length > 0) {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 80, right: 50, bottom: 210, left: 50 },
          animated: true,
        });
      }
    } catch (error) {
      console.error(error);
      setRouteError("Could not calculate walking route");
    } finally {
      setRouteLoading(false);
    }
  };

  const handleCoolingTypeChange = (type) => {
    setSelectedCoolingType(type);
    setShowAllResults(false);
    clearSelection();
  };

  const selectedOption = selectedShade || selectedFountain;
  const results = selectedCoolingType === "shade" ? shadeAreas : fountains;
  const loading = selectedCoolingType === "shade" ? shadeLoading : fountainLoading;
  const resultsError = selectedCoolingType === "shade" ? shadeError : fountainError;
  const visibleResults = showAllResults ? results : results.slice(0, 2);
  const selectedDisplay = selectedOption
    ? getCoolingDisplay(selectedOption, selectedShade ? "shade" : "water")
    : null;

  const handleContinueToCoolingRoute = () => {
    /*
     * Only continue when a complete, valid walking route
     * has been calculated.
     *
     * This preserves the stronger validation from the
     * previous Nearby Cooling implementation.
     */
    if (
      !searchOrigin ||
      !selectedOption ||
      !routeInfo ||
      routeLoading ||
      routeError ||
      !Array.isArray(routeCoordinates) ||
      routeCoordinates.length < 2
    ) {
      return;
    }

    /*
     * Preserve the richer cooling-option structure from
     * the new UI version because CoolingNavigation uses
     * these values to display the selected stop.
     */
    navigation.navigate("CoolingNavigation", {
      origin: searchOrigin,

      coolingOption: {
        type:
          selectedShade
            ? "shade"
            : "water",

        id:
          selectedShade
            ? selectedShade.canopy_id
            : selectedFountain.asset_id,

        name:
          selectedShade
            ? "Tree shade area"
            : selectedFountain.location_description ||
              "Drinking fountain",

        facility_type:
          selectedOption.facility_type,

        location_description:
          selectedOption.location_description,

        latitude:
          Number(
            selectedOption.latitude
          ),

        longitude:
          Number(
            selectedOption.longitude
          ),

        distanceMeters:
          selectedOption.distance_m,
      },

      routeInfo,
      routeCoordinates,
    });
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
      <View style={styles.mapContainer}>
        {!mapDisplayLocation ? (
          <View style={styles.centered}><Text style={styles.muted}>Getting your location...</Text></View>
        ) : (
          <MapView
            ref={mapRef}
            style={styles.map}
            userInterfaceStyle={theme.dark ? "dark" : "light"}
            customMapStyle={theme.dark ? DARK_MAP_STYLE : MAP_STYLE}
            initialRegion={{
              latitude: mapDisplayLocation.latitude,
              longitude: mapDisplayLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            showsUserLocation={false}
            showsMyLocationButton={false}
            onPress={() => Keyboard.dismiss()}
          >
            {userLocation && (
              <Marker coordinate={userLocation} accessibilityLabel="Your current location">
                <View style={styles.currentLocationHalo}>
                  <View style={styles.currentLocationDot} />
                </View>
              </Marker>
            )}
            {isManualSearch && searchOrigin && (
              <Marker coordinate={searchOrigin} accessibilityLabel={searchOrigin.label || "Search location"}>
                <View style={styles.searchMarker}>
                  <Ionicons name="location" size={20} color={theme.color("#FFFFFF")} />
                </View>
              </Marker>
            )}
            {selectedCoolingType === "shade" && shadeAreas.map((shade) => {
              const isSelected = selectedShade?.canopy_id === shade.canopy_id;
              return (
                <Marker
                  key={`shade-${shade.canopy_id}`}
                  coordinate={{ latitude: Number(shade.latitude), longitude: Number(shade.longitude) }}
                  accessibilityLabel={`Tree shade area, ${shade.distance_m} metres away`}
                  onPress={() => loadRoute(shade, "shade")}
                >
                  <View style={[styles.markerHalo, isSelected && styles.shadeMarkerHaloSelected]}>
                    <View style={[styles.coolingMarker, styles.shadeMarker, isSelected && styles.coolingMarkerSelected]}>
                      <Ionicons name="leaf" size={isSelected ? 22 : 19} color={theme.color("#FFFFFF")} />
                    </View>
                  </View>
                </Marker>
              );
            })}
            {selectedCoolingType === "water" && fountains.map((fountain) => {
              const isSelected = selectedFountain?.asset_id === fountain.asset_id;
              return (
                <Marker
                  key={fountain.asset_id}
                  coordinate={{ latitude: Number(fountain.latitude), longitude: Number(fountain.longitude) }}
                  accessibilityLabel={`${fountain.facility_type || "Drinking fountain"}, ${fountain.distance_m} metres away`}
                  onPress={() => loadRoute(fountain, "water")}
                >
                  <View style={[styles.markerHalo, isSelected && styles.waterMarkerHaloSelected]}>
                    <View style={[styles.coolingMarker, styles.waterMarker, isSelected && styles.coolingMarkerSelected]}>
                      <Ionicons name="water" size={isSelected ? 22 : 19} color={theme.color("#FFFFFF")} />
                    </View>
                  </View>
                </Marker>
              );
            })}
            {routeCoordinates.length > 0 && (
              <Polyline coordinates={routeCoordinates} strokeWidth={5} strokeColor="#087751" />
            )}
          </MapView>
        )}
      </View>
      <LinearGradient
        pointerEvents="none"
        colors={(["#F4F8F6", "rgba(244,248,246,0.9)", "rgba(244,248,246,0)"]).map(c => theme.color(c, 'backgroundColor'))}
        locations={[0, 0.58, 1]}
        style={[styles.topGradient, { height: 206 + insets.top }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={(["rgba(244,248,246,0)", "rgba(244,248,246,0.78)", "#F4F8F6"]).map(c => theme.color(c, 'backgroundColor'))}
        locations={[0, 0.55, 1]}
        style={styles.bottomGradient}
      />
      <Text style={[styles.headerTitle, { top: 12 + insets.top }]}>Nearby cooling options</Text>
      <View style={[styles.searchContainer, { top: 56 + insets.top }]}>
        <LocationSearchBar
          onLocationSelected={handleManualLocationSelected}
          onCurrentLocationPress={handleCurrentLocationPress}
        />
      </View>
      <View style={[styles.coolingTypeContainer, { top: 116 + insets.top }]}>
        {[
          ["shade", "leaf", "Shade"],
          ["water", "water", "Water"],
        ].map(([type, icon, label]) => (
          <TouchableOpacity
            key={type}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedCoolingType === type }}
            accessibilityLabel={`Show nearby ${label.toLowerCase()}`}
            style={[
              styles.coolingTypeButton,
              selectedCoolingType === type && (type === "water" ? styles.waterTypeButtonSelected : styles.coolingTypeButtonSelected),
            ]}
            onPress={() => handleCoolingTypeChange(type)}
          >
            <Ionicons name={icon} size={21} color={theme.color(type === "water" ? "#147BD1" : "#087751")} />
            <Text style={[styles.coolingTypeText, type === "water" && styles.waterTypeText]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.resultsSheet, showAllResults && !selectedOption && styles.expandedResultsSheet]}>
        {selectedOption ? (
          <>
            <View style={styles.detailHandle} />
            <View style={styles.detailHeader}>
              <View style={[styles.resultIcon, selectedFountain && styles.waterIcon]}>
                <Ionicons name={selectedFountain ? "water" : "leaf"} size={25} color={theme.color("#FFFFFF")} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.resultTitle} numberOfLines={2}>{selectedDisplay.name}</Text>
                {!!selectedDisplay.location && (
                  <Text style={styles.muted} numberOfLines={1}>{selectedDisplay.location}</Text>
                )}
              </View>
              <TouchableOpacity accessibilityLabel="Close place details" onPress={clearSelection} style={styles.closeButton}>
                <Ionicons name="close" size={22} color={theme.color("#52615C")} />
              </TouchableOpacity>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="walk-outline" size={20} color={theme.color("#31524A")} />
              <Text style={styles.detailLabel}>Walking route</Text>
              <Text numberOfLines={2} style={[styles.detailText, routeError && { color: theme.color("#B3261E", 'color') }]}>
                {routeInfo && !routeLoading
                  ? `${routeInfo.durationMinutes} min · ${routeInfo.distanceMeters} m`
                  : routeError || "Calculating..."}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Get directions"

              accessibilityState={{
                disabled:
                  !routeInfo ||
                  routeLoading ||
                  !!routeError ||
                  routeCoordinates.length < 2,
              }}

              disabled={
                !routeInfo ||
                routeLoading ||
                !!routeError ||
                routeCoordinates.length < 2
              }

              style={[
                styles.directionsButton,

                (
                  !routeInfo ||
                  routeLoading ||
                  !!routeError ||
                  routeCoordinates.length < 2
                ) &&
                  styles.buttonDisabled,
              ]}

              onPress={
                handleContinueToCoolingRoute
              }
            >
              <Ionicons
                name="navigate"
                size={20}
                color={
                  theme.color("#FFFFFF")
                }
              />

              <Text
                style={
                  styles.directionsButtonText
                }
              >
                Get directions
              </Text>
            </TouchableOpacity>
          </>
        ) : !searchOrigin ? (
          <View style={styles.emptyState}>
            <Text style={styles.resultTitle}>Choose a location</Text>
            <Text style={styles.muted}>{locationError || "Search for a place or use your current location."}</Text>
          </View>
        ) : (
          <>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{selectedCoolingType === "water" ? "Nearby water" : "Nearby shade"}</Text>
              {results.length > 2 && (
                <TouchableOpacity accessibilityRole="button" onPress={() => setShowAllResults((value) => !value)} style={styles.seeAllButton}>
                  <Text style={styles.seeAllText}>{showAllResults ? "Show less" : "See all"}</Text>
                </TouchableOpacity>
              )}
            </View>
            {loading ? <Text style={styles.statusText}>Finding nearby options...</Text>
              : resultsError ? <Text style={styles.errorText}>{resultsError}</Text>
              : visibleResults.length === 0 ? <Text style={styles.statusText}>No nearby options found</Text>
              : <ScrollView style={showAllResults && styles.expandedResultsList} showsVerticalScrollIndicator={showAllResults}>{visibleResults.map((option) => {
                const display = getCoolingDisplay(option, selectedCoolingType);
                return (
                  <TouchableOpacity
                    key={selectedCoolingType === "shade" ? option.canopy_id : option.asset_id}
                    style={styles.resultCard}
                    onPress={() => loadRoute(option, selectedCoolingType)}
                  >
                    <View style={[styles.resultIcon, selectedCoolingType === "water" && styles.waterIcon]}>
                      <Ionicons name={selectedCoolingType === "water" ? "water" : "leaf"} size={22} color={theme.color("#FFFFFF")} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.resultTitle} numberOfLines={1}>{display.name}</Text>
                      <Text style={styles.muted} numberOfLines={1}>
                        {display.location ? `${display.location} · ` : ""}{option.distance_m} m away
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.color("#52615C")} />
                  </TouchableOpacity>
                );
              })}</ScrollView>}
          </>
        )}
      </View>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F4F8F6" },
  headerTitle: { position: "absolute", top: 12, left: 20, right: 20, zIndex: 12, fontSize: 28, lineHeight: 34, fontWeight: "800", color: "#0A382E" },
  searchContainer: { position: "absolute", top: 56, left: 18, right: 18, zIndex: 12 },
  coolingTypeContainer: { position: "absolute", top: 116, left: 18, right: 18, flexDirection: "row", padding: 4, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.92)", zIndex: 11 },
  coolingTypeButton: { flex: 1, minHeight: 46, borderRadius: 21, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  coolingTypeButtonSelected: { backgroundColor: "#D9F4E5" },
  waterTypeButtonSelected: { backgroundColor: "#DCEEFF" },
  coolingTypeText: { fontSize: 15, fontWeight: "700", color: "#193E34" },
  waterTypeText: { color: "#1666AC" },
  mapContainer: { ...StyleSheet.absoluteFill, overflow: "hidden", backgroundColor: "#E4ECE8" },
  map: { width: "100%", height: "100%" },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 206, zIndex: 8 },
  bottomGradient: { position: "absolute", left: 0, right: 0, bottom: 0, height: 250, zIndex: 8 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  resultsSheet: { position: "absolute", left: 14, right: 14, bottom: 104, zIndex: 10, maxHeight: "48%", padding: 14, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.96)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)", shadowColor: "#163F34", shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 7 }, elevation: 9 },
  expandedResultsSheet: { height: "48%" },
  expandedResultsList: { flex: 1 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: "#0A382E" },
  seeAllButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  seeAllText: { color: "#31524A", fontWeight: "700", padding: 8 },
  resultCard: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#DDE5E1" },
  resultIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#087751", alignItems: "center", justifyContent: "center" },
  waterIcon: { backgroundColor: "#147BD1" },
  resultTitle: { fontSize: 16, fontWeight: "800", color: "#0A3028" },
  muted: { marginTop: 2, fontSize: 14, color: "#5F6E69" },
  flex: { flex: 1, minWidth: 0 },
  detailHandle: { alignSelf: "center", width: 36, height: 4, marginTop: -6, marginBottom: 12, borderRadius: 2, backgroundColor: "#C4CFCA" },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  detailRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: "#EAF7F3" },
  detailLabel: { flex: 1, color: "#31524A", fontSize: 14, fontWeight: "600" },
  detailText: { color: "#31524A", fontSize: 14, fontWeight: "700", textAlign: "right" },
  statusText: { paddingVertical: 12, color: "#5F6E69" },
  errorText: { paddingVertical: 10, color: "#B3261E" },
  directionsButton: { minHeight: 50, marginTop: 10, borderRadius: 25, backgroundColor: "#087751", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  directionsButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  buttonDisabled: { opacity: 0.45 },
  emptyState: { padding: 10, alignItems: "center" },
  markerHalo: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  shadeMarkerHaloSelected: { backgroundColor: "rgba(8,119,81,0.22)" },
  waterMarkerHaloSelected: { backgroundColor: "rgba(20,123,209,0.22)" },
  coolingMarker: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF" },
  coolingMarkerSelected: { width: 42, height: 42, borderRadius: 21 },
  shadeMarker: { backgroundColor: "#087751" },
  waterMarker: { backgroundColor: "#147BD1" },
  currentLocationHalo: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(47,111,237,0.22)", alignItems: "center", justifyContent: "center" },
  currentLocationDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#2F6FED", borderWidth: 2, borderColor: "#FFFFFF" },
  searchMarker: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#52615C", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF" },
});