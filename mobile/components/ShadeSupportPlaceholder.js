import { useThemedStyles } from "../theme/useAppTheme";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function ShadeSupportPlaceholder({ visible, onClose }) {
  const { styles, theme } = useThemedStyles(baseStyles);
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          accessibilityViewIsModal
          accessibilityLabel="Find shade nearby information"
          style={styles.dialog}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="map-outline" size={34} color={theme.color("#39775F")} />
          </View>

          <Text style={styles.title}>Find shade nearby</Text>
          <Text style={styles.message}>
            The shade map will open here when that feature is available.
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close find shade message"
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 26,
    alignItems: "center",
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#E4EFDA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    color: "#202020",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 9,
    textAlign: "center",
  },
  message: {
    color: "#333333",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 22,
  },
  closeButton: {
    minWidth: 120,
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: "#39775F",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  closeButtonPressed: {
    opacity: 0.8,
  },
  closeButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
});
