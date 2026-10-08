import { state } from './state.js';

let render, pending, dirty = false;
export function initializeProjectTaskCounts(onChange) {
    render = onChange;
    window.addEventListener('focus', refreshProjectTaskCounts);
    return refreshProjectTaskCounts();
}
export function refreshProjectTaskCounts() {
    // Initialization happens only after the existing session/role checks.
    if (!render) return;
    dirty = true;
    if (pending) return pending;
    state.projectTaskCountsStatus = 'loading';
    pending = (async () => {
        while (dirty) {
            dirty = false;
            try {
                const response = await fetch('/api/getProjectTaskCounts', { cache: 'no-store' });
                if (!response.ok) throw new Error('Contagem indisponível');
                const counts = await response.json();
                if (!Array.isArray(counts) || counts.some(row => typeof row.project !== 'string' || !Number.isSafeInteger(row.active) || !Number.isSafeInteger(row.total) || row.active < 0 || row.total < row.active)) throw new Error('Contagem inválida');
                // An event during the request invalidates its snapshot; fetch again.
                if (!dirty) {
                    state.projectTaskCounts = counts;
                    state.projectTaskCountsStatus = 'ready';
                }
            } catch {
                if (!dirty) state.projectTaskCountsStatus = 'error';
            }
        }
    })().finally(() => {
        pending = null;
        // A promise continuation may invalidate between the loop exit and finally.
        if (dirty) return refreshProjectTaskCounts();
        render();
    });
    return pending;
}
