const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("../node_modules/@babel/core");

const appPath = path.resolve(__dirname, "../App.js");
const tabBarPath = path.resolve(
  __dirname,
  "../components/LiquidGlassTabBar.js"
);
const glassSurfacePath = path.resolve(
  __dirname,
  "../components/GlassSurface.js"
);
const plannerPath = path.resolve(__dirname, "../screens/EventPlannerScreen.js");
const visualLearningPath = path.resolve(
  __dirname,
  "../screens/VisualLearningScreen.js"
);

test("MainTabs exposes the four root destinations in order", () => {
  const source = fs.readFileSync(appPath, "utf8");
  const names = [...source.matchAll(/<Tab\.Screen\s+name="([^"]+)"/g)].map(
    (match) => match[1]
  );

  assert.deepEqual(names, [
    "Home",
    "NearbyCooling",
    "HeatAwareActivityPlanner",
    "HeatSmartLearning",
  ]);
  assert.match(source, /initialRouteName="MainTabs"/);
  assert.match(source, /<PlannerStack\.Screen\s+name="PlannerTimeline"/);
  assert.match(source, /<PlannerStack\.Screen\s+name="EventDetails"/);
  assert.match(source, /<PlannerStack\.Screen\s+name="EventPlanner"/);
  assert.match(source, /<LearningStack\.Screen\s+name="LearningHome"/);
  assert.match(source, /<LearningStack\.Screen\s+name="VisualLearning"/);
  assert.match(source, /<LearningStack\.Screen\s+name="Quiz"/);
  assert.match(source, /<LearningStack\.Screen\s+name="ScenarioLearning"/);
  assert.match(source, /<LearningStack\.Screen\s+name="ScenarioDetails"/);
  assert.match(source, /<LearningStack\.Screen\s+name="ScenarioQuestion"/);
  assert.match(source, /<LearningStack\.Screen\s+name="ScenarioComplete"/);
  assert.doesNotMatch(source, /<RootStack\.Screen\s+name="EventDetails"/);
  assert.doesNotMatch(source, /<RootStack\.Screen\s+name="VisualLearning"/);
  assert.match(source, /<RootStack\.Screen\s+name="CoolingNavigation"/);
  assert.match(source, /<RootStack\.Screen\s+name="FeedbackFormList"/);
  assert.match(source, /<RootStack\.Screen\s+name="FeedbackForm"/);
  assert.match(source, /completedScenarioIds=\{\s*completedScenarioIds\s*\}/);
  assert.match(source, /quizCompleted=\{\s*quizCompleted\s*\}/);
  assert.match(
    source,
    /completedVisualActivityIds=\{\s*completedVisualActivityIds\s*\}/
  );
});

