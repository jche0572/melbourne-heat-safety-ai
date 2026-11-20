const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const babel = require("../node_modules/@babel/core");
let active;
const React = {
  createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
  useState(initial) {
    const owner = active, index = owner.cursor++;
    if (!(index in owner.slots)) owner.slots[index] = typeof initial === "function" ? initial() : initial;
    return [owner.slots[index], value => { owner.slots[index] = typeof value === "function" ? value(owner.slots[index]) : value; }];
  },
  useRef(initial) {
    const index = active.cursor++;
    if (!(index in active.slots)) active.slots[index] = { current: initial };
    return active.slots[index];
  },
  useEffect() {},
  useMemo: factory => factory(),
  useCallback: callback => callback,
};
const native = {
  View: "View", Text: "Text", Pressable: "Pressable", Linking: { openURL: async () => {} },
  StyleSheet: { create: x => x, absoluteFillObject: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } },
  useWindowDimensions: () => ({ width: 375, height: 667 }),
  PanResponder: { create: handlers => ({ panHandlers: handlers }) },
  Alert: { alert: (...args) => native.alerts.push(args) }, alerts: [],
};
function load(file, imports = {}) {
  const code = babel.transformSync(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    babelrc: false, configFile: false, plugins: [require("../node_modules/@babel/plugin-transform-react-jsx"), require("../node_modules/@babel/plugin-transform-modules-commonjs")],
  }).code;
  const module = { exports: {} };
  new Function("require", "module", "exports", "window", code)(id => {
    if (id in imports) return imports[id];
    if (id === "../utils/useBubbleDrag") return load("utils/useBubbleDrag.js", {
      "react-native": { ...native, ...imports["react-native"] },
      "../components/MiniMapProvider": { useMiniMap: () => ({}) },
      "./bubbleDrag": load("utils/bubbleDrag.js"),
    });
    if (id === "react") return React;
    if (id === "react-native") return native;
    if (id === "@expo/vector-icons") return { Ionicons: "Ionicons" };
    if (id === "@react-navigation/native") return {
      NavigationContainer: "NavigationContainer", StackActions: { popTo: (name, params) => ({ type: "POP_TO", payload: { name, params } }) },
      DefaultTheme: { colors: {} }, DarkTheme: { colors: {} },
    };
    if (id === "@react-navigation/native-stack") return { createNativeStackNavigator: () => ({ Navigator: "Navigator", Screen: "Screen" }) };
    if (id === "@react-navigation/bottom-tabs") return { createBottomTabNavigator: () => ({ Navigator: "TabNavigator", Screen: "TabScreen" }) };
    if (id === "react-native-safe-area-context") return { SafeAreaProvider: "SafeAreaProvider", useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
    if (id.endsWith("/theme/useAppTheme")) return {
      AppThemeProvider: "AppThemeProvider",
      useAppTheme: () => ({ dark: false, colors: {}, color: value => value, styles: styles => styles, setWeatherNight() {} }),
      useThemedStyles: styles => ({ styles, theme: { dark: false, color: value => value } }),
    };
    if (id.endsWith("/utils/coolingDisplay")) return load("utils/coolingDisplay.js");
    if (id.includes("learningProgress")) return { getLearningAccess: () => ({ quizUnlocked: true, scenarioUnlocked: true }) };
    return { default: id, __esModule: true };
  }, module, module.exports, { google: { maps: { SymbolPath: { CIRCLE: "CIRCLE" }, Size: class Size { constructor(width, height) { Object.assign(this, { width, height }); } }, Point: class Point { constructor(x, y) { Object.assign(this, { x, y }); } } } } });
  return module.exports;
}
function mount(component, props = {}) {
  const owner = { slots: [], cursor: 0 };
  owner.render = () => { active = owner; owner.cursor = 0; owner.tree = component(props); return owner.tree; };
  owner.render(); return owner;
}
function mountApp(imports) {
  const root = mount(load("App.js", imports).default);
  // App now provides theme context around the stateful navigation component.
  const content = nodes(root.tree).find(node => typeof node.type === "function");
  return mount(content.type, content.props);
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
}
function find(owner, label) { return nodes(owner.tree).find(node => node.props?.accessibilityLabel === label); }
const core = load("utils/miniMapRoute.js");
const params = {
  origin: { latitude: -37.81, longitude: 144.96, label: "Start" },
  coolingOption: { latitude: "-37.82", longitude: "144.97", name: "Shade", type: "shade", id: 7 },
  routeInfo: { distanceMeters: 700, durationMinutes: 9 },
  routeCoordinates: [{ latitude: -37.81, longitude: 144.96 }, { latitude: -37.82, longitude: 144.97 }],
  finalDestination: { latitude: -37.83, longitude: 144.98, label: "Finish" },
  finalRouteCoordinates: [{ latitude: -37.82, longitude: 144.97 }, { latitude: -37.83, longitude: 144.98 }],
};
test("minimize copies route, destination, metrics and second leg before going back", () => {
  const calls = []; let saved;
  const snapshot = core.minimizeCoolingRoute({ canGoBack: () => true, goBack: () => calls.push("back") }, params, value => { saved = value; calls.push("save"); });
  assert.deepEqual(calls, ["save", "back"]);
  assert.equal(saved, snapshot);
  assert.equal(saved.coolingOption.latitude, -37.82);
  assert.equal(saved.coolingOption.id, 7);
  assert.deepEqual(saved.routeInfo, params.routeInfo);
  assert.deepEqual(saved.finalRouteCoordinates, params.finalRouteCoordinates);
  assert.notEqual(saved.routeCoordinates, params.routeCoordinates);
  assert.notEqual(saved.coolingOption, params.coolingOption);
});
test("minimize without previous screen replaces route screen with Nearby Cooling", () => {
  let replaced;
  core.minimizeCoolingRoute({ canGoBack: () => false, replace: name => { replaced = name; } }, params, () => {});
  assert.equal(replaced, "NearbyCooling");
});
test("invalid route data never activates mini map or navigates", () => {
  for (const invalid of [null, {}, { ...params, routeCoordinates: [] }, { ...params, coolingOption: { latitude: null, longitude: 2 } }, { ...params, routeCoordinates: [{ latitude: 91, longitude: 0 }, params.routeCoordinates[1]] }, { ...params, finalDestination: { latitude: 0, longitude: Infinity } }]) {
    assert.throws(() => core.minimizeCoolingRoute({ canGoBack: () => assert.fail("navigated") }, invalid, () => assert.fail("saved invalid route")));
  }
});
test("restore uses existing stack entry when present, otherwise opens same route", () => {
  for (const existing of [true, false]) {
    const calls = [];
    core.restoreCoolingRoute({
      getRootState: () => ({ routes: [{ name: "Home" }, ...(existing ? [{ name: "CoolingNavigation" }] : [])] }),
      dispatch: action => calls.push(action), navigate: (name, data) => calls.push({ name, data }),
    }, params, (name, data) => ({ type: "POP_TO", name, data }));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, "CoolingNavigation");
    assert.equal(calls[0].type, existing ? "POP_TO" : undefined);
    assert.deepEqual(calls[0].data, core.createMiniMapRoute(params));
  }
});
test("installed navigation router restores the route without duplicate stack entries", async () => {
  const { pathToFileURL } = require("node:url");
  const { StackRouter, StackActions } = await import(pathToFileURL(path.resolve(__dirname, "../node_modules/@react-navigation/routers/lib/module/StackRouter.js")).href);
  const router = StackRouter({ initialRouteName: "Home" });
  const options = { routeNames: ["Home", "NearbyCooling", "CoolingNavigation", "EventPlanner"], routeParamList: {}, routeGetIdList: {} };
  let state = router.getInitialState(options);
  const dispatch = action => { state = router.getStateForAction(state, action, options); assert.ok(state); };
  const navigation = { getRootState: () => state, dispatch, navigate: (name, data) => dispatch({ type: "NAVIGATE", payload: { name, params: data } }) };
  navigation.navigate("NearbyCooling");
  core.restoreCoolingRoute(navigation, params, StackActions.popTo);
  navigation.navigate("EventPlanner");
  core.restoreCoolingRoute(navigation, params, StackActions.popTo);
  assert.deepEqual(state.routes.map(route => route.name), ["Home", "NearbyCooling", "CoolingNavigation"]);
  assert.deepEqual(state.routes.at(-1).params, core.createMiniMapRoute(params));
  core.restoreCoolingRoute(navigation, params, StackActions.popTo);
  assert.equal(state.routes.filter(route => route.name === "CoolingNavigation").length, 1);
});
test("app-level mini map survives screen changes, closes without navigation, and restores only once", () => {
  const app = mountApp({ "./utils/miniMapRoute": core });
  const navNode = () => nodes(app.tree).find(node => node.type === "NavigationContainer");
  const overlay = () => nodes(app.tree).find(node => node.type === "./components/MiniMapOverlay");
  const provider = () => nodes(app.tree).find(node => node.type === "./components/MiniMapProvider");
  let screen = "NearbyCooling"; const calls = [];
  navNode().props.ref.current = {
    getCurrentRoute: () => ({ name: screen }), getRootState: () => ({ routes: [{ name: "Home" }, { name: screen }] }),
    navigate: (name, data) => calls.push({ name, data }), dispatch: action => calls.push(action),
  };
  navNode().props.onReady();
  provider().props.onMinimize(core.createMiniMapRoute(params)); app.render();
  assert.equal(overlay().props.currentScreen, "NearbyCooling");
  assert.equal(overlay().props.snapshot.coolingOption.id, 7);
  screen = "Home"; navNode().props.onStateChange(); app.render();
  assert.equal(overlay().props.currentScreen, "Home");
  assert.equal(overlay().props.snapshot.coolingOption.id, 7);
  const restore = overlay().props.onRestore; restore(); restore();
  assert.equal(calls.length, 1);
  app.render(); assert.equal(overlay().props.snapshot, null);
  provider().props.onMinimize(core.createMiniMapRoute(params)); app.render();
  overlay().props.onClose(); app.render();
  assert.equal(overlay().props.snapshot, null);
  assert.equal(calls.length, 1);
  assert.equal(overlay().props.currentScreen, "Home");
});
test("bubble hides on full route screen and leaves surrounding page interactive", () => {
  const component = load("components/MiniMapOverlay.web.js", { "../utils/miniMapRoute": core }).default;
  assert.equal(mount(component, { snapshot: params, currentScreen: "CoolingNavigation" }).tree, null);
  assert.equal(mount(component, { snapshot: null, currentScreen: "Home" }).tree, null);
  let restored = 0, closed = 0;
  const owner = mount(component, { snapshot: params, currentScreen: "Home", onRestore: () => restored++, onClose: () => closed++ });
  assert.equal(owner.tree.props.pointerEvents, "box-none");
  const bubble = find(owner, "Restore cooling route");
  const close = find(owner, "Dismiss cooling route");
  const style = bubble.props.style({ pressed: false })[0];
  assert.equal(style.width, 54); assert.equal(style.height, 54);
  assert.equal(style.borderRadius, 27);
  assert.equal(close.props.style({ pressed: false })[0].width, 44);
  assert.equal(bubble.props.tabIndex, 0); assert.equal(close.props.tabIndex, 0);
  bubble.props.onFocus(); owner.render();
  assert.equal(find(owner, "Restore cooling route").props.style({ pressed: false })[2].outlineWidth, 3);
  find(owner, "Restore cooling route").props.onPress();
  close.props.onPress();
  assert.equal(restored, 1); assert.equal(closed, 1);
});
test("full Web map restores optional destination and minimizes without route fetching", () => {
  let saved, fetches = 0, backs = 0;
  const screen = load("screens/CoolingNavigationScreen.web.js", {
    "../utils/miniMapRoute": core,
    "../components/MiniMapProvider": { useMiniMap: () => ({ minimize: value => { saved = value; } }) },
    "@react-google-maps/api": { useJsApiLoader: () => ({ isLoaded: true }), GoogleMap: "GoogleMap", MarkerF: "MarkerF", PolylineF: "PolylineF" },
    "../services/nearbyCoolingService": { getWalkingRoute: async () => { fetches++; } },
  }).default;
  const owner = mount(screen, { route: { params }, navigation: { canGoBack: () => true, goBack: () => backs++ } });
  find(owner, "Minimize cooling route map").props.onPress();
  assert.deepEqual(saved, core.createMiniMapRoute(params));
  assert.equal(backs, 1); assert.equal(fetches, 0);
  const lines = nodes(owner.tree).filter(node => node.type === "PolylineF");
  assert.equal(lines.length, 2);
});
test("native bubble loads without importing Web Google Maps or system overlay APIs", () => {
  assert.equal(load("components/MiniMapOverlay.js", { "../utils/miniMapRoute": core }).default({ snapshot: null, currentScreen: "Home" }), null);
  const source = fs.readFileSync(path.join(__dirname, "../components/MiniMapOverlay.js"), "utf8");
  assert.ok(!source.includes("@react-google-maps/api"));
  assert.ok(!source.includes("expo-modules-core"));
});
test("floating bubble renders only icons, never loads or mounts a Google Map", () => {
  const component = load("components/MiniMapOverlay.web.js", {
    "../utils/miniMapRoute": core,
    "@react-google-maps/api": new Proxy({}, { get() { assert.fail("bubble loaded Google Maps"); } }),
  }).default;
  const snapshot = core.createMiniMapRoute(params);
  const overlay = mount(component, { snapshot, currentScreen: "Home" });
  const elements = nodes(overlay.tree);
  assert.equal(elements.filter(node => node.type === "Pressable").length, 2);
  assert.equal(elements.filter(node => node.props?.testID === "cooling-route-bubble").length, 1);
  assert.equal(elements.filter(node => node.type === "Ionicons").length, 2);
  assert.ok(!elements.some(node => node.type === "Text" || typeof node.type === "function"));
  assert.ok(!fs.readFileSync(path.join(__dirname, "../components/MiniMapOverlay.web.js"), "utf8").includes("@react-google-maps/api"));
});

