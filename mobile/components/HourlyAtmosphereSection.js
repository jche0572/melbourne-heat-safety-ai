import { useThemedStyles } from "../theme/useAppTheme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

// Presentation contract: [{ id, time, temperatureC, uvIndex, summary? }].
// Map future API responses to this shape outside the component.
export default function HourlyAtmosphereSection({ hours = [] }) {
  const { styles, theme } = useThemedStyles(baseStyles);
  const entries = hours ?? [];

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>AI Hourly Atmosphere</Text>
      <Text style={styles.caption}>
        Hourly forecast for this activity.
      </Text>
      {entries.length === 0 && <Text style={styles.caption}>No hourly atmosphere information available.</Text>}
      {entries.map((hour) => (
        <View key={hour.id} style={styles.card}>
          <Text style={styles.time}>{hour.time}</Text>
          <View style={styles.metrics}>
            <Text style={styles.metric}>Temperature: {Number.isFinite(hour.temperatureC) ? `${Math.round(hour.temperatureC)}°C` : "Unavailable"}</Text>
            <Text style={styles.metric}>UV index: {Number.isFinite(hour.uvIndex) ? hour.uvIndex.toFixed(1) : "Unavailable"}</Text>
          </View>
          {!!hour.summary && <Text style={styles.summary}>{hour.summary}</Text>}
        </View>
      ))}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  section: { gap: 12 },
  title: { fontSize: 22, fontWeight: "700", color: "#173C31" },
  caption: { fontSize: 14, lineHeight: 21, color: "#666666" },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "#B8C8C1", backgroundColor: "#FFFFFF", gap: 10 },
  time: { fontSize: 16, fontWeight: "700", color: "#173C31" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { fontSize: 14, color: "#173C31", backgroundColor: "#E8F2EE", padding: 8, borderRadius: 8 },
  summary: { fontSize: 14, lineHeight: 21, color: "#555555" },
});
