import React from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function EnvironmentalMetricCard({
  type,
  value,
  status,
  description,
  isUnavailable,
  dark = false,
}) {
  const { width } = useWindowDimensions();
  const compact = width < 430;
  const isHeat = type === "heat";
  const accentColor = isUnavailable
    ? "#616A67"
    : isHeat
      ? dark ? "#FFAE75" : "#D94B00"
      : dark ? "#AABEFF" : "#3653C9";
  const isLowRisk = status === "Normal" || status === "Low";
  const statusColor = isUnavailable
    ? "#4F5A56"
    : isLowRisk
      ? "#075C3D"
      : status === "Moderate"
        ? "#8A4B08"
        : "#9D231F";
  const statusBackground = isUnavailable
    ? "rgba(223, 230, 227, 0.9)"
    : isLowRisk
      ? "rgba(209, 242, 223, 0.92)"
      : status === "Moderate"
        ? "rgba(255, 235, 191, 0.94)"
        : "rgba(255, 217, 214, 0.94)";

  return (
    <View
      accessible
      accessibilityLabel={`${isHeat ? "Heat" : "UV"}: ${isUnavailable ? "unavailable" : `${value}, ${status}`}. ${description}`}
      style={[
        styles.card,
        compact && styles.compactCard,
        isUnavailable && styles.unavailableCard,
      ]}
    >
      <View style={styles.iconSlot}>
      <Ionicons
        name={isHeat ? "thermometer-outline" : "sunny-outline"}
        size={compact ? 32 : 38}
        color={accentColor}
      />
      </View>
      <View style={styles.details}>
      <Text style={[styles.metricLabel, dark && { color: "#E2ECE7" }]}>{isHeat ? "Heat" : "UV"}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={[
          styles.value,
          compact && styles.compactValue,
          { color: accentColor },
        ]}
      >
        {isUnavailable ? "—" : value}
      </Text>
      <View style={[styles.statusChip, { backgroundColor: statusBackground }]}>
        {!isUnavailable && isLowRisk && <Ionicons name="checkmark-circle" size={16} color={statusColor} />}
        <Text style={[styles.statusText, { color: statusColor }]}>
          {isUnavailable ? "Unavailable" : status}
        </Text>
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 92,
    flexDirection: "column",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  iconSlot: { height: 40, alignItems: "center", justifyContent: "center" },
  details: { alignSelf: "stretch", alignItems: "center", minWidth: 0 },

  unavailableCard: {
    opacity: 0.9,
  },

  compactCard: {
    gap: 5,
  },

  value: {
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 38,
    marginTop: 2,
    textAlign: "center",
    alignSelf: "stretch",
  },

  compactValue: {
    fontSize: 26,
    lineHeight: 34,
  },

  metricLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#173C31",
    marginTop: 4,
  },

  statusChip: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 5,
    marginTop: 4,
    minHeight: 30,
    paddingHorizontal: 10,
  },

  statusText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
