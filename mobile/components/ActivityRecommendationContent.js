import { useThemedStyles } from "../theme/useAppTheme";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Speech from "expo-speech";
import { setAudioModeAsync } from "expo-audio";

function buildRecommendationSpeechText(actions) {
  return actions
    .filter(
      (item) =>
        typeof item === "string" &&
        item.trim().length > 0
    )
    .map((item) => {
      const sentence = item
        .trim()
        .replace(/\s+/g, " ");

      return /[.!?]$/.test(sentence)
        ? sentence
        : `${sentence}.`;
    })
    .join(" ");
}

function pickRecommendationVoice(voices) {
  const normalisedVoices = voices.map(
    (voice) => ({
      voice,
      language: String(voice.language || "")
        .replace(/_/g, "-")
        .toLowerCase(),
      enhanced:
        voice.quality === Speech.VoiceQuality.Enhanced ||
        voice.quality === "Enhanced",
    })
  );

  const priorities = [
    ({ language, enhanced }) => language === "en-au" && enhanced,
    ({ language }) => language === "en-au",
    ({ language, enhanced }) => language === "en-gb" && enhanced,
    ({ language, enhanced }) => language === "en-us" && enhanced,
    ({ language }) => language === "en-gb" || language === "en-us",
  ];

  for (const matches of priorities) {
    const match = normalisedVoices.find(matches);

    if (match) {
      return match.voice;
    }
  }

  return undefined;
}

function getAdviceIcon(text) {
  const value = String(text || "").toLowerCase();

  if (/sun|sunscreen|hat|uv/.test(value)) {
    return { name: "sunny-outline", backgroundColor: "#FFF0E3", color: "#E56A00" };
  }
  if (/water|hydrat|drink/.test(value)) {
    return { name: "water-outline", backgroundColor: "#E5F3FF", color: "#1683D8" };
  }
  if (/shade|tree|indoors|shelter/.test(value)) {
    return { name: "leaf-outline", backgroundColor: "#E4F6EA", color: "#168052" };
  }
  if (/time|earlier|later|duration|break/.test(value)) {
    return { name: "time-outline", backgroundColor: "#F1EAFE", color: "#6841B5" };
  }

  return { name: "checkmark-circle-outline", backgroundColor: "#EAF3EF", color: "#39775F" };
}

function formatAlternativeTime({ startTime, endTime }) {
  const timeZone = "Australia/Melbourne";
  const start = new Date(startTime);
  const end = new Date(endTime);
  const todayKey = new Date().toLocaleDateString("en-CA", { timeZone });
  const startKey = start.toLocaleDateString("en-CA", { timeZone });
  const dateLabel = startKey === todayKey
    ? "Today"
    : start.toLocaleDateString("en-AU", {
        timeZone,
        weekday: "short",
        day: "numeric",
        month: "short",
      });
  const timeOptions = {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  };

  return `${dateLabel} · ${start.toLocaleTimeString("en-AU", timeOptions)} – ${end.toLocaleTimeString("en-AU", timeOptions)}`;
}


