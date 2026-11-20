import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Render hints in normal scrollable content, using the existing Education information colours.
export default function LearningHint({ hint }) {
  if (!hint) return null;
  return (
    <View accessibilityLiveRegion="polite" style={styles.panel}>
      <View style={styles.heading}>
        <Ionicons name="bulb-outline" size={20} color="#39775F" accessible={false} />
        <Text accessibilityRole="header" style={styles.title}>Hint</Text>
      </View>
      <Text style={styles.body}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: "#EBF3FF", borderWidth: 1, borderColor: "#D1E3FF", borderRadius: 16, padding: 16, gap: 12 },
  heading: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "600", color: "#182131" },
  body: { fontSize: 14, lineHeight: 22, color: "#43506A" },
});
