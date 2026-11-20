const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("../node_modules/@babel/core");

// Exercise the actual screen event handlers without adding a React Native test dependency.
// Host views and hook scheduling are simulated; this does not verify device layout or focus.
let active;
const React = {
  createElement(type, props, ...children) {
    return { type, props: { ...props, children }, key: props?.key };
  },
  useState(initial) {
    const index = active.cursor++;
    const owner = active;
    if (!(index in owner.slots)) owner.slots[index] = typeof initial === "function" ? initial() : initial;
    return [owner.slots[index], value => {
      owner.slots[index] = typeof value === "function" ? value(owner.slots[index]) : value;
    }];
  },
  useEffect(callback, dependencies) {
    const index = active.cursor++;
    const previous = active.slots[index];
    if (!previous || dependencies.some((value, i) => value !== previous[i])) {
      active.slots[index] = dependencies;
      active.effects.push(callback);
    }
  },
  createContext: value => ({ value, Provider: "ContextProvider" }),
  useContext: context => context.value,
  useMemo: factory => factory(),
  useCallback: callback => callback,
  useRef(initial) {
    const index = active.cursor++;
    if (!(index in active.slots)) active.slots[index] = { current: initial };
    return active.slots[index];
  },
};
const native = Object.fromEntries(
  ["Image", "Modal", "Pressable", "ScrollView", "StatusBar", "Text", "TouchableOpacity", "View"].map(name => [name, name])
);
native.StyleSheet = { create: value => value };
native.Platform = { OS: "web" };
native.useColorScheme = () => "light";
const cache = new Map();
function load(file) {
  file = path.resolve(__dirname, "..", file);
  if (cache.has(file)) return cache.get(file);
  const result = { exports: {} };
  const source = babel.transformSync(fs.readFileSync(file, "utf8"), {
    babelrc: false, configFile: false,
    plugins: [require("../node_modules/@babel/plugin-transform-react-jsx"),
      require("../node_modules/@babel/plugin-transform-modules-commonjs")],
  }).code;
  vm.runInNewContext(source, {
    exports: result.exports, module: result,
    require(id) {
      if (id === "react") return React;
      if (id === "react-native") return native;
      if (id === "react-native-safe-area-context") return { SafeAreaView: "SafeAreaView", SafeAreaProvider: "SafeAreaProvider", useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
      if (id === "@expo/vector-icons") return { Ionicons: "Ionicons" };
      if (id === "@react-navigation/native") return { NavigationContainer: "NavigationContainer", DefaultTheme: { colors: {} }, DarkTheme: { colors: {} } };
      if (id === "@react-navigation/bottom-tabs") return { createBottomTabNavigator: () => ({ Navigator: "TabNavigator", Screen: "TabScreen" }) };
      if (id.includes("/theme/")) return load(path.relative(path.resolve(__dirname, ".."), path.resolve(path.dirname(file), id + ".js")));
      if (file.includes("theme") && id === "./palette") return load("theme/palette.js");
      if (id === "@react-navigation/native-stack") return {
        createNativeStackNavigator: () => ({ Navigator: "Navigator", Screen: "Screen" }),
      };
      if (id.includes("LearningHint") || id.includes("LearningRouteGuard") || id.includes("learningProgress") || id.includes("data/") || id.includes("ScenarioLearningScreen") || id.includes("HeatSmartLearningScreen") || id.includes("VisualLearningScreen") || id.includes("QuizScreen")) {
        return load(path.relative(path.resolve(__dirname, ".."), path.resolve(path.dirname(file), id + ".js")));
      }
      // Images and unrelated screen imports are outside these Scenario Learning tests.
      return id;
    },
  }, { filename: file });
  cache.set(file, result.exports);
  return result.exports;
}
function mount(component, props) {
  if (component.name === "App") component = component(props).props.children[0].type;
  const instance = { slots: [], cursor: 0, tree: null };
  instance.render = () => {
    active = instance;
    instance.cursor = 0;
    instance.effects = [];
    instance.tree = component(props);
    instance.effects.forEach(callback => callback());
    return instance.tree;
  };
  instance.render();
  return instance;
}
// Unwrap children only for isolated completion-handler tests; route guards are mounted separately below.
function unwrapRoute(element) {
  return element.type?.name === "LearningRouteGuard" ? element.props.children[0] : element;
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  if (["MainTabs", "PlannerStackNavigator", "LearningStackNavigator"].includes(tree.type?.name)) return nodes(tree.type(tree.props));
  if (tree.props?.component?.name === "PlannerStackNavigator") return [tree, ...nodes(tree.props.component({}))];
  const nested = ["MainTabs", "HeatAwareActivityPlanner", "HeatSmartLearning"].includes(tree.props?.name)
    ? tree.props.children?.filter(child => typeof child === "function").map(child => child({ navigation: navigation(), route: { params: {} } })) : [];
  return [tree, ...nodes(tree.props?.children), ...nodes(nested)];
}
function rawText(tree) {
  if (Array.isArray(tree)) return tree.map(rawText).join("");
  if (tree == null || typeof tree === "boolean") return "";
  return typeof tree === "object" ? rawText(tree.props?.children) : String(tree);
}
function text(tree) { return rawText(tree).replace(/\s+/g, " ").trim(); }
function button(instance, label) {
  const node = nodes(instance.tree).find(node => node.type === "TouchableOpacity" && text(node) === label);
  assert.ok(node, "Missing button: " + label);
  return node.props;
}
function option(instance, index) {
  return nodes(instance.tree).filter(node => node.props?.accessibilityRole === "radio")[index].props;
}
function modal(instance) { return nodes(instance.tree).find(node => node.type === "Modal").props; }
function navigation() {
  const calls = [];
  return { calls, popTo: name => calls.push(["popTo", name]),
    setParams() {},
    navigate: (name, params) => calls.push(["navigate", name, params]),
    replace: (name, params) => calls.push(["replace", name, params]), goBack() {} };
}
const screens = load("screens/ScenarioLearningScreen.js");
const { scenarios } = load("data/scenarios.js");

for (const scenario of scenarios) {
  test(scenario.id + ": wrong retry, every correct decision, repeated clicks, and final completion", () => {
    const nav = navigation();
    const completed = [];
    const instance = mount(screens.ScenarioQuestionScreen, {
      navigation: nav, route: { params: { scenarioId: scenario.id } },
      onComplete: id => completed.push(id),
    });
    assert.equal(button(instance, "Check").disabled, true);
    button(instance, "Check").onPress();
    instance.render();
    assert.equal(modal(instance).visible, false);

    for (let i = 0; i < scenario.questions.length; i++) {
      const question = scenario.questions[i];
      assert.ok(text(instance.tree).includes(i + " of " + scenario.questions.length + " decisions completed"));
      const wrongIndex = (question.correctOptionIndex + 1) % question.options.length;
      option(instance, wrongIndex).onPress();
      instance.render();
      assert.equal(modal(instance).visible, false, "Selection must not evaluate an answer");
      const checkWrong = button(instance, "Check").onPress;
      checkWrong(); checkWrong();
      instance.render();
      assert.ok(text(instance.tree).includes("Incorrect"));
      assert.ok(text(instance.tree).includes(question.options[wrongIndex].feedback));
      assert.equal(option(instance, question.correctOptionIndex).disabled, true);
      const retry = button(instance, "I Understand").onPress;
      retry(); retry();
      instance.render();
      assert.equal(modal(instance).visible, false);
      assert.equal(instance.tree.props.pageKey, i);
      assert.equal(completed.length, 0);
      assert.equal(button(instance, "Check").disabled, true);

      option(instance, question.correctOptionIndex).onPress();
      instance.render();
      // Choices can still be changed before checking.
      option(instance, wrongIndex).onPress();
      instance.render();
      option(instance, question.correctOptionIndex).onPress();
      instance.render();
      const checkCorrect = button(instance, "Check").onPress;
      checkCorrect(); checkCorrect();
      instance.render();
      assert.ok(text(instance.tree).includes("Good Choice"));
      assert.ok(text(instance.tree).includes(question.options[question.correctOptionIndex].feedback));
      // Native back/Escape must not silently dismiss successful feedback or award progress.
      modal(instance).onRequestClose();
      instance.render();
      assert.equal(modal(instance).visible, true);
      assert.equal(completed.length, 0);
      const advance = button(instance, "Continue").onPress;
      advance(); advance();
      instance.render();
      assert.equal(modal(instance).visible, false);
      if (i < scenario.questions.length - 1) {
        assert.equal(instance.tree.props.pageKey, i + 1);
        assert.equal(button(instance, "Check").disabled, true);
      }
    }
    assert.deepEqual(completed, [scenario.id]);
    assert.equal(nav.calls.length, 2);
    assert.deepEqual(nav.calls[0], ["popTo", "ScenarioLearning"]);
    assert.equal(nav.calls[1][1], "ScenarioComplete");
    assert.equal(nav.calls[1][2].scenarioId, scenario.id);
  });

  test(scenario.id + ": completion result, selected lesson, and return routes", () => {
    const nav = navigation();
    const instance = mount(screens.ScenarioCompleteScreen, {
      navigation: nav, route: { params: { scenarioId: scenario.id } },
    });
    assert.ok(text(instance.tree).includes(scenario.completionMessage));
    assert.ok(text(instance.tree).includes(scenario.keyTakeaway));
    assert.ok(text(instance.tree).includes(scenario.questions.length + " / " + scenario.questions.length + " decisions answered correctly"));
    button(instance, "Try another scenario").onPress();
    button(instance, "Back to Education").onPress();
    assert.deepEqual(nav.calls, [["popTo", "ScenarioLearning"], ["popTo", "LearningHome"]]);
  });
}

test("App deduplicates scenario completion, shares dashboard progress, and keys fresh attempts", () => {
  const App = load("App.js").default;
  const instance = mount(App, {});
  const route = name => nodes(instance.tree).find(node => node.type === "Screen" && node.props.name === name);
  const child = (name, props) => unwrapRoute(route(name).props.children.find(value => typeof value === "function")(props));
  const first = child("ScenarioQuestion", { route: { params: { scenarioId: scenarios[0].id } } });
  first.props.onComplete(scenarios[0].id);
  first.props.onComplete(scenarios[0].id);
  instance.render();
  const dashboard = child("LearningHome", {});
  assert.equal(dashboard.props.completedScenarioIds.length, 1);
  assert.equal(dashboard.props.completedScenarioIds[0], scenarios[0].id);
  const learning = child("ScenarioLearning", {});
  assert.equal(learning.props.completedScenarioIds.length, 1);
  const second = child("ScenarioQuestion", { route: { params: { scenarioId: scenarios[1].id } } });
  assert.notEqual(first.key, second.key, "Scenario change must remount local question state");
  const fresh = mount(screens.ScenarioQuestionScreen, {
    ...second.props, navigation: navigation(),
  });
  assert.equal(fresh.tree.props.pageKey, 0);
  assert.equal(button(fresh, "Check").disabled, true);
  assert.equal(modal(fresh).visible, false);
  const summary = mount(dashboard.type, dashboard.props);
  assert.ok(text(summary.tree).includes("1 of 13 activities completed"));
  assert.ok(text(summary.tree).includes("1 / 3 completed"));
});

test("All existing scenario cards still open their own details and questions", () => {
  const nav = navigation();
  const list = mount(screens.ScenarioLearningScreen, { navigation: nav, completedScenarioIds: [] });
  const cards = nodes(list.tree).filter(node => node.type === "TouchableOpacity");
  assert.equal(cards.length, scenarios.length);
  for (let i = 0; i < scenarios.length; i++) {
    cards[i].props.onPress();
    assert.equal(nav.calls.at(-1)[2].scenarioId, scenarios[i].id);
    const details = mount(screens.ScenarioDetailsScreen, {
      navigation: nav, route: { params: { scenarioId: scenarios[i].id } },
    });
    button(details, "Start Scenario").onPress();
    assert.equal(nav.calls.at(-1)[1], "ScenarioQuestion");
    assert.equal(nav.calls.at(-1)[2].scenarioId, scenarios[i].id);
  }
});

test("Installed stack router removes completed attempts and returns to the existing Education routes", async () => {
  const { pathToFileURL } = require("node:url");
  const { StackRouter, StackActions } = await import(pathToFileURL(path.resolve(__dirname,
    "../node_modules/@react-navigation/routers/lib/module/StackRouter.js")).href);
  const router = StackRouter({ initialRouteName: "Home" });
  const routeNames = ["Home", "LearningHome", "ScenarioLearning", "ScenarioDetails",
    "ScenarioQuestion", "ScenarioComplete"];
  const options = { routeNames, routeParamList: {}, routeGetIdList: {} };
  function completedStack() {
    let state = router.getInitialState(options);
    const navigate = (name, params) => {
      state = router.getStateForAction(state, { type: "NAVIGATE", payload: { name, params } }, options);
      assert.ok(state);
    };
    navigate("LearningHome");
    navigate("ScenarioLearning");
    navigate("ScenarioDetails", { scenarioId: "market" });
    navigate("ScenarioQuestion", { scenarioId: "market" });
    state = router.getStateForAction(state, StackActions.popTo("ScenarioLearning"), options);
    navigate("ScenarioComplete", { scenarioId: "market" });
    assert.deepEqual(state.routes.map(route => route.name),
      ["Home", "LearningHome", "ScenarioLearning", "ScenarioComplete"]);
    return state;
  }
  const selection = router.getStateForAction(completedStack(), StackActions.popTo("ScenarioLearning"), options);
  assert.deepEqual(selection.routes.map(route => route.name), ["Home", "LearningHome", "ScenarioLearning"]);
  const education = router.getStateForAction(completedStack(), StackActions.popTo("LearningHome"), options);
  assert.deepEqual(education.routes.map(route => route.name), ["Home", "LearningHome"]);
});

test("Integrated App keeps teammate routes and unique Education route registrations", () => {
  const instance = mount(load("App.js").default, {});
  const registered = nodes(instance.tree).filter(node => node.type === "Screen").map(node => node.props.name);
  assert.equal(new Set(registered).size, registered.length);
  for (const name of ["FeedbackFormList", "FeedbackForm", "EventPlanner", "EventDetails",
    "LearningHome", "ScenarioLearning", "ScenarioDetails", "ScenarioQuestion", "ScenarioComplete"]) {
    assert.ok(registered.includes(name), "Missing integrated route: " + name);
  }
});

test("Scenario content has valid answer indexes, distinct lessons, and existing images", () => {
  assert.equal(new Set(scenarios.map(scenario => scenario.id)).size, scenarios.length);
  assert.equal(new Set(scenarios.map(scenario => scenario.keyTakeaway)).size, scenarios.length);
  for (const scenario of scenarios) {
    assert.ok(scenario.questions.length > 0);
    assert.ok(scenario.completionMessage && scenario.keyTakeaway);
    assert.ok(fs.existsSync(path.resolve(__dirname, "../data", scenario.image)));
    for (const question of scenario.questions) {
      assert.ok(Number.isInteger(question.correctOptionIndex));
      assert.ok(question.correctOptionIndex >= 0 && question.correctOptionIndex < question.options.length);
      assert.ok(question.options.every(option => option.text && option.feedback));
    }
  }
});

test("All scenario completions update module, overall, and knowledge progress once; revisits do not change it", () => {
  const instance = mount(load("App.js").default, {});
  const child = (name, props = {}) => {
    const route = nodes(instance.tree).find(node => node.type === "Screen" && node.props.name === name);
    return unwrapRoute(route.props.children.find(value => typeof value === "function")(props));
  };
  for (let i = 0; i <= scenarios.length; i++) {
    if (i > 0) {
      const question = child("ScenarioQuestion", { route: { params: { scenarioId: scenarios[i - 1].id } } });
      question.props.onComplete(scenarios[i - 1].id);
      question.props.onComplete(scenarios[i - 1].id);
      instance.render();
    }
    const dashboard = child("LearningHome");
    assert.equal(dashboard.props.completedScenarioIds.length, i);
    const summary = mount(dashboard.type, dashboard.props);
    assert.ok(text(summary.tree).includes(i + " of 13 activities completed"));
    assert.ok(text(summary.tree).includes(i + " / 3 completed"));
    // Inspect actual ProgressBar inputs, including the shared knowledge calculations.
    const bars = nodes(summary.tree).filter(node => node.type?.name === "ProgressBar");
    assert.equal(bars.find(node => node.props.label === "Overall learning progress").props.value,
      Math.round(i / 13 * 100));
    for (const [label, total] of [["Heat Safety knowledge", 11], ["UV Safety knowledge", 11], ["Safe Planning knowledge", 9]]) {
      assert.equal(bars.find(node => node.props.label === label).props.value, Math.round(i / total * 100));
    }
    if (i > 0) {
      const completion = mount(screens.ScenarioCompleteScreen, {
        navigation: navigation(), route: { params: { scenarioId: scenarios[i - 1].id } },
      });
      completion.render(); completion.render();
      instance.render();
      assert.equal(child("LearningHome").props.completedScenarioIds.length, i);
      const list = child("ScenarioLearning");
      const selection = mount(list.type, list.props);
      assert.ok(text(selection.tree).includes(i + " of 3 scenarios completed"));
    }
  }
});

// UI regression checks exercise the same screen callbacks without changing activity content.
test("Education page backgrounds and ordinary cards preserve their light theme styles", () => {
  const props = { navigation: navigation(), completedScenarioIds: [], route: { params: { scenarioId: scenarios[0].id } } };
  const components = [load("screens/HeatSmartLearningScreen.js").default,
    load("screens/VisualLearningScreen.js").default, load("screens/QuizScreen.js").default,
    screens.ScenarioLearningScreen, screens.ScenarioDetailsScreen, screens.ScenarioQuestionScreen, screens.ScenarioCompleteScreen];
  for (const component of components) {
    const instance = mount(component, props);
    // Scenario views share ScenarioPage, which owns their full-width SafeAreaView.
    const outer = typeof instance.tree.type === "function" ? mount(instance.tree.type, instance.tree.props).tree : instance.tree;
    assert.equal(Object.assign({}, ...[outer.props.style].flat().filter(Boolean)).backgroundColor, "#EEF2F0");
    const styles = nodes(instance.tree).flatMap(node => [node.props?.style].flat()).filter(Boolean);
    const cards = styles.filter(style => style.borderColor === "#E9ECF0");
    assert.ok(cards.length > 0);
    assert.ok(cards.every(style => style.backgroundColor === "#FFFFFF"));
  }
});

test("Visual overview arrows scroll its single original container, with fallback and no gesture interception", () => {
  const instance = mount(load("screens/VisualLearningScreen.js").default, { navigation: navigation() });
  const scrolls = nodes(instance.tree).filter(node => node.type === "ScrollView");
  assert.equal(scrolls.length, 1);
  const scroll = scrolls[0].props;
  const calls = [];
  scroll.ref.current = { getScrollableNode: () => ({ scrollBy: value => calls.push(value) }) };
  const arrow = label => nodes(instance.tree).find(node => node.props?.accessibilityLabel === label);
  arrow("Scroll activity list down").props.onPress();
  arrow("Scroll activity list up").props.onPress();
  assert.equal(calls[0].top, 180);
  assert.equal(calls[1].top, -180);
  assert.ok(calls.every(value => value.behavior === "smooth"));
  assert.equal(scroll.style.maxWidth, 440);
  assert.equal(scroll.style.overflowY, "scroll");
  assert.equal(scroll.style.overflowX, "hidden");
  assert.equal(scroll.onWheel, undefined);
  assert.equal(scroll.onTouchMove, undefined);
  const arrowNodes = nodes(instance.tree).filter(node => node.props?.accessibilityLabel?.startsWith("Scroll activity list"));
  assert.equal(arrowNodes.length, 2);
  assert.ok(arrowNodes.every(node => node.props.style[0].position === "absolute"));
  assert.equal(arrowNodes[0].props.style[1].top, 0);
  assert.equal(arrowNodes[1].props.style[1].bottom, 0);
  assert.ok(!nodes(scrolls[0]).some(node => arrowNodes.includes(node)), "Arrows must sit outside scrolling content");
  const fallback = { scrollTop: 180 };
  scroll.ref.current = { getScrollableNode: () => fallback };
  arrow("Scroll activity list up").props.onPress();
  assert.equal(fallback.scrollTop, 0);
  arrow("Scroll activity list down").props.onPress();
  assert.equal(fallback.scrollTop, 180);
  const links = nodes(instance.tree).filter(node => node.props?.accessibilityLabel?.startsWith("Open Activity "));
  assert.equal(links.length, 9);
  links[0].props.onPress();
  instance.render();
  assert.equal(nodes(instance.tree).filter(node => node.props?.accessibilityLabel?.startsWith("Scroll activity list")).length, 0);
  // Native devices retain their normal ScrollView and never receive these web controls.
  native.Platform.OS = "ios";
  try {
    const mobile = mount(load("screens/VisualLearningScreen.js").default, { navigation: navigation() });
    assert.equal(nodes(mobile.tree).filter(node => node.props?.accessibilityLabel?.startsWith("Scroll activity list")).length, 0);
    assert.equal(nodes(mobile.tree).find(node => node.type === "ScrollView").props.style, undefined);
  } finally {
    native.Platform.OS = "web";
  }
});

test("All nine visual activities still accept their correct interactions and record completion once", () => {
  const { visualActivities } = load("data/visualLearning.js");
  const Visual = load("screens/VisualLearningScreen.js").default;
  for (const activity of visualActivities) {
    const completed = [];
    const instance = mount(Visual, { navigation: navigation(), onActivityComplete: id => completed.push(id) });
    nodes(instance.tree).find(node => node.props?.accessibilityLabel?.startsWith("Open Activity " + activity.id + ":")).props.onPress();
    instance.render();
    if (activity.type === "tap") {
      nodes(instance.tree).find(node => node.props?.accessibilityLabel === "Activity image: tap an area").props.onPress();
      instance.render();
      assert.equal(completed.length, 0);
      nodes(instance.tree).find(node => node.props?.accessibilityLabel === activity.correctInteraction).props.onPress();
    } else {
      button(instance, "Check Answer").onPress();
      instance.render();
      assert.equal(completed.length, 0);
      for (const index of activity.correctItemIndexes) {
        nodes(instance.tree).filter(node => node.props?.accessibilityRole === "checkbox")[index].props.onPress();
        instance.render();
      }
      button(instance, "Check Answer").onPress();
    }
    instance.render();
    assert.deepEqual(completed, [activity.id]);
    assert.ok(text(instance.tree).includes(activity.correctFeedback));
  }
});

test("Quiz answers, scoring, completion, and restart remain functional after the background change", () => {
  const { quizQuestions } = load("data/quizQuestions.js");
  let completed = 0;
  const instance = mount(load("screens/QuizScreen.js").default, { navigation: navigation(), onComplete: () => completed++ });
  button(instance, "Start Quiz").onPress();
  instance.render();
  for (let i = 0; i < quizQuestions.length; i++) {
    option(instance, quizQuestions[i].correctOptionIndex).onPress();
    instance.render();
    assert.ok(text(instance.tree).includes(quizQuestions[i].options[quizQuestions[i].correctOptionIndex].feedback));
    button(instance, i === quizQuestions.length - 1 ? "See Results" : "Next Question").onPress();
    instance.render();
  }
  assert.equal(completed, 1);
  assert.ok(text(instance.tree).includes("100%"));
  button(instance, "Try Again").onPress();
  instance.render();
  assert.ok(text(instance.tree).includes("Question 1 of"));
  assert.ok(nodes(instance.tree).filter(node => node.props?.accessibilityRole === "radio").every(node => !node.props.accessibilityState.checked));
});

test("Education web columns fill viewport height and remain full-width on mobile", () => {
  const components = [load("screens/HeatSmartLearningScreen.js").default,
    load("screens/VisualLearningScreen.js").default, load("screens/QuizScreen.js").default,
    screens.ScenarioLearningScreen, screens.ScenarioDetailsScreen, screens.ScenarioQuestionScreen, screens.ScenarioCompleteScreen];
  const props = { navigation: navigation(), completedScenarioIds: [], route: { params: { scenarioId: scenarios[0].id } } };
  const mergeStyle = style => Object.assign({}, ...[style].flat().filter(Boolean));
  for (const component of components) {
    native.Platform.OS = "web";
    const instance = mount(component, props);
    const outer = typeof instance.tree.type === "function" ? mount(instance.tree.type, instance.tree.props).tree : instance.tree;
    assert.equal(mergeStyle(outer.props.style).backgroundColor, "#EEF2F0");
    const column = nodes(outer).find(node => {
      const style = mergeStyle(node.props?.style);
      const expectedBackground = component.name === "HeatSmartLearningScreen" ? "#F5F8F6" : "#EEF2F0";
      return style.backgroundColor === expectedBackground && [430, 440].includes(style.maxWidth);
    });
    assert.ok(column, "Missing full-height central Education column");
    const columnStyle = mergeStyle(column.props.style);
    assert.equal(columnStyle.flex, 1);
    assert.equal(columnStyle.width, "100%");
    assert.equal(columnStyle.minHeight, 0);
    assert.equal(columnStyle.alignSelf, "center");
    const pageScroll = nodes(outer).find(node => node.type === "ScrollView");
    assert.ok(pageScroll);
    assert.equal(mergeStyle(pageScroll.props.contentContainerStyle).maxWidth, 430);
    try {
      native.Platform.OS = "android";
      const mobile = mount(component, props);
      const mobileOuter = typeof mobile.tree.type === "function" ? mount(mobile.tree.type, mobile.tree.props).tree : mobile.tree;
      assert.equal(mergeStyle(mobileOuter.props.style).backgroundColor, "#EEF2F0");
      assert.equal(mergeStyle(mobileOuter.props.style).alignItems, undefined);
      const mobileScrollStyle = nodes(mobileOuter).find(node => node.type === "ScrollView").props.style;
      if (component.name === "HeatSmartLearningScreen") {
        assert.equal(mergeStyle(mobileScrollStyle).width, "100%");
        assert.equal(mergeStyle(mobileScrollStyle).maxWidth, 430);
      } else assert.equal(mobileScrollStyle, undefined);
    } finally {
      native.Platform.OS = "web";
    }
  }
});

// Review tests submit real screen answers, then inspect every saved answer card.
for (const platform of ["web", "android"]) {
  for (const correctCount of [0, 5, 10]) {
    test("Quiz review: " + platform + ", " + correctCount + " correct answers, all cards, results, and fresh attempt", () => {
      const { quizQuestions } = load("data/quizQuestions.js");
      const nav = navigation();
      let completed = 0;
      native.Platform.OS = platform;
      try {
        const instance = mount(load("screens/QuizScreen.js").default, { navigation: nav, onComplete: () => completed++ });
        button(instance, "Start Quiz").onPress();
        instance.render();
        const selectedIndexes = [];
        for (let i = 0; i < quizQuestions.length; i++) {
          const q = quizQuestions[i];
          const selected = i < correctCount ? q.correctOptionIndex : (q.correctOptionIndex + 1) % q.options.length;
          selectedIndexes.push(selected);
          const submit = option(instance, selected).onPress;
          const otherSubmit = option(instance, (selected + 1) % q.options.length).onPress;
          submit(); submit(); otherSubmit();
          instance.render();
          assert.equal(option(instance, selected).accessibilityState.checked, true);
          const next = button(instance, i === quizQuestions.length - 1 ? "See Results" : "Next Question").onPress;
          next(); next();
          instance.render();
          if (i < quizQuestions.length - 1) assert.ok(text(instance.tree).includes("Question " + (i + 2) + " of"));
        }
        assert.equal(completed, 1);
        const assertResults = () => {
          assert.ok(text(instance.tree).includes(correctCount + " / 10"));
          assert.ok(text(instance.tree).includes("Correct answers: " + correctCount));
          assert.ok(text(instance.tree).includes("Incorrect answers: " + (10 - correctCount)));
          assert.ok(text(instance.tree).includes("Total questions: 10"));
        };
        assertResults();
        const open = button(instance, "Review All Answers").onPress;
        open(); open();
        instance.render();
        const assertReview = () => {
          const cards = nodes(instance.tree).filter(node => node.type === "View" && node.key !== undefined);
          assert.equal(cards.length, 10);
          for (let i = 0; i < quizQuestions.length; i++) {
            const q = quizQuestions[i], selected = selectedIndexes[i];
            const card = cards.find(node => node.key === q.id);
            assert.ok(card);
            assert.ok(text(card).includes("Question " + (i + 1) + " of 10"));
            assert.ok(text(card).includes(q.title));
            assert.ok(text(card).includes("Your answer: " + q.options[selected].text));
            assert.ok(text(card).includes(q.options[q.correctOptionIndex].text));
            assert.ok(text(card).includes(q.options[q.correctOptionIndex].feedback));
            const correct = selected === q.correctOptionIndex;
            assert.ok(nodes(card).some(node => node.type === "Text" && text(node) === (correct ? "Correct" : "Incorrect")));
            const indicator = nodes(card).find(node => node.type === "Ionicons");
            assert.equal(indicator.props.name, correct ? "checkmark-circle" : "close-circle");
            assert.equal(indicator.props.color, correct ? "#39775F" : "#E9A6AA");
            if (!correct) assert.ok(text(card).includes(q.options[selected].feedback));
          }
          assert.equal(nodes(instance.tree).filter(node => node.props?.accessibilityRole === "radio").length, 0);
          const scroll = nodes(instance.tree).find(node => node.type === "ScrollView");
          assert.equal(scroll.props.contentContainerStyle.maxWidth, 430);
          assert.equal(scroll.props.style?.maxWidth, platform === "web" ? 430 : undefined);
          assert.equal(completed, 1);
        };
        assertReview();
        button(instance, "Back to Results").onPress();
        instance.render();
        assertResults();
        button(instance, "Review All Answers").onPress();
        instance.render();
        assertReview();
        // The header Back action must also return to results without leaving the quiz.
        nodes(instance.tree).find(node => node.props?.accessibilityLabel === "Back to Results").props.onPress();
        instance.render();
        assertResults();
        assert.equal(nav.calls.length, 0);
        button(instance, "Try Again").onPress();
        instance.render();
        assert.ok(text(instance.tree).includes("Question 1 of 10"));
        assert.ok(nodes(instance.tree).filter(node => node.props?.accessibilityRole === "radio").every(node => !node.props.accessibilityState.checked));
        // Complete a different attempt to prove neither the previous score nor answers survive.
        for (let i = 0; i < quizQuestions.length; i++) {
          option(instance, quizQuestions[i].correctOptionIndex).onPress();
          instance.render();
          button(instance, i === quizQuestions.length - 1 ? "See Results" : "Next Question").onPress();
          instance.render();
        }
        assert.equal(completed, 2);
        assert.ok(text(instance.tree).includes("10 / 10"));
        button(instance, "Review All Answers").onPress();
        instance.render();
        assert.equal(nodes(instance.tree).filter(node => node.type === "Text" && text(node) === "Incorrect").length, 0);
      } finally {
        native.Platform.OS = "web";
      }
    });
  }
}

test("Quiz review gracefully identifies unavailable answers without inventing selections or changing the score", () => {
  const { quizQuestions } = load("data/quizQuestions.js");
  let completed = 0;
  const instance = mount(load("screens/QuizScreen.js").default, { navigation: navigation(), onComplete: () => completed++ });
  button(instance, "Start Quiz").onPress();
  instance.render();
  for (let i = 0; i < quizQuestions.length; i++) {
    option(instance, quizQuestions[i].correctOptionIndex).onPress();
    instance.render();
    button(instance, i === quizQuestions.length - 1 ? "See Results" : "Next Question").onPress();
    instance.render();
  }
  // Simulate lost or invalid saved review state; completion score is kept separately.
  instance.slots[4] = [null, 99];
  instance.render();
  button(instance, "Review All Answers").onPress();
  instance.render();
  assert.equal(nodes(instance.tree).filter(node => node.type === "Text" && text(node) === "Answer unavailable").length, 10);
  assert.equal(nodes(instance.tree).filter(node => node.type === "Text" && text(node).startsWith("Your answer: No answer was recorded")).length, 10);
  assert.equal(nodes(instance.tree).filter(node => node.type === "Text" && text(node) === "Incorrect").length, 0);
  for (const q of quizQuestions) assert.ok(text(instance.tree).includes(q.options[q.correctOptionIndex].feedback));
  button(instance, "Back to Results").onPress();
  instance.render();
  assert.ok(text(instance.tree).includes("10 / 10"));
  assert.equal(completed, 1);
});

test("Sequential thresholds use unique known IDs and require both prerequisites for Quiz", () => {
  const { visualActivities } = load("data/visualLearning.js");
  const { getLearningAccess } = load("utils/learningProgress.js");
  const visual = visualActivities.map(item => item.id), scenario = scenarios.map(item => item.id);
  for (const [v, s, scenarioOpen, quizOpen] of [
    [[], [], false, false], [visual.slice(0, 8), [], false, false],
    [visual, [], true, false], [visual, scenario.slice(0, 2), true, false],
    [visual, scenario, true, true], [[], scenario, false, false],
    [Array(9).fill(visual[0]), Array(3).fill(scenario[0]), false, false],
    [[...visual.slice(0, 8), 999], scenario, false, false],
  ]) {
    const access = getLearningAccess(v, s);
    assert.equal(access.scenarioUnlocked, scenarioOpen);
    assert.equal(access.quizUnlocked, quizOpen);
  }
});

test("Module locks, exact unlock messages, progress, and revision access match all sequential states", () => {
  const { visualActivities } = load("data/visualLearning.js");
  const visual = visualActivities.map(item => item.id), scenario = scenarios.map(item => item.id);
  const { SCENARIO_UNLOCK_MESSAGE, QUIZ_UNLOCK_MESSAGE } = load("utils/learningProgress.js");
  for (const [v, s, quizCompleted, scenarioOpen, quizOpen] of [
    [[], [], false, false, false], [visual.slice(0, 8), [], false, false, false],
    [visual, [], false, true, false], [visual, scenario.slice(0, 2), false, true, false],
    [visual, scenario, false, true, true], [visual, scenario, true, true, true],
    [[], scenario, true, false, false],
  ]) {
    const nav = navigation();
    const instance = mount(load("screens/HeatSmartLearningScreen.js").default,
      { navigation: nav, completedVisualActivityIds: v, completedScenarioIds: s, quizCompleted });
    const rows = nodes(instance.tree).filter(node => node.type === "View" && ["Visual Learning", "Scenario Learning", "Quizzes"].includes(node.key)).map(wrapper => ({ ...nodes(wrapper).find(node => node.type === "TouchableOpacity"), key: wrapper.key }));
    assert.equal(rows.length, 3);
    for (const [title, unlocked, target, message] of [
      ["Visual Learning", true, "VisualLearning", ""],
      ["Scenario Learning", scenarioOpen, "ScenarioLearning", SCENARIO_UNLOCK_MESSAGE],
      ["Quizzes", quizOpen, "Quiz", QUIZ_UNLOCK_MESSAGE],
    ]) {
      const row = rows.find(node => node.key === title);
      assert.equal(row.props.disabled, !unlocked);
      assert.equal(row.props.accessibilityState.disabled, !unlocked);
      const icons = nodes(row).filter(node => node.type === "Ionicons").map(node => node.props.name);
      assert.ok(icons.includes(unlocked ? "chevron-forward" : "lock-closed-outline"));
      assert.ok(!icons.includes(unlocked ? "lock-closed-outline" : "chevron-forward"));
      if (!unlocked) {
        assert.ok(text(row).includes(message));
        assert.equal(row.props.style.at(-1).backgroundColor, "#F1F3F2");
      }
      const before = nav.calls.length;
      row.props.onPress();
      assert.equal(nav.calls.length, before + (unlocked ? 1 : 0));
      if (unlocked) assert.equal(nav.calls.at(-1)[1], target);
    }
    const count = v.length + s.length + (quizCompleted ? 1 : 0);
    assert.ok(text(instance.tree).includes(count + " of 13 activities completed"));
    if (quizCompleted) {
      const quizRow = rows.find(node => node.key === "Quizzes");
      assert.ok(text(quizRow).includes("1 / 1 completed"));
      assert.ok(nodes(quizRow).some(node => node.props?.name === "checkmark-circle"));
    }
  }
});

test("Learning journey follows real completion with one current level, locks, green connectors and final trophy", () => {
  const { visualActivities } = load("data/visualLearning.js");
  const visual = visualActivities.map(item => item.id), scenario = scenarios.map(item => item.id);
  for (const [v, s, quizCompleted, current, connected] of [
    [[], [], false, 1, 0],
    [visual, [], false, 2, 1],
    [visual, scenario, false, 3, 2],
    [visual, scenario, true, 0, 2],
    [[], scenario, true, 1, 0], // Legacy completion never bypasses prerequisite locks.
  ]) {
    const instance = mount(load("screens/HeatSmartLearningScreen.js").default,
      { navigation: navigation(), completedVisualActivityIds: v, completedScenarioIds: s, quizCompleted });
    const all = nodes(instance.tree);
    const levels = all.filter(node => /^learning-level-/.test(node.props?.testID ?? ""));
    assert.equal(levels.length, 3);
    levels.forEach((level, index) => {
      assert.ok(text(level).includes(`Level ${index + 1}`));
      assert.equal(text(level).includes("Your next level"), current === index + 1);
      const currentStyle = level.props.style.find(style => style?.borderWidth === 2);
      assert.equal(!!currentStyle, current === index + 1);
      if (currentStyle) assert.equal(currentStyle.borderColor, "#39775F");
    });
    assert.ok(text(levels[2]).includes("Final challenge"));
    assert.ok(nodes(levels[2]).some(node => node.props?.name === "trophy-outline"));
    const connectors = all.filter(node => /^learning-connector-/.test(node.props?.testID ?? ""));
    assert.equal(connectors.length, 2);
    connectors.forEach((connector, index) => {
      const line = nodes(connector).find(node => Array.isArray(node.props?.style) && node.props.style[0]?.borderStyle === "dashed");
      assert.ok(line);
      assert.equal(!!line.props.style[1], index < connected);
      const arrow = nodes(connector).find(node => node.props?.name === "arrow-down");
      assert.equal(arrow.props.color, index < connected ? "#39775F" : "#B4BDB8");
    });
  }
});

test("App guards every Scenario and Quiz entry, including direct routes without params, while preserving unrelated routes", () => {
  const app = mount(load("App.js").default, {});
  const rawRoute = (name, nav) => {
    const route = nodes(app.tree).find(node => node.type === "Screen" && node.props.name === name);
    return route.props.children.find(value => typeof value === "function")({ navigation: nav, route: { name } });
  };
  const check = (name, allowed, module) => {
    const nav = navigation(), guarded = rawRoute(name, nav);
    assert.equal(guarded.type.name, "LearningRouteGuard");
    const rendered = mount(guarded.type, guarded.props);
    assert.equal(guarded.props.allowed, allowed);
    if (!allowed) {
      assert.equal(rendered.tree, null, "Locked content must not mount");
      assert.equal(nav.calls.length, 1);
      assert.equal(nav.calls[0][0], "replace");
      assert.equal(nav.calls[0][1], "LearningHome");
      assert.equal(nav.calls[0][2].lockedModule, module);
      // Re-rendering an unchanged blocked route should not send another redirect.
      rendered.render();
      assert.equal(nav.calls.length, 1);
      const dashboard = mount(load("screens/HeatSmartLearningScreen.js").default, {
        navigation: nav, route: { params: nav.calls[0][2] },
      });
      assert.ok(nodes(dashboard.tree).some(node => node.props?.accessibilityRole === "alert"));
    } else {
      assert.ok(rendered.tree);
      assert.equal(nav.calls.length, 0);
    }
  };
  const scenarioRoutes = ["ScenarioLearning", "ScenarioDetails", "ScenarioQuestion", "ScenarioComplete"];
  for (const name of scenarioRoutes) check(name, false, "scenario");
  check("Quiz", false, "quiz");
  const visual = rawRoute("VisualLearning", navigation());
  assert.equal(visual.type.name, "VisualLearningScreen");
  const { visualActivities } = load("data/visualLearning.js");
  for (const activity of visualActivities) {
    visual.props.onActivityComplete(activity.id);
    visual.props.onActivityComplete(activity.id);
  }
  app.render();
  for (const name of scenarioRoutes) check(name, true, "scenario");
  check("Quiz", false, "quiz");
  for (const scenario of scenarios) {
    const guard = rawRoute("ScenarioQuestion", navigation());
    const child = mount(guard.type, guard.props).tree[0];
    child.props.onComplete(scenario.id);
    child.props.onComplete(scenario.id);
    app.render();
  }
  check("Quiz", true, "quiz");
  const quizGuard = rawRoute("Quiz", navigation());
  const quiz = mount(quizGuard.type, quizGuard.props).tree[0];
  quiz.props.onComplete(); quiz.props.onComplete();
  app.render();
  const dashboardRoute = rawRoute("LearningHome", navigation());
  assert.equal(dashboardRoute.props.completedVisualActivityIds.length, 9);
  assert.equal(dashboardRoute.props.completedScenarioIds.length, 3);
  assert.equal(dashboardRoute.props.quizCompleted, true);
  const summary = mount(dashboardRoute.type, dashboardRoute.props);
  assert.ok(text(summary.tree).includes("13 of 13 activities completed"));
  check("Quiz", true, "quiz");
  for (const name of scenarioRoutes) check(name, true, "scenario");
  for (const name of ["Home", "EventPlanner", "EventDetails", "NearbyCooling", "CoolingNavigation", "HeatAwareActivityPlanner", "FeedbackFormList", "FeedbackForm"]) {
    const route = nodes(app.tree).find(node => ["Screen", "TabScreen"].includes(node.type) && node.props.name === name);
    assert.ok(route.props.component, "Unrelated route was wrapped or removed: " + name);
  }
});

test("Legacy quiz completion remains counted when prerequisites are missing; notices disappear when unlocked", () => {
  const app = mount(load("App.js").default, {});
  // Simulate pre-existing in-memory progress; no persistence or progress deletion is introduced.
  app.slots[1] = true;
  app.render();
  const route = name => nodes(app.tree).find(node => node.type === "Screen" && node.props.name === name);
  const renderRoute = (name, props = {}) => route(name).props.children.find(value => typeof value === "function")(props);
  assert.equal(renderRoute("Quiz").props.allowed, false);
  const dashboard = renderRoute("LearningHome", { navigation: navigation(), route: { params: { lockedModule: "quiz" } } });
  const summary = mount(dashboard.type, dashboard.props);
  assert.ok(text(summary.tree).includes("1 of 13 activities completed"));
  assert.equal(dashboard.props.quizCompleted, true);
  assert.ok(nodes(summary.tree).some(node => node.props?.accessibilityRole === "alert"));
  const { visualActivities } = load("data/visualLearning.js");
  app.slots[0] = scenarios.map(item => item.id);
  app.slots[2] = visualActivities.map(item => item.id);
  app.render();
  assert.equal(renderRoute("Quiz").props.allowed, true);
  const unlocked = renderRoute("LearningHome", { navigation: navigation(), route: { params: { lockedModule: "quiz" } } });
  assert.equal(unlocked.props.quizCompleted, true);
  assert.equal(nodes(mount(unlocked.type, unlocked.props).tree).filter(node => node.props?.accessibilityRole === "alert").length, 0);
});

function hintNodes(instance) {
  return nodes(instance.tree).filter(node => node.type?.name === "LearningHint");
}

test("Hints are short, distinct prompts for all nine activities and fifteen decisions, without copying correct answers", () => {
  const { visualActivities } = load("data/visualLearning.js");
  const questions = scenarios.flatMap(scenario => scenario.questions);
  const all = [...visualActivities, ...questions];
  assert.equal(all.length, 24);
  assert.equal(new Set(all.map(item => item.hint)).size, 24);
  for (const item of all) {
    assert.ok(typeof item.hint === "string" && item.hint.length > 10 && item.hint.length <= 120);
    if (item.options) assert.ok(!item.hint.toLowerCase().includes(item.options[item.correctOptionIndex].text.toLowerCase()));
    if (item.correctInteraction) assert.ok(!item.hint.toLowerCase().includes(item.correctInteraction.toLowerCase()));
    if (item.tapArea) assert.ok(!/left|right|rectangle|percent|highlight/i.test(item.hint));
  }
});

for (const activity of load("data/visualLearning.js").visualActivities) {
  test("Visual hint " + activity.id + ": third-attempt threshold, continued retries, reopening reset, and correct completion", () => {
    const completed = [];
    const instance = mount(load("screens/VisualLearningScreen.js").default,
      { navigation: navigation(), onActivityComplete: id => completed.push(id) });
    const open = () => {
      nodes(instance.tree).find(node => node.props?.accessibilityLabel?.startsWith("Open Activity " + activity.id + ":")).props.onPress();
      instance.render();
    };
    const wrong = () => {
      if (activity.type === "tap") nodes(instance.tree).find(node => node.props?.accessibilityLabel === "Activity image: tap an area").props.onPress();
      else button(instance, "Check Answer").onPress();
      instance.render();
    };
    open();
    assert.equal(hintNodes(instance).length, 0);
    for (let attempt = 1; attempt <= 4; attempt++) {
      wrong();
      assert.ok(text(instance.tree).includes(activity.incorrectFeedback || "Try again."));
      assert.equal(hintNodes(instance).length, attempt >= 3 ? 1 : 0);
      if (attempt >= 3) assert.equal(hintNodes(instance)[0].props.hint, activity.hint);
      assert.equal(completed.length, 0);
      assert.ok(!nodes(instance.tree).some(node => node.type === "TouchableOpacity" && text(node) === "Next Activity"));
    }
    // Returning to the overview and opening this activity is a fresh attempt.
    nodes(instance.tree).find(node => node.props?.accessibilityLabel === "Back to Visual Learning overview").props.onPress();
    instance.render();
    open();
    assert.equal(hintNodes(instance).length, 0);
    wrong(); wrong();
    assert.equal(hintNodes(instance).length, 0);
    wrong();
    assert.equal(hintNodes(instance)[0].props.hint, activity.hint);
    if (activity.type === "items") {
      // Changing selections clears old feedback, but the hint stays available.
      for (const index of activity.correctItemIndexes) {
        nodes(instance.tree).filter(node => node.props?.accessibilityRole === "checkbox")[index].props.onPress();
        instance.render();
        assert.equal(hintNodes(instance).length, 1);
      }
      const accept = button(instance, "Check Answer").onPress;
      accept(); accept();
    } else {
      const accept = nodes(instance.tree).find(node => node.props?.accessibilityLabel === activity.correctInteraction).props.onPress;
      accept(); accept();
    }
    instance.render();
    assert.deepEqual(completed, [activity.id]);
    assert.equal(hintNodes(instance).length, 0);
    assert.ok(text(instance.tree).includes(activity.correctFeedback));
    const next = nodes(instance.tree).find(node => node.type === "TouchableOpacity" && text(node) === "Next Activity");
    if (next) {
      next.props.onPress();
      instance.render();
      assert.equal(hintNodes(instance).length, 0);
      const nextActivity = load("data/visualLearning.js").visualActivities[activity.id];
      if (nextActivity.type === "tap") nodes(instance.tree).find(node => node.props?.accessibilityLabel === "Activity image: tap an area").props.onPress();
      else button(instance, "Check Answer").onPress();
      instance.render();
      assert.equal(hintNodes(instance).length, 0, "Previous attempts must not carry over");
    }
  });
}

for (const scenario of scenarios) {
  test("Scenario hints " + scenario.id + ": independent counters, popup retry, disabled Check, and all decisions complete", () => {
    const completed = [];
    const instance = mount(screens.ScenarioQuestionScreen, {
      navigation: navigation(), route: { params: { scenarioId: scenario.id } },
      onComplete: id => completed.push(id),
    });
    for (let i = 0; i < scenario.questions.length; i++) {
      const question = scenario.questions[i];
      assert.equal(hintNodes(instance).length, 0);
      // A disabled unanswered Check must not count an attempt.
      button(instance, "Check").onPress(); button(instance, "Check").onPress();
      instance.render();
      for (let attempt = 1; attempt <= 4; attempt++) {
        option(instance, (question.correctOptionIndex + 1) % question.options.length).onPress();
        instance.render();
        const check = button(instance, "Check").onPress;
        check(); check(); check();
        instance.render();
        assert.ok(text(instance.tree).includes(question.options[(question.correctOptionIndex + 1) % question.options.length].feedback));
        assert.equal(hintNodes(instance).length, attempt >= 3 ? 1 : 0);
        if (attempt >= 3) assert.equal(hintNodes(instance)[0].props.hint, question.hint);
        assert.equal(completed.length, 0);
        assert.equal(instance.tree.props.pageKey, i);
        // Check is disabled during feedback; queued or programmatic repeated callbacks must not count.
        button(instance, "Check").onPress(); button(instance, "Check").onPress();
        const dismiss = button(instance, "I Understand").onPress;
        dismiss(); dismiss();
        instance.render();
        assert.equal(modal(instance).visible, false);
        assert.equal(hintNodes(instance).length, attempt >= 3 ? 1 : 0);
        assert.equal(instance.tree.props.pageKey, i);
      }
      option(instance, question.correctOptionIndex).onPress();
      instance.render();
      button(instance, "Check").onPress();
      instance.render();
      assert.equal(hintNodes(instance).length, 0);
      assert.ok(text(instance.tree).includes("Good Choice"));
      const accept = button(instance, "Continue").onPress;
      accept(); accept();
      instance.render();
      assert.equal(hintNodes(instance).length, 0);
      if (i < scenario.questions.length - 1) assert.equal(instance.tree.props.pageKey, i + 1);
    }
    assert.deepEqual(completed, [scenario.id]);
  });
}

test("Hint panel uses existing information colours, a lightbulb and readable inline content", () => {
  const panel = mount(load("components/LearningHint.js").default, { hint: "Consider how exposed you would be." });
  assert.equal(panel.tree.props.style.backgroundColor, "#EBF3FF");
  assert.equal(panel.tree.props.style.position, undefined);
  assert.equal(panel.tree.props.accessibilityLiveRegion, "polite");
  assert.ok(text(panel.tree).includes("Hint"));
  assert.ok(text(panel.tree).includes("Consider how exposed you would be."));
  assert.ok(nodes(panel.tree).some(node => node.props?.name === "bulb-outline"));
  assert.equal(mount(load("components/LearningHint.js").default, {}).tree, null);
});
