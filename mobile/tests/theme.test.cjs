const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('../node_modules/@babel/core');
const parser = require('../node_modules/@babel/parser');
const traverse = require('../node_modules/@babel/traverse').default;
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const exportsFor = (file, imports = {}) => {
  const exports = {};
  const code = babel.transformSync(read(file), { babelrc: false, configFile: false, plugins: [require('../node_modules/@babel/plugin-transform-modules-commonjs')] }).code;
  vm.runInNewContext(code, { exports, require: name => imports[name] });
  return exports;
};
const palette = exportsFor('theme/palette.js');

test('dark material mapping changes only colors and retains solid buttons, white labels and overlays', () => {
  const base = { panel: { backgroundColor: '#FFFFFF', color: '#173C31', padding: 19, borderRadius: 23 }, action: { backgroundColor: '#39775F', color: '#FFFFFF' }, overlay: { backgroundColor: 'rgba(0,0,0,0.45)' } };
  const dark = palette.darkStyles(base);
  assert.notEqual(dark.panel.backgroundColor, base.panel.backgroundColor);
  assert.notEqual(dark.panel.color, base.panel.color);
  assert.equal(dark.panel.padding, 19);
  assert.equal(dark.panel.borderRadius, 23);
  assert.equal(dark.action.backgroundColor, base.action.backgroundColor);
  assert.equal(dark.action.color, '#FFFFFF');
  assert.equal(dark.overlay.backgroundColor, base.overlay.backgroundColor);
  assert.equal(base.panel.backgroundColor, '#FFFFFF');
});

test('night weather reaches every route and Auto restores system appearance', () => {
  let scheme = 'light';
  const context = { weatherNight: false, setWeatherNight: value => { context.weatherNight = value; }, previewDark: null, setPreviewDark: value => { context.previewDark = value; } };
  const { useAppTheme } = exportsFor('theme/useAppTheme.js', { react: { createContext: () => ({}), useContext: () => context, useMemo: fn => fn() }, 'react-native': { useColorScheme: () => scheme }, './palette': palette });
  const base = { text: { color: '#173C31' } };
  assert.equal(useAppTheme().styles(base), base);
  assert.equal(useAppTheme(true).dark, true);
  assert.equal(useAppTheme().dark, false);
  useAppTheme().setWeatherNight(true);
  assert.equal(useAppTheme().dark, true);
  useAppTheme().setWeatherNight(false);
  assert.equal(useAppTheme().dark, false);
  scheme = 'dark';
  assert.equal(useAppTheme().dark, true);
  useAppTheme().setWeatherNight(true);
  // Daytime previews override both real nighttime and a dark system theme.
  useAppTheme().setPreviewDark(false);
  assert.equal(useAppTheme().dark, false);
  useAppTheme().setPreviewDark(true);
  assert.equal(useAppTheme().dark, true);
  useAppTheme().setPreviewDark(null);
  assert.equal(useAppTheme().dark, true);
  scheme = 'light';
  assert.equal(useAppTheme().dark, true);
  useAppTheme().setWeatherNight(false);
  assert.equal(useAppTheme().dark, false);
  assert.equal(useAppTheme(false).dark, false);
  assert.equal(JSON.parse(read('app.json')).expo.userInterfaceStyle, 'automatic');
});

test('every route opts into theme and no JSX style/theme reference is unbound', () => {
  for (const folder of ['screens', 'components']) for (const file of fs.readdirSync(path.join(__dirname, '..', folder)).filter(f => f.endsWith('.js'))) {
    const source = read(`${folder}/${file}`);
    if (folder === 'screens') assert.match(source, /useAppTheme|useThemedStyles/, file);
    traverse(parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }), {
      ReferencedIdentifier(p) {
        if (['styles', 'theme'].includes(p.node.name)) assert.ok(p.scope.hasBinding(p.node.name), `${file}:${p.node.loc.start.line}`);
      },
    });
  }
});

test('both feedback roots and success state apply safe areas; content stays scrollable', () => {
  for (const file of ['FeedbackFormScreen.js', 'FeedbackFormListScreen.js']) {
    const source = read(`screens/${file}`);
    assert.match(source, /SafeAreaView.*react-native-safe-area-context/);
    assert.doesNotMatch(source, /<View style=\{styles.safeArea\}>/);
    assert.match(source, /<SafeAreaView style=\{styles.safeArea\}>/);
    assert.match(source, /<ScrollView/);
  }
  assert.match(read('screens/FeedbackFormScreen.js'), /<SafeAreaView[\s\S]*Feedback completed[\s\S]*<\/SafeAreaView>/);
});