const external = load("utils/googleMapsNavigation.web.js", { "./miniMapRoute": core });
test("Maps launch saves the complete snapshot first and reuses a live tab for the same route", () => {
  const calls = []; let saved, error;
  const tab = { closed: false, focus: () => calls.push("focus"), opener: {} };
  const launch = external.createGoogleMapsLauncher(value => { saved = value; calls.push("save"); }, value => { error = value; }, {
    open: (url, target) => { calls.push({ url, target }); return tab; },
  });
  assert.equal(launch(params), true);
  assert.equal(calls[0], "save");
  assert.deepEqual(saved.routeCoordinates, params.routeCoordinates);
  assert.deepEqual(saved.finalRouteCoordinates, params.finalRouteCoordinates);
  assert.deepEqual(saved.routeInfo, params.routeInfo);
  const url = new URL(saved.googleMapsUrl);
  assert.equal(url.origin, "https://www.google.com");
  assert.equal(url.searchParams.get("origin"), "-37.81,144.96");
  assert.equal(url.searchParams.get("destination"), "-37.83,144.98");
  assert.equal(url.searchParams.get("waypoints"), "-37.82,144.97");
  assert.equal(url.searchParams.get("travelmode"), "walking");
  assert.equal(calls[1].target, "soladapt-cooling-route");
  assert.equal(tab.opener, null); assert.equal(error, null);
  launch(saved);
  assert.equal(calls.filter(value => value?.url).length, 1);
  assert.equal(calls.at(-1), "focus");
  tab.closed = true; launch(saved);
  assert.equal(calls.filter(value => value?.url).length, 2);
});
test("blocked or failed launches retain a retryable session without navigating SolAdapt", () => {
  for (const open of [() => null, () => { throw new Error("Launch failed"); }]) {
    let saved, error;
    const launch = external.createGoogleMapsLauncher(value => { saved = value; }, value => { error = value; }, { open });
    assert.equal(launch({ ...params, finalDestination: null, finalRouteCoordinates: [] }), false);
    assert.equal(saved.mode, "googleMaps");
    assert.ok(error);
    assert.equal(new URL(saved.googleMapsUrl).searchParams.get("destination"), "-37.82,144.97");
    assert.equal(new URL(saved.googleMapsUrl).searchParams.get("waypoints"), null);
  }
  let opens = 0;
  assert.equal(external.createGoogleMapsLauncher(() => assert.fail("saved invalid route"), () => {}, { open: () => opens++ })({}), false);
  assert.equal(opens, 0);
});
test("external bubble appears on Cooling Route too, reopens repeatedly and dismisses without navigation", () => {
  // Inject a launch browser into the utility rather than any Google Maps document.
  let opens = 0, focused = 0;
  const browser = { open: () => { opens++; return { closed: false, focus: () => focused++ }; } };
  const appWithBrowser = mountApp({
    "./utils/miniMapRoute": core,
    "./utils/googleMapsNavigation": { createGoogleMapsLauncher: (save, error) => external.createGoogleMapsLauncher(save, error, browser) },
  });
  const nav = nodes(appWithBrowser.tree).find(node => node.type === "NavigationContainer");
  nav.props.ref.current = { getCurrentRoute: () => ({ name: "CoolingNavigation" }) };
  nav.props.onReady();
  const getProvider = () => nodes(appWithBrowser.tree).find(node => node.type === "./components/MiniMapProvider");
  const getOverlay = () => nodes(appWithBrowser.tree).find(node => node.type === "./components/MiniMapOverlay");
  getProvider().props.onOpenGoogleMaps(params); appWithBrowser.render();
  assert.ok(core.shouldShowMiniMap(getOverlay().props.snapshot, "CoolingNavigation"));
  getOverlay().props.onRestore(); getOverlay().props.onRestore(); appWithBrowser.render();
  assert.equal(opens, 1); assert.equal(focused, 2);
  assert.equal(getOverlay().props.snapshot.mode, "googleMaps");
  getOverlay().props.onClose(); appWithBrowser.render();
  assert.equal(getOverlay().props.snapshot, null);
  assert.equal(getOverlay().props.currentScreen, "CoolingNavigation");
});
test("Open in Google Maps passes the current complete route to the shared launch action", () => {
  let saved;
  const screen = load("screens/CoolingNavigationScreen.web.js", {
    "../components/MiniMapProvider": { useMiniMap: () => ({ openGoogleMaps: value => { saved = value; } }) },
    "@react-google-maps/api": { useJsApiLoader: () => ({ isLoaded: true }), GoogleMap: "GoogleMap", MarkerF: "MarkerF", PolylineF: "PolylineF" },
  }).default;
  const owner = mount(screen, { route: { params }, navigation: {} });
  const button = find(owner, "Open route in Google Maps");
  assert.equal(button.props.disabled, false);
  button.props.onPress();
  assert.deepEqual(saved, params);
  const component = load("components/MiniMapOverlay.web.js", { "../utils/miniMapRoute": core }).default;
  const bubble = mount(component, { snapshot: { ...params, mode: "googleMaps" }, currentScreen: "CoolingNavigation", launchError: "Allow popups" });
  assert.ok(find(bubble, "Reopen cooling route in Google Maps"));
  assert.ok(nodes(bubble.tree).some(node => node.props?.accessibilityRole === "alert"));
});

