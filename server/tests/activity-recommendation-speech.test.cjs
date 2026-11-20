const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('../../mobile/node_modules/@babel/core');

const componentPath = path.resolve(__dirname, '../../mobile/components/ActivityRecommendationContent.js');

function setup(voices, platform = 'web') {
  let cursor = 0;
  const hooks = [];
  const effects = [];
  const spoken = [];
  const audioModes = [];
  let stops = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useCallback: callback => callback,
    useEffect(callback) { effects.push(callback()); },
    useRef(initial) {
      const index = cursor++;
      return hooks[index] ??= { current: initial };
    },
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
    },
  };
  const speech = {
    VoiceQuality: { Default: 'Default', Enhanced: 'Enhanced' },
    getAvailableVoicesAsync: async () => voices,
    speak: (value, options) => spoken.push({ value, options }),
    stop: () => { stops += 1; },
  };
  const source = `${fs.readFileSync(componentPath, 'utf8')}\nexport { buildRecommendationSpeechText, pickRecommendationVoice };`;
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
    console,
    require: name => ({
      react,
      '../theme/useAppTheme': { useThemedStyles: styles => ({ styles, theme: { dark: false, color: value => value } }) },
      'react-native': new Proxy({ StyleSheet: { create: value => value }, Platform: { OS: platform } }, { get: (object, key) => object[key] ?? key }),
      'expo-audio': { setAudioModeAsync: async mode => { audioModes.push(mode); } },
      '@expo/vector-icons': { Ionicons: 'Ionicons' },
      '@react-navigation/native': { useFocusEffect() {} },
      'expo-speech': speech,
    }[name] ?? (() => { throw new Error(`Unexpected import: ${name}`); })()),
  });
  const props = {
    enableSpeech: true,
    recommendation: {
      recommendation: {
        practicalActions: ['  Use sunscreen.  ', 'Bring   water', 'Take breaks!'],
      },
    },
  };
  const render = () => {
    cursor = 0;
    return exports.default(props);
  };
  return { exports, render, spoken, audioModes, stops: () => stops, effects };
}

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...(tree.children || []).flatMap(nodes)];
}

test('iOS speech configures playback through silent mode before speaking', async () => {
  const view = setup([], 'ios');
  const tree = view.render();
  const playing = nodes(tree).find(node => node.props?.accessibilityLabel === 'Read recommendations aloud').props.onPress();
  assert.equal(view.spoken.length, 0);
  await playing;
  assert.equal(view.audioModes[0].playsInSilentMode, true);
  assert.equal(view.spoken[0].options.useApplicationAudioSession, true);
});

test('speech text punctuation and preferred voice order are deterministic', () => {
  const view = setup([]);
  assert.equal(
    view.exports.buildRecommendationSpeechText([' Already done. ', 'Needs punctuation', 'Question?', '', 3]),
    'Already done. Needs punctuation. Question?',
  );

  const voices = [
    { identifier: 'us', language: 'en-US', quality: 'Enhanced' },
    { identifier: 'au-default', language: 'en_AU', quality: 'Default' },
    { identifier: 'au-enhanced', language: 'en-AU', quality: 'Enhanced' },
  ];
  assert.equal(view.exports.pickRecommendationVoice(voices).identifier, 'au-enhanced');
  assert.equal(view.exports.pickRecommendationVoice(voices.slice(0, 2)).identifier, 'au-default');
  assert.equal(view.exports.pickRecommendationVoice(voices.slice(0, 1)).identifier, 'us');
  assert.equal(view.exports.pickRecommendationVoice([]), undefined);
});

test('speech uses en-AU enhanced voice and toggles to stop', async () => {
  const view = setup([
    { identifier: 'us-enhanced', language: 'en-US', quality: 'Enhanced' },
    { identifier: 'au-enhanced', language: 'en-AU', quality: 'Enhanced' },
  ]);
  let tree = view.render();
  await new Promise(resolve => setImmediate(resolve));

  nodes(tree).find(node => node.props?.accessibilityLabel === 'Read recommendations aloud').props.onPress();
  assert.equal(view.spoken.length, 1);
  assert.equal(view.spoken[0].value, 'Use sunscreen. Bring water. Take breaks!');
  assert.equal(view.spoken[0].options.language, 'en-AU');
  assert.equal(view.spoken[0].options.rate, 0.92);
  assert.equal(view.spoken[0].options.pitch, 1);
  assert.equal(view.spoken[0].options.voice, 'au-enhanced');

  tree = view.render();
  const stopsBeforePress = view.stops();
  nodes(tree).find(node => node.props?.accessibilityLabel === 'Stop reading').props.onPress();
  assert.equal(view.stops(), stopsBeforePress + 1);

  const stopsBeforeCleanup = view.stops();
  view.effects.filter(cleanup => typeof cleanup === 'function').at(-1)();
  assert.equal(view.stops(), stopsBeforeCleanup + 1);
});
