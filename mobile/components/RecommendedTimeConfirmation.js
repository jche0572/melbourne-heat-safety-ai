import { useThemedStyles } from "../theme/useAppTheme";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function RecommendedTimeConfirmation({ onCancel, onConfirm, error }) {
  const { styles, theme } = useThemedStyles(baseStyles);
  return (
    <View style={styles.card} accessibilityViewIsModal>
      <Text accessibilityRole="header" style={styles.title}>
        Change activity time?
      </Text>
      <Text style={styles.message}>
        This will update the saved event and refresh its recommendation.
      </Text>
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      )}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Change to recommended time"
        style={styles.confirmButton}
        onPress={onConfirm}
      >
        <Text style={styles.confirmText}>Change Time</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Keep current time"
        style={styles.cancelButton}
        onPress={onCancel}
      >
        <Text style={styles.cancelText}>Keep Current Time</Text>
      </TouchableOpacity>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: 390,
    padding: 24,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    color: "#173C31",
  },
  message: {
    marginTop: 10,
    marginBottom: 20,
    fontSize: 16,
    lineHeight: 23,
    color: "#60736A",
  },
  error: {
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
    color: "#B42318",
  },
  confirmButton: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#39775F",
  },
  confirmText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cancelButton: {
    minHeight: 50,
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#B8C8C1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#39775F",
  },
});
