import { SafeAreaView } from "react-native-safe-area-context";
import { useThemedStyles } from "../theme/useAppTheme";
import React, {
  useMemo,
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
  getStoredEvents,
} from "../services/eventStorageService";

import {
  saveFeedback,
} from "../services/feedbackStorageService";


export default function FeedbackFormScreen({
  navigation,
  route,
}) {
  const { styles, theme } = useThemedStyles(baseStyles);
  const {
    eventId,
  } = route.params ?? {};


  const [
    selectedAnswer,
    setSelectedAnswer,
  ] = useState(null);


  const [
    isSubmitted,
    setIsSubmitted,
  ] = useState(false);


  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


  /* =========================================================
     FIND SELECTED EVENT
  ========================================================= */

  const event = useMemo(() => {
    const events =
      getStoredEvents();

    return (
      events.find(
        (item) =>
          item.id === eventId
      ) ?? null
    );
  }, [eventId]);


  /* =========================================================
     FORMAT STORED TIME

     Example:
     14:30
          ↓
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

    return (
      `${displayHour}:` +
      `${minute} ` +
      `${suffix}`
    );
  }


  /* =========================================================
     FEEDBACK OPTIONS
  ========================================================= */

  const feedbackOptions = [
    {
      value: "not_warm",
      label: "Not warm / OK",
      description:
        "The conditions felt comfortable.",
      emoji: "🙂",
    },

    {
      value: "warm",
      label: "Warm",
      description:
        "I felt warm, but it was still manageable.",
      emoji: "😐",
    },

    {
      value: "too_hot",
      label: "Too hot",
      description:
        "The conditions felt uncomfortably hot.",
      emoji: "🥵",
    },
  ];


  /* =========================================================
     SUBMIT FEEDBACK
  ========================================================= */

  function handleSubmit() {
    if (!selectedAnswer) {
      setErrorMessage(
        "Please select an answer before continuing."
      );

      return;
    }


    if (!eventId) {
      setErrorMessage(
        "This feedback form could not be linked to an event."
      );

      return;
    }


    try {
      saveFeedback(
        eventId,
        selectedAnswer
      );

      setErrorMessage("");

      setIsSubmitted(true);
    }
    catch (error) {
      console.error(
        "Feedback submission failed:",
        error
      );

      setErrorMessage(
        "We could not save your feedback. Please try again."
      );
    }
  }


  /* =========================================================
     SUCCESS PAGE
  ========================================================= */

  if (isSubmitted) {
    return (
      <SafeAreaView style={styles.safeArea}>

        <View style={styles.mobileContainer}>


          {/* ================= HEADER ================= */}

          <View style={styles.header}>

            <View style={styles.headerSideSpace} />


            <Text style={styles.headerTitle}>
              Feedback Form
            </Text>


            <View style={styles.headerSideSpace} />

          </View>


          {/* ================= SUCCESS CONTENT ================= */}

          <View style={styles.successContainer}>

            <View style={styles.successIconContainer}>

              <Ionicons
                name="checkmark"
                size={54}
                color={theme.color("#39775F")}
              />

            </View>


            <Text style={styles.successTitle}>
              Feedback completed
            </Text>


            <Text style={styles.successMessage}>
              Thank you for sharing how you felt
              during this activity.
            </Text>


            <TouchableOpacity
              style={styles.returnButton}
              onPress={() =>
                navigation.goBack()
              }
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Back to Feedback Form List"
            >

              <Ionicons
                name="arrow-back"
                size={21}
                color={theme.color("#FFFFFF")}
              />


              <Text
                style={
                  styles.returnButtonText
                }
              >
                Back to Feedback Form List
              </Text>

            </TouchableOpacity>

          </View>

        </View>

      </SafeAreaView>
    );
  }


  /* =========================================================
     FEEDBACK QUESTION PAGE
  ========================================================= */

  return (
    <SafeAreaView style={styles.safeArea}>

      <View style={styles.mobileContainer}>


        {/* ================= HEADER ================= */}

        <View style={styles.header}>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() =>
              navigation.goBack()
            }
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back to Feedback Form List"
          >

            <Ionicons
              name="chevron-back"
              size={30}
              color={theme.color("#222222")}
            />

          </TouchableOpacity>


          <Text style={styles.headerTitle}>
            Feedback Form
          </Text>


          <View style={styles.headerSideSpace} />

        </View>


        {/* ================= SCROLLABLE CONTENT ================= */}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={
            styles.scrollContent
          }
          showsVerticalScrollIndicator={false}
        >


          {/* ================= EVENT INFORMATION ================= */}

          {event ? (
            <View style={styles.eventCard}>

              <View style={styles.eventIconContainer}>

                <Ionicons
                  name="calendar-outline"
                  size={25}
                  color={theme.color("#39775F")}
                />

              </View>


              <View style={styles.eventInformation}>

                <Text style={styles.eventTitle}>
                  {event.title ||
                    "Planned activity"}
                </Text>


                <View style={styles.timeRow}>

                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={theme.color("#52645E")}
                  />


                  <Text style={styles.eventTime}>
                    {formatTime(
                      event.startTime
                    )}
                    {" - "}
                    {formatTime(
                      event.endTime
                    )}
                  </Text>

                </View>

              </View>

            </View>
          ) : (
            <View style={styles.eventErrorCard}>

              <Ionicons
                name="alert-circle-outline"
                size={23}
                color={theme.color("#B42318")}
              />


              <Text style={styles.eventError}>
                Event information is unavailable.
              </Text>

            </View>
          )}


          {/* ================= QUESTION ================= */}

          <View style={styles.questionSection}>

            <Text style={styles.questionLabel}>
              Activity feedback
            </Text>


            <Text style={styles.question}>
              How hot did you feel during this activity?
            </Text>


            <Text style={styles.questionHint}>
              Select the option that best describes
              how you felt.
            </Text>

          </View>


          {/* ================= ANSWERS ================= */}

          <View style={styles.optionsContainer}>

            {feedbackOptions.map(
              (option) => {
                const isSelected =
                  selectedAnswer ===
                  option.value;

                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionCard,

                      isSelected &&
                        styles.optionCardSelected,
                    ]}
                    onPress={() => {
                      setSelectedAnswer(
                        option.value
                      );

                      setErrorMessage("");
                    }}
                    activeOpacity={0.8}
                    accessibilityRole="radio"
                    accessibilityState={{
                      selected:
                        isSelected,
                    }}
                    accessibilityLabel={
                      option.label
                    }
                  >

                    {/* Radio button */}

                    <View
                      style={[
                        styles.radioOuter,

                        isSelected &&
                          styles.radioOuterSelected,
                      ]}
                    >

                      {isSelected && (
                        <View
                          style={
                            styles.radioInner
                          }
                        />
                      )}

                    </View>


                    {/* Emoji */}

                    <View
                      style={
                        styles.emojiContainer
                      }
                    >

                      <Text
                        style={
                          styles.optionEmoji
                        }
                      >
                        {option.emoji}
                      </Text>

                    </View>


                    {/* Answer text */}

                    <View
                      style={
                        styles.optionTextContainer
                      }
                    >

                      <Text
                        style={[
                          styles.optionLabel,

                          isSelected &&
                            styles.optionLabelSelected,
                        ]}
                      >
                        {option.label}
                      </Text>


                      <Text
                        style={
                          styles.optionDescription
                        }
                      >
                        {option.description}
                      </Text>

                    </View>

                  </TouchableOpacity>
                );
              }
            )}

          </View>


          {/* ================= ERROR ================= */}

          {errorMessage ? (
            <View style={styles.errorContainer}>

              <Ionicons
                name="alert-circle-outline"
                size={20}
                color={theme.color("#B42318")}
              />


              <Text style={styles.errorText}>
                {errorMessage}
              </Text>

            </View>
          ) : null}


          {/* ================= DONE BUTTON ================= */}

          <TouchableOpacity
            style={[
              styles.doneButton,

              !selectedAnswer &&
                styles.doneButtonDisabled,
            ]}
            onPress={
              handleSubmit
            }
            disabled={
              !selectedAnswer
            }
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Submit feedback"
            accessibilityState={{
              disabled:
                !selectedAnswer,
            }}
          >

            <Text
              style={[
                styles.doneButtonText,

                !selectedAnswer &&
                  styles.doneButtonTextDisabled,
              ]}
            >
              Done
            </Text>


            <Ionicons
              name="checkmark"
              size={22}
              color={theme.color(selectedAnswer
                  ? "#FFFFFF"
                  : "#737373")}
            />

          </TouchableOpacity>


          <Text style={styles.submitHint}>
            Your feedback will be saved for this activity.
          </Text>

        </ScrollView>

      </View>

    </SafeAreaView>
  );
}