export default function ActivityRecommendationContent({
  recommendation,
  loading = false,
  error = "",
  onRetry,
  showSavedNote = false,
  enableSpeech = false,
  showOverview = true,
  onChangeToRecommendedTime,
  acceptedRecommendedTime = false,
}) {
  const { styles, theme } = useThemedStyles(baseStyles);
  const advice =
    recommendation?.recommendation ?? {};

  const actions =
    Array.isArray(advice.practicalActions)
      ? advice.practicalActions
      : (
          Array.isArray(recommendation?.practicalAdvice)
            ? recommendation.practicalAdvice
            : []
        );

  const speechText =
    buildRecommendationSpeechText(actions);

  const [isSpeaking, setIsSpeaking] =
    useState(false);
  const speechRun = useRef(0);
  const preferredVoice = useRef(null);

  const stopSpeech = useCallback(
    () => {
      speechRun.current += 1;
      setIsSpeaking(false);
      Speech.stop();
    },
    []
  );

  const handleSpeechPress = async () => {
    if (isSpeaking) {
      stopSpeech();
      return;
    }

    if (!speechText) {
      return;
    }

    const run = ++speechRun.current;
    const finish = () => {
      if (speechRun.current === run) {
        setIsSpeaking(false);
      }
    };
    const fail = () => {
      if (speechRun.current !== run) return;
      finish();
      Alert.alert("Unable to play speech", "Please check your media volume and audio output, then try again.");
    };

    setIsSpeaking(true);

    try {
      if (Platform.OS === "ios") {
        await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "duckOthers" });
        if (speechRun.current !== run) return;
      }
      Speech.speak(
        speechText,
        {
          language: "en-AU",
          rate: 0.92,
          pitch: 1.0,
          useApplicationAudioSession: true,
          ...(preferredVoice.current
            ? {
                voice:
                  preferredVoice.current,
              }
            : {}),
          onDone: finish,
          onStopped: finish,
          onError: fail,
        }
      );
    } catch (_error) {
      fail();
    }
  };

  useEffect(
    () => {
      if (!enableSpeech) {
        preferredVoice.current = null;
        return undefined;
      }

      let cancelled = false;

      Speech.getAvailableVoicesAsync()
        .then((voices) => {
          if (!cancelled) {
            preferredVoice.current =
              pickRecommendationVoice(voices)
                ?.identifier ?? null;
          }
        })
        .catch(() => {
          if (!cancelled) {
            preferredVoice.current = null;
          }
        });

      return () => {
        cancelled = true;
      };
    },
    [enableSpeech]
  );

  useEffect(
    () => {
      if (enableSpeech) {
        stopSpeech();
      }

      return () => {
        if (enableSpeech) {
          speechRun.current += 1;
          Speech.stop();
        }
      };
    },
    [
      enableSpeech,
      speechText,
      stopSpeech,
    ]
  );

  useFocusEffect(
    useCallback(
      () => () => {
        if (enableSpeech) {
          stopSpeech();
        }
      },
      [enableSpeech, stopSpeech]
    )
  );

  return (
    <View style={styles.content}>

      {enableSpeech && (
        <View style={styles.recommendationHeader}>
          <View style={styles.recommendationHeadingText}>
            <Text accessibilityRole="header" style={styles.recommendationTitle}>
              Activity Recommendation
            </Text>
            <Text style={styles.recommendationSubtitle}>
              Based on the forecast for this time and location.
            </Text>
          </View>

          {!!speechText && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={isSpeaking ? "Stop reading" : "Read recommendations aloud"}
              style={styles.speechButton}
              onPress={handleSpeechPress}
            >
              <Ionicons
                name={isSpeaking ? "stop-circle-outline" : "volume-high-outline"}
                size={22}
                color={theme.color("#147A50")}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* LOADING */}
      {loading && (
        <Text
          accessibilityRole="status"
          style={styles.note}
        >
          Checking the forecast and preparing your recommendation…
        </Text>
      )}


      {/* ERROR */}
      {!!error && (
        <View style={styles.section}>
          <Text
            accessibilityRole="alert"
            style={styles.note}
          >
            {error}
          </Text>

          {typeof onRetry === "function" && (
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.retryButton}
              onPress={onRetry}
            >
              <Text style={styles.action}>
                Retry recommendation
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}


      {/* RECOMMENDATION */}
      {recommendation && (
        <>


          {/* ENVIRONMENT SUMMARY */}
          {showOverview && recommendation.environmentSummary && (
            <View style={styles.section}>
              <Text style={styles.label}>
                Forecast conditions
              </Text>

              {[
                [
                  "Peak temperature",
                  recommendation.environmentSummary.peakTemperatureC,
                  "°C",
                ],
                [
                  "Feels like",
                  recommendation.environmentSummary.peakApparentTemperatureC,
                  "°C",
                ],
                [
                  "Peak UV",
                  recommendation.environmentSummary.peakUvIndex,
                  "",
                ],
                [
                  "Heat category",
                  recommendation.environmentSummary.heatCategory,
                  "",
                ],
                [
                  "UV category",
                  recommendation.environmentSummary.uvCategory,
                  "",
                ],
              ]
                .filter(
                  ([, value]) =>
                    value !== null &&
                    value !== undefined
                )
                .map(
                  ([label, value, unit]) => (
                    <Text
                      key={label}
                      style={styles.note}
                    >
                      {label}: {value}{unit}
                    </Text>
                  )
                )}
            </View>
          )}


          {/* MAIN RECOMMENDATION */}
          {showOverview && (
            <Text style={styles.recommendation}>
              {
                advice.recommendation ||
                recommendation.shortRecommendation
              }
            </Text>
          )}


          {/* FALLBACK MESSAGE */}
          {showOverview && recommendation.recommendationStatus === "fallback" && (
            <Text
              accessibilityRole="status"
              style={styles.note}
            >
              Using forecast-based guidance for this recommendation.
            </Text>
          )}


          {/* SUMMARY */}
          {showOverview && !!advice.summary && (
            <Text style={styles.note}>
              {advice.summary}
            </Text>
          )}


          {/* ACTIONS */}
          {!!actions.length && !enableSpeech && (
            <Text style={styles.label}>
              What to do
            </Text>
          )}

          <View style={styles.actionList}>
            {actions.map(
              (item, index) => {
                const icon = getAdviceIcon(item);

                return (
                  <View
                    key={`action-${index}`}
                    style={styles.actionCard}
                  >
                    <View
                      style={[
                        styles.actionIcon,
                        { backgroundColor: theme.color(icon.backgroundColor, 'backgroundColor') },
                      ]}
                    >
                      <Ionicons
                        name={icon.name}
                        size={24}
                        color={theme.color(icon.color)}
                      />
                    </View>

                    <Text style={styles.actionText}>
                      {item}
                    </Text>
                  </View>
                );
              }
            )}
          </View>


          {/* ALTERNATIVE TIME */}
          {acceptedRecommendedTime && (
            <View style={styles.timeUpdatedNote} accessibilityRole="status">
              <Ionicons name="checkmark-circle-outline" size={20} color={theme.color("#6841B5")} />
              <Text style={styles.timeUpdatedText}>Time updated. Guidance reflects the new time.</Text>
            </View>
          )}
          {!acceptedRecommendedTime && recommendation.alternativeTimeRecommended &&
            recommendation.suggestedAlternativeTime && (
              <View style={styles.alternativeCard}>
                <View style={styles.alternativeMain}>
                  <View style={styles.alternativeIcon}>
                    <Ionicons name="time-outline" size={26} color={theme.color("#6841B5")} />
                  </View>
                  <View style={styles.alternativeText}>
                    <Text style={styles.alternativeTitle}>
                      Suggested alternative time
                    </Text>
                    <Text style={styles.alternativeTime}>
                      {formatAlternativeTime(recommendation.suggestedAlternativeTime)}
                    </Text>
                    <Text style={styles.alternativeHint}>Lower UV period</Text>
                  </View>
                </View>
                {typeof onChangeToRecommendedTime === "function" && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Use suggested alternative time"
                    style={styles.changeTimeButton}
                    onPress={onChangeToRecommendedTime}
                  >
                    <Text style={styles.changeTimeButtonText}>
                      Use this time
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
        </>
      )}
    </View>
  );
}


const baseStyles = StyleSheet.create({
  content: {
    gap: 14,
  },

  section: {
    gap: 6,
  },

  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#666666",
  },

  recommendationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  recommendationHeadingText: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },

  recommendationTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    color: "#173C31",
  },

  recommendationSubtitle: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 20,
    color: "#60736A",
  },

  speechButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DCE8E2",
    backgroundColor: "#FFFFFF",
  },

  note: {
    fontSize: 14,
    lineHeight: 21,
    color: "#666666",
  },

  recommendation: {
    fontSize: 16,
    lineHeight: 24,
    color: "#222222",
  },

  action: {
    color: "#39775F",
    fontSize: 15,
    fontWeight: "600",
  },

  actionList: {
    gap: 10,
  },

  actionCard: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E1E9E5",
    backgroundColor: "#FFFFFF",
  },

  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  actionText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
    color: "#173C31",
  },

  alternativeCard: {
    minHeight: 88,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DED4FA",
    backgroundColor: "#F5F0FF",
  },

  alternativeMain: {
    flexDirection: "row",
    alignItems: "center",
  },

  alternativeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E9DEFF",
  },

  alternativeText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },

  alternativeTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: "#241348",
  },

  alternativeTime: {
    marginTop: 1,
    fontSize: 14,
    lineHeight: 20,
    color: "#514369",
  },

  alternativeHint: {
    fontSize: 13,
    lineHeight: 18,
    color: "#6841B5",
  },

  timeUpdatedNote: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DED4FA",
    backgroundColor: "#F5F0FF",
  },

  timeUpdatedText: {
    flex: 1,
    fontSize: 14,
    color: "#514369",
  },

  changeTimeButton: {
    alignSelf: "center",
    minWidth: 160,
    minHeight: 48,
    marginTop: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BCA7ED",
    backgroundColor: "#FBF9FF",
    alignItems: "center",
    justifyContent: "center",
  },

  changeTimeButtonText: {
    color: "#56339F",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

  retryButton: {
    minHeight: 40,
    justifyContent: "center",
    alignSelf: "flex-start",
  },

  changeTimeButton: {
    minHeight: 50,
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: "#39775F",
    alignItems: "center",
    justifyContent: "center",
  },

  changeTimeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
