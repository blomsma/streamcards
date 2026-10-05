const customFonts = new Map();
const requests = new WeakMap();

export function loadFontFamily(value) {
    const name = value.split(',')[0].replace(/['"]/g, '').trim();
    return document.fonts.load(`16px "${name}"`);
}

export async function applyFont(element, family, filename) {
    const key = `${family}|${filename || ''}`;
    if (requests.get(element) === key) return;
    requests.set(element, key);
    element.style.fontFamily = family;
    try {
        if (!filename) { await loadFontFamily(family); return; }
        if (!customFonts.has(filename)) {
            const name = `UploadedFont${customFonts.size}`;
            const face = new FontFace(name, `url("/fonts/${encodeURIComponent(filename)}")`);
            customFonts.set(filename, face.load().then(loaded => { document.fonts.add(loaded); return name; }).catch(error => { customFonts.delete(filename); throw error; }));
        }
        const name = await customFonts.get(filename);
        if (requests.get(element) === key) element.style.fontFamily = `"${name}", ${family}`;
    } catch (error) {
        if (requests.get(element) === key) requests.delete(element);
        console.error(error);
        if (window.parent !== window) window.parent.postMessage({ type: 'STREAMCARD_FONT_ERROR', message: 'Lettertype kon niet laden. Controleer het bestand of je verbinding.' }, location.origin);
    }
}