for (const platform of ["ios", "android"]) {
  const platformNative = { ...native, Platform: { OS: platform }, SafeAreaView: "SafeAreaView", ScrollView: "ScrollView", TouchableOpacity: "TouchableOpacity", Keyboard: { dismiss() {} } };
  const launcher = load("utils/googleMapsNavigation.js", { "./miniMapRoute": core, "react-native": platformNative });
  test(`${platform}: save the complete route before launch; repeat launch preserves the URL and snapshot`, async () => {
    const calls = []; let snapshot, error;
    const launch = launcher.createGoogleMapsLauncher(value => { snapshot = value; calls.push("save"); }, value => { error = value; }, {
      openURL: async url => { calls.push(url); },
    });
    assert.equal(await launch(params), true);
    assert.equal(calls[0], "save");
    assert.equal(snapshot.mode, "googleMaps");
    assert.ok(calls[1].startsWith(platform === "ios" ? "comgooglemapsurl://www.google.com/maps/dir/" : "https://www.google.com/maps/dir/"));
    assert.deepEqual(snapshot.routeCoordinates, params.routeCoordinates);
    assert.deepEqual(snapshot.finalRouteCoordinates, params.finalRouteCoordinates);
    assert.deepEqual(snapshot.routeInfo, params.routeInfo);
    assert.equal(new URL(calls[1]).searchParams.get("travelmode"), "walking");
    assert.equal(new URL(calls[1]).searchParams.get("waypoints"), "-37.82,144.97");
    assert.equal(await launch(snapshot), true);
    assert.equal(calls[1], calls[3]); assert.equal(error, null);
  });
  test(`${platform}: failed launch is retryable, invalid data is rejected, and simultaneous taps launch once`, async () => {
    let saved, error, release, calls = 0;
    const launch = launcher.createGoogleMapsLauncher(value => { saved = value; }, value => { error = value; }, {
      openURL: () => { calls++; return new Promise(resolve => { release = resolve; }); },
    });
    const first = launch(params);
    assert.equal(await launch(params), false); assert.equal(calls, 1);
    release(); assert.equal(await first, true);
    const failed = launcher.createGoogleMapsLauncher(value => { saved = value; }, value => { error = value; }, {
      openURL: async () => { throw new Error("No URL handler"); },
    });
    assert.equal(await failed(params), false);
    assert.ok(saved.googleMapsUrl); assert.match(error, /retry/);
    assert.equal(await launcher.createGoogleMapsLauncher(() => assert.fail("invalid snapshot saved"), () => {}, {
      openURL: () => assert.fail("invalid launch"),
    })({}), false);
  });
  test(`${platform}: one accessible in-app bubble respects safe areas, reopens, dismisses and exposes launch errors`, () => {
    const component = load("components/MiniMapOverlay.js", {
      "../utils/miniMapRoute": core, "react-native": platformNative,
      "react-native-safe-area-context": { SafeAreaProvider: "SafeAreaProvider", useSafeAreaInsets: () => ({ top: 20, right: 8, bottom: 34, left: 0 }) },
    }).default;
    let opens = 0, closes = 0;
    const overlay = mount(component, { snapshot: { ...params, mode: "googleMaps" }, currentScreen: "CoolingNavigation", onRestore: () => opens++, onClose: () => closes++, launchError: "Unable to open Google Maps" });
    assert.equal(overlay.tree.props.pointerEvents, "box-none");
    const child = nodes(overlay.tree).find(node => typeof node.type === "function");
    const bubble = mount(child.type, child.props);
    assert.equal(bubble.tree.props.pointerEvents, "box-none");
    const controls = nodes(bubble.tree).find(node => node.props?.testID === "mini-map-overlay");
    assert.equal(controls.props.style[1].top, 451);
    assert.equal(controls.props.style[1].left, 301);
    assert.equal(nodes(bubble.tree).filter(node => node.props?.testID === "cooling-route-bubble").length, 1);
    const restore = find(bubble, "Reopen cooling route in Google Maps");
    assert.equal(restore.props.style({ pressed: false })[0].width, 54);
    assert.equal(find(bubble, "Dismiss cooling route").props.style({ pressed: false })[0].width, 44);
    restore.props.onPress(); find(bubble, "Dismiss cooling route").props.onPress();
    assert.equal(opens, 1); assert.equal(closes, 1);
    assert.ok(nodes(bubble.tree).some(node => node.props?.accessibilityRole === "alert"));
    assert.equal(mount(component, { snapshot: null, currentScreen: "Home" }).tree, null);
  });
  test(`${platform}: route screen launches the shared saved session without fetching again`, () => {
    let saved;
    const screen = load("screens/CoolingNavigationScreen.js", {
      "react-native": platformNative,
      "../components/MiniMapProvider": { useMiniMap: () => ({ openGoogleMaps: value => { saved = value; } }) },
      "react-native-maps": { __esModule: true, default: "MapView", Marker: "Marker", Polyline: "Polyline" },
    }).default;
    const owner = mount(screen, { route: { params }, navigation: {} });
    find(owner, "Open route in Google Maps").props.onPress();
    assert.deepEqual(saved, params);
    assert.equal(nodes(owner.tree).filter(node => node.type === "Polyline").length, 2);
    const invalid = mount(screen, { route: { params: {} }, navigation: {} });
    assert.equal(find(invalid, "Open route in Google Maps").props.disabled, true);
    saved = null;
    find(invalid, "Open route in Google Maps").props.onPress();
    assert.equal(saved, null);
  });
  test(`${platform}: native session survives return and screen navigation; dismiss never changes pages`, async () => {
    const launches = [];
    const app = mountApp({
      "./utils/miniMapRoute": core,
      "./utils/googleMapsNavigation": { createGoogleMapsLauncher: (save, error) => launcher.createGoogleMapsLauncher(save, error, { openURL: async url => launches.push(url) }) },
    });
    const nav = () => nodes(app.tree).find(node => node.type === "NavigationContainer");
    const overlay = () => nodes(app.tree).find(node => node.type === "./components/MiniMapOverlay");
    const provider = () => nodes(app.tree).find(node => node.type === "./components/MiniMapProvider");
    let screen = "CoolingNavigation";
    nav().props.ref.current = { getCurrentRoute: () => ({ name: screen }) };
    nav().props.onReady();
    await provider().props.onOpenGoogleMaps(params); app.render();
    assert.equal(overlay().props.snapshot.mode, "googleMaps");
    // Backgrounding does not unmount App; returning keeps its saved snapshot.
    app.render();
    for (const page of ["NearbyCooling", "Home", "HeatSmartLearning"]) {
      screen = page; nav().props.onStateChange(); app.render();
      assert.ok(core.shouldShowMiniMap(overlay().props.snapshot, page));
      assert.deepEqual(overlay().props.snapshot.routeCoordinates, params.routeCoordinates);
    }
    overlay().props.onRestore(); await Promise.resolve(); app.render();
    assert.equal(launches.length, 2); assert.equal(launches[0], launches[1]);
    overlay().props.onClose(); app.render();
    assert.equal(overlay().props.snapshot, null);
    assert.equal(overlay().props.currentScreen, "HeatSmartLearning");
  });
  test(`${platform}: Nearby Cooling hands the selected shade or water route to native navigation`, async () => {
    for (const type of ["shade", "water"]) {
      const effects = [], navigations = [];
      const selected = { latitude: "-37.82", longitude: "144.97", canopy_id: 7, asset_id: 8, facility_type: "Drinking fountain", distance_m: 16 };
      const screen = load("screens/NearbyCoolingScreen.js", {
        "react": { ...React, useEffect: (callback, dependencies) => { if (dependencies?.[0]) effects.push(callback); } },
        "react-native": platformNative,
        "react-native-maps": { __esModule: true, default: "MapView", Marker: "Marker", Polyline: "Polyline" },
        "../services/nearbyCoolingService": {
          getNearbyFountains: async () => ({ fountains: [selected] }),
          getNearbyShade: async () => ({ shadeAreas: [selected] }),
          getWalkingRoute: async () => ({ encodedPolyline: "fixture", distanceMeters: 700, durationMinutes: 9 }),
        },
        "@mapbox/polyline": { decode: () => params.routeCoordinates.map(p => [p.latitude, p.longitude]) },
      }).default;
      const owner = mount(screen, { navigation: { navigate: (name, data) => navigations.push({ name, data }) } });
      const search = nodes(owner.tree).find(node => node.type === "../components/LocationSearchBar");
      search.props.onLocationSelected(params.origin); owner.render();
      effects.splice(0).forEach(callback => callback()); await Promise.resolve(); owner.render();
      if (type === "water") {
        const toggle = find(owner, "Show nearby water");
        toggle.props.onPress(); owner.render();
      }
      assert.equal(find(owner, "Get directions"), undefined);
      const marker = nodes(owner.tree).find(node => node.type === "Marker" && node.props.accessibilityLabel === (type === "shade" ? "Tree shade area, 16 metres away" : "Drinking fountain, 16 metres away"));
      await marker.props.onPress(); owner.render();
      find(owner, "Get directions").props.onPress();
      assert.equal(navigations.length, 1); assert.equal(navigations[0].name, "CoolingNavigation");
      assert.equal(navigations[0].data.coolingOption.type, type);
      assert.equal(navigations[0].data.coolingOption.latitude, -37.82);
      assert.deepEqual(navigations[0].data.routeCoordinates, params.routeCoordinates);
      assert.deepEqual(navigations[0].data.routeInfo, params.routeInfo);
      assert.deepEqual(navigations[0].data.origin, params.origin);
    }
  });
}

