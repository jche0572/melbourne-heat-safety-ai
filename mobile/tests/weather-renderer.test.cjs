const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../utils/weatherAtmosphereRenderer.js'), 'utf8');

test('shared renderer draws sky into texture before glass, and disposes its resources', () => {
  const calls = [];
  let id = 0;
  const gl = new Proxy({ drawingBufferWidth: 390, drawingBufferHeight: 844 }, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
      if (name === 'checkFramebufferStatus') return () => { calls.push([name]); return 'FRAMEBUFFER_COMPLETE'; };
      if (name === name.toUpperCase()) return name;
      return (...args) => { calls.push([name, ...args]); return ++id; };
    },
  });
  const context = { Float32Array };
  vm.runInNewContext(source.replace(/export /g, '') + '\nthis.create = createWeatherRenderer;', context);
  const renderer = context.create(gl);
  const beforeLayout = calls.filter(c => c[0] === 'drawArrays').length;
  assert.equal(renderer.draw({ scene: 'sun', width: 0, height: 0 }), false);
  assert.equal(calls.filter(c => c[0] === 'drawArrays').length, beforeLayout);
  renderer.draw({ scene: 'rain', width: 390, height: 844, cardRect: { x: 20, y: 180, width: 350, height: 240 } });
  assert.equal(calls.filter(c => c[0] === 'drawArrays').length, 2);
  assert.ok(calls.some(c => c[0] === 'bindFramebuffer' && c[2] === null));
  renderer.draw({ scene: 'rain', width: 390, height: 844 });
  assert.equal(calls.filter(c => c[0] === 'checkFramebufferStatus').length, 1);
  gl.drawingBufferWidth = 320;
  renderer.draw({ scene: 'rain', width: 320, height: 844 });
  assert.equal(calls.filter(c => c[0] === 'checkFramebufferStatus').length, 2);
  renderer.dispose();
  for (const method of ['deleteBuffer', 'deleteTexture', 'deleteFramebuffer', 'deleteProgram', 'deleteShader']) {
    assert.ok(calls.some(c => c[0] === method), method);
  }
});

test('refraction samples the same glass function at displaced coordinates and is restricted to rain card', () => {
  assert.match(source, /refract\(vec3\(0\.,0\.,-1\.\),normal,1\.\/1\.333\)/);
  assert.match(source, /vec3 water=glass\(source\)/);
  assert.match(source, /rain>\.5 && card\.z>0\. && edge<0\./);
  assert.equal((source.match(/c=droplet\(/g) || []).length, 5);
  assert.match(source, /clamp\(n.y,-1\.,1\.\)/, 'droplet skew must remain bounded outside the cap');
});

let chromium;
try { ({ chromium } = require('playwright')); } catch { /* Browser checks need the supplied Playwright runtime. */ }
test('actual WebGL refracts a mobile-size grid only beneath droplets', { skip: !chromium }, async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent('<canvas width="390" height="844"></canvas>');
    await page.addScriptTag({ content: source.replace(/export /g, '') });
    const result = await page.evaluate(() => {
      const gl = document.querySelector('canvas').getContext('webgl', { preserveDrawingBuffer: true });
      const renderer = createWeatherRenderer(gl);
      const options = { scene: 'rain', width: 390, height: 844, cardRect: { x: 20, y: 180, width: 350, height: 240 }, gridTest: true };
      const read = () => { const pixels = new Uint8Array(390 * 844 * 4); gl.readPixels(0, 0, 390, 844, gl.RGBA, gl.UNSIGNED_BYTE, pixels); return pixels; };
      renderer.draw({ ...options, lensEnabled: false }); const before = read();
      renderer.draw({ ...options, lensEnabled: true }); const after = read();
      let changed = 0, outside = 0;
      for (let i = 0; i < before.length; i += 4) {
        if (Math.abs(before[i] - after[i]) <= 4) continue;
        changed++;
        const x = i / 4 % 390, y = 843 - Math.floor(i / 4 / 390);
        if (x < 20 || x >= 370 || y < 180 || y >= 420) outside++;
      }
      const errors = [];
      for (const scene of ['sun', 'cloud', 'rain', 'night']) {
        renderer.draw({ ...options, scene, gridTest: false }); errors.push(gl.getError());
      }
      const moonPixel = new Uint8Array(4);
      renderer.draw({ ...options, scene: 'night', dark: true, gridTest: false });
      gl.readPixels(Math.round(390 * .88), 843 - Math.round(390 * .34), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, moonPixel);
      renderer.dispose();
      return { changed, outside, errors, moonPixel: [...moonPixel] };
    });
    assert.ok(result.changed > 0 && result.changed < 500, JSON.stringify(result));
    assert.equal(result.outside, 0);
    assert.deepEqual(result.errors, [0, 0, 0, 0]);
    assert.ok(result.moonPixel[0] > 180 && result.moonPixel[1] > 160, 'night moon must stay luminous, not receive the daytime dark overlay');
  } finally { await browser.close(); }
});
