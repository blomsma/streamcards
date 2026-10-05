const express = require('express');
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');

async function verifyToken(token) {
    // Local mode has no user accounts. This marker is not an access password.
    if (token !== 'local-event') throw new Error('Ongeldige lokale aanvraag.');
    return { uid: 'event' };
}

function createApp(root = __dirname, verify = verifyToken, dataRoot = process.env.DATA_DIR || root, webRoot = process.env.WEB_ROOT || root) {
    const app = express();
    app.disable('x-powered-by');
    app.use(express.json({ limit: '1mb' }));
    for (const dir of ['video', 'images', 'fonts']) {
        fs.mkdirSync(path.join(dataRoot, dir), { recursive: true });
    }
    app.use(async (req, res, next) => {
        if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) return next();
        const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
        if (!token) return res.status(401).json({ message: 'Ongeldige lokale aanvraag.' });
        try {
            req.user = await verify(token);
            next();
        } catch {
            res.status(401).json({ message: 'Ongeldige lokale aanvraag.' });
        }
    });
    require('./local-db.cjs').localDatabase(app, dataRoot);
    const types = {
        video: { directory: 'video', field: 'videoFile', size: 50, extensions: ['.mp4', '.webm', '.mov', '.m4v'] },
        image: { directory: 'images', field: 'imageFile', size: 10, extensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif'] },
        overlay: { directory: 'images', field: 'overlayFile', size: 10, extensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif', '.json', '.lottie'] },
        font: { directory: 'fonts', field: 'fontFile', size: 5, extensions: ['.ttf', '.otf', '.woff', '.woff2'] }
    };
    for (const [kind, config] of Object.entries(types)) {
        // Keep staging on the destination mount so publishing via rename stays atomic.
        const staging = path.join(dataRoot, config.directory, '.uploads');
        fs.mkdirSync(staging, { recursive: true });
        const upload = multer({
            dest: staging,
            limits: { fileSize: config.size * 1024 * 1024, files: 1, fields: 2, parts: 3 },
            fileFilter(req, file, cb) {
                const allowed = config.extensions.includes(path.extname(file.originalname).toLowerCase());
                cb(allowed ? null : Object.assign(new Error('Dit bestandstype wordt niet ondersteund.'), { status: 400 }), allowed);
            }
        });
        app.post(`/upload-${kind}`, upload.single(config.field), async (req, res, next) => {
            if (!req.file) return res.status(400).json({ message: 'Geen bestand ontvangen.' });
            try {
                const { userId, fontType = 'timer' } = req.body;
                if (typeof userId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(userId)) {
                    throw Object.assign(new Error('Ongeldige gebruikers-ID.'), { status: 400 });
                }
                if (kind === 'font' && !['timer', 'title', 'message'].includes(fontType)) {
                    throw Object.assign(new Error('Ongeldig lettertypedoel.'), { status: 400 });
                }
                if (userId !== req.user.uid) throw Object.assign(new Error('Geen toegang tot deze bestanden.'), { status: 400 });
                const extension = path.extname(req.file.originalname).toLowerCase();
                let prefix = userId;
                if (kind === 'overlay') prefix += `_overlay_${randomUUID()}`;
                if (kind === 'font') prefix += `_${fontType}_${randomUUID()}`;
                const filename = prefix + extension;
                // Only publish complete uploads. Failed replacements leave existing media intact.
                await fs.promises.rename(req.file.path, path.join(dataRoot, config.directory, filename));
                res.json({ message: 'Bestand geüpload.', filename });
            } catch (error) {
                await fs.promises.rm(req.file.path, { force: true }).catch(() => {});
                next(error);
            }
        });
    }
    for (const kind of ['image', 'overlay', 'video']) {
        app.post(`/delete-${kind}`, async (req, res, next) => {
            const filename = req.body?.filename;
            const config = types[kind];
            if (typeof filename !== 'string' || !/^[A-Za-z0-9_-]+\.[a-z0-9]+$/i.test(filename)
                || !config.extensions.includes(path.extname(filename).toLowerCase())
                || (kind === 'overlay' && !filename.includes('_overlay_'))) {
                return res.status(400).json({ message: 'Ongeldige bestandsnaam.' });
            }
            const ownFile = kind === 'overlay'
                ? filename.startsWith(`${req.user.uid}_overlay_`)
                : path.parse(filename).name === req.user.uid;
            if (!ownFile) return res.status(403).json({ message: 'Geen toegang tot dit bestand.' });
            try {
                await fs.promises.unlink(path.join(dataRoot, config.directory, filename));
                res.json({ message: 'Bestand verwijderd.' });
            } catch (error) {
                if (error.code === 'ENOENT') return res.status(404).json({ message: 'Bestand niet gevonden.' });
                next(error);
            }
        });
    }
    // Serve only public files; data and server source are never exposed.
    for (const directory of ['js', 'lang', 'vendor']) {
        app.use(`/${directory}`, express.static(path.join(webRoot, directory), { dotfiles: 'deny' }));
    }
    for (const directory of ['video', 'images', 'fonts']) {
        app.use(`/${directory}`, express.static(path.join(dataRoot, directory), { dotfiles: 'deny' }));
    }
    app.get('/', (_req, res) => res.sendFile(path.join(webRoot, 'index.html')));
    for (const file of ['index.html', 'streamcard.html', 'styles.css', 'script.js']) {
        app.get(`/${file}`, (_req, res) => res.sendFile(path.join(webRoot, file)));
    }
    app.use((error, req, res, next) => {
        const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : error instanceof multer.MulterError ? 400 : error.status || 500;
        if (status >= 500) console.error('Media request failed', { route: req.path, code: error.code || 'UNKNOWN' });
        const message = status === 413 ? 'Bestand is te groot.' : status >= 500 ? 'Bestand kon niet worden opgeslagen of verwijderd. Probeer opnieuw.' : error.status === 400 && !(error instanceof SyntaxError) ? error.message : 'Ongeldige aanvraag of bestand.';
        res.status(status).json({ message });
    });
    return app;
}
if (require.main === module) {
    const port = process.env.PORT || 3001;
    const data = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
    for (const dir of ['video', 'images', 'fonts']) fs.mkdirSync(path.join(data, dir), { recursive: true });
    fs.cpSync(path.join(__dirname, 'seed'), data, { recursive: true, force: false, errorOnExist: false });
    createApp(__dirname, verifyToken, data).listen(port, () => console.log(`Streamcards draait op http://localhost:${port}`));
}
module.exports = { createApp };
