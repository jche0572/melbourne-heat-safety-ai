import { useThemedStyles } from "../theme/useAppTheme";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import localStorage from "../services/deviceStorage";

import { useFocusEffect, } from "@react-navigation/native";

import { getHourlyForecast } from "../services/hourlyForecastService";

import {
  changeEventToRecommendedTime,
  getStoredEvents,
} from "../services/eventStorageService";

import {
  getPendingFeedbackEvents,
} from "../services/feedbackStorageService";

import {
  getSavedActivityRecommendation,
} from "../services/activityRecommendationService";

import ActivityRecommendationContent
  from "../components/ActivityRecommendationContent";
import RecommendedTimeConfirmation from "../components/RecommendedTimeConfirmation";

const AGENDA_CARD_HEIGHT = 104;
const FORECAST_HOURS = [9, 12, 15, 18, 21];

function getEventIconName(title) {
  const value = String(title || "").toLowerCase();

  if (/walk|run|jog|hike/.test(value)) return "walk-outline";
  if (/lunch|dinner|breakfast|meal|eat|food/.test(value)) return "restaurant-outline";
  if (/park|garden|shade|tree/.test(value)) return "leaf-outline";

  return "calendar-outline";
}


function getUvColor(value) {
  if (!Number.isFinite(value)) return "#7A8782";
  if (value < 3) return "#17823B";
  if (value < 6) return "#F59E0B";
  if (value < 8) return "#E53935";
  return "#7E22CE";
}

function getUvCategory(value) {
  if (!Number.isFinite(value)) return "Unavailable";
  if (value < 3) return "Low";
  if (value < 6) return "Moderate";
  if (value < 8) return "High";
  if (value < 11) return "Very high";
  return "Extreme";
}

function getForecastIconName(hour) {
  if (hour === 18) return "partly-sunny";
  if (hour === 21) return "moon";
  return "sunny";
}

const FEEDBACK_REMINDER_STORAGE_KEY =
  "shadeadapt_feedback_reminder_last_shown";

