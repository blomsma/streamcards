const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');

async function fixture(t) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'streamcards-test-'));
    const server = createApp(root, async token => ({ uid: token })).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(async () => { await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); });
    return { root, url: `http://127.0.0.1:${server.address().port}` };
}
function media(userId, filename, contents = 'example', field = 'imageFile') {
    const body = new FormData();
    // Fields may arrive after the file: browser multipart order must not break uploads.
    body.append(field, new Blob([contents]), filename);
    body.append('userId', userId);
    return body;
}
test('replacement upload is complete and not asynchronously deleted', async t => {
    const { root, url } = await fixture(t);
    for (const contents of ['first', 'replacement']) {
        const response = await fetch(`${url}/upload-image`, { method: 'POST', headers: { Authorization: 'Bearer user' }, body: media('user', 'photo.png', contents) });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).filename, 'user.png');
        assert.equal(await fs.readFile(path.join(root, 'images/user.png'), 'utf8'), contents);
    }
});
test('invalid identifiers, executable extensions and malformed deletion are rejected', async t => {
    const { root, url } = await fixture(t);
    for (const [id, name] of [['../outside', 'photo.png'], ['user', 'page.html']]) {
        const response = await fetch(`${url}/upload-image`, { method: 'POST', headers: { Authorization: 'Bearer user' }, body: media(id, name) });
        assert.equal(response.status, 400);
    }
    assert.deepEqual(await fs.readdir(path.join(root, 'images', '.uploads')), []);
    for (const filename of [123, '../example.png', 'server.js']) {
        const response = await fetch(`${url}/delete-image`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer user' }, body: JSON.stringify({ filename }) });
        assert.equal(response.status, 400);
    }
});
test('failed oversized replacement keeps the previous image', async t => {
    const { root, url } = await fixture(t);
    await fs.writeFile(path.join(root, 'images/user.png'), 'original');
    const response = await fetch(`${url}/upload-image`, { method: 'POST', headers: { Authorization: 'Bearer user' }, body: media('user', 'image.png', new Uint8Array(10 * 1024 * 1024 + 1)) });
    assert.equal(response.status, 413);
    assert.equal(await fs.readFile(path.join(root, 'images/user.png'), 'utf8'), 'original');
    assert.deepEqual(await fs.readdir(path.join(root, 'images', '.uploads')), []);
});
test('video extension is preserved and private source is not served', async t => {
    const { url } = await fixture(t);
    const response = await fetch(`${url}/upload-video`, { method: 'POST', headers: { Authorization: 'Bearer user' }, body: media('user', 'video.webm', 'video', 'videoFile') });
    assert.equal((await response.json()).filename, 'user.webm');
    for (const file of ['server.js', 'package.json', 'node_modules/express/package.json', '.uploads/file']) {
        assert.equal((await fetch(`${url}/${file}`)).status, 404);
    }
});

test('media mutations require authentication and ownership', async t => {
    const { root, url } = await fixture(t);
    assert.equal((await fetch(`${url}/upload-image`, { method: 'POST' })).status, 401);
    const response = await fetch(`${url}/upload-image`, { method: 'POST', headers: { Authorization: 'Bearer other' }, body: media('user', 'photo.png') });
    assert.equal(response.status, 400);
    await fs.writeFile(path.join(root, 'images/user.png'), 'original');
    const deletion = await fetch(`${url}/delete-image`, { method: 'POST', headers: { Authorization: 'Bearer other', 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: 'user.png' }) });
    assert.equal(deletion.status, 403);
    assert.equal(await fs.readFile(path.join(root, 'images/user.png'), 'utf8'), 'original');
});

test('replacing a custom font produces a new URL and preserves both complete files', async t => {
    const { root, url } = await fixture(t);
    const names = [];
    for (const contents of ['font-one', 'font-two']) {
        const response = await fetch(`${url}/upload-font`, { method: 'POST', headers: { Authorization: 'Bearer user' }, body: media('user', 'custom.ttf', contents, 'fontFile') });
        assert.equal(response.status, 200);
        const { filename } = await response.json();
        names.push(filename);
        assert.equal(await fs.readFile(path.join(root, 'fonts', filename), 'utf8'), contents);
    }
    assert.notEqual(names[0], names[1]);
});


test('PNG overlay uses staging inside the destination mount', async t => {
    const { root, url } = await fixture(t);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=', 'base64');
    const response = await fetch(`${url}/upload-overlay`, { method: 'POST', headers: { Authorization: 'Bearer user' }, body: media('user', 'image.PNG', png, 'overlayFile') });
    assert.equal(response.status, 200);
    const { filename } = await response.json();
    assert.deepEqual(await fs.readFile(path.join(root, 'images', filename)), png);
    assert.deepEqual(await fs.readdir(path.join(root, 'images', '.uploads')), []);
    await fs.writeFile(path.join(root, 'images', '.uploads', 'private.png'), png);
    assert.equal((await fetch(`${url}/images/.uploads/private.png`)).status, 404);
});
