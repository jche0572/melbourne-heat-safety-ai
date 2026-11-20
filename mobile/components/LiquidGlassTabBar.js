import { useThemedStyles } from "../theme/useAppTheme";
import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Animated,
  PanResponder,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GlassSurface, { shouldUseNativeGlass } from "./GlassSurface";

export { shouldUseNativeGlass };

export function tabDragOffset(pageX, left, width, count) {
  const cell = (width - 12) / count;
  return Math.max(0, Math.min((count - 1) * cell, pageX - left - 6 - cell / 2));
}

const TAB_ICONS = {
  Home: "home-outline",
  NearbyCooling: "map-outline",
  HeatAwareActivityPlanner: "calendar-outline",
  HeatSmartLearning: "book-outline",
};

const HIDDEN_TAB_ROUTES = new Set([
  "EventPlanner",
  "Quiz",
  "ScenarioQuestion",
  "ScenarioComplete",
]);

export function isTabBarVisible(routeName, params = {}) {
  return !HIDDEN_TAB_ROUTES.has(routeName) && !params.tabBarHidden;
}

function getFocusedNestedRoute(route) {
  let focusedRoute = route;

  while (focusedRoute?.state?.routes?.length) {
    focusedRoute =
      focusedRoute.state.routes[focusedRoute.state.index ?? 0];
  }

  return focusedRoute;
}

function TabButton({
  route,
  label,
  selected,
  onPress,
  onLongPress,
  testID,
}) {
  const { styles, theme } = useThemedStyles(baseStyles);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={`${label} tab`}
      accessibilityState={{ selected }}
      focusable
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onLongPress={onLongPress}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.tabButton,
        focused && styles.focusedTab,
        pressed && styles.pressedTab,
      ]}
    >
      <Ionicons
        name={TAB_ICONS[route.name]}
        size={20}
        color={theme.color(selected ? "#145C45" : "#3E514B")}
      />
      <Text
        maxFontSizeMultiplier={1.4}
        numberOfLines={1}
        style={[
          styles.tabLabel,
          selected && styles.selectedLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function LiquidGlassTabBar({
  state,
  descriptors,
  navigation,
  insets,
}) {
  const { styles, theme } = useThemedStyles(baseStyles);
  const activeRoute = getFocusedNestedRoute(state.routes[state.index]);
  const bar = useRef(null);
  const left = useRef(0);
  const [width, setWidth] = useState(0);
  const offset = useRef(new Animated.Value(0)).current;
  const cell = Math.max(0, (width - 12) / state.routes.length);
  const settle = (index) => Animated.spring(offset, {
    toValue: index * cell, useNativeDriver: true, damping: 22, stiffness: 240, mass: 1,
  }).start();
  useEffect(() => { settle(state.index); }, [state.index, width]);

  const selectTab = (index) => {
    const route = state.routes[index];
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented && index !== state.index) {
      navigation.navigate(route.name, route.params);
    }
    settle(event.defaultPrevented ? state.index : index);
  };
  const dragOffset = (gesture) => tabDragOffset(gesture.moveX, left.current, width, state.routes.length);
  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => cell > 0 && Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderGrant: (_, gesture) => { offset.stopAnimation(); offset.setValue(dragOffset(gesture)); },
    onPanResponderMove: (_, gesture) => offset.setValue(dragOffset(gesture)),
    onPanResponderRelease: (_, gesture) => selectTab(Math.round(dragOffset(gesture) / cell)),
    onPanResponderTerminate: () => settle(state.index),
  });

  if (!isTabBarVisible(activeRoute?.name, activeRoute?.params)) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.tabBarSlot,
        { paddingBottom: Math.max(insets.bottom, 8) },
      ]}
    >
      <View ref={bar} style={styles.tabBar} {...pan.panHandlers}
        onLayout={(event) => {
          setWidth(event.nativeEvent.layout.width);
          bar.current?.measureInWindow((x) => { left.current = x; });
        }}
      >
        <GlassSurface pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 32 }]} />
        {cell > 0 && <Animated.View pointerEvents="none" style={{ position: "absolute", top: 6, bottom: 6, left: 6, width: cell, transform: [{ translateX: offset }] }}>
          <GlassSurface interactive style={[StyleSheet.absoluteFill, styles.selectedTab, { borderRadius: 28 }]} />
        </Animated.View>}
        {state.routes.map((route, index) => {
          const options = descriptors[route.key].options;
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : options.title ?? route.name;
          const selected = state.index === index;

          const onPress = () => selectTab(index);

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          return (
            <TabButton
              key={route.key}
              route={route}
              label={label}
              selected={selected}
              onPress={onPress}
              onLongPress={onLongPress}
              testID={options.tabBarButtonTestID}
            />
          );
        })}
      </View>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  tabBarSlot: {
    backgroundColor: "transparent",
    bottom: 0,
    left: 0,
    paddingTop: 4,
    position: "absolute",
    right: 0,
    zIndex: 20,
  },
  tabBar: {
    alignSelf: "center",
    borderColor: "rgba(255, 255, 255, 0.94)",
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 10,
    flexDirection: "row",
    height: 64,
    maxWidth: 430,
    overflow: "hidden",
    padding: 6,
    shadowColor: "#143E31",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    width: "92%",
  },
  tabButton: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: 28,
    borderWidth: 2,
    flex: 1,
    gap: 2,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 2,
  },
  selectedTab: {
    backgroundColor: "rgba(209, 236, 224, 0.65)",
  },
  focusedTab: {
    borderColor: "#2F8065",
  },
  pressedTab: {
    opacity: 0.72,
  },
  tabLabel: {
    color: "#3E514B",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
  },
  selectedLabel: {
    color: "#145C45",
    fontWeight: "700",
  },
});
