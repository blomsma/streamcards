const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');

test('local timer persists across server restart and is shared over events', async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'streamcards-local-'));
    let server;
    let reader;
    async function start() {
        server = createApp(root).listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        return `http://127.0.0.1:${server.address().port}`;
    }
    async function stop() { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
    t.after(async () => { if (reader) await reader.cancel(); await stop(); await fs.rm(root, { recursive: true, force: true }); });
    let url = await start();
    const state = { title: 'Event', isRunning: true, targetTimestamp: Date.now() + 60000, overlayImages: [] };
    assert.equal((await fetch(`${url}/api/timer`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) })).status, 401);
    const response = await fetch(`${url}/api/events`);
    reader = response.body.getReader();
    assert.match(new TextDecoder().decode((await reader.read()).value), /"state":null/);
    const saved = await fetch(`${url}/api/timer`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer local-event' }, body: JSON.stringify(state) });
    assert.equal(saved.status, 200);
    const event = new TextDecoder().decode((await reader.read()).value);
    assert.match(event, /"title":"Event"/);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, 'timer.json'), 'utf8')), state);
    await reader.cancel(); reader = null;
    await stop(); url = await start();
    assert.deepEqual(await (await fetch(`${url}/api/timer`)).json(), state);
    for (const body of ['[]', 'null', '"invalid"']) {
        assert.equal((await fetch(`${url}/api/timer`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer local-event' }, body })).status, 400);
    }
    assert.deepEqual(await (await fetch(`${url}/api/timer`)).json(), state);
    assert.equal((await fetch(`${url}/timer.json`)).status, 404);
});

test('a damaged timer database stops startup instead of clearing event data', async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'streamcards-corrupt-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    await fs.writeFile(path.join(root, 'timer.json'), '{damaged');
    assert.throws(() => createApp(root), /Kan .*timer.json niet lezen/);
});
