import { useThemedStyles } from "../theme/useAppTheme";
import React, { useEffect, useRef, useState } from "react";
import { Image, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { visualActivities } from "../data/visualLearning";
import LearningHint from "../components/LearningHint";

// Run the image activities and report successful answers to the shared Education progress.
export default function VisualLearningScreen({ navigation, completedActivities = [], onActivityComplete }) {
  const { styles, theme } = useThemedStyles(baseStyles);
  // Choose which view is visible: the overview, an activity, or the completion message.
  const [stage, setStage] = useState("introduction");
  // Store the zero-based position in visualActivities, rather than the activity ID.
  const [currentActivity, setCurrentActivity] = useState(0);
  // Store selected item indexes for activities that allow more than one answer.
  const [selectedItems, setSelectedItems] = useState([]);
  // Keep the current feedback text; null means no feedback is shown yet.
  const [feedback, setFeedback] = useState(null);
  // Lock the current activity after a correct answer or when reopening a completed activity.
  const [completed, setCompleted] = useState(false);
  // Count only submitted wrong answers for the currently opened activity, not selection changes.
  const [incorrectAttempts, setIncorrectAttempts] = useState(0);
  // Lock immediately on success so queued clicks on now-disabled controls cannot count twice.
  const completedRef = useRef(false);
  // Read the content and answer rules for the currently selected activity.
  const activity = visualActivities[currentActivity];
  // Use these category names to group the activity links in the overview.
  const categories = ["Spot the Risk", "Choose What to Bring", "Find Cooling Area / Shade"];
  const scrollRef = useRef(null);
  const showScrollArrows = Platform.OS === "web" && stage === "introduction";

  // Move the existing web scroll container without replacing its native scrollbar or gestures.
  function scrollActivityList(direction) {
    const node = scrollRef.current?.getScrollableNode();
    if (!node) return;
    if (typeof node.scrollBy === "function") {
      node.scrollBy({ top: direction * 180, behavior: "smooth" });
    } else {
      // Older browsers can still scroll when smooth scrolling is unavailable.
      node.scrollTop += direction * 180;
    }
  }

  useEffect(() => {
    navigation.setParams({ tabBarHidden: stage !== "introduction" });
  }, [navigation, stage]);

  // Open an activity and restore its successful state if it was already completed.
  function openActivity(index) {
    const next = visualActivities[index];
    // Check the shared completion list so revisiting an activity does not lose its progress.
    const wasCompleted = completedActivities.includes(next.id);
    setIncorrectAttempts(0);
    completedRef.current = wasCompleted;
    setCurrentActivity(index);
    // Restore correct item selections for completed item activities; tap activities need no item list.
    setSelectedItems(wasCompleted ? next.correctItemIndexes || [] : []);
    // Show saved success feedback for completed activities, or clear feedback for a new attempt.
    setFeedback(wasCompleted ? next.correctFeedback : null);
    setCompleted(wasCompleted);
    setStage("activity");
  }

  // Handle both image taps and item answers, and record progress only for correct answers.
  function checkAnswer(correct) {
    // Ignore further answers once this activity is complete to avoid repeated completion updates.
    if (completedRef.current) return;
    completedRef.current = correct;
    setCompleted(correct);
    if (correct) {
      // Send the stable activity ID to App so the dashboard can include it in progress.
      onActivityComplete(activity.id);
    } else {
      setIncorrectAttempts((attempts) => attempts + 1);
    }
    // Some activities only provide correct feedback in the PDF.
    setFeedback(correct ? activity.correctFeedback : activity.incorrectFeedback || "Try again.");
  }

  // Select or deselect one item while the learner is still working on the answer.
  function toggleItem(index) {
    if (completed) return;
    // Use the latest selection list: remove an existing index or add a new one.
    setSelectedItems((items) => items.includes(index)
      ? items.filter((item) => item !== index)
      : [...items, index]);
    // Clear the previous attempt message when the learner changes their choices.
    setFeedback(null);
  }

  // Accept an item answer only when it contains every required choice and no extra choices.
  function checkItems() {
    // Matching the count prevents extra choices; checking every index makes selection order irrelevant.
    const correct = selectedItems.length === activity.correctItemIndexes.length
      && activity.correctItemIndexes.every((index) => selectedItems.includes(index));
    checkAnswer(correct);
  }

  // Move forward after success, or choose the appropriate ending after the last activity.
  function nextActivity() {
    // Require a correct answer before allowing the learner to move forward.
    if (!completed) return;
    if (currentActivity === visualActivities.length - 1) {
      // Reaching the last activity is not enough: all activities must be completed to show the final screen.
      if (completedActivities.length === visualActivities.length) {
        setStage("complete");
      } else {
        setStage("introduction");
      }
    } else {
      openActivity(currentActivity + 1);
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, Platform.OS === "web" && styles.webOuter]}>
      {/* Apply browser scrollbar rules only on web; native platforms use their own scroll indicators. */}
      {Platform.OS === "web" && React.createElement("style", null, `
        #visual-learning-scroll::-webkit-scrollbar { width: 10px; }
        #visual-learning-scroll::-webkit-scrollbar-track { background: ${theme.colors.background}; }
        #visual-learning-scroll::-webkit-scrollbar-thumb {
          background: #8A96A8;
          border: 3px solid ${theme.colors.background};
          border-radius: 6px;
        }
        #visual-learning-scroll::-webkit-scrollbar-thumb:hover { background: #657386; }
        ${showScrollArrows ? `
          #visual-learning-scroll::-webkit-scrollbar-track { margin-top: 18px; margin-bottom: 18px; }
          #visual-learning-scroll::-webkit-scrollbar-button { display: none; }
        ` : ""}
        @supports not selector(::-webkit-scrollbar) {
          #visual-learning-scroll { scrollbar-color: #8A96A8 ${theme.colors.background}; scrollbar-width: auto; }
        }
      `)}
      <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
      <View style={Platform.OS === "web" ? styles.webViewport : styles.nativeViewport}>
      {/* Changing the key remounts the scroll view so each new stage or activity starts at the top. */}
      <ScrollView
        ref={scrollRef}
        key={`${stage}-${currentActivity}`}
        nativeID="visual-learning-scroll"
        contentContainerStyle={[styles.page, stage === "introduction" && styles.pageWithTabs]}
        showsVerticalScrollIndicator
        style={Platform.OS === "web" ? styles.webScroll : undefined}
      >
        <View style={styles.header}>
          {/* Inside an activity, Back opens the overview; elsewhere, it returns to the previous navigation screen. */}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={stage === "activity" ? "Back to Visual Learning overview" : "Back to Learning"} onPress={() => stage === "activity" ? setStage("introduction") : navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={theme.color("#182131")} />
          </TouchableOpacity>
          <Text accessibilityRole="header" style={styles.headerTitle}>Visual Learning</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Build the overview from categories and the matching activity data. */}
        {stage === "introduction" && (
          <>
            <Text style={styles.body}>Learn heat and UV safety through interactive images.</Text>
            {categories.map((category, index) => (
              <View key={category} style={styles.card}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>Category {index + 1} — {category}</Text>
                <Text style={styles.caption}>3 activities</Text>
                {/* Filter for this category, but open activities using their position in the full activity array. */}
                {visualActivities.filter((item) => item.category === category).map((item, rowIndex) => (
                  <TouchableOpacity
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open Activity ${item.id}: ${item.name}`}
                    onPress={() => openActivity(visualActivities.indexOf(item))}
                    style={[styles.activityLink, rowIndex > 0 && styles.activityDivider]}
                  >
                    <Image source={item.image} resizeMode="contain" style={styles.activityThumbnail} accessible={false} />
                    <Text style={[styles.body, styles.itemText]}>{item.id}. {item.name}</Text>
                    <Text style={styles.activityChevron} accessible={false}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </>
        )}

        {/* Render the instructions and interaction controls for the selected activity. */}
        {stage === "activity" && (
          <>
            <Text style={styles.caption}>Activity {currentActivity + 1} of {visualActivities.length} · {activity.category}</Text>
            <View style={[styles.card, styles.blueCard]}>
              <Text accessibilityRole="header" style={styles.title}>{activity.title}</Text>
              <Text style={styles.caption}>{activity.name}</Text>
              <Text style={styles.body}>{activity.description}</Text>
            </View>

            {/* The image keeps its original ratio so percentage tap areas do not move. */}
            <View style={[styles.imageFrame, { aspectRatio: activity.aspectRatio }]}>
              <Image source={activity.image} resizeMode="contain" style={styles.image} accessibilityLabel={activity.name} />
              {/* Tap activities layer a correct target above an image-wide area that handles incorrect taps. */}
              {activity.type === "tap" && (
                <>
                  {/* The full-image press area gives retry feedback when the learner taps outside the correct target. */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Activity image: tap an area"
                    disabled={completed}
                    onPress={() => checkAnswer(false)}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <Pressable
                    accessibilityRole="button"
                    // Describe the correct target to assistive technology without adding visible instructions.
                    accessibilityLabel={activity.correctInteraction}
                    accessibilityState={{ disabled: completed }}
                    disabled={completed}
                    onPress={() => checkAnswer(true)}
                    style={[
                      styles.tapArea,
                      {
                        // Position the target as percentages of the image frame so it scales with the image.
                        left: `${activity.tapArea.left}%`, top: `${activity.tapArea.top}%`,
                        width: `${activity.tapArea.width}%`, height: `${activity.tapArea.height}%`,
                      },
                      // Reveal the successful target after completion to reinforce the correct location.
                      completed && styles.correctTapArea,
                    ]}
                  />
                </>
              )}
            </View>

            {/* Item activities use selectable rows; checkbox state and highlighting follow selectedItems. */}
            {activity.type === "items" && (
              <>
                {activity.items.map((item, index) => (
                  <TouchableOpacity
                    key={item}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selectedItems.includes(index), disabled: completed }}
                    disabled={completed}
                    onPress={() => toggleItem(index)}
                    style={[styles.item, selectedItems.includes(index) && styles.selectedItem]}
                  >
                    <Ionicons name={selectedItems.includes(index) ? "checkbox" : "square-outline"} size={22} color={theme.color("#39775F")} />
                    <Text style={[styles.body, styles.itemText]}>{item}</Text>
                  </TouchableOpacity>
                ))}
                {/* Keep the check button available for retries and hide it after a correct answer. */}
                {!completed && (
                  <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={checkItems}>
                    <Text style={styles.buttonText}>Check Answer</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Show success or retry feedback and announce updates politely to screen readers. */}
            {feedback && (
              <View accessibilityLiveRegion="polite" style={[styles.card, completed ? styles.correctCard : styles.incorrectCard]}>
                <Text style={styles.body}>{feedback}</Text>
              </View>
            )}
            {/* Keep the hint available during retries without marking or highlighting an answer. */}
            {!completed && incorrectAttempts >= 3 && <LearningHint hint={activity.hint} />}
            {/* Allow a return to the previous activity; openActivity restores any saved completion. */}
            {currentActivity > 0 && (
              <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={() => openActivity(currentActivity - 1)}>
                <Text style={styles.buttonText}>Previous Activity</Text>
              </TouchableOpacity>
            )}
            {/* After success, offer the next activity or an ending based on the shared completion count. */}
            {completed && (
              <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={nextActivity}>
                <Text style={styles.buttonText}>{currentActivity === visualActivities.length - 1
                  ? completedActivities.length === visualActivities.length ? "Finish Learning" : "Back to Overview"
                  : "Next Activity"}</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Show the final summary once the learner has completed the full visual activity set. */}
        {stage === "complete" && (
          <>
            <View style={[styles.card, styles.correctCard]}>
              <Ionicons name="checkmark-circle" size={56} color={theme.color("#39775F")} />
              <Text accessibilityRole="header" style={styles.title}>Visual Learning Complete</Text>
              <Text style={styles.body}>{visualActivities.length} / {visualActivities.length} activities completed</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={() => navigation.goBack()}>
              <Text style={styles.buttonText}>Back to Learning</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
      {/* Keep these controls outside the scrolling content so both arrows remain visible. */}
      {showScrollArrows && (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel="Scroll activity list up" onPress={() => scrollActivityList(-1)} style={[styles.scrollArrow, styles.scrollArrowUp]}>
            <Ionicons name="caret-up" size={12} color={theme.color("#657386")} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Scroll activity list down" onPress={() => scrollActivityList(1)} style={[styles.scrollArrow, styles.scrollArrowDown]}>
            <Ionicons name="caret-down" size={12} color={theme.color("#657386")} />
          </Pressable>
        </>
      )}
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#EEF2F0" },
  // Fill the browser viewport around the constrained learning column.
  webOuter: { backgroundColor: "#EEF2F0", alignItems: "center" },
  nativeViewport: { flex: 1 },
  webViewport: { flex: 1, minHeight: 0, width: "100%", maxWidth: 440, alignSelf: "center", backgroundColor: "#EEF2F0", position: "relative", overflow: "hidden" },
  scrollArrow: { position: "absolute", right: 0, width: 18, height: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F7FA", zIndex: 1 },
  scrollArrowUp: { top: 0 },
  scrollArrowDown: { bottom: 0 },
  // Keep the 430px content column plus its native scrollbar in one centered viewport.
  webScroll: { flex: 1, minHeight: 0, height: 0, width: "100%", maxWidth: 440, alignSelf: "center", overflowY: "scroll", overflowX: "hidden" },
  page: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 28, gap: 16 },
  pageWithTabs: { paddingBottom: 112 },
  header: { flexDirection: "row", alignItems: "center" },
  backButton: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  headerSpacer: { width: 44 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "700", color: "#182131", textAlign: "center" },
  title: { fontSize: 20, lineHeight: 28, fontWeight: "700", color: "#182131" },
  sectionTitle: { fontSize: 16, lineHeight: 23, fontWeight: "700", color: "#182131" },
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9ECF0", borderRadius: 16, padding: 16, gap: 12 },
  blueCard: { backgroundColor: "#EBF3FF", borderColor: "#D1E3FF" },
  body: { fontSize: 14, lineHeight: 22, color: "#43506A" },
  activityLink: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 60 },
  activityDivider: { borderTopWidth: 1, borderTopColor: "#E9ECF0", paddingTop: 12 },
  activityThumbnail: { width: 76, height: 52, borderRadius: 8, backgroundColor: "#F5F7FA" },
  activityChevron: { fontSize: 22, color: "#657386" },
  caption: { fontSize: 12, lineHeight: 18, color: "#657386" },
  imageFrame: { width: "100%", borderRadius: 12, overflow: "hidden", position: "relative" },
  image: { width: "100%", height: "100%" },
  tapArea: { position: "absolute" },
  correctTapArea: { borderWidth: 3, borderColor: "#39775F", backgroundColor: "rgba(57,119,95,0.15)", borderRadius: 8 },
  item: { backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#DDE2EA", borderRadius: 14, padding: 14, minHeight: 50 },
  itemText: { flex: 1 },
  selectedItem: { backgroundColor: "#EEF6F2", borderColor: "#8DB5A5" },
  correctCard: { backgroundColor: "#EEF6F2", borderColor: "#8DB5A5" },
  incorrectCard: { backgroundColor: "#FFF0F0", borderColor: "#E9A6AA" },
  primaryButton: { backgroundColor: "#39775F", borderRadius: 14, minHeight: 54, padding: 16, justifyContent: "center", alignItems: "center" },
  buttonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF", textAlign: "center" },
});
