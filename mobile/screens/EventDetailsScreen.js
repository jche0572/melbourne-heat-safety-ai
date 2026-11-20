import { useThemedStyles } from "../theme/useAppTheme";
import React, {
  useCallback,
  useState,
  useRef,
} from "react";

import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import {
  useFocusEffect,
} from "@react-navigation/native";

import {
  changeEventToRecommendedTime,
  deleteEvent,
  getStoredEvents,
} from "../services/eventStorageService";

import { getSavedActivityRecommendation } from "../services/activityRecommendationService";
import ActivityRecommendationContent
  from "../components/ActivityRecommendationContent";
import RecommendedTimeConfirmation from "../components/RecommendedTimeConfirmation";

function formatEventTime(value) {
  if (!value || /AM|PM/i.test(value)) return value || "Time not set";

  const match = String(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;

  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
}

function getEventIconName(title) {
  const value = String(title || "").toLowerCase();
  if (/walk|run|jog|hike/.test(value)) return "walk-outline";
  if (/lunch|dinner|breakfast|meal|eat|food/.test(value)) return "restaurant-outline";
  if (/park|garden|shade|tree/.test(value)) return "leaf-outline";
  return "calendar-outline";
}

function getStatusTone(category) {
  const value = String(category || "").toLowerCase();

  if (/extreme|very high|high/.test(value)) {
    return { backgroundColor: "#FFE0DE", color: "#D92D20" };
  }
  if (/moderate/.test(value)) {
    return { backgroundColor: "#FFF0CC", color: "#B45309" };
  }

  return { backgroundColor: "#E1F4E8", color: "#147A50" };
}

function formatCategory(category) {
  const value = String(category || "").toLowerCase();
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : "";
}

export default function EventDetailsScreen({ navigation, route }) {
  const { styles, theme } = useThemedStyles(baseStyles);
  const [ event, setEvent ] = useState(() => {
    const eventId = (route.params?.eventId ?? route.params?.event?.id);
    const allEvents = getStoredEvents();

    return (
      allEvents.find(
        (item) =>
          item.id === eventId
      ) ?? null
    );
  });

  const [recommendation, setRecommendation] = useState(event?.activityRecommendation ?? null);
  const [loading, setLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState("");
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [confirmationError, setConfirmationError] = useState("");
  /*
  * Controls the popup shown after
  * an existing event is edited.
  */
  const [
    recommendationModalVisible,
    setRecommendationModalVisible,
  ] = useState(false);

  /*
  * Prevent the same edit/save action
  * from opening the popup more than once.
  */
  const handledRecommendationRefreshKey =
    useRef(null);
  const persistedEvent = useRef(event);
  const requestVersion = useRef(0);
  const requestBusy = useRef(false);
  const loadRecommendation = useCallback(async () => {
    const eventId = persistedEvent.current?.id;
    if (!eventId || requestBusy.current) return;
    const version = ++requestVersion.current;
    requestBusy.current = true;
    setLoading(true);
    setRecommendationError("");
    try {
      const result = await getSavedActivityRecommendation(eventId);
      if (version === requestVersion.current) setRecommendation(result);
    } catch (_error) {
      if (version === requestVersion.current) setRecommendationError("Recommendation unavailable or could not be saved. Your activity is still saved. Please try again.");
    } finally {
      if (version === requestVersion.current) { setLoading(false); requestBusy.current = false; }
    }
  }, []);

  /*
  * Reload the event whenever this screen
  * becomes active again.
  *
  * This is important after:
  *
  * Event Details
  * -> Edit
  * -> Event Planner
  * -> Save
  * -> back here
  */
  useFocusEffect(
    useCallback(
      () => {
        const eventId =
          (
            route.params?.eventId ??
            route.params?.event?.id
          );

        const recommendationRefreshKey =
          route.params?.recommendationRefreshKey;

        const allEvents =
          getStoredEvents();
        const foundEvent =
          allEvents.find(
            (item) =>
              item.id === eventId
          );

        persistedEvent.current =
          foundEvent ?? null;

        setEvent(
          foundEvent ?? null
        );

        setRecommendation(
          foundEvent?.activityRecommendation ??
            null
        );

        setLoading(false);
        setRecommendationError("");

        /*
        * If we have returned from editing this event,
        * automatically open the fresh recommendation popup.
        */
        if (
          recommendationRefreshKey &&
          handledRecommendationRefreshKey.current !==
            recommendationRefreshKey
        ) {
          handledRecommendationRefreshKey.current =
            recommendationRefreshKey;

          setRecommendationModalVisible(
            true
          );
        }

        /*
        * Event Details no longer waits for the
        * user to press "View recommendation".
        *
        * If there is no saved recommendation yet,
        * automatically request it.
        */
        if (
          foundEvent &&
          !foundEvent.activityRecommendation
        ) {
          loadRecommendation();
        }
        return () => {
          requestVersion.current += 1;
          requestBusy.current = false;
        };
      },
      [
        (
          route.params?.eventId ??
          route.params?.event?.id
        ),
        route.params?.recommendationRefreshKey,
        loadRecommendation,
      ]
    )
  );

  const closeRecommendationModal =
    () => {
      setRecommendationModalVisible(
        false
      );

      /*
      * Remove the navigation trigger so
      * the popup will not reopen later.
      */
      navigation.setParams({
        recommendationRefreshKey: null,
      });
    };

  const handleChangeToRecommendedTime = () => {
    if (
      !event?.id ||
      !recommendation?.alternativeTimeRecommended ||
      !recommendation.suggestedAlternativeTime ||
      loading
    ) return;

    setConfirmationError("");
    setConfirmationVisible(true);
  };

  const confirmRecommendedTime = () => {
    try {
      const updated = changeEventToRecommendedTime(
        event.id,
        recommendation.suggestedAlternativeTime
      );
      persistedEvent.current = updated;
      setEvent(updated);
      setRecommendation(null);
      setConfirmationVisible(false);
      loadRecommendation();
    } catch (error) {
      console.error("Failed to change to recommended time:", error);
      setConfirmationError(error.message || "Unable to change the activity time.");
    }
  };

  /*
  * Edit button:
  *
  * open your Event Planner and pass
  * the previous saved information.
  */
  const handleEdit =
    () => {
      if (!event) {
        return;
      }

      navigation.navigate(
        "EventPlanner",
        {
          eventId: event.id,
          title: event.title ?? "",
          location: event.location ?? "",
          latitude: event.latitude ?? null,
          longitude: event.longitude ?? null,
          description: event.description ?? "",
          startDate: event.startDate,
          startTime: event.startTime,
          endDate: event.endDate,
          endTime: event.endTime,
        }
      );
    };

  const deleteCurrentEvent = () => {
    try {
      deleteEvent(event.id);
      navigation.goBack();
    } catch (error) {
      console.error("Failed to delete event:", error);

      if (Platform.OS === "web") {
        window.alert("Unable to delete this event.");
      } else {
        Alert.alert("Unable to delete this event.");
      }
    }
  };

  const handleDelete = () => {
    if (!event?.id) {
      return;
    }

    const eventName = event.title || "this event";

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        `Delete "${eventName}"?\n\nThis event will be permanently removed from this browser.`
      );

      if (confirmed) {
        deleteCurrentEvent();
      }
      return;
    }

    Alert.alert(
      `Delete "${eventName}"?`,
      "This event will be permanently removed from this device.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: deleteCurrentEvent },
      ]
    );
  };

  if (!event) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.headerButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons
                name="chevron-back"
                size={30}
                color={theme.color("#222222")}
              />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>
              Event Details
            </Text>

            <View style={styles.headerButton}/>
          </View>

          <View style={styles.emptyContainer}>
            <Ionicons
              name="calendar-outline"
              size={42}
              color={theme.color("#6E6E73")}
            />

            <Text style={styles.emptyTitle}>
              Event not found
            </Text>

            <Text style={styles.emptyText}>
              This event is no longer stored on this device.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const summary = loading
    ? "Preparing forecast guidance…"
    : recommendationError
      ? "Recommendation unavailable. Your event is still saved."
      : recommendation?.shortRecommendation ||
        recommendation?.recommendation?.recommendation ||
        "Recommendation will appear when the forecast is ready.";

  const environment = recommendation?.environmentSummary;
  const heatTone = getStatusTone(environment?.heatCategory);
  const uvTone = getStatusTone(environment?.uvCategory);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>

          {/* BACK BUTTON */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons
              name="chevron-back"
              size={30}
              color={theme.color("#222222")}
            />
          </TouchableOpacity>

          {/* TITLE */}
          <Text
            accessibilityRole="header"
            style={styles.headerTitle}
          >
            Event Details
          </Text>

          {/* EDIT BUTTON */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Edit event"
            style={styles.headerButton}
            onPress={handleEdit}
          >
            <Text style={styles.action}>
              Edit
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <Ionicons
                name={getEventIconName(event.title)}
                size={40}
                color={theme.color("#147A50")}
              />
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.eventTitle} numberOfLines={2}>
                {event.title || "Untitled event"}
              </Text>
              <Text style={styles.summaryRecommendation}>
                {summary}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={24} color={theme.color("#173C31")} />
              <Text style={styles.infoValue}>
                {event.location || "Location not set"}
              </Text>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={24} color={theme.color("#173C31")} />
              <View style={styles.infoText}>
                <Text style={styles.infoValue}>
                  {formatEventTime(event.startTimeDisplay || event.startTime)}
                  {" – "}
                  {formatEventTime(event.endTimeDisplay || event.endTime)}
                </Text>
                <Text style={styles.note}>
                  {event.startDateDisplay || event.startDate || "Date not set"}
                </Text>
              </View>
            </View>

            {!!event.description && (
              <>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <Ionicons name="document-text-outline" size={24} color={theme.color("#173C31")} />
                  <Text style={styles.infoValue}>{event.description}</Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.forecastCard}>
            <Text style={styles.forecastTitle}>Forecast conditions</Text>

            {environment ? (
              <View style={styles.forecastMetrics}>
                <View style={styles.forecastMetric}>
                  <Ionicons name="thermometer-outline" size={38} color={theme.color("#F08A00")} />
                  <View style={styles.forecastMetricText}>
                    <Text style={styles.forecastLabel}>Heat</Text>
                    <Text style={styles.forecastValue}>
                      {Number.isFinite(environment.peakTemperatureC)
                        ? `${environment.peakTemperatureC}°C`
                        : "Unavailable"}
                    </Text>
                    {!!environment.heatCategory && (
                      <View style={[styles.statusChip, { backgroundColor: theme.color(heatTone.backgroundColor, 'backgroundColor') }]}>
                        <Text style={[styles.statusText, { color: theme.color(heatTone.color, 'color') }]}>
                          {formatCategory(environment.heatCategory)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.forecastMetricDivider} />

                <View style={styles.forecastMetric}>
                  <Ionicons name="sunny-outline" size={38} color={theme.color("#F08A00")} />
                  <View style={styles.forecastMetricText}>
                    <Text style={styles.forecastLabel}>UV</Text>
                    <Text style={styles.forecastValue}>
                      {Number.isFinite(environment.peakUvIndex)
                        ? environment.peakUvIndex
                        : "Unavailable"}
                    </Text>
                    {!!environment.uvCategory && (
                      <View style={[styles.statusChip, { backgroundColor: theme.color(uvTone.backgroundColor, 'backgroundColor') }]}>
                        <Text style={[styles.statusText, { color: theme.color(uvTone.color, 'color') }]}>
                          {formatCategory(environment.uvCategory)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ) : (
              <Text style={styles.note}>Forecast summary unavailable</Text>
            )}
          </View>

          {/* ACTIVITY RECOMMENDATION */}
          <View style={styles.recommendationSection}>
            <ActivityRecommendationContent
              recommendation={recommendation}
              loading={loading}
              error={recommendationError}
              onRetry={loadRecommendation}
              showSavedNote={true}
              enableSpeech={true}
              showOverview={false}
              acceptedRecommendedTime={event.acceptedRecommendedTime}
              onChangeToRecommendedTime={handleChangeToRecommendedTime}
            />
          </View>
          {/* DELETE EVENT */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Delete event"
            style={styles.deleteButton}
            activeOpacity={0.7}
            onPress={handleDelete}
          >
            <Text style={styles.deleteButtonText}>
              Delete Event
            </Text>
          </TouchableOpacity>
        </ScrollView>


        {/* =====================================================
            UPDATED AI RECOMMENDATION POPUP
        ===================================================== */}

        <Modal
          visible={
            recommendationModalVisible
          }
          transparent
          animationType="fade"
          onRequestClose={confirmationVisible
            ? () => setConfirmationVisible(false)
            : closeRecommendationModal}
        >
          <View
            style={styles.modalBackdrop}
          >
            <View
              style={styles.modalCard}
            >
              {confirmationVisible ? (
                <RecommendedTimeConfirmation
                  error={confirmationError}
                  onCancel={() => setConfirmationVisible(false)}
                  onConfirm={confirmRecommendedTime}
                />
              ) : (
                <>
              {/* HEADER */}
              <View
                style={styles.modalHeader}
              >
                <Text
                  accessibilityRole="header"
                  style={styles.modalTitle}
                >
                  Updated Activity Recommendation
                </Text>
              </View>


              {/* RECOMMENDATION */}
              <ScrollView
                contentContainerStyle={
                  styles.modalContent
                }
              >
                <ActivityRecommendationContent
                  recommendation={
                    recommendation
                  }
                  loading={
                    loading
                  }
                  error={
                    recommendationError
                  }
                  onRetry={
                    loadRecommendation
                  }
                  acceptedRecommendedTime={event.acceptedRecommendedTime}
                  onChangeToRecommendedTime={handleChangeToRecommendedTime}
                />
              </ScrollView>


              {/* BOTTOM BUTTON */}
              <View
                style={styles.modalFooter}
              >
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="I understand"
                  style={
                    styles.understandButton
                  }
                  onPress={
                    closeRecommendationModal
                  }
                >
                  <Text
                    style={
                      styles.understandButtonText
                    }
                  >
                    I Understand
                  </Text>
                </TouchableOpacity>
              </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        <Modal
          visible={confirmationVisible && !recommendationModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setConfirmationVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <RecommendedTimeConfirmation
              error={confirmationError}
              onCancel={() => setConfirmationVisible(false)}
              onConfirm={confirmRecommendedTime}
            />
          </View>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#EEF2F0", alignItems: "center" },
  container: { flex: 1, width: "100%", maxWidth: 430, backgroundColor: "#F5F8F6" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    minHeight: 68,
    backgroundColor: "#F5F8F6",
    borderBottomWidth: 1,
    borderBottomColor: "#E1E9E5",
  },
  headerButton: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "800", color: "#173C31", textAlign: "center" },
  action: { color: "#39775F", fontSize: 16, fontWeight: "700" },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 126, gap: 16 },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#CFEBDD",
    backgroundColor: "#E7F7EC",
  },
  summaryIcon: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.62)",
  },
  summaryText: { flex: 1, minWidth: 0, marginLeft: 14 },
  summaryRecommendation: { marginTop: 4, fontSize: 14, lineHeight: 20, color: "#3F5B51" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E0E9E4",
    shadowColor: "#173C31",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  deleteButton: {
    minHeight: 54,
    marginTop: 4,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7DDD9",
    cursor: "pointer",
  },

  deleteButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#D83B2D",
  },
  eventTitle: { fontSize: 23, lineHeight: 30, fontWeight: "800", color: "#173C31" },
  note: { fontSize: 14, lineHeight: 21, color: "#666666" },
  infoRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 12 },
  infoText: { flex: 1, minWidth: 0 },
  infoLabel: { marginBottom: 2, fontSize: 13, fontWeight: "600", color: "#6B7D75" },
  infoValue: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: "600", color: "#173C31" },
  infoDivider: { height: 1, backgroundColor: "#E5ECE8", marginLeft: 36 },
  forecastCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E0E9E4",
    backgroundColor: "#FFFFFF",
  },
  forecastTitle: { marginBottom: 12, fontSize: 17, fontWeight: "800", color: "#173C31" },
  forecastMetrics: { flexDirection: "row", alignItems: "stretch" },
  forecastMetric: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  forecastMetricText: { flex: 1, minWidth: 0, alignItems: "flex-start" },
  forecastMetricDivider: { width: 1, marginHorizontal: 12, backgroundColor: "#DFE7E3" },
  forecastLabel: { fontSize: 14, lineHeight: 18, fontWeight: "700", color: "#173C31" },
  forecastValue: { marginTop: 1, fontSize: 22, lineHeight: 27, fontWeight: "800", color: "#111827" },
  statusChip: { marginTop: 5, minHeight: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: "center" },
  statusText: { fontSize: 12, lineHeight: 16, fontWeight: "700", textTransform: "capitalize" },
  recommendationSection: { gap: 8 },
  cancel: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 400, maxHeight: "85%", backgroundColor: "#FFFFFF", borderRadius: 24, overflow: "hidden" },
  modalHeader: { flexDirection: "row", alignItems: "center", paddingLeft: 20, paddingRight: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#DCE5E0" },
  modalTitle: { flex: 1, fontSize: 20, fontWeight: "700", color: "#173C31" },
  modalContent: { padding: 20, gap: 14 },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  emptyTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: "700",
    color: "#173C31",
  },

  emptyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    color: "#666666",
  },

  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#DCE5E0",
    backgroundColor: "#FFFFFF",
  },

  understandButton: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#39775F",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },

  understandButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});