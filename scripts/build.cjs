const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
const pkg = require('../package.json');
for (const file of ['server.js', 'local-db.cjs', 'script.js', ...fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).map(f => `js/${f}`)]) {
    execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
}
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'vendor', 'fonts'), { recursive: true });
for (const file of ['index.html', 'streamcard.html', 'styles.css', 'script.js', 'js', 'lang']) {
    fs.cpSync(path.join(root, file), path.join(out, file), { recursive: true });
}
execFileSync(process.execPath, [require.resolve('tailwindcss/lib/cli.js'), '-c', 'tailwind.config.cjs', '-i', 'scripts/tailwind.css', '-o', 'dist/vendor/tailwind.css', '--minify'], { cwd: root, stdio: 'inherit' });
fs.copyFileSync(require.resolve('lottie-web/build/player/lottie.min.js'), path.join(out, 'vendor', 'lottie.min.js'));
let css = '';
for (const [family, name] of Object.entries(require('../font-families.json'))) {
    const dir = path.dirname(require.resolve(`${name}/package.json`));
    // Packages include licenses and per-weight Latin fonts; no network needed at runtime.
    for (const weight of [400, 700, 900]) {
        const source = path.join(dir, `${weight}.css`);
        if (!fs.existsSync(source)) continue;
        const blocks = fs.readFileSync(source, 'utf8').match(/@font-face\s*\{[^}]*\}/g) || [];
        for (let block of blocks.filter(b => b.includes('-latin-') && !b.includes('-latin-ext-'))) {
            block = block.replace(/url\(\.\/files\/([^)]*)\)/g, (_match, filename) => {
                fs.copyFileSync(path.join(dir, 'files', filename), path.join(out, 'vendor', 'fonts', filename));
                return `url('./fonts/${filename}')`;
            });
            css += block + '\n';
        }
    }
    const license = ['LICENSE', 'LICENSE.txt', 'OFL.txt'].find(f => fs.existsSync(path.join(dir, f)));
    if (license) fs.copyFileSync(path.join(dir, license), path.join(out, 'vendor', 'fonts', `${name.split('/')[1]}-LICENSE.txt`));
    if (!css.includes(`font-family: '${family}'`) && !css.includes(`font-family: "${family}"`)) throw new Error(`Font ontbreekt: ${family}`);
}
fs.writeFileSync(path.join(out, 'vendor', 'fonts.css'), css);
const date = new Date().toISOString();
const index = fs.readFileSync(path.join(out, 'index.html'), 'utf8')
    .replace(/(<span id="versionInfo">).*?(<\/span>)/, `$1Versie ${pkg.version}$2`)
    .replace(/(<span id="buildDateInfo">).*?(<\/span>)/, `$1Build ${date.slice(0, 10)}$2`);
fs.writeFileSync(path.join(out, 'index.html'), index);
fs.writeFileSync(path.join(out, 'build.json'), JSON.stringify({ version: pkg.version, builtAt: date }, null, 2));
console.log(`Streamcards ${pkg.version} gebouwd met lokale styling, animaties en lettertypen.`);
