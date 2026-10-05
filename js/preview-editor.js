// Instantiated only by the embedded, interactive preview, never by the OBS output.
export function createPreviewEditor({ getState, send, remove }) {
    let selection = null;
    let gesture = null;
    const bindings = new WeakMap();
    const box = document.createElement('div');
    box.id = 'selectionGizmo';
    box.hidden = true;
    for (const [action, label] of [['scale', 'Schalen'], ['rotate', 'Roteren'], ['delete', 'Verwijderen']]) {
        const handle = document.createElement('button');
        handle.type = 'button';
        handle.dataset.action = action;
        handle.setAttribute('aria-label', label);
        handle.title = label;
        handle.textContent = action === 'delete' ? '×' : action === 'rotate' ? '↻' : '↘';
        box.append(handle);
        if (action === 'delete') {
            handle.addEventListener('click', removeSelected);
            continue;
        }
        handle.addEventListener('pointerdown', event => begin(event, action));
        handle.addEventListener('keydown', event => {
            if (!selection || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault();
            const values = read();
            const direction = ['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : -1;
            commit(action === 'rotate' ? { rotation: values.rotation + direction * 5 } : { scale: Math.max(1, values.scale + direction * 2) });
        });
    }
    document.body.append(box);
    function removeSelected() {
        if (!selection) return;
        const selected = selection;
        selection = null;
        gesture = null;
        refresh();
        remove({ type: selected.type, id: selected.id });
    }
    function read() {
        const state = getState();
        if (selection.type === 'overlay') {
            const overlay = state.overlayImages?.find(item => item.id === selection.id) || {};
            return { posX: overlay.posX ?? 50, posY: overlay.posY ?? 50, scale: overlay.scale ?? 100, rotation: overlay.rotation ?? 0 };
        }
        const prefix = selection.type;
        const size = prefix === 'clock' ? 'fontSize' : `${prefix}FontSize`;
        return { posX: state[`${prefix}PosX`] ?? 50, posY: state[`${prefix}PosY`] ?? 50, scale: state[size] ?? 72, rotation: state[`${prefix}Rotation`] ?? 0 };
    }
    function commit(values) {
        if (selection.type === 'overlay') send({ overlayTransform: { id: selection.id, ...values } });
        else {
            const updates = {};
            for (const [key, value] of Object.entries(values)) {
                const prop = key === 'scale' ? (selection.type === 'clock' ? 'fontSize' : `${selection.type}FontSize`) : `${selection.type}${key[0].toUpperCase()}${key.slice(1)}`;
                updates[prop] = value;
            }
            send(updates);
        }
        refresh();
    }
    function refresh() {
        const element = selection?.element;
        if (!element?.isConnected || !element.getClientRects().length || getComputedStyle(element).opacity === '0') {
            box.hidden = true;
            return;
        }
        const rect = element.getBoundingClientRect();
        box.hidden = false;
        Object.assign(box.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    }
    function begin(event, action) {
        if (event.button !== 0 || !selection) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = selection.element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2;
        gesture = { action, x: event.clientX, y: event.clientY, centerX, centerY, values: read(), pointerId: event.pointerId,
            distance: Math.max(1, Math.hypot(event.clientX - centerX, event.clientY - centerY)),
            angle: Math.atan2(event.clientY - centerY, event.clientX - centerX) };
        event.currentTarget.setPointerCapture(event.pointerId);
    }
    window.addEventListener('pointermove', event => {
        if (!gesture || event.pointerId !== gesture.pointerId) return;
        const g = gesture;
        if (g.action === 'move') commit({ posX: Math.max(0, Math.min(100, g.values.posX + (event.clientX - g.x) / innerWidth * 100)), posY: Math.max(0, Math.min(100, g.values.posY + (event.clientY - g.y) / innerHeight * 100)) });
        if (g.action === 'scale') commit({ scale: Math.max(1, Math.min(1000, g.values.scale * Math.hypot(event.clientX - g.centerX, event.clientY - g.centerY) / g.distance)) });
        if (g.action === 'rotate') commit({ rotation: Math.round(g.values.rotation + (Math.atan2(event.clientY - g.centerY, event.clientX - g.centerX) - g.angle) * 180 / Math.PI) % 360 });
    });
    for (const event of ['pointerup', 'pointercancel']) window.addEventListener(event, () => { gesture = null; });
    document.addEventListener('pointerdown', event => {
        if (!box.contains(event.target) && !event.target.closest('[data-editor-object]')) { selection = null; refresh(); }
    });
    document.addEventListener('keydown', event => {
        if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
        if (event.key === 'Escape') { selection = null; refresh(); }
        if (event.key === 'Delete' && selection) { event.preventDefault(); removeSelected(); }
    });
    window.addEventListener('resize', refresh);
    document.addEventListener('transitionend', refresh);
    const observer = new ResizeObserver(refresh);
    document.fonts.addEventListener('loadingdone', refresh);
    return {
        refresh,
        bind(element, type, id = null) {
            if (bindings.has(element)) return;
            const entry = { element, type, id };
            bindings.set(element, entry);
            element.dataset.editorObject = type;
            element.style.touchAction = 'none';
            element.style.cursor = 'move';
            element.draggable = false;
            observer.observe(element);
            element.addEventListener('load', refresh);
            element.addEventListener('pointerdown', event => { selection = entry; refresh(); begin(event, 'move'); });
            element.addEventListener('wheel', event => {
                event.preventDefault(); selection = entry;
                commit({ scale: Math.max(1, Math.min(1000, read().scale + (event.deltaY < 0 ? 2 : -2))) });
            }, { passive: false });
        }
    };
}