const dragCore = load("utils/bubbleDrag.js");
for (const platform of ["web", "ios", "android"]) {
  test(`${platform}: drag threshold, clamping, tap/close suppression and navigation persistence`, () => {
    const context = { bubblePosition: null, setBubblePosition: value => { context.bubblePosition = value; } };
    let viewport = { width: 375, height: 667 };
    const hook = load("utils/useBubbleDrag.js", {
      "./bubbleDrag": dragCore,
      "../components/MiniMapProvider": { useMiniMap: () => context },
      "react-native": { ...native, useWindowDimensions: () => viewport },
    }).default;
    const insets = platform === "web" ? {} : { top: 20, bottom: 34, left: 0, right: 8 };
    const owner = mount(() => hook(insets));
    let opens = 0, closes = 0;
    const handlers = owner.tree.panHandlers;
    assert.equal(handlers.onStartShouldSetPanResponderCapture(), false);
    assert.equal(handlers.onMoveShouldSetPanResponderCapture(null, { dx: 3, dy: 4 }), false);
    owner.tree.press(() => opens++)();
    owner.tree.press(() => closes++)();
    assert.equal(opens, 1); assert.equal(closes, 1);
    assert.equal(handlers.onMoveShouldSetPanResponderCapture(null, { dx: 9, dy: 0 }), true);
    handlers.onPanResponderGrant(null, { dx: -60, dy: -100 });
    owner.render();
    assert.equal(owner.tree.panHandlers, handlers, "responder stays stable during drag");
    const bounds = dragCore.bubbleBounds(viewport.width, viewport.height, insets);
    assert.deepEqual(owner.tree.position, { x: bounds.right - 60, y: bounds.bottom - 100 });
    handlers.onPanResponderMove(null, { dx: -9999, dy: -9999 });
    owner.render();
    assert.deepEqual(owner.tree.position, { x: bounds.left, y: bounds.top });
    handlers.onPanResponderRelease(null, { dx: 9999, dy: 9999 });
    owner.render();
    assert.deepEqual(owner.tree.position, { x: bounds.right, y: bounds.bottom });
    owner.tree.press(() => opens++)(); owner.tree.press(() => closes++)();
    assert.equal(opens, 1); assert.equal(closes, 1);
    assert.deepEqual(mount(() => hook(insets)).tree.position, owner.tree.position, "provider keeps position after screen changes/remounts");
    handlers.onStartShouldSetPanResponderCapture();
    owner.tree.press(() => opens++)(); owner.tree.press(() => closes++)();
    assert.equal(opens, 2); assert.equal(closes, 2);
    handlers.onPanResponderGrant(null, { dx: 10, dy: 0 });
    owner.tree.press(() => opens++)({ nativeEvent: { detail: 0 } });
    assert.equal(opens, 3, "keyboard activation remains available");
    viewport = { width: 200, height: 300 }; owner.render();
    const resized = dragCore.bubbleBounds(200, 300, insets);
    assert.ok(owner.tree.position.x <= resized.right && owner.tree.position.y <= resized.bottom);
    assert.ok(owner.tree.position.y + 106 <= viewport.height);
    assert.equal(handlers.onPanResponderTerminationRequest(), false);
  });
}
test("bubble fits short viewports and reserves safe areas and bottom navigation", () => {
  for (const [width, height] of [[375, 667], [667, 375], [120, 150], [54, 106]]) {
    const bounds = dragCore.bubbleBounds(width, height, { top: 20, bottom: 34, right: 8 });
    for (const point of [{ x: -100, y: -100 }, { x: 9999, y: 9999 }, null]) {
      const position = dragCore.clampBubble(point, bounds);
      assert.ok(position.x >= 0 && position.x + 54 <= width);
      assert.ok(position.y >= 0 && position.y + 106 <= height);
    }
  }
});
for (const platform of ["web", "ios", "android"]) {
  test(`${platform}: rendered overlay drags both controls and guards their real press handlers`, () => {
    const context = { bubblePosition: null, setBubblePosition: value => { context.bubblePosition = value; } };
    const hook = load("utils/useBubbleDrag.js", {
      "./bubbleDrag": dragCore,
      "../components/MiniMapProvider": { useMiniMap: () => context },
    });
    const Component = load(platform === "web" ? "components/MiniMapOverlay.web.js" : "components/MiniMapOverlay.js", {
      "../utils/miniMapRoute": core, "../utils/useBubbleDrag": hook,
      "react-native-safe-area-context": { SafeAreaProvider: "SafeAreaProvider", useSafeAreaInsets: () => ({ top: 20, bottom: 34 }) },
    }).default;
    let opens = 0, closes = 0;
    const props = { snapshot: { ...params, mode: "googleMaps" }, currentScreen: "Home", onRestore: () => opens++, onClose: () => closes++ };
    const root = mount(Component, props);
    const child = nodes(root.tree).find(node => typeof node.type === "function");
    const owner = platform === "web" ? root : mount(child.type, child.props);
    const controls = () => nodes(owner.tree).find(node => node.props?.testID === "mini-map-overlay");
    assert.equal(owner.tree.props.pointerEvents, "box-none");
    const start = controls().props.style[1];
    controls().props.onStartShouldSetPanResponderCapture();
    controls().props.onPanResponderGrant(null, { dx: -50, dy: -70 });
    owner.render();
    assert.equal(controls().props.style[1].left, start.left - 50);
    assert.equal(controls().props.style[1].top, start.top - 70);
    controls().props.onPanResponderRelease(null, { dx: -50, dy: -70 });
    find(owner, "Reopen cooling route in Google Maps").props.onPress();
    find(owner, "Dismiss cooling route").props.onPress();
    assert.equal(opens, 0); assert.equal(closes, 0);
    props.currentScreen = "EventPlanner"; owner.render();
    assert.equal(controls().props.style[1].left, start.left - 50);
    controls().props.onStartShouldSetPanResponderCapture();
    find(owner, "Reopen cooling route in Google Maps").props.onPress();
    find(owner, "Dismiss cooling route").props.onPress();
    assert.equal(opens, 1); assert.equal(closes, 1);
    if (platform === "web") assert.equal(controls().props.style[1].touchAction, "none");
  });
}

