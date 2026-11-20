import { useThemedStyles } from "../theme/useAppTheme";
import React, { useRef, useState } from "react";
import { Image, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { scenarios } from "../data/scenarios";
import LearningHint from "../components/LearningHint";

// All four views share the same page layout and styles.
// Wrap each scenario view in a shared header and scrollable page, using its supplied back action.
function ScenarioPage({ title, onBack, children, pageKey, showsTabBar = false }) {
  const { styles, theme } = useThemedStyles(baseStyles);
  return (
    <SafeAreaView style={[styles.safeArea, Platform.OS === "web" && styles.webOuter]}>
      <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
      {/* A changing pageKey remounts the scroll view so a new question starts at the top. */}
      <ScrollView style={Platform.OS === "web" ? styles.webColumn : undefined} key={pageKey} contentContainerStyle={[styles.page, showsTabBar && styles.pageWithTabs]}>
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={theme.color("#182131")} />
          </TouchableOpacity>
          <Text accessibilityRole="header" style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

// Show the scenario topics, question count, and estimated learning time.
function ScenarioInformation({ scenario }) {
  const { styles, theme } = useThemedStyles(baseStyles);
  return (
    <View style={styles.information}>
      <View style={styles.tags}>
        {scenario.tags.map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}
      </View>
      <Text style={styles.caption}>{scenario.questions.length} questions · {scenario.estimatedTime}</Text>
    </View>
  );
}

// List available scenarios and show completion from the progress state held in App.
export function ScenarioLearningScreen({ navigation, completedScenarioIds }) {
  const { styles, theme } = useThemedStyles(baseStyles);
  return (
    <ScenarioPage title="Scenario Learning" onBack={() => navigation.goBack()} showsTabBar>
      <View style={[styles.card, styles.blueCard]}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Your Progress</Text>
        <Text style={styles.body}>{completedScenarioIds.length} of {scenarios.length} scenarios completed</Text>
      </View>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Scenario List</Text>
      {/* Each card opens details using its stable scenario ID and displays any saved completion. */}
      {scenarios.map((scenario) => (
        <TouchableOpacity
          key={scenario.id}
          style={styles.card}
          accessibilityRole="button"
          accessibilityLabel={`${scenario.title}${completedScenarioIds.includes(scenario.id) ? ", completed" : ""}`}
          onPress={() => navigation.navigate("ScenarioDetails", { scenarioId: scenario.id })}
        >
          <View style={styles.cardHeading}>
            <Image source={scenario.image} style={styles.thumbnail} resizeMode="cover" accessibilityLabel={scenario.title} />
            <Text style={[styles.sectionTitle, styles.flexText]}>{scenario.title}</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.color("#70798A")} />
          </View>
          <Text style={styles.body}>{scenario.shortDescription}</Text>
          <ScenarioInformation scenario={scenario} />
          {completedScenarioIds.includes(scenario.id) && <Text style={styles.completed}>✓ Completed</Text>}
        </TouchableOpacity>
      ))}
    </ScenarioPage>
  );
}

// Show the selected scenario context before starting its questions.
export function ScenarioDetailsScreen({ navigation, route }) {
  const { styles, theme } = useThemedStyles(baseStyles);
  // Find the scenario using the ID passed through the navigation route.
  const scenario = scenarios.find((item) => item.id === route.params.scenarioId);

  return (
    <ScenarioPage title="Scenario Details" onBack={() => navigation.goBack()} showsTabBar>
      <View style={[styles.card, styles.blueCard]}>
        <Text accessibilityRole="header" style={styles.title}>{scenario.title}</Text>
        <Image source={scenario.image} style={styles.scenarioImage} resizeMode="cover" accessibilityLabel={scenario.title} />
        <ScenarioInformation scenario={scenario} />
        <Text style={styles.body}>{scenario.longDescription}</Text>
      </View>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>What user is doing in that scenario</Text>
        <Text style={styles.body}>{scenario.activity}</Text>
      </View>
      {/* Carry the same scenario ID to the question route so it loads the matching questions. */}
      <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={() => navigation.navigate("ScenarioQuestion", { scenarioId: scenario.id })}>
        <Text style={styles.buttonText}>Start Scenario</Text>
      </TouchableOpacity>
    </ScenarioPage>
  );
}

// Check each decision and allow retries until the learner chooses the correct answer.
export function ScenarioQuestionScreen({ navigation, route, onComplete }) {
  const { styles, theme } = useThemedStyles(baseStyles);
  const scenario = scenarios.find((item) => item.id === route.params.scenarioId);
  // Track the current question position within this scenario.
  const [questionIndex, setQuestionIndex] = useState(0);
  // Use null for an unanswered question; otherwise store the selected option position.
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null);
  // Keep the submitted feedback separate from selection until it is acknowledged.
  const [feedback, setFeedback] = useState(null);
  // Only wrong Check submissions count; dismissing feedback keeps the current question's count.
  const [incorrectAttempts, setIncorrectAttempts] = useState(0);
  // Refs update immediately, preventing duplicate clicks before the next render.
  const feedbackRef = useRef(null);
  const finishedRef = useRef(false);
  const question = scenario.questions[questionIndex];
  const hasAnswered = selectedOptionIndex !== null;

  // Allow changing the selection before Check, but lock it while feedback is open.
  function selectOption(index) {
    if (feedbackRef.current || finishedRef.current) return;
    setSelectedOptionIndex(index);
  }

  // Evaluate a selected option only when Check is pressed.
  function checkAnswer() {
    if (!hasAnswered || feedbackRef.current || finishedRef.current) return;
    const checkedAnswer = {
      correct: selectedOptionIndex === question.correctOptionIndex,
      explanation: question.options[selectedOptionIndex].feedback,
    };
    feedbackRef.current = checkedAnswer;
    if (!checkedAnswer.correct) setIncorrectAttempts((attempts) => attempts + 1);
    setFeedback(checkedAnswer);
  }

  // Close incorrect feedback and allow another attempt on the same question.
  function retryQuestion() {
    if (!feedbackRef.current || feedbackRef.current.correct) return;
    feedbackRef.current = null;
    setFeedback(null);
    setSelectedOptionIndex(null);
  }

  // Count a correct decision once, then move forward or complete the scenario.
  function nextQuestion() {
    if (!feedbackRef.current?.correct || finishedRef.current) return;
    // Consume the feedback immediately so repeated Continue clicks cannot skip questions.
    feedbackRef.current = null;
    setFeedback(null);
    // Clear the earned hint when a correct decision is accepted, including the final one.
    setIncorrectAttempts(0);
    if (questionIndex === scenario.questions.length - 1) {
      finishedRef.current = true;
      // All decisions have now been answered correctly and their feedback acknowledged.
      onComplete(scenario.id);
      // Remove the finished questions and details from the back stack.
      navigation.popTo("ScenarioLearning");
      navigation.navigate("ScenarioComplete", { scenarioId: scenario.id });
    } else {
      setQuestionIndex(questionIndex + 1);
      // Clear the previous selection so the next question starts unanswered.
      setSelectedOptionIndex(null);
    }
  }

  return (
    <ScenarioPage title={scenario.title} onBack={() => navigation.goBack()} pageKey={questionIndex}>
      <Text style={styles.questionNumber}>Question {questionIndex + 1} of {scenario.questions.length}</Text>
      {/* A decision counts only after correct feedback is acknowledged with Continue. */}
      <Text style={styles.caption}>{questionIndex} of {scenario.questions.length} decisions completed</Text>
      <View style={[styles.card, styles.blueCard]}>
        <Text accessibilityRole="header" style={styles.title}>{question.title}</Text>
        <Text style={styles.body}>{question.description}</Text>
      </View>
      {/* Show a neutral selection until Check evaluates it; lock choices only during feedback. */}
      {question.options.map((option, index) => (
        <TouchableOpacity
          key={index}
          accessibilityRole="radio"
          accessibilityState={{ checked: selectedOptionIndex === index, disabled: !!feedback }}
          disabled={!!feedback}
          style={[styles.option, selectedOptionIndex === index && styles.blueCard]}
          onPress={() => selectOption(index)}
        >
          <Ionicons name={selectedOptionIndex === index ? "radio-button-on" : "radio-button-off"} size={22} color={theme.color("#39775F")} />
          <Text style={[styles.body, styles.flexText]}>{option.text}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ disabled: !hasAnswered || !!feedback }}
        disabled={!hasAnswered || !!feedback}
        onPress={checkAnswer}
        style={[styles.primaryButton, (!hasAnswered || !!feedback) && styles.disabledButton]}
      >
        <Text style={styles.buttonText}>Check</Text>
      </TouchableOpacity>
      {/* After I Understand, leave the earned hint visible while choosing another answer. */}
      {!feedback && incorrectAttempts >= 3 && <LearningHint hint={question.hint} />}
      {/* Modal blocks the question underneath on web and mobile; long feedback can scroll. */}
      <Modal visible={!!feedback} transparent animationType="fade" onRequestClose={retryQuestion}>
        <View style={styles.modalOverlay}>
          <View accessibilityViewIsModal style={styles.modalCard}>
            <ScrollView contentContainerStyle={styles.modalContent} bounces={false}>
              <View accessibilityLiveRegion="polite" style={[styles.card, feedback?.correct ? styles.correctOption : styles.incorrectOption]}>
                <Text accessibilityRole="header" style={styles.title}>{feedback?.correct ? "Good Choice" : "Incorrect"}</Text>
                <Text style={styles.body}>{feedback?.explanation}</Text>
              </View>
              {/* Popup opening/closing never increments the count; only Check does. */}
              {feedback && !feedback.correct && incorrectAttempts >= 3 && <LearningHint hint={question.hint} />}
              <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={feedback?.correct ? nextQuestion : retryQuestion}>
                <Text style={styles.buttonText}>{feedback?.correct ? "Continue" : "I Understand"}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScenarioPage>
  );
}

// Show the completed scenario message and takeaway, with a return action to the scenario list.
export function ScenarioCompleteScreen({ navigation, route }) {
  const { styles, theme } = useThemedStyles(baseStyles);
  const scenario = scenarios.find((item) => item.id === route.params.scenarioId);

  return (
    <ScenarioPage title="Scenario Complete" onBack={() => navigation.popTo("ScenarioLearning")}>
      <View style={[styles.card, styles.completionCard]}>
        <Ionicons name="checkmark-circle" size={56} color={theme.color("#39775F")} />
        <Text accessibilityRole="header" style={styles.title}>{scenario.title}</Text>
        <Text style={styles.body}>{scenario.completionMessage}</Text>
        {/* Completion requires every decision to be correct, including answers retried earlier. */}
        <Text style={styles.sectionTitle}>Your Result</Text>
        <Text style={styles.body}>{scenario.questions.length} / {scenario.questions.length} decisions answered correctly</Text>
      </View>
      <View style={[styles.card, styles.takeawayCard]}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Key Takeaway</Text>
        <Text style={styles.body}>{scenario.keyTakeaway}</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={() => navigation.popTo("ScenarioLearning")}>
        <Text style={styles.buttonText}>Try another scenario</Text>
      </TouchableOpacity>
      {/* Return to the existing dashboard, which reads the shared completion state from App. */}
      <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={() => navigation.popTo("LearningHome")}>
        <Text style={styles.buttonText}>Back to Education</Text>
      </TouchableOpacity>
    </ScenarioPage>
  );
}

const baseStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#EEF2F0" },
  // Constrain only the web scroll viewport; its background fills the full column height.
  webColumn: { flex: 1, minHeight: 0, height: 0, width: "100%", maxWidth: 430, alignSelf: "center", backgroundColor: "#EEF2F0", overflowX: "hidden" },
  // Match NearbyCoolingScreen.web.js: its outer background is also #EEF2F0.
  webOuter: { backgroundColor: "#EEF2F0", alignItems: "center" },
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
  cardHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  thumbnail: { width: "30%", maxWidth: 96, height: "auto", aspectRatio: 3 / 2, borderRadius: 10 },
  scenarioImage: { width: "100%", height: "auto", aspectRatio: 3 / 2, borderRadius: 12 },
  body: { fontSize: 14, lineHeight: 22, color: "#43506A" },
  caption: { fontSize: 12, lineHeight: 18, color: "#657386" },
  information: { gap: 10 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { fontSize: 12, color: "#7050A0", backgroundColor: "#EFE8FC", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  completed: { fontSize: 13, fontWeight: "600", color: "#39775F" },
  questionNumber: { fontSize: 14, fontWeight: "600", color: "#50617B" },
  option: { backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#DDE2EA", borderRadius: 14, padding: 16, minHeight: 56 },
  flexText: { flex: 1 },
  correctOption: { backgroundColor: "#EEF6F2", borderColor: "#8DB5A5" },
  incorrectOption: { backgroundColor: "#FFF0F0", borderColor: "#E9A6AA" },
  primaryButton: { backgroundColor: "#39775F", borderRadius: 14, minHeight: 54, padding: 16, justifyContent: "center", alignItems: "center" },
  // Match the existing content width and constrain the popup height on smaller screens.
  modalOverlay: { flex: 1, backgroundColor: "rgba(24,33,49,0.45)", justifyContent: "center", alignItems: "center", padding: 16 },
  modalCard: { width: "100%", maxWidth: 430, maxHeight: "85%", backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden" },
  modalContent: { padding: 16, gap: 16 },
  disabledButton: { opacity: 0.45 },
  buttonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF", textAlign: "center" },
  completionCard: { backgroundColor: "#EEF6F2", borderColor: "#8DB5A5", alignItems: "center" },
  takeawayCard: { backgroundColor: "#FBF6EC", borderColor: "#F1E6D5" },
});
