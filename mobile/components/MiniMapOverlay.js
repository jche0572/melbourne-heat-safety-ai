import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context";
import { shouldShowMiniMap } from "../utils/miniMapRoute";
import useBubbleDrag from "../utils/useBubbleDrag";

function NativeBubble({ snapshot, onRestore, onClose, launchError }) {
  const insets = useSafeAreaInsets();
  const drag = useBubbleDrag(insets);
  return <View pointerEvents="box-none" style={styles.layer}>
    {launchError && <Text pointerEvents="none" accessibilityRole="alert" style={[styles.error, { top: insets.top + 12, left: insets.left + 12 }]}>{launchError}</Text>}
    <View testID="mini-map-overlay" {...drag.panHandlers} pointerEvents="box-none" style={[styles.controls, { position: "absolute", left: drag.position.x, top: drag.position.y }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss cooling route"
        onPress={drag.press(onClose)} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
        <Ionicons name="close" size={22} color="#39775F" />
      </Pressable>
      <Pressable testID="cooling-route-bubble" accessibilityRole="button"
        accessibilityLabel={snapshot.mode === "googleMaps" ? "Reopen cooling route in Google Maps" : "Restore cooling route"}
        onPress={drag.press(onRestore)} style={({ pressed }) => [styles.bubble, pressed && styles.pressed]}>
        <Ionicons name="map-outline" size={26} color="#FFFFFF" />
      </Pressable>
    </View>
  </View>;
}

export default function MiniMapOverlay(props) {
  if (!shouldShowMiniMap(props.snapshot, props.currentScreen)) return null;
  // The overlay is outside NavigationContainer's safe-area context.
  return <SafeAreaProvider initialMetrics={initialWindowMetrics} pointerEvents="box-none" style={styles.layer}>
    <NativeBubble {...props} />
  </SafeAreaProvider>;
}

const shadow = { shadowColor: "#000000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 6 };
const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, zIndex: 1000, alignItems: "flex-end", justifyContent: "flex-end" },
  controls: { width: 54, alignItems: "center", gap: 8 },
  bubble: { ...shadow, width: 54, height: 54, borderRadius: 27, backgroundColor: "#39775F", alignItems: "center", justifyContent: "center" },
  close: { ...shadow, width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C8DDD1", alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.75 },
  error: { position: "absolute", right: 12, maxWidth: 260, backgroundColor: "#FFFFFF", color: "#8B2929", padding: 12, borderRadius: 8 },
});