test("event creation returns to the Planner timeline inside its nested stack", () => {
  const plannerSource = fs.readFileSync(plannerPath, "utf8");

  assert.match(
    plannerSource,
    /navigation\.popTo\(\s*"PlannerTimeline"/
  );
  assert.doesNotMatch(
    plannerSource,
    /navigation\.navigate\(\s*"MainTabs",\s*\{\s*screen:\s*"HeatAwareActivityPlanner"/
  );
  const visualLearningSource = fs.readFileSync(visualLearningPath, "utf8");
  assert.match(
    visualLearningSource,
    /navigation\.setParams\(\{ tabBarHidden: stage !== "introduction" \}\)/
  );
});

test("native glass is limited to supported iOS without reduced transparency", () => {
  const source = fs.readFileSync(tabBarPath, "utf8");
  const code = babel.transformSync(source, {
    babelrc: false,
    configFile: false,
    plugins: [
      require("../node_modules/@babel/plugin-transform-react-jsx"),
      require("../node_modules/@babel/plugin-transform-modules-commonjs"),
    ],
  }).code;
  const exports = {};
  const shouldUseNativeGlass = ({
    platform,
    liquidGlassAvailable,
    glassEffectApiAvailable,
    reduceTransparencyEnabled,
  }) =>
    platform === "ios" &&
    liquidGlassAvailable &&
    glassEffectApiAvailable &&
    !reduceTransparencyEnabled;

  vm.runInNewContext(code, {
    exports,
    require: (name) => ({
      react: {
        createElement() {},
        useEffect() {},
        useState: (value) => [value, () => {}],
      },
      "react-native": {
        AccessibilityInfo: {},
        Platform: { OS: "web" },
        Pressable: "Pressable",
        StyleSheet: { create: (value) => value, hairlineWidth: 1 },
        Text: "Text",
        View: "View",
      },
      "@expo/vector-icons": { Ionicons: "Ionicons" },
      "./GlassSurface": {
        __esModule: true,
        default: "GlassSurface",
        shouldUseNativeGlass,
      },
    })[name],
  });

  assert.equal(exports.tabDragOffset(-20, 100, 412, 4), 0);
  assert.equal(exports.tabDragOffset(256, 100, 412, 4), 100);
  assert.equal(exports.tabDragOffset(900, 100, 412, 4), 300);

  const glassCode = babel.transformSync(
    fs.readFileSync(glassSurfacePath, "utf8"),
    {
      babelrc: false,
      configFile: false,
      plugins: [
        require("../node_modules/@babel/plugin-transform-react-jsx"),
        require("../node_modules/@babel/plugin-transform-modules-commonjs"),
      ],
    }
  ).code;
  const glassExports = {};
  vm.runInNewContext(glassCode, {
    exports: glassExports,
    require: (name) => ({
      react: {
        createElement() {},
        useEffect() {},
        useState: (value) => [value, () => {}],
      },
      "react-native": {
        AccessibilityInfo: {},
        Platform: { OS: "web" },
        StyleSheet: { create: (value) => value, hairlineWidth: 1 },
        View: "View",
      },
      "expo-glass-effect": {
        GlassView: "GlassView",
        isGlassEffectAPIAvailable: () => false,
        isLiquidGlassAvailable: () => false,
      },
      "expo-blur": { BlurView: "BlurView" },
    })[name],
  });

  const available = {
    platform: "ios",
    liquidGlassAvailable: true,
    glassEffectApiAvailable: true,
    reduceTransparencyEnabled: false,
  };

  assert.equal(glassExports.shouldUseNativeGlass(available), true);
  assert.equal(
    glassExports.shouldUseNativeGlass({
      ...available,
      reduceTransparencyEnabled: true,
    }),
    false
  );
  assert.equal(
    glassExports.shouldUseNativeGlass({ ...available, platform: "android" }),
    false
  );
  assert.equal(
    glassExports.shouldUseNativeGlass({
      ...available,
      glassEffectApiAvailable: false,
    }),
    false
  );

  const visibleRoutes = [
    "Home",
    "NearbyCooling",
    "PlannerTimeline",
    "EventDetails",
    "LearningHome",
    "VisualLearning",
    "ScenarioLearning",
    "ScenarioDetails",
  ];
  const hiddenRoutes = [
    "EventPlanner",
    "Quiz",
    "ScenarioQuestion",
    "ScenarioComplete",
  ];

  visibleRoutes.forEach((routeName) => {
    assert.equal(exports.isTabBarVisible(routeName), true, routeName);
  });
  hiddenRoutes.forEach((routeName) => {
    assert.equal(exports.isTabBarVisible(routeName), false, routeName);
  });
  assert.equal(
    exports.isTabBarVisible("VisualLearning", { tabBarHidden: true }),
    false
  );
});

test("bottom tabs stay compact without shrinking touch targets", () => {
  const source = fs.readFileSync(tabBarPath, "utf8");

  assert.match(source, /height: 64,/);
  assert.match(source, /minHeight: 48,/);
  assert.match(source, /minWidth: 48,/);
});
