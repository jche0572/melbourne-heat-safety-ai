import { useThemedStyles } from "../theme/useAppTheme";
import React, { useRef, useState } from "react";
import { Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { quizQuestions } from "../data/quizQuestions";

// Run the quiz attempt, show answer explanations, and report completion to App.
export default function QuizScreen({ navigation, onComplete }) {
  const { styles, theme } = useThemedStyles(baseStyles);
  // Switch between introduction, questions, results, and the read-only answer review.
  const [stage, setStage] = useState("introduction");
  // Store the zero-based question position in the quiz data.
  const [currentQuestion, setCurrentQuestion] = useState(0);
  // Store the answer index, or null while the current question is unanswered.
  const [selectedOption, setSelectedOption] = useState(null);
  // Count correct answers in this attempt; shared module completion is tracked separately in App.
  const [score, setScore] = useState(0);
  // Keep each submitted option index for the current attempt, including incorrect answers.
  const [submittedAnswers, setSubmittedAnswers] = useState([]);
  // Immediate guards prevent rapid clicks from scoring twice or advancing more than once.
  const submittedAnswersRef = useRef([]);
  const lastAdvancedQuestionRef = useRef(-1);
  const completionReportedRef = useRef(false);
  // Load the current question and derive its answered and correctness flags from the selection.
  const question = quizQuestions[currentQuestion];
  const hasAnswered = selectedOption !== null;
  const isCorrect = selectedOption === question.correctOptionIndex;
  // Use the data length for question counts and convert the current score to a whole percentage.
  const totalQuestions = quizQuestions.length;
  const percentage = Math.round(score / totalQuestions * 100);

  // Save the first answer and add one point only if it matches the correct option index.
  function selectAnswer(optionIndex) {
    // Lock the first answer so each question can add at most one point.
    if (stage !== "questions" || hasAnswered || submittedAnswersRef.current[currentQuestion] !== undefined) return;
    submittedAnswersRef.current[currentQuestion] = optionIndex;
    setSubmittedAnswers((previousAnswers) => {
      const answers = [...previousAnswers];
      answers[currentQuestion] = optionIndex;
      return answers;
    });
    setSelectedOption(optionIndex);
    if (optionIndex === question.correctOptionIndex) {
      // Update from the latest score so each accepted correct answer adds exactly one point.
      setScore((previousScore) => previousScore + 1);
    }
  }

  // Move to the next unanswered question or finish the attempt and show results.
  function nextQuestion() {
    if (stage !== "questions" || !hasAnswered || lastAdvancedQuestionRef.current >= currentQuestion) return;
    lastAdvancedQuestionRef.current = currentQuestion;
    if (currentQuestion === totalQuestions - 1) {
      // Notify App that the quiz unit is complete, regardless of how many answers were correct.
      if (!completionReportedRef.current) {
        completionReportedRef.current = true;
        onComplete();
      }
      setStage("result");
    } else {
      setCurrentQuestion(currentQuestion + 1);
      // Remove the previous answer before the next question is displayed.
      setSelectedOption(null);
    }
  }

  // Reset the local attempt and start again; the shared completion flag in App remains recorded.
  function restartQuiz() {
    // Review never clears these records; only starting a new attempt resets them.
    setSubmittedAnswers([]);
    submittedAnswersRef.current = [];
    lastAdvancedQuestionRef.current = -1;
    completionReportedRef.current = false;
    setCurrentQuestion(0);
    setSelectedOption(null);
    setScore(0);
    setStage("questions");
  }

  // Open the saved attempt without changing its answers, score, or shared completion progress.
  function openReview() {
    if (stage === "result") setStage("review");
  }

  // Return to the same results rather than restarting the quiz or leaving Education.
  function backToResults() {
    if (stage === "review") setStage("result");
  }

  // Select encouragement using the existing score thresholds of eight and five correct answers.
  let resultMessage = "Keep learning! Review the heat and UV safety content and try again.";
  if (score >= 8) {
    resultMessage = "Great job! You have a strong understanding of heat and UV safety.";
  } else if (score >= 5) {
    resultMessage = "Good effort! Review the learning modules to strengthen your knowledge.";
  }

  return (
    <SafeAreaView style={[styles.safeArea, Platform.OS === "web" && styles.webOuter]}>
      <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
      {/* Remount the scroll view to start each question at the top. */}
      <ScrollView style={Platform.OS === "web" ? styles.webColumn : undefined} key={`${stage}-${currentQuestion}`} contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={stage === "review" ? "Back to Results" : "Back to Learning"} style={styles.backButton} onPress={stage === "review" ? backToResults : () => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={theme.color("#182131")} />
          </TouchableOpacity>
          <Text accessibilityRole="header" style={styles.headerTitle}>Heat &amp; UV Quiz</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Explain the quiz and start a fresh attempt through restartQuiz. */}
        {stage === "introduction" && (
          <>
            <View style={[styles.card, styles.blueCard]}>
              <Ionicons name="reader-outline" size={36} color={theme.color("#4D83FF")} />
              <Text accessibilityRole="header" style={styles.title}>{totalQuestions} Questions</Text>
              <Text style={styles.body}>Test your knowledge about staying safe in hot and high-UV conditions.</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={restartQuiz}>
              <Text style={styles.buttonText}>Start Quiz</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Render the current question and a progress bar that counts answered questions, not correct answers. */}
        {stage === "questions" && (
          <>
            <Text style={styles.questionNumber}>Question {currentQuestion + 1} of {totalQuestions}</Text>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Questions answered"
              accessibilityValue={{ min: 0, max: totalQuestions, now: currentQuestion + (hasAnswered ? 1 : 0) }}
              style={styles.track}
            >
              <View style={[styles.fill, { width: `${(currentQuestion + (hasAnswered ? 1 : 0)) / totalQuestions * 100}%` }]} />
            </View>
            <View style={[styles.card, styles.blueCard]}>
              <Text accessibilityRole="header" style={styles.title}>{question.title}</Text>
              <Text style={styles.body}>{question.description}</Text>
            </View>
            {/* Show one selectable row per option and lock all choices after the first answer. */}
            {question.options.map((option, index) => (
              <TouchableOpacity
                key={index}
                accessibilityRole="radio"
                accessibilityState={{ checked: selectedOption === index, disabled: hasAnswered }}
                disabled={hasAnswered}
                onPress={() => selectAnswer(index)}
                style={[styles.option, selectedOption === index && (isCorrect ? styles.correctOption : styles.incorrectOption)]}
              >
                <Ionicons name={selectedOption === index ? "radio-button-on" : "radio-button-off"} size={22} color={theme.color("#39775F")} />
                <Text style={[styles.body, styles.optionText]}>{option.text}</Text>
              </TouchableOpacity>
            ))}
            {/* After selection, show that option feedback and allow the learner to continue. */}
            {hasAnswered && (
              <>
                <View accessibilityLiveRegion="polite" style={[styles.card, isCorrect ? styles.correctOption : styles.incorrectOption]}>
                  <Text style={styles.sectionTitle}>{isCorrect ? "Correct" : "Incorrect"}</Text>
                  <Text style={styles.body}>{question.options[selectedOption].feedback}</Text>
                </View>
                <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={nextQuestion}>
                  <Text style={styles.buttonText}>{currentQuestion === totalQuestions - 1 ? "See Results" : "Next Question"}</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        {/* Show the score and percentage, then offer another attempt or a return to the dashboard. */}
        {stage === "result" && (
          <>
            <View style={[styles.card, styles.resultCard]}>
              <Ionicons name="checkmark-circle" size={56} color={theme.color("#39775F")} />
              <Text accessibilityRole="header" style={styles.title}>Quiz Complete!</Text>
              <Text style={styles.sectionTitle}>Your Score</Text>
              <Text style={styles.score}>{score} / {totalQuestions}</Text>
              <Text style={styles.sectionTitle}>{percentage}%</Text>
              <Text style={styles.body}>{resultMessage}</Text>
            </View>
            <View style={styles.card}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Review Answers</Text>
              <Text style={styles.body}>Total questions: {totalQuestions}</Text>
              <Text style={styles.body}>Correct answers: {score}</Text>
              <Text style={styles.body}>Incorrect answers: {totalQuestions - score}</Text>
              <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={openReview}>
                <Text style={styles.buttonText}>Review All Answers</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={restartQuiz}>
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.secondaryButton} onPress={() => navigation.goBack()}>
              <Text style={styles.secondaryButtonText}>Back to Learning</Text>
            </TouchableOpacity>
          </>
        )}

        {stage === "review" && (
          <>
            <Text accessibilityRole="header" style={styles.title}>Review Answers</Text>
            {quizQuestions.map((reviewQuestion, index) => {
              // Read the actual submitted index; never substitute a guessed user answer.
              const answerIndex = submittedAnswers[index];
              const selectedAnswer = Number.isInteger(answerIndex) ? reviewQuestion.options[answerIndex] : undefined;
              const correctAnswer = reviewQuestion.options[reviewQuestion.correctOptionIndex];
              const answeredCorrectly = !!selectedAnswer && answerIndex === reviewQuestion.correctOptionIndex;
              return (
                <View key={reviewQuestion.id} style={styles.card}>
                  <Text style={styles.questionNumber}>Question {index + 1} of {totalQuestions}</Text>
                  <Text accessibilityRole="header" style={styles.sectionTitle}>{reviewQuestion.title}</Text>
                  <Text style={styles.body}>{reviewQuestion.description}</Text>
                  <View style={[styles.card, !selectedAnswer ? styles.blueCard : answeredCorrectly ? styles.correctOption : styles.incorrectOption]}>
                    {selectedAnswer && <Ionicons name={answeredCorrectly ? "checkmark-circle" : "close-circle"} size={24} color={theme.color(answeredCorrectly ? "#39775F" : "#E9A6AA")} />}
                    <Text style={styles.sectionTitle}>{!selectedAnswer ? "Answer unavailable" : answeredCorrectly ? "Correct" : "Incorrect"}</Text>
                    <Text style={styles.body}>Your answer: {selectedAnswer?.text || "No answer was recorded for this question."}</Text>
                    {/* Wrong-choice feedback explains its risk; the correct-choice explanation explains the safer answer. */}
                    {selectedAnswer && !answeredCorrectly && <Text style={styles.body}>{selectedAnswer.feedback}</Text>}
                  </View>
                  <Text style={styles.sectionTitle}>Correct answer</Text>
                  <Text style={styles.body}>{correctAnswer.text}</Text>
                  <Text style={styles.sectionTitle}>Why this answer is safer</Text>
                  <Text style={styles.body}>{correctAnswer.feedback}</Text>
                </View>
              );
            })}
            <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={backToResults}>
              <Text style={styles.buttonText}>Back to Results</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#EEF2F0" },
  webColumn: { flex: 1, minHeight: 0, height: 0, width: "100%", maxWidth: 430, alignSelf: "center", backgroundColor: "#EEF2F0", overflowX: "hidden" },
  webOuter: { backgroundColor: "#EEF2F0", alignItems: "center" },
  page: { width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 28, gap: 16 },
  header: { flexDirection: "row", alignItems: "center" },
  backButton: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  headerSpacer: { width: 44 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "700", color: "#182131", textAlign: "center" },
  title: { fontSize: 20, lineHeight: 28, fontWeight: "700", color: "#182131" },
  sectionTitle: { fontSize: 16, lineHeight: 23, fontWeight: "700", color: "#182131" },
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9ECF0", borderRadius: 16, padding: 16, gap: 12 },
  blueCard: { backgroundColor: "#EBF3FF", borderColor: "#D1E3FF" },
  body: { fontSize: 14, lineHeight: 22, color: "#43506A" },
  questionNumber: { fontSize: 14, fontWeight: "600", color: "#50617B" },
  track: { height: 6, backgroundColor: "#D1E3FB", borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: "#4D83FF", borderRadius: 4 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#DDE2EA", borderRadius: 14, padding: 16, minHeight: 56 },
  optionText: { flex: 1 },
  correctOption: { backgroundColor: "#EEF6F2", borderColor: "#8DB5A5" },
  incorrectOption: { backgroundColor: "#FFF0F0", borderColor: "#E9A6AA" },
  primaryButton: { backgroundColor: "#39775F", borderRadius: 14, minHeight: 54, padding: 16, justifyContent: "center", alignItems: "center" },
  buttonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF", textAlign: "center" },
  secondaryButton: { borderColor: "#39775F", borderWidth: 1, borderRadius: 14, minHeight: 54, padding: 16, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { fontSize: 16, fontWeight: "600", color: "#39775F", textAlign: "center" },
  resultCard: { backgroundColor: "#EEF6F2", borderColor: "#8DB5A5", alignItems: "center" },
  score: { fontSize: 36, fontWeight: "700", color: "#182131" },
});
