const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('../node_modules/@babel/core');

test('Home background and foreground stay out of document flow with the installed React Native styles', () => {
  const rnSource = fs.readFileSync(path.join(__dirname, '../node_modules/react-native/Libraries/StyleSheet/StyleSheetExports.js'), 'utf8');
  const fill = /const absoluteFill = (\{[\s\S]*?\});/.exec(rnSource);
  assert.ok(fill);
  assert.match(rnSource, /\n  absoluteFill,/);
  const StyleSheet = {
    absoluteFill: vm.runInNewContext(`(${fill[1]})`),
    create: value => value,
  };
  const home = fs.readFileSync(path.join(__dirname, '../screens/HomeScreen.js'), 'utf8');
  const styles = vm.runInNewContext(`${home.slice(home.lastIndexOf('const styles ='))}\nstyles`, { StyleSheet, Platform: { OS: 'ios' } });
  assert.equal(styles.screen.maxWidth, undefined);
  assert.equal(styles.screen.width, '100%');
  for (const name of ['foreground']) {
    assert.equal(styles[name].position, 'absolute', `${name} must not push sibling content off-screen`);
    for (const edge of ['top', 'bottom', 'left', 'right']) assert.equal(styles[name][edge], 0);
  }
  assert.ok(styles.foreground.zIndex > 0);
  const atmosphere = fs.readFileSync(path.join(__dirname, '../components/WeatherAtmosphere.js'), 'utf8');
  assert.match(atmosphere, /StyleSheet\.absoluteFill/);
});

test('glass uses native material when available, blur as fallback, and respects reduced transparency', () => {
  const source = fs.readFileSync(path.join(__dirname, '../components/GlassSurface.js'), 'utf8');
  const code = babel.transformSync(source, {
    babelrc: false, configFile: false,
    plugins: [require('../node_modules/@babel/plugin-transform-react-jsx'), require('../node_modules/@babel/plugin-transform-modules-commonjs')],
  }).code;
  for (const [available, reduced, expected] of [[true, false, 'Glass'], [false, false, 'Blur'], [true, true, 'View']]) {
    const exports = {};
    const imports = {
      react: { createElement: (type, props) => ({ type, props }), useState: () => [reduced, () => {}], useEffect() {} },
      'react-native': { Platform: { OS: 'ios' }, StyleSheet: { create: value => value }, View: 'View' },
      'expo-glass-effect': { GlassView: 'Glass', isLiquidGlassAvailable: () => available, isGlassEffectAPIAvailable: () => available },
      'expo-blur': { BlurView: 'Blur' },
      '../theme/useAppTheme': { useAppTheme: () => ({ dark: false, styles: value => value }) },
    };
    vm.runInNewContext(code, { exports, require: name => imports[name] });
    const rendered = exports.default({ interactive: true, children: 'tabs' });
    assert.equal(rendered.type, expected);
    if (expected === 'Glass') assert.equal(rendered.props.isInteractive, true);
    if (expected === 'Blur') assert.equal(rendered.props.intensity, 75);
    if (reduced) {
      const overridden = exports.default({ style: { backgroundColor: 'rgba(255,255,255,0.1)' } });
      assert.equal(overridden.props.style.at(-1).backgroundColor, '#F7FBF9');
    }
  }
});