test("iOS/Expo Go opens the installed Maps app directly without creating a browser tab", async () => {
  let saved, error;
  const urls = [];
  const launcher = load("utils/googleMapsNavigation.js", { "./miniMapRoute": core, "react-native": { ...native, Platform: { OS: "ios" } } });
  const launch = launcher.createGoogleMapsLauncher(value => { saved = value; }, value => { error = value; }, {
    openURL: async url => urls.push(url),
    canOpenURL: () => assert.fail("Expo Go app-query permissions must not be required"),
  });
  assert.equal(await launch(params), true);
  assert.equal(urls.length, 1);
  assert.equal(urls[0], saved.googleMapsUrl.replace("https://", "comgooglemapsurl://"));
  assert.equal(new URL(urls[0]).searchParams.get("destination"), "-37.83,144.98");
  assert.equal(new URL(urls[0]).searchParams.get("waypoints"), "-37.82,144.97");
  assert.equal(new URL(urls[0]).searchParams.get("travelmode"), "walking");
  assert.equal(await launch(saved), true);
  assert.equal(urls[1], urls[0]);
  assert.equal(error, null);
});
test("iOS without Google Maps falls back once to the complete HTTPS route", async () => {
  const urls = [];
  let saved, error;
  const launcher = load("utils/googleMapsNavigation.js", { "./miniMapRoute": core, "react-native": { ...native, Platform: { OS: "ios" } } });
  const launch = launcher.createGoogleMapsLauncher(value => { saved = value; }, value => { error = value; }, {
    openURL: async url => { urls.push(url); if (url.startsWith("comgooglemapsurl:")) throw new Error("No app installed"); },
  });
  assert.equal(await launch(params), true);
  assert.deepEqual(urls, [saved.googleMapsUrl.replace("https://", "comgooglemapsurl://"), saved.googleMapsUrl]);
  assert.equal(error, null);
});
for (const platform of ["ios", "android"]) {
  test(`${platform}: route-screen fallback uses the same saved destination and platform launcher`, async () => {
    const calls = [];
    const launcher = load("utils/googleMapsNavigation.js", { "./miniMapRoute": core, "react-native": { ...native, Platform: { OS: platform } } });
    const Screen = load("screens/CoolingNavigationScreen.js", {
      "../components/MiniMapProvider": { useMiniMap: () => ({}) },
      "../utils/miniMapRoute": core,
      "../utils/googleMapsNavigation": { openGoogleMapsUrl: url => launcher.openGoogleMapsUrl(url, { openURL: async value => calls.push(value) }) },
      "react-native-maps": { __esModule: true, default: "MapView", Marker: "Marker", Polyline: "Polyline" },
    }).default;
    const screen = mount(Screen, { route: { params }, navigation: {} });
    await find(screen, "Open route in Google Maps").props.onPress();
    assert.equal(calls.length, 1);
    assert.ok(calls[0].startsWith(platform === "ios" ? "comgooglemapsurl://" : "https://"));
    assert.equal(new URL(calls[0]).searchParams.get("destination"), "-37.83,144.98");
    assert.equal(new URL(calls[0]).searchParams.get("waypoints"), "-37.82,144.97");
  });
}

