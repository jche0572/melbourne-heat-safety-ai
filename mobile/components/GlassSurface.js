import { useAppTheme } from "../theme/useAppTheme";
import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { BlurView } from "expo-blur";

export function shouldUseNativeGlass({
  platform,
  liquidGlassAvailable,
  glassEffectApiAvailable,
  reduceTransparencyEnabled,
}) {
  return (
    platform === "ios" &&
    liquidGlassAvailable &&
    glassEffectApiAvailable &&
    !reduceTransparencyEnabled
  );
}

export default function GlassSurface({ children, style, interactive = false, dark, ...props }) {
  const theme = useAppTheme(dark);
  const styles = theme.styles(baseStyles);
  const [reduceTransparencyEnabled, setReduceTransparencyEnabled] =
    useState(Platform.OS === "ios");

  useEffect(() => {
    if (Platform.OS !== "ios") {
      return undefined;
    }

    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((enabled) => {
        if (mounted) {
          setReduceTransparencyEnabled(enabled);
        }
      })
      .catch(() => {
        if (mounted) {
          setReduceTransparencyEnabled(true);
        }
      });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparencyEnabled
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const useNativeGlass = shouldUseNativeGlass({
    platform: Platform.OS,
    liquidGlassAvailable: isLiquidGlassAvailable(),
    glassEffectApiAvailable: isGlassEffectAPIAvailable(),
    reduceTransparencyEnabled,
  });
  const useBlur = Platform.OS === "ios" && !useNativeGlass && !reduceTransparencyEnabled;
  const Surface = useNativeGlass ? GlassView : useBlur ? BlurView : View;

  return (
    <Surface
      {...props}
      {...(useNativeGlass
        ? {
            glassEffectStyle: "regular",
            tintColor: theme.dark ? "rgba(15, 32, 26, 0.18)" : "rgba(244, 250, 247, 0.12)",
            colorScheme: theme.dark ? "dark" : "light",
            isInteractive: interactive,
          }
        : useBlur ? { tint: theme.dark ? "systemMaterialDark" : "systemMaterialLight", intensity: 75 } : {})}
      style={[
        styles.surface,
        !useNativeGlass && !useBlur && styles.fallback,
        useBlur && styles.blur,
        style,
        reduceTransparencyEnabled && styles.opaque,
      ]}
    >
      {children}
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  surface: {
    borderColor: "rgba(255, 255, 255, 0.82)",
    borderWidth: StyleSheet.hairlineWidth,
  },
  fallback: {
    backgroundColor: "rgba(247, 252, 250, 0.66)",
  },
  blur: {
    overflow: "hidden",
  },
  opaque: {
    backgroundColor: "#F7FBF9",
  },
});
