const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.TEST_BASE_URL || 'http://localhost:8787';
(async () => {
    const initial = { isRunning: false, timerMode: 'duration', durationMinutes: 5, title: 'Event test', backgroundType: 'transparent', fontFamily: "'Inter', sans-serif", overlayImages: [] };
    const previous = await (await fetch(`${base}/api/timer`)).json();
    const save = state => fetch(`${base}/api/timer`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer local-event' }, body: JSON.stringify(state) });
    const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
    let uploaded = [];
    try {
        await save(initial);
        const errors = [];
        const external = [];
        const controlContext = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
        const outputContext = await browser.newContext();
        for (const context of [controlContext, outputContext]) {
            await context.route('**/*', route => {
                if (new URL(route.request().url()).origin !== new URL(base).origin) {
                    external.push(route.request().url()); return route.abort();
                }
                return route.continue();
            });
            context.on('page', page => page.on('pageerror', e => errors.push(e.message)));
        }
        const page = await controlContext.newPage();
        const output = await outputContext.newPage();
        await page.goto(base);
        await page.locator('#mainContent').waitFor({ state: 'visible' });
        await page.locator('#durationMinutes').waitFor();
        await page.waitForFunction(() => document.querySelector('#durationMinutes').value === '5');
        await output.goto(`${base}/streamcard.html?timerId=event`);
        await page.locator('#startBtn').click();
        await output.locator('#clockWrapper').waitFor({ state: 'visible' });
        await output.waitForFunction(() => document.querySelector('#timerTitle').textContent === 'Event test');
        await output.waitForFunction(() => document.fonts.check('16px "Inter"'));
        assert.equal(await output.locator('#selectionGizmo').count(), 0);
        const frame = page.frames().find(f => f.url().includes('streamcard.html'));
        assert(frame);
        await page.locator('#pauseBtn').click();
        await page.waitForFunction(async () => (await (await fetch('/api/timer')).json()).isPaused === true);
        const paused = await output.locator('#clock').textContent();
        await output.waitForTimeout(1200);
        assert.equal(await output.locator('#clock').textContent(), paused);
        await page.locator('#resumeBtn').click();
        await page.waitForFunction(async () => (await (await fetch('/api/timer')).json()).isPaused === false);
        // Real upload, drag/drop and synchronization to a separate browser session.
        await frame.evaluate(() => {
            const transfer = new DataTransfer();
            transfer.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="red"/></svg>'], 'test.svg', { type: 'image/svg+xml' }));
            document.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer, clientX: innerWidth * .25, clientY: innerHeight * .3 }));
        });
        await output.locator('[data-overlay-id]').waitFor({ state: 'visible' });
        const state = await (await fetch(`${base}/api/timer`)).json();
        uploaded = state.overlayImages.map(item => item.file);
        assert(Math.abs(state.overlayImages[0].posX - 25) < 1);
        await frame.locator('[data-overlay-id]').click();
        await frame.locator('[aria-label="Roteren"]').focus();
        await page.keyboard.press('ArrowRight');
        await output.waitForFunction(() => document.querySelector('[data-overlay-id]').style.transform.includes('rotate(5deg)'));
        await output.reload();
        await output.waitForFunction(() => document.querySelector('[data-overlay-id]')?.style.transform.includes('rotate(5deg)'));
        await frame.locator('[aria-label="Verwijderen"]').click();
        await output.locator('[data-overlay-id]').waitFor({ state: 'detached' });
        uploaded = [];
        await page.locator('#startBtn').click();
        await output.locator('#timerDisplay').waitFor({ state: 'hidden' });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.deepEqual(errors, []);
        assert.deepEqual(external, [], 'App must work with all external requests blocked');
        console.log('PASS: offline styling/fonts, real local timer start/pause/resume/stop, separate browser output, real upload/delete, preview rotation, output reload and mobile layout.');
    } finally {
        for (const filename of uploaded) await fetch(`${base}/delete-overlay`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer local-event' }, body: JSON.stringify({ filename }) });
        await save(previous || initial);
        await browser.close();
    }
})().catch(error => { console.error(error); process.exit(1); });
