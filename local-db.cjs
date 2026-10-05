const fs = require('node:fs');
const path = require('node:path');

function localDatabase(app, directory) {
    fs.mkdirSync(directory, { recursive: true });
    const filename = path.join(directory, 'timer.json');
    let state = null;
    try { state = JSON.parse(fs.readFileSync(filename, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw new Error(`Kan ${filename} niet lezen: ${error.message}`); }
    const clients = new Set();
    const snapshot = () => JSON.stringify({ state, serverTime: Date.now() });
    const send = client => client.write(`data: ${snapshot()}\n\n`);
    app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'streamcards-local', serverTime: Date.now() }));
    app.get('/api/timer', (_req, res) => res.json(state));
    app.put('/api/timer', (req, res, next) => {
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ message: 'Timergegevens moeten een object zijn.' });
        try {
            // Persist before notifying browsers; a failed write leaves the previous state intact.
            fs.writeFileSync(filename + '.tmp', JSON.stringify(req.body, null, 2), { flush: true });
            fs.renameSync(filename + '.tmp', filename);
            state = req.body;
            for (const client of clients) send(client);
            res.json({ ok: true });
        } catch (error) { next(error); }
    });
    app.get('/api/events', (req, res) => {
        res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.flushHeaders();
        clients.add(res);
        send(res);
        const heartbeat = setInterval(() => { if (!res.destroyed) send(res); }, 15000);
        req.on('close', () => { clearInterval(heartbeat); clients.delete(res); });
    });
}
module.exports = { localDatabase };