function getMelbourneDateKey() {
  const parts =
    new Intl.DateTimeFormat(
      "en-AU",
      {
        timeZone:
          "Australia/Melbourne",

        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(
      new Date()
    );


  const year =
    parts.find(
      (part) =>
        part.type === "year"
    )?.value;


  const month =
    parts.find(
      (part) =>
        part.type === "month"
    )?.value;


  const day =
    parts.find(
      (part) =>
        part.type === "day"
    )?.value;


  return `${year}-${month}-${day}`;
}

export default function HeatAwareActivityPlannerScreen({
  navigation,
  route,
}) {
  const { styles, theme } = useThemedStyles(baseStyles);
  // 0 = Today, 1 = Tomorrow, 2 = Day After
  const [selectedDay, setSelectedDay] = useState(0);

  // Events actually saved on this browser/device
  const [savedEvents, setSavedEvents] = useState([]);

  // Events that have finished but do not have feedback yet
  const [
    pendingFeedbackEvents,
    setPendingFeedbackEvents,
  ] = useState([]);

  // Controls the feedback reminder popup
  const [
    feedbackReminderVisible,
    setFeedbackReminderVisible,
  ] = useState(false);

  // Controls the automatic AI recommendation popup.
const [
  recommendationModalVisible,
  setRecommendationModalVisible,
] = useState(false);

const [
  recommendationEvent,
  setRecommendationEvent,
] = useState(null);

const [
  recommendation,
  setRecommendation,
] = useState(null);

const [
  recommendationLoading,
  setRecommendationLoading,
] = useState(false);

const [
  recommendationError,
  setRecommendationError,
] = useState("");

const [confirmationVisible, setConfirmationVisible] = useState(false);
const [confirmationError, setConfirmationError] = useState("");

// Remembers which save action has already opened the popup.
const handledRecommendationPopupKey =
  useRef(null);

  // Store the hourly forecast returned by the backend
  const [forecastData, setForecastData] = useState([]);

  const days = [
    {
      label: "Today",
      date: new Date()
    },
    {
      label: "Tomorrow",
      date: new Date()
    },
    {
      label: "Day After",
      date: new Date()
    }
  ];

  // Move the second date forward by 1 day
  days[1].date.setDate(days[1].date.getDate() + 1);

  // Move the third date forward by 2 days
  days[2].date.setDate(days[2].date.getDate() + 2);

  // Change 0-24 into normal AM/PM time
  // Small helper function to format the hour, so an arrow function keeps it simple
  const formatHour = (hour) => {
    if (hour === 0 || hour === 24) {
      return "12 AM";
    }

    if (hour === 12) {
      return "12 PM";
    }

    if (hour > 12) {
      return `${hour - 12} PM`;
    }

    return `${hour} AM`; // backticks ` ` allow us to put a JavaScript value
  };

  // Change a Date object into YYYY-MM-DD for the backend API
  const formatDateForApi = (date) => {
    const year = date.getFullYear();

    const month = String(date.getMonth() + 1).padStart(2, "0");

    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  /* =========================================================
    CURRENT SELECTED DATE

    Example:
    2026-09-13
  ========================================================= */

  const selectedDateKey =
    formatDateForApi(
      days[selectedDay].date
    );


  /* =========================================================
    LOAD SAVED EVENTS

    This runs every time the user returns to this screen.

    Example:
    Event Planner
        ↓
    Save event
        ↓
    go back
        ↓
    planner automatically reloads localStorage
  ========================================================= */

  useFocusEffect(
    useCallback(
      () => {
        /* -----------------------------------------
          Reload saved planner events
        ----------------------------------------- */

        const events =
          getStoredEvents();

        setSavedEvents(
          events
        );


        /* -----------------------------------------
          Check whether any completed events
          are waiting for feedback
        ----------------------------------------- */

        const pendingFeedback =
          getPendingFeedbackEvents();

        setPendingFeedbackEvents(
          pendingFeedback
        );


        /* -----------------------------------------
          DAILY FEEDBACK REMINDER

          Show the reminder only once per
          Melbourne calendar day.

          Important:
          The Feedback button and badge still
          remain available all day.
        ----------------------------------------- */

        if (
          pendingFeedback.length > 0
        ) {
          const today =
            getMelbourneDateKey();


          const lastReminderDate =
            localStorage.getItem(
              FEEDBACK_REMINDER_STORAGE_KEY
            );


          /*
          * The reminder has NOT been shown today.
          */
          if (
            lastReminderDate !== today
          ) {
            setFeedbackReminderVisible(
              true
            );


            /*
            * Record today's date immediately so
            * returning to this screen later today
            * does not show the reminder again.
            */
            localStorage.setItem(
              FEEDBACK_REMINDER_STORAGE_KEY,
              today
            );
          }
          else {
            /*
            * Pending feedback still exists,
            * but today's reminder was already shown.
            */
            setFeedbackReminderVisible(
              false
            );
          }
        }
        else {
          /*
          * There is no unanswered feedback.
          */
          setFeedbackReminderVisible(
            false
          );
        }
      },
      []
    )
  );

  /* =========================================================
    AUTOMATIC AI RECOMMENDATION POPUP
  ========================================================= */

  const showRecommendationForSavedEvent =
    useCallback(
      async (eventId) => {
        const storedEvent =
          getStoredEvents().find(
            (event) =>
              event.id === eventId
          );

        setRecommendationEvent(
          storedEvent ?? null
        );

        setRecommendation(
          storedEvent?.activityRecommendation ??
            null
        );

        setRecommendationError("");
        setRecommendationLoading(false);

        // Open the popup immediately.
        setRecommendationModalVisible(true);


        // Event could not be found.
        if (!storedEvent) {
          setRecommendationError(
            "The saved event could not be found."
          );

          return;
        }


        /*
        * If this event already has a saved recommendation,
        * display it immediately without another API request.
        */
        if (
          storedEvent.activityRecommendation
        ) {
          return;
        }


        // Otherwise generate and save the recommendation.
        setRecommendationLoading(true);

        try {
          const result =
            await getSavedActivityRecommendation(
              eventId
            );

          setRecommendation(result);

          /*
          * Reload the local event list because
          * getSavedActivityRecommendation saves
          * the recommendation into the event.
          */
          setSavedEvents(
            getStoredEvents()
          );
        }
        catch (error) {
          console.error(
            "Failed to load activity recommendation:",
            error
          );

          setRecommendationError(
            "Recommendation unavailable or could not be saved. Your activity is still saved. Please try again."
          );
        }
        finally {
          setRecommendationLoading(false);
        }
      },
      []
    );


  /*
  * Watch for the event ID passed by EventPlannerScreen.
  *
  * When Save Event sends us back here,
  * automatically open the recommendation.
  */
  useEffect(
    () => {
      const eventId =
        route.params?.recommendationEventId;

      const popupKey =
        route.params?.recommendationPopupKey;

      // Nothing new to display.
      if (
        !eventId ||
        !popupKey
      ) {
        return;
      }

      /*
      * Prevent the same navigation params from
      * reopening the popup every time this screen renders.
      */
      if (
        handledRecommendationPopupKey.current ===
        popupKey
      ) {
        return;
      }

      handledRecommendationPopupKey.current =
        popupKey;

      showRecommendationForSavedEvent(
        eventId
      );
    },
    [
      route.params?.recommendationEventId,
      route.params?.recommendationPopupKey,
      showRecommendationForSavedEvent,
    ]
  );


  const closeRecommendationModal =
    () => {
      setRecommendationModalVisible(
        false
      );

      /*
      * Clear the navigation instruction after
      * the user acknowledges the recommendation.
      */
      navigation.setParams({
        recommendationEventId: null,
        recommendationPopupKey: null,
      });
    };

  const handleChangeToRecommendedTime = () => {
    if (
      !recommendationEvent?.id ||
      !recommendation?.alternativeTimeRecommended ||
      !recommendation.suggestedAlternativeTime ||
      recommendationLoading
    ) return;

    setConfirmationError("");
    setConfirmationVisible(true);
  };

  const confirmRecommendedTime = () => {
    try {
      const updated = changeEventToRecommendedTime(
        recommendationEvent.id,
        recommendation.suggestedAlternativeTime
      );
      setSavedEvents(getStoredEvents());
      setConfirmationVisible(false);
      showRecommendationForSavedEvent(updated.id);
    } catch (error) {
      console.error("Failed to change to recommended time:", error);
      setConfirmationError(error.message || "Unable to change the activity time.");
    }
  };

  // Load new forecast data whenever the user changes the day
  // useEffect means letting react to run this code when [selectedDay] change
  useEffect(() => {
    const loadForecast = async () => {
      try {
        // Start from today's date
        const selectedDate = new Date();

        // Move forward based on the selected day: 0, 1 or 2
        selectedDate.setDate(selectedDate.getDate() + selectedDay);

        const apiDate = formatDateForApi(selectedDate);

        const data = await getHourlyForecast(apiDate);

        setForecastData(data.forecast || []);
      } catch (error) {
        console.error("Failed to load hourly forecast:", error);

        setForecastData([]);
      }
    };

    loadForecast();
  }, [selectedDay]);

  const getHeatValue = (hour) => {
    const forecast = forecastData[hour];

    if (!forecast || !Number.isFinite(forecast.temperature_c)) {
      return "--";
    }

    return `${Math.round(forecast.temperature_c)}°C`;
  };

  const getUvValue = (hour) => {
    const forecast = forecastData[hour];

    if (!forecast || !Number.isFinite(forecast.uv_index)) {
      return "--";
    }

    return forecast.uv_index.toFixed(1);
  };

  const getUvNumber = (hour) => {
    const value = forecastData[hour]?.uv_index;
    return Number.isFinite(value) ? value : null;
  };

  /* =========================================================
    SAVED EVENT HELPERS
  ========================================================= */

  /*
  * Convert stored 24-hour time:
  * "15:05"
  * into:
  * "3:05 PM"
  */
  const formatStoredTime =
    (value) => {

      if (!value) {
        return "Time not set";
      }

      /*
      * If it is already formatted,
      * just return it.
      */
      if (
        /AM|PM/i.test(value)
      ) {
        return value;
      }

      const match =
        String(value).match(
          /^(\d{1,2}):(\d{2})$/
        );

      if (!match) {
        return value;
      }

      const hour24 = Number(match[1]);

      const minute = match[2];


      const period =
        hour24 >= 12
          ? "PM"
          : "AM";

      const hour12 =
        hour24 % 12 || 12;

      return (
        `${hour12}:` +
        `${minute} ` +
        `${period}`
      );
    };

  const getTimeMinutes =
    (value) => {
      const match =
        String(value ?? "").match(
          /^(\d{2}):(\d{2})$/
        );

      if (!match) {
        return null;
      }

      const hour = Number(match[1]);
      const minute = Number(match[2]);

      if (
        hour > 23 ||
        minute > 59
      ) {
        return null;
      }

      return hour * 60 + minute;
    };

  /* =========================================================
    DISPLAY EVENT TIME RANGE
  ========================================================= */
  const formatSavedEventRange =
    (event) => {
      const startTime =
        event.startTimeDisplay ||
        formatStoredTime(
          event.startTime
        );

      const endTime =
        event.endTimeDisplay ||
        formatStoredTime(
          event.endTime
        );

      return (
        `${startTime} - ${endTime}`
      );
    };

  const getTimelineEvents = (dateKey) =>
    savedEvents
      .map((event) => {
        const startMinutes =
          getTimeMinutes(event.startTime);
        const endMinutes =
          getTimeMinutes(event.endTime);

        if (
          event.startDate !== dateKey ||
          event.endDate !== event.startDate ||
          startMinutes === null ||
          endMinutes === null ||
          endMinutes <= startMinutes
        ) {
          return null;
        }

        return {
          event,
          startMinutes,
          endMinutes,
        };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          a.startMinutes - b.startMinutes
      );

  const timelineEvents =
    getTimelineEvents(selectedDateKey);
  const hasTimelineEvents = timelineEvents.length > 0;
  const tomorrowTimelineEvents =
    selectedDay === 0 && !hasTimelineEvents
      ? getTimelineEvents(formatDateForApi(days[1].date))
      : [];

  /* =========================================================
    + ADD EVENT

    No temporary popup anymore.

    Go directly to your EventPlannerScreen.
  ========================================================= */
  const handleAddEvent =
    () => {
      navigation.navigate(
        "EventPlanner",
        {
          /*
          * Pass the day currently selected
          * in the Heat-Aware Planner.
          */
          date:
            selectedDateKey,

          startDate:
            selectedDateKey,

          endDate:
            selectedDateKey,
        }
      );
    };

  return (
    /* Outer web background */
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      {/* Keep the web app at a phone-like width */}
      <View style={styles.mobileContainer}>
				{/* Header */}
			  <View style={styles.header}>
			    <Text
            accessibilityRole="header"
            style={styles.headerTitle}
          >
			      Heat-Aware Activity Planner
			    </Text>

			    <TouchableOpacity
            style={[
              styles.feedbackButton,

              pendingFeedbackEvents.length > 0 &&
                styles.feedbackButtonHighlighted,
            ]}
            onPress={() =>
              navigation.navigate(
                "FeedbackFormList"
              )
            }
            accessibilityRole="button"
            accessibilityLabel="Open Feedback Form List"
          >
            <Ionicons
              name="list-outline"
              size={28}
              color={theme.color(pendingFeedbackEvents.length > 0
                  ? "#FFFFFF"
                  : "#222222")}
            />

            {pendingFeedbackEvents.length > 0 && (
              <View style={styles.feedbackBadge}>
                <Text style={styles.feedbackBadgeText}>
                  {pendingFeedbackEvents.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>

			  </View>


        {/* =====================================================
            FEEDBACK REMINDER OVERLAY
        ===================================================== */}

        {feedbackReminderVisible && (
          <View style={styles.feedbackReminderLayer}>

            {/* Dim the planner underneath */}
            <View style={styles.feedbackDimBackground} />


            {/* Reminder box */}
            <View style={styles.feedbackReminderCard}>

              <View style={styles.feedbackReminderIcon}>
                <Ionicons
                  name="chatbox-ellipses-outline"
                  size={32}
                  color={theme.color("#39775F")}
                />
              </View>


              <Text style={styles.feedbackReminderTitle}>
                Feedback Reminder
              </Text>


              <Text style={styles.feedbackReminderText}>
                Feedback is available for a completed activity.
              </Text>


              <Text style={styles.feedbackReminderInstruction}>
                Select the highlighted Feedback button above to view your feedback forms.
              </Text>

            </View>

          </View>
        )}


        {/* Planner content  */}
        <View style={styles.topContent}>

          {/* Date selection */}
          <View style={styles.dateSection}>
            <Text style={styles.sectionTitle}>Plan your day</Text>

            <View style={styles.dateSelector}>
              {/* Create one date button for each day in the days array stated above */}
              {days.map((day, index) => (
                <TouchableOpacity
                  key={day.label}
                  accessibilityRole="button"
                  accessibilityLabel={`${day.label}, ${day.date.toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "long",
                  })}`}
                  accessibilityState={{ selected: selectedDay === index }}
                  style={[
                    styles.dateButton,

                    selectedDay === index && styles.dateButtonSelected
                  ]}
                  onPress={() => setSelectedDay(index)}
                >
                  <Text
                    style={[
                      styles.dateButtonLabel,

                      selectedDay === index && styles.dateButtonLabelSelected
                    ]}
                  >
                    {day.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.selectedDayText}>
              {days[selectedDay].date.toLocaleDateString("en-AU", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              }).replace(",", "")}
            </Text>
          </View>

          <View style={styles.forecastTable}>
            <View style={styles.forecastLabels}>
              <View style={styles.forecastLabelSpacer} />
              <Text style={styles.forecastRowLabel}>Heat (°C)</Text>
              <Text style={styles.forecastRowLabel}>UV Index</Text>
            </View>

            {FORECAST_HOURS.map((hour) => {
              const uv = getUvNumber(hour);

              return (
                <View
                  key={`forecast-${hour}`}
                  style={styles.forecastColumn}
                  accessibilityLabel={`${formatHour(hour)}, temperature ${getHeatValue(hour)}, UV ${getUvValue(hour)}, ${getUvCategory(uv)}`}
                >
                  <Text style={styles.forecastHourLabel}>
                    {formatHour(hour).replace(" ", "").toLowerCase()}
                  </Text>
                  <View style={styles.forecastIconSlot}>
                    <Ionicons
                      name={getForecastIconName(hour)}
                      size={hour === 21 ? 30 : 32}
                      color={theme.color(hour === 21 ? "#667085" : "#FF8A00")}
                    />
                  </View>
                  <Text style={styles.forecastTemperature}>
                    {getHeatValue(hour).replace("C", "")}
                  </Text>
                  <Text
                    style={[
                      styles.forecastUv,
                      { color: theme.color(getUvColor(uv), 'color') },
                    ]}
                  >
                    {getUvValue(hour)}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Planner header */}
          <View style={styles.plannerHeader}>
            <Text style={styles.timelineTitle}>Your schedule</Text>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Add event"
              style={styles.addEventButton}
              onPress={handleAddEvent}
            >
              <Ionicons name="add" size={18} color={theme.color("#147A50")} />
              <Text style={styles.addEventText}>Add Event</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Schedule agenda */}
        <ScrollView
          style={styles.timeline}
          contentContainerStyle={styles.timelineContent}
          showsVerticalScrollIndicator={true}
        >
          {!hasTimelineEvents ? (
            <>
              <View style={styles.emptyScheduleCard}>
                <View style={styles.emptyScheduleIcon}>
                  <Ionicons
                    name="calendar-outline"
                    size={34}
                    color={theme.color("#147A50")}
                  />
                  <View style={styles.emptyScheduleCheck}>
                    <Ionicons name="checkmark" size={13} color={theme.color("#FFFFFF")} />
                  </View>
                </View>

                <View style={styles.emptyScheduleText}>
                  <Text style={styles.emptyScheduleTitle}>
                    {selectedDay === 0
                      ? "No activities planned today"
                      : selectedDay === 1
                        ? "No activities planned tomorrow"
                        : "No activities planned for this day"}
                  </Text>
                  <Text style={styles.emptyScheduleMessage}>
                    Add an activity to receive heat and UV guidance.
                  </Text>
                </View>
              </View>

              {tomorrowTimelineEvents.length > 0 && (() => {
                const { event } = tomorrowTimelineEvents[0];
                const title = event.title || "Untitled event";
                const location = typeof event.location === "string"
                  ? event.location.trim()
                  : "";

                return (
                  <View style={styles.tomorrowPreviewSection}>
                    <Text style={styles.tomorrowPreviewHeading}>
                      Coming up tomorrow
                    </Text>

                    <TouchableOpacity
                      style={styles.tomorrowPreviewEvent}
                      accessibilityRole="button"
                      accessibilityLabel={`View tomorrow's event, ${title}, ${formatSavedEventRange(event)}`}
                      onPress={() => setSelectedDay(1)}
                    >
                      <Ionicons
                        name={getEventIconName(title)}
                        size={42}
                        color={theme.color("#147A50")}
                        style={styles.tomorrowPreviewIcon}
                      />
                      <View style={styles.tomorrowPreviewText}>
                        <Text style={styles.tomorrowPreviewTitle} numberOfLines={1}>
                          {title}
                        </Text>
                        <Text style={styles.tomorrowPreviewTime} numberOfLines={1}>
                          {formatSavedEventRange(event)}
                        </Text>
                        {!!location && (
                          <Text style={styles.tomorrowPreviewLocation} numberOfLines={1}>
                            {location}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.viewTomorrowButton}
                      accessibilityRole="button"
                      accessibilityLabel="View tomorrow's schedule"
                      onPress={() => setSelectedDay(1)}
                    >
                      <Text style={styles.viewTomorrowText}>View tomorrow</Text>
                    </TouchableOpacity>
                  </View>
                );
              })()}
            </>
          ) : (
            <View style={styles.timelineAgenda}>
              {timelineEvents.map(({ event }) => {
                const title = event.title || "Untitled event";
                const timeRange = formatSavedEventRange(event);
                const startTime = event.startTimeDisplay || formatStoredTime(event.startTime);
                const endTime = event.endTimeDisplay || formatStoredTime(event.endTime);
                const location = typeof event.location === "string"
                  ? event.location.trim()
                  : "";
                const accessibilityLabel = [
                  `View event details for ${title}`,
                  timeRange,
                  location,
                ].filter(Boolean).join(", ");

                return (
                  <View key={event.id} style={styles.agendaEventRow}>
                    <View style={styles.agendaTimeColumn}>
                      <Text style={styles.agendaTimeText}>{startTime}</Text>
                      <Text style={styles.agendaTimeText}>{endTime}</Text>
                    </View>

                    <View style={styles.agendaRail}>
                      <View style={styles.agendaRailDot} />
                      <View style={styles.agendaRailLine} />
                      <View style={styles.agendaRailDot} />
                    </View>

                    <TouchableOpacity
                      style={styles.savedEvent}
                      accessibilityRole="button"
                      accessibilityLabel={accessibilityLabel}
                      onPress={() => navigation.navigate("EventDetails", { eventId: event.id })}
                    >
                      <View style={styles.savedEventIconContainer}>
                        <Ionicons
                          name={getEventIconName(title)}
                          size={42}
                          color={theme.color("#147A50")}
                        />
                      </View>

                      <View style={styles.savedEventText}>
                        <Text style={styles.savedEventTitle} numberOfLines={1}>
                          {title}
                        </Text>
                        <Text style={styles.savedEventTime} numberOfLines={1}>
                          {timeRange}
                        </Text>
                        {!!location && (
                          <Text style={styles.savedEventLocation} numberOfLines={1}>
                            {location}
                          </Text>
                        )}
                      </View>

                      <Ionicons name="chevron-forward" size={22} color={theme.color("#173C31")} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>


      {/* =====================================================
          AUTOMATIC AI RECOMMENDATION POPUP
      ===================================================== */}

      <Modal
        visible={recommendationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={confirmationVisible
          ? () => setConfirmationVisible(false)
          : closeRecommendationModal}
      >
        <View
          style={
            styles.recommendationBackdrop
          }
        >
          <View
            style={
              styles.recommendationModal
            }
          >
            {confirmationVisible ? (
              <RecommendedTimeConfirmation
                error={confirmationError}
                onCancel={() => setConfirmationVisible(false)}
                onConfirm={confirmRecommendedTime}
              />
            ) : (
              <>
            {/* POPUP HEADER */}
            <View
              style={
                styles.recommendationHeader
              }
            >
              <Text
                accessibilityRole="header"
                style={
                  styles.recommendationTitle
                }
              >
                AI Activity Recommendation
              </Text>
            </View>


            {/* SCROLLABLE RECOMMENDATION */}
            <ScrollView
              contentContainerStyle={
                styles.recommendationBody
              }
            >
              {!!recommendationEvent && (
                <Text
                  style={
                    styles.recommendationEventTitle
                  }
                >
                  {
                    recommendationEvent.title ||
                    "Untitled event"
                  }
                </Text>
              )}

              <ActivityRecommendationContent
                recommendation={
                  recommendation
                }
                loading={
                  recommendationLoading
                }
                error={
                  recommendationError
                }
                onRetry={() =>
                  showRecommendationForSavedEvent(
                    recommendationEvent?.id
                  )
                }
                onChangeToRecommendedTime={handleChangeToRecommendedTime}
                acceptedRecommendedTime={recommendationEvent?.acceptedRecommendedTime}
              />
            </ScrollView>


            {/* RECOMMENDATION FOOTER */}
            <View
              style={
                styles.recommendationFooter
              }
            >
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={recommendation?.alternativeTimeRecommended ? "Keep current time" : "I understand"}
                style={
                  recommendation?.alternativeTimeRecommended
                    ? styles.keepCurrentTimeButton
                    : styles.understandButton
                }
                onPress={
                  closeRecommendationModal
                }
              >
                <Text
                  style={
                    recommendation?.alternativeTimeRecommended
                      ? styles.keepCurrentTimeButtonText
                      : styles.understandButtonText
                  }
                >
                  {recommendation?.alternativeTimeRecommended ? "Keep Current Time" : "I Understand"}
                </Text>
              </TouchableOpacity>
            </View>
              </>
            )}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

/* Styles for the planner screen */
const baseStyles = StyleSheet.create({
  // Outer background for the web page
  safeArea: {
    flex: 1,
    backgroundColor: "#EEF2F0",
    alignItems: "center"
  },

  // Keep the web application looking like a mobile screen
  mobileContainer: {
    flex: 1,
    width: "100%",
    maxWidth: 430,
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: "#F5F8F6",

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 0
    },
    shadowOpacity: 0.12,
    shadowRadius: 10
  },

  // Adds spacing inside the phone screen
  topContent: {
    paddingHorizontal: 18
  },

  /* Header */

	header: {
	  minHeight: 72,
	  flexDirection: "row",
	  alignItems: "center",
	  justifyContent: "space-between",
	  paddingHorizontal: 18,
	  backgroundColor: "#F5F8F6",
    zIndex: 30,
    position: "relative",
	},

	headerTitle: {
	  flex: 1,
	  fontSize: 21,
	  lineHeight: 27,
	  fontWeight: "800",
	  color: "#173C31",
	},

	headerRightSpace: {
	  width: 44,
	},

  feedbackButton: {
    width: 44,
    height: 44,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 14,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#D7E2DD",

    cursor: "pointer",
  },

  feedbackButtonHighlighted: {
    backgroundColor: "#39775F",
    borderColor: "#39775F",
  },

  feedbackBadge: {
    position: "absolute",

    top: -4,
    right: -4,

    minWidth: 21,
    height: 21,

    paddingHorizontal: 5,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 11,

    backgroundColor: "#C2410C",

    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  feedbackBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  feedbackReminderLayer: {
    position: "absolute",

    top: 72,
    left: 0,
    right: 0,
    bottom: 0,

    zIndex: 20,

    alignItems: "center",

    paddingTop: 90,
    paddingHorizontal: 24,
  },

  feedbackDimBackground: {
    position: "absolute",

    top: 0,
    left: 0,
    right: 0,
    bottom: 0,

    backgroundColor: "rgba(0, 0, 0, 0.42)",
  },

  feedbackReminderCard: {
    width: "100%",
    maxWidth: 350,

    paddingHorizontal: 24,
    paddingVertical: 26,

    alignItems: "center",

    backgroundColor: "#FFFFFF",

    borderRadius: 16,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.18,
    shadowRadius: 10,

    elevation: 6,
  },

  feedbackReminderIcon: {
    width: 62,
    height: 62,

    marginBottom: 16,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 31,

    backgroundColor: "#E8F2EE",
  },

  feedbackReminderTitle: {
    marginBottom: 12,

    textAlign: "center",

    fontSize: 22,
    fontWeight: "700",
    color: "#173C31",
  },

  feedbackReminderText: {
    marginBottom: 10,

    textAlign: "center",

    fontSize: 17,
    lineHeight: 25,
    color: "#333333",
  },

  feedbackReminderInstruction: {
    textAlign: "center",

    fontSize: 15,
    lineHeight: 23,
    color: "#666666",
  },

  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 20
  },

  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#173C31",
    textAlign: "center"
  },

  message: {
    marginTop: 10,
    fontSize: 15,
    color: "#666666"
  },

  /* Date selector */

  dateSection: {
    marginTop: 10
  },

  sectionTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#173C31",
    marginBottom: 14
  },

  dateSelector: {
    flexDirection: "row",
    padding: 0,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    borderWidth: 1,
    borderColor: "#E0E9E4",
  },

  dateButton: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 11,
    borderRadius: 18,
    borderWidth: 0,
    alignItems: "center",
    backgroundColor: "transparent"
  },

  dateButtonSelected: {
    backgroundColor: "#39775F",
    shadowColor: "#173C31",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },

  dateButtonLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#39775F"
  },

  dateButtonLabelSelected: {
    color: "#ffffff"
  },

  selectedDayText: {
    marginTop: 16,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: "#111827"
  },

  /* Planner header */

  plannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    marginBottom: 10
  },

  timelineTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#173C31",
  },

  forecastTable: {
    marginTop: 16,
    paddingBottom: 18,
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#DCE5E0",
  },

  forecastLabels: {
    width: 70,
    justifyContent: "flex-end",
  },

  forecastLabelSpacer: {
    height: 65,
  },

  forecastRowLabel: {
    height: 31,
    fontSize: 12,
    color: "#344054",
  },

  forecastColumn: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 3,
    alignItems: "center",
    borderLeftWidth: 1,
    borderLeftColor: "#DCE5E0",
  },

  forecastHourLabel: {
    height: 25,
    fontSize: 12,
    fontWeight: "600",
    color: "#344054",
  },

  forecastIconSlot: {
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  forecastTemperature: {
    height: 31,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "800",
    color: "#101828",
  },

  forecastUv: {
    height: 31,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "800",
  },

  addEventButton: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DFF5E8",
    minHeight: 40,
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    shadowColor: "#173C31",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 3,
  },

  addEventText: {
    color: "#147A50",
    fontSize: 12,
    fontWeight: "700"
  },

  /* 24 hour timeline */

  timeline: {
    flex: 1,
    minHeight: 0
  },

  timelineAgenda: {
    gap: 20,
  },

  agendaEventRow: {
    minHeight: AGENDA_CARD_HEIGHT,
    flexDirection: "row",
    alignItems: "stretch",
  },

  agendaTimeColumn: {
    width: 66,
    paddingVertical: 2,
    justifyContent: "space-between",
  },

  agendaTimeText: {
    fontSize: 12,
    lineHeight: 16,
    color: "#52645E",
  },

  agendaRail: {
    width: 18,
    paddingVertical: 4,
    alignItems: "center",
  },

  agendaRailDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#148A54",
  },

  agendaRailLine: {
    flex: 1,
    width: 3,
    backgroundColor: "#148A54",
  },

  emptyScheduleCard: {
    minHeight: 104,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D5E9DF",
    backgroundColor: "#EDF9F2",
  },

  emptyScheduleIcon: {
    width: 58,
    height: 58,
    marginRight: 14,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D8F2E4",
  },

  emptyScheduleCheck: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#147A50",
    borderWidth: 2,
    borderColor: "#EDF9F2",
  },

  emptyScheduleText: {
    flex: 1,
    minWidth: 0,
  },

  emptyScheduleTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
    color: "#173C31",
  },

  emptyScheduleMessage: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "#52645E",
  },

  tomorrowPreviewSection: {
    marginTop: 16,
  },

  tomorrowPreviewHeading: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    color: "#173C31",
  },

  tomorrowPreviewEvent: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#DCE5E0",
  },

  tomorrowPreviewIcon: {
    width: 58,
    marginRight: 10,
    textAlign: "center",
  },

  tomorrowPreviewText: {
    flex: 1,
    minWidth: 0,
  },

  tomorrowPreviewTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: "#173C31",
  },

  tomorrowPreviewTime: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: "#52645E",
  },

  tomorrowPreviewLocation: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: "#52645E",
  },

  viewTomorrowButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  viewTomorrowText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#147A50",
  },

  /* =========================================================
    SAVED EVENT CARD
  ========================================================= */

  savedEvent: {
    flex: 1,
    height: AGENDA_CARD_HEIGHT,
    marginLeft: 6,
    backgroundColor: "#E6F1EC",
    borderWidth: 0,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    overflow: "hidden",
    cursor: "pointer",
    flexDirection: "row",
    alignItems: "center",
  },

  savedEventIconContainer: {
    width: 52,
    height: 52,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  savedEventText: {
    flex: 1,
    minWidth: 0,
  },

  savedEventTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
    color: "#173C31",
  },

  savedEventTime: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: "#52645E",
  },

  savedEventLocation: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: "#52645E",
  },

  /* Temporary Add Event popup */
  popupBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center"
  },

  popupBox: {
    width: 300,
    maxHeight: 500,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20
  },

  popupTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#173C31",
    textAlign: "center"
  },

  popupMessage: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 12
  },

  hourOptions: {
    maxHeight: 300
  },

  slotButton: {
    borderWidth: 1,
    borderColor: "#39775F",
    borderRadius: 8,
    paddingVertical: 10,
    marginBottom: 8
  },

  slotButtonText: {
    textAlign: "center",
    color: "#39775F",
    fontWeight: "600"
  },

  cancelButton: {
    marginTop: 5,
    paddingVertical: 8
  },

  cancelText: {
    textAlign: "center",
    color: "#666666"
  },

  // Keep timeline spacing consistent with the top content
  timelineContent: {
    paddingHorizontal: 18,
    paddingBottom: 112,
  },

  recommendationBackdrop: {
    flex: 1,
    backgroundColor:
      "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  recommendationModal: {
    width: "100%",
    maxWidth: 390,
    maxHeight: "85%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
  },

  recommendationHeader: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#DCE5E0",
  },

  recommendationTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#173C31",
    textAlign: "center",
  },

  recommendationBody: {
    padding: 20,
    gap: 16,
  },

  recommendationEventTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#173C31",
  },

  recommendationFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#DCE5E0",
    backgroundColor: "#FFFFFF",
  },

  understandButton: {
    minHeight: 50,
    borderRadius: 10,
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

  keepCurrentTimeButton: {
    minHeight: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#B8C8C1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  keepCurrentTimeButtonText: {
    color: "#39775F",
    fontSize: 16,
    fontWeight: "600",
  },
});