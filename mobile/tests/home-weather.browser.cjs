// Run separately from node:test: NODE_PATH=<Playwright modules> node tests/home-weather.browser.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'soladapt-weather-'));
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const report = [];
  try {
    for (const width of [390, 375]) {
      for (const scenario of ['sun', 'cloud', 'rain', 'night', ...(width === 390 ? ['sun-dark'] : [])]) {
        const scene = scenario.split('-')[0];
        const colorScheme = scenario === 'sun-dark' || scene === 'night' ? 'dark' : 'light';
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 812 }, colorScheme, reducedMotion: 'reduce', permissions: ['geolocation'], geolocation: { latitude: -37.8, longitude: 144.97 } });
        const page = await context.newPage();
        const errors = [], weatherURLs = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => {
          navigator.geolocation.getCurrentPosition = success => setTimeout(() => success({
            coords: { latitude: -37.8, longitude: 144.97, accuracy: 5, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
            timestamp: Date.now(),
          }), 0);
          window.__weatherDraws = [];
          const original = WebGLRenderingContext.prototype.drawArrays;
          WebGLRenderingContext.prototype.drawArrays = function (...args) {
            original.apply(this, args);
            const pixel = new Uint8Array(4), values = [];
            for (let y = 1; y <= 4; y++) {
              this.readPixels(Math.floor(this.drawingBufferWidth / 2), Math.floor(this.drawingBufferHeight * y / 5), 1, 1, this.RGBA, this.UNSIGNED_BYTE, pixel);
              values.push(...pixel);
            }
            window.__weatherDraws.push(values.join(','));
          };
        });
        await page.route('**/v1/forecast?**', route => {
          weatherURLs.push(route.request().url());
          const now = Math.floor(Date.now() / 1000);
          return route.fulfill({ json: { current: { time: now, weather_code: { sun: 0, cloud: 3, rain: 61, night: 0 }[scene], is_day: scene === 'night' ? 0 : 1 } } });
        });
        await page.route('**/api/**', route => {
          const url = route.request().url();
          const data = url.includes('/microclimate/nearby') ? { observation: { air_temperature: 21.8, sensor_location: 'Melbourne CBD' } }
            : url.includes('/uv/latest') ? { observation: { uv_index: 0.2 } }
            : url.includes('/service-area/check') ? { insideCityOfMelbourne: true }
            : url.includes('/reverse-geocode') ? { suburb: 'Melbourne CBD' } : {};
          return route.fulfill({ json: data });
        });
        await page.goto('http://localhost:8081/', { waitUntil: 'networkidle' });
        await page.getByText('Current conditions', { exact: true }).waitFor();
        await page.getByText('21.8°C', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Weather preview', exact: true }).click();
        await page.getByText(`Weather: ${scene} · Local forecast`, { exact: true }).waitFor();
        assert.ok(weatherURLs.some(url => url.includes('latitude=-37.8&longitude=144.97')));
        await page.getByRole('button', { name: 'Weather preview', exact: true }).click();
        await page.locator('[role="img"][aria-label="SolAdapt"]').scrollIntoViewIfNeeded();
        const logoBounds = await page.locator('[role="img"][aria-label="SolAdapt"]').boundingBox();
        assert.ok(logoBounds && logoBounds.width > 200 && logoBounds.x >= 0 && logoBounds.x + logoBounds.width <= width, 'Brand lockup stays readable within the mobile viewport');
        await page.waitForFunction(() => [...document.images].some(img => img.src.includes('soladapt-brand-lockup') && img.complete && img.naturalWidth > 0));
        await page.waitForTimeout(1500);
        const metrics = await page.evaluate(() => {
          const bounds = label => {
            const node = [...document.querySelectorAll('[aria-label]')].find(node => node.getAttribute('aria-label').startsWith(label + ':'));
            const rect = node.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, children: [...node.children].map(child => { const r = child.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }) };
          };
          return { heat: bounds('Heat'), uv: bounds('UV'), pixels: window.__weatherDraws.at(-1), draws: window.__weatherDraws.length, text: document.body.innerText };
        });
        assert.ok(Math.abs(metrics.heat.y - metrics.uv.y) < 1);
        assert.ok(Math.abs(metrics.heat.width - metrics.uv.width) < 1);
        assert.ok(Math.abs(metrics.heat.children[0].y - metrics.uv.children[0].y) < 1);
        assert.ok(metrics.pixels?.split(',').some((v, i) => i % 4 !== 3 && +v > 0), 'WebGL must render nonblank pixels');
        await page.screenshot({ path: path.join(directory, `${scenario}-${width}.png`) });
        await page.waitForTimeout(1200);
        const after = await page.evaluate(() => ({ pixels: window.__weatherDraws.at(-1), draws: window.__weatherDraws.length }));
        assert.equal(after.pixels, metrics.pixels, 'Reduced motion must keep pixels steady');
        const cooling = page.getByRole('button', { name: 'Find shade & water', exact: true });
        await cooling.scrollIntoViewIfNeeded();
        await page.mouse.move(width / 2, 650);
        await page.mouse.wheel(0, 160);
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(directory, `${scenario}-${width}-scroll.png`) });
        assert.equal(errors.length, 0, errors.join('\n'));
        if (width === 390 && scenario === 'sun') {
          await page.getByRole('button', { name: 'Weather preview', exact: true }).click();
          const previewPixels = [];
          for (const label of ['Sunny', 'Cloudy', 'Rain', 'Night']) {
            await page.getByRole('button', { name: `Preview ${label}`, exact: true }).click();
            await page.waitForTimeout(300);
            previewPixels.push(await page.evaluate(() => window.__weatherDraws.at(-1)));
            await page.getByText('21.8°C', { exact: true }).waitFor();
            await page.getByText('0.2', { exact: true }).waitFor();
          }
          assert.equal(new Set(previewPixels).size, 4, 'Preview states must render four distinct backgrounds');
          await page.mouse.move(190, 650);
          await page.mouse.wheel(0, 320);
          await page.waitForTimeout(250);
          await page.screenshot({ path: path.join(directory, 'preview-controls.png') });
          assert.equal(await page.getByRole('button', { name: 'Data sources', exact: true }).count(), 0);
          assert.equal(await page.getByRole('link', { name: 'Weather data by Open-Meteo', exact: true }).count(), 0);
          for (const [name, heading] of [['Plan your activities', 'Plan your day'], ['Find shade & water', 'Nearby cooling options'], ['Learn to stay safe', 'Heat Smart Learning']]) {
            await page.getByRole('button', { name, exact: true }).click();
            await page.getByText(heading, { exact: true }).waitFor();
            const color = await page.getByText(heading, { exact: true }).evaluate(node => getComputedStyle(node).color);
            assert.ok(color.match(/\d+/g).slice(0, 3).every(channel => Number(channel) > 150), `${heading} must retain night text: ${color}`);
            await page.screenshot({ path: path.join(directory, `night-${heading.replaceAll(' ', '-')}.png`) });
            await page.getByRole('tab', { name: 'Home tab', exact: true }).click();
            await page.getByText('Current conditions', { exact: true }).waitFor();
          }
          await page.getByRole('button', { name: 'Preview Auto', exact: true }).click();
          await page.waitForFunction(() => {
            const heading = [...document.querySelectorAll('[role="heading"]')].find(node => node.textContent === 'Current conditions');
            return heading && Number(getComputedStyle(heading).color.match(/\d+/g)[0]) < 100;
          });
          const restored = await page.getByText('Current conditions', { exact: true }).evaluate(node => getComputedStyle(node).color);
          assert.ok(Number(restored.match(/\d+/g)[0]) < 100, 'Auto restores daytime light theme');
          await page.getByRole('button', { name: 'Weather preview', exact: true }).click();
        }
        if (width === 390 && scenario === 'night') {
          const isDark = () => page.getByText('Current conditions', { exact: true }).evaluate(node => Number(getComputedStyle(node).color.match(/\d+/g)[0]) > 150);
          await page.getByRole('button', { name: 'Weather preview', exact: true }).click();
          for (const label of ['Sunny', 'Cloudy', 'Rain', 'Night']) {
            await page.getByRole('button', { name: `Preview ${label}`, exact: true }).click();
            await page.waitForTimeout(300);
            assert.equal(await isDark(), label === 'Night', `${label} preview must override nighttime and system dark mode`);
            await page.getByText('21.8°C', { exact: true }).waitFor();
            await page.locator('[role="img"][aria-label="SolAdapt"]').scrollIntoViewIfNeeded();
            await page.screenshot({ path: path.join(directory, `nighttime-preview-${label}.png`) });
          }
          await page.getByRole('button', { name: 'Preview Sunny', exact: true }).click();
          await page.getByRole('button', { name: 'Plan your activities', exact: true }).click();
          const planner = page.getByText('Plan your day', { exact: true });
          await planner.waitFor();
          assert.ok(Number((await planner.evaluate(node => getComputedStyle(node).color)).match(/\d+/g)[0]) < 100, 'Sunny preview theme persists across routes');
          await page.getByRole('tab', { name: 'Home tab', exact: true }).click();
          await page.getByRole('button', { name: 'Preview Auto', exact: true }).click();
          await page.waitForTimeout(300);
          assert.equal(await isDark(), true, 'Auto restores actual nighttime dark theme');
          await page.getByRole('button', { name: 'Preview Sunny', exact: true }).click();
          await page.getByRole('button', { name: 'Weather preview', exact: true }).click();
          await page.waitForTimeout(300);
          assert.equal(await isDark(), true, 'Closing preview restores automatic appearance');
          assert.equal(errors.length, 0, errors.join('\n'));
        }
        report.push({ scene, colorScheme, width, metrics, after, errors, weatherURLs });
        await context.close();
      }
    }
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ directory, checks: report.length }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
