// ==UserScript==
// @name         Muse Desktop - Beacon Activity Inspector (Auto-Open, Toggle, State Indicator & Twirl)
// @namespace    https://github.com/chromewizard/muse-desktop
// @version      1.4.0
// @description  Opens Beacon's Activity Inspector drawer by default, adds a persistent top-right toolbar toggle that shows On/Off state, binds Cmd+Option+I, and makes the little Beacon avatar do a full 3D turn (12 hand-drawn views, arms lifting through the turn) when the drawer is closed with the X, so people learn that he is the handle that brings it back.
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
    window.__museInspectorEnhancement = { version: '1.4.0' };

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
            .muse-beacon-twirling { will-change: transform; }
            .muse-beacon-stage3d {
                position: absolute; inset: 0; border-radius: 9999px; overflow: hidden; pointer-events: none;
                background: #f2f0ec; opacity: 0;
            }
            .muse-beacon-stage3d canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
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
            ${SEL.avatar}[role="button"]:hover {
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
    const SHEET_COLS = 4, SHEET_FRAMES = 12, SHEET_CELL = 192;
    const SHEET_URL = 'data:image/webp;base64,' + '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';
    let sheetImg = null, sheetState = 'idle';
    function loadSheet() {
        if (sheetState !== 'idle') return;
        sheetState = 'loading';
        const im = new Image();
        im.onload = () => { sheetImg = im; sheetState = 'ready'; };
        im.onerror = () => { sheetState = 'failed'; };
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

    // Draw him at thetaDeg: the two neighbouring views, dissolved by where the angle falls between them.
    // The dissolve is exact (A*(1-w) + B*w) thanks to an additive pass on a cleared offscreen canvas.
    function drawTurn(ctx, off, px, thetaDeg, bg) {
        const f = (((thetaDeg % 360) + 360) % 360) / (360 / SHEET_FRAMES);
        const i0 = Math.floor(f) % SHEET_FRAMES, i1 = (i0 + 1) % SHEET_FRAMES;
        // hold each view for most of its 30°, dissolve only across the last third: no double faces mid-blend
        const raw = f - Math.floor(f), w = Math.max(0, Math.min(1, (raw - 0.62) / 0.38));
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

        if (sheetState !== 'ready') { loadSheet(); runHop(avatar, tag); return; }   // art not decoded yet: hop, next time twirl

        const size = front.getBoundingClientRect().width || 56;
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const px = Math.max(32, Math.round(size * dpr));
        const bg = frameColor(front) || '#f2f0ec';

        avatar.querySelectorAll('.muse-beacon-stage3d').forEach(n => n.remove());
        const stage = document.createElement('div');
        stage.className = 'muse-beacon-stage3d'; stage.setAttribute('aria-hidden', 'true');
        stage.style.background = bg;
        const cv = document.createElement('canvas'); cv.width = px; cv.height = px;
        const off = document.createElement('canvas'); off.width = px; off.height = px;
        stage.appendChild(cv);
        const ctx = cv.getContext('2d');
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
            const t = Math.min(1, (now - t0) / TWIRL_MS);
            const [theta, , y, rot, sx, sy] = sampleKeys(t);
            drawTurn(ctx, off, px, theta, bg);
            stage.style.opacity = t < 0.07 ? (t / 0.07).toFixed(3) : (t > 0.93 ? ((1 - t) / 0.07).toFixed(3) : '1');
            avatar.style.transform = 'translateY(' + y + 'px) rotate(' + rot + 'deg) scale(' + sx + ',' + sy + ')';
            if (t < 1) raf = requestAnimationFrame(frame); else cleanup();
        };
        raf = requestAnimationFrame(frame);
        setTimeout(cleanup, TWIRL_MS + 1200); // safety net

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

    let lastKnownOpen = null;
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

        if (lastKnownOpen === true && open === false) twirlWhenLanded();   // the X (or ⌘⌥I) just closed it
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
    window.__museInspectorEnhancement.isOpen = isInspectorOpen;
    window.__museInspectorEnhancement.isStockBeacon = () => { const a = document.querySelector(SEL.avatar); return !!a && isStockBeacon(a.firstElementChild || a); };
})();
