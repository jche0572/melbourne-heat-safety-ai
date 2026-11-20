import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { shouldShowMiniMap } from "../utils/miniMapRoute";
import useBubbleDrag from "../utils/useBubbleDrag";

export default function MiniMapOverlay({ snapshot, currentScreen, onRestore, onClose, launchError }) {
  const drag = useBubbleDrag();
  const [focused, setFocused] = useState(null);
  if (!shouldShowMiniMap(snapshot, currentScreen)) return null;

  return <View pointerEvents="box-none" style={styles.layer}>
    {launchError && <Text pointerEvents="none" accessibilityRole="alert" style={styles.error}>{launchError}</Text>}
    <View testID="mini-map-overlay" {...drag.panHandlers} pointerEvents="box-none" style={[styles.controls, { position: "absolute", left: drag.position.x, top: drag.position.y, touchAction: "none", userSelect: "none" }]}>
      <Pressable
        accessibilityRole="button" accessibilityLabel="Dismiss cooling route"
        focusable tabIndex={0}
        onFocus={() => setFocused("close")} onBlur={() => setFocused(null)}
        onPress={drag.press(onClose)}
        style={({ pressed }) => [styles.close, pressed && styles.pressed, focused === "close" && styles.focused]}
      >
        <Ionicons name="close" size={22} color="#39775F" />
      </Pressable>
      <Pressable
        testID="cooling-route-bubble"
        accessibilityRole="button" accessibilityLabel={snapshot.mode === "googleMaps" ? "Reopen cooling route in Google Maps" : "Restore cooling route"}
        focusable tabIndex={0}
        onFocus={() => setFocused("restore")} onBlur={() => setFocused(null)}
        onPress={drag.press(onRestore)}
        style={({ pressed }) => [styles.bubble, pressed && styles.pressed, focused === "restore" && styles.focused]}
      >
        <Ionicons name="map-outline" size={26} color="#FFFFFF" />
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, zIndex: 1000, alignItems: "flex-end", justifyContent: "flex-end", paddingRight: 12 },
  controls: { width: 54, alignItems: "center", gap: 8 },
  bubble: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#39775F", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 12px rgba(0,0,0,0.22)" },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C8DDD1", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.14)" },
  pressed: { opacity: 0.75 },
  focused: { outlineStyle: "solid", outlineWidth: 3, outlineColor: "#24513F", outlineOffset: 3 },
  error: { position: "absolute", top: 12, left: 12, right: 12, maxWidth: 260, backgroundColor: "#FFFFFF", color: "#8B2929", padding: 12, borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.14)" },
});
