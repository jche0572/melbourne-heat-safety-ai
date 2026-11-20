const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('../../mobile/node_modules/@babel/core');

const screenPath = path.resolve(__dirname, '../../mobile/screens/EventPlannerScreen.js');

function setup(saveError, locationService = {}, platform = 'web') {
  let cursor = 0;
  const hooks = [];
  const react = {
    createElement: (type, props, ...children) => (
      typeof type === 'function'
        ? type({ ...(props || {}), children })
        : { type, props: props || {}, children }
    ),
    useEffect() {},
    useMemo: callback => callback(),
    useRef(initial) {
      const index = cursor++;
      return hooks[index] ??= { current: initial };
    },
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
    },
  };
  const native = new Proxy(
    { StyleSheet: { create: value => value, absoluteFill: {} }, Platform: { OS: platform } },
    { get: (object, key) => object[key] ?? key },
  );
  const source = fs.readFileSync(screenPath, 'utf8');
  const code = babel.transformSync(source, {
    babelrc: false,
    configFile: false,
    plugins: [
      require('../../mobile/node_modules/@babel/plugin-transform-react-jsx'),
      require('../../mobile/node_modules/@babel/plugin-transform-modules-commonjs'),
    ],
  }).code;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    Date,
    Intl,
    console,
    setTimeout,
    clearTimeout,
    require: name => ({
      react,
      '../theme/useAppTheme': { useThemedStyles: styles => ({ styles, theme: { dark: false, color: value => value } }) },
      'react-native': native,
      '@react-native-picker/picker': { Picker: Object.assign(props => ({ type: 'Picker', props, children: props.children }), { Item: 'Picker.Item' }) },
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      '@expo/vector-icons': { Ionicons: 'Ionicons' },
      '../utils/activityDateTime': { toMelbourneIso: (date, time) => `${date}T${time}:00+11:00` },
      '../services/locationSearchService': { searchLocations: async () => [], getPlaceCoordinates: async () => null, ...locationService },
      '../services/eventStorageService': {
        saveEvent: data => {
          if (saveError) throw new Error(saveError);
          return { ...data, id: 'saved' };
        },
        updateEvent: (_id, data) => ({ ...data, id: 'saved' }),
      },
    }[name] ?? (() => { throw new Error(`Unexpected import: ${name}`); })()),
  });

  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const params = {
    title: 'Walk',
    location: 'Melbourne',
    startDate: date,
    endDate: date,
    startTime: '2:00 PM',
    endTime: '3:00 PM',
  };
  const navigation = { goBack() {}, popTo() {} };
  const render = () => {
    cursor = 0;
    return exports.default({ route: { params }, navigation });
  };

  return { render };
}

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...(tree.children || []).flatMap(nodes)];
}

function text(tree) {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  if (!tree || typeof tree !== 'object') return '';
  return (Array.isArray(tree) ? tree : tree.children || []).map(text).join(' ');
}

function pressable(tree, label) {
  const found = nodes(tree).find(node => node.props?.onPress && text(node).trim() === label);
  assert.ok(found, `Pressable ${label} exists`);
  return found;
}

test('native time wheels commit a swiped value through the existing validation', () => {
  const view = setup(undefined, {}, 'ios');
  pressable(view.render(), '3:00 PM').props.onPress();
  let tree = view.render();
  const wheels = nodes(tree).filter(node => node.type === 'Picker');
  assert.equal(wheels.length, 3);
  wheels[0].props.onValueChange(4);
  tree = view.render();
  pressable(tree, 'Done').props.onPress();
  assert.match(text(view.render()), /4:00 PM/);
});

test('time wheels show all values cyclically and reject end <= start on Done', () => {
  const view = setup();
  pressable(view.render(), '3:00 PM').props.onPress();

  let tree = view.render();
  const openModal = nodes(tree).find(node => node.type === 'Modal' && node.props.visible);
  assert.ok(openModal);
  pressable(openModal, '2').props.onPress();
  tree = view.render();
  const wrappedModal = nodes(tree).find(node => node.type === 'Modal' && node.props.visible);
  assert.deepEqual(
    nodes(wrappedModal)
      .filter(node => node.type === 'TouchableOpacity' && /^\d+$/.test(text(node).trim()))
      .slice(0, 5)
      .map(node => text(node).trim()),
    ['12', '1', '2', '3', '4'],
  );

  pressable(tree, 'Done').props.onPress();
  tree = view.render();
  assert.match(text(tree), /End time must be later than start time/);
  assert.ok(nodes(tree).some(node => node.type === 'Modal' && node.props.visible));

  pressable(tree, '4').props.onPress();
  tree = view.render();
  pressable(tree, 'Done').props.onPress();
  tree = view.render();
  assert.doesNotMatch(text(tree), /End time must be later than start time/);
  assert.ok(nodes(tree).every(node => node.type !== 'Modal' || !node.props.visible));
  assert.match(text(tree), /4:00 PM/);
});

test('storage errors appear in a modal without clearing the form', () => {
  const message = 'This time overlaps with an existing event. Please choose another time.';
  const view = setup(message);

  pressable(view.render(), 'Save Event').props.onPress();
  const tree = view.render();
  const modal = nodes(tree).find(node => node.type === 'Modal' && node.props.visible);

  assert.ok(modal);
  assert.match(text(modal), /Time conflict/);
  assert.match(text(modal), /This time overlaps with an existing event/);
  assert.ok(pressable(modal, 'Choose another time'));
  const inputValues = nodes(tree)
    .filter(node => node.type === 'TextInput')
    .map(node => node.props.value);
  assert.ok(inputValues.includes('Walk'));
  assert.ok(inputValues.includes('Melbourne'));
});

test('submitting a location with no cached suggestions selects a fresh search result', async () => {
  const view = setup(undefined, {
    searchLocations: async () => [{ label: 'Melbourne Central', latitude: -37.81, longitude: 144.96 }],
    getPlaceCoordinates: async () => ({ latitude: -37.81, longitude: 144.96 }),
  });
  const input = nodes(view.render()).find(node => node.type === 'TextInput' && node.props.onSubmitEditing);
  assert.ok(input);
  await input.props.onSubmitEditing();
  const tree = view.render();
  assert.doesNotMatch(text(tree), /Unable to select|Could not|No matching/);
  assert.ok(nodes(tree).some(node => node.type === 'TextInput' && node.props.value === 'Melbourne Central'));
});