for (const platform of ["web", "ios", "android"]) {
  test(`${platform}: Walking Route header separates title/back control from the map and respects safe areas`, () => {
    const insets = { top: 24, left: 0, right: 0, bottom: 20 };
    const Screen = load(platform === "web" ? "screens/CoolingNavigationScreen.web.js" : "screens/CoolingNavigationScreen.js", {
      "react-native": { ...native, Platform: { OS: platform }, TouchableOpacity: "TouchableOpacity" },
      "react-native-safe-area-context": { useSafeAreaInsets: () => insets },
      "../components/MiniMapProvider": { useMiniMap: () => ({ minimize() {}, openGoogleMaps() {} }) },
      "@react-google-maps/api": { useJsApiLoader: () => ({ isLoaded: true }), GoogleMap: "GoogleMap", MarkerF: "MarkerF", PolylineF: "PolylineF" },
      "react-native-maps": { __esModule: true, default: "MapView", Marker: "Marker", Polyline: "Polyline" },
    }).default;
    let backs = 0;
    const owner = mount(Screen, { route: { params }, navigation: { goBack: () => backs++ } });
    const byId = id => nodes(owner.tree).find(node => node.props?.testID === id);
    const flatten = style => Object.assign({}, ...(Array.isArray(style) ? style : [style]));
    const header = byId("walking-route-header");
    const style = flatten(header.props.style);
    assert.equal(style.backgroundColor, "#FFFFFF");
    assert.equal(style.flexDirection, "row");
    assert.equal(style.alignItems, "center");
    assert.ok(style.gap >= 8 && style.padding >= 8);
    assert.equal(flatten(find(owner, "Back").props.style).flexShrink, 0);
    const title = nodes(header).find(node => node.props?.accessibilityRole === "header");
    assert.ok(title.props.children.includes("Walking route"));
    assert.equal(flatten(title.props.style).color, "#0A3028");
    assert.equal(flatten(title.props.style).minWidth, 0);
    assert.equal(flatten(title.props.style).textShadowColor, undefined);
    assert.ok(flatten(byId("walking-route-map").props.style).top >= style.top + style.minHeight + 8);
    header.props.onLayout({ nativeEvent: { layout: { height: 104 } } }); owner.render();
    assert.ok(flatten(byId("walking-route-map").props.style).top >= style.top + 104 + 8, "wrapped/scaled title reserves its actual height");
    find(owner, "Back").props.onPress();
    assert.equal(backs, 1);
  });
}
