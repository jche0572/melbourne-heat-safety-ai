import { SafeAreaView } from "react-native-safe-area-context";
import { useThemedStyles } from "../theme/useAppTheme";
import React, {
  useCallback,
  useState,
} from "react";

import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  Ionicons,
} from "@expo/vector-icons";

import {
  useFocusEffect,
} from "@react-navigation/native";

import {
  getPendingFeedbackEvents,
} from "../services/feedbackStorageService";


export default function FeedbackFormListScreen({
  navigation,
}) {
  const { styles, theme } = useThemedStyles(baseStyles);
  const [
    pendingFeedback,
    setPendingFeedback,
  ] = useState([]);


  /* =========================================================
     LOAD PENDING FEEDBACK

     Reload every time Greg returns to this screen.

     This is important because:
     Feedback Form
          ↓
     submit feedback
          ↓
     return to list
          ↓
     completed item disappears
  ========================================================= */

  useFocusEffect(
    useCallback(() => {
      const pendingEvents =
        getPendingFeedbackEvents();

      setPendingFeedback(
        pendingEvents
      );
    }, [])
  );


  /* =========================================================
     FORMAT TIME

     Your stored event time may look like:
     09:00
     14:30

     This converts it to:
     9:00 AM
     2:30 PM
  ========================================================= */

  function formatTime(time) {
    if (!time) {
      return "";
    }

    const [
      hourString,
      minuteString,
    ] = time.split(":");

    const hour =
      Number(hourString);

    const minute =
      minuteString ?? "00";

    const suffix =
      hour >= 12
        ? "PM"
        : "AM";

    const displayHour =
      hour % 12 === 0
        ? 12
        : hour % 12;

    return `${displayHour}:${minute} ${suffix}`;
  }


  /* =========================================================
     OPEN ONE FEEDBACK FORM
  ========================================================= */

  function openFeedbackForm(event) {
    navigation.navigate(
      "FeedbackForm",
      {
        eventId: event.id,
      }
    );
  }


  return (
    <SafeAreaView style={styles.safeArea}>

        <View style={styles.mobileContainer}>

        <View style={styles.header}>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() =>
            navigation.goBack()
          }
          accessibilityRole="button"
          accessibilityLabel="Back to Heat-Aware Activity Planner"
        >
          <Ionicons
            name="chevron-back"
            size={30}
            color={theme.color("#1F2937")}
          />
        </TouchableOpacity>


        <Text style={styles.headerTitle}>
          Feedback Form List
        </Text>


        {/*
          Empty view keeps the title visually centred.
        */}
        <View style={styles.headerSpacer} />

      </View>


      {/* ================= CONTENT ================= */}

      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={false}
      >

        {pendingFeedback.length === 0 ? (

          /* =========================================
             ALL FEEDBACK COMPLETED
          ========================================= */

          <View
            style={styles.completedContainer}
          >

            <View
              style={styles.completedIcon}
            >
              <Ionicons
                name="checkmark"
                size={42}
                color={theme.color("#2F855A")}
              />
            </View>


            <Text
              style={styles.completedTitle}
            >
              All feedback is complete
            </Text>


            <Text
              style={styles.completedText}
            >
              You have completed all available
              feedback forms.
            </Text>

          </View>

        ) : (

          /* =========================================
             PENDING FEEDBACK LIST
          ========================================= */

          <>
            <Text style={styles.introduction}>
              Select an activity to provide
              feedback.
            </Text>


            {pendingFeedback.map(
              (event) => (

                <TouchableOpacity
                  key={event.id}
                  style={styles.feedbackCard}
                  onPress={() =>
                    openFeedbackForm(event)
                  }
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    `Provide feedback for ${event.title}`
                  }
                >

                  <View
                    style={
                      styles.feedbackCardContent
                    }
                  >

                    <Text
                      style={
                        styles.eventTitle
                      }
                    >
                      {event.title ||
                        "Planned activity"}
                    </Text>


                    <Text
                      style={
                        styles.eventTime
                      }
                    >
                      {formatTime(
                        event.startTime
                      )}
                      {" - "}
                      {formatTime(
                        event.endTime
                      )}
                    </Text>

                  </View>


                  <Ionicons
                    name="chevron-forward"
                    size={28}
                    color={theme.color("#4B5563")}
                  />

                </TouchableOpacity>

              )
            )}
          </>
        )}

            </ScrollView>

    </View>

  </SafeAreaView>
);
}


/* =========================================================
   STYLES
========================================================= */

const baseStyles = StyleSheet.create({

  safeArea: {
    flex: 1,

    backgroundColor: "#EEF2F0",

    alignItems: "center",
    },

    mobileContainer: {
    flex: 1,

    width: "100%",
    maxWidth: 430,

    minHeight: 0,

    backgroundColor: "#F8FAF8",

    overflow: "hidden",

    shadowColor: "#000000",

    shadowOffset: {
        width: 0,
        height: 0,
    },

    shadowOpacity: 0.12,
    shadowRadius: 10,

    elevation: 3,
    },


  /* ================= HEADER ================= */

  header: {
    minHeight: 78,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    backgroundColor: "#FFFFFF",

    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },

  backButton: {
    width: 44,
    height: 44,

    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    flex: 1,

    textAlign: "center",

    fontSize: 23,
    fontWeight: "700",
    color: "#1F2937",
  },

  headerSpacer: {
    width: 44,
  },


  /* ================= CONTENT ================= */

  scrollContent: {
    flexGrow: 1,

    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },

  introduction: {
    marginBottom: 18,

    fontSize: 18,
    lineHeight: 26,
    color: "#4B5563",
  },


  /* ================= FEEDBACK CARD ================= */

  feedbackCard: {
    minHeight: 96,

    marginBottom: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,

    flexDirection: "row",
    alignItems: "center",

    backgroundColor: "#FFFFFF",

    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",

    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: {
      width: 0,
      height: 2,
    },

    elevation: 2,
  },

  feedbackCardContent: {
    flex: 1,
    paddingRight: 12,
  },

  eventTitle: {
    marginBottom: 8,

    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    color: "#1F2937",
  },

  eventTime: {
    fontSize: 17,
    lineHeight: 23,
    color: "#4B5563",
  },


  /* ================= COMPLETED STATE ================= */

  completedContainer: {
    flex: 1,

    paddingHorizontal: 20,

    alignItems: "center",
    justifyContent: "center",
  },

  completedIcon: {
    width: 82,
    height: 82,

    marginBottom: 24,

    borderRadius: 41,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#E6F4EA",
  },

  completedTitle: {
    marginBottom: 12,

    textAlign: "center",

    fontSize: 24,
    lineHeight: 31,
    fontWeight: "700",
    color: "#1F2937",
  },

  completedText: {
    maxWidth: 330,

    textAlign: "center",

    fontSize: 18,
    lineHeight: 27,
    color: "#4B5563",
  },

});