/* =========================================================
   STYLES
========================================================= */

const baseStyles =
  StyleSheet.create({


    /* =======================================================
       WEB BACKGROUND + PHONE CONTAINER
    ======================================================= */

    safeArea: {
      flex: 1,

      backgroundColor:
        "#EEF2F0",

      alignItems: "center",
    },


    mobileContainer: {
      flex: 1,

      width: "100%",
      maxWidth: 430,

      minHeight: 0,

      backgroundColor:
        "#FFFFFF",

      overflow: "hidden",

      shadowColor:
        "#000000",

      shadowOffset: {
        width: 0,
        height: 0,
      },

      shadowOpacity: 0.12,
      shadowRadius: 10,

      elevation: 3,
    },


    /* =======================================================
       HEADER
    ======================================================= */

    header: {
      height: 65,

      paddingHorizontal: 14,

      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",

      backgroundColor:
        "#FFFFFF",

      borderBottomWidth: 1,
      borderBottomColor:
        "#E3E8E5",
    },


    backButton: {
      width: 44,
      height: 44,

      alignItems: "center",
      justifyContent:
        "center",

      cursor: "pointer",
    },


    headerTitle: {
      flex: 1,

      textAlign: "center",

      fontSize: 20,
      fontWeight: "700",

      color: "#171717",
    },


    headerSideSpace: {
      width: 44,
      height: 44,
    },


    /* =======================================================
       SCROLL CONTENT
    ======================================================= */

    scrollView: {
      flex: 1,

      backgroundColor:
        "#F8FAF8",
    },


    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 38,
    },


    /* =======================================================
       EVENT CARD
    ======================================================= */

    eventCard: {
      minHeight: 88,

      marginBottom: 28,

      paddingHorizontal: 18,
      paddingVertical: 16,

      flexDirection: "row",
      alignItems: "center",

      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,
      borderColor:
        "#D8E1DC",

      borderRadius: 14,

      shadowColor:
        "#000000",

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity: 0.05,
      shadowRadius: 6,

      elevation: 1,
    },


    eventIconContainer: {
      width: 46,
      height: 46,

      marginRight: 14,

      alignItems: "center",
      justifyContent:
        "center",

      borderRadius: 23,

      backgroundColor:
        "#E8F2EE",
    },


    eventInformation: {
      flex: 1,
    },


    eventTitle: {
      marginBottom: 7,

      fontSize: 19,
      lineHeight: 25,

      fontWeight: "700",

      color: "#173C31",
    },


    timeRow: {
      flexDirection: "row",
      alignItems: "center",
    },


    eventTime: {
      marginLeft: 6,

      fontSize: 15,
      lineHeight: 21,

      color: "#52645E",
    },


    eventErrorCard: {
      marginBottom: 28,

      padding: 16,

      flexDirection: "row",
      alignItems: "center",

      backgroundColor:
        "#FFF5F5",

      borderRadius: 12,
    },


    eventError: {
      flex: 1,

      marginLeft: 10,

      fontSize: 15,

      color: "#B42318",
    },


    /* =======================================================
       QUESTION
    ======================================================= */

    questionSection: {
      marginBottom: 22,
    },


    questionLabel: {
      marginBottom: 7,

      fontSize: 14,
      lineHeight: 19,

      fontWeight: "700",

      color: "#39775F",

      textTransform:
        "uppercase",

      letterSpacing: 0.5,
    },


    question: {
      marginBottom: 8,

      fontSize: 22,
      lineHeight: 30,

      fontWeight: "700",

      color: "#173C31",
    },


    questionHint: {
      fontSize: 15,
      lineHeight: 22,

      color: "#666666",
    },


    /* =======================================================
       ANSWER OPTIONS
    ======================================================= */

    optionsContainer: {
      gap: 12,
    },


    optionCard: {
      minHeight: 86,

      paddingHorizontal: 15,
      paddingVertical: 14,

      flexDirection: "row",
      alignItems: "center",

      backgroundColor:
        "#FFFFFF",

      borderWidth: 2,
      borderColor:
        "#D7DFDB",

      borderRadius: 14,

      cursor: "pointer",
    },


    optionCardSelected: {
      borderColor:
        "#39775F",

      backgroundColor:
        "#F0F7F4",
    },


    radioOuter: {
      width: 25,
      height: 25,

      marginRight: 12,

      borderWidth: 2,
      borderColor:
        "#7A8580",

      borderRadius: 13,

      alignItems: "center",
      justifyContent:
        "center",
    },


    radioOuterSelected: {
      borderColor:
        "#39775F",
    },


    radioInner: {
      width: 13,
      height: 13,

      borderRadius: 7,

      backgroundColor:
        "#39775F",
    },


    emojiContainer: {
      width: 42,
      height: 42,

      marginRight: 12,

      alignItems: "center",
      justifyContent:
        "center",

      borderRadius: 21,

      backgroundColor:
        "#F4F6F5",
    },


    optionEmoji: {
      fontSize: 25,
    },


    optionTextContainer: {
      flex: 1,
    },


    optionLabel: {
      marginBottom: 3,

      fontSize: 17,
      lineHeight: 22,

      fontWeight: "700",

      color: "#333333",
    },


    optionLabelSelected: {
      color: "#173C31",
    },


    optionDescription: {
      fontSize: 13,
      lineHeight: 19,

      color: "#666666",
    },


    /* =======================================================
       ERROR
    ======================================================= */

    errorContainer: {
      marginTop: 17,

      paddingHorizontal: 13,
      paddingVertical: 11,

      flexDirection: "row",
      alignItems: "center",

      backgroundColor:
        "#FFF5F5",

      borderRadius: 10,
    },


    errorText: {
      flex: 1,

      marginLeft: 8,

      fontSize: 14,
      lineHeight: 20,

      color: "#B42318",
    },


    /* =======================================================
       DONE BUTTON
    ======================================================= */

    doneButton: {
      minHeight: 54,

      marginTop: 26,

      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",

      gap: 8,

      backgroundColor:
        "#39775F",

      borderRadius: 10,

      cursor: "pointer",
    },


    doneButtonDisabled: {
      backgroundColor:
        "#D5DAD7",
    },


    doneButtonText: {
      fontSize: 17,

      fontWeight: "700",

      color: "#FFFFFF",
    },


    doneButtonTextDisabled: {
      color: "#737373",
    },


    submitHint: {
      marginTop: 12,

      textAlign: "center",

      fontSize: 12,
      lineHeight: 18,

      color: "#777777",
    },


    /* =======================================================
       SUCCESS PAGE
    ======================================================= */

    successContainer: {
      flex: 1,

      paddingHorizontal: 28,

      alignItems: "center",
      justifyContent:
        "center",

      backgroundColor:
        "#F8FAF8",
    },


    successIconContainer: {
      width: 88,
      height: 88,

      marginBottom: 24,

      alignItems: "center",
      justifyContent:
        "center",

      borderRadius: 44,

      backgroundColor:
        "#E8F2EE",
    },


    successTitle: {
      marginBottom: 12,

      textAlign: "center",

      fontSize: 24,
      lineHeight: 31,

      fontWeight: "700",

      color: "#173C31",
    },


    successMessage: {
      maxWidth: 330,

      marginBottom: 30,

      textAlign: "center",

      fontSize: 17,
      lineHeight: 25,

      color: "#4D5551",
    },


    returnButton: {
      width: "100%",
      minHeight: 54,

      paddingHorizontal: 18,

      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",

      gap: 9,

      backgroundColor:
        "#39775F",

      borderRadius: 10,

      cursor: "pointer",
    },


    returnButtonText: {
      textAlign: "center",

      fontSize: 16,
      fontWeight: "700",

      color: "#FFFFFF",
    },

  });