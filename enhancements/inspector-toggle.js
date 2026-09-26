// ==UserScript==
// @name         Muse Desktop - Beacon Activity Inspector (Auto-Open, Toggle, State Indicator & Twirl)
// @namespace    https://github.com/chromewizard/muse-desktop
// @version      1.4.2
// @description  Opens Beacon's Activity Inspector drawer by default, adds a persistent top-right toolbar toggle that shows On/Off state, binds Cmd+Option+I, and makes the little Beacon avatar do a full 3D turn (12 hand-drawn views, arms lifting through the turn) when the drawer is closed with the X, so people learn that he is the handle that brings it back. The turn has a no-canvas CSS-sprite player and a plain hop behind it, so something always moves and the avatar can never go blank.
// @match        https://muse.ai/*
// @grant        none
// ==/UserScript==

/*
 * Runs in two places:
 *   1. Muse Standalone PWA Launcher (Chrome --app=https://muse.ai) via a userscript manager.
 *   2. The native macOS app (com.meta.endo), injected into Contents/Resources/hatch/index.html
 *      by v4.1.1-patch/patch-dmg.py (or v4.1.1-patch/inject-enhancements.py for an installed app).
 *
 * Hooks used (from the Hatch bundle):
 *   [data-testid="hatch-status-panel-close"]              the X in the drawer's top-right corner
 *   [data-hatch-avatar-host]                              the floating Beacon avatar (framer "spring" geometry)
 *   [data-hatch-avatar-host] [data-hatch-avatar-interaction]  the round 56px avatar inside it
 *   [data-hatch-avatar-display-stage="chat-nav"]          host attribute when the avatar sits top-center of the chat
 *   window event "hatch:open-approvals-panel"             the app's own "open the drawer" hook
 *   button[aria-label="Activity"]                         the drawer's Activity tab
 */

