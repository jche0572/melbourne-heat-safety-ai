import React from "react";
import {
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function AlertCard({ content, dark = false }) {
  const title = content.title.toLowerCase();
  const iconName = !content.isRiskAlert
    ? "information-circle-outline"
    : title.includes("uv")
      ? "sunny-outline"
      : title.includes("heat")
        ? "thermometer-outline"
        : "warning-outline";

  return (
    <View
      accessible
      accessibilityLabel={
        `${content.title}. ${content.description}`
      }
      style={[
        styles.card,
        content.isRiskAlert
          ? styles.riskCard
          : styles.informationCard,
      ]}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name={iconName}
          size={22}
          color={dark ? content.isRiskAlert ? "#FFAE75" : "#9DDFBF" : content.isRiskAlert ? "#ED6500" : "#087658"}
        />
      </View>

      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            content.isRiskAlert ? styles.riskTitle : styles.informationTitle,
            dark && { color: content.isRiskAlert ? "#FFAE75" : "#E2ECE7" },
          ]}
        >
          {content.title}
        </Text>
        {content.isRiskAlert && <Text style={[styles.description, dark && { color: "#C4D5D1" }]}>{content.description}</Text>}
        {content.unavailableMessage ? (
          <Text style={[styles.unavailable, dark && { color: "#C4D5D1" }]}>{content.unavailableMessage}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  riskCard: {
    borderColor: "rgba(244, 127, 52, 0.45)",
  },
  informationCard: {
    borderColor: "rgba(80, 139, 113, 0.38)",
  },
  iconContainer: {
    width: 24,
    alignItems: "center",
    marginRight: 8,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
  },
  riskTitle: {
    color: "#D94B00",
  },
  informationTitle: {
    color: "#164C3B",
  },
  description: {
    fontSize: 14,
    color: "#3C4B46",
    lineHeight: 20,
  },
  unavailable: {
    fontSize: 13,
    color: "#333333",
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 3,
  },
});
