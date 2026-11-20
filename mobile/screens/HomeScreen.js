import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";

import AlertCard from "../components/AlertCard";
import GlassSurface from "../components/GlassSurface";
import EnvironmentalMetricCard from "../components/EnvironmentalMetricCard";
import WeatherAtmosphere from "../components/WeatherAtmosphere";
import useWeatherAtmosphere from "../utils/useWeatherAtmosphere";
import { useAppTheme } from "../theme/useAppTheme";

import {
  getEnvironmentalData,
  getEnvironmentalFallback,
} from "../services/environmentService";

import {
  requestCurrentUserLocation,
} from "../services/locationService";

import {
  getSuburbFromCoordinates,
} from "../services/locationSearchService";

import {
  getAlertContent,
  getAlertState,
  getUvCategory,
} from "../utils/alertState";

/*
 * Check whether the user's GPS coordinates
 * are inside the SolAdapt service area.
 */
import {
  checkCityOfMelbourneServiceArea,
} from "../services/serviceAreaService";

const DEVELOPMENT_ALERT_SCENARIOS =
  Object.freeze({
    NORMAL: Object.freeze({
      temperature: 17,
      uvIndex: 0,
    }),

    HIGH_HEAT: Object.freeze({
      temperature: 38,
      uvIndex: 0,
    }),

    HIGH_UV: Object.freeze({
      temperature: 17,
      uvIndex: 9,
    }),

    HIGH_HEAT_AND_UV:
      Object.freeze({
        temperature: 38,
        uvIndex: 9,
      }),
  });