(function () {
    'use strict';

    if (window.__museInspectorEnhancement) return; // idempotent (userscript + injected copy)
    window.__museInspectorEnhancement = { version: '1.4.2' };

    const SEL = {
        closeBtn: '[data-testid="hatch-status-panel-close"]',
        avatarHost: '[data-hatch-avatar-host]',
        avatar: '[data-hatch-avatar-host] [data-hatch-avatar-interaction]',
        activityTab: 'button[aria-label="Activity"]',
    };
    const TOGGLE_ID = 'muse-inspector-toggle-btn';
    const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ------------------------------------------------------------------ */
    /*  Styles: twirl keyframes, toolbar pill, avatar hover affordance      */
    /* ------------------------------------------------------------------ */
    function injectStyles() {
        if (document.getElementById('muse-inspector-enhancement-css')) return;
        const css = document.createElement('style');
        css.id = 'muse-inspector-enhancement-css';
        css.textContent = `
            /* --- Beacon twirl: twelve hand-drawn views of him (0°..330°, arms lifting through the
                   back view and settling by 330°), cross-dissolved as the turn angle sweeps, drawn over
                   the avatar's own background. Fades in over his live avatar and back out. --- */
            .muse-beacon-twirling, ${SEL.avatar}[role="button"].muse-beacon-twirling {
                transition: none !important;            /* the hover transition must not smooth the hop */
                transform-origin: 50% 60% !important;
                will-change: transform;
            }
            .muse-beacon-stage3d {
                position: absolute; inset: 0; border-radius: 9999px; overflow: hidden; pointer-events: none;
                background: #f2f0ec; opacity: 0;
            }
            .muse-beacon-stage3d canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
            /* no-canvas player: the same two views as CSS sprites, cross-dissolved by opacity. plus-lighter
               inside an isolated group makes that dissolve exact where it is supported (Safari 16.4+). */
            .muse-beacon-sprites { position: absolute; inset: 0; isolation: isolate; }
            .muse-beacon-cell {
                position: absolute; inset: 0; background-repeat: no-repeat;
                background-size: ${SHEET_COLS * 100}% ${(SHEET_FRAMES / SHEET_COLS) * 100}%;
                will-change: opacity, background-position;
            }
            .muse-beacon-cell.muse-b { mix-blend-mode: plus-lighter; }
            /* a replaced (custom) avatar, or a machine where the art will not draw, gets this plain hop */
            @keyframes muse-beacon-hop {
                0%   { transform: translateY(0)    rotate(0deg)    scale(1, 1);       animation-timing-function: ease-in; }
                18%  { transform: translateY(1px)  rotate(2deg)    scale(1.04, 0.96); animation-timing-function: ease-out; }
                50%  { transform: translateY(-8px) rotate(-2deg)   scale(0.98, 1.03); animation-timing-function: ease-in; }
                80%  { transform: translateY(1px)  rotate(1deg)    scale(1.03, 0.97); animation-timing-function: ease-out; }
                100% { transform: translateY(0)    rotate(0deg)    scale(1, 1); }
            }
            .muse-beacon-hopping, ${SEL.avatar}[role="button"].muse-beacon-hopping {
                animation: muse-beacon-hop 620ms both !important; transition: none !important;
                transform-origin: 50% 60% !important; will-change: transform;
            }
            /* the name tag under the avatar bobs when he lands, like it is attached to him */
            @keyframes muse-beacon-tag-bob {
                0%   { transform: translateY(0); }
                35%  { transform: translateY(2px); }
                65%  { transform: translateY(-2px); }
                100% { transform: translateY(0); }
            }
            .muse-beacon-tag-bob {
                animation: muse-beacon-tag-bob 420ms 1900ms ease-out both !important;
                display: inline-block; will-change: transform;   /* transforms do nothing on a plain inline span */
            }
            /* reduced motion: a soft pulse instead of the spin */
            @keyframes muse-beacon-pulse {
                0%, 100% { opacity: 1; }
                50%      { opacity: 0.55; }
            }
            .muse-beacon-pulse {
                animation: muse-beacon-pulse 600ms ease-in-out both !important;
            }

            /* --- Discoverability: when the avatar is a real button, say so on hover --- */
            ${SEL.avatar}[role="button"] {
                cursor: pointer !important;
                transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1), filter 180ms ease !important;
            }
            ${SEL.avatar}[role="button"]:hover:not(.muse-beacon-twirling):not(.muse-beacon-hopping) {
                transform: translateY(-2px) scale(1.06) !important;
                filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.18));
            }

            /* --- Toolbar pill with On/Off state --- */
            #${TOGGLE_ID} {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                height: 36px;
                padding: 0 12px 0 10px;
                margin-right: 8px;
                border-radius: 9999px;
                border: 1px solid rgba(0, 0, 0, 0.10);
                background: rgba(255, 255, 255, 0.85);
                color: inherit;
                font: inherit;
                font-size: 13px;
                font-weight: 500;
                line-height: 1;
                cursor: pointer;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
                transition: background 150ms ease, border-color 150ms ease, transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
                -webkit-user-select: none; user-select: none;
            }
            #${TOGGLE_ID}:hover { background: rgba(255, 255, 255, 1); border-color: rgba(0, 0, 0, 0.18); }
            #${TOGGLE_ID}:active { transform: scale(0.97); }
            #${TOGGLE_ID}:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
            #${TOGGLE_ID} svg { width: 16px; height: 16px; flex: none; }
            #${TOGGLE_ID} .muse-state {
                display: inline-flex; align-items: center; gap: 5px;
                padding: 3px 7px 3px 5px; border-radius: 9999px;
                font-size: 11px; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase;
                background: rgba(0, 0, 0, 0.06); color: rgba(0, 0, 0, 0.55);
                transition: background 200ms ease, color 200ms ease;
            }
            #${TOGGLE_ID} .muse-dot {
                width: 7px; height: 7px; border-radius: 50%;
                background: rgba(0, 0, 0, 0.28);
                transition: background 200ms ease, box-shadow 200ms ease;
            }
            #${TOGGLE_ID}[aria-pressed="true"] { border-color: rgba(34, 197, 94, 0.45); }
            #${TOGGLE_ID}[aria-pressed="true"] .muse-state { background: rgba(34, 197, 94, 0.14); color: #15803d; }
            #${TOGGLE_ID}[aria-pressed="true"] .muse-dot { background: #22c55e; box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.22); }
            @keyframes muse-dot-pop { 0% { transform: scale(1); } 40% { transform: scale(1.7); } 100% { transform: scale(1); } }
            #${TOGGLE_ID} .muse-dot.pop { animation: muse-dot-pop 360ms cubic-bezier(0.22, 1, 0.36, 1); }

            html.dark #${TOGGLE_ID} {
                background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.14); box-shadow: none;
            }
            html.dark #${TOGGLE_ID}:hover { background: rgba(255, 255, 255, 0.14); }
            html.dark #${TOGGLE_ID} .muse-state { background: rgba(255, 255, 255, 0.10); color: rgba(255, 255, 255, 0.7); }
            html.dark #${TOGGLE_ID} .muse-dot { background: rgba(255, 255, 255, 0.35); }
            html.dark #${TOGGLE_ID}[aria-pressed="true"] .muse-state { background: rgba(34, 197, 94, 0.2); color: #4ade80; }
        `;
        (document.head || document.documentElement).appendChild(css);
    }

    /* ------------------------------------------------------------------ */
    /*  Panel state & control                                               */
    /* ------------------------------------------------------------------ */
    function isInspectorOpen() {
        return !!document.querySelector(SEL.closeBtn);
    }

    function avatarButton() {
        const el = document.querySelector(SEL.avatar);
        return el && el.getAttribute('role') === 'button' ? el : null;
    }

    function openInspector() {
        if (isInspectorOpen()) return;
        const btn = avatarButton();
        if (btn) { btn.click(); return; }          // the app's own toggle (keeps the last tab)
        // Fallback: the app's public hook opens to Approvals; hop to Activity so tool calls show first.
        window.dispatchEvent(new CustomEvent('hatch:open-approvals-panel'));
        setTimeout(() => {
            const tab = document.querySelector(SEL.activityTab);
            if (tab && tab.getAttribute('aria-pressed') !== 'true') tab.click();
        }, 60);
    }

    function closeInspector() {
        const x = document.querySelector(SEL.closeBtn);
        if (x) x.click();
    }

    function toggleInspector() {
        isInspectorOpen() ? closeInspector() : openInspector();
    }

    /* ------------------------------------------------------------------ */
    /*  The twirl                                                           */
    /* ------------------------------------------------------------------ */
    let twirlTimer = null;

    // A fabric texture for the sphere and for the back of his hood: sampled from the live avatar
    // media (the lower-middle of the frame is onesie, below the face) onto a small canvas.
    // Returns null if the media cannot be read (e.g. cross-origin) -> the CSS gradient shows instead.
    function fabricCanvas(front, size) {
        try {
            const m = front.querySelector('video, img');
            const W = m && (m.videoWidth || m.naturalWidth), H = m && (m.videoHeight || m.naturalHeight);
            if (!m || !(W > 0) || !(H > 0)) return null;
            const dpr = Math.min(window.devicePixelRatio || 1, 3);
            const c = document.createElement('canvas');
            c.width = Math.max(2, Math.round(size * dpr)); c.height = c.width;
            const ctx = c.getContext('2d');
            const sw = W * 0.42, sh = H * 0.42, sx = (W - sw) / 2, sy = H * 0.50;
            ctx.drawImage(m, sx, sy, sw, sh, 0, 0, c.width, c.height);
            ctx.getImageData(0, 0, 1, 1); // throws on a tainted canvas
            return c;
        } catch (e) { return null; }
    }

    // The onesie-sphere twirl is built for Beacon's own look. Users can replace the avatar, and a
    // photo or another character would get a fake fuzzy back, so the special move is gated:
    //   1. the stock avatar renders from the app's built-in media (/avatars/hatch*.mp4|jpg) -> yes
    //   2. otherwise the pixels under the face must read as Beacon's fabric: light, warm, low-detail
    // Anything else gets a plain hop (still says "I'm the handle", nothing fabricated).
    function isStockBeacon(front) {
        const m = front.querySelector('video, img');
        const src = (m && (m.currentSrc || m.src)) || '';
        if (/\/avatars\/hatch[a-z_]*\.(mp4|jpg)(\?|#|$)/i.test(src)) return true;
        const c = fabricCanvas(front, 16);
        if (!c) return false;
        try {
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let n = 0, r = 0, g = 0, b = 0, l2 = 0, lsum = 0;
            for (let i = 0; i < d.length; i += 4) { const L = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; r += d[i]; g += d[i + 1]; b += d[i + 2]; lsum += L; l2 += L * L; n++; }
            r /= n; g /= n; b /= n; const lm = lsum / n, sd = Math.sqrt(Math.max(0, l2 / n - lm * lm));
            const warm = r >= g - 4 && g >= b - 4, light = lm > 150 && lm < 248, muted = (Math.max(r, g, b) - Math.min(r, g, b)) < 70, smooth = sd < 30;
            return warm && light && muted && smooth;
        } catch (e) { return false; }
    }

    function runHop(avatar, tag) {
        avatar.classList.remove('muse-beacon-hopping'); void avatar.offsetWidth;
        avatar.classList.add('muse-beacon-hopping');
        avatar.addEventListener('animationend', (e) => { if (e.animationName === 'muse-beacon-hop') avatar.classList.remove('muse-beacon-hopping'); }, { once: true });
        if (tag) {
            tag.classList.remove('muse-beacon-tag-bob'); void tag.offsetWidth;
            tag.style.animationDelay = '260ms';
            tag.classList.add('muse-beacon-tag-bob');
            tag.addEventListener('animationend', () => { tag.classList.remove('muse-beacon-tag-bob'); tag.style.animationDelay = ''; }, { once: true });
        }
    }

    /* ------------------------------------------------------------------ */
    /*  The turnaround art: 12 views, 30° apart, arms lifting through the turn   */
    /* ------------------------------------------------------------------ */
    const SHEET_COLS = 4, SHEET_FRAMES = 12, SHEET_CELL = 160;
    const SHEET_B64 = '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';
    const SHEET_URL = 'data:image/png;base64,' + SHEET_B64;
    // sheetState: idle | loading | ready | failed.  sheetMode (when ready): 'canvas' draws the views on a
    // canvas (exact dissolve); 'css' shows them as CSS sprites (no canvas at all).  The art is only ever
    // trusted after a test draw really puts his pixels somewhere, so a stage can never come up blank.
    let sheetImg = null, sheetState = 'idle', sheetMode = 'none';

    function testDraw(source) {
        const c = document.createElement('canvas'); c.width = 16; c.height = 16;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(source, 0, 0, SHEET_CELL, SHEET_CELL, 0, 0, 16, 16);
        const d = x.getImageData(0, 0, 16, 16).data;
        let hit = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) hit++;
        return hit > 20;
    }

    // Decode the atlas from raw bytes instead of a URL (no image-loading policy involved at all).
    function bitmapFallback(orElse) {
        try {
            if (typeof createImageBitmap !== 'function') { orElse(); return; }
            const bin = atob(SHEET_B64), bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            createImageBitmap(new Blob([bytes], { type: 'image/png' })).then((bmp) => {
                let ok = false; try { ok = testDraw(bmp); } catch (e) { ok = false; }
                if (ok) { sheetImg = bmp; sheetMode = 'canvas'; sheetState = 'ready'; } else orElse();
            }, orElse);
        } catch (e) { orElse(); }
    }

    function loadSheet() {
        if (sheetState !== 'idle') return;
        sheetState = 'loading';
        const im = new Image();
        im.onload = () => {
            let ok = false; try { ok = testDraw(im); } catch (e) { ok = false; }
            if (ok) { sheetImg = im; sheetMode = 'canvas'; sheetState = 'ready'; return; }
            // It decoded but a canvas will not take it: try raw bytes, else let CSS paint the same image.
            bitmapFallback(() => {
                if (im.naturalWidth > 0) { sheetImg = im; sheetMode = 'css'; sheetState = 'ready'; } else sheetState = 'failed';
            });
        };
        im.onerror = () => bitmapFallback(() => { sheetState = 'failed'; });
        im.src = SHEET_URL;
    }

    // The avatar's own backdrop color, sampled from a corner of the live frame (outside the figure).
    function frameColor(front) {
        try {
            const m = front.querySelector('video, img');
            const W = m && (m.videoWidth || m.naturalWidth), H = m && (m.videoHeight || m.naturalHeight);
            if (!m || !(W > 0) || !(H > 0)) return null;
            const c = document.createElement('canvas'); c.width = 8; c.height = 8;
            const ctx = c.getContext('2d');
            ctx.drawImage(m, W * 0.04, H * 0.04, W * 0.12, H * 0.12, 0, 0, 8, 8);
            const d = ctx.getImageData(0, 0, 8, 8).data;
            let r = 0, g = 0, b = 0, n = 0;
            for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
            return 'rgb(' + Math.round(r / n) + ',' + Math.round(g / n) + ',' + Math.round(b / n) + ')';
        } catch (e) { return null; }
    }

    // Which two of the twelve views show at thetaDeg, and how far the dissolve between them has come.
    // Each view holds for most of its 30 degrees and dissolves only across the last third, so there are
    // never two faces mid-blend.
    function turnBlend(thetaDeg) {
        const f = (((thetaDeg % 360) + 360) % 360) / (360 / SHEET_FRAMES);
        const i0 = Math.floor(f) % SHEET_FRAMES, i1 = (i0 + 1) % SHEET_FRAMES;
        const raw = f - Math.floor(f), w = Math.max(0, Math.min(1, (raw - 0.62) / 0.38));
        return [i0, i1, w];
    }

    // Canvas player: draw him at thetaDeg. The dissolve is exact (A*(1-w) + B*w) thanks to an additive
    // pass on a cleared offscreen canvas, laid over the avatar's own backdrop colour.
    function drawTurn(ctx, off, px, thetaDeg, bg) {
        const [i0, i1, w] = turnBlend(thetaDeg);
        const o = off.getContext('2d');
        o.setTransform(1, 0, 0, 1, 0, 0);
        o.globalCompositeOperation = 'source-over';
        o.clearRect(0, 0, px, px);
        const cell = (i) => [(i % SHEET_COLS) * SHEET_CELL, Math.floor(i / SHEET_COLS) * SHEET_CELL];
        let [sx, sy] = cell(i0);
        o.globalAlpha = 1 - w;
        o.drawImage(sheetImg, sx, sy, SHEET_CELL, SHEET_CELL, 0, 0, px, px);
        if (w > 0.001) {
            [sx, sy] = cell(i1);
            o.globalCompositeOperation = 'lighter';
            o.globalAlpha = w;
            o.drawImage(sheetImg, sx, sy, SHEET_CELL, SHEET_CELL, 0, 0, px, px);
        }
        o.globalAlpha = 1; o.globalCompositeOperation = 'source-over';
        ctx.fillStyle = bg; ctx.fillRect(0, 0, px, px);
        ctx.drawImage(off, 0, 0);
    }

    // CSS-sprite player: the same two views as background positions on two layers, no canvas involved.
    function cellPos(i) {
        const rows = SHEET_FRAMES / SHEET_COLS;
        const x = (i % SHEET_COLS) / (SHEET_COLS - 1) * 100, y = Math.floor(i / SHEET_COLS) / (rows - 1) * 100;
        return x.toFixed(3) + '% ' + y.toFixed(3) + '%';
    }
    function spriteTurn(a, b, thetaDeg) {
        const [i0, i1, w] = turnBlend(thetaDeg);
        a.style.backgroundPosition = cellPos(i0); a.style.opacity = (1 - w).toFixed(3);
        b.style.backgroundPosition = cellPos(i1); b.style.opacity = w.toFixed(3);
    }

    // The keyframes of the move (fraction of the 2.4 s): turn angle, hand lift, hop, tilt, squash.
    const TWIRL_MS = 2400;
    const KEYS = [
        // t,    theta, lift, y,    rot,  sx,   sy
        [0.00,   0,     0,    0,    0,    1,    1   ],
        [0.10,  -22,    0.10, 1,    3,    1.05, 0.95],
        [0.24,   50,    0.55, -7,  -3,    0.96, 1.06],
        [0.52,   200,   1.00, -11,  2,    1,    1   ],
        [0.76,   335,   0.55, -4,  -2,    1,    1   ],
        [0.86,   372,   0.15, 1.5,  1.5,  1.06, 0.94],
        [0.94,   355,   0.03, -0.5,-0.5,  0.99, 1.01],
        [1.00,   360,   0,    0,    0,    1,    1   ],
    ];
    const ease = (u) => u * u * (3 - 2 * u);
    function sampleKeys(t) {
        let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
        const A = KEYS[i], B = KEYS[i + 1];
        let u = (t - A[0]) / (B[0] - A[0]); u = Math.max(0, Math.min(1, u));
        const spin = i >= 2 && i <= 3;                       // constant speed through the middle
        const w = spin ? u : ease(u);
        const out = [];
        for (let k = 1; k < 7; k++) out.push(A[k] + (B[k] - A[k]) * w);
        return out; // theta, lift, y, rot, sx, sy
    }

    function runTwirl() {
        const avatar = document.querySelector(SEL.avatar);
        if (!avatar) return;
        if (document.visibilityState === 'hidden') return;       // nothing animates in a hidden page; do not queue it
        const front = avatar.firstElementChild || avatar;
        const host = avatar.closest(SEL.avatarHost);
        const tag = host && Array.from(host.querySelectorAll('span')).find(s => s.children.length === 0 && s.textContent.trim().length > 0);

        if (reducedMotion()) {
            front.classList.remove('muse-beacon-pulse'); void front.offsetWidth;
            front.classList.add('muse-beacon-pulse');
            front.addEventListener('animationend', () => front.classList.remove('muse-beacon-pulse'), { once: true });
            return;
        }
        if (!isStockBeacon(front)) { runHop(avatar, tag); return; }   // replaced avatar: plain hop only

        if (sheetState !== 'ready') { loadSheet(); runHop(avatar, tag); return; }   // art not usable here: hop instead

        const size = front.getBoundingClientRect().width || 56;
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const px = Math.max(32, Math.round(size * dpr));
        const bg = frameColor(front) || '#f2f0ec';

        avatar.querySelectorAll('.muse-beacon-stage3d').forEach(n => n.remove());
        const stage = document.createElement('div');
        stage.className = 'muse-beacon-stage3d'; stage.setAttribute('aria-hidden', 'true');
        stage.style.background = bg;

        // Build the player. Canvas first (exact dissolve); if its first frame does not actually show him,
        // fall back to CSS sprites of the same image; if that is impossible too, hop.
        let render = null;
        if (sheetMode === 'canvas') {
            const cv = document.createElement('canvas'); cv.width = px; cv.height = px;
            const off = document.createElement('canvas'); off.width = px; off.height = px;
            const ctx = cv.getContext('2d', { willReadFrequently: true });
            try {
                drawTurn(ctx, off, px, 0, bg);
                const d = ctx.getImageData(0, 0, px, px).data, r0 = d[8], g0 = d[9], b0 = d[10]; // backdrop corner
                let diff = 0;
                for (let i = 0; i < d.length; i += 16) { if (Math.abs(d[i] - r0) + Math.abs(d[i + 1] - g0) + Math.abs(d[i + 2] - b0) > 30) diff++; }
                if (diff < (d.length / 16) * 0.08) throw new Error('first frame is blank');
                stage.appendChild(cv);
                render = (theta) => drawTurn(ctx, off, px, theta, bg);
            } catch (e) {
                render = null;
                sheetMode = (sheetImg instanceof HTMLImageElement) ? 'css' : 'none';
            }
        }
        if (!render && sheetMode === 'css') {
            const wrap = document.createElement('div'); wrap.className = 'muse-beacon-sprites';
            const la = document.createElement('div'); la.className = 'muse-beacon-cell muse-a';
            const lb = document.createElement('div'); lb.className = 'muse-beacon-cell muse-b';
            la.style.backgroundImage = lb.style.backgroundImage = 'url("' + SHEET_URL + '")';
            wrap.appendChild(la); wrap.appendChild(lb); stage.appendChild(wrap);
            spriteTurn(la, lb, 0);
            render = (theta) => spriteTurn(la, lb, theta);
        }
        if (!render) { sheetState = 'failed'; runHop(avatar, tag); return; }

        avatar.appendChild(stage);
        avatar.classList.add('muse-beacon-twirling');

        let done = false, raf = 0;
        const cleanup = () => {
            if (done) return; done = true;
            cancelAnimationFrame(raf);
            avatar.style.transform = '';
            avatar.classList.remove('muse-beacon-twirling');
            stage.remove();
        };
        const t0 = performance.now();
        const frame = (now) => {
            try {
                // if the drawer came back, he left the top-center, or the page went away mid-turn: stop at once
                if (isInspectorOpen() || document.visibilityState === 'hidden' ||
                    (host && host.getAttribute('data-hatch-avatar-display-stage') !== 'chat-nav')) { cleanup(); return; }
                const t = Math.min(1, (now - t0) / TWIRL_MS);
                const [theta, , y, rot, sx, sy] = sampleKeys(t);
                render(theta);
                stage.style.opacity = t < 0.07 ? (t / 0.07).toFixed(3) : (t > 0.93 ? ((1 - t) / 0.07).toFixed(3) : '1');
                avatar.style.transform = 'translateY(' + y + 'px) rotate(' + rot + 'deg) scale(' + sx + ',' + sy + ')';
                if (t < 1) raf = requestAnimationFrame(frame); else cleanup();
            } catch (e) { cleanup(); }
        };
        raf = requestAnimationFrame(frame);
        setTimeout(cleanup, TWIRL_MS + 600); // safety net

        if (tag) {
            tag.classList.remove('muse-beacon-tag-bob'); void tag.offsetWidth;
            tag.classList.add('muse-beacon-tag-bob');
            tag.addEventListener('animationend', () => tag.classList.remove('muse-beacon-tag-bob'), { once: true });
        }
    }

    // After a close, the avatar springs from the drawer back to the top-center of the chat.
    // Wait for it to land (position stable for a few frames), then twirl. Falls back to a
    // fixed delay if it never settles (e.g. mid-scroll).
    function twirlWhenLanded() {
        clearTimeout(twirlTimer);
        const started = performance.now();
        let last = null, stableFrames = 0;
        const tick = () => {
            const host = document.querySelector(SEL.avatarHost);
            const elapsed = performance.now() - started;
            if (host && host.getAttribute('data-hatch-avatar-display-stage') === 'chat-nav' && !isInspectorOpen()) {
                const r = host.getBoundingClientRect();
                const key = Math.round(r.left) + ',' + Math.round(r.top);
                stableFrames = key === last ? stableFrames + 1 : 0;
                last = key;
                if (stableFrames >= 4 && elapsed >= 120) { runTwirl(); return; }
            }
            if (elapsed > 1600) { if (host && !isInspectorOpen()) runTwirl(); return; }
            twirlTimer = setTimeout(tick, 40);
        };
        tick();
    }

    /* ------------------------------------------------------------------ */
    /*  Toolbar pill (state indicator + toggle)                             */
    /* ------------------------------------------------------------------ */
    function injectToggleToolbarButton() {
        if (document.getElementById(TOGGLE_ID)) return;
        const inviteBtn = Array.from(document.querySelectorAll('button')).find(b => /\bInvite\b/.test(b.textContent));
        if (!inviteBtn || !inviteBtn.parentElement) return;

        const btn = document.createElement('button');
        btn.id = TOGGLE_ID;
        btn.type = 'button';
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('data-muse-enhancement', 'inspector-toggle');
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect width="18" height="18" x="3" y="3" rx="4"/>
                <path d="M15 3v18"/>
                <path d="m8 9 3 3-3 3"/>
            </svg>
            <span>Inspector</span>
            <span class="muse-state"><span class="muse-dot"></span><span class="muse-state-text">Off</span></span>`;
        btn.addEventListener('click', (e) => { e.preventDefault(); toggleInspector(); });
        inviteBtn.parentElement.insertBefore(btn, inviteBtn);
        syncToggleState(true);
    }

    // Only a close the person asked for (the X, the pill, the shortcut, Escape) earns the twirl. The app can
    // also flip the drawer closed on its own while it boots or re-lays out; that gets no move, and during the
    // first seconds after launch it gets reopened, so the Inspector really does start on.
    let lastInputAt = -1e9;
    ['pointerdown', 'mousedown', 'keydown', 'click'].forEach((type) => {
        window.addEventListener(type, (e) => { if (e.isTrusted) lastInputAt = performance.now(); }, true);
    });
    const userActedRecently = () => performance.now() - lastInputAt < 3000;

    let lastKnownOpen = null, reopenTries = 0;
    function syncToggleState(silent) {
        const open = isInspectorOpen();
        const btn = document.getElementById(TOGGLE_ID);
        if (btn) {
            btn.setAttribute('aria-pressed', open ? 'true' : 'false');
            btn.title = (open ? 'Hide' : 'Show') + " Beacon's Activity Inspector (⌘⌥I)";
            btn.setAttribute('aria-label', btn.title);
            const text = btn.querySelector('.muse-state-text');
            if (text) text.textContent = open ? 'On' : 'Off';
            const dot = btn.querySelector('.muse-dot');
            if (dot && !silent && open !== lastKnownOpen && lastKnownOpen !== null) {
                dot.classList.remove('pop'); void dot.offsetWidth; dot.classList.add('pop');
            }
        }
        // Tooltip on the little guy himself, whenever he is actually clickable.
        const av = avatarButton();
        if (av) av.title = "Beacon — click to " + (open ? 'hide' : 'show') + " his activity";

        if (lastKnownOpen === true && open === false) {
            if (userActedRecently()) twirlWhenLanded();                     // the X (or ⌘⌥I / the pill) just closed it
            else if (autoOpened && performance.now() - bootAt < 20000 && reopenTries < 2) {
                reopenTries++;                                              // the app closed it while still booting
                setTimeout(() => { if (!isInspectorOpen() && !userActedRecently()) openInspector(); }, 400);
            }
        }
        lastKnownOpen = open;
    }

    /* ------------------------------------------------------------------ */
    /*  Keyboard shortcut: Cmd/Ctrl + Option + I                            */
    /* ------------------------------------------------------------------ */
    window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.altKey && (e.code === 'KeyI' || e.key === 'i' || e.key === 'I' || e.key === 'ı')) {
            e.preventDefault();
            toggleInspector();
        }
    }, true);

    /* ------------------------------------------------------------------ */
    /*  Auto-open once on startup (default ON)                              */
    /* ------------------------------------------------------------------ */
    let autoOpened = false;
    const bootAt = performance.now();
    function autoOpenOnStartup() {
        if (autoOpened) return;
        if (isInspectorOpen()) { autoOpened = true; return; }
        // The app must be far enough along to have its header (Invite) or the avatar mounted.
        const ready = document.querySelector(SEL.avatarHost) || Array.from(document.querySelectorAll('button')).some(b => /\bInvite\b/.test(b.textContent));
        if (!ready) return;
        autoOpened = true;
        openInspector();
        // If the app was not quite ready and ignored us, try once more shortly after.
        setTimeout(() => { if (!isInspectorOpen() && performance.now() - bootAt < 30000) openInspector(); }, 1200);
        console.log('[Muse Desktop] Beacon Activity Inspector opened by default.');
    }

    /* ------------------------------------------------------------------ */
    /*  Wiring                                                              */
    /* ------------------------------------------------------------------ */
    let raf = 0;
    function onMutation() {
        if (raf) return;
        raf = requestAnimationFrame(() => {
            raf = 0;
            injectStyles();
            injectToggleToolbarButton();
            syncToggleState(false);
            autoOpenOnStartup();
        });
    }

    function start() {
        injectStyles();
        loadSheet();
        new MutationObserver(onMutation).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-testid', 'role', 'data-hatch-avatar-display-stage'] });
        onMutation();
        setTimeout(onMutation, 500);
        setTimeout(onMutation, 2000);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();

    // Small public surface for testing / the in-app console.
    window.__museInspectorEnhancement.toggle = toggleInspector;
    window.__museInspectorEnhancement.open = openInspector;
    window.__museInspectorEnhancement.close = closeInspector;
    window.__museInspectorEnhancement.twirl = runTwirl;
    window.__museInspectorEnhancement._draw = drawTurn;
    window.__museInspectorEnhancement._keys = sampleKeys;
    window.__museInspectorEnhancement._sheetReady = () => sheetState === 'ready';
    window.__museInspectorEnhancement._mode = () => (sheetState === 'ready' ? sheetMode : sheetState);
    window.__museInspectorEnhancement._forceMode = (m) => { if (sheetState === 'ready' && (m === 'css' || m === 'canvas')) sheetMode = m; return sheetMode; };
    window.__museInspectorEnhancement._sprite = spriteTurn;
    window.__museInspectorEnhancement.isOpen = isInspectorOpen;
    window.__museInspectorEnhancement.isStockBeacon = () => { const a = document.querySelector(SEL.avatar); return !!a && isStockBeacon(a.firstElementChild || a); };
})();