// DEVELOPMENT ONLY:
// null means real API data.
const ACTIVE_DEVELOPMENT_ALERT_SCENARIO =
  null;

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [
    environment,
    setEnvironment,
  ] = useState(
    getEnvironmentalFallback
  );

  /* -----------------------------
     LOCATION DISPLAY
  ----------------------------- */

  const [
    locationLabel,
    setLocationLabel,
  ] = useState("");

  const [
    hasLocationAccess,
    setHasLocationAccess,
  ] = useState(false);

  const [
    locationCanAskAgain,
    setLocationCanAskAgain,
  ] = useState(true);

  const [
    locationLoading,
    setLocationLoading,
  ] = useState(false);

  const [
    locationMessage,
    setLocationMessage,
  ] = useState(null);

  /*
  * Tracks whether the user has granted location permission
  * but their actual GPS location is outside the
  * City of Melbourne municipal boundary.
  *
  * false:
  *   - location permission denied, OR
  *   - current location is inside City of Melbourne
  *
  * true:
  *   - location permission granted
  *   - GPS was successfully obtained
  *   - PostGIS confirmed the point is outside the boundary
  */
  const [
    isOutsideServiceArea,
    setIsOutsideServiceArea,
  ] = useState(false);

  /*
   * Keep the latest GPS coordinates
   * without forcing a React re-render.
   */
  const currentLocationRef =
    useRef(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  currentLocationRef.current = currentLocation;
  const focused = useIsFocused();
  const { scene: liveScene, observation } = useWeatherAtmosphere(currentLocation, true);
  const [weatherPreview, setWeatherPreview] = useState(null);
  const [showWeatherPreview, setShowWeatherPreview] = useState(false);
  const [weatherRenderError, setWeatherRenderError] = useState(null);
  const scene = __DEV__ && weatherPreview ? weatherPreview : liveScene;
  const theme = useAppTheme();
  const { setWeatherNight, setPreviewDark } = theme;
  useEffect(() => { setWeatherNight(liveScene === "night"); }, [liveScene, setWeatherNight]);
  useEffect(() => {
    setPreviewDark(__DEV__ && weatherPreview ? weatherPreview === "night" : null);
  }, [weatherPreview, setPreviewDark]);
  const themed = useMemo(() => theme.styles(styles), [theme]);
  const [conditionsLayout, setConditionsLayout] = useState(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [atmosphereReady, setAtmosphereReady] = useState(false);
  const sharedRainGlass = scene === "rain" && atmosphereReady;
  const ConditionsSurface = sharedRainGlass ? View : GlassSurface;

  /* -----------------------------
     ENVIRONMENT REFRESH
  ----------------------------- */

  const refreshEnvironmentalData =
    async (location = null) => {
      try {
        const data =
          await getEnvironmentalData(
            location?.latitude,
            location?.longitude
          );

        setEnvironment(data);
      } catch {
        setEnvironment(
          getEnvironmentalFallback()
        );
      }
    };

  /* -----------------------------
    APPLY A GRANTED LOCATION
  ----------------------------- */

  /*
  * This function runs after the operating system/browser
  * successfully gives SolAdapt the user's GPS coordinates.
  *
  * The important change is that we now check the coordinates
  * against the official City of Melbourne municipal boundary
  * BEFORE treating the location as a supported SolAdapt
  * location.
  */
  const applyCurrentLocation =
    async (location) => {

      /*
      * The user DID grant location permission.
      *
      * This stays true even when the actual GPS point is
      * outside City of Melbourne.
      *
      * "Permission granted" and "inside service area"
      * are two different states.
      */
      setHasLocationAccess(true);

      /*
      * Clear any previous permission/error message.
      */
      setLocationMessage(null);


      /*
      * --------------------------------------------------
      * STEP 1:
      * Check whether the GPS point is inside
      * City of Melbourne.
      * --------------------------------------------------
      */
      try {
        const serviceAreaResult =
          await checkCityOfMelbourneServiceArea(
            location.latitude,
            location.longitude
          );


        /*
        * ------------------------------------------------
        * OUTSIDE CITY OF MELBOURNE
        * ------------------------------------------------
        *
        * The user has shared their location successfully,
        * but SolAdapt does not support that geographic
        * location.
        */
        if (
          !serviceAreaResult.insideCityOfMelbourne
        ) {
          /*
          * Record the service-area state separately from
          * location permission.
          */
          setIsOutsideServiceArea(true);


          /*
          * On the Home screen we keep the simple
          * "Current location" heading.
          *
          * The explanatory service-area message will be
          * displayed underneath it.
          */
          setLocationLabel(
            "Current location"
          );


          /*
          * Do not use an unsupported location as the
          * location for SolAdapt's nearby environmental
          * lookup.
          *
          * null keeps the existing fallback behaviour.
          */
          setCurrentLocation(null);

          await refreshEnvironmentalData(
            null
          );


          /*
          * Stop here.
          *
          * In particular, we do NOT try to reverse-geocode
          * the out-of-area location into a suburb.
          */
          return;
        }


        /*
        * ------------------------------------------------
        * INSIDE CITY OF MELBOURNE
        * ------------------------------------------------
        *
        * The coordinate is supported, so normal
        * SolAdapt behaviour can continue.
        */
        setIsOutsideServiceArea(false);

      } catch (error) {
        /*
        * A backend/network failure is NOT the same as
        * being outside City of Melbourne.
        *
        * We therefore do not mark the user as outside.
        */
        console.error(
          "Could not verify service area:",
          error
        );

        setIsOutsideServiceArea(false);

        setLocationLabel(
          "Current location"
        );

        setLocationMessage(
          "Unable to verify whether your current location is within the City of Melbourne."
        );

        /*
        * Avoid using an unverified location for
        * location-based environmental information.
        */
        setCurrentLocation(null);

        await refreshEnvironmentalData(
          null
        );

        return;
      }


      /*
      * --------------------------------------------------
      * STEP 2:
      * Save the valid City of Melbourne location.
      * --------------------------------------------------
      *
      * This ref is used by your one-minute environmental
      * refresh.
      */
      setCurrentLocation(location);


      /*
      * --------------------------------------------------
      * STEP 3:
      * Try to obtain a readable suburb/location name.
      * --------------------------------------------------
      *
      * Your existing behaviour is kept here.
      *
      * If reverse geocoding is unavailable, the screen
      * simply falls back to "Current location".
      */
      try {
        const suburb =
          await getSuburbFromCoordinates(
            location.latitude,
            location.longitude
          );

        setLocationLabel(
          suburb ||
            "Current location"
        );
      } catch (error) {
        console.warn(
          "Could not get suburb:",
          error
        );

        setLocationLabel(
          "Current location"
        );
      }


      /*
      * --------------------------------------------------
      * STEP 4:
      * Reload environmental information using the
      * supported City of Melbourne GPS location.
      * --------------------------------------------------
      */
      await refreshEnvironmentalData(
        location
      );
    };

  /* -----------------------------
     INITIAL LOCATION
  ----------------------------- */

  useEffect(() => {
    let isMounted = true;
    let refreshTimer = null;

    async function initialise() {
      try {
        const result =
          await requestCurrentUserLocation();

        if (!isMounted) {
          return;
        }

        setLocationCanAskAgain(
          result.canAskAgain ?? true
        );

        if (
          result.granted &&
          result.location
        ) {
          await applyCurrentLocation(
            result.location
          );
        } else {
          setCurrentLocation(null);

          /*
          * No GPS permission means we do not know whether the
          * user is inside or outside the City of Melbourne.
          *
          * Therefore this is NOT an "outside service area" state.
          */
          setHasLocationAccess(false);
          setIsOutsideServiceArea(false);

          setLocationLabel("");

          await refreshEnvironmentalData(null);
        }
      } catch (error) {
        console.error(
          "Initial location failed:",
          error
        );

        if (!isMounted) {
          return;
        }

        setHasLocationAccess(false);
        setIsOutsideServiceArea(false);

        setLocationLabel("");

        await refreshEnvironmentalData(
          null
        );
      }

      /*
       * Refresh live environment
       * every minute.
       */
      refreshTimer = setInterval(
        () => {
          refreshEnvironmentalData(
            currentLocationRef.current
          );
        },
        60000
      );
    }

    initialise();

    return () => {
      isMounted = false;

      if (refreshTimer) {
        clearInterval(
          refreshTimer
        );
      }
    };
  }, []);

  /* -----------------------------
     ALLOW LOCATION BUTTON
  ----------------------------- */

  const handleAllowLocation =
    async () => {
      try {
        setLocationLoading(true);

        setLocationMessage(null);

        const result =
          await requestCurrentUserLocation();

        setLocationCanAskAgain(
          result.canAskAgain ?? true
        );

        if (
          result.granted &&
          result.location
        ) {
          await applyCurrentLocation(
            result.location
          );

          return;
        }

        /*
         * WEB
         *
         * Browsers control whether they
         * show the permission prompt again.
         */
        if (Platform.OS === "web") {
          setLocationMessage(
            "Location access is blocked. Please allow location for this website in your browser settings and try again."
          );

          return;
        }

        /*
         * MOBILE:
         * OS no longer allows another
         * permission prompt.
         */
        if (
          result.canAskAgain === false
        ) {
          Alert.alert(
            "Location permission required",
            "Location access is disabled. Open your device settings to allow SolAdapt to use your location.",
            [
              {
                text: "Cancel",
                style: "cancel",
              },
              {
                text:
                  "Open Settings",
                onPress: () =>
                  Linking.openSettings(),
              },
            ]
          );

          return;
        }

        setLocationMessage(
          "Location permission was not granted."
        );
      } catch (error) {
        console.error(
          "Location request failed:",
          error
        );

        setLocationMessage(
          "Unable to access your location."
        );
      } finally {
        setLocationLoading(false);
      }
    };

  /* -----------------------------
     ENVIRONMENT VALUES
  ----------------------------- */

  const developmentAlertScenario =
    __DEV__
      ? ACTIVE_DEVELOPMENT_ALERT_SCENARIO
      : null;

  const temperature =
    developmentAlertScenario
      ?.temperature ??
    environment?.temperature ??
    null;

  const uvIndex =
    developmentAlertScenario
      ?.uvIndex ??
    environment?.uvIndex ??
    null;

  const alertResult =
    getAlertState(
      temperature,
      uvIndex
    );

  const alertContent =
    getAlertContent(
      alertResult
    );

  const temperatureAvailable =
    alertResult
      .temperatureAvailable;

  const uvAvailable =
    alertResult.uvAvailable;

  const heatStatus =
    alertResult.heatHigh
      ? "High Heat"
      : "Normal";

  const uvStatus =
    getUvCategory(
      uvIndex
    );

  const formatNumber = (
    value
  ) => {
    const number =
      Number(value);

    if (
      !Number.isFinite(number)
    ) {
      return "—";
    }

    return number
      .toFixed(1)
      .replace(/\.0$/, "");
  };

  const temperatureDisplay =
    temperatureAvailable
      ? `${formatNumber(
          temperature
        )}°C`
      : "—";

  const uvDisplay =
    uvAvailable
      ? formatNumber(
          uvIndex
        )
      : "—";

  /* =============================
     UI
  ============================= */

  return (
    <View style={themed.screen}>
      <WeatherAtmosphere
        scene={scene}
        dark={theme.dark}
        active={focused}
        cardRect={conditionsLayout ? { ...conditionsLayout, y: conditionsLayout.y - scrollOffset } : null}
        onReady={setAtmosphereReady}
        onError={setWeatherRenderError}
      />

      {focused && <StatusBar
        barStyle={theme.dark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />}

      <ScrollView
        style={styles.foreground}
        onScroll={(event) => setScrollOffset(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.page,
          { paddingTop: insets.top + 18 },
        ]}
        showsVerticalScrollIndicator={
          false
        }
      >
        <View style={styles.header}>
          <Image
            source={require("../assets/soladapt-brand-lockup.png")}
            accessibilityLabel="SolAdapt"
            accessibilityRole="image"
            resizeMode="contain"
            style={styles.brandLogo}
          />
        </View>
        <Text style={themed.welcome}>Let’s plan a heat-smart day.</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={hasLocationAccess ? "Refresh current location" : "Allow location access"} onPress={handleAllowLocation} disabled={locationLoading} style={styles.locationRow}>
          <Ionicons name={isOutsideServiceArea ? "warning-outline" : "location"} size={20} color={theme.color("#38616C")} />
          <Text style={themed.locationText}>{locationLoading ? "Finding your location…" : isOutsideServiceArea ? "Outside service area" : hasLocationAccess ? locationLabel || "Current location" : "Allow location access"}</Text>
        </TouchableOpacity>

        {isOutsideServiceArea || locationMessage ? (
          <View style={themed.locationNotice}>
            <Ionicons
              name="warning-outline"
              size={16}
              color={theme.color("#8A4B08")}
            />
            <Text style={themed.locationNoticeText}>
              {isOutsideServiceArea
                ? "You're outside the City of Melbourne. Location-based features are available only within the service area."
                : locationMessage}
            </Text>
          </View>
        ) : null}

        {!weatherPreview && (liveScene === "neutral" || observation?.isLocationBased === false) && (
          <Text style={[themed.weatherSource, { color: theme.colors.muted }]}>
            {liveScene === "neutral" ? "Weather background temporarily unavailable" : "Using Melbourne CBD weather until local weather is available"}
          </Text>
        )}
        <ConditionsSurface
          {...(!sharedRainGlass ? { dark: theme.dark } : {})}
          onLayout={(event) => setConditionsLayout(event.nativeEvent.layout)}
          style={[themed.conditionsCard, sharedRainGlass && styles.sharedConditionsCard]}
        >
          <Text accessibilityRole="header" style={themed.conditionsTitle}>Current conditions</Text>
        <View style={styles.environmentRow}>
          <EnvironmentalMetricCard
            type="heat"
            dark={theme.dark}
            value={
              temperatureDisplay
            }
            status={
              heatStatus
            }
            description={
              temperatureAvailable
                ? hasLocationAccess &&
                  !isOutsideServiceArea
                  ? "Live nearby temperature"
                  : "Live Melbourne CBD temperature"
                : "Temperature information unavailable"
            }
            isUnavailable={
              !temperatureAvailable
            }
          />

          <View style={themed.metricDivider} />
          <EnvironmentalMetricCard
            type="uv"
            dark={theme.dark}
            value={uvDisplay}
            status={uvStatus}
            description={
              uvAvailable
                ? "Current Melbourne UV index"
                : "UV information unavailable"
            }
            isUnavailable={
              !uvAvailable
            }
          />
        </View>
          <AlertCard content={alertContent} dark={theme.dark} />
        </ConditionsSurface>
        <Text accessibilityRole="header" style={themed.exploreTitle}>Explore</Text>
        {[
          { route: "HeatAwareActivityPlanner", title: "Plan your activities", description: "Check heat and UV before you go.", icon: "calendar-outline", color: "#086048", background: "#CFEDDD" },
          { route: "NearbyCooling", title: "Find shade & water", description: "Explore nearby cooling options.", icon: "location-outline", color: "#086699", background: "#CDEBFA" },
          { route: "HeatSmartLearning", title: "Learn to stay safe", description: "Try short lessons and quizzes.", icon: "book-outline", color: "#796006", background: "#F8EDB9" },
        ].map((feature) => (
          <TouchableOpacity key={feature.route} accessibilityRole="button" accessibilityLabel={feature.title} accessibilityHint={feature.description} activeOpacity={0.8} onPress={() => navigation.navigate(feature.route)} style={styles.featureButton}>
            <GlassSurface dark={theme.dark} style={themed.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: theme.color(feature.background, "backgroundColor") }]}><Ionicons name={feature.icon} size={28} color={theme.color(feature.color)} /></View>
              <View style={styles.featureText}>
                <Text style={themed.featureTitle}>{feature.title}</Text>
                <Text style={themed.featureDescription}>{feature.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.color("#38616C")} />
            </GlassSurface>
          </TouchableOpacity>
        ))}
        {__DEV__ && (
        <>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Weather preview" onPress={() => { setShowWeatherPreview(!showWeatherPreview); if (showWeatherPreview) setWeatherPreview(null); }} style={{ minHeight: 48, justifyContent: "center" }}>
            <Text style={{ color: theme.colors.muted }}>Weather preview {showWeatherPreview ? "−" : "+"}</Text>
          </TouchableOpacity>
          {showWeatherPreview && <View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[[null, "Auto"], ["sun", "Sunny"], ["cloud", "Cloudy"], ["rain", "Rain"], ["night", "Night"]].map(([value, label]) => (
                <TouchableOpacity key={label} accessibilityRole="button" accessibilityLabel={`Preview ${label}`} accessibilityState={{ selected: weatherPreview === value }} onPress={() => setWeatherPreview(value)} style={{ minHeight: 48, paddingHorizontal: 12, justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: weatherPreview === value ? theme.colors.surface : "transparent" }}>
                  <Text style={{ color: theme.colors.text }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[themed.weatherSource, { color: theme.colors.muted, marginTop: 8 }]}>Preview changes the background only. Live readings stay unchanged. Close to return to Auto.</Text>
            <Text style={[themed.weatherSource, { color: theme.colors.muted }]}>{weatherRenderError ? `Rendering failed: ${weatherRenderError}` : `Weather: ${liveScene} · ${observation?.isLocationBased ? "Local forecast" : "Melbourne CBD forecast"}`}</Text>
          </View>}
        </>
        )}
      </ScrollView>
    </View>
  );
}

/* =============================
   STYLES
============================= */

const styles =
  StyleSheet.create({
    screen: {
      alignSelf: "center",
      backgroundColor: "#DDF2F0",
      flex: 1,
      maxWidth: Platform.OS === "web" ? 430 : undefined,
      overflow: "hidden",
      width: "100%",
    },

    foreground: {
      ...StyleSheet.absoluteFill,
      zIndex: 1,
      backgroundColor: "transparent",
    },

    page: {
      flexGrow: 1,
      width: "100%",
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 132,
    },

    header: { alignItems: "flex-start", justifyContent: "center", minHeight: 64 },
    brandLogo: { width: 260, maxWidth: "100%", height: 64 },
    welcome: { color: "#143F3B", fontSize: 19, lineHeight: 26, marginTop: 4 },
    locationRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, marginBottom: 12 },
    locationText: { color: "#315E67", fontSize: 15, flexShrink: 1 },
    conditionsCard: { borderRadius: 24, padding: 16 },
    sharedConditionsCard: { backgroundColor: "transparent", borderColor: "rgba(255,255,255,.52)", borderWidth: StyleSheet.hairlineWidth },
    weatherSource: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
    conditionsTitle: { color: "#103C36", fontSize: 17, fontWeight: "700", marginBottom: 14 },
    metricDivider: { width: 1, backgroundColor: "rgba(68,117,129,0.22)", marginVertical: 6 },
    exploreTitle: { color: "#103C36", fontSize: 23, fontWeight: "700", marginTop: 20, marginBottom: 10 },
    featureButton: { marginBottom: 8 },
    featureCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 22, minHeight: 76 },
    featureIcon: { width: 50, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    featureText: { flex: 1 },
    featureTitle: { color: "#123B36", fontSize: 16, lineHeight: 21, fontWeight: "700" },
    featureDescription: { color: "#3B6068", fontSize: 14, lineHeight: 19, marginTop: 3 },

    locationNotice: {
      alignItems: "flex-start",
      backgroundColor: "rgba(255, 247, 226, 0.92)",
      borderColor: "rgba(160, 90, 0, 0.24)",
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: 6,
      marginBottom: 12,
      padding: 10,
    },

    locationNoticeText: {
      color: "#754107",
      flex: 1,
      fontSize: 11,
      lineHeight: 15,
    },

    /* ENVIRONMENT */

    environmentRow: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 12,
    },

  });